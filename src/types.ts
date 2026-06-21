export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export type ComplexityLevel = 'low' | 'medium' | 'high';

export interface BoardSpecs {
  size: number;              // 100, 140, or 180 mm
  thickness: number;         // 15 mm
  cellCount: number;         // 6, 9, or 12
  wallWidth: number;         // Calculated dynamically
  channelWidth: number;      // 12 mm
  channelDepth: number;      // 8 mm
  baseThickness: number;     // thickness - channelDepth = 7 mm
  ballDiameter: number;      // 10 mm
  rodDiameter: number;       // 8 mm
  rodLength: number;         // 25 mm
  knobDiameter: number;      // 18 mm
}

export interface MazeGrid {
  rows: number;
  cols: number;
  verticalWalls: boolean[][];   // true if wall exists between (r, c) and (r, c+1)
  horizontalWalls: boolean[][]; // true if wall exists between (r, c) and (r+1, c)
  start: { r: number; c: number };
  finish: { r: number; c: number };
}

export interface DifficultyAnalytics {
  score: number;         // 0 - 10
  pathLength: number;    // in mm
  turns: number;         // number of turns in the solution path
  deadEnds: number;      // number of dead ends in the maze
  boardSizeText: string; // e.g., "180 × 180 mm"
}

export interface PrintValidationReport {
  isValid: boolean;
  minWallThickness: number;     // mm
  channelWidth: number;         // mm
  ballClearance: number;        // mm
  isManifold: boolean;
  warnings: string[];
}
