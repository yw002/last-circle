// Bullet tracer system - draws visible paths from exact muzzle point to impact point.

import * as THREE from 'three';
import { state } from '../state.js';

const TRACER_DURATION = 0.18; // seconds
const TRACER_COLOR = 0xffff00; // Yellow
const MAX_TRACERS = 50;
const TRACER_RADIUS = 0.035;

// Pool of tracer lines
const tracerPool = [];
const activeTracers = [];
const _midPoint = new THREE.Vector3();
const _direction = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

// Shared geometry and material
const tracerGeometry = new THREE.CylinderGeometry(TRACER_RADIUS, TRACER_RADIUS * 0.4, 1, 6, 1, true);
const tracerMaterial = new THREE.MeshBasicMaterial({
  color: TRACER_COLOR,
  transparent: true,
  opacity: 0.85,
  depthWrite: false
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

  // Create new tracer if pool not full.
  if (tracerPool.length < MAX_TRACERS) {
    const mesh = new THREE.Mesh(tracerGeometry, tracerMaterial.clone());
    mesh.frustumCulled = false;
    state.scene.add(mesh);

    const tracer = {
      mesh,
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

  _direction.subVectors(endPos, startPos);
  const length = _direction.length();
  if (length < 0.01) {
    tracer.active = false;
    tracer.mesh.visible = false;
    return;
  }

  _midPoint.copy(startPos).add(endPos).multiplyScalar(0.5);
  tracer.mesh.position.copy(_midPoint);
  tracer.mesh.scale.set(1, length, 1);
  tracer.mesh.quaternion.setFromUnitVectors(_up, _direction.normalize());
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

// Create a tracer from the exact muzzle position to the actual impact point.
export function createWeaponTracer(startPos, hitPoint) {
  if (!startPos || !hitPoint) return;
  spawnTracer(startPos, hitPoint);
}

// Create tracer from any position (for enemy bullets)
export function createTracerFromPosition(startPos, endPos) {
  spawnTracer(startPos.clone(), endPos.clone());
}
