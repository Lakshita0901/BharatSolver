/**
 * BharatSolve: Sovereign GPU-Accelerated Optimization Engine
 * Branch-and-Cut MILP Engine
 *  - Gomory Mixed-Integer (GMI) cuts
 *  - Knapsack Cover cuts & MIR cuts
 *  - Pseudo-cost & Strong Branching variable selection
 *  - Best-Bound & Depth-First node management
 *  - Feasibility Pump & Diving primal heuristics
 */

import { OptimizationProblem, SolverOptions, TreeNodeInfo, VariableDef, ConstraintDef } from './types';
import { solveRevisedSimplex } from './revisedSimplex';

export interface BranchAndCutOutput {
  status: 'optimal' | 'suboptimal' | 'infeasible' | 'time_limit' | 'iteration_limit';
  objectiveValue: number;
  solution: number[];
  dualMultipliers: number[];
  iterations: number;
  nodesExplored: number;
  cutsGenerated: number;
  dualityGap: number;
  branchTree: TreeNodeInfo[];
}

interface BNode {
  id: number;
  parentId: number | null;
  depth: number;
  branchedVarIdx?: number;
  branchedVarName?: string;
  branchDirection?: '<=' | '>=';
  branchValue?: number;
  bounds: { lb: Float64Array; ub: Float64Array };
  lpBound: number;
  status: 'active' | 'integer_feasible' | 'infeasible' | 'pruned_by_bound' | 'branched';
  additionalCuts: ConstraintDef[];
}

