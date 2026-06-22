// Performance optimization system
// Implements object pooling, LOD, throttled updates, and efficient rendering

import * as THREE from 'three';
import { state } from '../state.js';

// Object pool for particles and temporary objects
class ObjectPool {
  constructor(createFn, resetFn, initialSize = 50) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.pool = [];
    this.active = [];

    // Pre-populate pool
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(createFn());
    }
  }

  get() {
    let obj = this.pool.pop();
    if (!obj) {
      obj = this.createFn();
    }
    this.active.push(obj);
    return obj;
  }

  release(obj) {
    const idx = this.active.indexOf(obj);
    if (idx !== -1) {
      this.active.splice(idx, 1);
      this.resetFn(obj);
      this.pool.push(obj);
    }
  }

  releaseAll() {
    while (this.active.length > 0) {
      const obj = this.active.pop();
      this.resetFn(obj);
      this.pool.push(obj);
    }
  }
}

// LOD (Level of Detail) system
const LOD_LEVELS = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2
};

const LOD_DISTANCES = {
  [LOD_LEVELS.HIGH]: 100,
  [LOD_LEVELS.MEDIUM]: 300,
  [LOD_LEVELS.LOW]: 600
};

export function getLODLevel(position, cameraPosition) {
  const dist = position.distanceTo(cameraPosition);
  if (dist < LOD_DISTANCES[LOD_LEVELS.HIGH]) return LOD_LEVELS.HIGH;
  if (dist < LOD_DISTANCES[LOD_LEVELS.MEDIUM]) return LOD_LEVELS.MEDIUM;
  return LOD_LEVELS.LOW;
}

// Throttled update system
class ThrottledUpdater {
  constructor() {
    this.updates = new Map();
  }

  register(key, updateFn, interval) {
    this.updates.set(key, { fn: updateFn, interval, lastUpdate: 0 });
  }

  update(delta) {
    const now = performance.now();
    this.updates.forEach((entry, key) => {
      if (now - entry.lastUpdate >= entry.interval) {
        entry.fn(delta);
        entry.lastUpdate = now;
      }
    });
  }
}

// Frustum culling helper
const _cachedFrustum = new THREE.Frustum();
const _cachedMatrix = new THREE.Matrix4();
const _cachedSphere = new THREE.Sphere();

export function isInView(object, camera, margin = 50) {
  if (!object.position) return true;
  _cachedMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  _cachedFrustum.setFromProjectionMatrix(_cachedMatrix);
  _cachedSphere.set(object.position, margin);
  return _cachedFrustum.intersectsSphere(_cachedSphere);
}

// Efficient distance check using squared distance
export function isWithinDistance(pos1, pos2, distance) {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  const dz = pos1.z - pos2.z;
  return (dx * dx + dy * dy + dz * dz) < (distance * distance);
}

// Batch update for similar objects
export function batchUpdate(objects, updateFn, batchSize = 10) {
  let processed = 0;
  for (let i = 0; i < objects.length && processed < batchSize; i++) {
    if (objects[i].alive) {
      updateFn(objects[i]);
      processed++;
    }
  }
}

// Memory management
export function cleanupRemovedObjects(array, scene) {
  for (let i = array.length - 1; i >= 0; i--) {
    if (!array[i].alive && array[i].mesh) {
      scene.remove(array[i].mesh);
      array.splice(i, 1);
    }
  }
}

// Renderer optimization settings
export function optimizeRenderer(renderer) {
  // Enable frustum culling
  renderer.info.render.frame++;

  // Keep the renderer from undoing scene-level pixel ratio caps on high-DPI screens.
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const currentRatio = renderer.getPixelRatio ? renderer.getPixelRatio() : 1;
  const targetRatio = isMobile ? 1 : Math.min(currentRatio || 1, window.devicePixelRatio, 1.5);
  renderer.setPixelRatio(targetRatio);

  return renderer;
}

// Scene optimization
export function optimizeScene(scene) {
  // Enable frustum culling for all meshes
  scene.traverse((object) => {
    if (object.isMesh) {
      object.frustumCulled = true;
    }
  });

  return scene;
}

// Geometry optimization - merge static geometries
export function mergeStaticGeometries(meshes) {
  // Simplified version - just return first mesh
  // In production, you'd use BufferGeometryUtils from three/examples/jsm/utils
  if (meshes.length === 0) return null;
  return meshes[0];
}

// Texture atlas helper
export function createTextureAtlas(textures, size = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const cols = Math.ceil(Math.sqrt(textures.length));
  const cellSize = size / cols;

  textures.forEach((tex, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    ctx.drawImage(tex.image, col * cellSize, row * cellSize, cellSize, cellSize);
  });

  const atlas = new THREE.CanvasTexture(canvas);
  atlas.needsUpdate = true;
  return atlas;
}

// FPS counter
let fpsFrames = 0;
let fpsTime = 0;
let fpsCurrent = 60;
let fpsTotalFrames = 0;
let fpsTotalTime = 0;
let fpsAverage = 0;
const recentFpsSamples = [];
const profileStats = new Map();
let profileLastLog = 0;
let profileEnabled = false;

export function profileStep(label, fn) {
  if (!profileEnabled) return fn();

  const start = performance.now();
  try {
    return fn();
  } finally {
    const elapsed = performance.now() - start;
    const stat = profileStats.get(label) || { total: 0, max: 0, count: 0 };
    stat.total += elapsed;
    stat.max = Math.max(stat.max, elapsed);
    stat.count++;
    profileStats.set(label, stat);
  }
}

