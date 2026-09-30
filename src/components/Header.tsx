/**
 * BharatSolve: Sovereign GPU-Accelerated Optimization Engine
 * Top Bar adhering to the Top Bar Contract (3 zones)
 */

import React from 'react';
import { Cpu, Zap, ShieldCheck } from 'lucide-react';
import { gpuEngine } from '../solver/gpuCompute';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onRunQuickBenchmark: () => void;
  isSolving: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onRunQuickBenchmark,
  isSolving,
}) => {
  const gpuInfo = gpuEngine.deviceInfo;

  return (
    <header className="border-b border-slate-800 bg-slate-950/95 sticky top-0 z-50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Zone 1: Single text element wordmark with subtle sovereign symbol */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-base shadow-sm">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current stroke-2">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" opacity="0.6" />
              <circle cx="12" cy="12" r="2.5" className="fill-amber-400" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight text-white leading-none">
              BharatSolve
            </span>
            <span className="text-[11px] font-mono text-slate-400 tracking-wider">
              Sovereign Optimization Core
            </span>
          </div>
        </div>

        {/* Zone 2: Clean text navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
          <button
            onClick={() => setActiveTab('console')}
            className={`transition-colors relative py-1 ${
              activeTab === 'console'
                ? 'text-amber-400 font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-amber-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Solver Console
          </button>
          <button
            onClick={() => setActiveTab('sparsity')}
            className={`transition-colors relative py-1 ${
              activeTab === 'sparsity'
                ? 'text-amber-400 font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-amber-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Matrix Sparsity
          </button>
          <button
            onClick={() => setActiveTab('telemetry')}
            className={`transition-colors relative py-1 ${
              activeTab === 'telemetry'
                ? 'text-amber-400 font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-amber-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Convergence & Tree
          </button>
          <button
            onClick={() => setActiveTab('benchmark')}
            className={`transition-colors relative py-1 ${
              activeTab === 'benchmark'
                ? 'text-amber-400 font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-amber-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Commercial Benchmarks
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`transition-colors relative py-1 ${
              activeTab === 'audit'
                ? 'text-amber-400 font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-amber-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sovereign Audit
          </button>
          <button
            onClick={() => setActiveTab('sdk')}
            className={`transition-colors relative py-1 ${
              activeTab === 'sdk'
                ? 'text-amber-400 font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-amber-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            C++ / Python SDK
          </button>
        </nav>

        {/* Zone 3: Actions & GPU Acceleration Status */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900/80 px-2.5 py-1.5 rounded border border-slate-800">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>{gpuInfo.isAvailable ? 'GPU Kernel: Active' : 'SIMD Fallback'}</span>
          </div>

          <button
            onClick={onRunQuickBenchmark}
            disabled={isSolving}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 transition-colors rounded shadow-sm whitespace-nowrap"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>{isSolving ? 'Solving...' : 'Run Benchmark'}</span>
          </button>
        </div>

      </div>
    </header>
  );
};
