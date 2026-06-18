// Loot system: Optimized with shared resources

import * as THREE from 'three';
import { state } from '../state.js';
import { weapons, equipments, scopes } from '../config.js';
import { getTerrainHeight } from './terrain.js';

// ========== SHARED RESOURCES ==========
const sharedMats = {
  dark: new THREE.MeshLambertMaterial({ color: 0x111111 }),
  wood: new THREE.MeshLambertMaterial({ color: 0x8b4513 }),
  metal: new THREE.MeshLambertMaterial({ color: 0x888888 }),
  ammo: new THREE.MeshLambertMaterial({ color: 0x27ae60, emissive: 0x27ae60, emissiveIntensity: 0.4 }),
  health: new THREE.MeshLambertMaterial({ color: 0xe74c3c, emissive: 0xe74c3c, emissiveIntensity: 0.4 }),
  bubble: new THREE.MeshBasicMaterial({ color: 0xf1c40f, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false }),
  ring: new THREE.MeshBasicMaterial({ color: 0xf1c40f, transparent: true, opacity: 0.6 })
};

const sharedGeos = {
  // Weapon parts
  bodyAR: new THREE.BoxGeometry(0.4, 0.8, 4),
  bodySMG: new THREE.BoxGeometry(0.4, 0.8, 3),
  bodySniper: new THREE.BoxGeometry(0.4, 0.8, 6),
  barrelAR: new THREE.CylinderGeometry(0.1, 0.12, 3.5, 6),
  barrelSMG: new THREE.CylinderGeometry(0.1, 0.12, 2, 6),
  barrelSniper: new THREE.CylinderGeometry(0.1, 0.12, 5, 6),
  stock: new THREE.BoxGeometry(0.4, 0.6, 2.5),
  grip: new THREE.BoxGeometry(0.3, 1.2, 0.5),
  mag: new THREE.BoxGeometry(0.35, 1.5, 0.8),
  sight: new THREE.BoxGeometry(0.1, 0.3, 0.2),

  // Shotgun
  bodyShotgun: new THREE.BoxGeometry(0.4, 0.6, 3),
  barrelShotgun: new THREE.CylinderGeometry(0.15, 0.15, 4, 6),
  stockShotgun: new THREE.BoxGeometry(0.4, 0.8, 2.5),

  // Pistol
  bodyPistol: new THREE.BoxGeometry(0.3, 0.5, 1.8),
  gripPistol: new THREE.BoxGeometry(0.3, 1.0, 0.6),

  // Throwable
  grenade: new THREE.SphereGeometry(0.5, 6, 6),
  pin: new THREE.BoxGeometry(0.2, 0.4, 0.2),
  flashbang: new THREE.CylinderGeometry(0.3, 0.3, 1.2, 6),

  // Melee
  panBody: new THREE.CylinderGeometry(1.2, 1.0, 0.2, 12),
  panHandle: new THREE.CylinderGeometry(0.15, 0.15, 2, 6),
  macheteBlade: new THREE.BoxGeometry(0.1, 2.5, 0.5),
  macheteHandle: new THREE.CylinderGeometry(0.15, 0.15, 1.2, 6),

  // Loot items
  ammoBox: new THREE.BoxGeometry(1.5, 1, 1),
  healthBox: new THREE.BoxGeometry(2, 2, 2),
  scopeCylinder: new THREE.CylinderGeometry(0.5, 0.5, 2, 6),
  helmetSphere: new THREE.SphereGeometry(1.5, 6, 6),
  armorBox: new THREE.BoxGeometry(3, 3, 0.5),

  // Effects
  bubble: new THREE.SphereGeometry(2.5, 12, 12),
  ring: new THREE.TorusGeometry(2, 0.1, 6, 24)
};

// Material cache for weapon colors
const weaponMatCache = {};
function getWeaponMat(color) {
  if (!weaponMatCache[color]) {
    weaponMatCache[color] = new THREE.MeshLambertMaterial({ color });
  }
  return weaponMatCache[color];
}

