// Minimap system - optimized with distance culling and reduced draw calls

import * as THREE from 'three';
import { state } from '../state.js';
import { MAP_SIZE } from '../config.js';
import { getAllAnimals } from '../entities/animals.js';
import { getAllAliens } from '../entities/aliens.js';

let minimapCanvas = null;
let minimapCtx = null;
const MINIMAP_SIZE = 300;
const MINIMAP_RANGE = 1000;
const MINIMAP_RANGE_SQ = MINIMAP_RANGE * MINIMAP_RANGE;

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
  let dx = worldX - playerX;
  let dz = worldZ - playerZ;

  // Quick range check
  if (dx * dx + dz * dz > MINIMAP_RANGE_SQ * 1.5) return null;

  let scale = MINIMAP_SIZE / (MINIMAP_RANGE * 2);
  let mx = MINIMAP_SIZE / 2 + dx * scale;
  let my = MINIMAP_SIZE / 2 + dz * scale;

  // Clamp to circle
  let cx = mx - MINIMAP_SIZE / 2;
  let cy = my - MINIMAP_SIZE / 2;
  let distSq = cx * cx + cy * cy;
  let maxR = MINIMAP_SIZE / 2 - 5;
  if (distSq > maxR * maxR) {
    let dist = Math.sqrt(distSq);
    let scale2 = maxR / dist;
    mx = MINIMAP_SIZE / 2 + cx * scale2;
    my = MINIMAP_SIZE / 2 + cy * scale2;
  }

  _tempPos.x = mx;
  _tempPos.y = my;
  return _tempPos;
}

export function updateMinimap() {
  if (!minimapCtx || !state.controls) return;

  const ctx = minimapCtx;
  const playerPos = state.controls.getObject().position;
  const px = playerPos.x;
  const pz = playerPos.z;

  // Clear
  ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

  // Background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.beginPath();
  ctx.arc(MINIMAP_SIZE / 2, MINIMAP_SIZE / 2, MINIMAP_SIZE / 2, 0, Math.PI * 2);
  ctx.fill();

  // Draw zone
  let zonePos = worldToMinimap(state.zone.x, state.zone.z, px, pz);
  if (zonePos) {
    let zoneRadius = (state.zone.radius / MINIMAP_RANGE) * (MINIMAP_SIZE / 2);
    ctx.fillStyle = 'rgba(0, 100, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(zonePos.x, zonePos.y, zoneRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0088ff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Draw houses (only nearby)
  ctx.fillStyle = '#888888';
  for (let i = 0; i < state.housePositions.length; i++) {
    let h = state.housePositions[i];
    let pos = worldToMinimap(h.x, h.z, px, pz);
    if (pos) {
      ctx.fillRect(pos.x - 2, pos.y - 2, 4, 4);
    }
  }

  // Draw bots (only nearby)
  ctx.fillStyle = '#ff3333';
  ctx.font = '8px sans-serif';
  for (let i = 0; i < state.bots.length; i++) {
    let bot = state.bots[i];
    if (!bot.alive) continue;
    let pos = worldToMinimap(bot.mesh.position.x, bot.mesh.position.z, px, pz);
    if (pos) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
      ctx.fill();
      // Show bot name if close enough
      const dx = bot.mesh.position.x - px;
      const dz = bot.mesh.position.z - pz;
      if (dx * dx + dz * dz < 200 * 200 && bot.name) {
        ctx.fillStyle = '#ff6666';
        ctx.fillText(bot.name, pos.x + 4, pos.y - 4);
        ctx.fillStyle = '#ff3333';
      }
    }
  }

  // Draw zombies (only nearby)
  ctx.fillStyle = '#00cc00';
  for (let i = 0; i < state.zombies.length; i++) {
    let z = state.zombies[i];
    if (!z.alive) continue;
    let pos = worldToMinimap(z.mesh.position.x, z.mesh.position.z, px, pz);
    if (pos) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Draw animals (only nearby)
  let animals = getAllAnimals();
  ctx.fillStyle = '#ffaa00';
  for (let i = 0; i < animals.length; i++) {
    let a = animals[i];
    if (!a.alive) continue;
    let pos = worldToMinimap(a.mesh.position.x, a.mesh.position.z, px, pz);
    if (pos) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Draw aliens
  let aliens = getAllAliens();
  ctx.fillStyle = '#ff00ff';
  for (let i = 0; i < aliens.length; i++) {
    let a = aliens[i];
    if (!a.alive) continue;
    let pos = worldToMinimap(a.mesh.position.x, a.mesh.position.z, px, pz);
    if (pos) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Draw player (always center)
  ctx.fillStyle = '#00ff00';
  ctx.beginPath();
  ctx.arc(MINIMAP_SIZE / 2, MINIMAP_SIZE / 2, 4, 0, Math.PI * 2);
  ctx.fill();

  // Player direction
  let dir = new THREE.Vector3();
  state.camera.getWorldDirection(dir);
  let angle = Math.atan2(dir.z, dir.x);
  ctx.strokeStyle = '#00ff00';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(MINIMAP_SIZE / 2, MINIMAP_SIZE / 2);
  ctx.lineTo(
    MINIMAP_SIZE / 2 + Math.cos(angle) * 15,
    MINIMAP_SIZE / 2 + Math.sin(angle) * 15
  );
  ctx.stroke();

  // Compass
  ctx.fillStyle = '#ffffff';
  ctx.font = '10px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('N', MINIMAP_SIZE / 2, 12);
  ctx.fillText('S', MINIMAP_SIZE / 2, MINIMAP_SIZE - 4);
  ctx.fillText('E', MINIMAP_SIZE - 6, MINIMAP_SIZE / 2 + 4);
  ctx.fillText('W', 8, MINIMAP_SIZE / 2 + 4);
}
