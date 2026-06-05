// Chunked grass and small decoration renderer.

import * as THREE from 'three';
import { state } from '../state.js';
import { MAP_SIZE } from '../config.js';
import { getTerrainHeight } from './terrain.js';

const GRASS_COUNT = 50000;
const FLOWER_COUNT = 2000;
const BUSH_COUNT = 500;
const CHUNK_SIZE = 350;
const GRASS_VISIBLE_RADIUS = 650;
const DECOR_VISIBLE_RADIUS = 800;
const GRASS_VISIBLE_RADIUS_SQ = GRASS_VISIBLE_RADIUS * GRASS_VISIBLE_RADIUS;
const DECOR_VISIBLE_RADIUS_SQ = DECOR_VISIBLE_RADIUS * DECOR_VISIBLE_RADIUS;

let grassTime = 0;
let lastVisibilityUpdate = 0;
const grassChunks = [];
const decorChunks = [];
const chunkMap = new Map();
const _matrix = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _pos = new THREE.Vector3();

function chunkCoord(value) {
  return Math.floor(value / CHUNK_SIZE);
}

function chunkKey(x, z) {
  return `${chunkCoord(x)},${chunkCoord(z)}`;
}

function getChunk(x, z) {
  const key = chunkKey(x, z);
  let chunk = chunkMap.get(key);
  if (!chunk) {
    const cx = (chunkCoord(x) + 0.5) * CHUNK_SIZE;
    const cz = (chunkCoord(z) + 0.5) * CHUNK_SIZE;
    chunk = { key, x: cx, z: cz, grass: [], flowers: [], bushes: [] };
    chunkMap.set(key, chunk);
  }
  return chunk;
}

function createGrassBladeGeometry() {
  const geo = new THREE.BufferGeometry();
  const vertices = new Float32Array([
    -0.3, 0, 0,
     0.3, 0, 0,
    -0.15, 3.5, 0,
     0.15, 3.5, 0
  ]);
  const indices = new Uint16Array([0, 1, 2, 1, 3, 2]);
  const uvs = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);

  geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  geo.computeVertexNormals();
  return geo;
}

function createInstancedGrassGeometry(baseGeo, positions) {
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = baseGeo.index;
  geo.setAttribute('position', baseGeo.attributes.position);
  geo.setAttribute('uv', baseGeo.attributes.uv);
  geo.setAttribute('normal', baseGeo.attributes.normal);

  const instancePositions = new Float32Array(positions.length * 3);
  const instanceScales = new Float32Array(positions.length);
  const instancePhases = new Float32Array(positions.length);

  for (let i = 0; i < positions.length; i++) {
    const p = positions[i];
    instancePositions[i * 3] = p.x;
    instancePositions[i * 3 + 1] = p.y;
    instancePositions[i * 3 + 2] = p.z;
    instanceScales[i] = p.scale;
    instancePhases[i] = p.phase;
  }

  geo.setAttribute('instancePosition', new THREE.InstancedBufferAttribute(instancePositions, 3));
  geo.setAttribute('instanceScale', new THREE.InstancedBufferAttribute(instanceScales, 1));
  geo.setAttribute('instancePhase', new THREE.InstancedBufferAttribute(instancePhases, 1));
  geo.instanceCount = positions.length;
  geo.computeBoundingSphere();
  return geo;
}

