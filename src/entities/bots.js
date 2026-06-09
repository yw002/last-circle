// Bot AI subsystem - Performance optimized with shared resources

import * as THREE from 'three';
import { state } from '../state.js';
import { MAP_SIZE, BOT_COUNT, difficulties, CURRENT_DIFFICULTY, weapons, equipments } from '../config.js';
import { getTerrainHeight, getGroundHeight } from '../world/terrain.js';
import { getHousePlayerIsInside } from './house.js';
import { calcDamage } from './damage.js';
import { playSound } from '../systems/audio.js';
import { spawnBlood, spawnWorldMuzzleFlash } from '../systems/particles.js';
import { playerHit } from './player.js';
import { addKillFeed } from '../ui/notices.js';
import { createTracerFromPosition } from '../systems/bullets.js';
import { checkEntityCollision, resolveEntityCollisions } from '../systems/collision.js';
import { getNearbyBots, getNearbyColliders, getNearbyDoors } from '../systems/spatial.js';
import { updateUI } from '../ui/hud.js';
import { showNotice } from '../ui/notices.js';

// ========== SHARED RESOURCES (created once) ==========
const skinColors = [0xffdfc4, 0xd0a37e, 0x8d5524, 0xc68642, 0xe0ac69, 0x4a2a18, 0xf1c27d, 0x3d2314];
const shirtColors = [0x95a5a6, 0x34495e, 0x27ae60, 0x8e44ad, 0xc0392b, 0xd35400, 0xf39c12, 0x2c3e50, 0x111111, 0xecf0f1, 0x1abc9c, 0xf1c40f];
const pantsColors = [0x2c3e50, 0xbdc3c7, 0x34495e, 0x7f8c8d, 0x222222, 0x8b4513, 0x2e4053, 0x17202a];
const _botMuzzleDir = new THREE.Vector3();

// ========== MAXIMUM PRECISION SHARED GEOMETRIES ==========
// Using LatheGeometry for organic shapes, 48-64 segments for absolute smoothness

const SEG = 48; // Maximum segment count for ultra-smooth curves
const SEG2 = 64; // For high-visibility parts

// Torso - LatheGeometry for organic human torso with muscle definition
const torsoProfile = [];
for (let i = 0; i <= 48; i++) {
  const t = i / 48;
  // Pectorals at top, waist narrower, hips wider
  let r;
  if (t < 0.3) r = 1.6 + Math.sin(t * Math.PI / 0.3) * 0.3; // Chest
  else if (t < 0.6) r = 1.9 - (t - 0.3) * 2; // Waist
  else r = 1.3 + Math.sin((t - 0.6) * Math.PI / 0.4) * 0.4; // Hips
  torsoProfile.push(new THREE.Vector2(r, t * 4 - 2));
}

// Head - LatheGeometry with detailed skull shape
const headProfile = [];
for (let i = 0; i <= 48; i++) {
  const t = i / 48;
  let r;
  if (t < 0.15) r = t * 3.5; // Chin
  else if (t < 0.4) r = 0.5 + Math.sin((t - 0.15) * Math.PI / 0.25) * 0.7; // Jaw to cheek
  else if (t < 0.65) r = 1.2; // Cheeks
  else if (t < 0.85) r = 1.2 - (t - 0.65) * 1.5; // Forehead
  else r = 0.9 * (1 - (t - 0.85) * 6.67); // Top of head
  headProfile.push(new THREE.Vector2(Math.max(0, r), t * 2.4 - 1.2));
}

// Arm profile with muscle definition
const armProfile = [];
for (let i = 0; i <= 24; i++) {
  const t = i / 24;
  // Bicep bulge, forearm taper
  let r;
  if (t < 0.4) r = 0.35 + Math.sin(t * Math.PI / 0.4) * 0.12; // Bicep
  else if (t < 0.7) r = 0.47 - (t - 0.4) * 0.3; // Elbow area
  else r = 0.35 + Math.sin((t - 0.7) * Math.PI / 0.3) * 0.08; // Forearm
  armProfile.push(new THREE.Vector2(r, t * 2 - 1));
}

// Leg profile with thigh and calf muscles
const legProfile = [];
for (let i = 0; i <= 24; i++) {
  const t = i / 24;
  let r;
  if (t < 0.3) r = 0.5 + Math.sin(t * Math.PI / 0.3) * 0.15; // Thigh
  else if (t < 0.5) r = 0.65 - (t - 0.3) * 1.5; // Knee area
  else if (t < 0.8) r = 0.35 + Math.sin((t - 0.5) * Math.PI / 0.3) * 0.12; // Calf
  else r = 0.35 - (t - 0.8) * 0.5; // Ankle
  legProfile.push(new THREE.Vector2(Math.max(0.2, r), t * 2.5 - 1.25));
}

// Hand profile with palm shape
const handProfile = [];
for (let i = 0; i <= 16; i++) {
  const t = i / 16;
  let r;
  if (t < 0.3) r = 0.2 + t * 0.3; // Wrist to palm
  else if (t < 0.7) r = 0.29; // Palm
  else r = 0.29 * (1 - (t - 0.7) * 3.33); // Fingers taper
  handProfile.push(new THREE.Vector2(Math.max(0, r), t * 0.8 - 0.4));
}

// Boot profile with proper shoe shape
const bootProfile = [];
for (let i = 0; i <= 16; i++) {
  const t = i / 16;
  let r;
  if (t < 0.2) r = 0.3 + t * 1.5; // Toe box
  else if (t < 0.5) r = 0.6; // Mid foot
  else if (t < 0.8) r = 0.6 - (t - 0.5) * 1.0; // Ankle
  else r = 0.3 - (t - 0.8) * 0.5; // Top
  bootProfile.push(new THREE.Vector2(Math.max(0.15, r), t * 1.2 - 0.6));
}

