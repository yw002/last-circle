// New building types: military bases, ruins, lighthouses, bridges, mines, farms

import * as THREE from 'three';
import { state } from '../state.js';
import { MAP_SIZE } from '../config.js';
import { getTerrainHeight } from './terrain.js';
import { getBiomeAt, BIOME } from './biomes.js';
import { registerStaticObject } from '../systems/staticVisibility.js';
import { spawnLoot } from './loot.js';

// Shared materials
const metalMat = new THREE.MeshLambertMaterial({ color: 0x4A5A2A });
const containerMat = new THREE.MeshLambertMaterial({ color: 0x3A4A2A });
const fenceMat = new THREE.MeshLambertMaterial({ color: 0x888888, wireframe: true });
const stoneMat = new THREE.MeshLambertMaterial({ color: 0x808080 });
const stoneBrokenMat = new THREE.MeshLambertMaterial({ color: 0x6A6A6A });
const goldMat = new THREE.MeshLambertMaterial({ color: 0xDAA520 });
const lighthouseWhite = new THREE.MeshLambertMaterial({ color: 0xF5F5F5 });
const lighthouseRed = new THREE.MeshLambertMaterial({ color: 0xCC3333 });
const glassMat = new THREE.MeshLambertMaterial({ color: 0x88CCFF, transparent: true, opacity: 0.3 });
const woodMat = new THREE.MeshLambertMaterial({ color: 0x6B4226 });
const woodDarkMat = new THREE.MeshLambertMaterial({ color: 0x4A2F1D });
const barnRedMat = new THREE.MeshLambertMaterial({ color: 0x8B0000 });
const hayMat = new THREE.MeshLambertMaterial({ color: 0xDAA520 });
const ironMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
const lanternMat = new THREE.MeshBasicMaterial({ color: 0xFFD700 });
const blackMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
const weaponBoxMat = new THREE.MeshLambertMaterial({ color: 0x2F4F2F });

// Building placement tracking
const buildingPositions = [];

// Animated buildings (windmills + lighthouses) so updateBuildings can drive them.
const animatedWindmills = []; // [{ bladeHub: Group, speed: number }]
const animatedLighthouses = []; // [{ spotlight, target, group }]

function tooCloseToBuildings(x, z, minDist) {
  for (let i = 0; i < buildingPositions.length; i++) {
    const b = buildingPositions[i];
    const dx = x - b.x, dz = z - b.z;
    if (dx * dx + dz * dz < minDist * minDist) return true;
  }
  return false;
}

function addBuildingCollider(group, x, y, z, w, h, d) {
  const box = new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(x, y + h / 2, z),
    new THREE.Vector3(w, h, d)
  );
  box.userData = { kind: 'building', standable: false };
  state.colliders.push(box);
}

function addStandableSurface(x, y, z, w, d) {
  const box = new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(x, y, z),
    new THREE.Vector3(w, 1, d)
  );
  box.userData = { kind: 'bridge', standable: true };
  state.colliders.push(box);
}

