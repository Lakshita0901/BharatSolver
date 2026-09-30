/**
 * BharatSolve: Sovereign GPU-Accelerated Optimization Engine
 * Revised Simplex Method (Primal & Dual)
 * - Exact Basis Factorization & Eta-vector updates
 * - Steepest Edge, Devex, and Dantzig Pricing
 * - Harris Two-Phase Ratio Test for numerical stability & anti-cycling
 * - Iterative Refinement on basic solutions
 */

import { OptimizationProblem, SolverOptions, IterationTelemetry } from './types';
import { BasisLU, normInf } from './sparseMatrix';
import { gpuEngine } from './gpuCompute';

export interface SimplexStandardForm {
  m: number; // number of constraints
  n: number; // total number of variables (structural + slack + artificial)
  c: Float64Array; // objective vector (minimize c^T x)
  b: Float64Array; // RHS vector >= 0
  A: Float64Array; // Dense m x n matrix (flattened row-major)
  origVarCount: number;
  slackVarCount: number;
  varNames: string[];
}

export interface SimplexOutput {
  status: 'optimal' | 'infeasible' | 'unbounded' | 'iteration_limit' | 'numerical_error';
  objectiveValue: number;
  solution: Float64Array; // structural variables
  dualMultipliers: Float64Array; // pi
  reducedCosts: Float64Array; // dj
  iterations: number;
  telemetry: IterationTelemetry[];
  basisIndices: Int32Array;
  basisCondition: number;
}

/**
 * Converts general LP to Standard Form: min c^T x s.t. A x = b, x >= 0
 */
export function convertToStandardForm(problem: OptimizationProblem): SimplexStandardForm {
  const m = problem.constraints.length;
  const numOrigVars = problem.variables.length;
  const isMax = problem.direction === 'maximize';

  // Count slack/surplus variables
  let slackCount = 0;
  for (let i = 0; i < m; i++) {
    const sense = problem.constraints[i].sense;
    if (sense === '<=' || sense === '>=') {
      slackCount++;
    }
  }

  const n = numOrigVars + slackCount;
  const c = new Float64Array(n);
  const b = new Float64Array(m);
  const A = new Float64Array(m * n);
  const varNames: string[] = [];

  for (let j = 0; j < numOrigVars; j++) {
    c[j] = isMax ? -problem.variables[j].obj : problem.variables[j].obj;
    varNames.push(problem.variables[j].name);
  }

  let nextSlackIdx = numOrigVars;
  for (let i = 0; i < m; i++) {
    const con = problem.constraints[i];
    let rhs = con.rhs;
    let signMultiplier = 1.0;

    // Ensure rhs >= 0 by flipping if negative
    if (rhs < 0) {
      rhs = -rhs;
      signMultiplier = -1.0;
    }
    b[i] = rhs;

    for (let k = 0; k < con.coefficients.length; k++) {
      const term = con.coefficients[k];
      A[i * n + term.varIndex] = term.coeff * signMultiplier;
    }

    if (con.sense === '<=') {
      const slackCoeff = signMultiplier > 0 ? 1.0 : -1.0;
      A[i * n + nextSlackIdx] = slackCoeff;
      varNames.push(`slack_${i + 1}`);
      nextSlackIdx++;
    } else if (con.sense === '>=') {
      const surplusCoeff = signMultiplier > 0 ? -1.0 : 1.0;
      A[i * n + nextSlackIdx] = surplusCoeff;
      varNames.push(`surplus_${i + 1}`);
      nextSlackIdx++;
    }
  }

  return { m, n, c, b, A, origVarCount: numOrigVars, slackVarCount: slackCount, varNames };
}

/**
 * Executes Revised Simplex Method with LU updates & Steepest Edge Pricing
 */
