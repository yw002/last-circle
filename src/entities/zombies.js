// Zombie AI subsystem

import * as THREE from 'three';
import { state } from '../state.js';
import { MAP_SIZE } from '../config.js';
import { getTerrainHeight, getGroundHeight } from '../world/terrain.js';
import { getHousePlayerIsInside, getHouseObjectIsInside } from './house.js';
import { playZombieSound } from '../systems/audio.js';
import { spawnBlood } from '../systems/particles.js';
import { playerHit } from './player.js';
import { botDied } from './bots.js';
import { createTracerFromPosition } from '../systems/bullets.js';
import { checkEntityCollision, resolveEntityCollisions } from '../systems/collision.js';
import { getNearbyBots, getNearbyColliders, getNearbyDoors } from '../systems/spatial.js';
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
const eyeMat = new THREE.MeshBasicMaterial({ color: 0xeeff44 });
const eyeGlowMat = new THREE.MeshBasicMaterial({ color: 0xaaff22, transparent: true, opacity: 0.6 });
const darkMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
const boneMat = new THREE.MeshLambertMaterial({ color: 0xddccaa });
const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
const tornClothMat = new THREE.MeshLambertMaterial({ color: 0x3a2a1a, side: THREE.DoubleSide });
const bloodDripMat = new THREE.MeshBasicMaterial({ color: 0x8b0000, transparent: true, opacity: 0.8 });
const woundMat = new THREE.MeshLambertMaterial({ color: 0x4a0808, emissive: 0x2a0404, emissiveIntensity: 0.3 });

// ========== MAXIMUM PRECISION ZOMBIE GEOMETRIES ==========
const SEG_Z = 48; // Ultra-high segment count for zombies

// Zombie torso profile - emaciated, ribcage visible
const zombieTorsoProfile = [];
for (let i = 0; i <= 32; i++) {
  const t = i / 32;
  let r;
  if (t < 0.3) r = 1.3 + Math.sin(t * Math.PI / 0.3) * 0.2; // Ribcage
  else if (t < 0.6) r = 1.5 - (t - 0.3) * 2; // Waist (very thin)
  else r = 1.0 + Math.sin((t - 0.6) * Math.PI / 0.4) * 0.2; // Hips
  zombieTorsoProfile.push(new THREE.Vector2(r, t * 3.5 - 1.75));
}

// Zombie head profile - elongated, skull-like
const zombieHeadProfile = [];
for (let i = 0; i <= 32; i++) {
  const t = i / 32;
  let r;
  if (t < 0.2) r = t * 2.5; // Jaw
  else if (t < 0.5) r = 0.5 + Math.sin((t - 0.2) * Math.PI / 0.3) * 0.6; // Cheeks
  else if (t < 0.8) r = 1.1 - (t - 0.5) * 1.0; // Forehead
  else r = 0.8 * (1 - (t - 0.8) * 5); // Top
  zombieHeadProfile.push(new THREE.Vector2(Math.max(0, r), t * 2.2 - 1.1));
}