// Finger profile with joints
const fingerProfile = [];
for (let i = 0; i <= 12; i++) {
  const t = i / 12;
  // Knuckle bulges
  let r = 0.05;
  if (Math.abs(t - 0.25) < 0.1) r = 0.065; // Knuckle 1
  if (Math.abs(t - 0.5) < 0.1) r = 0.06;  // Knuckle 2
  if (Math.abs(t - 0.75) < 0.1) r = 0.055; // Knuckle 3
  fingerProfile.push(new THREE.Vector2(r, t * 0.4));
}

const sharedGeos = {
  // Torso - organic LatheGeometry with muscle definition
  torsoLower: new THREE.LatheGeometry(torsoProfile, SEG),
  torsoUpper: new THREE.LatheGeometry(torsoProfile, SEG),

  // Chest muscle definition
  pectoral: new THREE.SphereGeometry(0.8, SEG / 2, SEG / 2),
  abdominal: new THREE.BoxGeometry(1.2, 0.15, 0.8),

  // Head - organic LatheGeometry with proper skull shape
  head: new THREE.LatheGeometry(headProfile, SEG),
  hair: new THREE.SphereGeometry(1.25, SEG, SEG / 2),

  // Neck - smooth with tendons
  neck: new THREE.CylinderGeometry(0.4, 0.5, 0.6, SEG),
  neckTendon: new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8),

  // Facial features - ultra detailed
  eye: new THREE.SphereGeometry(0.22, SEG / 2, SEG / 2),
  pupil: new THREE.SphereGeometry(0.12, SEG / 2, SEG / 2),
  iris: new THREE.SphereGeometry(0.16, SEG / 2, SEG / 2),
  eyelid: new THREE.SphereGeometry(0.24, SEG / 2, SEG / 2, 0, Math.PI * 2, 0, Math.PI / 2),
  nose: new THREE.LatheGeometry([
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.1, 0.02),
    new THREE.Vector2(0.14, 0.08),
    new THREE.Vector2(0.15, 0.15),
    new THREE.Vector2(0.12, 0.22),
    new THREE.Vector2(0.08, 0.28),
    new THREE.Vector2(0, 0.32)
  ], SEG / 2),
  nostril: new THREE.SphereGeometry(0.06, 8, 8),
  mouth: new THREE.SphereGeometry(0.2, SEG / 2, SEG / 2),
  lip: new THREE.TorusGeometry(0.18, 0.03, 12, SEG / 2),
  lipLower: new THREE.TorusGeometry(0.16, 0.025, 12, SEG / 2),
  ear: new THREE.LatheGeometry([
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.12, 0.05),
    new THREE.Vector2(0.18, 0.15),
    new THREE.Vector2(0.2, 0.3),
    new THREE.Vector2(0.15, 0.45),
    new THREE.Vector2(0.08, 0.55),
    new THREE.Vector2(0, 0.6)
  ], SEG / 2),
  earCanal: new THREE.SphereGeometry(0.08, 8, 8),
  brow: new THREE.TorusGeometry(0.3, 0.04, 12, SEG / 2, Math.PI),
  cheek: new THREE.SphereGeometry(0.3, SEG / 2, SEG / 2),
  chin: new THREE.SphereGeometry(0.2, SEG / 2, SEG / 2),
  jaw: new THREE.LatheGeometry([
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.8, 0.1),
    new THREE.Vector2(1.0, 0.3),
    new THREE.Vector2(0.9, 0.5),
    new THREE.Vector2(0.6, 0.6)
  ], SEG / 2),

  // Shoulders - smooth spheres with deltoid definition
  shoulder: new THREE.SphereGeometry(0.5, SEG / 2, SEG / 2),
  deltoid: new THREE.SphereGeometry(0.45, SEG / 2, SEG / 2),

  // Belt - detailed
  belt: new THREE.TorusGeometry(1.5, 0.15, 16, SEG),
  beltBuckle: new THREE.BoxGeometry(0.4, 0.3, 0.15),
  beltLoop: new THREE.TorusGeometry(0.15, 0.03, 8, 16),

  // Arms - organic LatheGeometry with muscle definition
  armUpper: new THREE.LatheGeometry(armProfile, SEG / 2),
  elbow: new THREE.SphereGeometry(0.35, SEG / 2, SEG / 2),
  armLower: new THREE.LatheGeometry(armProfile, SEG / 2),
  wrist: new THREE.SphereGeometry(0.25, SEG / 2, SEG / 2),
  bicep: new THREE.SphereGeometry(0.4, SEG / 2, SEG / 2),
  forearm: new THREE.SphereGeometry(0.35, SEG / 2, SEG / 2),

  // Hands - detailed with individual fingers and joints
  hand: new THREE.LatheGeometry(handProfile, SEG / 2),
  finger: new THREE.LatheGeometry(fingerProfile, 12),
  thumb: new THREE.LatheGeometry(fingerProfile, 12),
  fingernail: new THREE.SphereGeometry(0.04, 12, 12),
  knuckle: new THREE.SphereGeometry(0.06, 8, 8),

  // Legs - organic LatheGeometry with muscle definition
  legUpper: new THREE.LatheGeometry(legProfile, SEG / 2),
  knee: new THREE.SphereGeometry(0.4, SEG / 2, SEG / 2),
  legLower: new THREE.LatheGeometry(legProfile, SEG / 2),
  ankle: new THREE.SphereGeometry(0.3, SEG / 2, SEG / 2),
  thigh: new THREE.SphereGeometry(0.55, SEG / 2, SEG / 2),
  calf: new THREE.SphereGeometry(0.45, SEG / 2, SEG / 2),

  // Boots - detailed with sole and laces
  boot: new THREE.LatheGeometry(bootProfile, SEG / 2),
  bootSole: new THREE.BoxGeometry(0.7, 0.15, 1.2),
  bootLace: new THREE.CylinderGeometry(0.02, 0.02, 0.8, 6),
  bootTongue: new THREE.BoxGeometry(0.3, 0.05, 0.6),
  bootHeel: new THREE.CylinderGeometry(0.2, 0.25, 0.3, SEG / 2),

  // Gun - ultra detailed with all parts
  gunBody: new THREE.BoxGeometry(0.15, 0.15, 1.5),
  gunBarrel: new THREE.CylinderGeometry(0.04, 0.05, 0.8, SEG / 2),
  gunBarrelInner: new THREE.CylinderGeometry(0.03, 0.03, 0.85, SEG / 2),
  gunStock: new THREE.BoxGeometry(0.12, 0.15, 0.6),
  gunMag: new THREE.BoxGeometry(0.1, 0.3, 0.15),
  gunGrip: new THREE.BoxGeometry(0.1, 0.2, 0.08),
  gunSight: new THREE.BoxGeometry(0.04, 0.06, 0.04),
  gunTrigger: new THREE.BoxGeometry(0.02, 0.06, 0.01),
  gunTriggerGuard: new THREE.TorusGeometry(0.04, 0.01, 12, 16, Math.PI),
  gunBolt: new THREE.CylinderGeometry(0.02, 0.02, 0.15, 12),
  gunRail: new THREE.BoxGeometry(0.06, 0.015, 0.5),
  gunEjectionPort: new THREE.BoxGeometry(0.06, 0.02, 0.12),
  gunChargingHandle: new THREE.BoxGeometry(0.1, 0.03, 0.03),
  gunFlashHider: new THREE.CylinderGeometry(0.03, 0.025, 0.1, SEG / 2),
  gunMuzzleBrake: new THREE.CylinderGeometry(0.05, 0.04, 0.15, SEG / 2),

  // Pack - rounded edges with straps
  pack: new THREE.BoxGeometry(1.5, 2.0, 0.8),
  packStrap: new THREE.BoxGeometry(0.15, 0.05, 2.0),
  packBuckle: new THREE.BoxGeometry(0.2, 0.15, 0.05),
  packPocket: new THREE.BoxGeometry(0.8, 0.6, 0.2),

  // Parachute - smooth
  parachute: new THREE.SphereGeometry(10, SEG / 2, SEG / 4, 0, Math.PI * 2, 0, Math.PI / 2),
  parachuteLine: new THREE.CylinderGeometry(0.02, 0.02, 12, 6),

  // Tactical gear
  vestFront: new THREE.BoxGeometry(2.6, 2.8, 0.4),
  vestBack: new THREE.BoxGeometry(2.4, 2.6, 0.3),
  vestShoulder: new THREE.BoxGeometry(0.6, 0.3, 1.2),
  ammoPouch: new THREE.BoxGeometry(0.5, 0.6, 0.35),
  magPouch: new THREE.BoxGeometry(0.3, 0.7, 0.25),
  kneePad: new THREE.SphereGeometry(0.35, SEG / 4, SEG / 4),
  elbowPad: new THREE.SphereGeometry(0.3, SEG / 4, SEG / 4),
  holster: new THREE.CylinderGeometry(0.2, 0.15, 0.8, 8),
  strapGeo: new THREE.BoxGeometry(0.2, 0.05, 2.5),
  radioBox: new THREE.BoxGeometry(0.3, 0.6, 0.15),
  antennaGeo: new THREE.CylinderGeometry(0.015, 0.015, 1.5, 6)
};

