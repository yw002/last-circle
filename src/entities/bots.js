// Bot AI subsystem - Performance optimized with shared resources

import * as THREE from 'three';
import { state } from '../state.js';
import { MAP_SIZE, BOT_COUNT, difficulties, CURRENT_DIFFICULTY, weapons, equipments } from '../config.js';
import { getTerrainHeight } from '../world/terrain.js';
import { getHousePlayerIsInside } from './house.js';
import { calcDamage } from './damage.js';
import { playSound } from '../systems/audio.js';
import { spawnBlood } from '../systems/particles.js';
import { playerHit } from './player.js';
import { addKillFeed } from '../ui/notices.js';
import { updateUI } from '../ui/hud.js';
import { showNotice } from '../ui/notices.js';

// ========== SHARED RESOURCES (created once) ==========
const skinColors = [0xffdfc4, 0xd0a37e, 0x8d5524, 0xc68642, 0xe0ac69, 0x4a2a18, 0xf1c27d, 0x3d2314];
const shirtColors = [0x95a5a6, 0x34495e, 0x27ae60, 0x8e44ad, 0xc0392b, 0xd35400, 0xf39c12, 0x2c3e50, 0x111111, 0xecf0f1, 0x1abc9c, 0xf1c40f];
const pantsColors = [0x2c3e50, 0xbdc3c7, 0x34495e, 0x7f8c8d, 0x222222, 0x8b4513, 0x2e4053, 0x17202a];

// Shared geometries - created once, reused for all bots (reduced segments for performance)
const sharedGeos = {
  torsoLower: new THREE.SphereGeometry(1.8, 8, 6),
  torsoUpper: new THREE.SphereGeometry(1.6, 8, 6),
  head: new THREE.SphereGeometry(1.2, 8, 8),
  hair: new THREE.SphereGeometry(1.25, 8, 4),
  neck: new THREE.CylinderGeometry(0.4, 0.5, 0.6, 6),
  eye: new THREE.SphereGeometry(0.22, 6, 6),
  pupil: new THREE.SphereGeometry(0.12, 6, 6),
  nose: new THREE.SphereGeometry(0.15, 6, 6),
  mouth: new THREE.BoxGeometry(0.4, 0.08, 0.1),
  shoulder: new THREE.SphereGeometry(0.5, 6, 6),
  belt: new THREE.TorusGeometry(1.5, 0.15, 6, 12),
  armUpper: new THREE.CylinderGeometry(0.4, 0.35, 2.0, 6),
  elbow: new THREE.SphereGeometry(0.35, 6, 6),
  armLower: new THREE.CylinderGeometry(0.35, 0.3, 1.8, 6),
  hand: new THREE.SphereGeometry(0.3, 6, 6),
  legUpper: new THREE.CylinderGeometry(0.5, 0.45, 2.2, 6),
  legLower: new THREE.CylinderGeometry(0.45, 0.4, 2.0, 6),
  boot: new THREE.BoxGeometry(0.6, 0.4, 1.0),
  gunBody: new THREE.BoxGeometry(0.15, 0.15, 1.5),
  gunBarrel: new THREE.CylinderGeometry(0.04, 0.05, 0.8, 6),
  pack: new THREE.BoxGeometry(1.5, 2.0, 0.8),
  parachute: new THREE.SphereGeometry(10, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2)
};

// Shared materials - created once
const sharedMats = {
  dark: new THREE.MeshLambertMaterial({ color: 0x222222 }),
  boot: new THREE.MeshLambertMaterial({ color: 0x111111 }),
  belt: new THREE.MeshLambertMaterial({ color: 0x333333 }),
  eyeWhite: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  pupil: new THREE.MeshBasicMaterial({ color: 0x222222 }),
  mouth: new THREE.MeshLambertMaterial({ color: 0xcc8888 }),
  hair: new THREE.MeshLambertMaterial({ color: 0x222222 }),
  parachute: new THREE.MeshLambertMaterial({ color: 0xe74c3c, side: THREE.DoubleSide }),
  laser: new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.6 })
};

// Reusable Vector3 for calculations
const _tempVec3 = new THREE.Vector3();

