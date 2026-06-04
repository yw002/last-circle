// Lightning strike system - dramatic strikes near player

import * as THREE from 'three';
import { state } from '../state.js';
import { getTerrainHeight } from '../world/terrain.js';
import { playThunderSound } from './audio.js';

export function triggerLightningStrike() {
  if (!state.controls) return;

  let playerPos = state.controls.getObject().position;
  let playerDir = new THREE.Vector3();
  state.camera.getWorldDirection(playerDir);

  // Strike very close to player (5-15 units ahead, scary close!)
  let strikeDist = 5 + Math.random() * 10;
  let strikeX = playerPos.x + playerDir.x * strikeDist + (Math.random() - 0.5) * 20;
  let strikeZ = playerPos.z + playerDir.z * strikeDist + (Math.random() - 0.5) * 20;

  createLightningBolt(strikeX, strikeZ);
  playThunderSound();
}

function createLightningBolt(targetX, targetZ) {
  if (state.lightningBoltLine) {
    state.scene.remove(state.lightningBoltLine);
  }

  let startY = 400;
  let endY = getTerrainHeight(targetX, targetZ);

  const points = [];
  let segments = 16;
  let currentX = targetX;
  let currentY = startY;
  let currentZ = targetZ;
  points.push(new THREE.Vector3(currentX, currentY, currentZ));

  for (let i = 1; i <= segments; i++) {
    let t = i / segments;
    let targetY = THREE.MathUtils.lerp(startY, endY, t);

    if (i < segments) {
      currentX = targetX + (Math.random() - 0.5) * 25;
      currentY = targetY;
      currentZ = targetZ + (Math.random() - 0.5) * 25;
    } else {
      currentX = targetX;
      currentY = endY;
      currentZ = targetZ;
    }
    points.push(new THREE.Vector3(currentX, currentY, currentZ));
  }

  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({
    color: 0xffffff,
    linewidth: 4,
    transparent: true,
    opacity: 1.0
  });
  state.lightningBoltLine = new THREE.Line(geo, mat);
  state.scene.add(state.lightningBoltLine);

  // Create impact effect
  createLightningImpact(targetX, endY, targetZ);
}

function createLightningImpact(x, y, z) {
  // Bright flash sphere
  const flashGeo = new THREE.SphereGeometry(10, 16, 16);
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.95
  });
  const flash = new THREE.Mesh(flashGeo, flashMat);
  flash.position.set(x, y + 3, z);
  state.scene.add(flash);

  // Ground glow
  const glowGeo = new THREE.CircleGeometry(20, 16);
  glowGeo.rotateX(-Math.PI / 2);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xffff88,
    transparent: true,
    opacity: 0.7
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.position.set(x, y + 0.2, z);
  state.scene.add(glow);

  // Electric sparks
  for (let i = 0; i < 10; i++) {
    const sparkGeo = new THREE.SphereGeometry(0.4, 4, 4);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0x88ccff });
    const spark = new THREE.Mesh(sparkGeo, sparkMat);
    spark.position.set(x, y + 2, z);
    state.scene.add(spark);

    const angle = (i / 10) * Math.PI * 2;
    const speed = 8 + Math.random() * 15;

    state.bloodParticles.push({
      mesh: spark,
      vx: Math.cos(angle) * speed,
      vy: 5 + Math.random() * 10,
      vz: Math.sin(angle) * speed,
      age: 0
    });
  }

  // Fade out
  let fade = 0;
  const interval = setInterval(() => {
    fade += 0.05;
    flash.material.opacity = 0.95 * (1 - fade);
    glow.material.opacity = 0.7 * (1 - fade);
    if (fade >= 1) {
      clearInterval(interval);
      state.scene.remove(flash);
      state.scene.remove(glow);
    }
  }, 50);
}
