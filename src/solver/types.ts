/**
 * BharatSolve: Sovereign GPU-Accelerated Optimization Engine
 * Mathematical Types and Problem Definitions for LP, MILP, and QP
 */

export type VariableType = 'continuous' | 'integer' | 'binary';

export type ConstraintSense = '<=' | '>=' | '==';

export type SolverAlgorithm = 
  | 'auto'
  | 'revised_simplex_primal'
  | 'revised_simplex_dual'
  | 'interior_point_mehrotra'
  | 'branch_and_cut';

export type PricingStrategy = 'steepest_edge' | 'devex' | 'dantzig';

export type BranchingStrategy = 'pseudo_cost' | 'strong_branching' | 'most_fractional';

export type NodeSelectionStrategy = 'best_bound' | 'depth_first' | 'hybrid';

export interface SolverOptions {
  algorithm: SolverAlgorithm;
  pricing: PricingStrategy;
  branching: BranchingStrategy;
  nodeSelection: NodeSelectionStrategy;
  maxIterations: number;
  timeLimitMs: number;
  primalTolerance: number;
  dualTolerance: number;
  integralityTolerance: number;
  presolve: boolean;
  enableGpu: boolean;
  generateCuts: boolean;
  heuristics: boolean; // Feasibility Pump & Diving
  markowitzThreshold: number; // For LU stability, e.g. 0.1
}

export interface VariableDef {
  id: string;
  name: string;
  type: VariableType;
  lb: number; // Lower bound (default 0 or -Infinity)
  ub: number; // Upper bound (default Infinity)
  obj: number; // Objective coefficient
}

export interface ConstraintDef {
  id: string;
  name: string;
  sense: ConstraintSense;
  rhs: number;
  // Sparse representation: map from variable index to coefficient
  coefficients: { varIndex: number; coeff: number }[];
}

export interface OptimizationProblem {
  id: string;
  name: string;
  category: 'refinery' | 'power_grid' | 'logistics' | 'petrochemical' | 'agriculture' | 'netlib' | 'miplib' | 'mittelmann' | 'custom';
  description: string;
  direction: 'minimize' | 'maximize';
  isQuadratic: boolean;
  variables: VariableDef[];
  constraints: ConstraintDef[];
  // Optional quadratic objective matrix Q (for QP: min 0.5 x^T Q x + c^T x)
  // represented as sparse entries: { row: number, col: number, value: number }[]
  quadraticMatrix?: { row: number; col: number; value: number }[];
}

export type SolverStatus = 
  | 'optimal'
  | 'suboptimal'
  | 'infeasible'
  | 'unbounded'
  | 'time_limit'
  | 'iteration_limit'
  | 'numerical_error'
  | 'ready'
  | 'running';

export interface IterationTelemetry {
  iteration: number;
  primalObj: number;
  dualObj?: number;
  primalResidual: number;
  dualResidual: number;
  dualityGap?: number;
  stepSize?: number;
  basisCondition?: number;
  phase?: 1 | 2;
  activeNodes?: number;
  cutsAdded?: number;
  gpuAccelerated?: boolean;
}

export interface SolverResult {
  status: SolverStatus;
  objectiveValue: number;
  solution: number[]; // x values indexed by original variable indices
  dualVariables?: number[]; // y / pi values for constraints
  reducedCosts?: number[]; // d values for variables
  slacks?: number[];
  iterations: number;
  solveTimeMs: number;
  primalResidual: number;
  dualResidual: number;
  dualityGap: number;
  algorithmUsed: SolverAlgorithm;
  gpuActive: boolean;
  telemetry: IterationTelemetry[];
  branchTree?: TreeNodeInfo[];
  presolveStats?: {
    origVars: number;
    origCons: number;
    reducedVars: number;
    reducedCons: number;
    removedNonzeros: number;
  };
  mathematicalAudit: {
    primalFeasible: boolean;
    dualFeasible: boolean;
    complementaritySatisfied: boolean;
    integralitySatisfied: boolean;
    maxViolation: number;
    sovereignComplianceScore: number; // 0 to 100
  };
}

export interface TreeNodeInfo {
  id: number;
  parentId: number | null;
  depth: number;
  branchedVarName?: string;
  branchDirection?: '<=' | '>=';
  branchValue?: number;
  bound: number;
  status: 'active' | 'integer_feasible' | 'infeasible' | 'pruned_by_bound' | 'branched';
}

export interface BenchmarkComparisonEntry {
  problemName: string;
  category: string;
  rows: number;
  cols: number;
  nonzeros: number;
  isMip: boolean;
  cplexTime: number; // ms
  gurobiTime: number; // ms
  xpressTime: number; // ms
  highsTime: number; // ms
  bharatSolveCpuTime: number; // ms
  bharatSolveGpuTime: number; // ms
  optimalObjective: number;
  bharatSolveGap: number;
  notes: string;
}
