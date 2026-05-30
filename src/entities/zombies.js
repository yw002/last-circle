// Zombie AI subsystem

import * as THREE from 'three';
import { state } from '../state.js';
import { MAP_SIZE } from '../config.js';
import { getTerrainHeight } from '../world/terrain.js';
import { getHousePlayerIsInside, getHouseObjectIsInside } from './house.js';
import { playZombieSound } from '../systems/audio.js';
import { spawnBlood } from '../systems/particles.js';
import { playerHit } from './player.js';
import { botDied } from './bots.js';
import { spawnSingleLoot } from '../world/loot.js';
import { addKillFeed } from '../ui/notices.js';
import { updateUI } from '../ui/hud.js';
import { showNotice } from '../ui/notices.js';

// ========== SHARED RESOURCES (created once) ==========
const zombieSkinMat = new THREE.MeshLambertMaterial({
  color: 0x2d3b2a,
  emissive: 0x182617,
  emissiveIntensity: 0.5,
  side: THREE.DoubleSide
});
const zombieClothMat = new THREE.MeshLambertMaterial({
  color: 0x5a1818,
  emissive: 0x2a0c0c,
  emissiveIntensity: 0.5,
  side: THREE.DoubleSide
});
const zombieDetailMat = new THREE.MeshLambertMaterial({
  color: 0x8b0000,
  emissive: 0x4a0000,
  emissiveIntensity: 0.6,
  side: THREE.DoubleSide
});
const eyeMat = new THREE.MeshBasicMaterial({ color: 0xeeff77 });
const darkMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
const boneMat = new THREE.MeshLambertMaterial({ color: 0xddccaa });
const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

// Shared geometries - reduced segments for performance
const zGeos = {
  torsoLower: new THREE.SphereGeometry(1.6, 8, 6),
  torsoUpper: new THREE.SphereGeometry(1.4, 8, 6),
  head: new THREE.SphereGeometry(1.1, 8, 8),
  skull: new THREE.SphereGeometry(0.6, 6, 6),
  neck: new THREE.CylinderGeometry(0.35, 0.45, 0.5, 6),
  eye: new THREE.SphereGeometry(0.2, 6, 6),
  pupil: new THREE.SphereGeometry(0.1, 6, 6),
  bloodWound: new THREE.SphereGeometry(0.35, 6, 6),
  jaw: new THREE.SphereGeometry(0.4, 6, 6),
  rib: new THREE.TorusGeometry(0.8, 0.06, 4, 8, Math.PI),
  armUpper: new THREE.CylinderGeometry(0.35, 0.3, 1.8, 6),
  armLower: new THREE.CylinderGeometry(0.3, 0.25, 1.6, 6),
  bone: new THREE.CylinderGeometry(0.08, 0.08, 1.2, 4),
  hand: new THREE.SphereGeometry(0.25, 6, 6),
  legUpper: new THREE.CylinderGeometry(0.45, 0.4, 2.0, 6),
  legLower: new THREE.CylinderGeometry(0.4, 0.35, 1.8, 6),
  boot: new THREE.BoxGeometry(0.5, 0.35, 0.9)
};

const ZOMBIE_COUNT = 60; // Reduced from 100

