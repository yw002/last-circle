// Bullet hole decal system - leaves marks on surfaces when bullets hit

import * as THREE from 'three';
import { state } from '../state.js';

const MAX_BULLET_HOLES = 200;
const BULLET_HOLE_LIFETIME = 30000; // 30 seconds

// Pool of bullet hole meshes
const bulletHolePool = [];
const activeBulletHoles = [];

// Create bullet hole texture using canvas
function createBulletHoleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  // Dark circle with rough edges
  ctx.fillStyle = 'rgba(20, 20, 20, 0.9)';
  ctx.beginPath();
  ctx.arc(32, 32, 20, 0, Math.PI * 2);
  ctx.fill();

  // Inner darker hole
  ctx.fillStyle = 'rgba(5, 5, 5, 0.95)';
  ctx.beginPath();
  ctx.arc(32, 32, 10, 0, Math.PI * 2);
  ctx.fill();

  // Cracks radiating out
  ctx.strokeStyle = 'rgba(40, 40, 40, 0.6)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + Math.random() * 0.3;
    ctx.beginPath();
    ctx.moveTo(32 + Math.cos(angle) * 10, 32 + Math.sin(angle) * 10);
    ctx.lineTo(32 + Math.cos(angle) * (25 + Math.random() * 10), 32 + Math.sin(angle) * (25 + Math.random() * 10));
    ctx.stroke();
  }

  // Edge roughness
  ctx.fillStyle = 'rgba(30, 30, 30, 0.5)';
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const r = 18 + Math.random() * 6;
    ctx.beginPath();
    ctx.arc(32 + Math.cos(angle) * r, 32 + Math.sin(angle) * r, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// Shared resources
let bulletHoleTexture = null;
let bulletHoleMaterial = null;

function initBulletHoleResources() {
  if (bulletHoleMaterial) return;

  bulletHoleTexture = createBulletHoleTexture();
  bulletHoleMaterial = new THREE.MeshBasicMaterial({
    map: bulletHoleTexture,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    side: THREE.DoubleSide
  });
}

function getBulletHoleFromPool() {
  initBulletHoleResources();

  // Find inactive bullet hole
  for (let i = 0; i < bulletHolePool.length; i++) {
    if (!bulletHolePool[i].active) {
      bulletHolePool[i].active = true;
      bulletHolePool[i].mesh.visible = true;
      return bulletHolePool[i];
    }
  }

  // Create new if pool not full
  if (bulletHolePool.length < MAX_BULLET_HOLES) {
    const geometry = new THREE.PlaneGeometry(1.5, 1.5);
    const mesh = new THREE.Mesh(geometry, bulletHoleMaterial.clone());
    state.scene.add(mesh);

    const bulletHole = {
      mesh,
      createdAt: 0,
      active: true
    };
    bulletHolePool.push(bulletHole);
    return bulletHole;
  }

  // Reuse oldest
  if (activeBulletHoles.length > 0) {
    const oldest = activeBulletHoles.shift();
    oldest.active = false;
    oldest.active = true;
    return oldest;
  }

  return null;
}

// Spawn a bullet hole at a hit point on a surface
export function spawnBulletHole(hitPoint, hitNormal) {
  const bulletHole = getBulletHoleFromPool();
  if (!bulletHole) return;

  // Position slightly above surface to avoid z-fighting
  bulletHole.mesh.position.copy(hitPoint);
  bulletHole.mesh.position.add(hitNormal.clone().multiplyScalar(0.05));

  // Orient to face the surface normal
  bulletHole.mesh.lookAt(
    hitPoint.x + hitNormal.x,
    hitPoint.y + hitNormal.y,
    hitPoint.z + hitNormal.z
  );

  // Random rotation for variety
  bulletHole.mesh.rotation.z = Math.random() * Math.PI * 2;

  // Random size variation
  const scale = 0.8 + Math.random() * 0.6;
  bulletHole.mesh.scale.set(scale, scale, 1);

  bulletHole.createdAt = performance.now();
  bulletHole.active = true;
  bulletHole.mesh.visible = true;

  activeBulletHoles.push(bulletHole);
}

// Update bullet holes (fade and remove old ones)
export function updateBulletHoles() {
  const now = performance.now();

  for (let i = activeBulletHoles.length - 1; i >= 0; i--) {
    const hole = activeBulletHoles[i];
    const age = now - hole.createdAt;

    if (age > BULLET_HOLE_LIFETIME) {
      // Remove old bullet hole
      hole.active = false;
      hole.mesh.visible = false;
      activeBulletHoles.splice(i, 1);
    } else if (age > BULLET_HOLE_LIFETIME * 0.8) {
      // Fade out in last 20% of lifetime
      const fadeProgress = (age - BULLET_HOLE_LIFETIME * 0.8) / (BULLET_HOLE_LIFETIME * 0.2);
      hole.mesh.material.opacity = 0.9 * (1 - fadeProgress);
    }
  }
}
