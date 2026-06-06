// Particle effects: blood, shell casings, muzzle flash

import * as THREE from 'three';
import { state } from '../state.js';

// Shared materials and geometries
const bloodMat = new THREE.MeshBasicMaterial({ color: 0x8a0303 });
const bloodGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
const shellMat = new THREE.MeshBasicMaterial({ color: 0xd4af37 });
const shellGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.2, 6);

// Muzzle flash state
let muzzleFlashEndTime = 0;
const MUZZLE_FLASH_DURATION = 80; // milliseconds
const worldMuzzleFlashPool = [];
const activeWorldMuzzleFlashes = [];
const _worldFlashDir = new THREE.Vector3();
const _worldFlashTarget = new THREE.Vector3();
const _worldFlashDefaultDir = new THREE.Vector3(0, 0, 1);

export function spawnBlood(point, normal) {
  for (let i = 0; i < 12; i++) {
    const mesh = new THREE.Mesh(bloodGeo, bloodMat);
    mesh.position.copy(point);
    state.scene.add(mesh);
    const vx = normal.x * 5 + (Math.random() - 0.5) * 15;
    const vy = normal.y * 5 + Math.random() * 15 + 5;
    const vz = normal.z * 5 + (Math.random() - 0.5) * 15;
    state.bloodParticles.push({ mesh, vx, vy, vz, age: 0 });
  }
}

export function spawnMuzzleFlash(weaponName) {
  // Create muzzle flash if it doesn't exist
  if (!state.muzzleFlash) {
    state.muzzleFlash = new THREE.Group();

    // Core light sphere
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), coreMat);
    state.muzzleFlash.add(core);

    // Star spikes
    const spikeMat = new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.95 });
    const spikeGeo = new THREE.ConeGeometry(0.08, 0.8, 4);
    spikeGeo.translate(0, 0.4, 0);

    for (let i = 0; i < 4; i++) {
      const spike = new THREE.Mesh(spikeGeo, spikeMat);
      spike.rotation.z = (i / 4) * Math.PI * 2;
      state.muzzleFlash.add(spike);
    }

    // Forward spike
    const spikeF = new THREE.Mesh(spikeGeo, spikeMat);
    spikeF.rotation.x = Math.PI / 2;
    state.muzzleFlash.add(spikeF);

    state.muzzleFlash.visible = false;

    // Point light
    state.muzzleLight = new THREE.PointLight(0xffaa00, 3.0, 30);
    state.muzzleLight.visible = false;
  }

  // Add to weapon mesh if not already added
  if (state.viewWeaponMesh && !state.viewWeaponMesh.children.includes(state.muzzleFlash)) {
    state.viewWeaponMesh.add(state.muzzleFlash);
  }
  if (state.viewWeaponMesh && !state.viewWeaponMesh.children.includes(state.muzzleLight)) {
    state.viewWeaponMesh.add(state.muzzleLight);
  }

  // Position at gun barrel tip (front of weapon model)
  // The weapon model extends from z=0 to z=-1.2 approximately
  const barrelTipZ = -1.2;
  const barrelTipY = 0.06;

  state.muzzleFlash.position.set(0, barrelTipY, barrelTipZ);
  state.muzzleLight.position.set(0, barrelTipY, barrelTipZ);

  // Random rotation for variety
  state.muzzleFlash.rotation.z = Math.random() * Math.PI;

  // Random scale - shotgun has bigger flash
  let scaleVal = 0.6 + Math.random() * 0.4;
  if (weaponName === 'S686' || weaponName === 'S1897' || weaponName === 'S12K' || weaponName === 'DBS') {
    scaleVal *= 2.0; // Shotgun flash is 2x bigger
    if (state.muzzleLight) state.muzzleLight.intensity = 10.0; // Brighter light
  }
  state.muzzleFlash.scale.set(scaleVal, scaleVal, scaleVal * 1.2);

  // Show flash
  state.muzzleFlash.visible = true;
  state.muzzleLight.visible = true;

  // Set end time
  muzzleFlashEndTime = Date.now() + MUZZLE_FLASH_DURATION;

  // Spawn shell casing
  spawnBulletCasing();
}

// Call this every frame to hide muzzle flash when time expires
export function updateMuzzleFlash() {
  if (state.muzzleFlash && state.muzzleFlash.visible && Date.now() > muzzleFlashEndTime) {
    state.muzzleFlash.visible = false;
    if (state.muzzleLight) state.muzzleLight.visible = false;
  }
}

