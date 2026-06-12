// Giant entity — terrifying boss, massive HP, required for chicken dinner

import * as THREE from 'three';
import { state } from '../state.js';
import { MAP_SIZE } from '../config.js';
import { getTerrainHeight } from '../world/terrain.js';
import { playerHit } from './player.js';
import { showNotice, addKillFeed } from '../ui/notices.js';
import { playSound } from '../systems/audio.js';
import { spawnSingleLoot } from '../world/loot.js';
import { triggerVictoryChicken } from '../systems/victory.js';

const GIANT_HEIGHT = 900;
const GIANT_SCALE = GIANT_HEIGHT / 20;
const GIANT_MAX_HP = 5000;

// Insulting messages when spit hits
const SPIT_INSULTS = [
  "💦 巨人朝你吐了口口水！(-3 HP，侮辱性极强)",
  "🤮 你被巨人的口水命中了！(-3 HP，太丢人了)",
  "😤 巨人嫌弃地啐了你一口！(-3 HP)",
  "🫠 一团巨大的口水从天而降…(-3 HP，恶心)",
  "💧 巨人：就这？(-3 HP)",
  "🤡 你被巨人的唾沫精准命中！(-3 HP，小丑竟是我)",
  "😒 巨人甚至懒得看你，随便吐了口…(-3 HP)",
  "🦷 口水里还夹着一块菜叶…(-3 HP，物理+精神双重伤害)",
  "💦 巨人打了个哈欠，口水溅到你了(-3 HP)",
  "🫣 全场都在看你被巨人吐口水…(-3 HP，社死现场)"
];

const GIANT_SPAWN_MESSAGES = [
  "⚠️ 大地震颤…远古恶魔巨人从地狱深渊爬出！",
  "🏔️ 地平线上升起了一座\"山\"…不，那是远古恶魔！",
  "💀 全图可见的恶魔巨人苏醒了！击杀它是吃鸡的条件之一！"
];

const GIANT_DEATH_MESSAGES = [
  "🏆 你击杀了远古恶魔巨人！吃鸡之路已无阻碍！",
  "💀 巨人轰然倒地！大地震颤！全场震惊！",
  "⚡ 远古恶魔终于倒下了！你证明了自己是最强者！"
];

let giantGroup = null;
let giantPos = new THREE.Vector3();
let giantNextSpit = 8 + Math.random() * 12;
let spitProjectiles = [];
let giantSwayPhase = 0;
let giantHeadMesh = null;
let giantHealth = GIANT_MAX_HP;
let giantAlive = true;
let giantDamageFlashTimer = 0;
let giantDeathPhase = 0; // 0=alive, 1=dying, 2=dead
let giantDripParticles = [];
let giantHealthBarGroup = null;
let giantHealthBarFill = null;
let giantDyingTimer = 0;
let giantLastDropThreshold = GIANT_MAX_HP; // Track next HP threshold for loot drop

// Shared geometries & materials
const _giantGeos = {};
const _giantMats = {};

