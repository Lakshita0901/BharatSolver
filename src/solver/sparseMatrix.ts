/**
 * BharatSolve: Sovereign GPU-Accelerated Optimization Engine
 * Sparse Linear Algebra & Numerical Safeguards
 * Formats: Compressed Sparse Row (CSR) & Compressed Sparse Column (CSC)
 * Algorithms: LU Factorization with Markowitz Pivoting, Sparse Cholesky, Preconditioned Conjugate Gradient (PCG)
 */

export interface CSRMatrix {
  values: Float64Array;
  colIndices: Int32Array;
  rowPointers: Int32Array;
  numRows: number;
  numCols: number;
  nnz: number;
}

export interface CSCMatrix {
  values: Float64Array;
  rowIndices: Int32Array;
  colPointers: Int32Array;
  numRows: number;
  numCols: number;
  nnz: number;
}

/**
 * Builds CSR matrix from triplet list: rows, cols, values
 */
export function buildCSR(
  numRows: number,
  numCols: number,
  triplets: { row: number; col: number; val: number }[]
): CSRMatrix {
  // Count non-zeros per row
  const rowCounts = new Int32Array(numRows);
  for (let i = 0; i < triplets.length; i++) {
    const t = triplets[i];
    if (Math.abs(t.val) > 1e-15 && t.row >= 0 && t.row < numRows && t.col >= 0 && t.col < numCols) {
      rowCounts[t.row]++;
    }
  }

  const rowPointers = new Int32Array(numRows + 1);
  rowPointers[0] = 0;
  for (let r = 0; r < numRows; r++) {
    rowPointers[r + 1] = rowPointers[r] + rowCounts[r];
  }

  const nnz = rowPointers[numRows];
  const values = new Float64Array(nnz);
  const colIndices = new Int32Array(nnz);
  const currentPos = new Int32Array(rowPointers);

  for (let i = 0; i < triplets.length; i++) {
    const t = triplets[i];
    if (Math.abs(t.val) > 1e-15 && t.row >= 0 && t.row < numRows && t.col >= 0 && t.col < numCols) {
      const idx = currentPos[t.row]++;
      values[idx] = t.val;
      colIndices[idx] = t.col;
    }
  }

  return { values, colIndices, rowPointers, numRows, numCols, nnz };
}

/**
 * Builds CSC matrix from triplet list
 */
export function buildCSC(
  numRows: number,
  numCols: number,
  triplets: { row: number; col: number; val: number }[]
): CSCMatrix {
  const colCounts = new Int32Array(numCols);
  for (let i = 0; i < triplets.length; i++) {
    const t = triplets[i];
    if (Math.abs(t.val) > 1e-15 && t.row >= 0 && t.row < numRows && t.col >= 0 && t.col < numCols) {
      colCounts[t.col]++;
    }
  }

  const colPointers = new Int32Array(numCols + 1);
  colPointers[0] = 0;
  for (let c = 0; c < numCols; c++) {
    colPointers[c + 1] = colPointers[c] + colCounts[c];
  }

  const nnz = colPointers[numCols];
  const values = new Float64Array(nnz);
  const rowIndices = new Int32Array(nnz);
  const currentPos = new Int32Array(colPointers);

  for (let i = 0; i < triplets.length; i++) {
    const t = triplets[i];
    if (Math.abs(t.val) > 1e-15 && t.row >= 0 && t.row < numRows && t.col >= 0 && t.col < numCols) {
      const idx = currentPos[t.col]++;
      values[idx] = t.val;
      rowIndices[idx] = t.row;
    }
  }

  return { values, rowIndices, colPointers, numRows, numCols, nnz };
}

/**
 * Sparse Matrix-Vector Product: y = A * x (using CSR format)
 */
export function spmvCSR(A: CSRMatrix, x: Float64Array, y: Float64Array): void {
  for (let r = 0; r < A.numRows; r++) {
    let sum = 0.0;
    const start = A.rowPointers[r];
    const end = A.rowPointers[r + 1];
    for (let k = start; k < end; k++) {
      sum += A.values[k] * x[A.colIndices[k]];
    }
    y[r] = sum;
  }
}

/**
 * Sparse Matrix-Transpose-Vector Product: y = A^T * x (using CSC format)
 */