const grassVertexShader = `
  attribute vec3 instancePosition;
  attribute float instanceScale;
  attribute float instancePhase;

  uniform float time;
  uniform vec3 playerPos;

  varying float vHeight;
  varying float vDist;

  void main() {
    vec3 pos = position * instanceScale;
    float height = pos.y / 3.5;
    float windStrength = height * height * 2.0;

    float wind1 = sin(time * 1.5 + instancePhase + instancePosition.x * 0.05) * 0.8;
    float wind2 = sin(time * 2.3 + instancePhase * 1.5 + instancePosition.z * 0.07) * 0.4;
    float wind3 = sin(time * 0.7 + instancePhase * 0.5) * 0.3;

    pos.x += (wind1 + wind2 + wind3) * windStrength;
    pos.z += (wind2 + wind3 * 0.5) * windStrength * 0.6;

    vec3 toPlayer = instancePosition - playerPos;
    float distToPlayer = length(toPlayer.xz);
    vec2 pushDir = distToPlayer > 0.01 ? normalize(toPlayer.xz) : vec2(0.0);
    float pushStrength = smoothstep(15.0, 3.0, distToPlayer) * height * 2.0;
    pos.xz += pushDir * pushStrength;

    pos += instancePosition;
    vHeight = height;
    vDist = distToPlayer;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const grassFragmentShader = `
  varying float vHeight;
  varying float vDist;

  void main() {
    vec3 baseColor = vec3(0.1, 0.35, 0.08);
    vec3 tipColor = vec3(0.25, 0.55, 0.15);
    vec3 color = mix(baseColor, tipColor, vHeight);
    color *= 0.9 + 0.1 * sin(vDist * 0.1);
    gl_FragColor = vec4(color, 1.0);
  }
