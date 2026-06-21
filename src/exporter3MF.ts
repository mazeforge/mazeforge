import JSZip from 'jszip';
import { BoardSpecs, MazeGrid } from './types';

export interface RawMesh {
  vertices: [number, number, number][];
  triangles: [number, number, number][];
}

// Generate Cube / Box Mesh
export function generateBoxMesh(
  width: number,
  length: number,
  height: number,
  cx: number,
  cy: number,
  cz: number
): RawMesh {
  const dx = width / 2;
  const dy = length / 2;
  const dz = height / 2;

  const vertices: [number, number, number][] = [
    [cx - dx, cy - dy, cz - dz], // 0
    [cx + dx, cy - dy, cz - dz], // 1
    [cx + dx, cy + dy, cz - dz], // 2
    [cx - dx, cy + dy, cz - dz], // 3
    [cx - dx, cy - dy, cz + dz], // 4
    [cx + dx, cy - dy, cz + dz], // 5
    [cx + dx, cy + dy, cz + dz], // 6
    [cx - dx, cy + dy, cz + dz], // 7
  ];

  // Wound CCW looking from the outside of each face
  const triangles: [number, number, number][] = [
    // Bottom face (z-)
    [0, 2, 1], [0, 3, 2],
    // Top face (z+)
    [4, 5, 6], [4, 6, 7],
    // Front face (y-)
    [0, 1, 5], [0, 5, 4],
    // Back face (y+)
    [2, 3, 7], [2, 7, 6],
    // Left face (x-)
    [3, 0, 4], [3, 4, 7],
    // Right face (x+)
    [1, 2, 6], [1, 6, 5],
  ];

  return { vertices, triangles };
}

// Generate Cylinder along X-axis
export function generateCylinderMeshX(
  radius: number,
  length: number,
  cx: number,
  cy: number,
  cz: number,
  segments: number = 16
): RawMesh {
  const vertices: [number, number, number][] = [];
  const triangles: [number, number, number][] = [];

  const hLen = length / 2;

  // Add cylindrical side vertices
  for (let s = 0; s < 2; s++) {
    const x = cx + (s === 0 ? -hLen : hLen);
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const y = cy + radius * Math.cos(angle);
      const z = cz + radius * Math.sin(angle);
      vertices.push([x, y, z]);
    }
  }

  // Indices:
  // Cap 1 (smaller X): 0 .. segments-1
  // Cap 2 (larger X): segments .. 2*segments-1
  // Cap 1 center: 2*segments
  // Cap 2 center: 2*segments + 1

  const cap1CenterIdx = 2 * segments;
  const cap2CenterIdx = 2 * segments + 1;

  vertices.push([cx - hLen, cy, cz]);
  vertices.push([cx + hLen, cy, cz]);

  // Cylinder walls
  for (let i = 0; i < segments; i++) {
    const nextI = (i + 1) % segments;
    const a = i;
    const b = nextI;
    const c = nextI + segments;
    const d = i + segments;

    // Outward facing triangles
    triangles.push([a, c, b]);
    triangles.push([a, d, c]);
  }

  // Cap 1 (facing negative X, looking outward means CW winding in 2D angle)
  for (let i = 0; i < segments; i++) {
    const nextI = (i + 1) % segments;
    triangles.push([cap1CenterIdx, nextI, i]);
  }

  // Cap 2 (facing positive X, CCW winding)
  for (let i = 0; i < segments; i++) {
    const nextI = (i + 1) % segments;
    triangles.push([cap2CenterIdx, i + segments, nextI + segments]);
  }

  return { vertices, triangles };
}

// Generate Sphere
export function generateSphereMesh(
  radius: number,
  cx: number,
  cy: number,
  cz: number,
  latBands: number = 16,
  lonBands: number = 16
): RawMesh {
  const vertices: [number, number, number][] = [];
  const triangles: [number, number, number][] = [];

  for (let lat = 0; lat <= latBands; lat++) {
    const theta = (lat * Math.PI) / latBands;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let lon = 0; lon <= lonBands; lon++) {
      const phi = (lon * 2 * Math.PI) / lonBands;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      const x = cx + radius * cosPhi * sinTheta;
      const y = cy + radius * cosTheta;
      const z = cz + radius * sinPhi * sinTheta;
      vertices.push([x, y, z]);
    }
  }

  for (let lat = 0; lat < latBands; lat++) {
    for (let lon = 0; lon < lonBands; lon++) {
      const first = lat * (lonBands + 1) + lon;
      const second = first + lonBands + 1;

      triangles.push([first, second, first + 1]);
      triangles.push([second, second + 1, first + 1]);
    }
  }

  return { vertices, triangles };
}

