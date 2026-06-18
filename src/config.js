// Read-only game configuration and constants

export const MAP_SIZE = 6000; // Reduced from 8000
export const BOT_COUNT = 100; // Reduced from 200 for better performance
export const RELOAD_DURATION = 2000;

export const RAIN_START_ENEMIES_MIN = 40;
export const RAIN_START_ENEMIES_MAX = 30;

export const difficulties = {
  easy: {
    name: "末日生存",
    botDamageMultiplier: 0.6,
    botHealth: 130,
    botAccuracy: 0.35,
    botTargetRange: 400,
    botToPlayerDamageFactor: 0.38,
    botSpeed: 20,
    botFireRateMultiplier: 3
  }
};

export const CURRENT_DIFFICULTY = 'easy';

export const equipments = [
  { type: "helmet", level: 1, reduction: 0.3, name: "一级头 (Lv.1)", color: 0x27ae60 },
  { type: "helmet", level: 2, reduction: 0.4, name: "二级头 (Lv.2)", color: 0x2980b9 },
  { type: "helmet", level: 3, reduction: 0.55, name: "三级头 (Lv.3)", color: 0x8e44ad },
  { type: "armor", level: 1, reduction: 0.3, name: "一级甲 (Lv.1)", color: 0x27ae60 },
  { type: "armor", level: 2, reduction: 0.4, name: "二级甲 (Lv.2)", color: 0x2980b9 },
  { type: "armor", level: 3, reduction: 0.55, name: "三级甲 (Lv.3)", color: 0x8e44ad }
];

export const scopes = [
  { type: "scope", level: 1, name: "红点", fov: 65, color: 0xe74c3c },
  { type: "scope", level: 2, name: "2倍", fov: 55, color: 0x3498db },
  { type: "scope", level: 3, name: "4倍", fov: 40, color: 0x9b59b6 },
  { type: "scope", level: 4, name: "8倍", fov: 25, color: 0x34495e }
];