function createGiantGeometries() {
  const S = GIANT_SCALE;
  const u = S * 0.12; // unit multiplier

  // === MATERIALS ===
  _giantMats.skin = new THREE.MeshPhongMaterial({ color: 0x3a4a2a, shininess: 5 });
  _giantMats.skinDark = new THREE.MeshPhongMaterial({ color: 0x2a3a1a, shininess: 3 });
  _giantMats.rotten = new THREE.MeshPhongMaterial({ color: 0x4a3a2a, shininess: 2 });
  _giantMats.bone = new THREE.MeshPhongMaterial({ color: 0xd4c8a0, shininess: 20 });
  _giantMats.blood = new THREE.MeshPhongMaterial({ color: 0x8b0000, shininess: 40 });
  _giantMats.cloth = new THREE.MeshPhongMaterial({ color: 0x1a1a0a, shininess: 2 });
  _giantMats.chain = new THREE.MeshPhongMaterial({ color: 0x555555, shininess: 60 });
  _giantMats.vein = new THREE.MeshBasicMaterial({ color: 0x00ff44, transparent: true, opacity: 0.8 });
  _giantMats.eyeMain = new THREE.MeshBasicMaterial({ color: 0xff2200 });
  _giantMats.eyeSmall = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
  _giantMats.eyeGlow = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.4 });
  _giantMats.pupil = new THREE.MeshBasicMaterial({ color: 0x110000 });
  _giantMats.mouth = new THREE.MeshPhongMaterial({ color: 0x5a0000, shininess: 30 });
  _giantMats.tongue = new THREE.MeshPhongMaterial({ color: 0xcc3333, shininess: 40 });
  _giantMats.tooth = new THREE.MeshPhongMaterial({ color: 0xaa9944, shininess: 30 });
  _giantMats.wound = new THREE.MeshPhongMaterial({ color: 0x660000, shininess: 15 });
  _giantMats.spike = new THREE.MeshPhongMaterial({ color: 0x888866, shininess: 25 });
  _giantMats.spit = new THREE.MeshBasicMaterial({ color: 0x88cc44, transparent: true, opacity: 0.8 });
  _giantMats.damageFlash = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.6 });

  // === BASE GEOMETRIES ===
  _giantGeos.torso = new THREE.CylinderGeometry(8 * u, 10 * u, 12 * S * 0.15, 28);
  _giantGeos.belly = new THREE.SphereGeometry(10 * u, 28, 20);
  _giantGeos.head = new THREE.SphereGeometry(5.5 * u, 32, 24);
  _giantGeos.jaw = new THREE.SphereGeometry(3.8 * u, 24, 16);
  _giantGeos.eyeMain = new THREE.SphereGeometry(1.4 * u, 24, 18);
  _giantGeos.eyeSmall = new THREE.SphereGeometry(0.7 * u, 10, 10);
  _giantGeos.eyeGlow = new THREE.SphereGeometry(2.2 * u, 10, 10);
  _giantGeos.pupil = new THREE.SphereGeometry(0.5 * u, 8, 8);
  _giantGeos.nose = new THREE.ConeGeometry(1.5 * u, 3.5 * u, 14);
  _giantGeos.mouth = new THREE.SphereGeometry(2.8 * u, 24, 16);
  _giantGeos.tooth = new THREE.ConeGeometry(0.5 * u, 2 * u, 12);
  _giantGeos.toothBig = new THREE.ConeGeometry(0.7 * u, 3 * u, 12);
  _giantGeos.ear = new THREE.SphereGeometry(2 * u, 18, 14);
  _giantGeos.horn = new THREE.ConeGeometry(1.2 * u, 8 * u, 16);
  _giantGeos.hornSmall = new THREE.ConeGeometry(0.6 * u, 4 * u, 12);
  _giantGeos.tongue = new THREE.CylinderGeometry(1.5 * u, 1 * u, 0.5 * u, 16);

  // Arms & Legs
  _giantGeos.armUpper = new THREE.CylinderGeometry(3.2 * u, 2.8 * u, 10 * S * 0.15, 22);
  _giantGeos.armLower = new THREE.CylinderGeometry(2.8 * u, 2.2 * u, 9 * S * 0.15, 22);
  _giantGeos.fist = new THREE.SphereGeometry(2.8 * u, 22, 16);
  _giantGeos.legUpper = new THREE.CylinderGeometry(4.2 * u, 3.2 * u, 12 * S * 0.15, 22);
  _giantGeos.legLower = new THREE.CylinderGeometry(3.2 * u, 2.6 * u, 10 * S * 0.15, 22);
  _giantGeos.foot = new THREE.CylinderGeometry(3.5 * u, 4 * u, 2.5 * u, 20);

  // Joint/connector geometries (seamless transitions)
  _giantGeos.neck = new THREE.CylinderGeometry(5.5 * u, 8 * u, 10 * u, 24);
  _giantGeos.shoulderL = new THREE.SphereGeometry(4 * u, 22, 16);
  _giantGeos.shoulderR = new THREE.SphereGeometry(4 * u, 22, 16);
  _giantGeos.elbow = new THREE.SphereGeometry(3 * u, 20, 14);
  _giantGeos.wrist = new THREE.SphereGeometry(2.5 * u, 18, 12);
  _giantGeos.knee = new THREE.SphereGeometry(3.5 * u, 20, 14);
  _giantGeos.ankle = new THREE.SphereGeometry(2.8 * u, 18, 12);
  _giantGeos.hipJoint = new THREE.SphereGeometry(4.5 * u, 22, 16);

  // Horror details
  _giantGeos.rib = new THREE.CylinderGeometry(0.3 * u, 0.3 * u, 6 * u, 12);
  _giantGeos.spike = new THREE.ConeGeometry(0.8 * u, 5 * u, 12);
  _giantGeos.spikeSmall = new THREE.ConeGeometry(0.5 * u, 3 * u, 10);
  _giantGeos.chainLink = new THREE.TorusGeometry(1.2 * u, 0.3 * u, 12, 16);
  _giantGeos.vein = new THREE.CylinderGeometry(0.25 * u, 0.25 * u, 4 * u, 12);
  _giantGeos.woundPatch = new THREE.SphereGeometry(1.5 * u, 16, 12);
  _giantGeos.drip = new THREE.SphereGeometry(0.8, 6, 6);

  // Spit projectile
  _giantGeos.spit = new THREE.SphereGeometry(8, 18, 14);
  _giantGeos.spitTrail = new THREE.SphereGeometry(5, 8, 8);
}

function markAllMeshes(group) {
  group.traverse(child => {
    if (child.isMesh) {
      child.frustumCulled = false;
      child.userData.isGiant = true;
    }
  });
}

export function isGiantAlive() {
  return giantAlive;
}

export function getGiantHealth() {
  return giantHealth;
}

export function getGiantMaxHealth() {
  return GIANT_MAX_HP;
}

export function getGiantPosition() {
  return giantPos;
}

