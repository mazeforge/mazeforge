/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BoardSpecs, MazeGrid } from '../types';
import { buildBoardMesh, buildBallMesh } from '../exporter3MF';

interface ThreeViewerProps {
  grid: MazeGrid;
  specs: BoardSpecs;
  resetTrigger: number;
}

export default function ThreeViewer({
  grid,
  specs,
  resetTrigger,
}: ThreeViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  // References to Three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const boardGroupRef = useRef<THREE.Group | null>(null);
  const needsRenderRef = useRef<boolean>(true);
  const cameraInitializedRef = useRef<boolean>(false);

  // Dimension helpers
  const S = specs.size;
  const margin = 4.0;
  const ChW = specs.channelWidth;
  const WaW = specs.wallWidth;

  const getCellLeft = (c: number) => -S / 2 + margin + c * (ChW + WaW);
  const getCellCenterY = (r: number) => -S / 2 + margin + r * (ChW + WaW) + ChW / 2;
  const getCellCenterX = (c: number) => getCellLeft(c) + ChW / 2;

  // Helper to generate a text billboard sprite
  const makeTextSprite = (message: string, color: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 140;
    canvas.height = 45;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Background box
      ctx.fillStyle = 'rgba(24, 24, 27, 0.9)';
      ctx.roundRect ? ctx.roundRect(0, 0, 140, 45, 8) : ctx.rect(0, 0, 140, 45);
      ctx.fill();
      
      // Border outline
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      
      // Text
      ctx.font = 'bold 15px Arial, sans-serif';
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(message, 70, 22);
    }
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(material);
    // Scale matching the grid dimensions
    sprite.scale.set(16, 5.2, 1);
    return sprite;
  };


  // Refs for camera/light adjustments
  const mainLightRef = useRef<THREE.DirectionalLight | null>(null);
  const warmFillLightRef = useRef<THREE.DirectionalLight | null>(null);

  // 1. Mount Effect: Initialize WebGL renderer, scene, camera, controls, and lights ONLY ONCE
  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    // Create Renderer once
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // 1.5 is perfect balance of sharp display and smooth perf
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap; // Lighter shadow mapping
    renderer.shadowMap.autoUpdate = false; // MASSIVE SPEEDUP: shadows are static relative to world space and lights
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    mountRef.current.innerHTML = '';
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = null;
    sceneRef.current = scene;

    // Set initial Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 1000);
    camera.up.set(0, 0, 1);
    cameraRef.current = camera;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
    controlsRef.current = controls;

    controls.addEventListener('change', () => {
      needsRenderRef.current = true;
    });

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    renderer.domElement.addEventListener('contextmenu', handleContextMenu);

    // Ambient support
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambientLight);

    // Dynamic Main Light
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.85);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 512; // 512 is extremely light and delivers crisp shadows
    mainLight.shadow.mapSize.height = 512;
    mainLight.shadow.bias = -0.0003;
    scene.add(mainLight);
    mainLightRef.current = mainLight;

    // Secondary Warm Light
    const warmFillLight = new THREE.DirectionalLight(0xfff6e9, 0.35);
    scene.add(warmFillLight);
    warmFillLightRef.current = warmFillLight;

    // Shadow Floor
    const floorGeo = new THREE.PlaneGeometry(800, 800);
    const floorMat = new THREE.ShadowMaterial({ opacity: 0.1 });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.z = -5;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // Main Group Container
    const boardGroup = new THREE.Group();
    scene.add(boardGroup);
    boardGroupRef.current = boardGroup;

    // Multi-device resize adapter
    let resizeFrameId: number | null = null;
    const resizeObserver = new ResizeObserver(() => {
      if (resizeFrameId !== null) {
        cancelAnimationFrame(resizeFrameId);
      }
      resizeFrameId = requestAnimationFrame(() => {
        if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
        const w = mountRef.current.clientWidth;
        const h = mountRef.current.clientHeight;
        cameraRef.current.aspect = w / h;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(w, h);
        needsRenderRef.current = true;
      });
    });
    resizeObserver.observe(mountRef.current);

    // Unified render ticker
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      let changed = false;
      if (controlsRef.current) {
        changed = controlsRef.current.update();
      }
      if (needsRenderRef.current || changed) {
        needsRenderRef.current = false;
        if (rendererRef.current && sceneRef.current && cameraRef.current) {
          rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
      }
    };
    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (resizeFrameId !== null) {
        cancelAnimationFrame(resizeFrameId);
      }
      resizeObserver.disconnect();
      if (renderer.domElement) {
        renderer.domElement.removeEventListener('contextmenu', handleContextMenu);
      }
      if (mountRef.current && renderer.domElement) {
        if (mountRef.current.contains(renderer.domElement)) {
          mountRef.current.removeChild(renderer.domElement);
        }
      }
      scene.clear();
      renderer.dispose();
    };
  }, []);

  // 2. Mesh Update Effect: Clear and rebuild board parts inside the scene when dimensions/complexity changes
  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const boardGroup = boardGroupRef.current;
    const mainLight = mainLightRef.current;
    const warmFillLight = warmFillLightRef.current;

    if (!scene || !camera || !controls || !boardGroup || !mainLight || !warmFillLight) return;

    // Recursive disposal helper to avoid memory leaks with nested edge lines / indices
    const disposeObject = (obj: THREE.Object3D) => {
      // Create a shallow copy of children first as we will modify the array if we remove them
      const children = [...obj.children];
      children.forEach((child) => {
        obj.remove(child);
        disposeObject(child);
      });

      if ('geometry' in obj && (obj as any).geometry) {
        (obj as any).geometry.dispose();
      }
      if ('material' in obj && (obj as any).material) {
        const mat = (obj as any).material;
        if (Array.isArray(mat)) {
          mat.forEach((m) => {
            if (m && typeof m.dispose === 'function') m.dispose();
          });
        } else if (mat && typeof mat.dispose === 'function') {
          mat.dispose();
        }
      }
    };

    // Cleanup existing nested meshes and lines perfectly matching any dynamic adjustments
    while (boardGroup.children.length > 0) {
      const child = boardGroup.children[0];
      boardGroup.remove(child);
      disposeObject(child);
    }

    // Dynamic camera frustum positioning
    camera.far = S * 6;
    controls.minDistance = S * 0.4;
    controls.maxDistance = S * 3.5;

    // Adjust shadow mapping dimensions safely matched to board size
    mainLight.position.set(S * 1.5, -S * 1.2, S * 2.0);
    mainLight.shadow.camera.near = 10;
    mainLight.shadow.camera.far = S * 6;
    mainLight.shadow.camera.left = -S;
    mainLight.shadow.camera.right = S;
    mainLight.shadow.camera.top = S;
    mainLight.shadow.camera.bottom = -S;
    mainLight.shadow.camera.updateProjectionMatrix();

    warmFillLight.position.set(-S * 1.5, S, S / 2);

    // Initialize viewpoint positioning only on first model load
    if (!cameraInitializedRef.current) {
      camera.up.set(0, 0, 1);
      camera.position.set(S * 1.1, -S * 1.1, S * 1.1);
      camera.lookAt(0, 0, 0);
      controls.target.set(0, 0, 0);
      cameraInitializedRef.current = true;
    }
    controls.update();

    // Reconstruct Board Geometry using isPreview: true (skips hundreds of heavy cylinders, keeps frames high)
    const boardMeshRaw = buildBoardMesh(grid, specs, true);
    const boardGeometry = new THREE.BufferGeometry();
    const boardVArray = new Float32Array(boardMeshRaw.vertices.flat());
    const boardIArray = new Uint32Array(boardMeshRaw.triangles.flat());
    boardGeometry.setAttribute('position', new THREE.BufferAttribute(boardVArray, 3));
    boardGeometry.setIndex(new THREE.BufferAttribute(boardIArray, 1));
    boardGeometry.computeVertexNormals();

    const boardMaterial = new THREE.MeshStandardMaterial({
      color: 0xf4f4f5, // Premium organic PLA look
      roughness: 0.5,
      metalness: 0.03,
      side: THREE.DoubleSide,
    });

    const boardStaticMesh = new THREE.Mesh(boardGeometry, boardMaterial);
    boardStaticMesh.castShadow = true;
    boardStaticMesh.receiveShadow = true;
    boardGroup.add(boardStaticMesh);

    // Create Edges Geometry to render visible style lines only
    const boardEdgesGeometry = new THREE.EdgesGeometry(boardGeometry, 15);
    const boardEdgesLines = new THREE.LineSegments(
      boardEdgesGeometry,
      new THREE.LineBasicMaterial({ color: 0x18181b, linewidth: 1 })
    );
    boardGroup.add(boardEdgesLines);

    // Optimized Start indicator (low segment count: 12)
    const startDiscGeo = new THREE.CylinderGeometry(specs.channelWidth / 2 - 0.4, specs.channelWidth / 2 - 0.4, 0.5, 12);
    startDiscGeo.rotateX(Math.PI / 2);
    const startDiscMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      roughness: 0.4,
      emissive: 0x15803d,
      emissiveIntensity: 0.2,
      side: THREE.DoubleSide,
    });
    const startDisc = new THREE.Mesh(startDiscGeo, startDiscMat);
    startDisc.position.set(getCellCenterX(0), getCellCenterY(0), specs.baseThickness + 0.35);
    startDisc.receiveShadow = true;
    boardGroup.add(startDisc);

    // Edge lines for start indicator
    const startDiscEdges = new THREE.EdgesGeometry(startDiscGeo, 15);
    const startDiscLines = new THREE.LineSegments(
      startDiscEdges,
      new THREE.LineBasicMaterial({ color: 0x166534, linewidth: 1 })
    );
    startDisc.add(startDiscLines);

    // Optimized Finish indicator (low segment count: 12)
    const finishDiscGeo = new THREE.CylinderGeometry(specs.channelWidth / 2 - 0.4, specs.channelWidth / 2 - 0.4, 0.5, 12);
    finishDiscGeo.rotateX(Math.PI / 2);
    const finishDiscMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      roughness: 0.4,
      emissive: 0xb91c1c,
      emissiveIntensity: 0.2,
      side: THREE.DoubleSide,
    });
    const finishDisc = new THREE.Mesh(finishDiscGeo, finishDiscMat);
    finishDisc.position.set(getCellCenterX(specs.cellCount - 1), getCellCenterY(specs.cellCount - 1), specs.baseThickness + 0.35);
    finishDisc.receiveShadow = true;
    boardGroup.add(finishDisc);

    // Edge lines for finish indicator
    const finishDiscEdges = new THREE.EdgesGeometry(finishDiscGeo, 15);
    const finishDiscLines = new THREE.LineSegments(
      finishDiscEdges,
      new THREE.LineBasicMaterial({ color: 0x991b1b, linewidth: 1 })
    );
    finishDisc.add(finishDiscLines);

    // Double crisp floating billboard tags
    const startLabel = makeTextSprite('START', '#22c55e');
    startLabel.position.set(getCellCenterX(0), getCellCenterY(0), specs.thickness + 12);
    boardGroup.add(startLabel);

    const finishLabel = makeTextSprite('FINISH', '#ef4444');
    finishLabel.position.set(getCellCenterX(specs.cellCount - 1), getCellCenterY(specs.cellCount - 1), specs.thickness + 12);
    boardGroup.add(finishLabel);

    // Request a shadow refresh and frame redraw
    if (rendererRef.current) {
      rendererRef.current.shadowMap.needsUpdate = true;
    }
    needsRenderRef.current = true;
  }, [grid, specs, resetTrigger]);

  return (
    <div 
      className="flex-1 min-h-[460px] md:h-full w-full relative flex flex-col items-stretch overflow-hidden bg-zinc-50 border border-zinc-200"
      id="threejs-container"
    >
      {/* 3D Rendering Canvas Container */}
      <div 
        ref={mountRef} 
        className="flex-1 w-full h-full cursor-grab active:cursor-grabbing" 
      />

    </div>
  );
}
