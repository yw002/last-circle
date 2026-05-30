// Loot system: spawning, pickup, weapon meshes

import * as THREE from 'three';
import { state } from '../state.js';
import { weapons, equipments, scopes } from '../config.js';
import { getTerrainHeight } from './terrain.js';

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
  let c = weaponData ? weaponData.color : 0x333333;
  const mat = new THREE.MeshLambertMaterial({ color: c });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
  const metalMat = new THREE.MeshLambertMaterial({ color: 0x888888 });

  if (!weaponData) return group;

  if (weaponData.type === 'ar' || weaponData.type === 'smg' || weaponData.type === 'sniper') {
    let bodyLen = weaponData.type === 'sniper' ? 6 : (weaponData.type === 'smg' ? 3 : 4);
    let bodyMat = (weaponData.name === 'Kar98k' || weaponData.name === 'Thompson') ? woodMat : mat;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.8, bodyLen), bodyMat);
    body.position.set(0, 0, 0);

    let barrelLen = weaponData.type === 'sniper' ? 5 : (weaponData.type === 'smg' ? 2 : 3.5);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, barrelLen, 8), darkMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.2, -bodyLen / 2 - barrelLen / 2);

    let stockLen = 2.5;
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, stockLen), bodyMat);
    stock.position.set(0, -0.1, bodyLen / 2 + stockLen / 2);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.2, 0.5), darkMat);
    grip.rotation.x = -Math.PI / 8;
    grip.position.set(0, -0.8, bodyLen / 2 - 0.5);

    if (weaponData.type !== 'sniper' || weaponData.name === 'SKS' || weaponData.name === 'Mini14' || weaponData.name === 'Mk14' || weaponData.name === 'SLR') {
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.5, 0.8), darkMat);
      mag.rotation.x = Math.PI / 16;
      mag.position.set(0, -1.0, -bodyLen / 4);
      group.add(mag);
    }

    group.add(body, barrel, stock, grip);

    if (weaponData.scope) {
      const scopeColor = scopes.find(s => s.name === weaponData.scope.name).color;
      const scopeMat = new THREE.MeshLambertMaterial({ color: scopeColor });
      const scopeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.5, 8), scopeMat);
      scopeMesh.rotation.x = Math.PI / 2;
      scopeMesh.position.set(0, 0.6, 0);
      group.add(scopeMesh);
    } else {
      const sight = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.2), darkMat);
      sight.position.set(0, 0.5, -bodyLen / 2 + 0.5);
      group.add(sight);
    }

  } else if (weaponData.type === 'shotgun') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 3), mat);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 4, 8), darkMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.2, -3.5);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.8, 2.5), woodMat);
    stock.position.set(0, -0.2, 2.75);
    group.add(body, barrel, stock);
  } else if (weaponData.type === 'pistol') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 1.8), mat);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.0, 0.6), darkMat);
    grip.rotation.x = -Math.PI / 8;
    grip.position.set(0, -0.6, 0.5);
    group.add(body, grip);
  } else if (weaponData.type === 'throwable') {
    if (weaponData.name === 'Grenade') {
      const nade = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), mat);
      const pin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 0.2), metalMat);
      pin.position.set(0, 0.6, 0);
      group.add(nade, pin);
    } else if (weaponData.name === 'Flashbang') {
      const flash = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.2, 8), mat);
      const pin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.2), metalMat);
      pin.position.set(0, 0.7, 0);
      group.add(flash, pin);
    }
  } else if (weaponData.type === 'melee') {
    if (weaponData.name === 'Pan') {
      const panBody = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.0, 0.2, 16), darkMat);
      panBody.rotation.x = Math.PI / 2;
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 2, 8), mat);
      handle.position.set(0, -1.8, 0);
      group.add(panBody, handle);
    } else if (weaponData.name === 'Machete') {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.5, 0.5), metalMat);
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.2, 8), woodMat);
      handle.position.set(0, -1.8, 0);
      group.add(blade, handle);
    }
  }

  group.scale.set(scaleMultiplier, scaleMultiplier, scaleMultiplier);
  return group;
}

