// Wave Manager — 20-wave survival mode core scheduler

import { state } from '../state.js';
import { WAVE_CONFIG } from '../config.js';
import { getTerrainHeight } from '../world/terrain.js';
import { spawnSingleBot } from '../entities/bots.js';
import { spawnSingleZombie } from '../entities/zombies.js';
import { spawnSingleAlien } from '../entities/aliens.js';
import { spawnWaveGiant } from '../entities/giant.js';
import { triggerVictoryChicken } from './victory.js';
import { showNotice } from '../ui/notices.js';
import { addKillFeed } from '../ui/notices.js';
import { updateUI } from '../ui/hud.js';

let _spawnTimer = 0;
const SPAWN_INTERVAL = 0.3; // seconds between each enemy spawn during spawning phase

// Anti-camping detection
let _lastPlayerPos = null;
let _stationaryTimer = 0;
const CAMP_THRESHOLD = 30; // seconds before penalty
const CAMP_MOVE_THRESHOLD = 100; // squared distance to count as "moving"

function getWaveComposition(waveNum) {
  if (waveNum <= 3) {
    return [{ type: 'zombie', ratio: 1.0 }];
  } else if (waveNum <= 7) {
    return [{ type: 'zombie', ratio: 0.6 }, { type: 'bot', ratio: 0.4 }];
  } else if (waveNum <= 14) {
    return [
      { type: 'zombie', ratio: 0.35 },
      { type: 'bot', ratio: 0.4 },
      { type: 'alien', ratio: 0.25 }
    ];
  } else {
    // Waves 15-19: heavy mix
    return [
      { type: 'zombie', ratio: 0.3 },
      { type: 'bot', ratio: 0.4 },
      { type: 'alien', ratio: 0.3 }
    ];
  }
}

function isBossWave(waveNum) {
  return waveNum % WAVE_CONFIG.BOSS_EVERY_N_WAVES === 0;
}

function getScaling(waveNum) {
  return {
    healthMul: 1 + waveNum * WAVE_CONFIG.HEALTH_SCALE,
    damageMul: 1 + waveNum * WAVE_CONFIG.DAMAGE_SCALE,
    speedMul: 1 + waveNum * WAVE_CONFIG.SPEED_SCALE
  };
}

function getRandomSpawnPos() {
  const playerPos = state.controls.getObject().position;
  const angle = Math.random() * Math.PI * 2;
  const dist = WAVE_CONFIG.SPAWN_DISTANCE_MIN +
    Math.random() * (WAVE_CONFIG.SPAWN_DISTANCE_MAX - WAVE_CONFIG.SPAWN_DISTANCE_MIN);
  let x = playerPos.x + Math.cos(angle) * dist;
  let z = playerPos.z + Math.sin(angle) * dist;
  // Clamp to map bounds
  const halfMap = 2800;
  x = Math.max(-halfMap, Math.min(halfMap, x));
  z = Math.max(-halfMap, Math.min(halfMap, z));
  const y = getTerrainHeight(x, z);
  return { x, y, z };
}

function spawnEnemy(type, scaling) {
  const pos = getRandomSpawnPos();
  if (pos.y < 1) return; // skip water

  switch (type) {
    case 'zombie':
      spawnSingleZombie(pos.x, pos.z, scaling);
      break;
    case 'bot':
      spawnSingleBot(pos.x, pos.z, scaling);
      break;
    case 'alien':
      spawnSingleAlien(pos.x, pos.z, scaling);
      break;
  }
}

function startNextWave() {
  const wave = state.wave;
  wave.number++;

  if (wave.number > WAVE_CONFIG.TOTAL_WAVES) {
    // Victory!
    wave.phase = 'victory';
    wave.score = WAVE_CONFIG.TOTAL_WAVES;
    showNotice("🏆 恭喜通关全部20关！", "#f1c40f");
    triggerVictoryChicken();
    setTimeout(() => {
      state.controls.unlock();
      document.getElementById('title').innerText = "通关！全部20关完成！";
      document.getElementById('title').style.color = "#f1c40f";
      document.getElementById('subtitle').innerText = `总击杀: ${wave.totalKills} | 你是真正的末日生存者！`;
      document.getElementById('start-btn').innerText = "再玩一局";
      document.getElementById('start-btn').style.display = "block";
      document.getElementById('start-btn').onclick = () => location.reload();
      document.getElementById('overlay').style.display = "flex";
    }, 3000);
    return;
  }

  const boss = isBossWave(wave.number);

  if (boss) {
    wave.phase = 'boss';
    wave.enemiesTotal = 8 + wave.number * 2; // fewer minions during boss
    wave.killThreshold = Math.ceil(wave.enemiesTotal * WAVE_CONFIG.KILL_THRESHOLD);
    wave.enemiesSpawned = 0;
    wave.enemiesRemaining = wave.enemiesTotal + 1; // +1 for giant
    showNotice(`⚠️ 第${wave.number}关 — BOSS关！巨人来袭！`, "#ff4444");
    addKillFeed(`<span style='color:#ff4444'>⚠ 第${wave.number}关 BOSS — 远古恶魔巨人降临！</span>`);
    // Spawn giant
    const scaling = getScaling(wave.number);
    spawnWaveGiant(scaling);
  } else {
    wave.phase = 'spawning';
    wave.enemiesTotal = WAVE_CONFIG.BASE_ENEMY_COUNT + wave.number * WAVE_CONFIG.ENEMIES_PER_WAVE;
    wave.killThreshold = Math.ceil(wave.enemiesTotal * WAVE_CONFIG.KILL_THRESHOLD);
    wave.enemiesSpawned = 0;
    wave.enemiesRemaining = wave.enemiesTotal;
    showNotice(`📢 第${wave.number}关开始！敌人数量: ${wave.enemiesTotal}`, "#3498db");
  }

  _spawnTimer = 0;
  updateUI();
}

