// Player subsystem: movement, shooting, reloading, weapon management

import * as THREE from 'three';
import { state } from '../state.js';
import { MAP_SIZE, RELOAD_DURATION } from '../config.js';
import { getTerrainHeight } from '../world/terrain.js';
import { getHousePlayerIsInside } from './house.js';
import { playImpactSound, playSound, playFootstepSound } from '../systems/audio.js';
import { spawnBlood, spawnMuzzleFlash } from '../systems/particles.js';
import { updateUI } from '../ui/hud.js';
import { createWeaponTracer } from '../systems/bullets.js';
import { showHitFromDirection } from '../ui/hitindicator.js';
import { spawnBulletHole } from '../systems/bulletholes.js';
import { inferImpactMaterial, spawnImpactEffect } from '../systems/impactEffects.js';
import { showNotice } from '../ui/notices.js';
import { calcDamage } from './damage.js';
import { botDied } from './bots.js';
import { zombieDied } from './zombies.js';
import { killAnimal, getAllAnimals } from './animals.js';
import { alienDied, getAllAliens } from './aliens.js';
import { damageGiant, isGiantAlive } from './giant.js';
import { getNearbyColliders, getNearbyDoors, getNearbyLoot } from '../systems/spatial.js';
import { checkSweptColliderCollision } from '../systems/collision.js';
import { registerCombatHit } from '../systems/combatFeedback.js';
import { fireSpecialWeapon } from '../systems/specialWeapons.js';

// Crosshair spread state
let crosshairSpread = 0;
const CROSSHAIR_SPREAD_DECAY = 3; // Slower recovery
const CROSSHAIR_SPREAD_PER_SHOT = 2.0; // More spread per shot
const CROSSHAIR_MAX_SPREAD = 5;
const PLAYER_EYE_HEIGHT = 10;
const PLAYER_COLLIDER_HEIGHT = 10;
const PLAYER_HALF_HEIGHT = PLAYER_COLLIDER_HEIGHT * 0.5;
const _playerBox = new THREE.Box3();
const _playerBoxSizePara = new THREE.Vector3(1, PLAYER_COLLIDER_HEIGHT, 1);
const _playerBoxSize = new THREE.Vector3(3, PLAYER_COLLIDER_HEIGHT, 3);
const _playerCollisionCenter = new THREE.Vector3();
const PLAYER_COLLIDER_RADIUS = 1.5;
let footstepTimer = 0;

export function updateCrosshairSpread(delta) {
  // Recover spread over time
  crosshairSpread = Math.max(0, crosshairSpread - CROSSHAIR_SPREAD_DECAY * delta);

  // Update crosshair visual
  const crosshair = document.getElementById('crosshair');
  if (!crosshair) return;

  // Calculate spread level (0-5)
  const spreadLevel = Math.min(5, Math.floor(crosshairSpread));

  // Update crosshair size directly via style
  const baseSize = 40;
  const sizeIncrease = spreadLevel * 12;
  const newSize = baseSize + sizeIncrease;
  crosshair.style.width = `${newSize}px`;
  crosshair.style.height = `${newSize}px`;

  // Add hit marker if recently hit
  if (state.player.lastHitTime && Date.now() - state.player.lastHitTime < 100) {
    crosshair.style.filter = 'hue-rotate(0deg) brightness(1.5)';
  } else {
    crosshair.style.filter = 'none';
  }
}

function addCrosshairSpread() {
  crosshairSpread = Math.min(CROSSHAIR_MAX_SPREAD, crosshairSpread + CROSSHAIR_SPREAD_PER_SHOT);
}

export function reloadWeapon() {
  if (state.player.isReloading || !state.player.weapon) return;

  const needed = state.player.weapon.maxAmmo - state.player.weapon.ammo;
  const available = state.player.sharedAmmo;

  if (needed <= 0) {
    showNotice("弹匣已满!", "#2ecc71");
    return;
  }
  if (available <= 0) {
    showNotice("没有备用子弹!", "#e74c3c");
    return;
  }

  state.player.isReloading = true;
  state.reloadStartTime = Date.now();
  playSound('reload');
  document.getElementById('reload-bar-bg').style.display = 'block';
  document.getElementById('reload-bar').style.width = '0%';

  state.reloadTimeout = setTimeout(() => {
    const finalNeeded = state.player.weapon.maxAmmo - state.player.weapon.ammo;
    const toReload = Math.min(finalNeeded, state.player.sharedAmmo);
    state.player.weapon.ammo += toReload;
    state.player.sharedAmmo -= toReload;
    state.player.isReloading = false;
    document.getElementById('reload-bar-bg').style.display = 'none';
    if (state.viewWeaponMesh) {
      state.viewWeaponMesh.position.set(0.5, -0.5, -1.8);
      state.viewWeaponMesh.rotation.set(0, 0, 0);
    }
    updateUI();
    showNotice(`换弹完成! +${toReload}`, "#2ecc71");
  }, RELOAD_DURATION);
}

export function cancelReload() {
  if (state.reloadTimeout) {
    clearTimeout(state.reloadTimeout);
    state.reloadTimeout = null;
  }
  state.player.isReloading = false;
  document.getElementById('reload-bar-bg').style.display = 'none';
  if (state.viewWeaponMesh) {
    state.viewWeaponMesh.position.set(0.5, -0.5, -1.8);
    state.viewWeaponMesh.rotation.set(0, 0, 0);
  }
}

export function switchWeapon(index) {
  if (state.player.inventory[index] && state.player.currentWeaponIndex !== index) {
    cancelReload();
    state.player.currentWeaponIndex = index;
    state.player.weapon = state.player.inventory[index];
    state.player.isADS = false;
    state.player.recoilY = 0;
    document.getElementById('scope-overlay').style.display = 'none';
    state.camera.fov = 75;
    state.camera.updateProjectionMatrix();
    if (state.viewWeaponMesh) {
      state.viewWeaponMesh.position.set(0.5, -0.5, -1.8);
      state.viewWeaponMesh.rotation.set(0, 0, 0);
    }
    updateWeaponModel();
    updateUI();
    showNotice("切换武器: " + state.player.weapon.name, "#f1c40f");
  }
}

export function equipWeapon(index) {
  cancelReload();
  state.player.currentWeaponIndex = index;
  state.player.weapon = state.player.inventory[index];
  state.player.isADS = false;
  state.player.recoilY = 0;
  document.getElementById('scope-overlay').style.display = 'none';
  state.camera.fov = 75;
  state.camera.updateProjectionMatrix();
  if (state.viewWeaponMesh) {
    state.viewWeaponMesh.position.set(0.5, -0.5, -1.8);
    state.viewWeaponMesh.rotation.set(0, 0, 0);
  }
  updateWeaponModel();
  updateUI();
}

