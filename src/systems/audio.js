// Ultra-realistic audio system with advanced synthesis
// Multi-layered sounds with noise, filtering, and spatial audio

import * as THREE from 'three';

let audioCtx = null;
let initialized = false;
let noiseBuffer = null;
let longNoiseBuffer = null;

export function initAudio() {
  if (initialized) return true;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    noiseBuffer = createNoiseBuffer(0.5);
    longNoiseBuffer = createNoiseBuffer(2);
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

function createPanner(sourcePos) {
  if (!sourcePos) return null;
  const panner = audioCtx.createPanner();
  panner.panningModel = 'HRTF';
  panner.distanceModel = 'exponential';
  panner.refDistance = 30;
  panner.maxDistance = 1500;
  panner.rolloffFactor = 0.7;
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

export function playSound(type, sourcePos = null) {
  if (!audioCtx || audioCtx.state === 'suspended') return;

  try {
    const now = audioCtx.currentTime;
    const vol = sourcePos ? 0.5 : 0.25;
    const panner = createPanner(sourcePos);

    switch (type) {
      case 'pistol':
        playPistolSound(now, vol, panner);
        break;
      case 'ar':
      case 'ar_fast':
        playARSound(now, vol, panner, type === 'ar_fast');
        break;
      case 'sniper':
        playSniperSound(now, vol, panner);
        break;
      case 'shotgun':
        playShotgunSound(now, vol, panner);
        break;
      case 'hit':
        playHitSound(now, vol, panner);
        break;
      default:
        playGenericSound(now, vol, panner);
    }
  } catch (e) {}
}

function playPistolSound(now, vol, panner) {
  // Layer 1: Sharp mechanical click
  const click = audioCtx.createOscillator();
  const clickGain = audioCtx.createGain();
  click.type = 'square';
  click.frequency.setValueAtTime(1200, now);
  click.frequency.exponentialRampToValueAtTime(200, now + 0.012);
  clickGain.gain.setValueAtTime(vol * 0.6, now);
  clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
  click.connect(clickGain);
  connectToOutput(clickGain, panner);
  click.start(now);
  click.stop(now + 0.03);

  // Layer 2: Gunshot crack
  const crack = audioCtx.createOscillator();
  const crackGain = audioCtx.createGain();
  crack.type = 'sawtooth';
  crack.frequency.setValueAtTime(800, now);
  crack.frequency.exponentialRampToValueAtTime(150, now + 0.02);
  crackGain.gain.setValueAtTime(vol * 0.8, now);
  crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
  crack.connect(crackGain);
  connectToOutput(crackGain, panner);
  crack.start(now);
  crack.stop(now + 0.05);

  // Layer 3: Low body thump
  const body = audioCtx.createOscillator();
  const bodyGain = audioCtx.createGain();
  body.type = 'sine';
  body.frequency.setValueAtTime(200, now);
  body.frequency.exponentialRampToValueAtTime(50, now + 0.08);
  bodyGain.gain.setValueAtTime(vol * 0.5, now);
  bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  body.connect(bodyGain);
  connectToOutput(bodyGain, panner);
  body.start(now);
  body.stop(now + 0.12);

  // Layer 4: High frequency noise burst
  if (noiseBuffer) {
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    const noiseGain = audioCtx.createGain();
    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 4000;
    noiseGain.gain.setValueAtTime(vol * 0.4, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    connectToOutput(noiseGain, panner);
    noise.start(now);
    noise.stop(now + 0.03);
  }

  // Layer 5: Tail echo
  const tail = audioCtx.createOscillator();
  const tailGain = audioCtx.createGain();
  tail.type = 'sine';
  tail.frequency.setValueAtTime(120, now + 0.05);
  tail.frequency.exponentialRampToValueAtTime(40, now + 0.2);
  tailGain.gain.setValueAtTime(0, now);
  tailGain.gain.linearRampToValueAtTime(vol * 0.2, now + 0.05);
  tailGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  tail.connect(tailGain);
  connectToOutput(tailGain, panner);
  tail.start(now + 0.05);
  tail.stop(now + 0.3);
}

function playARSound(now, vol, panner, fast = false) {
  const dur = fast ? 0.04 : 0.06;

  // Layer 1: Mechanical action
  const mech = audioCtx.createOscillator();
  const mechGain = audioCtx.createGain();
  mech.type = 'square';
  mech.frequency.setValueAtTime(900, now);
  mech.frequency.exponentialRampToValueAtTime(120, now + 0.01);
  mechGain.gain.setValueAtTime(vol * 0.5, now);
  mechGain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);
  mech.connect(mechGain);
  connectToOutput(mechGain, panner);
  mech.start(now);
  mech.stop(now + 0.02);

  // Layer 2: Sharp crack
  const crack = audioCtx.createOscillator();
  const crackGain = audioCtx.createGain();
  crack.type = 'sawtooth';
  crack.frequency.setValueAtTime(1000, now);
  crack.frequency.exponentialRampToValueAtTime(200, now + 0.015);
  crackGain.gain.setValueAtTime(vol * 0.7, now);
  crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
  crack.connect(crackGain);
  connectToOutput(crackGain, panner);
  crack.start(now);
  crack.stop(now + 0.04);

  // Layer 3: Low thump
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

  // Layer 4: Mid-range body
  const mid = audioCtx.createOscillator();
  const midGain = audioCtx.createGain();
  mid.type = 'triangle';
  mid.frequency.setValueAtTime(400, now);
  mid.frequency.exponentialRampToValueAtTime(80, now + dur);
  midGain.gain.setValueAtTime(vol * 0.4, now);
  midGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
  mid.connect(midGain);
  connectToOutput(midGain, panner);
  mid.start(now);
  mid.stop(now + dur * 1.2);

  // Layer 5: Noise burst
  if (noiseBuffer) {
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    const noiseGain = audioCtx.createGain();
    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 3000;
    noiseFilter.Q.value = 1.5;
    noiseGain.gain.setValueAtTime(vol * 0.35, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    connectToOutput(noiseGain, panner);
    noise.start(now);
    noise.stop(now + dur * 1.2);
  }

  // Layer 6: Supersonic crack (for fast rounds)
  if (!fast) {
    const superCrack = audioCtx.createOscillator();
    const superGain = audioCtx.createGain();
    superCrack.type = 'sawtooth';
    superCrack.frequency.setValueAtTime(2000, now);
    superCrack.frequency.exponentialRampToValueAtTime(500, now + 0.008);
    superGain.gain.setValueAtTime(vol * 0.3, now);
    superGain.gain.exponentialRampToValueAtTime(0.001, now + 0.012);
    superCrack.connect(superGain);
    connectToOutput(superGain, panner);
    superCrack.start(now);
    superCrack.stop(now + 0.015);
  }
}

function playSniperSound(now, vol, panner) {
  // Layer 1: Massive initial crack
  const crack = audioCtx.createOscillator();
  const crackGain = audioCtx.createGain();
  crack.type = 'sawtooth';
  crack.frequency.setValueAtTime(2000, now);
  crack.frequency.exponentialRampToValueAtTime(100, now + 0.04);
  crackGain.gain.setValueAtTime(vol * 1.0, now);
  crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  crack.connect(crackGain);
  connectToOutput(crackGain, panner);
  crack.start(now);
  crack.stop(now + 0.08);

  // Layer 2: Mechanical bolt action
  const bolt = audioCtx.createOscillator();
  const boltGain = audioCtx.createGain();
  bolt.type = 'square';
  bolt.frequency.setValueAtTime(600, now);
  bolt.frequency.exponentialRampToValueAtTime(80, now + 0.02);
  boltGain.gain.setValueAtTime(vol * 0.4, now);
  boltGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
  bolt.connect(boltGain);
  connectToOutput(boltGain, panner);
  bolt.start(now);
  bolt.stop(now + 0.04);

  // Layer 3: Deep body resonance
  const body = audioCtx.createOscillator();
  const bodyGain = audioCtx.createGain();
  body.type = 'sawtooth';
  body.frequency.setValueAtTime(100, now);
  body.frequency.exponentialRampToValueAtTime(20, now + 0.3);
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
    snapFilter.frequency.value = 5000;
    snapGain.gain.setValueAtTime(vol * 0.5, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    snap.connect(snapFilter);
    snapFilter.connect(snapGain);
    connectToOutput(snapGain, panner);
    snap.start(now);
    snap.stop(now + 0.05);
  }

  // Layer 6: Long echo tail
  const echo = audioCtx.createOscillator();
  const echoGain = audioCtx.createGain();
  echo.type = 'sine';
  echo.frequency.setValueAtTime(60, now + 0.1);
  echo.frequency.exponentialRampToValueAtTime(20, now + 0.8);
  echoGain.gain.setValueAtTime(0, now);
  echoGain.gain.linearRampToValueAtTime(vol * 0.3, now + 0.1);
  echoGain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
  echo.connect(echoGain);
  connectToOutput(echoGain, panner);
  echo.start(now + 0.1);
  echo.stop(now + 1.2);
}

function playShotgunSound(now, vol, panner) {
  // Layer 1: Massive boom
  const boom = audioCtx.createOscillator();
  const boomGain = audioCtx.createGain();
  boom.type = 'sine';
  boom.frequency.setValueAtTime(80, now);
  boom.frequency.exponentialRampToValueAtTime(15, now + 0.15);
  boomGain.gain.setValueAtTime(vol * 1.2, now);
  boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  boom.connect(boomGain);
  connectToOutput(boomGain, panner);
  boom.start(now);
  boom.stop(now + 0.25);

  // Layer 2: Mechanical click
  const click = audioCtx.createOscillator();
  const clickGain = audioCtx.createGain();
  click.type = 'square';
  click.frequency.setValueAtTime(700, now);
  click.frequency.exponentialRampToValueAtTime(80, now + 0.015);
  clickGain.gain.setValueAtTime(vol * 0.5, now);
  clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
  click.connect(clickGain);
  connectToOutput(clickGain, panner);
  click.start(now);
  click.stop(now + 0.03);

  // Layer 3: Shotgun crack
  const crack = audioCtx.createOscillator();
  const crackGain = audioCtx.createGain();
  crack.type = 'sawtooth';
  crack.frequency.setValueAtTime(600, now);
  crack.frequency.exponentialRampToValueAtTime(100, now + 0.03);
  crackGain.gain.setValueAtTime(vol * 0.7, now);
  crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
  crack.connect(crackGain);
  connectToOutput(crackGain, panner);
  crack.start(now);
  crack.stop(now + 0.06);

  // Layer 4: Noise burst (pellets)
  if (noiseBuffer) {
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    const noiseGain = audioCtx.createGain();
    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 800;
    noiseGain.gain.setValueAtTime(vol * 0.8, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    connectToOutput(noiseGain, panner);
    noise.start(now);
    noise.stop(now + 0.15);
  }

  // Layer 5: Pump action (delayed)
  const pump = audioCtx.createOscillator();
  const pumpGain = audioCtx.createGain();
  pump.type = 'square';
  pump.frequency.setValueAtTime(300, now + 0.3);
  pump.frequency.exponentialRampToValueAtTime(100, now + 0.4);
  pumpGain.gain.setValueAtTime(0, now);
  pumpGain.gain.linearRampToValueAtTime(vol * 0.3, now + 0.3);
  pumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
  pump.connect(pumpGain);
  connectToOutput(pumpGain, panner);
  pump.start(now + 0.3);
  pump.stop(now + 0.5);
}

function playHitSound(now, vol, panner) {
  // Impact thud
  const thud = audioCtx.createOscillator();
  const thudGain = audioCtx.createGain();
  thud.type = 'sine';
  thud.frequency.setValueAtTime(250, now);
  thud.frequency.exponentialRampToValueAtTime(60, now + 0.06);
  thudGain.gain.setValueAtTime(vol * 0.7, now);
  thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  thud.connect(thudGain);
  connectToOutput(thudGain, panner);
  thud.start(now);
  thud.stop(now + 0.1);

  // Flesh impact noise
  if (noiseBuffer) {
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    const noiseGain = audioCtx.createGain();
    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 500;
    noiseFilter.Q.value = 2;
    noiseGain.gain.setValueAtTime(vol * 0.4, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    connectToOutput(noiseGain, panner);
    noise.start(now);
    noise.stop(now + 0.06);
  }

  // High crack
  const crack = audioCtx.createOscillator();
  const crackGain = audioCtx.createGain();
  crack.type = 'sawtooth';
  crack.frequency.setValueAtTime(600, now);
  crack.frequency.exponentialRampToValueAtTime(200, now + 0.02);
  crackGain.gain.setValueAtTime(vol * 0.3, now);
  crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
  crack.connect(crackGain);
  connectToOutput(crackGain, panner);
  crack.start(now);
  crack.stop(now + 0.04);
}

function playGenericSound(now, vol, panner) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(350, now);
  osc.frequency.exponentialRampToValueAtTime(50, now + 0.08);
  gain.gain.setValueAtTime(vol * 0.4, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  osc.connect(gain);
  connectToOutput(gain, panner);
  osc.start(now);
  osc.stop(now + 0.12);
}

export function playZombieSound(type, sourcePos = null) {
  if (!audioCtx || audioCtx.state === 'suspended') return;

  try {
    const now = audioCtx.currentTime;
    const vol = sourcePos ? 0.4 : 0.15;
    const panner = createPanner(sourcePos);

    if (type === 'growl') {
      // Deep guttural growl
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(55, now);
      osc.frequency.linearRampToValueAtTime(35, now + 1.0);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      osc.connect(gain);
      connectToOutput(gain, panner);
      osc.start(now);
      osc.stop(now + 1.5);

      // Add LFO for tremolo
      const lfo = audioCtx.createOscillator();
      const lfoGain = audioCtx.createGain();
      lfo.type = 'sine';
      lfo.frequency.value = 8;
      lfoGain.gain.value = 15;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start(now);
      lfo.stop(now + 1.5);

      // Raspy noise layer
      if (noiseBuffer) {
        const noise = audioCtx.createBufferSource();
        noise.buffer = noiseBuffer;
        const noiseGain = audioCtx.createGain();
        const noiseFilter = audioCtx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.value = 200;
        noiseFilter.Q.value = 3;
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
      // Bite/snap sound
      const snap = audioCtx.createOscillator();
      const snapGain = audioCtx.createGain();
      snap.type = 'sawtooth';
      snap.frequency.setValueAtTime(150, now);
      snap.frequency.exponentialRampToValueAtTime(60, now + 0.1);
      snapGain.gain.setValueAtTime(vol * 0.8, now);
      snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      snap.connect(snapGain);
      connectToOutput(snapGain, panner);
      snap.start(now);
      snap.stop(now + 0.2);

      // Jaw snap noise
      if (noiseBuffer) {
        const noise = audioCtx.createBufferSource();
        noise.buffer = noiseBuffer;
        const noiseGain = audioCtx.createGain();
        const noiseFilter = audioCtx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = 800;
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

export function playGhostWhisper(pos) {
  if (!audioCtx || audioCtx.state === 'suspended') return;

  try {
    const now = audioCtx.currentTime;
    const panner = createPanner(pos);

    // Ethereal whisper with multiple detuned oscillators
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(250, now);
    osc1.frequency.exponentialRampToValueAtTime(120, now + 2.0);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(253, now); // Slight detune for chorus
    osc2.frequency.exponentialRampToValueAtTime(123, now + 2.0);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.8);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 300;
    filter.Q.value = 3;

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

export function playThunderSound() {
  if (!audioCtx || audioCtx.state === 'suspended') return;

  try {
    const now = audioCtx.currentTime;

    // Layer 1: Initial crack
    const crack = audioCtx.createOscillator();
    const crackGain = audioCtx.createGain();
    crack.type = 'sawtooth';
    crack.frequency.setValueAtTime(100, now);
    crack.frequency.exponentialRampToValueAtTime(20, now + 0.2);
    crackGain.gain.setValueAtTime(0, now);
    crackGain.gain.linearRampToValueAtTime(0.8, now + 0.1);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    crack.connect(crackGain);
    crackGain.connect(audioCtx.destination);
    crack.start(now);
    crack.stop(now + 0.4);

    // Layer 2: Low rumble
    const rumble = audioCtx.createOscillator();
    const rumbleGain = audioCtx.createGain();
    rumble.type = 'sine';
    rumble.frequency.setValueAtTime(50, now + 0.1);
    rumble.frequency.exponentialRampToValueAtTime(10, now + 1.5);
    rumbleGain.gain.setValueAtTime(0, now);
    rumbleGain.gain.linearRampToValueAtTime(0.6, now + 0.2);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
    rumble.connect(rumbleGain);
    rumbleGain.connect(audioCtx.destination);
    rumble.start(now + 0.1);
    rumble.stop(now + 2.5);

    // Layer 3: Noise crackle
    if (longNoiseBuffer) {
      const noise = audioCtx.createBufferSource();
      noise.buffer = longNoiseBuffer;
      const noiseGain = audioCtx.createGain();
      const noiseFilter = audioCtx.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.value = 150;
      noiseGain.gain.setValueAtTime(0, now);
      noiseGain.gain.linearRampToValueAtTime(0.5, now + 0.15);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(audioCtx.destination);
      noise.start(now);
      noise.stop(now + 2.0);
    }
  } catch (e) {}
}

export function playExplosionSound(sourcePos = null) {
  if (!audioCtx || audioCtx.state === 'suspended') return;

  try {
    const now = audioCtx.currentTime;
    const vol = sourcePos ? 0.6 : 0.3;
    const panner = createPanner(sourcePos);

    // Layer 1: Initial blast
    const blast = audioCtx.createOscillator();
    const blastGain = audioCtx.createGain();
    blast.type = 'sine';
    blast.frequency.setValueAtTime(80, now);
    blast.frequency.exponentialRampToValueAtTime(15, now + 0.3);
    blastGain.gain.setValueAtTime(vol * 1.5, now);
    blastGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    blast.connect(blastGain);
    connectToOutput(blastGain, panner);
    blast.start(now);
    blast.stop(now + 0.5);

    // Layer 2: Debris noise
    if (noiseBuffer) {
      const noise = audioCtx.createBufferSource();
      noise.buffer = noiseBuffer;
      const noiseGain = audioCtx.createGain();
      const noiseFilter = audioCtx.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.value = 600;
      noiseGain.gain.setValueAtTime(vol, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      connectToOutput(noiseGain, panner);
      noise.start(now);
      noise.stop(now + 0.6);
    }

    // Layer 3: Low boom
    const boom = audioCtx.createOscillator();
    const boomGain = audioCtx.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(40, now);
    boom.frequency.exponentialRampToValueAtTime(10, now + 0.8);
    boomGain.gain.setValueAtTime(vol * 0.8, now);
    boomGain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
    boom.connect(boomGain);
    connectToOutput(boomGain, panner);
    boom.start(now);
    boom.stop(now + 1.2);
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