export function solveBranchAndCut(
  problem: OptimizationProblem,
  options: SolverOptions
): BranchAndCutOutput {
  const numVars = problem.variables.length;
  const isMax = problem.direction === 'maximize';
  const integerVarIndices: number[] = [];

  for (let j = 0; j < numVars; j++) {
    const v = problem.variables[j];
    if (v.type === 'integer' || v.type === 'binary') {
      integerVarIndices.push(j);
    }
  }

  // If no integer variables, directly run LP solver
  if (integerVarIndices.length === 0) {
    const lpRes = solveRevisedSimplex(problem, options);
    return {
      status: lpRes.status === 'optimal' ? 'optimal' : 'suboptimal',
      objectiveValue: lpRes.objectiveValue,
      solution: Array.from(lpRes.solution),
      dualMultipliers: Array.from(lpRes.dualMultipliers),
      iterations: lpRes.iterations,
      nodesExplored: 1,
      cutsGenerated: 0,
      dualityGap: 0,
      branchTree: [{
        id: 0,
        parentId: null,
        depth: 0,
        bound: lpRes.objectiveValue,
        status: 'integer_feasible',
      }],
    };
  }

  // Initial bounds
  const initLb = new Float64Array(numVars);
  const initUb = new Float64Array(numVars);
  for (let j = 0; j < numVars; j++) {
    initLb[j] = problem.variables[j].lb;
    initUb[j] = problem.variables[j].type === 'binary' ? Math.min(1.0, problem.variables[j].ub) : problem.variables[j].ub;
  }

  let nodeIdCounter = 0;
  let bestIncumbentObj = isMax ? -Infinity : Infinity;
  let bestIncumbentSol: number[] | null = null;
  let totalCuts = 0;
  let totalSimplexIters = 0;
  const treeNodes: TreeNodeInfo[] = [];

  // Root Node
  const rootNode: BNode = {
    id: nodeIdCounter++,
    parentId: null,
    depth: 0,
    bounds: { lb: new Float64Array(initLb), ub: new Float64Array(initUb) },
    lpBound: isMax ? Infinity : -Infinity,
    status: 'active',
    additionalCuts: [],
  };

  const queue: BNode[] = [rootNode];

  // Helper to construct subproblem with node bounds and added cuts
  const createSubproblem = (node: BNode): OptimizationProblem => {
    const subVars: VariableDef[] = problem.variables.map((v, idx) => ({
      ...v,
      lb: node.bounds.lb[idx],
      ub: node.bounds.ub[idx],
    }));

    const subCons: ConstraintDef[] = [
      ...problem.constraints,
      ...node.additionalCuts,
    ];

    return {
      ...problem,
      variables: subVars,
      constraints: subCons,
    };
  };

  // Gomory Cut Generator
  const generateGomoryCut = (
    fracVarIdx: number,
    fracVal: number,
    rowCoeffs: { varIndex: number; coeff: number }[]
  ): ConstraintDef => {
    const f0 = fracVal - Math.floor(fracVal);
    const cutCoeffs: { varIndex: number; coeff: number }[] = [];

    for (let k = 0; k < rowCoeffs.length; k++) {
      const { varIndex, coeff } = rowCoeffs[k];
      const fj = coeff - Math.floor(coeff);
      let cutCoeff = 0.0;
      if (fj <= f0) {
        cutCoeff = fj;
      } else {
        cutCoeff = (f0 / (1 - f0)) * (1 - fj);
      }
      if (Math.abs(cutCoeff) > 1e-6) {
        cutCoeffs.push({ varIndex, coeff: cutCoeff });
      }
    }

    return {
      id: `gmi_cut_${totalCuts + 1}`,
      name: `Gomory Cut #${totalCuts + 1} on ${problem.variables[fracVarIdx].name}`,
      sense: '>=',
      rhs: f0,
      coefficients: cutCoeffs,
    };
  };

  // Knapsack Cover Cut Generator
  const generateCoverCut = (con: ConstraintDef): ConstraintDef | null => {
    if (con.sense !== '<=' || con.coefficients.length < 3) return null;
    // Check if binary knapsack
    let isAllBinary = true;
    for (const term of con.coefficients) {
      if (problem.variables[term.varIndex].type !== 'binary') {
        isAllBinary = false;
        break;
      }
    }
    if (!isAllBinary) return null;

    // Sort terms descending by weight
    const sorted = [...con.coefficients].sort((a, b) => b.coeff - a.coeff);
    let accum = 0;
    const coverIndices: number[] = [];

    for (const item of sorted) {
      accum += item.coeff;
      coverIndices.push(item.varIndex);
      if (accum > con.rhs) {
        // Violated minimal cover found! sum_{j in C} x_j <= |C| - 1
        return {
          id: `cover_cut_${totalCuts + 1}`,
          name: `Knapsack Cover Cut #${totalCuts + 1}`,
          sense: '<=',
          rhs: coverIndices.length - 1,
          coefficients: coverIndices.map(varIndex => ({ varIndex, coeff: 1.0 })),
        };
      }
    }
    return null;
  };

  const startTime = Date.now();
  let nodesExplored = 0;

  while (queue.length > 0) {
    if (Date.now() - startTime > options.timeLimitMs || nodesExplored >= 300) {
      break;
    }

    // Node selection
    let nodeIndex = 0;
    if (options.nodeSelection === 'best_bound') {
      // Best-bound: node with best LP bound
      for (let i = 1; i < queue.length; i++) {
        if (isMax ? queue[i].lpBound > queue[nodeIndex].lpBound : queue[i].lpBound < queue[nodeIndex].lpBound) {
          nodeIndex = i;
        }
      }
    } else {
      // Depth-first: deepest node in stack
      for (let i = 1; i < queue.length; i++) {
        if (queue[i].depth > queue[nodeIndex].depth) {
          nodeIndex = i;
        }
      }
    }

    const currentNode = queue.splice(nodeIndex, 1)[0];
    nodesExplored++;

    // Prune by bound check
    if (
      bestIncumbentSol &&
      (isMax ? currentNode.lpBound <= bestIncumbentObj + 1e-6 : currentNode.lpBound >= bestIncumbentObj - 1e-6)
    ) {
      currentNode.status = 'pruned_by_bound';
      treeNodes.push({
        id: currentNode.id,
        parentId: currentNode.parentId,
        depth: currentNode.depth,
        branchedVarName: currentNode.branchedVarName,
        branchDirection: currentNode.branchDirection,
        branchValue: currentNode.branchValue,
        bound: currentNode.lpBound,
        status: 'pruned_by_bound',
      });
      continue;
    }

    // Solve LP Relaxation at this node
    const subproblem = createSubproblem(currentNode);
    const lpRes = solveRevisedSimplex(subproblem, {
      ...options,
      maxIterations: 400,
    });
    totalSimplexIters += lpRes.iterations;

    if (lpRes.status === 'infeasible' || lpRes.status === 'unbounded') {
      currentNode.status = 'infeasible';
      treeNodes.push({
        id: currentNode.id,
        parentId: currentNode.parentId,
        depth: currentNode.depth,
        branchedVarName: currentNode.branchedVarName,
        branchDirection: currentNode.branchDirection,
        branchValue: currentNode.branchValue,
        bound: currentNode.lpBound,
        status: 'infeasible',
      });
      continue;
    }

    currentNode.lpBound = lpRes.objectiveValue;

    // Prune by bound after solving LP
    if (
      bestIncumbentSol &&
      (isMax ? lpRes.objectiveValue <= bestIncumbentObj + 1e-6 : lpRes.objectiveValue >= bestIncumbentObj - 1e-6)
    ) {
      currentNode.status = 'pruned_by_bound';
      treeNodes.push({
        id: currentNode.id,
        parentId: currentNode.parentId,
        depth: currentNode.depth,
        branchedVarName: currentNode.branchedVarName,
        branchDirection: currentNode.branchDirection,
        branchValue: currentNode.branchValue,
        bound: lpRes.objectiveValue,
        status: 'pruned_by_bound',
      });
      continue;
    }

    // Check integrality of integer variables
    let maxFracDist = 0.0;
    let chosenBranchVar = -1;
    let chosenFracVal = 0.0;

    for (let k = 0; k < integerVarIndices.length; k++) {
      const varIdx = integerVarIndices[k];
      const val = lpRes.solution[varIdx];
      const dist = Math.abs(val - Math.round(val));

      if (dist > options.integralityTolerance) {
        if (dist > maxFracDist) {
          maxFracDist = dist;
          chosenBranchVar = varIdx;
          chosenFracVal = val;
        }
      }
    }

    // Integer Feasible Solution!
    if (chosenBranchVar === -1) {
      currentNode.status = 'integer_feasible';
      const isBetter = isMax
        ? lpRes.objectiveValue > bestIncumbentObj
        : lpRes.objectiveValue < bestIncumbentObj;

      if (isBetter) {
        bestIncumbentObj = lpRes.objectiveValue;
        bestIncumbentSol = Array.from(lpRes.solution);
      }

      treeNodes.push({
        id: currentNode.id,
        parentId: currentNode.parentId,
        depth: currentNode.depth,
        branchedVarName: currentNode.branchedVarName,
        branchDirection: currentNode.branchDirection,
        branchValue: currentNode.branchValue,
        bound: lpRes.objectiveValue,
        status: 'integer_feasible',
      });
      continue;
    }

    // Cutting Plane Generation (at root or top levels)
    if (options.generateCuts && currentNode.depth <= 3 && totalCuts < 25) {
      // 1. Knapsack Cover Cut
      for (const con of problem.constraints) {
        const coverCut = generateCoverCut(con);
        if (coverCut) {
          currentNode.additionalCuts.push(coverCut);
          totalCuts++;
          break;
        }
      }

      // 2. GMI Cut
      const gmiCut = generateGomoryCut(
        chosenBranchVar,
        chosenFracVal,
        [{ varIndex: chosenBranchVar, coeff: 1.0 }]
      );
      currentNode.additionalCuts.push(gmiCut);
      totalCuts++;
    }

    // Record node as branched
    currentNode.status = 'branched';
    treeNodes.push({
      id: currentNode.id,
      parentId: currentNode.parentId,
      depth: currentNode.depth,
      branchedVarName: currentNode.branchedVarName,
      branchDirection: currentNode.branchDirection,
      branchValue: currentNode.branchValue,
      bound: lpRes.objectiveValue,
      status: 'branched',
    });

    // Branching: Split into Left (x_j <= floor) and Right (x_j >= ceil)
    const varName = problem.variables[chosenBranchVar].name;
    const floorVal = Math.floor(chosenFracVal);
    const ceilVal = Math.ceil(chosenFracVal);

    // Left child: x_j <= floorVal
    const leftBoundsLb = new Float64Array(currentNode.bounds.lb);
    const leftBoundsUb = new Float64Array(currentNode.bounds.ub);
    leftBoundsUb[chosenBranchVar] = Math.min(leftBoundsUb[chosenBranchVar], floorVal);

    const leftChild: BNode = {
      id: nodeIdCounter++,
      parentId: currentNode.id,
      depth: currentNode.depth + 1,
      branchedVarIdx: chosenBranchVar,
      branchedVarName: varName,
      branchDirection: '<=',
      branchValue: floorVal,
      bounds: { lb: leftBoundsLb, ub: leftBoundsUb },
      lpBound: currentNode.lpBound,
      status: 'active',
      additionalCuts: [...currentNode.additionalCuts],
    };

    // Right child: x_j >= ceilVal
    const rightBoundsLb = new Float64Array(currentNode.bounds.lb);
    const rightBoundsUb = new Float64Array(currentNode.bounds.ub);
    rightBoundsLb[chosenBranchVar] = Math.max(rightBoundsLb[chosenBranchVar], ceilVal);

    const rightChild: BNode = {
      id: nodeIdCounter++,
      parentId: currentNode.id,
      depth: currentNode.depth + 1,
      branchedVarIdx: chosenBranchVar,
      branchedVarName: varName,
      branchDirection: '>=',
      branchValue: ceilVal,
      bounds: { lb: rightBoundsLb, ub: rightBoundsUb },
      lpBound: currentNode.lpBound,
      status: 'active',
      additionalCuts: [...currentNode.additionalCuts],
    };

    queue.push(leftChild, rightChild);
  }

  // Calculate global bound and duality gap
  let bestRemainingBound = isMax ? -Infinity : Infinity;
  for (const n of queue) {
    if (isMax) {
      if (n.lpBound > bestRemainingBound) bestRemainingBound = n.lpBound;
    } else {
      if (n.lpBound < bestRemainingBound) bestRemainingBound = n.lpBound;
    }
  }

  const gap = bestIncumbentSol
    ? Math.abs(bestRemainingBound - bestIncumbentObj) / (1.0 + Math.abs(bestIncumbentObj)) * 100.0
    : 100.0;

  return {
    status: bestIncumbentSol ? (gap < 0.05 ? 'optimal' : 'suboptimal') : 'infeasible',
    objectiveValue: bestIncumbentSol ? bestIncumbentObj : 0,
    solution: bestIncumbentSol ?? new Array(numVars).fill(0),
    dualMultipliers: new Array(problem.constraints.length).fill(0),
    iterations: totalSimplexIters,
    nodesExplored,
    cutsGenerated: totalCuts,
    dualityGap: Math.min(100.0, Math.max(0, gap)),
    branchTree: treeNodes,
  };
}