export function initBots() {
  for (let i = 0; i < BOT_COUNT; i++) {
    let x = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let z = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let y = 300 + Math.random() * 200;

    const botGroup = new THREE.Group();

    // Get random colors
    let skinC = skinColors[Math.floor(Math.random() * skinColors.length)];
    let shirtC = shirtColors[Math.floor(Math.random() * shirtColors.length)];
    let pantsC = pantsColors[Math.floor(Math.random() * pantsColors.length)];

    // Create per-bot color materials (only color differs)
    const bodyMat = new THREE.MeshLambertMaterial({ color: shirtC });
    const headMat = new THREE.MeshLambertMaterial({ color: skinC });
    const limbMat = new THREE.MeshLambertMaterial({ color: pantsC });

    // Build bot using shared geometries
    const torsoLower = new THREE.Mesh(sharedGeos.torsoLower, bodyMat);
    torsoLower.scale.set(1, 0.8, 0.7);
    torsoLower.position.y = 4.0;

    const torsoUpper = new THREE.Mesh(sharedGeos.torsoUpper, bodyMat);
    torsoUpper.scale.set(1, 1.0, 0.7);
    torsoUpper.position.y = 5.5;

    const head = new THREE.Mesh(sharedGeos.head, headMat);
    head.position.y = 7.5;

    const hair = new THREE.Mesh(sharedGeos.hair, sharedMats.hair);
    hair.position.y = 7.6;

    const neck = new THREE.Mesh(sharedGeos.neck, headMat);
    neck.position.y = 6.8;

    const eyeL = new THREE.Mesh(sharedGeos.eye, sharedMats.eyeWhite);
    eyeL.position.set(-0.45, 7.7, 0.9);
    const eyeR = new THREE.Mesh(sharedGeos.eye, sharedMats.eyeWhite);
    eyeR.position.set(0.45, 7.7, 0.9);
    const pupilL = new THREE.Mesh(sharedGeos.pupil, sharedMats.pupil);
    pupilL.position.set(-0.45, 7.7, 1.05);
    const pupilR = new THREE.Mesh(sharedGeos.pupil, sharedMats.pupil);
    pupilR.position.set(0.45, 7.7, 1.05);

    const nose = new THREE.Mesh(sharedGeos.nose, headMat);
    nose.position.set(0, 7.4, 1.1);

    const shoulderL = new THREE.Mesh(sharedGeos.shoulder, bodyMat);
    shoulderL.position.set(-1.8, 6.0, 0);
    const shoulderR = new THREE.Mesh(sharedGeos.shoulder, bodyMat);
    shoulderR.position.set(1.8, 6.0, 0);

    const belt = new THREE.Mesh(sharedGeos.belt, sharedMats.belt);
    belt.position.y = 3.5;
    belt.rotation.x = Math.PI / 2;

    const armUpperL = new THREE.Mesh(sharedGeos.armUpper, bodyMat);
    armUpperL.position.set(-2.2, 5.5, 0);
    armUpperL.rotation.z = 0.2;
    const armLowerL = new THREE.Mesh(sharedGeos.armLower, bodyMat);
    armLowerL.position.set(-2.8, 4.0, 0.3);
    const handL = new THREE.Mesh(sharedGeos.hand, headMat);
    handL.position.set(-3.0, 3.2, 0.5);

    const armUpperR = new THREE.Mesh(sharedGeos.armUpper, bodyMat);
    armUpperR.position.set(2.2, 5.5, 0);
    armUpperR.rotation.z = -0.2;
    armUpperR.rotation.x = -0.5;
    const armLowerR = new THREE.Mesh(sharedGeos.armLower, bodyMat);
    armLowerR.position.set(2.8, 4.0, 0.8);
    const handR = new THREE.Mesh(sharedGeos.hand, headMat);
    handR.position.set(3.0, 3.2, 1.0);

    const legUpperL = new THREE.Mesh(sharedGeos.legUpper, limbMat);
    legUpperL.position.set(-0.8, 2.5, 0);
    const legLowerL = new THREE.Mesh(sharedGeos.legLower, limbMat);
    legLowerL.position.set(-0.8, 0.8, 0.2);
    const bootL = new THREE.Mesh(sharedGeos.boot, sharedMats.boot);
    bootL.position.set(-0.8, 0.2, 0.3);

    const legUpperR = new THREE.Mesh(sharedGeos.legUpper, limbMat);
    legUpperR.position.set(0.8, 2.5, 0);
    const legLowerR = new THREE.Mesh(sharedGeos.legLower, limbMat);
    legLowerR.position.set(0.8, 0.8, 0.2);
    const bootR = new THREE.Mesh(sharedGeos.boot, sharedMats.boot);
    bootR.position.set(0.8, 0.2, 0.3);

    // Backpack
    let pack = null;
    if (Math.random() > 0.3) {
      pack = new THREE.Mesh(sharedGeos.pack, sharedMats.dark);
      pack.position.set(0, 4.5, -1.5);
      botGroup.add(pack);
    }

    // Gun
    const gunBody = new THREE.Mesh(sharedGeos.gunBody, sharedMats.dark);
    gunBody.position.set(3.0, 3.5, 1.5);
    const gunBarrel = new THREE.Mesh(sharedGeos.gunBarrel, sharedMats.dark);
    gunBarrel.rotation.x = Math.PI / 2;
    gunBarrel.position.set(3.0, 3.6, 0.8);

    // Laser sight
    const laserGeo = new THREE.CylinderGeometry(0.03, 0.03, 80, 4);
    laserGeo.translate(0, 40, 0);
    laserGeo.rotateX(Math.PI / 2);
    const botLaser = new THREE.Mesh(laserGeo, sharedMats.laser);
    botLaser.position.set(3.0, 3.6, 0.8);
    botLaser.visible = false;

    // Add all parts
    botGroup.add(
      torsoLower, torsoUpper, neck, head, hair,
      eyeL, eyeR, pupilL, pupilR, nose,
      shoulderL, shoulderR, belt,
      armUpperL, armLowerL, handL,
      armUpperR, armLowerR, handR,
      legUpperL, legLowerL, bootL,
      legUpperR, legLowerR, bootR,
      gunBody, gunBarrel, botLaser
    );

    // Parachute
    const bParaGroup = new THREE.Group();
    const bCanopy = new THREE.Mesh(sharedGeos.parachute, sharedMats.parachute);
    bCanopy.position.y = 12;
    bCanopy.scale.y = 0.5;
    bParaGroup.add(bCanopy);
    const strMat = new THREE.LineBasicMaterial({ color: 0xffffff });
    for (let j = 0; j < 4; j++) {
      const ang = (j / 4) * Math.PI * 2;
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(Math.cos(ang) * 9, 12, Math.sin(ang) * 9),
        new THREE.Vector3(0, 5, 0)
      ]);
      bParaGroup.add(new THREE.Line(geo, strMat));
    }
    botGroup.add(bParaGroup);

    // Random scale
    let scale = 0.9 + Math.random() * 0.2;
    botGroup.scale.set(scale, scale, scale);

    botGroup.position.set(x, y, z);
    state.scene.add(botGroup);

    // Set userData for raycasting
    torsoLower.userData = { isBot: true, botIndex: i, isHeadshot: false };
    torsoUpper.userData = { isBot: true, botIndex: i, isHeadshot: false };
    head.userData = { isBot: true, botIndex: i, isHeadshot: true };
    state.objects.push(torsoLower, torsoUpper, head);
    if (pack) {
      pack.userData = { isBot: true, botIndex: i, isHeadshot: false };
      state.objects.push(pack);
    }

    // Random equipment
    let bHelmet = null;
    if (Math.random() > 0.3) {
      bHelmet = equipments.filter(e => e.type === "helmet")[Math.floor(Math.random() * 3)];
      headMat.color.setHex(bHelmet.color);
    }

    let bArmor = null;
    if (Math.random() > 0.3) {
      bArmor = equipments.filter(e => e.type === "armor")[Math.floor(Math.random() * 3)];
      bodyMat.color.setHex(bArmor.color);
    }

    let w = weapons[Math.floor(Math.random() * weapons.length)];
    let diff = difficulties[CURRENT_DIFFICULTY];

    state.bots.push({
      id: i, mesh: botGroup, bodyMesh: torsoLower, headMesh: head, packMesh: pack, parachuteMesh: bParaGroup, laserMesh: botLaser,
      health: diff.botHealth, alive: true, weapon: { ...w, damage: w.damage * diff.botDamageMultiplier },
      helmet: bHelmet, armor: bArmor,
      accuracy: diff.botAccuracy,
      isParachuting: true,
      state: 'wander', target: null, lastFire: 0, vx: 0, vz: 0, changeDirTime: 0
    });
  }

  state.aliveCount = BOT_COUNT + 1;
}

