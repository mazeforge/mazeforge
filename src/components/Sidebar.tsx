/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { DifficultyLevel, ComplexityLevel, BoardSpecs, DifficultyAnalytics } from '../types';
import { 
  Dices, 
  Layers, 
  Sliders, 
  Download, 
  Compass
} from 'lucide-react';

interface SidebarProps {
  difficulty: DifficultyLevel;
  setDifficulty: (diff: DifficultyLevel) => void;
  complexity: ComplexityLevel;
  setComplexity: (complex: ComplexityLevel) => void;
  algorithm: 'dfs' | 'prims';
  setAlgorithm: (algo: 'dfs' | 'prims') => void;
  onGenerate: () => void;
  analytics: DifficultyAnalytics;
  onExport: () => void;
  isExporting: boolean;
  specs: BoardSpecs;
}

export default function Sidebar({
  difficulty,
  setDifficulty,
  complexity,
  setComplexity,
  algorithm,
  setAlgorithm,
  onGenerate,
  analytics,
  onExport,
  isExporting,
  specs,
}: SidebarProps) {
  return (
    <aside 
      className="w-full lg:w-96 flex flex-col h-full bg-white border-r border-zinc-200 overflow-y-auto shrink-0 select-none text-zinc-800"
      id="sidebar-controls"
    >
      {/* Brand Header */}
      <div className="p-6 border-b border-zinc-200 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-zinc-950 flex items-center justify-center text-white font-mono font-bold text-base tracking-tighter">
            M
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-zinc-950 uppercase">MazeForge 3D</h1>
            <p className="text-[10px] text-zinc-400 font-mono font-semibold">CAD Tool for 3D Printing</p>
          </div>
        </div>
        <div className="px-2.5 py-1 rounded-full bg-zinc-100 border border-zinc-200 text-[9px] font-mono text-zinc-500 font-extrabold">
          PARAMETRIC GENERATOR
        </div>
      </div>

      <div className="p-6 flex flex-col gap-6 flex-1">
        {/* Module 1: Board Dimensions Size */}
        <div className="flex flex-col gap-2.5">
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 font-mono">
            <Sliders className="w-3.5 h-3.5 text-zinc-450" />
            <span>Board Size (Diameter)</span>
          </label>
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-zinc-100 rounded-xl border border-zinc-200/50">
            {([
              { id: 'easy', label: '100 mm', desc: 'Mini grid' },
              { id: 'medium', label: '140 mm', desc: 'Standard grid' },
              { id: 'hard', label: '180 mm', desc: 'Large grid' },
            ] as const).map((level) => (
              <button
                key={level.id}
                id={`btn-diff-${level.id}`}
                onClick={() => setDifficulty(level.id)}
                className={`flex flex-col items-center py-2 px-1 rounded-lg text-xs font-semibold capitalize transition ${
                  difficulty === level.id
                    ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200/50 font-bold font-semibold'
                    : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50/50'
                }`}
                title={level.desc}
              >
                <span>{level.id}</span>
                <span className="text-[10px] text-zinc-400 font-mono mt-0.5">{level.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Module 2: Maze Density (Complexity) */}
        <div className="flex flex-col gap-2.5">
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 font-mono">
            <Layers className="w-3.5 h-3.5 text-zinc-450" />
            <span>Maze Density & Grid Complexity</span>
          </label>
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-zinc-100 rounded-xl border border-zinc-200/50">
            {(['low', 'medium', 'high'] as ComplexityLevel[]).map((level) => (
              <button
                key={level}
                id={`btn-complex-${level}`}
                onClick={() => setComplexity(level)}
                className={`py-2 rounded-lg text-xs font-semibold capitalize transition ${
                  complexity === level
                    ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200/50 font-bold'
                    : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50/50'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
          <div className="text-[10px] text-zinc-400 font-medium px-1 leading-normal">
            {complexity === 'low' && 'Provides thick, fast-printing robust walls for kids and high-speed FDM runs.'}
            {complexity === 'high' && 'Extremely dense, intricate grid paths with maximum solution complexity.'}
          </div>
        </div>

        {/* Module 3: Maze Branching Logic (Algorithms) */}
        <div className="flex flex-col gap-2.5">
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 font-mono">
            <Compass className="w-3.5 h-3.5 text-zinc-450" />
            <span>Procedural Algorithm</span>
          </label>
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-zinc-100 rounded-xl border border-zinc-200/50">
            {[
              { id: 'dfs', label: 'Backtracker (DFS)', desc: 'Long winding solver routes' },
              { id: 'prims', label: 'Branching (Prim\'s)', desc: 'Organic branching routes' },
            ].map((algo) => (
              <button
                key={algo.id}
                id={`btn-algo-${algo.id}`}
                onClick={() => setAlgorithm(algo.id as 'dfs' | 'prims')}
                className={`flex flex-col items-center py-2 rounded-lg transition ${
                  algorithm === algo.id
                    ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200/50 font-bold'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
                title={algo.desc}
              >
                <span className="text-xs font-semibold">{algo.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Big Generate Action Button */}
        <button
          id="btn-generate-maze"
          onClick={onGenerate}
          className="w-full mt-1 bg-zinc-950 hover:bg-zinc-900 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 group border border-zinc-950 active:scale-[0.98]"
        >
          <Dices className="w-4 h-4 group-hover:rotate-180 transition duration-500 text-zinc-300" />
          <span className="text-xs uppercase tracking-wider font-extrabold">Generate Maze Model</span>
        </button>

        <div className="flex-1" />

        {/* Module 6: Export and Slicer Downloads */}
         <div className="flex flex-col gap-2.5 mt-auto">
          <div className="flex flex-col gap-2">
            {/* Primary Action Button: Export STL Files */}
            <button
              id="btn-export-stl"
              disabled={isExporting}
              onClick={onExport}
              className="w-full bg-zinc-950 hover:bg-zinc-900 disabled:bg-zinc-450 text-white font-bold py-3.5 px-4 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 text-xs font-mono group cursor-pointer active:scale-[0.98]"
            >
              <Download className="w-4 h-4 text-zinc-300 group-hover:translate-y-0.5 transition duration-200" />
              <span className="font-extrabold uppercase tracking-wider text-white">Export STL Files</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