// Scope material cache
const scopeMatCache = {};
function getScopeMat(color) {
  if (!scopeMatCache[color]) {
    scopeMatCache[color] = new THREE.MeshLambertMaterial({ color });
  }
  return scopeMatCache[color];
}

export function createTextSprite(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(4, 4, 248, 56, 12);
  } else {
    ctx.rect(4, 4, 248, 56);
  }
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = 'bold 24px "Segoe UI", sans-serif';
  ctx.fillStyle = color || '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  ctx.fillText(text, 128, 32);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(7, 1.75, 1);
  return sprite;
}

export function createWeaponMesh(weaponData, scaleMultiplier = 1.0) {
  const group = new THREE.Group();
  if (!weaponData) return group;

  const mat = getWeaponMat(weaponData.color);

  if (weaponData.type === 'ar' || weaponData.type === 'smg' || weaponData.type === 'sniper') {
    let bodyGeo = weaponData.type === 'sniper' ? sharedGeos.bodySniper :
                  (weaponData.type === 'smg' ? sharedGeos.bodySMG : sharedGeos.bodyAR);
    let barrelGeo = weaponData.type === 'sniper' ? sharedGeos.barrelSniper :
                    (weaponData.type === 'smg' ? sharedGeos.barrelSMG : sharedGeos.barrelAR);
    let bodyLen = weaponData.type === 'sniper' ? 6 : (weaponData.type === 'smg' ? 3 : 4);
    let barrelLen = weaponData.type === 'sniper' ? 5 : (weaponData.type === 'smg' ? 2 : 3.5);

    let bodyMat = (weaponData.name === 'Kar98k' || weaponData.name === 'Thompson') ? sharedMats.wood : mat;
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(0, 0, 0);

    const barrel = new THREE.Mesh(barrelGeo, sharedMats.dark);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.2, -bodyLen / 2 - barrelLen / 2);

    const stock = new THREE.Mesh(sharedGeos.stock, bodyMat);
    stock.position.set(0, -0.1, bodyLen / 2 + 2.5 / 2);

    const grip = new THREE.Mesh(sharedGeos.grip, sharedMats.dark);
    grip.rotation.x = -Math.PI / 8;
    grip.position.set(0, -0.8, bodyLen / 2 - 0.5);

    group.add(body, barrel, stock, grip);

    if (weaponData.type !== 'sniper' || ['SKS', 'Mini14', 'Mk14', 'SLR'].includes(weaponData.name)) {
      const mag = new THREE.Mesh(sharedGeos.mag, sharedMats.dark);
      mag.rotation.x = Math.PI / 16;
      mag.position.set(0, -1.0, -bodyLen / 4);
      group.add(mag);
    }

    if (weaponData.scope) {
      const scopeColor = scopes.find(s => s.name === weaponData.scope.name).color;
      const scopeMat = getScopeMat(scopeColor);
      const scopeMesh = new THREE.Mesh(sharedGeos.scopeCylinder, scopeMat);
      scopeMesh.rotation.x = Math.PI / 2;
      scopeMesh.position.set(0, 0.6, 0);
      group.add(scopeMesh);
    } else {
      const sight = new THREE.Mesh(sharedGeos.sight, sharedMats.dark);
      sight.position.set(0, 0.5, -bodyLen / 2 + 0.5);
      group.add(sight);
    }
  } else if (weaponData.type === 'shotgun') {
    const body = new THREE.Mesh(sharedGeos.bodyShotgun, mat);
    const barrel = new THREE.Mesh(sharedGeos.barrelShotgun, sharedMats.dark);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.2, -3.5);
    const stock = new THREE.Mesh(sharedGeos.stockShotgun, sharedMats.wood);
    stock.position.set(0, -0.2, 2.75);
    group.add(body, barrel, stock);
  } else if (weaponData.type === 'pistol') {
    const body = new THREE.Mesh(sharedGeos.bodyPistol, mat);
    const grip = new THREE.Mesh(sharedGeos.gripPistol, sharedMats.dark);
    grip.rotation.x = -Math.PI / 8;
    grip.position.set(0, -0.6, 0.5);
    group.add(body, grip);
  } else if (weaponData.type === 'throwable') {
    if (weaponData.name === 'Grenade') {
      const nade = new THREE.Mesh(sharedGeos.grenade, mat);
      const pin = new THREE.Mesh(sharedGeos.pin, sharedMats.metal);
      pin.position.set(0, 0.6, 0);
      group.add(nade, pin);
    } else if (weaponData.name === 'Flashbang') {
      const flash = new THREE.Mesh(sharedGeos.flashbang, mat);
      const pin = new THREE.Mesh(sharedGeos.pin, sharedMats.metal);
      pin.position.set(0, 0.7, 0);
      group.add(flash, pin);
    }
  } else if (weaponData.type === 'melee') {
    if (weaponData.name === 'Pan') {
      const panBody = new THREE.Mesh(sharedGeos.panBody, sharedMats.dark);
      panBody.rotation.x = Math.PI / 2;
      const handle = new THREE.Mesh(sharedGeos.panHandle, mat);
      handle.position.set(0, -1.8, 0);
      group.add(panBody, handle);
    } else if (weaponData.name === 'Machete') {
      const blade = new THREE.Mesh(sharedGeos.macheteBlade, sharedMats.metal);
      const handle = new THREE.Mesh(sharedGeos.macheteHandle, sharedMats.wood);
      handle.position.set(0, -1.8, 0);
      group.add(blade, handle);
    } else if (weaponData.name === '咸鱼') {
      const fishMat = new THREE.MeshLambertMaterial({ color: 0x7fb3d8 });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), fishMat);
      body.scale.set(0.6, 0.5, 1.8);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 4), fishMat);
      tail.rotation.x = Math.PI / 2;
      tail.position.set(0, 0, 1.2);
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), eyeMat);
      eye.position.set(0.2, 0.15, -0.7);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), new THREE.MeshBasicMaterial({ color: 0x000000 }));
      pupil.position.set(0.25, 0.18, -0.82);
      group.add(body, tail, eye, pupil);
    }
  }

  if (weaponData.special) {
    const glowMat = new THREE.MeshBasicMaterial({
      color: weaponData.effectColor || weaponData.color,
      transparent: true,
      opacity: 0.7
    });
    // Special loot gets an energy core so it reads differently before pickup.
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 10), glowMat);
    core.position.set(0, 0.75, 0);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.06, 8, 24), glowMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 0.75, 0);
    group.add(core, ring);
  }

  group.scale.set(scaleMultiplier, scaleMultiplier, scaleMultiplier);
  return group;
}