// ========== MILITARY BASE ==========
function createMilitaryBase(x, y, z) {
  const group = new THREE.Group();

  // 3-5 containers
  const containerGeo = new THREE.BoxGeometry(10, 8, 20);
  const containerCount = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < containerCount; i++) {
    const container = new THREE.Mesh(containerGeo, containerMat);
    container.position.set((i - 1) * 14, 4, (Math.random() - 0.5) * 10);
    container.rotation.y = Math.random() * 0.3;
    container.userData = { isBuilding: true, impactMaterial: 'metal' };
    group.add(container);
  }

  // Fence perimeter (4 sides)
  const fenceGeo = new THREE.BoxGeometry(50, 6, 0.3);
  const fencePositions = [
    { x: 0, z: 30 }, { x: 0, z: -30 },
    { x: 30, z: 0, ry: Math.PI / 2 }, { x: -30, z: 0, ry: Math.PI / 2 }
  ];
  for (const fp of fencePositions) {
    const fence = new THREE.Mesh(fenceGeo, fenceMat);
    fence.position.set(fp.x, 3, fp.z);
    if (fp.ry) fence.rotation.y = fp.ry;
    group.add(fence);
  }

  // Radar tower
  const poleGeo = new THREE.CylinderGeometry(1, 1.5, 40, 6);
  const pole = new THREE.Mesh(poleGeo, metalMat);
  pole.position.set(20, 20, -20);
  pole.userData = { isBuilding: true, impactMaterial: 'metal' };
  group.add(pole);

  const dishGeo = new THREE.SphereGeometry(5, 8, 6, 0, Math.PI);
  const dish = new THREE.Mesh(dishGeo, metalMat);
  dish.position.set(20, 42, -20);
  dish.rotation.x = -Math.PI / 4;
  group.add(dish);

  // Weapon crate (visible loot box) — a chunky military-green chest with iron bands.
  const weaponBoxBody = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 4), weaponBoxMat);
  weaponBoxBody.position.set(-15, 1.5, 10);
  weaponBoxBody.userData = { isBuilding: true, impactMaterial: 'metal', isWeaponBox: true };
  group.add(weaponBoxBody);
  const bandGeo = new THREE.BoxGeometry(6.2, 0.4, 0.4);
  for (const offsetZ of [-1.6, 1.6]) {
    const band = new THREE.Mesh(bandGeo, ironMat);
    band.position.set(-15, 1.5, 10 + offsetZ);
    group.add(band);
  }

  group.position.set(x, y, z);
  state.scene.add(group);
  registerStaticObject(group, x, z, 1800);

  for (let i = 0; i < containerCount; i++) {
    addBuildingCollider(group, x + (i - 1) * 14, y, z, 10, 8, 20);
  }
  // Radar pole
  addBuildingCollider(group, x + 20, y, z - 20, 3, 40, 3);
  // Weapon box
  addBuildingCollider(group, x - 15, y, z + 10, 6, 3, 4);

  buildingPositions.push({ x, z });
  spawnLoot(x - 15, y, z + 10);
  spawnLoot(x + 10, y, z + 5);
  spawnLoot(x - 10, y, z - 5);

  // Mark this base as a fence cluster anchor so destructibles can group fences here.
  state.fenceClusterAnchors.push({ x, z, kind: 'military' });
  state.buildingMarkers.push({ x, z, kind: 'military' });
}

// ========== ANCIENT RUINS ==========
function createAncientRuins(x, y, z) {
  const group = new THREE.Group();

  const pillarGeo = new THREE.CylinderGeometry(3, 4, 30, 8);
  const pillarCount = 4 + Math.floor(Math.random() * 5);
  const pillarLocations = [];
  for (let i = 0; i < pillarCount; i++) {
    const pillar = new THREE.Mesh(pillarGeo, stoneMat);
    const angle = (i / pillarCount) * Math.PI * 2;
    const radius = 15 + Math.random() * 10;
    const lx = Math.cos(angle) * radius;
    const lz = Math.sin(angle) * radius;
    pillar.position.set(lx, 15, lz);
    pillar.rotation.z = (Math.random() - 0.5) * 0.3;
    pillar.rotation.x = (Math.random() - 0.5) * 0.2;
    pillar.userData = { isBuilding: true, impactMaterial: 'stone' };
    group.add(pillar);
    pillarLocations.push({ lx, lz });
  }

  const archGeo = new THREE.TorusGeometry(8, 2, 6, 8, Math.PI);
  const arch = new THREE.Mesh(archGeo, stoneBrokenMat);
  arch.position.set(0, 20, 0);
  arch.rotation.x = Math.PI / 2;
  group.add(arch);

  const statueBase = new THREE.Mesh(new THREE.BoxGeometry(5, 2, 5), stoneMat);
  statueBase.position.set(-15, 1, 10);
  group.add(statueBase);
  const statueBody = new THREE.Mesh(new THREE.CylinderGeometry(2, 3, 12, 6), stoneMat);
  statueBody.position.set(-15, 8, 10);
  group.add(statueBody);
  const statueHead = new THREE.Mesh(new THREE.SphereGeometry(2.5, 6, 6), stoneMat);
  statueHead.position.set(-15, 16, 10);
  group.add(statueHead);

  const chestGeo = new THREE.BoxGeometry(3, 2, 2);
  const chest = new THREE.Mesh(chestGeo, goldMat);
  chest.position.set(5, 1, -5);
  group.add(chest);

  group.position.set(x, y, z);
  state.scene.add(group);
  registerStaticObject(group, x, z, 1500);

  // Box3 colliders for each pillar so players can take cover behind them.
  for (const loc of pillarLocations) {
    addBuildingCollider(group, x + loc.lx, y, z + loc.lz, 8, 30, 8);
  }
  addBuildingCollider(group, x - 15, y, z + 10, 6, 18, 6); // statue body

  buildingPositions.push({ x, z });
  spawnLoot(x + 5, y, z - 5);
  spawnLoot(x - 5, y, z + 5);
  state.buildingMarkers.push({ x, z, kind: 'ruin' });
}

