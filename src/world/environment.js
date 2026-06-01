// Rich environment ecosystem: diverse trees, rivers, lakes, streams, mountains, sun

import * as THREE from 'three';
import { state } from '../state.js';
import { MAP_SIZE } from '../config.js';
import { getBaseTerrainHeight, getTerrainHeight } from './terrain.js';
import { spawnLoot } from './loot.js';

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

// Cherry blossom tree (new)
const trunkMatCherry = new THREE.MeshLambertMaterial({ color: 0x6b4226 });
const leavesMatCherry = new THREE.MeshLambertMaterial({ color: 0xffb7c5 }); // Pink blossoms
const trunkGeoCherry = new THREE.CylinderGeometry(4, 7, 40, 8);

// Willow tree (new)
const trunkMatWillow = new THREE.MeshLambertMaterial({ color: 0x4a3728 });
const leavesMatWillow = new THREE.MeshLambertMaterial({ color: 0x3a7a3a, side: THREE.DoubleSide });
const trunkGeoWillow = new THREE.CylinderGeometry(5, 9, 50, 8);

// Bamboo (new)
const bambooMat = new THREE.MeshLambertMaterial({ color: 0x4a7a2a });
const bambooGeo = new THREE.CylinderGeometry(1.5, 2, 80, 6);
const bambooLeavesMat = new THREE.MeshLambertMaterial({ color: 0x3a6a1a, side: THREE.DoubleSide });

// Rock materials
const rockGeo = new THREE.DodecahedronGeometry(8, 1);
const rockMat = new THREE.MeshLambertMaterial({ color: 0x7f8c8d });
const rockDarkMat = new THREE.MeshLambertMaterial({ color: 0x5a5a5a });
const rockMossyMat = new THREE.MeshLambertMaterial({ color: 0x4a6a3a });

