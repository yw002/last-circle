// Blue zone (playzone) system

import * as THREE from 'three';
import { state } from '../state.js';
import { playerHit } from '../entities/player.js';
import { botDied } from '../entities/bots.js';
import { addKillFeed } from '../ui/notices.js';

export function initZone() {
  const zoneGeo = new THREE.CylinderGeometry(1, 1, 2000, 48, 1, true);
  const zoneMat = new THREE.MeshBasicMaterial({
    color: 0x0000ff,
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide
  });
  state.zoneMesh = new THREE.Mesh(zoneGeo, zoneMat);
  state.zoneMesh.scale.set(state.zone.radius, 1, state.zone.radius);
  state.zoneMesh.position.set(0, 500, 0);
  state.scene.add(state.zoneMesh);
}

export function updateZone(delta) {
  let now = Date.now();
  if (now - state.zone.lastTick > 1000) {
    state.zone.lastTick = now;
    state.zone.nextShrinkTime--;

    if (state.zone.nextShrinkTime <= 0) {
      state.zone.phase++;
      state.zone.targetRadius = state.zone.radius * 0.6;
      let angle = Math.random() * Math.PI * 2;
      let dist = Math.random() * (state.zone.radius - state.zone.targetRadius);
      state.zone.targetX = state.zone.x + Math.cos(angle) * dist;
      state.zone.targetZ = state.zone.z + Math.sin(angle) * dist;
      state.zone.nextShrinkTime = 60;
      addKillFeed("<span style='color:#3498db'>安全区开始缩小！</span>");
    }

    if (state.player.alive && !state.player.isParachuting) {
      let pPos = state.controls.getObject().position;
      let dist = Math.sqrt(Math.pow(pPos.x - state.zone.x, 2) + Math.pow(pPos.z - state.zone.z, 2));
      if (dist > state.zone.radius) {
        playerHit(state.zone.phase * 2);
        document.getElementById('zone-overlay').style.opacity = '1';
      } else {
        document.getElementById('zone-overlay').style.opacity = '0';
      }
    }

    state.bots.forEach(bot => {
      if (bot.alive && !bot.isParachuting) {
        let dist = Math.sqrt(
          Math.pow(bot.mesh.position.x - state.zone.x, 2) +
          Math.pow(bot.mesh.position.z - state.zone.z, 2)
        );
        if (dist > state.zone.radius) {
          bot.health -= state.zone.phase * 2;
          if (bot.health <= 0) botDied(bot, "毒圈 (Playzone)");
        }
      }
    });
  }

  if (state.zone.radius > state.zone.targetRadius) {
    state.zone.radius -= 15 * delta;
    state.zone.x += (state.zone.targetX - state.zone.x) * 0.05 * delta;
    state.zone.z += (state.zone.targetZ - state.zone.z) * 0.05 * delta;
    state.zoneMesh.scale.set(state.zone.radius, 1, state.zone.radius);
    state.zoneMesh.position.set(state.zone.x, 500, state.zone.z);
  }
}
