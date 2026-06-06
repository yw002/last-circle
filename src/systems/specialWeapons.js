// Player-only special weapon effects. Normal weapons and bot weapons keep the existing fire path.

import * as THREE from 'three';
import { state } from '../state.js';
import { calcDamage } from '../entities/damage.js';
import { botDied } from '../entities/bots.js';
import { zombieDied } from '../entities/zombies.js';
import { killAnimal, getAllAnimals } from '../entities/animals.js';
import { alienDied, getAllAliens } from '../entities/aliens.js';
import { playImpactSound, playSound } from './audio.js';
import { spawnBlood } from './particles.js';
import { createWeaponTracer, spawnTracer } from './bullets.js';
import { spawnBulletHole } from './bulletholes.js';
import { inferImpactMaterial, spawnImpactEffect } from './impactEffects.js';
import { registerCombatHit, spawnMonsterHeadshotBurst } from './combatFeedback.js';

const activeDots = [];
const activeLines = [];
const activeBursts = [];
const activeMarkers = [];
const _tmp = new THREE.Vector3();
const _tmp2 = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _lineMat = new THREE.LineBasicMaterial({ color: 0x88ddff, transparent: true, opacity: 0.9 });
const _burstGeo = new THREE.SphereGeometry(1, 8, 8);
const _markerGeo = new THREE.TorusGeometry(1.4, 0.08, 6, 24);

function getEntityFromHit(hit) {
  if (!hit || !hit.object) return null;
  const ud = hit.object.userData || {};
  if (ud.isBot) {
    const entity = state.bots[ud.botIndex];
    return entity ? { entity, type: 'bot', index: ud.botIndex, isHeadshot: !!ud.isHeadshot } : null;
  }
  if (ud.isZombie) {
    const entity = state.zombies[ud.zombieIndex];
    return entity ? { entity, type: 'zombie', index: ud.zombieIndex, isHeadshot: !!ud.isHeadshot } : null;
  }
  if (ud.isAnimal) {
    const entity = getAllAnimals()[ud.index];
    return entity ? { entity, type: 'animal', index: ud.index, animalType: ud.animalType, isHeadshot: false } : null;
  }
  if (ud.isAlien) {
    const entity = getAllAliens()[ud.alienIndex];
    return entity ? { entity, type: 'alien', index: ud.alienIndex, isHeadshot: !!ud.isHeadshot } : null;
  }
  return null;
}

function isAlive(target) {
  return target && target.entity && target.entity.alive !== false && target.entity.health > 0;
}

function getEntityPosition(target) {
  if (!target || !target.entity || !target.entity.mesh) return null;
  return target.entity.mesh.position;
}

function killTarget(target) {
  if (!target || !target.entity) return;
  if (target.type === 'bot') botDied(target.entity, 'You');
  else if (target.type === 'zombie') zombieDied(target.entity);
  else if (target.type === 'animal') killAnimal(target.entity, target.animalType || target.entity.type);
  else if (target.type === 'alien') alienDied(target.entity);
}

function isMarkedTarget(target) {
  return activeMarkers.some(entry => entry.target.entity === target.entity);
}

function revealNearbyFromMarked(target) {
  const origin = getEntityPosition(target);
  if (!origin) return;
  const nearby = findNearbyTargets(target, 90, 5);
  for (let i = 0; i < nearby.length; i++) {
    const pos = getEntityPosition(nearby[i]);
    if (!pos) continue;
    // Marked-target deaths briefly expose nearby threats without changing damage or AI.
    spawnTempLine(origin, pos, 0xd15cff, 420);
    _tmp2.copy(pos);
    _tmp2.y += 6;
    spawnBurst(_tmp2, 0xd15cff, 5, 520);
  }
}