function cleanupDeadEntities() {
  // Remove dead entities from arrays to prevent memory growth
  state.bots = state.bots.filter(b => b.alive);
  state.zombies = state.zombies.filter(z => z.alive);
  state.ghosts = state.ghosts.filter(g => g.state !== 'dead');
  state.aliens = state.aliens.filter(a => a.alive);
}

export function initWaveManager() {
  const wave = state.wave;
  wave.number = 0;
  wave.phase = 'rest';
  wave.restTimer = 5; // First wave starts after 5 seconds
  wave.enemiesRemaining = 0;
  wave.enemiesSpawned = 0;
  wave.enemiesTotal = 0;
  wave.killThreshold = 0;
  wave.score = 0;
  wave.totalKills = 0;
  _spawnTimer = 0;
  _lastPlayerPos = null;
  _stationaryTimer = 0;
}

export function updateWaveManager(delta) {
  const wave = state.wave;
  if (wave.phase === 'victory') return;

  const playerPos = state.controls.getObject().position;

  // Anti-camping detection
  if (_lastPlayerPos) {
    const dx = playerPos.x - _lastPlayerPos.x;
    const dz = playerPos.z - _lastPlayerPos.z;
    if (dx * dx + dz * dz < CAMP_MOVE_THRESHOLD) {
      _stationaryTimer += delta;
      if (_stationaryTimer > CAMP_THRESHOLD && (wave.phase === 'active' || wave.phase === 'boss' || wave.phase === 'spawning')) {
        // Spawn extra enemies near player
        const scaling = getScaling(wave.number);
        for (let i = 0; i < 3; i++) {
          spawnEnemy(Math.random() < 0.5 ? 'zombie' : 'bot', scaling);
          wave.enemiesRemaining++;
          wave.enemiesTotal++;
        }
        showNotice("⚠️ 敌人检测到你停留不动，增援赶来！", "#ff6600");
        _stationaryTimer = 0;
      }
    } else {
      _stationaryTimer = Math.max(0, _stationaryTimer - delta * 2);
    }
  }
  _lastPlayerPos = playerPos.clone();

  // State machine
  if (wave.phase === 'rest') {
    wave.restTimer -= delta;
    if (wave.restTimer <= 0) {
      cleanupDeadEntities();
      startNextWave();
    }
    return;
  }

  if (wave.phase === 'spawning') {
    _spawnTimer += delta;
    if (_spawnTimer >= SPAWN_INTERVAL && wave.enemiesSpawned < wave.enemiesTotal) {
      _spawnTimer = 0;
      const composition = getWaveComposition(wave.number);
      // Pick type based on ratio
      let roll = Math.random();
      let type = 'zombie';
      let cumRatio = 0;
      for (const entry of composition) {
        cumRatio += entry.ratio;
        if (roll <= cumRatio) { type = entry.type; break; }
      }
      const scaling = getScaling(wave.number);
      spawnEnemy(type, scaling);
      wave.enemiesSpawned++;
    }
    if (wave.enemiesSpawned >= wave.enemiesTotal) {
      wave.phase = 'active';
    }
    return;
  }

  if (wave.phase === 'active' || wave.phase === 'boss') {
    // Check if kill threshold reached
    const killsNeeded = wave.enemiesTotal - wave.killThreshold;
    const killsSoFar = wave.enemiesTotal - wave.enemiesRemaining;
    const thresholdMet = killsSoFar >= killsNeeded || wave.enemiesRemaining <= 0;

    // Boss wave: giant must also be dead
    const bossCleared = wave.phase !== 'boss' || !state.giantAlive;

    if (thresholdMet && bossCleared) {
      // Wave complete
      wave.score = wave.number;
      showNotice(`✅ 第${wave.number}关完成！`, "#2ecc71");
      addKillFeed(`<span style='color:#2ecc71'>第${wave.number}关通关！击杀 ${wave.totalKills} 敌人</span>`);
      wave.phase = 'rest';
      wave.restTimer = WAVE_CONFIG.REST_DURATION;
      updateUI();
    }
  }
}

// Called by entity death functions (bots, zombies, aliens, giant)
export function onWaveEnemyKilled() {
  state.wave.enemiesRemaining = Math.max(0, state.wave.enemiesRemaining - 1);
  state.wave.totalKills++;
  updateUI();
}
