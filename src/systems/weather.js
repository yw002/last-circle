// Random weather system: rain, snow, sunshine with smooth transitions

import * as THREE from 'three';
import { state } from '../state.js';
import { MAP_SIZE } from '../config.js';
import { getTerrainHeight } from '../world/terrain.js';
import { addKillFeed } from '../ui/notices.js';
import { playThunderSound } from './audio.js';

// Weather states
const WEATHER = {
  SUNNY: 'sunny',
  RAIN: 'rain',
  SNOW: 'snow',
  STORM: 'storm'
};

let currentWeather = WEATHER.SUNNY;
let weatherTimer = 0;
let weatherDuration = 60 + Math.random() * 60; // 60-120 seconds per weather
let snowParticles = [];
let transitionProgress = 0;
let targetSkyColor = new THREE.Color(0x87CEEB);
let targetFogColor = new THREE.Color(0x87CEEB);
let targetFogDensity = 0.0008;

export function initClouds() {
  const cloudGeo = new THREE.SphereGeometry(1, 8, 8);
  const cloudMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.8
  });

  for (let i = 0; i < 100; i++) {
    const cloudGroup = new THREE.Group();
    let numParts = 3 + Math.floor(Math.random() * 5);
    for (let j = 0; j < numParts; j++) {
      const part = new THREE.Mesh(cloudGeo, cloudMat.clone());
      let scale = 20 + Math.random() * 40;
      part.scale.set(scale, scale * 0.6, scale);
      part.position.set(
        (Math.random() - 0.5) * 80,
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 40
      );
      cloudGroup.add(part);
    }

    cloudGroup.position.set(
      (Math.random() - 0.5) * MAP_SIZE * 1.5,
      300 + Math.random() * 300,
      (Math.random() - 0.5) * MAP_SIZE * 1.5
    );

    cloudGroup.userData.speed = 1 + Math.random() * 2;
    cloudGroup.userData.baseOpacity = 0.6 + Math.random() * 0.3;
    state.clouds.push(cloudGroup);
    state.scene.add(cloudGroup);
  }
}

function createLightningBolt() {
  if (state.lightningBoltLine) {
    state.scene.remove(state.lightningBoltLine);
  }

  let playerPos = state.controls.getObject().position;
  let angle = Math.random() * Math.PI * 2;
  let dist = 150 + Math.random() * 150;
  let startX = playerPos.x + Math.cos(angle) * dist;
  let startZ = playerPos.z + Math.sin(angle) * dist;
  let startY = 300;

  let endX = startX + (Math.random() - 0.5) * 50;
  let endZ = startZ + (Math.random() - 0.5) * 50;
  let endY = getTerrainHeight(endX, endZ);

  const points = [];
  let segments = 12;
  let currentX = startX;
  let currentY = startY;
  let currentZ = startZ;
  points.push(new THREE.Vector3(currentX, currentY, currentZ));

  for (let i = 1; i <= segments; i++) {
    let t = i / segments;
    let targetX = THREE.MathUtils.lerp(startX, endX, t);
    let targetY = THREE.MathUtils.lerp(startY, endY, t);
    let targetZ = THREE.MathUtils.lerp(startZ, endZ, t);

    if (i < segments) {
      currentX = targetX + (Math.random() - 0.5) * 22;
      currentY = targetY;
      currentZ = targetZ + (Math.random() - 0.5) * 22;
    } else {
      currentX = endX;
      currentY = endY;
      currentZ = endZ;
    }
    points.push(new THREE.Vector3(currentX, currentY, currentZ));
  }

  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 4 });
  state.lightningBoltLine = new THREE.Line(geo, mat);
  state.scene.add(state.lightningBoltLine);
}

