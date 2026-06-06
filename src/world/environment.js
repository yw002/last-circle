// Rich environment ecosystem: diverse trees, rivers, lakes, streams, mountains, sun

import * as THREE from 'three';
import { state } from '../state.js';
import { MAP_SIZE } from '../config.js';
import { getBaseTerrainHeight, getTerrainHeight } from './terrain.js';
import { spawnLoot } from './loot.js';
import { registerStaticObject } from '../systems/staticVisibility.js';

// ========== SHARED TREE RESOURCES ==========
// Pine tree
const trunkMatPine = new THREE.MeshLambertMaterial({ color: 0x5c4033 });
const leavesMatPine = new THREE.MeshLambertMaterial({ color: 0x274e13 });
const trunkGeoPine = new THREE.CylinderGeometry(5, 8, 60, 8);
const cone1Geo = new THREE.ConeGeometry(35, 70, 8);
const cone2Geo = new THREE.ConeGeometry(28, 60, 8);
const cone3Geo = new THREE.ConeGeometry(20, 50, 8);

// Oak tree
const trunkMatOak = new THREE.MeshLambertMaterial({ color: 0x4d2f1d });
const leavesMatOak = new THREE.MeshLambertMaterial({ color: 0x194d19 });
const trunkGeoOak = new THREE.CylinderGeometry(6, 10, 45, 8);
const sphere1Geo = new THREE.SphereGeometry(22, 8, 8);
const sphere2Geo = new THREE.SphereGeometry(18, 8, 8);
const sphere3Geo = new THREE.SphereGeometry(14, 8, 8);

// Birch tree
const trunkMatBirch = new THREE.MeshLambertMaterial({ color: 0xdddddd });
const leavesMatBirch = new THREE.MeshLambertMaterial({ color: 0xd4ac0d });
const trunkGeoBirch = new THREE.CylinderGeometry(3.5, 5.5, 60, 8);
const birch1Geo = new THREE.ConeGeometry(28, 54, 8);
const birch2Geo = new THREE.ConeGeometry(22, 46, 8);
const birch3Geo = new THREE.ConeGeometry(16, 38, 8);

// Cherry blossom
const trunkMatCherry = new THREE.MeshLambertMaterial({ color: 0x6b4226 });
const leavesMatCherry = new THREE.MeshLambertMaterial({ color: 0xffb7c5 });
const trunkGeoCherry = new THREE.CylinderGeometry(4, 7, 40, 8);

// Willow
const trunkMatWillow = new THREE.MeshLambertMaterial({ color: 0x4a3728 });
const leavesMatWillow = new THREE.MeshLambertMaterial({ color: 0x3a7a3a, side: THREE.DoubleSide });
const trunkGeoWillow = new THREE.CylinderGeometry(5, 9, 50, 8);

// Bamboo
const bambooMat = new THREE.MeshLambertMaterial({ color: 0x4a7a2a });
const bambooGeo = new THREE.CylinderGeometry(1.5, 2, 80, 6);
const bambooLeavesMat = new THREE.MeshLambertMaterial({ color: 0x3a6a1a, side: THREE.DoubleSide });

// Rock materials
const rockGeo = new THREE.DodecahedronGeometry(8, 1);
const rockMat = new THREE.MeshLambertMaterial({ color: 0x7f8c8d });
const rockDarkMat = new THREE.MeshLambertMaterial({ color: 0x5a5a5a });
const rockMossyMat = new THREE.MeshLambertMaterial({ color: 0x4a6a3a });

// Water materials - more realistic
const waterMat = new THREE.MeshLambertMaterial({
  color: 0x1a6b8a,
  transparent: true,
  opacity: 0.85,
  side: THREE.DoubleSide
});
const riverMat = new THREE.MeshLambertMaterial({
  color: 0x2980b9,
  transparent: true,
  opacity: 0.9,
  side: THREE.DoubleSide
});
const lakeMat = new THREE.MeshLambertMaterial({
  color: 0x1565c0,
  transparent: true,
  opacity: 0.85,
  side: THREE.DoubleSide
});