// ========== LIGHTHOUSE ==========
function createLighthouse(x, y, z) {
  const group = new THREE.Group();

  const towerGeo = new THREE.CylinderGeometry(5, 8, 60, 12);
  const tower = new THREE.Mesh(towerGeo, lighthouseWhite);
  tower.position.y = 30;
  tower.userData = { isBuilding: true, impactMaterial: 'building' };
  group.add(tower);

  const stripeGeo = new THREE.CylinderGeometry(6, 7, 4, 12);
  for (let i = 0; i < 3; i++) {
    const stripe = new THREE.Mesh(stripeGeo, lighthouseRed);
    stripe.position.y = 15 + i * 18;
    group.add(stripe);
  }

  const lampRoomGeo = new THREE.CylinderGeometry(6, 6, 8, 12);
  const lampRoom = new THREE.Mesh(lampRoomGeo, glassMat);
  lampRoom.position.y = 64;
  group.add(lampRoom);

  const capGeo = new THREE.ConeGeometry(7, 5, 12);
  const cap = new THREE.Mesh(capGeo, lighthouseRed);
  cap.position.y = 71;
  group.add(cap);

  // Rotating SpotLight — needs a target object to point at; we'll move the target each frame.
  const spotlight = new THREE.SpotLight(0xFFFF88, 0, 500, 0.3, 0.5);
  spotlight.position.set(0, 64, 0);
  group.add(spotlight);
  const target = new THREE.Object3D();
  target.position.set(50, 64, 0);
  group.add(target);
  spotlight.target = target;

  group.position.set(x, y, z);
  state.scene.add(group);
  registerStaticObject(group, x, z, 2000);

  addBuildingCollider(group, x, y, z, 16, 60, 16);
  buildingPositions.push({ x, z });

  spawnLoot(x + 5, y, z + 5);

  animatedLighthouses.push({ spotlight, target, group });
  state.buildingMarkers.push({ x, z, kind: 'lighthouse' });
}

// ========== BRIDGES ==========
// Bridges accept an explicit yaw so we can orient them perpendicular to the river flow.
function createBridge(x, y, z, yaw = 0) {
  const group = new THREE.Group();
  const length = 40;
  const width = 8;

  const deckGeo = new THREE.BoxGeometry(width, 1, length);
  const deck = new THREE.Mesh(deckGeo, woodMat);
  deck.position.y = 2;
  deck.userData = { isBuilding: true, impactMaterial: 'wood' };
  group.add(deck);

  const postGeo = new THREE.CylinderGeometry(0.5, 0.5, 6, 5);
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 5; i++) {
      const post = new THREE.Mesh(postGeo, woodDarkMat);
      post.position.set(side * (width / 2 - 0.5), 5, -length / 2 + i * (length / 4));
      group.add(post);
    }
    const railGeo = new THREE.BoxGeometry(0.3, 0.3, length);
    const rail = new THREE.Mesh(railGeo, woodDarkMat);
    rail.position.set(side * (width / 2 - 0.5), 7.5, 0);
    group.add(rail);
  }

  const pillarGeo = new THREE.CylinderGeometry(1.5, 2, 10, 6);
  for (let i = 0; i < 3; i++) {
    const pillar = new THREE.Mesh(pillarGeo, stoneMat);
    pillar.position.set(0, -4, -length / 2 + 5 + i * (length / 2 - 5));
    pillar.userData = { isBuilding: true, impactMaterial: 'stone' };
    group.add(pillar);
  }

  group.position.set(x, y + 1, z);
  group.rotation.y = yaw;
  state.scene.add(group);
  registerStaticObject(group, x, z, 1200);

  // Standable surface — Box3 must be axis-aligned, so use the rotated bbox in world space.
  const cosA = Math.abs(Math.cos(yaw));
  const sinA = Math.abs(Math.sin(yaw));
  const aabbX = width * cosA + length * sinA;
  const aabbZ = width * sinA + length * cosA;
  addStandableSurface(x, y + 2.5, z, aabbX, aabbZ);
  buildingPositions.push({ x, z });

  // Loot at the bridge end facing the road.
  spawnLoot(x + Math.sin(yaw) * (length * 0.3), y, z + Math.cos(yaw) * (length * 0.3));
  state.buildingMarkers.push({ x, z, kind: 'bridge' });
}