`;

function isGrassPosition(x, z, y) {
  if (y < 3 || y > 30) return false;
  const roadX = Math.abs(((x + MAP_SIZE / 2) % 500) - 250);
  const roadZ = Math.abs(((z + MAP_SIZE / 2) % 500) - 250);
  return roadX >= 25 && roadZ >= 25;
}

function collectPositions() {
  chunkMap.clear();

  let grassCollected = 0;
  for (let i = 0; i < GRASS_COUNT * 2 && grassCollected < GRASS_COUNT; i++) {
    const x = (Math.random() - 0.5) * MAP_SIZE * 0.95;
    const z = (Math.random() - 0.5) * MAP_SIZE * 0.95;
    const y = getTerrainHeight(x, z);
    if (!isGrassPosition(x, z, y)) continue;
    getChunk(x, z).grass.push({
      x, y, z,
      scale: 0.6 + Math.random() * 1.0,
      phase: Math.random() * Math.PI * 2
    });
    grassCollected++;
  }

  const flowerColors = [0xff6b6b, 0xfeca57, 0xff9ff3, 0x54a0ff, 0x5f27cd, 0xff6348];
  for (let i = 0; i < FLOWER_COUNT; i++) {
    const x = (Math.random() - 0.5) * MAP_SIZE * 0.9;
    const z = (Math.random() - 0.5) * MAP_SIZE * 0.9;
    const y = getTerrainHeight(x, z);
    if (!isGrassPosition(x, z, y)) continue;
    getChunk(x, z).flowers.push({ x, y, z, color: flowerColors[Math.floor(Math.random() * flowerColors.length)] });
  }

  for (let i = 0; i < BUSH_COUNT; i++) {
    const x = (Math.random() - 0.5) * MAP_SIZE * 0.9;
    const z = (Math.random() - 0.5) * MAP_SIZE * 0.9;
    const y = getTerrainHeight(x, z);
    if (y < 3 || y > 25) continue;
    getChunk(x, z).bushes.push({ x, y, z, scale: 3 + Math.random() * 4 });
  }
}

function setInstanceMatrix(mesh, index, x, y, z, sx, sy, sz) {
  _pos.set(x, y, z);
  _scale.set(sx, sy, sz);
  _matrix.compose(_pos, _quat, _scale);
  mesh.setMatrixAt(index, _matrix);
}

function createFlowerMeshes(flowers) {
  if (flowers.length === 0) return [];

  const stemGeo = new THREE.CylinderGeometry(0.1, 0.1, 2, 4);
  const stemMat = new THREE.MeshLambertMaterial({ color: 0x2d5a27 });
  const stemMesh = new THREE.InstancedMesh(stemGeo, stemMat, flowers.length);

  const petalGeo = new THREE.SphereGeometry(0.5, 6, 6);
  const petalMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const petalMesh = new THREE.InstancedMesh(petalGeo, petalMat, flowers.length);

  for (let i = 0; i < flowers.length; i++) {
    const f = flowers[i];
    setInstanceMatrix(stemMesh, i, f.x, f.y + 1, f.z, 1, 1, 1);
    setInstanceMatrix(petalMesh, i, f.x, f.y + 2.2, f.z, 1, 0.5, 1);
    petalMesh.setColorAt(i, new THREE.Color(f.color));
  }

  stemMesh.instanceMatrix.needsUpdate = true;
  petalMesh.instanceMatrix.needsUpdate = true;
  if (petalMesh.instanceColor) petalMesh.instanceColor.needsUpdate = true;
  return [stemMesh, petalMesh];
}

function createBushMesh(bushes) {
  if (bushes.length === 0) return null;

  const bushGeo = new THREE.SphereGeometry(1, 6, 6);
  const bushMat = new THREE.MeshLambertMaterial({ color: 0x3a6a2a });
  const bushMesh = new THREE.InstancedMesh(bushGeo, bushMat, bushes.length);

  for (let i = 0; i < bushes.length; i++) {
    const b = bushes[i];
    setInstanceMatrix(bushMesh, i, b.x, b.y + 2, b.z, b.scale, b.scale * 0.6, b.scale);
  }

  bushMesh.instanceMatrix.needsUpdate = true;
  return bushMesh;
}

export function initGrass() {
  grassChunks.length = 0;
  decorChunks.length = 0;
  collectPositions();

  const baseGrassGeo = createGrassBladeGeometry();
  const grassMat = new THREE.ShaderMaterial({
    vertexShader: grassVertexShader,
    fragmentShader: grassFragmentShader,
    uniforms: {
      time: { value: 0 },
      playerPos: { value: new THREE.Vector3() }
    },
    side: THREE.DoubleSide,
    transparent: false
  });

  chunkMap.forEach((chunk) => {
    if (chunk.grass.length > 0) {
      const grassGeo = createInstancedGrassGeometry(baseGrassGeo, chunk.grass);
      const grassMesh = new THREE.Mesh(grassGeo, grassMat);
      // Distance chunking handles visibility; custom instance attributes do not produce a useful default bounds.
      grassMesh.frustumCulled = false;
      grassMesh.visible = false;
      state.scene.add(grassMesh);
      grassChunks.push({ x: chunk.x, z: chunk.z, mesh: grassMesh });
    }

    const meshes = createFlowerMeshes(chunk.flowers);
    const bushMesh = createBushMesh(chunk.bushes);
    if (bushMesh) meshes.push(bushMesh);
    if (meshes.length > 0) {
      for (let i = 0; i < meshes.length; i++) {
        meshes[i].frustumCulled = true;
        meshes[i].visible = false;
        state.scene.add(meshes[i]);
      }
      decorChunks.push({ x: chunk.x, z: chunk.z, meshes });
    }
  });
}

function updateChunkVisibility(px, pz) {
  for (let i = 0; i < grassChunks.length; i++) {
    const chunk = grassChunks[i];
    const dx = chunk.x - px;
    const dz = chunk.z - pz;
    const visible = dx * dx + dz * dz <= GRASS_VISIBLE_RADIUS_SQ;
    if (chunk.mesh.visible !== visible) chunk.mesh.visible = visible;
  }

  for (let i = 0; i < decorChunks.length; i++) {
    const chunk = decorChunks[i];
    const dx = chunk.x - px;
    const dz = chunk.z - pz;
    const visible = dx * dx + dz * dz <= DECOR_VISIBLE_RADIUS_SQ;
    for (let j = 0; j < chunk.meshes.length; j++) {
      if (chunk.meshes[j].visible !== visible) chunk.meshes[j].visible = visible;
    }
  }
}

export function updateGrass(delta) {
  if (grassChunks.length === 0) return;

  grassTime += delta;
  const p = state.controls ? state.controls.getObject().position : null;

  for (let i = 0; i < grassChunks.length; i++) {
    const material = grassChunks[i].mesh.material;
    material.uniforms.time.value = grassTime;
    if (p) material.uniforms.playerPos.value.set(p.x, p.y, p.z);
  }

  if (p && performance.now() - lastVisibilityUpdate > 150) {
    updateChunkVisibility(p.x, p.z);
    lastVisibilityUpdate = performance.now();
  }
}