export function updateWeaponModel() {
  if (!state.viewWeaponMesh) return;

  // Preserve muzzle flash and light
  const muzzleFlash = state.muzzleFlash;
  const muzzleLight = state.muzzleLight;

  // Remove all children except muzzle flash
  const childrenToRemove = [];
  state.viewWeaponMesh.children.forEach(child => {
    if (child !== muzzleFlash && child !== muzzleLight) {
      childrenToRemove.push(child);
    }
  });
  childrenToRemove.forEach(child => state.viewWeaponMesh.remove(child));

  const wName = state.player.weapon.name;
  const wColor = state.player.weapon.color;

  // 100-STAR PRECISION MATERIALS
  const metalMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x6b3a1f });
  const bodyMat = new THREE.MeshLambertMaterial({ color: wColor });
  const gripMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const chromeMat = new THREE.MeshLambertMaterial({ color: 0x999999 });
  const rubberMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
  const polymerMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const springMat = new THREE.MeshLambertMaterial({ color: 0x777777 });

  // Maximum segment count for ultra-smooth curves
  const SEG = 32;
  const SEG2 = 48;

  // LatheGeometry profiles for organic weapon shapes
  const barrelProfile = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const r = 0.03 + Math.sin(t * Math.PI) * 0.01; // Slight bulge
    barrelProfile.push(new THREE.Vector2(r, t * 0.8));
  }

  const gripProfile = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    let r;
    if (t < 0.3) r = 0.06 + t * 0.1; // Bottom wider
    else if (t < 0.7) r = 0.09; // Palm area
    else r = 0.09 - (t - 0.7) * 0.2; // Top narrow
    gripProfile.push(new THREE.Vector2(Math.max(0.03, r), t * 0.25));
  }

  if (wName === 'M1911' || wName === 'P92' || wName === 'Desert Eagle') {
    // ========== 100-STAR PISTOL ==========
    // Slide - main body with serrations
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.55), metalMat);
    slide.position.set(0, 0.06, 0);
    // Slide serrations (front)
    for (let i = 0; i < 5; i++) {
      const serration = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.01, 0.02), darkMat);
      serration.position.set(0, 0.06, -0.2 + i * 0.04);
      state.viewWeaponMesh.add(serration);
    }
    // Slide serrations (rear)
    for (let i = 0; i < 5; i++) {
      const serration = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.01, 0.02), darkMat);
      serration.position.set(0, 0.06, 0.15 + i * 0.04);
      state.viewWeaponMesh.add(serration);
    }
    // Barrel - smooth LatheGeometry
    const barrel = new THREE.Mesh(new THREE.LatheGeometry(barrelProfile, SEG), darkMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.09, -0.35);
    // Barrel bushing
    const bushing = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.06, SEG), chromeMat);
    bushing.rotation.x = Math.PI / 2;
    bushing.position.set(0, 0.09, -0.6);
    // Barrel link
    const barrelLink = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.04), metalMat);
    barrelLink.position.set(0, 0.02, -0.2);
    // Frame - lower receiver
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.1, 0.45), bodyMat);
    frame.position.set(0, -0.02, 0.05);
    // Frame rails (left/right)
    const railL = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.02, 0.45), metalMat);
    railL.position.set(-0.04, 0.04, 0.05);
    const railR = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.02, 0.45), metalMat);
    railR.position.set(0.04, 0.04, 0.05);
    // Grip - organic shape
    const grip = new THREE.Mesh(new THREE.LatheGeometry(gripProfile, SEG), gripMat);
    grip.position.set(0, -0.15, 0.18);
    grip.rotation.x = -0.3;
    // Grip texture (checkering pattern)
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 3; col++) {
        const check = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, 0.01), darkMat);
        check.position.set(-0.025 + col * 0.025, -0.08 - row * 0.03, 0.25);
        check.rotation.x = -0.3;
        state.viewWeaponMesh.add(check);
      }
    }
    // Grip base
    const gripBase = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.03, 0.12), metalMat);
    gripBase.position.set(0, -0.28, 0.18);
    // Trigger guard
    const triggerGuard = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 12, SEG, Math.PI), metalMat);
    triggerGuard.position.set(0, -0.06, 0.05);
    triggerGuard.rotation.x = Math.PI;
    // Trigger
    const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.08, 0.01), metalMat);
    trigger.position.set(0, -0.04, 0.06);
    trigger.rotation.x = 0.15;
    // Trigger pin
    const triggerPin = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.08, 8), chromeMat);
    triggerPin.position.set(0, -0.02, 0.06);
    triggerPin.rotation.z = Math.PI / 2;
    // Hammer
    const hammer = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.03), metalMat);
    hammer.position.set(0, 0.12, 0.28);
    hammer.rotation.x = -0.4;
    // Hammer spur
    const hammerSpur = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.02), chromeMat);
    hammerSpur.position.set(0, 0.16, 0.3);
    // Sights
    const sightRear = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.025), darkMat);
    sightRear.position.set(0, 0.13, 0.2);
    // Sight notch
    const sightNotch = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.01), darkMat);
    sightNotch.position.set(0, 0.14, 0.2);
    const sightFront = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.05, 0.02), darkMat);
    sightFront.position.set(0, 0.13, -0.25);
    // Front sight dot
    const sightDot = new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    sightDot.position.set(0, 0.15, -0.25);
    // Ejection port
    const ejectionPort = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.025, 0.12), darkMat);
    ejectionPort.position.set(0.04, 0.11, -0.05);
    // Ejection port cover
    const ejectionCover = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.01, 0.1), metalMat);
    ejectionCover.position.set(0.04, 0.12, -0.05);
    // Magazine release
    const magRelease = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.02, 8), metalMat);
    magRelease.position.set(0.04, -0.02, 0.15);
    magRelease.rotation.z = Math.PI / 2;
    // Magazine
    const magazine = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.18, 0.08), metalMat);
    magazine.position.set(0, -0.2, 0.1);
    // Magazine base pad
    const magPad = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.02, 0.09), rubberMat);
    magPad.position.set(0, -0.3, 0.1);
    // Disassembly lever
    const disassemblyLever = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.06), metalMat);
    disassemblyLever.position.set(-0.04, 0.02, -0.15);
    // Slide stop
    const slideStop = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.08), metalMat);
    slideStop.position.set(-0.04, 0.04, 0.1);
    // Safety switch
    const safety = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.04), metalMat);
    safety.position.set(-0.04, 0.08, 0.2);

    state.viewWeaponMesh.add(
      slide, barrel, bushing, barrelLink, frame, railL, railR,
      grip, gripBase, triggerGuard, trigger, triggerPin,
      hammer, hammerSpur, sightRear, sightNotch, sightFront, sightDot,
      ejectionPort, ejectionCover, magRelease, magazine, magPad,
      disassemblyLever, slideStop, safety
    );

  } else if (wName === 'S686' || wName === 'S1897' || wName === 'S12K' || wName === 'DBS' || (state.player.weapon.special && state.player.weapon.type === 'shotgun')) {
    // ========== 100-STAR SHOTGUN ==========
    // Double barrels
    const barrel1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.3, SEG), metalMat);
    barrel1.rotation.x = Math.PI / 2;
    barrel1.position.set(-0.035, 0.05, -0.65);
    const barrel2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.3, SEG), metalMat);
    barrel2.rotation.x = Math.PI / 2;
    barrel2.position.set(0.035, 0.05, -0.65);
    // Muzzle chokes
    const choke1 = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.12, SEG), chromeMat);
    choke1.rotation.x = Math.PI / 2;
    choke1.position.set(-0.035, 0.05, -1.35);
    const choke2 = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.12, SEG), chromeMat);
    choke2.rotation.x = Math.PI / 2;
    choke2.position.set(0.035, 0.05, -1.35);
    // Barrel rib (ventilated)
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.015, 1.0), metalMat);
    rib.position.set(0, 0.08, -0.5);
    // Rib holes (ventilation)
    for (let i = 0; i < 8; i++) {
      const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.02, 6), darkMat);
      hole.position.set(0, 0.08, -0.8 + i * 0.12);
      hole.rotation.x = Math.PI / 2;
      state.viewWeaponMesh.add(hole);
    }
    // Receiver
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.45), bodyMat);
    receiver.position.set(0, 0, 0.1);
    // Receiver engravings
    const engraving = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.08, 0.3), darkMat);
    engraving.position.set(0, 0, 0.1);
    // Stock - wood with cheek rest
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.16, 0.55), woodMat);
    stock.position.set(0, -0.03, 0.55);
    const cheekRest = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.06, 0.25), woodMat);
    cheekRest.position.set(0, 0.04, 0.5);
    // Stock butt plate
    const buttPlate = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.04), rubberMat);
    buttPlate.position.set(0, -0.03, 0.85);
    // Grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.2, 0.09), woodMat);
    grip.position.set(0, -0.13, 0.28);
    grip.rotation.x = -0.2;
    // Grip cap
    const gripCap = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.1), metalMat);
    gripCap.position.set(0, -0.24, 0.28);
    // Forend
    const foreend = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.35, SEG), woodMat);
    foreend.rotation.x = Math.PI / 2;
    foreend.position.set(0, 0.02, -0.3);
    // Forend grip texture
    for (let i = 0; i < 6; i++) {
      const groove = new THREE.Mesh(new THREE.TorusGeometry(0.066, 0.008, 6, SEG), darkMat);
      groove.position.set(0, 0.02, -0.4 + i * 0.06);
      groove.rotation.x = Math.PI / 2;
      state.viewWeaponMesh.add(groove);
    }
    // Trigger guard
    const triggerGuard = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 12, SEG, Math.PI), metalMat);
    triggerGuard.position.set(0, -0.07, 0.12);
    triggerGuard.rotation.x = Math.PI;
    // Trigger
    const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.08, 0.012), metalMat);
    trigger.position.set(0, -0.04, 0.12);
    trigger.rotation.x = 0.15;
    // Hammer
    const hammer = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.03), metalMat);
    hammer.position.set(0, 0.08, 0.3);
    // Shell ejector
    const ejector = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.1), chromeMat);
    ejector.position.set(0.07, 0.06, 0.1);
    // Shell latch
    const latch = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.06), metalMat);
    latch.position.set(-0.07, 0.02, 0.15);

    state.viewWeaponMesh.add(
      barrel1, barrel2, choke1, choke2, rib, receiver, engraving,
      stock, cheekRest, buttPlate, grip, gripCap, foreend,
      triggerGuard, trigger, hammer, ejector, latch
    );

  } else if (wName === 'Kar98k' || wName === 'M24' || wName === 'AWM' || (state.player.weapon.special && state.player.weapon.type === 'sniper')) {
    // ========== 100-STAR SNIPER RIFLE ==========
    // Long barrel with fluting
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 1.6, SEG), metalMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.06, -0.85);
    // Barrel fluting (3 grooves)
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const flute = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 1.2), darkMat);
      flute.position.set(
        Math.cos(angle) * 0.04,
        0.06 + Math.sin(angle) * 0.04,
        -0.5
      );
      flute.rotation.z = angle;
      state.viewWeaponMesh.add(flute);
    }
    // Muzzle brake with ports
    const muzzleBrake = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.18, SEG), chromeMat);
    muzzleBrake.rotation.x = Math.PI / 2;
    muzzleBrake.position.set(0, 0.06, -1.7);
    // Muzzle brake ports
    for (let i = 0; i < 4; i++) {
      const port = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.04), darkMat);
      port.position.set(0, 0.06 + (i - 1.5) * 0.025, -1.7);
      state.viewWeaponMesh.add(port);
    }
    // Receiver - detailed
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.65), bodyMat);
    receiver.position.set(0, 0, 0.1);
    // Receiver rail
    const receiverRail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.015, 0.6), metalMat);
    receiverRail.position.set(0, 0.07, 0.1);
    // Ejection port
    const ejectionPort = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 0.2), darkMat);
    ejectionPort.position.set(0.05, 0.05, 0.05);
    // Bolt handle
    const boltHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, SEG), chromeMat);
    boltHandle.position.set(0.1, 0.06, 0.15);
    boltHandle.rotation.z = Math.PI / 2;
    // Bolt knob
    const boltKnob = new THREE.Mesh(new THREE.SphereGeometry(0.035, SEG / 2, SEG / 2), chromeMat);
    boltKnob.position.set(0.15, 0.06, 0.15);
    // Bolt shroud
    const boltShroud = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, SEG), metalMat);
    boltShroud.rotation.x = Math.PI / 2;
    boltShroud.position.set(0, 0.06, 0.2);
    // Stock - wood with cheek rest
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.75), woodMat);
    stock.position.set(0, -0.02, 0.65);
    // Cheek rest
    const cheekRest = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.3), woodMat);
    cheekRest.position.set(0, 0.05, 0.55);
    // Stock butt plate
    const buttPlate = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.04), rubberMat);
    buttPlate.position.set(0, -0.02, 1.05);
    // Stock sling swivel
    const slingSwivel = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.01, 8, 12), metalMat);
    slingSwivel.position.set(0, -0.05, 0.9);
    // Grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.18, 0.07), woodMat);
    grip.position.set(0, -0.12, 0.35);
    grip.rotation.x = -0.25;
    // Trigger guard
    const triggerGuard = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 12, SEG, Math.PI), metalMat);
    triggerGuard.position.set(0, -0.07, 0.15);
    triggerGuard.rotation.x = Math.PI;
    // Trigger
    const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.07, 0.01), metalMat);
    trigger.position.set(0, -0.04, 0.15);
    trigger.rotation.x = 0.15;
    // Scope - ultra detailed
    const scopeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.55, SEG), darkMat);
    scopeBody.rotation.x = Math.PI / 2;
    scopeBody.position.set(0, 0.15, 0);
    // Scope objective lens
    const scopeFront = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.12, SEG), chromeMat);
    scopeFront.rotation.x = Math.PI / 2;
    scopeFront.position.set(0, 0.15, -0.35);
    // Scope eyepiece
    const scopeRear = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.1, SEG), chromeMat);
    scopeRear.rotation.x = Math.PI / 2;
    scopeRear.position.set(0, 0.15, 0.35);
    // Scope lenses (glowing)
    const lensMat = new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.4 });
    const lensFront = new THREE.Mesh(new THREE.CircleGeometry(0.044, SEG), lensMat);
    lensFront.position.set(0, 0.15, -0.42);
    const lensRear = new THREE.Mesh(new THREE.CircleGeometry(0.044, SEG), lensMat);
    lensRear.position.set(0, 0.15, 0.42);
    lensRear.rotation.y = Math.PI;
    // Scope turrets (windage/elevation)
    const turretTop = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.06, SEG), chromeMat);
    turretTop.position.set(0, 0.2, 0);
    const turretSide = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.06, SEG), chromeMat);
    turretSide.position.set(0.05, 0.15, 0);
    turretSide.rotation.z = Math.PI / 2;
    // Scope mount rings
    const mountRing1 = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.015, 8, SEG), metalMat);
    mountRing1.position.set(0, 0.12, -0.15);
    mountRing1.rotation.x = Math.PI / 2;
    const mountRing2 = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.015, 8, SEG), metalMat);
    mountRing2.position.set(0, 0.12, 0.15);
    mountRing2.rotation.x = Math.PI / 2;
    // Scope mount base
    const mountBase1 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.1), metalMat);
    mountBase1.position.set(0, 0.08, -0.15);
    const mountBase2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.1), metalMat);
    mountBase2.position.set(0, 0.08, 0.15);
    // Bipod
    const bipodLegL = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.35, 8), metalMat);
    bipodLegL.position.set(-0.12, -0.08, -0.45);
    bipodLegL.rotation.z = 0.4;
    const bipodLegR = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.35, 8), metalMat);
    bipodLegR.position.set(0.12, -0.08, -0.45);
    bipodLegR.rotation.z = -0.4;
    const bipodFootL = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), rubberMat);
    bipodFootL.position.set(-0.25, -0.25, -0.45);
    const bipodFootR = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), rubberMat);
    bipodFootR.position.set(0.25, -0.25, -0.45);

    state.viewWeaponMesh.add(
      barrel, muzzleBrake, receiver, receiverRail, ejectionPort,
      boltHandle, boltKnob, boltShroud, stock, cheekRest, buttPlate,
      slingSwivel, grip, triggerGuard, trigger,
      scopeBody, scopeFront, scopeRear, lensFront, lensRear,
      turretTop, turretSide, mountRing1, mountRing2, mountBase1, mountBase2,
      bipodLegL, bipodLegR, bipodFootL, bipodFootR
    );

  } else if (wName === 'UZI' || wName === 'Vector' || wName === 'MP5K' || (state.player.weapon.special && state.player.weapon.type === 'smg')) {
    // ========== 100-STAR SMG ==========
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.65), metalMat);
    body.position.set(0, 0.03, 0);
    // Barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.45, SEG), darkMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.06, -0.5);
    // Suppressor
    const suppressor = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.35, SEG), darkMat);
    suppressor.rotation.x = Math.PI / 2;
    suppressor.position.set(0, 0.06, -0.85);
    // Suppressor baffles
    for (let i = 0; i < 4; i++) {
      const baffle = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.01, 8, SEG), darkMat);
      baffle.position.set(0, 0.06, -0.72 + i * 0.08);
      baffle.rotation.x = Math.PI / 2;
      state.viewWeaponMesh.add(baffle);
    }
    // Magazine
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.28, 0.04), darkMat);
    mag.position.set(0, -0.14, -0.05);
    // Magazine base
    const magBase = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 0.05), metalMat);
    magBase.position.set(0, -0.29, -0.05);
    // Grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.17, 0.065), gripMat);
    grip.position.set(0, -0.1, 0.22);
    grip.rotation.x = -0.2;
    // Grip texture
    for (let i = 0; i < 4; i++) {
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.01, 0.01), darkMat);
      ridge.position.set(0, -0.04 - i * 0.035, 0.26);
      ridge.rotation.x = -0.2;
      state.viewWeaponMesh.add(ridge);
    }
    // Folding stock
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.09, 0.35), metalMat);
    stock.position.set(0, 0.02, 0.45);
    const stockEnd = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.04), metalMat);
    stockEnd.position.set(0, 0.02, 0.65);
    // Charging handle
    const chargingHandle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.035, 0.035), chromeMat);
    chargingHandle.position.set(0, 0.09, 0.12);
    // Cocking handle slot
    const cockingSlot = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, 0.02), darkMat);
    cockingSlot.position.set(0, 0.09, 0.12);
    // Sight
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.025), darkMat);
    sight.position.set(0, 0.11, -0.25);
    // Front sight post
    const sightPost = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.04, 8), chromeMat);
    sightPost.position.set(0, 0.13, -0.25);
    // Magazine release
    const magRelease = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.04), metalMat);
    magRelease.position.set(-0.05, 0, 0.1);
    // Selector switch
    const selector = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 0.06), metalMat);
    selector.position.set(-0.05, 0.05, 0.2);

    state.viewWeaponMesh.add(
      body, barrel, suppressor, mag, magBase, grip,
      stock, stockEnd, chargingHandle, cockingSlot,
      sight, sightPost, magRelease, selector
    );

  } else if (state.player.weapon.type === 'melee') {
    // ========== MELEE WEAPONS ==========
    if (wName === 'Pan') {
      // Frying pan - disc with handle
      const panMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
      // Pan body (flat disc)
      const panBody = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.04, SEG), panMat);
      panBody.rotation.x = Math.PI / 2;
      panBody.position.set(0, 0.02, -0.45);
      // Pan rim
      const panRim = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.018, 8, SEG), panMat);
      panRim.position.set(0, 0.02, -0.45);
      // Pan bottom (slightly domed)
      const panBottom = new THREE.Mesh(new THREE.SphereGeometry(0.2, SEG, 16, 0, Math.PI * 2, 0, Math.PI * 0.15), panMat);
      panBottom.rotation.x = Math.PI;
      panBottom.position.set(0, 0.02, -0.43);
      // Handle
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.32, SEG), woodMat);
      handle.rotation.x = Math.PI / 2;
      handle.position.set(0, -0.02, -0.05);
      // Handle end knob
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, SEG, SEG), woodMat);
      knob.position.set(0, -0.02, 0.1);
      state.viewWeaponMesh.add(panBody, panRim, panBottom, handle, knob);
    } else if (wName === '咸鱼') {
      // Dead fish weapon
      const fishMat = new THREE.MeshLambertMaterial({ color: 0x7fb3d8 });
      const fishDark = new THREE.MeshLambertMaterial({ color: 0x4a7a9b });
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const pupilMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
      // Fish body (elongated ellipsoid)
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), fishMat);
      body.scale.set(0.7, 0.6, 2.2);
      body.position.set(0, 0.02, -0.35);
      // Fish tail
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 4), fishDark);
      tail.rotation.x = Math.PI / 2;
      tail.position.set(0, 0.02, 0.0);
      tail.scale.set(1, 0.3, 1);
      // Fish head
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), fishMat);
      head.scale.set(0.9, 0.8, 1);
      head.position.set(0, 0.02, -0.65);
      // Eyes (dead, X-shaped pupils)
      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), eyeMat);
      eyeL.position.set(-0.06, 0.06, -0.68);
      const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), eyeMat);
      eyeR.position.set(0.06, 0.06, -0.68);
      const pupilL = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), pupilMat);
      pupilL.position.set(-0.06, 0.06, -0.71);
      const pupilR = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), pupilMat);
      pupilR.position.set(0.06, 0.06, -0.71);
      // Fins
      const finL = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.08, 0.15), fishDark);
      finL.position.set(-0.09, 0.02, -0.3);
      finL.rotation.z = 0.4;
      const finR = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.08, 0.15), fishDark);
      finR.position.set(0.09, 0.02, -0.3);
      finR.rotation.z = -0.4;
      // Mouth (open, gasping)
      const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), new THREE.MeshLambertMaterial({ color: 0xcc5555 }));
      mouth.scale.set(1, 0.5, 1);
      mouth.position.set(0, -0.01, -0.72);
      state.viewWeaponMesh.add(body, tail, head, eyeL, eyeR, pupilL, pupilR, finL, finR, mouth);
    } else {
      // Machete / generic melee blade
      const bladeMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
      // Blade
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, 0.55), bladeMat);
      blade.position.set(0, 0.04, -0.4);
      // Blade edge (wider bottom)
      const bladeEdge = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.13, 0.15), bladeMat);
      bladeEdge.position.set(0, 0.04, -0.6);
      // Blade tip
      const bladeTip = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.08, 0.06), bladeMat);
      bladeTip.position.set(0, 0.02, -0.7);
      bladeTip.rotation.x = 0.3;
      // Guard
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.025, 0.06), metalMat);
      guard.position.set(0, -0.01, -0.1);
      // Handle
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.22, SEG), woodMat);
      handle.rotation.x = Math.PI / 2;
      handle.position.set(0, -0.02, 0.05);
      // Pommel
      const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.03, SEG, SEG), metalMat);
      pommel.position.set(0, -0.02, 0.16);
      state.viewWeaponMesh.add(blade, bladeEdge, bladeTip, guard, handle, pommel);
    }

  } else {
    // ========== 100-STAR ASSAULT RIFLE ==========
    // Upper receiver
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.85), bodyMat);
    upper.position.set(0, 0.04, 0);
    // Lower receiver
    const lower = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.65), bodyMat);
    lower.position.set(0, -0.02, 0.1);
    // Barrel with gas block
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.75, SEG), darkMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.07, -0.75);
    // Gas block
    const gasBlock = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.08), metalMat);
    gasBlock.position.set(0, 0.07, -0.4);
    // Gas tube
    const gasTube = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.4, 8), metalMat);
    gasTube.rotation.x = Math.PI / 2;
    gasTube.position.set(0, 0.09, -0.2);
    // Flash hider
    const flashHider = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.028, 0.12, SEG), chromeMat);
    flashHider.rotation.x = Math.PI / 2;
    flashHider.position.set(0, 0.07, -1.18);
    // Handguard with rail system
    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.35), polymerMat);
    handguard.position.set(0, 0.02, -0.38);
    // Top rail
    const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.018, 0.55), metalMat);
    topRail.position.set(0, 0.095, -0.15);
    // Rail segments (Picatinny)
    for (let i = 0; i < 12; i++) {
      const railSeg = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.01, 0.02), darkMat);
      railSeg.position.set(0, 0.095, -0.4 + i * 0.04);
      state.viewWeaponMesh.add(railSeg);
    }
    // Bottom rail
    const bottomRail = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.018, 0.35), metalMat);
    bottomRail.position.set(0, -0.03, -0.38);
    // Side rails
    const sideRailL = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.065, 0.35), metalMat);
    sideRailL.position.set(-0.05, 0.02, -0.38);
    const sideRailR = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.065, 0.35), metalMat);
    sideRailR.position.set(0.05, 0.02, -0.38);
    // Magazine
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.22, 0.09), darkMat);
    mag.position.set(0, -0.15, -0.05);
    if (wName === 'AKM') mag.rotation.x = 0.18;
    // Magazine base
    const magBase = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.025, 0.1), metalMat);
    magBase.position.set(0, -0.27, -0.05);
    // Grip - ergonomic
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.17, 0.055), gripMat);
    grip.position.set(0, -0.13, 0.28);
    grip.rotation.x = -0.25;
    // Grip texture
    for (let i = 0; i < 5; i++) {
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.01, 0.01), darkMat);
      ridge.position.set(0, -0.06 - i * 0.03, 0.32);
      ridge.rotation.x = -0.25;
      state.viewWeaponMesh.add(ridge);
    }
    // Stock
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.11, 0.55), bodyMat);
    stock.position.set(0, 0, 0.65);
    // Stock buffer tube
    const bufferTube = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, SEG), metalMat);
    bufferTube.rotation.x = Math.PI / 2;
    bufferTube.position.set(0, 0.02, 0.4);
    // Stock butt pad
    const buttPad = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.13, 0.04), rubberMat);
    buttPad.position.set(0, 0, 0.95);
    // Sights
    const sightRear = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.07, 0.025), darkMat);
    sightRear.position.set(0, 0.1, 0.3);
    // Rear sight aperture
    const rearAperture = new THREE.Mesh(new THREE.TorusGeometry(0.015, 0.005, 8, 12), chromeMat);
    rearAperture.position.set(0, 0.12, 0.3);
    const sightFront = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.07, 0.02), darkMat);
    sightFront.position.set(0, 0.1, -0.65);
    // Front sight post
    const frontPost = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 8), chromeMat);
    frontPost.position.set(0, 0.13, -0.65);
    // Ejection port
    const ejectionPort = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.025, 0.14), darkMat);
    ejectionPort.position.set(0.04, 0.08, 0.05);
    // Ejection port dust cover
    const dustCover = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.12), metalMat);
    dustCover.position.set(0.04, 0.09, 0.05);
    // Charging handle
    const chargingHandle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.035, 0.035), chromeMat);
    chargingHandle.position.set(0, 0.085, 0.4);
    // Bolt release
    const boltRelease = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.035, 0.025), metalMat);
    boltRelease.position.set(-0.04, 0, 0.18);
    // Magazine release
    const magRelease = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.04), metalMat);
    magRelease.position.set(-0.04, -0.02, 0.15);
    // Selector switch
    const selector = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.04, 0.08), metalMat);
    selector.position.set(-0.04, 0.04, 0.25);
    // Trigger guard
    const triggerGuard = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 12, SEG, Math.PI), metalMat);
    triggerGuard.position.set(0, -0.07, 0.12);
    triggerGuard.rotation.x = Math.PI;
    // Trigger
    const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.07, 0.01), metalMat);
    trigger.position.set(0, -0.04, 0.12);
    trigger.rotation.x = 0.15;

    state.viewWeaponMesh.add(
      upper, lower, barrel, gasBlock, gasTube, flashHider,
      handguard, topRail, bottomRail, sideRailL, sideRailR,
      mag, magBase, grip, stock, bufferTube, buttPad,
      sightRear, rearAperture, sightFront, frontPost,
      ejectionPort, dustCover, chargingHandle,
      boltRelease, magRelease, selector, triggerGuard, trigger
    );
  }

  if (state.player.weapon.special) {
    const effectColor = state.player.weapon.effectColor || wColor;
    const glowMat = new THREE.MeshBasicMaterial({ color: effectColor, transparent: true, opacity: 0.75 });
    const coilMat = new THREE.MeshBasicMaterial({ color: effectColor, transparent: true, opacity: 0.45, wireframe: true });
    // Special weapons share the base gun silhouettes but add visible energy hardware.
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.7, 16), glowMat);
    core.rotation.x = Math.PI / 2;
    core.position.set(0, 0.14, -0.42);
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.008, 8, 24), coilMat);
    coil.rotation.x = Math.PI / 2;
    coil.position.set(0, 0.14, -0.78);
    const cell = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.28), glowMat);
    cell.position.set(0.075, 0.02, -0.05);
    state.viewWeaponMesh.add(core, coil, cell);
  }
}
export function playerHit(dmg, attackerPos = null, attackerName = null) {
  if (state.player.isParachuting) return;
  state.player.health -= dmg;
  playSound('hit');

  // Show hit direction indicator
  if (attackerPos) {
    showHitFromDirection(attackerPos, dmg);
  }

  document.getElementById('hit-overlay').style.opacity = '1';
  setTimeout(() => { document.getElementById('hit-overlay').style.opacity = '0'; }, 150);

  updateUI();
  if (state.player.health <= 0) {
    state.player.alive = false;
    state.controls.unlock();
    const deathMsg = attackerName ? `你被${attackerName}击败了，太菜了` : "游戏结束 (YOU DIED)";
    document.getElementById('title').innerText = deathMsg;
    document.getElementById('title').style.color = "#e74c3c";
    document.getElementById('subtitle').innerText = "排名: #" + state.aliveCount;
    document.getElementById('start-btn').innerText = "重新开始";
    document.getElementById('start-btn').style.display = "block";
    document.getElementById('start-btn').onclick = () => location.reload();
    document.getElementById('overlay').style.display = "flex";
  }
}

