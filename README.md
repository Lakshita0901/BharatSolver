# BharatSolve: Sovereign Optimization Engine

**Smart India Hackathon 2026 | Problem Statement 26119 | Team ManoRaksha (Team ID 149543)**  
*Indigenous GPU-Accelerated Optimization Solver: a sovereign alternative to Xpress / CPLEX*

> [!NOTE]  
> **Status: Phase 1 prototype (reference implementation + demo console)**  
> This repository validates the solver architecture, the algorithm set, and the audit workflow on small models. It is not a production solver, and it has not been benchmarked against CPLEX, Gurobi, Xpress, or HiGHS. See [Limitations](#4-limitations-read-this-first) and the [Roadmap](#5-roadmap).

---

## 1. Why this project exists

Refinery scheduling, crude blending, power dispatch, logistics, and supply-chain planning in India depend on a handful of foreign, closed-source optimization solvers (IBM CPLEX, Gurobi, FICO Xpress). They carry recurring licence costs, and their internals cannot be inspected or modified. Open-source solvers (HiGHS, CBC, GLPK, SCIP) help, but still lag commercial solvers on several classes of large mixed-integer problems.

**BharatSolve** aims to be a transparent, extensible, sovereign solver core, written from mathematical foundations, with no existing solver library underneath. It is a solver core, not a modelling environment.

---

## 2. Scope (per the problem statement)

| Area | Target | Phase 1 Status |
| :--- | :--- | :--- |
| **Linear Programming (LP)** | Revised simplex, interior point | Reference implementation |
| **Mixed-Integer LP (MILP)** | Branch-and-bound / branch-and-cut, presolve, cuts, heuristics | Basic branch-and-cut |
| **Quadratic Programming (QP)** | Convex QP via interior point | Separable (diagonal $Q$) only |
| **MIQP, NLP, MINLP** | Modular extension | Planned |
| **Sparse linear algebra** | Sparse LU, sparse Cholesky | Partial (CSR in interior point) |
| **Multi-core parallelism** | Parallel B&B and pricing | Planned |
| **GPU acceleration** | Sparse kernels where measurable | Planned (not active) |
| **Benchmarks** | MIPLIB, Netlib, Mittelmann, QPLIB | Planned (Phase 2) |

---

## 3. What is implemented (Phase 1)

All solver code is in `src/solver/` and is written in TypeScript with no third-party numerical or solver libraries.

| Module | File | What it does |
| :--- | :--- | :--- |
| **Problem types** | [`src/solver/types.ts`](src/solver/types.ts) | LP / MILP / QP model definition, solver options, telemetry, and result types |
| **Orchestrator + audit** | [`src/solver/solverEngine.ts`](src/solver/solverEngine.ts) | Algorithm auto-selection, presolve, dispatch, post-solve, mathematical audit |
| **Presolve** | [`src/solver/presolve.ts`](src/solver/presolve.ts) | Fixed-variable removal, row singletons, bound tightening, redundant-row removal, post-solve mapping |
| **Revised simplex** | [`src/solver/revisedSimplex.ts`](src/solver/revisedSimplex.ts) | Two-phase primal simplex, Harris ratio test, steepest-edge pricing, iterative refinement |
| **Interior point** | [`src/solver/interiorPoint.ts`](src/solver/interiorPoint.ts) | Mehrotra predictor-corrector, Lustig-Marsten-Shanno-style start, diagonal-$Q$ QP |
| **Branch-and-cut** | [`src/solver/branchAndCut.ts`](src/solver/branchAndCut.ts) | Branch-and-bound with pseudo-cost / most-fractional branching, best-bound / depth-first / hybrid node selection, Gomory mixed-integer and knapsack-cover cuts |
| **Sparse / dense linear algebra** | [`src/solver/sparseMatrix.ts`](src/solver/sparseMatrix.ts) | CSR matrices, LU with Markowitz-style threshold pivoting, preconditioned CG for normal equations |
| **GPU layer (placeholder)** | [`src/solver/gpuCompute.ts`](src/solver/gpuCompute.ts) | Detects a WebGL2 context; kernels currently run as CPU loops |
| **Demo models** | [`src/solver/benchmarks.ts`](src/solver/benchmarks.ts) | 8 small demo models and a benchmark comparison table (illustrative, see below) |

### Mathematical audit and Sovereign Compliance Score

After every solve, `performMathematicalAudit` (in [`src/solver/solverEngine.ts`](src/solver/solverEngine.ts)) re-checks the returned solution against the original (un-presolved) model:
- Variable bounds and constraint feasibility,
- Integrality of integer and binary variables,
- A 0–100 **Sovereign Compliance Score** derived from the worst violation.

> [!WARNING]  
> **Current limitation:** Dual feasibility and complementary slackness are not yet independently computed. The audit reports them as satisfied by default. A full audit (dual feasibility, complementarity, duality gap) is a Phase 2 deliverable.

### Demo console

A React + Vite console (`src/components/`) for exploring the solver:
- **Solver Console:** Pick a model, algorithm, pricing rule, presolve, and cut options; run and inspect the solution.
- **Matrix Sparsity:** View the constraint-matrix structure.
- **Convergence & Tree:** Iteration telemetry and the branch-and-bound tree.
- **Commercial Benchmarks:** Illustrative comparison table (see [Limitations](#4-limitations-read-this-first)).
- **Sovereign Audit:** The audit checks and score.
- **C++ / Python SDK:** Generates example SDK code for a model (code text export only; there is no installable SDK yet).

### Demo models

Eight small models, used to validate the workflow:

| Domain | Type | Notes |
| :--- | :--- | :--- |
| **Refinery crude blending** | LP | Representative model, product-spec constraints |
| **Power grid inter-regional dispatch** | LP | Representative model |
| **Freight rake allocation** | MILP | Representative model |
| **Petrochemical multi-feed cracker** | Convex QP | Representative model (diagonal $Q$) |
| **Multi-plant fertiliser dispatch** | LP | Representative model |
| **Netlib AFIRO** | LP | Classic test problem |
| **Klee-Minty cube (6-D)** | LP | Simplex worst-case stress test |
| **MIPLIB STEIN27** | Binary MILP | Set-covering style problem |

*Note: The sector models are representative models built from open-literature structures, with synthetic data where industrial data is unavailable. They are not real plant data.*

---

## 4. Limitations (read this first)

This is a Phase 1 prototype. Be aware of the following:

- **Small scale only:** The 8 demo models have 56 variables and 45 constraints in total. Nothing in this repository demonstrates thousands or millions of variables yet.
- **Dense internals in simplex:** The simplex path stores the constraint matrix and basis factorization densely and refactorizes the basis every iteration. It will not scale. A sparse LU with Forrest-Tomlin updates is a Phase 2 item.
- **No measured benchmarks:** The "Commercial Benchmarks" tab holds hard-coded, illustrative numbers for CPLEX, Gurobi, Xpress, HiGHS, and BharatSolve. The "simulate live run" button only adds random variation to those constants. Do not treat them as measurements. Measured comparisons are a Phase 2 deliverable.
- **GPU acceleration is not active:** The GPU module detects a WebGL2 context, but the kernels run on the CPU. GPU status labels and speed-up figures in the UI are placeholders.
- **QP is partial:** Only the diagonal of the quadratic matrix is used.
- **Branch-and-cut is basic:** The node count is capped, and primal heuristics (feasibility pump, diving) are not implemented.
- **Numerical robustness is unproven:** Anti-cycling, scaling, perturbation, and ill-conditioned-model handling are limited to a Harris ratio test and iterative refinement.
- **Partial audit:** See the audit note above.
- **Model input:** The custom model editor accepts JSON only. There is no MPS or LP file reader yet.
- **Some models may not solve correctly:** Some demo models can return `UNBOUNDED` or infeasible results due to open issues in the standard-form conversion. Test a model before relying on its output. Bug reports are welcome.

---

## 5. Roadmap

| Phase | Focus | Key Deliverables | Status |
| :--- | :--- | :--- | :--- |
| **1: Prototype** | Validate architecture | Reference simplex, IPM, branch-and-cut; audit and Compliance Score; demo console; 8 demo models | **Completed** |
| **2: Robust sparse core** | Numerical robustness | C++ sparse LU with Forrest-Tomlin updates, dual simplex, scaling, MPS reader, CLI/API, full audit, measured Netlib validation vs HiGHS | **Next** |
| **3: Scale and parallelism** | Large-model performance | Multi-core parallel branch-and-bound, GPU sparse kernels and first-order LP methods (PDHG), full QP (QPLIB), heuristics | Planned |
| **4: Industrial hardening** | Real workloads | Open-literature refinery scheduling, production planning, and supply-chain MILPs; stress tests; Python/C++ SDK; MIQP, NLP, MINLP | Planned |

### Verification plan

| Step | What we do | Dataset / Yardstick |
| :--- | :--- | :--- |
| **Correctness** | Audit every solve: feasibility, dual feasibility, complementarity, duality gap, integrality | Built-in audit |
| **LP** | Solve a Netlib subset; compare objectives | Netlib LP; HiGHS as external reference |
| **MILP** | Solve a MIPLIB subset; compare objective, gap, nodes | MIPLIB 2017; HiGHS |
| **QP** | Convex QP instances | QPLIB (convex subset) |
| **Robustness** | Degenerate, ill-conditioned, weak-relaxation models | Mittelmann benchmarks |
| **Case studies** | Refinery scheduling, crude blending, production planning, supply chain | Open-literature models; synthetic data where industrial data is unavailable |

*HiGHS and other solvers are used only as external checkers to compare results. No third-party solver code is used inside BharatSolve.*

---

## 6. Getting started

**Prerequisites:** Node.js 18 or later.

```bash
# 1. Install dependencies
npm install

# 2. Start the development server
npm run dev
# open http://localhost:3000

# 3. Type-check
npm run lint

# 4. Production build
npm run build
```

*No API keys or environment variables are needed to run the solver or the console.*

### Using the solver from code

The solver modules can be imported directly (TypeScript):

```ts
import { solveProblem } from './src/solver/solverEngine';
import { BENCHMARK_PROBLEMS } from './src/solver/benchmarks';

const result = await solveProblem(BENCHMARK_PROBLEMS[5], {
  algorithm: 'auto',
  presolve: true,
});

console.log(result.status, result.objectiveValue);
console.log(result.mathematicalAudit);
```

### Defining a custom model

Paste a model in the console's **Custom Model Editor** tab as JSON, following the `OptimizationProblem` type in [`src/solver/types.ts`](src/solver/types.ts):

```json
{
  "id": "toy",
  "name": "Toy LP",
  "category": "custom",
  "description": "max 3x + 2y s.t. x + y <= 4, x <= 3",
  "direction": "maximize",
  "isQuadratic": false,
  "variables": [
    { "id": "x", "name": "x", "type": "continuous", "lb": 0, "ub": 1e9, "obj": 3 },
    { "id": "y", "name": "y", "type": "continuous", "lb": 0, "ub": 1e9, "obj": 2 }
  ],
  "constraints": [
    {
      "id": "c1",
      "name": "cap",
      "sense": "<=",
      "rhs": 4,
      "coefficients": [
        { "varIndex": 0, "coeff": 1 },
        { "varIndex": 1, "coeff": 1 }
      ]
    },
    {
      "id": "c2",
      "name": "xmax",
      "sense": "<=",
      "rhs": 3,
      "coefficients": [
        { "varIndex": 0, "coeff": 1 }
      ]
    }
  ]
}
```

---

## 7. Repository layout

```text
src/
├── solver/              # Solver core (no third-party solver libraries)
│   ├── types.ts         # LP / MILP / QP model definitions and telemetry types
│   ├── solverEngine.ts  # Dispatch orchestrator + mathematical audit
│   ├── presolve.ts      # Presolve reductions and bound tightening
│   ├── revisedSimplex.ts# Two-phase primal simplex engine
│   ├── interiorPoint.ts # Mehrotra predictor-corrector IPM
│   ├── branchAndCut.ts  # Branch-and-cut for mixed-integer LP
│   ├── sparseMatrix.ts  # CSR sparse linear algebra and pivoting
│   ├── gpuCompute.ts    # Placeholder WebGL2 detection, CPU loops
│   └── benchmarks.ts    # Demo models and illustrative comparison data
└── components/          # React demo console UI
    ├── App.tsx
    └── main.tsx
```

---

## 8. References

### Algorithms
- **Mehrotra, S. (1992).** On the implementation of a primal-dual interior point method. *SIAM J. Optimization*, 2(4), 575–601.
- **Harris, P. M. J. (1973).** Pivot selection methods of the Devex LP code. *Mathematical Programming*, 5, 1–28.
- **Forrest, J. J. H. & Tomlin, J. A. (1972).** Updated triangular factors of the basis to maintain sparsity in the product form simplex method. *Mathematical Programming*, 2, 263–278.
- **Huangfu, Q. & Hall, J. A. J. (2018).** Parallelizing the dual revised simplex method. *Math. Programming Computation*, 10(1), 119–142.
- **Applegate, D. et al. (2021).** Practical large-scale linear programming using primal-dual hybrid gradient. *NeurIPS 34*.
- **Achterberg, T. (2007).** Constraint Integer Programming. PhD thesis, TU Berlin.

### Benchmarks
- **Gleixner, A. et al. (2021).** MIPLIB 2017. *Math. Programming Computation*, 13(3), 443–490. [https://miplib.zib.de/](https://miplib.zib.de/)
- **Netlib LP test set:** [https://www.netlib.org/lp/](https://www.netlib.org/lp/)
- **Mittelmann benchmarks:** [https://plato.asu.edu/bench.html](https://plato.asu.edu/bench.html)
- **Furini, F. et al. (2019).** QPLIB: a library of quadratic programming instances. *Math. Programming Computation*, 11(2), 237–265.

*Please verify volume and page details against the original publications before citing.*

---

## 9. Contributing

Issues and pull requests are welcome, especially:
- Correctness fixes for the demo models and standard-form conversion,
- An MPS / LP file reader,
- Sparse LU and dual simplex work,
- Benchmark scripts that compare against HiGHS on public instances.

*Please keep contributions free of third-party solver code.*

---

## 10. Licence

Add a licence file before publishing (for example Apache-2.0 or MIT) and name it here.

---

## 11. Team

**Team ManoRaksha**  
Smart India Hackathon 2026 | Problem Statement ID: 26119 | Team ID: 149543
