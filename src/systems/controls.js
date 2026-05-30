// Keyboard and mouse input handling

import { state } from '../state.js';
import { reloadWeapon, switchWeapon, cancelReload, fireWeapon } from '../entities/player.js';

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
      if (state.player.isReloading) {
        cancelReload();
      }
      // Fire immediately for slow weapons (fireRate > 200ms)
      if (state.player.weapon && state.player.weapon.fireRate > 200) {
        fireWeapon();
      }
    } else if (e.button === 2) {
      state.player.isADS = !state.player.isADS;
    }
  });

  document.addEventListener('mouseup', (e) => {
    if (e.button === 0) state.isMouseDown = false;
  });
}