// ========== MINE ENTRANCE ==========
function createMineEntrance(x, y, z) {
  const group = new THREE.Group();

  const frameVertGeo = new THREE.BoxGeometry(2, 12, 2);
  const frameL = new THREE.Mesh(frameVertGeo, woodDarkMat);
  frameL.position.set(-5, 6, 0);
  group.add(frameL);
  const frameR = new THREE.Mesh(frameVertGeo, woodDarkMat);
  frameR.position.set(5, 6, 0);
  group.add(frameR);
  const frameTopGeo = new THREE.BoxGeometry(12, 2, 2);
  const frameTop = new THREE.Mesh(frameTopGeo, woodDarkMat);
  frameTop.position.set(0, 12, 0);
  group.add(frameTop);

  const caveGeo = new THREE.PlaneGeometry(8, 10);
  const cave = new THREE.Mesh(caveGeo, blackMat);
  cave.position.set(0, 5, -1);
  group.add(cave);

  const railGeo = new THREE.BoxGeometry(0.3, 0.2, 30);
  const railL = new THREE.Mesh(railGeo, ironMat);
  railL.position.set(-2, 0.1, 15);
  group.add(railL);
  const railR = new THREE.Mesh(railGeo, ironMat);
  railR.position.set(2, 0.1, 15);
  group.add(railR);

  const tieGeo = new THREE.BoxGeometry(6, 0.2, 0.8);
  for (let i = 0; i < 8; i++) {
    const tie = new THREE.Mesh(tieGeo, woodDarkMat);
    tie.position.set(0, 0.05, 3 + i * 3.5);
    group.add(tie);
  }

  const cartGeo = new THREE.BoxGeometry(4, 3, 5);
  const cart = new THREE.Mesh(cartGeo, ironMat);
  cart.position.set(0, 1.5, 18);
  cart.userData = { isBuilding: true, impactMaterial: 'metal' };
  group.add(cart);

  const lanternGeo = new THREE.SphereGeometry(0.8, 6, 6);
  const lantern1 = new THREE.Mesh(lanternGeo, lanternMat);
  lantern1.position.set(-6, 10, 0);
  group.add(lantern1);
  const light1 = new THREE.PointLight(0xFFD700, 1.5, 30);
  light1.position.copy(lantern1.position);
  group.add(light1);

  const lantern2 = new THREE.Mesh(lanternGeo, lanternMat);
  lantern2.position.set(6, 10, 0);
  group.add(lantern2);
  const light2 = new THREE.PointLight(0xFFD700, 1.5, 30);
  light2.position.copy(lantern2.position);
  group.add(light2);

  group.position.set(x, y, z);
  state.scene.add(group);
  registerStaticObject(group, x, z, 1500);

  // Box3 colliders for the wooden frame posts and cart
  addBuildingCollider(group, x - 5, y, z, 2, 12, 2);
  addBuildingCollider(group, x + 5, y, z, 2, 12, 2);
  addBuildingCollider(group, x, y, z + 18, 4, 3, 5);

  buildingPositions.push({ x, z });
  spawnLoot(x, y, z + 5);
  spawnLoot(x, y, z + 12);
  state.buildingMarkers.push({ x, z, kind: 'mine' });
}

