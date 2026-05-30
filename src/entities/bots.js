// Bot AI subsystem

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

export function initBots() {
  // Shared geometries for performance
  const skinColors = [0xffdfc4, 0xd0a37e, 0x8d5524, 0xc68642, 0xe0ac69, 0x4a2a18, 0xf1c27d, 0x3d2314];
  const shirtColors = [0x95a5a6, 0x34495e, 0x27ae60, 0x8e44ad, 0xc0392b, 0xd35400, 0xf39c12, 0x2c3e50, 0x111111, 0xecf0f1, 0x1abc9c, 0xf1c40f];
  const pantsColors = [0x2c3e50, 0xbdc3c7, 0x34495e, 0x7f8c8d, 0x222222, 0x8b4513, 0x2e4053, 0x17202a];

  for (let i = 0; i < BOT_COUNT; i++) {
    let x = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let z = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let y = 300 + Math.random() * 200;

    const botGroup = new THREE.Group();

    let skinC = skinColors[Math.floor(Math.random() * skinColors.length)];
    let shirtC = shirtColors[Math.floor(Math.random() * shirtColors.length)];
    let pantsC = pantsColors[Math.floor(Math.random() * pantsColors.length)];

    const bodyMat = new THREE.MeshLambertMaterial({ color: shirtC });
    const headMat = new THREE.MeshLambertMaterial({ color: skinC });
    const limbMat = new THREE.MeshLambertMaterial({ color: pantsC });
    const armMat = new THREE.MeshLambertMaterial({ color: shirtC });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const bootMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const beltMat = new THREE.MeshLambertMaterial({ color: 0x333333 });

    // Torso - detailed rounded shape
    const torsoLower = new THREE.Mesh(new THREE.SphereGeometry(1.8, 16, 12), bodyMat);
    torsoLower.scale.set(1, 0.8, 0.7);
    torsoLower.position.y = 4.0;

    const torsoUpper = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 12), bodyMat);
    torsoUpper.scale.set(1, 1.0, 0.7);
    torsoUpper.position.y = 5.5;

    // Shoulders
    const shoulderL = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), bodyMat);
    shoulderL.position.set(-1.8, 6.0, 0);
    const shoulderR = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), bodyMat);
    shoulderR.position.set(1.8, 6.0, 0);

    // Belt
    const belt = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.15, 8, 16), beltMat);
    belt.position.y = 3.5;
    belt.rotation.x = Math.PI / 2;

    // Head - sphere with details
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 16), headMat);
    head.position.y = 7.5;

    // Hair
    const hairMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const hair = new THREE.Mesh(new THREE.SphereGeometry(1.25, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), hairMat);
    hair.position.y = 7.6;

    // Neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.6, 12), headMat);
    neck.position.y = 6.8;

    // Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), eyeMat);
    eyeL.position.set(-0.45, 7.7, 0.9);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), eyeMat);
    eyeR.position.set(0.45, 7.7, 0.9);
    const pupilL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), pupilMat);
    pupilL.position.set(-0.45, 7.7, 1.05);
    const pupilR = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), pupilMat);
    pupilR.position.set(0.45, 7.7, 1.05);

    // Nose
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), headMat);
    nose.position.set(0, 7.4, 1.1);

    // Mouth
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.1), new THREE.MeshLambertMaterial({ color: 0xcc8888 }));
    mouth.position.set(0, 7.1, 1.05);

    // Arms - detailed with joints
    const armUpperL = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.35, 2.0, 12), armMat);
    armUpperL.position.set(-2.2, 5.5, 0);
    armUpperL.rotation.z = 0.2;

    const elbowL = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), armMat);
    elbowL.position.set(-2.6, 4.5, 0.2);

    const armLowerL = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.3, 1.8, 12), armMat);
    armLowerL.position.set(-2.8, 3.5, 0.3);
    armLowerL.rotation.z = 0.1;

    const armUpperR = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.35, 2.0, 12), armMat);
    armUpperR.position.set(2.2, 5.5, 0);
    armUpperR.rotation.z = -0.2;
    armUpperR.rotation.x = -0.5;

    const armLowerR = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.3, 1.8, 8), armMat);
    armLowerR.position.set(2.8, 4.0, 0.8);
    armLowerR.rotation.z = -0.1;
    armLowerR.rotation.x = -0.3;

    // Hands
    const handL = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), headMat);
    handL.position.set(-3.0, 3.2, 0.5);
    const handR = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), headMat);
    handR.position.set(3.0, 3.2, 1.0);

    // Legs - rounded
    const legUpperL = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.45, 2.2, 8), limbMat);
    legUpperL.position.set(-0.8, 2.5, 0);

    const legLowerL = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.4, 2.0, 8), limbMat);
    legLowerL.position.set(-0.8, 0.8, 0.2);

    const legUpperR = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.45, 2.2, 8), limbMat);
    legUpperR.position.set(0.8, 2.5, 0);

    const legLowerR = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.4, 2.0, 8), limbMat);
    legLowerR.position.set(0.8, 0.8, 0.2);

    // Boots
    const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 1.0), bootMat);
    bootL.position.set(-0.8, 0.2, 0.3);
    const bootR = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 1.0), bootMat);
    bootR.position.set(0.8, 0.2, 0.3);

    // Backpack
    let pack = null;
    if (Math.random() > 0.3) {
      pack = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.0, 0.8), darkMat);
      pack.position.set(0, 4.5, -1.5);
      botGroup.add(pack);
    }

    // Gun
    const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 1.5), darkMat);
    gunBody.position.set(3.0, 3.5, 1.5);
    const gunBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.8, 6), darkMat);
    gunBarrel.rotation.x = Math.PI / 2;
    gunBarrel.position.set(3.0, 3.6, 0.8);

    // Laser sight
    const laserMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.6 });
    const laserGeo = new THREE.CylinderGeometry(0.03, 0.03, 100);
    laserGeo.translate(0, 50, 0);
    laserGeo.rotateX(Math.PI / 2);
    const botLaser = new THREE.Mesh(laserGeo, laserMat);
    botLaser.position.set(3.0, 3.6, 0.8);
    botLaser.visible = false;

    // Add all parts
    botGroup.add(
      torsoLower, torsoUpper, neck, head,
      eyeL, eyeR, pupilL, pupilR,
      armUpperL, armLowerL, handL,
      armUpperR, armLowerR, handR,
      legUpperL, legLowerL, bootL,
      legUpperR, legLowerR, bootR,
      gunBody, gunBarrel, botLaser
    );

    // Random scale for variety
    let scaleX = 0.9 + Math.random() * 0.2;
    let scaleY = 0.9 + Math.random() * 0.2;
    let scaleZ = 0.9 + Math.random() * 0.2;
    botGroup.scale.set(scaleX, scaleY, scaleZ);

    const bParaGroup = new THREE.Group();
    const bCanopy = new THREE.Mesh(
      new THREE.SphereGeometry(10, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: 0xe74c3c, side: THREE.DoubleSide })
    );
    bCanopy.position.y = 12; bCanopy.scale.y = 0.5;
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

    let rH = Math.random();
    let bHelmet = null;
    if (rH > 0.3) {
      bHelmet = equipments.filter(e => e.type === "helmet")[Math.floor(Math.random() * 3)];
      headMat.color.setHex(bHelmet.color);
    }

    let rA = Math.random();
    let bArmor = null;
    if (rA > 0.3) {
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

    let bPos = bot.mesh.position;
    let oldBx = bPos.x, oldBz = bPos.z;

    if ((idx % 5) === currentTick && now > bot.changeDirTime) {
      bot.changeDirTime = now + 1500 + Math.random() * 2500;
      let closestTarget = null;
      let minDistSq = diff.botTargetRange * diff.botTargetRange;

      if (state.player.alive && !state.player.isParachuting) {
        let dSq = bPos.distanceToSquared(playerPos);
        if (dSq < minDistSq) { minDistSq = dSq; closestTarget = 'player'; }
      }

      state.bots.forEach(other => {
        if (other.alive && !other.isParachuting && other.id !== bot.id) {
          let dSq = bPos.distanceToSquared(other.mesh.position);
          if (dSq < minDistSq) { minDistSq = dSq; closestTarget = other; }
        }
      });

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
      let dir = new THREE.Vector3().subVectors(targetPos, bPos);
      dir.y = 0;
      let dist = dir.length();
      dir.normalize();

      if (dist > 80) {
        bPos.x += dir.x * speed * delta;
        bPos.z += dir.z * speed * delta;
      } else if (dist < 30) {
        bPos.x -= dir.x * speed * delta;
        bPos.z -= dir.z * speed * delta;
      } else {
        let strafeDir = (Math.floor(now / 2000) + bot.id) % 2 === 0 ? 1 : -1;
        let perp = new THREE.Vector3(-dir.z, 0, dir.x);
        bPos.x += perp.x * speed * 0.85 * strafeDir * delta;
        bPos.z += perp.z * speed * 0.85 * strafeDir * delta;
      }
      bPos.y = getTerrainHeight(bPos.x, bPos.z);

      if (now - bot.lastFire > bot.weapon.fireRate * diff.botFireRateMultiplier) {
        bot.lastFire = now;
        playSound(bot.weapon.sound, { x: bPos.x, y: bPos.y, z: bPos.z });

        if (bot.laserMesh) {
          bot.laserMesh.material.opacity = 1.0;
          setTimeout(() => { if (bot.laserMesh) bot.laserMesh.material.opacity = 0.6; }, 100);
        }

        if (Math.random() < bot.accuracy) {
          let isHeadshot = Math.random() > 0.9;
          if (bot.target === 'player') {
            const botHeadPos = bot.mesh.position.clone().add(new THREE.Vector3(0, 5, 0));
            const playerPosRef = state.controls.getObject().position;
            const direction = new THREE.Vector3().subVectors(playerPosRef, botHeadPos).normalize();
            const ray = new THREE.Raycaster(botHeadPos, direction, 0, 1000);
            const intersects = ray.intersectObjects(state.objects);

            let isBlocked = false;

            let insideHouse = getHousePlayerIsInside();
            if (insideHouse && !insideHouse.isOpen) {
              isBlocked = true;
            } else if (intersects.length > 0) {
              if (intersects[0].distance < botHeadPos.distanceTo(playerPosRef)) {
                if (intersects[0].object.userData.botIndex !== bot.id) {
                  isBlocked = true;
                }
              }
            }

            if (!isBlocked) {
              let dmg = calcDamage(bot.weapon.damage * diff.botToPlayerDamageFactor, isHeadshot, state.player);
              playerHit(dmg);
            }
          } else {
            let dmg = calcDamage(bot.weapon.damage * 0.5, isHeadshot, bot.target);
            bot.target.health -= dmg;

            let n = new THREE.Vector3(0, 1, 0);
            spawnBlood(bot.target.mesh.position.clone().add(new THREE.Vector3(0, 4, 0)), n);

            if (bot.target.health <= 0) {
              botDied(bot.target, "Bot " + bot.id);
              bot.target = null;
              bot.changeDirTime = 0;
            }
          }
        }
      }
    }

    // House wall collision for bots
    for (let i = 0; i < state.doors.length; i++) {
      let d = state.doors[i];
      let hPos = d.housePos;
      let dx = bPos.x - hPos.x;
      let dz = bPos.z - hPos.z;
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