// Bullet spread amount based on weapon type and crosshair spread
function getBulletSpread() {
  const w = state.player.weapon;
  let baseSpread = 0.01;

  if (w.type === 'sniper') baseSpread = 0.002;
  else if (w.type === 'ar') baseSpread = 0.008;
  else if (w.type === 'smg') baseSpread = 0.012;
  else if (w.type === 'shotgun') baseSpread = 0.025;
  else if (w.type === 'pistol') baseSpread = 0.006;

  // Add crosshair spread factor
  const spreadMultiplier = 1 + crosshairSpread * 0.5;
  return baseSpread * spreadMultiplier;
}

// Reusable resources for bullet effects
const _barrelTip = new THREE.Vector3(0, 0.06, -1.2);
const _muzzleWorldPos = new THREE.Vector3();

// Get the world position of the gun barrel tip
function getGunBarrelPosition() {
  if (!state.viewWeaponMesh) return state.camera.position.clone();
  _muzzleWorldPos.copy(_barrelTip);
  state.viewWeaponMesh.localToWorld(_muzzleWorldPos);
  return _muzzleWorldPos;
}

function getRoofSurfaceY(hPos, x, z) {
  const dx = Math.abs(x - hPos.x);
  const dz = Math.abs(z - hPos.z);
  if (dx > 15.6 || dz > 15.6) return null;
  const baseHeight = hPos.baseHeight ?? hPos.y;
  return baseHeight + 38.1 - 14 * (Math.max(dx, dz) / 15.556);
}