export function damageGiant(dmg, hitPoint) {
  if (!giantAlive || giantDeathPhase > 0) return;
  giantHealth -= dmg;
  giantDamageFlashTimer = 0.15;

  // Flash red
  giantGroup.traverse(child => {
    if (child.isMesh && !child.userData._origMat) {
      child.userData._origMat = child.material;
      child.material = _giantMats.damageFlash;
    }
  });

  // Drop ammo every 500 HP lost (prevents running out of bullets)
  const dropInterval = 500;
  while (giantHealth <= giantLastDropThreshold - dropInterval && giantHealth > 0) {
    giantLastDropThreshold -= dropInterval;
    // Spawn ammo box near giant's feet with random offset
    const dropAngle = Math.random() * Math.PI * 2;
    const dropDist = 15 + Math.random() * 20;
    const dropX = giantPos.x + Math.cos(dropAngle) * dropDist;
    const dropZ = giantPos.z + Math.sin(dropAngle) * dropDist;
    const dropY = getTerrainHeight(dropX, dropZ);
    spawnSingleLoot(dropX, dropY, dropZ, "ammo", 5.0, 200);
    showNotice("📦 巨人掉落了巨型弹药箱(200发)！快去捡！", "#2ecc71");
    playSound('hit', { x: dropX, y: dropY, z: dropZ });
  }

  // Massive blood splash at hit point
  if (hitPoint) {
    // Big blood spray (15 particles, large & dramatic)
    for (let i = 0; i < 15; i++) {
      const size = 1.0 + Math.random() * 2.5;
      const geo = new THREE.SphereGeometry(size, 5, 5);
      const shade = 0x660000 + Math.floor(Math.random() * 0x220000);
      const mat = new THREE.MeshBasicMaterial({ color: shade, transparent: true, opacity: 0.95 });
      const p = new THREE.Mesh(geo, mat);
      p.frustumCulled = false;
      p.position.copy(hitPoint);
      state.scene.add(p);
      state.bloodParticles.push({
        mesh: p,
        vx: (Math.random() - 0.5) * 30,
        vy: 3 + Math.random() * 18,
        vz: (Math.random() - 0.5) * 30,
        age: 0
      });
    }
    // Blood stream (3 large drops that fall like a fountain)
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.SphereGeometry(3, 6, 6);
      const mat = new THREE.MeshBasicMaterial({ color: 0x990000, transparent: true, opacity: 0.9 });
      const p = new THREE.Mesh(geo, mat);
      p.frustumCulled = false;
      p.position.copy(hitPoint);
      state.scene.add(p);
      const angle = (i / 3) * Math.PI * 2 + Math.random();
      state.bloodParticles.push({
        mesh: p,
        vx: Math.cos(angle) * 8,
        vy: 12 + Math.random() * 8,
        vz: Math.sin(angle) * 8,
        age: 0
      });
    }
  }

  // Show damage notice
  showNotice(`⚔️ 对巨人造成 ${Math.round(dmg)} 伤害！(${giantHealth}/${GIANT_MAX_HP})`, "#ff6644");

  if (giantHealth <= 0) {
    giantHealth = 0;
    giantAlive = false;
    giantDeathPhase = 1;
    giantDyingTimer = 0;
    state.giantAlive = false;

    // Announce kill
    const msg = GIANT_DEATH_MESSAGES[Math.floor(Math.random() * GIANT_DEATH_MESSAGES.length)];
    showNotice(msg, "#f1c40f");
    addKillFeed("<span style='color:#f1c40f'>你</span> 击杀了 <span style='color:#ff4444'>远古恶魔巨人</span>");
    state.player.kills++;

    playSound('explosion', { x: giantPos.x, y: giantPos.y, z: giantPos.z });

    // Check if this completes the chicken dinner condition
    if (state.aliveCount === 1 && state.player.alive) {
      triggerVictoryChicken();
      setTimeout(() => {
        state.controls.unlock();
        document.getElementById('title').innerText = "大吉大利，今晚吃鸡！";
        document.getElementById('title').style.color = "#f1c40f";
        document.getElementById('subtitle').innerText = `WINNER WINNER CHICKEN DINNER! 击杀数: ${state.player.kills} (含远古恶魔巨人)`;
        document.getElementById('start-btn').innerText = "再玩一局";
        document.getElementById('start-btn').style.display = "block";
        document.getElementById('start-btn').onclick = () => location.reload();
        document.getElementById('overlay').style.display = "flex";
      }, 5000); // Wait for death animation
    }
  }
}

