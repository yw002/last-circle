// Jungle biome: giant ferns, vines, massive trees, dense fog

import * as THREE from 'three';
import { state } from '../state.js';
import { MAP_SIZE } from '../config.js';
import { getBiomeAt, BIOME } from './biomes.js';
import { getTerrainHeight } from './terrain.js';
import { registerStaticObject } from '../systems/staticVisibility.js';

// Shared resources
const fernLeafGeo = new THREE.PlaneGeometry(6, 18);
const fernMat = new THREE.MeshLambertMaterial({ color: 0x228B22, side: THREE.DoubleSide });
const fernDarkMat = new THREE.MeshLambertMaterial({ color: 0x1A6B1A, side: THREE.DoubleSide });
const vineMat = new THREE.MeshLambertMaterial({ color: 0x3A5A1A });
const vineGeo = new THREE.CylinderGeometry(0.2, 0.1, 20, 4);
const giantTrunkGeo = new THREE.CylinderGeometry(10, 16, 80, 8);
const giantTrunkMat = new THREE.MeshLambertMaterial({ color: 0x4a3020 });
const giantCanopyGeo = new THREE.SphereGeometry(40, 8, 8);
const giantCanopyMat = new THREE.MeshLambertMaterial({ color: 0x1B5E20 });
const giantCanopy2Geo = new THREE.SphereGeometry(30, 8, 8);

function createFern(x, y, z) {
  const group = new THREE.Group();
  const leafCount = 4 + Math.floor(Math.random() * 4);
  const mat = Math.random() > 0.5 ? fernMat : fernDarkMat;

  for (let i = 0; i < leafCount; i++) {
    const leaf = new THREE.Mesh(fernLeafGeo, mat);
    const angle = (i / leafCount) * Math.PI * 2;
    leaf.position.set(Math.cos(angle) * 2, 5 + Math.random() * 3, Math.sin(angle) * 2);
    leaf.rotation.y = angle;
    leaf.rotation.x = -0.3 - Math.random() * 0.3;
    leaf.scale.set(0.8 + Math.random() * 0.4, 0.8 + Math.random() * 0.4, 1);
    group.add(leaf);
  }

  group.position.set(x, y, z);
  state.scene.add(group);
  registerStaticObject(group, x, z, 600);
}

function createVine(x, y, z) {
  const vine = new THREE.Mesh(vineGeo, vineMat);
  vine.position.set(x, y + 30 + Math.random() * 20, z);
  vine.rotation.z = (Math.random() - 0.5) * 0.3;
  vine.scale.y = 0.5 + Math.random() * 1.5;
  state.scene.add(vine);
  registerStaticObject(vine, x, z, 600);
}

function createGiantTree(x, y, z) {
  const group = new THREE.Group();
  const scale = 2 + Math.random();

  const trunk = new THREE.Mesh(giantTrunkGeo, giantTrunkMat);
  trunk.position.y = 40;
  trunk.scale.set(scale * 0.5, 1, scale * 0.5);
  group.add(trunk);

  const canopy1 = new THREE.Mesh(giantCanopyGeo, giantCanopyMat);
  canopy1.position.y = 90;
  canopy1.scale.set(scale * 0.6, 0.7, scale * 0.6);
  group.add(canopy1);

  const canopy2 = new THREE.Mesh(giantCanopy2Geo, giantCanopyMat);
  canopy2.position.set(15 * scale * 0.3, 80, 10 * scale * 0.3);
  canopy2.scale.set(scale * 0.6, 0.6, scale * 0.6);
  group.add(canopy2);

  // Buttress roots
  for (let i = 0; i < 4; i++) {
    const rootGeo = new THREE.BoxGeometry(2, 12, 8);
    const root = new THREE.Mesh(rootGeo, giantTrunkMat);
    const angle = (i / 4) * Math.PI * 2 + Math.random() * 0.3;
    root.position.set(Math.cos(angle) * 6, 6, Math.sin(angle) * 6);
    root.rotation.y = angle;
    root.rotation.z = 0.3;
    group.add(root);
  }

  group.position.set(x, y - 6, z);
  group.traverse(c => { if (c.isMesh) c.userData.impactMaterial = 'wood'; });
  state.scene.add(group);
  registerStaticObject(group, x, z, 1500);

  const box = new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(x, y + 40, z),
    new THREE.Vector3(16 * scale * 0.5, 80, 16 * scale * 0.5)
  );
  box.userData = { kind: 'tree', standable: false };
  state.colliders.push(box);
}

export function initBiomeJungleVegetation() {
  let fernCount = 0, vineCount = 0, giantCount = 0;
  const maxAttempts = 4000;

  for (let i = 0; i < maxAttempts && (fernCount < 400 || vineCount < 200 || giantCount < 50); i++) {
    const x = (Math.random() - 0.5) * MAP_SIZE * 0.85;
    const z = (Math.random() - 0.5) * MAP_SIZE * 0.85;
    if (getBiomeAt(x, z) !== BIOME.JUNGLE) continue;

    const y = getTerrainHeight(x, z);
    if (y < 2) continue;

    if (fernCount < 400 && Math.random() < 0.4) {
      createFern(x, y, z);
      fernCount++;
    } else if (vineCount < 200 && Math.random() < 0.3) {
      createVine(x, y, z);
      vineCount++;
    } else if (giantCount < 50 && Math.random() < 0.08) {
      createGiantTree(x, y, z);
      giantCount++;
    }
  }
}

export function updateBiomeJungle(delta) {
  // Jungle fog could be dynamic in future
}
