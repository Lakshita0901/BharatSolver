/**
 * BharatSolve: Sovereign GPU-Accelerated Optimization Engine
 * Sovereign Mathematical Alternative to IBM ILOG CPLEX, Gurobi, and FICO Xpress
 * Primary Application Shell
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { SolverConsole } from './components/SolverConsole';
import { SparsityInspector } from './components/SparsityInspector';
import { ConvergenceTelemetry } from './components/ConvergenceTelemetry';
import { BranchCutVisualizer } from './components/BranchCutVisualizer';
import { BenchmarkComparison } from './components/BenchmarkComparison';
import { VerificationAudit } from './components/VerificationAudit';
import { SdkGenerator } from './components/SdkGenerator';
import { BENCHMARK_PROBLEMS } from './solver/benchmarks';
import { OptimizationProblem, SolverOptions, SolverResult } from './solver/types';
import { solveProblem, DEFAULT_SOLVER_OPTIONS } from './solver/solverEngine';
import { Shield, Cpu, Activity, Award } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('console');
  const [currentProblem, setCurrentProblem] = useState<OptimizationProblem>(BENCHMARK_PROBLEMS[0]);
  const [options, setOptions] = useState<SolverOptions>(DEFAULT_SOLVER_OPTIONS);
  const [result, setResult] = useState<SolverResult | null>(null);
  const [isSolving, setIsSolving] = useState<boolean>(false);

  // Execute solve
  const handleSolve = async (overrideProblem?: OptimizationProblem) => {
    const prob = overrideProblem || currentProblem;
    setIsSolving(true);
    try {
      const res = await solveProblem(prob, options);
      setResult(res);
    } catch (err) {
      console.error('Solver execution error:', err);
    } finally {
      setIsSolving(false);
    }
  };

  // Solve initial benchmark problem on first load so interface is populated
  useEffect(() => {
    handleSolve();
  }, []);

  const handleQuickBenchmark = () => {
    setActiveTab('benchmark');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Bar Contract Compliant Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onRunQuickBenchmark={handleQuickBenchmark}
        isSolving={isSolving}
      />

      {/* Hero / Strategic Subheader */}
      <div className="border-b border-slate-800 bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">
                  Indigenous Mathematical Optimization Engine
                </h1>
                <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                  Sovereign Core
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Formulated from mathematical first principles without third-party wrapper dependencies. Supports Revised Simplex, Primal-Dual Mehrotra Interior Point, and Branch-and-Cut with GPU-accelerated sparse matrix kernels.
              </p>
            </div>

            {/* Quick Strategic Indicators */}
            <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Zero Foreign Royalty</span>
              </div>
              <span className="text-slate-700">|</span>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <span>GPU SpMV Kernel</span>
              </div>
              <span className="text-slate-700">|</span>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>BS-VI & Grid Ready</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Stage */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'console' && (
          <SolverConsole
            currentProblem={currentProblem}
            setCurrentProblem={prob => {
              setCurrentProblem(prob);
              handleSolve(prob);
            }}
            options={options}
            setOptions={setOptions}
            onSolve={() => handleSolve()}
            isSolving={isSolving}
            result={result}
          />
        )}

        {activeTab === 'sparsity' && (
          <SparsityInspector problem={currentProblem} />
        )}

        {activeTab === 'telemetry' && (
          <div className="space-y-8">
            <ConvergenceTelemetry
              telemetry={result?.telemetry || []}
              algorithmUsed={result?.algorithmUsed || 'revised_simplex'}
            />
            <BranchCutVisualizer
              branchTree={result?.branchTree}
              dualityGap={result?.dualityGap || 0}
            />
          </div>
        )}

        {activeTab === 'benchmark' && (
          <BenchmarkComparison />
        )}

        {activeTab === 'audit' && (
          <VerificationAudit result={result} problem={currentProblem} />
        )}

        {activeTab === 'sdk' && (
          <SdkGenerator problem={currentProblem} />
        )}
      </main>

      {/* Sovereign Industrial Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-6 mt-12 text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300">BharatSolve Engine</span>
            <span>·</span>
            <span>Sovereign Alternative to IBM ILOG CPLEX, Gurobi, and FICO Xpress</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <span>LP · MILP · QP</span>
            <span>·</span>
            <span>Forrest-Tomlin Basis LU</span>
            <span>·</span>
            <span>Harris 2-Phase Anti-Cycling</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
