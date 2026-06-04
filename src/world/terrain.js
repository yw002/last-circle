// Terrain generation and height functions - Optimized with spatial grid

import * as THREE from 'three';
import { state } from '../state.js';
import { MAP_SIZE } from '../config.js';

// Spatial grid for house proximity checks
const GRID_CELL_SIZE = 50;
let houseGrid = {};

function buildHouseGrid() {
  houseGrid = {};
  state.housePositions.forEach(h => {
    let cx = Math.floor(h.x / GRID_CELL_SIZE);
    let cz = Math.floor(h.z / GRID_CELL_SIZE);
    let key = `${cx},${cz}`;
    if (!houseGrid[key]) houseGrid[key] = [];
    houseGrid[key].push(h);
  });
}

function getNearbyHouses(x, z) {
  let cx = Math.floor(x / GRID_CELL_SIZE);
  let cz = Math.floor(z / GRID_CELL_SIZE);
  let result = [];

  // Check 3x3 grid cells
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      let key = `${cx + dx},${cz + dz}`;
      if (houseGrid[key]) {
        result.push(...houseGrid[key]);
      }
    }
  }
  return result;
}

export function getBaseTerrainHeight(x, z) {
  let dist = Math.sqrt(x * x + z * z);

  // Base elevation - higher in center
  let height = 80 - (dist / (MAP_SIZE / 2)) * 80;

  // Mountain ranges (3 major peaks)
  const peak1 = Math.exp(-((x - 800) ** 2 + (z - 600) ** 2) / 200000) * 120;
  const peak2 = Math.exp(-((x + 500) ** 2 + (z - 800) ** 2) / 150000) * 100;
  const peak3 = Math.exp(-((x - 300) ** 2 + (z + 700) ** 2) / 180000) * 110;
  height += peak1 + peak2 + peak3;

  // Rolling hills
  height += Math.sin(x / 150) * 30 + Math.cos(z / 150) * 30;
  height += Math.sin(x / 80) * 15 + Math.cos(z / 80) * 15;

  // Small detail bumps
  height += Math.sin(x / 30) * 8 + Math.cos(z / 30) * 8;

  // Valleys (low areas for rivers)
  const valley1 = Math.exp(-((x - 200) ** 2) / 50000) * -20;
  const valley2 = Math.exp(-((x + 400) ** 2) / 40000) * -15;
  height += valley1 + valley2;

  return Math.max(-10, height);
}

export function getTerrainHeight(x, z) {
  // Use spatial grid to only check nearby houses
  let nearbyHouses = getNearbyHouses(x, z);

  for (let i = 0; i < nearbyHouses.length; i++) {
    let h = nearbyHouses[i];
    let dx = x - h.x;
    let dz = z - h.z;
    let distSq = dx * dx + dz * dz;

    // House interior is 30x30, so we need to cover that area
    // Core flat area: inside the house walls (15 units from center)
    // Extended flat area: foundation around the house (20 units)
    // Transition area: smooth blend to natural terrain (20-30 units)

    if (distSq < 30 * 30) {
      let baseH = h.baseHeight;

      // Inside house walls - completely flat
      if (Math.abs(dx) <= 15 && Math.abs(dz) <= 15) {
        return baseH;
      }

      // Foundation area - flat around the house
      if (distSq < 20 * 20) {
        return baseH;
      }

      // Transition area - smooth blend
      let dist = Math.sqrt(distSq);
      let t = (dist - 20) / 10;
      return THREE.MathUtils.lerp(baseH, getBaseTerrainHeight(x, z), t);
    }
  }
  return getBaseTerrainHeight(x, z);
}

export function initTerrain() {
  // Build spatial grid after houses are generated
  buildHouseGrid();

  // Reduced resolution since fog hides distant terrain (100x100 instead of 150x150)
  const geometry = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, 100, 100);
  geometry.rotateX(-Math.PI / 2);
  const vertices = geometry.attributes.position.array;
  const colors = [];

  for (let i = 0; i < vertices.length; i += 3) {
    let x = vertices[i];
    let z = vertices[i + 2];
    let height = getTerrainHeight(x, z);
    vertices[i + 1] = height;

    let color = new THREE.Color();
    // Deep forest green - green mountains
    if (height < 2) {
      color.setHex(0x0D47A1); // Deep dark blue water
    } else if (height < 5) {
      color.setHex(0x1B5E20); // Very deep green lowlands
    } else if (height < 15) {
      color.setHex(0x2E7D32); // Deep forest green
    } else if (height < 30) {
      color.setHex(0x33691E); // Dark olive green hills
    } else {
      color.setHex(0x558B2F); // Green mountains (not brown!)
    }

    // Roads - optimized with modulo instead of loop
    const roadX = Math.abs(((x + MAP_SIZE / 2) % 500) - 250);
    const roadZ = Math.abs(((z + MAP_SIZE / 2) % 500) - 250);
    let roadFactor = 0;
    if (roadX < 20 || roadZ < 20) roadFactor = 0.5;
    if (roadX < 20 && roadZ < 20) roadFactor = 0.7;

    if (roadFactor > 0) {
      color.lerp(new THREE.Color(0x5D4037), roadFactor);
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
