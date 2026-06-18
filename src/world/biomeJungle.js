// Jungle biome: giant ferns (GPU instanced), vines, massive trees, dense fog

import * as THREE from 'three';
import { state } from '../state.js';
import { MAP_SIZE, BIOME_CONFIG } from '../config.js';
import { getBiomeAt, BIOME } from './biomes.js';
import { getTerrainHeight } from './terrain.js';
import { registerStaticObject } from '../systems/staticVisibility.js';

// Shared resources
const fernMat = new THREE.MeshLambertMaterial({ color: 0x228B22, side: THREE.DoubleSide });
const vineMat = new THREE.MeshLambertMaterial({ color: 0x3A5A1A });
const vineGeo = new THREE.CylinderGeometry(0.2, 0.1, 20, 4);
const giantTrunkGeo = new THREE.CylinderGeometry(10, 16, 80, 8);
const giantTrunkMat = new THREE.MeshLambertMaterial({ color: 0x4a3020 });
const giantCanopyGeo = new THREE.SphereGeometry(40, 8, 8);
const giantCanopyMat = new THREE.MeshLambertMaterial({ color: 0x1B5E20 });
const giantCanopy2Geo = new THREE.SphereGeometry(30, 8, 8);

// === Fern InstancedMesh ===
// Build a single merged geometry for a stylized fern (5 plane leaves arranged radially)
// then GPU-instance it across the jungle for ~400 ferns at ~zero overhead.
let fernInstancedMesh = null;

function buildFernInstancedGeometry() {
  // Merge 5 plane leaves into a single geometry by transforming each plane.
  const leafCount = 5;
  const geos = [];
  for (let i = 0; i < leafCount; i++) {
    const leaf = new THREE.PlaneGeometry(6, 18);
    const angle = (i / leafCount) * Math.PI * 2;
    const m = new THREE.Matrix4();
    m.makeRotationY(angle);
    m.multiply(new THREE.Matrix4().makeRotationX(-0.4));
    m.setPosition(Math.cos(angle) * 2, 6, Math.sin(angle) * 2);
    leaf.applyMatrix4(m);
    geos.push(leaf);
  }
  // Merge by concatenation
  const merged = new THREE.BufferGeometry();
  let posCount = 0, idxCount = 0;
  for (const g of geos) {
    posCount += g.attributes.position.count;
    idxCount += g.index ? g.index.count : g.attributes.position.count;
  }
  const positions = new Float32Array(posCount * 3);
  const normals = new Float32Array(posCount * 3);
  const uvs = new Float32Array(posCount * 2);
  const indices = new Uint16Array(idxCount);
  let posOffset = 0, idxOffset = 0, vertexOffset = 0;
  for (const g of geos) {
    const gPos = g.attributes.position.array;
    const gNorm = g.attributes.normal ? g.attributes.normal.array : null;
    const gUv = g.attributes.uv ? g.attributes.uv.array : null;
    positions.set(gPos, posOffset * 3);
    if (gNorm) normals.set(gNorm, posOffset * 3);
    if (gUv) uvs.set(gUv, posOffset * 2);
    const gIdx = g.index;
    if (gIdx) {
      const arr = gIdx.array;
      for (let i = 0; i < arr.length; i++) indices[idxOffset++] = arr[i] + vertexOffset;
    }
    vertexOffset += g.attributes.position.count;
    posOffset += g.attributes.position.count;
  }
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  merged.computeBoundingSphere();
  return merged;
}

function initFernInstanced(maxCount) {
  const geo = buildFernInstancedGeometry();
  fernInstancedMesh = new THREE.InstancedMesh(geo, fernMat, maxCount);
  fernInstancedMesh.count = 0; // grow as we place
  fernInstancedMesh.frustumCulled = true;
  fernInstancedMesh.userData.impactMaterial = 'wood';
  state.scene.add(fernInstancedMesh);
}

const _tmpMatrix = new THREE.Matrix4();
const _tmpQuat = new THREE.Quaternion();
const _tmpScale = new THREE.Vector3();
const _tmpPos = new THREE.Vector3();

