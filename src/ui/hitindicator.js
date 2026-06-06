// Hit direction indicator - shows where damage came from (CS:GO style)

import * as THREE from 'three';
import { state } from '../state.js';

let indicatorContainer = null;
let vignetteElement = null;
let indicators = [];
const INDICATOR_LIFETIME = 1500; // 1.5 seconds
const _playerDir = new THREE.Vector3();
const _toAttacker = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _hitShakeEuler = new THREE.Euler(0, 0, 0, 'YXZ');

export function initHitIndicator() {
  // Create container for hit indicators
  indicatorContainer = document.createElement('div');
  indicatorContainer.id = 'hit-indicator-container';
  indicatorContainer.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 15;
  `;
  document.body.appendChild(indicatorContainer);

  vignetteElement = document.createElement('div');
  vignetteElement.id = 'hit-direction-vignette';
  vignetteElement.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    width: 180vmax;
    height: 180vmax;
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 14;
    opacity: 0;
    mix-blend-mode: screen;
  `;
  document.body.appendChild(vignetteElement);
  requestAnimationFrame(updateHitIndicators);
}

function getHitAngle(attackerPos) {
  const playerPos = state.controls.getObject().position;
  state.camera.getWorldDirection(_playerDir);

  _toAttacker.subVectors(attackerPos, playerPos);
  _toAttacker.y = 0;
  _toAttacker.normalize();

  _forward.set(_playerDir.x, 0, _playerDir.z).normalize();
  return Math.atan2(
    _forward.x * _toAttacker.z - _forward.z * _toAttacker.x,
    _forward.x * _toAttacker.x + _forward.z * _toAttacker.z
  );
}

function updateIndicatorTransform(indicator) {
  if (!indicator.element || !state.controls || !state.camera) return;
  const angle = getHitAngle(indicator.attackerPos);
  indicator.element.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`;
}

function updateHitIndicators() {
  const now = performance.now();
  let strongestVignette = null;
  let strongestOpacity = 0;

  for (let i = indicators.length - 1; i >= 0; i--) {
    const indicator = indicators[i];
    const elapsed = now - indicator.startTime;
    const opacity = Math.max(0, 1 - elapsed / INDICATOR_LIFETIME);

    updateIndicatorTransform(indicator);
    indicator.element.style.opacity = opacity;
    const vignetteOpacity = opacity * indicator.intensity;
    if (vignetteOpacity > strongestOpacity) {
      strongestOpacity = vignetteOpacity;
      strongestVignette = indicator;
    }

    if (elapsed >= INDICATOR_LIFETIME) {
      if (indicatorContainer && indicatorContainer.contains(indicator.element)) {
        indicatorContainer.removeChild(indicator.element);
      }
      indicators.splice(i, 1);
    }
  }

  updateVignette(strongestVignette, strongestOpacity);
  requestAnimationFrame(updateHitIndicators);
}

function updateVignette(indicator, opacity) {
  if (!vignetteElement) return;
  if (!indicator || opacity <= 0) {
    vignetteElement.style.opacity = '0';
    return;
  }
  const angle = getHitAngle(indicator.attackerPos);
  const pulse = Math.min(1, Math.max(0, opacity));
  vignetteElement.style.opacity = (pulse * 0.55).toFixed(3);
  vignetteElement.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`;
  vignetteElement.style.background = `radial-gradient(ellipse at 50% 7%, rgba(255, 30, 24, ${0.28 * pulse}), rgba(255, 0, 0, ${0.12 * pulse}) 12%, rgba(255, 0, 0, 0) 34%)`;
}

function applyDirectionalCameraKick(attackerPos, intensity) {
  if (!state.camera || !attackerPos) return;
  const angle = getHitAngle(attackerPos);
  const amount = 0.004 + intensity * 0.006;

  // A tiny one-frame roll/yaw nudge sells impact direction without fighting mouse aim.
  _hitShakeEuler.setFromQuaternion(state.camera.quaternion);
  _hitShakeEuler.y += Math.sin(angle) * amount * 0.45;
  _hitShakeEuler.x += Math.cos(angle) * amount * 0.35;
  _hitShakeEuler.z = 0;
  state.camera.quaternion.setFromEuler(_hitShakeEuler);
}

// Show hit indicator from a specific direction
export function showHitDirection(attackerPos, damage = 10) {
  if (!indicatorContainer || !state.controls) return;
  const intensity = Math.min(1, Math.max(0.25, damage / 55));

  // Create hit indicator element
  const indicator = document.createElement('div');
  indicator.className = 'hit-direction';
  indicator.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    width: 100px;
    height: 100px;
    pointer-events: none;
  `;

  // Create the red arc/wedge
  const arc = document.createElement('div');
  arc.style.cssText = `
    position: absolute;
    top: -40px;
    left: 50%;
    width: 0;
    height: 0;
    border-left: 15px solid transparent;
    border-right: 15px solid transparent;
    border-bottom: 40px solid rgba(255, 0, 0, 0.8);
    transform: translateX(-50%);
    filter: drop-shadow(0 0 5px rgba(255, 0, 0, 0.5));
  `;
  indicator.appendChild(arc);

  indicatorContainer.appendChild(indicator);
  const entry = {
    element: indicator,
    attackerPos: attackerPos.clone ? attackerPos.clone() : new THREE.Vector3(attackerPos.x, attackerPos.y, attackerPos.z),
    startTime: performance.now(),
    intensity
  };
  indicators.push(entry);
  applyDirectionalCameraKick(entry.attackerPos, intensity);
  updateIndicatorTransform(entry);
}

// Show hit indicator when player is hit
export function showHitFromDirection(damageSourcePos, damage = 10) {
  showHitDirection(damageSourcePos, damage);
}
