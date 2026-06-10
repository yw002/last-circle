// Victory chicken celebration effect

import * as THREE from 'three';
import { state } from '../state.js';
import { playVictoryMusic } from './audio.js';
import { getTerrainHeight } from '../world/terrain.js';

let chickenGroup = null;
let chickenParachute = null;
let chickenPhase = 'idle'; // idle, falling, orbiting
let chickenOrbitAngle = 0;
let chickenFireworkTimer = 0;
let fireworks = [];

// Shared geometries
const _bodyGeo = new THREE.SphereGeometry(1.5, 16, 12);
const _headGeo = new THREE.SphereGeometry(0.8, 12, 10);
const _beakGeo = new THREE.ConeGeometry(0.25, 0.6, 4);
const _combGeo = new THREE.ConeGeometry(0.3, 0.6, 3);
const _wingGeo = new THREE.BoxGeometry(1.8, 0.15, 1.0);
const _legGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.8, 6);
const _footGeo = new THREE.BoxGeometry(0.3, 0.05, 0.4);

function createChicken() {
  const group = new THREE.Group();
  const yellow = new THREE.MeshLambertMaterial({ color: 0xf5d442 });
  const orange = new THREE.MeshLambertMaterial({ color: 0xff8c00 });
  const red = new THREE.MeshLambertMaterial({ color: 0xff2222 });
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const black = new THREE.MeshBasicMaterial({ color: 0x000000 });

  // Body
  const body = new THREE.Mesh(_bodyGeo, yellow);
  body.scale.set(1, 0.9, 1.3);
  group.add(body);

  // Head
  const head = new THREE.Mesh(_headGeo, yellow);
  head.position.set(0, 1.2, -0.8);
  group.add(head);

  // Comb (red crown)
  for (let i = 0; i < 3; i++) {
    const comb = new THREE.Mesh(_combGeo, red);
    comb.position.set((i - 1) * 0.2, 1.9, -0.8);
    comb.scale.set(0.7, 1, 0.7);
    group.add(comb);
  }

  // Beak
  const beak = new THREE.Mesh(_beakGeo, orange);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 1.1, -1.5);
  group.add(beak);

  // Eyes
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), white);
  eyeL.position.set(-0.4, 1.4, -1.2);
  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), white);
  eyeR.position.set(0.4, 1.4, -1.2);
  const pupilL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), black);
  pupilL.position.set(-0.42, 1.42, -1.35);
  const pupilR = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), black);
  pupilR.position.set(0.42, 1.42, -1.35);
  group.add(eyeL, eyeR, pupilL, pupilR);

  // Wings
  const wingL = new THREE.Mesh(_wingGeo, yellow);
  wingL.position.set(-1.3, 0.3, 0);
  wingL.rotation.z = 0.3;
  wingL.userData._isWing = true;
  wingL.userData._side = -1;
  group.add(wingL);

  const wingR = new THREE.Mesh(_wingGeo, yellow);
  wingR.position.set(1.3, 0.3, 0);
  wingR.rotation.z = -0.3;
  wingR.userData._isWing = true;
  wingR.userData._side = 1;
  group.add(wingR);

  // Legs
  const legL = new THREE.Mesh(_legGeo, orange);
  legL.position.set(-0.4, -1.5, 0);
  const legR = new THREE.Mesh(_legGeo, orange);
  legR.position.set(0.4, -1.5, 0);
  group.add(legL, legR);

  // Feet
  const footL = new THREE.Mesh(_footGeo, orange);
  footL.position.set(-0.4, -1.9, -0.1);
  const footR = new THREE.Mesh(_footGeo, orange);
  footR.position.set(0.4, -1.9, -0.1);
  group.add(footL, footR);

  // Tail feathers
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xd4a017 });
  for (let i = 0; i < 5; i++) {
    const feather = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 1.2), tailMat);
    feather.position.set((i - 2) * 0.2, 0.5 + Math.abs(i - 2) * 0.15, 1.5);
    feather.rotation.x = -0.4;
    group.add(feather);
  }

  group.scale.set(2, 2, 2);
  return group;
}

function createParachute() {
  const group = new THREE.Group();
  const canopyGeo = new THREE.SphereGeometry(5, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const canopyMat = new THREE.MeshLambertMaterial({ color: 0xff4444, side: THREE.DoubleSide });
  const canopy = new THREE.Mesh(canopyGeo, canopyMat);
  canopy.position.y = 5;
  canopy.scale.y = 0.4;
  group.add(canopy);

  const stringMat = new THREE.LineBasicMaterial({ color: 0xffffff });
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const pts = [
      new THREE.Vector3(Math.cos(angle) * 4.5, 5, Math.sin(angle) * 4.5),
      new THREE.Vector3(0, 0, 0)
    ];
    const stringGeo = new THREE.BufferGeometry().setFromPoints(pts);
    group.add(new THREE.Line(stringGeo, stringMat));
  }
  return group;
}