export const weapons = [
  // ARs
  { type: "ar", name: "AKM", ammo: 40, maxAmmo: 40, damage: 47, fireRate: 100, range: 800, color: 0x5a4a42, sound: 'ar', scope: null },
  { type: "ar", name: "M416", ammo: 40, maxAmmo: 40, damage: 41, fireRate: 85, range: 800, color: 0x222222, sound: 'ar_fast', scope: null },
  { type: "ar", name: "SCAR-L", ammo: 40, maxAmmo: 40, damage: 41, fireRate: 96, range: 800, color: 0x8a817c, sound: 'ar', scope: null },
  { type: "ar", name: "M16A4", ammo: 40, maxAmmo: 40, damage: 43, fireRate: 75, range: 800, color: 0x2b2b2b, sound: 'ar_fast', scope: null },
  { type: "ar", name: "Groza", ammo: 40, maxAmmo: 40, damage: 47, fireRate: 80, range: 800, color: 0x333333, sound: 'ar_fast', scope: null },
  { type: "ar", name: "AUG", ammo: 40, maxAmmo: 40, damage: 41, fireRate: 85, range: 800, color: 0x4a5a4a, sound: 'ar_fast', scope: null },
  { type: "ar", name: "QBZ", ammo: 40, maxAmmo: 40, damage: 41, fireRate: 92, range: 800, color: 0x5a5a4a, sound: 'ar', scope: null },
  { type: "ar", name: "G36C", ammo: 40, maxAmmo: 40, damage: 41, fireRate: 86, range: 800, color: 0x444444, sound: 'ar_fast', scope: null },
  { type: "ar", name: "Beryl M762", ammo: 40, maxAmmo: 40, damage: 44, fireRate: 86, range: 800, color: 0x111111, sound: 'ar', scope: null },
  { type: "ar", name: "Mk47 Mutant", ammo: 40, maxAmmo: 40, damage: 49, fireRate: 100, range: 800, color: 0x3a3a3a, sound: 'ar', scope: null },
  // SMGs
  { type: "smg", name: "UZI", ammo: 35, maxAmmo: 35, damage: 26, fireRate: 48, range: 300, color: 0x222222, sound: 'ar_fast', scope: null },
  { type: "smg", name: "UMP45", ammo: 35, maxAmmo: 35, damage: 41, fireRate: 92, range: 400, color: 0x333333, sound: 'ar', scope: null },
  { type: "smg", name: "Vector", ammo: 33, maxAmmo: 33, damage: 31, fireRate: 54, range: 300, color: 0x555555, sound: 'ar_fast', scope: null },
  { type: "smg", name: "Thompson", ammo: 50, maxAmmo: 50, damage: 40, fireRate: 86, range: 400, color: 0x8b4513, sound: 'ar', scope: null },
  { type: "smg", name: "Bizon", ammo: 53, maxAmmo: 53, damage: 35, fireRate: 86, range: 400, color: 0x444444, sound: 'ar', scope: null },
  { type: "smg", name: "MP5K", ammo: 40, maxAmmo: 40, damage: 33, fireRate: 66, range: 350, color: 0x2a2a2a, sound: 'ar_fast', scope: null },
  // Snipers & DMRs
  { type: "sniper", name: "Kar98k", ammo: 5, maxAmmo: 5, damage: 95, fireRate: 1500, range: 1500, color: 0x8b4513, sound: 'sniper', scope: null },
  { type: "sniper", name: "M24", ammo: 5, maxAmmo: 5, damage: 98, fireRate: 1500, range: 1500, color: 0x222222, sound: 'sniper', scope: null },
  { type: "sniper", name: "AWM", ammo: 5, maxAmmo: 5, damage: 130, fireRate: 1500, range: 1500, color: 0x3d4a3d, sound: 'sniper', scope: null },
  { type: "sniper", name: "SKS", ammo: 20, maxAmmo: 20, damage: 53, fireRate: 150, range: 1200, color: 0x5a4a42, sound: 'sniper', scope: null },
  { type: "sniper", name: "Mini14", ammo: 30, maxAmmo: 30, damage: 46, fireRate: 100, range: 1200, color: 0x333333, sound: 'ar', scope: null },
  { type: "sniper", name: "SLR", ammo: 20, maxAmmo: 20, damage: 58, fireRate: 150, range: 1200, color: 0x2b2b2b, sound: 'sniper', scope: null },
  { type: "sniper", name: "Mk14", ammo: 20, maxAmmo: 20, damage: 61, fireRate: 90, range: 1200, color: 0x222222, sound: 'sniper', scope: null },
  // Shotguns
  { type: "shotgun", name: "S686", ammo: 2, maxAmmo: 2, damage: 85, fireRate: 800, range: 50, color: 0x555555, sound: 'shotgun', scope: null },
  { type: "shotgun", name: "S1897", ammo: 5, maxAmmo: 5, damage: 85, fireRate: 1000, range: 50, color: 0x4a4a4a, sound: 'shotgun', scope: null },
  { type: "shotgun", name: "S12K", ammo: 8, maxAmmo: 8, damage: 75, fireRate: 250, range: 50, color: 0x222222, sound: 'shotgun', scope: null },
  { type: "shotgun", name: "DBS", ammo: 14, maxAmmo: 14, damage: 85, fireRate: 400, range: 50, color: 0x111111, sound: 'shotgun', scope: null },
  // Pistols
  { type: "pistol", name: "M1911", ammo: 15, maxAmmo: 15, damage: 41, fireRate: 400, range: 300, color: 0xaaaaaa, sound: 'pistol', scope: null },
  { type: "pistol", name: "P92", ammo: 20, maxAmmo: 20, damage: 35, fireRate: 350, range: 300, color: 0x555555, sound: 'pistol', scope: null },
  { type: "pistol", name: "Desert Eagle", ammo: 10, maxAmmo: 10, damage: 62, fireRate: 500, range: 300, color: 0xdddddd, sound: 'sniper', scope: null },
  // Special apocalypse weapons - player-only effects are handled by specialWeapons.js
  { type: "ar", name: "腐蚀喷射器", ammo: 45, maxAmmo: 45, damage: 18, fireRate: 70, range: 260, color: 0x9bdc28, sound: 'ar_fast', scope: null, special: 'corrosive', rarity: 'special', ammoCost: 1, effectColor: 0xb6ff2e, description: '全自动腐蚀流，命中后追加腐蚀伤害' },
  { type: "ar", name: "电弧链枪", ammo: 36, maxAmmo: 36, damage: 27, fireRate: 130, range: 520, color: 0x54d7ff, sound: 'ar_fast', scope: null, special: 'arc_chain', rarity: 'special', ammoCost: 1, effectColor: 0x7ce8ff, description: '全自动电弧束，命中后跳电至附近敌人' },
  { type: "shotgun", name: "重力锤发射器", ammo: 22, maxAmmo: 22, damage: 28, fireRate: 190, range: 420, color: 0x7f5cff, sound: 'shotgun', scope: null, special: 'gravity_hammer', rarity: 'special', ammoCost: 1, effectColor: 0x8b5cff, description: '全自动重力球，小范围冲击并推开敌人' },
  { type: "sniper", name: "血雾收割枪", ammo: 24, maxAmmo: 24, damage: 58, fireRate: 185, range: 850, color: 0x8f1028, sound: 'ar', scope: null, special: 'blood_mist', rarity: 'special', ammoCost: 1, effectColor: 0xcc1f3c, description: '全自动血雾弹，击杀怪物时爆开溅射' },
  { type: "sniper", name: "裂隙步枪", ammo: 30, maxAmmo: 30, damage: 46, fireRate: 155, range: 950, color: 0x9b59ff, sound: 'ar_fast', scope: null, special: 'rift', rarity: 'special', ammoCost: 1, effectColor: 0xb05cff, description: '全自动裂隙光束，可穿透目标' },
  { type: "smg", name: "感染标记枪", ammo: 42, maxAmmo: 42, damage: 17, fireRate: 85, range: 450, color: 0xd15cff, sound: 'ar_fast', scope: null, special: 'infection_marker', rarity: 'special', ammoCost: 1, effectColor: 0xd15cff, description: '全自动感染针，命中后短暂标记目标' },
  // Melee
  { type: "melee", name: "Pan", ammo: 1, maxAmmo: 1, damage: 80, fireRate: 600, range: 5, color: 0x111111, sound: 'hit', scope: null },
  { type: "melee", name: "Machete", ammo: 1, maxAmmo: 1, damage: 60, fireRate: 500, range: 5, color: 0x888888, sound: 'hit', scope: null },
  { type: "melee", name: "咸鱼", ammo: 1, maxAmmo: 1, damage: 120, fireRate: 800, range: 6, color: 0x7fb3d8, sound: 'fish_slap', scope: null, special: 'fish' },
  // Throwables
  { type: "throwable", name: "Grenade", ammo: 1, maxAmmo: 1, damage: 150, fireRate: 1000, range: 80, color: 0x27ae60, sound: '', scope: null },
  { type: "throwable", name: "Flashbang", ammo: 1, maxAmmo: 1, damage: 0, fireRate: 1000, range: 80, color: 0xbdc3c7, sound: '', scope: null }
];

