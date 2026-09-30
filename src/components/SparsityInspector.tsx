/**
 * BharatSolve: Sovereign GPU-Accelerated Optimization Engine
 * Matrix Sparsity Inspector (Spy Plot & Structural Analysis)
 */

import React, { useRef, useEffect, useState } from 'react';
import { OptimizationProblem } from '../solver/types';
import { Eye, Layers, Compass, Sliders } from 'lucide-react';

interface SparsityInspectorProps {
  problem: OptimizationProblem;
}

export const SparsityInspector: React.FC<SparsityInspectorProps> = ({ problem }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const normalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoverCoord, setHoverCoord] = useState<{ row: number; col: number; val: number } | null>(null);
  const [viewMode, setViewMode] = useState<'constraint' | 'normal'>('constraint');

  const m = problem.constraints.length;
  const n = problem.variables.length;

  let totalNnz = 0;
  for (let i = 0; i < m; i++) {
    totalNnz += problem.constraints[i].coefficients.length;
  }
  const totalEntries = m * n;
  const sparsityPercent = totalEntries > 0 ? (1.0 - totalNnz / totalEntries) * 100 : 0;

  // Calculate bandwidth
  let maxBandwidth = 0;
  for (let i = 0; i < m; i++) {
    const c = problem.constraints[i];
    for (const term of c.coefficients) {
      const diff = Math.abs(i - term.varIndex);
      if (diff > maxBandwidth) maxBandwidth = diff;
    }
  }

  // Draw Constraint Matrix Spy Plot
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 0.5;
    const stepX = width / Math.max(1, n);
    const stepY = height / Math.max(1, m);

    // Draw nonzeros
    for (let i = 0; i < m; i++) {
      const y = (i / m) * height;
      const c = problem.constraints[i];
      for (let k = 0; k < c.coefficients.length; k++) {
        const item = c.coefficients[k];
        const x = (item.varIndex / n) * width;
        const val = item.coeff;

        if (val > 0) {
          ctx.fillStyle = '#38bdf8'; // Laser cyan for positive
        } else {
          ctx.fillStyle = '#f59e0b'; // Amber for negative
        }

        const dotSize = Math.max(3, Math.min(stepX * 0.9, stepY * 0.9, 10));
        ctx.fillRect(x, y, dotSize, dotSize);
      }
    }
  }, [problem, m, n]);

  // Draw Normal Matrix A * A^T structure
  useEffect(() => {
    const canvas = normalCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    // Compute adjacency of rows (i, j) if they share at least one column
    const step = width / Math.max(1, m);

    for (let i = 0; i < m; i++) {
      const rowI = new Set(problem.constraints[i].coefficients.map(c => c.varIndex));
      for (let j = 0; j < m; j++) {
        let shares = (i === j);
        if (!shares) {
          const rowJ = problem.constraints[j].coefficients;
          for (let k = 0; k < rowJ.length; k++) {
            if (rowI.has(rowJ[k].varIndex)) {
              shares = true;
              break;
            }
          }
        }

        if (shares) {
          ctx.fillStyle = i === j ? '#f43f5e' : '#a855f7';
          const x = (j / m) * width;
          const y = (i / m) * height;
          const dotSize = Math.max(3, Math.min(step * 0.9, 8));
          ctx.fillRect(x, y, dotSize, dotSize);
        }
      }
    }
  }, [problem, m]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const col = Math.floor((mouseX / rect.width) * n);
    const row = Math.floor((mouseY / rect.height) * m);

    if (row >= 0 && row < m && col >= 0 && col < n) {
      const con = problem.constraints[row];
      const term = con.coefficients.find(c => c.varIndex === col);
      setHoverCoord({
        row,
        col,
        val: term ? term.coeff : 0,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Structural Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-lg">
          <div className="text-[11px] font-mono uppercase text-slate-400">Rows (m)</div>
          <div className="text-xl font-bold font-mono text-white mt-1 tabular-nums">{m}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Constraints</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-lg">
          <div className="text-[11px] font-mono uppercase text-slate-400">Columns (n)</div>
          <div className="text-xl font-bold font-mono text-white mt-1 tabular-nums">{n}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Variables</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-lg">
          <div className="text-[11px] font-mono uppercase text-slate-400">Non-Zeros (nnz)</div>
          <div className="text-xl font-bold font-mono text-amber-400 mt-1 tabular-nums">{totalNnz}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Active coefficients</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-lg">
          <div className="text-[11px] font-mono uppercase text-slate-400">Sparsity Ratio</div>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-1 tabular-nums">
            {sparsityPercent.toFixed(2)} %
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Matrix emptiness</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-lg">
          <div className="text-[11px] font-mono uppercase text-slate-400">Half-Bandwidth</div>
          <div className="text-xl font-bold font-mono text-cyan-400 mt-1 tabular-nums">{maxBandwidth}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Fill-in dispersion</div>
        </div>
      </div>

      {/* Mode Selector and Canvas Container */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
          <div>
            <h3 className="text-base font-semibold text-white">
              {viewMode === 'constraint' ? 'Constraint Matrix Non-Zero Pattern A' : 'Normal Equation Structure A Aᵀ'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {viewMode === 'constraint'
                ? 'Visualizes sparsity structure, column couplings, and fill-in distribution.'
                : 'Adjacency graph of normal equations used in Mehrotra IPM Cholesky factorization.'}
            </p>
          </div>

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-md border border-slate-800 text-xs">
            <button
              onClick={() => setViewMode('constraint')}
              className={`px-3 py-1 rounded font-medium transition-colors ${
                viewMode === 'constraint' ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:text-white'
              }`}
            >
              Matrix A (m × n)
            </button>
            <button
              onClick={() => setViewMode('normal')}
              className={`px-3 py-1 rounded font-medium transition-colors ${
                viewMode === 'normal' ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:text-white'
              }`}
            >
              Normal Matrix A Aᵀ (m × m)
            </button>
          </div>
        </div>

        {/* Spy Plot Canvas Stage */}
        <div className="mt-5 flex flex-col lg:flex-row items-center gap-6">
          <div className="relative bg-slate-950 border border-slate-800 rounded-md p-2 shadow-inner">
            <canvas
              ref={canvasRef}
              width={420}
              height={360}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHoverCoord(null)}
              className={`block rounded cursor-crosshair ${viewMode === 'constraint' ? 'block' : 'hidden'}`}
            />
            <canvas
              ref={normalCanvasRef}
              width={420}
              height={360}
              className={`block rounded ${viewMode === 'normal' ? 'block' : 'hidden'}`}
            />

            {/* Hover Tooltip Overlay */}
            {hoverCoord && viewMode === 'constraint' && (
              <div className="absolute bottom-4 right-4 bg-slate-900/90 border border-slate-700 px-3 py-1.5 rounded text-[11px] font-mono text-slate-200 pointer-events-none shadow-lg">
                Row: <span className="text-amber-400">{hoverCoord.row}</span> ({problem.constraints[hoverCoord.row]?.name}) · Col:{' '}
                <span className="text-cyan-400">{hoverCoord.col}</span> ({problem.variables[hoverCoord.col]?.name}) · Coeff:{' '}
                <span className="font-semibold text-white">{hoverCoord.val}</span>
              </div>
            )}
          </div>

          {/* Color Key and Technical Explanation */}
          <div className="flex-1 space-y-4 text-xs text-slate-300">
            <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-md space-y-2.5">
              <div className="font-semibold text-white text-sm">Matrix Legend & Color Coding</div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-sky-400 rounded-sm" />
                <span>Positive matrix entry (aᵢⱼ &gt; 0)</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-amber-400 rounded-sm" />
                <span>Negative matrix entry (aᵢⱼ &lt; 0)</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-rose-500 rounded-sm" />
                <span>Diagonal pivot block in A Aᵀ</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-purple-500 rounded-sm" />
                <span>Off-diagonal non-zero coupling</span>
              </div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-md space-y-2">
              <div className="font-semibold text-white text-sm">Sovereign Linear Algebra Principles</div>
              <p className="text-slate-400 leading-relaxed">
                BharatSolve avoids dense matrix materialization. All linear algebra is executed in Compressed Sparse
                Row (CSR) and Compressed Sparse Column (CSC) formats. For Mehrotra IPM, the normal system (A D Aᵀ)
                is solved with Preconditioned Conjugate Gradient (PCG) accelerated by GPU compute kernels, eliminating
                O(m³) Cholesky factorization bottlenecks on large sparse networks.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
