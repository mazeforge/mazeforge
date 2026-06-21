import { BoardSpecs, MazeGrid, DifficultyAnalytics } from './types';

// Helper to check if coordinates are within bounds
function inBounds(r: number, c: number, rows: number, cols: number): boolean {
  return r >= 0 && r < rows && c >= 0 && c < cols;
}

// Procedural Maze Generator
export function generateMaze(
  specs: BoardSpecs,
  algorithm: 'dfs' | 'prims' = 'dfs'
): MazeGrid {
  const N = specs.cellCount;
  const rows = N;
  const cols = N;

  // Initialize wall matrices (all walls intact)
  const verticalWalls: boolean[][] = [];
  const horizontalWalls: boolean[][] = [];

  for (let r = 0; r < rows; r++) {
    verticalWalls.push(new Array(cols - 1).fill(true));
  }
  for (let r = 0; r < rows - 1; r++) {
    horizontalWalls.push(new Array(cols).fill(true));
  }

  const start = { r: 0, c: 0 };
  const finish = { r: rows - 1, c: cols - 1 };

  const totalCells = rows * cols;
  let targetLength = Math.floor(totalCells * 0.74); // 74% target primary route occupies most of the board!

  let primaryPath: { r: number; c: number }[] = [];
  let attempts = 0;

  while (attempts < 150) {
    attempts++;
    // Gradually reduce complexity target if finding a self-avoiding path is too hard on high-density grids
    if (attempts % 15 === 0) {
      targetLength = Math.max(Math.floor(totalCells * 0.50), targetLength - 2);
    }

    const path: { r: number; c: number }[] = [start];
    const visited = Array.from({ length: rows }, () => new Array(cols).fill(false));
    visited[start.r][start.c] = true;

    // DFS with random direction selection
    const dfs = (r: number, c: number): boolean => {
      if (r === finish.r && c === finish.c) {
        if (path.length >= targetLength) {
          primaryPath = [...path];
          return true;
        }
        return false; // too short, continue search
      }

      const dirs = [
        { dr: -1, dc: 0 },
        { dr: 1, dc: 0 },
        { dr: 0, dc: -1 },
        { dr: 0, dc: 1 }
      ];

      // Randomize neighbors
      const neighbors = dirs
        .map(d => ({ r: r + d.dr, c: c + d.dc, weight: Math.random() }))
        .filter(n => inBounds(n.r, n.c, rows, cols) && !visited[n.r][n.c]);

      neighbors.sort((a, b) => b.weight - a.weight);

      for (const n of neighbors) {
        // If it's the finish cell, but we haven't reached target length, skip it for now if there are other candidates
        if (n.r === finish.r && n.c === finish.c && path.length < targetLength) {
          if (neighbors.length > 1) {
            continue;
          }
        }

        visited[n.r][n.c] = true;
        path.push({ r: n.r, c: n.c });

        if (dfs(n.r, n.c)) {
          return true;
        }

        path.pop();
        visited[n.r][n.c] = false;
      }

      return false;
    };

    if (dfs(start.r, start.c)) {
      break;
    }
  }

  // Knock down walls along the primary path (this guarantees start and finish are fully connected)
  for (let i = 0; i < primaryPath.length - 1; i++) {
    const p1 = primaryPath[i];
    const p2 = primaryPath[i + 1];
    if (p1.r === p2.r) {
      const minC = Math.min(p1.c, p2.c);
      verticalWalls[p1.r][minC] = false;
    } else {
      const minR = Math.min(p1.r, p2.r);
      horizontalWalls[minR][p1.c] = false;
    }
  }

  // Fill in secondary branching paths to cover all remaining cells of the grid
  const branchVisited = Array.from({ length: rows }, () => new Array(cols).fill(false));
  primaryPath.forEach(p => {
    branchVisited[p.r][p.c] = true;
  });

  type BranchWall = {
    r1: number; c1: number; // Visited side
    r2: number; c2: number; // Unvisited candidate
    wallType: 'v' | 'h';
    wallR: number;
    wallC: number;
  };

  const frontier: BranchWall[] = [];

  const addBranchFrontier = (r: number, c: number) => {
    const dirs = [
      { dr: -1, dc: 0, wallType: 'h', wallR: r - 1, wallC: c },
      { dr: 1, dc: 0, wallType: 'h', wallR: r, wallC: c },
      { dr: 0, dc: -1, wallType: 'v', wallR: r, wallC: c - 1 },
      { dr: 0, dc: 1, wallType: 'v', wallR: r, wallC: c },
    ];

    dirs.forEach((d) => {
      const nr = r + d.dr;
      const nc = c + d.dc;
      if (inBounds(nr, nc, rows, cols) && !branchVisited[nr][nc]) {
        // Crucial safety constraint: NEVER connect a branch into the 'finish' cell!
        // This ensures the finish remains a terminal dead-end of degree 1.
        if (nr === finish.r && nc === finish.c) return;

        frontier.push({
          r1: r, c1: c,
          r2: nr, c2: nc,
          wallType: d.wallType as 'v' | 'h',
          wallR: d.wallR,
          wallC: d.wallC
        });
      }
    });
  };

  // Seed branch expansion from all primary path cells except the finish cell
  for (let i = 0; i < primaryPath.length - 1; i++) {
    addBranchFrontier(primaryPath[i].r, primaryPath[i].c);
  }

  // randomized growing tree
  while (frontier.length > 0) {
    const selectIndex = Math.floor(Math.random() * frontier.length);
    const wall = frontier.splice(selectIndex, 1)[0];

    if (branchVisited[wall.r1][wall.c1] && !branchVisited[wall.r2][wall.c2]) {
      // Knock down wall
      if (wall.wallType === 'v') {
         verticalWalls[wall.wallR][wall.wallC] = false;
      } else {
         horizontalWalls[wall.wallR][wall.wallC] = false;
      }

      branchVisited[wall.r2][wall.c2] = true;
      addBranchFrontier(wall.r2, wall.c2);
    }
  }

  return {
    rows,
    cols,
    verticalWalls,
    horizontalWalls,
    start,
    finish,
  };
}