export function initGiant() {
  createGiantGeometries();

  giantGroup = new THREE.Group();
  giantHealth = GIANT_MAX_HP;
  giantAlive = true;
  giantDeathPhase = 0;
  state.giantAlive = true;
  state.giantHealth = GIANT_MAX_HP;
  const S = GIANT_SCALE;
  const u = S * 0.12;

  // Position giant at a random spot
  const angle = Math.random() * Math.PI * 2;
  const dist = MAP_SIZE * 0.25 + Math.random() * MAP_SIZE * 0.15;
  giantPos.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
  giantPos.y = getTerrainHeight(giantPos.x, giantPos.z);

  // ====== BUILD THE TERRIFYING GIANT ======

  // -- TORSO --
  const torso = new THREE.Mesh(_giantGeos.torso, _giantMats.skin);
  torso.position.y = GIANT_HEIGHT * 0.5;
  giantGroup.add(torso);

  // -- BELLY (bloated, rotten) --
  const belly = new THREE.Mesh(_giantGeos.belly, _giantMats.rotten);
  belly.position.set(0, GIANT_HEIGHT * 0.42, 4 * u);
  belly.scale.set(1, 0.8, 0.8);
  giantGroup.add(belly);

  // -- EXPOSED RIBCAGE (chest wound reveals bones) --
  for (let i = 0; i < 5; i++) {
    const ribL = new THREE.Mesh(_giantGeos.rib, _giantMats.bone);
    ribL.position.set(-3 * u + i * 1.5 * u, GIANT_HEIGHT * 0.5 + (i - 2) * 1.2 * u, 8 * u);
    ribL.rotation.z = 0.4 + i * 0.1;
    ribL.rotation.x = -0.3;
    giantGroup.add(ribL);
    const ribR = new THREE.Mesh(_giantGeos.rib, _giantMats.bone);
    ribR.position.set(3 * u - i * 1.5 * u, GIANT_HEIGHT * 0.5 + (i - 2) * 1.2 * u, 8 * u);
    ribR.rotation.z = -0.4 - i * 0.1;
    ribR.rotation.x = -0.3;
    giantGroup.add(ribR);
  }

  // Chest wound cavity (dark hole)
  const woundCavity = new THREE.Mesh(
    new THREE.SphereGeometry(3 * u, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0x1a0000 })
  );
  woundCavity.position.set(0, GIANT_HEIGHT * 0.5, 7 * u);
  woundCavity.scale.set(1, 0.6, 0.5);
  giantGroup.add(woundCavity);

  // -- STITCHED WOUNDS on body --
  const woundPositions = [
    { x: -5 * u, y: GIANT_HEIGHT * 0.55, z: 6 * u },
    { x: 4 * u, y: GIANT_HEIGHT * 0.45, z: 7 * u },
    { x: -3 * u, y: GIANT_HEIGHT * 0.35, z: 3 * u },
    { x: 6 * u, y: GIANT_HEIGHT * 0.52, z: -2 * u },
  ];
  woundPositions.forEach(wp => {
    const wound = new THREE.Mesh(_giantGeos.woundPatch, _giantMats.wound);
    wound.position.set(wp.x, wp.y, wp.z);
    wound.scale.set(1, 0.3, 1);
    giantGroup.add(wound);
    // Stitch lines (thin boxes across wound)
    for (let s = 0; s < 3; s++) {
      const stitch = new THREE.Mesh(
        new THREE.BoxGeometry(3 * u, 0.15 * u, 0.15 * u),
        _giantMats.cloth
      );
      stitch.position.set(wp.x + (s - 1) * 0.8 * u, wp.y + 0.2 * u, wp.z + 0.5 * u);
      stitch.rotation.z = 0.3;
      giantGroup.add(stitch);
    }
  });

  // -- GLOWING VEINS on arms and neck --
  const veinPositions = [
    { x: -10 * u, y: GIANT_HEIGHT * 0.55, z: 1 * u, rz: 0.5 },
    { x: -11 * u, y: GIANT_HEIGHT * 0.45, z: 0.5 * u, rz: 0.3 },
    { x: 10 * u, y: GIANT_HEIGHT * 0.55, z: 1 * u, rz: -0.5 },
    { x: 11 * u, y: GIANT_HEIGHT * 0.45, z: 0.5 * u, rz: -0.3 },
    { x: -1.5 * u, y: GIANT_HEIGHT * 0.65, z: 3 * u, rz: 0.8 },
    { x: 1.5 * u, y: GIANT_HEIGHT * 0.65, z: 3 * u, rz: -0.8 },
  ];
  veinPositions.forEach(vp => {
    const vein = new THREE.Mesh(_giantGeos.vein, _giantMats.vein);
    vein.position.set(vp.x, vp.y, vp.z);
    vein.rotation.z = vp.rz;
    giantGroup.add(vein);
  });

  // -- HEAD (deformed, asymmetric) --
  const head = new THREE.Mesh(_giantGeos.head, _giantMats.skin);
  head.position.y = GIANT_HEIGHT * 0.72;
  head.scale.set(1, 0.9, 1.1);
  giantGroup.add(head);
  giantHeadMesh = head;

  // -- NECK (thick seamless connector) --
  const neck = new THREE.Mesh(_giantGeos.neck, _giantMats.skin);
  neck.position.y = GIANT_HEIGHT * 0.58;
  giantGroup.add(neck);

  // -- SHOULDERS (smooth arm-to-torso transition) --
  const shoulderL = new THREE.Mesh(_giantGeos.shoulderL, _giantMats.skin);
  shoulderL.position.set(-9 * u, GIANT_HEIGHT * 0.53, 0);
  shoulderL.scale.set(1, 0.8, 0.9);
  const shoulderR = new THREE.Mesh(_giantGeos.shoulderR, _giantMats.skin);
  shoulderR.position.set(9 * u, GIANT_HEIGHT * 0.53, 0);
  shoulderR.scale.set(1, 0.8, 0.9);
  giantGroup.add(shoulderL, shoulderR);

  // Head lump/tumor
  const tumor = new THREE.Mesh(
    new THREE.SphereGeometry(2.5 * u, 10, 10),
    _giantMats.rotten
  );
  tumor.position.set(2 * u, GIANT_HEIGHT * 0.78, -1 * u);
  giantGroup.add(tumor);

  // -- JAW (split/broken, hanging) --
  const jaw = new THREE.Mesh(_giantGeos.jaw, _giantMats.skinDark);
  jaw.position.set(0, GIANT_HEIGHT * 0.64, 3 * u);
  jaw.scale.set(1, 0.6, 0.8);
  jaw.rotation.x = 0.15; // Jaw hangs open
  giantGroup.add(jaw);

  // -- MOUTH (dark gaping maw) --
  const mouth = new THREE.Mesh(_giantGeos.mouth, _giantMats.mouth);
  mouth.position.set(0, GIANT_HEIGHT * 0.66, 4.5 * u);
  mouth.scale.set(1, 0.5, 0.6);
  giantGroup.add(mouth);

  // -- TONGUE (hanging out, grotesque) --
  const tongue = new THREE.Mesh(_giantGeos.tongue, _giantMats.tongue);
  tongue.position.set(0.5 * u, GIANT_HEIGHT * 0.62, 5.5 * u);
  tongue.rotation.x = 0.5;
  tongue.rotation.z = 0.2;
  giantGroup.add(tongue);

  // -- EYES (asymmetric — one main + cluster of small ones) --
  // Left: single large glowing eye
  const eyeL = new THREE.Mesh(_giantGeos.eyeMain, _giantMats.eyeMain);
  eyeL.position.set(-2.5 * u, GIANT_HEIGHT * 0.74, 3.8 * u);
  giantGroup.add(eyeL);
  const glowL = new THREE.Mesh(_giantGeos.eyeGlow, _giantMats.eyeGlow);
  glowL.position.copy(eyeL.position);
  giantGroup.add(glowL);
  const pupilL = new THREE.Mesh(_giantGeos.pupil, _giantMats.pupil);
  pupilL.position.copy(eyeL.position).add(new THREE.Vector3(0, 0, 0.5 * u));
  giantGroup.add(pupilL);

  // Right: cluster of 3 smaller eyes (creepy!)
  const eyeR1 = new THREE.Mesh(_giantGeos.eyeMain, _giantMats.eyeSmall);
  eyeR1.position.set(2.5 * u, GIANT_HEIGHT * 0.75, 3.8 * u);
  const eyeR2 = new THREE.Mesh(_giantGeos.eyeSmall, _giantMats.eyeSmall);
  eyeR2.position.set(3.5 * u, GIANT_HEIGHT * 0.72, 3.2 * u);
  const eyeR3 = new THREE.Mesh(_giantGeos.eyeSmall, _giantMats.eyeSmall);
  eyeR3.position.set(2.8 * u, GIANT_HEIGHT * 0.78, 3.0 * u);
  giantGroup.add(eyeR1, eyeR2, eyeR3);
  const glowR = new THREE.Mesh(_giantGeos.eyeGlow, _giantMats.eyeGlow);
  glowR.position.copy(eyeR1.position);
  giantGroup.add(glowR);

  // -- NOSE (broken, twisted) --
  const nose = new THREE.Mesh(_giantGeos.nose, _giantMats.skinDark);
  nose.position.set(0.5 * u, GIANT_HEIGHT * 0.7, 5 * u);
  nose.rotation.x = Math.PI * 0.6;
  nose.rotation.z = 0.25;
  giantGroup.add(nose);

  // -- TEETH (jagged, uneven — some big, some small) --
  for (let i = 0; i < 8; i++) {
    const isBig = i === 1 || i === 4 || i === 6;
    const toothGeo = isBig ? _giantGeos.toothBig : _giantGeos.tooth;
    const tooth = new THREE.Mesh(toothGeo, _giantMats.tooth);
    const tx = -3 * u + i * 0.85 * u;
    tooth.position.set(tx, GIANT_HEIGHT * 0.64, 4.2 * u);
    tooth.rotation.x = Math.PI + (Math.random() - 0.5) * 0.4;
    tooth.rotation.z = (Math.random() - 0.5) * 0.5;
    giantGroup.add(tooth);
  }
  // Upper fangs (sticking down)
  for (let i = 0; i < 3; i++) {
    const fang = new THREE.Mesh(_giantGeos.toothBig, _giantMats.tooth);
    const fx = -2 * u + i * 2 * u;
    fang.position.set(fx, GIANT_HEIGHT * 0.68, 4.5 * u);
    fang.rotation.z = (Math.random() - 0.5) * 0.3;
    giantGroup.add(fang);
  }

  // -- EARS (one torn, one with earring) --
  const earL = new THREE.Mesh(_giantGeos.ear, _giantMats.skin);
  earL.position.set(-5 * u, GIANT_HEIGHT * 0.72, 0);
  earL.scale.set(0.5, 1, 0.8);
  giantGroup.add(earL);
  // Right ear — torn, smaller
  const earR = new THREE.Mesh(_giantGeos.ear, _giantMats.wound);
  earR.position.set(5 * u, GIANT_HEIGHT * 0.72, 0);
  earR.scale.set(0.3, 0.6, 0.7);
  giantGroup.add(earR);
  // Earring (chain ring on torn ear)
  const earring = new THREE.Mesh(
    new THREE.TorusGeometry(0.8 * u, 0.15 * u, 6, 10),
    _giantMats.chain
  );
  earring.position.set(5.5 * u, GIANT_HEIGHT * 0.7, 0.5 * u);
  giantGroup.add(earring);

  // -- HORNS (massive, curved) --
  const hornL = new THREE.Mesh(_giantGeos.horn, _giantMats.bone);
  hornL.position.set(-3.5 * u, GIANT_HEIGHT * 0.83, -1.5 * u);
  hornL.rotation.z = 0.35;
  hornL.rotation.x = -0.2;
  const hornR = new THREE.Mesh(_giantGeos.horn, _giantMats.bone);
  hornR.position.set(3.5 * u, GIANT_HEIGHT * 0.83, -1.5 * u);
  hornR.rotation.z = -0.35;
  hornR.rotation.x = -0.2;
  // Smaller extra horns
  const hornExtra1 = new THREE.Mesh(_giantGeos.hornSmall, _giantMats.bone);
  hornExtra1.position.set(-2 * u, GIANT_HEIGHT * 0.8, -2 * u);
  hornExtra1.rotation.z = 0.5;
  const hornExtra2 = new THREE.Mesh(_giantGeos.hornSmall, _giantMats.bone);
  hornExtra2.position.set(4.5 * u, GIANT_HEIGHT * 0.78, -2 * u);
  hornExtra2.rotation.z = -0.6;
  giantGroup.add(hornL, hornR, hornExtra1, hornExtra2);

  // -- BONE SPIKES (protruding from body) --
  const spikePositions = [
    { x: -9 * u, y: GIANT_HEIGHT * 0.55, z: -3 * u, rz: -0.8 },
    { x: 9 * u, y: GIANT_HEIGHT * 0.55, z: -3 * u, rz: 0.8 },
    { x: -12 * u, y: GIANT_HEIGHT * 0.38, z: 0, rz: -1.0 },
    { x: 12 * u, y: GIANT_HEIGHT * 0.38, z: 0, rz: 1.0 },
    { x: 0, y: GIANT_HEIGHT * 0.58, z: -7 * u, rz: 0, rx: -0.8 },
    { x: -3 * u, y: GIANT_HEIGHT * 0.56, z: -6 * u, rz: -0.2, rx: -0.6 },
    { x: 3 * u, y: GIANT_HEIGHT * 0.56, z: -6 * u, rz: 0.2, rx: -0.6 },
  ];
  spikePositions.forEach(sp => {
    const spike = new THREE.Mesh(_giantGeos.spike, _giantMats.spike);
    spike.position.set(sp.x, sp.y, sp.z);
    spike.rotation.z = sp.rz || 0;
    spike.rotation.x = sp.rx || 0;
    giantGroup.add(spike);
  });
  // Small spikes on forearms
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 3; i++) {
      const sp = new THREE.Mesh(_giantGeos.spikeSmall, _giantMats.spike);
      sp.position.set(
        side * (11 + i * 0.5) * u,
        GIANT_HEIGHT * (0.37 - i * 0.03),
        -1.5 * u
      );
      sp.rotation.z = side * (0.6 + i * 0.15);
      giantGroup.add(sp);
    }
  }

  // -- CHAINS (hanging from shoulders and waist) --
  const chainAnchors = [
    { x: -8 * u, y: GIANT_HEIGHT * 0.52, z: 2 * u },
    { x: 8 * u, y: GIANT_HEIGHT * 0.52, z: 2 * u },
    { x: -6 * u, y: GIANT_HEIGHT * 0.38, z: 5 * u },
    { x: 6 * u, y: GIANT_HEIGHT * 0.38, z: 5 * u },
  ];
  chainAnchors.forEach(ca => {
    const numLinks = 4 + Math.floor(Math.random() * 3);
    for (let l = 0; l < numLinks; l++) {
      const link = new THREE.Mesh(_giantGeos.chainLink, _giantMats.chain);
      link.position.set(ca.x, ca.y - l * 2.2 * u, ca.z);
      link.rotation.x = Math.PI / 2;
      link.rotation.y = l * 0.5;
      giantGroup.add(link);
    }
  });

  // -- ARMS (massive, scarred) --
  const armUpperL = new THREE.Mesh(_giantGeos.armUpper, _giantMats.skin);
  armUpperL.position.set(-10 * u, GIANT_HEIGHT * 0.5, 0);
  armUpperL.rotation.z = 0.15;
  const armLowerL = new THREE.Mesh(_giantGeos.armLower, _giantMats.skinDark);
  armLowerL.position.set(-12 * u, GIANT_HEIGHT * 0.35, 1 * u);
  armLowerL.rotation.z = 0.1;
  const fistL = new THREE.Mesh(_giantGeos.fist, _giantMats.rotten);
  fistL.position.set(-13 * u, GIANT_HEIGHT * 0.24, 1.5 * u);

  const armUpperR = new THREE.Mesh(_giantGeos.armUpper, _giantMats.skin);
  armUpperR.position.set(10 * u, GIANT_HEIGHT * 0.5, 0);
  armUpperR.rotation.z = -0.15;
  const armLowerR = new THREE.Mesh(_giantGeos.armLower, _giantMats.skinDark);
  armLowerR.position.set(12 * u, GIANT_HEIGHT * 0.35, 1 * u);
  armLowerR.rotation.z = -0.1;
  const fistR = new THREE.Mesh(_giantGeos.fist, _giantMats.rotten);
  fistR.position.set(13 * u, GIANT_HEIGHT * 0.24, 1.5 * u);

  // -- ELBOW JOINTS (smooth arm bend transition) --
  const elbowL = new THREE.Mesh(_giantGeos.elbow, _giantMats.skin);
  elbowL.position.set(-11 * u, GIANT_HEIGHT * 0.42, 0.5 * u);
  const elbowR = new THREE.Mesh(_giantGeos.elbow, _giantMats.skin);
  elbowR.position.set(11 * u, GIANT_HEIGHT * 0.42, 0.5 * u);

  // -- WRIST JOINTS (smooth arm-to-fist transition) --
  const wristL = new THREE.Mesh(_giantGeos.wrist, _giantMats.skinDark);
  wristL.position.set(-12.5 * u, GIANT_HEIGHT * 0.28, 1.2 * u);
  const wristR = new THREE.Mesh(_giantGeos.wrist, _giantMats.skinDark);
  wristR.position.set(12.5 * u, GIANT_HEIGHT * 0.28, 1.2 * u);

  giantGroup.add(armUpperL, armLowerL, elbowL, wristL, fistL, armUpperR, armLowerR, elbowR, wristR, fistR);

  // -- LEGS (tree-trunk thick, clothed in rags) --
  const legUpperL = new THREE.Mesh(_giantGeos.legUpper, _giantMats.cloth);
  legUpperL.position.set(-4 * u, GIANT_HEIGHT * 0.25, 0);
  const legLowerL = new THREE.Mesh(_giantGeos.legLower, _giantMats.skin);
  legLowerL.position.set(-4 * u, GIANT_HEIGHT * 0.1, 0);
  const footL = new THREE.Mesh(_giantGeos.foot, _giantMats.rotten);
  footL.position.set(-4 * u, 1.2 * u, 1 * u);

  const legUpperR = new THREE.Mesh(_giantGeos.legUpper, _giantMats.cloth);
  legUpperR.position.set(4 * u, GIANT_HEIGHT * 0.25, 0);
  const legLowerR = new THREE.Mesh(_giantGeos.legLower, _giantMats.skin);
  legLowerR.position.set(4 * u, GIANT_HEIGHT * 0.1, 0);
  const footR = new THREE.Mesh(_giantGeos.foot, _giantMats.rotten);
  footR.position.set(4 * u, 1.2 * u, 1 * u);

  // -- HIP JOINTS (smooth leg-to-torso transition) --
  const hipL = new THREE.Mesh(_giantGeos.hipJoint, _giantMats.cloth);
  hipL.position.set(-4 * u, GIANT_HEIGHT * 0.33, 0);
  hipL.scale.set(1, 0.7, 0.9);
  const hipR = new THREE.Mesh(_giantGeos.hipJoint, _giantMats.cloth);
  hipR.position.set(4 * u, GIANT_HEIGHT * 0.33, 0);
  hipR.scale.set(1, 0.7, 0.9);

  // -- KNEE JOINTS (smooth leg bend transition) --
  const kneeL = new THREE.Mesh(_giantGeos.knee, _giantMats.skin);
  kneeL.position.set(-4 * u, GIANT_HEIGHT * 0.17, 0);
  const kneeR = new THREE.Mesh(_giantGeos.knee, _giantMats.skin);
  kneeR.position.set(4 * u, GIANT_HEIGHT * 0.17, 0);

  // -- ANKLE JOINTS (smooth leg-to-foot transition) --
  const ankleL = new THREE.Mesh(_giantGeos.ankle, _giantMats.skin);
  ankleL.position.set(-4 * u, GIANT_HEIGHT * 0.05, 0.5 * u);
  const ankleR = new THREE.Mesh(_giantGeos.ankle, _giantMats.skin);
  ankleR.position.set(4 * u, GIANT_HEIGHT * 0.05, 0.5 * u);

  giantGroup.add(hipL, hipR, legUpperL, legLowerL, kneeL, ankleL, footL, legUpperR, legLowerR, kneeR, ankleR, footR);

  // -- HEALTH BAR (floating above head) --
  giantHealthBarGroup = new THREE.Group();
  const hbBg = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 4),
    new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide })
  );
  giantHealthBarFill = new THREE.Mesh(
    new THREE.PlaneGeometry(58, 3),
    new THREE.MeshBasicMaterial({ color: 0xff2200, side: THREE.DoubleSide })
  );
  const hbBorder = new THREE.Mesh(
    new THREE.PlaneGeometry(62, 6),
    new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.DoubleSide })
  );
  hbBorder.position.z = -0.1;
  giantHealthBarFill.position.z = 0.1;
  giantHealthBarGroup.add(hbBorder, hbBg, giantHealthBarFill);
  giantHealthBarGroup.position.set(0, GIANT_HEIGHT * 0.92, 0);
  giantHealthBarGroup.frustumCulled = false;
  hbBorder.frustumCulled = false;
  hbBg.frustumCulled = false;
  giantHealthBarFill.frustumCulled = false;
  giantGroup.add(giantHealthBarGroup);

  // -- Mark all meshes & disable frustum culling --
  markAllMeshes(giantGroup);

  // Register giant meshes in state.objects for raycasting
  giantGroup.traverse(child => {
    if (child.isMesh) {
      state.objects.push(child);
    }
  });

  giantGroup.position.copy(giantPos);
  state.scene.add(giantGroup);

  // Spawn dripping particles
  startGiantDrip();

  // Announce
  setTimeout(() => {
    showNotice(GIANT_SPAWN_MESSAGES[Math.floor(Math.random() * GIANT_SPAWN_MESSAGES.length)], "#ff4400");
  }, 3000);
}

