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
import { initZone, updateZone } from './systems/zone.js';
import { initTerrain, getTerrainHeight } from './world/terrain.js';
import { preGenerateHouses, initEnvironment } from './world/environment.js';
import { updateWeaponModel, updatePlayer, fireWeapon } from './entities/player.js';
import { initBots, updateBots } from './entities/bots.js';
import { initZombies, updateZombies } from './entities/zombies.js';
import { initAnimals, updateAnimals } from './entities/animals.js';
import { initGhosts, updateGhosts } from './entities/ghosts.js';
import { initAliens, updateAliens, alienDied } from './entities/aliens.js';
import { updateUI } from './ui/hud.js';
import { initMinimap, updateMinimap } from './ui/minimap.js';
import { optimizeRenderer, optimizeScene, updateFPS, adaptQuality } from './systems/performance.js';

// Disable right-click menu
document.addEventListener('contextmenu', e => e.preventDefault());

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

  // Set default weapon
  const defaultWeapon = { ...weapons.find(w => w.name === 'M1911') };
  state.player.weapon = defaultWeapon;
  state.player.inventory = [defaultWeapon, null];

  // Create first-person weapon model
  state.viewWeaponMesh = new THREE.Group();
  state.viewWeaponMesh.position.set(0.6, -0.6, -1.2);
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
  initAnimals();

  // Initialize zone
  initZone();

  // Start button handler
  document.getElementById('start-btn').addEventListener('click', () => {
    document.getElementById('overlay').style.display = 'none';
    state.controls.lock();
    resumeAudio();
    if (!state.gameStarted) {
      state.gameStarted = true;
      initBots();
      initZombies();
      initGhosts();
      initAliens();
    }
  });

  // Pause handler
  state.controls.addEventListener('unlock', () => {
    if (state.player.alive && state.aliveCount > 1) {
      document.getElementById('overlay').style.display = 'flex';
      document.getElementById('title').innerText = "暂停 (PAUSED)";
      document.getElementById('subtitle').innerText = "点击按钮继续";
      document.getElementById('start-btn').innerText = "继续游戏";
    }
  });

  // Initial UI update
  updateUI();
  initMinimap();

  // Start game loop
  state.prevTime = performance.now();
  animate();
}

function animate() {
  requestAnimationFrame(animate);

  const time = performance.now();
  const delta = Math.min((time - state.prevTime) / 1000, 0.1);

  // FPS tracking and adaptive quality
  const fps = updateFPS(delta);
  if (fps < 30) {
    adaptQuality(fps);
  }

  // Update audio listener position (throttled)
  if (time - state.prevTime > 50) {
    updateAudioListener(state.camera);
  }

  // Rotate loot items horizontally and animate bubble
  state.lootItems.forEach(l => {
    l.mesh.rotation.y += delta * 0.5; // Horizontal rotation only
    if (l.bubble) {
      l.bubble.material.opacity = 0.1 + Math.sin(time * 0.003) * 0.05;
    }
    if (l.ring) {
      l.ring.rotation.z += delta * 0.8;
    }
  });

  // Animate doors
  state.doors.forEach(d => {
    d.currentAngle += (d.targetAngle - d.currentAngle) * 10 * delta;
    d.pivot.rotation.y = d.currentAngle;
  });

  if (state.controls.isLocked && state.player.alive) {
    // Scope/ADS zoom
    let targetFov = 75;
    if (state.player.isADS) {
      if (state.player.weapon.scope) {
        targetFov = state.player.weapon.scope.fov;
        if (state.player.weapon.scope.level >= 2) {
          document.getElementById('scope-overlay').style.display = 'block';
          document.getElementById('crosshair').style.display = 'none';
          let vignetteSize = 70 - state.player.weapon.scope.level * 10;
          document.querySelector('.scope-vignette').style.background =
            `radial-gradient(circle at 50% 50%, transparent ${vignetteSize}%, rgba(0,0,0,0.8) ${vignetteSize + 5}%)`;
        } else {
          document.getElementById('scope-overlay').style.display = 'none';
          document.getElementById('crosshair').style.display = 'block';
          document.getElementById('crosshair').style.background = 'red';
          document.getElementById('crosshair').style.width = '4px';
          document.getElementById('crosshair').style.height = '4px';
        }
      } else {
        targetFov = 65;
        document.getElementById('scope-overlay').style.display = 'none';
        document.getElementById('crosshair').style.display = 'block';
      }
    } else {
      document.getElementById('scope-overlay').style.display = 'none';
      document.getElementById('crosshair').style.display = 'block';
      document.getElementById('crosshair').style.background = 'rgba(0, 255, 0, 0.8)';
      document.getElementById('crosshair').style.width = '6px';
      document.getElementById('crosshair').style.height = '6px';
    }
    state.camera.fov += (targetFov - state.camera.fov) * 0.15;
    state.camera.updateProjectionMatrix();

    // Reload progress bar
    if (state.player.isReloading) {
      let elapsed = Date.now() - state.reloadStartTime;
      let progress = Math.min(100, (elapsed / 2000) * 100);
      document.getElementById('reload-bar').style.width = progress + '%';
    }

    // Update all subsystems
    updatePlayer(delta);
    updateBots(delta);
    updateZombies(delta);
    updateGhosts(delta);
    updateAnimals(delta);
    updateAliens(delta);
    updateZone(delta);
    updateWeather(delta);
    updateParticles(delta);
    updateMinimap();

    // Auto-fire for fast weapons
    if (state.isMouseDown && state.player.weapon.fireRate <= 200) {
      fireWeapon();
    }

    // Camera recoil recovery (camera went UP, now recover back DOWN)
    if (state.player.cameraRecoil > 0) {
      let rec = state.player.cameraRecoil * 10 * delta;
      if (rec > state.player.cameraRecoil) rec = state.player.cameraRecoil;
      const _rr = new THREE.Euler(0, 0, 0, 'YXZ');
      _rr.setFromQuaternion(state.camera.quaternion);
      _rr.x += rec; // Recover by moving camera back DOWN (positive X)
      _rr.z = 0;
      state.camera.quaternion.setFromEuler(_rr);
      state.player.cameraRecoil -= rec;
      if (state.player.cameraRecoil < 0.0001) state.player.cameraRecoil = 0;
    }

    // Weapon recoil recovery
    if (state.player.recoilY > 0) {
      let rec = state.player.recoilY * 5 * delta;
      state.player.recoilY -= rec;
      if (state.player.recoilY < 0) state.player.recoilY = 0;
    }

    // Weapon model recovery
    if (state.viewWeaponMesh && !state.player.isReloading) {
      state.viewWeaponMesh.position.z += (-1.2 - state.viewWeaponMesh.position.z) * 10 * delta;
      state.viewWeaponMesh.rotation.x += (0 - state.viewWeaponMesh.rotation.x) * 10 * delta;
    }

    // Reload animation - smooth and realistic
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

      state.viewWeaponMesh.position.y = -0.6 + yOffset;
      state.viewWeaponMesh.position.x = 0.6 + xOffset;
      state.viewWeaponMesh.position.z = -1.2 + zOffset;
      state.viewWeaponMesh.rotation.x = rotX;
      state.viewWeaponMesh.rotation.z = rotZ;
    }
  }

  state.prevTime = time;
  state.renderer.render(state.scene, state.camera);
}

// Start the game
init();