// Shared materials - created once
const sharedMats = {
  dark: new THREE.MeshLambertMaterial({ color: 0x222222 }),
  boot: new THREE.MeshLambertMaterial({ color: 0x111111 }),
  belt: new THREE.MeshLambertMaterial({ color: 0x333333 }),
  eyeWhite: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  pupil: new THREE.MeshBasicMaterial({ color: 0x222222 }),
  mouth: new THREE.MeshLambertMaterial({ color: 0xcc8888 }),
  hair: new THREE.MeshLambertMaterial({ color: 0x222222 }),
  parachute: new THREE.MeshLambertMaterial({ color: 0xe74c3c, side: THREE.DoubleSide }),
  laser: new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.6 }),
  // Tactical gear materials
  vest: new THREE.MeshPhongMaterial({ color: 0x2a3a2a, shininess: 15 }),
  vestDark: new THREE.MeshPhongMaterial({ color: 0x1a2a1a, shininess: 10 }),
  pouch: new THREE.MeshLambertMaterial({ color: 0x3a4a3a }),
  kneePad: new THREE.MeshPhongMaterial({ color: 0x1a1a1a, shininess: 30 }),
  gunMetal: new THREE.MeshPhongMaterial({ color: 0x2a2a2a, shininess: 60, specular: 0x444444 }),
  strap: new THREE.MeshLambertMaterial({ color: 0x4a4a3a }),
  radio: new THREE.MeshLambertMaterial({ color: 0x333333 }),
  antenna: new THREE.MeshLambertMaterial({ color: 0x555555 })
};

// Reusable Vector3 for calculations
const _tempVec3 = new THREE.Vector3();
const _botHeadPos = new THREE.Vector3();
const _botDirection = new THREE.Vector3();
const _botGunPos = new THREE.Vector3();
const _missPoint = new THREE.Vector3();
const _bloodOffset = new THREE.Vector3(0, 4, 0);
const _upNormal = new THREE.Vector3(0, 1, 0);
const _botRaycaster = new THREE.Raycaster();