function startGiantDrip() {
  // Green ooze dripping from the giant's body
  const dripPoints = [
    { ox: -5 * GIANT_SCALE * 0.12, oy: GIANT_HEIGHT * 0.55, oz: 6 * GIANT_SCALE * 0.12 },
    { ox: 4 * GIANT_SCALE * 0.12, oy: GIANT_HEIGHT * 0.45, oz: 7 * GIANT_SCALE * 0.12 },
    { ox: 0, oy: GIANT_HEIGHT * 0.62, oz: 5.5 * GIANT_SCALE * 0.12 },
    { ox: -12 * GIANT_SCALE * 0.12, oy: GIANT_HEIGHT * 0.28, oz: 1 * GIANT_SCALE * 0.12 },
  ];
  giantDripParticles = dripPoints;
}

function spawnDripDrop(dp) {
  const drop = new THREE.Mesh(_giantGeos.drip, _giantMats.vein.clone());
  drop.material.opacity = 0.7;
  const wx = giantPos.x + dp.ox;
  const wy = giantPos.y + dp.oy;
  const wz = giantPos.z + dp.oz;
  drop.position.set(wx, wy, wz);
  drop.frustumCulled = false;
  state.scene.add(drop);
  state.bloodParticles.push({
    mesh: drop,
    vx: (Math.random() - 0.5) * 2,
    vy: -1,
    vz: (Math.random() - 0.5) * 2,
    age: 0
  });
}

