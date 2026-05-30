// House/door interaction utilities

import { state } from '../state.js';

export function getHouseObjectIsInside(position) {
  if (!position) return null;
  for (let i = 0; i < state.doors.length; i++) {
    let d = state.doors[i];
    let hPos = d.housePos;
    let dx = Math.abs(position.x - hPos.x);
    let dz = Math.abs(position.z - hPos.z);
    let dy = position.y - hPos.y;
    if (dx < 14.5 && dz < 14.5 && dy > 0 && dy < 24) {
      return d;
    }
  }
  return null;
}

export function getHousePlayerIsInside() {
  return getHouseObjectIsInside(state.controls.getObject().position);
}
