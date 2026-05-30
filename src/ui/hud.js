// HUD update functions

import { state } from '../state.js';
import { RELOAD_DURATION } from '../config.js';

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

  let infoStr = `存活 (Alive): ${state.aliveCount} / 100<br>击杀 (Kills): ${state.player.kills}`;
  if (state.player.isParachuting) infoStr += `<br><span style="color:#f1c40f">正在跳伞... (控制WASD降落)</span>`;

  let minutes = Math.floor(state.zone.nextShrinkTime / 60);
  let seconds = Math.floor(state.zone.nextShrinkTime % 60);
  infoStr += `<br><span style="color:#3498db">缩圈倒计时: ${minutes}:${seconds < 10 ? '0' : ''}${seconds}</span>`;

  document.getElementById('info').innerHTML = infoStr;
}