function setPlayerBoxFromEye(pPos, size) {
  _playerCollisionCenter.set(pPos.x, pPos.y - PLAYER_EYE_HEIGHT + PLAYER_HALF_HEIGHT, pPos.z);
  _playerBox.setFromCenterAndSize(_playerCollisionCenter, size);
}

function resolvePlayerGroundY(pPos, nearbyDoors, nearbyColliders) {
  let groundSurfaceY = getTerrainHeight(pPos.x, pPos.z);
  const playerFootY = pPos.y - PLAYER_EYE_HEIGHT;

  for (let i = 0; i < nearbyDoors.length; i++) {
    const roofSurfaceY = getRoofSurfaceY(nearbyDoors[i].housePos, pPos.x, pPos.z);
    // Only use roof as floor if player is truly at roof level (tight threshold)
    if (roofSurfaceY !== null && roofSurfaceY > groundSurfaceY && playerFootY >= roofSurfaceY - 1.0) {
      groundSurfaceY = roofSurfaceY;
    }
  }

  setPlayerBoxFromEye(pPos, _playerBoxSize);
  for (let i = 0; i < nearbyColliders.length; i++) {
    const box = nearbyColliders[i];
    if (box.userData && box.userData.standable === false) continue;
    if (_playerBox.intersectsBox(box) && box.max.y > groundSurfaceY) {
      groundSurfaceY = box.max.y;
    }
  }

  return groundSurfaceY + PLAYER_EYE_HEIGHT;
}

