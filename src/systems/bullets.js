// Bullet tracer system - shows yellow lines for all bullets
// Supports multiple simultaneous tracers with fade-out

import * as THREE from 'three';
import { state } from '../state.js';

const TRACER_DURATION = 0.15; // seconds
const TRACER_COLOR = 0xffff00; // Yellow
const MAX_TRACERS = 50;

// Pool of tracer lines
const tracerPool = [];
const activeTracers = [];

// Shared geometry and material
const tracerMaterial = new THREE.LineBasicMaterial({
  color: TRACER_COLOR,
  transparent: true,
  opacity: 0.9,
  linewidth: 2
});

function getTracerFromPool() {
  // Reuse inactive tracer or create new
  for (let i = 0; i < tracerPool.length; i++) {
    if (!tracerPool[i].active) {
      tracerPool[i].active = true;
      tracerPool[i].mesh.visible = true;
      return tracerPool[i];
    }
  }

  // Create new tracer if pool not full
  if (tracerPool.length < MAX_TRACERS) {
    const geometry = new THREE.BufferGeometry();
    const points = [new THREE.Vector3(), new THREE.Vector3()];
    geometry.setFromPoints(points);

    const mesh = new THREE.Line(geometry, tracerMaterial.clone());
    state.scene.add(mesh);

    const tracer = {
      mesh,
      geometry,
      points,
      startTime: 0,
      active: true
    };
    tracerPool.push(tracer);
    return tracer;
  }

  return null;
}

// Spawn a bullet tracer from start to end
export function spawnTracer(startPos, endPos) {
  const tracer = getTracerFromPool();
  if (!tracer) return;

  tracer.points[0].copy(startPos);
  tracer.points[1].copy(endPos);
  tracer.geometry.setFromPoints(tracer.points);
  tracer.startTime = performance.now();
  tracer.active = true;
  tracer.mesh.visible = true;
  tracer.mesh.material.opacity = 0.9;

  activeTracers.push(tracer);
}

// Update all active tracers (fade out and remove)
export function updateTracers() {
  const now = performance.now();

  for (let i = activeTracers.length - 1; i >= 0; i--) {
    const tracer = activeTracers[i];
    const elapsed = (now - tracer.startTime) / 1000;

    if (elapsed > TRACER_DURATION) {
      // Deactivate tracer
      tracer.active = false;
      tracer.mesh.visible = false;
      activeTracers.splice(i, 1);
    } else {
      // Fade out
      const opacity = 0.9 * (1 - elapsed / TRACER_DURATION);
      tracer.mesh.material.opacity = opacity;
    }
  }
}

// Create a tracer from a weapon to a hit point
export function createWeaponTracer(weaponMesh, hitPoint) {
  if (!weaponMesh || !hitPoint) return;

  // Get gun barrel position
  const barrelTip = new THREE.Vector3(0, 0.06, -1.8);
  const startPos = barrelTip.clone();
  weaponMesh.localToWorld(startPos);

  spawnTracer(startPos, hitPoint);
}

// Create tracer from any position (for enemy bullets)
export function createTracerFromPosition(startPos, endPos) {
  spawnTracer(startPos.clone(), endPos.clone());
}
