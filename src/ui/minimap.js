// Minimap system - biome-colored background, building icons, airdrop markers, entity dots

import * as THREE from 'three';
import { state } from '../state.js';
import { MAP_SIZE, BIOME_BY_ID } from '../config.js';
import { getBiomeAt, BIOME } from '../world/biomes.js';
import { getAllAnimals } from '../entities/animals.js';
import { getAllAliens } from '../entities/aliens.js';

let minimapCanvas = null;
let minimapCtx = null;
const MINIMAP_SIZE = 300;
const MINIMAP_RANGE = 1000;
const MINIMAP_RANGE_SQ = MINIMAP_RANGE * MINIMAP_RANGE;

// Biome background is drawn as a coarse grid of colored squares.
// BIOME_BG_SAMPLES is the number of samples per axis (so BIOME_BG_SAMPLES^2 cells total).
const BIOME_BG_SAMPLES = 24;
const BIOME_CELL_PX = MINIMAP_SIZE / BIOME_BG_SAMPLES;

// Biome colors (rgba strings for canvas 2d). Kept separate from the Three.js hex codes.
const BIOME_COLORS_CSS = {
  [BIOME.DESERT]: 'rgba(194, 178, 128, 0.55)', // sandy
  [BIOME.SNOW]:   'rgba(224, 232, 240, 0.55)', // pale white-blue
  [BIOME.JUNGLE]: 'rgba(27, 94, 32, 0.55)',    // deep green
  [BIOME.SWAMP]:  'rgba(74, 93, 35, 0.55)',    // murky olive
  [BIOME.LAVA]:   'rgba(60, 20, 10, 0.55)',    // obsidian red
};
const BIOME_FALLBACK_CSS = 'rgba(60, 60, 60, 0.55)';

// Building icon specs: { color, shape } — shape ∈ 'square' | 'triangle' | 'diamond' | 'circle'
const BUILDING_ICONS = {
  military:    { color: '#3a5a2a', shape: 'triangle' },
  ruin:        { color: '#888888', shape: 'square' },
  lighthouse:  { color: '#ffffff', shape: 'circle', accent: '#cc3333' },
  bridge:      { color: '#8b5a2b', shape: 'square' },
  mine:        { color: '#333333', shape: 'diamond' },
  farm:        { color: '#8b0000', shape: 'square' },
  house:       { color: '#aaaaaa', shape: 'square' },
};

// Reusable objects
const _tempPos = { x: 0, y: 0 };

export function initMinimap() {
  const container = document.createElement('div');
  container.id = 'minimap-container';
  container.style.cssText = `
    position: absolute;
    bottom: 20px;
    right: 20px;
    width: ${MINIMAP_SIZE}px;
    height: ${MINIMAP_SIZE}px;
    border: 2px solid rgba(255, 255, 255, 0.5);
    border-radius: 50%;
    overflow: hidden;
    pointer-events: none;
    z-index: 5;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
  `;

  minimapCanvas = document.createElement('canvas');
  minimapCanvas.width = MINIMAP_SIZE;
  minimapCanvas.height = MINIMAP_SIZE;
  minimapCanvas.style.cssText = `width: 100%; height: 100%; border-radius: 50%;`;

  container.appendChild(minimapCanvas);
  document.body.appendChild(container);

  minimapCtx = minimapCanvas.getContext('2d');
}

function worldToMinimap(worldX, worldZ, playerX, playerZ) {
  const dx = worldX - playerX;
  const dz = worldZ - playerZ;

  // Quick range check
  if (dx * dx + dz * dz > MINIMAP_RANGE_SQ * 1.5) return null;

  const scale = MINIMAP_SIZE / (MINIMAP_RANGE * 2);
  const mx = MINIMAP_SIZE / 2 + dx * scale;
  const my = MINIMAP_SIZE / 2 + dz * scale;

  // Clamp to circle
  const cx = mx - MINIMAP_SIZE / 2;
  const cy = my - MINIMAP_SIZE / 2;
  const distSq = cx * cx + cy * cy;
  const maxR = MINIMAP_SIZE / 2 - 5;
  if (distSq > maxR * maxR) {
    const dist = Math.sqrt(distSq);
    const scale2 = maxR / dist;
    _tempPos.x = MINIMAP_SIZE / 2 + cx * scale2;
    _tempPos.y = MINIMAP_SIZE / 2 + cy * scale2;
    return _tempPos;
  }

  _tempPos.x = mx;
  _tempPos.y = my;
  return _tempPos;
}

