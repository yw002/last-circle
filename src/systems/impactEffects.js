// Material-specific bullet impact particles.

import * as THREE from 'three';
import { state } from '../state.js';

const dustGeo = new THREE.BoxGeometry(0.45, 0.45, 0.45);
const sparkGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
const splashGeo = new THREE.SphereGeometry(0.25, 6, 6);

const impactMaterials = {
  dirt: new THREE.MeshBasicMaterial({ color: 0x8a7358 }),
  stone: new THREE.MeshBasicMaterial({ color: 0x9a9a9a }),
  wood: new THREE.MeshBasicMaterial({ color: 0x8b5a2b }),
  building: new THREE.MeshBasicMaterial({ color: 0xc8b79a }),
  metal: new THREE.MeshBasicMaterial({ color: 0xffcc66 }),
  water: new THREE.MeshBasicMaterial({ color: 0x8fd3ff, transparent: true, opacity: 0.8 })
};

function getImpactProfile(material) {
  if (material === 'metal') return { count: 5, speed: 18, up: 8, geo: sparkGeo, mat: impactMaterials.metal };
  if (material === 'water') return { count: 8, speed: 10, up: 18, geo: splashGeo, mat: impactMaterials.water };
  if (material === 'wood') return { count: 5, speed: 12, up: 10, geo: dustGeo, mat: impactMaterials.wood };
  if (material === 'stone') return { count: 4, speed: 10, up: 7, geo: dustGeo, mat: impactMaterials.stone };
  if (material === 'building') return { count: 4, speed: 11, up: 7, geo: dustGeo, mat: impactMaterials.building };
  return { count: 4, speed: 9, up: 6, geo: dustGeo, mat: impactMaterials.dirt };
}

export function inferImpactMaterial(hit) {
  const ud = hit && hit.object ? hit.object.userData || {} : {};
  if (ud.impactMaterial) return ud.impactMaterial;
  if (ud.isBuilding) return 'building';
  return 'dirt';
}

export function spawnImpactEffect(hitPoint, normal, material = 'dirt') {
  const profile = getImpactProfile(material);

  // Impact particles reuse the existing short-lived particle updater.
  for (let i = 0; i < profile.count; i++) {
    const p = new THREE.Mesh(profile.geo, profile.mat);
    p.position.copy(hitPoint);
    state.scene.add(p);
    state.bloodParticles.push({
      mesh: p,
      vx: normal.x * profile.speed + (Math.random() - 0.5) * profile.speed,
      vy: normal.y * profile.up + Math.random() * profile.up,
      vz: normal.z * profile.speed + (Math.random() - 0.5) * profile.speed,
      age: 0
    });
  }
}