// Complete Solver using BFS to find optimal solution path
export function solveMaze(grid: MazeGrid): { r: number; c: number }[] {
  const { rows, cols, verticalWalls, horizontalWalls, start, finish } = grid;
  const queue: { r: number; c: number; path: { r: number; c: number }[] }[] = [];
  const visited = Array.from({ length: rows }, () => new Array(cols).fill(false));

  queue.push({ ...start, path: [start] });
  visited[start.r][start.c] = true;

  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr.r === finish.r && curr.c === finish.c) {
      return curr.path;
    }

    // Neighbors we can reach
    // Up
    if (curr.r > 0 && !horizontalWalls[curr.r - 1][curr.c] && !visited[curr.r - 1][curr.c]) {
      visited[curr.r - 1][curr.c] = true;
      queue.push({ r: curr.r - 1, c: curr.c, path: [...curr.path, { r: curr.r - 1, c: curr.c }] });
    }
    // Down
    if (curr.r < rows - 1 && !horizontalWalls[curr.r][curr.c] && !visited[curr.r + 1][curr.c]) {
      visited[curr.r + 1][curr.c] = true;
      queue.push({ r: curr.r + 1, c: curr.c, path: [...curr.path, { r: curr.r + 1, c: curr.c }] });
    }
    // Left
    if (curr.c > 0 && !verticalWalls[curr.r][curr.c - 1] && !visited[curr.r][curr.c - 1]) {
      visited[curr.r][curr.c - 1] = true;
      queue.push({ r: curr.r, c: curr.c - 1, path: [...curr.path, { r: curr.r, c: curr.c - 1 }] });
    }
    // Right
    if (curr.c < cols - 1 && !verticalWalls[curr.r][curr.c] && !visited[curr.r][curr.c + 1]) {
      visited[curr.r][curr.c + 1] = true;
      queue.push({ r: curr.r, c: curr.c + 1, path: [...curr.path, { r: curr.r, c: curr.c + 1 }] });
    }
  }

  return []; // Unsolvable (should not happen with our generator)
}