// ========== FARM ==========
function createFarm(x, y, z) {
  const group = new THREE.Group();

  const barnGeo = new THREE.BoxGeometry(20, 15, 30);
  const barn = new THREE.Mesh(barnGeo, barnRedMat);
  barn.position.set(0, 7.5, 0);
  barn.userData = { isBuilding: true, impactMaterial: 'wood' };
  group.add(barn);

  const roofGeo = new THREE.BoxGeometry(22, 2, 32);
  const roof = new THREE.Mesh(roofGeo, woodDarkMat);
  roof.position.set(0, 16, 0);
  group.add(roof);
  const roofPeak = new THREE.Mesh(new THREE.BoxGeometry(4, 8, 32), woodDarkMat);
  roofPeak.position.set(0, 20, 0);
  group.add(roofPeak);

  const windmillGeo = new THREE.CylinderGeometry(3, 5, 30, 8);
  const windmill = new THREE.Mesh(windmillGeo, lighthouseWhite);
  windmill.position.set(25, 15, -15);
  windmill.userData = { isBuilding: true, impactMaterial: 'building' };
  group.add(windmill);

  // Windmill blades parented to a rotating hub so we can spin them in updateBuildings.
  const bladeHub = new THREE.Group();
  bladeHub.position.set(25, 30, -15);
  const bladeGeo = new THREE.BoxGeometry(1, 15, 0.5);
  const bladeMat = woodMat;
  for (let i = 0; i < 4; i++) {
    const bladeWrap = new THREE.Group();
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.y = 7.5; // half blade length
    bladeWrap.add(blade);
    bladeWrap.rotation.z = (i / 4) * Math.PI * 2;
    bladeHub.add(bladeWrap);
  }
  // Tilt the hub so blades face outward (along +X) instead of lying flat.
  bladeHub.rotation.x = Math.PI / 2;
  group.add(bladeHub);

  const fencePostGeo = new THREE.BoxGeometry(0.5, 4, 0.5);
  const fenceRailGeo = new THREE.BoxGeometry(0.3, 0.3, 5);
  for (let i = 0; i < 8; i++) {
    const post = new THREE.Mesh(fencePostGeo, woodDarkMat);
    post.position.set(-20 + i * 6, 2, 25);
    group.add(post);
    if (i < 7) {
      const rail = new THREE.Mesh(fenceRailGeo, woodDarkMat);
      rail.position.set(-17 + i * 6, 3, 25);
      group.add(rail);
    }
  }

  const hayGeo = new THREE.CylinderGeometry(4, 4, 5, 8);
  for (let i = 0; i < 3; i++) {
    const hay = new THREE.Mesh(hayGeo, hayMat);
    hay.position.set(-15 + i * 8, 2.5, -20);
    hay.userData = { isBuilding: true, impactMaterial: 'wood' };
    group.add(hay);
  }

  group.position.set(x, y, z);
  state.scene.add(group);
  registerStaticObject(group, x, z, 1800);

  addBuildingCollider(group, x, y, z, 20, 15, 30);
  for (let i = 0; i < 3; i++) {
    addBuildingCollider(group, x - 15 + i * 8, y, z - 20, 8, 5, 8);
  }
  addBuildingCollider(group, x + 25, y, z - 15, 8, 30, 8);

  buildingPositions.push({ x, z });
  spawnLoot(x, y, z);

  animatedWindmills.push({ bladeHub, speed: 0.6 + Math.random() * 0.4 });

  // Farms also act as fence cluster anchors.
  state.fenceClusterAnchors.push({ x, z, kind: 'farm' });
  state.buildingMarkers.push({ x, z, kind: 'farm' });
}