export function initBots() {
  for (let i = 0; i < BOT_COUNT; i++) {
    let x = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let z = (Math.random() - 0.5) * MAP_SIZE * 0.8;
    let y = 300 + Math.random() * 200;

    const botGroup = new THREE.Group();

    // Get random colors
    let skinC = skinColors[Math.floor(Math.random() * skinColors.length)];
    let shirtC = shirtColors[Math.floor(Math.random() * shirtColors.length)];
    let pantsC = pantsColors[Math.floor(Math.random() * pantsColors.length)];

    // Create per-bot color materials (only color differs)
    const bodyMat = new THREE.MeshLambertMaterial({ color: shirtC });
    const headMat = new THREE.MeshLambertMaterial({ color: skinC });
    const limbMat = new THREE.MeshLambertMaterial({ color: pantsC });

    // Build bot using shared geometries
    const torsoLower = new THREE.Mesh(sharedGeos.torsoLower, bodyMat);
    torsoLower.scale.set(1, 0.8, 0.7);
    torsoLower.position.y = 4.0;

    const torsoUpper = new THREE.Mesh(sharedGeos.torsoUpper, bodyMat);
    torsoUpper.scale.set(1, 1.0, 0.7);
    torsoUpper.position.y = 5.5;

    const head = new THREE.Mesh(sharedGeos.head, headMat);
    head.position.y = 7.5;

    const hair = new THREE.Mesh(sharedGeos.hair, sharedMats.hair);
    hair.position.y = 7.6;

    const neck = new THREE.Mesh(sharedGeos.neck, headMat);
    neck.position.y = 6.8;

    const eyeL = new THREE.Mesh(sharedGeos.eye, sharedMats.eyeWhite);
    eyeL.position.set(-0.45, 7.7, 0.9);
    const eyeR = new THREE.Mesh(sharedGeos.eye, sharedMats.eyeWhite);
    eyeR.position.set(0.45, 7.7, 0.9);
    const pupilL = new THREE.Mesh(sharedGeos.pupil, sharedMats.pupil);
    pupilL.position.set(-0.45, 7.7, 1.05);
    const pupilR = new THREE.Mesh(sharedGeos.pupil, sharedMats.pupil);
    pupilR.position.set(0.45, 7.7, 1.05);

    const nose = new THREE.Mesh(sharedGeos.nose, headMat);
    nose.position.set(0, 7.4, 1.1);

    const shoulderL = new THREE.Mesh(sharedGeos.shoulder, bodyMat);
    shoulderL.position.set(-1.8, 6.0, 0);
    const shoulderR = new THREE.Mesh(sharedGeos.shoulder, bodyMat);
    shoulderR.position.set(1.8, 6.0, 0);

    const belt = new THREE.Mesh(sharedGeos.belt, sharedMats.belt);
    belt.position.y = 3.5;
    belt.rotation.x = Math.PI / 2;

    // Ears
    const earL = new THREE.Mesh(sharedGeos.ear, headMat);
    earL.position.set(-1.1, 7.6, 0);
    const earR = new THREE.Mesh(sharedGeos.ear, headMat);
    earR.position.set(1.1, 7.6, 0);

    // Brow ridge
    const browL = new THREE.Mesh(sharedGeos.brow, headMat);
    browL.position.set(-0.35, 8.0, 0.95);
    browL.rotation.z = 0.2;
    const browR = new THREE.Mesh(sharedGeos.brow, headMat);
    browR.position.set(0.35, 8.0, 0.95);
    browR.rotation.z = -0.2;

    // Belt buckle
    const beltBuckle = new THREE.Mesh(sharedGeos.beltBuckle, sharedMats.dark);
    beltBuckle.position.set(0, 3.5, 1.5);

    // Arms with elbows and fingers
    const armUpperL = new THREE.Mesh(sharedGeos.armUpper, bodyMat);
    armUpperL.position.set(-2.2, 5.5, 0);
    armUpperL.rotation.z = 0.2;
    const elbowL = new THREE.Mesh(sharedGeos.elbow, headMat);
    elbowL.position.set(-2.5, 4.5, 0.15);
    const armLowerL = new THREE.Mesh(sharedGeos.armLower, bodyMat);
    armLowerL.position.set(-2.8, 4.0, 0.3);
    const handL = new THREE.Mesh(sharedGeos.hand, headMat);
    handL.position.set(-3.0, 3.2, 0.5);
    // Fingers on left hand
    const fingerL1 = new THREE.Mesh(sharedGeos.finger, headMat);
    fingerL1.position.set(-3.15, 2.9, 0.6);
    fingerL1.rotation.x = -0.3;
    const fingerL2 = new THREE.Mesh(sharedGeos.finger, headMat);
    fingerL2.position.set(-3.0, 2.9, 0.65);
    fingerL2.rotation.x = -0.3;
    const thumbL = new THREE.Mesh(sharedGeos.thumb, headMat);
    thumbL.position.set(-2.8, 3.0, 0.7);
    thumbL.rotation.z = 0.5;

    const armUpperR = new THREE.Mesh(sharedGeos.armUpper, bodyMat);
    armUpperR.position.set(2.2, 5.5, 0);
    armUpperR.rotation.z = -0.2;
    armUpperR.rotation.x = -0.5;
    const elbowR = new THREE.Mesh(sharedGeos.elbow, headMat);
    elbowR.position.set(2.6, 4.5, 0.4);
    const armLowerR = new THREE.Mesh(sharedGeos.armLower, bodyMat);
    armLowerR.position.set(2.8, 4.0, 0.8);
    const handR = new THREE.Mesh(sharedGeos.hand, headMat);
    handR.position.set(3.0, 3.2, 1.0);
    // Fingers on right hand (holding gun)
    const fingerR1 = new THREE.Mesh(sharedGeos.finger, headMat);
    fingerR1.position.set(3.15, 2.9, 1.1);
    fingerR1.rotation.x = -0.5;
    const fingerR2 = new THREE.Mesh(sharedGeos.finger, headMat);
    fingerR2.position.set(3.0, 2.9, 1.15);
    fingerR2.rotation.x = -0.5;
    const thumbR = new THREE.Mesh(sharedGeos.thumb, headMat);
    thumbR.position.set(2.8, 3.0, 1.2);
    thumbR.rotation.z = -0.5;

    // Legs with knees and boot soles
    const legUpperL = new THREE.Mesh(sharedGeos.legUpper, limbMat);
    legUpperL.position.set(-0.8, 2.5, 0);
    const kneeL = new THREE.Mesh(sharedGeos.knee, limbMat);
    kneeL.position.set(-0.8, 1.6, 0.1);
    const legLowerL = new THREE.Mesh(sharedGeos.legLower, limbMat);
    legLowerL.position.set(-0.8, 0.8, 0.2);
    const bootL = new THREE.Mesh(sharedGeos.boot, sharedMats.boot);
    bootL.position.set(-0.8, 0.2, 0.3);
    const bootSoleL = new THREE.Mesh(sharedGeos.bootSole, sharedMats.dark);
    bootSoleL.position.set(-0.8, 0.05, 0.35);

    const legUpperR = new THREE.Mesh(sharedGeos.legUpper, limbMat);
    legUpperR.position.set(0.8, 2.5, 0);
    const kneeR = new THREE.Mesh(sharedGeos.knee, limbMat);
    kneeR.position.set(0.8, 1.6, 0.1);
    const legLowerR = new THREE.Mesh(sharedGeos.legLower, limbMat);
    legLowerR.position.set(0.8, 0.8, 0.2);
    const bootR = new THREE.Mesh(sharedGeos.boot, sharedMats.boot);
    bootR.position.set(0.8, 0.2, 0.3);
    const bootSoleR = new THREE.Mesh(sharedGeos.bootSole, sharedMats.dark);
    bootSoleR.position.set(0.8, 0.05, 0.35);

    // Backpack
    let pack = null;
    if (Math.random() > 0.3) {
      pack = new THREE.Mesh(sharedGeos.pack, sharedMats.dark);
      pack.position.set(0, 4.5, -1.5);
      botGroup.add(pack);
    }

    // ========== TACTICAL GEAR ==========
    // Plate carrier / tactical vest
    let hasVest = Math.random() > 0.25;
    if (hasVest) {
      const vestFront = new THREE.Mesh(sharedGeos.vestFront, sharedMats.vest);
      vestFront.position.set(0, 5.2, 0.9);
      const vestBack = new THREE.Mesh(sharedGeos.vestBack, sharedMats.vestDark);
      vestBack.position.set(0, 5.0, -1.0);
      const vestShoulderL = new THREE.Mesh(sharedGeos.vestShoulder, sharedMats.vest);
      vestShoulderL.position.set(-1.2, 6.2, 0);
      const vestShoulderR = new THREE.Mesh(sharedGeos.vestShoulder, sharedMats.vest);
      vestShoulderR.position.set(1.2, 6.2, 0);
      botGroup.add(vestFront, vestBack, vestShoulderL, vestShoulderR);

      // Ammo pouches on vest front
      for (let p = 0; p < 3; p++) {
        const pouch = new THREE.Mesh(sharedGeos.magPouch, sharedMats.pouch);
        pouch.position.set(-0.6 + p * 0.6, 4.5, 1.15);
        botGroup.add(pouch);
      }
    }

    // Belt pouches
    const pouchCount = 1 + Math.floor(Math.random() * 3);
    for (let p = 0; p < pouchCount; p++) {
      const pouch = new THREE.Mesh(sharedGeos.ammoPouch, sharedMats.pouch);
      const angle = (p / pouchCount) * Math.PI * 1.2 - 0.3;
      pouch.position.set(Math.sin(angle) * 1.5, 3.5, Math.cos(angle) * 1.5);
      botGroup.add(pouch);
    }

    // Knee pads
    if (Math.random() > 0.3) {
      const kneePadL = new THREE.Mesh(sharedGeos.kneePad, sharedMats.kneePad);
      kneePadL.position.set(-0.8, 1.6, 0.45);
      kneePadL.scale.set(1, 0.6, 0.8);
      const kneePadR = new THREE.Mesh(sharedGeos.kneePad, sharedMats.kneePad);
      kneePadR.position.set(0.8, 1.6, 0.45);
      kneePadR.scale.set(1, 0.6, 0.8);
      botGroup.add(kneePadL, kneePadR);
    }

    // Elbow pads
    if (Math.random() > 0.5) {
      const elbowPadL = new THREE.Mesh(sharedGeos.elbowPad, sharedMats.kneePad);
      elbowPadL.position.set(-2.5, 4.5, 0.4);
      const elbowPadR = new THREE.Mesh(sharedGeos.elbowPad, sharedMats.kneePad);
      elbowPadR.position.set(2.6, 4.5, 0.65);
      botGroup.add(elbowPadL, elbowPadR);
    }

    // Gun sling strap
    const strap = new THREE.Mesh(sharedGeos.strapGeo, sharedMats.strap);
    strap.position.set(2.0, 4.5, 1.0);
    strap.rotation.z = 0.8;
    botGroup.add(strap);

    // Radio on backpack/back
    if (Math.random() > 0.5) {
      const radio = new THREE.Mesh(sharedGeos.radioBox, sharedMats.radio);
      radio.position.set(-1.0, 5.5, -1.2);
      const antenna = new THREE.Mesh(sharedGeos.antennaGeo, sharedMats.antenna);
      antenna.position.set(-1.0, 6.5, -1.2);
      botGroup.add(radio, antenna);
    }

    // Pistol holster on thigh
    if (Math.random() > 0.4) {
      const holster = new THREE.Mesh(sharedGeos.holster, sharedMats.dark);
      holster.position.set(1.2, 2.2, 0.3);
      botGroup.add(holster);
    }

    // Detailed gun (upgraded metallic material)
    const gunBody = new THREE.Mesh(sharedGeos.gunBody, sharedMats.gunMetal);
    gunBody.position.set(3.0, 3.5, 1.5);
    const gunBarrel = new THREE.Mesh(sharedGeos.gunBarrel, sharedMats.gunMetal);
    gunBarrel.rotation.x = Math.PI / 2;
    gunBarrel.position.set(3.0, 3.6, 0.8);
    const gunStock = new THREE.Mesh(sharedGeos.gunStock, sharedMats.dark);
    gunStock.position.set(3.0, 3.4, 2.2);
    const gunMag = new THREE.Mesh(sharedGeos.gunMag, sharedMats.gunMetal);
    gunMag.position.set(3.0, 3.0, 1.3);
    const gunGrip = new THREE.Mesh(sharedGeos.gunGrip, sharedMats.dark);
    gunGrip.position.set(3.0, 3.2, 1.8);
    const gunSight = new THREE.Mesh(sharedGeos.gunSight, sharedMats.gunMetal);
    gunSight.position.set(3.0, 3.8, 0.5);

    // Laser sight
    const laserGeo = new THREE.CylinderGeometry(0.03, 0.03, 80, 8);
    laserGeo.translate(0, 40, 0);
    laserGeo.rotateX(Math.PI / 2);
    const botLaser = new THREE.Mesh(laserGeo, sharedMats.laser);
    botLaser.position.set(3.0, 3.6, 0.8);
    botLaser.visible = false;

    // Add all parts
    botGroup.add(
      torsoLower, torsoUpper, neck, head, hair,
      eyeL, eyeR, pupilL, pupilR, nose, earL, earR, browL, browR,
      shoulderL, shoulderR, belt, beltBuckle,
      armUpperL, elbowL, armLowerL, handL, fingerL1, fingerL2, thumbL,
      armUpperR, elbowR, armLowerR, handR, fingerR1, fingerR2, thumbR,
      legUpperL, kneeL, legLowerL, bootL, bootSoleL,
      legUpperR, kneeR, legLowerR, bootR, bootSoleR,
      gunBody, gunBarrel, gunStock, gunMag, gunGrip, gunSight, botLaser
    );

    // Parachute
    const bParaGroup = new THREE.Group();
    const bCanopy = new THREE.Mesh(sharedGeos.parachute, sharedMats.parachute);
    bCanopy.position.y = 12;
    bCanopy.scale.y = 0.5;
    bParaGroup.add(bCanopy);
    const strMat = new THREE.LineBasicMaterial({ color: 0xffffff });
    for (let j = 0; j < 4; j++) {
      const ang = (j / 4) * Math.PI * 2;
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(Math.cos(ang) * 9, 12, Math.sin(ang) * 9),
        new THREE.Vector3(0, 5, 0)
      ]);
      bParaGroup.add(new THREE.Line(geo, strMat));
    }
    botGroup.add(bParaGroup);

    // Random scale with body type variation
    let scale = 0.85 + Math.random() * 0.3; // 0.85 to 1.15
    let widthMul = 0.9 + Math.random() * 0.25; // body width variation
    botGroup.scale.set(scale * widthMul, scale, scale * widthMul);

    botGroup.position.set(x, y, z);
    state.scene.add(botGroup);

    // Set userData for raycasting
    torsoLower.userData = { isBot: true, botIndex: i, isHeadshot: false };
    torsoUpper.userData = { isBot: true, botIndex: i, isHeadshot: false };
    head.userData = { isBot: true, botIndex: i, isHeadshot: true };
    state.objects.push(torsoLower, torsoUpper, head);
    if (pack) {
      pack.userData = { isBot: true, botIndex: i, isHeadshot: false };
      state.objects.push(pack);
    }

    // Random equipment
    let bHelmet = null;
    if (Math.random() > 0.3) {
      bHelmet = equipments.filter(e => e.type === "helmet")[Math.floor(Math.random() * 3)];
      headMat.color.setHex(bHelmet.color);
    }

    let bArmor = null;
    if (Math.random() > 0.3) {
      bArmor = equipments.filter(e => e.type === "armor")[Math.floor(Math.random() * 3)];
      bodyMat.color.setHex(bArmor.color);
    }

    const botWeaponPool = weapons.filter(w => !w.special);
    let w = botWeaponPool[Math.floor(Math.random() * botWeaponPool.length)];
    let diff = difficulties[CURRENT_DIFFICULTY];

    state.bots.push({
      id: i, mesh: botGroup, bodyMesh: torsoLower, headMesh: head, packMesh: pack, parachuteMesh: bParaGroup, laserMesh: botLaser,
      health: diff.botHealth, alive: true, weapon: { ...w, damage: w.damage * diff.botDamageMultiplier },
      helmet: bHelmet, armor: bArmor,
      accuracy: diff.botAccuracy,
      isParachuting: true,
      state: 'wander', target: null, lastFire: 0, vx: 0, vz: 0, changeDirTime: 0
    });
  }

  state.aliveCount = BOT_COUNT + 1;
}