function placeFernInstance(x, y, z) {
  if (!fernInstancedMesh || fernInstancedMesh.count >= fernInstancedMesh.instanceMatrix.count) return;
  _tmpPos.set(x, y, z);
  _tmpQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI * 2);
  const s = 0.85 + Math.random() * 0.4;
  _tmpScale.set(s, s, s);
  _tmpMatrix.compose(_tmpPos, _tmpQuat, _tmpScale);
  fernInstancedMesh.setMatrixAt(fernInstancedMesh.count, _tmpMatrix);
  fernInstancedMesh.count++;
  // Small soft collider so player doesn't snag on every leaf — minimal blocker
  const box = new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(x, y + 5, z),
    new THREE.Vector3(3, 10, 3)
  );
  box.userData = { kind: 'fern', standable: false, soft: true };
  state.colliders.push(box);
}

function createVine(x, y, z) {
  const vine = new THREE.Mesh(vineGeo, vineMat);
  vine.position.set(x, y + 30 + Math.random() * 20, z);
  vine.rotation.z = (Math.random() - 0.5) * 0.3;
  vine.scale.y = 0.5 + Math.random() * 1.5;
  state.scene.add(vine);
  registerStaticObject(vine, x, z, 600);
  // Thin tall collider for vines hanging from canopy
  const box = new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(x, y + 30, z),
    new THREE.Vector3(1.2, 30, 1.2)
  );
  box.userData = { kind: 'vine', standable: false, soft: true };
  state.colliders.push(box);
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
  initFernInstanced(420); // 400 + small headroom

  let fernCount = 0, vineCount = 0, giantCount = 0;
  const maxAttempts = 4000;

  for (let i = 0; i < maxAttempts && (fernCount < 400 || vineCount < 200 || giantCount < 50); i++) {
    const x = (Math.random() - 0.5) * MAP_SIZE * 0.85;
    const z = (Math.random() - 0.5) * MAP_SIZE * 0.85;
    if (getBiomeAt(x, z) !== BIOME.JUNGLE) continue;

    const y = getTerrainHeight(x, z);
    if (y < 2) continue;

    if (fernCount < 400 && Math.random() < 0.4) {
      placeFernInstance(x, y, z);
      fernCount++;
    } else if (vineCount < 200 && Math.random() < 0.3) {
      createVine(x, y, z);
      vineCount++;
    } else if (giantCount < 50 && Math.random() < 0.08) {
      createGiantTree(x, y, z);
      giantCount++;
    }
  }

  if (fernInstancedMesh) {
    fernInstancedMesh.instanceMatrix.needsUpdate = true;
  }
}

// === Local jungle fog ===
// Three.js uses a single scene-wide fog; instead we tint the scene background and lower
// visibility when the player stands inside the jungle biome.
const JUNGLE_FOG_COLOR = new THREE.Color(BIOME_CONFIG.JUNGLE.fogColor || 0x0a2a0a);
const JUNGLE_FOG_NEAR = 80;
const JUNGLE_FOG_FAR = 380;
let savedFog = null;

export function updateBiomeJungle(delta) {
  if (!state.player || !state.scene) return;
  const px = state.player.position.x;
  const pz = state.player.position.z;
  const inJungle = getBiomeAt(px, pz) === BIOME.JUNGLE;

  // Lazily snapshot baseline fog the first time we modify it
  if (savedFog === null && state.scene.fog) {
    savedFog = {
      color: state.scene.fog.color.clone(),
      near: state.scene.fog.near,
      far: state.scene.fog.far,
    };
  }

  const fog = state.scene.fog;
  if (!fog) return;

  // Lerp toward jungle fog when inside, restore otherwise.
  const t = inJungle ? Math.min(1, delta * 1.5) : Math.min(1, delta * 0.8);
  if (inJungle) {
    fog.color.lerp(JUNGLE_FOG_COLOR, t);
    fog.near = THREE.MathUtils.lerp(fog.near, JUNGLE_FOG_NEAR, t);
    fog.far = THREE.MathUtils.lerp(fog.far, JUNGLE_FOG_FAR, t);
  } else if (savedFog) {
    fog.color.lerp(savedFog.color, t);
    fog.near = THREE.MathUtils.lerp(fog.near, savedFog.near, t);
    fog.far = THREE.MathUtils.lerp(fog.far, savedFog.far, t);
  }
}
