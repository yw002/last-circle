// UFO and Alien system
// Flying saucers appear in the sky, release aliens that attack players

import * as THREE from 'three';
import { state } from '../state.js';
import { MAP_SIZE } from '../config.js';
import { getTerrainHeight, getGroundHeight } from '../world/terrain.js';
import { playerHit } from './player.js';
import { botDied } from './bots.js';
import { spawnSingleLoot } from '../world/loot.js';
import { addKillFeed } from '../ui/notices.js';
import { updateUI } from '../ui/hud.js';
import { showNotice } from '../ui/notices.js';
import { playSound } from '../systems/audio.js';
import { spawnBlood, spawnWorldMuzzleFlash } from '../systems/particles.js';
import { checkEntityCollision, resolveEntityCollisions } from '../systems/collision.js';
import { getNearbyBots, getNearbyColliders, getNearbyDoors } from '../systems/spatial.js';

let ufos = [];
let aliens = [];
let alienBullets = [];
const _alienMoveDir = new THREE.Vector3();
const _alienHeadPos = new THREE.Vector3();
const _alienShotDir = new THREE.Vector3();
const _alienBulletDir = new THREE.Vector3();
const _alienRaycaster = new THREE.Raycaster();

// UFO model
function createUFOMesh() {
  const group = new THREE.Group();

  // Main saucer body
  const saucerGeo = new THREE.SphereGeometry(15, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3);
  const saucerMat = new THREE.MeshLambertMaterial({
    color: 0x888888,
    emissive: 0x222222,
    emissiveIntensity: 0.3
  });
  const saucer = new THREE.Mesh(saucerGeo, saucerMat);
  saucer.rotation.x = Math.PI;
  saucer.position.y = 2;
  group.add(saucer);

  // Bottom dome
  const domeGeo = new THREE.SphereGeometry(10, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const domeMat = new THREE.MeshLambertMaterial({
    color: 0x44ff44,
    transparent: true,
    opacity: 0.6,
    emissive: 0x00ff00,
    emissiveIntensity: 0.5
  });
  const dome = new THREE.Mesh(domeGeo, domeMat);
  dome.position.y = -2;
  group.add(dome);

  // Lights around the edge
  const lightGeo = new THREE.SphereGeometry(1, 8, 8);
  const lightColors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const lightMat = new THREE.MeshBasicMaterial({
      color: lightColors[i % lightColors.length],
      emissive: lightColors[i % lightColors.length],
      emissiveIntensity: 1.0
    });
    const light = new THREE.Mesh(lightGeo, lightMat);
    light.position.set(Math.cos(angle) * 12, 0, Math.sin(angle) * 12);
    light.userData.lightIndex = i;
    group.add(light);
  }

  // Central beam (for abduction)
  const beamGeo = new THREE.CylinderGeometry(8, 2, 100, 16, 1, true);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0x00ff88,
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.y = -52;
  beam.visible = false;
  beam.userData.isBeam = true;
  group.add(beam);

  return group;
}