export function spawnLoot(bx, by, bz) {
  for (let i = 0; i < 12; i++) {
    let lx = bx + (Math.random() - 0.5) * 50;
    let lz = bz + (Math.random() - 0.5) * 50;
    let ly = getTerrainHeight(lx, lz) + 3.0; // Higher above ground

    if (ly < 1) continue;

    let r = Math.random();
    let type, itemData;
    let mesh;

    if (r < 0.45) {
      type = "weapon";
      itemData = weapons[Math.floor(Math.random() * weapons.length)];
      mesh = createWeaponMesh(itemData, 1.5);
      // Don't rotate - weapons stay upright for horizontal spinning
    } else if (r < 0.65) {
      type = "ammo";
      let color = 0x27ae60;
      let geo = new THREE.BoxGeometry(1.5, 1, 1);
      let mat = new THREE.MeshLambertMaterial({ color: color, emissive: color, emissiveIntensity: 0.4 });
      mesh = new THREE.Mesh(geo, mat);
      itemData = { name: "弹药箱 (60发)", amount: 60 };
    } else if (r < 0.75) {
      type = "health";
      let color = 0xe74c3c;
      let geo = new THREE.BoxGeometry(2, 2, 2);
      let mat = new THREE.MeshLambertMaterial({ color: color, emissive: color, emissiveIntensity: 0.4 });
      mesh = new THREE.Mesh(geo, mat);
    } else if (r < 0.85) {
      type = "scope";
      itemData = scopes[Math.floor(Math.random() * scopes.length)];
      let color = itemData.color;
      let geo = new THREE.CylinderGeometry(0.5, 0.5, 2, 8);
      let mat = new THREE.MeshLambertMaterial({ color: color, emissive: color, emissiveIntensity: 0.4 });
      mesh = new THREE.Mesh(geo, mat);
    } else if (r < 0.92) {
      type = "helmet";
      let lvls = [0, 0, 1, 1, 2];
      itemData = equipments.filter(e => e.type === "helmet")[lvls[Math.floor(Math.random() * lvls.length)]];
      let color = itemData.color;
      let geo = new THREE.SphereGeometry(1.5, 8, 8);
      let mat = new THREE.MeshLambertMaterial({ color: color, emissive: color, emissiveIntensity: 0.4 });
      mesh = new THREE.Mesh(geo, mat);
    } else {
      type = "armor";
      let lvls = [0, 0, 1, 1, 2];
      itemData = equipments.filter(e => e.type === "armor")[lvls[Math.floor(Math.random() * lvls.length)]];
      let color = itemData.color;
      let geo = new THREE.BoxGeometry(3, 3, 0.5);
      let mat = new THREE.MeshLambertMaterial({ color: color, emissive: color, emissiveIntensity: 0.4 });
      mesh = new THREE.Mesh(geo, mat);
    }

    mesh.position.set(lx, ly, lz);

    // Add glowing bubble around loot
    const bubbleGeo = new THREE.SphereGeometry(2.5, 16, 16);
    const bubbleMat = new THREE.MeshBasicMaterial({
      color: getLootBubbleColor(type),
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const bubble = new THREE.Mesh(bubbleGeo, bubbleMat);
    bubble.position.y = 0.5;
    mesh.add(bubble);

    // Add inner glow ring
    const ringGeo = new THREE.TorusGeometry(2, 0.1, 8, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: getLootBubbleColor(type),
      transparent: true,
      opacity: 0.6
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
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

export function spawnSingleLoot(lx, ly, lz, forceType = null) {
  let type = forceType || "ammo";
  let itemData = null;
  let color = 0xffffff;
  let geo = new THREE.BoxGeometry(2, 2, 2);

  if (type === "health") {
    color = 0xe74c3c;
  } else if (type === "ammo") {
    color = 0x27ae60;
    geo = new THREE.BoxGeometry(1.5, 1, 1);
    itemData = { name: "弹药箱 (60发)", amount: 60 };
  }

  const mat = new THREE.MeshLambertMaterial({ color: color, emissive: color, emissiveIntensity: 0.4 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(lx, ly + 3.0, lz); // Higher above ground

  // Add glowing bubble
  const bubbleGeo = new THREE.SphereGeometry(2.5, 16, 16);
  const bubbleMat = new THREE.MeshBasicMaterial({
    color: type === 'health' ? 0xe74c3c : 0x2ecc71,
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const bubble = new THREE.Mesh(bubbleGeo, bubbleMat);
  bubble.position.y = 0.5;
  mesh.add(bubble);

  // Add ring
  const ringGeo = new THREE.TorusGeometry(2, 0.1, 8, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color: type === 'health' ? 0xe74c3c : 0x2ecc71,
    transparent: true,
    opacity: 0.6
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.y = 0.5;
  ring.rotation.x = Math.PI / 2;
  mesh.add(ring);

  let labelName = type === 'health' ? '急救包' : '弹药箱 (60发)';
  const labelSprite = createTextSprite(labelName, type === 'health' ? '#e74c3c' : '#2ecc71');
  labelSprite.position.set(0, 2.5, 0);
  mesh.add(labelSprite);

  state.scene.add(mesh);
  state.lootItems.push({ mesh: mesh, type: type, data: itemData, bubble: bubble, ring: ring });
}
