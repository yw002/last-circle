// Hit direction indicator - shows where damage came from (CS:GO style)

import * as THREE from 'three';
import { state } from '../state.js';

let indicatorContainer = null;
let indicators = [];
const INDICATOR_LIFETIME = 1500; // 1.5 seconds
const _playerDir = new THREE.Vector3();
const _toAttacker = new THREE.Vector3();
const _forward = new THREE.Vector3();

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

  for (let i = indicators.length - 1; i >= 0; i--) {
    const indicator = indicators[i];
    const elapsed = now - indicator.startTime;
    const opacity = Math.max(0, 1 - elapsed / INDICATOR_LIFETIME);

    updateIndicatorTransform(indicator);
    indicator.element.style.opacity = opacity;

    if (elapsed >= INDICATOR_LIFETIME) {
      if (indicatorContainer && indicatorContainer.contains(indicator.element)) {
        indicatorContainer.removeChild(indicator.element);
      }
      indicators.splice(i, 1);
    }
  }

  requestAnimationFrame(updateHitIndicators);
}

// Show hit indicator from a specific direction
export function showHitDirection(attackerPos) {
  if (!indicatorContainer || !state.controls) return;

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
    startTime: performance.now()
  };
  indicators.push(entry);
  updateIndicatorTransform(entry);
}

// Show hit indicator when player is hit
export function showHitFromDirection(damageSourcePos) {
  showHitDirection(damageSourcePos);
}