// Convert canvas 2d x/y to world offset from player given the minimap range.
function canvasToWorld(dx, dz) {
  const scale = (MINIMAP_RANGE * 2) / MINIMAP_SIZE;
  return { x: dx * scale, z: dz * scale };
}

function drawBiomeBackground(ctx, px, pz) {
  // Sample biome at a BIOME_BG_SAMPLES x BIOME_BG_SAMPLES grid covering the minimap view.
  // Each cell maps to (MINIMAP_RANGE*2 / BIOME_BG_SAMPLES) world units per side.
  const stepWorld = (MINIMAP_RANGE * 2) / BIOME_BG_SAMPLES;
  const startWorldX = px - MINIMAP_RANGE;
  const startWorldZ = pz - MINIMAP_RANGE;

  for (let gy = 0; gy < BIOME_BG_SAMPLES; gy++) {
    for (let gx = 0; gx < BIOME_BG_SAMPLES; gx++) {
      const sampleX = startWorldX + (gx + 0.5) * stepWorld;
      const sampleZ = startWorldZ + (gy + 0.5) * stepWorld;
      const biome = getBiomeAt(sampleX, sampleZ);
      ctx.fillStyle = BIOME_COLORS_CSS[biome] || BIOME_FALLBACK_CSS;
      ctx.fillRect(gx * BIOME_CELL_PX, gy * BIOME_CELL_PX, BIOME_CELL_PX + 1, BIOME_CELL_PX + 1);
    }
  }
}