// === Biome Configuration (5 biomes: Desert/Snow/Jungle/Swamp/Lava) ===
// Single source of truth for biome IDs, colors, and gameplay attributes.
export const BIOME_CONFIG = {
  DESERT: {
    id: 0,
    name: 'Desert',
    colors: { low: 0xA0926B, mid: 0xC2B280, high: 0xD4C494 },
    seed: { x: -1500, z: -1500 },
    damagePerSec: 0,
    fogColor: null,
  },
  SNOW: {
    id: 1,
    name: 'Snow',
    colors: { low: 0xB0C4DE, mid: 0xE8E8F0, high: 0xF0F0F8 },
    seed: { x: 1500, z: -1500 },
    damagePerSec: 0,
    fogColor: null,
  },
  JUNGLE: {
    id: 2,
    name: 'Jungle',
    colors: { low: 0x0D3B0D, mid: 0x1B5E20, high: 0x2E7D32 },
    seed: { x: 0, z: 1800 },
    damagePerSec: 0,
    fogColor: 0x0a2a0a, // local dense fog tint
    fogDensity: 0.012,
  },
  SWAMP: {
    id: 3,
    name: 'Swamp',
    colors: { low: 0x2F3B1A, mid: 0x4A5D23, high: 0x5A6D33 },
    seed: { x: -1800, z: 1200 },
    damagePerSec: 5, // poison: -5 HP / sec when low
    fogColor: null,
  },
  LAVA: {
    id: 4,
    name: 'Lava',
    colors: { low: 0xFF4500, mid: 0x2C2C2C, high: 0x3A3A3A },
    seed: { x: 1800, z: 1200 },
    damagePerSec: 15, // fire: -15 HP / sec when low
    fogColor: null,
  },
};

// Map of biome id -> entry, used by biomes.js for fast lookup.
export const BIOME_BY_ID = Object.freeze(
  Object.values(BIOME_CONFIG).reduce((acc, entry) => {
    acc[entry.id] = entry;
    return acc;
  }, {})
);

// === Wave Survival Configuration (20-wave mode) ===
export const WAVE_CONFIG = {
  TOTAL_WAVES: 20,
  REST_DURATION: 15,
  KILL_THRESHOLD: 0.8,
  SPAWN_DISTANCE_MIN: 300,
  SPAWN_DISTANCE_MAX: 800,
  BOSS_EVERY_N_WAVES: 5,
  HEALTH_SCALE: 0.15,
  DAMAGE_SCALE: 0.10,
  SPEED_SCALE: 0.05,
  BASE_ENEMY_COUNT: 20,
  ENEMIES_PER_WAVE: 6,
  AIRDROP_INTERVAL: 60
};
