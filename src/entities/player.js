// Player subsystem: movement, shooting, reloading, weapon management

import * as THREE from 'three';
import { state } from '../state.js';
import { MAP_SIZE, RELOAD_DURATION } from '../config.js';
import { getTerrainHeight } from '../world/terrain.js';
import { getHousePlayerIsInside } from './house.js';
import { playSound } from '../systems/audio.js';
import { spawnBlood, spawnMuzzleFlash } from '../systems/particles.js';
import { updateUI } from '../ui/hud.js';
import { showNotice } from '../ui/notices.js';
import { calcDamage } from './damage.js';
import { botDied } from './bots.js';
import { zombieDied } from './zombies.js';
import { killAnimal, getAllAnimals } from './animals.js';
import { alienDied, getAllAliens } from './aliens.js';

// Crosshair spread state
let crosshairSpread = 0;
const CROSSHAIR_SPREAD_DECAY = 3; // Slower recovery
const CROSSHAIR_SPREAD_PER_SHOT = 2.0; // More spread per shot
const CROSSHAIR_MAX_SPREAD = 5;

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
      state.viewWeaponMesh.position.set(0.6, -0.6, -1.2);
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
    state.viewWeaponMesh.position.set(0.6, -0.6, -1.2);
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
      state.viewWeaponMesh.position.set(0.6, -0.6, -1.2);
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
    state.viewWeaponMesh.position.set(0.6, -0.6, -1.2);
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

  // Shared materials
  const metalMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x6b3a1f });
  const bodyMat = new THREE.MeshLambertMaterial({ color: wColor });
  const gripMat = new THREE.MeshLambertMaterial({ color: 0x222222 });

  if (wName === 'M1911' || wName === 'P92' || wName === 'Desert Eagle') {
    // Pistol model
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.5), metalMat);
    slide.position.set(0, 0.05, 0);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 8), darkMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.08, -0.35);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.4), bodyMat);
    frame.position.set(0, -0.02, 0.05);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.2, 0.12), gripMat);
    grip.position.set(0, -0.15, 0.15);
    grip.rotation.x = -0.3;
    const triggerGuard = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.01, 6, 8, Math.PI), metalMat);
    triggerGuard.position.set(0, -0.06, 0.05);
    triggerGuard.rotation.x = Math.PI;
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.02), darkMat);
    sight.position.set(0, 0.12, -0.2);
    state.viewWeaponMesh.add(slide, barrel, frame, grip, triggerGuard, sight);
  } else if (wName === 'S686' || wName === 'S1897' || wName === 'S12K' || wName === 'DBS') {
    // Shotgun model
    const barrel1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 8), metalMat);
    barrel1.rotation.x = Math.PI / 2;
    barrel1.position.set(-0.03, 0.04, -0.6);
    const barrel2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 8), metalMat);
    barrel2.rotation.x = Math.PI / 2;
    barrel2.position.set(0.03, 0.04, -0.6);
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.4), bodyMat);
    receiver.position.set(0, 0, 0.1);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.5), woodMat);
    stock.position.set(0, -0.03, 0.5);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.08), woodMat);
    grip.position.set(0, -0.12, 0.25);
    grip.rotation.x = -0.2;
    const foreend = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8), woodMat);
    foreend.rotation.x = Math.PI / 2;
    foreend.position.set(0, 0.02, -0.3);
    state.viewWeaponMesh.add(barrel1, barrel2, receiver, stock, grip, foreend);
  } else if (wName === 'Kar98k' || wName === 'M24' || wName === 'AWM') {
    // Sniper rifle model
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.5, 8), metalMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.05, -0.8);
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.6), bodyMat);
    receiver.position.set(0, 0, 0.1);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.7), woodMat);
    stock.position.set(0, -0.02, 0.6);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.15, 0.06), woodMat);
    grip.position.set(0, -0.1, 0.3);
    grip.rotation.x = -0.25;
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.15, 6), metalMat);
    bolt.position.set(0.06, 0.05, 0.15);
    bolt.rotation.z = Math.PI / 2;
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 8), darkMat);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.12, 0);
    const scopeMount = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.1), metalMat);
    scopeMount.position.set(0, 0.08, 0);
    state.viewWeaponMesh.add(barrel, receiver, stock, grip, bolt, scope, scopeMount);
  } else if (wName === 'UZI' || wName === 'Vector' || wName === 'MP5K') {
    // SMG model
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.6), metalMat);
    body.position.set(0, 0.03, 0);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.4, 8), darkMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.05, -0.45);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.25, 0.04), darkMat);
    mag.position.set(0, -0.12, -0.05);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.15, 0.06), gripMat);
    grip.position.set(0, -0.1, 0.2);
    grip.rotation.x = -0.2;
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.3), metalMat);
    stock.position.set(0, 0.02, 0.4);
    state.viewWeaponMesh.add(body, barrel, mag, grip, stock);
  } else {
    // Assault rifle model (AKM, M416, SCAR-L, etc.)
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.8), bodyMat);
    upper.position.set(0, 0.04, 0);
    const lower = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.6), bodyMat);
    lower.position.set(0, -0.02, 0.1);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.7, 8), darkMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.06, -0.7);
    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.3), woodMat);
    handguard.position.set(0, 0.02, -0.35);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.08), darkMat);
    mag.position.set(0, -0.14, -0.05);
    if (wName === 'AKM') mag.rotation.x = 0.15;
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.15, 0.05), gripMat);
    grip.position.set(0, -0.12, 0.25);
    grip.rotation.x = -0.25;
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.5), bodyMat);
    stock.position.set(0, 0, 0.6);
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 0.02), darkMat);
    sight.position.set(0, 0.1, -0.3);
    const sightFront = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.02), darkMat);
    sightFront.position.set(0, 0.1, -0.6);
    state.viewWeaponMesh.add(upper, lower, barrel, handguard, mag, grip, stock, sight, sightFront);
  }
}

