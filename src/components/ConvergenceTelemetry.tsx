/**
 * BharatSolve: Sovereign GPU-Accelerated Optimization Engine
 * Convergence Telemetry: Dual/Primal Residuals, Duality Gap, Condition Progression
 */

import React, { useState } from 'react';
import { IterationTelemetry } from '../solver/types';
import { Activity, Zap, TrendingDown } from 'lucide-react';

interface ConvergenceTelemetryProps {
  telemetry: IterationTelemetry[];
  algorithmUsed: string;
}

export const ConvergenceTelemetry: React.FC<ConvergenceTelemetryProps> = ({
  telemetry,
  algorithmUsed,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!telemetry || telemetry.length === 0) {
    return (
      <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-8 text-center text-slate-400">
        <Activity className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        <div className="text-sm font-semibold text-white">No Active Telemetry Trace</div>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Execute a solve run from the Solver Console to observe real-time central path convergence, residual decay, and basis condition history.
        </p>
      </div>
    );
  }

  // Find min/max for scaling (log scale for residuals)
  const maxIter = telemetry[telemetry.length - 1].iteration || 1;
  const svgWidth = 680;
  const svgHeight = 220;
  const padLeft = 60;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 30;

  const chartW = svgWidth - padLeft - padRight;
  const chartH = svgHeight - padTop - padBottom;

  // Compute log10 values clamped to [-10, 2]
  const clampLog = (val: number) => {
    const v = Math.max(1e-12, Math.abs(val));
    return Math.max(-10, Math.min(2, Math.log10(v)));
  };

  const minLog = -10;
  const maxLog = 2;

  const getX = (iter: number) => padLeft + (iter / Math.max(1, maxIter)) * chartW;
  const getY = (logVal: number) => padTop + chartH - ((logVal - minLog) / (maxLog - minLog)) * chartH;

  // Build SVG path strings
  let pathPrimal = '';
  let pathDual = '';
  let pathGap = '';

  telemetry.forEach((t, idx) => {
    const x = getX(t.iteration);
    const yP = getY(clampLog(t.primalResidual));
    const yD = getY(clampLog(t.dualResidual));
    const yG = t.dualityGap !== undefined ? getY(clampLog(t.dualityGap)) : null;

    if (idx === 0) {
      pathPrimal = `M ${x} ${yP}`;
      pathDual = `M ${x} ${yD}`;
      if (yG !== null) pathGap = `M ${x} ${yG}`;
    } else {
      pathPrimal += ` L ${x} ${yP}`;
      pathDual += ` L ${x} ${yD}`;
      if (yG !== null) pathGap += ` L ${x} ${yG}`;
    }
  });

  const lastEntry = telemetry[telemetry.length - 1];

  return (
    <div className="space-y-6">
      {/* Top Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-lg">
          <div className="text-[11px] font-mono text-slate-400">TOTAL ITERATIONS</div>
          <div className="text-xl font-bold font-mono text-white mt-1 tabular-nums">
            {lastEntry.iteration}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Convergence steps</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-lg">
          <div className="text-[11px] font-mono text-cyan-400">PRIMAL RESIDUAL ||Ax - b||</div>
          <div className="text-xl font-bold font-mono text-cyan-300 mt-1 tabular-nums">
            {lastEntry.primalResidual.toExponential(2)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Constraint violation</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-lg">
          <div className="text-[11px] font-mono text-amber-400">DUAL RESIDUAL ||Aᵀy + s - c||</div>
          <div className="text-xl font-bold font-mono text-amber-300 mt-1 tabular-nums">
            {lastEntry.dualResidual.toExponential(2)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Stationarity norm</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-lg">
          <div className="text-[11px] font-mono text-emerald-400">DUALITY GAP (μ)</div>
          <div className="text-xl font-bold font-mono text-emerald-300 mt-1 tabular-nums">
            {lastEntry.dualityGap !== undefined ? lastEntry.dualityGap.toExponential(2) : '0.00e+00'}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Complementarity</div>
        </div>
      </div>

      {/* Convergence Chart Container */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
          <div>
            <h3 className="text-base font-semibold text-white">
              Logarithmic Residual Convergence Trajectory
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Tracking primal/dual infeasibility decay and Mehrotra central path descent on log₁₀ scale.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-cyan-400 inline-block" />
              <span className="text-cyan-300">Primal Residual</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-amber-400 inline-block" />
              <span className="text-amber-300">Dual Residual</span>
            </div>
            {pathGap && (
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-emerald-400 inline-block" />
                <span className="text-emerald-300">Duality Gap μ</span>
              </div>
            )}
          </div>
        </div>

        {/* SVG Chart Stage */}
        <div className="mt-4 overflow-x-auto">
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto min-w-[550px]">
            {/* Horizontal Grid lines */}
            {[-8, -6, -4, -2, 0].map(val => {
              const y = getY(val);
              return (
                <g key={val}>
                  <line x1={padLeft} y1={y} x2={svgWidth - padRight} y2={y} stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
                  <text x={padLeft - 8} y={y + 3} fill="#64748b" fontSize="10" fontFamily="JetBrains Mono" textAnchor="end">
                    10^{val}
                  </text>
                </g>
              );
            })}

            {/* X Axis line */}
            <line x1={padLeft} y1={padTop + chartH} x2={svgWidth - padRight} y2={padTop + chartH} stroke="#334155" strokeWidth="1" />
            <text x={padLeft} y={svgHeight - 10} fill="#64748b" fontSize="10" fontFamily="JetBrains Mono">
              Iter 0
            </text>
            <text x={svgWidth - padRight} y={svgHeight - 10} fill="#64748b" fontSize="10" fontFamily="JetBrains Mono" textAnchor="end">
              Iter {maxIter}
            </text>

            {/* Data Curves */}
            <path d={pathPrimal} fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
            <path d={pathDual} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
            {pathGap && <path d={pathGap} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />}

            {/* Hover Circles */}
            {telemetry.map((t, idx) => {
              const x = getX(t.iteration);
              const yP = getY(clampLog(t.primalResidual));
              return (
                <circle
                  key={idx}
                  cx={x}
                  cy={yP}
                  r="3.5"
                  className="fill-cyan-400 hover:fill-white cursor-pointer transition-colors"
                  onMouseEnter={() => setHoveredIdx(idx)}
                />
              );
            })}
          </svg>
        </div>

        {/* Hover info badge */}
        {hoveredIdx !== null && telemetry[hoveredIdx] && (
          <div className="mt-3 p-2 bg-slate-950 border border-slate-800 rounded text-xs font-mono flex items-center justify-between text-slate-300">
            <span>Iteration: <strong className="text-white">{telemetry[hoveredIdx].iteration}</strong></span>
            <span>Primal Obj: <strong className="text-amber-400">{telemetry[hoveredIdx].primalObj.toFixed(4)}</strong></span>
            <span>Primal Res: <strong className="text-cyan-400">{telemetry[hoveredIdx].primalResidual.toExponential(2)}</strong></span>
            <span>Dual Res: <strong className="text-amber-400">{telemetry[hoveredIdx].dualResidual.toExponential(2)}</strong></span>
            {telemetry[hoveredIdx].basisCondition && (
              <span>Basis Cond κ: <strong className="text-purple-400">{telemetry[hoveredIdx].basisCondition?.toFixed(1)}</strong></span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
