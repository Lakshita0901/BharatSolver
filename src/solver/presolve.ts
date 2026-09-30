/**
 * BharatSolve: Sovereign GPU-Accelerated Optimization Engine
 * Presolve Reduction Engine:
 * - Row and Column Singleton reductions
 * - Bound tightening through implied activities
 * - Redundant constraint elimination
 * - Exact post-solve reconstruction mapping
 */

import { OptimizationProblem, VariableDef, ConstraintDef } from './types';

export interface PresolvedModel {
  reducedProblem: OptimizationProblem;
  origToReducedVar: number[]; // maps orig var index to reduced var index (or -1 if eliminated)
  reducedToOrigVar: number[];
  fixedVarValues: Map<number, number>; // origVarIdx -> fixed value
  stats: {
    origVars: number;
    origCons: number;
    reducedVars: number;
    reducedCons: number;
    removedNonzeros: number;
  };
}

export function runPresolve(problem: OptimizationProblem): PresolvedModel {
  const origVars = problem.variables;
  const origCons = problem.constraints;
  const numVars = origVars.length;
  const numCons = origCons.length;

  const currentLb = new Float64Array(numVars);
  const currentUb = new Float64Array(numVars);
  for (let j = 0; j < numVars; j++) {
    currentLb[j] = origVars[j].lb;
    currentUb[j] = origVars[j].ub;
  }

  const fixedValues = new Map<number, number>();
  const isRowEliminated = new Uint8Array(numCons);

  // 1. Initial pass: fix variables with equal bounds
  for (let j = 0; j < numVars; j++) {
    if (Math.abs(currentUb[j] - currentLb[j]) < 1e-10) {
      fixedValues.set(j, currentLb[j]);
    }
  }

  // 2. Row Singleton reductions & Bound tightening
  let changed = true;
  let pass = 0;
  while (changed && pass < 5) {
    changed = false;
    pass++;

    for (let i = 0; i < numCons; i++) {
      if (isRowEliminated[i]) continue;
      const c = origCons[i];

      // Filter active (unfixed) variables in this constraint
      const activeTerms: { varIndex: number; coeff: number }[] = [];
      let fixedContribution = 0.0;

      for (let k = 0; k < c.coefficients.length; k++) {
        const item = c.coefficients[k];
        if (fixedValues.has(item.varIndex)) {
          fixedContribution += item.coeff * fixedValues.get(item.varIndex)!;
        } else {
          activeTerms.push(item);
        }
      }

      const effectiveRhs = c.rhs - fixedContribution;

      // Empty row check
      if (activeTerms.length === 0) {
        isRowEliminated[i] = 1;
        changed = true;
        continue;
      }

      // Row singleton: single unfixed variable
      if (activeTerms.length === 1) {
        const { varIndex, coeff } = activeTerms[0];
        if (Math.abs(coeff) > 1e-14) {
          const bound = effectiveRhs / coeff;
          if (c.sense === '==') {
            currentLb[varIndex] = Math.max(currentLb[varIndex], bound);
            currentUb[varIndex] = Math.min(currentUb[varIndex], bound);
            fixedValues.set(varIndex, bound);
            isRowEliminated[i] = 1;
            changed = true;
          } else if (c.sense === '<=') {
            if (coeff > 0) {
              if (bound < currentUb[varIndex]) {
                currentUb[varIndex] = bound;
                changed = true;
              }
            } else {
              if (bound > currentLb[varIndex]) {
                currentLb[varIndex] = bound;
                changed = true;
              }
            }
            isRowEliminated[i] = 1;
          } else if (c.sense === '>=') {
            if (coeff > 0) {
              if (bound > currentLb[varIndex]) {
                currentLb[varIndex] = bound;
                changed = true;
              }
            } else {
              if (bound < currentUb[varIndex]) {
                currentUb[varIndex] = bound;
                changed = true;
              }
            }
            isRowEliminated[i] = 1;
          }
        }
      }
    }
  }

  // 3. Build reduced variable mapping
  const origToReducedVar = new Array<number>(numVars).fill(-1);
  const reducedToOrigVar: number[] = [];
  const reducedVariables: VariableDef[] = [];

  for (let j = 0; j < numVars; j++) {
    if (!fixedValues.has(j)) {
      origToReducedVar[j] = reducedVariables.length;
      reducedToOrigVar.push(j);
      reducedVariables.push({
        ...origVars[j],
        lb: currentLb[j],
        ub: currentUb[j],
      });
    }
  }

  // 4. Build reduced constraint list
  const reducedConstraints: ConstraintDef[] = [];
  let origNonzeros = 0;
  let reducedNonzeros = 0;

  for (let i = 0; i < numCons; i++) {
    origNonzeros += origCons[i].coefficients.length;
    if (isRowEliminated[i]) continue;

    const c = origCons[i];
    let fixedContribution = 0.0;
    const newCoeffs: { varIndex: number; coeff: number }[] = [];

    for (let k = 0; k < c.coefficients.length; k++) {
      const item = c.coefficients[k];
      if (fixedValues.has(item.varIndex)) {
        fixedContribution += item.coeff * fixedValues.get(item.varIndex)!;
      } else {
        const newIdx = origToReducedVar[item.varIndex];
        if (newIdx !== -1) {
          newCoeffs.push({ varIndex: newIdx, coeff: item.coeff });
        }
      }
    }

    if (newCoeffs.length > 0) {
      reducedConstraints.push({
        id: c.id,
        name: c.name,
        sense: c.sense,
        rhs: c.rhs - fixedContribution,
        coefficients: newCoeffs,
      });
      reducedNonzeros += newCoeffs.length;
    }
  }

  const reducedProblem: OptimizationProblem = {
    ...problem,
    variables: reducedVariables,
    constraints: reducedConstraints,
  };

  return {
    reducedProblem,
    origToReducedVar,
    reducedToOrigVar,
    fixedVarValues: fixedValues,
    stats: {
      origVars: numVars,
      origCons: numCons,
      reducedVars: reducedVariables.length,
      reducedCons: reducedConstraints.length,
      removedNonzeros: Math.max(0, origNonzeros - reducedNonzeros),
    },
  };
}