// Generate Cylinder along Z-axis
export function generateCylinderMeshZ(
  radius: number,
  height: number,
  cx: number,
  cy: number,
  cz: number,
  segments: number = 16
): RawMesh {
  const vertices: [number, number, number][] = [];
  const triangles: [number, number, number][] = [];

  const hLen = height / 2;

  // Add cylindrical side vertices
  for (let s = 0; s < 2; s++) {
    const z = cz + (s === 0 ? -hLen : hLen);
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      vertices.push([x, y, z]);
    }
  }

  const cap1CenterIdx = 2 * segments;
  const cap2CenterIdx = 2 * segments + 1;

  vertices.push([cx, cy, cz - hLen]);
  vertices.push([cx, cy, cz + hLen]);

  // Cylinder walls
  for (let i = 0; i < segments; i++) {
    const nextI = (i + 1) % segments;
    const a = i;
    const b = nextI;
    const c = nextI + segments;
    const d = i + segments;

    triangles.push([a, c, b]);
    triangles.push([a, d, c]);
  }

  // Cap 1 (facing negative Z, CW winding)
  for (let i = 0; i < segments; i++) {
    const nextI = (i + 1) % segments;
    triangles.push([cap1CenterIdx, nextI, i]);
  }

  // Cap 2 (facing positive Z, CCW winding)
  for (let i = 0; i < segments; i++) {
    const nextI = (i + 1) % segments;
    triangles.push([cap2CenterIdx, i + segments, nextI + segments]);
  }

  return { vertices, triangles };
}

// Generate Rounded Square / Box along X-axis for handle knobs
export function generateRoundedSquareKnobMeshX(
  width: number,
  height: number,
  thickness: number,
  radius: number,
  cx: number,
  cy: number,
  cz: number,
  steps: number = 4
): RawMesh {
  const vertices: [number, number, number][] = [];
  const triangles: [number, number, number][] = [];

  const hThick = thickness / 2;

  // Sample perimeter in YZ plane
  const pts2D: [number, number][] = [];
  const wh = width / 2;
  const hh = height / 2;

  const corners = [
    { cx: wh - radius, cy: hh - radius, aMin: 0, aMax: Math.PI / 2 },
    { cx: -wh + radius, cy: hh - radius, aMin: Math.PI / 2, aMax: Math.PI },
    { cx: -wh + radius, cy: -hh + radius, aMin: Math.PI, aMax: 1.5 * Math.PI },
    { cx: wh - radius, cy: -hh + radius, aMin: 1.5 * Math.PI, aMax: 2 * Math.PI },
  ];

  for (const corner of corners) {
    for (let i = 0; i <= steps; i++) {
      const a = corner.aMin + (i / steps) * (corner.aMax - corner.aMin);
      const y = cy + corner.cx + radius * Math.cos(a);
      const z = cz + corner.cy + radius * Math.sin(a);
      pts2D.push([y, z]);
    }
  }

  const m = pts2D.length; // 4 * 4 = 16

  // Side 1 (smaller X)
  for (const pt of pts2D) {
    vertices.push([cx - hThick, pt[0], pt[1]]);
  }
  // Side 2 (larger X)
  for (const pt of pts2D) {
    vertices.push([cx + hThick, pt[0], pt[1]]);
  }

  const cap1CenterIdx = 2 * m;
  const cap2CenterIdx = 2 * m + 1;
  vertices.push([cx - hThick, cy, cz]);
  vertices.push([cx + hThick, cy, cz]);

  // Cylinder walls
  for (let i = 0; i < m; i++) {
    const nextI = (i + 1) % m;
    const a = i;
    const b = nextI;
    const c = nextI + m;
    const d = i + m;

    triangles.push([a, c, b]);
    triangles.push([a, d, c]);
  }

  // Cap 1 (CW winding)
  for (let i = 0; i < m; i++) {
    const nextI = (i + 1) % m;
    triangles.push([cap1CenterIdx, nextI, i]);
  }

  // Cap 2 (CCW winding)
  for (let i = 0; i < m; i++) {
    const nextI = (i + 1) % m;
    triangles.push([cap2CenterIdx, i + m, nextI + m]);
  }

  return { vertices, triangles };
}

