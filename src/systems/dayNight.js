// Day/Night cycle system with sun/moon movement and sky color transitions

import * as THREE from 'three';
import { state } from '../state.js';

const DAY_CYCLE_DURATION = 600; // seconds for one full day/night cycle

// Pre-allocated color objects to avoid GC
const _dayColor = new THREE.Color(0x87CEEB);
const _nightColor = new THREE.Color(0x0A0A1A);
const _sunsetColor = new THREE.Color(0xFF6B35);
const _sunriseColor = new THREE.Color(0xFF8C42);
const _targetColor = new THREE.Color();

// Moon mesh
let moonMesh = null;
let moonGlow = null;

export function initDayNight() {
  // Moon
  const moonGeo = new THREE.SphereGeometry(80, 16, 16);
  const moonMat = new THREE.MeshBasicMaterial({ color: 0xE8E8D0 });
  moonMesh = new THREE.Mesh(moonGeo, moonMat);
  moonMesh.visible = false;
  state.scene.add(moonMesh);

  // Moon glow
  const glowGeo = new THREE.SphereGeometry(100, 16, 16);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xC8C8B0, transparent: true, opacity: 0.2 });
  moonGlow = new THREE.Mesh(glowGeo, glowMat);
  moonGlow.visible = false;
  state.scene.add(moonGlow);
}

/**
 * Returns 0-1 day factor (1=noon, 0=midnight)
 */
export function getDayNightFactor() {
  const t = state.dayNightTime / DAY_CYCLE_DURATION;
  const sunHeight = Math.sin(t * Math.PI * 2);
  return Math.max(0, sunHeight);
}

/**
 * Returns true if it's currently nighttime
 */
export function isNight() {
  return getDayNightFactor() < 0.15;
}

export function updateDayNight(delta) {
  state.dayNightTime = (state.dayNightTime + delta) % DAY_CYCLE_DURATION;
  const t = state.dayNightTime / DAY_CYCLE_DURATION;
  const sunAngle = t * Math.PI * 2;

  // Sun on a tilted orbit so its azimuth (Y-axis rotation) sweeps a full circle each cycle
  // while elevation rises/falls. cos drives east/west sweep, sin drives both elevation
  // (Y) and a softer north/south (Z) component — i.e. the orbit plane is tilted ~30° from
  // vertical so the sun does loop around the Y axis.
  const sunX = Math.cos(sunAngle) * 1500;
  const sunY = Math.sin(sunAngle) * 1500 * 0.866; // cos(30°)
  const sunZ = Math.sin(sunAngle) * 1500 * 0.5;   // sin(30°)
  state.dirLight.position.set(sunX, Math.max(sunY, 100), sunZ);

  // Moon (opposite side of sun)
  if (moonMesh) {
    const moonVisible = sunY < 500;
    moonMesh.visible = moonVisible;
    moonGlow.visible = moonVisible;
    if (moonVisible) {
      moonMesh.position.set(-sunX, -sunY + 400, -sunZ);
      moonGlow.position.copy(moonMesh.position);
    }
  }

  // Sky color based on time of day
  const dayFactor = getDayNightFactor();

  if (t < 0.15) {
    // Sunrise
    _targetColor.copy(_nightColor).lerp(_sunriseColor, t / 0.15);
  } else if (t < 0.25) {
    // Morning
    _targetColor.copy(_sunriseColor).lerp(_dayColor, (t - 0.15) / 0.1);
  } else if (t < 0.45) {
    // Full day
    _targetColor.copy(_dayColor);
  } else if (t < 0.55) {
    // Sunset
    _targetColor.copy(_dayColor).lerp(_sunsetColor, (t - 0.45) / 0.1);
  } else if (t < 0.65) {
    // Dusk
    _targetColor.copy(_sunsetColor).lerp(_nightColor, (t - 0.55) / 0.1);
  } else {
    // Night
    _targetColor.copy(_nightColor);
  }

  // Smooth transition
  state.scene.background.lerp(_targetColor, delta * 2);
  state.scene.fog.color.lerp(_targetColor, delta * 2);

  // Light intensity modulation
  const ambBase = 0.15 + dayFactor * 0.85;
  state.ambLight.intensity = ambBase;
  state.dirLight.intensity = dayFactor * 0.6;
}