export function preGenerateHouses() {
  state.housePositions = [];
  for (let i = 0; i < 200; i++) {
    let x = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let z = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let baseHeight = getBaseTerrainHeight(x, z);
    if (baseHeight < 2) continue;

    let tooClose = false;
    for (let j = 0; j < state.housePositions.length; j++) {
      let h = state.housePositions[j];
      let dx = x - h.x;
      let dz = z - h.z;
      if (dx * dx + dz * dz < 80 * 80) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    state.housePositions.push({ x, z, baseHeight });
  }
}

export function initEnvironment() {
  initSun();
  initTrees();
  initRocks();
  initHouses();
  initRivers();
  initLakes();
  initStreams();
}

// ========== SUN ==========
function initSun() {
  const sunGeo = new THREE.SphereGeometry(100, 16, 16);
  const sunMat = new THREE.MeshBasicMaterial({
    color: 0xffff00,
    emissive: 0xffff00,
    emissiveIntensity: 1.0
  });
  const sun = new THREE.Mesh(sunGeo, sunMat);
  sun.position.set(1000, 2000, 500);
  state.scene.add(sun);

  const glowGeo = new THREE.SphereGeometry(150, 16, 16);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xffff88,
    transparent: true,
    opacity: 0.3
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.position.copy(sun.position);
  state.scene.add(glow);

  const rayMat = new THREE.MeshBasicMaterial({
    color: 0xffff88,
    transparent: true,
    opacity: 0.05,
    side: THREE.DoubleSide
  });
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const rayGeo = new THREE.PlaneGeometry(20, 800);
    const ray = new THREE.Mesh(rayGeo, rayMat);
    ray.position.copy(sun.position);
    ray.position.y -= 400;
    ray.rotation.z = angle;
    ray.rotation.x = Math.PI / 4;
    state.scene.add(ray);
  }
}