// ========== INIT ALL BUILDINGS ==========
export function initBuildings() {
  // Military bases (3) - prefer flat areas
  let placed = 0;
  for (let i = 0; i < 200 && placed < 3; i++) {
    const x = (Math.random() - 0.5) * MAP_SIZE * 0.7;
    const z = (Math.random() - 0.5) * MAP_SIZE * 0.7;
    const y = getTerrainHeight(x, z);
    if (y < 5 || y > 30) continue;
    if (tooCloseToBuildings(x, z, 300)) continue;
    createMilitaryBase(x, y, z);
    placed++;
  }

  // Ancient ruins (5)
  placed = 0;
  for (let i = 0; i < 200 && placed < 5; i++) {
    const x = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    const z = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    const y = getTerrainHeight(x, z);
    if (y < 3) continue;
    if (tooCloseToBuildings(x, z, 250)) continue;
    createAncientRuins(x, y, z);
    placed++;
  }

  // Lighthouses (2) - near water (low terrain)
  placed = 0;
  for (let i = 0; i < 200 && placed < 2; i++) {
    const x = (Math.random() - 0.5) * MAP_SIZE * 0.7;
    const z = (Math.random() - 0.5) * MAP_SIZE * 0.7;
    const y = getTerrainHeight(x, z);
    if (y < 2 || y > 10) continue;
    if (tooCloseToBuildings(x, z, 400)) continue;
    createLighthouse(x, y, z);
    placed++;
  }

  // Bridges (8) - actually span the rivers when possible.
  placed = placeBridgesAcrossRivers(8);
  // Fall back to random low-terrain placement if we didn't get 8 from rivers alone.
  for (let i = 0; i < 200 && placed < 8; i++) {
    const x = (Math.random() - 0.5) * MAP_SIZE * 0.7;
    const z = (Math.random() - 0.5) * MAP_SIZE * 0.7;
    const y = getTerrainHeight(x, z);
    if (y < 1 || y > 8) continue;
    if (tooCloseToBuildings(x, z, 200)) continue;
    createBridge(x, y, z, Math.random() * Math.PI);
    placed++;
  }

  // Mine entrances (3) - prefer hilly/mountainous terrain
  placed = 0;
  for (let i = 0; i < 200 && placed < 3; i++) {
    const x = (Math.random() - 0.5) * MAP_SIZE * 0.7;
    const z = (Math.random() - 0.5) * MAP_SIZE * 0.7;
    const y = getTerrainHeight(x, z);
    if (y < 20 || y > 60) continue;
    if (tooCloseToBuildings(x, z, 300)) continue;
    createMineEntrance(x, y, z);
    placed++;
  }

  // Farms (5) - prefer flat, non-lava non-desert non-snow terrain
  placed = 0;
  for (let i = 0; i < 200 && placed < 5; i++) {
    const x = (Math.random() - 0.5) * MAP_SIZE * 0.7;
    const z = (Math.random() - 0.5) * MAP_SIZE * 0.7;
    const y = getTerrainHeight(x, z);
    if (y < 5 || y > 25) continue;
    const biome = getBiomeAt(x, z);
    if (biome === BIOME.DESERT || biome === BIOME.LAVA || biome === BIOME.SNOW) continue;
    if (tooCloseToBuildings(x, z, 250)) continue;
    createFarm(x, y, z);
    placed++;
  }
}

// Distribute bridges along the rivers exposed in state.rivers.
function placeBridgesAcrossRivers(maxBridges) {
  const rivers = state.rivers || [];
  if (rivers.length === 0) return 0;

  const candidates = [];
  for (const river of rivers) {
    const pts = river.points;
    if (!pts || pts.length < 4) continue;
    const samples = Math.min(4, Math.floor(pts.length / 6));
    for (let s = 1; s <= samples; s++) {
      const idx = Math.floor((pts.length - 1) * (s / (samples + 1)));
      const p = pts[idx];
      const next = pts[Math.min(idx + 1, pts.length - 1)];
      const dirX = next.x - p.x;
      const dirZ = next.z - p.z;
      // Bridge spans across the river: orient bridge length perpendicular to flow.
      // BoxGeometry length axis is local Z; rotation.y so local +Z aligns with flow direction.
      const yaw = Math.atan2(dirX, dirZ);
      candidates.push({ x: p.x, z: p.z, yaw });
    }
  }

  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  let placed = 0;
  for (const c of candidates) {
    if (placed >= maxBridges) break;
    if (tooCloseToBuildings(c.x, c.z, 120)) continue;
    const y = getTerrainHeight(c.x, c.z);
    createBridge(c.x, y, c.z, c.yaw);
    placed++;
  }
  return placed;
}

// ========== UPDATE (called once per frame) ==========
const _lighthouseTargetVec = new THREE.Vector3();
let _lighthouseAngle = 0;

export function updateBuildings(delta) {
  // Windmill blades rotate continuously.
  for (const w of animatedWindmills) {
    w.bladeHub.rotation.y += w.speed * delta;
  }

  // Lighthouse spotlight rotates slowly; only emits at night.
  _lighthouseAngle += delta * 0.7;
  // Day/night factor: dayNight.js stores cycle 0..600s. nightStrength: 0 day, 1 deep night.
  const cycleT = (state.dayNightTime || 0) / 600;
  const nightStrength = Math.max(0, -Math.sin(cycleT * Math.PI * 2));

  for (const lh of animatedLighthouses) {
    const r = 50;
    _lighthouseTargetVec.set(Math.cos(_lighthouseAngle) * r, 0, Math.sin(_lighthouseAngle) * r);
    lh.target.position.copy(_lighthouseTargetVec);
    lh.spotlight.intensity = 3 * nightStrength;
  }
}
