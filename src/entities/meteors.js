// Meteor/Asteroid falling system - fire and sparks, very dramatic!

import * as THREE from 'three';
import { state } from '../state.js';
import { getTerrainHeight } from '../world/terrain.js';
import { playSound } from '../systems/audio.js';

let meteors = [];
let meteorTimer = 0;
let nextMeteorTime = 10 + Math.random() * 10; // 10-20 seconds between meteors

// Shared resources
const meteorGeo = new THREE.SphereGeometry(3, 12, 12);
const meteorMat = new THREE.MeshBasicMaterial({
  color: 0xff4400,
  emissive: 0xff2200,
  emissiveIntensity: 1.0
});

const fireGeo = new THREE.SphereGeometry(4, 8, 8);
const fireMat = new THREE.MeshBasicMaterial({
  color: 0xff6600,
  transparent: true,
  opacity: 0.7
});

function createMeteor() {
  // Random position near player
  let playerPos = state.controls.getObject().position;
  let playerDir = new THREE.Vector3();
  state.camera.getWorldDirection(playerDir);

  // Spawn in sky near player (30-80 units away)
  let spawnDist = 30 + Math.random() * 50;
  let spawnX = playerPos.x + playerDir.x * spawnDist + (Math.random() - 0.5) * 60;
  let spawnZ = playerPos.z + playerDir.z * spawnDist + (Math.random() - 0.5) * 60;
  let spawnY = 300 + Math.random() * 200;

  // Target position near player (10-30 units away)
  let targetX = playerPos.x + (Math.random() - 0.5) * 60;
  let targetZ = playerPos.z + (Math.random() - 0.5) * 60;
  let targetY = getTerrainHeight(targetX, targetZ);

  // Create meteor mesh
  const meteor = new THREE.Mesh(meteorGeo, meteorMat.clone());
  meteor.position.set(spawnX, spawnY, spawnZ);
  state.scene.add(meteor);

  // Create fire trail
  const fireTrail = new THREE.Mesh(fireGeo, fireMat.clone());
  fireTrail.position.copy(meteor.position);
  state.scene.add(fireTrail);

  // Create sparks
  const sparks = [];
  for (let i = 0; i < 6; i++) {
    const sparkGeo = new THREE.SphereGeometry(0.5, 4, 4);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    const spark = new THREE.Mesh(sparkGeo, sparkMat);
    spark.position.copy(meteor.position);
    state.scene.add(spark);
    sparks.push(spark);
  }

  const meteorObj = {
    mesh: meteor,
    fireTrail: fireTrail,
    sparks: sparks,
    startPos: new THREE.Vector3(spawnX, spawnY, spawnZ),
    targetPos: new THREE.Vector3(targetX, targetY, targetZ),
    progress: 0,
    speed: 1.5 + Math.random() * 1.0, // 1.5-2.5 seconds to fall
    active: true
  };

  meteors.push(meteorObj);
  return meteorObj;
}