function damageTarget(target, amount, options = {}) {
  if (!isAlive(target)) return false;
  const entity = target.entity;
  const wasAlive = entity.alive !== false && entity.health > 0;
  let damage = amount;
  if (options.useArmor !== false && target.type !== 'animal') {
    damage = calcDamage(amount, !!options.isHeadshot, entity);
  }
  entity.health -= damage;

  const point = options.point || getEntityPosition(target);
  const normal = options.normal || _up;
  if (point) spawnBlood(point, normal);
  playSound('hit');

  const killed = wasAlive && entity.health <= 0;
  const shouldReveal = killed && isMarkedTarget(target);
  registerCombatHit({
    targetType: target.type,
    isHeadshot: !!options.isHeadshot,
    isKill: killed,
    point,
    normal,
    entity,
    damage
  });

  if (shouldReveal) revealNearbyFromMarked(target);
  if (killed) killTarget(target);
  return killed;
}

function getAllCombatTargets() {
  const targets = [];
  for (let i = 0; i < state.bots.length; i++) if (state.bots[i].alive) targets.push({ entity: state.bots[i], type: 'bot', index: i });
  for (let i = 0; i < state.zombies.length; i++) if (state.zombies[i].alive) targets.push({ entity: state.zombies[i], type: 'zombie', index: i });
  const animals = getAllAnimals();
  for (let i = 0; i < animals.length; i++) if (animals[i].alive) targets.push({ entity: animals[i], type: 'animal', index: i, animalType: animals[i].type });
  const aliens = getAllAliens();
  for (let i = 0; i < aliens.length; i++) if (aliens[i].alive) targets.push({ entity: aliens[i], type: 'alien', index: i });
  return targets;
}

function spawnTempLine(from, to, color = 0x88ddff, duration = 120) {
  if (!state.scene || !from || !to) return;
  const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
  const mat = _lineMat.clone();
  mat.color.setHex(color);
  const line = new THREE.Line(geo, mat);
  state.scene.add(line);
  activeLines.push({ line, start: performance.now(), duration });
}

function spawnBurst(point, color, radius = 6, duration = 320) {
  if (!state.scene || !point) return;
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false });
  const mesh = new THREE.Mesh(_burstGeo, mat);
  mesh.position.copy(point);
  mesh.scale.setScalar(0.5);
  state.scene.add(mesh);
  activeBursts.push({ mesh, start: performance.now(), duration, radius });
}

function markTarget(target) {
  if (!isAlive(target) || !state.scene) return;
  const markerMat = new THREE.MeshBasicMaterial({
    color: 0xb35cff,
    transparent: true,
    opacity: 0.75,
    depthWrite: false
  });
  const marker = new THREE.Mesh(_markerGeo, markerMat);
  marker.rotation.x = Math.PI / 2;
  state.scene.add(marker);
  activeMarkers.push({ target, marker, expires: performance.now() + 4000, pulse: Math.random() * Math.PI * 2 });
}

function addDot(target, damagePerTick, durationMs, tickMs, color) {
  if (!isAlive(target)) return;
  activeDots.push({
    target,
    damagePerTick,
    nextTick: performance.now() + tickMs,
    expires: performance.now() + durationMs,
    tickMs,
    color
  });
}

function handleCoverImpact(hit) {
  if (!hit) return;
  const normal = hit.face ? hit.face.normal : _up;
  const material = inferImpactMaterial(hit);
  playImpactSound(material, hit.point);
  spawnImpactEffect(hit.point, normal, material);
  if (material !== 'water') spawnBulletHole(hit.point, normal);
}

function areaDamage(point, radius, baseDamage, options = {}) {
  if (!point) return;
  const radiusSq = radius * radius;
  const targets = getAllCombatTargets();
  for (let i = 0; i < targets.length; i++) {
    const pos = getEntityPosition(targets[i]);
    if (!pos) continue;
    const distSq = pos.distanceToSquared(point);
    if (distSq > radiusSq) continue;
    const falloff = 1 - Math.sqrt(distSq) / radius;
    const damage = baseDamage * (0.35 + falloff * 0.65) * (targets[i].type === 'bot' && options.botScale ? options.botScale : 1);
    damageTarget(targets[i], damage, { useArmor: true, point: pos, normal: _up });
    if (options.push) {
      _tmp.subVectors(pos, point);
      _tmp.y = 0;
      if (_tmp.lengthSq() > 0.01) {
        _tmp.normalize().multiplyScalar(options.push * (0.35 + falloff));
        targets[i].entity.vx = (targets[i].entity.vx || 0) + _tmp.x;
        targets[i].entity.vz = (targets[i].entity.vz || 0) + _tmp.z;
      }
    }
  }
}