function applyGroundSafety(pPos, nearbyDoors, nearbyColliders) {
  // Only snap to ground when falling or stationary, never during upward jump
  if (state.velocity.y > 1.0) return;
  const minY = resolvePlayerGroundY(pPos, nearbyDoors, nearbyColliders);
  if (pPos.y < minY) {
    pPos.y = minY;
    state.velocity.y = Math.max(0, state.velocity.y);
    state.canJump = true;
  }
}

// Cooldown for empty magazine notice
let lastEmptyNoticeTime = 0;

export function fireWeapon() {
  if (!state.player.alive || state.player.isParachuting || state.player.isReloading) return;
  let now = Date.now();
  if (now - state.player.lastFire < state.player.weapon.fireRate) return;

  // ========== MELEE ATTACK ==========
  if (state.player.weapon.type === 'melee') {
    state.player.lastFire = now;
    playSound('melee');

    // Swing animation
    if (state.viewWeaponMesh) {
      state.viewWeaponMesh.rotation.z -= 1.2;
      state.viewWeaponMesh.rotation.x += 0.4;
      state.viewWeaponMesh.position.z -= 0.1;
    }

    // Cone-based melee hit detection
    const cam = state.camera;
    const forward = cam.getWorldDirection(new THREE.Vector3());
    forward.y = 0;
    forward.normalize();
    const myPos = cam.position.clone();
    const meleeRange = 8;
    const meleeDamage = state.player.weapon.damage;
    let hitAny = false;

    // Check bots
    for (const bot of state.bots) {
      if (!bot.alive) continue;
      const dx = bot.position.x - myPos.x;
      const dz = bot.position.z - myPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > meleeRange) continue;
      const toTarget = new THREE.Vector3(dx, 0, dz).normalize();
      if (forward.dot(toTarget) > 0.4) {
        bot.health -= meleeDamage;
        if (bot.health <= 0) {
          bot.alive = false;
          bot.mesh.visible = false;
          state.player.kills++;
        }
        hitAny = true;
        break;
      }
    }

    // Check zombies
    if (!hitAny) {
      for (const zombie of state.zombies) {
        if (!zombie.alive) continue;
        const dx = zombie.mesh.position.x - myPos.x;
        const dz = zombie.mesh.position.z - myPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > meleeRange) continue;
        const toTarget = new THREE.Vector3(dx, 0, dz).normalize();
        if (forward.dot(toTarget) > 0.4) {
          zombie.health -= meleeDamage;
          if (zombie.health <= 0) {
            zombie.alive = false;
            zombie.mesh.visible = false;
            state.player.kills++;
          }
          hitAny = true;
          break;
        }
      }
    }

    // Check animals
    if (!hitAny && state._allAnimals) {
      for (const animal of state._allAnimals) {
        if (!animal.alive) continue;
        const dx = animal.mesh.position.x - myPos.x;
        const dz = animal.mesh.position.z - myPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > meleeRange) continue;
        const toTarget = new THREE.Vector3(dx, 0, dz).normalize();
        if (forward.dot(toTarget) > 0.4) {
          animal.health -= meleeDamage;
          if (animal.health <= 0) {
            animal.alive = false;
            animal.mesh.visible = false;
            state.player.kills++;
          }
          hitAny = true;
          break;
        }
      }
    }

    // Show hit feedback
    if (hitAny) {
      if (state.player.weapon.special === 'fish') {
        showNotice(`🐟 被咸鱼甩了一巴掌！(-${meleeDamage} DMG)`, "#7fb3d8");
        state.player.recoilY += 0.3;
      } else {
        showNotice(`🔪 近战命中！(-${meleeDamage} DMG)`, "#f39c12");
        state.player.recoilY += 0.15;
      }
    }

    updateUI();
    return;
  }

  // ========== RANGED WEAPONS ==========
  const ammoCost = Math.max(1, state.player.weapon.ammoCost || 1);
  if (state.player.weapon.ammo < ammoCost) {
    playSound('dry_fire');
    // Only show notice every 2 seconds to avoid spam
    if (now - lastEmptyNoticeTime > 2000) {
      showNotice(state.player.weapon.ammo <= 0 ? "弹匣为空！按 R 换弹" : `弹药不足！需要 ${ammoCost} 发`, "#e74c3c");
      lastEmptyNoticeTime = now;
    }
    // Auto-reload if has ammo (silent)
    if (state.player.sharedAmmo > 0 && !state.player.isReloading) {
      reloadWeapon();
    }
    return;
  }
  state.player.weapon.ammo -= ammoCost;
  state.player.lastFire = now;
  updateUI();
  playSound(state.player.weapon.sound, null, {
    remainingAmmo: state.player.weapon.ammo,
    maxAmmo: state.player.weapon.maxAmmo
  });

  // Add crosshair spread (CS:GO style)
  addCrosshairSpread();

  const RECOIL_AMOUNT = 0.012;
  state.player.cameraRecoil += RECOIL_AMOUNT;
  if (state.player.cameraRecoil > 0.08) state.player.cameraRecoil = 0.08;
  const _re = new THREE.Euler(0, 0, 0, 'YXZ');
  _re.setFromQuaternion(state.camera.quaternion);
  _re.x -= RECOIL_AMOUNT;
  _re.x = Math.max(_re.x, -1.5);
  _re.z = 0;
  state.camera.quaternion.setFromEuler(_re);

  state.player.recoilY += 0.3;

  // Capture the muzzle before applying the visible weapon kick so the trail starts at the fired position.
  const muzzleStart = getGunBarrelPosition().clone();
  if (!state.player.weapon.special) {
    spawnMuzzleFlash(state.player.weapon.name);
  }

  if (state.viewWeaponMesh) {
    state.viewWeaponMesh.rotation.x += 0.3;
    state.viewWeaponMesh.position.z += 0.15;
  }

  // Apply bullet spread
  const spread = getBulletSpread();
  const spreadX = (Math.random() - 0.5) * spread * 2;
  const spreadY = (Math.random() - 0.5) * spread * 2;

  state.raycaster.setFromCamera(new THREE.Vector2(spreadX, spreadY), state.camera);
  const intersects = state.raycaster.intersectObjects(state.objects);

  let coverHit = null;
  let targetHit = null;

  for (let i = 0; i < intersects.length; i++) {
    let hit = intersects[i];
    if (hit.distance > state.player.weapon.range) break;

    let ud = hit.object.userData;
    if (ud.isBot || ud.isZombie || ud.isAnimal || ud.isAlien || ud.isGiant) {
      if (!targetHit) targetHit = hit;
    } else {
      if (!coverHit) coverHit = hit;
    }
  }

  // Determine hit point for tracer
  let hitPoint = null;
  if (targetHit && (!coverHit || targetHit.distance < coverHit.distance)) {
    hitPoint = targetHit.point;
  } else if (coverHit) {
    hitPoint = coverHit.point;
  } else {
    // No hit - tracer goes to max range
    const dir = state.raycaster.ray.direction.clone();
    hitPoint = state.camera.position.clone().add(dir.multiplyScalar(state.player.weapon.range));
  }

  if (state.player.weapon.special) {
    const effectiveTargetHit = targetHit && (!coverHit || targetHit.distance < coverHit.distance) ? targetHit : null;
    fireSpecialWeapon({
      weapon: state.player.weapon,
      muzzleStart,
      hitPoint,
      targetHit: effectiveTargetHit,
      coverHit,
      intersects
    });
    return;
  }

  // Visual trajectory uses the exact muzzle position and the same impact point used by damage/decals.
  createWeaponTracer(muzzleStart, hitPoint, state.player.weapon);

  if (coverHit && (!targetHit || coverHit.distance < targetHit.distance)) {
    let n = coverHit.face ? coverHit.face.normal : new THREE.Vector3(0, 1, 0);
    const impactMaterial = inferImpactMaterial(coverHit);

    // Impact feedback shares the actual raycast entry point with bullet holes and trajectory.
    playImpactSound(impactMaterial, coverHit.point);
    spawnImpactEffect(coverHit.point, n, impactMaterial);
    if (impactMaterial !== 'water') spawnBulletHole(coverHit.point, n);
  } else if (targetHit) {
    let ud = targetHit.object.userData;
    if (ud.isBot) {
      let bot = state.bots[ud.botIndex];
      if (bot.alive) {
        let dmg = calcDamage(state.player.weapon.damage, ud.isHeadshot, bot);
        bot.health -= dmg;
        playSound('hit');
        let n = targetHit.face ? targetHit.face.normal : new THREE.Vector3(0, 1, 0);
        spawnBlood(targetHit.point, n);
        const isKill = bot.health <= 0;
        registerCombatHit({ targetType: 'bot', isHeadshot: ud.isHeadshot, isKill, point: targetHit.point, normal: n, entity: bot, damage: dmg });
        if (isKill) botDied(bot, "You");
      }
    } else if (ud.isZombie) {
      let zombie = state.zombies[ud.zombieIndex];
      if (zombie && zombie.alive) {
        let dmg = calcDamage(state.player.weapon.damage, ud.isHeadshot, zombie);
        zombie.health -= dmg;
        playSound('hit');
        let n = targetHit.face ? targetHit.face.normal : new THREE.Vector3(0, 1, 0);
        spawnBlood(targetHit.point, n);
        const isKill = zombie.health <= 0;
        registerCombatHit({ targetType: 'zombie', isHeadshot: ud.isHeadshot, isKill, point: targetHit.point, normal: n, entity: zombie, damage: dmg });
        if (isKill) zombieDied(zombie);
      }
    } else if (ud.isAnimal) {
      let animals = getAllAnimals();
      let animal = animals[ud.index];
      if (animal && animal.alive) {
        animal.health -= state.player.weapon.damage;
        playSound('hit');
        let n = targetHit.face ? targetHit.face.normal : new THREE.Vector3(0, 1, 0);
        spawnBlood(targetHit.point, n);
        const isKill = animal.health <= 0;
        registerCombatHit({ targetType: 'animal', isHeadshot: false, isKill, point: targetHit.point, normal: n, entity: animal, damage: state.player.weapon.damage });
        if (isKill) {
          killAnimal(animal, ud.animalType);
        }
      }
    } else if (ud.isAlien) {
      let aliens = getAllAliens();
      let alien = aliens[ud.alienIndex];
      if (alien && alien.alive) {
        let dmg = calcDamage(state.player.weapon.damage, ud.isHeadshot, alien);
        alien.health -= dmg;
        playSound('hit');
        let n = targetHit.face ? targetHit.face.normal : new THREE.Vector3(0, 1, 0);
        spawnBlood(targetHit.point, n);
        const isKill = alien.health <= 0;
        registerCombatHit({ targetType: 'alien', isHeadshot: ud.isHeadshot, isKill, point: targetHit.point, normal: n, entity: alien, damage: dmg });
        if (isKill) {
          alienDied(alien);
        }
      }
    } else if (ud.isGiant) {
      if (isGiantAlive()) {
        let dmg = state.player.weapon.damage;
        damageGiant(dmg, targetHit.point);
        playSound('giantHit', targetHit.point ? { x: targetHit.point.x, y: targetHit.point.y, z: targetHit.point.z } : null);
        let n = targetHit.face ? targetHit.face.normal : new THREE.Vector3(0, 1, 0);
        spawnBlood(targetHit.point, n);
      }
    }
  } // End pellet loop
}

