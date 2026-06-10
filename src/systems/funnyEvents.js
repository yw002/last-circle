// Random funny events system - triggers random comedic events every 30-60 seconds

import * as THREE from 'three';
import { state } from '../state.js';
import { showNotice } from '../ui/notices.js';
import { playFartSound, playDiscoBeat } from './audio.js';
import { isGiantAlive, getGiantPosition } from '../entities/giant.js';
import { setBotsDancing } from '../entities/bots.js';
import { spawnSingleLoot } from '../world/loot.js';
import { getTerrainHeight } from '../world/terrain.js';

let nextEventTime = 0;
const EVENT_INTERVAL_MIN = 30; // seconds
const EVENT_INTERVAL_MAX = 60; // seconds

// Fish rain state
let fallingFish = [];
const fishGeo = new THREE.SphereGeometry(0.4, 8, 6);
const fishMat = new THREE.MeshLambertMaterial({ color: 0x7fb3d8 });

// Disco state
let discoTimer = 0;
let discoOrigAmbient = null;
let discoOrigDir = null;

const EVENT_NAMES = ['dance', 'fishRain', 'giantFart', 'disco', 'delivery'];

function scheduleNextEvent() {
  nextEventTime = performance.now() / 1000 + EVENT_INTERVAL_MIN + Math.random() * (EVENT_INTERVAL_MAX - EVENT_INTERVAL_MIN);
}

function triggerDance() {
  showNotice('🕺 全体尬舞时间到！放飞自我！', '#ff69b4');
  setBotsDancing(3);
}

function triggerFishRain() {
  showNotice('🐟 天降咸鱼！今天的晚餐有着落了', '#7fb3d8');
  const playerPos = state.controls.getObject().position;
  const count = 15 + Math.floor(Math.random() * 6); // 15-20
  for (let i = 0; i < count; i++) {
    const fish = new THREE.Mesh(fishGeo, fishMat);
    const offsetX = (Math.random() - 0.5) * 200;
    const offsetZ = (Math.random() - 0.5) * 200;
    fish.position.set(
      playerPos.x + offsetX,
      150 + Math.random() * 100,
      playerPos.z + offsetZ
    );
    fish.scale.set(0.7 + Math.random() * 0.6, 0.5 + Math.random() * 0.3, 1.5 + Math.random());
    fish.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    state.scene.add(fish);
    fallingFish.push({
      mesh: fish,
      vy: -20 - Math.random() * 15,
      rotX: (Math.random() - 0.5) * 5,
      rotY: (Math.random() - 0.5) * 5,
      age: 0
    });
  }
}

function triggerGiantFart() {
  if (!isGiantAlive()) {
    // Fallback: if giant is dead, do fish rain instead
    triggerFishRain();
    return;
  }
  showNotice('💨 巨人放了一个惊天大屁！', '#27ae60');
  const gPos = getGiantPosition();
  playFartSound({ x: gPos.x, y: gPos.y, z: gPos.z });

  // Spawn green smoke particles
  for (let i = 0; i < 25; i++) {
    const smokeMat = new THREE.MeshBasicMaterial({
      color: 0x44aa44,
      transparent: true,
      opacity: 0.6
    });
    const smoke = new THREE.Mesh(new THREE.SphereGeometry(3 + Math.random() * 5, 8, 8), smokeMat);
    smoke.position.set(
      gPos.x + (Math.random() - 0.5) * 40,
      gPos.y + 20 + Math.random() * 30,
      gPos.z + (Math.random() - 0.5) * 40
    );
    state.scene.add(smoke);
    state.bloodParticles.push({
      mesh: smoke,
      vx: (Math.random() - 0.5) * 20,
      vy: 5 + Math.random() * 10,
      vz: (Math.random() - 0.5) * 20,
      age: 0
    });
  }
}

function triggerDisco() {
  showNotice('🪩 迪斯科模式！Everybody dance now!', '#ff00ff');
  discoTimer = 5;
  discoOrigAmbient = state.ambLight ? state.ambLight.color.clone() : null;
  discoOrigDir = state.dirLight ? state.dirLight.color.clone() : null;
  playDiscoBeat();
}

function triggerDelivery() {
  showNotice('📦 外卖到了！请签收您的快递！', '#f39c12');
  const playerPos = state.controls.getObject().position;
  const count = 3 + Math.floor(Math.random() * 3); // 3-5
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 20 + Math.random() * 30;
    const lx = playerPos.x + Math.cos(angle) * dist;
    const lz = playerPos.z + Math.sin(angle) * dist;
    const ly = getTerrainHeight(lx, lz) + 1;
    spawnSingleLoot(lx, ly, lz, null, 1.5);
  }
}

export function updateFunnyEvents(delta) {
  if (!state.gameStarted || !state.player.alive) return;

  const now = performance.now() / 1000;

  // Schedule first event
  if (nextEventTime === 0) {
    scheduleNextEvent();
  }

  // Trigger random event
  if (now >= nextEventTime) {
    const eventName = EVENT_NAMES[Math.floor(Math.random() * EVENT_NAMES.length)];
    switch (eventName) {
      case 'dance': triggerDance(); break;
      case 'fishRain': triggerFishRain(); break;
      case 'giantFart': triggerGiantFart(); break;
      case 'disco': triggerDisco(); break;
      case 'delivery': triggerDelivery(); break;
    }
    scheduleNextEvent();
  }

  // Update falling fish
  for (let i = fallingFish.length - 1; i >= 0; i--) {
    const f = fallingFish[i];
    f.age += delta;
    f.mesh.position.y += f.vy * delta;
    f.mesh.rotation.x += f.rotX * delta;
    f.mesh.rotation.y += f.rotY * delta;

    const groundY = getTerrainHeight(f.mesh.position.x, f.mesh.position.z);
    if (f.mesh.position.y <= groundY + 0.5) {
      f.mesh.position.y = groundY + 0.5;
      f.vy = 0;
      f.rotX = 0;
      f.rotY = 0;
    }

    // Remove after 8 seconds
    if (f.age > 8) {
      state.scene.remove(f.mesh);
      fallingFish.splice(i, 1);
    }
  }

  // Update disco mode
  if (discoTimer > 0) {
    discoTimer -= delta;
    const t = performance.now() / 200;
    const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xff00ff, 0xffff00, 0x00ffff];
    const ci = Math.floor(t) % colors.length;
    if (state.ambLight) state.ambLight.color.setHex(colors[ci]);
    if (state.dirLight) state.dirLight.color.setHex(colors[(ci + 2) % colors.length]);

    if (discoTimer <= 0) {
      // Restore original colors
      if (state.ambLight && discoOrigAmbient) state.ambLight.color.copy(discoOrigAmbient);
      if (state.dirLight && discoOrigDir) state.dirLight.color.copy(discoOrigDir);
      discoOrigAmbient = null;
      discoOrigDir = null;
    }
  }
}
