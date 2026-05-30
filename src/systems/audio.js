// High-quality realistic audio system
// Uses advanced synthesis for realistic gun sounds

import * as THREE from 'three';

let audioCtx = null;
let initialized = false;
let noiseBuffer = null;

export function initAudio() {
  if (initialized) return true;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    // Create noise buffer for realistic sounds
    noiseBuffer = createNoiseBuffer(1);
    initialized = true;
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
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

export function playSound(type, sourcePos = null) {
  if (!audioCtx || audioCtx.state === 'suspended') return;

  try {
    const now = audioCtx.currentTime;
    const vol = sourcePos ? 0.4 : 0.2;

    // Create panner for 3D sound
    let panner = null;
    if (sourcePos) {
      panner = audioCtx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'exponential';
      panner.refDistance = 30;
      panner.maxDistance = 1200;
      panner.rolloffFactor = 0.8;
      panner.positionX.value = sourcePos.x;
      panner.positionY.value = sourcePos.y;
      panner.positionZ.value = sourcePos.z;
    }

    const output = panner || audioCtx.destination;

    switch (type) {
      case 'pistol':
        playRealisticPistol(now, vol, output);
        break;
      case 'ar':
      case 'ar_fast':
        playRealisticAR(now, vol, output, type === 'ar_fast');
        break;
      case 'sniper':
        playRealisticSniper(now, vol, output);
        break;
      case 'shotgun':
        playRealisticShotgun(now, vol, output);
        break;
      case 'hit':
        playRealisticHit(now, vol, output);
        break;
      default:
        playRealisticGeneric(now, vol, output);
    }

    if (panner) {
      setTimeout(() => panner.disconnect(), 3000);
    }
  } catch (e) {
    // Ignore audio errors
  }
}

function playRealisticPistol(now, vol, output) {
  // Layer 1: Sharp crack
  const crack = audioCtx.createOscillator();
  const crackGain = audioCtx.createGain();
  crack.type = 'sawtooth';
  crack.frequency.setValueAtTime(1200, now);
  crack.frequency.exponentialRampToValueAtTime(200, now + 0.015);
  crackGain.gain.setValueAtTime(vol * 0.7, now);
  crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
  crack.connect(crackGain);
  crackGain.connect(output);
  crack.start(now);
  crack.stop(now + 0.04);

  // Layer 2: Body thump
  const body = audioCtx.createOscillator();
  const bodyGain = audioCtx.createGain();
  body.type = 'sine';
  body.frequency.setValueAtTime(250, now);
  body.frequency.exponentialRampToValueAtTime(60, now + 0.08);
  bodyGain.gain.setValueAtTime(vol * 0.5, now);
  bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  body.connect(bodyGain);
  bodyGain.connect(output);
  body.start(now);
  body.stop(now + 0.12);

  // Layer 3: Noise burst
  if (noiseBuffer) {
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    const noiseGain = audioCtx.createGain();
    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 3000;
    noiseGain.gain.setValueAtTime(vol * 0.4, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(output);
    noise.start(now);
    noise.stop(now + 0.03);
  }
}

function playRealisticAR(now, vol, output, fast = false) {
  const dur = fast ? 0.05 : 0.08;

  // Layer 1: Mechanical action
  const mech = audioCtx.createOscillator();
  const mechGain = audioCtx.createGain();
  mech.type = 'square';
  mech.frequency.setValueAtTime(800, now);
  mech.frequency.exponentialRampToValueAtTime(100, now + 0.01);
  mechGain.gain.setValueAtTime(vol * 0.4, now);
  mechGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
  mech.connect(mechGain);
  mechGain.connect(output);
  mech.start(now);
  mech.stop(now + 0.03);

  // Layer 2: Low thump
  const thump = audioCtx.createOscillator();
  const thumpGain = audioCtx.createGain();
  thump.type = 'sine';
  thump.frequency.setValueAtTime(180, now);
  thump.frequency.exponentialRampToValueAtTime(40, now + dur);
  thumpGain.gain.setValueAtTime(vol * 0.6, now);
  thumpGain.gain.exponentialRampToValueAtTime(0.001, now + dur * 1.2);
  thump.connect(thumpGain);
  thumpGain.connect(output);
  thump.start(now);
  thump.stop(now + dur * 1.5);

  // Layer 3: High crack
  const crack = audioCtx.createOscillator();
  const crackGain = audioCtx.createGain();
  crack.type = 'sawtooth';
  crack.frequency.setValueAtTime(1000, now);
  crack.frequency.exponentialRampToValueAtTime(250, now + 0.015);
  crackGain.gain.setValueAtTime(vol * 0.35, now);
  crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
  crack.connect(crackGain);
  crackGain.connect(output);
  crack.start(now);
  crack.stop(now + 0.03);

  // Layer 4: Noise
  if (noiseBuffer) {
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    const noiseGain = audioCtx.createGain();
    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 2500;
    noiseFilter.Q.value = 2;
    noiseGain.gain.setValueAtTime(vol * 0.3, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(output);
    noise.start(now);
    noise.stop(now + dur * 1.2);
  }
}

function playRealisticSniper(now, vol, output) {
  // Layer 1: Massive crack
  const crack = audioCtx.createOscillator();
  const crackGain = audioCtx.createGain();
  crack.type = 'sawtooth';
  crack.frequency.setValueAtTime(1800, now);
  crack.frequency.exponentialRampToValueAtTime(100, now + 0.04);
  crackGain.gain.setValueAtTime(vol * 0.9, now);
  crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  crack.connect(crackGain);
  crackGain.connect(output);
  crack.start(now);
  crack.stop(now + 0.08);

  // Layer 2: Deep body
  const body = audioCtx.createOscillator();
  const bodyGain = audioCtx.createGain();
  body.type = 'sawtooth';
  body.frequency.setValueAtTime(120, now);
  body.frequency.exponentialRampToValueAtTime(25, now + 0.25);
  bodyGain.gain.setValueAtTime(vol * 0.7, now);
  bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  body.connect(bodyGain);
  bodyGain.connect(output);
  body.start(now);
  body.stop(now + 0.4);

  // Layer 3: Sub bass
  const sub = audioCtx.createOscillator();
  const subGain = audioCtx.createGain();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(50, now);
  sub.frequency.exponentialRampToValueAtTime(15, now + 0.4);
  subGain.gain.setValueAtTime(vol * 0.5, now);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  sub.connect(subGain);
  subGain.connect(output);
  sub.start(now);
  sub.stop(now + 0.6);

  // Layer 4: Noise crack
  if (noiseBuffer) {
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    const noiseGain = audioCtx.createGain();
    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 3500;
    noiseFilter.Q.value = 1;
    noiseGain.gain.setValueAtTime(vol * 0.5, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(output);
    noise.start(now);
    noise.stop(now + 0.08);
  }
}

function playRealisticShotgun(now, vol, output) {
  // Layer 1: Big boom
  const boom = audioCtx.createOscillator();
  const boomGain = audioCtx.createGain();
  boom.type = 'sine';
  boom.frequency.setValueAtTime(100, now);
  boom.frequency.exponentialRampToValueAtTime(20, now + 0.12);
  boomGain.gain.setValueAtTime(vol * 1.0, now);
  boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  boom.connect(boomGain);
  boomGain.connect(output);
  boom.start(now);
  boom.stop(now + 0.2);

  // Layer 2: Click
  const click = audioCtx.createOscillator();
  const clickGain = audioCtx.createGain();
  click.type = 'square';
  click.frequency.setValueAtTime(600, now);
  click.frequency.exponentialRampToValueAtTime(80, now + 0.02);
  clickGain.gain.setValueAtTime(vol * 0.5, now);
  clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
  click.connect(clickGain);
  clickGain.connect(output);
  click.start(now);
  click.stop(now + 0.05);

  // Layer 3: Noise burst
  if (noiseBuffer) {
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    const noiseGain = audioCtx.createGain();
    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 800;
    noiseGain.gain.setValueAtTime(vol * 0.7, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(output);
    noise.start(now);
    noise.stop(now + 0.15);
  }
}

function playRealisticHit(now, vol, output) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(300, now);
  osc.frequency.exponentialRampToValueAtTime(800, now + 0.08);
  gain.gain.setValueAtTime(vol * 0.5, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  osc.connect(gain);
  gain.connect(output);
  osc.start(now);
  osc.stop(now + 0.12);
}

function playRealisticGeneric(now, vol, output) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(350, now);
  osc.frequency.exponentialRampToValueAtTime(50, now + 0.08);
  gain.gain.setValueAtTime(vol * 0.4, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  osc.connect(gain);
  gain.connect(output);
  osc.start(now);
  osc.stop(now + 0.12);
}

export function playZombieSound(type, sourcePos = null) {
  if (!audioCtx || audioCtx.state === 'suspended') return;

  try {
    const now = audioCtx.currentTime;
    const vol = sourcePos ? 0.3 : 0.1;

    let panner = null;
    if (sourcePos) {
      panner = audioCtx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'exponential';
      panner.refDistance = 20;
      panner.maxDistance = 600;
      panner.rolloffFactor = 1.0;
      panner.positionX.value = sourcePos.x;
      panner.positionY.value = sourcePos.y;
      panner.positionZ.value = sourcePos.z;
    }

    const output = panner || audioCtx.destination;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    if (type === 'growl') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(55, now);
      osc.frequency.linearRampToValueAtTime(35, now + 1.0);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.linearRampToValueAtTime(70, now + 0.2);
      gain.gain.setValueAtTime(vol * 0.8, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    }

    osc.connect(gain);
    gain.connect(output);
    osc.start(now);
    osc.stop(now + 1.5);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
      if (panner) panner.disconnect();
    };
  } catch (e) {}
}

export function playGhostWhisper(pos) {
  if (!audioCtx || audioCtx.state === 'suspended') return;

  try {
    const now = audioCtx.currentTime;
    const panner = audioCtx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'exponential';
    panner.refDistance = 15;
    panner.maxDistance = 300;
    panner.rolloffFactor = 1.0;
    panner.positionX.value = pos.x;
    panner.positionY.value = pos.y;
    panner.positionZ.value = pos.z;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(250, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 2.0);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.8);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
    osc.connect(gain);
    gain.connect(panner);
    panner.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 3.0);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); panner.disconnect(); };
  } catch (e) {}
}

export function playThunderSound() {
  if (!audioCtx || audioCtx.state === 'suspended') return;

  try {
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(60, now);
    osc.frequency.exponentialRampToValueAtTime(10, now + 1.5);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.6, now + 0.15);
    gain.gain.setValueAtTime(0.6, now + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 2.5);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
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
