import { BoardSpecs, MazeGrid, DifficultyAnalytics } from './types';

// Helper to check if coordinates are within bounds
function inBounds(r: number, c: number, rows: number, cols: number): boolean {
  return r >= 0 && r < rows && c >= 0 && c < cols;
}

// Helper to count dead ends on the outermost border of the maze (excluding start and finish cells)
function countBorderDeadEnds(
  rows: number,
  cols: number,
  verticalWalls: boolean[][],
  horizontalWalls: boolean[][],
  start: { r: number; c: number },
  finish: { r: number; c: number }
): number {
  let borderDeadEnds = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const isBorder = r === 0 || r === rows - 1 || c === 0 || c === cols - 1;
      if (!isBorder) continue;

      // Skip start and finish cells (as they have outward-facing openings)
      if ((r === start.r && c === start.c) || (r === finish.r && c === finish.c)) {
        continue;
      }

      let passages = 0;
      // Up
      if (r > 0 && !horizontalWalls[r - 1][c]) passages++;
      // Down
      if (r < rows - 1 && !horizontalWalls[r][c]) passages++;
      // Left
      if (c > 0 && !verticalWalls[r][c - 1]) passages++;
      // Right
      if (c < cols - 1 && !verticalWalls[r][c]) passages++;

      if (passages === 1) {
        borderDeadEnds++;
      }
    }
  }
  return borderDeadEnds;
}

// Helper to count wall segments that terminate with a dead end single cell away from the outer border
function countBorderWallFingers(
  rows: number,
  cols: number,
  verticalWalls: boolean[][],
  horizontalWalls: boolean[][],
): number {
  let fingers = 0;
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const wN = verticalWalls[r][c];       // Upper transition (going North, i.e., up)
      const wS = verticalWalls[r + 1][c];   // Lower transition (going South, i.e., down)
      const wW = horizontalWalls[r][c];     // Left transition (going West, i.e., left)
      const wE = horizontalWalls[r][c + 1]; // Right transition (going East, i.e., right)

      const activeCount = (wN ? 1 : 0) + (wS ? 1 : 0) + (wW ? 1 : 0) + (wE ? 1 : 0);

      if (activeCount === 1) {
        // This is a dead-end corner of a wall segment. Check if it's 1-cell away from the board's outer boundary.
        if (r === 0 && wS) {
          fingers++;
        } else if (r === rows - 2 && wN) {
          fingers++;
        } else if (c === 0 && wE) {
          fingers++;
        } else if (c === cols - 2 && wW) {
          fingers++;
        }
      }
    }
  }
  return fingers;
}

// Helper to recursively compute the maximum depth of a branch off the solution path.
function getBranchDepth(
  r: number,
  c: number,
  parentR: number,
  parentC: number,
  rows: number,
  cols: number,
  verticalWalls: boolean[][],
  horizontalWalls: boolean[][],
  solutionSet: Set<string>
): number {
  let maxDepth = 1;
  const dirs = [
    { dr: -1, dc: 0, type: 'h', wr: r - 1, wc: c }, // up
    { dr: 1, dc: 0, type: 'h', wr: r, wc: c },     // down
    { dr: 0, dc: -1, type: 'v', wr: r, wc: c - 1 }, // left
    { dr: 0, dc: 1, type: 'v', wr: r, wc: c },     // right
  ];

  for (const d of dirs) {
    const nr = r + d.dr;
    const nc = c + d.dc;
    if (nr === parentR && nc === parentC) continue;
    if (solutionSet.has(`${nr},${nc}`)) continue;
    if (!inBounds(nr, nc, rows, cols)) continue;

    // Check wall
    let hasWall = false;
    if (d.type === 'v' && verticalWalls[d.wr][d.wc]) hasWall = true;
    if (d.type === 'h' && horizontalWalls[d.wr][d.wc]) hasWall = true;

    if (!hasWall) {
      const depth = 1 + getBranchDepth(nr, nc, r, c, rows, cols, verticalWalls, horizontalWalls, solutionSet);
      if (depth > maxDepth) {
        maxDepth = depth;
      }
    }
  }
  return maxDepth;
}

