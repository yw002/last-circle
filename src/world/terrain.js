// Terrain generation and height functions

import * as THREE from 'three';
import { state } from '../state.js';
import { MAP_SIZE } from '../config.js';

export function getBaseTerrainHeight(x, z) {
  let dist = Math.sqrt(x * x + z * z);
  let height = 80 - (dist / (MAP_SIZE / 2)) * 80;
  height += Math.sin(x / 150) * 30 + Math.cos(z / 150) * 30;
  height += Math.sin(x / 30) * 8 + Math.cos(z / 30) * 8;
  return Math.max(-10, height);
}

export function getTerrainHeight(x, z) {
  // Flatten terrain near houses
  for (let i = 0; i < state.housePositions.length; i++) {
    let h = state.housePositions[i];
    let dx = x - h.x;
    let dz = z - h.z;
    let distSq = dx * dx + dz * dz;

    if (distSq < 26 * 26) {
      let baseH = h.baseHeight;
      if (distSq < 18 * 18) {
        return baseH;
      }
      let dist = Math.sqrt(distSq);
      let t = (dist - 18) / 8;
      return THREE.MathUtils.lerp(baseH, getBaseTerrainHeight(x, z), t);
    }
  }
  return getBaseTerrainHeight(x, z);
}

export function initTerrain() {
  const geometry = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, 200, 200);
  geometry.rotateX(-Math.PI / 2);
  const vertices = geometry.attributes.position.array;
  const colors = [];

  for (let i = 0; i < vertices.length; i += 3) {
    let x = vertices[i];
    let z = vertices[i + 2];
    let height = getTerrainHeight(x, z);
    vertices[i + 1] = height;

    let color = new THREE.Color();
    if (height < 2) {
      color.setHex(0x2980b9);
    } else if (height < 5) {
      color.setHex(0x3d8c40);
    } else if (height < 15) {
      color.setHex(0x4a7c2e);
    } else if (height < 30) {
      color.setHex(0x556b2f);
    } else {
      color.setHex(0x6b8e23);
    }

    // Roads
    let roadFactor = 0;
    for (let rx = -MAP_SIZE / 2; rx < MAP_SIZE / 2; rx += 500) {
      if (Math.abs(x - rx) < 20) roadFactor = 0.5;
    }
    for (let rz = -MAP_SIZE / 2; rz < MAP_SIZE / 2; rz += 500) {
      if (Math.abs(z - rz) < 20) roadFactor = 0.5;
    }
    for (let rx = -MAP_SIZE / 2; rx < MAP_SIZE / 2; rx += 500) {
      for (let rz = -MAP_SIZE / 2; rz < MAP_SIZE / 2; rz += 500) {
        if (Math.abs(x - rx) < 25 && Math.abs(z - rz) < 25) {
          roadFactor = 0.7;
        }
      }
    }

    if (roadFactor > 0) {
      color.lerp(new THREE.Color(0x555555), roadFactor);
    }

    colors.push(color.r, color.g, color.b);
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  const terrain = new THREE.Mesh(geometry, material);
  state.scene.add(terrain);
  state.objects.push(terrain);

  const waterGeo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.MeshBasicMaterial({ color: 0x2980b9, transparent: true, opacity: 0.8 });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.y = 0;
  state.scene.add(water);
}