export function updateBots(delta) {
  let now = Date.now();
  let playerPos = state.controls.getObject().position;
  let diff = difficulties[CURRENT_DIFFICULTY];
  let currentTick = now % 5;

  state.bots.forEach((bot, idx) => {
    if (!bot.alive) return;

    // Distance check - skip detailed updates for far bots
    let distToPlayer = bot.mesh.position.distanceTo(playerPos);
    let isNearby = distToPlayer < 400;

    if (bot.isParachuting) {
      bot.mesh.position.y -= (25 + Math.random() * 10) * delta;
      let bPos = bot.mesh.position;
      bot.mesh.position.x += Math.cos(bot.id) * 15 * delta;
      bot.mesh.position.z += Math.sin(bot.id) * 15 * delta;

      let groundY = getTerrainHeight(bPos.x, bPos.z);
      if (bPos.y <= groundY) {
        bPos.y = groundY;
        bot.isParachuting = false;
        bot.parachuteMesh.visible = false;
      }
      return;
    }

    // Hide far away bots
    if (distToPlayer > 600) {
      bot.mesh.visible = false;
      return;
    }
    bot.mesh.visible = true;

    let bPos = bot.mesh.position;
    let oldBx = bPos.x, oldBz = bPos.z;

    // AI targeting (throttled)
    if ((idx % 5) === currentTick && now > bot.changeDirTime) {
      bot.changeDirTime = now + 1500 + Math.random() * 2500;
      let closestTarget = null;
      let minDistSq = diff.botTargetRange * diff.botTargetRange;

      if (state.player.alive && !state.player.isParachuting) {
        let dSq = bPos.distanceToSquared(playerPos);
        if (dSq < minDistSq) { minDistSq = dSq; closestTarget = 'player'; }
      }

      // Only check nearby bots for targets
      if (isNearby) {
        state.bots.forEach(other => {
          if (other.alive && !other.isParachuting && other.id !== bot.id) {
            let dSq = bPos.distanceToSquared(other.mesh.position);
            if (dSq < minDistSq) { minDistSq = dSq; closestTarget = other; }
          }
        });
      }

      bot.target = closestTarget;

      if (!bot.target) {
        bot.state = 'wander';
        let distToZoneCenterSq = Math.pow(bPos.x - state.zone.x, 2) + Math.pow(bPos.z - state.zone.z, 2);
        if (distToZoneCenterSq > state.zone.radius * state.zone.radius * 0.81) {
          let angle = Math.atan2(state.zone.z - bPos.z, state.zone.x - bPos.x);
          bot.vx = Math.cos(angle) * 20;
          bot.vz = Math.sin(angle) * 20;
        } else {
          let angle = Math.random() * Math.PI * 2;
          bot.vx = Math.cos(angle) * 15;
          bot.vz = Math.sin(angle) * 15;
        }
      } else {
        bot.state = 'attack';
      }
    }

    if (bot.state === 'wander') {
      bPos.x += bot.vx * delta;
      bPos.z += bot.vz * delta;
      bPos.y = getTerrainHeight(bPos.x, bPos.z);
      if (bot.laserMesh) bot.laserMesh.visible = false;
    } else if (bot.state === 'attack' && bot.target) {
      let targetPos = bot.target === 'player' ? playerPos : bot.target.mesh.position;
      bot.mesh.lookAt(targetPos.x, bPos.y, targetPos.z);
      if (bot.laserMesh) bot.laserMesh.visible = true;

      let speed = diff.botSpeed || 20;
      _tempVec3.subVectors(targetPos, bPos);
      _tempVec3.y = 0;
      let dist = _tempVec3.length();
      _tempVec3.normalize();

      if (dist > 80) {
        bPos.x += _tempVec3.x * speed * delta;
        bPos.z += _tempVec3.z * speed * delta;
      } else if (dist < 30) {
        bPos.x -= _tempVec3.x * speed * delta;
        bPos.z -= _tempVec3.z * speed * delta;
      } else {
        let strafeDir = (Math.floor(now / 2000) + bot.id) % 2 === 0 ? 1 : -1;
        bPos.x += (-_tempVec3.z) * speed * 0.85 * strafeDir * delta;
        bPos.z += _tempVec3.x * speed * 0.85 * strafeDir * delta;
      }
      bPos.y = getTerrainHeight(bPos.x, bPos.z);

      // Shooting (only nearby bots shoot)
      if (isNearby && now - bot.lastFire > bot.weapon.fireRate * diff.botFireRateMultiplier) {
        bot.lastFire = now;
        playSound(bot.weapon.sound, { x: bPos.x, y: bPos.y, z: bPos.z });

        if (bot.laserMesh) {
          bot.laserMesh.material.opacity = 1.0;
          setTimeout(() => { if (bot.laserMesh) bot.laserMesh.material.opacity = 0.6; }, 100);
        }

        if (Math.random() < bot.accuracy) {
          let isHeadshot = Math.random() > 0.9;
          if (bot.target === 'player') {
            const botHeadPos = _tempVec3.set(bPos.x, bPos.y + 5, bPos.z);
            const direction = new THREE.Vector3().subVectors(playerPos, botHeadPos).normalize();
            const ray = new THREE.Raycaster(botHeadPos, direction, 0, 1000);
            const intersects = ray.intersectObjects(state.objects);

            let isBlocked = false;
            let insideHouse = getHousePlayerIsInside();
            if (insideHouse && !insideHouse.isOpen) {
              isBlocked = true;
            } else if (intersects.length > 0) {
              if (intersects[0].distance < botHeadPos.distanceTo(playerPos)) {
                if (intersects[0].object.userData.botIndex !== bot.id) {
                  isBlocked = true;
                }
              }
            }

            if (!isBlocked) {
              let dmg = calcDamage(bot.weapon.damage * diff.botToPlayerDamageFactor, isHeadshot, state.player);
              playerHit(dmg);
            }
          } else if (bot.target.mesh) {
            let dmg = calcDamage(bot.weapon.damage * 0.5, isHeadshot, bot.target);
            bot.target.health -= dmg;
            spawnBlood(bot.target.mesh.position.clone().add(new THREE.Vector3(0, 4, 0)), new THREE.Vector3(0, 1, 0));
            if (bot.target.health <= 0) {
              botDied(bot.target, "Bot " + bot.id);
              bot.target = null;
              bot.changeDirTime = 0;
            }
          }
        }
      }
    }

    // House collision (simplified - only check nearby doors)
    if (isNearby) {
      for (let i = 0; i < state.doors.length; i++) {
        let d = state.doors[i];
        let hPos = d.housePos;
        let dx = bPos.x - hPos.x;
        let dz = bPos.z - hPos.z;

        if (Math.abs(dx) > 20 || Math.abs(dz) > 20) continue;

        let dy = bPos.y - hPos.y;
        if (dy > 0 && dy < 24) {
          let absX = Math.abs(dx);
          let absZ = Math.abs(dz);
          if (absX < 16.2 && absZ < 16.2) {
            let wallHit = false;
            if ((dx >= -16.2 && dx <= -13.5 && dz >= -16.2 && dz <= 16.2) ||
              (dx >= 13.5 && dx <= 16.2 && dz >= -16.2 && dz <= 16.2) ||
              (dz >= -16.2 && dz <= -13.5 && dx >= -16.2 && dx <= 16.2) ||
              (dz >= 13.5 && dz <= 16.2 && dx >= -16.2 && dx <= -3.1) ||
              (dz >= 13.5 && dz <= 16.2 && dx >= 3.1 && dx <= 16.2) ||
              (!d.isOpen && dz >= 13.5 && dz <= 16.2 && dx >= -3.25 && dx <= 3.25)) {
              wallHit = true;
            }
            if (wallHit) {
              bPos.x = oldBx;
              bPos.z = oldBz;
              break;
            }
          }
        }
      }
    }
  });
}

