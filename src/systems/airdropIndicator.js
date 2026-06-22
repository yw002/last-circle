// Airdrop direction indicator — golden arrow on screen pointing to nearest airdrop

import * as THREE from 'three';
import { state } from '../state.js';

let indicatorEl = null;

export function initAirdropIndicator() {
  indicatorEl = document.createElement('div');
  indicatorEl.id = 'airdrop-indicator';
  indicatorEl.style.display = 'none';
  document.body.appendChild(indicatorEl);
}

export function updateAirdropIndicator() {
  if (!indicatorEl) return;

  // Find nearest landed airdrop
  const playerPos = state.controls ? state.controls.getObject().position : null;
  if (!playerPos) return;

  let nearest = null;
  let nearestDist = Infinity;

  for (let i = 0; i < state.airdrops.length; i++) {
    const ad = state.airdrops[i];
    if (ad.phase === 'landed' && ad.crate) {
      const dx = ad.crate.position.x - playerPos.x;
      const dz = ad.crate.position.z - playerPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = ad.crate.position;
      }
    }
  }

  // Also check state.nearestAirdropPos as fallback
  if (!nearest && state.nearestAirdropPos) {
    nearest = state.nearestAirdropPos;
    const dx = nearest.x - playerPos.x;
    const dz = nearest.z - playerPos.z;
    nearestDist = Math.sqrt(dx * dx + dz * dz);
  }

  if (!nearest || nearestDist < 20) {
    // Hide indicator if no airdrop or very close
    indicatorEl.style.display = 'none';
    return;
  }

  indicatorEl.style.display = 'block';

  // Calculate angle from player to airdrop (in screen space)
  const dx = nearest.x - playerPos.x;
  const dz = nearest.z - playerPos.z;
  const angle = Math.atan2(dz, dx);

  // Get player facing direction
  const camDir = new THREE.Vector3();
  state.camera.getWorldDirection(camDir);
  const camAngle = Math.atan2(camDir.z, camDir.x);

  // Relative angle
  let relAngle = angle - camAngle;
  // Normalize to -PI..PI
  while (relAngle > Math.PI) relAngle -= Math.PI * 2;
  while (relAngle < -Math.PI) relAngle += Math.PI * 2;

  // Position arrow around screen edge based on relative angle
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;
  const radius = Math.min(centerX, centerY) * 0.7;

  const ax = centerX + Math.cos(relAngle) * radius;
  const ay = centerY + Math.sin(relAngle) * radius;

  indicatorEl.style.left = ax + 'px';
  indicatorEl.style.top = ay + 'px';
  // Arrow rotation: 0deg = right, CSS rotate clockwise
  indicatorEl.style.transform = `translate(-50%, -50%) rotate(${relAngle}rad)`;

  // Distance text
  const distText = nearestDist > 1000
    ? (nearestDist / 1000).toFixed(1) + 'km'
    : Math.round(nearestDist) + 'm';
  indicatorEl.innerHTML = `<span class="airdrop-arrow">▶</span><span class="airdrop-dist">${distText}</span>`;
}