export function spmvCSC_Trans(A: CSCMatrix, x: Float64Array, y: Float64Array): void {
  for (let c = 0; c < A.numCols; c++) {
    let sum = 0.0;
    const start = A.colPointers[c];
    const end = A.colPointers[c + 1];
    for (let k = start; k < end; k++) {
      sum += A.values[k] * x[A.rowIndices[k]];
    }
    y[c] = sum;
  }
}

/**
 * Euclidean dot product
 */
export function dot(a: Float64Array, b: Float64Array, length?: number): number {
  const n = length ?? a.length;
  let sum = 0.0;
  for (let i = 0; i < n; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * Vector Infinity Norm
 */
export function normInf(x: Float64Array): number {
  let maxVal = 0.0;
  for (let i = 0; i < x.length; i++) {
    const val = Math.abs(x[i]);
    if (val > maxVal) maxVal = val;
  }
  return maxVal;
}

/**
 * Vector L2 Norm
 */
export function norm2(x: Float64Array): number {
  let sum = 0.0;
  for (let i = 0; i < x.length; i++) {
    sum += x[i] * x[i];
  }
  return Math.sqrt(sum);
}

/**
 * LU Factorization with Markowitz Threshold Pivoting for Basis Matrix B
 * Solves B * x = rhs or B^T * y = rhs
 */
export class BasisLU {
  private n: number;
  private LU: Float64Array; // Flattened dense n x n
  private p: Int32Array; // Row permutation
  private q: Int32Array; // Col permutation
  public conditionEstimate: number = 1.0;
  public isValid: boolean = false;

  constructor(n: number) {
    this.n = n;
    this.LU = new Float64Array(n * n);
    this.p = new Int32Array(n);
    this.q = new Int32Array(n);
  }

  /**
   * Factorize an n x n matrix B with Markowitz threshold pivoting
   * u: Markowitz threshold parameter (e.g. 0.1 to maintain balance between sparsity and numerical stability)
   */
  public factorize(
    getEntry: (row: number, col: number) => number,
    u: number = 0.1
  ): boolean {
    const n = this.n;
    // Copy into working array
    for (let i = 0; i < n; i++) {
      this.p[i] = i;
      this.q[i] = i;
      for (let j = 0; j < n; j++) {
        this.LU[i * n + j] = getEntry(i, j);
      }
    }

    // Measure initial 1-norm for condition number estimation
    let maxColSum = 0.0;
    for (let j = 0; j < n; j++) {
      let colSum = 0.0;
      for (let i = 0; i < n; i++) {
        colSum += Math.abs(this.LU[i * n + j]);
      }
      if (colSum > maxColSum) maxColSum = colSum;
    }

    let minPivot = 1e30;
    let maxPivot = 0.0;

    for (let k = 0; k < n; k++) {
      // Markowitz search: find pivot that satisfies threshold criterion
      // |a_ij| >= u * max_{l >= k} |a_lj| with minimal (row_count - 1)*(col_count - 1)
      let bestI = k;
      let bestJ = k;
      let bestScore = Infinity;
      let foundPivot = false;

      for (let j = k; j < n; j++) {
        let maxInCol = 0.0;
        let colCount = 0;
        for (let i = k; i < n; i++) {
          const val = Math.abs(this.LU[i * n + j]);
          if (val > maxInCol) maxInCol = val;
          if (val > 1e-12) colCount++;
        }

        if (maxInCol < 1e-14) continue; // Skip near-zero column

        const threshold = u * maxInCol;
        for (let i = k; i < n; i++) {
          const val = Math.abs(this.LU[i * n + j]);
          if (val >= threshold && val > 1e-12) {
            // Count entries in this row
            let rowCount = 0;
            for (let l = k; l < n; l++) {
              if (Math.abs(this.LU[i * n + l]) > 1e-12) rowCount++;
            }
            const score = (rowCount - 1) * (colCount - 1);
            if (score < bestScore) {
              bestScore = score;
              bestI = i;
              bestJ = j;
              foundPivot = true;
            }
          }
        }
      }

      if (!foundPivot) {
        // Fall back to partial pivoting
        let maxVal = 0.0;
        for (let i = k; i < n; i++) {
          const val = Math.abs(this.LU[i * n + k]);
          if (val > maxVal) {
            maxVal = val;
            bestI = i;
            bestJ = k;
          }
        }
        if (maxVal < 1e-12) {
          this.isValid = false;
          this.conditionEstimate = 1e16;
          return false; // Singular matrix
        }
      }

      // Swap rows k and bestI
      if (bestI !== k) {
        const tmpP = this.p[k];
        this.p[k] = this.p[bestI];
        this.p[bestI] = tmpP;
        for (let j = 0; j < n; j++) {
          const tmp = this.LU[k * n + j];
          this.LU[k * n + j] = this.LU[bestI * n + j];
          this.LU[bestI * n + j] = tmp;
        }
      }

      // Swap cols k and bestJ
      if (bestJ !== k) {
        const tmpQ = this.q[k];
        this.q[k] = this.q[bestJ];
        this.q[bestJ] = tmpQ;
        for (let i = 0; i < n; i++) {
          const tmp = this.LU[i * n + k];
          this.LU[i * n + k] = this.LU[i * n + bestJ];
          this.LU[i * n + bestJ] = tmp;
        }
      }

      const pivot = this.LU[k * n + k];
      if (Math.abs(pivot) < 1e-13) {
        this.isValid = false;
        return false;
      }

      const absP = Math.abs(pivot);
      if (absP < minPivot) minPivot = absP;
      if (absP > maxPivot) maxPivot = absP;

      // Gaussian elimination
      for (let i = k + 1; i < n; i++) {
        const mult = this.LU[i * n + k] / pivot;
        this.LU[i * n + k] = mult; // Store L entry
        for (let j = k + 1; j < n; j++) {
          this.LU[i * n + j] -= mult * this.LU[k * n + j];
        }
      }
    }

    this.conditionEstimate = maxPivot / Math.max(1e-14, minPivot);
    this.isValid = true;
    return true;
  }

  /**
   * Solves B * x = b using forward and back substitution
   */
  public solve(b: Float64Array, x: Float64Array): void {
    const n = this.n;
    const y = new Float64Array(n);

    // Apply row permutation P: P * b
    for (let i = 0; i < n; i++) {
      y[i] = b[this.p[i]];
    }

    // Forward substitution: L * z = P * b
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < i; j++) {
        y[i] -= this.LU[i * n + j] * y[j];
      }
    }

    // Back substitution: U * w = z
    const w = new Float64Array(n);
    for (let i = n - 1; i >= 0; i--) {
      let sum = y[i];
      for (let j = i + 1; j < n; j++) {
        sum -= this.LU[i * n + j] * w[j];
      }
      w[i] = sum / this.LU[i * n + i];
    }

    // Apply column permutation Q: x = Q * w
    for (let j = 0; j < n; j++) {
      x[this.q[j]] = w[j];
    }
  }

  /**
   * Solves B^T * y = c
   */
  public solveTranspose(c: Float64Array, y: Float64Array): void {
    const n = this.n;
    // Permutation Q^T * c
    const w = new Float64Array(n);
    for (let j = 0; j < n; j++) {
      w[j] = c[this.q[j]];
    }

    // Forward substitution on U^T: U^T * z = Q^T * c
    const z = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let sum = w[i];
      for (let j = 0; j < i; j++) {
        sum -= this.LU[j * n + i] * z[j];
      }
      z[i] = sum / this.LU[i * n + i];
    }

    // Back substitution on L^T: L^T * v = z
    const v = new Float64Array(n);
    for (let i = n - 1; i >= 0; i--) {
      let sum = z[i];
      for (let j = i + 1; j < n; j++) {
        sum -= this.LU[j * n + i] * v[j];
      }
      v[i] = sum;
    }

    // Permutation P^T * v: y = P^T * v
    for (let i = 0; i < n; i++) {
      y[this.p[i]] = v[i];
    }
  }

  /**
   * Iterative refinement for high numerical accuracy:
   * x_{new} = x + B^{-1} (b - B*x)
   */
  public refine(
    b: Float64Array,
    x: Float64Array,
    getEntry: (row: number, col: number) => number,
    iterations: number = 2
  ): void {
    const n = this.n;
    const res = new Float64Array(n);
    const delta = new Float64Array(n);

    for (let it = 0; it < iterations; it++) {
      // Calculate residual = b - B * x
      for (let i = 0; i < n; i++) {
        let sum = 0.0;
        for (let j = 0; j < n; j++) {
          sum += getEntry(i, j) * x[j];
        }
        res[i] = b[i] - sum;
      }

      this.solve(res, delta);
      for (let i = 0; i < n; i++) {
        x[i] += delta[i];
      }
      if (normInf(delta) < 1e-14) break;
    }
  }
}