// ========== DIVERSE TREES ==========
function initTrees() {
  const cells = 30;
  const cellSize = 4500 / cells;

  for (let col = 0; col < cells; col++) {
    for (let row = 0; row < cells; row++) {
      let cellMinX = -2250 + col * cellSize;
      let cellMinZ = -2250 + row * cellSize;

      let x = cellMinX + 10 + Math.random() * (cellSize - 20);
      let z = cellMinZ + 10 + Math.random() * (cellSize - 20);
      let y = getTerrainHeight(x, z);

      if (y < 2) continue;

      let tooCloseToHouse = false;
      for (let h of state.housePositions) {
        let dx = x - h.x;
        let dz = z - h.z;
        if (dx * dx + dz * dz < 35 * 35) {
          tooCloseToHouse = true;
          break;
        }
      }
      if (tooCloseToHouse) continue;

      let tooCloseToRock = false;
      for (let j = 0; j < state.rockPositions.length; j++) {
        let r = state.rockPositions[j];
        let dx = x - r.x;
        let dz = z - r.z;
        if (dx * dx + dz * dz < 20 * 20) {
          tooCloseToRock = true;
          break;
        }
      }
      if (tooCloseToRock) continue;

      const tree = new THREE.Group();
      let treeType = Math.floor(Math.random() * 7);
      let trunk;

      if (treeType === 0) {
        trunk = new THREE.Mesh(trunkGeoPine, trunkMatPine); trunk.position.y = 30;
        const l1 = new THREE.Mesh(cone1Geo, leavesMatPine); l1.position.y = 65;
        const l2 = new THREE.Mesh(cone2Geo, leavesMatPine); l2.position.y = 95;
        const l3 = new THREE.Mesh(cone3Geo, leavesMatPine); l3.position.y = 120;
        tree.add(trunk, l1, l2, l3);
        state.objects.push(trunk);
      } else if (treeType === 1) {
        trunk = new THREE.Mesh(trunkGeoOak, trunkMatOak); trunk.position.y = 22.5;
        const l1 = new THREE.Mesh(sphere1Geo, leavesMatOak); l1.position.y = 48;
        const l2 = new THREE.Mesh(sphere2Geo, leavesMatOak); l2.position.y = 64;
        const l3 = new THREE.Mesh(sphere3Geo, leavesMatOak); l3.position.y = 78;
        tree.add(trunk, l1, l2, l3);
        state.objects.push(trunk);
      } else if (treeType === 2) {
        trunk = new THREE.Mesh(trunkGeoBirch, trunkMatBirch); trunk.position.y = 30;
        const l1 = new THREE.Mesh(birch1Geo, leavesMatBirch); l1.position.y = 62;
        const l2 = new THREE.Mesh(birch2Geo, leavesMatBirch); l2.position.y = 84;
        const l3 = new THREE.Mesh(birch3Geo, leavesMatBirch); l3.position.y = 104;
        tree.add(trunk, l1, l2, l3);
        state.objects.push(trunk);
      } else if (treeType === 3) {
        trunk = new THREE.Mesh(trunkGeoCherry, trunkMatCherry); trunk.position.y = 20;
        const crown1 = new THREE.Mesh(new THREE.SphereGeometry(20, 8, 8), leavesMatCherry); crown1.position.y = 45;
        const crown2 = new THREE.Mesh(new THREE.SphereGeometry(16, 8, 8), leavesMatCherry); crown2.position.set(10, 40, 5);
        const crown3 = new THREE.Mesh(new THREE.SphereGeometry(14, 8, 8), leavesMatCherry); crown3.position.set(-8, 42, -3);
        tree.add(trunk, crown1, crown2, crown3);
        state.objects.push(trunk);
      } else if (treeType === 4) {
        trunk = new THREE.Mesh(trunkGeoWillow, trunkMatWillow); trunk.position.y = 25;
        for (let b = 0; b < 12; b++) {
          const branchAngle = (b / 12) * Math.PI * 2;
          const branchGeo = new THREE.CylinderGeometry(0.3, 0.1, 40, 4);
          const branch = new THREE.Mesh(branchGeo, leavesMatWillow);
          branch.position.set(Math.cos(branchAngle) * 15, 50, Math.sin(branchAngle) * 15);
          branch.rotation.z = Math.cos(branchAngle) * 0.8;
          branch.rotation.x = Math.sin(branchAngle) * 0.8;
          tree.add(branch);
        }
        const crown = new THREE.Mesh(new THREE.SphereGeometry(25, 8, 8), leavesMatWillow); crown.position.y = 55;
        tree.add(trunk, crown);
        state.objects.push(trunk);
      } else if (treeType === 5) {
        for (let b = 0; b < 5; b++) {
          const bx = (Math.random() - 0.5) * 10;
          const bz = (Math.random() - 0.5) * 10;
          const bamboo = new THREE.Mesh(bambooGeo, bambooMat);
          bamboo.position.set(bx, 40, bz);
          tree.add(bamboo);
          for (let l = 0; l < 3; l++) {
            const leafGeo = new THREE.PlaneGeometry(8, 2);
            const leaf = new THREE.Mesh(leafGeo, bambooLeavesMat);
            leaf.position.set(bx + 4, 30 + l * 15, bz);
            leaf.rotation.z = -0.5;
            tree.add(leaf);
          }
        }
      } else {
        trunk = new THREE.Mesh(trunkGeoOak, trunkMatOak); trunk.position.y = 22.5;
        const l1 = new THREE.Mesh(sphere1Geo, leavesMatOak); l1.position.y = 48;
        const l2 = new THREE.Mesh(sphere2Geo, leavesMatOak); l2.position.y = 64;
        tree.add(trunk, l1, l2);
        state.objects.push(trunk);
      }

      tree.position.set(x, y - 6, z);
      tree.traverse((child) => {
        if (child.isMesh && !child.userData.impactMaterial) child.userData.impactMaterial = 'wood';
      });
      state.scene.add(tree);
      registerStaticObject(tree, x, z, 1300);
      tree.updateMatrixWorld(true);

      if (trunk) {
        const colliderBox = new THREE.Box3().setFromObject(trunk);
        state.colliders.push(colliderBox);
      }
    }
  }
}