// Merge multiple RawMeshes
export function mergeMeshes(meshes: RawMesh[]): RawMesh {
  const mergedVertices: [number, number, number][] = [];
  const mergedTriangles: [number, number, number][] = [];
  let vertexOffset = 0;

  for (const mesh of meshes) {
    for (const v of mesh.vertices) {
      mergedVertices.push([v[0], v[1], v[2]]);
    }
    for (const t of mesh.triangles) {
      mergedTriangles.push([
        t[0] + vertexOffset,
        t[1] + vertexOffset,
        t[2] + vertexOffset,
      ]);
    }
    vertexOffset += mesh.vertices.length;
  }

  return {
    vertices: mergedVertices,
    triangles: mergedTriangles,
  };
}

// Build the composite Board geometry as a single solid RawMesh
export function buildBoardMesh(grid: MazeGrid, specs: BoardSpecs, isPreview: boolean = false): RawMesh {
  const meshes: RawMesh[] = [];

  const S = specs.size;
  const margin = 4.0; // outer wall thickness
  const ChW = specs.channelWidth;
  const WaW = specs.wallWidth;
  const N = specs.cellCount;
  const baseT = specs.baseThickness; // 7mm
  const totalT = specs.thickness;     // 15mm
  const wallH = specs.channelDepth;   // 8mm

  // 1. Solid Base Plate box (from z = 0 to z = 7)
  // Center of the board in Z should be baseT/2
  meshes.push(generateBoxMesh(S, S, baseT, 0, 0, baseT / 2));

  // 2. Outer rim walls (from z = 7 to z = 15)
  const outerWallCenterZ = baseT + wallH / 2; // Z offset: 7 + 4 = 11

  // Top rim
  meshes.push(generateBoxMesh(S, margin, wallH, 0, -S / 2 + margin / 2, outerWallCenterZ));
  // Bottom rim
  meshes.push(generateBoxMesh(S, margin, wallH, 0, S / 2 - margin / 2, outerWallCenterZ));
  // Left rim with entrance hole at Row 0 (start cell)
  const leftRimLen = S - 2 * margin - ChW;
  const leftRimCenterY = ChW / 2;
  meshes.push(generateBoxMesh(margin, leftRimLen, wallH, -S / 2 + margin / 2, leftRimCenterY, outerWallCenterZ));

  // Right rim with exit hole at Row N-1 (finish cell)
  const rightRimLen = S - 2 * margin - ChW;
  const rightRimCenterY = -ChW / 2;
  meshes.push(generateBoxMesh(margin, rightRimLen, wallH, S / 2 - margin / 2, rightRimCenterY, outerWallCenterZ));

  // Helper coordinate getters:
  const getCellLeft = (c: number) => -S / 2 + margin + c * (ChW + WaW);
  const getCellCenterY = (r: number) => -S / 2 + margin + r * (ChW + WaW) + ChW / 2;
  const getCellCenterX = (c: number) => getCellLeft(c) + ChW / 2;

  // 3. Inner maze walls (from z = 7 to z = 15, centered at outerWallCenterZ)
  // Vertical maze walls - length is exactly ChW (the cell's size), no messy overlapping extension
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N - 1; c++) {
      if (grid.verticalWalls[r][c]) {
        const xCenter = getCellLeft(c) + ChW + WaW / 2;
        const yCenter = getCellCenterY(r);
        meshes.push(generateBoxMesh(WaW, ChW, wallH, xCenter, yCenter, outerWallCenterZ));
      }
    }
  }

  // Horizontal maze walls - length is exactly ChW (the cell's size), no messy overlapping extension
  for (let r = 0; r < N - 1; r++) {
    for (let c = 0; c < N; c++) {
      if (grid.horizontalWalls[r][c]) {
        const xCenter = getCellCenterX(c);
        const yCenter = -S / 2 + margin + r * (ChW + WaW) + ChW + WaW / 2;
        meshes.push(generateBoxMesh(ChW, WaW, wallH, xCenter, yCenter, outerWallCenterZ));
      }
    }
  }

  // Junction Pillars - placed perfectly at corners where at least one wall segment meets.
  // This achieves perfect 90-degree flush corners without any jagged offsets or overlapping lines.
  for (let r = 0; r < N - 1; r++) {
    for (let c = 0; c < N - 1; c++) {
      const wUT = grid.verticalWalls[r][c];       // Upper transition
      const wLT = grid.verticalWalls[r + 1][c];   // Lower transition
      const wLH = grid.horizontalWalls[r][c];     // Left transition
      const wRH = grid.horizontalWalls[r][c + 1]; // Right transition

      if (wUT || wLT || wLH || wRH) {
        const xCorner = getCellLeft(c) + ChW + WaW / 2;
        const yCorner = -S / 2 + margin + r * (ChW + WaW) + ChW + WaW / 2;
        meshes.push(generateBoxMesh(WaW, WaW, wallH, xCorner, yCorner, outerWallCenterZ));
      }
    }
  }

  // 3b. Junction filleted cylinders (tiang-tiang) removed to ensure exported model matches the preview exactly.

  // 4. Handles on Left and Right (integrated cylinder + Rounded Square knob)
  const handleZ = totalT / 2;
  const rodR = specs.rodDiameter / 2;
  const rodL = specs.rodLength;
  
  // Knob dimensions: 15 mm wide, matches board thickness in height (totalT)
  const knobWidth = 15.0; // width in Y
  const knobHeight = totalT; // height in Z (matches board thickness)
  const knobThickness = 15.0; // thickness along X-axis
  const knobFillet = Math.min(3.0, knobHeight / 2 - 0.5);

  const rodSegments = isPreview ? 8 : 16;
  const knobSteps = isPreview ? 2 : 4;

  // Left handle (attached at Left -S/2, extending along -X)
  // Cylinder rod
  meshes.push(generateCylinderMeshX(rodR, rodL, -S / 2 - rodL / 2, 0, handleZ, rodSegments));
  // Rounded Square Knob
  meshes.push(generateRoundedSquareKnobMeshX(knobWidth, knobHeight, knobThickness, knobFillet, -S / 2 - rodL - knobThickness / 2, 0, handleZ, knobSteps));

  // Right handle (attached at Right +S/2, extending along +X)
  // Cylinder rod
  meshes.push(generateCylinderMeshX(rodR, rodL, S / 2 + rodL / 2, 0, handleZ, rodSegments));
  // Rounded Square Knob
  meshes.push(generateRoundedSquareKnobMeshX(knobWidth, knobHeight, knobThickness, knobFillet, S / 2 + rodL + knobThickness / 2, 0, handleZ, knobSteps));

  return mergeMeshes(meshes);
}

