// Dynamic weather system with scripted events
// Sunny → Storm+Meteors (50s) → Blizzard+Lightning (120s) → Sunny (5 enemies left)

import * as THREE from 'three';
import { state } from '../state.js';
import { MAP_SIZE } from '../config.js';
import { getTerrainHeight } from '../world/terrain.js';
import { addKillFeed } from '../ui/notices.js';
import { playThunderSound } from './audio.js';
import { triggerLightningStrike } from './lightning.js';

// Weather states
const WEATHER = {
  SUNNY: 'sunny',
  STORM: 'storm',
  BLIZZARD: 'blizzard'
};

let currentWeather = WEATHER.SUNNY;
let gameStartTime = 0;
let weatherInitialized = false;
let lastLightningStrikeTime = 0;

// Snow particles
let snowParticles = [];

export function initClouds() {
  const cloudGeo = new THREE.SphereGeometry(1, 8, 8);
  const cloudMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.8
  });

  for (let i = 0; i < 120; i++) {
    const cloudGroup = new THREE.Group();
    let numParts = 4 + Math.floor(Math.random() * 5);
    for (let j = 0; j < numParts; j++) {
      const part = new THREE.Mesh(cloudGeo, cloudMat);
      let scale = 25 + Math.random() * 50;
      part.scale.set(scale, scale * 0.5, scale);
      part.position.set(
        (Math.random() - 0.5) * 100,
        (Math.random() - 0.5) * 25,
        (Math.random() - 0.5) * 60
      );
      cloudGroup.add(part);
    }

    cloudGroup.position.set(
      (Math.random() - 0.5) * MAP_SIZE * 1.5,
      300 + Math.random() * 300,
      (Math.random() - 0.5) * MAP_SIZE * 1.5
    );

    cloudGroup.userData.speed = 1 + Math.random() * 2;
    state.clouds.push(cloudGroup);
    state.scene.add(cloudGroup);
  }
}

function setWeatherSunny() {
  currentWeather = WEATHER.SUNNY;
  removeRain();
  removeSnow();
  addKillFeed("<span style='color:#f1c40f'>☀️ 天气转晴，阳光明媚！</span>");
}

function setWeatherStorm() {
  currentWeather = WEATHER.STORM;
  createRain();
  removeSnow();
  addKillFeed("<span style='color:#e74c3c'>⛈️ 暴风雨来袭！电闪雷鸣！陨石坠落！</span>");
}

function setWeatherBlizzard() {
  currentWeather = WEATHER.BLIZZARD;
  removeRain();
  createSnow();
  addKillFeed("<span style='color:#dfe6e9'>❄️ 暴风雪来袭！雷电交加！</span>");
}

function createRain() {
  if (state.rainParticles.length > 0) return;

  const rainMat = new THREE.PointsMaterial({
    color: 0x90a9e1,
    size: 0.8,
    transparent: true,
    opacity: 0.7,
    depthWrite: false
  });

  for (let c = 0; c < 3; c++) {
    const rainGeo = new THREE.BufferGeometry();
    const rainCount = 3000;
    const positions = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 500;
      positions[i * 3 + 1] = Math.random() * 300;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 500;
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const rain = new THREE.Points(rainGeo, rainMat);
    rain.position.y = 100 + c * 100;
    state.rainParticles.push(rain);
    state.scene.add(rain);
  }
}

function removeRain() {
  state.rainParticles.forEach(rain => state.scene.remove(rain));
  state.rainParticles = [];
}

function createSnow() {
  if (snowParticles.length > 0) return;

  const snowMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 1.5,
    transparent: true,
    opacity: 0.9,
    depthWrite: false
  });

  for (let c = 0; c < 3; c++) {
    const snowGeo = new THREE.BufferGeometry();
    const snowCount = 3000;
    const positions = new Float32Array(snowCount * 3);
    for (let i = 0; i < snowCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 600;
      positions[i * 3 + 1] = Math.random() * 400;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 600;
    }
    snowGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const snow = new THREE.Points(snowGeo, snowMat);
    snow.position.y = 100 + c * 150;
    snowParticles.push(snow);
    state.scene.add(snow);
  }
}

function removeSnow() {
  snowParticles.forEach(snow => state.scene.remove(snow));
  snowParticles = [];
}

