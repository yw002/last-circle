// Volcano and Earthquake system
// Massive Fuji-like volcano erupts when half enemies are defeated

import * as THREE from 'three';
import { state } from '../state.js';
import { MAP_SIZE } from '../config.js';
import { getTerrainHeight } from '../world/terrain.js';
import { playerHit } from './player.js';
import { showNotice } from '../ui/notices.js';

let volcanoGroup = null;
let volcanoX = 0;
let volcanoZ = 0;
let eruptionActive = false;
let eruptionParticles = [];
let earthquakeTimer = 0;
let earthquakeActive = false;
let earthquakeEndTime = 0;
let volcanoTriggered = false;
let lavaFlows = [];

// Create the massive Fuji-like volcano
export function initVolcano() {
  // Place volcano at edge of map
  volcanoX = MAP_SIZE * 0.4;
  volcanoZ = MAP_SIZE * 0.4;

  volcanoGroup = new THREE.Group();

  // Main mountain body - massive cone
  const mountainGeo = new THREE.ConeGeometry(400, 600, 32, 1);
  const mountainMat = new THREE.MeshLambertMaterial({ color: 0x4a4a4a });
  const mountain = new THREE.Mesh(mountainGeo, mountainMat);
  mountain.position.y = 300;
  volcanoGroup.add(mountain);

  // Snow cap
  const snowCapGeo = new THREE.ConeGeometry(100, 100, 16, 1);
  const snowMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const snowCap = new THREE.Mesh(snowCapGeo, snowMat);
  snowCap.position.y = 550;
  volcanoGroup.add(snowCap);

  // Crater (dark ring at top)
  const craterGeo = new THREE.TorusGeometry(60, 15, 8, 16);
  const craterMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const crater = new THREE.Mesh(craterGeo, craterMat);
  crater.position.y = 580;
  crater.rotation.x = Math.PI / 2;
  volcanoGroup.add(crater);

  // Lava pool in crater (initially dim)
  const lavaGeo = new THREE.CircleGeometry(55, 16);
  lavaGeo.rotateX(-Math.PI / 2);
  const lavaMat = new THREE.MeshBasicMaterial({
    color: 0xff2200,
    transparent: true,
    opacity: 0.3
  });
  const lava = new THREE.Mesh(lavaGeo, lavaMat);
  lava.position.y = 575;
  lava.userData.isLava = true;
  volcanoGroup.add(lava);

  // Base rocks
  const baseRockGeo = new THREE.DodecahedronGeometry(50, 1);
  const baseRockMat = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const rock = new THREE.Mesh(baseRockGeo, baseRockMat);
    rock.position.set(Math.cos(angle) * 350, 10, Math.sin(angle) * 350);
    rock.scale.set(1 + Math.random(), 0.5 + Math.random() * 0.5, 1 + Math.random());
    volcanoGroup.add(rock);
  }

  volcanoGroup.position.set(volcanoX, 0, volcanoZ);
  state.scene.add(volcanoGroup);
}

// Trigger eruption when reaching wave 15
export function updateVolcano(delta) {
  if (!volcanoTriggered && state.wave.number >= 15) {
    volcanoTriggered = true;
    eruptionActive = true;
    showNotice("🌋 火山喷发！富士山开始爆发！", "#ff4400");
  }

  if (!volcanoGroup) return;

  // Animate lava glow
  volcanoGroup.children.forEach(child => {
    if (child.userData && child.userData.isLava) {
      if (eruptionActive) {
        child.material.opacity = 0.5 + Math.sin(Date.now() * 0.005) * 0.3;
        child.material.color.setHex(0xff4400);
      }
    }
  });

  // Eruption particles
  if (eruptionActive) {
    // Spawn eruption particles
    if (Math.random() < 0.3) {
      spawnEruptionParticle();
    }

    // Update eruption particles
    for (let i = eruptionParticles.length - 1; i >= 0; i--) {
      const p = eruptionParticles[i];
      p.age += delta;

      p.mesh.position.x += p.vx * delta;
      p.mesh.position.y += p.vy * delta;
      p.mesh.position.z += p.vz * delta;
      p.vy -= 30 * delta; // Gravity

      // Fade out
      p.mesh.material.opacity = Math.max(0, 1 - p.age / p.lifetime);

      if (p.age > p.lifetime) {
        state.scene.remove(p.mesh);
        eruptionParticles.splice(i, 1);
      }
    }

    // Earthquake effect
    if (!earthquakeActive && Math.random() < 0.005) {
      startEarthquake();
    }
  }

  // Update earthquake
  if (earthquakeActive) {
    if (Date.now() > earthquakeEndTime) {
      earthquakeActive = false;
    } else {
      // Shake camera
      const intensity = 0.5;
      state.camera.position.x += (Math.random() - 0.5) * intensity;
      state.camera.position.z += (Math.random() - 0.5) * intensity;
    }
  }
}

function spawnEruptionParticle() {
  if (eruptionParticles.length > 100) return;

  const types = ['fire', 'rock', 'smoke'];
  const type = types[Math.floor(Math.random() * types.length)];

  let geo, mat;
  switch (type) {
    case 'fire':
      geo = new THREE.SphereGeometry(1 + Math.random() * 2, 6, 6);
      mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(1, 0.3 + Math.random() * 0.5, 0),
        transparent: true,
        opacity: 0.9
      });
      break;
    case 'rock':
      geo = new THREE.DodecahedronGeometry(0.5 + Math.random() * 1.5, 0);
      mat = new THREE.MeshLambertMaterial({ color: 0x333333 });
      break;
    case 'smoke':
      geo = new THREE.SphereGeometry(2 + Math.random() * 3, 6, 6);
      mat = new THREE.MeshBasicMaterial({
        color: 0x444444,
        transparent: true,
        opacity: 0.5
      });
      break;
  }

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(
    volcanoX + (Math.random() - 0.5) * 40,
    580,
    volcanoZ + (Math.random() - 0.5) * 40
  );
  state.scene.add(mesh);

  const speed = 30 + Math.random() * 50;
  const angle = Math.random() * Math.PI * 2;
  const spread = 0.2 + Math.random() * 0.3;

  eruptionParticles.push({
    mesh: mesh,
    vx: Math.cos(angle) * speed * spread,
    vy: speed + Math.random() * 30,
    vz: Math.sin(angle) * speed * spread,
    age: 0,
    lifetime: 3 + Math.random() * 4
  });
}

function startEarthquake() {
  earthquakeActive = true;
  earthquakeEndTime = Date.now() + 10000; // 10 seconds
  showNotice("🌍 地震！大地在颤抖！", "#ffaa00");
}