export function updatePlayer(delta) {
  if (!state.player.alive) return;

  let pPos = state.controls.getObject().position;
  const nearbyDoors = getNearbyDoors(pPos.x, pPos.z);
  const nearbyColliders = getNearbyColliders(pPos.x, pPos.z);

  if (state.player.isParachuting) {
    let fallSpeed = state.isSprinting ? -120 : -35;
    state.velocity.y = fallSpeed;

    state.direction.z = Number(state.moveForward) - Number(state.moveBackward);
    state.direction.x = Number(state.moveLeft) - Number(state.moveRight);
    state.direction.normalize();

    let speed = 80;
    if (state.moveForward || state.moveBackward) state.velocity.z -= state.direction.z * speed * delta;
    if (state.moveLeft || state.moveRight) state.velocity.x -= state.direction.x * speed * delta;

    state.velocity.x -= state.velocity.x * 1.5 * delta;
    state.velocity.z -= state.velocity.z * 1.5 * delta;

    state.controls.moveRight(state.velocity.x * delta);
    state.controls.moveForward(-state.velocity.z * delta);
    pPos.y += state.velocity.y * delta;

    let groundY = resolvePlayerGroundY(pPos, nearbyDoors, nearbyColliders);

    if (pPos.y <= groundY) {
      pPos.y = groundY;
      state.player.isParachuting = false;
      if (state.parachuteGroup) state.parachuteGroup.visible = false;
      showNotice("已落地！快去房屋或石头附近寻找装备！", "#4caf50");
      updateUI();
    }
  } else {
    state.velocity.x -= state.velocity.x * 10.0 * delta;
    state.velocity.z -= state.velocity.z * 10.0 * delta;
    state.velocity.y -= 9.8 * 40.0 * delta;

    state.direction.z = Number(state.moveForward) - Number(state.moveBackward);
    state.direction.x = Number(state.moveLeft) - Number(state.moveRight);
    state.direction.normalize();

    let speed = state.isSprinting ? 600 : 350;
    if (state.moveForward || state.moveBackward) state.velocity.z -= state.direction.z * speed * delta;
    if (state.moveLeft || state.moveRight) state.velocity.x -= state.direction.x * speed * delta;

    let oldX = pPos.x, oldY = pPos.y, oldZ = pPos.z;

    state.velocity.x = Math.max(-300, Math.min(300, state.velocity.x));
    state.velocity.z = Math.max(-300, Math.min(300, state.velocity.z));

    // Phase 1: Horizontal X/Z movement and collision
    state.controls.moveRight(state.velocity.x * delta);
    state.controls.moveForward(-state.velocity.z * delta);

    setPlayerBoxFromEye(pPos, _playerBoxSize);
    let hitColliderXZ = checkSweptColliderCollision(
      oldX,
      oldZ,
      pPos.x,
      pPos.z,
      pPos.y,
      PLAYER_COLLIDER_HEIGHT,
      nearbyColliders,
      PLAYER_COLLIDER_RADIUS
    );
    for (let box of nearbyColliders) {
      if (_playerBox.intersectsBox(box)) {
        if (pPos.y - PLAYER_EYE_HEIGHT < box.max.y) {
          hitColliderXZ = true;
          break;
        }
      }
    }

    if (hitColliderXZ || Math.abs(pPos.x) > MAP_SIZE / 2 || Math.abs(pPos.z) > MAP_SIZE / 2) {
      pPos.x = oldX;
      pPos.z = oldZ;
    }

    // House wall collision
    for (let i = 0; i < nearbyDoors.length; i++) {
      let d = nearbyDoors[i];
      let hPos = d.housePos;
      let dx = pPos.x - hPos.x;
      let dz = pPos.z - hPos.z;
      const baseY = hPos.baseHeight ?? hPos.y;
      const footY = pPos.y - PLAYER_EYE_HEIGHT;
      const headY = pPos.y;

      if (headY > baseY && footY < baseY + 24) {
        let absX = Math.abs(dx);
        let absZ = Math.abs(dz);

        if (absX < 16.2 && absZ < 16.2) {
          let wallHit = false;

          if (dx >= -16.2 && dx <= -13.5 && dz >= -16.2 && dz <= 16.2) {
            wallHit = true;
          } else if (dx >= 13.5 && dx <= 16.2 && dz >= -16.2 && dz <= 16.2) {
            wallHit = true;
          } else if (dz >= -16.2 && dz <= -13.5 && dx >= -16.2 && dx <= 16.2) {
            wallHit = true;
          } else if (dz >= 13.5 && dz <= 16.2 && dx >= -16.2 && dx <= -3.1) {
            wallHit = true;
          } else if (dz >= 13.5 && dz <= 16.2 && dx >= 3.1 && dx <= 16.2) {
            wallHit = true;
          } else if (!d.isOpen && dz >= 13.5 && dz <= 16.2 && dx >= -3.25 && dx <= 3.25) {
            wallHit = true;
          }

          if (wallHit) {
            pPos.x = oldX;
            pPos.z = oldZ;
            break;
          }
        }
      }
    }

    // Phase 2: Vertical Y movement
    pPos.y += state.velocity.y * delta;

    let hitColliderY = false;
    let landingY = 0;

    for (let i = 0; i < nearbyDoors.length; i++) {
      let hPos = nearbyDoors[i].housePos;
      let roofSurfaceY = getRoofSurfaceY(hPos, pPos.x, pPos.z);
      if (roofSurfaceY !== null) {
        if (oldY - PLAYER_EYE_HEIGHT >= roofSurfaceY - 2.0 && (pPos.y - PLAYER_EYE_HEIGHT) <= roofSurfaceY) {
          hitColliderY = true;
          landingY = roofSurfaceY + PLAYER_EYE_HEIGHT;
          break;
        }
      }
    }

    if (!hitColliderY) {
      setPlayerBoxFromEye(pPos, _playerBoxSize);
      for (let box of nearbyColliders) {
        if (box.userData && box.userData.standable === false) continue;
        if (_playerBox.intersectsBox(box)) {
          if (oldY - PLAYER_EYE_HEIGHT >= box.max.y - 1.2) {
            hitColliderY = true;
            landingY = box.max.y + PLAYER_EYE_HEIGHT;
            break;
          }
        }
      }
    }

    if (hitColliderY) {
      pPos.y = landingY;
      state.velocity.y = 0;
      state.canJump = true;
    } else {
      let groundY = getTerrainHeight(pPos.x, pPos.z) + PLAYER_EYE_HEIGHT;
      if (pPos.y <= groundY + 0.5 && state.velocity.y <= 0) {
        state.velocity.y = 0;
        pPos.y = groundY;
        state.canJump = true;
      } else if (pPos.y > groundY + 0.5) {
        state.canJump = false;
      }
    }

    applyGroundSafety(pPos, nearbyDoors, nearbyColliders);

    // Footstep sounds
    if (state.canJump) {
      const hSpeed = Math.sqrt(state.velocity.x * state.velocity.x + state.velocity.z * state.velocity.z);
      if (hSpeed > 5) {
        footstepTimer -= delta;
        if (footstepTimer <= 0) {
          const interval = state.isSprinting ? 0.28 : 0.42;
          footstepTimer = interval;
          const insideHouse = getHousePlayerIsInside(pPos);
          const surface = insideHouse ? 'wood' : 'grass';
          playFootstepSound(surface);
        }
      } else {
        footstepTimer = 0;
      }
    }

    // Loot pickup
    let nearbyLoot = null;
    let nearbyIndex = -1;
    const nearbyLootItems = getNearbyLoot(pPos.x, pPos.z);
    for (let i = nearbyLootItems.length - 1; i >= 0; i--) {
      if (pPos.distanceToSquared(nearbyLootItems[i].mesh.position) < 225) {
        nearbyLoot = nearbyLootItems[i];
        nearbyIndex = state.lootItems.indexOf(nearbyLoot);
        break;
      }
    }

    // Door interaction
    let nearbyDoor = null;
    for (let i = 0; i < nearbyDoors.length; i++) {
      let d = nearbyDoors[i];
      let doorWorldPos = d.doorWorldPos;
      if (pPos.distanceToSquared(doorWorldPos) < 256) {
        nearbyDoor = d;
        break;
      }
    }

    const promptEl = document.getElementById('interact-prompt');
    if (nearbyLoot) {
      let itemName = nearbyLoot.data ? nearbyLoot.data.name : (nearbyLoot.type === 'health' ? '急救包' : '物资');
      promptEl.innerText = `按 F 拾取 ${itemName}`;
      promptEl.style.display = 'block';

      if (state.interactKey) {
        state.interactKey = false;
        let picked = false;
        if (nearbyLoot.type === "ammo") {
          const amount = nearbyLoot.data.amount;
          state.player.sharedAmmo += amount;
          showNotice(`拾取 ${amount} 发通用子弹`, "#27ae60");
          picked = true;
        } else if (nearbyLoot.type === "health") {
          state.player.health = Math.min(state.player.maxHealth, state.player.health + 150);
          showNotice("使用 急救包 (+150 HP)", "#e74c3c");
          picked = true;
        } else if (nearbyLoot.type === "weapon") {
          let weaponData;
          let targetSlot = null;

          if (state.player.inventory[1] === null) {
            targetSlot = 1;
          } else if (state.player.inventory[0] === null) {
            targetSlot = 0;
          } else {
            targetSlot = state.player.currentWeaponIndex;
          }

          if (targetSlot !== state.player.currentWeaponIndex) {
            let oldScope = state.player.weapon.scope;
            weaponData = { ...nearbyLoot.data, ammo: nearbyLoot.data.maxAmmo, scope: oldScope };
          } else {
            let oldWeapon = state.player.weapon;
            let newScope = oldWeapon.scope;
            weaponData = { ...nearbyLoot.data, ammo: nearbyLoot.data.maxAmmo, scope: newScope };
          }

          state.player.sharedAmmo += 60;
          state.player.inventory[targetSlot] = weaponData;
          equipWeapon(targetSlot);
          showNotice("拾取武器: " + nearbyLoot.data.name + " (按R换弹)", "#f1c40f");
          picked = true;
        } else if (nearbyLoot.type === "scope") {
          state.player.weapon.scope = nearbyLoot.data;
          showNotice(`安装 ${nearbyLoot.data.name} 到 ${state.player.weapon.name}`, "#" + nearbyLoot.data.color.toString(16));
          picked = true;
        } else if (nearbyLoot.type === "helmet") {
          if (!state.player.helmet || state.player.helmet.level < nearbyLoot.data.level) {
            state.player.helmet = nearbyLoot.data;
            showNotice("装备: " + nearbyLoot.data.name, "#" + nearbyLoot.data.color.toString(16));
            picked = true;
          } else {
            showNotice("已有更高级的头盔", "#ccc");
          }
        } else if (nearbyLoot.type === "armor") {
          if (!state.player.armor || state.player.armor.level < nearbyLoot.data.level) {
            state.player.armor = nearbyLoot.data;
            showNotice("装备: " + nearbyLoot.data.name, "#" + nearbyLoot.data.color.toString(16));
            picked = true;
          } else {
            showNotice("已有更高级的护甲", "#ccc");
          }
        }

        if (picked && nearbyIndex >= 0) {
          state.scene.remove(nearbyLoot.mesh);
          state.lootItems.splice(nearbyIndex, 1);
          updateUI();
        }
      }
    } else if (nearbyDoor) {
      promptEl.innerText = `按 F ${nearbyDoor.isOpen ? '关门' : '开门'}`;
      promptEl.style.display = 'block';

      if (state.interactKey) {
        state.interactKey = false;
        nearbyDoor.isOpen = !nearbyDoor.isOpen;
        nearbyDoor.targetAngle = nearbyDoor.isOpen ? Math.PI / 1.8 : 0;
        showNotice(nearbyDoor.isOpen ? "🚪 避难屋大门已被拉开" : "🚪 避难屋大门已被反锁紧闭", "#2ecc71");
        playSound('hit', { x: nearbyDoor.housePos.x, y: nearbyDoor.housePos.y, z: nearbyDoor.housePos.z });
      }
    } else {
      promptEl.style.display = 'none';
    }
  }
}
