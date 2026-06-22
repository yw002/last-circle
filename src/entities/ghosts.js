// Ghost entity subsystem

import * as THREE from 'three';
import { state } from '../state.js';
import { getTerrainHeight } from '../world/terrain.js';
import { playGhostWhisper } from '../systems/audio.js';

// Shared geometries (created once at module load)
const ghostMat = new THREE.MeshBasicMaterial({
  color: 0xccffff,
  transparent: true,
  opacity: 0.0,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide,
  depthWrite: false
});

const bodyGeo = new THREE.ConeGeometry(2, 8, 16, 1, true);
bodyGeo.translate(0, -1, 0);

const headGeo = new THREE.SphereGeometry(2, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
headGeo.translate(0, 3, 0);

const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
const eyeGeo = new THREE.PlaneGeometry(0.5, 0.8);

export function initGhosts() {
  // Wave mode: ghosts spawned dynamically by waveManager
}

export function spawnSingleGhost(x, z, scaling = null) {
  const ghostGroup = new THREE.Group();
  const body = new THREE.Mesh(bodyGeo, ghostMat.clone());
  const head = new THREE.Mesh(headGeo, ghostMat.clone());

  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.6, 3.5, 1.95);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(0.6, 3.5, 1.95);

  ghostGroup.add(body, head, eyeL, eyeR);

  let y = getTerrainHeight(x, z) + 5;
  ghostGroup.position.set(x, y, z);
  state.scene.add(ghostGroup);

  const ghost = {
    mesh: ghostGroup,
    bodyMesh: body,
    headMesh: head,
    x: x, z: z, originY: y,
    timeOffset: Math.random() * 100,
    targetOpacity: 0.0,
    currentOpacity: 0.0,
    state: 'hidden',
    stateTimer: 0
  };
  state.ghosts.push(ghost);
  return ghost;
}

export function updateGhosts(delta) {
  let playerPos = state.controls.getObject().position;

  state.ghosts.forEach(ghost => {
    ghost.timeOffset += delta;
    let dSq = ghost.mesh.position.distanceToSquared(playerPos);

    if (dSq < 150 * 150) {
      if (ghost.state === 'hidden' && Math.random() < 0.005) {
        ghost.state = 'appearing';
        ghost.targetOpacity = 0.5 + Math.random() * 0.3;
        ghost.stateTimer = 5 + Math.random() * 5;
        playGhostWhisper(ghost.mesh.position);

        let angle = Math.random() * Math.PI * 2;
        let dist = 15 + Math.random() * 30;
        ghost.x = playerPos.x + Math.cos(angle) * dist;
        ghost.z = playerPos.z + Math.sin(angle) * dist;
        ghost.originY = getTerrainHeight(ghost.x, ghost.z) + 5;
      }
    } else {
      if (ghost.state !== 'hidden' && ghost.state !== 'vanishing') {
        ghost.state = 'vanishing';
      }
    }

    if (ghost.state === 'appearing') {
      ghost.currentOpacity = THREE.MathUtils.lerp(ghost.currentOpacity, ghost.targetOpacity, delta * 2);
      ghost.stateTimer -= delta;
      if (ghost.stateTimer <= 0) ghost.state = 'vanishing';
    } else if (ghost.state === 'vanishing') {
      ghost.currentOpacity = THREE.MathUtils.lerp(ghost.currentOpacity, 0, delta * 1.5);
      if (ghost.currentOpacity < 0.01) {
        ghost.currentOpacity = 0;
        ghost.state = 'hidden';
      }
    }

    ghost.bodyMesh.material.opacity = ghost.currentOpacity;
    ghost.headMesh.material.opacity = ghost.currentOpacity;

    if (ghost.currentOpacity > 0) {
      ghost.mesh.position.y = ghost.originY + Math.sin(ghost.timeOffset * 2) * 2;

      let dirX = playerPos.x - ghost.x;
      let dirZ = playerPos.z - ghost.z;
      let len = Math.sqrt(dirX * dirX + dirZ * dirZ);
      if (len > 0) {
        ghost.x += (dirX / len) * delta * 4;
        ghost.z += (dirZ / len) * delta * 4;
      }
      ghost.mesh.position.x = ghost.x;
      ghost.mesh.position.z = ghost.z;

      ghost.mesh.lookAt(playerPos.x, ghost.mesh.position.y, playerPos.z);
    }
  });
}