function spawnFirework(pos) {
  const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff, 0xff8800, 0xff44aa];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });

  for (let i = 0; i < 12; i++) {
    const particle = new THREE.Mesh(new THREE.SphereGeometry(0.3, 4, 4), mat);
    particle.position.copy(pos);
    state.scene.add(particle);

    const angle = (i / 12) * Math.PI * 2;
    const elev = (Math.random() - 0.3) * Math.PI;
    const speed = 8 + Math.random() * 6;
    fireworks.push({
      mesh: particle,
      vx: Math.cos(angle) * Math.cos(elev) * speed,
      vy: Math.sin(elev) * speed + 5,
      vz: Math.sin(angle) * Math.cos(elev) * speed,
      age: 0,
      maxAge: 1.5 + Math.random() * 0.5
    });
  }
}

export function triggerVictoryChicken() {
  if (chickenPhase !== 'idle') return;

  playVictoryMusic();

  // Create chicken + parachute
  chickenGroup = createChicken();
  chickenParachute = createParachute();
  chickenGroup.add(chickenParachute);

  const playerPos = state.controls.getObject().position;
  chickenGroup.position.set(
    playerPos.x + (Math.random() - 0.5) * 50,
    300,
    playerPos.z + (Math.random() - 0.5) * 50
  );
  state.scene.add(chickenGroup);
  chickenPhase = 'falling';
}

export function updateVictory(delta) {
  if (chickenPhase === 'idle') return;

  const playerPos = state.controls.getObject().position;

  if (chickenPhase === 'falling') {
    chickenGroup.position.y -= 40 * delta;
    // Gentle sway
    chickenGroup.position.x += Math.sin(performance.now() / 500) * 2 * delta;

    const groundY = getTerrainHeight(chickenGroup.position.x, chickenGroup.position.z) + 3;
    if (chickenGroup.position.y <= groundY) {
      chickenGroup.position.y = groundY;
      // Remove parachute
      if (chickenParachute) {
        chickenGroup.remove(chickenParachute);
        chickenParachute = null;
      }
      chickenPhase = 'orbiting';
      chickenOrbitAngle = Math.atan2(
        chickenGroup.position.z - playerPos.z,
        chickenGroup.position.x - playerPos.x
      );
    }
  }

  if (chickenPhase === 'orbiting') {
    // Orbit around player
    chickenOrbitAngle += delta * 1.2;
    const radius = 15;
    const groundY = getTerrainHeight(playerPos.x, playerPos.z) + 3;
    chickenGroup.position.x = playerPos.x + Math.cos(chickenOrbitAngle) * radius;
    chickenGroup.position.z = playerPos.z + Math.sin(chickenOrbitAngle) * radius;
    chickenGroup.position.y = groundY + Math.sin(performance.now() / 300) * 0.5;

    // Face direction of movement
    chickenGroup.rotation.y = -chickenOrbitAngle + Math.PI / 2;

    // Flap wings
    const t = performance.now() / 100;
    chickenGroup.traverse(child => {
      if (child.userData && child.userData._isWing) {
        child.rotation.z = child.userData._side * (0.3 + Math.sin(t) * 0.5);
      }
    });

    // Fireworks every 0.5s
    chickenFireworkTimer += delta;
    if (chickenFireworkTimer >= 0.5) {
      chickenFireworkTimer = 0;
      if (fireworks.length < 80) { // Cap particles for performance
        spawnFirework(new THREE.Vector3(
          chickenGroup.position.x + (Math.random() - 0.5) * 5,
          chickenGroup.position.y + 5 + Math.random() * 10,
          chickenGroup.position.z + (Math.random() - 0.5) * 5
        ));
      }
    }
  }

  // Update firework particles
  for (let i = fireworks.length - 1; i >= 0; i--) {
    const f = fireworks[i];
    f.age += delta;
    f.mesh.position.x += f.vx * delta;
    f.mesh.position.y += f.vy * delta;
    f.mesh.position.z += f.vz * delta;
    f.vy -= 15 * delta; // Gravity
    f.mesh.material.opacity = Math.max(0, 1 - f.age / f.maxAge);

    if (f.age >= f.maxAge) {
      state.scene.remove(f.mesh);
      fireworks.splice(i, 1);
    }
  }
}
