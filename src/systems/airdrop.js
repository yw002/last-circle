// Airdrop system: periodic supply drops from aircraft

import * as THREE from 'three';
import { state } from '../state.js';
import { MAP_SIZE, WAVE_CONFIG } from '../config.js';
import { getTerrainHeight } from '../world/terrain.js';
import { spawnAirdropLoot } from '../world/loot.js';
import { playSound } from './audio.js';
import { showNotice } from '../ui/notices.js';

// Shared resources
const planeMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
const crateMat = new THREE.MeshLambertMaterial({ color: 0xDAA520 });
const parachuteMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide });
const smokeMat = new THREE.PointsMaterial({ color: 0xFF2200, size: 5, transparent: true, opacity: 0.6, depthWrite: false });

let airdropTimer = 0;
let engineSoundTimer = 0;

function createPlaneMesh() {
  const group = new THREE.Group();

  // Fuselage
  const fuselageGeo = new THREE.BoxGeometry(4, 3, 15);
  const fuselage = new THREE.Mesh(fuselageGeo, planeMat);
  group.add(fuselage);

  // Wings
  const wingGeo = new THREE.BoxGeometry(20, 0.5, 4);
  const wing = new THREE.Mesh(wingGeo, planeMat);
  wing.position.y = 1;
  group.add(wing);

  // Tail
  const tailGeo = new THREE.BoxGeometry(6, 4, 0.5);
  const tail = new THREE.Mesh(tailGeo, planeMat);
  tail.position.set(0, 2, 7);
  group.add(tail);

  return group;
}

function spawnAirdrop() {
  // Random direction and target point
  const angle = Math.random() * Math.PI * 2;
  const targetX = (Math.random() - 0.5) * MAP_SIZE * 0.5;
  const targetZ = (Math.random() - 0.5) * MAP_SIZE * 0.5;

  // Plane starts from edge
  const startDist = 2500;
  const startX = targetX + Math.cos(angle) * startDist;
  const startZ = targetZ + Math.sin(angle) * startDist;

  const plane = createPlaneMesh();
  plane.position.set(startX, 500, startZ);
  plane.lookAt(targetX, 500, targetZ);
  state.scene.add(plane);

  const direction = new THREE.Vector3(targetX - startX, 0, targetZ - startZ).normalize();
  const speed = 200;

  const airdrop = {
    plane,
    direction,
    speed,
    targetX,
    targetZ,
    phase: 'flying', // flying -> dropping -> landed
    crate: null,
    parachute: null,
    smoke: null,
    dropY: 500,
    distanceTraveled: 0,
    totalDistance: startDist
  };

  state.airdrops.push(airdrop);
}

function createCrate(x, y, z) {
  const crateGeo = new THREE.BoxGeometry(4, 4, 4);
  const crate = new THREE.Mesh(crateGeo, crateMat);
  crate.position.set(x, y, z);
  crate.userData = { isAirdrop: true, impactMaterial: 'wood' };
  state.scene.add(crate);
  state.objects.push(crate);
  return crate;
}

function createParachute(x, y, z) {
  const group = new THREE.Group();

  const canopyGeo = new THREE.SphereGeometry(8, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const canopy = new THREE.Mesh(canopyGeo, parachuteMat);
  canopy.position.y = 8;
  canopy.scale.y = 0.5;
  group.add(canopy);

  // Strings
  const stringMat = new THREE.LineBasicMaterial({ color: 0x888888 });
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const pts = [
      new THREE.Vector3(Math.cos(angle) * 7, 8, Math.sin(angle) * 7),
      new THREE.Vector3(0, 0, 0)
    ];
    const stringGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const stringLine = new THREE.Line(stringGeo, stringMat);
    group.add(stringLine);
  }

  group.position.set(x, y, z);
  state.scene.add(group);
  return group;
}

function createSmokeMarker(x, y, z) {
  const count = 50;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = x + (Math.random() - 0.5) * 2;
    positions[i * 3 + 1] = y + Math.random() * 30;
    positions[i * 3 + 2] = z + (Math.random() - 0.5) * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const smoke = new THREE.Points(geo, smokeMat);
  state.scene.add(smoke);
  return smoke;
}

