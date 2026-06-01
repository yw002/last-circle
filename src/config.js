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
    botAccuracy: 0.28,
    botTargetRange: 350,
    botToPlayerDamageFactor: 0.35,
    botSpeed: 18,
    botFireRateMultiplier: 3.5
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
  // Melee
  { type: "melee", name: "Pan", ammo: 1, maxAmmo: 1, damage: 80, fireRate: 600, range: 5, color: 0x111111, sound: 'hit', scope: null },
  { type: "melee", name: "Machete", ammo: 1, maxAmmo: 1, damage: 60, fireRate: 500, range: 5, color: 0x888888, sound: 'hit', scope: null },
  // Throwables
  { type: "throwable", name: "Grenade", ammo: 1, maxAmmo: 1, damage: 150, fireRate: 1000, range: 80, color: 0x27ae60, sound: '', scope: null },
  { type: "throwable", name: "Flashbang", ammo: 1, maxAmmo: 1, damage: 0, fireRate: 1000, range: 80, color: 0xbdc3c7, sound: '', scope: null }
];
