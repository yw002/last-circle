// Bullet tracer system - draws visible paths from exact muzzle point to impact point.

import * as THREE from 'three';
import { state } from '../state.js';
import { playBulletWhiz } from './audio.js';

const TRACER_DURATION = 0.18; // seconds
const TRACER_COLOR = 0xffff00; // Yellow
const MAX_TRACERS = 50;
const TRACER_RADIUS = 0.035;
let weaponTracerCounter = 0;
let enemyTracerCounter = 0;

// Pool of tracer lines
const tracerPool = [];
const activeTracers = [];
const _midPoint = new THREE.Vector3();
const _direction = new THREE.Vector3();
const _segment = new THREE.Vector3();
const _closest = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
let lastWhizTime = 0;

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
      active: true,
      duration: TRACER_DURATION,
      baseOpacity: 0.9
    };
    tracerPool.push(tracer);
    return tracer;
  }

  return null;
}

function maybePlayWhiz(startPos, endPos) {
  if (!state.controls) return;

  const now = performance.now();
  if (now - lastWhizTime < 90) return;

  const playerPos = state.controls.getObject().position;
  _segment.subVectors(endPos, startPos);
  const lenSq = _segment.lengthSq();
  if (lenSq < 1) return;

  const t = Math.max(0, Math.min(1, _closest.subVectors(playerPos, startPos).dot(_segment) / lenSq));
  _closest.copy(startPos).add(_segment.multiplyScalar(t));
  const distSq = _closest.distanceToSquared(playerPos);
  if (distSq > 55 * 55 || startPos.distanceToSquared(playerPos) < 25) return;

  lastWhizTime = now;
  playBulletWhiz(_closest, 1 - Math.sqrt(distSq) / 55);
}

function getDistanceVisuals(length, options) {
  const t = Math.max(0, Math.min(1, length / 850));
  const isEnemy = options && options.source === 'enemy';
  const nearBoost = 1 - t;

  return {
    radiusScale: (isEnemy ? 0.85 : 1.0) * (1.15 - t * 0.55),
    opacity: Math.max(0.24, (isEnemy ? 0.72 : 0.9) - t * 0.42 + nearBoost * 0.12),
    duration: Math.max(0.08, Math.min(0.22, 0.105 + t * 0.08))
  };
}

function shouldShowWeaponTracer(weapon) {
  if (!weapon) return true;
  weaponTracerCounter++;
  if (weapon.type === 'melee' || weapon.type === 'throwable') return false;
  if (weapon.type === 'sniper' || weapon.type === 'shotgun' || weapon.type === 'pistol') return true;

  // Automatic weapons show sampled tracers, keeping feedback readable without every round looking identical.
  const cadence = weapon.fireRate <= 60 ? 4 : weapon.fireRate <= 110 ? 3 : 2;
  return weaponTracerCounter % cadence === 0 || Math.random() < 0.12;
}

function shouldShowEnemyTracer() {
  enemyTracerCounter++;
  return enemyTracerCounter % 2 === 0 || Math.random() < 0.28;
}

// Spawn a bullet tracer from start to end
export function spawnTracer(startPos, endPos, options = null) {
  if (options && options.sample === 'weapon' && !shouldShowWeaponTracer(options.weapon)) return;
  if (options && options.sample === 'enemy' && !shouldShowEnemyTracer()) {
    if (options.whiz) maybePlayWhiz(startPos, endPos);
    return;
  }

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
  const visuals = getDistanceVisuals(length, options);
  tracer.mesh.position.copy(_midPoint);
  tracer.mesh.scale.set(visuals.radiusScale, length, visuals.radiusScale);
  tracer.mesh.quaternion.setFromUnitVectors(_up, _direction.normalize());
  tracer.startTime = performance.now();
  tracer.duration = visuals.duration;
  tracer.baseOpacity = visuals.opacity;
  tracer.active = true;
  tracer.mesh.visible = true;
  tracer.mesh.material.opacity = visuals.opacity;
  tracer.mesh.material.color.setHex(options && options.source === 'enemy' ? 0xffb84a : TRACER_COLOR);
  if (options && options.whiz) maybePlayWhiz(startPos, endPos);

  activeTracers.push(tracer);
}

// Update all active tracers (fade out and remove)
export function updateTracers() {
  const now = performance.now();

  for (let i = activeTracers.length - 1; i >= 0; i--) {
    const tracer = activeTracers[i];
    const elapsed = (now - tracer.startTime) / 1000;

    if (elapsed > tracer.duration) {
      // Deactivate tracer
      tracer.active = false;
      tracer.mesh.visible = false;
      activeTracers.splice(i, 1);
    } else {
      // Fade out
      const opacity = tracer.baseOpacity * (1 - elapsed / tracer.duration);
      tracer.mesh.material.opacity = opacity;
    }
  }
}

// Create a tracer from the exact muzzle position to the actual impact point.
export function createWeaponTracer(startPos, hitPoint, weapon = null) {
  if (!startPos || !hitPoint) return;
  spawnTracer(startPos, hitPoint, { whiz: false, sample: 'weapon', weapon });
}

// Create tracer from any position (for enemy bullets)
export function createTracerFromPosition(startPos, endPos) {
  spawnTracer(startPos.clone(), endPos.clone(), { whiz: true, sample: 'enemy', source: 'enemy' });
}
