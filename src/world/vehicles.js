// Vehicle system: jeeps and motorcycles that players can drive

import * as THREE from 'three';
import { state } from '../state.js';
import { MAP_SIZE } from '../config.js';
import { getTerrainHeight } from '../world/terrain.js';
import { getBiomeAt, BIOME } from '../world/biomes.js';
import { registerStaticObject } from '../systems/staticVisibility.js';
import { playSound } from '../systems/audio.js';

// Shared resources
const jeepBodyGeo = new THREE.BoxGeometry(6, 3, 10);
const jeepBodyMat = new THREE.MeshLambertMaterial({ color: 0x3A5A2A });
const jeepWheelGeo = new THREE.CylinderGeometry(1.5, 1.5, 0.8, 12);
const jeepWheelMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
const jeepWindshieldGeo = new THREE.PlaneGeometry(5, 2.5);
const jeepWindshieldMat = new THREE.MeshLambertMaterial({ color: 0x88CCFF, transparent: true, opacity: 0.3, side: THREE.DoubleSide });

const motoBodyGeo = new THREE.BoxGeometry(1.5, 2, 4);
const motoBodyMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
const motoWheelGeo = new THREE.CylinderGeometry(1, 1, 0.4, 12);
const motoSeatGeo = new THREE.BoxGeometry(1.2, 0.5, 1.5);
const motoSeatMat = new THREE.MeshLambertMaterial({ color: 0x5A2A2A });

// Roads in this game are a 500-unit grid (terrain.js). Road centerlines lie on world coords
// where (x + MAP_SIZE/2) % 500 == 250. Intersections are where both axes hit a centerline.
const ROAD_GRID = 500;
const ROAD_OFFSET = 250;