function createRain() {
  if (state.rainParticles.length > 0) return;

  const rainMat = new THREE.PointsMaterial({
    color: 0x90a9e1,
    size: 0.8,
    transparent: true,
    opacity: 0.6,
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
    size: 1.2,
    transparent: true,
    opacity: 0.8,
    depthWrite: false
  });

  for (let c = 0; c < 3; c++) {
    const snowGeo = new THREE.BufferGeometry();
    const snowCount = 2000;
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

function changeWeather() {
  const weathers = [WEATHER.SUNNY, WEATHER.RAIN, WEATHER.SNOW, WEATHER.STORM];
  let newWeather;
  do {
    newWeather = weathers[Math.floor(Math.random() * weathers.length)];
  } while (newWeather === currentWeather);

  currentWeather = newWeather;
  weatherDuration = 60 + Math.random() * 60;
  weatherTimer = 0;

  // Set target colors based on weather
  switch (currentWeather) {
    case WEATHER.SUNNY:
      targetSkyColor.setHex(0x87CEEB);
      targetFogColor.setHex(0x87CEEB);
      targetFogDensity = 0.0008;
      removeRain();
      removeSnow();
      addKillFeed("<span style='color:#f1c40f'>☀️ 天气转晴，阳光明媚！</span>");
      break;
    case WEATHER.RAIN:
      targetSkyColor.setHex(0x4a5568);
      targetFogColor.setHex(0x4a5568);
      targetFogDensity = 0.0015;
      createRain();
      removeSnow();
      addKillFeed("<span style='color:#3498db'>🌧️ 开始下雨了！</span>");
      break;
    case WEATHER.SNOW:
      targetSkyColor.setHex(0xc8d6e5);
      targetFogColor.setHex(0xc8d6e5);
      targetFogDensity = 0.002;
      removeRain();
      createSnow();
      addKillFeed("<span style='color:#dfe6e9'>❄️ 下雪了！大地银装素裹！</span>");
      break;
    case WEATHER.STORM:
      targetSkyColor.setHex(0x1a212a);
      targetFogColor.setHex(0x1a212a);
      targetFogDensity = 0.002;
      createRain();
      removeSnow();
      addKillFeed("<span style='color:#e74c3c'>⛈️ 暴风雨来袭！电闪雷鸣！</span>");
      break;
  }
}

export function updateWeather(delta) {
  let playerPos = state.controls.getObject().position;
  weatherTimer += delta;

  // Check if weather should change
  if (weatherTimer > weatherDuration) {
    changeWeather();
  }

  // Smooth sky/fog transition
  state.scene.background.lerp(targetSkyColor, delta * 0.5);
  state.scene.fog.color.lerp(targetFogColor, delta * 0.5);
  state.scene.fog.density = THREE.MathUtils.lerp(state.scene.fog.density, targetFogDensity, delta * 0.5);

  // Update clouds
  state.clouds.forEach(cloud => {
    let speedMult = currentWeather === WEATHER.STORM ? 4.0 : (currentWeather === WEATHER.RAIN ? 2.0 : 1.0);
    cloud.position.x += cloud.userData.speed * delta * 10 * speedMult;
    if (cloud.position.x > MAP_SIZE) cloud.position.x = -MAP_SIZE;

    // Adjust cloud opacity based on weather
    let targetOpacity = cloud.userData.baseOpacity;
    if (currentWeather === WEATHER.STORM) targetOpacity = 0.9;
    else if (currentWeather === WEATHER.RAIN) targetOpacity = 0.7;
    else if (currentWeather === WEATHER.SNOW) targetOpacity = 0.5;

    cloud.children.forEach(part => {
      part.material.opacity = THREE.MathUtils.lerp(part.material.opacity, targetOpacity, delta);
    });
  });

  // Update rain
  state.rainParticles.forEach(rain => {
    rain.position.x = playerPos.x;
    rain.position.z = playerPos.z;
    rain.position.y -= 350 * delta;
    if (rain.position.y < -150) rain.position.y = 180;
  });

  // Update snow
  snowParticles.forEach(snow => {
    snow.position.x = playerPos.x + Math.sin(weatherTimer * 0.5) * 50;
    snow.position.z = playerPos.z + Math.cos(weatherTimer * 0.3) * 50;
    snow.position.y -= 80 * delta; // Slower fall for snow
    if (snow.position.y < -150) snow.position.y = 200;
  });

  // Storm effects
  if (currentWeather === WEATHER.STORM) {
    // Lightning
    if (!state.isLightningFlashing && Math.random() < 0.003) {
      state.isLightningFlashing = true;
      state.lightningFlashTime = Date.now();
      playThunderSound();
      createLightningBolt();
    }

    if (state.isLightningFlashing) {
      let elapsed = Date.now() - state.lightningFlashTime;
      if (elapsed < 120) {
        state.scene.background.setHex(0xd0ebff);
        state.scene.fog.color.setHex(0xd0ebff);
        if (state.ambLight) state.ambLight.intensity = 3.0;
        if (state.dirLight) state.dirLight.intensity = 3.0;
      } else if (elapsed < 220) {
        state.scene.background.setHex(0x1a212a);
        state.scene.fog.color.setHex(0x1a212a);
        if (state.ambLight) state.ambLight.intensity = 0.4;
        if (state.dirLight) state.dirLight.intensity = 0.3;
      } else if (elapsed < 300) {
        state.scene.background.setHex(0xb5e0ff);
        state.scene.fog.color.setHex(0xb5e0ff);
        if (state.ambLight) state.ambLight.intensity = 2.4;
        if (state.dirLight) state.dirLight.intensity = 2.4;
      } else {
        state.isLightningFlashing = false;
        if (state.lightningBoltLine) {
          state.scene.remove(state.lightningBoltLine);
          state.lightningBoltLine = null;
        }
        if (state.ambLight) state.ambLight.intensity = 0.7;
        if (state.dirLight) state.dirLight.intensity = 0.6;
      }
    }
  }

  // Adjust lighting based on weather
  if (!state.isLightningFlashing) {
    let targetAmbient = 0.7;
    let targetDir = 0.6;

    switch (currentWeather) {
      case WEATHER.SUNNY:
        targetAmbient = 0.9;
        targetDir = 0.8;
        break;
      case WEATHER.RAIN:
        targetAmbient = 0.5;
        targetDir = 0.4;
        break;
      case WEATHER.SNOW:
        targetAmbient = 0.6;
        targetDir = 0.5;
        break;
      case WEATHER.STORM:
        targetAmbient = 0.3;
        targetDir = 0.2;
        break;
    }

    if (state.ambLight) state.ambLight.intensity = THREE.MathUtils.lerp(state.ambLight.intensity, targetAmbient, delta);
    if (state.dirLight) state.dirLight.intensity = THREE.MathUtils.lerp(state.dirLight.intensity, targetDir, delta);
  }
}

export function getCurrentWeather() {
  return currentWeather;
}