function launchSpitProjectile() {
  if (!giantGroup || !giantAlive || !state.player.alive) return;

  const playerPos = state.controls.getObject().position;
  const mouthPos = new THREE.Vector3(giantPos.x, giantPos.y + GIANT_HEIGHT * 0.66, giantPos.z);

  const dir = new THREE.Vector3().subVectors(playerPos, mouthPos);
  const dist = dir.length();
  dir.normalize();
  dir.x += (Math.random() - 0.5) * 0.15;
  dir.z += (Math.random() - 0.5) * 0.15;
  dir.normalize();

  const flightTime = Math.max(2.5, dist / 180);
  const launchSpeed = dist / flightTime;
  const gravity = 280;
  const launchVY = (0.5 * gravity * flightTime * flightTime + playerPos.y - mouthPos.y) / flightTime;

  const spit = new THREE.Mesh(_giantGeos.spit, _giantMats.spit);
  spit.position.copy(mouthPos);
  spit.frustumCulled = false;
  state.scene.add(spit);

  const trails = [];
  for (let i = 0; i < 3; i++) {
    const trail = new THREE.Mesh(_giantGeos.spitTrail, _giantMats.spit.clone());
    trail.material.opacity = 0.5 - i * 0.12;
    trail.frustumCulled = false;
    state.scene.add(trail);
    trails.push(trail);
  }

  spitProjectiles.push({
    mesh: spit, trails, pos: mouthPos.clone(),
    vx: dir.x * launchSpeed, vy: launchVY, vz: dir.z * launchSpeed,
    gravity, age: 0, maxAge: flightTime + 2, active: true
  });
}

