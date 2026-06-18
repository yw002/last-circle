// Snow biome: snow-covered pines, frozen lakes, snow piles, icicles

import * as THREE from 'three';
import { state } from '../state.js';
import { MAP_SIZE } from '../config.js';
import { getBiomeAt, BIOME } from './biomes.js';
import { getTerrainHeight } from './terrain.js';
import { registerStaticObject } from '../systems/staticVisibility.js';

// Shared resources
const snowPineTrunkGeo = new THREE.CylinderGeometry(5, 8, 60, 8);
const snowCone1Geo = new THREE.ConeGeometry(35, 70, 8);
const snowCone2Geo = new THREE.ConeGeometry(28, 60, 8);
const snowCone3Geo = new THREE.ConeGeometry(20, 50, 8);
const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5c4033 });
const snowLeafMat = new THREE.MeshLambertMaterial({ color: 0xA8C8A0 }); // light green-white
const snowCapMat = new THREE.MeshLambertMaterial({ color: 0xF0F8FF }); // snow white
const frozenLakeMat = new THREE.MeshLambertMaterial({ color: 0xB0E0E6, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
const snowPileMat = new THREE.MeshLambertMaterial({ color: 0xF5F5F5 });
const snowPileGeo = new THREE.SphereGeometry(4, 8, 6);
const icicleMat = new THREE.MeshLambertMaterial({ color: 0xD4E6F1, transparent: true, opacity: 0.6 });
const icicleGeo = new THREE.ConeGeometry(0.5, 4, 5);

function createSnowPine(x, y, z) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(snowPineTrunkGeo, trunkMat);
  trunk.position.y = 30;
  group.add(trunk);

  const l1 = new THREE.Mesh(snowCone1Geo, snowLeafMat); l1.position.y = 65;
  const l2 = new THREE.Mesh(snowCone2Geo, snowLeafMat); l2.position.y = 95;
  const l3 = new THREE.Mesh(snowCone3Geo, snowLeafMat); l3.position.y = 120;
  group.add(l1, l2, l3);

  // Snow caps on top of each cone layer
  const cap1 = new THREE.Mesh(snowCone1Geo, snowCapMat);
  cap1.position.y = 66; cap1.scale.set(1.02, 0.3, 1.02);
  const cap2 = new THREE.Mesh(snowCone2Geo, snowCapMat);
  cap2.position.y = 96; cap2.scale.set(1.02, 0.3, 1.02);
  const cap3 = new THREE.Mesh(snowCone3Geo, snowCapMat);
  cap3.position.y = 121; cap3.scale.set(1.02, 0.3, 1.02);
  group.add(cap1, cap2, cap3);

  group.position.set(x, y - 6, z);
  group.traverse(c => { if (c.isMesh) c.userData.impactMaterial = 'wood'; });
  state.scene.add(group);
  registerStaticObject(group, x, z, 1300);

  const box = new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(x, y + 30, z),
    new THREE.Vector3(14, 60, 14)
  );
  box.userData = { kind: 'tree', standable: false };
  state.colliders.push(box);
}

function createFrozenLake(x, y, z) {
  const radius = 25 + Math.random() * 35;
  const geo = new THREE.CircleGeometry(radius, 16);
  const mesh = new THREE.Mesh(geo, frozenLakeMat);
  mesh.position.set(x, y + 0.2, z);
  mesh.rotation.x = -Math.PI / 2;
  mesh.userData.impactMaterial = 'ice';
  state.scene.add(mesh);
  registerStaticObject(mesh, x, z, 1000);
  // Marker collider — standable surface tagged 'ice' for any system that wants to react.
  const box = new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(x, y + 0.2, z),
    new THREE.Vector3(radius * 2, 0.3, radius * 2)
  );
  box.userData = { kind: 'frozen_lake', standable: true, soft: true };
  state.colliders.push(box);
}

function createSnowPile(x, y, z) {
  const mesh = new THREE.Mesh(snowPileGeo, snowPileMat);
  mesh.position.set(x, y + 1.5, z);
  const sx = 1 + Math.random() * 1.5;
  const sy = 0.5 + Math.random() * 0.5;
  const sz = 1 + Math.random() * 1.5;
  mesh.scale.set(sx, sy, sz);
  state.scene.add(mesh);
  registerStaticObject(mesh, x, z, 500);
  const box = new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(x, y + 1.5, z),
    new THREE.Vector3(8 * sx, 4 * sy, 8 * sz)
  );
  box.userData = { kind: 'snow_pile', standable: true, soft: true };
  state.colliders.push(box);
}

function createIcicle(x, y, z) {
  const mesh = new THREE.Mesh(icicleGeo, icicleMat);
  mesh.position.set(x, y + 20 + Math.random() * 10, z);
  mesh.rotation.x = Math.PI; // point downward
  const sy = 1 + Math.random() * 2;
  mesh.scale.y = sy;
  state.scene.add(mesh);
  registerStaticObject(mesh, x, z, 500);
  // Hanging icicle collider (overhead), thin column near tip.
  const box = new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(x, mesh.position.y, z),
    new THREE.Vector3(1, 4 * sy, 1)
  );
  box.userData = { kind: 'icicle', standable: false, soft: true };
  state.colliders.push(box);
}

export function initBiomeSnowVegetation() {
  let pineCount = 0, lakeCount = 0, pileCount = 0, icicleCount = 0;
  const maxAttempts = 3000;

  for (let i = 0; i < maxAttempts && (pineCount < 250 || lakeCount < 8 || pileCount < 150 || icicleCount < 60); i++) {
    const x = (Math.random() - 0.5) * MAP_SIZE * 0.85;
    const z = (Math.random() - 0.5) * MAP_SIZE * 0.85;
    if (getBiomeAt(x, z) !== BIOME.SNOW) continue;

    const y = getTerrainHeight(x, z);
    if (y < 1 && lakeCount >= 8) continue;

    if (pineCount < 250 && Math.random() < 0.35 && y > 2) {
      createSnowPine(x, y, z);
      pineCount++;
    } else if (lakeCount < 8 && Math.random() < 0.03 && y < 5) {
      createFrozenLake(x, y, z);
      lakeCount++;
    } else if (pileCount < 150 && Math.random() < 0.3 && y > 1) {
      createSnowPile(x, y, z);
      pileCount++;
    } else if (icicleCount < 60 && Math.random() < 0.15 && y > 5) {
      createIcicle(x, y, z);
      icicleCount++;
    }
  }
}

export function updateBiomeSnow(delta) {
  // Snow biome - no per-frame updates needed (snowfall handled by weather system)
}