function findNearbyTargets(originTarget, radius, maxCount) {
  const origin = getEntityPosition(originTarget);
  if (!origin) return [];
  const candidates = getAllCombatTargets()
    .filter(t => t.entity !== originTarget.entity)
    .map(t => ({ target: t, distSq: getEntityPosition(t)?.distanceToSquared(origin) ?? Infinity }))
    .filter(entry => entry.distSq <= radius * radius)
    .sort((a, b) => a.distSq - b.distSq);
  return candidates.slice(0, maxCount).map(entry => entry.target);
}

function fireCorrosive(context) {
  const { targetHit, coverHit, hitPoint, muzzleStart, weapon } = context;
  createWeaponTracer(muzzleStart, hitPoint, weapon);
  const target = getEntityFromHit(targetHit);
  if (!target) {
    if (coverHit) handleCoverImpact(coverHit);
    return;
  }
  const normal = targetHit.face ? targetHit.face.normal : _up;
  damageTarget(target, weapon.damage, { isHeadshot: target.isHeadshot, point: targetHit.point, normal });
  addDot(target, 7, 3000, 650, weapon.effectColor || 0xb6ff2e);
  spawnMonsterHeadshotBurst(targetHit.point, normal);
}

function fireArc(context) {
  const { targetHit, coverHit, hitPoint, muzzleStart, weapon } = context;
  spawnTracer(muzzleStart, hitPoint, { color: weapon.effectColor || 0x7ce8ff });
  const target = getEntityFromHit(targetHit);
  if (!target) {
    if (coverHit) handleCoverImpact(coverHit);
    return;
  }
  const firstPoint = targetHit.point;
  damageTarget(target, weapon.damage, { isHeadshot: target.isHeadshot, point: firstPoint, normal: targetHit.face ? targetHit.face.normal : _up });
  let from = getEntityPosition(target) || firstPoint;
  const jumps = findNearbyTargets(target, 55, 2);
  for (let i = 0; i < jumps.length; i++) {
    const pos = getEntityPosition(jumps[i]);
    if (!pos) continue;
    spawnTempLine(from, pos, weapon.effectColor || 0x7ce8ff, 150);
    damageTarget(jumps[i], weapon.damage * (i === 0 ? 0.55 : 0.35), { isHeadshot: false, point: pos, normal: _up });
    from = pos;
  }
}

function fireGravity(context) {
  const { targetHit, coverHit, hitPoint, muzzleStart, weapon } = context;
  spawnTracer(muzzleStart, hitPoint, { color: weapon.effectColor || 0x8b5cff });
  const impactPoint = targetHit ? targetHit.point : (coverHit ? coverHit.point : hitPoint);
  spawnBurst(impactPoint, weapon.effectColor || 0x8b5cff, 16, 420);
  areaDamage(impactPoint, 38, weapon.damage, { push: 42, botScale: 0.65 });
  if (coverHit && !targetHit) handleCoverImpact(coverHit);
}

function fireBloodMist(context) {
  const { targetHit, coverHit, hitPoint, muzzleStart, weapon } = context;
  spawnTracer(muzzleStart, hitPoint, { color: weapon.effectColor || 0xcc1f3c });
  const target = getEntityFromHit(targetHit);
  if (!target) {
    if (coverHit) handleCoverImpact(coverHit);
    return;
  }
  const normal = targetHit.face ? targetHit.face.normal : _up;
  const killed = damageTarget(target, weapon.damage, { isHeadshot: target.isHeadshot, point: targetHit.point, normal });
  if (killed && target.type !== 'bot') {
    spawnBurst(targetHit.point, weapon.effectColor || 0xcc1f3c, 18, 360);
    areaDamage(targetHit.point, 32, 28, { botScale: 0.35 });
  }
}