const zGeos = {
  // Torso - emaciated LatheGeometry
  torsoLower: new THREE.LatheGeometry(zombieTorsoProfile, SEG_Z),
  torsoUpper: new THREE.LatheGeometry(zombieTorsoProfile, SEG_Z),

  // Head - skull-like LatheGeometry
  head: new THREE.LatheGeometry(zombieHeadProfile, SEG_Z),
  skull: new THREE.SphereGeometry(0.6, SEG_Z / 2, SEG_Z / 2),

  // Neck - thin
  neck: new THREE.CylinderGeometry(0.35, 0.45, 0.5, SEG_Z / 2),

  // Eyes - glowing with sockets
  eye: new THREE.SphereGeometry(0.2, SEG_Z / 2, SEG_Z / 2),
  eyeSocket: new THREE.SphereGeometry(0.25, SEG_Z / 2, SEG_Z / 2),
  pupil: new THREE.SphereGeometry(0.1, SEG_Z / 2, SEG_Z / 2),

  // Gore details - high poly
  bloodWound: new THREE.SphereGeometry(0.35, SEG_Z / 2, SEG_Z / 2),
  jaw: new THREE.SphereGeometry(0.4, SEG_Z / 2, SEG_Z / 2),
  teeth: new THREE.BoxGeometry(0.08, 0.12, 0.05),
  rib: new THREE.TorusGeometry(0.8, 0.06, 12, SEG_Z, Math.PI),
  exposedBone: new THREE.CylinderGeometry(0.1, 0.1, 1.5, SEG_Z / 2),
  tornFlesh: new THREE.SphereGeometry(0.3, SEG_Z / 2, SEG_Z / 2),

  // Arms - smooth with joints and muscle
  armUpper: new THREE.CylinderGeometry(0.35, 0.3, 1.8, SEG_Z / 2),
  elbow: new THREE.SphereGeometry(0.28, SEG_Z / 2, SEG_Z / 2),
  armLower: new THREE.CylinderGeometry(0.3, 0.25, 1.6, SEG_Z / 2),
  wrist: new THREE.SphereGeometry(0.2, SEG_Z / 2, SEG_Z / 2),

  // Hands with detailed claws
  hand: new THREE.SphereGeometry(0.25, SEG_Z / 2, SEG_Z / 2),
  claw: new THREE.CylinderGeometry(0.04, 0.02, 0.3, 12),
  fingerBone: new THREE.CylinderGeometry(0.03, 0.03, 0.25, 8),

  // Legs - detailed
  legUpper: new THREE.CylinderGeometry(0.45, 0.4, 2.0, SEG_Z / 2),
  knee: new THREE.SphereGeometry(0.35, SEG_Z / 2, SEG_Z / 2),
  legLower: new THREE.CylinderGeometry(0.4, 0.35, 1.8, SEG_Z / 2),
  ankle: new THREE.SphereGeometry(0.25, SEG_Z / 2, SEG_Z / 2),

  // Boots - torn with soles
  boot: new THREE.CylinderGeometry(0.3, 0.35, 0.9, SEG_Z / 2),
  bootSole: new THREE.BoxGeometry(0.6, 0.1, 1.1),
  bootTongue: new THREE.BoxGeometry(0.25, 0.04, 0.5),

  // Visual effects
  eyeGlow: new THREE.SphereGeometry(0.35, 12, 12),
  tornCloth: new THREE.PlaneGeometry(0.6, 1.2),
  bloodDrip: new THREE.CylinderGeometry(0.06, 0.03, 0.8, 6),
  openWound: new THREE.SphereGeometry(0.25, 8, 8)
};

const ZOMBIE_COUNT = 15; // Finite zombie count — clear them all to win this threat
const _zombieDir = new THREE.Vector3();
const _zombieBloodPos = new THREE.Vector3();
const _zombieUp = new THREE.Vector3(0, 1, 0);
const _zombieBloodOffset = new THREE.Vector3(0, 4, 0);

