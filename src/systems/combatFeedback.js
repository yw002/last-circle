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
const activeHealthBars = [];
const damageNumberPool = [];
const activeDamageNumbers = [];
const _dustPoint = new THREE.Vector3();
const _screenPos = new THREE.Vector3();
let container = null;
let healthBarContainer = null;
let lastKillTime = 0;
let comboCount = 0;
let lastNearMissDust = 0;
let healthBarsEnabled = false;

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

function ensureHealthBarContainer() {
  if (healthBarContainer) return healthBarContainer;
  healthBarContainer = document.createElement('div');
  healthBarContainer.id = 'target-healthbars';
  document.body.appendChild(healthBarContainer);
  return healthBarContainer;
}

export function toggleHealthBars() {
  healthBarsEnabled = !healthBarsEnabled;
  ensureHealthBarContainer();
  if (!healthBarsEnabled) {
    for (let i = activeHealthBars.length - 1; i >= 0; i--) removeHealthBar(activeHealthBars[i]);
    activeHealthBars.length = 0;
  }
  const msg = healthBarsEnabled ? 'F4 血条/伤害数字: 开' : 'F4 血条/伤害数字: 关';
  const el = document.createElement('div');
  el.className = 'healthbar-toggle-toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => {
    if (document.body.contains(el)) document.body.removeChild(el);
  }, 1200);
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

function getHealthBarForEntity(entity) {
  for (let i = 0; i < activeHealthBars.length; i++) {
    if (activeHealthBars[i].entity === entity) return activeHealthBars[i];
  }

  ensureHealthBarContainer();
  const el = document.createElement('div');
  el.className = 'target-healthbar';
  el.innerHTML = '<div class="target-healthbar-fill"></div>';
  healthBarContainer.appendChild(el);
  const entry = { entity, el, fill: el.firstElementChild, expires: 0, yOffset: 11 };
  activeHealthBars.push(entry);
  return entry;
}

function getDamageNumber() {
  for (let i = 0; i < damageNumberPool.length; i++) {
    const pooled = damageNumberPool[i];
    if (!pooled.active) {
      pooled.active = true;
      pooled.el.style.display = 'block';
      return pooled;
    }
  }

  ensureHealthBarContainer();
  const el = document.createElement('div');
  el.className = 'damage-number';
  healthBarContainer.appendChild(el);
  const entry = { el, active: true, start: 0, duration: 760, worldPos: new THREE.Vector3(), value: 0 };
  damageNumberPool.push(entry);
  return entry;
}

function removeHealthBar(entry) {
  if (entry && entry.el && entry.el.parentNode) entry.el.parentNode.removeChild(entry.el);
}

function estimateMaxHealth(entity, targetType) {
  if (!entity) return 100;
  if (typeof entity.maxHealth === 'number') return entity.maxHealth;
  if (targetType === 'zombie') return 110;
  if (targetType === 'alien') return 80;
  if (targetType === 'bot') return 130;
  return Math.max(entity.health || 1, 100);
}

function showHealthAndDamage({ entity, targetType, damage, point, isHeadshot, isKill }) {
  if (!healthBarsEnabled || !entity || !entity.mesh) return;
  const maxHealth = estimateMaxHealth(entity, targetType);
  const entry = getHealthBarForEntity(entity);
  entry.expires = performance.now() + 2600;
  entry.yOffset = targetType === 'animal' ? 7 : 11;
  const percent = Math.max(0, Math.min(100, (entity.health / maxHealth) * 100));
  entry.fill.style.width = `${percent}%`;
  entry.fill.style.background = percent > 55 ? '#44ff66' : percent > 25 ? '#ffd34d' : '#ff4545';

  const number = getDamageNumber();
  number.start = performance.now();
  number.duration = isKill ? 950 : 760;
  number.value = Math.max(1, Math.round(damage || 0));
  number.worldPos.copy(point || entity.mesh.position);
  number.worldPos.y += entry.yOffset;
  number.el.textContent = `${number.value}`;
  number.el.className = `damage-number${isHeadshot && isKill ? ' headshot' : ''}${isKill ? ' kill' : ''}`;
  activeDamageNumbers.push(number);
}

export function registerCombatHit({ targetType = 'bot', isHeadshot = false, isKill = false, point = null, normal = null, entity = null, damage = 0 } = {}) {
  const profile = getTargetProfile(targetType);
  const showHeadshot = isHeadshot && isKill;
  const feedbackClass = showHeadshot ? 'combat-headshot' : isKill ? 'combat-kill' : 'combat-hit';
  const text = showHeadshot ? profile.head : isKill ? profile.kill : profile.hit;

  pulseCrosshair(feedbackClass);
  showCenterText(text, profile.className, isKill || isHeadshot);
  playCombatFeedbackSound(showHeadshot ? 'headshot' : isKill ? 'kill' : 'hit');
  showHealthAndDamage({ entity, targetType, damage, point, isHeadshot, isKill });
  if (isKill) registerKill();
  if (showHeadshot && targetType === 'zombie' && point) spawnMonsterHeadshotBurst(point, normal);
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

  if (healthBarContainer && state.camera && state.renderer) {
    const now = performance.now();
    const width = window.innerWidth;
    const height = window.innerHeight;

    for (let i = activeHealthBars.length - 1; i >= 0; i--) {
      const entry = activeHealthBars[i];
      if (!entry.entity || entry.entity.alive === false || now > entry.expires || !entry.entity.mesh) {
        removeHealthBar(entry);
        activeHealthBars.splice(i, 1);
        continue;
      }
      _screenPos.copy(entry.entity.mesh.position);
      _screenPos.y += entry.yOffset;
      _screenPos.project(state.camera);
      if (_screenPos.z < -1 || _screenPos.z > 1) {
        entry.el.style.display = 'none';
        continue;
      }
      entry.el.style.display = 'block';
      entry.el.style.transform = `translate(-50%, -100%) translate(${(_screenPos.x * 0.5 + 0.5) * width}px, ${(-_screenPos.y * 0.5 + 0.5) * height}px)`;
    }

    for (let i = activeDamageNumbers.length - 1; i >= 0; i--) {
      const entry = activeDamageNumbers[i];
      const t = (now - entry.start) / entry.duration;
      if (t >= 1) {
        entry.active = false;
        entry.el.style.display = 'none';
        activeDamageNumbers.splice(i, 1);
        continue;
      }
      _screenPos.copy(entry.worldPos);
      _screenPos.project(state.camera);
      entry.el.style.opacity = `${1 - t}`;
      entry.el.style.transform = `translate(-50%, -50%) translate(${(_screenPos.x * 0.5 + 0.5) * width}px, ${(-_screenPos.y * 0.5 + 0.5) * height - t * 34}px)`;
    }
  }
}