function roadIntersections() {
  const out = [];
  const half = MAP_SIZE / 2;
  for (let x = -half + ROAD_OFFSET; x <= half - ROAD_OFFSET; x += ROAD_GRID) {
    for (let z = -half + ROAD_OFFSET; z <= half - ROAD_OFFSET; z += ROAD_GRID) {
      out.push({ x, z });
    }
  }
  // Shuffle so picks aren't predictable.
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function nearestRoadside() {
  // Pick a random point that is on a road centerline (one axis aligned, the other random).
  const half = MAP_SIZE / 2;
  if (Math.random() < 0.5) {
    // East/West road: x snapped, z random
    const xCells = Math.floor((MAP_SIZE - 2 * ROAD_OFFSET) / ROAD_GRID) + 1;
    const x = -half + ROAD_OFFSET + Math.floor(Math.random() * xCells) * ROAD_GRID;
    const z = (Math.random() - 0.5) * MAP_SIZE * 0.7;
    // Park slightly off the centerline
    return { x: x + (Math.random() - 0.5) * 6, z };
  } else {
    const zCells = Math.floor((MAP_SIZE - 2 * ROAD_OFFSET) / ROAD_GRID) + 1;
    const z = -half + ROAD_OFFSET + Math.floor(Math.random() * zCells) * ROAD_GRID;
    const x = (Math.random() - 0.5) * MAP_SIZE * 0.7;
    return { x, z: z + (Math.random() - 0.5) * 6 };
  }
}

function createJeep(x, y, z) {
  const group = new THREE.Group();

  const body = new THREE.Mesh(jeepBodyGeo, jeepBodyMat);
  body.position.y = 2.5;
  const vehicleIndex = state.vehicles.length;
  body.userData = { isVehicle: true, impactMaterial: 'metal', vehicleIndex };
  group.add(body);

  const wheelPositions = [
    { x: -3, z: -3.5 }, { x: 3, z: -3.5 },
    { x: -3, z: 3.5 }, { x: 3, z: 3.5 }
  ];
  for (const wp of wheelPositions) {
    const wheel = new THREE.Mesh(jeepWheelGeo, jeepWheelMat);
    wheel.position.set(wp.x, 1, wp.z);
    wheel.rotation.z = Math.PI / 2;
    group.add(wheel);
  }

  const windshield = new THREE.Mesh(jeepWindshieldGeo, jeepWindshieldMat);
  windshield.position.set(0, 4.5, -3);
  windshield.rotation.x = -0.2;
  group.add(windshield);

  group.position.set(x, y, z);
  group.rotation.y = Math.random() * Math.PI * 2;
  state.scene.add(group);
  registerStaticObject(group, x, z, 1200);
  state.objects.push(body);

  state.vehicles.push({
    mesh: group,
    body,
    position: new THREE.Vector3(x, y, z),
    rotation: group.rotation.y,
    speed: 0,
    // Plan: 2-3x player sprint speed (player sprint = 600 units/s in player.js).
    maxSpeed: 1300,
    acceleration: 220,
    turnSpeed: 2.0,
    health: 300,
    maxHealth: 300,
    occupied: false,
    destroyed: false,
    type: 'jeep',
    engineSoundTimer: 0,
  });
}

function createMotorcycle(x, y, z) {
  const group = new THREE.Group();

  const body = new THREE.Mesh(motoBodyGeo, motoBodyMat);
  body.position.y = 1.5;
  const vehicleIndex = state.vehicles.length;
  body.userData = { isVehicle: true, impactMaterial: 'metal', vehicleIndex };
  group.add(body);

  const wheelFront = new THREE.Mesh(motoWheelGeo, jeepWheelMat);
  wheelFront.position.set(0, 0.8, -2);
  wheelFront.rotation.z = Math.PI / 2;
  group.add(wheelFront);

  const wheelBack = new THREE.Mesh(motoWheelGeo, jeepWheelMat);
  wheelBack.position.set(0, 0.8, 2);
  wheelBack.rotation.z = Math.PI / 2;
  group.add(wheelBack);

  const seat = new THREE.Mesh(motoSeatGeo, motoSeatMat);
  seat.position.set(0, 2.8, 0.5);
  group.add(seat);

  group.position.set(x, y, z);
  group.rotation.y = Math.random() * Math.PI * 2;
  state.scene.add(group);
  registerStaticObject(group, x, z, 1000);
  state.objects.push(body);

  state.vehicles.push({
    mesh: group,
    body,
    position: new THREE.Vector3(x, y, z),
    rotation: group.rotation.y,
    speed: 0,
    maxSpeed: 1700,
    acceleration: 320,
    turnSpeed: 3.2,
    health: 150,
    maxHealth: 150,
    occupied: false,
    destroyed: false,
    type: 'motorcycle',
    engineSoundTimer: 0,
  });
}

export function initVehicles() {
  // Jeeps (15) — at road intersections.
  const intersections = roadIntersections();
  let placed = 0;
  for (let i = 0; i < intersections.length && placed < 15; i++) {
    const { x, z } = intersections[i];
    const y = getTerrainHeight(x, z);
    if (y < 1 || y > 35) continue;
    const biome = getBiomeAt(x, z);
    if (biome === BIOME.LAVA || biome === BIOME.SWAMP) continue;
    createJeep(x, y, z);
    placed++;
  }
  // Fall back to random placement if not enough intersections were habitable.
  for (let i = 0; i < 200 && placed < 15; i++) {
    const x = (Math.random() - 0.5) * MAP_SIZE * 0.7;
    const z = (Math.random() - 0.5) * MAP_SIZE * 0.7;
    const y = getTerrainHeight(x, z);
    if (y < 3 || y > 25) continue;
    const biome = getBiomeAt(x, z);
    if (biome === BIOME.LAVA || biome === BIOME.SWAMP) continue;
    createJeep(x, y, z);
    placed++;
  }

  // Motorcycles (10) — along roadsides.
  placed = 0;
  for (let i = 0; i < 200 && placed < 10; i++) {
    const { x, z } = nearestRoadside();
    const y = getTerrainHeight(x, z);
    if (y < 1 || y > 30) continue;
    const biome = getBiomeAt(x, z);
    if (biome === BIOME.LAVA || biome === BIOME.SWAMP) continue;
    createMotorcycle(x, y, z);
    placed++;
  }
}

export function updateVehicles(delta) {
  const playerObj = state.controls ? state.controls.getObject() : null;
  if (!playerObj) return;

  const vehicle = state.currentVehicle;

  if (vehicle && !vehicle.destroyed) {
    const { mesh, maxSpeed, acceleration, turnSpeed } = vehicle;

    if (state.moveForward) {
      vehicle.speed = Math.min(maxSpeed, vehicle.speed + acceleration * delta);
    } else if (state.moveBackward) {
      vehicle.speed = Math.max(-maxSpeed * 0.3, vehicle.speed - acceleration * 1.5 * delta);
    } else {
      vehicle.speed *= (1 - 2 * delta);
      if (Math.abs(vehicle.speed) < 0.5) vehicle.speed = 0;
    }

    if (state.moveLeft) vehicle.rotation += turnSpeed * delta * (vehicle.speed > 0 ? 1 : -1);
    if (state.moveRight) vehicle.rotation -= turnSpeed * delta * (vehicle.speed > 0 ? 1 : -1);

    mesh.rotation.y = vehicle.rotation;
    const moveX = Math.sin(vehicle.rotation) * vehicle.speed * delta;
    const moveZ = Math.cos(vehicle.rotation) * vehicle.speed * delta;
    mesh.position.x += moveX;
    mesh.position.z += moveZ;

    const terrainY = getTerrainHeight(mesh.position.x, mesh.position.z);
    mesh.position.y = terrainY;

    vehicle.position.copy(mesh.position);

    // Engine sound — pulse periodically while moving; faster pulses at higher speed.
    vehicle.engineSoundTimer -= delta;
    if (vehicle.engineSoundTimer <= 0 && Math.abs(vehicle.speed) > 5) {
      playSound('engine', vehicle.position);
      const pulseRate = 0.45 - 0.3 * Math.min(1, Math.abs(vehicle.speed) / vehicle.maxSpeed);
      vehicle.engineSoundTimer = pulseRate;
    }

    // Camera follows behind vehicle
    const camDist = 20;
    const camHeight = 10;
    const camX = mesh.position.x - Math.sin(vehicle.rotation) * camDist;
    const camZ = mesh.position.z - Math.cos(vehicle.rotation) * camDist;
    const camY = terrainY + camHeight;

    playerObj.position.set(camX, camY, camZ);
    state.camera.lookAt(mesh.position.x, mesh.position.y + 3, mesh.position.z);
  }
}

/**
 * Find nearest vehicle to player within range
 */
export function getNearbyVehicle(playerPos, maxDist = 8) {
  let nearest = null;
  let nearestDist = maxDist * maxDist;

  for (const v of state.vehicles) {
    if (v.occupied || v.destroyed) continue;
    const dx = v.position.x - playerPos.x;
    const dz = v.position.z - playerPos.z;
    const distSq = dx * dx + dz * dz;
    if (distSq < nearestDist) {
      nearestDist = distSq;
      nearest = v;
    }
  }
  return nearest;
}

export function enterVehicle(vehicle) {
  if (!vehicle || vehicle.occupied || vehicle.destroyed) return;

  vehicle.occupied = true;
  vehicle.speed = 0;
  state.currentVehicle = vehicle;

  const playerObj = state.controls.getObject();
  playerObj.traverse(child => {
    if (child.isMesh) child.visible = false;
  });
  playSound('engine', vehicle.position);
}

export function exitVehicle() {
  const vehicle = state.currentVehicle;
  if (!vehicle) return;

  vehicle.occupied = false;
  vehicle.speed = 0;
  state.currentVehicle = null;

  const playerObj = state.controls.getObject();
  playerObj.position.set(
    vehicle.position.x + 8,
    vehicle.position.y + 2,
    vehicle.position.z
  );
  playerObj.traverse(child => {
    if (child.isMesh) child.visible = true;
  });
}

/**
 * Damage a vehicle by index — destroys it when health hits zero, ejects driver.
 */
export function damageVehicle(index, damage) {
  const v = state.vehicles[index];
  if (!v || v.destroyed) return;
  v.health -= damage;
  if (v.health <= 0) {
    v.health = 0;
    v.destroyed = true;
    if (v.occupied) {
      // Eject driver
      exitVehicle();
    }
    // Visual: tint body dark and emit a small explosion sound.
    if (v.body && v.body.material) {
      v.body.material = v.body.material.clone();
      v.body.material.color.setHex(0x222222);
    }
    playSound('explosion', v.position);
  }
}