export function initZombies() {
  // Pick 3-4 specific houses to cluster zombies around (so player can clear them)
  const clusterHouses = [];
  if (state.housePositions.length > 0) {
    const numClusters = Math.min(4, state.housePositions.length);
    const shuffled = [...state.housePositions].sort(() => Math.random() - 0.5);
    for (let c = 0; c < numClusters; c++) {
      clusterHouses.push(shuffled[c]);
    }
  }

  for (let i = 0; i < ZOMBIE_COUNT; i++) {
    const zombieGroup = new THREE.Group();

    let x, z;
    if (clusterHouses.length > 0) {
      // Cluster around specific houses (4-5 per house)
      let house = clusterHouses[i % clusterHouses.length];
      let angle = Math.random() * Math.PI * 2;
      let dist = 12 + Math.random() * 25;
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

    // Arms - outstretched zombie pose with detailed joints
    const armUpperL = new THREE.Mesh(zGeos.armUpper, zombieSkinMat);
    armUpperL.position.set(-2.0, 5.5, 0.8);
    armUpperL.rotation.z = 0.5;
    armUpperL.rotation.x = -0.8;

    // Elbow joint
    const elbowL = new THREE.Mesh(zGeos.elbow, zombieSkinMat);
    elbowL.position.set(-2.4, 5.0, 1.2);

    // Exposed bone on arm
    const boneL = new THREE.Mesh(zGeos.exposedBone, boneMat);
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

    // Elbow joint
    const elbowR = new THREE.Mesh(zGeos.elbow, zombieSkinMat);
    elbowR.position.set(2.4, 5.0, 1.2);

    const armLowerR = new THREE.Mesh(zGeos.armLower, zombieSkinMat);
    armLowerR.position.set(2.8, 5.0, 1.8);
    armLowerR.rotation.z = -0.3;
    armLowerR.rotation.x = -1.2;

    // Hands with claws
    const handL = new THREE.Mesh(zGeos.hand, zombieSkinMat);
    handL.position.set(-3.2, 4.5, 2.5);
    // Claws on left hand
    const clawL1 = new THREE.Mesh(zGeos.claw, zombieSkinMat);
    clawL1.position.set(-3.4, 4.2, 2.7);
    clawL1.rotation.x = -0.5;
    const clawL2 = new THREE.Mesh(zGeos.claw, zombieSkinMat);
    clawL2.position.set(-3.3, 4.2, 2.75);
    clawL2.rotation.x = -0.5;
    const clawL3 = new THREE.Mesh(zGeos.claw, zombieSkinMat);
    clawL3.position.set(-3.2, 4.2, 2.8);
    clawL3.rotation.x = -0.5;

    const handR = new THREE.Mesh(zGeos.hand, zombieSkinMat);
    handR.position.set(3.2, 4.5, 2.5);
    // Claws on right hand
    const clawR1 = new THREE.Mesh(zGeos.claw, zombieSkinMat);
    clawR1.position.set(3.4, 4.2, 2.7);
    clawR1.rotation.x = -0.5;
    const clawR2 = new THREE.Mesh(zGeos.claw, zombieSkinMat);
    clawR2.position.set(3.3, 4.2, 2.75);
    clawR2.rotation.x = -0.5;
    const clawR3 = new THREE.Mesh(zGeos.claw, zombieSkinMat);
    clawR3.position.set(3.2, 4.2, 2.8);
    clawR3.rotation.x = -0.5;

    // Legs with knees - shambling pose
    const legUpperL = new THREE.Mesh(zGeos.legUpper, zombieClothMat);
    legUpperL.position.set(-0.7, 2.5, 0);
    const kneeL = new THREE.Mesh(zGeos.knee, zombieClothMat);
    kneeL.position.set(-0.7, 1.5, 0.1);
    const legLowerL = new THREE.Mesh(zGeos.legLower, zombieClothMat);
    legLowerL.position.set(-0.7, 0.8, 0.3);
    const legUpperR = new THREE.Mesh(zGeos.legUpper, zombieClothMat);
    legUpperR.position.set(0.7, 2.5, 0);
    const kneeR = new THREE.Mesh(zGeos.knee, zombieClothMat);
    kneeR.position.set(0.7, 1.5, 0.1);
    const legLowerR = new THREE.Mesh(zGeos.legLower, zombieClothMat);
    legLowerR.position.set(0.7, 0.8, 0.3);

    // Torn boots with soles
    const bootL = new THREE.Mesh(zGeos.boot, darkMat);
    bootL.position.set(-0.7, 0.2, 0.3);
    const bootSoleL = new THREE.Mesh(zGeos.bootSole, darkMat);
    bootSoleL.position.set(-0.7, 0.05, 0.35);
    const bootR = new THREE.Mesh(zGeos.boot, darkMat);
    bootR.position.set(0.7, 0.2, 0.3);
    const bootSoleR = new THREE.Mesh(zGeos.bootSole, darkMat);
    bootSoleR.position.set(0.7, 0.05, 0.35);

    // Eye glow effect (halo around eyes)
    const eyeGlowL = new THREE.Mesh(zGeos.eyeGlow, eyeGlowMat);
    eyeGlowL.position.set(-0.4, 7.7, 0.85);
    const eyeGlowR = new THREE.Mesh(zGeos.eyeGlow, eyeGlowMat);
    eyeGlowR.position.set(0.4, 7.7, 0.85);

    // Torn clothing strips hanging from body
    const tornStrips = [];
    const stripCount = 2 + Math.floor(Math.random() * 4);
    for (let s = 0; s < stripCount; s++) {
      const strip = new THREE.Mesh(zGeos.tornCloth, tornClothMat);
      const angle = Math.random() * Math.PI * 2;
      const yPos = 3.0 + Math.random() * 3.0;
      strip.position.set(Math.sin(angle) * 1.5, yPos, Math.cos(angle) * 1.0);
      strip.rotation.set(Math.random() * 0.5, angle, Math.random() * 0.3);
      tornStrips.push(strip);
    }

    // Blood drips
    const drips = [];
    const dripCount = 2 + Math.floor(Math.random() * 3);
    for (let d = 0; d < dripCount; d++) {
      const drip = new THREE.Mesh(zGeos.bloodDrip, bloodDripMat);
      const angle = Math.random() * Math.PI * 2;
      const yPos = 4.0 + Math.random() * 4.0;
      drip.position.set(Math.sin(angle) * 1.6, yPos, Math.cos(angle) * 1.2);
      drips.push(drip);
    }

    // Open wounds on body
    const wounds = [];
    const woundCount = 1 + Math.floor(Math.random() * 3);
    for (let w = 0; w < woundCount; w++) {
      const wound = new THREE.Mesh(zGeos.openWound, woundMat);
      const angle = Math.random() * Math.PI * 2;
      const yPos = 3.5 + Math.random() * 3.5;
      wound.position.set(Math.sin(angle) * 1.4, yPos, Math.cos(angle) * 1.0);
      wound.scale.set(0.8 + Math.random() * 0.5, 0.6, 0.8 + Math.random() * 0.5);
      wounds.push(wound);
    }

    // Add all parts
    const zombieModel = new THREE.Group();
    zombieModel.add(
      torsoLower, torsoUpper, neck, head, skull, jaw,
      eyeL, eyeR, eyeGlowL, eyeGlowR, pupilL, pupilR, bloodWound,
      armUpperL, elbowL, armLowerL, boneL, handL, clawL1, clawL2, clawL3,
      armUpperR, elbowR, armLowerR, handR, clawR1, clawR2, clawR3,
      legUpperL, kneeL, legLowerL, bootL, bootSoleL,
      legUpperR, kneeR, legLowerR, bootR, bootSoleR,
      ...tornStrips, ...drips, ...wounds
    );
    zombieGroup.add(zombieModel);

    // Random scale variation (some zombies bigger/smaller)
    const zScale = 0.9 + Math.random() * 0.25;
    zombieGroup.scale.set(zScale, zScale * (0.95 + Math.random() * 0.1), zScale);

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
      bodyMesh: torsoLower,
      headMesh: head,
      bloodWound: bloodWound,
      legL: legLowerL,
      legR: legLowerR,
      health: 110,
      alive: true,
      speed: 18 + Math.random() * 5,
      lastAttack: 0,
      lastThreatGrowl: 0,
      changeDirTime: 0,
      target: null,
      vx: 0, vz: 0
    });
  }
}

