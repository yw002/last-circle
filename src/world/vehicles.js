// Vehicle system: jeeps and motorcycles that players can drive

import * as THREE from 'three';
import { state } from '../state.js';
import { MAP_SIZE } from '../config.js';
import { getTerrainHeight } from '../world/terrain.js';
import { getBiomeAt, BIOME } from '../world/biomes.js';
import { registerStaticObject } from '../systems/staticVisibility.js';

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

function createJeep(x, y, z) {
  const group = new THREE.Group();

  const body = new THREE.Mesh(jeepBodyGeo, jeepBodyMat);
  body.position.y = 2.5;
  body.userData = { isVehicle: true, impactMaterial: 'metal' };
  group.add(body);

  // 4 wheels
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

  // Windshield
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
    position: new THREE.Vector3(x, y, z),
    rotation: group.rotation.y,
    speed: 0,
    maxSpeed: 120,
    acceleration: 40,
    turnSpeed: 2.5,
    health: 300,
    occupied: false,
    type: 'jeep'
  });
}

function createMotorcycle(x, y, z) {
  const group = new THREE.Group();

  const body = new THREE.Mesh(motoBodyGeo, motoBodyMat);
  body.position.y = 1.5;
  body.userData = { isVehicle: true, impactMaterial: 'metal' };
  group.add(body);

  // 2 wheels
  const wheelFront = new THREE.Mesh(motoWheelGeo, jeepWheelMat);
  wheelFront.position.set(0, 0.8, -2);
  wheelFront.rotation.z = Math.PI / 2;
  group.add(wheelFront);

  const wheelBack = new THREE.Mesh(motoWheelGeo, jeepWheelMat);
  wheelBack.position.set(0, 0.8, 2);
  wheelBack.rotation.z = Math.PI / 2;
  group.add(wheelBack);

  // Seat
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
    position: new THREE.Vector3(x, y, z),
    rotation: group.rotation.y,
    speed: 0,
    maxSpeed: 160,
    acceleration: 60,
    turnSpeed: 3.5,
    health: 150,
    occupied: false,
    type: 'motorcycle'
  });
}

export function initVehicles() {
  // Jeeps (15) - at road intersections
  let placed = 0;
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

  // Motorcycles (10)
  placed = 0;
  for (let i = 0; i < 200 && placed < 10; i++) {
    const x = (Math.random() - 0.5) * MAP_SIZE * 0.7;
    const z = (Math.random() - 0.5) * MAP_SIZE * 0.7;
    const y = getTerrainHeight(x, z);
    if (y < 3 || y > 25) continue;
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

  if (vehicle) {
    // Driving mode
    const { mesh, maxSpeed, acceleration, turnSpeed } = vehicle;

    // Acceleration/brake
    if (state.moveForward) {
      vehicle.speed = Math.min(maxSpeed, vehicle.speed + acceleration * delta);
    } else if (state.moveBackward) {
      vehicle.speed = Math.max(-maxSpeed * 0.3, vehicle.speed - acceleration * 1.5 * delta);
    } else {
      // Friction
      vehicle.speed *= (1 - 2 * delta);
      if (Math.abs(vehicle.speed) < 0.5) vehicle.speed = 0;
    }

    // Turning
    if (state.moveLeft) vehicle.rotation += turnSpeed * delta * (vehicle.speed > 0 ? 1 : -1);
    if (state.moveRight) vehicle.rotation -= turnSpeed * delta * (vehicle.speed > 0 ? 1 : -1);

    // Move vehicle
    mesh.rotation.y = vehicle.rotation;
    const moveX = Math.sin(vehicle.rotation) * vehicle.speed * delta;
    const moveZ = Math.cos(vehicle.rotation) * vehicle.speed * delta;
    mesh.position.x += moveX;
    mesh.position.z += moveZ;

    // Terrain following
    const terrainY = getTerrainHeight(mesh.position.x, mesh.position.z);
    mesh.position.y = terrainY;

    vehicle.position.copy(mesh.position);

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
    if (v.occupied) continue;
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

/**
 * Enter a vehicle
 */
export function enterVehicle(vehicle) {
  if (!vehicle || vehicle.occupied) return;

  vehicle.occupied = true;
  vehicle.speed = 0;
  state.currentVehicle = vehicle;

  // Hide player model
  const playerObj = state.controls.getObject();
  playerObj.traverse(child => {
    if (child.isMesh) child.visible = false;
  });
}

/**
 * Exit current vehicle
 */
export function exitVehicle() {
  const vehicle = state.currentVehicle;
  if (!vehicle) return;

  vehicle.occupied = false;
  vehicle.speed = 0;
  state.currentVehicle = null;

  // Place player next to vehicle
  const playerObj = state.controls.getObject();
  playerObj.position.set(
    vehicle.position.x + 8,
    vehicle.position.y + 2,
    vehicle.position.z
  );

  // Show player model
  playerObj.traverse(child => {
    if (child.isMesh) child.visible = true;
  });
}