// Procedural Maze Generator
export function generateMaze(
  specs: BoardSpecs,
  algorithm: 'dfs' | 'prims' = 'dfs'
): MazeGrid {
  const N = specs.cellCount;
  const rows = N;
  const cols = N;
  const start = { r: 0, c: 0 };
  const finish = { r: rows - 1, c: cols - 1 };
  const totalCells = rows * cols;

  let bestGrid: MazeGrid | null = null;
  let bestScore = -Infinity;

  // Running 400 iterations lets us scan for an extremely winded, difficult path with minimal border dead ends
  const totalTrials = 400;

  for (let attempt = 0; attempt < totalTrials; attempt++) {
    // Initialize wall matrices (all walls intact)
    const verticalWalls: boolean[][] = [];
    const horizontalWalls: boolean[][] = [];

    for (let r = 0; r < rows; r++) {
      verticalWalls.push(new Array(cols - 1).fill(true));
    }
    for (let r = 0; r < rows - 1; r++) {
      horizontalWalls.push(new Array(cols).fill(true));
    }

    if (algorithm === 'prims') {
      // Randomized Prim's Algorithm for Perfect Maze Spanning Tree
      const primVisited = Array.from({ length: rows }, () => new Array(cols).fill(false));
      
      type PrimWall = {
        r1: number; c1: number;
        r2: number; c2: number;
        type: 'v' | 'h';
        wr: number;
        wc: number;
      };
      
      const wallList: PrimWall[] = [];
      
      const addWallsOfCell = (r: number, c: number) => {
        primVisited[r][c] = true;
        // Do not expand neighbors of the finish cell. This ensures the finish cell maintains degree 1.
        if (r === rows - 1 && c === cols - 1) {
          return;
        }
        const dirs = [
          { dr: -1, dc: 0, type: 'h', wr: r - 1, wc: c }, // up
          { dr: 1, dc: 0, type: 'h', wr: r, wc: c },     // down
          { dr: 0, dc: -1, type: 'v', wr: r, wc: c - 1 }, // left
          { dr: 0, dc: 1, type: 'v', wr: r, wc: c },     // right
        ];
        
        dirs.forEach(d => {
          const nr = r + d.dr;
          const nc = c + d.dc;
          if (inBounds(nr, nc, rows, cols) && !primVisited[nr][nc]) {
            wallList.push({
              r1: r, c1: c,
              r2: nr, c2: nc,
              type: d.type as 'v' | 'h',
              wr: d.wr,
              wc: d.wc
            });
          }
        });
      };
      
      addWallsOfCell(0, 0);
      
      while (wallList.length > 0) {
        const idx = Math.floor(Math.random() * wallList.length);
        const wall = wallList.splice(idx, 1)[0];
        
        if (primVisited[wall.r1][wall.c1] !== primVisited[wall.r2][wall.c2]) {
          const unvisitedR = primVisited[wall.r1][wall.c1] ? wall.r2 : wall.r1;
          const unvisitedC = primVisited[wall.r1][wall.c1] ? wall.c2 : wall.c1;
          
          if (wall.type === 'v') {
            verticalWalls[wall.wr][wall.wc] = false;
          } else {
            horizontalWalls[wall.wr][wall.wc] = false;
          }
          
          addWallsOfCell(unvisitedR, unvisitedC);
        }
      }
    } else {
      // Randomized DFS Algorithm for Perfect Maze Spanning Tree
      const genVisited = Array.from({ length: rows }, () => new Array(cols).fill(false));
      const stack: { r: number; c: number }[] = [];
      
      genVisited[0][0] = true;
      stack.push({ r: 0, c: 0 });
      
      while (stack.length > 0) {
        const curr = stack[stack.length - 1];
        
        // If the current cell is the finish cell, backtrack immediately to keep its degree exactly 1.
        if (curr.r === rows - 1 && curr.c === cols - 1) {
          stack.pop();
          continue;
        }

        const dirs = [
          { dr: -1, dc: 0, type: 'h', wr: curr.r - 1, wc: curr.c }, // up
          { dr: 1, dc: 0, type: 'h', wr: curr.r, wc: curr.c },     // down
          { dr: 0, dc: -1, type: 'v', wr: curr.r, wc: curr.c - 1 }, // left
          { dr: 0, dc: 1, type: 'v', wr: curr.r, wc: curr.c },     // right
        ];
        
        const unvisitedNeighbors = dirs.filter(d => {
          const nr = curr.r + d.dr;
          const nc = curr.c + d.dc;
          return inBounds(nr, nc, rows, cols) && !genVisited[nr][nc];
        });
        
        if (unvisitedNeighbors.length > 0) {
          const chosen = unvisitedNeighbors[Math.floor(Math.random() * unvisitedNeighbors.length)];
          const nr = curr.r + chosen.dr;
          const nc = curr.c + chosen.dc;
          
          if (chosen.type === 'v') {
            verticalWalls[chosen.wr][chosen.wc] = false;
          } else {
            horizontalWalls[chosen.wr][chosen.wc] = false;
          }
          
          genVisited[nr][nc] = true;
          stack.push({ r: nr, c: nc });
        } else {
          stack.pop();
        }
      }
    }

    const currentGrid: MazeGrid = {
      rows,
      cols,
      verticalWalls,
      horizontalWalls,
      start,
      finish,
    };

    const solution = solveMaze(currentGrid);

    // Enforce exactly 1 open wall for the finish cell, which is the transition to/from the solution path.
    // Close any other walls leading to the finish cell to guarantee no path exists after the finish.
    if (solution.length > 1) {
      const beforeFinish = solution[solution.length - 2];
      if (beforeFinish.r === rows - 2 && beforeFinish.c === cols - 1) {
        // Path came from above. Keep Up open, close Left (if in bounds)
        horizontalWalls[rows - 2][cols - 1] = false;
        if (cols > 1) {
          verticalWalls[rows - 1][cols - 2] = true;
        }
      } else if (beforeFinish.r === rows - 1 && beforeFinish.c === cols - 2) {
        // Path came from left. Keep Left open, close Up (if in bounds)
        if (cols > 1) {
          verticalWalls[rows - 1][cols - 2] = false;
        }
        if (rows > 1) {
          horizontalWalls[rows - 2][cols - 1] = true;
        }
      }
    }

    const pathLength = solution.length;
    const borderDeadEnds = countBorderDeadEnds(rows, cols, verticalWalls, horizontalWalls, start, finish);
    const borderWallFingers = countBorderWallFingers(rows, cols, verticalWalls, horizontalWalls);

    // Calculate turns in solution
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

    // Scoring metric: We want maximum start-to-finish pathLength, maximum winding turns, zero border wall fingers, and minimal borderDeadEnds
    let difficultyWeight = (pathLength * 50) + (turns * 250);
    // Apply heavy penalty if solution path is too short (covering less than 55% of total cells)
    if (pathLength < totalCells * 0.55) {
      difficultyWeight -= 100000;
    }
    const score = difficultyWeight - (borderWallFingers * 2000) - (borderDeadEnds * 150);

    if (score > bestScore) {
      bestScore = score;
      bestGrid = {
        rows,
        cols,
        verticalWalls: verticalWalls.map(row => [...row]),
        horizontalWalls: horizontalWalls.map(row => [...row]),
        start,
        finish,
      };
    }
  }

  // Fallback to avoid nullable
  const finalGrid = bestGrid ? bestGrid : {
    rows,
    cols,
    verticalWalls: Array.from({ length: rows }, () => new Array(cols - 1).fill(true)),
    horizontalWalls: Array.from({ length: rows - 1 }, () => new Array(cols).fill(true)),
    start,
    finish,
  };

  // Perform localized wall removal on any remaining border dead ends
  const solution = solveMaze(finalGrid);
  const solutionSet = new Set(solution.map(p => `${p.r},${p.c}`));

  const finalVWalls = finalGrid.verticalWalls;
  const finalHWalls = finalGrid.horizontalWalls;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const isBorder = r === 0 || r === rows - 1 || c === 0 || c === cols - 1;
      if (!isBorder) continue;

      // Skip start and finish cells
      if ((r === start.r && c === start.c) || (r === finish.r && c === finish.c)) {
        continue;
      }

      let passages = 0;
      // Up
      if (r > 0 && !finalHWalls[r - 1][c]) passages++;
      // Down
      if (r < rows - 1 && !finalHWalls[r][c]) passages++;
      // Left
      if (c > 0 && !finalVWalls[r][c - 1]) passages++;
      // Right
      if (c < cols - 1 && !finalVWalls[r][c]) passages++;

      if (passages === 1) {
        // Find closed interior walls to adjacent cells
        const closedNeighbors: { nr: number; nc: number; type: 'v' | 'h'; wr: number; wc: number }[] = [];
        // Up
        if (r > 0 && finalHWalls[r - 1][c]) {
          const nr = r - 1;
          const nc = c;
          if (!((nr === start.r && nc === start.c) || (nr === finish.r && nc === finish.c))) {
            closedNeighbors.push({ nr, nc, type: 'h', wr: r - 1, wc: c });
          }
        }
        // Down
        if (r < rows - 1 && finalHWalls[r][c]) {
          const nr = r + 1;
          const nc = c;
          if (!((nr === start.r && nc === start.c) || (nr === finish.r && nc === finish.c))) {
            closedNeighbors.push({ nr, nc, type: 'h', wr: r, wc: c });
          }
        }
        // Left
        if (c > 0 && finalVWalls[r][c - 1]) {
          const nr = r;
          const nc = c - 1;
          if (!((nr === start.r && nc === start.c) || (nr === finish.r && nc === finish.c))) {
            closedNeighbors.push({ nr, nc, type: 'v', wr: r, wc: c - 1 });
          }
        }
        // Right
        if (c < cols - 1 && finalVWalls[r][c]) {
          const nr = r;
          const nc = c + 1;
          if (!((nr === start.r && nc === start.c) || (nr === finish.r && nc === finish.c))) {
            closedNeighbors.push({ nr, nc, type: 'v', wr: r, wc: c });
          }
        }

        if (closedNeighbors.length > 0) {
          // Prioritize neighboring cells that are NOT on the solution path to keep the solution path as long and hard as possible
          const offPath = closedNeighbors.filter(n => !solutionSet.has(`${n.nr},${n.nc}`));
          const candidates = offPath.length > 0 ? offPath : closedNeighbors;
          // Pick a random candidate
          const chosen = candidates[Math.floor(Math.random() * candidates.length)];
          if (chosen.type === 'v') {
            finalVWalls[chosen.wr][chosen.wc] = false;
          } else {
            finalHWalls[chosen.wr][chosen.wc] = false;
          }
        }
      }
    }
  }

  // Post-Post-Processing: Enforce that the finish cell has EXACTLY one open wall (the entry transition from the solution path).
  // This guarantees there are absolutely NO paths continuing past/after the finish cell.
  const finalSol = solveMaze(finalGrid);
  if (finalSol.length > 1) {
    const beforeFinish = finalSol[finalSol.length - 2];
    if (beforeFinish.r === rows - 2 && beforeFinish.c === cols - 1) {
      // Path came from above. Keep Up open (passage = false), close Left (wall = true)
      finalGrid.horizontalWalls[rows - 2][cols - 1] = false;
      if (cols > 1) {
        finalGrid.verticalWalls[rows - 1][cols - 2] = true;
      }
    } else if (beforeFinish.r === rows - 1 && beforeFinish.c === cols - 2) {
      // Path came from left. Keep Left open (passage = false), close Up (wall = true)
      if (cols > 1) {
        finalGrid.verticalWalls[rows - 1][cols - 2] = false;
      }
      if (rows > 1) {
        finalGrid.horizontalWalls[rows - 2][cols - 1] = true;
      }
    }
  }

  // Also, for the start cell (0, 0), let's ensure it has exactly one open wall (the exit transition into the solution path).
  if (finalSol.length > 1) {
    const afterStart = finalSol[1];
    if (afterStart.r === 1 && afterStart.c === 0) {
      // Path goes down. Keep Down open (passage = false), close Right (wall = true)
      finalGrid.horizontalWalls[0][0] = false;
      if (cols > 1) {
        finalGrid.verticalWalls[0][0] = true;
      }
    } else if (afterStart.r === 0 && afterStart.c === 1) {
      // Path goes right. Keep Right open (passage = false), close Down (wall = true)
      if (cols > 1) {
        finalGrid.verticalWalls[0][0] = false;
      }
      if (rows > 1) {
        finalGrid.horizontalWalls[0][0] = true;
      }
    }
  }

  return finalGrid;
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