// ========== ROCKS ==========
function initRocks() {
  state.rockPositions = [];

  for (let i = 0; i < 300; i++) {
    let x = (Math.random() - 0.5) * MAP_SIZE * 0.9;
    let z = (Math.random() - 0.5) * MAP_SIZE * 0.9;
    let y = getTerrainHeight(x, z);
    if (y < 0) continue;

    let tooCloseToHouse = false;
    for (let j = 0; j < state.housePositions.length; j++) {
      let h = state.housePositions[j];
      let dx = x - h.x;
      let dz = z - h.z;
      if (dx * dx + dz * dz < 30 * 30) {
        tooCloseToHouse = true;
        break;
      }
    }
    if (tooCloseToHouse) continue;

    const rockType = Math.floor(Math.random() * 3);
    let mat;
    if (rockType === 0) mat = rockMat;
    else if (rockType === 1) mat = rockDarkMat;
    else mat = rockMossyMat;

    const rock = new THREE.Mesh(rockGeo, mat);
    rock.userData = { impactMaterial: 'stone' };
    rock.scale.set(1 + Math.random() * 2, 0.5 + Math.random() * 0.5, 1 + Math.random() * 2);
    rock.position.set(x, y + rock.geometry.parameters.radius * 0.5, z);
    rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    state.scene.add(rock);
    registerStaticObject(rock, x, z, 900);
    state.objects.push(rock);

    state.rockPositions.push({ x, z });
    rock.updateMatrixWorld(true);

    const colliderBox = new THREE.Box3().setFromObject(rock);
    let dx = (colliderBox.max.x - colliderBox.min.x) * 0.15;
    let dz = (colliderBox.max.z - colliderBox.min.z) * 0.15;
    colliderBox.min.x += dx;
    colliderBox.max.x -= dx;
    colliderBox.min.z += dz;
    colliderBox.max.z -= dz;
    state.colliders.push(colliderBox);
  }
}

// ========== RIVERS - Flat and embedded in terrain ==========
function initRivers() {
  const riverColor = new THREE.Color(0x2980b9);
  const riverBedMat = new THREE.MeshLambertMaterial({ color: 0x1a5276 });

  for (let r = 0; r < 3; r++) {
    const riverPoints = [];
    const startX = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    const startZ = -MAP_SIZE / 2;
    const endX = startX + (Math.random() - 0.5) * 1000;
    const endZ = MAP_SIZE / 2;

    // Generate river path with curves
    const segments = 30;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = THREE.MathUtils.lerp(startX, endX, t) + Math.sin(t * Math.PI * 3) * 200;
      const z = THREE.MathUtils.lerp(startZ, endZ, t);
      // River follows terrain but slightly below
      const y = getTerrainHeight(x, z) - 0.5;
      riverPoints.push(new THREE.Vector3(x, y, z));
    }

    // Create river as flat plane segments
    const riverWidth = 12;
    for (let i = 0; i < riverPoints.length - 1; i++) {
      const p1 = riverPoints[i];
      const p2 = riverPoints[i + 1];

      // Calculate perpendicular direction for width
      const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
      const perp = new THREE.Vector3(-dir.z, 0, dir.x);

      // Create quad for river segment
      const vertices = new Float32Array([
        p1.x - perp.x * riverWidth, p1.y, p1.z - perp.z * riverWidth,
        p1.x + perp.x * riverWidth, p1.y, p1.z + perp.z * riverWidth,
        p2.x - perp.x * riverWidth, p2.y, p2.z - perp.z * riverWidth,
        p2.x + perp.x * riverWidth, p2.y, p2.z + perp.z * riverWidth,
      ]);

      const indices = [0, 1, 2, 1, 3, 2];
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      geo.setIndex(indices);
      geo.computeVertexNormals();

      const riverSegment = new THREE.Mesh(geo, riverMat);
      riverSegment.userData = { impactMaterial: 'water' };
      state.scene.add(riverSegment);
      registerStaticObject(riverSegment, (p1.x + p2.x) * 0.5, (p1.z + p2.z) * 0.5, 1000);
    }

    // River bed (darker bottom)
    for (let i = 0; i < riverPoints.length - 1; i++) {
      const p1 = riverPoints[i];
      const p2 = riverPoints[i + 1];
      const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
      const perp = new THREE.Vector3(-dir.z, 0, dir.x);
      const bedWidth = riverWidth + 2;

      const vertices = new Float32Array([
        p1.x - perp.x * bedWidth, p1.y - 0.3, p1.z - perp.z * bedWidth,
        p1.x + perp.x * bedWidth, p1.y - 0.3, p1.z + perp.z * bedWidth,
        p2.x - perp.x * bedWidth, p2.y - 0.3, p2.z - perp.z * bedWidth,
        p2.x + perp.x * bedWidth, p2.y - 0.3, p2.z + perp.z * bedWidth,
      ]);

      const indices = [0, 1, 2, 1, 3, 2];
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      geo.setIndex(indices);
      geo.computeVertexNormals();

      const bedSegment = new THREE.Mesh(geo, riverBedMat);
      bedSegment.userData = { impactMaterial: 'stone' };
      state.scene.add(bedSegment);
      registerStaticObject(bedSegment, (p1.x + p2.x) * 0.5, (p1.z + p2.z) * 0.5, 1000);
    }

    // Add reeds along river
    const reedMat = new THREE.MeshLambertMaterial({ color: 0x4a7a2a, side: THREE.DoubleSide });
    for (let i = 0; i < 80; i++) {
      const t = Math.random();
      const idx = Math.floor(t * (riverPoints.length - 1));
      const p = riverPoints[idx];
      const side = Math.random() > 0.5 ? 1 : -1;
      const reedGeo = new THREE.CylinderGeometry(0.2, 0.3, 8, 4);
      const reed = new THREE.Mesh(reedGeo, reedMat);
      reed.userData = { impactMaterial: 'wood' };
      reed.position.set(p.x + side * (14 + Math.random() * 6), p.y + 4, p.z + (Math.random() - 0.5) * 10);
      reed.rotation.z = (Math.random() - 0.5) * 0.3;
      state.scene.add(reed);
      registerStaticObject(reed, reed.position.x, reed.position.z, 700);
    }
  }
}