function fireRift(context) {
  const { intersects, hitPoint, muzzleStart, weapon } = context;
  spawnTracer(muzzleStart, hitPoint, { color: weapon.effectColor || 0xb05cff });
  let hits = 0;
  for (let i = 0; i < intersects.length && hits < 2; i++) {
    const hit = intersects[i];
    if (hit.distance > weapon.range) break;
    const target = getEntityFromHit(hit);
    if (!target || !isAlive(target)) {
      handleCoverImpact(hit);
      break;
    }
    const normal = hit.face ? hit.face.normal : _up;
    damageTarget(target, weapon.damage * (hits === 0 ? 1 : 0.62), { isHeadshot: target.isHeadshot, point: hit.point, normal });
    hits++;
  }
}

function fireInfection(context) {
  const { targetHit, coverHit, hitPoint, muzzleStart, weapon } = context;
  spawnTracer(muzzleStart, hitPoint, { color: weapon.effectColor || 0xd15cff });
  const target = getEntityFromHit(targetHit);
  if (!target) {
    if (coverHit) handleCoverImpact(coverHit);
    return;
  }
  damageTarget(target, weapon.damage, { isHeadshot: target.isHeadshot, point: targetHit.point, normal: targetHit.face ? targetHit.face.normal : _up });
  markTarget(target);
}

export function fireSpecialWeapon(context) {
  const special = context.weapon.special;
  if (special === 'corrosive') fireCorrosive(context);
  else if (special === 'arc_chain') fireArc(context);
  else if (special === 'gravity_hammer') fireGravity(context);
  else if (special === 'blood_mist') fireBloodMist(context);
  else if (special === 'rift') fireRift(context);
  else if (special === 'infection_marker') fireInfection(context);
}

export function updateSpecialWeapons(delta) {
  const now = performance.now();
  for (let i = activeDots.length - 1; i >= 0; i--) {
    const dot = activeDots[i];
    if (!isAlive(dot.target) || now > dot.expires) {
      activeDots.splice(i, 1);
      continue;
    }
    if (now >= dot.nextTick) {
      const pos = getEntityPosition(dot.target);
      damageTarget(dot.target, dot.damagePerTick, { useArmor: false, point: pos, normal: _up });
      if (pos) spawnBurst(pos, dot.color, 4, 180);
      dot.nextTick += dot.tickMs;
    }
  }

  for (let i = activeLines.length - 1; i >= 0; i--) {
    const entry = activeLines[i];
    const t = (now - entry.start) / entry.duration;
    if (t >= 1) {
      state.scene.remove(entry.line);
      entry.line.geometry.dispose();
      entry.line.material.dispose();
      activeLines.splice(i, 1);
    } else {
      entry.line.material.opacity = 0.9 * (1 - t);
    }
  }

  for (let i = activeBursts.length - 1; i >= 0; i--) {
    const entry = activeBursts[i];
    const t = (now - entry.start) / entry.duration;
    if (t >= 1) {
      state.scene.remove(entry.mesh);
      entry.mesh.material.dispose();
      activeBursts.splice(i, 1);
    } else {
      entry.mesh.scale.setScalar(0.5 + entry.radius * t);
      entry.mesh.material.opacity = 0.35 * (1 - t);
    }
  }

  for (let i = activeMarkers.length - 1; i >= 0; i--) {
    const entry = activeMarkers[i];
    if (!isAlive(entry.target) || now > entry.expires) {
      state.scene.remove(entry.marker);
      entry.marker.material.dispose();
      activeMarkers.splice(i, 1);
      continue;
    }
    const pos = getEntityPosition(entry.target);
    if (!pos) continue;
    entry.pulse += delta * 5;
    entry.marker.position.set(pos.x, pos.y + 9 + Math.sin(entry.pulse) * 0.5, pos.z);
    entry.marker.rotation.z += delta * 2;
    entry.marker.material.opacity = 0.45 + Math.sin(entry.pulse) * 0.2;
  }
}
