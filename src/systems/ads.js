// ADS (Aim Down Sights) system - CoD/PUBG style
// Moves weapon model to center of screen and adjusts FOV

import * as THREE from 'three';
import { state } from '../state.js';
import { scopes } from '../config.js';

// ADS positions for different weapon types
const ADS_POSITIONS = {
  default: { x: 0, y: -0.3, z: -1.0 },
  pistol: { x: 0, y: -0.25, z: -0.8 },
  smg: { x: 0, y: -0.3, z: -0.9 },
  ar: { x: 0, y: -0.3, z: -1.0 },
  sniper: { x: 0, y: -0.35, z: -1.2 },
  shotgun: { x: 0, y: -0.3, z: -1.0 }
};

// Default hip-fire position
const HIP_POSITION = { x: 0.5, y: -0.5, z: -1.8 };

// ADS animation state
let adsProgress = 0; // 0 = hip, 1 = fully ADS
let isADS = false;
let targetADSPosition = { ...HIP_POSITION };
let targetFOV = 75;
let currentFOV = 75;

// Get ADS position for current weapon
function getADSPosition() {
  const weaponType = state.player.weapon?.type || 'default';
  return ADS_POSITIONS[weaponType] || ADS_POSITIONS.default;
}

// Get FOV for current scope
function getScopeFOV() {
  if (!state.player.weapon?.scope) {
    return 65; // Iron sights - slight zoom
  }

  const scope = state.player.weapon.scope;
  return scope.fov;
}

// Toggle ADS
export function toggleADS() {
  isADS = !isADS;

  if (isADS) {
    targetADSPosition = getADSPosition();
    targetFOV = getScopeFOV();

    // Show scope overlay for high magnification scopes
    const scope = state.player.weapon?.scope;
    if (scope && scope.level >= 2) {
      document.getElementById('scope-overlay').style.display = 'block';
      document.getElementById('crosshair').style.display = 'none';
    }
  } else {
    targetADSPosition = { ...HIP_POSITION };
    targetFOV = 75;

    // Hide scope overlay
    document.getElementById('scope-overlay').style.display = 'none';
    document.getElementById('crosshair').style.display = 'block';
  }
}

// Update ADS animation each frame
export function updateADS(delta) {
  if (!state.viewWeaponMesh) return;

  // Smooth ADS transition
  const adsSpeed = 8; // Speed of ADS animation
  if (isADS) {
    adsProgress = Math.min(1, adsProgress + delta * adsSpeed);
  } else {
    adsProgress = Math.max(0, adsProgress - delta * adsSpeed);
  }

  // Interpolate weapon position
  const currentPos = state.viewWeaponMesh.position;
  const targetPos = isADS ? targetADSPosition : HIP_POSITION;

  currentPos.x = THREE.MathUtils.lerp(currentPos.x, targetPos.x, delta * adsSpeed);
  currentPos.y = THREE.MathUtils.lerp(currentPos.y, targetPos.y, delta * adsSpeed);
  currentPos.z = THREE.MathUtils.lerp(currentPos.z, targetPos.z, delta * adsSpeed);

  // Smooth FOV transition
  const currentTargetFOV = isADS ? targetFOV : 75;
  state.camera.fov = THREE.MathUtils.lerp(state.camera.fov, currentTargetFOV, delta * adsSpeed);
  state.camera.updateProjectionMatrix();

  // Weapon rotation when ADS (slight tilt for realism)
  if (isADS) {
    state.viewWeaponMesh.rotation.x = THREE.MathUtils.lerp(state.viewWeaponMesh.rotation.x, 0, delta * adsSpeed);
    state.viewWeaponMesh.rotation.z = THREE.MathUtils.lerp(state.viewWeaponMesh.rotation.z, 0, delta * adsSpeed);
  }

  // Update scope overlay appearance based on magnification
  if (isADS && state.player.weapon?.scope) {
    updateScopeOverlay(state.player.weapon.scope);
  }
}

// Update scope overlay appearance
function updateScopeOverlay(scope) {
  const overlay = document.getElementById('scope-overlay');
  if (!overlay) return;

  const vignette = overlay.querySelector('.scope-vignette');
  if (!vignette) return;

  // Adjust vignette size based on scope level
  const vignetteSize = 60 - scope.level * 8;
  vignette.style.background = `radial-gradient(circle at 50% 50%, transparent ${vignetteSize}%, rgba(0,0,0,0.9) ${vignetteSize + 3}%)`;
}

// Check if currently in ADS
export function isADSActive() {
  return isADS;
}

// Get current ADS progress (0-1)
export function getADSProgress() {
  return adsProgress;
}
