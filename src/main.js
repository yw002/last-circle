// Main entry point: init + game loop

import './styles.css';
import * as THREE from 'three';
import { state } from './state.js';
import { weapons } from './config.js';
import { initScene } from './scene.js';
import { initControls } from './systems/controls.js';
import { resumeAudio, updateAudioListener } from './systems/audio.js';
import { updateParticles } from './systems/particles.js';
import { initClouds, updateWeather } from './systems/weather.js';
import { triggerLightningStrike } from './systems/lightning.js';
import { initZone, updateZone } from './systems/zone.js';
import { initTerrain, getTerrainHeight } from './world/terrain.js';
import { preGenerateHouses, initEnvironment } from './world/environment.js';
import { initGrass, updateGrass } from './world/grass.js';
import { updateWeaponModel, updatePlayer, fireWeapon, updateCrosshairSpread } from './entities/player.js';
import { updateTracers } from './systems/bullets.js';
import { updateBulletHoles } from './systems/bulletholes.js';
import { updateADS } from './systems/ads.js';
import { initBots, updateBots } from './entities/bots.js';
import { initZombies, updateZombies } from './entities/zombies.js';
import { initAnimals, updateAnimals } from './entities/animals.js';
import { initGhosts, updateGhosts } from './entities/ghosts.js';
import { initAliens, updateAliens, alienDied } from './entities/aliens.js';
import { updateMeteors } from './entities/meteors.js';
import { updateTornadoes } from './entities/tornadoes.js';
import { initVolcano, updateVolcano } from './entities/volcano.js';
import { updateUI } from './ui/hud.js';
import { initMinimap, updateMinimap } from './ui/minimap.js';
import { initHitIndicator } from './ui/hitindicator.js';
import { optimizeRenderer, optimizeScene, updateFPS, getAverageFPS, resetFPS, adaptQuality, profileStep, logPerformanceProfile } from './systems/performance.js';
import { rebuildSpatialIndex, resetStaticSpatialIndex, getNearbyLoot } from './systems/spatial.js';
import { updateStaticVisibility } from './systems/staticVisibility.js';

// Disable right-click menu
document.addEventListener('contextmenu', e => e.preventDefault());

// Reusable objects for performance
let _recoilEuler = null;
let _lastFrameErrorLog = 0;
const _frameErrorCounts = new Map();

function reportFrameError(label, error) {
  const now = performance.now();
  const count = (_frameErrorCounts.get(label) || 0) + 1;
  _frameErrorCounts.set(label, count);

  // Throttle repeated frame errors so one bad entity cannot flood the console or stall DevTools.
  if (now - _lastFrameErrorLog > 1000) {
    console.warn(`Frame step failed: ${label} (${count})`, error);
    _lastFrameErrorLog = now;
  }
}

function runFrameStep(label, fn) {
  return profileStep(label, () => {
    try {
      return fn();
    } catch (error) {
      reportFrameError(label, error);
      return undefined;
    }
  });
}

function renderFrame() {
  profileStep('render', () => {
    try {
      state.renderer.render(state.scene, state.camera);
    } catch (error) {
      reportFrameError('render', error);
    }
  });
}

function init() {
  // Initialize Three.js scene
  initScene();

  // Optimize renderer and scene
  optimizeRenderer(state.renderer);
  optimizeScene(state.scene);

  // Initialize controls (keyboard/mouse)
  initControls();

  // Initialize clouds
  initClouds();

  // Set default weapon - random automatic rifle with full ammo
  const autoRifles = weapons.filter(w => w.type === 'ar' || w.type === 'smg');
  const defaultWeapon = { ...autoRifles[Math.floor(Math.random() * autoRifles.length)] };
  defaultWeapon.ammo = defaultWeapon.maxAmmo; // Full magazine
  state.player.weapon = defaultWeapon;
  state.player.inventory = [defaultWeapon, null];
  state.player.sharedAmmo = 300; // Start with 300 reserve ammo

  // Create first-person weapon model - pushed forward to prevent back-clipping
  state.viewWeaponMesh = new THREE.Group();
  state.viewWeaponMesh.position.set(0.5, -0.5, -1.8);
  state.camera.add(state.viewWeaponMesh);
  updateWeaponModel();

  // Create player parachute
  state.parachuteGroup = new THREE.Group();
  const canopyGeo = new THREE.SphereGeometry(12, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const canopyMat = new THREE.MeshLambertMaterial({ color: 0x2e86c1, side: THREE.DoubleSide });
  const canopy = new THREE.Mesh(canopyGeo, canopyMat);
  canopy.position.y = 12;
  canopy.scale.y = 0.4;
  state.parachuteGroup.add(canopy);
  const stringMat = new THREE.LineBasicMaterial({ color: 0xffffff });
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const pts = [
      new THREE.Vector3(Math.cos(angle) * 11, 12, Math.sin(angle) * 11),
      new THREE.Vector3(0, 0, 0)
    ];
    const stringGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const stringLine = new THREE.Line(stringGeo, stringMat);
    state.parachuteGroup.add(stringLine);
  }
  state.controls.getObject().add(state.parachuteGroup);

  // Generate world
  preGenerateHouses();
  initTerrain();
  initEnvironment();
  resetStaticSpatialIndex();
  initGrass(); // Zelda-style flowing grass
  initAnimals();
  initVolcano(); // Create massive volcano

  // Initialize zone
  initZone();

  const overlayEl = document.getElementById('overlay');
  const startBtnEl = document.getElementById('start-btn');

  // Start/resume only hides the menu after pointer lock is actually restored.
  startBtnEl.addEventListener('click', () => {
    resumeAudio();
    state.prevTime = performance.now();
    state.controls.lock();
    if (!state.gameStarted) {
      state.gameStarted = true;
      resetFPS();
      initBots();
      initZombies();
      initGhosts();
      initAliens();
    }
  });

  state.controls.addEventListener('lock', () => {
    overlayEl.style.display = 'none';
    state.prevTime = performance.now();
  });

  // Pause handler
  state.controls.addEventListener('unlock', () => {
    if (state.player.alive && state.aliveCount > 1) {
      overlayEl.style.display = 'flex';
      document.getElementById('title').innerText = "暂停 (PAUSED)";
      document.getElementById('subtitle').innerText = "点击按钮继续";
      startBtnEl.innerText = "继续游戏";
    }
  });

  // Initial UI update
  updateUI();
  initMinimap();
  initHitIndicator();

  // Start game loop
  state.prevTime = performance.now();
  animate();
}