export function initZombies() {
  for (let i = 0; i < ZOMBIE_COUNT; i++) {
    const zombieGroup = new THREE.Group();

    let x, z;
    if (i < 45 && state.housePositions.length > 0) {
      let house = state.housePositions[Math.floor(Math.random() * state.housePositions.length)];
      let angle = Math.random() * Math.PI * 2;
      let dist = 15 + Math.random() * 30;
      x = house.x + Math.cos(angle) * dist;
      z = house.z + Math.sin(angle) * dist;
    } else {
      x = (Math.random() - 0.5) * MAP_SIZE * 0.75;
      z = (Math.random() - 0.5) * MAP_SIZE * 0.75;
    }

    let y = getTerrainHeight(x, z);
    if (y < 2) {
      i--;
      continue;
    }

    // Build zombie using shared geometries
    const torsoLower = new THREE.Mesh(zGeos.torsoLower, zombieClothMat);
    torsoLower.scale.set(1, 0.8, 0.7);
    torsoLower.position.y = 4.0;

    const torsoUpper = new THREE.Mesh(zGeos.torsoUpper, zombieClothMat);
    torsoUpper.scale.set(1, 1.0, 0.7);
    torsoUpper.position.y = 5.5;

    // Exposed ribs
    for (let r = 0; r < 3; r++) {
      const rib = new THREE.Mesh(zGeos.rib, boneMat);
      rib.position.set(0, 4.8 + r * 0.5, 0.6);
      rib.rotation.x = Math.PI / 2;
      zombieGroup.add(rib);
    }

    // Head - sphere with wounds
    const head = new THREE.Mesh(zGeos.head, zombieSkinMat);
    head.position.y = 7.5;

    // Exposed skull
    const skull = new THREE.Mesh(zGeos.skull, boneMat);
    skull.position.set(-0.3, 8.0, 0.2);

    // Neck with exposed tendons
    const neck = new THREE.Mesh(zGeos.neck, zombieSkinMat);
    neck.position.y = 6.8;

    // Glowing eyes
    const eyeL = new THREE.Mesh(zGeos.eye, eyeMat);
    eyeL.position.set(-0.4, 7.7, 0.85);
    const eyeR = new THREE.Mesh(zGeos.eye, eyeMat);
    eyeR.position.set(0.4, 7.7, 0.85);

    // Pupils
    const pupilL = new THREE.Mesh(zGeos.pupil, pupilMat);
    pupilL.position.set(-0.4, 7.7, 1.0);
    const pupilR = new THREE.Mesh(zGeos.pupil, pupilMat);
    pupilR.position.set(0.4, 7.7, 1.0);

    // Blood wound on face
    const bloodWound = new THREE.Mesh(zGeos.bloodWound, zombieDetailMat);
    bloodWound.position.set(0.3, 7.5, 0.9);

    // Jaw hanging
    const jaw = new THREE.Mesh(zGeos.jaw, zombieSkinMat);
    jaw.position.set(0, 6.9, 0.8);
    jaw.scale.set(1, 0.5, 0.8);

    // Arms - outstretched zombie pose with exposed bone
    const armUpperL = new THREE.Mesh(zGeos.armUpper, zombieSkinMat);
    armUpperL.position.set(-2.0, 5.5, 0.8);
    armUpperL.rotation.z = 0.5;
    armUpperL.rotation.x = -0.8;

    // Exposed bone on arm
    const boneL = new THREE.Mesh(zGeos.bone, boneMat);
    boneL.position.set(-2.4, 5.2, 1.3);
    boneL.rotation.z = 0.5;
    boneL.rotation.x = -0.8;

    const armLowerL = new THREE.Mesh(zGeos.armLower, zombieSkinMat);
    armLowerL.position.set(-2.8, 5.0, 1.8);
    armLowerL.rotation.z = 0.3;
    armLowerL.rotation.x = -1.2;

    const armUpperR = new THREE.Mesh(zGeos.armUpper, zombieSkinMat);
    armUpperR.position.set(2.0, 5.5, 0.8);
    armUpperR.rotation.z = -0.5;
    armUpperR.rotation.x = -0.8;

    const armLowerR = new THREE.Mesh(zGeos.armLower, zombieSkinMat);
    armLowerR.position.set(2.8, 5.0, 1.8);
    armLowerR.rotation.z = -0.3;
    armLowerR.rotation.x = -1.2;

    // Hands - claws
    const handL = new THREE.Mesh(zGeos.hand, zombieSkinMat);
    handL.position.set(-3.2, 4.5, 2.5);
    const handR = new THREE.Mesh(zGeos.hand, zombieSkinMat);
    handR.position.set(3.2, 4.5, 2.5);

    // Legs - shambling pose
    const legUpperL = new THREE.Mesh(zGeos.legUpper, zombieClothMat);
    legUpperL.position.set(-0.7, 2.5, 0);
    const legLowerL = new THREE.Mesh(zGeos.legLower, zombieClothMat);
    legLowerL.position.set(-0.7, 0.8, 0.3);
    const legUpperR = new THREE.Mesh(zGeos.legUpper, zombieClothMat);
    legUpperR.position.set(0.7, 2.5, 0);
    const legLowerR = new THREE.Mesh(zGeos.legLower, zombieClothMat);
    legLowerR.position.set(0.7, 0.8, 0.3);

    // Torn boots
    const bootL = new THREE.Mesh(zGeos.boot, darkMat);
    bootL.position.set(-0.7, 0.2, 0.3);
    const bootR = new THREE.Mesh(zGeos.boot, darkMat);
    bootR.position.set(0.7, 0.2, 0.3);

    // Add all parts
    const zombieModel = new THREE.Group();
    zombieModel.add(
      torsoLower, torsoUpper, neck, head, skull, jaw,
      eyeL, eyeR, pupilL, pupilR, bloodWound,
      armUpperL, armLowerL, boneL, handL,
      armUpperR, armLowerR, handR,
      legUpperL, legLowerL, bootL,
      legUpperR, legLowerR, bootR
    );
    zombieGroup.add(zombieModel);

    zombieGroup.position.set(x, y, z);
    state.scene.add(zombieGroup);

    // Enable frustum culling for performance
    zombieGroup.traverse(child => {
      if (child.isMesh) {
        child.frustumCulled = true;
      }
    });

    // Set userData for raycasting
    torsoLower.userData = { isZombie: true, zombieIndex: state.zombies.length, isHeadshot: false };
    torsoUpper.userData = { isZombie: true, zombieIndex: state.zombies.length, isHeadshot: false };
    head.userData = { isZombie: true, zombieIndex: state.zombies.length, isHeadshot: true };
    bloodWound.userData = { isZombie: true, zombieIndex: state.zombies.length, isHeadshot: true };
    state.objects.push(torsoLower, torsoUpper, head, bloodWound);

    state.zombies.push({
      id: state.zombies.length,
      mesh: zombieGroup,
      modelMesh: zombieModel,
      bodyMesh: body,
      headMesh: head,
      bloodWound: bloodWound,
      legL, legR,
      health: 110,
      alive: true,
      speed: 18 + Math.random() * 5,
      lastAttack: 0,
      changeDirTime: 0,
      target: null,
      vx: 0, vz: 0
    });
  }
}

