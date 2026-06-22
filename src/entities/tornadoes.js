// Tornado system - massive, moving toward zone center, damages nearby players

import * as THREE from 'three';
import { state } from '../state.js';
import { MAP_SIZE } from '../config.js';
import { getTerrainHeight } from '../world/terrain.js';
import { playerHit } from './player.js';
import { showNotice } from '../ui/notices.js';

let tornadoes = [];
let tornadoTimer = 0;
let nextTornadoTime = 60 + Math.random() * 60;

function createTornado() {
  let playerPos = state.controls.getObject().position;

  // Spawn tornado 150-300 units from player
  let angle = Math.random() * Math.PI * 2;
  let dist = 150 + Math.random() * 150;
  let x = playerPos.x + Math.cos(angle) * dist;
  let z = playerPos.z + Math.sin(angle) * dist;
  let y = getTerrainHeight(x, z);

  const tornadoGroup = new THREE.Group();

  // Create tornado with multiple spinning rings
  const ringCount = 40; // More rings for denser look
  for (let i = 0; i < ringCount; i++) {
    const t = i / ringCount;
    const radius = 3 + t * 25; // Wider at top
    const height = t * 250; // 250 units tall - MASSIVE

    // Multiple rings per level for density
    for (let j = 0; j < 3; j++) {
      const ringGeo = new THREE.TorusGeometry(radius + j * 0.5, 1.0 + t * 0.5, 8, 16);
      const opacity = 0.2 + t * 0.3;
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x666666,
        transparent: true,
        opacity: opacity,
        side: THREE.DoubleSide
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = height;
      ring.rotation.x = Math.PI / 2;
      ring.userData.baseAngle = (j / 3) * Math.PI * 2;
      tornadoGroup.add(ring);
    }
  }

  // Dust cloud at base
  const dustGeo = new THREE.SphereGeometry(15, 12, 12);
  const dustMat = new THREE.MeshBasicMaterial({
    color: 0x8b7355,
    transparent: true,
    opacity: 0.5
  });
  const dust = new THREE.Mesh(dustGeo, dustMat);
  dust.position.y = 5;
  dust.scale.y = 0.3;
  tornadoGroup.add(dust);

  // Debris flying around
  const debrisColors = [0x8b7355, 0x555555, 0x4a3728, 0x228b22];
  for (let i = 0; i < 40; i++) {
    const debrisGeo = new THREE.BoxGeometry(
      0.3 + Math.random() * 0.5,
      0.3 + Math.random() * 0.5,
      0.3 + Math.random() * 0.5
    );
    const debrisMat = new THREE.MeshLambertMaterial({
      color: debrisColors[Math.floor(Math.random() * debrisColors.length)]
    });
    const debris = new THREE.Mesh(debrisGeo, debrisMat);
    debris.userData.angle = Math.random() * Math.PI * 2;
    debris.userData.radius = 5 + Math.random() * 20;
    debris.userData.height = Math.random() * 200;
    debris.userData.speed = 1 + Math.random() * 3;
    tornadoGroup.add(debris);
  }

  // Inner glow (energy core)
  const coreGeo = new THREE.CylinderGeometry(1, 3, 200, 8, 1, true);
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0x4488ff,
    transparent: true,
    opacity: 0.1,
    side: THREE.DoubleSide
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.position.y = 100;
  tornadoGroup.add(core);

  tornadoGroup.position.set(x, y, z);
  state.scene.add(tornadoGroup);

  const tornado = {
    mesh: tornadoGroup,
    x: x,
    z: z,
    vx: 0,
    vz: 0,
    rotation: 0,
    life: 60 + Math.random() * 60, // 60-120 seconds
    age: 0,
    lastDamageTime: 0,
    active: true
  };

  tornadoes.push(tornado);
  return tornado;
}

export function updateTornadoes(delta) {
  tornadoTimer += delta;

  // Spawn new tornado
  if (tornadoTimer > nextTornadoTime && tornadoes.length < 2) {
    tornadoTimer = 0;
    nextTornadoTime = 90 + Math.random() * 60;
    createTornado();
  }

  let playerPos = state.controls.getObject().position;

  for (let i = tornadoes.length - 1; i >= 0; i--) {
    const tornado = tornadoes[i];
    if (!tornado.active) continue;

    tornado.age += delta;

    // Move toward player
    const playerPos = state.controls.getObject().position;
    let dx = playerPos.x - tornado.x;
    let dz = playerPos.z - tornado.z;
    let dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > 50) {
      tornado.vx = (dx / dist) * 15;
      tornado.vz = (dz / dist) * 15;
    } else {
      // Wander near zone center
      tornado.vx += (Math.random() - 0.5) * 2;
      tornado.vz += (Math.random() - 0.5) * 2;
      tornado.vx *= 0.95;
      tornado.vz *= 0.95;
    }

    tornado.x += tornado.vx * delta;
    tornado.z += tornado.vz * delta;
    tornado.mesh.position.x = tornado.x;
    tornado.mesh.z = tornado.z;
    tornado.mesh.position.y = getTerrainHeight(tornado.x, tornado.z);

    // Rotate tornado
    tornado.rotation += delta * 3;
    tornado.mesh.rotation.y = tornado.rotation;

    // Animate rings
    tornado.mesh.children.forEach((child, idx) => {
      if (child.isMesh && child.geometry.type === 'TorusGeometry') {
        child.rotation.z += delta * (2 + idx * 0.05);
        child.position.x = Math.sin(tornado.age * 3 + child.userData.baseAngle) * 2;
        child.position.z = Math.cos(tornado.age * 3 + child.userData.baseAngle) * 2;
      }
    });

    // Animate debris
    tornado.mesh.children.forEach((child) => {
      if (child.userData.angle !== undefined) {
        child.userData.angle += delta * child.userData.speed;
        child.position.x = Math.cos(child.userData.angle) * child.userData.radius;
        child.position.z = Math.sin(child.userData.angle) * child.userData.radius;
        child.userData.height = (child.userData.height + delta * 15) % 200;
        child.position.y = child.userData.height;
        child.rotation.x += delta * 5;
        child.rotation.y += delta * 3;
      }
    });

    // Damage player if too close (3 units)
    let playerDist = Math.sqrt(
      Math.pow(tornado.x - playerPos.x, 2) +
      Math.pow(tornado.z - playerPos.z, 2)
    );

    if (playerDist < 3.0 && Date.now() - tornado.lastDamageTime > 1000) {
      tornado.lastDamageTime = Date.now();
      playerHit(5);
      showNotice("🌪️ 被龙卷风卷入！(-5 HP)", "#8888ff");
    }

    // Lifetime
    if (tornado.age > tornado.life) {
      tornado.active = false;
      state.scene.remove(tornado.mesh);
      tornadoes.splice(i, 1);
    }
  }
}
