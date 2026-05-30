// Minimap system - shows player, enemies, zone, and terrain

import * as THREE from 'three';
import { state } from '../state.js';
import { MAP_SIZE } from '../config.js';
import { getAllAnimals } from '../entities/animals.js';
import { getAllAliens } from '../entities/aliens.js';

let minimapCanvas = null;
let minimapCtx = null;
const MINIMAP_SIZE = 300;
const MINIMAP_RANGE = 1000; // How far the minimap shows

// Colors for different entity types
const COLORS = {
  player: '#00ff00',
  bot: '#ff3333',
  zombie: '#00cc00',
  animal: '#ffaa00',
  alien: '#ff00ff',
  zone: 'rgba(0, 100, 255, 0.3)',
  zoneBorder: '#0088ff',
  house: '#888888',
  background: 'rgba(0, 0, 0, 0.7)',
  grid: 'rgba(255, 255, 255, 0.1)'
};

export function initMinimap() {
  // Create minimap container
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

  // Create canvas
  minimapCanvas = document.createElement('canvas');
  minimapCanvas.width = MINIMAP_SIZE;
  minimapCanvas.height = MINIMAP_SIZE;
  minimapCanvas.style.cssText = `
    width: 100%;
    height: 100%;
    border-radius: 50%;
  `;

  container.appendChild(minimapCanvas);
  document.body.appendChild(container);

  minimapCtx = minimapCanvas.getContext('2d');
}

export function updateMinimap() {
  if (!minimapCtx || !state.controls) return;

  const ctx = minimapCtx;
  const playerPos = state.controls.getObject().position;

  // Clear
  ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

  // Background
  ctx.fillStyle = COLORS.background;
  ctx.beginPath();
  ctx.arc(MINIMAP_SIZE / 2, MINIMAP_SIZE / 2, MINIMAP_SIZE / 2, 0, Math.PI * 2);
  ctx.fill();

  // Draw grid
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 5; i++) {
    let pos = (i / 4) * MINIMAP_SIZE;
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, MINIMAP_SIZE);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(MINIMAP_SIZE, pos);
    ctx.stroke();
  }

  // Helper: world coords to minimap coords
  function worldToMinimap(worldX, worldZ) {
    let dx = worldX - playerPos.x;
    let dz = worldZ - playerPos.z;

    // Scale to minimap
    let scale = MINIMAP_SIZE / (MINIMAP_RANGE * 2);
    let mx = MINIMAP_SIZE / 2 + dx * scale;
    let my = MINIMAP_SIZE / 2 + dz * scale;

    // Clamp to circle
    let distFromCenter = Math.sqrt((mx - MINIMAP_SIZE / 2) ** 2 + (my - MINIMAP_SIZE / 2) ** 2);
    if (distFromCenter > MINIMAP_SIZE / 2 - 5) {
      let angle = Math.atan2(my - MINIMAP_SIZE / 2, mx - MINIMAP_SIZE / 2);
      mx = MINIMAP_SIZE / 2 + Math.cos(angle) * (MINIMAP_SIZE / 2 - 5);
      my = MINIMAP_SIZE / 2 + Math.sin(angle) * (MINIMAP_SIZE / 2 - 5);
    }

    return { x: mx, y: my };
  }

  // Draw zone
  let zonePos = worldToMinimap(state.zone.x, state.zone.z);
  let zoneRadius = (state.zone.radius / MINIMAP_RANGE) * (MINIMAP_SIZE / 2);
  ctx.fillStyle = COLORS.zone;
  ctx.beginPath();
  ctx.arc(zonePos.x, zonePos.y, zoneRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COLORS.zoneBorder;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw houses
  state.housePositions.forEach(house => {
    let pos = worldToMinimap(house.x, house.z);
    ctx.fillStyle = COLORS.house;
    ctx.fillRect(pos.x - 2, pos.y - 2, 4, 4);
  });

  // Draw bots
  state.bots.forEach(bot => {
    if (!bot.alive) return;
    let pos = worldToMinimap(bot.mesh.position.x, bot.mesh.position.z);
    ctx.fillStyle = COLORS.bot;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
    ctx.fill();
  });

  // Draw zombies
  state.zombies.forEach(zombie => {
    if (!zombie.alive) return;
    let pos = worldToMinimap(zombie.mesh.position.x, zombie.mesh.position.z);
    ctx.fillStyle = COLORS.zombie;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
    ctx.fill();
  });

  // Draw animals
  let animals = getAllAnimals();
  animals.forEach(animal => {
    if (!animal.alive) return;
    let pos = worldToMinimap(animal.mesh.position.x, animal.mesh.position.z);
    ctx.fillStyle = COLORS.animal;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 1.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // Draw aliens
  let aliens = getAllAliens();
  aliens.forEach(alien => {
    if (!alien.alive) return;
    let pos = worldToMinimap(alien.mesh.position.x, alien.mesh.position.z);
    ctx.fillStyle = COLORS.alien;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  // Draw player (always center)
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.arc(MINIMAP_SIZE / 2, MINIMAP_SIZE / 2, 4, 0, Math.PI * 2);
  ctx.fill();

  // Draw player direction indicator
  let dir = new THREE.Vector3();
  state.camera.getWorldDirection(dir);
  let angle = Math.atan2(dir.z, dir.x);
  ctx.strokeStyle = COLORS.player;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(MINIMAP_SIZE / 2, MINIMAP_SIZE / 2);
  ctx.lineTo(
    MINIMAP_SIZE / 2 + Math.cos(angle) * 15,
    MINIMAP_SIZE / 2 + Math.sin(angle) * 15
  );
  ctx.stroke();

  // Draw compass directions
  ctx.fillStyle = '#ffffff';
  ctx.font = '10px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('N', MINIMAP_SIZE / 2, 12);
  ctx.fillText('S', MINIMAP_SIZE / 2, MINIMAP_SIZE - 4);
  ctx.fillText('E', MINIMAP_SIZE - 6, MINIMAP_SIZE / 2 + 4);
  ctx.fillText('W', 8, MINIMAP_SIZE / 2 + 4);
}