export function botDied(bot, killerName) {
  if (!bot.alive) return;
  bot.alive = false;
  state.scene.remove(bot.mesh);
  state.aliveCount = Math.max(1, state.aliveCount - 1);

  let idx1 = state.objects.indexOf(bot.bodyMesh);
  if (idx1 > -1) state.objects.splice(idx1, 1);
  let idx2 = state.objects.indexOf(bot.headMesh);
  if (idx2 > -1) state.objects.splice(idx2, 1);
  if (bot.packMesh) {
    let idx3 = state.objects.indexOf(bot.packMesh);
    if (idx3 > -1) state.objects.splice(idx3, 1);
  }

  if (killerName === "You") {
    state.player.kills++;
    showNotice("击杀 Bot " + bot.id, "#f1c40f");
  }

  addKillFeed(`[${killerName}] 击杀了 [Bot ${bot.id}]`);
  updateUI();

  if (state.aliveCount === 1 && state.player.alive) {
    setTimeout(() => {
      state.controls.unlock();
      document.getElementById('title').innerText = "大吉大利，今晚吃鸡！";
      document.getElementById('title').style.color = "#f1c40f";
      document.getElementById('subtitle').innerText = `WINNER WINNER CHICKEN DINNER! 击杀数: ${state.player.kills}`;
      document.getElementById('start-btn').innerText = "再玩一局";
      document.getElementById('start-btn').style.display = "block";
      document.getElementById('start-btn').onclick = () => location.reload();
      document.getElementById('overlay').style.display = "flex";
    }, 800);
  }
}