export function playerHit(dmg) {
  if (state.player.isParachuting) return;
  state.player.health -= dmg;
  playSound('hit');
  document.getElementById('hit-overlay').style.opacity = '1';
  setTimeout(() => { document.getElementById('hit-overlay').style.opacity = '0'; }, 150);

  updateUI();
  if (state.player.health <= 0) {
    state.player.alive = false;
    state.controls.unlock();
    document.getElementById('title').innerText = "游戏结束 (YOU DIED)";
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

// Get the world position of the gun barrel tip
function getGunBarrelPosition() {
  if (!state.viewWeaponMesh) return state.camera.position.clone();

  // Gun barrel tip is at the front of the weapon (negative Z in local space)
  const barrelTipLocal = new THREE.Vector3(0, 0.06, -1.2);
  const barrelTipWorld = barrelTipLocal.clone();

  // Transform from weapon local space to world space
  state.viewWeaponMesh.localToWorld(barrelTipWorld);

  return barrelTipWorld;
}

// Create bullet tracer line
function createBulletTracer(startPos, endPos) {
  const points = [startPos.clone(), endPos.clone()];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: 0xffff00,
    transparent: true,
    opacity: 0.8,
    linewidth: 2
  });
  const line = new THREE.Line(geometry, material);
  state.scene.add(line);

  // Remove after short delay
  setTimeout(() => {
    state.scene.remove(line);
    geometry.dispose();
    material.dispose();
  }, 80);
}

// Cooldown for empty magazine notice
let lastEmptyNoticeTime = 0;