export function logPerformanceProfile(now = performance.now()) {
  if (!profileEnabled || now - profileLastLog < 2000 || profileStats.size === 0) return;

  const rows = [...profileStats.entries()]
    .map(([label, stat]) => ({
      label,
      avg: stat.total / stat.count,
      max: stat.max
    }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 6);

  const renderInfo = state.renderer ? state.renderer.info.render : null;
  const memoryInfo = state.renderer ? state.renderer.info.memory : null;
  const renderFrames = renderInfo ? Math.max(1, renderInfo.frame) : 1;
  const diagnostics = state.renderer ? {
    step: 'renderer',
    avgMs: '-',
    maxMs: '-',
    calls: Math.round(renderInfo.calls / renderFrames),
    triangles: Math.round(renderInfo.triangles / renderFrames),
    geometries: memoryInfo.geometries,
    textures: memoryInfo.textures,
    sceneChildren: state.scene ? state.scene.children.length : 0,
    pixelRatio: state.renderer.getPixelRatio().toFixed(2),
    fps10s: getRecentAverageFPS()
  } : null;

  const tableRows = rows.map(row => ({
    step: row.label,
    avgMs: row.avg.toFixed(2),
    maxMs: row.max.toFixed(2),
    calls: '',
    triangles: '',
    geometries: '',
    textures: '',
    sceneChildren: '',
    pixelRatio: '',
    fps10s: ''
  }));
  if (diagnostics) tableRows.push(diagnostics);

  console.table(tableRows);

  profileStats.clear();
  profileLastLog = now;
  if (state.renderer) state.renderer.info.reset();
}

export function setPerformanceProfiling(enabled) {
  profileEnabled = enabled;
  profileStats.clear();
  profileLastLog = performance.now();
}

export function updateFPS(delta) {
  fpsFrames++;
  fpsTime += delta;
  // Average FPS only receives deltas from active gameplay callers.
  fpsTotalFrames++;
  fpsTotalTime += delta;

  if (fpsTime >= 1.0) {
    fpsCurrent = Math.round(fpsFrames / fpsTime);
    fpsFrames = 0;
    fpsTime = 0;
  }

  if (fpsTotalTime > 0) {
    fpsAverage = Math.round(fpsTotalFrames / fpsTotalTime);
  }

  // A short moving average makes perf regressions visible without waiting for the lifetime avg to recover.
  recentFpsSamples.push({ time: performance.now(), delta });
  const cutoff = performance.now() - 10000;
  while (recentFpsSamples.length && recentFpsSamples[0].time < cutoff) recentFpsSamples.shift();

  return fpsCurrent;
}

export function getFPS() {
  return fpsCurrent;
}

export function getAverageFPS() {
  return fpsAverage;
}

export function getRecentAverageFPS() {
  let total = 0;
  for (let i = 0; i < recentFpsSamples.length; i++) total += recentFpsSamples[i].delta;
  return total > 0 ? Math.round(recentFpsSamples.length / total) : fpsCurrent;
}

export function resetFPS() {
  fpsFrames = 0;
  fpsTime = 0;
  fpsCurrent = 60;
  fpsTotalFrames = 0;
  fpsTotalTime = 0;
  fpsAverage = 0;
  recentFpsSamples.length = 0;
}

// Adaptive quality based on FPS (FogExp2 uses density, not near/far)
export function adaptQuality(fps) {
  if (fps < 30) {
    // Reduce quality — increase fog density to hide distant objects
    if (state.scene.fog && state.scene.fog.density !== undefined) {
      state.scene.fog.density = 0.001;
    }
    return 'low';
  } else if (fps < 45) {
    // Medium quality
    if (state.scene.fog && state.scene.fog.density !== undefined) {
      state.scene.fog.density = 0.0006;
    }
    return 'medium';
  } else {
    // High quality — maximum visibility
    if (state.scene.fog && state.scene.fog.density !== undefined) {
      state.scene.fog.density = 0.0004;
    }
    return 'high';
  }
}

// Create optimized shared materials
const sharedMaterials = {};

export function getSharedMaterial(color, emissive = false) {
  const key = `${color}_${emissive}`;
  if (!sharedMaterials[key]) {
    if (emissive) {
      sharedMaterials[key] = new THREE.MeshLambertMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.3
      });
    } else {
      sharedMaterials[key] = new THREE.MeshLambertMaterial({ color });
    }
  }
  return sharedMaterials[key];
}

// Create optimized shared geometries
const sharedGeometries = {};

export function getSharedGeometry(type, size = 1) {
  const key = `${type}_${size}`;
  if (!sharedGeometries[key]) {
    switch (type) {
      case 'box':
        sharedGeometries[key] = new THREE.BoxGeometry(size, size, size);
        break;
      case 'sphere':
        sharedGeometries[key] = new THREE.SphereGeometry(size, 8, 8);
        break;
      case 'cylinder':
        sharedGeometries[key] = new THREE.CylinderGeometry(size, size, size, 8);
        break;
      case 'cone':
        sharedGeometries[key] = new THREE.ConeGeometry(size, size * 2, 8);
        break;
      default:
        sharedGeometries[key] = new THREE.BoxGeometry(size, size, size);
    }
  }
  return sharedGeometries[key];
}
