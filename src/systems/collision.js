// Shared collision detection utilities for all entities

import * as THREE from 'three';
import { state } from '../state.js';
import { MAP_SIZE } from '../config.js';

// Temporary vectors for collision calculations
const _tempBox = new THREE.Box3();
const _tempSize = new THREE.Vector3();
const _tempCenter = new THREE.Vector3();

function hasVerticalOverlap(y, entityHeight, box) {
  const footY = y - entityHeight;
  const headY = y;
  return headY > box.min.y && footY < box.max.y;
}

function segmentIntersectsExpandedBoxXZ(oldX, oldZ, newX, newZ, box, radius) {
  const minX = box.min.x - radius;
  const maxX = box.max.x + radius;
  const minZ = box.min.z - radius;
  const maxZ = box.max.z + radius;
  const dx = newX - oldX;
  const dz = newZ - oldZ;
  let tMin = 0;
  let tMax = 1;

  // Slab test in XZ catches fast movement through narrow trunks between frames.
  if (Math.abs(dx) < 0.0001) {
    if (oldX < minX || oldX > maxX) return false;
  } else {
    const inv = 1 / dx;
    let t1 = (minX - oldX) * inv;
    let t2 = (maxX - oldX) * inv;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }

  if (Math.abs(dz) < 0.0001) {
    if (oldZ < minZ || oldZ > maxZ) return false;
  } else {
    const inv = 1 / dz;
    let t1 = (minZ - oldZ) * inv;
    let t2 = (maxZ - oldZ) * inv;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }

  return true;
}

// Check if a position collides with any tree/rock collider
export function checkColliderCollision(x, y, z, entityHeight = 5, colliders = state.colliders) {
  // Create a small bounding box around the entity
  _tempSize.set(2, entityHeight, 2);
  _tempCenter.set(x, y, z);
  _tempBox.setFromCenterAndSize(_tempCenter, _tempSize);

  for (let i = 0; i < colliders.length; i++) {
    const box = colliders[i];
    if (_tempBox.intersectsBox(box)) {
      // Only block if entity is below the top of the collider
      if (hasVerticalOverlap(y, entityHeight, box)) {
        return true; // Collision detected
      }
    }
  }
  return false;
}

export function checkSweptColliderCollision(oldX, oldZ, newX, newZ, y, entityHeight = 10, colliders = state.colliders, radius = 1.5) {
  for (let i = 0; i < colliders.length; i++) {
    const box = colliders[i];
    if (!hasVerticalOverlap(y, entityHeight, box)) continue;
    if (segmentIntersectsExpandedBoxXZ(oldX, oldZ, newX, newZ, box, radius)) return true;
  }
  return false;
}

// Check if a position is inside a house (for preventing entry)
export function checkHouseWallCollision(x, y, z, doors = state.doors) {
  for (let i = 0; i < doors.length; i++) {
    const d = doors[i];
    const hPos = d.housePos;
    const dx = x - hPos.x;
    const dz = z - hPos.z;
    const baseY = hPos.baseHeight ?? hPos.y;
    const footY = y - 10;
    const headY = y;

    // Check body overlap with the wall height, not just the camera/eye height.
    if (headY > baseY && footY < baseY + 24) {
      const absX = Math.abs(dx);
      const absZ = Math.abs(dz);

      if (absX < 16.2 && absZ < 16.2) {
        // Check each wall region
        // Left wall
        if (dx >= -16.2 && dx <= -13.5 && dz >= -16.2 && dz <= 16.2) return true;
        // Right wall
        if (dx >= 13.5 && dx <= 16.2 && dz >= -16.2 && dz <= 16.2) return true;
        // Back wall
        if (dz >= -16.2 && dz <= -13.5 && dx >= -16.2 && dx <= 16.2) return true;
        // Front wall left
        if (dz >= 13.5 && dz <= 16.2 && dx >= -16.2 && dx <= -3.1) return true;
        // Front wall right
        if (dz >= 13.5 && dz <= 16.2 && dx >= 3.1 && dx <= 16.2) return true;
        // Door (closed)
        if (!d.isOpen && dz >= 13.5 && dz <= 16.2 && dx >= -3.25 && dx <= 3.25) return true;
      }
    }
  }
  return false;
}

// Check map boundaries
export function checkBoundary(x, z) {
  return Math.abs(x) > MAP_SIZE / 2 || Math.abs(z) > MAP_SIZE / 2;
}

// Combined collision check for entity movement
export function checkEntityCollision(oldX, oldZ, newX, newZ, y, entityHeight = 5, options = {}) {
  const colliders = options.colliders || state.colliders;
  const doors = options.doors || state.doors;

  // Check tree/rock collision
  if (!options.skipColliders && checkColliderCollision(newX, y, newZ, entityHeight, colliders)) {
    return { blocked: true, x: oldX, z: oldZ };
  }

  // Check house wall collision
  if (!options.skipHouses && checkHouseWallCollision(newX, y, newZ, doors)) {
    return { blocked: true, x: oldX, z: oldZ };
  }

  // Check boundary
  if (checkBoundary(newX, newZ)) {
    return { blocked: true, x: oldX, z: oldZ };
  }

  return { blocked: false, x: newX, z: newZ };
}