export function initAirdrop() {
  airdropTimer = WAVE_CONFIG.AIRDROP_INTERVAL * 0.4; // First drop earlier
  engineSoundTimer = 0;
}

export function updateAirdrop(delta) {
  airdropTimer += delta;

  // Spawn on timer only (no alive-count trigger in wave mode)
  if (airdropTimer >= WAVE_CONFIG.AIRDROP_INTERVAL) {
    airdropTimer = 0;
    spawnAirdrop();
  }

  // Engine sound: pulse while at least one plane is in flight.
  let anyPlane = false;
  for (let i = 0; i < state.airdrops.length; i++) {
    if (state.airdrops[i].phase === 'flying' && state.airdrops[i].plane) {
      anyPlane = true;
      break;
    }
  }
  engineSoundTimer -= delta;
  if (anyPlane && engineSoundTimer <= 0) {
    // Use the first airborne plane's position as the sound source.
    for (let i = 0; i < state.airdrops.length; i++) {
      const ad = state.airdrops[i];
      if (ad.phase === 'flying' && ad.plane) {
        playSound('engine', ad.plane.position);
        break;
      }
    }
    engineSoundTimer = 0.6;
  }

  // Update active airdrops
  for (let i = state.airdrops.length - 1; i >= 0; i--) {
    const ad = state.airdrops[i];

    if (ad.phase === 'flying') {
      // Move plane
      ad.plane.position.x += ad.direction.x * ad.speed * delta;
      ad.plane.position.z += ad.direction.z * ad.speed * delta;
      ad.distanceTraveled += ad.speed * delta;

      // Check if over target
      const dx = ad.plane.position.x - ad.targetX;
      const dz = ad.plane.position.z - ad.targetZ;
      if (dx * dx + dz * dz < 100 * 100) {
        ad.phase = 'dropping';
        ad.crate = createCrate(ad.targetX, 490, ad.targetZ);
        ad.parachute = createParachute(ad.targetX, 492, ad.targetZ);
      }

      if (ad.distanceTraveled > ad.totalDistance * 2) {
        state.scene.remove(ad.plane);
        ad.plane = null;
      }

    } else if (ad.phase === 'dropping') {
      const terrainY = getTerrainHeight(ad.crate.position.x, ad.crate.position.z);
      ad.crate.position.y -= 30 * delta;
      ad.parachute.position.y = ad.crate.position.y + 2;

      if (ad.crate.position.y <= terrainY + 2) {
        ad.phase = 'landed';
        ad.crate.position.y = terrainY + 2;
        state.scene.remove(ad.parachute);
        ad.parachute = null;

        ad.smoke = createSmokeMarker(ad.crate.position.x, terrainY + 2, ad.crate.position.z);

        // Spawn rare airdrop-grade loot (special weapon + L3 helmet/armor + ammo).
        spawnAirdropLoot(ad.crate.position.x, terrainY, ad.crate.position.z);

        // Expose drop position so HUD/minimap can highlight it.
        state.nearestAirdropPos = ad.crate.position.clone();

        // Notify player with direction and distance
        const pp = state.controls.getObject().position;
        const ddx = ad.crate.position.x - pp.x;
        const ddz = ad.crate.position.z - pp.z;
        const dist = Math.sqrt(ddx * ddx + ddz * ddz);
        const dir = dist > 0 ? (ddx > 0 ? '东' : '西') + (ddz > 0 ? '南' : '北') : '';
        showNotice(`📦 空投落地！方向: ${dir} | 距离: ${Math.round(dist)}m`, '#DAA520');
      }

    } else if (ad.phase === 'landed') {
      if (ad.smoke) {
        const positions = ad.smoke.geometry.attributes.position.array;
        for (let j = 0; j < positions.length; j += 3) {
          positions[j + 1] += delta * 8;
          if (positions[j + 1] > ad.crate.position.y + 40) {
            positions[j + 1] = ad.crate.position.y;
          }
        }
        ad.smoke.geometry.attributes.position.needsUpdate = true;
      }
    }
  }
}
