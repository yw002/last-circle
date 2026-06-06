// Keyboard and mouse input handling

import { state } from '../state.js';
import { reloadWeapon, switchWeapon, cancelReload, fireWeapon } from '../entities/player.js';
import { toggleADS } from './ads.js';
import { toggleCollisionDebug } from './collisionDebug.js';

let lastWheelSwitchTime = 0;

function clearInputState() {
  // Pointer lock can be interrupted by the browser; clear held inputs to avoid a stuck controls state.
  state.moveForward = false;
  state.moveBackward = false;
  state.moveLeft = false;
  state.moveRight = false;
  state.isSprinting = false;
  state.isMouseDown = false;
  state.interactKey = false;
}

export function initControls() {
  document.addEventListener('contextmenu', e => e.preventDefault());

  document.addEventListener('keydown', (event) => {
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
      case 'KeyR': reloadWeapon(); break;
      case 'Digit1': case 'Numpad1': event.preventDefault(); switchWeapon(0); break;
      case 'Digit2': case 'Numpad2': event.preventDefault(); switchWeapon(1); break;
      case 'F3':
        event.preventDefault();
        toggleCollisionDebug();
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
