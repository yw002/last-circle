// Environment generation: houses, trees, rocks, grass

import * as THREE from 'three';
import { state } from '../state.js';
import { MAP_SIZE } from '../config.js';
import { getBaseTerrainHeight, getTerrainHeight } from './terrain.js';
import { spawnLoot } from './loot.js';

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
  initTrees();
  initRocks();
  initHouses();
  initGrass();
}

function initTrees() {
  const trunkMatPine = new THREE.MeshLambertMaterial({ color: 0x5c4033 });
  const leavesMatPine = new THREE.MeshLambertMaterial({ color: 0x274e13 });
  const trunkGeoPine = new THREE.CylinderGeometry(5, 8, 60, 8);
  const cone1Geo = new THREE.ConeGeometry(35, 70, 8);
  const cone2Geo = new THREE.ConeGeometry(28, 60, 8);
  const cone3Geo = new THREE.ConeGeometry(20, 50, 8);

  const trunkMatOak = new THREE.MeshLambertMaterial({ color: 0x4d2f1d });
  const leavesMatOak = new THREE.MeshLambertMaterial({ color: 0x194d19 });
  const trunkGeoOak = new THREE.CylinderGeometry(6, 10, 45, 8);
  const sphere1Geo = new THREE.SphereGeometry(22, 8, 8);
  const sphere2Geo = new THREE.SphereGeometry(18, 8, 8);
  const sphere3Geo = new THREE.SphereGeometry(14, 8, 8);

  const trunkMatBirch = new THREE.MeshLambertMaterial({ color: 0xdddddd });
  const leavesMatBirch = new THREE.MeshLambertMaterial({ color: 0xd4ac0d });
  const trunkGeoBirch = new THREE.CylinderGeometry(3.5, 5.5, 60, 8);
  const birch1Geo = new THREE.ConeGeometry(28, 54, 8);
  const birch2Geo = new THREE.ConeGeometry(22, 46, 8);
  const birch3Geo = new THREE.ConeGeometry(16, 38, 8);

  const cells = 45;
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
      let treeType = Math.floor(Math.random() * 3);
      let trunk;

      if (treeType === 0) {
        trunk = new THREE.Mesh(trunkGeoPine, trunkMatPine); trunk.position.y = 30;
        const l1 = new THREE.Mesh(cone1Geo, leavesMatPine); l1.position.y = 65;
        const l2 = new THREE.Mesh(cone2Geo, leavesMatPine); l2.position.y = 95;
        const l3 = new THREE.Mesh(cone3Geo, leavesMatPine); l3.position.y = 120;
        tree.add(trunk, l1, l2, l3);
        state.objects.push(trunk, l1, l2, l3);
      } else if (treeType === 1) {
        trunk = new THREE.Mesh(trunkGeoOak, trunkMatOak); trunk.position.y = 22.5;
        const l1 = new THREE.Mesh(sphere1Geo, leavesMatOak); l1.position.y = 48;
        const l2 = new THREE.Mesh(sphere2Geo, leavesMatOak); l2.position.y = 64;
        const l3 = new THREE.Mesh(sphere3Geo, leavesMatOak); l3.position.y = 78;
        tree.add(trunk, l1, l2, l3);
        state.objects.push(trunk, l1, l2, l3);
      } else {
        trunk = new THREE.Mesh(trunkGeoBirch, trunkMatBirch); trunk.position.y = 30;
        const l1 = new THREE.Mesh(birch1Geo, leavesMatBirch); l1.position.y = 62;
        const l2 = new THREE.Mesh(birch2Geo, leavesMatBirch); l2.position.y = 84;
        const l3 = new THREE.Mesh(birch3Geo, leavesMatBirch); l3.position.y = 104;
        tree.add(trunk, l1, l2, l3);
        state.objects.push(trunk, l1, l2, l3);
      }

      tree.position.set(x, y - 6, z);
      state.scene.add(tree);
      tree.updateMatrixWorld(true);

      const colliderBox = new THREE.Box3().setFromObject(trunk);
      state.colliders.push(colliderBox);
    }
  }
}

function initRocks() {
  const rockGeo = new THREE.DodecahedronGeometry(8, 1);
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x7f8c8d });
  state.rockPositions = [];

  for (let i = 0; i < 600; i++) {
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

    const rock = new THREE.Mesh(rockGeo, rockMat);
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

function initHouses() {
  const bldgBaseMat = new THREE.MeshLambertMaterial({ color: 0xf5f5dc, side: THREE.DoubleSide });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0xc0392b, side: THREE.DoubleSide });
  const roofGeo = new THREE.ConeGeometry(22, 14, 4, 1, true);
  const windowMat = new THREE.MeshLambertMaterial({
    color: 0x5dade2,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.35,
    depthWrite: false
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
    let x = h.x;
    let z = h.z;
    let y = h.baseHeight;

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

function initGrass() {
  const grassCount = 80000;
  const grassGeo = new THREE.CylinderGeometry(0.8, 2.5, 3.5, 4);
  grassGeo.translate(0, 1.75, 0);
  // Deep forest green - not eye-searing
  const grassMat = new THREE.MeshLambertMaterial({ color: 0x1B5E20 });
  const grassInstanced = new THREE.InstancedMesh(grassGeo, grassMat, grassCount);

  const dummy = new THREE.Object3D();
  let gIdx = 0;
  for (let i = 0; i < grassCount; i++) {
    let x = (Math.random() - 0.5) * MAP_SIZE;
    let z = (Math.random() - 0.5) * MAP_SIZE;
    let y = getTerrainHeight(x, z);

    if (y > 2 && y < 35) {
      let roadFactor = 0;
      for (let rx = -MAP_SIZE / 2; rx < MAP_SIZE / 2; rx += 500) {
        if (Math.abs(x - rx) < 25) roadFactor = 1;
      }
      for (let rz = -MAP_SIZE / 2; rz < MAP_SIZE / 2; rz += 500) {
        if (Math.abs(z - rz) < 25) roadFactor = 1;
      }
      if (roadFactor === 0) {
        let tooCloseToHouse = false;
        for (let h of state.housePositions) {
          let dx = x - h.x;
          let dz = z - h.z;
          if (dx * dx + dz * dz < 20 * 20) {
            tooCloseToHouse = true;
            break;
          }
        }
        if (!tooCloseToHouse) {
          dummy.position.set(x, y, z);
          dummy.rotation.y = Math.random() * Math.PI;
          dummy.scale.set(1.0 + Math.random() * 0.5, 0.7 + Math.random() * 0.6, 1.0 + Math.random() * 0.5);
          dummy.updateMatrix();
          grassInstanced.setMatrixAt(gIdx, dummy.matrix);

          // Deep forest green grass - not eye-searing
          let c = new THREE.Color();
          if (y < 10) c.setHex(0x0D3B0D);
          else c.setHex(0x1B5E20);
          grassInstanced.setColorAt(gIdx, c);

          gIdx++;
        }
      }
    }
  }
  grassInstanced.count = gIdx;
  state.scene.add(grassInstanced);
}