// Calculate difficulty analytics
export function analyzeDifficulty(grid: MazeGrid, specs: BoardSpecs): DifficultyAnalytics {
  const solution = solveMaze(grid);
  const cellSize = specs.channelWidth + specs.wallWidth;

  // 1. Path Length (mm)
  // Distance between adjacent cells is exactly cellSize
  const pathLength = Math.round((solution.length - 1) * cellSize);

  // 2. Number of Turns
  let turns = 0;
  if (solution.length > 2) {
    let lastDr = solution[1].r - solution[0].r;
    let lastDc = solution[1].c - solution[0].c;

    for (let i = 2; i < solution.length; i++) {
      const dr = solution[i].r - solution[i - 1].r;
      const dc = solution[i].c - solution[i - 1].c;

      if (dr !== lastDr || dc !== lastDc) {
        turns++;
        lastDr = dr;
        lastDc = dc;
      }
    }
  }

  // 3. Dead Ends
  // Count how many cells have total open pathways (degree) equal to 1.
  // We check all cells except start & finish.
  let deadEnds = 0;
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      if ((r === grid.start.r && c === grid.start.c) || (r === grid.finish.r && c === grid.finish.c)) {
        continue;
      }

      let passages = 0;
      // Up
      if (r > 0 && !grid.horizontalWalls[r - 1][c]) passages++;
      // Down
      if (r < grid.rows - 1 && !grid.horizontalWalls[r][c]) passages++;
      // Left
      if (c > 0 && !grid.verticalWalls[r][c - 1]) passages++;
      // Right
      if (c < grid.cols - 1 && !grid.verticalWalls[r][c]) passages++;

      if (passages === 1) {
        deadEnds++;
      }
    }
  }

  // 4. Calculate a realistic Difficulty Score (0 to 10 scale)
  // Factors: cellCount (width/height dimensions), path length ratio, turns ratio, dead end density.
  let baseScore = 0;
  if (specs.cellCount <= 7) {
    // Easy range: 1.0 to 3.0
    const cellScore = 1.0;
    const lenFactor = (solution.length / 15) * 1.0;
    const turnFactor = (turns / 6) * 0.8;
    const deadEndFactor = (deadEnds / 8) * 0.2;
    baseScore = cellScore + lenFactor + turnFactor + deadEndFactor;
    baseScore = Math.max(1.0, Math.min(3.0, baseScore));
  } else if (specs.cellCount <= 10) {
    // Medium range: 3.5 to 6.8
    const cellScore = 3.5;
    const lenFactor = (solution.length / 35) * 1.5;
    const turnFactor = (turns / 16) * 1.2;
    const deadEndFactor = (deadEnds / 24) * 0.6;
    baseScore = cellScore + lenFactor + turnFactor + deadEndFactor;
    baseScore = Math.max(3.5, Math.min(6.8, baseScore));
  } else {
    // Hard range: 7.0 to 9.8
    const cellScore = 7.0;
    const lenFactor = (solution.length / 75) * 1.5; // max solution around 75 cells for 12x12
    const turnFactor = (turns / 35) * 1.0;
    const deadEndFactor = (deadEnds / 45) * 0.4;
    baseScore = cellScore + lenFactor + turnFactor + deadEndFactor;
    baseScore = Math.max(7.0, Math.min(9.8, baseScore));
  }

  // Double-check precision
  const score = parseFloat(baseScore.toFixed(1));

  return {
    score,
    pathLength,
    turns,
    deadEnds,
    boardSizeText: `${specs.size} × ${specs.size} mm`,
  };
}