// Water materials
const waterMat = new THREE.MeshLambertMaterial({
  color: 0x1a6b8a,
  transparent: true,
  opacity: 0.7,
  side: THREE.DoubleSide
});
const riverMat = new THREE.MeshLambertMaterial({
  color: 0x2980b9,
  transparent: true,
  opacity: 0.8,
  side: THREE.DoubleSide
});
const lakeMat = new THREE.MeshLambertMaterial({
  color: 0x1565c0,
  transparent: true,
  opacity: 0.75,
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
  // Sun sphere
  const sunGeo = new THREE.SphereGeometry(100, 16, 16);
  const sunMat = new THREE.MeshBasicMaterial({
    color: 0xffff00,
    emissive: 0xffff00,
    emissiveIntensity: 1.0
  });
  const sun = new THREE.Mesh(sunGeo, sunMat);
  sun.position.set(1000, 2000, 500);
  state.scene.add(sun);

  // Sun glow
  const glowGeo = new THREE.SphereGeometry(150, 16, 16);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xffff88,
    transparent: true,
    opacity: 0.3
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.position.copy(sun.position);
  state.scene.add(glow);

  // Sunbeam rays (god rays effect)
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
      let treeType = Math.floor(Math.random() * 7); // 7 tree types
      let trunk;

      if (treeType === 0) {
        // Pine tree
        trunk = new THREE.Mesh(trunkGeoPine, trunkMatPine); trunk.position.y = 30;
        const l1 = new THREE.Mesh(cone1Geo, leavesMatPine); l1.position.y = 65;
        const l2 = new THREE.Mesh(cone2Geo, leavesMatPine); l2.position.y = 95;
        const l3 = new THREE.Mesh(cone3Geo, leavesMatPine); l3.position.y = 120;
        tree.add(trunk, l1, l2, l3);
        state.objects.push(trunk);
      } else if (treeType === 1) {
        // Oak tree
        trunk = new THREE.Mesh(trunkGeoOak, trunkMatOak); trunk.position.y = 22.5;
        const l1 = new THREE.Mesh(sphere1Geo, leavesMatOak); l1.position.y = 48;
        const l2 = new THREE.Mesh(sphere2Geo, leavesMatOak); l2.position.y = 64;
        const l3 = new THREE.Mesh(sphere3Geo, leavesMatOak); l3.position.y = 78;
        tree.add(trunk, l1, l2, l3);
        state.objects.push(trunk);
      } else if (treeType === 2) {
        // Birch tree
        trunk = new THREE.Mesh(trunkGeoBirch, trunkMatBirch); trunk.position.y = 30;
        const l1 = new THREE.Mesh(birch1Geo, leavesMatBirch); l1.position.y = 62;
        const l2 = new THREE.Mesh(birch2Geo, leavesMatBirch); l2.position.y = 84;
        const l3 = new THREE.Mesh(birch3Geo, leavesMatBirch); l3.position.y = 104;
        tree.add(trunk, l1, l2, l3);
        state.objects.push(trunk);
      } else if (treeType === 3) {
        // Cherry blossom
        trunk = new THREE.Mesh(trunkGeoCherry, trunkMatCherry); trunk.position.y = 20;
        const crown1 = new THREE.Mesh(new THREE.SphereGeometry(20, 8, 8), leavesMatCherry); crown1.position.y = 45;
        const crown2 = new THREE.Mesh(new THREE.SphereGeometry(16, 8, 8), leavesMatCherry); crown2.position.set(10, 40, 5);
        const crown3 = new THREE.Mesh(new THREE.SphereGeometry(14, 8, 8), leavesMatCherry); crown3.position.set(-8, 42, -3);
        tree.add(trunk, crown1, crown2, crown3);
        state.objects.push(trunk);
      } else if (treeType === 4) {
        // Willow tree
        trunk = new THREE.Mesh(trunkGeoWillow, trunkMatWillow); trunk.position.y = 25;
        // Drooping branches
        for (let b = 0; b < 12; b++) {
          const branchAngle = (b / 12) * Math.PI * 2;
          const branchGeo = new THREE.CylinderGeometry(0.3, 0.1, 40, 4);
          const branch = new THREE.Mesh(branchGeo, leavesMatWillow);
          branch.position.set(
            Math.cos(branchAngle) * 15,
            50,
            Math.sin(branchAngle) * 15
          );
          branch.rotation.z = Math.cos(branchAngle) * 0.8;
          branch.rotation.x = Math.sin(branchAngle) * 0.8;
          tree.add(branch);
        }
        const crown = new THREE.Mesh(new THREE.SphereGeometry(25, 8, 8), leavesMatWillow); crown.position.y = 55;
        tree.add(trunk, crown);
        state.objects.push(trunk);
      } else if (treeType === 5) {
        // Bamboo cluster
        for (let b = 0; b < 5; b++) {
          const bx = (Math.random() - 0.5) * 10;
          const bz = (Math.random() - 0.5) * 10;
          const bamboo = new THREE.Mesh(bambooGeo, bambooMat);
          bamboo.position.set(bx, 40, bz);
          tree.add(bamboo);

          // Bamboo leaves
          for (let l = 0; l < 3; l++) {
            const leafGeo = new THREE.PlaneGeometry(8, 2);
            const leaf = new THREE.Mesh(leafGeo, bambooLeavesMat);
            leaf.position.set(bx + 4, 30 + l * 15, bz);
            leaf.rotation.z = -0.5;
            tree.add(leaf);
          }
        }
      } else {
        // Mixed forest tree
        trunk = new THREE.Mesh(trunkGeoOak, trunkMatOak); trunk.position.y = 22.5;
        const l1 = new THREE.Mesh(sphere1Geo, leavesMatOak); l1.position.y = 48;
        const l2 = new THREE.Mesh(sphere2Geo, leavesMatOak); l2.position.y = 64;
        tree.add(trunk, l1, l2);
        state.objects.push(trunk);
      }

      tree.position.set(x, y - 6, z);
      state.scene.add(tree);
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

    // Different rock types
    const rockType = Math.floor(Math.random() * 3);
    let mat;
    if (rockType === 0) mat = rockMat;
    else if (rockType === 1) mat = rockDarkMat;
    else mat = rockMossyMat;

    const rock = new THREE.Mesh(rockGeo, mat);
    rock.scale.set(1 + Math.random() * 2, 0.5 + Math.random() * 0.5, 1 + Math.random() * 2);
    rock.position.set(x, y + rock.geometry.parameters.radius * 0.5, z);
    rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    state.scene.add(rock);
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

// ========== RIVERS ==========
function initRivers() {
  // Create 3 rivers flowing through the map
  for (let r = 0; r < 3; r++) {
    const riverPoints = [];
    const startX = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    const startZ = -MAP_SIZE / 2;
    const endX = startX + (Math.random() - 0.5) * 1000;
    const endZ = MAP_SIZE / 2;

    // Generate river path with curves
    const segments = 20;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = THREE.MathUtils.lerp(startX, endX, t) + Math.sin(t * Math.PI * 3) * 200;
      const z = THREE.MathUtils.lerp(startZ, endZ, t);
      const y = getTerrainHeight(x, z);
      riverPoints.push(new THREE.Vector3(x, Math.max(y, 0.5), z));
    }

    // Create river mesh
    const riverCurve = new THREE.CatmullRomCurve3(riverPoints);
    const riverGeo = new THREE.TubeGeometry(riverCurve, 50, 15, 8, false);
    const river = new THREE.Mesh(riverGeo, riverMat);
    state.scene.add(river);

    // River banks
    const bankMat = new THREE.MeshLambertMaterial({ color: 0x8b7355 });
    for (let i = 0; i < segments; i++) {
      const p = riverPoints[i];
      const bankGeo = new THREE.BoxGeometry(35, 3, 20);
      const bankL = new THREE.Mesh(bankGeo, bankMat);
      bankL.position.set(p.x - 20, p.y - 1, p.z);
      bankL.rotation.y = Math.random() * 0.3;
      state.scene.add(bankL);

      const bankR = new THREE.Mesh(bankGeo, bankMat);
      bankR.position.set(p.x + 20, p.y - 1, p.z);
      bankR.rotation.y = Math.random() * 0.3;
      state.scene.add(bankR);
    }

    // Add reeds along river
    const reedMat = new THREE.MeshLambertMaterial({ color: 0x4a7a2a, side: THREE.DoubleSide });
    for (let i = 0; i < 100; i++) {
      const t = Math.random();
      const p = riverCurve.getPointAt(t);
      const side = Math.random() > 0.5 ? 1 : -1;
      const reedGeo = new THREE.CylinderGeometry(0.2, 0.3, 8, 4);
      const reed = new THREE.Mesh(reedGeo, reedMat);
      reed.position.set(p.x + side * (18 + Math.random() * 10), p.y + 4, p.z + (Math.random() - 0.5) * 20);
      reed.rotation.z = (Math.random() - 0.5) * 0.3;
      state.scene.add(reed);
    }
  }
}

// ========== LAKES ==========
function initLakes() {
  // Create 5 lakes at random positions
  for (let l = 0; l < 5; l++) {
    const lx = (Math.random() - 0.5) * MAP_SIZE * 0.6;
    const lz = (Math.random() - 0.5) * MAP_SIZE * 0.6;
    const lRadius = 60 + Math.random() * 80;

    // Lake water surface
    const lakeGeo = new THREE.CircleGeometry(lRadius, 24);
    lakeGeo.rotateX(-Math.PI / 2);
    const lake = new THREE.Mesh(lakeGeo, lakeMat);
    const ly = getTerrainHeight(lx, lz);
    lake.position.set(lx, Math.max(ly, 0.3), lz);
    state.scene.add(lake);

    // Lake shore (sand/gravel)
    const shoreMat = new THREE.MeshLambertMaterial({ color: 0xc2b280 });
    const shoreGeo = new THREE.RingGeometry(lRadius - 5, lRadius + 15, 24);
    shoreGeo.rotateX(-Math.PI / 2);
    const shore = new THREE.Mesh(shoreGeo, shoreMat);
    shore.position.set(lx, Math.max(ly, 0.1), lz);
    state.scene.add(shore);

    // Surrounding vegetation
    const bushMat = new THREE.MeshLambertMaterial({ color: 0x3a6a2a });
    for (let b = 0; b < 15; b++) {
      const angle = (b / 15) * Math.PI * 2;
      const dist = lRadius + 10 + Math.random() * 20;
      const bx = lx + Math.cos(angle) * dist;
      const bz = lz + Math.sin(angle) * dist;
      const by = getTerrainHeight(bx, bz);

      const bushGeo = new THREE.SphereGeometry(5 + Math.random() * 8, 6, 6);
      const bush = new THREE.Mesh(bushGeo, bushMat);
      bush.position.set(bx, by + 3, bz);
      bush.scale.y = 0.6;
      state.scene.add(bush);
    }

    // Lily pads on lake
    const lilyMat = new THREE.MeshLambertMaterial({ color: 0x2d7a2d, side: THREE.DoubleSide });
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * lRadius * 0.7;
      const lilyGeo = new THREE.CircleGeometry(3, 8);
      lilyGeo.rotateX(-Math.PI / 2);
      const lily = new THREE.Mesh(lilyGeo, lilyMat);
      lily.position.set(
        lx + Math.cos(angle) * dist,
        Math.max(ly, 0.3) + 0.1,
        lz + Math.sin(angle) * dist
      );
      state.scene.add(lily);
    }
  }
}