// ========== LAKES ==========
function initLakes() {
  for (let l = 0; l < 5; l++) {
    const lx = (Math.random() - 0.5) * MAP_SIZE * 0.6;
    const lz = (Math.random() - 0.5) * MAP_SIZE * 0.6;
    const lRadius = 60 + Math.random() * 80;

    const lakeGeo = new THREE.CircleGeometry(lRadius, 24);
    lakeGeo.rotateX(-Math.PI / 2);
    const lake = new THREE.Mesh(lakeGeo, lakeMat);
    lake.userData = { impactMaterial: 'water' };
    const ly = getTerrainHeight(lx, lz) - 0.5;
    lake.position.set(lx, ly, lz);
    state.scene.add(lake);
    registerStaticObject(lake, lx, lz, 1200);

    const shoreMat = new THREE.MeshLambertMaterial({ color: 0xc2b280 });
    const shoreGeo = new THREE.RingGeometry(lRadius - 5, lRadius + 15, 24);
    shoreGeo.rotateX(-Math.PI / 2);
    const shore = new THREE.Mesh(shoreGeo, shoreMat);
    shore.userData = { impactMaterial: 'dirt' };
    shore.position.set(lx, ly - 0.2, lz);
    state.scene.add(shore);
    registerStaticObject(shore, lx, lz, 1200);

    const bushMat = new THREE.MeshLambertMaterial({ color: 0x3a6a2a });
    for (let b = 0; b < 15; b++) {
      const angle = (b / 15) * Math.PI * 2;
      const dist = lRadius + 10 + Math.random() * 20;
      const bx = lx + Math.cos(angle) * dist;
      const bz = lz + Math.sin(angle) * dist;
      const by = getTerrainHeight(bx, bz);
      const bushGeo = new THREE.SphereGeometry(5 + Math.random() * 8, 6, 6);
      const bush = new THREE.Mesh(bushGeo, bushMat);
      bush.userData = { impactMaterial: 'wood' };
      bush.position.set(bx, by + 3, bz);
      bush.scale.y = 0.6;
      state.scene.add(bush);
      registerStaticObject(bush, bx, bz, 800);
    }

    const lilyMat = new THREE.MeshLambertMaterial({ color: 0x2d7a2d, side: THREE.DoubleSide });
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * lRadius * 0.7;
      const lilyGeo = new THREE.CircleGeometry(3, 8);
      lilyGeo.rotateX(-Math.PI / 2);
      const lily = new THREE.Mesh(lilyGeo, lilyMat);
      lily.userData = { impactMaterial: 'water' };
      lily.position.set(lx + Math.cos(angle) * dist, ly + 0.1, lz + Math.sin(angle) * dist);
      state.scene.add(lily);
      registerStaticObject(lily, lily.position.x, lily.position.z, 600);
    }
  }
}