export function fireWeapon() {
  if (!state.player.alive || state.player.isParachuting || state.player.isReloading) return;
  let now = Date.now();
  if (now - state.player.lastFire < state.player.weapon.fireRate) return;

  if (state.player.weapon.ammo <= 0) {
    // Only show notice every 2 seconds to avoid spam
    if (now - lastEmptyNoticeTime > 2000) {
      showNotice("弹匣为空！按 R 换弹", "#e74c3c");
      lastEmptyNoticeTime = now;
    }
    // Auto-reload if has ammo (silent)
    if (state.player.sharedAmmo > 0 && !state.player.isReloading) {
      reloadWeapon();
    }
    return;
  }
  state.player.weapon.ammo--;
  state.player.lastFire = now;
  updateUI();
  playSound(state.player.weapon.sound);

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

  spawnMuzzleFlash(state.player.weapon.name);

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

  // Get gun barrel position for tracer
  const tracerStart = getGunBarrelPosition();

  let coverHit = null;
  let targetHit = null;

  for (let i = 0; i < intersects.length; i++) {
    let hit = intersects[i];
    if (hit.distance > state.player.weapon.range) break;

    let ud = hit.object.userData;
    if (ud.isBot || ud.isZombie || ud.isAnimal || ud.isAlien) {
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
    hitPoint = tracerStart.clone().add(state.raycaster.ray.direction.clone().multiplyScalar(state.player.weapon.range));
  }

  // Create bullet tracer
  createBulletTracer(tracerStart, hitPoint);

  if (coverHit && (!targetHit || coverHit.distance < targetHit.distance)) {
    let n = coverHit.face ? coverHit.face.normal : new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < 3; i++) {
      const dust = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshBasicMaterial({ color: 0x7f8c8d }));
      dust.position.copy(coverHit.point);
      state.scene.add(dust);
      state.bloodParticles.push({
        mesh: dust,
        vx: n.x * 5 + (Math.random() - 0.5) * 10,
        vy: n.y * 5 + Math.random() * 10,
        vz: n.z * 5 + (Math.random() - 0.5) * 10,
        age: 0
      });
    }
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
        document.getElementById('crosshair').style.background = 'red';
        document.getElementById('crosshair').style.transform = 'translate(-50%, -50%) scale(1.5)';
        setTimeout(() => {
          document.getElementById('crosshair').style.background = 'rgba(0,255,0,0.8)';
          document.getElementById('crosshair').style.transform = 'translate(-50%, -50%) scale(1)';
        }, 100);
        if (bot.health <= 0) botDied(bot, "You");
      }
    } else if (ud.isZombie) {
      let zombie = state.zombies[ud.zombieIndex];
      if (zombie && zombie.alive) {
        let dmg = calcDamage(state.player.weapon.damage, ud.isHeadshot, zombie);
        zombie.health -= dmg;
        playSound('hit');
        let n = targetHit.face ? targetHit.face.normal : new THREE.Vector3(0, 1, 0);
        spawnBlood(targetHit.point, n);
        document.getElementById('crosshair').style.background = 'red';
        document.getElementById('crosshair').style.transform = 'translate(-50%, -50%) scale(1.5)';
        setTimeout(() => {
          document.getElementById('crosshair').style.background = 'rgba(0,255,0,0.8)';
          document.getElementById('crosshair').style.transform = 'translate(-50%, -50%) scale(1)';
        }, 100);
        if (zombie.health <= 0) zombieDied(zombie);
      }
    } else if (ud.isAnimal) {
      let animals = getAllAnimals();
      let animal = animals[ud.index];
      if (animal && animal.alive) {
        animal.health -= state.player.weapon.damage;
        playSound('hit');
        let n = targetHit.face ? targetHit.face.normal : new THREE.Vector3(0, 1, 0);
        spawnBlood(targetHit.point, n);
        document.getElementById('crosshair').style.background = 'red';
        document.getElementById('crosshair').style.transform = 'translate(-50%, -50%) scale(1.5)';
        setTimeout(() => {
          document.getElementById('crosshair').style.background = 'rgba(0,255,0,0.8)';
          document.getElementById('crosshair').style.transform = 'translate(-50%, -50%) scale(1)';
        }, 100);
        if (animal.health <= 0) {
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
        document.getElementById('crosshair').style.background = 'red';
        document.getElementById('crosshair').style.transform = 'translate(-50%, -50%) scale(1.5)';
        setTimeout(() => {
          document.getElementById('crosshair').style.background = 'rgba(0,255,0,0.8)';
          document.getElementById('crosshair').style.transform = 'translate(-50%, -50%) scale(1)';
        }, 100);
        if (alien.health <= 0) {
          alienDied(alien);
        }
      }
    }
  }
}