export function updateBots(delta) {
  let now = Date.now();
  let playerPos = state.controls.getObject().position;
  let diff = difficulties[CURRENT_DIFFICULTY];
  let currentTick = state.frameId % 5;

  state.bots.forEach((bot, idx) => {
    if (!bot.alive) return;

    // Distance check - skip detailed updates for far bots
    let bPos = bot.mesh.position;
    let dxPlayer = bPos.x - playerPos.x;
    let dzPlayer = bPos.z - playerPos.z;
    let distToPlayerSq = dxPlayer * dxPlayer + dzPlayer * dzPlayer;
    let isNearby = distToPlayerSq < 400 * 400;

    if (bot.isParachuting) {
      bot.mesh.position.y -= (25 + Math.random() * 10) * delta;
      bot.mesh.position.x += Math.cos(bot.id) * 15 * delta;
      bot.mesh.position.z += Math.sin(bot.id) * 15 * delta;

      let groundY = getGroundHeight(bPos.x, bPos.z, 2);
      if (bPos.y <= groundY) {
        bPos.y = groundY;
        bot.isParachuting = false;
        bot.parachuteMesh.visible = false;
      }
      return;
    }

    // Hide far away bots
    if (distToPlayerSq > 600 * 600) {
      bot.mesh.visible = false;
      return;
    }
    bot.mesh.visible = true;
    if (!isNearby && (state.frameId + bot.id) % 4 !== 0) return;
    const stepDelta = isNearby ? delta : delta * 4;

    let oldBx = bPos.x, oldBz = bPos.z;
    const nearbyColliders = getNearbyColliders(bPos.x, bPos.z);
    const nearbyDoors = getNearbyDoors(bPos.x, bPos.z);

    // AI targeting (throttled - only 1/5 of bots update per frame)
    if ((idx % 5) === currentTick && now > bot.changeDirTime) {
      bot.changeDirTime = now + 1500 + Math.random() * 2500;
      let closestTarget = null;
      let minDistSq = diff.botTargetRange * diff.botTargetRange;
      const rangeSq = minDistSq;

      // Check player first (cheapest check)
      if (state.player.alive && !state.player.isParachuting) {
        let dx = bPos.x - playerPos.x;
        let dz = bPos.z - playerPos.z;
        let dSq = dx * dx + dz * dz;
        if (dSq < rangeSq) { minDistSq = dSq; closestTarget = 'player'; }
      }

      // Only check nearby bots with aggressive bounding box rejection
      if (isNearby) {
        const range = Math.sqrt(minDistSq);
        const bx = bPos.x, bz = bPos.z;
        const nearbyBots = getNearbyBots(bx, bz);
        for (let j = 0, len = nearbyBots.length; j < len; j++) {
          const other = nearbyBots[j];
          if (!other.alive || other.isParachuting || other.id === bot.id) continue;
          const oPos = other.mesh.position;
          const odx = bx - oPos.x;
          const odz = bz - oPos.z;
          // Bounding box rejection (cheaper than distanceToSquared)
          if (odx > range || odx < -range || odz > range || odz < -range) continue;
          const dSq = odx * odx + odz * odz;
          if (dSq < minDistSq) { minDistSq = dSq; closestTarget = other; }
        }
      }

      bot.target = closestTarget;

      if (!bot.target) {
        bot.state = 'wander';
        // Zone-aware wandering
        const dx = bPos.x - state.zone.x;
        const dz = bPos.z - state.zone.z;
        const distToZoneCenterSq = dx * dx + dz * dz;
        if (distToZoneCenterSq > state.zone.radius * state.zone.radius * 0.81) {
          let angle = Math.atan2(state.zone.z - bPos.z, state.zone.x - bPos.x);
          bot.vx = Math.cos(angle) * 20;
          bot.vz = Math.sin(angle) * 20;
        } else {
          let angle = Math.random() * Math.PI * 2;
          bot.vx = Math.cos(angle) * 15;
          bot.vz = Math.sin(angle) * 15;
        }
      } else {
        bot.state = 'attack';
      }
    }

    if (bot.state === 'wander') {
      let newX = bPos.x + bot.vx * stepDelta;
      let newZ = bPos.z + bot.vz * stepDelta;

      // Check collision before moving
      let collision = checkEntityCollision(bPos.x, bPos.z, newX, newZ, bPos.y, 5, {
        colliders: nearbyColliders,
        doors: nearbyDoors
      });
      if (!collision.blocked) {
        bPos.x = newX;
        bPos.z = newZ;
      } else {
        bPos.x = collision.x;
        bPos.z = collision.z;
        // Change direction on collision
        bot.vx = -bot.vx * 0.5;
        bot.vz = -bot.vz * 0.5;
      }
      bPos.y = getGroundHeight(bPos.x, bPos.z, 2);
      if (bot.laserMesh) bot.laserMesh.visible = false;
      resolveEntityCollisions(bPos, 'bot_' + bot.id, 2);
      bPos.y = getGroundHeight(bPos.x, bPos.z, 2);
    } else if (bot.state === 'attack' && bot.target) {
      let targetPos = bot.target === 'player' ? playerPos : bot.target.mesh.position;
      bot.mesh.lookAt(targetPos.x, bPos.y, targetPos.z);
      if (bot.laserMesh) bot.laserMesh.visible = true;

      let speed = diff.botSpeed || 20;
      _tempVec3.subVectors(targetPos, bPos);
      _tempVec3.y = 0;
      let dist = _tempVec3.length();
      _tempVec3.normalize();

      let moveX = 0, moveZ = 0;
      if (dist > 80) {
        moveX = _tempVec3.x * speed * stepDelta;
        moveZ = _tempVec3.z * speed * stepDelta;
      } else if (dist < 30) {
        moveX = -_tempVec3.x * speed * stepDelta;
        moveZ = -_tempVec3.z * speed * stepDelta;
      } else {
        let strafeDir = (Math.floor(now / 2000) + bot.id) % 2 === 0 ? 1 : -1;
        moveX = (-_tempVec3.z) * speed * 0.85 * strafeDir * stepDelta;
        moveZ = _tempVec3.x * speed * 0.85 * strafeDir * stepDelta;
      }

      // Check collision before moving
      let newX = bPos.x + moveX;
      let newZ = bPos.z + moveZ;
      let collision = checkEntityCollision(bPos.x, bPos.z, newX, newZ, bPos.y, 5, {
        colliders: nearbyColliders,
        doors: nearbyDoors
      });
      if (!collision.blocked) {
        bPos.x = newX;
        bPos.z = newZ;
      }
      bPos.y = getGroundHeight(bPos.x, bPos.z, 2);
      resolveEntityCollisions(bPos, 'bot_' + bot.id, 2);
      bPos.y = getGroundHeight(bPos.x, bPos.z, 2);

      // Shooting (only nearby bots shoot)
      if (isNearby && now - bot.lastFire > bot.weapon.fireRate * diff.botFireRateMultiplier) {
        bot.lastFire = now;
        playSound(bot.weapon.sound, { x: bPos.x, y: bPos.y, z: bPos.z });

        if (bot.laserMesh) {
          bot.laserMesh.material.opacity = 1.0;
          setTimeout(() => { if (bot.laserMesh) bot.laserMesh.material.opacity = 0.6; }, 100);
        }

        // Bot gun position (right hand area)
        _botGunPos.set(bPos.x + 2, bPos.y + 3.5, bPos.z + 1.5);
        _botMuzzleDir.subVectors(targetPos, _botGunPos).normalize();
        spawnWorldMuzzleFlash(_botGunPos, _botMuzzleDir, { scale: 1.0, duration: 62 });

        // Add bullet spread for bots
        const botSpread = 0.05;
        const spreadX = (Math.random() - 0.5) * botSpread;
        const spreadY = (Math.random() - 0.5) * botSpread;

        if (Math.random() < bot.accuracy) {
          let isHeadshot = Math.random() > 0.9;
          if (bot.target === 'player') {
            const botHeadPos = _botHeadPos.set(bPos.x, bPos.y + 5, bPos.z);
            const direction = _botDirection.subVectors(playerPos, botHeadPos).normalize();
            // Apply spread to direction
            direction.x += spreadX;
            direction.y += spreadY;
            direction.normalize();

            _botRaycaster.set(botHeadPos, direction);
            _botRaycaster.near = 0;
            _botRaycaster.far = 1000;
            const intersects = _botRaycaster.intersectObjects(state.objects);

            let isBlocked = false;
            let hitPoint = playerPos;

            let insideHouse = getHousePlayerIsInside();
            if (insideHouse && !insideHouse.isOpen) {
              isBlocked = true;
            } else if (intersects.length > 0) {
              if (intersects[0].distance < botHeadPos.distanceTo(playerPos)) {
                if (intersects[0].object.userData.botIndex !== bot.id) {
                  isBlocked = true;
                  hitPoint = intersects[0].point;
                }
              }
            }

            // Create bot bullet tracer
            createTracerFromPosition(_botGunPos, hitPoint);

            if (!isBlocked) {
              let dmg = calcDamage(bot.weapon.damage * diff.botToPlayerDamageFactor, isHeadshot, state.player);
              playerHit(dmg, bPos); // Pass bot position for hit direction
            }
          } else if (bot.target.mesh) {
            // Bot-vs-bot damage reduced by 20x
            let dmg = calcDamage(bot.weapon.damage * 0.025, isHeadshot, bot.target);
            bot.target.health -= dmg;

            // Create bot bullet tracer for bot-vs-bot combat
            createTracerFromPosition(_botGunPos, bot.target.mesh.position);

            spawnBlood(_missPoint.copy(bot.target.mesh.position).add(_bloodOffset), _upNormal);
            if (bot.target.health <= 0) {
              botDied(bot.target, "Bot " + bot.id);
              bot.target = null;
              bot.changeDirTime = 0;
            }
          }
        } else {
          // Miss - tracer goes past target
          _missPoint.set(
            _botGunPos.x + (Math.random() - 0.5) * 50,
            _botGunPos.y + (Math.random() - 0.5) * 20,
            _botGunPos.z + (Math.random() - 0.5) * 50
          );
          createTracerFromPosition(_botGunPos, _missPoint);
        }
      }
    }

    // House collision (simplified - only check nearby doors)
    if (isNearby) {
      for (let i = 0; i < nearbyDoors.length; i++) {
        let d = nearbyDoors[i];
        let hPos = d.housePos;
        let dx = bPos.x - hPos.x;
        let dz = bPos.z - hPos.z;

        if (Math.abs(dx) > 20 || Math.abs(dz) > 20) continue;

        const baseY = hPos.baseHeight ?? hPos.y;
        if (bPos.y + 8 > baseY && bPos.y < baseY + 24) {
          let absX = Math.abs(dx);
          let absZ = Math.abs(dz);
          if (absX < 16.2 && absZ < 16.2) {
            let wallHit = false;
            if ((dx >= -16.2 && dx <= -13.5 && dz >= -16.2 && dz <= 16.2) ||
              (dx >= 13.5 && dx <= 16.2 && dz >= -16.2 && dz <= 16.2) ||
              (dz >= -16.2 && dz <= -13.5 && dx >= -16.2 && dx <= 16.2) ||
              (dz >= 13.5 && dz <= 16.2 && dx >= -16.2 && dx <= -3.1) ||
              (dz >= 13.5 && dz <= 16.2 && dx >= 3.1 && dx <= 16.2) ||
              (!d.isOpen && dz >= 13.5 && dz <= 16.2 && dx >= -3.25 && dx <= 3.25)) {
              wallHit = true;
            }
            if (wallHit) {
              bPos.x = oldBx;
              bPos.z = oldBz;
              break;
            }
          }
        }
      }
    }
  });
}

