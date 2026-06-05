// Distance-based visibility for static render-only world details.

import { state } from '../state.js';

const CELL_SIZE = 500;
const DEFAULT_VISIBLE_RADIUS = 1000;
const entries = [];
const grid = new Map();
let lastUpdate = 0;

function cellCoord(value) {
  return Math.floor(value / CELL_SIZE);
}

function keyFor(x, z) {
  return `${cellCoord(x)},${cellCoord(z)}`;
}

export function registerStaticObject(object, x, z, visibleRadius = DEFAULT_VISIBLE_RADIUS) {
  object.visible = false;
  const entry = { object, x, z, visibleRadius, visibleRadiusSq: visibleRadius * visibleRadius };
  entries.push(entry);

  const key = keyFor(x, z);
  let bucket = grid.get(key);
  if (!bucket) {
    bucket = [];
    grid.set(key, bucket);
  }
  bucket.push(entry);

  return object;
}

function nearbyEntries(x, z, radius) {
  const range = Math.ceil(radius / CELL_SIZE);
  const cx = cellCoord(x);
  const cz = cellCoord(z);
  const result = [];

  for (let dx = -range; dx <= range; dx++) {
    for (let dz = -range; dz <= range; dz++) {
      const bucket = grid.get(`${cx + dx},${cz + dz}`);
      if (bucket) result.push(...bucket);
    }
  }

  return result;
}

export function updateStaticVisibility(now = performance.now()) {
  if (!state.controls || now - lastUpdate < 250 || entries.length === 0) return;
  lastUpdate = now;

  const p = state.controls.getObject().position;
  const active = new Set(nearbyEntries(p.x, p.z, 1600));

  // Static props do not affect collision here, so hidden distant meshes can skip render work entirely.
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const object = entry.object;
    if (!object) continue;

    let visible = false;
    if (active.has(entry)) {
      const dx = entry.x - p.x;
      const dz = entry.z - p.z;
      visible = dx * dx + dz * dz <= entry.visibleRadiusSq;
    }

    if (object.visible !== visible) object.visible = visible;
  }
}

export function getStaticVisibilityStats() {
  let visible = 0;
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].object && entries[i].object.visible) visible++;
  }
  return { total: entries.length, visible };
}