export function updateWeather(delta) {
  if (!weatherInitialized) {
    gameStartTime = performance.now();
    weatherInitialized = true;
  }

  let elapsed = (performance.now() - gameStartTime) / 1000;
  let playerPos = state.controls.getObject().position;

  // Weather state machine based on time and enemy count
  if (state.aliveCount <= 4 && currentWeather !== WEATHER.SUNNY) {
    // Last 3 enemies - return to sunny
    setWeatherSunny();
  } else if (elapsed > 120 && currentWeather !== WEATHER.BLIZZARD && state.aliveCount > 6) {
    // 2 minutes - blizzard with lightning
    setWeatherBlizzard();
  } else if (elapsed > 50 && currentWeather === WEATHER.SUNNY && state.aliveCount > 6) {
    // 50 seconds - storm with meteors
    setWeatherStorm();
  }

  // Update sky/fog based on weather
  let targetSky, targetFog, targetDensity;
  switch (currentWeather) {
    case WEATHER.SUNNY:
      targetSky = new THREE.Color(0x87CEEB);
      targetFog = new THREE.Color(0x87CEEB);
      targetDensity = 0.001;
      break;
    case WEATHER.STORM:
      targetSky = new THREE.Color(0x1a212a);
      targetFog = new THREE.Color(0x1a212a);
      targetDensity = 0.002;
      break;
    case WEATHER.BLIZZARD:
      targetSky = new THREE.Color(0xc8d6e5);
      targetFog = new THREE.Color(0xc8d6e5);
      targetDensity = 0.003;
      break;
  }

  state.scene.background.lerp(targetSky, delta * 0.5);
  state.scene.fog.color.lerp(targetFog, delta * 0.5);
  state.scene.fog.density = THREE.MathUtils.lerp(state.scene.fog.density, targetDensity, delta * 0.5);

  // Update clouds
  let speedMult = currentWeather === WEATHER.STORM ? 4.0 : (currentWeather === WEATHER.BLIZZARD ? 2.0 : 1.0);
  state.clouds.forEach(cloud => {
    cloud.position.x += cloud.userData.speed * delta * 10 * speedMult;
    if (cloud.position.x > MAP_SIZE) cloud.position.x = -MAP_SIZE;
  });

  // Update rain
  state.rainParticles.forEach(rain => {
    rain.position.x = playerPos.x;
    rain.position.z = playerPos.z;
    rain.position.y -= 380 * delta;
    if (rain.position.y < -150) rain.position.y = 180;
  });

  // Update snow
  snowParticles.forEach(snow => {
    snow.position.x = playerPos.x + Math.sin(elapsed * 0.5) * 50;
    snow.position.z = playerPos.z + Math.cos(elapsed * 0.3) * 50;
    snow.position.y -= 60 * delta;
    if (snow.position.y < -150) snow.position.y = 200;
  });

  // Lightning during storm and blizzard
  if ((currentWeather === WEATHER.STORM || currentWeather === WEATHER.BLIZZARD)) {
    const now = Date.now();
    // Keep lightning atmospheric: random, but with a real cooldown so it does not spam the player.
    if (!state.isLightningFlashing && now - lastLightningStrikeTime > 9000 && Math.random() < 0.0025) {
      state.isLightningFlashing = true;
      state.lightningFlashTime = now;
      lastLightningStrikeTime = now;
      triggerLightningStrike();
    }

    if (state.isLightningFlashing) {
      let elapsed2 = Date.now() - state.lightningFlashTime;
      if (elapsed2 < 80) {
        state.scene.background.setHex(0xffffff);
        state.scene.fog.color.setHex(0xffffff);
        if (state.ambLight) state.ambLight.intensity = 5.0;
        if (state.dirLight) state.dirLight.intensity = 5.0;
      } else if (elapsed2 < 150) {
        state.scene.background.setHex(0x0a0a0a);
        state.scene.fog.color.setHex(0x0a0a0a);
        if (state.ambLight) state.ambLight.intensity = 0.1;
        if (state.dirLight) state.dirLight.intensity = 0.1;
      } else if (elapsed2 < 220) {
        state.scene.background.setHex(0xb5e0ff);
        state.scene.fog.color.setHex(0xb5e0ff);
        if (state.ambLight) state.ambLight.intensity = 3.0;
        if (state.dirLight) state.dirLight.intensity = 3.0;
      } else {
        state.isLightningFlashing = false;
        if (state.ambLight) state.ambLight.intensity = currentWeather === WEATHER.STORM ? 0.3 : 0.5;
        if (state.dirLight) state.dirLight.intensity = currentWeather === WEATHER.STORM ? 0.2 : 0.4;
      }
    }
  }

  // Ambient light based on weather
  if (!state.isLightningFlashing) {
    let targetAmb = 0.8;
    let targetDir = 0.6;
    switch (currentWeather) {
      case WEATHER.SUNNY:
        targetAmb = 1.0;
        targetDir = 0.8;
        break;
      case WEATHER.STORM:
        targetAmb = 0.3;
        targetDir = 0.2;
        break;
      case WEATHER.BLIZZARD:
        targetAmb = 0.5;
        targetDir = 0.4;
        break;
    }
    if (state.ambLight) state.ambLight.intensity = THREE.MathUtils.lerp(state.ambLight.intensity, targetAmb, delta);
    if (state.dirLight) state.dirLight.intensity = THREE.MathUtils.lerp(state.dirLight.intensity, targetDir, delta);
  }
}

export function getCurrentWeather() {
  return currentWeather;
}
