// Central combat feedback: hit markers, kill/combo text, and near-miss dust.

import * as THREE from 'three';
import { state } from '../state.js';
import { getTerrainHeight } from '../world/terrain.js';
import { playCombatFeedbackSound } from './audio.js';

const COMBO_WINDOW_MS = 3000;
const MAX_DUST = 36;
const dustGeo = new THREE.BoxGeometry(0.45, 0.45, 0.45);
const dustMat = new THREE.MeshBasicMaterial({ color: 0x8c7458, transparent: true, opacity: 0.55, depthWrite: false });
const dustPool = [];
const activeDust = [];
const _dustPoint = new THREE.Vector3();
let container = null;
let lastKillTime = 0;
let comboCount = 0;
let lastNearMissDust = 0;

function ensureContainer() {
  if (container) return container;
  container = document.createElement('div');
  container.id = 'combat-feedback';
  container.innerHTML = `
    <div id="combat-feedback-main"></div>
    <div id="combat-feedback-combo"></div>
  `;
  document.body.appendChild(container);
  return container;
}

function getTargetProfile(targetType) {
  if (targetType === 'zombie' || targetType === 'alien') {
    return { className: 'monster', hit: 'HIT', head: 'HEADSHOT', kill: 'MONSTER DOWN' };
  }
  if (targetType === 'animal') {
    return { className: 'wildlife', hit: 'HIT', head: 'CRITICAL', kill: 'TAKEDOWN' };
  }
  return { className: 'human', hit: 'HIT', head: 'HEADSHOT', kill: 'KILL' };
}

function pulseCrosshair(kind) {
  const crosshair = document.getElementById('crosshair');
  if (!crosshair) return;
  crosshair.classList.remove('combat-hit', 'combat-headshot', 'combat-kill');
  // Force a style restart when hits arrive in rapid succession.
  void crosshair.offsetWidth;
  crosshair.classList.add(kind);
  setTimeout(() => crosshair.classList.remove(kind), kind === 'combat-kill' ? 180 : 110);
}

function showCenterText(text, className, strong = false) {
  ensureContainer();
  const el = document.getElementById('combat-feedback-main');
  if (!el) return;
  el.className = `${className}${strong ? ' strong' : ''}`;
  el.textContent = text;
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = 'combatFeedbackPop 520ms ease-out forwards';
}

function showComboText(count) {
  if (count < 2) return;
  ensureContainer();
  const el = document.getElementById('combat-feedback-combo');
  if (!el) return;
  const label = count === 2 ? 'DOUBLE KILL' : count === 3 ? 'MULTI KILL' : `${count} KILL STREAK`;
  el.textContent = label;
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = 'combatComboPop 760ms ease-out forwards';
}

function registerKill() {
  const now = performance.now();
  comboCount = now - lastKillTime <= COMBO_WINDOW_MS ? comboCount + 1 : 1;
  lastKillTime = now;
  showComboText(comboCount);
}

function getDustFromPool() {
  for (let i = 0; i < dustPool.length; i++) {
    if (!dustPool[i].active) {
      dustPool[i].active = true;
      dustPool[i].mesh.visible = true;
      return dustPool[i];
    }
  }

  if (dustPool.length >= MAX_DUST || !state.scene) return null;
  const mesh = new THREE.Mesh(dustGeo, dustMat.clone());
  mesh.visible = true;
  state.scene.add(mesh);
  const dust = { mesh, active: true, age: 0, vx: 0, vy: 0, vz: 0 };
  dustPool.push(dust);
  return dust;
}

export function registerCombatHit({ targetType = 'bot', isHeadshot = false, isKill = false, point = null, normal = null } = {}) {
  const profile = getTargetProfile(targetType);
  const feedbackClass = isKill ? 'combat-kill' : isHeadshot ? 'combat-headshot' : 'combat-hit';
  const text = isKill ? profile.kill : isHeadshot ? profile.head : profile.hit;

  pulseCrosshair(feedbackClass);
  showCenterText(text, profile.className, isKill || isHeadshot);
  playCombatFeedbackSound(isKill ? 'kill' : isHeadshot ? 'headshot' : 'hit');
  if (isKill) registerKill();
  if (isHeadshot && targetType === 'zombie' && point) spawnMonsterHeadshotBurst(point, normal);
}

export function spawnMonsterHeadshotBurst(point, normal = null) {
  const baseNormal = normal || new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 10; i++) {
    const dust = getDustFromPool();
    if (!dust) return;
    dust.mesh.material.color.setHex(i % 2 === 0 ? 0x445b2d : 0x5c1616);
    dust.mesh.material.opacity = 0.55;
    dust.mesh.position.copy(point);
    dust.mesh.scale.setScalar(0.7 + Math.random() * 0.9);
    dust.vx = baseNormal.x * 4 + (Math.random() - 0.5) * 10;
    dust.vy = 4 + Math.random() * 8;
    dust.vz = baseNormal.z * 4 + (Math.random() - 0.5) * 10;
    dust.age = 0;
    activeDust.push(dust);
  }
}

export function triggerNearMissDust(point, intensity = 0.5) {
  const now = performance.now();
  if (!point || now - lastNearMissDust < 120) return;
  lastNearMissDust = now;

  _dustPoint.copy(point);
  const groundY = getTerrainHeight(_dustPoint.x, _dustPoint.z);
  if (_dustPoint.y > groundY + 4) _dustPoint.y = groundY + 0.6;

  const count = 3 + Math.floor(Math.max(0, Math.min(1, intensity)) * 4);
  for (let i = 0; i < count; i++) {
    const dust = getDustFromPool();
    if (!dust) return;
    dust.mesh.material.color.setHex(0x8c7458);
    dust.mesh.material.opacity = 0.55;
    dust.mesh.position.copy(_dustPoint);
    dust.mesh.scale.setScalar(0.45 + Math.random() * 0.55);
    dust.vx = (Math.random() - 0.5) * 6;
    dust.vy = 2 + Math.random() * 5;
    dust.vz = (Math.random() - 0.5) * 6;
    dust.age = 0;
    activeDust.push(dust);
  }
}

export function updateCombatFeedback(delta) {
  for (let i = activeDust.length - 1; i >= 0; i--) {
    const dust = activeDust[i];
    dust.age += delta;
    dust.vy -= 18 * delta;
    dust.mesh.position.x += dust.vx * delta;
    dust.mesh.position.y += dust.vy * delta;
    dust.mesh.position.z += dust.vz * delta;
    dust.mesh.material.opacity = Math.max(0, 0.55 * (1 - dust.age / 0.45));

    if (dust.age >= 0.45) {
      dust.active = false;
      dust.mesh.visible = false;
      activeDust[i] = activeDust[activeDust.length - 1];
      activeDust.pop();
    }
  }
}
