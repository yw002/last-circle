// HUD update functions

import { state } from '../state.js';
import { RELOAD_DURATION, WAVE_CONFIG } from '../config.js';

export function updateUI() {
  let hpPercent = Math.max(0, (state.player.health / state.player.maxHealth) * 100);
  document.getElementById('health-bar').style.width = hpPercent + '%';
  document.getElementById('health-bar').style.backgroundColor = hpPercent > 50 ? '#4caf50' : hpPercent > 20 ? '#f39c12' : '#e74c3c';

  document.getElementById('weapon-info').innerText = `${state.player.weapon.name} | ${state.player.weapon.ammo}/${state.player.sharedAmmo}`;
  if (state.player.isReloading) {
    let elapsed = Date.now() - state.reloadStartTime;
    let progress = Math.min(100, (elapsed / RELOAD_DURATION) * 100);
    document.getElementById('weapon-info').innerText += ` [${Math.floor(progress)}%]`;
  }

  for (let i = 0; i < 2; i++) {
    let slotEl = document.getElementById(`slot-${i + 1}`);
    if (state.player.inventory[i]) {
      slotEl.innerText = state.player.inventory[i].name;
    } else {
      slotEl.innerText = `空槽位 (${i + 1})`;
    }
    if (i === state.player.currentWeaponIndex) {
      slotEl.className = 'inv-slot active';
    } else {
      slotEl.className = 'inv-slot';
    }
  }

  if (state.player.helmet) {
    document.getElementById('ui-helmet').innerText = state.player.helmet.name;
    document.getElementById('ui-helmet').style.color = '#' + state.player.helmet.color.toString(16);
  }
  if (state.player.armor) {
    document.getElementById('ui-armor').innerText = state.player.armor.name;
    document.getElementById('ui-armor').style.color = '#' + state.player.armor.color.toString(16);
  }
  if (state.player.weapon && state.player.weapon.scope) {
    document.getElementById('ui-scope').innerText = state.player.weapon.scope.name;
    document.getElementById('ui-scope').style.color = '#' + state.player.weapon.scope.color.toString(16);
  } else {
    document.getElementById('ui-scope').innerText = '机瞄';
    document.getElementById('ui-scope').style.color = 'white';
  }

  // Wave survival info (replaces alive count + zone timer)
  const wave = state.wave;
  let infoStr = `<span style="color:#f1c40f">第${wave.number}/${WAVE_CONFIG.TOTAL_WAVES}关</span> | 击杀: ${state.player.kills}`;

  if (wave.phase === 'rest' && wave.restTimer > 0) {
    infoStr += `<br><span style="color:#2ecc71">休整中... ${Math.ceil(wave.restTimer)}秒后开始下一关</span>`;
  } else if (wave.phase === 'spawning' || wave.phase === 'active') {
    infoStr += `<br><span style="color:#e74c3c">敌人剩余: ${wave.enemiesRemaining}</span>`;
  } else if (wave.phase === 'boss') {
    infoStr += `<br><span style="color:#ff4444">⚠ BOSS关！敌人剩余: ${wave.enemiesRemaining}</span>`;
  } else if (wave.phase === 'victory') {
    infoStr += `<br><span style="color:#f1c40f">🏆 通关！总击杀: ${wave.totalKills}</span>`;
  }

  if (state.player.isParachuting) infoStr += `<br><span style="color:#f1c40f">正在跳伞... (控制WASD降落)</span>`;

  document.getElementById('info').innerHTML = infoStr;
}
