// Keyboard and mouse input handling

import { state } from '../state.js';
import { weapons } from '../config.js';
import { reloadWeapon, switchWeapon, cancelReload, fireWeapon, equipWeapon } from '../entities/player.js';
import { showNotice } from '../ui/notices.js';
import { toggleADS } from './ads.js';
import { toggleCollisionDebug } from './collisionDebug.js';
import { toggleHealthBars } from './combatFeedback.js';
import { getNearbyVehicle, enterVehicle, exitVehicle } from '../world/vehicles.js';

let lastWheelSwitchTime = 0;
let cheatBuffer = '';

function handleWeaponCheat(event) {
  if (!state.controls.isLocked || !state.player.alive) return false;
  if (!event.key || !/^[a-z0-9]$/i.test(event.key)) return false;

  cheatBuffer = (cheatBuffer + event.key.toLowerCase()).slice(-12);
  const match = cheatBuffer.match(/weapon([1-6])$/);
  if (!match) return false;

  const specialWeapons = weapons.filter(w => w.special);
  const weapon = specialWeapons[Number(match[1]) - 1];
  if (!weapon) return false;

  const slot = state.player.currentWeaponIndex || 0;
  const grantedWeapon = { ...weapon, ammo: weapon.maxAmmo, scope: null };
  state.player.inventory[slot] = grantedWeapon;
  equipWeapon(slot);
  showNotice(`作弊码: ${grantedWeapon.name}`, '#d15cff');
  cheatBuffer = '';
  event.preventDefault();
  return true;
}

function clearInputState() {
  // Pointer lock can be interrupted by the browser; clear held inputs to avoid a stuck controls state.
  state.moveForward = false;
  state.moveBackward = false;
  state.moveLeft = false;
  state.moveRight = false;
  state.isSprinting = false;
  state.isMouseDown = false;
  state.interactKey = false;
  state.interactEKey = false;
}

export function initControls() {
  document.addEventListener('contextmenu', e => e.preventDefault());

  document.addEventListener('keydown', (event) => {
    if (handleWeaponCheat(event)) return;

    switch (event.code) {
      case 'ArrowUp': case 'KeyW': state.moveForward = true; break;
      case 'ArrowLeft': case 'KeyA': state.moveLeft = true; break;
      case 'ArrowDown': case 'KeyS': state.moveBackward = true; break;
      case 'ArrowRight': case 'KeyD': state.moveRight = true; break;
      case 'Space':
        if (state.canJump && !state.player.isParachuting) {
          state.velocity.y += 120;
          state.canJump = false;
        }
        break;
      case 'ShiftLeft': state.isSprinting = true; break;
      case 'KeyF': state.interactKey = true; break;
      case 'KeyE':
        // Vehicle enter/exit
        if (state.currentVehicle) {
          exitVehicle();
        } else if (state.controls && state.controls.getObject()) {
          const vehicle = getNearbyVehicle(state.controls.getObject().position);
          if (vehicle) {
            enterVehicle(vehicle);
            showNotice(`进入${vehicle.type === 'jeep' ? '吉普车' : '摩托车'}`, '#44ff44');
          }
        }
        state.interactEKey = true;
        break;
      case 'KeyR': reloadWeapon(); break;
      case 'Digit1': case 'Numpad1': event.preventDefault(); switchWeapon(0); break;
      case 'Digit2': case 'Numpad2': event.preventDefault(); switchWeapon(1); break;
      case 'F3':
        event.preventDefault();
        toggleCollisionDebug();
        break;
      case 'F4':
        event.preventDefault();
        toggleHealthBars();
        break;
    }
  });

  document.addEventListener('keyup', (event) => {
    switch (event.code) {
      case 'ArrowUp': case 'KeyW': state.moveForward = false; break;
      case 'ArrowLeft': case 'KeyA': state.moveLeft = false; break;
      case 'ArrowDown': case 'KeyS': state.moveBackward = false; break;
      case 'ArrowRight': case 'KeyD': state.moveRight = false; break;
      case 'ShiftLeft': state.isSprinting = false; break;
      case 'KeyF': state.interactKey = false; break;
      case 'KeyE': state.interactEKey = false; break;
    }
  });

  document.addEventListener('mousedown', (e) => {
    if (!state.controls.isLocked) return;
    if (e.button === 0) {
      state.isMouseDown = true;
      // Don't cancel reload on left click - reload should complete uninterrupted
      // fireWeapon() already checks isReloading and will not fire during reload
      if (!state.player.isReloading && state.player.weapon && state.player.weapon.fireRate > 200) {
        fireWeapon();
      }
    } else if (e.button === 2) {
      toggleADS();
    }
  });

  document.addEventListener('mouseup', (e) => {
    if (e.button === 0) state.isMouseDown = false;
  });

  document.addEventListener('wheel', (event) => {
    if (!state.controls.isLocked || !state.player.alive) return;
    if (!state.player.inventory || state.player.inventory.length < 2) return;

    const now = performance.now();
    if (now - lastWheelSwitchTime < 140) {
      event.preventDefault();
      return;
    }

    // Mouse wheel cycles weapon slots through the same path as number keys.
    const direction = event.deltaY > 0 ? 1 : -1;
    const slotCount = state.player.inventory.length;
    let nextIndex = state.player.currentWeaponIndex;

    for (let i = 0; i < slotCount; i++) {
      nextIndex = (nextIndex + direction + slotCount) % slotCount;
      if (state.player.inventory[nextIndex]) {
        event.preventDefault();
        lastWheelSwitchTime = now;
        switchWeapon(nextIndex);
        break;
      }
    }
  }, { passive: false });

  window.addEventListener('blur', clearInputState);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearInputState();
  });

  state.controls.addEventListener('unlock', clearInputState);
}