function createMeteorExplosion(x, y, z) {
  // Create explosion flash
  const flashGeo = new THREE.SphereGeometry(15, 16, 16);
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xff4400,
    transparent: true,
    opacity: 0.9
  });
  const flash = new THREE.Mesh(flashGeo, flashMat);
  flash.position.set(x, y + 5, z);
  state.scene.add(flash);

  // Ground crater glow
  const craterGeo = new THREE.CircleGeometry(20, 16);
  craterGeo.rotateX(-Math.PI / 2);
  const craterMat = new THREE.MeshBasicMaterial({
    color: 0xff6600,
    transparent: true,
    opacity: 0.7
  });
  const crater = new THREE.Mesh(craterGeo, craterMat);
  crater.position.set(x, y + 0.2, z);
  state.scene.add(crater);

  // Explosion sparks
  for (let i = 0; i < 12; i++) {
    const sparkGeo = new THREE.SphereGeometry(0.8, 4, 4);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    const spark = new THREE.Mesh(sparkGeo, sparkMat);
    spark.position.set(x, y + 2, z);
    state.scene.add(spark);

    const angle = (i / 12) * Math.PI * 2;
    const speed = 10 + Math.random() * 20;
    const vx = Math.cos(angle) * speed;
    const vz = Math.sin(angle) * speed;
    const vy = 8 + Math.random() * 15;

    state.bloodParticles.push({
      mesh: spark,
      vx: vx,
      vy: vy,
      vz: vz,
      age: 0
    });
  }

  // Smoke ring
  const smokeGeo = new THREE.TorusGeometry(8, 2, 8, 16);
  const smokeMat = new THREE.MeshBasicMaterial({
    color: 0x333333,
    transparent: true,
    opacity: 0.6
  });
  const smoke = new THREE.Mesh(smokeGeo, smokeMat);
  smoke.position.set(x, y + 10, z);
  smoke.rotation.x = Math.PI / 2;
  state.scene.add(smoke);

  // Fade out effects
  let fadeProgress = 0;
  const fadeInterval = setInterval(() => {
    fadeProgress += 0.03;
    flash.material.opacity = 0.9 * (1 - fadeProgress);
    crater.material.opacity = 0.7 * (1 - fadeProgress);
    smoke.material.opacity = 0.6 * (1 - fadeProgress);
    smoke.position.y += 0.5;
    smoke.scale.x += 0.02;
    smoke.scale.z += 0.02;

    if (fadeProgress >= 1) {
      clearInterval(fadeInterval);
      state.scene.remove(flash);
      state.scene.remove(crater);
      state.scene.remove(smoke);
    }
  }, 50);

  // Play explosion sound
  playSound('shotgun', { x, y, z });
}

export function updateMeteors(delta) {
  meteorTimer += delta;

  // Spawn new meteor
  if (meteorTimer > nextMeteorTime) {
    meteorTimer = 0;
    nextMeteorTime = 10 + Math.random() * 10; // 10-20 seconds between meteors
    createMeteor();
  }

  // Update existing meteors
  for (let i = meteors.length - 1; i >= 0; i--) {
    const meteor = meteors[i];
    if (!meteor.active) continue;

    meteor.progress += delta / meteor.speed;

    // Interpolate position along path
    const t = Math.min(meteor.progress, 1);
    const easedT = t * t; // Accelerate as it falls

    meteor.mesh.position.lerpVectors(meteor.startPos, meteor.targetPos, easedT);
    meteor.fireTrail.position.copy(meteor.mesh.position);

    // Scale fire trail based on progress
    const fireScale = 1 + t * 2;
    meteor.fireTrail.scale.set(fireScale, fireScale, fireScale);

    // Update sparks
    meteor.sparks.forEach((spark, idx) => {
      const sparkAngle = (idx / meteor.sparks.length) * Math.PI * 2 + meteor.progress * 10;
      const sparkDist = 3 + Math.sin(meteor.progress * 20 + idx) * 2;
      spark.position.set(
        meteor.mesh.position.x + Math.cos(sparkAngle) * sparkDist,
        meteor.mesh.position.y + Math.sin(sparkAngle * 2) * 2,
        meteor.mesh.position.z + Math.sin(sparkAngle) * sparkDist
      );
    });

    // Rotation
    meteor.mesh.rotation.x += delta * 3;
    meteor.mesh.rotation.y += delta * 2;

    // Hit ground
    if (meteor.progress >= 1) {
      meteor.active = false;
      state.scene.remove(meteor.mesh);
      state.scene.remove(meteor.fireTrail);
      meteor.sparks.forEach(s => state.scene.remove(s));

      // Create explosion
      createMeteorExplosion(
        meteor.targetPos.x,
        meteor.targetPos.y,
        meteor.targetPos.z
      );

      // Remove from array
      meteors.splice(i, 1);
    }
  }
}