function getLootBubbleColor(type) {
  switch (type) {
    case 'weapon': return 0xf1c40f;
    case 'ammo': return 0x2ecc71;
    case 'health': return 0xe74c3c;
    case 'scope': return 0x9b59b6;
    case 'helmet':
    case 'armor': return 0x3498db;
    default: return 0xffffff;
  }
}

export function spawnLoot(bx, by, bz) {
  for (let i = 0; i < 8; i++) { // Reduced from 12
    // Spawn in a ring OUTSIDE the house (house walls are at ~16 units from center)
    let angle = Math.random() * Math.PI * 2;
    let dist = 18 + Math.random() * 18; // 18-36 units from center (outside walls)
    let lx = bx + Math.cos(angle) * dist;
    let lz = bz + Math.sin(angle) * dist;
    let ly = getTerrainHeight(lx, lz) + 3.0;

    if (ly < 1) continue;

    // Check overlap with existing loot (minimum 5 units apart)
    let tooClose = false;
    for (let j = 0; j < state.lootItems.length; j++) {
      const other = state.lootItems[j].mesh.position;
      const dx = lx - other.x;
      const dz = lz - other.z;
      if (dx * dx + dz * dz < 25) { // 5 * 5 = 25
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    let r = Math.random();
    let type, itemData;
    let mesh;

    if (r < 0.45) {
      type = "weapon";
      if (Math.random() < 0.03) {
        itemData = weapons.find(w => w.name === '咸鱼') || weapons[weapons.length - 1];
      } else {
        itemData = weapons[Math.floor(Math.random() * weapons.length)];
      }
      mesh = createWeaponMesh(itemData, 1.5);
    } else if (r < 0.65) {
      type = "ammo";
      mesh = new THREE.Mesh(sharedGeos.ammoBox, sharedMats.ammo);
      itemData = { name: "弹药箱 (60发)", amount: 60 };
    } else if (r < 0.75) {
      type = "health";
      mesh = new THREE.Mesh(sharedGeos.healthBox, sharedMats.health);
    } else if (r < 0.85) {
      type = "scope";
      itemData = scopes[Math.floor(Math.random() * scopes.length)];
      mesh = new THREE.Mesh(sharedGeos.scopeCylinder, getScopeMat(itemData.color));
    } else if (r < 0.92) {
      type = "helmet";
      let lvls = [0, 0, 1, 1, 2];
      itemData = equipments.filter(e => e.type === "helmet")[lvls[Math.floor(Math.random() * lvls.length)]];
      mesh = new THREE.Mesh(sharedGeos.helmetSphere, getWeaponMat(itemData.color));
    } else {
      type = "armor";
      let lvls = [0, 0, 1, 1, 2];
      itemData = equipments.filter(e => e.type === "armor")[lvls[Math.floor(Math.random() * lvls.length)]];
      mesh = new THREE.Mesh(sharedGeos.armorBox, getWeaponMat(itemData.color));
    }

    mesh.position.set(lx, ly, lz);

    // Add glowing bubble - use shared materials
    const bubble = new THREE.Mesh(sharedGeos.bubble, sharedMats.bubble);
    bubble.position.y = 0.5;
    mesh.add(bubble);

    const ring = new THREE.Mesh(sharedGeos.ring, sharedMats.ring);
    ring.position.y = 0.5;
    ring.rotation.x = Math.PI / 2;
    mesh.add(ring);

    let labelName = itemData ? itemData.name : (type === "health" ? "急救包" : "物资");
    let labelColor = "#ffffff";
    if (type === "weapon") labelColor = "#f1c40f";
    else if (type === "ammo") labelColor = "#2ecc71";
    else if (type === "health") labelColor = "#e74c3c";
    else if (type === "scope") labelColor = "#9b59b6";
    else if (type === "helmet" || type === "armor") labelColor = "#3498db";

    const labelSprite = createTextSprite(labelName, labelColor);
    labelSprite.position.set(0, 2.5, 0);
    mesh.add(labelSprite);

    state.scene.add(mesh);
    state.lootItems.push({ mesh: mesh, type: type, data: itemData, bubble: bubble, ring: ring });
  }
}

export function spawnSingleLoot(lx, ly, lz, forceType = null, scale = 1.0, ammoAmount = null) {
  let type = forceType || "ammo";
  let itemData = null;
  let mesh;

  // Offset slightly to avoid overlap with existing loot
  for (let attempt = 0; attempt < 5; attempt++) {
    let tooClose = false;
    const testX = lx + (attempt > 0 ? (Math.random() - 0.5) * 10 : 0);
    const testZ = lz + (attempt > 0 ? (Math.random() - 0.5) * 10 : 0);
    for (let j = 0; j < state.lootItems.length; j++) {
      const other = state.lootItems[j].mesh.position;
      const dx = testX - other.x;
      const dz = testZ - other.z;
      if (dx * dx + dz * dz < 25) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) {
      lx = testX;
      lz = testZ;
      break;
    }
  }

  if (type === "health") {
    mesh = new THREE.Mesh(sharedGeos.healthBox, sharedMats.health);
  } else {
    mesh = new THREE.Mesh(sharedGeos.ammoBox, sharedMats.ammo);
    const actualAmount = ammoAmount || 60;
    itemData = { name: `弹药箱 (${actualAmount}发)`, amount: actualAmount };
  }

  mesh.position.set(lx, ly + 3.0 * scale, lz);
  if (scale !== 1.0) mesh.scale.setScalar(scale);

  // Add bubble - use shared materials
  const bubble = new THREE.Mesh(sharedGeos.bubble, sharedMats.bubble);
  bubble.position.y = 0.5;
  mesh.add(bubble);

  const ring = new THREE.Mesh(sharedGeos.ring, sharedMats.ring);
  ring.position.y = 0.5;
  ring.rotation.x = Math.PI / 2;
  mesh.add(ring);

  let labelName = type === 'health' ? '急救包' : (ammoAmount ? `弹药箱 (${ammoAmount}发)` : '弹药箱 (60发)');
  const labelSprite = createTextSprite(labelName, type === 'health' ? '#e74c3c' : '#2ecc71');
  labelSprite.position.set(0, 2.5, 0);
  mesh.add(labelSprite);

  state.scene.add(mesh);
  state.lootItems.push({ mesh: mesh, type: type, data: itemData, bubble: bubble, ring: ring });
}

/**
 * Spawn airdrop-grade loot — biased to special weapons + L3 equipment.
 * Drops a fixed loadout (special weapon, L3 helmet, L3 armor, ammo box) instead of a random table.
 */
export function spawnAirdropLoot(bx, by, bz) {
  const specials = weapons.filter((w) => w.special);
  const helmetL3 = equipments.find((e) => e.type === 'helmet' && e.level === 3);
  const armorL3 = equipments.find((e) => e.type === 'armor' && e.level === 3);

  const items = [];
  if (specials.length > 0) {
    items.push({
      kind: 'weapon',
      itemData: { ...specials[Math.floor(Math.random() * specials.length)] },
      buildMesh: (data) => createWeaponMesh(data, 1.6),
    });
    if (Math.random() < 0.5) {
      items.push({
        kind: 'weapon',
        itemData: { ...specials[Math.floor(Math.random() * specials.length)] },
        buildMesh: (data) => createWeaponMesh(data, 1.6),
      });
    }
  }
  if (helmetL3) {
    items.push({ kind: 'helmet', itemData: helmetL3, buildMesh: (data) => new THREE.Mesh(sharedGeos.helmetSphere, getWeaponMat(data.color)) });
  }
  if (armorL3) {
    items.push({ kind: 'armor', itemData: armorL3, buildMesh: (data) => new THREE.Mesh(sharedGeos.armorBox, getWeaponMat(data.color)) });
  }
  // Ammo too — high-tier loadouts demand bullets.
  items.push({ kind: 'ammo', itemData: { name: '弹药箱 (120发)', amount: 120 }, buildMesh: () => new THREE.Mesh(sharedGeos.ammoBox, sharedMats.ammo) });

  // Place items in a tight ring around the crate.
  const radius = 6;
  for (let i = 0; i < items.length; i++) {
    const angle = (i / items.length) * Math.PI * 2;
    const lx = bx + Math.cos(angle) * radius;
    const lz = bz + Math.sin(angle) * radius;
    const ly = getTerrainHeight(lx, lz) + 1.5;
    const it = items[i];
    const mesh = it.buildMesh(it.itemData);
    mesh.position.set(lx, ly, lz);

    const bubble = new THREE.Mesh(sharedGeos.bubble, sharedMats.bubble);
    bubble.position.y = 0.5;
    mesh.add(bubble);
    const ring = new THREE.Mesh(sharedGeos.ring, sharedMats.ring);
    ring.position.y = 0.5;
    ring.rotation.x = Math.PI / 2;
    mesh.add(ring);

    const labelColor = it.kind === 'weapon' ? '#f1c40f' : (it.kind === 'ammo' ? '#2ecc71' : '#3498db');
    const labelSprite = createTextSprite(it.itemData.name, labelColor);
    labelSprite.position.set(0, 2.5, 0);
    mesh.add(labelSprite);

    state.scene.add(mesh);
    state.lootItems.push({ mesh, type: it.kind, data: it.itemData, bubble, ring });
  }
}
