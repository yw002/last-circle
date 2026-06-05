// Ultra-realistic audio system with advanced multi-layer synthesis
// Each sound has 5-8 layers for maximum realism

import * as THREE from 'three';

let audioCtx = null;
let initialized = false;
let noiseBuffer = null;
let longNoiseBuffer = null;

export function initAudio() {
  if (initialized) return true;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    noiseBuffer = createNoiseBuffer(1);
    longNoiseBuffer = createNoiseBuffer(3);
    initialized = true;
    setInterval(() => {
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    }, 500);
    return true;
  } catch (e) {
    console.warn('Audio init failed:', e);
    return false;
  }
}

function createNoiseBuffer(duration) {
  const length = audioCtx.sampleRate * duration;
  const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

export function resumeAudio() {
  if (!initialized) initAudio();
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

function createPanner(sourcePos) {
  if (!sourcePos) return null;
  const panner = audioCtx.createPanner();
  panner.panningModel = 'HRTF';
  panner.distanceModel = 'exponential';
  panner.refDistance = 40;
  panner.maxDistance = 2000;
  panner.rolloffFactor = 0.6;
  panner.positionX.value = sourcePos.x;
  panner.positionY.value = sourcePos.y;
  panner.positionZ.value = sourcePos.z;
  return panner;
}

function connectToOutput(node, panner) {
  if (panner) {
    node.connect(panner);
    panner.connect(audioCtx.destination);
  } else {
    node.connect(audioCtx.destination);
  }
}

function playLowAmmoTail(now, vol, panner, intensity = 1) {
  const clamped = Math.max(0.18, Math.min(0.85, intensity));

  // Low-ammo cue sits between realistic dry mechanics and readable combat feedback.
  const bolt = audioCtx.createOscillator();
  const boltGain = audioCtx.createGain();
  bolt.type = 'triangle';
  bolt.frequency.setValueAtTime(1350, now + 0.019);
  bolt.frequency.exponentialRampToValueAtTime(360, now + 0.055);
  boltGain.gain.setValueAtTime(0, now);
  boltGain.gain.linearRampToValueAtTime(vol * 0.19 * clamped, now + 0.023);
  boltGain.gain.exponentialRampToValueAtTime(0.001, now + 0.078);
  bolt.connect(boltGain);
  connectToOutput(boltGain, panner);
  bolt.start(now + 0.015);
  bolt.stop(now + 0.095);

  if (noiseBuffer) {
    const scrape = audioCtx.createBufferSource();
    scrape.buffer = noiseBuffer;
    const scrapeGain = audioCtx.createGain();
    const scrapeFilter = audioCtx.createBiquadFilter();
    scrapeFilter.type = 'bandpass';
    scrapeFilter.frequency.value = 1900;
    scrapeFilter.Q.value = 1.4;
    scrapeGain.gain.setValueAtTime(vol * 0.105 * clamped, now + 0.022);
    scrapeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    scrape.connect(scrapeFilter);
    scrapeFilter.connect(scrapeGain);
    connectToOutput(scrapeGain, panner);
    scrape.start(now + 0.02);
    scrape.stop(now + 0.09);
  }
}

function playLastRoundLockSound(now, vol, panner) {
  // Last-round lockback is audible, but still tucked behind the shot.
  const lock = audioCtx.createOscillator();
  const lockGain = audioCtx.createGain();
  lock.type = 'triangle';
  lock.frequency.setValueAtTime(1120, now + 0.07);
  lock.frequency.exponentialRampToValueAtTime(420, now + 0.122);
  lockGain.gain.setValueAtTime(0, now);
  lockGain.gain.linearRampToValueAtTime(vol * 0.33, now + 0.08);
  lockGain.gain.exponentialRampToValueAtTime(0.001, now + 0.158);
  lock.connect(lockGain);
  connectToOutput(lockGain, panner);
  lock.start(now + 0.07);
  lock.stop(now + 0.185);
}

function playDryFireSound(now, vol, panner) {
  const click = audioCtx.createOscillator();
  const clickGain = audioCtx.createGain();
  click.type = 'square';
  click.frequency.setValueAtTime(2400, now);
  click.frequency.exponentialRampToValueAtTime(280, now + 0.035);
  clickGain.gain.setValueAtTime(vol * 0.8, now);
  clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  click.connect(clickGain);
  connectToOutput(clickGain, panner);
  click.start(now);
  click.stop(now + 0.07);
}

export function playBulletWhiz(sourcePos = null, intensity = 1) {
  if (!audioCtx || audioCtx.state === 'suspended') return;
  try {
    const now = audioCtx.currentTime;
    const vol = Math.max(0.08, Math.min(0.35, 0.18 * intensity));
    const panner = createPanner(sourcePos);

    if (noiseBuffer) {
      const noise = audioCtx.createBufferSource();
      noise.buffer = noiseBuffer;
      const noiseGain = audioCtx.createGain();
      const noiseFilter = audioCtx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.value = 5200;
      noiseFilter.Q.value = 5;
      noiseGain.gain.setValueAtTime(vol, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      connectToOutput(noiseGain, panner);
      noise.start(now);
      noise.stop(now + 0.18);
    }

    const snap = audioCtx.createOscillator();
    const snapGain = audioCtx.createGain();
    snap.type = 'triangle';
    snap.frequency.setValueAtTime(1800, now);
    snap.frequency.exponentialRampToValueAtTime(720, now + 0.055);
    snapGain.gain.setValueAtTime(vol * 0.45, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    snap.connect(snapGain);
    connectToOutput(snapGain, panner);
    snap.start(now);
    snap.stop(now + 0.09);
  } catch (e) {}
}

export function playImpactSound(material = 'dirt', sourcePos = null) {
  if (!audioCtx || audioCtx.state === 'suspended') return;
  try {
    const now = audioCtx.currentTime;
    const vol = sourcePos ? 0.45 : 0.22;
    const panner = createPanner(sourcePos);

    const profiles = {
      metal: { freq: 1700, end: 520, noiseFreq: 5200, noiseVol: 0.25, oscVol: 0.45, dur: 0.14 },
      wood: { freq: 850, end: 180, noiseFreq: 1400, noiseVol: 0.32, oscVol: 0.28, dur: 0.12 },
      stone: { freq: 620, end: 120, noiseFreq: 2300, noiseVol: 0.34, oscVol: 0.22, dur: 0.1 },
      water: { freq: 420, end: 160, noiseFreq: 900, noiseVol: 0.38, oscVol: 0.12, dur: 0.16 },
      building: { freq: 700, end: 130, noiseFreq: 1800, noiseVol: 0.3, oscVol: 0.22, dur: 0.11 },
      dirt: { freq: 420, end: 80, noiseFreq: 700, noiseVol: 0.34, oscVol: 0.18, dur: 0.13 }
    };
    const profile = profiles[material] || profiles.dirt;

    const thud = audioCtx.createOscillator();
    const thudGain = audioCtx.createGain();
    thud.type = material === 'metal' ? 'triangle' : 'sine';
    thud.frequency.setValueAtTime(profile.freq, now);
    thud.frequency.exponentialRampToValueAtTime(profile.end, now + profile.dur * 0.55);
    thudGain.gain.setValueAtTime(vol * profile.oscVol, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + profile.dur);
    thud.connect(thudGain);
    connectToOutput(thudGain, panner);
    thud.start(now);
    thud.stop(now + profile.dur + 0.03);

    if (noiseBuffer) {
      const noise = audioCtx.createBufferSource();
      noise.buffer = noiseBuffer;
      const noiseGain = audioCtx.createGain();
      const noiseFilter = audioCtx.createBiquadFilter();
      noiseFilter.type = material === 'water' ? 'lowpass' : 'bandpass';
      noiseFilter.frequency.value = profile.noiseFreq;
      noiseFilter.Q.value = 1.5;
      noiseGain.gain.setValueAtTime(vol * profile.noiseVol, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + profile.dur);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      connectToOutput(noiseGain, panner);
      noise.start(now);
      noise.stop(now + profile.dur + 0.03);
    }
  } catch (e) {}
}

function applyAmmoTone(type, now, vol, panner, options) {
  if (!options || typeof options.remainingAmmo !== 'number' || typeof options.maxAmmo !== 'number') return;
  if (type === 'hit' || type === 'melee' || options.maxAmmo <= 1) return;

  const remaining = options.remainingAmmo;
  const lowThreshold = Math.max(3, Math.ceil(options.maxAmmo * 0.15));
  if (remaining <= 0) {
    playLastRoundLockSound(now, vol, panner);
  } else if (remaining <= lowThreshold) {
    const intensity = 0.4 + (lowThreshold - remaining) / lowThreshold * 0.48;
    playLowAmmoTail(now, vol, panner, intensity);
  }
}

// ========== PISTOL SOUND (6 layers) ==========
function playPistolSound(now, vol, panner) {
  // Layer 1: Mechanical hammer click
  const hammer = audioCtx.createOscillator();
  const hammerGain = audioCtx.createGain();
  hammer.type = 'square';
  hammer.frequency.setValueAtTime(2000, now);
  hammer.frequency.exponentialRampToValueAtTime(300, now + 0.008);
  hammerGain.gain.setValueAtTime(vol * 0.4, now);
  hammerGain.gain.exponentialRampToValueAtTime(0.001, now + 0.012);
  hammer.connect(hammerGain);
  connectToOutput(hammerGain, panner);
  hammer.start(now);
  hammer.stop(now + 0.015);

  // Layer 2: Sharp gunshot crack
  const crack = audioCtx.createOscillator();
  const crackGain = audioCtx.createGain();
  crack.type = 'sawtooth';
  crack.frequency.setValueAtTime(1200, now);
  crack.frequency.exponentialRampToValueAtTime(200, now + 0.015);
  crackGain.gain.setValueAtTime(vol * 0.9, now);
  crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
  crack.connect(crackGain);
  connectToOutput(crackGain, panner);
  crack.start(now);
  crack.stop(now + 0.04);

  // Layer 3: Mid-range body punch
  const body = audioCtx.createOscillator();
  const bodyGain = audioCtx.createGain();
  body.type = 'sine';
  body.frequency.setValueAtTime(250, now);
  body.frequency.exponentialRampToValueAtTime(60, now + 0.08);
  bodyGain.gain.setValueAtTime(vol * 0.6, now);
  bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  body.connect(bodyGain);
  connectToOutput(bodyGain, panner);
  body.start(now);
  body.stop(now + 0.12);

  // Layer 4: Low frequency thump
  const thump = audioCtx.createOscillator();
  const thumpGain = audioCtx.createGain();
  thump.type = 'sine';
  thump.frequency.setValueAtTime(80, now);
  thump.frequency.exponentialRampToValueAtTime(30, now + 0.15);
  thumpGain.gain.setValueAtTime(vol * 0.4, now);
  thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  thump.connect(thumpGain);
  connectToOutput(thumpGain, panner);
  thump.start(now);
  thump.stop(now + 0.25);

  // Layer 5: High frequency noise burst
  if (noiseBuffer) {
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    const noiseGain = audioCtx.createGain();
    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 5000;
    noiseGain.gain.setValueAtTime(vol * 0.5, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    connectToOutput(noiseGain, panner);
    noise.start(now);
    noise.stop(now + 0.025);
  }

  // Layer 6: Tail echo
  const echo = audioCtx.createOscillator();
  const echoGain = audioCtx.createGain();
  echo.type = 'sine';
  echo.frequency.setValueAtTime(100, now + 0.05);
  echo.frequency.exponentialRampToValueAtTime(40, now + 0.3);
  echoGain.gain.setValueAtTime(0, now);
  echoGain.gain.linearRampToValueAtTime(vol * 0.15, now + 0.05);
  echoGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  echo.connect(echoGain);
  connectToOutput(echoGain, panner);
  echo.start(now + 0.05);
  echo.stop(now + 0.4);
}

// ========== AR SOUND (7 layers) ==========
function playARSound(now, vol, panner, fast) {
  const dur = fast ? 0.04 : 0.06;

  // Layer 1: Mechanical bolt action
  const bolt = audioCtx.createOscillator();
  const boltGain = audioCtx.createGain();
  bolt.type = 'square';
  bolt.frequency.setValueAtTime(1500, now);
  bolt.frequency.exponentialRampToValueAtTime(200, now + 0.008);
  boltGain.gain.setValueAtTime(vol * 0.3, now);
  boltGain.gain.exponentialRampToValueAtTime(0.001, now + 0.012);
  bolt.connect(boltGain);
  connectToOutput(boltGain, panner);
  bolt.start(now);
  bolt.stop(now + 0.015);

  // Layer 2: Sharp crack
  const crack = audioCtx.createOscillator();
  const crackGain = audioCtx.createGain();
  crack.type = 'sawtooth';
  crack.frequency.setValueAtTime(1500, now);
  crack.frequency.exponentialRampToValueAtTime(300, now + 0.012);
  crackGain.gain.setValueAtTime(vol * 0.8, now);
  crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
  crack.connect(crackGain);
  connectToOutput(crackGain, panner);
  crack.start(now);
  crack.stop(now + 0.03);

  // Layer 3: Mid body
  const mid = audioCtx.createOscillator();
  const midGain = audioCtx.createGain();
  mid.type = 'triangle';
  mid.frequency.setValueAtTime(400, now);
  mid.frequency.exponentialRampToValueAtTime(80, now + dur);
  midGain.gain.setValueAtTime(vol * 0.5, now);
  midGain.gain.exponentialRampToValueAtTime(0.001, now + dur * 1.2);
  mid.connect(midGain);
  connectToOutput(midGain, panner);
  mid.start(now);
  mid.stop(now + dur * 1.5);

  // Layer 4: Low thump
  const thump = audioCtx.createOscillator();
  const thumpGain = audioCtx.createGain();
  thump.type = 'sine';
  thump.frequency.setValueAtTime(160, now);
  thump.frequency.exponentialRampToValueAtTime(35, now + dur);
  thumpGain.gain.setValueAtTime(vol * 0.6, now);
  thumpGain.gain.exponentialRampToValueAtTime(0.001, now + dur * 1.3);
  thump.connect(thumpGain);
  connectToOutput(thumpGain, panner);
  thump.start(now);
  thump.stop(now + dur * 1.5);

  // Layer 5: Sub bass
  const sub = audioCtx.createOscillator();
  const subGain = audioCtx.createGain();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(50, now);
  sub.frequency.exponentialRampToValueAtTime(20, now + dur * 2);
  subGain.gain.setValueAtTime(vol * 0.3, now);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + dur * 2.5);
  sub.connect(subGain);
  connectToOutput(subGain, panner);
  sub.start(now);
  sub.stop(now + dur * 3);

  // Layer 6: Supersonic crack
  const superC = audioCtx.createOscillator();
  const superCGain = audioCtx.createGain();
  superC.type = 'sawtooth';
  superC.frequency.setValueAtTime(3000, now);
  superC.frequency.exponentialRampToValueAtTime(800, now + 0.006);
  superCGain.gain.setValueAtTime(vol * 0.25, now);
  superCGain.gain.exponentialRampToValueAtTime(0.001, now + 0.01);
  superC.connect(superCGain);
  connectToOutput(superCGain, panner);
  superC.start(now);
  superC.stop(now + 0.012);

  // Layer 7: Noise
  if (noiseBuffer) {
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    const noiseGain = audioCtx.createGain();
    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 3500;
    noiseFilter.Q.value = 1;
    noiseGain.gain.setValueAtTime(vol * 0.35, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    connectToOutput(noiseGain, panner);
    noise.start(now);
    noise.stop(now + dur * 1.2);
  }
}

// ========== SNIPER SOUND (7 layers) ==========
function playSniperSound(now, vol, panner) {
  // Layer 1: Massive initial crack
  const crack = audioCtx.createOscillator();
  const crackGain = audioCtx.createGain();
  crack.type = 'sawtooth';
  crack.frequency.setValueAtTime(2500, now);
  crack.frequency.exponentialRampToValueAtTime(150, now + 0.04);
  crackGain.gain.setValueAtTime(vol * 1.0, now);
  crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  crack.connect(crackGain);
  connectToOutput(crackGain, panner);
  crack.start(now);
  crack.stop(now + 0.08);

  // Layer 2: Bolt action mechanical
  const bolt = audioCtx.createOscillator();
  const boltGain = audioCtx.createGain();
  bolt.type = 'square';
  bolt.frequency.setValueAtTime(800, now);
  bolt.frequency.exponentialRampToValueAtTime(100, now + 0.015);
  boltGain.gain.setValueAtTime(vol * 0.4, now);
  boltGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
  bolt.connect(boltGain);
  connectToOutput(boltGain, panner);
  bolt.start(now);
  bolt.stop(now + 0.03);

  // Layer 3: Deep body resonance
  const body = audioCtx.createOscillator();
  const bodyGain = audioCtx.createGain();
  body.type = 'sawtooth';
  body.frequency.setValueAtTime(120, now);
  body.frequency.exponentialRampToValueAtTime(25, now + 0.3);
  bodyGain.gain.setValueAtTime(vol * 0.8, now);
  bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
  body.connect(bodyGain);
  connectToOutput(bodyGain, panner);
  body.start(now);
  body.stop(now + 0.5);

  // Layer 4: Sub-bass rumble
  const sub = audioCtx.createOscillator();
  const subGain = audioCtx.createGain();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(45, now);
  sub.frequency.exponentialRampToValueAtTime(12, now + 0.5);
  subGain.gain.setValueAtTime(vol * 0.6, now);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
  sub.connect(subGain);
  connectToOutput(subGain, panner);
  sub.start(now);
  sub.stop(now + 0.7);

  // Layer 5: High frequency snap
  if (noiseBuffer) {
    const snap = audioCtx.createBufferSource();
    snap.buffer = noiseBuffer;
    const snapGain = audioCtx.createGain();
    const snapFilter = audioCtx.createBiquadFilter();
    snapFilter.type = 'highpass';
    snapFilter.frequency.value = 6000;
    snapGain.gain.setValueAtTime(vol * 0.6, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    snap.connect(snapFilter);
    snapFilter.connect(snapGain);
    connectToOutput(snapGain, panner);
    snap.start(now);
    snap.stop(now + 0.04);
  }

  // Layer 6: Long echo tail
  const echo = audioCtx.createOscillator();
  const echoGain = audioCtx.createGain();
  echo.type = 'sine';
  echo.frequency.setValueAtTime(60, now + 0.1);
  echo.frequency.exponentialRampToValueAtTime(20, now + 0.8);
  echoGain.gain.setValueAtTime(0, now);
  echoGain.gain.linearRampToValueAtTime(vol * 0.25, now + 0.1);
  echoGain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
  echo.connect(echoGain);
  connectToOutput(echoGain, panner);
  echo.start(now + 0.1);
  echo.stop(now + 1.2);

  // Layer 7: Noise crack
  if (longNoiseBuffer) {
    const noise = audioCtx.createBufferSource();
    noise.buffer = longNoiseBuffer;
    const noiseGain = audioCtx.createGain();
    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 4000;
    noiseFilter.Q.value = 0.8;
    noiseGain.gain.setValueAtTime(vol * 0.4, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    connectToOutput(noiseGain, panner);
    noise.start(now);
    noise.stop(now + 0.08);
  }
}

// ========== SHOTGUN SOUND (6 layers) ==========
function playShotgunSound(now, vol, panner) {
  // Layer 1: Massive boom
  const boom = audioCtx.createOscillator();
  const boomGain = audioCtx.createGain();
  boom.type = 'sine';
  boom.frequency.setValueAtTime(80, now);
  boom.frequency.exponentialRampToValueAtTime(15, now + 0.15);
  boomGain.gain.setValueAtTime(vol * 1.3, now);
  boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  boom.connect(boomGain);
  connectToOutput(boomGain, panner);
  boom.start(now);
  boom.stop(now + 0.25);

  // Layer 2: Mechanical click
  const click = audioCtx.createOscillator();
  const clickGain = audioCtx.createGain();
  click.type = 'square';
  click.frequency.setValueAtTime(900, now);
  click.frequency.exponentialRampToValueAtTime(100, now + 0.012);
  clickGain.gain.setValueAtTime(vol * 0.5, now);
  clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
  click.connect(clickGain);
  connectToOutput(clickGain, panner);
  click.start(now);
  click.stop(now + 0.025);

  // Layer 3: Shotgun crack
  const crack = audioCtx.createOscillator();
  const crackGain = audioCtx.createGain();
  crack.type = 'sawtooth';
  crack.frequency.setValueAtTime(700, now);
  crack.frequency.exponentialRampToValueAtTime(100, now + 0.025);
  crackGain.gain.setValueAtTime(vol * 0.7, now);
  crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
  crack.connect(crackGain);
  connectToOutput(crackGain, panner);
  crack.start(now);
  crack.stop(now + 0.05);

  // Layer 4: Noise burst (pellets)
  if (noiseBuffer) {
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    const noiseGain = audioCtx.createGain();
    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 900;
    noiseGain.gain.setValueAtTime(vol * 0.9, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    connectToOutput(noiseGain, panner);
    noise.start(now);
    noise.stop(now + 0.15);
  }

  // Layer 5: Low rumble
  const rumble = audioCtx.createOscillator();
  const rumbleGain = audioCtx.createGain();
  rumble.type = 'sine';
  rumble.frequency.setValueAtTime(40, now + 0.05);
  rumble.frequency.exponentialRampToValueAtTime(15, now + 0.4);
  rumbleGain.gain.setValueAtTime(0, now);
  rumbleGain.gain.linearRampToValueAtTime(vol * 0.3, now + 0.05);
  rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  rumble.connect(rumbleGain);
  connectToOutput(rumbleGain, panner);
  rumble.start(now + 0.05);
  rumble.stop(now + 0.6);

  // Layer 6: Pump action (delayed)
  const pump = audioCtx.createOscillator();
  const pumpGain = audioCtx.createGain();
  pump.type = 'square';
  pump.frequency.setValueAtTime(400, now + 0.3);
  pump.frequency.exponentialRampToValueAtTime(100, now + 0.38);
  pumpGain.gain.setValueAtTime(0, now);
  pumpGain.gain.linearRampToValueAtTime(vol * 0.3, now + 0.3);
  pumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
  pump.connect(pumpGain);
  connectToOutput(pumpGain, panner);
  pump.start(now + 0.3);
  pump.stop(now + 0.45);
}

// ========== HIT SOUND (4 layers) ==========
function playHitSound(now, vol, panner) {
  // Layer 1: Impact thud
  const thud = audioCtx.createOscillator();
  const thudGain = audioCtx.createGain();
  thud.type = 'sine';
  thud.frequency.setValueAtTime(300, now);
  thud.frequency.exponentialRampToValueAtTime(60, now + 0.06);
  thudGain.gain.setValueAtTime(vol * 0.8, now);
  thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  thud.connect(thudGain);
  connectToOutput(thudGain, panner);
  thud.start(now);
  thud.stop(now + 0.1);

  // Layer 2: Flesh impact
  if (noiseBuffer) {
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    const noiseGain = audioCtx.createGain();
    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 600;
    noiseFilter.Q.value = 2;
    noiseGain.gain.setValueAtTime(vol * 0.5, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    connectToOutput(noiseGain, panner);
    noise.start(now);
    noise.stop(now + 0.06);
  }

  // Layer 3: High crack
  const crack = audioCtx.createOscillator();
  const crackGain = audioCtx.createGain();
  crack.type = 'sawtooth';
  crack.frequency.setValueAtTime(800, now);
  crack.frequency.exponentialRampToValueAtTime(200, now + 0.02);
  crackGain.gain.setValueAtTime(vol * 0.35, now);
  crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
  crack.connect(crackGain);
  connectToOutput(crackGain, panner);
  crack.start(now);
  crack.stop(now + 0.04);

  // Layer 4: Low resonance
  const low = audioCtx.createOscillator();
  const lowGain = audioCtx.createGain();
  low.type = 'sine';
  low.frequency.setValueAtTime(100, now);
  low.frequency.exponentialRampToValueAtTime(40, now + 0.1);
  lowGain.gain.setValueAtTime(vol * 0.2, now);
  lowGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  low.connect(lowGain);
  connectToOutput(lowGain, panner);
  low.start(now);
  low.stop(now + 0.15);
}

// ========== ZOMBIE SOUNDS ==========
export function playZombieSound(type, sourcePos = null) {
  if (!audioCtx || audioCtx.state === 'suspended') return;
  try {
    const now = audioCtx.currentTime;
    const vol = sourcePos ? 0.5 : 0.2;
    const panner = createPanner(sourcePos);

    if (type === 'growl') {
      // Deep guttural growl with LFO tremolo
      const osc = audioCtx.createOscillator();
      const lfo = audioCtx.createOscillator();
      const lfoGain = audioCtx.createGain();
      const gain = audioCtx.createGain();
      const filter = audioCtx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(55, now);
      osc.frequency.linearRampToValueAtTime(35, now + 1.0);

      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(10, now);
      lfoGain.gain.setValueAtTime(20, now);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(200, now);

      osc.connect(filter);
      filter.connect(gain);
      connectToOutput(gain, panner);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      lfo.start(now);
      osc.start(now);
      lfo.stop(now + 1.5);
      osc.stop(now + 1.5);

      // Raspy noise layer
      if (noiseBuffer) {
        const noise = audioCtx.createBufferSource();
        noise.buffer = noiseBuffer;
        const noiseGain = audioCtx.createGain();
        const noiseFilter = audioCtx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.value = 180;
        noiseFilter.Q.value = 4;
        noiseGain.gain.setValueAtTime(0, now);
        noiseGain.gain.linearRampToValueAtTime(vol * 0.3, now + 0.1);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        connectToOutput(noiseGain, panner);
        noise.start(now);
        noise.stop(now + 1.2);
      }
    } else {
      // Bite/snap
      const snap = audioCtx.createOscillator();
      const snapGain = audioCtx.createGain();
      snap.type = 'sawtooth';
      snap.frequency.setValueAtTime(180, now);
      snap.frequency.exponentialRampToValueAtTime(60, now + 0.08);
      snapGain.gain.setValueAtTime(vol * 0.9, now);
      snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      snap.connect(snapGain);
      connectToOutput(snapGain, panner);
      snap.start(now);
      snap.stop(now + 0.15);

      if (noiseBuffer) {
        const noise = audioCtx.createBufferSource();
        noise.buffer = noiseBuffer;
        const noiseGain = audioCtx.createGain();
        const noiseFilter = audioCtx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = 1000;
        noiseGain.gain.setValueAtTime(vol * 0.5, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        connectToOutput(noiseGain, panner);
        noise.start(now);
        noise.stop(now + 0.05);
      }
    }
  } catch (e) {}
}

// ========== GHOST WHISPER ==========
export function playGhostWhisper(pos) {
  if (!audioCtx || audioCtx.state === 'suspended') return;
  try {
    const now = audioCtx.currentTime;
    const panner = createPanner(pos);

    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(280, now);
    osc1.frequency.exponentialRampToValueAtTime(130, now + 2.0);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(284, now);
    osc2.frequency.exponentialRampToValueAtTime(134, now + 2.0);

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 350;
    filter.Q.value = 3;

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.8);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    connectToOutput(gain, panner);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 3.0);
    osc2.stop(now + 3.0);
  } catch (e) {}
}

// ========== THUNDER - High Fidelity ==========
export function playThunderSound() {
  if (!audioCtx || audioCtx.state === 'suspended') return;
  try {
    const now = audioCtx.currentTime;

    // Layer 1: Initial lightning crack (sharp transient)
    const crack = audioCtx.createOscillator();
    const crackGain = audioCtx.createGain();
    crack.type = 'sawtooth';
    crack.frequency.setValueAtTime(200, now);
    crack.frequency.exponentialRampToValueAtTime(30, now + 0.3);
    crackGain.gain.setValueAtTime(0, now);
    crackGain.gain.linearRampToValueAtTime(1.2, now + 0.05);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    crack.connect(crackGain);
    crackGain.connect(audioCtx.destination);
    crack.start(now);
    crack.stop(now + 0.6);

    // Layer 2: Deep rumble (low frequency roll)
    const rumble = audioCtx.createOscillator();
    const rumbleGain = audioCtx.createGain();
    rumble.type = 'sine';
    rumble.frequency.setValueAtTime(50, now + 0.1);
    rumble.frequency.exponentialRampToValueAtTime(8, now + 3.0);
    rumbleGain.gain.setValueAtTime(0, now);
    rumbleGain.gain.linearRampToValueAtTime(0.8, now + 0.3);
    rumbleGain.gain.setValueAtTime(0.8, now + 1.0);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 4.0);
    rumble.connect(rumbleGain);
    rumbleGain.connect(audioCtx.destination);
    rumble.start(now + 0.1);
    rumble.stop(now + 4.5);

    // Layer 3: Mid-range body (gives thunder its "weight")
    const body = audioCtx.createOscillator();
    const bodyGain = audioCtx.createGain();
    body.type = 'sawtooth';
    body.frequency.setValueAtTime(80, now + 0.05);
    body.frequency.exponentialRampToValueAtTime(20, now + 0.8);
    bodyGain.gain.setValueAtTime(0, now);
    bodyGain.gain.linearRampToValueAtTime(0.6, now + 0.1);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    body.connect(bodyGain);
    bodyGain.connect(audioCtx.destination);
    body.start(now + 0.05);
    body.stop(now + 2.0);

    // Layer 4: Noise crackle (electrical discharge)
    if (noiseBuffer) {
      const noise = audioCtx.createBufferSource();
      noise.buffer = noiseBuffer;
      const noiseGain = audioCtx.createGain();
      const noiseFilter = audioCtx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.value = 800;
      noiseFilter.Q.value = 2;
      noiseGain.gain.setValueAtTime(0, now);
      noiseGain.gain.linearRampToValueAtTime(0.8, now + 0.02);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(audioCtx.destination);
      noise.start(now);
      noise.stop(now + 0.4);
    }

    // Layer 5: Low frequency boom (felt more than heard)
    const boom = audioCtx.createOscillator();
    const boomGain = audioCtx.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(30, now + 0.2);
    boom.frequency.exponentialRampToValueAtTime(5, now + 2.0);
    boomGain.gain.setValueAtTime(0, now);
    boomGain.gain.linearRampToValueAtTime(0.5, now + 0.3);
    boomGain.gain.exponentialRampToValueAtTime(0.001, now + 3.0);
    boom.connect(boomGain);
    boomGain.connect(audioCtx.destination);
    boom.start(now + 0.2);
    boom.stop(now + 3.5);

    // Layer 6: Echo/reflection (delayed quieter version)
    setTimeout(() => {
      if (!audioCtx || audioCtx.state === 'suspended') return;
      try {
        const echoNow = audioCtx.currentTime;
        const echo = audioCtx.createOscillator();
        const echoGain = audioCtx.createGain();
        echo.type = 'sawtooth';
        echo.frequency.setValueAtTime(60, echoNow);
        echo.frequency.exponentialRampToValueAtTime(15, echoNow + 1.0);
        echoGain.gain.setValueAtTime(0, echoNow);
        echoGain.gain.linearRampToValueAtTime(0.4, echoNow + 0.2);
        echoGain.gain.exponentialRampToValueAtTime(0.001, echoNow + 2.0);
        echo.connect(echoGain);
        echoGain.connect(audioCtx.destination);
        echo.start(echoNow);
        echo.stop(echoNow + 2.5);
      } catch (e) {}
    }, 1500); // Echo arrives 1.5 seconds later
  } catch (e) {}
}

// ========== MAIN PLAY SOUND DISPATCHER ==========
export function playSound(type, sourcePos = null, options = null) {
  if (!audioCtx || audioCtx.state === 'suspended') return;
  try {
    const now = audioCtx.currentTime;
    const vol = sourcePos ? 0.6 : 0.3;
    const panner = createPanner(sourcePos);

    switch (type) {
      case 'dry_fire': playDryFireSound(now, vol, panner); break;
      case 'pistol': playPistolSound(now, vol, panner); break;
      case 'ar':
      case 'ar_fast': playARSound(now, vol, panner, type === 'ar_fast'); break;
      case 'sniper': playSniperSound(now, vol, panner); break;
      case 'shotgun': playShotgunSound(now, vol, panner); break;
      case 'hit': playHitSound(now, vol, panner); break;
      default: playARSound(now, vol, panner, false); break;
    }
    applyAmmoTone(type, now, vol, panner, options);
  } catch (e) {}
}

export function updateAudioListener(camera) {
  if (!audioCtx || !audioCtx.listener) return;
  try {
    const p = camera.position;
    if (audioCtx.listener.positionX) {
      audioCtx.listener.positionX.setTargetAtTime(p.x, audioCtx.currentTime, 0.1);
      audioCtx.listener.positionY.setTargetAtTime(p.y, audioCtx.currentTime, 0.1);
      audioCtx.listener.positionZ.setTargetAtTime(p.z, audioCtx.currentTime, 0.1);
    }
    const dir = camera.getWorldDirection(new THREE.Vector3());
    if (audioCtx.listener.forwardX) {
      audioCtx.listener.forwardX.setTargetAtTime(dir.x, audioCtx.currentTime, 0.1);
      audioCtx.listener.forwardY.setTargetAtTime(dir.y, audioCtx.currentTime, 0.1);
      audioCtx.listener.forwardZ.setTargetAtTime(dir.z, audioCtx.currentTime, 0.1);
    }
  } catch (e) {}
}