export function botDied(bot, killerName) {
  if (!bot.alive) return;
  bot.alive = false;
  state.scene.remove(bot.mesh);
  state.aliveCount = Math.max(1, state.aliveCount - 1);

  let idx1 = state.objects.indexOf(bot.bodyMesh);
  if (idx1 > -1) state.objects.splice(idx1, 1);
  let idx2 = state.objects.indexOf(bot.headMesh);
  if (idx2 > -1) state.objects.splice(idx2, 1);
  if (bot.packMesh) {
    let idx3 = state.objects.indexOf(bot.packMesh);
    if (idx3 > -1) state.objects.splice(idx3, 1);
  }

  if (killerName === "You") {
    state.player.kills++;
    showNotice("击杀 Bot " + bot.id, "#f1c40f");
  }

  addKillFeed(`[${killerName}] 击杀了 [Bot ${bot.id}]`);
  updateUI();

  if (state.aliveCount === 1 && !state.giantAlive && state.player.alive) {
    setTimeout(() => {
      state.controls.unlock();
      document.getElementById('title').innerText = "大吉大利，今晚吃鸡！";
      document.getElementById('title').style.color = "#f1c40f";
      document.getElementById('subtitle').innerText = `WINNER WINNER CHICKEN DINNER! 击杀数: ${state.player.kills} (含远古恶魔巨人)`;
      document.getElementById('start-btn').innerText = "再玩一局";
      document.getElementById('start-btn').style.display = "block";
      document.getElementById('start-btn').onclick = () => location.reload();
      document.getElementById('overlay').style.display = "flex";
    }, 800);
  } else if (state.aliveCount === 1 && state.giantAlive && state.player.alive) {
    // Player killed all bots but giant still alive — remind them
    showNotice("⚠️ 所有Bot已击杀！但远古恶魔巨人仍在…击败它才能吃鸡！", "#ff6600");
  }
}