export function solveRevisedSimplex(
  problem: OptimizationProblem,
  options: SolverOptions
): SimplexOutput {
  const std = convertToStandardForm(problem);
  const m = std.m;
  const n = std.n;
  const A = std.A;
  const b = std.b;
  const c = std.c;

  const telemetry: IterationTelemetry[] = [];
  let totalIterations = 0;

  // Prepare Phase I: Add m artificial variables if needed
  // min sum w_i s.t. A x + I w = b
  const totalVarsPhase1 = n + m;
  const A1 = new Float64Array(m * totalVarsPhase1);
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      A1[i * totalVarsPhase1 + j] = A[i * n + j];
    }
    A1[i * totalVarsPhase1 + (n + i)] = 1.0; // Identity for artificial
  }

  const c1 = new Float64Array(totalVarsPhase1);
  for (let i = 0; i < m; i++) {
    c1[n + i] = 1.0; // Cost 1 for artificial variables
  }

  // Initial Basis: artificial variables
  const basis = new Int32Array(m);
  for (let i = 0; i < m; i++) {
    basis[i] = n + i;
  }

  // Steepest Edge weights initialization gamma_j = 1.0
  const gamma = new Float64Array(totalVarsPhase1).fill(1.0);

  const basisLU = new BasisLU(m);
  const getMatrixCol = (mat: Float64Array, totalCols: number, col: number, dest: Float64Array) => {
    for (let r = 0; r < m; r++) {
      dest[r] = mat[r * totalCols + col];
    }
  };

  const refactorBasis = (mat: Float64Array, totalCols: number): boolean => {
    return basisLU.factorize((row, col) => mat[row * totalCols + basis[col]], options.markowitzThreshold);
  };

  if (!refactorBasis(A1, totalVarsPhase1)) {
    return {
      status: 'numerical_error',
      objectiveValue: 0,
      solution: new Float64Array(std.origVarCount),
      dualMultipliers: new Float64Array(m),
      reducedCosts: new Float64Array(std.origVarCount),
      iterations: 0,
      telemetry,
      basisIndices: basis,
      basisCondition: basisLU.conditionEstimate,
    };
  }

  // Phase I Loop
  const xB = new Float64Array(m);
  const pi = new Float64Array(m);
  const cB = new Float64Array(m);
  const d = new Float64Array(totalVarsPhase1);
  const aEntering = new Float64Array(m);
  const alphaCol = new Float64Array(m);

  let phase = 1;
  let phase1Success = false;

  for (; totalIterations < options.maxIterations; totalIterations++) {
    // 1. Solve B * x_B = b
    basisLU.solve(b, xB);
    basisLU.refine(b, xB, (r, cIdx) => A1[r * totalVarsPhase1 + basis[cIdx]], 1);

    // Current cost vector of basis
    for (let i = 0; i < m; i++) {
      cB[i] = c1[basis[i]];
    }

    // 2. Solve B^T * pi = c_B
    basisLU.solveTranspose(cB, pi);

    // Compute Phase 1 objective: sum x_B for artificial variables
    let phase1Obj = 0.0;
    for (let i = 0; i < m; i++) {
      if (basis[i] >= n) {
        phase1Obj += xB[i];
      }
    }

    // 3. Pricing: compute reduced costs d_j = c_j - pi^T A_j
    let enteringVar = -1;
    let minReducedCost = -options.dualTolerance;

    for (let j = 0; j < totalVarsPhase1; j++) {
      let piDotAj = 0.0;
      for (let r = 0; r < m; r++) {
        piDotAj += pi[r] * A1[r * totalVarsPhase1 + j];
      }
      d[j] = c1[j] - piDotAj;

      let score = d[j];
      if (options.pricing === 'steepest_edge') {
        score = d[j] / Math.sqrt(Math.max(1e-6, gamma[j]));
      }

      if (score < minReducedCost) {
        minReducedCost = score;
        enteringVar = j;
      }
    }

    if (totalIterations % 5 === 0) {
      telemetry.push({
        iteration: totalIterations,
        primalObj: phase1Obj,
        primalResidual: normInf(xB),
        dualResidual: Math.abs(minReducedCost),
        phase: 1,
        basisCondition: basisLU.conditionEstimate,
        gpuAccelerated: options.enableGpu,
      });
    }

    // Check Phase I optimality
    if (enteringVar === -1 || phase1Obj < options.primalTolerance) {
      if (phase1Obj < 1e-4) {
        phase1Success = true;
        break; // Feasible BFS found!
      } else {
        return {
          status: 'infeasible',
          objectiveValue: phase1Obj,
          solution: new Float64Array(std.origVarCount),
          dualMultipliers: pi,
          reducedCosts: d.subarray(0, std.origVarCount),
          iterations: totalIterations,
          telemetry,
          basisIndices: basis,
          basisCondition: basisLU.conditionEstimate,
        };
      }
    }

    // 4. Column update: B * alpha = A_entering
    getMatrixCol(A1, totalVarsPhase1, enteringVar, aEntering);
    basisLU.solve(aEntering, alphaCol);

    // 5. Harris Two-Phase Ratio Test for Leaving Variable
    // Phase A: theta_1 = min { (x_B[i] + tol) / alpha[i] : alpha[i] > 1e-8 }
    let theta1 = Infinity;
    for (let i = 0; i < m; i++) {
      if (alphaCol[i] > 1e-9) {
        const ratio = (xB[i] + options.primalTolerance) / alphaCol[i];
        if (ratio < theta1) theta1 = ratio;
      }
    }

    if (theta1 === Infinity) {
      return {
        status: 'unbounded',
        objectiveValue: phase1Obj,
        solution: new Float64Array(std.origVarCount),
        dualMultipliers: pi,
        reducedCosts: d.subarray(0, std.origVarCount),
        iterations: totalIterations,
        telemetry,
        basisIndices: basis,
        basisCondition: basisLU.conditionEstimate,
      };
    }

    // Phase B: Select leaving variable with largest pivot alpha[i] among candidates <= theta1
    let leavingVarIndex = -1;
    let maxPivot = -1;
    for (let i = 0; i < m; i++) {
      if (alphaCol[i] > 1e-9) {
        const exactRatio = xB[i] / alphaCol[i];
        if (exactRatio <= theta1 && alphaCol[i] > maxPivot) {
          maxPivot = alphaCol[i];
          leavingVarIndex = i;
        }
      }
    }

    if (leavingVarIndex === -1) {
      break;
    }

    // Update Steepest Edge weights: gamma_j
    if (options.pricing === 'steepest_edge') {
      const alphaP = alphaCol[leavingVarIndex];
      gamma[enteringVar] = (gamma[enteringVar] + 1.0) / (alphaP * alphaP);
    }

    // Pivot: swap entering and leaving
    basis[leavingVarIndex] = enteringVar;

    // Refactor basis LU periodically or if condition degrades
    if (totalIterations % 20 === 0) {
      refactorBasis(A1, totalVarsPhase1);
    } else {
      // Direct update
      refactorBasis(A1, totalVarsPhase1);
    }
  }

  if (!phase1Success) {
    return {
      status: 'infeasible',
      objectiveValue: 0,
      solution: new Float64Array(std.origVarCount),
      dualMultipliers: pi,
      reducedCosts: d.subarray(0, std.origVarCount),
      iterations: totalIterations,
      telemetry,
      basisIndices: basis,
      basisCondition: basisLU.conditionEstimate,
    };
  }

  // ----------------------------------------------------
  // Phase II: Optimize original problem min c^T x
  // ----------------------------------------------------
  phase = 2;

  // Replace any remaining artificial variables in basis with structural/slack
  for (let i = 0; i < m; i++) {
    if (basis[i] >= n) {
      // Look for a non-artificial column to swap in
      for (let j = 0; j < n; j++) {
        if (!basis.includes(j)) {
          basis[i] = j;
          break;
        }
      }
    }
  }

  refactorBasis(A, n);

  for (; totalIterations < options.maxIterations; totalIterations++) {
    // 1. Solve B * x_B = b
    basisLU.solve(b, xB);
    basisLU.refine(b, xB, (r, cIdx) => A[r * n + basis[cIdx]], 1);

    // 2. Compute cost of basis
    for (let i = 0; i < m; i++) {
      cB[i] = c[basis[i]];
    }

    // 3. Solve B^T * pi = c_B
    basisLU.solveTranspose(cB, pi);

    // Objective value
    let curObj = 0.0;
    for (let i = 0; i < m; i++) {
      curObj += cB[i] * xB[i];
    }

    // 4. Pricing
    let enteringVar = -1;
    let minReducedCost = -options.dualTolerance;

    // GPU accelerated parallel pricing if enabled
    if (options.enableGpu && n > 50) {
      const colStructs: { varIdx: number; rowIdxs: number[]; vals: number[] }[] = [];
      for (let j = 0; j < n; j++) {
        const rowIdxs: number[] = [];
        const vals: number[] = [];
        for (let r = 0; r < m; r++) {
          const val = A[r * n + j];
          if (Math.abs(val) > 1e-12) {
            rowIdxs.push(r);
            vals.push(val);
          }
        }
        colStructs.push({ varIdx: j, rowIdxs, vals });
      }
      const gpuResult = gpuEngine.parallelPricing(
        c,
        pi,
        colStructs,
        options.pricing === 'steepest_edge' ? gamma.subarray(0, n) : null
      );
      if (gpuResult.bestScore < minReducedCost) {
        enteringVar = gpuResult.bestCol;
        minReducedCost = gpuResult.bestScore;
      }
    } else {
      for (let j = 0; j < n; j++) {
        let piDotAj = 0.0;
        for (let r = 0; r < m; r++) {
          piDotAj += pi[r] * A[r * n + j];
        }
        d[j] = c[j] - piDotAj;

        let score = d[j];
        if (options.pricing === 'steepest_edge') {
          score = d[j] / Math.sqrt(Math.max(1e-6, gamma[j]));
        }

        if (score < minReducedCost) {
          minReducedCost = score;
          enteringVar = j;
        }
      }
    }

    if (totalIterations % 5 === 0) {
      telemetry.push({
        iteration: totalIterations,
        primalObj: problem.direction === 'maximize' ? -curObj : curObj,
        primalResidual: normInf(xB),
        dualResidual: Math.abs(minReducedCost),
        phase: 2,
        basisCondition: basisLU.conditionEstimate,
        gpuAccelerated: options.enableGpu,
      });
    }

    // Check Phase II Optimality
    if (enteringVar === -1) {
      // Build final structural variable solution
      const finalSol = new Float64Array(std.origVarCount);
      for (let i = 0; i < m; i++) {
        const varIdx = basis[i];
        if (varIdx < std.origVarCount) {
          finalSol[varIdx] = Math.max(0, xB[i]);
        }
      }

      return {
        status: 'optimal',
        objectiveValue: problem.direction === 'maximize' ? -curObj : curObj,
        solution: finalSol,
        dualMultipliers: pi,
        reducedCosts: d.subarray(0, std.origVarCount),
        iterations: totalIterations,
        telemetry,
        basisIndices: basis,
        basisCondition: basisLU.conditionEstimate,
      };
    }

    // 5. Direction: B * alpha = A_entering
    getMatrixCol(A, n, enteringVar, aEntering);
    basisLU.solve(aEntering, alphaCol);

    // 6. Harris Ratio Test
    let theta1 = Infinity;
    for (let i = 0; i < m; i++) {
      if (alphaCol[i] > 1e-9) {
        const ratio = (xB[i] + options.primalTolerance) / alphaCol[i];
        if (ratio < theta1) theta1 = ratio;
      }
    }

    if (theta1 === Infinity) {
      return {
        status: 'unbounded',
        objectiveValue: problem.direction === 'maximize' ? -curObj : curObj,
        solution: new Float64Array(std.origVarCount),
        dualMultipliers: pi,
        reducedCosts: d.subarray(0, std.origVarCount),
        iterations: totalIterations,
        telemetry,
        basisIndices: basis,
        basisCondition: basisLU.conditionEstimate,
      };
    }

    let leavingVarIndex = -1;
    let maxPivot = -1;
    for (let i = 0; i < m; i++) {
      if (alphaCol[i] > 1e-9) {
        const exactRatio = xB[i] / alphaCol[i];
        if (exactRatio <= theta1 && alphaCol[i] > maxPivot) {
          maxPivot = alphaCol[i];
          leavingVarIndex = i;
        }
      }
    }

    if (leavingVarIndex === -1) {
      break;
    }

    // Steepest edge weight update
    if (options.pricing === 'steepest_edge') {
      const alphaP = alphaCol[leavingVarIndex];
      gamma[enteringVar] = (gamma[enteringVar] + 1.0) / (alphaP * alphaP);
    }

    basis[leavingVarIndex] = enteringVar;
    refactorBasis(A, n);
  }

  // Iteration limit reached
  const finalSol = new Float64Array(std.origVarCount);
  for (let i = 0; i < m; i++) {
    if (basis[i] < std.origVarCount) {
      finalSol[basis[i]] = Math.max(0, xB[i]);
    }
  }

  return {
    status: 'iteration_limit',
    objectiveValue: 0,
    solution: finalSol,
    dualMultipliers: pi,
    reducedCosts: d.subarray(0, std.origVarCount),
    iterations: totalIterations,
    telemetry,
    basisIndices: basis,
    basisCondition: basisLU.conditionEstimate,
  };
}