// Alien model
function createAlienMesh() {
  const group = new THREE.Group();

  // Body (slender)
  const bodyGeo = new THREE.CylinderGeometry(0.8, 1.2, 4, 8);
  const bodyMat = new THREE.MeshLambertMaterial({
    color: 0x44cc44,
    emissive: 0x226622,
    emissiveIntensity: 0.3
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 2;
  group.add(body);

  // Head (large, elongated)
  const headGeo = new THREE.SphereGeometry(1.5, 12, 8);
  const headMat = new THREE.MeshLambertMaterial({
    color: 0x55dd55,
    emissive: 0x338833,
    emissiveIntensity: 0.3
  });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 5;
  head.scale.set(1, 1.3, 1);
  group.add(head);

  // Eyes (large, black)
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const eyeGeo = new THREE.SphereGeometry(0.5, 8, 8);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.8, 5.2, 1.2);
  eyeL.scale.set(1.2, 0.8, 0.5);
  group.add(eyeL);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(0.8, 5.2, 1.2);
  eyeR.scale.set(1.2, 0.8, 0.5);
  group.add(eyeR);

  // Glowing pupils
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
  const pupilGeo = new THREE.SphereGeometry(0.2, 8, 8);
  const pupilL = new THREE.Mesh(pupilGeo, pupilMat);
  pupilL.position.set(-0.8, 5.2, 1.5);
  group.add(pupilL);
  const pupilR = new THREE.Mesh(pupilGeo, pupilMat);
  pupilR.position.set(0.8, 5.2, 1.5);
  group.add(pupilR);

  // Arms (thin, long)
  const armGeo = new THREE.CylinderGeometry(0.2, 0.15, 3, 6);
  const armL = new THREE.Mesh(armGeo, bodyMat);
  armL.position.set(-1.5, 2.5, 0);
  armL.rotation.z = 0.3;
  group.add(armL);
  const armR = new THREE.Mesh(armGeo, bodyMat);
  armR.position.set(1.5, 2.5, 0);
  armR.rotation.z = -0.3;
  group.add(armR);

  // Legs (thin)
  const legGeo = new THREE.CylinderGeometry(0.25, 0.2, 2.5, 6);
  const legL = new THREE.Mesh(legGeo, bodyMat);
  legL.position.set(-0.5, 0.5, 0);
  group.add(legL);
  const legR = new THREE.Mesh(legGeo, bodyMat);
  legR.position.set(0.5, 0.5, 0);
  group.add(legR);

  // Weapon (alien blaster)
  const weaponGeo = new THREE.CylinderGeometry(0.15, 0.3, 2, 6);
  const weaponMat = new THREE.MeshLambertMaterial({
    color: 0x666666,
    emissive: 0x333333,
    emissiveIntensity: 0.2
  });
  const weapon = new THREE.Mesh(weaponGeo, weaponMat);
  weapon.position.set(1.8, 2, 0.5);
  weapon.rotation.z = -Math.PI / 4;
  group.add(weapon);

  return { group, body, head, eyeL, eyeR };
}

export function initAliens() {
  // Spawn initial UFOs
  for (let i = 0; i < 3; i++) {
    spawnUFO();
  }
  state.aliens = aliens;
}

function spawnUFO() {
  const mesh = createUFOMesh();

  // Random position in sky
  let x = (Math.random() - 0.5) * MAP_SIZE * 0.6;
  let z = (Math.random() - 0.5) * MAP_SIZE * 0.6;
  let y = 300 + Math.random() * 200;

  mesh.position.set(x, y, z);
  state.scene.add(mesh);

  const ufo = {
    mesh: mesh,
    x: x, z: z,
    y: y,
    targetX: x,
    targetZ: z,
    state: 'hovering', // 'hovering', 'descending', 'releasing', 'ascending', 'moving'
    timer: 0,
    releaseCount: 0,
    maxReleases: 3 + Math.floor(Math.random() * 3),
    speed: 20 + Math.random() * 30,
    beamTimer: 0,
    aliensReleased: []
  };

  ufos.push(ufo);
  return ufo;
}

function spawnAlien(x, y, z) {
  const { group, body, head, eyeL, eyeR } = createAlienMesh();

  group.position.set(x, y, z);
  state.scene.add(group);

  const idx = aliens.length;
  body.userData = { isAlien: true, alienIndex: idx, isHeadshot: false };
  head.userData = { isAlien: true, alienIndex: idx, isHeadshot: true };
  state.objects.push(body, head);

  const alien = {
    id: idx,
    mesh: group,
    bodyMesh: body,
    headMesh: head,
    health: 80,
    alive: true,
    state: 'descending', // 'descending', 'wander', 'attack'
    target: null,
    lastFire: 0,
    vx: 0, vz: 0,
    changeDirTime: 0,
    speed: 15 + Math.random() * 10,
    weaponDamage: 20
  };

  aliens.push(alien);
  return alien;
}

export function updateAliens(delta) {
  let now = Date.now();
  let playerPos = state.controls.getObject().position;

  // Update UFOs
  ufos.forEach(ufo => {
    if (!ufo.mesh) return;

    ufo.timer += delta;

    // Animate lights
    ufo.mesh.children.forEach(child => {
      if (child.userData.lightIndex !== undefined) {
        child.material.opacity = 0.5 + Math.sin(now * 0.005 + child.userData.lightIndex) * 0.5;
      }
    });

    switch (ufo.state) {
      case 'hovering':
        // Float in place
        ufo.mesh.position.y = ufo.y + Math.sin(now * 0.001) * 10;

        // Move slowly
        ufo.mesh.position.x += Math.cos(now * 0.0005) * ufo.speed * delta;
        ufo.mesh.position.z += Math.sin(now * 0.0005) * ufo.speed * delta;

        // After some time, descend to release aliens
        if (ufo.timer > 15 + Math.random() * 20) {
          ufo.state = 'descending';
          ufo.timer = 0;
          // Find a target position near player
          let angle = Math.random() * Math.PI * 2;
          let dist = 100 + Math.random() * 200;
          ufo.targetX = playerPos.x + Math.cos(angle) * dist;
          ufo.targetZ = playerPos.z + Math.sin(angle) * dist;
        }
        break;

      case 'descending':
        // Move toward target
        let dx = ufo.targetX - ufo.mesh.position.x;
        let dz = ufo.targetZ - ufo.mesh.position.z;
        let dist = Math.sqrt(dx * dx + dz * dz);

        if (dist > 10) {
          ufo.mesh.position.x += (dx / dist) * ufo.speed * 2 * delta;
          ufo.mesh.position.z += (dz / dist) * ufo.speed * 2 * delta;
        }

        // Descend
        if (ufo.mesh.position.y > 150) {
          ufo.mesh.position.y -= 50 * delta;
        } else {
          ufo.state = 'releasing';
          ufo.timer = 0;
          // Activate beam
          ufo.mesh.children.forEach(child => {
            if (child.userData.isBeam) child.visible = true;
          });
        }
        break;

      case 'releasing':
        // Release aliens one by one
        if (ufo.timer > 2 && ufo.releaseCount < ufo.maxReleases) {
          ufo.timer = 0;
          ufo.releaseCount++;

          // Spawn alien below UFO
          let alienX = ufo.mesh.position.x + (Math.random() - 0.5) * 20;
          let alienZ = ufo.mesh.position.z + (Math.random() - 0.5) * 20;
          let alienY = ufo.mesh.position.y - 50;
          let groundY = getTerrainHeight(alienX, alienZ);
          alienY = Math.max(alienY, groundY + 2);

          const alien = spawnAlien(alienX, alienY, alienZ);
          ufo.aliensReleased.push(alien);

          // Only show notification once per UFO
          if (!ufo.notified) {
            showNotice("👽 外星人入侵！UFO正在释放外星人！", "#00ff88");
            ufo.notified = true;
          }
        }

        // All aliens released, ascend
        if (ufo.releaseCount >= ufo.maxReleases) {
          ufo.state = 'ascending';
          ufo.timer = 0;
          // Deactivate beam
          ufo.mesh.children.forEach(child => {
            if (child.userData.isBeam) child.visible = false;
          });
        }
        break;

      case 'ascending':
        // Rise up
        ufo.mesh.position.y += 80 * delta;

        if (ufo.mesh.position.y > 400) {
          ufo.state = 'moving';
          ufo.timer = 0;
          // Move to new position
          ufo.targetX = (Math.random() - 0.5) * MAP_SIZE * 0.6;
          ufo.targetZ = (Math.random() - 0.5) * MAP_SIZE * 0.6;
        }
        break;

      case 'moving':
        // Move to new position
        let mdx = ufo.targetX - ufo.mesh.position.x;
        let mdz = ufo.targetZ - ufo.mesh.position.z;
        let mdist = Math.sqrt(mdx * mdx + mdz * mdz);

        if (mdist > 20) {
          ufo.mesh.position.x += (mdx / mdist) * ufo.speed * 3 * delta;
          ufo.mesh.position.z += (mdz / mdist) * ufo.speed * 3 * delta;
        } else {
          ufo.state = 'hovering';
          ufo.timer = 0;
          ufo.releaseCount = 0;
          ufo.aliensReleased = [];
        }
        break;
    }

    // Rotate UFO
    ufo.mesh.rotation.y += delta * 0.5;

    // Keep in bounds
    if (Math.abs(ufo.mesh.position.x) > MAP_SIZE / 2) {
      ufo.mesh.position.x = Math.sign(ufo.mesh.position.x) * MAP_SIZE / 2;
    }
    if (Math.abs(ufo.mesh.position.z) > MAP_SIZE / 2) {
      ufo.mesh.position.z = Math.sign(ufo.mesh.position.z) * MAP_SIZE / 2;
    }
  });

  // Update aliens
  aliens.forEach(alien => {
    if (!alien.alive) return;

    let aPos = alien.mesh.position;

    // Descend to ground if still in air
    if (alien.state === 'descending') {
      let groundY = getGroundHeight(aPos.x, aPos.z, 1.5);
      if (aPos.y > groundY + 2) {
        aPos.y -= 20 * delta;
      } else {
        aPos.y = groundY + 2;
        alien.state = 'wander';
      }
      return;
    }

    // Find target
    if (now > alien.changeDirTime) {
      alien.changeDirTime = now + 1000 + Math.random() * 2000;

      let minDistSq = 300 * 300;
      let closestTarget = null;

      if (state.player.alive && !state.player.isParachuting) {
        let dSq = aPos.distanceToSquared(playerPos);
        if (dSq < minDistSq) {
          minDistSq = dSq;
          closestTarget = 'player';
        }
      }

      const nearbyBots = getNearbyBots(aPos.x, aPos.z);
      nearbyBots.forEach(bot => {
        if (bot.alive && !bot.isParachuting) {
          let dSq = aPos.distanceToSquared(bot.mesh.position);
          if (dSq < minDistSq) {
            minDistSq = dSq;
            closestTarget = bot;
          }
        }
      });

      alien.target = closestTarget;

      if (!alien.target) {
        alien.state = 'wander';
        let angle = Math.random() * Math.PI * 2;
        alien.vx = Math.cos(angle) * 8;
        alien.vz = Math.sin(angle) * 8;
      } else {
        alien.state = 'attack';
      }
    }

    if (alien.state === 'wander') {
      let newX = aPos.x + alien.vx * delta;
      let newZ = aPos.z + alien.vz * delta;

      // Check collision (aliens hover above ground, check at ground level)
      let collision = checkEntityCollision(aPos.x, aPos.z, newX, newZ, getTerrainHeight(newX, newZ), 5);
      if (!collision.blocked) {
        aPos.x = newX;
        aPos.z = newZ;
      } else {
        aPos.x = collision.x;
        aPos.z = collision.z;
        alien.vx = -alien.vx * 0.5;
        alien.vz = -alien.vz * 0.5;
      }
      aPos.y = getGroundHeight(aPos.x, aPos.z, 1.5) + 2;
      resolveEntityCollisions(aPos, 'alien_' + alien.id, 1.5);
      aPos.y = getGroundHeight(aPos.x, aPos.z, 1.5) + 2;

      // Hover slightly
      aPos.y += Math.sin(now * 0.003) * 0.5;
    } else if (alien.state === 'attack' && alien.target) {
      let targetPos = alien.target === 'player' ? playerPos : alien.target.mesh.position;
      let dir = _alienMoveDir.subVectors(targetPos, aPos);
      dir.y = 0;
      let dist = dir.length();
      dir.normalize();

      // Calculate movement
      let moveX = 0, moveZ = 0;
      if (dist > 60) {
        moveX = dir.x * alien.speed * delta;
        moveZ = dir.z * alien.speed * delta;
      } else if (dist < 30) {
        moveX = -dir.x * alien.speed * delta;
        moveZ = -dir.z * alien.speed * delta;
      } else {
        let perp = new THREE.Vector3(-dir.z, 0, dir.x);
        let strafeDir = Math.sin(now * 0.002) > 0 ? 1 : -1;
        moveX = perp.x * alien.speed * 0.7 * strafeDir * delta;
        moveZ = perp.z * alien.speed * 0.7 * strafeDir * delta;
      }

      // Check collision
      let newX = aPos.x + moveX;
      let newZ = aPos.z + moveZ;
      let collision = checkEntityCollision(aPos.x, aPos.z, newX, newZ, getTerrainHeight(newX, newZ), 5, {
        colliders: getNearbyColliders(aPos.x, aPos.z),
        doors: getNearbyDoors(aPos.x, aPos.z)
      });
      if (!collision.blocked) {
        aPos.x = newX;
        aPos.z = newZ;
      }

      aPos.y = getGroundHeight(aPos.x, aPos.z, 1.5) + 2;
      resolveEntityCollisions(aPos, 'alien_' + alien.id, 1.5);
      aPos.y = getGroundHeight(aPos.x, aPos.z, 1.5) + 2;
      aPos.y += Math.sin(now * 0.003) * 0.5;
      // Face target
      alien.mesh.lookAt(targetPos.x, aPos.y, targetPos.z);

      // Shoot
      if (now - alien.lastFire > 800) {
        alien.lastFire = now;
        playSound('ar', { x: aPos.x, y: aPos.y, z: aPos.z });

        // Check line of sight before shooting
        const alienHeadPos = _alienHeadPos.set(aPos.x, aPos.y + 3, aPos.z);
        const direction = _alienShotDir.subVectors(targetPos, alienHeadPos).normalize();
        spawnWorldMuzzleFlash(alienHeadPos, direction, { scale: 0.85, duration: 58 });
        _alienRaycaster.set(alienHeadPos, direction);
        _alienRaycaster.near = 0;
        _alienRaycaster.far = 500;
        const intersects = _alienRaycaster.intersectObjects(state.objects);

        let isBlocked = false;
        let hitPoint = targetPos;

        // Check if any obstacle is between alien and target
        const distToTarget = alienHeadPos.distanceTo(targetPos);
        for (let i = 0; i < intersects.length; i++) {
          const hit = intersects[i];
          // If hit something that's not the target itself, and it's closer
          if (hit.distance < distToTarget) {
            const ud = hit.object.userData;
            // Ignore hitting the alien itself or other aliens
            if (!ud.isAlien) {
              isBlocked = true;
              hitPoint = hit.point;
              break;
            }
          }
        }

        // Create bullet tracer
        spawnAlienBullet(aPos, hitPoint);

        if (!isBlocked && Math.random() < 0.35) {
          let isHeadshot = Math.random() > 0.8;
          if (alien.target === 'player') {
            playerHit(alien.weaponDamage * (isHeadshot ? 2 : 1), aPos); // Pass position for hit direction
            showNotice("👽 被外星武器击中！", "#00ff88");
          } else {
            alien.target.health -= alien.weaponDamage;
            if (alien.target.health <= 0) {
              botDied(alien.target, "外星人 (Alien)");
              alien.target = null;
              alien.changeDirTime = 0;
            }
          }
        }
      }
    }

    // Boundary check
    if (Math.abs(aPos.x) > MAP_SIZE / 2 || Math.abs(aPos.z) > MAP_SIZE / 2) {
      aPos.x = (Math.random() - 0.5) * MAP_SIZE * 0.4;
      aPos.z = (Math.random() - 0.5) * MAP_SIZE * 0.4;
    }

    // Slow down
    alien.vx *= 0.95;
    alien.vz *= 0.95;
  });

  // Update alien bullets
  for (let i = alienBullets.length - 1; i >= 0; i--) {
    let bullet = alienBullets[i];
    bullet.age += delta;

    bullet.mesh.position.x += bullet.vx * delta;
    bullet.mesh.position.y += bullet.vy * delta;
    bullet.mesh.position.z += bullet.vz * delta;

    if (bullet.age > 2) {
      state.scene.remove(bullet.mesh);
      alienBullets.splice(i, 1);
    }
  }
}

function spawnAlienBullet(fromPos, toPos) {
  const bulletGeo = new THREE.SphereGeometry(0.3, 8, 8);
  const bulletMat = new THREE.MeshBasicMaterial({
    color: 0x00ff88
  });
  const bullet = new THREE.Mesh(bulletGeo, bulletMat);
  bullet.position.copy(fromPos);
  state.scene.add(bullet);

  let dir = _alienBulletDir.subVectors(toPos, fromPos).normalize();
  let speed = 150;

  alienBullets.push({
    mesh: bullet,
    vx: dir.x * speed,
    vy: dir.y * speed,
    vz: dir.z * speed,
    age: 0
  });
}

export function alienDied(alien) {
  if (!alien.alive) return;
  alien.alive = false;
  state.scene.remove(alien.mesh);

  let idx1 = state.objects.indexOf(alien.bodyMesh);
  if (idx1 > -1) state.objects.splice(idx1, 1);
  let idx2 = state.objects.indexOf(alien.headMesh);
  if (idx2 > -1) state.objects.splice(idx2, 1);

  state.player.kills++;
  showNotice("👽 击杀外星人！(+1 击杀)", "#00ff88");

  // Drop alien technology
  let r = Math.random();
  if (r < 0.3) {
    spawnSingleLoot(alien.mesh.position.x, alien.mesh.position.y, alien.mesh.position.z, 'health');
  } else if (r < 0.6) {
    spawnSingleLoot(alien.mesh.position.x, alien.mesh.position.y, alien.mesh.position.z, 'ammo');
  } else {
    spawnSingleLoot(alien.mesh.position.x, alien.mesh.position.y, alien.mesh.position.z, 'health');
  }

  addKillFeed(`[You] 击杀了一只 [外星人]`);
  updateUI();
}

// Get all aliens for external access
export function getAllAliens() {
  return aliens;
}

export function getAllUFOs() {
  return ufos;
}
