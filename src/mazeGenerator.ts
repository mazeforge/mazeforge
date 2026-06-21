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
  const start = { r: 0, c: 0 };
  const finish = { r: rows - 1, c: cols - 1 };

  const totalCells = rows * cols;
  // We'll target finding a maze with a path length of at least 40% of the cells (which guarantees a beautiful winding path)
  const targetLength = Math.max(5, Math.floor(totalCells * 0.40));

  let bestGrid: MazeGrid | null = null;
  let maxPathLength = -1;

  // Limit to at most 15 instantaneous runs to entirely prevent any threat of main-thread freeze or crash
  for (let attempt = 0; attempt < 15; attempt++) {
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
    const pathLength = solution.length;

    if (pathLength > maxPathLength) {
      maxPathLength = pathLength;
      bestGrid = currentGrid;
    }

    // Stop candidate generation immediately once we have a winding path that satisfies complexity criteria
    if (pathLength >= targetLength) {
      break;
    }
  }

  return bestGrid!;
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