function animate() {
  requestAnimationFrame(animate);

  try {
    const time = performance.now();
    const delta = Math.min((time - state.prevTime) / 1000, 0.1);
    state.frameId++;
    logPerformanceProfile(time);

    runFrameStep('spatial rebuild', () => rebuildSpatialIndex());
    runFrameStep('static visibility', () => updateStaticVisibility(time));

    // Update audio listener position (throttled to every 100ms)
    runFrameStep('audio listener', () => {
      if (!state._lastAudioUpdate || time - state._lastAudioUpdate > 100) {
        updateAudioListener(state.camera);
        state._lastAudioUpdate = time;
      }
    });

    // Rotate loot items (only nearby ones, throttled)
    runFrameStep('loot animation', () => {
      if (!state._lastLootUpdate || time - state._lastLootUpdate > 50) {
        const playerPos = state.controls.getObject().position;
        const px = playerPos.x, pz = playerPos.z;
        const nearbyLoot = getNearbyLoot(px, pz);
        for (let i = 0; i < nearbyLoot.length; i++) {
          const l = nearbyLoot[i];
          if (!l.mesh) continue;
          const lp = l.mesh.position;
          const dx = lp.x - px, dz = lp.z - pz;
          // Only animate loot within 150 units (22500 = 150^2)
          if (dx * dx + dz * dz < 22500) {
            l.mesh.rotation.y += delta * 0.5;
          }
        }
        state._lastLootUpdate = time;
      }
    });

    // Animate doors (only if angle changed)
    runFrameStep('door animation', () => {
      for (let i = 0; i < state.doors.length; i++) {
        const d = state.doors[i];
        if (!d.pivot) continue;
        if (Math.abs(d.currentAngle - d.targetAngle) > 0.001) {
          d.currentAngle += (d.targetAngle - d.currentAngle) * 10 * delta;
          d.pivot.rotation.y = d.currentAngle;
        }
      }
    });

    if (state.controls.isLocked && state.player.alive) {
      // Count performance only during active gameplay, excluding initial and pause overlays.
      const fps = updateFPS(delta);
      const avgFps = getAverageFPS();
      if (fps < 30) {
        adaptQuality(fps);
      }

      // Keep average FPS directly under the realtime FPS readout.
      const fpsEl = document.getElementById('fps-counter');
      if (fpsEl) {
        fpsEl.innerHTML = `FPS: ${fps}<br><span class="fps-avg">avg: ${avgFps}</span>`;
        if (fps >= 50) fpsEl.style.color = '#00ff00';
        else if (fps >= 30) fpsEl.style.color = '#ffff00';
        else fpsEl.style.color = '#ff0000';
      }

      // ADS is now handled by updateADS() system

      // Reload progress bar
      runFrameStep('reload progress', () => {
        if (state.player.isReloading) {
          let elapsed = Date.now() - state.reloadStartTime;
          let progress = Math.min(100, (elapsed / 2000) * 100);
          document.getElementById('reload-bar').style.width = progress + '%';
        }
      });

      // Keep independent systems isolated so one runtime error cannot freeze rendering.
      runFrameStep('player update', () => updatePlayer(delta));
      runFrameStep('bot update', () => updateBots(delta));
      runFrameStep('zombie update', () => updateZombies(delta));
      runFrameStep('ghost update', () => updateGhosts(delta));
      runFrameStep('animal update', () => updateAnimals(delta));
      runFrameStep('alien update', () => updateAliens(delta));
      runFrameStep('meteor update', () => updateMeteors(delta));
      runFrameStep('tornado update', () => updateTornadoes(delta));
      runFrameStep('volcano update', () => updateVolcano(delta));
      runFrameStep('zone update', () => updateZone(delta));
      runFrameStep('weather update', () => updateWeather(delta));
      runFrameStep('particle update', () => updateParticles(delta));
      runFrameStep('crosshair update', () => updateCrosshairSpread(delta));
      runFrameStep('grass update', () => updateGrass(delta));
      runFrameStep('tracer update', () => updateTracers());
      runFrameStep('bullet hole update', () => updateBulletHoles());
      runFrameStep('ads update', () => updateADS(delta));

      // Throttle minimap to ~15 FPS
      runFrameStep('minimap update', () => {
        if (!state._lastMinimapUpdate || time - state._lastMinimapUpdate > 66) {
          updateMinimap();
          state._lastMinimapUpdate = time;
        }
      });

      // Auto-fire for fast weapons
      runFrameStep('auto fire', () => {
        if (state.isMouseDown && state.player.weapon && state.player.weapon.fireRate <= 200) {
          fireWeapon();
        }
      });

      // Camera recoil recovery (reusable Euler)
      runFrameStep('camera recoil', () => {
        if (state.player.cameraRecoil > 0) {
          let rec = state.player.cameraRecoil * 10 * delta;
          if (rec > state.player.cameraRecoil) rec = state.player.cameraRecoil;
          if (!_recoilEuler) _recoilEuler = new THREE.Euler(0, 0, 0, 'YXZ');
          _recoilEuler.setFromQuaternion(state.camera.quaternion);
          _recoilEuler.x += rec;
          _recoilEuler.z = 0;
          state.camera.quaternion.setFromEuler(_recoilEuler);
          state.player.cameraRecoil -= rec;
          if (state.player.cameraRecoil < 0.0001) state.player.cameraRecoil = 0;
        }
      });

      // Weapon recoil recovery
      runFrameStep('weapon recoil', () => {
        if (state.player.recoilY > 0) {
          let rec = state.player.recoilY * 5 * delta;
          state.player.recoilY -= rec;
          if (state.player.recoilY < 0) state.player.recoilY = 0;
        }
      });

      // Weapon model recovery
      runFrameStep('weapon model recovery', () => {
        if (state.viewWeaponMesh && !state.player.isReloading) {
          state.viewWeaponMesh.position.z += (-1.2 - state.viewWeaponMesh.position.z) * 10 * delta;
          state.viewWeaponMesh.rotation.x += (0 - state.viewWeaponMesh.rotation.x) * 10 * delta;
        }
      });

      // Reload animation - smooth and realistic
      runFrameStep('reload animation', () => {
        if (state.player.isReloading && state.viewWeaponMesh) {
          let elapsed = Date.now() - state.reloadStartTime;
          let progress = elapsed / 2000;

          // Simple smooth animation: weapon moves down and slightly right, then back up
          let yOffset = 0;
          let xOffset = 0;
          let zOffset = 0;
          let rotX = 0;
          let rotZ = 0;

          if (progress < 0.3) {
            // Phase 1: Move weapon down (0-30%)
            let t = progress / 0.3;
            t = t * t * (3 - 2 * t); // Smooth step
            yOffset = -0.3 * t;
            xOffset = 0.1 * t;
            rotX = 0.15 * t;
          } else if (progress < 0.7) {
            // Phase 2: Hold position (30-70%)
            let t = (progress - 0.3) / 0.4;
            yOffset = -0.3;
            xOffset = 0.1;
            rotX = 0.15;
          } else {
            // Phase 3: Move weapon back up (70-100%)
            let t = (progress - 0.7) / 0.3;
            t = t * t * (3 - 2 * t); // Smooth step
            yOffset = -0.3 * (1 - t);
            xOffset = 0.1 * (1 - t);
            rotX = 0.15 * (1 - t);
          }

          state.viewWeaponMesh.position.y = -0.5 + yOffset;
          state.viewWeaponMesh.position.x = 0.5 + xOffset;
          state.viewWeaponMesh.position.z = -1.8 + zOffset;
          state.viewWeaponMesh.rotation.x = rotX;
          state.viewWeaponMesh.rotation.z = rotZ;
        }
      });
    }

    state.prevTime = time;

  } catch (e) {
    // Keep frame timing sane even if the setup path itself fails.
    reportFrameError('frame setup', e);
    state.prevTime = performance.now();
  }

  renderFrame();
}

// Start the game
init();
