// Hit direction indicator - shows where damage came from (CS:GO style)

import * as THREE from 'three';
import { state } from '../state.js';

let indicatorContainer = null;
let indicators = [];
const INDICATOR_LIFETIME = 1500; // 1.5 seconds

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
}

// Show hit indicator from a specific direction
export function showHitDirection(attackerPos) {
  if (!indicatorContainer || !state.controls) return;

  const playerPos = state.controls.getObject().position;
  const playerDir = new THREE.Vector3();
  state.camera.getWorldDirection(playerDir);

  // Calculate angle between player forward and attacker direction
  const toAttacker = new THREE.Vector3().subVectors(attackerPos, playerPos);
  toAttacker.y = 0;
  toAttacker.normalize();

  const forward = new THREE.Vector3(playerDir.x, 0, playerDir.z).normalize();
  const angle = Math.atan2(
    forward.x * toAttacker.z - forward.z * toAttacker.x,
    forward.x * toAttacker.x + forward.z * toAttacker.z
  );

  // Create hit indicator element
  const indicator = document.createElement('div');
  indicator.className = 'hit-direction';
  indicator.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    width: 100px;
    height: 100px;
    transform: translate(-50%, -50%) rotate(${angle}rad);
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

  // Fade out and remove
  let opacity = 1;
  const fadeInterval = setInterval(() => {
    opacity -= 0.05;
    indicator.style.opacity = opacity;
    if (opacity <= 0) {
      clearInterval(fadeInterval);
      if (indicatorContainer.contains(indicator)) {
        indicatorContainer.removeChild(indicator);
      }
    }
  }, 75);
}

// Show hit indicator when player is hit
export function showHitFromDirection(damageSourcePos) {
  showHitDirection(damageSourcePos);
}