export function updatePlayer(delta) {
  if (!state.player.alive) return;

  let pPos = state.controls.getObject().position;

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

    let groundY = getTerrainHeight(pPos.x, pPos.z) + 10;

    for (let i = 0; i < state.housePositions.length; i++) {
      let hPos = state.housePositions[i];
      let dx = Math.abs(pPos.x - hPos.x);
      let dz = Math.abs(pPos.z - hPos.z);
      if (dx <= 15.6 && dz <= 15.6) {
        let roofSurfaceY = hPos.baseHeight + 38.1 - 14 * (Math.max(dx, dz) / 15.556);
        if (roofSurfaceY + 10 > groundY) {
          groundY = roofSurfaceY + 10;
        }
      }
    }

    let pBoxPara = new THREE.Box3().setFromCenterAndSize(pPos, new THREE.Vector3(1, 10, 1));
    for (let box of state.colliders) {
      if (pBoxPara.intersectsBox(box)) {
        if (box.max.y + 10 > groundY) {
          groundY = box.max.y + 10;
        }
      }
    }

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

    let pBoxXZ = new THREE.Box3().setFromCenterAndSize(pPos, new THREE.Vector3(3, 10, 3));
    let hitColliderXZ = false;
    for (let box of state.colliders) {
      if (pBoxXZ.intersectsBox(box)) {
        if (pPos.y - 4.5 < box.max.y) {
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
    for (let i = 0; i < state.doors.length; i++) {
      let d = state.doors[i];
      let hPos = d.housePos;
      let dx = pPos.x - hPos.x;
      let dz = pPos.z - hPos.z;
      let dy = pPos.y - hPos.y;

      if (dy > 0 && dy < 24) {
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

    for (let i = 0; i < state.housePositions.length; i++) {
      let hPos = state.housePositions[i];
      let dx = Math.abs(pPos.x - hPos.x);
      let dz = Math.abs(pPos.z - hPos.z);
      if (dx <= 15.6 && dz <= 15.6) {
        let roofSurfaceY = hPos.baseHeight + 38.1 - 14 * (Math.max(dx, dz) / 15.556);
        if (oldY - 4.5 >= roofSurfaceY - 2.0 && (pPos.y - 5.0) <= roofSurfaceY) {
          hitColliderY = true;
          landingY = roofSurfaceY + 5.0;
          break;
        }
      }
    }

    if (!hitColliderY) {
      let pBoxY = new THREE.Box3().setFromCenterAndSize(pPos, new THREE.Vector3(3, 10, 3));
      for (let box of state.colliders) {
        if (pBoxY.intersectsBox(box)) {
          if (oldY - 4.5 >= box.max.y - 1.2) {
            hitColliderY = true;
            landingY = box.max.y + 5.0;
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
      let groundY = getTerrainHeight(pPos.x, pPos.z) + 10;
      if (pPos.y <= groundY + 0.5 && state.velocity.y <= 0) {
        state.velocity.y = 0;
        pPos.y = groundY;
        state.canJump = true;
      } else if (pPos.y > groundY + 0.5) {
        state.canJump = false;
      }
    }

    // Loot pickup
    let nearbyLoot = null;
    let nearbyIndex = -1;
    for (let i = state.lootItems.length - 1; i >= 0; i--) {
      if (pPos.distanceToSquared(state.lootItems[i].mesh.position) < 225) {
        nearbyLoot = state.lootItems[i];
        nearbyIndex = i;
        break;
      }
    }

    // Door interaction
    let nearbyDoor = null;
    for (let i = 0; i < state.doors.length; i++) {
      let d = state.doors[i];
      let doorWorldPos = d.housePos.clone().add(new THREE.Vector3(0, 4.75, 15));
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

        if (picked) {
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