// ========== STREAMS ==========
function initStreams() {
  for (let s = 0; s < 8; s++) {
    const streamPoints = [];
    const startX = (Math.random() - 0.5) * MAP_SIZE * 0.7;
    const startZ = (Math.random() - 0.5) * MAP_SIZE * 0.7;
    const length = 100 + Math.random() * 200;
    const angle = Math.random() * Math.PI * 2;
    const endX = startX + Math.cos(angle) * length;
    const endZ = startZ + Math.sin(angle) * length;

    const segments = 10;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = THREE.MathUtils.lerp(startX, endX, t) + Math.sin(t * Math.PI * 2) * 30;
      const z = THREE.MathUtils.lerp(startZ, endZ, t);
      const y = getTerrainHeight(x, z) - 0.3;
      streamPoints.push(new THREE.Vector3(x, y, z));
    }

    const streamCurve = new THREE.CatmullRomCurve3(streamPoints);
    const streamGeo = new THREE.TubeGeometry(streamCurve, 15, 2, 6, false);
    const stream = new THREE.Mesh(streamGeo, riverMat);
    stream.userData = { impactMaterial: 'water' };
    state.scene.add(stream);
    registerStaticObject(stream, (startX + endX) * 0.5, (startZ + endZ) * 0.5, 900);

    const stoneMat = new THREE.MeshLambertMaterial({ color: 0x8a8a8a });
    for (let i = 0; i < 15; i++) {
      const t = Math.random();
      const p = streamCurve.getPointAt(t);
      const stoneGeo = new THREE.SphereGeometry(1 + Math.random() * 1.5, 6, 6);
      const stone = new THREE.Mesh(stoneGeo, stoneMat);
      stone.userData = { impactMaterial: 'stone' };
      stone.position.set(p.x + (Math.random() - 0.5) * 8, p.y, p.z + (Math.random() - 0.5) * 8);
      stone.scale.y = 0.5;
      state.scene.add(stone);
      registerStaticObject(stone, stone.position.x, stone.position.z, 550);
    }
  }
}

