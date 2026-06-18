// Swamp biome: poison pools, giant mushrooms, twisted dead trees

import * as THREE from 'three';
import { state } from '../state.js';
import { MAP_SIZE } from '../config.js';
import { getBiomeAt, BIOME } from './biomes.js';
import { getTerrainHeight } from './terrain.js';
import { registerStaticObject } from '../systems/staticVisibility.js';

// Shared resources
const poisonPoolMat = new THREE.MeshLambertMaterial({ color: 0x556B2F, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
const mushroomStemGeo = new THREE.CylinderGeometry(0.8, 1.2, 6, 6);
const mushroomStemMat = new THREE.MeshLambertMaterial({ color: 0xD4C8A8 });
const mushroomCapRedGeo = new THREE.SphereGeometry(3, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
const mushroomCapRedMat = new THREE.MeshLambertMaterial({ color: 0xCC2222 });
const mushroomCapPurpleGeo = new THREE.SphereGeometry(2.5, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
const mushroomCapPurpleMat = new THREE.MeshLambertMaterial({ color: 0x8B008B });
const twistedTrunkGeo = new THREE.CylinderGeometry(2, 5, 20, 6);
const twistedTrunkMat = new THREE.MeshLambertMaterial({ color: 0x3A3A2A });
const twistedBranchGeo = new THREE.CylinderGeometry(0.4, 1.5, 10, 5);

function createPoisonPool(x, y, z) {
  const radius = 8 + Math.random() * 15;
  const geo = new THREE.CircleGeometry(radius, 12);
  const mesh = new THREE.Mesh(geo, poisonPoolMat);
  mesh.position.set(x, y + 0.15, z);
  mesh.rotation.x = -Math.PI / 2;
  state.scene.add(mesh);
  registerStaticObject(mesh, x, z, 800);
  // Damage zone marker — keep standable so movement isn't blocked, biome-wide poison still applies.
  const box = new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(x, y + 0.15, z),
    new THREE.Vector3(radius * 2, 0.4, radius * 2)
  );
  box.userData = { kind: 'poison_pool', standable: true, soft: true, damagePerSec: 5, radius };
  state.colliders.push(box);
}

function createMushroom(x, y, z) {
  const group = new THREE.Group();
  const stem = new THREE.Mesh(mushroomStemGeo, mushroomStemMat);
  stem.position.y = 3;
  const stemScaleY = 0.5 + Math.random() * 1.5;
  stem.scale.y = stemScaleY;
  group.add(stem);

  const isRed = Math.random() > 0.4;
  const cap = new THREE.Mesh(
    isRed ? mushroomCapRedGeo : mushroomCapPurpleGeo,
    isRed ? mushroomCapRedMat : mushroomCapPurpleMat
  );
  cap.position.y = 5 + stem.scale.y * 3;
  cap.scale.set(1 + Math.random(), 1, 1 + Math.random());
  group.add(cap);

  // Dots on red mushrooms
  if (isRed) {
    const dotMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
    const dotGeo = new THREE.SphereGeometry(0.3, 4, 4);
    for (let d = 0; d < 5; d++) {
      const dot = new THREE.Mesh(dotGeo, dotMat);
      const angle = Math.random() * Math.PI * 2;
      dot.position.set(Math.cos(angle) * 2, cap.position.y + 0.5, Math.sin(angle) * 2);
      group.add(dot);
    }
  }

  group.position.set(x, y, z);
  state.scene.add(group);
  registerStaticObject(group, x, z, 600);
  // Mushroom can block movement (giant variant), small collider.
  const box = new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(x, y + 3, z),
    new THREE.Vector3(4, 6 * stemScaleY, 4)
  );
  box.userData = { kind: 'mushroom', standable: false, soft: true };
  state.colliders.push(box);
}

function createTwistedTree(x, y, z) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(twistedTrunkGeo, twistedTrunkMat);
  trunk.position.y = 10;
  trunk.rotation.z = (Math.random() - 0.5) * 0.4;
  trunk.rotation.x = (Math.random() - 0.5) * 0.2;
  group.add(trunk);

  const branchCount = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < branchCount; i++) {
    const branch = new THREE.Mesh(twistedBranchGeo, twistedTrunkMat);
    const angle = Math.random() * Math.PI * 2;
    branch.position.set(Math.cos(angle) * 3, 12 + Math.random() * 6, Math.sin(angle) * 3);
    branch.rotation.z = Math.cos(angle) * (0.8 + Math.random() * 0.5);
    branch.rotation.x = Math.sin(angle) * (0.8 + Math.random() * 0.5);
    group.add(branch);
  }

  group.position.set(x, y, z);
  group.traverse(c => { if (c.isMesh) c.userData.impactMaterial = 'wood'; });
  state.scene.add(group);
  registerStaticObject(group, x, z, 1000);

  const box = new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(x, y + 10, z),
    new THREE.Vector3(8, 20, 8)
  );
  box.userData = { kind: 'tree', standable: false };
  state.colliders.push(box);
}

export function initBiomeSwampVegetation() {
  let poolCount = 0, mushroomCount = 0, treeCount = 0;
  const maxAttempts = 3000;

  for (let i = 0; i < maxAttempts && (poolCount < 30 || mushroomCount < 120 || treeCount < 100); i++) {
    const x = (Math.random() - 0.5) * MAP_SIZE * 0.85;
    const z = (Math.random() - 0.5) * MAP_SIZE * 0.85;
    if (getBiomeAt(x, z) !== BIOME.SWAMP) continue;

    const y = getTerrainHeight(x, z);

    if (poolCount < 30 && Math.random() < 0.08) {
      createPoisonPool(x, y, z);
      poolCount++;
    } else if (mushroomCount < 120 && Math.random() < 0.3 && y > 0) {
      createMushroom(x, y, z);
      mushroomCount++;
    } else if (treeCount < 100 && Math.random() < 0.2 && y > 1) {
      createTwistedTree(x, y, z);
      treeCount++;
    }
  }
}

export function updateBiomeSwamp(delta) {
  // Swamp poison damage is handled in player update
}
