// Desert biome: cacti, dead trees, sand dunes decorations, bones

import * as THREE from 'three';
import { state } from '../state.js';
import { MAP_SIZE } from '../config.js';
import { getBiomeAt, BIOME } from './biomes.js';
import { getTerrainHeight } from './terrain.js';
import { registerStaticObject } from '../systems/staticVisibility.js';

// Shared resources
const cactusTrunkGeo = new THREE.CylinderGeometry(2, 3, 20, 8);
const cactusArmGeo = new THREE.CylinderGeometry(1.5, 2, 10, 6);
const cactusMat = new THREE.MeshLambertMaterial({ color: 0x2D5A27 });
const deadTreeMat = new THREE.MeshLambertMaterial({ color: 0x6B5B3A });
const deadTreeTrunkGeo = new THREE.CylinderGeometry(2, 4, 25, 6);
const deadTreeBranchGeo = new THREE.CylinderGeometry(0.5, 1.5, 12, 5);
const duneRippleGeo = new THREE.RingGeometry(3, 5, 8);
const duneMat = new THREE.MeshLambertMaterial({ color: 0xC2B280, side: THREE.DoubleSide });
const boneMat = new THREE.MeshLambertMaterial({ color: 0xE8DCC8 });
const boneGeo = new THREE.CylinderGeometry(0.3, 0.3, 3, 5);
const skullGeo = new THREE.SphereGeometry(1, 6, 6);

function createCactus(x, y, z) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(cactusTrunkGeo, cactusMat);
  trunk.position.y = 10;
  group.add(trunk);

  // Random arms (1-3)
  const armCount = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < armCount; i++) {
    const arm = new THREE.Mesh(cactusArmGeo, cactusMat);
    const angle = Math.random() * Math.PI * 2;
    const height = 6 + Math.random() * 8;
    arm.position.set(Math.cos(angle) * 4, height, Math.sin(angle) * 4);
    arm.rotation.z = Math.cos(angle) * 0.8;
    arm.rotation.x = Math.sin(angle) * 0.8;
    group.add(arm);
  }

  group.position.set(x, y, z);
  group.traverse(c => { if (c.isMesh) c.userData.impactMaterial = 'wood'; });
  state.scene.add(group);
  registerStaticObject(group, x, z, 1000);

  const box = new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(x, y + 10, z),
    new THREE.Vector3(6, 20, 6)
  );
  box.userData = { kind: 'cactus', standable: false };
  state.colliders.push(box);
}

function createDeadTree(x, y, z) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(deadTreeTrunkGeo, deadTreeMat);
  trunk.position.y = 12.5;
  trunk.rotation.z = (Math.random() - 0.5) * 0.15;
  group.add(trunk);

  // 2-4 bare branches
  const branchCount = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < branchCount; i++) {
    const branch = new THREE.Mesh(deadTreeBranchGeo, deadTreeMat);
    const angle = Math.random() * Math.PI * 2;
    const height = 10 + Math.random() * 12;
    branch.position.set(Math.cos(angle) * 3, height, Math.sin(angle) * 3);
    branch.rotation.z = Math.cos(angle) * (0.5 + Math.random() * 0.5);
    branch.rotation.x = Math.sin(angle) * (0.5 + Math.random() * 0.5);
    group.add(branch);
  }

  group.position.set(x, y, z);
  group.traverse(c => { if (c.isMesh) c.userData.impactMaterial = 'wood'; });
  state.scene.add(group);
  registerStaticObject(group, x, z, 1000);

  const box = new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(x, y + 12, z),
    new THREE.Vector3(6, 25, 6)
  );
  box.userData = { kind: 'tree', standable: false };
  state.colliders.push(box);
}

function createDuneRipple(x, y, z) {
  const mesh = new THREE.Mesh(duneRippleGeo, duneMat);
  mesh.position.set(x, y + 0.1, z);
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.z = Math.random() * Math.PI;
  mesh.scale.set(1 + Math.random(), 1, 1 + Math.random());
  state.scene.add(mesh);
  registerStaticObject(mesh, x, z, 600);
  // Flat low collider so AI/player ground-cast still resolves the surface (standable).
  const box = new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(x, y + 0.1, z),
    new THREE.Vector3(8, 0.2, 8)
  );
  box.userData = { kind: 'dune', standable: true, soft: true };
  state.colliders.push(box);
}

function createBones(x, y, z) {
  const group = new THREE.Group();
  // 2-4 bones + maybe a skull
  const boneCount = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < boneCount; i++) {
    const bone = new THREE.Mesh(boneGeo, boneMat);
    bone.position.set((Math.random() - 0.5) * 3, 0.3, (Math.random() - 0.5) * 3);
    bone.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    group.add(bone);
  }
  if (Math.random() > 0.5) {
    const skull = new THREE.Mesh(skullGeo, boneMat);
    skull.position.set(0, 0.8, 0);
    skull.scale.y = 0.8;
    group.add(skull);
  }
  group.position.set(x, y, z);
  state.scene.add(group);
  registerStaticObject(group, x, z, 500);
  // Small soft collider so the bone pile reads as something — won't significantly block movement.
  const box = new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(x, y + 0.5, z),
    new THREE.Vector3(3, 1, 3)
  );
  box.userData = { kind: 'bones', standable: true, soft: true };
  state.colliders.push(box);
}

export function initBiomeDesertVegetation() {
  let cactiCount = 0;
  let deadTreeCount = 0;
  let duneCount = 0;
  let boneCount = 0;
  const maxAttempts = 3000;

  for (let i = 0; i < maxAttempts && (cactiCount < 200 || deadTreeCount < 80 || duneCount < 100 || boneCount < 30); i++) {
    const x = (Math.random() - 0.5) * MAP_SIZE * 0.85;
    const z = (Math.random() - 0.5) * MAP_SIZE * 0.85;
    if (getBiomeAt(x, z) !== BIOME.DESERT) continue;

    const y = getTerrainHeight(x, z);
    if (y < 1) continue;

    if (cactiCount < 200 && Math.random() < 0.4) {
      createCactus(x, y, z);
      cactiCount++;
    } else if (deadTreeCount < 80 && Math.random() < 0.25) {
      createDeadTree(x, y, z);
      deadTreeCount++;
    } else if (duneCount < 100 && Math.random() < 0.3) {
      createDuneRipple(x, y, z);
      duneCount++;
    } else if (boneCount < 30 && Math.random() < 0.1) {
      createBones(x, y, z);
      boneCount++;
    }
  }
}

export function updateBiomeDesert(delta) {
  // Desert is mostly static - no per-frame updates needed
}