// ========== STREAMS ==========
function initStreams() {
  // Create small streams connecting to lakes/rivers
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
      const y = getTerrainHeight(x, z);
      streamPoints.push(new THREE.Vector3(x, Math.max(y, 0.3), z));
    }

    const streamCurve = new THREE.CatmullRomCurve3(streamPoints);
    const streamGeo = new THREE.TubeGeometry(streamCurve, 15, 4, 6, false);
    const stream = new THREE.Mesh(streamGeo, riverMat);
    state.scene.add(stream);

    // Small stones along stream
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0x8a8a8a });
    for (let i = 0; i < 20; i++) {
      const t = Math.random();
      const p = streamCurve.getPointAt(t);
      const stoneGeo = new THREE.SphereGeometry(1 + Math.random() * 2, 6, 6);
      const stone = new THREE.Mesh(stoneGeo, stoneMat);
      stone.position.set(
        p.x + (Math.random() - 0.5) * 12,
        p.y,
        p.z + (Math.random() - 0.5) * 12
      );
      stone.scale.y = 0.5;
      state.scene.add(stone);
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

    state.doors.push({
      pivot: doorPivot,
      housePos: new THREE.Vector3(x, y, z),
      isOpen: false,
      targetAngle: 0,
      currentAngle: 0
    });

    leftWallF.userData = { isBuilding: true };
    leftWallB.userData = { isBuilding: true };
    rightWallF.userData = { isBuilding: true };
    rightWallB.userData = { isBuilding: true };
    backWall.userData = { isBuilding: true };
    frontWallL.userData = { isBuilding: true };
    frontWallR.userData = { isBuilding: true };
    door.userData = { isBuilding: true };
    roof.userData = { isBuilding: true };
    floor.userData = { isBuilding: true };
    state.objects.push(leftWallF, leftWallB, rightWallF, rightWallB, backWall, frontWallL, frontWallR, door, roof, floor);

    spawnLoot(x, y, z);
  }
}