function createSpitImpact(x, y, z) {
  const splatGeo = new THREE.CircleGeometry(25, 16);
  splatGeo.rotateX(-Math.PI / 2);
  const splatMat = new THREE.MeshBasicMaterial({ color: 0x66aa22, transparent: true, opacity: 0.7 });
  const splat = new THREE.Mesh(splatGeo, splatMat);
  splat.position.set(x, y + 0.3, z);
  splat.frustumCulled = false;
  state.scene.add(splat);

  for (let i = 0; i < 6; i++) {
    const dropGeo = new THREE.SphereGeometry(1.5, 6, 6);
    const dropMat = new THREE.MeshBasicMaterial({ color: 0x88cc44, transparent: true, opacity: 0.8 });
    const drop = new THREE.Mesh(dropGeo, dropMat);
    drop.position.set(x, y + 1, z);
    drop.frustumCulled = false;
    state.scene.add(drop);
    const angle = (i / 6) * Math.PI * 2;
    const speed = 10 + Math.random() * 15;
    state.bloodParticles.push({
      mesh: drop,
      vx: Math.cos(angle) * speed,
      vy: 3 + Math.random() * 5,
      vz: Math.sin(angle) * speed,
      age: 0
    });
  }

  let fade = 0;
  const interval = setInterval(() => {
    fade += 0.02;
    splatMat.opacity = 0.7 * (1 - fade);
    if (fade >= 1) { clearInterval(interval); state.scene.remove(splat); }
  }, 80);
}