// Generate the ball mesh centered at its correct physical coordinates
export function buildBallMesh(grid: MazeGrid, specs: BoardSpecs): RawMesh {
  const margin = 4.0;
  const ChW = specs.channelWidth;
  const WaW = specs.wallWidth;
  const baseT = specs.baseThickness; // 7mm
  const ballR = specs.ballDiameter / 2; // 5mm
  const S = specs.size;

  // Let's place the ball initially in the center of the Start cell: (0, 0)
  const getCellLeft = (c: number) => -S / 2 + margin + c * (ChW + WaW);
  const getCellCenterY = (r: number) => -S / 2 + margin + r * (ChW + WaW) + ChW / 2;
  const getCellCenterX = (c: number) => getCellLeft(c) + ChW / 2;

  const startCX = getCellCenterX(0);
  const startCY = getCellCenterY(0);
  const ballCZ = baseT + ballR; // 7 + 5 = 12

  return generateSphereMesh(ballR, startCX, startCY, ballCZ, 16, 16);
}

// Export to ASCII or Binary STL
export function exportToBinarySTL(mesh: RawMesh): Blob {
  const numTriangles = mesh.triangles.length;
  const bufferSize = 80 + 4 + numTriangles * 50;
  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);

  // 80-byte empty header
  for (let i = 0; i < 80; i++) {
    view.setUint8(i, 32); 
  }

  // 4-byte triangle count
  view.setUint32(80, numTriangles, true); // Little endian

  let offset = 84;
  for (const tri of mesh.triangles) {
    const v0 = mesh.vertices[tri[0]];
    const v1 = mesh.vertices[tri[1]];
    const v2 = mesh.vertices[tri[2]];

    // Calc normal (v1 - v0) cross (v2 - v0)
    const ux = v1[0] - v0[0];
    const uy = v1[1] - v0[1];
    const uz = v1[2] - v0[2];
    const vx = v2[0] - v0[0];
    const vy = v2[1] - v0[1];
    const vz = v2[2] - v0[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;

    // Normalize
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len > 0) {
      nx /= len;
      ny /= len;
      nz /= len;
    }

    // Normal vector components
    view.setFloat32(offset, nx, true);
    view.setFloat32(offset + 4, ny, true);
    view.setFloat32(offset + 8, nz, true);
    offset += 12;

    // Vertex 0
    view.setFloat32(offset, v0[0], true);
    view.setFloat32(offset + 4, v0[1], true);
    view.setFloat32(offset + 8, v0[2], true);
    offset += 12;

    // Vertex 1
    view.setFloat32(offset, v1[0], true);
    view.setFloat32(offset + 4, v1[1], true);
    view.setFloat32(offset + 8, v1[2], true);
    offset += 12;

    // Vertex 2
    view.setFloat32(offset, v2[0], true);
    view.setFloat32(offset + 4, v2[1], true);
    view.setFloat32(offset + 8, v2[2], true);
    offset += 12;

    // Attribute byte count (2 bytes)
    view.setUint16(offset, 0, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'application/octet-stream' });
}