/**
 * Solves symmetric positive-definite normal equations (A * D * A^T + delta * I) * y = rhs
 * using Preconditioned Conjugate Gradient (PCG) with Jacobi (diagonal) preconditioner.
 * This is the workhorse of Interior-Point and GPU acceleration!
 */
export function solveNormalEquationsPCG(
  A: CSRMatrix,
  D: Float64Array, // Diagonal scaling: D_j = x_j / s_j > 0
  rhs: Float64Array,
  yOut: Float64Array,
  maxIters: number = 100,
  tol: number = 1e-8,
  regularization: number = 1e-9
): { iterations: number; residual: number } {
  const m = A.numRows;
  const n = A.numCols;

  // Diagonal Preconditioner M_i = row_norm(A D A^T) + regularization
  const M_inv = new Float64Array(m);
  for (let i = 0; i < m; i++) {
    let diagSum = 0.0;
    const start = A.rowPointers[i];
    const end = A.rowPointers[i + 1];
    for (let k = start; k < end; k++) {
      const col = A.colIndices[k];
      const val = A.values[k];
      diagSum += val * val * D[col];
    }
    M_inv[i] = 1.0 / (diagSum + regularization);
  }

  // Operator A * D * A^T * v
  const tempCol = new Float64Array(n);
  const applyNormal = (v: Float64Array, result: Float64Array) => {
    // 1. tempCol = D * (A^T * v)
    tempCol.fill(0);
    for (let i = 0; i < m; i++) {
      const vi = v[i];
      if (Math.abs(vi) < 1e-16) continue;
      const start = A.rowPointers[i];
      const end = A.rowPointers[i + 1];
      for (let k = start; k < end; k++) {
        tempCol[A.colIndices[k]] += A.values[k] * vi;
      }
    }
    for (let j = 0; j < n; j++) {
      tempCol[j] *= D[j];
    }

    // 2. result = A * tempCol + reg * v
    for (let i = 0; i < m; i++) {
      let sum = 0.0;
      const start = A.rowPointers[i];
      const end = A.rowPointers[i + 1];
      for (let k = start; k < end; k++) {
        sum += A.values[k] * tempCol[A.colIndices[k]];
      }
      result[i] = sum + regularization * v[i];
    }
  };

  const r = new Float64Array(m);
  const z = new Float64Array(m);
  const p = new Float64Array(m);
  const Ap = new Float64Array(m);

  // r = rhs - A * D * A^T * y0
  applyNormal(yOut, Ap);
  for (let i = 0; i < m; i++) {
    r[i] = rhs[i] - Ap[i];
  }

  // z = M^{-1} * r
  for (let i = 0; i < m; i++) {
    z[i] = M_inv[i] * r[i];
    p[i] = z[i];
  }

  let rzOld = dot(r, z);
  const normRhs = Math.max(1.0, norm2(rhs));

  let it = 0;
  for (; it < maxIters; it++) {
    const curRes = norm2(r) / normRhs;
    if (curRes < tol) break;

    applyNormal(p, Ap);
    const pAp = dot(p, Ap);
    if (pAp <= 1e-18) break; // Breakdown

    const alpha = rzOld / pAp;
    for (let i = 0; i < m; i++) {
      yOut[i] += alpha * p[i];
      r[i] -= alpha * Ap[i];
    }

    for (let i = 0; i < m; i++) {
      z[i] = M_inv[i] * r[i];
    }

    const rzNew = dot(r, z);
    const beta = rzNew / rzOld;
    rzOld = rzNew;

    for (let i = 0; i < m; i++) {
      p[i] = z[i] + beta * p[i];
    }
  }

  return { iterations: it, residual: norm2(r) / normRhs };
}
