// Central mutable game state
// All modules import this to read/write shared state

export const state = {
  // Three.js core
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  raycaster: null,
  ambLight: null,
  dirLight: null,

  // Raycast targets
  objects: [],

  // Physics colliders
  colliders: [],

  // Entity arrays
  bots: [],
  zombies: [],
  birds: [],
  deers: [],
  boars: [],
  ghosts: [],
  aliens: [],
  lootItems: [],
  killFeed: [],

  // World data
  housePositions: [],
  doors: [],
  rockPositions: [],

  // Player state
  player: {
    health: 500,
    maxHealth: 500,
    alive: true,
    helmet: null,
    armor: null,
    sharedAmmo: 0,
    isReloading: false,
    isADS: false,
    weapon: null, // set in main.js
    inventory: [null, null], // set in main.js
    currentWeaponIndex: 0,
    lastFire: 0,
    isParachuting: true,
    kills: 0,
    recoilY: 0,
    cameraRecoil: 0
  },

  // Alive count (player + bots)
  aliveCount: 0,

  // Giant boss
  giantAlive: false,

  // Blue zone
  zone: {
    x: 0, z: 0,
    radius: 2500,
    targetX: 0, targetZ: 0,
    targetRadius: 2500,
    phase: 0,
    nextShrinkTime: 60,
    lastTick: 0
  },
  zoneMesh: null,

  // Player visuals
  parachuteGroup: null,
  viewWeaponMesh: null,
  muzzleFlash: null,
  muzzleLight: null,

  // Input state
  moveForward: false,
  moveBackward: false,
  moveLeft: false,
  moveRight: false,
  canJump: false,
  isSprinting: false,
  isMouseDown: false,
  interactKey: false,
  velocity: null, // THREE.Vector3, created in scene.js
  direction: null, // THREE.Vector3, created in scene.js

  // Reload state
  reloadTimeout: null,
  reloadStartTime: 0,

  // Weather
  clouds: [],
  rainParticles: [],
  isRaining: false,

  // Lightning
  lightningFlashTime: 0,
  lightningBoltLine: null,
  isLightningFlashing: false,

  // Particles
  bloodParticles: [],
  shellCasings: [],

  // Game state
  gameStarted: false,
  prevTime: 0,
  frameId: 0,
  _allAnimals: null
};