export function updateGiant(delta) {
  if (!giantGroup) return;

  const now = Date.now();
  const playerPos = state.controls.getObject().position;

  // === DEATH ANIMATION ===
  if (giantDeathPhase >= 1 && giantDeathPhase < 2) {
    giantDyingTimer += delta;
    // Slowly tilt and fall over ~4 seconds
    const fallProgress = Math.min(giantDyingTimer / 4, 1);
    giantGroup.rotation.x = fallProgress * Math.PI * 0.45;
    giantGroup.position.y = giantPos.y - fallProgress * GIANT_HEIGHT * 0.3;

    // Screen shake during fall
    state.camera.rotation.z += (Math.random() - 0.5) * 0.01 * (1 - fallProgress);

    // Fade out health bar
    if (giantHealthBarGroup) giantHealthBarGroup.visible = false;

    // Red flash on body
    if (giantDyingTimer < 2 && Math.sin(giantDyingTimer * 10) > 0) {
      giantGroup.traverse(child => {
        if (child.isMesh && child.material && !child.userData._origColor) {
          child.userData._origColor = child.material.color ? child.material.color.getHex() : 0;
        }
      });
    }

    if (fallProgress >= 1) {
      giantDeathPhase = 2;
      // Remove after 8 seconds
      setTimeout(() => {
        if (giantGroup) {
          state.scene.remove(giantGroup);
          giantGroup = null;
        }
      }, 8000);
    }
    return;
  }
  if (giantDeathPhase >= 2) return;

  // === ALIVE BEHAVIOR ===

  // Damage flash (red tint when hit)
  if (giantDamageFlashTimer > 0) {
    giantDamageFlashTimer -= delta;
    if (giantDamageFlashTimer <= 0) {
      // Restore original materials
      giantGroup.traverse(child => {
        if (child.isMesh && child.userData._origMat) {
          child.material = child.userData._origMat;
          delete child.userData._origMat;
        }
      });
    }
  }

  // Giant always faces player (slowly)
  const dxP = playerPos.x - giantPos.x;
  const dzP = playerPos.z - giantPos.z;
  const targetAngle = Math.atan2(dxP, dzP);
  let currentAngle = giantGroup.rotation.y;
  let angleDiff = targetAngle - currentAngle;
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
  giantGroup.rotation.y += angleDiff * 0.5 * delta;

  // Body sway
  giantSwayPhase += delta * 0.8;
  giantGroup.rotation.z = Math.sin(giantSwayPhase) * 0.01;

  // Walk toward safe zone
  const zoneX = state.zone.x || 0;
  const zoneZ = state.zone.z || 0;
  const toZone = new THREE.Vector3(zoneX - giantPos.x, 0, zoneZ - giantPos.z);
  const distToZone = toZone.length();

  if (distToZone > 20) {
    toZone.normalize();
    const walkSpeed = 20 + Math.max(0, 15 - state.zone.radius / 200);
    giantPos.x += toZone.x * walkSpeed * delta;
    giantPos.z += toZone.z * walkSpeed * delta;
    giantPos.y = getTerrainHeight(giantPos.x, giantPos.z);
    giantGroup.position.copy(giantPos);

    const distToPlayer = Math.sqrt(dxP * dxP + dzP * dzP);
    if (distToPlayer < 1000 && Math.sin(now * 0.004) > 0.9) {
      state.camera.rotation.z += (Math.random() - 0.5) * 0.008;
    }
  }

  // Update health bar
  if (giantHealthBarFill) {
    const ratio = giantHealth / GIANT_MAX_HP;
    giantHealthBarFill.scale.x = Math.max(0.01, ratio);
    giantHealthBarFill.position.x = -(1 - ratio) * 29;
    // Health bar always faces camera
    if (giantHealthBarGroup) {
      giantHealthBarGroup.lookAt(state.camera.position);
    }
    // Color: green → yellow → red
    if (ratio > 0.5) {
      giantHealthBarFill.material.color.setHex(0x44ff44);
    } else if (ratio > 0.25) {
      giantHealthBarFill.material.color.setHex(0xffaa00);
    } else {
      giantHealthBarFill.material.color.setHex(0xff2200);
    }
  }

  // Spit attack timer
  giantNextSpit -= delta;
  if (giantNextSpit <= 0) {
    giantNextSpit = 6 + Math.random() * 10;
    const distToPlayer = Math.sqrt(dxP * dxP + dzP * dzP);
    if (distToPlayer < 2000 && state.player.alive) {
      launchSpitProjectile();
    }
  }

  // Drip ooze particles (occasionally)
  if (giantDripParticles.length > 0 && Math.random() < delta * 2) {
    const dp = giantDripParticles[Math.floor(Math.random() * giantDripParticles.length)];
    spawnDripDrop(dp);
  }

  // Update spit projectiles
  for (let i = spitProjectiles.length - 1; i >= 0; i--) {
    const proj = spitProjectiles[i];
    if (!proj.active) continue;

    proj.age += delta;
    proj.vy -= proj.gravity * delta;
    proj.pos.x += proj.vx * delta;
    proj.pos.y += proj.vy * delta;
    proj.pos.z += proj.vz * delta;

    proj.mesh.position.copy(proj.pos);
    proj.mesh.scale.setScalar(1 + Math.sin(proj.age * 15) * 0.2);

    for (let t = 0; t < proj.trails.length; t++) {
      const trailOffset = (t + 1) * 0.06;
      proj.trails[t].position.set(
        proj.pos.x - proj.vx * trailOffset,
        proj.pos.y - proj.vy * trailOffset,
        proj.pos.z - proj.vz * trailOffset
      );
    }

    const groundY = getTerrainHeight(proj.pos.x, proj.pos.z);

    const dpx = proj.pos.x - playerPos.x;
    const dpy = proj.pos.y - playerPos.y;
    const dpz = proj.pos.z - playerPos.z;
    const distToPlayerSq = dpx * dpx + dpy * dpy + dpz * dpz;

    if (distToPlayerSq < 400) {
      proj.active = false;
      state.scene.remove(proj.mesh);
      proj.trails.forEach(t => state.scene.remove(t));
      spitProjectiles.splice(i, 1);
      playerHit(3, giantPos);
      const insult = SPIT_INSULTS[Math.floor(Math.random() * SPIT_INSULTS.length)];
      showNotice(insult, "#88cc44");
      createSpitImpact(proj.pos.x, groundY, proj.pos.z);
      playSound('shotgun', { x: proj.pos.x, y: groundY, z: proj.pos.z });
      continue;
    }

    if (proj.pos.y <= groundY || proj.age > proj.maxAge) {
      proj.active = false;
      state.scene.remove(proj.mesh);
      proj.trails.forEach(t => state.scene.remove(t));
      spitProjectiles.splice(i, 1);
      if (proj.pos.y <= groundY + 5) {
        createSpitImpact(proj.pos.x, groundY, proj.pos.z);
        playSound('shotgun', { x: proj.pos.x, y: groundY, z: proj.pos.z });
      }
    }
  }
}