// ========== HOUSES ==========
function initHouses() {
  const bldgBaseMat = new THREE.MeshLambertMaterial({ color: 0xf5f5dc, side: THREE.DoubleSide });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0xc0392b, side: THREE.DoubleSide });
  const roofGeo = new THREE.ConeGeometry(22, 14, 4, 1, true);
  const windowMat = new THREE.MeshLambertMaterial({
    color: 0x5dade2, side: THREE.DoubleSide, transparent: true, opacity: 0.35, depthWrite: false
  });
  const windowGeo = new THREE.BoxGeometry(0.1, 4.5, 6.0);
  const doorMat = new THREE.MeshLambertMaterial({ color: 0x5c4033, side: THREE.DoubleSide });
  const doorGeo = new THREE.BoxGeometry(6.5, 14, 0.1);

  const sideSegmentGeo = new THREE.BoxGeometry(0.5, 24, 12);
  const sideBottomGeo = new THREE.BoxGeometry(0.5, 10, 6);
  const sideTopGeo = new THREE.BoxGeometry(0.5, 9.5, 6);
  const backWallGeo = new THREE.BoxGeometry(30, 24, 0.5);
  const frontSegmentGeo = new THREE.BoxGeometry(11.75, 24, 0.5);
  const frontHeaderGeo = new THREE.BoxGeometry(6.5, 10, 0.5);
  const floorMat = new THREE.MeshLambertMaterial({ color: 0x512e10, side: THREE.DoubleSide });
  const floorGeo = new THREE.BoxGeometry(30, 0.4, 30);

  for (let i = 0; i < state.housePositions.length; i++) {
    let h = state.housePositions[i];
    let x = h.x, z = h.z, y = h.baseHeight;

    const houseGroup = new THREE.Group();

    const leftWallF = new THREE.Mesh(sideSegmentGeo, bldgBaseMat);
    leftWallF.position.set(-15, 12, 9);
    const leftWallB = new THREE.Mesh(sideSegmentGeo, bldgBaseMat);
    leftWallB.position.set(-15, 12, -9);
    const leftWallBot = new THREE.Mesh(sideBottomGeo, bldgBaseMat);
    leftWallBot.position.set(-15, 5, 0);
    const leftWallTop = new THREE.Mesh(sideTopGeo, bldgBaseMat);
    leftWallTop.position.set(-15, 19.25, 0);

    const rightWallF = new THREE.Mesh(sideSegmentGeo, bldgBaseMat);
    rightWallF.position.set(15, 12, 9);
    const rightWallB = new THREE.Mesh(sideSegmentGeo, bldgBaseMat);
    rightWallB.position.set(15, 12, -9);
    const rightWallBot = new THREE.Mesh(sideBottomGeo, bldgBaseMat);
    rightWallBot.position.set(15, 5, 0);
    const rightWallTop = new THREE.Mesh(sideTopGeo, bldgBaseMat);
    rightWallTop.position.set(15, 19.25, 0);

    const backWall = new THREE.Mesh(backWallGeo, bldgBaseMat);
    backWall.position.set(0, 12, -15);

    const frontWallL = new THREE.Mesh(frontSegmentGeo, bldgBaseMat);
    frontWallL.position.set(-9.125, 12, 15);
    const frontWallR = new THREE.Mesh(frontSegmentGeo, bldgBaseMat);
    frontWallR.position.set(9.125, 12, 15);

    const frontHeader = new THREE.Mesh(frontHeaderGeo, bldgBaseMat);
    frontHeader.position.set(0, 19, 15);

    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(0, 0.2, 0);

    houseGroup.add(
      leftWallF, leftWallB, leftWallBot, leftWallTop,
      rightWallF, rightWallB, rightWallBot, rightWallTop,
      backWall, frontWallL, frontWallR, frontHeader, floor
    );

    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 31.1;
    roof.rotation.y = Math.PI / 4;
    houseGroup.add(roof);

    const winL = new THREE.Mesh(windowGeo, windowMat);
    winL.position.set(-15, 12.25, 0);
    const winR = new THREE.Mesh(windowGeo, windowMat);
    winR.position.set(15, 12.25, 0);
    houseGroup.add(winL, winR);

    const doorPivot = new THREE.Group();
    doorPivot.position.set(-3.25, 7.0, 15);
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(3.25, 0, 0);
    doorPivot.add(door);
    houseGroup.add(doorPivot);

    houseGroup.position.set(x, y, z);
    state.scene.add(houseGroup);
    registerStaticObject(houseGroup, x, z, 1500);

    const housePos = new THREE.Vector3(x, y, z);
    housePos.baseHeight = y;

    state.doors.push({
      pivot: doorPivot,
      housePos,
      isOpen: false,
      targetAngle: 0,
      currentAngle: 0
    });

    leftWallF.userData = { isBuilding: true, impactMaterial: 'building' };
    leftWallB.userData = { isBuilding: true, impactMaterial: 'building' };
    rightWallF.userData = { isBuilding: true, impactMaterial: 'building' };
    rightWallB.userData = { isBuilding: true, impactMaterial: 'building' };
    backWall.userData = { isBuilding: true, impactMaterial: 'building' };
    frontWallL.userData = { isBuilding: true, impactMaterial: 'building' };
    frontWallR.userData = { isBuilding: true, impactMaterial: 'building' };
    door.userData = { isBuilding: true, impactMaterial: 'wood' };
    roof.userData = { isBuilding: true, impactMaterial: 'metal' };
    floor.userData = { isBuilding: true, impactMaterial: 'wood' };
    state.objects.push(leftWallF, leftWallB, rightWallF, rightWallB, backWall, frontWallL, frontWallR, door, roof, floor);

    spawnLoot(x, y, z);
  }
}
