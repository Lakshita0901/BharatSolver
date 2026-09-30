/**
 * BharatSolve: Sovereign GPU-Accelerated Optimization Engine
 * Solver Console: Problem Formulation, Parameter Tuning, and Solution Matrix Inspector
 */

import React, { useState } from 'react';
import {
  OptimizationProblem,
  SolverOptions,
  SolverResult,
  SolverAlgorithm,
  PricingStrategy,
} from '../solver/types';
import { BENCHMARK_PROBLEMS } from '../solver/benchmarks';
import {
  Play,
  RotateCcw,
  Sliders,
  Cpu,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Table,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface SolverConsoleProps {
  currentProblem: OptimizationProblem;
  setCurrentProblem: (prob: OptimizationProblem) => void;
  options: SolverOptions;
  setOptions: React.Dispatch<React.SetStateAction<SolverOptions>>;
  onSolve: () => void;
  isSolving: boolean;
  result: SolverResult | null;
}

export const SolverConsole: React.FC<SolverConsoleProps> = ({
  currentProblem,
  setCurrentProblem,
  options,
  setOptions,
  onSolve,
  isSolving,
  result,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'formulation' | 'solution' | 'custom_editor'>('formulation');
  const [customJson, setCustomJson] = useState<string>('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  const handleSelectProblem = (id: string) => {
    const found = BENCHMARK_PROBLEMS.find(p => p.id === id);
    if (found) {
      setCurrentProblem(found);
      setCustomJson(JSON.stringify(found, null, 2));
      setJsonError(null);
    }
  };

  const handleApplyCustomJson = () => {
    try {
      const parsed = JSON.parse(customJson) as OptimizationProblem;
      if (!parsed.variables || !parsed.constraints) {
        throw new Error('Problem must define variables and constraints arrays.');
      }
      setCurrentProblem(parsed);
      setJsonError(null);
      setActiveSubTab('formulation');
    } catch (err: any) {
      setJsonError(err.message || 'Invalid JSON format');
    }
  };

  return (
    <div className="space-y-6">
      {/* Problem Selection & Execution Strip */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          
          {/* Preset Problem Selector */}
          <div className="lg:col-span-5 space-y-1.5">
            <label className="text-xs font-mono uppercase text-slate-400">
              Benchmark Industrial Model / Testbed
            </label>
            <select
              value={currentProblem.id}
              onChange={e => handleSelectProblem(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400 transition-colors font-medium"
            >
              <optgroup label="India Sovereign Strategic Industries">
                {BENCHMARK_PROBLEMS.filter(p =>
                  ['refinery', 'power_grid', 'logistics', 'petrochemical', 'agriculture'].includes(p.category)
                ).map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Standard Netlib / MIPLIB / Mittelmann">
                {BENCHMARK_PROBLEMS.filter(p =>
                  ['netlib', 'miplib', 'mittelmann'].includes(p.category)
                ).map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Quick Problem Dimension Tags */}
          <div className="lg:col-span-4 flex items-center gap-2 text-xs font-mono text-slate-400">
            <div className="bg-slate-950 border border-slate-800 px-3 py-2 rounded-md flex-1 text-center">
              <span className="text-slate-500 block text-[10px]">VARIABLES</span>
              <span className="text-white font-bold tabular-nums text-sm">
                {currentProblem.variables.length}
              </span>
            </div>
            <div className="bg-slate-950 border border-slate-800 px-3 py-2 rounded-md flex-1 text-center">
              <span className="text-slate-500 block text-[10px]">CONSTRAINTS</span>
              <span className="text-white font-bold tabular-nums text-sm">
                {currentProblem.constraints.length}
              </span>
            </div>
            <div className="bg-slate-950 border border-slate-800 px-3 py-2 rounded-md flex-1 text-center">
              <span className="text-slate-500 block text-[10px]">DIRECTION</span>
              <span className="text-amber-400 font-bold uppercase text-xs">
                {currentProblem.direction}
              </span>
            </div>
          </div>

          {/* Run Action Button */}
          <div className="lg:col-span-3 flex items-center justify-end gap-3">
            <button
              onClick={onSolve}
              disabled={isSolving}
              className="w-full flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 transition-all rounded shadow-md"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{isSolving ? 'Optimizing...' : 'Run Solver'}</span>
            </button>
          </div>

        </div>

        {/* Problem Description Subtitle */}
        <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-800/80 leading-relaxed">
          <strong className="text-slate-300">Model Context:</strong> {currentProblem.description}
        </p>
      </div>

      {/* Solver Hyperparameters Accordion / Panel */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">
              Indigenous Solver Core Tuning & Hardware Acceleration
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">Zero foreign dependencies</span>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
          {/* Core Algorithm */}
          <div className="space-y-1">
            <label className="text-slate-400">ALGORITHM DISPATCH</label>
            <select
              value={options.algorithm}
              onChange={e => setOptions(prev => ({ ...prev, algorithm: e.target.value as SolverAlgorithm }))}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200"
            >
              <option value="auto">Auto (Smart Structural Select)</option>
              <option value="revised_simplex_primal">Revised Simplex (Primal)</option>
              <option value="revised_simplex_dual">Revised Simplex (Dual)</option>
              <option value="interior_point_mehrotra">Mehrotra Primal-Dual IPM</option>
              <option value="branch_and_cut">Branch-and-Cut (MILP)</option>
            </select>
          </div>

          {/* Pricing Rule */}
          <div className="space-y-1">
            <label className="text-slate-400">SIMPLEX PRICING RULE</label>
            <select
              value={options.pricing}
              onChange={e => setOptions(prev => ({ ...prev, pricing: e.target.value as PricingStrategy }))}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200"
            >
              <option value="steepest_edge">Steepest Edge (Harris Exact)</option>
              <option value="devex">Devex Dynamic Approx</option>
              <option value="dantzig">Dantzig First Negative</option>
            </select>
          </div>

          {/* Presolve Switch */}
          <div className="space-y-1">
            <label className="text-slate-400">PRESOLVE REDUCTIONS</label>
            <select
              value={options.presolve ? 'true' : 'false'}
              onChange={e => setOptions(prev => ({ ...prev, presolve: e.target.value === 'true' }))}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200"
            >
              <option value="true">Enabled (Row/Col Singletons & Bound Tightening)</option>
              <option value="false">Disabled (Raw Unreduced Model)</option>
            </select>
          </div>

          {/* GPU Acceleration Switch */}
          <div className="space-y-1">
            <label className="text-slate-400">GPU COMPUTE ACCELERATION</label>
            <select
              value={options.enableGpu ? 'true' : 'false'}
              onChange={e => setOptions(prev => ({ ...prev, enableGpu: e.target.value === 'true' }))}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 text-amber-300 font-semibold"
            >
              <option value="true">Active (WebGL2 GPGPU / SIMD)</option>
              <option value="false">CPU Sequential Only</option>
            </select>
          </div>
        </div>

        {/* Second Row of Parameters */}
        <div className="mt-3 pt-3 border-t border-slate-800/60 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
          <div className="flex items-center justify-between bg-slate-950 p-2 rounded border border-slate-800/80">
            <span className="text-slate-400">Markowitz Pivot Threshold (u):</span>
            <span className="text-amber-400 font-bold">0.10 (Stable LU)</span>
          </div>

          <div className="flex items-center justify-between bg-slate-950 p-2 rounded border border-slate-800/80">
            <span className="text-slate-400">Primal / Dual Tolerance:</span>
            <span className="text-cyan-400 font-bold">1.0e-06</span>
          </div>

          <div className="flex items-center justify-between bg-slate-950 p-2 rounded border border-slate-800/80">
            <span className="text-slate-400">Cutting Planes:</span>
            <span className="text-emerald-400 font-bold">GMI & Knapsack Cover</span>
          </div>
        </div>
      </div>

      {/* Solution Results Banner if Available */}
      {result && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-5">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-md flex items-center justify-center font-bold text-sm ${
                  result.status === 'optimal'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                }`}
              >
                {result.status === 'optimal' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-white uppercase tracking-wider">
                    {result.status}
                  </span>
                  <span className="text-slate-500">·</span>
                  <span className="text-xs font-mono text-slate-400">
                    Engine: {result.algorithmUsed} {result.gpuActive ? '(GPU Accelerated)' : '(CPU)'}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Solved in <strong className="text-white font-mono">{result.solveTimeMs} ms</strong> across{' '}
                  <strong className="text-white font-mono">{result.iterations}</strong> iterations
                </div>
              </div>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-xs font-mono uppercase text-slate-400">Optimal Objective:</span>
              <span className="text-2xl font-bold font-mono text-amber-400 tabular-nums">
                {result.objectiveValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
            <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
              <div className="text-slate-500 text-[10px]">PRIMAL RESIDUAL ||Ax - b||</div>
              <div className="text-cyan-300 font-bold mt-0.5">{result.primalResidual.toExponential(2)}</div>
            </div>
            <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
              <div className="text-slate-500 text-[10px]">DUAL RESIDUAL ||Aᵀy - c||</div>
              <div className="text-amber-300 font-bold mt-0.5">{result.dualResidual.toExponential(2)}</div>
            </div>
            <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
              <div className="text-slate-500 text-[10px]">OPTIMALITY GAP</div>
              <div className="text-emerald-300 font-bold mt-0.5">{result.dualityGap.toFixed(2)} %</div>
            </div>
            <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
              <div className="text-slate-500 text-[10px]">SOVEREIGN AUDIT SCORE</div>
              <div className="text-white font-bold mt-0.5">{result.mathematicalAudit.sovereignComplianceScore} / 100</div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs for Problem Formulation, Solution Vector, and Custom Editor */}
      <div className="space-y-4">
        <div className="flex items-center gap-1.5 border-b border-slate-800 text-xs font-medium">
          <button
            onClick={() => setActiveSubTab('formulation')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeSubTab === 'formulation'
                ? 'border-amber-400 text-amber-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Formulation & Constraints ({currentProblem.constraints.length})
          </button>
          <button
            onClick={() => setActiveSubTab('solution')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeSubTab === 'solution'
                ? 'border-amber-400 text-amber-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Optimal Solution Vector x* {result ? `(${result.solution.length} vars)` : ''}
          </button>
          <button
            onClick={() => {
              setActiveSubTab('custom_editor');
              if (!customJson) setCustomJson(JSON.stringify(currentProblem, null, 2));
            }}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeSubTab === 'custom_editor'
                ? 'border-amber-400 text-amber-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Custom Model Editor (JSON / MPS)
          </button>
        </div>

        {/* Tab 1: Algebraic Formulation View */}
        {activeSubTab === 'formulation' && (
          <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-5 space-y-5">
            {/* Objective Function */}
            <div>
              <div className="text-xs font-mono uppercase text-slate-400 mb-1">
                Objective Function ({currentProblem.direction})
              </div>
              <div className="bg-slate-950 p-3 rounded border border-slate-800 font-mono text-xs text-amber-300 overflow-x-auto">
                <span className="text-slate-400 font-semibold uppercase">{currentProblem.direction} Z = </span>
                {currentProblem.variables
                  .filter(v => Math.abs(v.obj) > 1e-9)
                  .map((v, idx) => (
                    <span key={v.id}>
                      {idx > 0 && v.obj >= 0 ? ' + ' : v.obj < 0 ? ' - ' : ' '}
                      {Math.abs(v.obj)} · <strong className="text-white">{v.name}</strong>
                    </span>
                  ))}
              </div>
            </div>

            {/* Constraints Table */}
            <div>
              <div className="text-xs font-mono uppercase text-slate-400 mb-2">
                Structural Constraints Matrix ({currentProblem.constraints.length} Rows)
              </div>
              <div className="overflow-x-auto max-h-[360px] overflow-y-auto border border-slate-800 rounded">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-950 border-b border-slate-800 text-[11px] uppercase text-slate-400 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Constraint Name</th>
                      <th className="py-2.5 px-3">Algebraic Expression</th>
                      <th className="py-2.5 px-3 text-center">Sense</th>
                      <th className="py-2.5 px-3 text-right">RHS Bound</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {currentProblem.constraints.map(c => (
                      <tr key={c.id} className="hover:bg-slate-800/30">
                        <td className="py-2.5 px-3 font-semibold text-slate-200">{c.name}</td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {c.coefficients.map((term, tIdx) => {
                            const vName = currentProblem.variables[term.varIndex]?.name || `x_${term.varIndex}`;
                            return (
                              <span key={tIdx}>
                                {tIdx > 0 && term.coeff >= 0 ? ' + ' : term.coeff < 0 ? ' - ' : ''}
                                {Math.abs(term.coeff)} · <span className="text-cyan-300">{vName}</span>
                              </span>
                            );
                          })}
                        </td>
                        <td className="py-2.5 px-3 text-center text-amber-400 font-bold">{c.sense}</td>
                        <td className="py-2.5 px-3 text-right text-white font-bold tabular-nums">{c.rhs}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Optimal Solution Vector */}
        {activeSubTab === 'solution' && (
          <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-5">
            {result ? (
              <div className="overflow-x-auto max-h-[420px] overflow-y-auto border border-slate-800 rounded">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-950 border-b border-slate-800 text-[11px] uppercase text-slate-400 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Variable</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3 text-right">Lower Bound</th>
                      <th className="py-2.5 px-3 text-right">Upper Bound</th>
                      <th className="py-2.5 px-3 text-right text-amber-400 font-bold">Optimal Value x*</th>
                      <th className="py-2.5 px-3 text-right text-slate-400">Unit Cost cⱼ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {currentProblem.variables.map((v, idx) => {
                      const val = result.solution[idx] ?? 0;
                      return (
                        <tr key={v.id} className="hover:bg-slate-800/30">
                          <td className="py-2.5 px-3 font-semibold text-white">{v.name}</td>
                          <td className="py-2.5 px-3 text-slate-400 uppercase text-[11px]">{v.type}</td>
                          <td className="py-2.5 px-3 text-right text-slate-400 tabular-nums">{v.lb}</td>
                          <td className="py-2.5 px-3 text-right text-slate-400 tabular-nums">
                            {v.ub === Infinity ? '∞' : v.ub}
                          </td>
                          <td className="py-2.5 px-3 text-right text-amber-300 font-bold tabular-nums text-sm">
                            {Number(val.toFixed(4))}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-400 tabular-nums">{v.obj}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs">
                Run the solver using the button above to view the primal solution vector x* and dual shadow prices.
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Custom Model Editor */}
        {activeSubTab === 'custom_editor' && (
          <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-white">Custom Model JSON Definition</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Define custom linear or mixed-integer formulations directly in JSON format.
                </p>
              </div>

              <button
                onClick={handleApplyCustomJson}
                className="px-4 py-1.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded shadow-sm transition-colors"
              >
                Load Custom Model
              </button>
            </div>

            {jsonError && (
              <div className="p-3 bg-rose-950/60 border border-rose-800 rounded text-xs text-rose-300 font-mono">
                Error: {jsonError}
              </div>
            )}

            <textarea
              rows={14}
              value={customJson}
              onChange={e => setCustomJson(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-amber-400"
            />
          </div>
        )}
      </div>
    </div>
  );
};