function drawBuildingIcon(ctx, x, y, kind, size = 5) {
  const spec = BUILDING_ICONS[kind] || BUILDING_ICONS.house;
  ctx.fillStyle = spec.color;
  if (spec.shape === 'square') {
    ctx.fillRect(x - size, y - size, size * 2, size * 2);
  } else if (spec.shape === 'triangle') {
    ctx.beginPath();
    ctx.moveTo(x, y - size * 1.2);
    ctx.lineTo(x + size, y + size);
    ctx.lineTo(x - size, y + size);
    ctx.closePath();
    ctx.fill();
  } else if (spec.shape === 'diamond') {
    ctx.beginPath();
    ctx.moveTo(x, y - size * 1.2);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x, y + size * 1.2);
    ctx.lineTo(x - size, y);
    ctx.closePath();
    ctx.fill();
  } else if (spec.shape === 'circle') {
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    if (spec.accent) {
      ctx.fillStyle = spec.accent;
      ctx.beginPath();
      ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawAirdropMarker(ctx, pos, playerX, playerZ) {
  if (!pos) return;
  const p = worldToMinimap(pos.x, pos.z, playerX, playerZ);
  if (!p) return;
  // Pulsing red triangle + "!" label.
  const pulse = 0.85 + 0.15 * Math.sin(performance.now() * 0.005);
  ctx.fillStyle = `rgba(255, 34, 0, ${0.8 * pulse})`;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - 6);
  ctx.lineTo(p.x + 5, p.y + 3);
  ctx.lineTo(p.x - 5, p.y + 3);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 9px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('!', p.x, p.y + 1);
}

export function updateMinimap() {
  if (!minimapCtx || !state.controls) return;

  const ctx = minimapCtx;
  const playerPos = state.controls.getObject().position;
  const px = playerPos.x;
  const pz = playerPos.z;

  // Clear + clip to circle
  ctx.save();
  ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
  ctx.beginPath();
  ctx.arc(MINIMAP_SIZE / 2, MINIMAP_SIZE / 2, MINIMAP_SIZE / 2, 0, Math.PI * 2);
  ctx.clip();

  // Background — default dark wash, then biome tint on top.
  ctx.fillStyle = 'rgba(10, 10, 10, 0.9)';
  ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
  drawBiomeBackground(ctx, px, pz);

  // Re-apply circle tint so edges fade to black
  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

  // Draw zone
  const zonePos = worldToMinimap(state.zone.x, state.zone.z, px, pz);
  if (zonePos) {
    const zoneRadius = (state.zone.radius / MINIMAP_RANGE) * (MINIMAP_SIZE / 2);
    ctx.fillStyle = 'rgba(0, 100, 255, 0.25)';
    ctx.beginPath();
    ctx.arc(zonePos.x, zonePos.y, zoneRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0088ff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Buildings — use state.buildingMarkers (kind-tagged).
  const markers = state.buildingMarkers || [];
  for (let i = 0; i < markers.length; i++) {
    const m = markers[i];
    const pos = worldToMinimap(m.x, m.z, px, pz);
    if (pos) drawBuildingIcon(ctx, pos.x, pos.y, m.kind, 4);
  }
  // Legacy: plain housePositions (no kind tag)
  ctx.fillStyle = BUILDING_ICONS.house.color;
  for (let i = 0; i < state.housePositions.length; i++) {
    const h = state.housePositions[i];
    const pos = worldToMinimap(h.x, h.z, px, pz);
    if (pos) ctx.fillRect(pos.x - 2, pos.y - 2, 4, 4);
  }

  // Airdrop position (nearest active drop).
  if (state.nearestAirdropPos) {
    drawAirdropMarker(ctx, state.nearestAirdropPos, px, pz);
  }
  // Also show each active landed airdrop crate position.
  for (let i = 0; i < state.airdrops.length; i++) {
    const ad = state.airdrops[i];
    if (ad.phase === 'landed' && ad.crate) {
      drawAirdropMarker(ctx, ad.crate.position, px, pz);
    }
  }

  // Bots
  ctx.fillStyle = '#ff3333';
  ctx.font = '8px sans-serif';
  for (let i = 0; i < state.bots.length; i++) {
    const bot = state.bots[i];
    if (!bot.alive) continue;
    const pos = worldToMinimap(bot.mesh.position.x, bot.mesh.position.z, px, pz);
    if (pos) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
      ctx.fill();
      const dx = bot.mesh.position.x - px;
      const dz = bot.mesh.position.z - pz;
      if (dx * dx + dz * dz < 200 * 200 && bot.name) {
        ctx.fillStyle = '#ff6666';
        ctx.fillText(bot.name, pos.x + 4, pos.y - 4);
        ctx.fillStyle = '#ff3333';
      }
    }
  }

  // Zombies
  ctx.fillStyle = '#00cc00';
  for (let i = 0; i < state.zombies.length; i++) {
    const z = state.zombies[i];
    if (!z.alive) continue;
    const pos = worldToMinimap(z.mesh.position.x, z.mesh.position.z, px, pz);
    if (pos) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Animals
  const animals = getAllAnimals();
  ctx.fillStyle = '#ffaa00';
  for (let i = 0; i < animals.length; i++) {
    const a = animals[i];
    if (!a.alive) continue;
    const pos = worldToMinimap(a.mesh.position.x, a.mesh.position.z, px, pz);
    if (pos) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Aliens
  const aliens = getAllAliens();
  ctx.fillStyle = '#ff00ff';
  for (let i = 0; i < aliens.length; i++) {
    const a = aliens[i];
    if (!a.alive) continue;
    const pos = worldToMinimap(a.mesh.position.x, a.mesh.position.z, px, pz);
    if (pos) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Vehicles (nearby ones)
  ctx.fillStyle = '#55aaff';
  for (let i = 0; i < state.vehicles.length; i++) {
    const v = state.vehicles[i];
    if (v.destroyed) continue;
    const pos = worldToMinimap(v.position.x, v.position.z, px, pz);
    if (pos) {
      ctx.fillRect(pos.x - 2, pos.y - 2, 4, 4);
    }
  }

  // Player (always center)
  ctx.fillStyle = '#00ff00';
  ctx.beginPath();
  ctx.arc(MINIMAP_SIZE / 2, MINIMAP_SIZE / 2, 4, 0, Math.PI * 2);
  ctx.fill();

  // Player direction
  const dir = new THREE.Vector3();
  state.camera.getWorldDirection(dir);
  const angle = Math.atan2(dir.z, dir.x);
  ctx.strokeStyle = '#00ff00';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(MINIMAP_SIZE / 2, MINIMAP_SIZE / 2);
  ctx.lineTo(
    MINIMAP_SIZE / 2 + Math.cos(angle) * 15,
    MINIMAP_SIZE / 2 + Math.sin(angle) * 15
  );
  ctx.stroke();

  ctx.restore();

  // Compass (drawn outside the clip so it's not clipped at edges)
  ctx.fillStyle = '#ffffff';
  ctx.font = '10px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('N', MINIMAP_SIZE / 2, 12);
  ctx.fillText('S', MINIMAP_SIZE / 2, MINIMAP_SIZE - 4);
  ctx.fillText('E', MINIMAP_SIZE - 6, MINIMAP_SIZE / 2 + 4);
  ctx.fillText('W', 8, MINIMAP_SIZE / 2 + 4);
}