export function updateZombies(delta) {
  let now = Date.now();
  let playerPos = state.controls.getObject().position;

  // Cache player house check once per frame
  const playerInsideHouse = getHousePlayerIsInside();
  const playerIsSafe = playerInsideHouse && !playerInsideHouse.isOpen;

  state.zombies.forEach(zombie => {
    if (!zombie.alive) return;

    let zPos = zombie.mesh.position;
    const pdx = zPos.x - playerPos.x;
    const pdz = zPos.z - playerPos.z;
    const playerDistSq = pdx * pdx + pdz * pdz;
    const isNearby = playerDistSq < 400 * 400;

    if (playerDistSq > 650 * 650) {
      zombie.mesh.visible = false;
      return;
    }
    zombie.mesh.visible = true;
    if (!isNearby && (state.frameId + zombie.id) % 4 !== 0) return;
    const stepDelta = isNearby ? delta : delta * 4;

    if (zombie.target === 'player' && playerIsSafe) {
      zombie.target = null;
      zombie.changeDirTime = 0;
    }

    if (now > zombie.changeDirTime) {
      zombie.changeDirTime = now + 1000 + Math.random() * 1000;

      let minDistSq = 400 * 400;
      let closestTarget = null;

      if (state.player.alive && !state.player.isParachuting && !playerIsSafe) {
        let dSq = playerDistSq;
        if (dSq < minDistSq) {
          minDistSq = dSq;
          closestTarget = 'player';
        }
      }

      // Add bounding box rejection for bot search
      const range = Math.sqrt(minDistSq);
      const nearbyBots = getNearbyBots(zPos.x, zPos.z);
      nearbyBots.forEach(bot => {
        if (!bot.alive || bot.isParachuting) return;
        const botPos = bot.mesh.position;
        const dx = Math.abs(zPos.x - botPos.x);
        const dz = Math.abs(zPos.z - botPos.z);
        if (dx > range || dz > range) return;
        let dSq = zPos.distanceToSquared(botPos);
        if (dSq < minDistSq) {
          minDistSq = dSq;
          closestTarget = bot;
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
      let dir = _zombieDir.subVectors(targetPos, zPos);
      dir.y = 0;
      let distXZ = dir.length();
      dir.normalize();
      // 3D distance including height difference
      const dy = targetPos.y - zPos.y;
      const dist3D = Math.sqrt(distXZ * distXZ + dy * dy);

      zombie.vx = dir.x * zombie.speed;
      zombie.vz = dir.z * zombie.speed;

      zombie.mesh.lookAt(targetPos.x, zPos.y, targetPos.z);
      zombie.modelMesh.rotation.z = Math.sin(now * 0.015) * 0.08;

      if (Math.random() < 0.004) {
        playZombieSound('growl', { x: zPos.x, y: zPos.y, z: zPos.z });
      }
      if (zombie.target === 'player' && dist3D < 22 && dist3D >= 6 && now - zombie.lastThreatGrowl > 2600) {
        // Short pre-attack warning makes nearby zombies readable without increasing their damage.
        zombie.lastThreatGrowl = now;
        playZombieSound('growl', { x: zPos.x, y: zPos.y, z: zPos.z });
      }

      // Attack only if close in 3D distance (height difference matters)
      if (dist3D < 6.0) {
        zombie.vx = 0; zombie.vz = 0;

        let targetHouse = zombie.target === 'player' ? getHousePlayerIsInside() : getHouseObjectIsInside(zombie.target.mesh.position);
        let zombieHouse = getHouseObjectIsInside(zPos);
        if (targetHouse !== zombieHouse) {
          return;
        }

        if (now - zombie.lastAttack > 1400) {
          zombie.lastAttack = now;

          spawnBlood(_zombieBloodPos.set(zPos.x, zPos.y + 4.5, zPos.z + 1), _zombieUp);

          if (zombie.target === 'player') {
            playerHit(12, zPos); // Pass zombie position for hit direction
            playZombieSound('bite');
            showNotice("⚠️ 您被丧尸抓咬了！(-12 HP)", "#e74c3c");
          } else {
            // Zombie-vs-bot damage reduced by 20x
            zombie.target.health -= 0.75;
            playZombieSound('bite', { x: zombie.target.mesh.position.x, y: zombie.target.mesh.position.y, z: zombie.target.mesh.position.z });
            spawnBlood(_zombieBloodPos.copy(zombie.target.mesh.position).add(_zombieBloodOffset), _zombieUp);
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
    let newX = zPos.x + zombie.vx * stepDelta;
    let newZ = zPos.z + zombie.vz * stepDelta;

    // Check collision before moving
    const nearbyColliders = getNearbyColliders(zPos.x, zPos.z);
    const nearbyDoors = getNearbyDoors(zPos.x, zPos.z);
    let collision = checkEntityCollision(oldZx, oldZz, newX, newZ, zPos.y, 5, {
      colliders: nearbyColliders,
      doors: nearbyDoors
    });
    if (!collision.blocked) {
      zPos.x = newX;
      zPos.z = newZ;
    } else {
      zPos.x = collision.x;
      zPos.z = collision.z;
      // Bounce away on collision
      zombie.vx = -zombie.vx * 0.5;
      zombie.vz = -zombie.vz * 0.5;
    }
    zPos.y = getGroundHeight(zPos.x, zPos.z, 2);
    resolveEntityCollisions(zPos, 'zombie_' + zombie.id, 2);
    zPos.y = getGroundHeight(zPos.x, zPos.z, 2);

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

  // Show remaining zombie count
  const remaining = state.zombies.filter(z => z.alive).length;
  if (remaining === 0) {
    showNotice("🎉 所有丧尸已清除！", "#2ecc71");
  } else {
    showNotice(`击杀丧尸！剩余 ${remaining}/${ZOMBIE_COUNT}`, "#e74c3c");
  }

  let r = Math.random();
  if (r < 0.4) {
    spawnSingleLoot(zombie.mesh.position.x, zombie.mesh.position.y, zombie.mesh.position.z, 'health');
  } else if (r < 0.8) {
    spawnSingleLoot(zombie.mesh.position.x, zombie.mesh.position.y, zombie.mesh.position.z, 'ammo');
  }

  addKillFeed(`[You] 击杀了一只 [血腥丧尸] (${remaining} 剩余)`);
  updateUI();
}
