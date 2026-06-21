/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { DifficultyLevel, ComplexityLevel, BoardSpecs, MazeGrid, DifficultyAnalytics } from './types';
import { generateMaze, analyzeDifficulty } from './mazeGenerator';
import { buildBoardMesh, buildBallMesh, exportToBinarySTL, mergeMeshes } from './exporter3MF';
import Sidebar from './components/Sidebar';
import ThreeViewer from './components/ThreeViewer';
import { Compass } from 'lucide-react';

function getBoardSpecs(diff: DifficultyLevel, complexity: ComplexityLevel): BoardSpecs {
  const specs: Partial<BoardSpecs> = {
    thickness: 10.5,
    channelDepth: 8,
    baseThickness: 2.5, 
    rodDiameter: 8,
    rodLength: 10,
    knobDiameter: 18, 
  };

  // Set precise target board size strictly based on current Board Size (difficulty) selection
  if (diff === 'easy') {
    specs.size = 100.0;
  } else if (diff === 'medium') {
    specs.size = 140.0;
  } else {
    specs.size = 180.0;
  }

  // Set cells count based on complexity / density level
  if (diff === 'easy') {
    if (complexity === 'low') specs.cellCount = 5;
    else if (complexity === 'medium') specs.cellCount = 6;
    else specs.cellCount = 7;
  } else if (diff === 'medium') {
    if (complexity === 'low') specs.cellCount = 7;
    else if (complexity === 'medium') specs.cellCount = 8;
    else specs.cellCount = 9;
  } else {
    if (complexity === 'low') specs.cellCount = 9;
    else if (complexity === 'medium') specs.cellCount = 11;
    else specs.cellCount = 13;
  }

  // Set wall width to a constant of exactly 2.0 mm across all profiles
  specs.wallWidth = 2.0;

  // Calculate dynamic channel width so that Board Size remains exactly target size
  const margin = 4.0;
  const totalWallSpaces = (specs.cellCount - 1) * specs.wallWidth;
  const availableTrackSpace = specs.size - (2 * margin) - totalWallSpaces;
  specs.channelWidth = availableTrackSpace / specs.cellCount;

  // Adjust ball diameter dynamically to match the track with exactly 2.0 mm total safety clearance
  specs.ballDiameter = specs.channelWidth - 2.0;

  return specs as BoardSpecs;
}

export default function App() {
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium');
  const [complexity, setComplexity] = useState<ComplexityLevel>('medium');
  const [algorithm, setAlgorithm] = useState<'dfs' | 'prims'>('dfs');
  
  const [specs, setSpecs] = useState<BoardSpecs>(() => getBoardSpecs('medium', 'medium'));
  const [grid, setGrid] = useState<MazeGrid>(() => generateMaze(getBoardSpecs('medium', 'medium'), 'dfs'));
  const [analytics, setAnalytics] = useState<DifficultyAnalytics>(() => analyzeDifficulty(grid, getBoardSpecs('medium', 'medium')));

  const [resetTrigger, setResetTrigger] = useState<number>(0);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Sync board specs and generate initial layouts on difficulty/complexity changes
  useEffect(() => {
    const newSpecs = getBoardSpecs(difficulty, complexity);
    setSpecs(newSpecs);
    
    const newGrid = generateMaze(newSpecs, algorithm);
    setGrid(newGrid);
    
    const newAn = analyzeDifficulty(newGrid, newSpecs);
    setAnalytics(newAn);

    setResetTrigger((prev) => prev + 1);
  }, [difficulty, complexity, algorithm]);

  // Generate Maze action (explicitly manually regenerates with randomized seed)
  const handleGenerate = () => {
    const newSpecs = getBoardSpecs(difficulty, complexity);
    setSpecs(newSpecs);

    const newGrid = generateMaze(newSpecs, algorithm);
    setGrid(newGrid);
    
    const newAn = analyzeDifficulty(newGrid, newSpecs);
    setAnalytics(newAn);

    setResetTrigger((prev) => prev + 1);
  };

  // Universal Slicer Exporter downloader
  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Build discrete part meshes
      const boardMesh = buildBoardMesh(grid, specs);
      const ballMesh = buildBallMesh(grid, specs);

      // Export individual parts as binary STL blobs
      const boardBlob = exportToBinarySTL(boardMesh);
      const ballBlob = exportToBinarySTL(ballMesh);

      // Create JSZip archive
      const zip = new JSZip();
      zip.file("Maze.stl", boardBlob);
      zip.file("Ball.stl", ballBlob);

      // Generate the ZIP blob
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      // Trigger standard browser download
      const zipLink = document.createElement('a');
      zipLink.href = URL.createObjectURL(zipBlob);
      zipLink.download = `Maze_and_Ball.zip`;
      document.body.appendChild(zipLink);
      zipLink.click();
      document.body.removeChild(zipLink);

    } catch (err) {
      console.error("Failed to generate model export slices:", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen w-screen overflow-hidden bg-zinc-100 font-sans" id="app-wrapper">
      {/* Sidebar Parametric Controls */}
      <Sidebar
        difficulty={difficulty}
        setDifficulty={setDifficulty}
        complexity={complexity}
        setComplexity={setComplexity}
        algorithm={algorithm}
        setAlgorithm={setAlgorithm}
        onGenerate={handleGenerate}
        analytics={analytics}
        onExport={handleExport}
        isExporting={isExporting}
        specs={specs}
      />

      {/* Main Viewport Workspace */}
      <main className="flex-1 flex flex-col relative h-full">
        {/* Workspace Topbar */}
        <header className="px-6 py-4 bg-white border-b border-zinc-200 flex items-center justify-between select-none shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold tracking-tight text-zinc-950 uppercase flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-zinc-650" />
            </h2>
          </div>
        </header>

        {/* 3D Static CAD Viewer Workspace */}
        <div className="flex-1 min-h-0 relative flex flex-col">
          <ThreeViewer
            grid={grid}
            specs={specs}
            resetTrigger={resetTrigger}
          />
        </div>
      </main>
    </div>
  );
}