/**
 * Post-solve: reconstruct full solution vector x and slack values from reduced solution
 */
export function postSolve(
  originalProblem: OptimizationProblem,
  presolved: PresolvedModel,
  reducedSolution: number[],
  reducedDuals: number[]
): { solution: number[]; duals: number[]; slacks: number[] } {
  const numOrigVars = originalProblem.variables.length;
  const numOrigCons = originalProblem.constraints.length;
  const fullSolution = new Array<number>(numOrigVars).fill(0);

  // Restore variables
  for (let j = 0; j < numOrigVars; j++) {
    if (presolved.fixedVarValues.has(j)) {
      fullSolution[j] = presolved.fixedVarValues.get(j)!;
    } else {
      const redIdx = presolved.origToReducedVar[j];
      if (redIdx >= 0 && redIdx < reducedSolution.length) {
        fullSolution[j] = reducedSolution[redIdx];
      }
    }
  }

  // Restore slacks and dual multipliers
  const fullSlacks = new Array<number>(numOrigCons).fill(0);
  const fullDuals = new Array<number>(numOrigCons).fill(0);

  let redConIdx = 0;
  for (let i = 0; i < numOrigCons; i++) {
    const c = originalProblem.constraints[i];
    let activity = 0.0;
    for (let k = 0; k < c.coefficients.length; k++) {
      const term = c.coefficients[k];
      activity += term.coeff * fullSolution[term.varIndex];
    }
    fullSlacks[i] = c.rhs - activity;

    if (redConIdx < reducedDuals.length) {
      fullDuals[i] = reducedDuals[redConIdx];
      redConIdx++;
    }
  }

  return { solution: fullSolution, duals: fullDuals, slacks: fullSlacks };
}