function getWorldMuzzleFlash() {
  for (let i = 0; i < worldMuzzleFlashPool.length; i++) {
    if (!worldMuzzleFlashPool[i].active) {
      worldMuzzleFlashPool[i].active = true;
      worldMuzzleFlashPool[i].group.visible = true;
      return worldMuzzleFlashPool[i];
    }
  }

  if (worldMuzzleFlashPool.length >= 36) return null;

  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff2a0, transparent: true, opacity: 0.9, depthWrite: false })
  );
  const flare = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 1.4, 6, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xff8c18, transparent: true, opacity: 0.78, depthWrite: false })
  );
  flare.rotation.x = Math.PI / 2;
  flare.position.z = 0.55;
  group.add(core, flare);
  group.visible = false;
  state.scene.add(group);

  const entry = { group, core, flare, startTime: 0, duration: 70, active: false };
  worldMuzzleFlashPool.push(entry);
  return entry;
}

export function spawnWorldMuzzleFlash(position, direction = null, options = null) {
  if (!position || !state.scene) return;
  const flash = getWorldMuzzleFlash();
  if (!flash) return;

  const scale = (options && options.scale) || 1;
  flash.group.position.copy(position);
  flash.group.scale.setScalar(scale * (0.8 + Math.random() * 0.35));
  flash.group.rotation.z = Math.random() * Math.PI;

  _worldFlashDir.copy(direction || _worldFlashDefaultDir);
  if (_worldFlashDir.lengthSq() < 0.001) _worldFlashDir.copy(_worldFlashDefaultDir);
  _worldFlashTarget.copy(position).add(_worldFlashDir.normalize());
  flash.group.lookAt(_worldFlashTarget);

  // World flashes are deliberately short: enough to read enemy fire, cheap enough for firefights.
  flash.startTime = performance.now();
  flash.duration = (options && options.duration) || 70;
  flash.core.material.opacity = 0.95;
  flash.flare.material.opacity = 0.78;
  flash.group.visible = true;
  flash.active = true;
  activeWorldMuzzleFlashes.push(flash);
}

function spawnBulletCasing() {
  if (state.shellCasings.length > 20) {
    state.scene.remove(state.shellCasings[0].mesh);
    state.shellCasings.shift();
  }

  const shell = new THREE.Mesh(shellGeo, shellMat);
  const pos = state.camera.position.clone();
  const dir = new THREE.Vector3(0.4, -0.4, -1.0).applyQuaternion(state.camera.quaternion);
  shell.position.copy(pos).add(dir);
  shell.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  state.scene.add(shell);

  let vx = 2 + Math.random() * 2;
  let vy = Math.random() * 1.5 + 0.5;
  let vz = -Math.random() * 1.5 - 0.5;

  state.shellCasings.push({ mesh: shell, vx, vy, vz, rotSpeed: (Math.random() - 0.5) * 20, age: 0 });
}

export function updateParticles(delta) {
  // Update muzzle flash
  updateMuzzleFlash();

  const now = performance.now();
  for (let i = activeWorldMuzzleFlashes.length - 1; i >= 0; i--) {
    const flash = activeWorldMuzzleFlashes[i];
    const t = (now - flash.startTime) / flash.duration;
    if (t >= 1) {
      flash.active = false;
      flash.group.visible = false;
      activeWorldMuzzleFlashes.splice(i, 1);
    } else {
      const opacity = 1 - t;
      flash.core.material.opacity = 0.95 * opacity;
      flash.flare.material.opacity = 0.78 * opacity;
    }
  }

  // Update blood particles (swap-and-pop for O(1) removal)
  const bloodArr = state.bloodParticles;
  for (let i = bloodArr.length - 1; i >= 0; i--) {
    let p = bloodArr[i];
    p.age += delta;
    p.vy -= 40 * delta;
    p.mesh.position.x += p.vx * delta;
    p.mesh.position.y += p.vy * delta;
    p.mesh.position.z += p.vz * delta;
    if (p.age > 0.5) {
      state.scene.remove(p.mesh);
      // Swap with last element and pop (O(1) instead of O(n) splice)
      bloodArr[i] = bloodArr[bloodArr.length - 1];
      bloodArr.pop();
    }
  }

  // Update shell casings (swap-and-pop)
  const shellArr = state.shellCasings;
  for (let i = shellArr.length - 1; i >= 0; i--) {
    let s = shellArr[i];
    s.age += delta;
    s.vy -= 15 * delta;
    s.mesh.position.x += s.vx * delta;
    s.mesh.position.y += s.vy * delta;
    s.mesh.position.z += s.vz * delta;
    s.mesh.rotation.x += s.rotSpeed * delta;
    s.mesh.rotation.z += s.rotSpeed * 0.5 * delta;
    if (s.age > 1.5) {
      state.scene.remove(s.mesh);
      shellArr[i] = shellArr[shellArr.length - 1];
      shellArr.pop();
    }
  }
}
