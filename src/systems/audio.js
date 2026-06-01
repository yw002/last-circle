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

// ========== THUNDER ==========
export function playThunderSound() {
  if (!audioCtx || audioCtx.state === 'suspended') return;
  try {
    const now = audioCtx.currentTime;

    // Crack
    const crack = audioCtx.createOscillator();
    const crackGain = audioCtx.createGain();
    crack.type = 'sawtooth';
    crack.frequency.setValueAtTime(100, now);
    crack.frequency.exponentialRampToValueAtTime(15, now + 1.5);
    crackGain.gain.setValueAtTime(0, now);
    crackGain.gain.linearRampToValueAtTime(0.8, now + 0.12);
    crackGain.gain.setValueAtTime(0.8, now + 0.25);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
    crack.connect(crackGain);
    crackGain.connect(audioCtx.destination);
    crack.start(now);
    crack.stop(now + 2.5);

    // Rumble
    const rumble = audioCtx.createOscillator();
    const rumbleGain = audioCtx.createGain();
    rumble.type = 'sine';
    rumble.frequency.setValueAtTime(40, now + 0.1);
    rumble.frequency.exponentialRampToValueAtTime(10, now + 1.5);
    rumbleGain.gain.setValueAtTime(0, now);
    rumbleGain.gain.linearRampToValueAtTime(0.6, now + 0.2);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
    rumble.connect(rumbleGain);
    rumbleGain.connect(audioCtx.destination);
    rumble.start(now + 0.1);
    rumble.stop(now + 3.0);

    // Noise crackle
    if (longNoiseBuffer) {
      const noise = audioCtx.createBufferSource();
      noise.buffer = longNoiseBuffer;
      const noiseGain = audioCtx.createGain();
      const noiseFilter = audioCtx.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.value = 120;
      noiseGain.gain.setValueAtTime(0, now);
      noiseGain.gain.linearRampToValueAtTime(0.5, now + 0.1);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(audioCtx.destination);
      noise.start(now);
      noise.stop(now + 2.0);
    }
  } catch (e) {}
}

// ========== MAIN PLAY SOUND DISPATCHER ==========
export function playSound(type, sourcePos = null) {
  if (!audioCtx || audioCtx.state === 'suspended') return;
  try {
    const now = audioCtx.currentTime;
    const vol = sourcePos ? 0.6 : 0.3;
    const panner = createPanner(sourcePos);

    switch (type) {
      case 'pistol': playPistolSound(now, vol, panner); break;
      case 'ar':
      case 'ar_fast': playARSound(now, vol, panner, type === 'ar_fast'); break;
      case 'sniper': playSniperSound(now, vol, panner); break;
      case 'shotgun': playShotgunSound(now, vol, panner); break;
      case 'hit': playHitSound(now, vol, panner); break;
      default: playARSound(now, vol, panner, false); break;
    }
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