export function updateZombies(delta) {
  let now = Date.now();
  let playerPos = state.controls.getObject().position;

  state.zombies.forEach(zombie => {
    if (!zombie.alive) return;

    let zPos = zombie.mesh.position;

    if (zombie.target === 'player') {
      let insideHouse = getHousePlayerIsInside();
      if (insideHouse && !insideHouse.isOpen) {
        zombie.target = null;
        zombie.changeDirTime = 0;
      }
    }

    if (now > zombie.changeDirTime) {
      zombie.changeDirTime = now + 1000 + Math.random() * 1000;

      let minDistSq = 400 * 400;
      let closestTarget = null;

      if (state.player.alive && !state.player.isParachuting) {
        let insideHouse = getHousePlayerIsInside();
        let targetable = true;
        if (insideHouse && !insideHouse.isOpen) {
          targetable = false;
        }
        if (targetable) {
          let dSq = zPos.distanceToSquared(playerPos);
          if (dSq < minDistSq) {
            minDistSq = dSq;
            closestTarget = 'player';
          }
        }
      }

      state.bots.forEach(bot => {
        if (bot.alive && !bot.isParachuting) {
          let dSq = zPos.distanceToSquared(bot.mesh.position);
          if (dSq < minDistSq) {
            minDistSq = dSq;
            closestTarget = bot;
          }
        }
      });

      zombie.target = closestTarget;

      if (!zombie.target) {
        let angle = Math.random() * Math.PI * 2;
        let s = 10 + Math.random() * 5;
        zombie.vx = Math.cos(angle) * s;
        zombie.vz = Math.sin(angle) * s;
      }
    }

    if (zombie.target) {
      let targetPos = zombie.target === 'player' ? playerPos : zombie.target.mesh.position;
      let dir = new THREE.Vector3().subVectors(targetPos, zPos);
      dir.y = 0;
      let dist = dir.length();
      dir.normalize();

      zombie.vx = dir.x * zombie.speed;
      zombie.vz = dir.z * zombie.speed;

      zombie.mesh.lookAt(targetPos.x, zPos.y, targetPos.z);
      zombie.modelMesh.rotation.z = Math.sin(now * 0.015) * 0.08;

      if (Math.random() < 0.004) {
        playZombieSound('growl', { x: zPos.x, y: zPos.y, z: zPos.z });
      }

      if (dist < 6.0) {
        zombie.vx = 0; zombie.vz = 0;

        let targetHouse = zombie.target === 'player' ? getHousePlayerIsInside() : getHouseObjectIsInside(zombie.target.mesh.position);
        let zombieHouse = getHouseObjectIsInside(zPos);
        if (targetHouse !== zombieHouse) {
          return;
        }

        if (now - zombie.lastAttack > 1400) {
          zombie.lastAttack = now;

          spawnBlood(zPos.clone().add(new THREE.Vector3(0, 4.5, 1)), new THREE.Vector3(0, 1, 0));

          if (zombie.target === 'player') {
            playerHit(12);
            playZombieSound('bite');
            showNotice("⚠️ 您被丧尸抓咬了！(-12 HP)", "#e74c3c");
          } else {
            zombie.target.health -= 15;
            playZombieSound('bite', { x: zombie.target.mesh.position.x, y: zombie.target.mesh.position.y, z: zombie.target.mesh.position.z });
            spawnBlood(zombie.target.mesh.position.clone().add(new THREE.Vector3(0, 4, 0)), new THREE.Vector3(0, 1, 0));
            if (zombie.target.health <= 0) {
              botDied(zombie.target, "丧尸 (Zombie)");
              zombie.target = null;
              zombie.changeDirTime = 0;
            }
          }
        }
      }
    } else {
      zombie.modelMesh.rotation.z = 0;
    }

    // Movement with collision
    let oldZx = zPos.x, oldZz = zPos.z;
    zPos.x += zombie.vx * delta;
    zPos.z += zombie.vz * delta;
    zPos.y = getTerrainHeight(zPos.x, zPos.z);

    let inHouse = getHouseObjectIsInside(zPos);
    if (inHouse) {
      zPos.x = oldZx;
      zPos.z = oldZz;
      zPos.y = getTerrainHeight(zPos.x, zPos.z);
    }

    // House wall collision
    for (let i = 0; i < state.doors.length; i++) {
      let d = state.doors[i];
      let hPos = d.housePos;
      let dx = zPos.x - hPos.x;
      let dz = zPos.z - hPos.z;
      let dy = zPos.y - hPos.y;

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
            zPos.x = oldZx;
            zPos.z = oldZz;
            break;
          }
        }
      }
    }

    // Leg animation
    let moveSpeedSq = zombie.vx * zombie.vx + zombie.vz * zombie.vz;
    if (moveSpeedSq > 1) {
      let freq = zombie.target ? 0.02 : 0.01;
      let swing = Math.sin(now * freq) * 0.55;
      zombie.legL.rotation.x = swing;
      zombie.legR.rotation.x = -swing;
    } else {
      zombie.legL.rotation.x = 0;
      zombie.legR.rotation.x = 0;
    }
  });
}

export function zombieDied(zombie) {
  if (!zombie.alive) return;
  zombie.alive = false;
  state.scene.remove(zombie.mesh);

  let idx1 = state.objects.indexOf(zombie.bodyMesh);
  if (idx1 > -1) state.objects.splice(idx1, 1);
  let idx2 = state.objects.indexOf(zombie.headMesh);
  if (idx2 > -1) state.objects.splice(idx2, 1);
  let idx3 = state.objects.indexOf(zombie.bloodWound);
  if (idx3 > -1) state.objects.splice(idx3, 1);

  state.player.kills++;
  showNotice("击杀血腥丧尸！(+1 击杀)", "#e74c3c");

  let r = Math.random();
  if (r < 0.4) {
    spawnSingleLoot(zombie.mesh.position.x, zombie.mesh.position.y, zombie.mesh.position.z, 'health');
  } else if (r < 0.8) {
    spawnSingleLoot(zombie.mesh.position.x, zombie.mesh.position.y, zombie.mesh.position.z, 'ammo');
  }

  addKillFeed(`[You] 击杀了一只 [血腥丧尸]`);
  updateUI();
}
