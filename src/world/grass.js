// Zelda BOTW style flowing grass system
// Paper-like flat grass blades that sway in the wind

import * as THREE from 'three';
import { state } from '../state.js';
import { MAP_SIZE } from '../config.js';
import { getTerrainHeight } from './terrain.js';

let grassMesh = null;
let grassPositions = [];
let grassTime = 0;

// Create a single grass blade geometry (flat quad like paper)
function createGrassBladeGeometry() {
  const geo = new THREE.BufferGeometry();

  // 4 vertices forming a flat quad
  const vertices = new Float32Array([
    -0.3, 0, 0,    // bottom-left
     0.3, 0, 0,    // bottom-right
    -0.15, 3.5, 0, // top-left (narrower)
     0.15, 3.5, 0  // top-right (narrower)
  ]);

  const indices = new Uint16Array([
    0, 1, 2,
    1, 3, 2
  ]);

  const uvs = new Float32Array([
    0, 0,
    1, 0,
    0, 1,
    1, 1
  ]);

  geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  geo.computeVertexNormals();

  return geo;
}

// Wind animation vertex shader
const grassVertexShader = `
  attribute vec3 instancePosition;
  attribute float instanceScale;
  attribute float instancePhase;

  uniform float time;
  uniform vec3 playerPos;

  varying float vHeight;
  varying float vDist;

  void main() {
    vec3 pos = position;

    // Scale
    pos *= instanceScale;

    // Wind sway - stronger at top
    float height = pos.y / 3.5;
    float windStrength = height * height * 2.0;

    // Multiple wind frequencies for natural look
    float wind1 = sin(time * 1.5 + instancePhase + instancePosition.x * 0.05) * 0.8;
    float wind2 = sin(time * 2.3 + instancePhase * 1.5 + instancePosition.z * 0.07) * 0.4;
    float wind3 = sin(time * 0.7 + instancePhase * 0.5) * 0.3;

    pos.x += (wind1 + wind2 + wind3) * windStrength;
    pos.z += (wind2 + wind3 * 0.5) * windStrength * 0.6;

    // Player interaction - grass bends away from player
    vec3 toPlayer = instancePosition - playerPos;
    float distToPlayer = length(toPlayer.xz);
    float pushStrength = smoothstep(15.0, 3.0, distToPlayer) * height * 2.0;
    pos.xz += normalize(toPlayer.xz) * pushStrength;

    // Translate to instance position
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
    // Color gradient from dark at base to light at tip
    vec3 baseColor = vec3(0.1, 0.35, 0.08);
    vec3 tipColor = vec3(0.25, 0.55, 0.15);
    vec3 color = mix(baseColor, tipColor, vHeight);

    // Slight variation based on distance
    color *= 0.9 + 0.1 * sin(vDist * 0.1);

    gl_FragColor = vec4(color, 1.0);
  }
`;

export function initGrass() {
  const grassCount = 50000;
  const grassGeo = createGrassBladeGeometry();

  // Collect valid grass positions
  grassPositions = [];
  for (let i = 0; i < grassCount * 2; i++) {
    if (grassPositions.length >= grassCount) break;

    let x = (Math.random() - 0.5) * MAP_SIZE * 0.95;
    let z = (Math.random() - 0.5) * MAP_SIZE * 0.95;
    let y = getTerrainHeight(x, z);

    // Only on grass terrain
    if (y < 3 || y > 30) continue;

    // Not on roads
    const roadX = Math.abs(((x + MAP_SIZE / 2) % 500) - 250);
    const roadZ = Math.abs(((z + MAP_SIZE / 2) % 500) - 250);
    if (roadX < 25 || roadZ < 25) continue;

    grassPositions.push({ x, y, z });
  }

  const actualCount = grassPositions.length;

  // Create instanced mesh
  const instancePositions = new Float32Array(actualCount * 3);
  const instanceScales = new Float32Array(actualCount);
  const instancePhases = new Float32Array(actualCount);

  for (let i = 0; i < actualCount; i++) {
    const p = grassPositions[i];
    instancePositions[i * 3] = p.x;
    instancePositions[i * 3 + 1] = p.y;
    instancePositions[i * 3 + 2] = p.z;
    instanceScales[i] = 0.6 + Math.random() * 1.0;
    instancePhases[i] = Math.random() * Math.PI * 2;
  }

  grassGeo.setAttribute('instancePosition', new THREE.InstancedBufferAttribute(instancePositions, 3));
  grassGeo.setAttribute('instanceScale', new THREE.InstancedBufferAttribute(instanceScales, 1));
  grassGeo.setAttribute('instancePhase', new THREE.InstancedBufferAttribute(instancePhases, 1));

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

  grassMesh = new THREE.Mesh(grassGeo, grassMat);
  grassMesh.frustumCulled = false;
  state.scene.add(grassMesh);

  // Add flowers scattered in grass
  const flowerColors = [0xff6b6b, 0xfeca57, 0xff9ff3, 0x54a0ff, 0x5f27cd, 0xff6348];
  for (let i = 0; i < 2000; i++) {
    let fx = (Math.random() - 0.5) * MAP_SIZE * 0.9;
    let fz = (Math.random() - 0.5) * MAP_SIZE * 0.9;
    let fy = getTerrainHeight(fx, fz);
    if (fy < 3 || fy > 30) continue;

    const flowerColor = flowerColors[Math.floor(Math.random() * flowerColors.length)];
    const flowerMat = new THREE.MeshBasicMaterial({ color: flowerColor });

    // Flower stem
    const stemGeo = new THREE.CylinderGeometry(0.1, 0.1, 2, 4);
    const stemMat = new THREE.MeshLambertMaterial({ color: 0x2d5a27 });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.set(fx, fy + 1, fz);

    // Flower head
    const petalGeo = new THREE.SphereGeometry(0.5, 6, 6);
    const petal = new THREE.Mesh(petalGeo, flowerMat);
    petal.position.set(fx, fy + 2.2, fz);
    petal.scale.y = 0.5;

    state.scene.add(stem);
    state.scene.add(petal);
  }

  // Add small bushes
  const bushMat = new THREE.MeshLambertMaterial({ color: 0x3a6a2a });
  for (let i = 0; i < 500; i++) {
    let bx = (Math.random() - 0.5) * MAP_SIZE * 0.9;
    let bz = (Math.random() - 0.5) * MAP_SIZE * 0.9;
    let by = getTerrainHeight(bx, bz);
    if (by < 3 || by > 25) continue;

    const bushGeo = new THREE.SphereGeometry(3 + Math.random() * 4, 6, 6);
    const bush = new THREE.Mesh(bushGeo, bushMat);
    bush.position.set(bx, by + 2, bz);
    bush.scale.y = 0.6;
    state.scene.add(bush);
  }
}

export function updateGrass(delta) {
  if (!grassMesh) return;

  grassTime += delta;
  grassMesh.material.uniforms.time.value = grassTime;

  // Update player position for grass interaction
  if (state.controls) {
    const p = state.controls.getObject().position;
    grassMesh.material.uniforms.playerPos.value.set(p.x, p.y, p.z);
  }
}