// Export to Wavefront OBJ format
export function exportToOBJ(mesh: RawMesh, name: string = 'Maze3D'): string {
  let obj = `# ${name} Export\n`;
  obj += `# Generated by Maze3D\n`;
  obj += `o ${name}\n`;

  for (const v of mesh.vertices) {
    obj += `v ${v[0].toFixed(4)} ${v[1].toFixed(4)} ${v[2].toFixed(4)}\n`;
  }

  // Face indices in Wavefront OBJ are 1-based (not 0-based)
  for (const t of mesh.triangles) {
    obj += `f ${t[0] + 1} ${t[1] + 1} ${t[2] + 1}\n`;
  }

  return obj;
}

// Helper to write XML text formatted 3D models for 3MF Packages
function generate3MFModelXML(boardMesh: RawMesh, ballMesh: RawMesh): string {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <metadata name="Application">Maze 3D</metadata>
  <metadata name="Title">3D Ball Maze Puzzle</metadata>
  <resources>
    <!-- Object 1: Maze Board -->
    <object id="1" type="model">
      <mesh>
        <vertices>
`;

  // Write Board Vertices
  for (const v of boardMesh.vertices) {
    xml += `          <vertex x="${v[0].toFixed(4)}" y="${v[1].toFixed(4)}" z="${v[2].toFixed(4)}" />\n`;
  }

  xml += `        </vertices>
        <triangles>
`;

  // Write Board Triangles
  for (const t of boardMesh.triangles) {
    xml += `          <triangle v1="${t[0]}" v2="${t[1]}" v3="${t[2]}" />\n`;
  }

  xml += `        </triangles>
      </mesh>
    </object>

    <!-- Object 2: Steel Ball -->
    <object id="2" type="model">
      <mesh>
        <vertices>
`;

  // Write Ball Vertices
  for (const v of ballMesh.vertices) {
    xml += `          <vertex x="${v[0].toFixed(4)}" y="${v[1].toFixed(4)}" z="${v[2].toFixed(4)}" />\n`;
  }

  xml += `        </vertices>
        <triangles>
`;

  // Write Ball Triangles
  for (const t of ballMesh.triangles) {
    xml += `          <triangle v1="${t[0]}" v2="${t[1]}" v3="${t[2]}" />\n`;
  }

  xml += `        </triangles>
      </mesh>
    </object>
  </resources>
  <build>
    <item objectid="1" />
    <item objectid="2" />
  </build>
</model>`;

  return xml;
}

// Complete 3MF Package Exporter
// Relies on jszip to packet relationships and content types perfectly!
export async function exportTo3MF(boardMesh: RawMesh, ballMesh: RawMesh): Promise<Blob> {
  const zip = new JSZip();

  // 1. _rels/.rels relationships file
  const relsContent = `<?xml version="1.0" encoding="utf-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" />
</Relationships>`;
  zip.file('_rels/.rels', relsContent);

  // 2. [Content_Types].xml MIME type definition
  const contentTypesContent = `<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" />
</Types>`;
  zip.file('[Content_Types].xml', contentTypesContent);

  // 3. 3D/3dmodel.model structural XML
  const modelXML = generate3MFModelXML(boardMesh, ballMesh);
  zip.file('3D/3dmodel.model', modelXML);

  // Generate ZIP compression
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  return zipBlob;
}
