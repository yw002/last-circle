// Ultra-realistic audio system with advanced multi-layer synthesis
// Master chain: dynamics compressor + convolution reverb for professional output

import * as THREE from 'three';

let audioCtx = null;
let initialized = false;
let noiseBuffer = null;
let longNoiseBuffer = null;
let masterCompressor = null;
let reverbNode = null;
let reverbGain = null;
let dryGain = null;
let masterGainNode = null;
let saturationNode = null;
let subBassGain = null;

// ========== DISTORTION CURVE (soft clipping saturation) ==========
function makeDistortionCurve(amount) {
  const samples = 44100;
  const curve = new Float32Array(samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

// ========== IMPULSE RESPONSE (simulated room reverb) ==========
function createReverbIR(ctx, duration, decay) {
  const rate = ctx.sampleRate;
  const length = rate * duration;
  const ir = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return ir;
}

export function initAudio() {
  if (initialized) return true;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    noiseBuffer = createNoiseBuffer(1);
    longNoiseBuffer = createNoiseBuffer(3);

    // Master chain: compressor → [dry + reverb] → master gain → destination
    masterCompressor = audioCtx.createDynamicsCompressor();
    masterCompressor.threshold.setValueAtTime(-24, audioCtx.currentTime);
    masterCompressor.knee.setValueAtTime(18, audioCtx.currentTime);
    masterCompressor.ratio.setValueAtTime(4, audioCtx.currentTime);
    masterCompressor.attack.setValueAtTime(0.005, audioCtx.currentTime);
    masterCompressor.release.setValueAtTime(0.25, audioCtx.currentTime);

    // Convolution reverb
    reverbNode = audioCtx.createConvolver();
    reverbNode.buffer = createReverbIR(audioCtx, 1.8, 2.5);
    reverbGain = audioCtx.createGain();
    reverbGain.gain.setValueAtTime(0.18, audioCtx.currentTime);
    dryGain = audioCtx.createGain();
    dryGain.gain.setValueAtTime(1.0, audioCtx.currentTime);

    // Soft saturation on master bus (analog warmth)
    saturationNode = audioCtx.createWaveShaper();
    saturationNode.curve = makeDistortionCurve(12);
    saturationNode.oversample = '4x';

    masterGainNode = audioCtx.createGain();
    masterGainNode.gain.setValueAtTime(1.4, audioCtx.currentTime);

    // Sub-bass enhancer (boosts 20-80Hz)
    subBassGain = audioCtx.createGain();
    subBassGain.gain.setValueAtTime(1.6, audioCtx.currentTime);
    const subFilter = audioCtx.createBiquadFilter();
    subFilter.type = 'lowshelf';
    subFilter.frequency.value = 80;
    subFilter.gain.value = 4;

    // Routing: compressor → saturation → [dry + reverb] → masterGain → subFilter → destination
    masterCompressor.connect(saturationNode);
    saturationNode.connect(dryGain);
    saturationNode.connect(reverbNode);
    reverbNode.connect(reverbGain);
    dryGain.connect(masterGainNode);
    reverbGain.connect(masterGainNode);
    masterGainNode.connect(subFilter);
    subFilter.connect(audioCtx.destination);

    initialized = true;
    setInterval(() => {
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
    }, 200);
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

// Watchdog: resume audio on tab switch, focus, and user interaction
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  });
  window.addEventListener('focus', () => {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  });
  // Resume on any user gesture (click, keydown, touch)
  const resumeOnGesture = () => {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  };
  document.addEventListener('click', resumeOnGesture, { passive: true });
  document.addEventListener('keydown', resumeOnGesture, { passive: true });
  document.addEventListener('touchstart', resumeOnGesture, { passive: true });
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
  const dest = masterCompressor || audioCtx.destination;
  if (panner) {
    node.connect(panner);
    panner.connect(dest);
  } else {
    node.connect(dest);
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
    const vol = Math.max(0.15, Math.min(0.55, 0.3 * intensity));
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

    // Layer 3: Doppler-shifted tone (pitch sweep simulates passing bullet)
    const doppler = audioCtx.createOscillator();
    const dopplerG = audioCtx.createGain();
    doppler.type = 'sine';
    doppler.frequency.setValueAtTime(2400 * intensity, now);
    doppler.frequency.exponentialRampToValueAtTime(300, now + 0.12);
    dopplerG.gain.setValueAtTime(vol * 0.3, now);
    dopplerG.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    doppler.connect(dopplerG); connectToOutput(dopplerG, panner);
    doppler.start(now); doppler.stop(now + 0.16);

    // Layer 4: Turbulence noise (air disturbance)
    if (noiseBuffer) {
      const turb = audioCtx.createBufferSource();
      turb.buffer = noiseBuffer;
      const tg = audioCtx.createGain();
      const tf = audioCtx.createBiquadFilter();
      tf.type = 'bandpass'; tf.frequency.setValueAtTime(4000, now);
      tf.frequency.exponentialRampToValueAtTime(1000, now + 0.15);
      tf.Q.value = 3;
      tg.gain.setValueAtTime(vol * 0.2, now + 0.02);
      tg.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      turb.connect(tf); tf.connect(tg); connectToOutput(tg, panner);
      turb.start(now); turb.stop(now + 0.2);
    }

    // Layer 5: Secondary crack (sonic boom micro-bang)
    const crack2 = audioCtx.createOscillator();
    const crack2G = audioCtx.createGain();
    crack2.type = 'sawtooth';
    crack2.frequency.setValueAtTime(3200, now + 0.01);
    crack2.frequency.exponentialRampToValueAtTime(400, now + 0.04);
    crack2G.gain.setValueAtTime(vol * 0.25 * intensity, now + 0.01);
    crack2G.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    crack2.connect(crack2G); connectToOutput(crack2G, panner);
    crack2.start(now); crack2.stop(now + 0.06);
  } catch (e) {}
}

export function playImpactSound(material = 'dirt', sourcePos = null) {
  if (!audioCtx || audioCtx.state === 'suspended') return;
  try {
    const now = audioCtx.currentTime;
    const vol = sourcePos ? 0.65 : 0.35;
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

    // Layer 3: Sharp transient click (initial contact)
    const click = audioCtx.createOscillator();
    const clickG = audioCtx.createGain();
    click.type = 'square';
    click.frequency.setValueAtTime(2800 + Math.random() * 600, now);
    click.frequency.exponentialRampToValueAtTime(200, now + 0.008);
    clickG.gain.setValueAtTime(vol * 0.35, now);
    clickG.gain.exponentialRampToValueAtTime(0.001, now + 0.015);
    click.connect(clickG); connectToOutput(clickG, panner);
    click.start(now); click.stop(now + 0.02);

    // Layer 4: Distortion crunch (adds grit)
    const crunch = audioCtx.createOscillator();
    const crunchG = audioCtx.createGain();
    const ws = audioCtx.createWaveShaper();
    ws.curve = makeDistortionCurve(50);
    crunch.type = 'sawtooth';
    crunch.frequency.setValueAtTime(profile.freq * 0.5, now);
    crunch.frequency.exponentialRampToValueAtTime(profile.end * 0.3, now + profile.dur * 0.4);
    crunchG.gain.setValueAtTime(vol * 0.2, now);
    crunchG.gain.exponentialRampToValueAtTime(0.001, now + profile.dur * 0.5);
    crunch.connect(ws); ws.connect(crunchG); connectToOutput(crunchG, panner);
    crunch.start(now); crunch.stop(now + profile.dur * 0.6);

    // Layer 5: Secondary resonance (echo bounce)
    if (noiseBuffer) {
      const debris = audioCtx.createBufferSource();
      debris.buffer = noiseBuffer;
      const dg = audioCtx.createGain();
      const df = audioCtx.createBiquadFilter();
      df.type = 'highpass'; df.frequency.value = profile.noiseFreq * 1.5; df.Q.value = 2;
      dg.gain.setValueAtTime(0, now);
      dg.gain.linearRampToValueAtTime(vol * 0.15, now + profile.dur * 0.3);
      dg.gain.exponentialRampToValueAtTime(0.001, now + profile.dur * 1.2);
      debris.connect(df); df.connect(dg); connectToOutput(dg, panner);
      debris.start(now + profile.dur * 0.2); debris.stop(now + profile.dur * 1.4);
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

// ========== PISTOL SOUND (9 layers — punchy + saturated) ==========
function playPistolSound(now, vol, panner) {
  // Layer 1: Ultra-fast mechanical click
  const hammer = audioCtx.createOscillator();
  const hammerGain = audioCtx.createGain();
  hammer.type = 'square';
  hammer.frequency.setValueAtTime(3200, now);
  hammer.frequency.exponentialRampToValueAtTime(200, now + 0.005);
  hammerGain.gain.setValueAtTime(vol * 0.5, now);
  hammerGain.gain.exponentialRampToValueAtTime(0.001, now + 0.008);
  hammer.connect(hammerGain);
  connectToOutput(hammerGain, panner);
  hammer.start(now); hammer.stop(now + 0.01);

  // Layer 2: Sharp noise transient (THE CRACK)
  if (noiseBuffer) {
    const crack = audioCtx.createBufferSource();
    crack.buffer = noiseBuffer;
    const crackGain = audioCtx.createGain();
    const crackFilter = audioCtx.createBiquadFilter();
    crackFilter.type = 'highpass'; crackFilter.frequency.value = 3000;
    const ws = audioCtx.createWaveShaper(); ws.curve = makeDistortionCurve(30);
    crackGain.gain.setValueAtTime(vol * 1.2, now);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.018);
    crack.connect(crackFilter); crackFilter.connect(ws); ws.connect(crackGain);
    connectToOutput(crackGain, panner);
    crack.start(now); crack.stop(now + 0.025);
  }

  // Layer 3: Gunshot crack oscillator
  const crack2 = audioCtx.createOscillator();
  const crackGain2 = audioCtx.createGain();
  crack2.type = 'sawtooth';
  crack2.frequency.setValueAtTime(1800, now);
  crack2.frequency.exponentialRampToValueAtTime(120, now + 0.018);
  crackGain2.gain.setValueAtTime(vol * 1.1, now);
  crackGain2.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
  crack2.connect(crackGain2);
  connectToOutput(crackGain2, panner);
  crack2.start(now); crack2.stop(now + 0.04);

  // Layer 4: Mid-range body punch
  const body = audioCtx.createOscillator();
  const bodyGain = audioCtx.createGain();
  body.type = 'sine';
  body.frequency.setValueAtTime(350, now);
  body.frequency.exponentialRampToValueAtTime(45, now + 0.1);
  bodyGain.gain.setValueAtTime(vol * 0.8, now);
  bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  body.connect(bodyGain);
  connectToOutput(bodyGain, panner);
  body.start(now); body.stop(now + 0.15);

  // Layer 5: Deep thump (chest feel)
  const thump = audioCtx.createOscillator();
  const thumpGain = audioCtx.createGain();
  thump.type = 'sine';
  thump.frequency.setValueAtTime(90, now);
  thump.frequency.exponentialRampToValueAtTime(25, now + 0.2);
  thumpGain.gain.setValueAtTime(vol * 0.6, now);
  thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  thump.connect(thumpGain);
  connectToOutput(thumpGain, panner);
  thump.start(now); thump.stop(now + 0.3);

  // Layer 6: Sub bass
  const sub = audioCtx.createOscillator();
  const subGain = audioCtx.createGain();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(40, now);
  sub.frequency.exponentialRampToValueAtTime(15, now + 0.3);
  subGain.gain.setValueAtTime(vol * 0.35, now);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  sub.connect(subGain);
  connectToOutput(subGain, panner);
  sub.start(now); sub.stop(now + 0.4);

  // Layer 7: Mid-frequency noise burst (body texture)
  if (noiseBuffer) {
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    const noiseGain = audioCtx.createGain();
    const nf = audioCtx.createBiquadFilter();
    nf.type = 'bandpass'; nf.frequency.value = 1200; nf.Q.value = 1.5;
    noiseGain.gain.setValueAtTime(vol * 0.45, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    noise.connect(nf); nf.connect(noiseGain);
    connectToOutput(noiseGain, panner);
    noise.start(now); noise.stop(now + 0.05);
  }

  // Layer 8: Tail echo
  if (longNoiseBuffer) {
    const tail = audioCtx.createBufferSource();
    tail.buffer = longNoiseBuffer;
    const tailGain = audioCtx.createGain();
    const tf = audioCtx.createBiquadFilter();
    tf.type = 'lowpass'; tf.frequency.value = 800; tf.Q.value = 0.5;
    tailGain.gain.setValueAtTime(0, now);
    tailGain.gain.linearRampToValueAtTime(vol * 0.12, now + 0.06);
    tailGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    tail.connect(tf); tf.connect(tailGain);
    connectToOutput(tailGain, panner);
    tail.start(now + 0.04); tail.stop(now + 0.55);
  }

  // Layer 9: Saturation layer (harmonic richness)
  const sat = audioCtx.createOscillator();
  const satGain = audioCtx.createGain();
  const ws = audioCtx.createWaveShaper(); ws.curve = makeDistortionCurve(50);
  sat.type = 'sawtooth';
  sat.frequency.setValueAtTime(600, now);
  sat.frequency.exponentialRampToValueAtTime(80, now + 0.04);
  satGain.gain.setValueAtTime(vol * 0.25, now);
  satGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  sat.connect(ws); ws.connect(satGain);
  connectToOutput(satGain, panner);
  sat.start(now); sat.stop(now + 0.08);
}

// ========== AR SOUND (10 layers — aggressive + saturated) ==========
function playARSound(now, vol, panner, fast) {
  const dur = fast ? 0.04 : 0.06;

  // Layer 1: Bolt action click
  const bolt = audioCtx.createOscillator();
  const boltGain = audioCtx.createGain();
  bolt.type = 'square';
  bolt.frequency.setValueAtTime(2200, now);
  bolt.frequency.exponentialRampToValueAtTime(150, now + 0.005);
  boltGain.gain.setValueAtTime(vol * 0.4, now);
  boltGain.gain.exponentialRampToValueAtTime(0.001, now + 0.008);
  bolt.connect(boltGain); connectToOutput(boltGain, panner);
  bolt.start(now); bolt.stop(now + 0.01);

  // Layer 2: Noise transient crack (THE key layer)
  if (noiseBuffer) {
    const crack = audioCtx.createBufferSource();
    crack.buffer = noiseBuffer;
    const cg = audioCtx.createGain();
    const cf = audioCtx.createBiquadFilter();
    cf.type = 'highpass'; cf.frequency.value = 2500;
    const ws = audioCtx.createWaveShaper(); ws.curve = makeDistortionCurve(40);
    cg.gain.setValueAtTime(vol * 1.3, now);
    cg.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
    crack.connect(cf); cf.connect(ws); ws.connect(cg);
    connectToOutput(cg, panner);
    crack.start(now); crack.stop(now + 0.03);
  }

  // Layer 3: Sharp attack oscillator
  const atk = audioCtx.createOscillator();
  const atkG = audioCtx.createGain();
  atk.type = 'sawtooth';
  atk.frequency.setValueAtTime(2000, now);
  atk.frequency.exponentialRampToValueAtTime(200, now + 0.015);
  atkG.gain.setValueAtTime(vol * 1.0, now);
  atkG.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
  atk.connect(atkG); connectToOutput(atkG, panner);
  atk.start(now); atk.stop(now + 0.035);

  // Layer 4: Mid body
  const mid = audioCtx.createOscillator();
  const midG = audioCtx.createGain();
  mid.type = 'triangle';
  mid.frequency.setValueAtTime(500, now);
  mid.frequency.exponentialRampToValueAtTime(60, now + dur);
  midG.gain.setValueAtTime(vol * 0.7, now);
  midG.gain.exponentialRampToValueAtTime(0.001, now + dur * 1.2);
  mid.connect(midG); connectToOutput(midG, panner);
  mid.start(now); mid.stop(now + dur * 1.5);

  // Layer 5: Low thump
  const thump = audioCtx.createOscillator();
  const thumpG = audioCtx.createGain();
  thump.type = 'sine';
  thump.frequency.setValueAtTime(180, now);
  thump.frequency.exponentialRampToValueAtTime(25, now + dur);
  thumpG.gain.setValueAtTime(vol * 0.8, now);
  thumpG.gain.exponentialRampToValueAtTime(0.001, now + dur * 1.3);
  thump.connect(thumpG); connectToOutput(thumpG, panner);
  thump.start(now); thump.stop(now + dur * 1.5);

  // Layer 6: Sub bass
  const sub = audioCtx.createOscillator();
  const subG = audioCtx.createGain();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(55, now);
  sub.frequency.exponentialRampToValueAtTime(18, now + dur * 2);
  subG.gain.setValueAtTime(vol * 0.4, now);
  subG.gain.exponentialRampToValueAtTime(0.001, now + dur * 2.5);
  sub.connect(subG); connectToOutput(subG, panner);
  sub.start(now); sub.stop(now + dur * 3);

  // Layer 7: Supersonic crack
  const sc = audioCtx.createOscillator();
  const scG = audioCtx.createGain();
  sc.type = 'sawtooth';
  sc.frequency.setValueAtTime(4000, now);
  sc.frequency.exponentialRampToValueAtTime(600, now + 0.005);
  scG.gain.setValueAtTime(vol * 0.35, now);
  scG.gain.exponentialRampToValueAtTime(0.001, now + 0.01);
  sc.connect(scG); connectToOutput(scG, panner);
  sc.start(now); sc.stop(now + 0.012);

  // Layer 8: Mid noise texture
  if (noiseBuffer) {
    const n = audioCtx.createBufferSource();
    n.buffer = noiseBuffer;
    const ng = audioCtx.createGain();
    const nf = audioCtx.createBiquadFilter();
    nf.type = 'bandpass'; nf.frequency.value = 2000; nf.Q.value = 1.2;
    ng.gain.setValueAtTime(vol * 0.5, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + dur);
    n.connect(nf); nf.connect(ng); connectToOutput(ng, panner);
    n.start(now); n.stop(now + dur * 1.2);
  }

  // Layer 9: Saturation (distorted sawtooth)
  const sat = audioCtx.createOscillator();
  const satG = audioCtx.createGain();
  const ws2 = audioCtx.createWaveShaper(); ws2.curve = makeDistortionCurve(60);
  sat.type = 'sawtooth';
  sat.frequency.setValueAtTime(800, now);
  sat.frequency.exponentialRampToValueAtTime(100, now + 0.03);
  satG.gain.setValueAtTime(vol * 0.2, now);
  satG.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
  sat.connect(ws2); ws2.connect(satG); connectToOutput(satG, panner);
  sat.start(now); sat.stop(now + 0.06);

  // Layer 10: Tail (noise decay)
  if (longNoiseBuffer) {
    const tail = audioCtx.createBufferSource();
    tail.buffer = longNoiseBuffer;
    const tg = audioCtx.createGain();
    const tf = audioCtx.createBiquadFilter();
    tf.type = 'lowpass'; tf.frequency.value = 600; tf.Q.value = 0.5;
    tg.gain.setValueAtTime(0, now);
    tg.gain.linearRampToValueAtTime(vol * 0.1, now + 0.03);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    tail.connect(tf); tf.connect(tg); connectToOutput(tg, panner);
    tail.start(now + 0.02); tail.stop(now + 0.45);
  }
}

// ========== SNIPER SOUND (10 layers — devastating boom) ==========
function playSniperSound(now, vol, panner) {
  // Layer 1: Massive noise transient crack
  if (noiseBuffer) {
    const crack = audioCtx.createBufferSource();
    crack.buffer = noiseBuffer;
    const cg = audioCtx.createGain();
    const cf = audioCtx.createBiquadFilter();
    cf.type = 'highpass'; cf.frequency.value = 2000;
    const ws = audioCtx.createWaveShaper(); ws.curve = makeDistortionCurve(50);
    cg.gain.setValueAtTime(vol * 1.6, now);
    cg.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
    crack.connect(cf); cf.connect(ws); ws.connect(cg);
    connectToOutput(cg, panner);
    crack.start(now); crack.stop(now + 0.03);
  }

  // Layer 2: Massive initial crack
  const crack2 = audioCtx.createOscillator();
  const crackG = audioCtx.createGain();
  crack2.type = 'sawtooth';
  crack2.frequency.setValueAtTime(3500, now);
  crack2.frequency.exponentialRampToValueAtTime(80, now + 0.05);
  crackG.gain.setValueAtTime(vol * 1.3, now);
  crackG.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
  crack2.connect(crackG); connectToOutput(crackG, panner);
  crack2.start(now); crack2.stop(now + 0.09);

  // Layer 3: Bolt action
  const bolt = audioCtx.createOscillator();
  const boltG = audioCtx.createGain();
  bolt.type = 'square';
  bolt.frequency.setValueAtTime(1200, now);
  bolt.frequency.exponentialRampToValueAtTime(80, now + 0.012);
  boltG.gain.setValueAtTime(vol * 0.5, now);
  boltG.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
  bolt.connect(boltG); connectToOutput(boltG, panner);
  bolt.start(now); bolt.stop(now + 0.025);

  // Layer 4: Deep body resonance (sawtooth for richness)
  const body = audioCtx.createOscillator();
  const bodyG = audioCtx.createGain();
  body.type = 'sawtooth';
  body.frequency.setValueAtTime(150, now);
  body.frequency.exponentialRampToValueAtTime(18, now + 0.4);
  bodyG.gain.setValueAtTime(vol * 1.0, now);
  bodyG.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  body.connect(bodyG); connectToOutput(bodyG, panner);
  body.start(now); body.stop(now + 0.6);

  // Layer 5: Sub-bass rumble (felt in chest)
  const sub = audioCtx.createOscillator();
  const subG = audioCtx.createGain();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(50, now);
  sub.frequency.exponentialRampToValueAtTime(10, now + 0.6);
  subG.gain.setValueAtTime(vol * 0.8, now);
  subG.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
  sub.connect(subG); connectToOutput(subG, panner);
  sub.start(now); sub.stop(now + 0.8);

  // Layer 6: High frequency snap
  if (noiseBuffer) {
    const snap = audioCtx.createBufferSource();
    snap.buffer = noiseBuffer;
    const sg = audioCtx.createGain();
    const sf = audioCtx.createBiquadFilter();
    sf.type = 'highpass'; sf.frequency.value = 5000;
    sg.gain.setValueAtTime(vol * 0.7, now);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
    snap.connect(sf); sf.connect(sg); connectToOutput(sg, panner);
    snap.start(now); snap.stop(now + 0.04);
  }

  // Layer 7: Saturation layer
  const sat = audioCtx.createOscillator();
  const satG = audioCtx.createGain();
  const ws2 = audioCtx.createWaveShaper(); ws2.curve = makeDistortionCurve(80);
  sat.type = 'sawtooth';
  sat.frequency.setValueAtTime(400, now);
  sat.frequency.exponentialRampToValueAtTime(40, now + 0.06);
  satG.gain.setValueAtTime(vol * 0.35, now);
  satG.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  sat.connect(ws2); ws2.connect(satG); connectToOutput(satG, panner);
  sat.start(now); sat.stop(now + 0.12);

  // Layer 8: Long echo tail (noise)
  if (longNoiseBuffer) {
    const tail = audioCtx.createBufferSource();
    tail.buffer = longNoiseBuffer;
    const tg = audioCtx.createGain();
    const tf = audioCtx.createBiquadFilter();
    tf.type = 'lowpass'; tf.frequency.value = 500; tf.Q.value = 0.4;
    tg.gain.setValueAtTime(0, now);
    tg.gain.linearRampToValueAtTime(vol * 0.2, now + 0.1);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    tail.connect(tf); tf.connect(tg); connectToOutput(tg, panner);
    tail.start(now + 0.05); tail.stop(now + 1.4);
  }

  // Layer 9: Mid body noise texture
  if (noiseBuffer) {
    const n = audioCtx.createBufferSource();
    n.buffer = noiseBuffer;
    const ng = audioCtx.createGain();
    const nf = audioCtx.createBiquadFilter();
    nf.type = 'bandpass'; nf.frequency.value = 800; nf.Q.value = 1.0;
    ng.gain.setValueAtTime(vol * 0.5, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    n.connect(nf); nf.connect(ng); connectToOutput(ng, panner);
    n.start(now); n.stop(now + 0.1);
  }

  // Layer 10: Echo ring (delayed oscillator)
  const echo = audioCtx.createOscillator();
  const echoG = audioCtx.createGain();
  echo.type = 'sine';
  echo.frequency.setValueAtTime(65, now + 0.15);
  echo.frequency.exponentialRampToValueAtTime(15, now + 1.0);
  echoG.gain.setValueAtTime(0, now);
  echoG.gain.linearRampToValueAtTime(vol * 0.25, now + 0.15);
  echoG.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
  echo.connect(echoG); connectToOutput(echoG, panner);
  echo.start(now + 0.1); echo.stop(now + 1.4);
}

// ========== SHOTGUN SOUND (9 layers — devastating spread) ==========
function playShotgunSound(now, vol, panner) {
  // Layer 1: Noise transient (THE BOOM)
  if (noiseBuffer) {
    const crack = audioCtx.createBufferSource();
    crack.buffer = noiseBuffer;
    const cg = audioCtx.createGain();
    const cf = audioCtx.createBiquadFilter();
    cf.type = 'bandpass'; cf.frequency.value = 1500; cf.Q.value = 0.8;
    const ws = audioCtx.createWaveShaper(); ws.curve = makeDistortionCurve(60);
    cg.gain.setValueAtTime(vol * 1.8, now);
    cg.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    crack.connect(cf); cf.connect(ws); ws.connect(cg);
    connectToOutput(cg, panner);
    crack.start(now); crack.stop(now + 0.05);
  }

  // Layer 2: Massive boom oscillator
  const boom = audioCtx.createOscillator();
  const boomG = audioCtx.createGain();
  boom.type = 'sine';
  boom.frequency.setValueAtTime(100, now);
  boom.frequency.exponentialRampToValueAtTime(12, now + 0.2);
  boomG.gain.setValueAtTime(vol * 1.5, now);
  boomG.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  boom.connect(boomG); connectToOutput(boomG, panner);
  boom.start(now); boom.stop(now + 0.3);

  // Layer 3: Mechanical click
  const click = audioCtx.createOscillator();
  const clickG = audioCtx.createGain();
  click.type = 'square';
  click.frequency.setValueAtTime(1400, now);
  click.frequency.exponentialRampToValueAtTime(80, now + 0.008);
  clickG.gain.setValueAtTime(vol * 0.6, now);
  clickG.gain.exponentialRampToValueAtTime(0.001, now + 0.015);
  click.connect(clickG); connectToOutput(clickG, panner);
  click.start(now); click.stop(now + 0.02);

  // Layer 4: Shotgun crack
  const crack2 = audioCtx.createOscillator();
  const crackG = audioCtx.createGain();
  crack2.type = 'sawtooth';
  crack2.frequency.setValueAtTime(900, now);
  crack2.frequency.exponentialRampToValueAtTime(60, now + 0.03);
  crackG.gain.setValueAtTime(vol * 0.9, now);
  crackG.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
  crack2.connect(crackG); connectToOutput(crackG, panner);
  crack2.start(now); crack2.stop(now + 0.06);

  // Layer 5: Noise burst (pellets spread)
  if (noiseBuffer) {
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    const ng = audioCtx.createGain();
    const nf = audioCtx.createBiquadFilter();
    nf.type = 'lowpass'; nf.frequency.value = 1200;
    ng.gain.setValueAtTime(vol * 1.1, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    noise.connect(nf); nf.connect(ng); connectToOutput(ng, panner);
    noise.start(now); noise.stop(now + 0.18);
  }

  // Layer 6: Sub bass (chest punch)
  const sub = audioCtx.createOscillator();
  const subG = audioCtx.createGain();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(45, now);
  sub.frequency.exponentialRampToValueAtTime(10, now + 0.5);
  subG.gain.setValueAtTime(vol * 0.5, now);
  subG.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
  sub.connect(subG); connectToOutput(subG, panner);
  sub.start(now); sub.stop(now + 0.7);

  // Layer 7: Low rumble tail
  const rumble = audioCtx.createOscillator();
  const rumbleG = audioCtx.createGain();
  rumble.type = 'sine';
  rumble.frequency.setValueAtTime(35, now + 0.05);
  rumble.frequency.exponentialRampToValueAtTime(10, now + 0.5);
  rumbleG.gain.setValueAtTime(0, now);
  rumbleG.gain.linearRampToValueAtTime(vol * 0.35, now + 0.06);
  rumbleG.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
  rumble.connect(rumbleG); connectToOutput(rumbleG, panner);
  rumble.start(now + 0.04); rumble.stop(now + 0.7);

  // Layer 8: Pump action (delayed mechanical)
  if (noiseBuffer) {
    const pump = audioCtx.createBufferSource();
    pump.buffer = noiseBuffer;
    const pg = audioCtx.createGain();
    const pf = audioCtx.createBiquadFilter();
    pf.type = 'bandpass'; pf.frequency.value = 2500; pf.Q.value = 2;
    pg.gain.setValueAtTime(0, now);
    pg.gain.linearRampToValueAtTime(vol * 0.4, now + 0.32);
    pg.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    pump.connect(pf); pf.connect(pg); connectToOutput(pg, panner);
    pump.start(now + 0.3); pump.stop(now + 0.45);
  }
  const pumpO = audioCtx.createOscillator();
  const pumpOG = audioCtx.createGain();
  pumpO.type = 'square';
  pumpO.frequency.setValueAtTime(500, now + 0.3);
  pumpO.frequency.exponentialRampToValueAtTime(80, now + 0.4);
  pumpOG.gain.setValueAtTime(0, now);
  pumpOG.gain.linearRampToValueAtTime(vol * 0.35, now + 0.31);
  pumpOG.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
  pumpO.connect(pumpOG); connectToOutput(pumpOG, panner);
  pumpO.start(now + 0.3); pumpO.stop(now + 0.5);

  // Layer 9: Saturation body
  const sat = audioCtx.createOscillator();
  const satG = audioCtx.createGain();
  const ws2 = audioCtx.createWaveShaper(); ws2.curve = makeDistortionCurve(70);
  sat.type = 'sawtooth';
  sat.frequency.setValueAtTime(250, now);
  sat.frequency.exponentialRampToValueAtTime(30, now + 0.08);
  satG.gain.setValueAtTime(vol * 0.3, now);
  satG.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  sat.connect(ws2); ws2.connect(satG); connectToOutput(satG, panner);
  sat.start(now); sat.stop(now + 0.15);
}

// ========== HIT SOUND (7 layers — meaty visceral impact) ==========
function playHitSound(now, vol, panner) {
  // Layer 1: Sharp impact crack
  const crack = audioCtx.createOscillator();
  const crackG = audioCtx.createGain();
  crack.type = 'sawtooth';
  crack.frequency.setValueAtTime(1200, now);
  crack.frequency.exponentialRampToValueAtTime(100, now + 0.015);
  crackG.gain.setValueAtTime(vol * 1.0, now);
  crackG.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
  crack.connect(crackG); connectToOutput(crackG, panner);
  crack.start(now); crack.stop(now + 0.03);

  // Layer 2: Impact thud
  const thud = audioCtx.createOscillator();
  const thudG = audioCtx.createGain();
  thud.type = 'sine';
  thud.frequency.setValueAtTime(400, now);
  thud.frequency.exponentialRampToValueAtTime(40, now + 0.08);
  thudG.gain.setValueAtTime(vol * 1.0, now);
  thudG.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  thud.connect(thudG); connectToOutput(thudG, panner);
  thud.start(now); thud.stop(now + 0.12);

  // Layer 3: Flesh impact (noise squelch)
  if (noiseBuffer) {
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    const ng = audioCtx.createGain();
    const nf = audioCtx.createBiquadFilter();
    nf.type = 'bandpass'; nf.frequency.value = 800; nf.Q.value = 2;
    ng.gain.setValueAtTime(vol * 0.8, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    noise.connect(nf); nf.connect(ng); connectToOutput(ng, panner);
    noise.start(now); noise.stop(now + 0.07);
  }

  // Layer 4: Wet squelch (higher noise)
  if (noiseBuffer) {
    const wet = audioCtx.createBufferSource();
    wet.buffer = noiseBuffer;
    const wg = audioCtx.createGain();
    const wf = audioCtx.createBiquadFilter();
    wf.type = 'bandpass'; wf.frequency.value = 2500; wf.Q.value = 3;
    wg.gain.setValueAtTime(vol * 0.5, now);
    wg.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    wet.connect(wf); wf.connect(wg); connectToOutput(wg, panner);
    wet.start(now); wet.stop(now + 0.05);
  }

  // Layer 5: High crack
  const crack2 = audioCtx.createOscillator();
  const crackG2 = audioCtx.createGain();
  crack2.type = 'sawtooth';
  crack2.frequency.setValueAtTime(1000, now);
  crack2.frequency.exponentialRampToValueAtTime(150, now + 0.02);
  crackG2.gain.setValueAtTime(vol * 0.5, now);
  crackG2.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
  crack2.connect(crackG2); connectToOutput(crackG2, panner);
  crack2.start(now); crack2.stop(now + 0.04);

  // Layer 6: Low resonance (body cavity)
  const low = audioCtx.createOscillator();
  const lowG = audioCtx.createGain();
  low.type = 'sine';
  low.frequency.setValueAtTime(120, now);
  low.frequency.exponentialRampToValueAtTime(30, now + 0.15);
  lowG.gain.setValueAtTime(vol * 0.4, now);
  lowG.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  low.connect(lowG); connectToOutput(lowG, panner);
  low.start(now); low.stop(now + 0.2);

  // Layer 7: Saturation (distorted impact)
  const sat = audioCtx.createOscillator();
  const satG = audioCtx.createGain();
  const ws = audioCtx.createWaveShaper(); ws.curve = makeDistortionCurve(40);
  sat.type = 'sawtooth';
  sat.frequency.setValueAtTime(250, now);
  sat.frequency.exponentialRampToValueAtTime(60, now + 0.04);
  satG.gain.setValueAtTime(vol * 0.3, now);
  satG.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  sat.connect(ws); ws.connect(satG); connectToOutput(satG, panner);
  sat.start(now); sat.stop(now + 0.08);
}

export function playCombatFeedbackSound(type = 'hit') {
  if (!audioCtx || audioCtx.state === 'suspended') return;
  try {
    const now = audioCtx.currentTime;
    const profiles = {
      hit: { f1: 720, f2: 380, gain: 0.18, dur: 0.06 },
      headshot: { f1: 1100, f2: 500, gain: 0.24, dur: 0.08 },
      kill: { f1: 480, f2: 880, gain: 0.22, dur: 0.12 }
    };
    const p = profiles[type] || profiles.hit;

    // UI cue is short and dry so it reads as feedback, not an in-world sound.
    // Layer 1: Primary tone
    const cue = audioCtx.createOscillator();
    const cueGain = audioCtx.createGain();
    cue.type = type === 'kill' ? 'triangle' : 'sine';
    cue.frequency.setValueAtTime(p.f1, now);
    cue.frequency.exponentialRampToValueAtTime(p.f2, now + p.dur * 0.65);
    cueGain.gain.setValueAtTime(0, now);
    cueGain.gain.linearRampToValueAtTime(p.gain, now + 0.01);
    cueGain.gain.exponentialRampToValueAtTime(0.001, now + p.dur);
    cue.connect(cueGain);
    connectToOutput(cueGain, null);
    cue.start(now);
    cue.stop(now + p.dur + 0.02);

    // Layer 2: Harmonic overtone (richer tone)
    const harm = audioCtx.createOscillator();
    const harmG = audioCtx.createGain();
    harm.type = 'sine';
    harm.frequency.setValueAtTime(p.f1 * 2, now);
    harm.frequency.exponentialRampToValueAtTime(p.f2 * 1.5, now + p.dur * 0.5);
    harmG.gain.setValueAtTime(0, now);
    harmG.gain.linearRampToValueAtTime(p.gain * 0.3, now + 0.008);
    harmG.gain.exponentialRampToValueAtTime(0.001, now + p.dur * 0.7);
    harm.connect(harmG); connectToOutput(harmG, null);
    harm.start(now); harm.stop(now + p.dur + 0.02);

    // Layer 3: Transient click (sharp attack)
    const click = audioCtx.createOscillator();
    const clickG = audioCtx.createGain();
    click.type = 'square';
    click.frequency.setValueAtTime(4000, now);
    click.frequency.exponentialRampToValueAtTime(800, now + 0.01);
    clickG.gain.setValueAtTime(p.gain * 0.5, now);
    clickG.gain.exponentialRampToValueAtTime(0.001, now + 0.015);
    click.connect(clickG); connectToOutput(clickG, null);
    click.start(now); click.stop(now + 0.02);

    // Layer 4: Kill confirmation (extra satisfying ding for kills)
    if (type === 'kill') {
      const ding = audioCtx.createOscillator();
      const dingG = audioCtx.createGain();
      ding.type = 'sine';
      ding.frequency.setValueAtTime(1200, now + 0.05);
      ding.frequency.exponentialRampToValueAtTime(880, now + 0.2);
      dingG.gain.setValueAtTime(0, now);
      dingG.gain.linearRampToValueAtTime(0.12, now + 0.06);
      dingG.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      ding.connect(dingG); connectToOutput(dingG, null);
      ding.start(now + 0.04); ding.stop(now + 0.3);
    }
  } catch (e) {}
}

// ========== ZOMBIE SOUNDS ==========
export function playZombieSound(type, sourcePos = null) {
  if (!audioCtx || audioCtx.state === 'suspended') return;
  try {
    const now = audioCtx.currentTime;
    const vol = sourcePos ? 0.7 : 0.35;
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

      // Layer 3: Bone crunch (distorted impact)
      const crunch = audioCtx.createOscillator();
      const crunchG = audioCtx.createGain();
      const ws = audioCtx.createWaveShaper(); ws.curve = makeDistortionCurve(60);
      crunch.type = 'sawtooth';
      crunch.frequency.setValueAtTime(300, now);
      crunch.frequency.exponentialRampToValueAtTime(80, now + 0.06);
      crunchG.gain.setValueAtTime(vol * 0.4, now);
      crunchG.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      crunch.connect(ws); ws.connect(crunchG);
      connectToOutput(crunchG, panner);
      crunch.start(now); crunch.stop(now + 0.1);

      // Layer 4: Low guttural moan
      const moan = audioCtx.createOscillator();
      const moanG = audioCtx.createGain();
      moan.type = 'sawtooth';
      moan.frequency.setValueAtTime(60, now + 0.02);
      moan.frequency.linearRampToValueAtTime(40, now + 0.3);
      moanG.gain.setValueAtTime(0, now);
      moanG.gain.linearRampToValueAtTime(vol * 0.3, now + 0.05);
      moanG.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      moan.connect(moanG); connectToOutput(moanG, panner);
      moan.start(now); moan.stop(now + 0.4);
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
    gain.gain.linearRampToValueAtTime(0.5, now + 0.8);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    connectToOutput(gain, panner);

    // Layer: Eerie detuned whisper (beating frequency)
    const osc3 = audioCtx.createOscillator();
    const osc3G = audioCtx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(276, now);
    osc3.frequency.exponentialRampToValueAtTime(126, now + 2.0);
    osc3G.gain.setValueAtTime(0, now);
    osc3G.gain.linearRampToValueAtTime(0.25, now + 1.0);
    osc3G.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
    const filter2 = audioCtx.createBiquadFilter();
    filter2.type = 'bandpass'; filter2.frequency.value = 300; filter2.Q.value = 5;
    osc3.connect(filter2); filter2.connect(osc3G);
    connectToOutput(osc3G, panner);
    osc3.start(now); osc3.stop(now + 3.0);

    // Layer: Breathy noise (ghostly air)
    if (noiseBuffer) {
      const breath = audioCtx.createBufferSource();
      breath.buffer = longNoiseBuffer || noiseBuffer;
      const bg = audioCtx.createGain();
      const bf = audioCtx.createBiquadFilter();
      bf.type = 'bandpass'; bf.frequency.value = 600; bf.Q.value = 4;
      bg.gain.setValueAtTime(0, now);
      bg.gain.linearRampToValueAtTime(0.15, now + 0.5);
      bg.gain.setValueAtTime(0.15, now + 1.5);
      bg.gain.exponentialRampToValueAtTime(0.001, now + 2.8);
      breath.connect(bf); bf.connect(bg);
      connectToOutput(bg, panner);
      breath.start(now); breath.stop(now + 3.0);
    }

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 3.0);
    osc2.stop(now + 3.0);
  } catch (e) {}
}

// ========== THUNDER - softened storm ambience ==========
export function playThunderSound() {
  if (!audioCtx || audioCtx.state === 'suspended') return;
  try {
    const now = audioCtx.currentTime;

    // Layer 1: Initial crack, softened to avoid jump-scare spikes.
    const crack = audioCtx.createOscillator();
    const crackGain = audioCtx.createGain();
    crack.type = 'triangle';
    crack.frequency.setValueAtTime(150, now);
    crack.frequency.exponentialRampToValueAtTime(35, now + 0.35);
    crackGain.gain.setValueAtTime(0, now);
    crackGain.gain.linearRampToValueAtTime(0.45, now + 0.08);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    crack.connect(crackGain);
    connectToOutput(crackGain, null);
    crack.start(now);
    crack.stop(now + 0.6);

    // Layer 2: Deep rumble kept lower in the mix.
    const rumble = audioCtx.createOscillator();
    const rumbleGain = audioCtx.createGain();
    rumble.type = 'sine';
    rumble.frequency.setValueAtTime(42, now + 0.15);
    rumble.frequency.exponentialRampToValueAtTime(12, now + 2.8);
    rumbleGain.gain.setValueAtTime(0, now);
    rumbleGain.gain.linearRampToValueAtTime(0.34, now + 0.45);
    rumbleGain.gain.setValueAtTime(0.34, now + 1.0);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 3.4);
    rumble.connect(rumbleGain);
    connectToOutput(rumbleGain, null);
    rumble.start(now + 0.1);
    rumble.stop(now + 3.8);

    // Layer 3: Mid-range body (gives thunder its "weight")
    const body = audioCtx.createOscillator();
    const bodyGain = audioCtx.createGain();
    body.type = 'triangle';
    body.frequency.setValueAtTime(70, now + 0.08);
    body.frequency.exponentialRampToValueAtTime(24, now + 0.9);
    bodyGain.gain.setValueAtTime(0, now);
    bodyGain.gain.linearRampToValueAtTime(0.26, now + 0.16);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 1.35);
    body.connect(bodyGain);
    connectToOutput(bodyGain, null);
    body.start(now + 0.05);
    body.stop(now + 2.0);

    // Layer 4: Noise crackle (electrical discharge)
    if (noiseBuffer) {
      const noise = audioCtx.createBufferSource();
      noise.buffer = noiseBuffer;
      const noiseGain = audioCtx.createGain();
      const noiseFilter = audioCtx.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.value = 1100;
      noiseFilter.Q.value = 0.8;
      noiseGain.gain.setValueAtTime(0, now);
      noiseGain.gain.linearRampToValueAtTime(0.22, now + 0.05);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      connectToOutput(noiseGain, null);
      noise.start(now);
      noise.stop(now + 0.4);
    }

    // Layer 5: Low frequency boom (felt more than heard)
    const boom = audioCtx.createOscillator();
    const boomGain = audioCtx.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(28, now + 0.25);
    boom.frequency.exponentialRampToValueAtTime(9, now + 1.8);
    boomGain.gain.setValueAtTime(0, now);
    boomGain.gain.linearRampToValueAtTime(0.2, now + 0.45);
    boomGain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
    boom.connect(boomGain);
    connectToOutput(boomGain, null);
    boom.start(now + 0.2);
    boom.stop(now + 3.0);

    // Layer 6: Lightning crack (sharp electric snap)
    if (noiseBuffer) {
      const lightning = audioCtx.createBufferSource();
      lightning.buffer = noiseBuffer;
      const lg = audioCtx.createGain();
      const lf = audioCtx.createBiquadFilter();
      lf.type = 'highpass'; lf.frequency.value = 3000; lf.Q.value = 1;
      const ws = audioCtx.createWaveShaper(); ws.curve = makeDistortionCurve(80);
      lg.gain.setValueAtTime(0.35, now);
      lg.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      lightning.connect(lf); lf.connect(ws); ws.connect(lg);
      connectToOutput(lg, null);
      lightning.start(now); lightning.stop(now + 0.1);
    }

    // Layer 7: Long reverb tail (distant rolling echo)
    if (longNoiseBuffer) {
      const tail = audioCtx.createBufferSource();
      tail.buffer = longNoiseBuffer;
      const tg = audioCtx.createGain();
      const tf = audioCtx.createBiquadFilter();
      tf.type = 'lowpass'; tf.frequency.setValueAtTime(800, now + 0.5);
      tf.frequency.exponentialRampToValueAtTime(100, now + 4);
      tg.gain.setValueAtTime(0, now);
      tg.gain.linearRampToValueAtTime(0.12, now + 0.6);
      tg.gain.exponentialRampToValueAtTime(0.001, now + 4.5);
      tail.connect(tf); tf.connect(tg);
      connectToOutput(tg, null);
      tail.start(now + 0.3); tail.stop(now + 5);
    }

    // Layer 8: Echo/reflection (delayed quieter version)
    setTimeout(() => {
      if (!audioCtx || audioCtx.state === 'suspended') return;
      try {
        const echoNow = audioCtx.currentTime;
        const echo = audioCtx.createOscillator();
        const echoGain = audioCtx.createGain();
        echo.type = 'triangle';
        echo.frequency.setValueAtTime(52, echoNow);
        echo.frequency.exponentialRampToValueAtTime(18, echoNow + 1.0);
        echoGain.gain.setValueAtTime(0, echoNow);
        echoGain.gain.linearRampToValueAtTime(0.16, echoNow + 0.25);
        echoGain.gain.exponentialRampToValueAtTime(0.001, echoNow + 2.0);
        echo.connect(echoGain);
        connectToOutput(echoGain, null);
        echo.start(echoNow);
        echo.stop(echoNow + 2.5);
      } catch (e) {}
    }, 1500); // Echo arrives 1.5 seconds later
  } catch (e) {}
}

// ========== RELOAD SOUND (5 layers) ==========
function playReloadSound(now, vol, panner) {
  // Layer 1: Magazine release click
  const magClick = audioCtx.createOscillator();
  const magGain = audioCtx.createGain();
  magClick.type = 'square';
  magClick.frequency.setValueAtTime(1800, now);
  magClick.frequency.exponentialRampToValueAtTime(400, now + 0.015);
  magGain.gain.setValueAtTime(vol * 0.6, now);
  magGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
  magClick.connect(magGain);
  connectToOutput(magGain, panner);
  magClick.start(now);
  magClick.stop(now + 0.03);

  // Layer 2: Magazine drop (hollow thud)
  const magDrop = audioCtx.createOscillator();
  const magDropGain = audioCtx.createGain();
  magDrop.type = 'triangle';
  magDrop.frequency.setValueAtTime(300, now + 0.08);
  magDrop.frequency.exponentialRampToValueAtTime(80, now + 0.15);
  magDropGain.gain.setValueAtTime(0, now);
  magDropGain.gain.linearRampToValueAtTime(vol * 0.4, now + 0.08);
  magDropGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  magDrop.connect(magDropGain);
  connectToOutput(magDropGain, panner);
  magDrop.start(now + 0.07);
  magDrop.stop(now + 0.2);

  // Layer 3: New magazine insert (metallic click)
  if (noiseBuffer) {
    const insert = audioCtx.createBufferSource();
    insert.buffer = noiseBuffer;
    const insertGain = audioCtx.createGain();
    const insertFilter = audioCtx.createBiquadFilter();
    insertFilter.type = 'bandpass';
    insertFilter.frequency.value = 2800;
    insertFilter.Q.value = 3;
    insertGain.gain.setValueAtTime(0, now);
    insertGain.gain.linearRampToValueAtTime(vol * 0.5, now + 0.45);
    insertGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    insert.connect(insertFilter);
    insertFilter.connect(insertGain);
    connectToOutput(insertGain, panner);
    insert.start(now + 0.44);
    insert.stop(now + 0.52);
  }

  // Layer 4: Bolt/slide rack
  const bolt = audioCtx.createOscillator();
  const boltGain = audioCtx.createGain();
  bolt.type = 'sawtooth';
  bolt.frequency.setValueAtTime(600, now + 0.7);
  bolt.frequency.exponentialRampToValueAtTime(150, now + 0.78);
  boltGain.gain.setValueAtTime(0, now);
  boltGain.gain.linearRampToValueAtTime(vol * 0.5, now + 0.7);
  boltGain.gain.exponentialRampToValueAtTime(0.001, now + 0.82);
  bolt.connect(boltGain);
  connectToOutput(boltGain, panner);
  bolt.start(now + 0.68);
  bolt.stop(now + 0.85);

  // Layer 5: Spring resonance
  const spring = audioCtx.createOscillator();
  const springGain = audioCtx.createGain();
  spring.type = 'sine';
  spring.frequency.setValueAtTime(2200, now + 0.75);
  spring.frequency.exponentialRampToValueAtTime(800, now + 0.85);
  springGain.gain.setValueAtTime(0, now);
  springGain.gain.linearRampToValueAtTime(vol * 0.15, now + 0.75);
  springGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
  spring.connect(springGain);
  connectToOutput(springGain, panner);
  spring.start(now + 0.74);
  spring.stop(now + 0.95);
}

// ========== MELEE SWING SOUND (6 layers — powerful whoosh) ==========
function playMeleeSwingSound(now, vol, panner) {
  // Layer 1: Whoosh (filtered noise sweep)
  if (noiseBuffer) {
    const whoosh = audioCtx.createBufferSource();
    whoosh.buffer = noiseBuffer;
    const wg = audioCtx.createGain();
    const wf = audioCtx.createBiquadFilter();
    wf.type = 'bandpass';
    wf.frequency.setValueAtTime(600, now);
    wf.frequency.exponentialRampToValueAtTime(3500, now + 0.06);
    wf.frequency.exponentialRampToValueAtTime(400, now + 0.2);
    wf.Q.value = 2.5;
    wg.gain.setValueAtTime(0, now);
    wg.gain.linearRampToValueAtTime(vol * 1.0, now + 0.03);
    wg.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    whoosh.connect(wf); wf.connect(wg); connectToOutput(wg, panner);
    whoosh.start(now); whoosh.stop(now + 0.25);
  }

  // Layer 2: Air displacement swoosh
  const swoosh = audioCtx.createOscillator();
  const swooshG = audioCtx.createGain();
  swoosh.type = 'sine';
  swoosh.frequency.setValueAtTime(150, now);
  swoosh.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
  swoosh.frequency.exponentialRampToValueAtTime(100, now + 0.18);
  swooshG.gain.setValueAtTime(vol * 0.5, now);
  swooshG.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  swoosh.connect(swooshG); connectToOutput(swooshG, panner);
  swoosh.start(now); swoosh.stop(now + 0.22);

  // Layer 3: Metal ring (for pan/machete)
  const ring = audioCtx.createOscillator();
  const ringG = audioCtx.createGain();
  ring.type = 'triangle';
  ring.frequency.setValueAtTime(1800, now + 0.01);
  ring.frequency.exponentialRampToValueAtTime(300, now + 0.15);
  ringG.gain.setValueAtTime(vol * 0.35, now + 0.01);
  ringG.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  ring.connect(ringG); connectToOutput(ringG, panner);
  ring.start(now + 0.01); ring.stop(now + 0.2);

  // Layer 4: Low thump
  const thump = audioCtx.createOscillator();
  const thumpG = audioCtx.createGain();
  thump.type = 'sine';
  thump.frequency.setValueAtTime(100, now);
  thump.frequency.exponentialRampToValueAtTime(25, now + 0.1);
  thumpG.gain.setValueAtTime(vol * 0.4, now);
  thumpG.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  thump.connect(thumpG); connectToOutput(thumpG, panner);
  thump.start(now); thump.stop(now + 0.15);

  // Layer 5: High-speed whoosh oscillator
  const hw = audioCtx.createOscillator();
  const hwG = audioCtx.createGain();
  hw.type = 'triangle';
  hw.frequency.setValueAtTime(300, now);
  hw.frequency.exponentialRampToValueAtTime(2000, now + 0.04);
  hw.frequency.exponentialRampToValueAtTime(200, now + 0.12);
  hwG.gain.setValueAtTime(vol * 0.25, now);
  hwG.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
  hw.connect(hwG); connectToOutput(hwG, panner);
  hw.start(now); hw.stop(now + 0.16);

  // Layer 6: Impact crack at end of swing
  const imp = audioCtx.createOscillator();
  const impG = audioCtx.createGain();
  imp.type = 'sawtooth';
  imp.frequency.setValueAtTime(600, now + 0.06);
  imp.frequency.exponentialRampToValueAtTime(100, now + 0.1);
  impG.gain.setValueAtTime(0, now);
  impG.gain.linearRampToValueAtTime(vol * 0.3, now + 0.06);
  impG.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  imp.connect(impG); connectToOutput(impG, panner);
  imp.start(now + 0.05); imp.stop(now + 0.15);
}

// ========== GIANT HIT SOUND (crisp, heavy bullet impact) ==========
function playGiantHitSound(now, vol, panner) {
  // Layer 1: Sharp metallic crack (crisp bullet impact)
  const crack = audioCtx.createOscillator();
  const crackGain = audioCtx.createGain();
  crack.type = 'sawtooth';
  crack.frequency.setValueAtTime(1800, now);
  crack.frequency.exponentialRampToValueAtTime(400, now + 0.015);
  crackGain.gain.setValueAtTime(vol * 1.0, now);
  crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
  crack.connect(crackGain);
  connectToOutput(crackGain, panner);
  crack.start(now);
  crack.stop(now + 0.05);

  // Layer 2: Heavy deep thud (massive body impact)
  const thud = audioCtx.createOscillator();
  const thudGain = audioCtx.createGain();
  thud.type = 'sine';
  thud.frequency.setValueAtTime(200, now);
  thud.frequency.exponentialRampToValueAtTime(30, now + 0.15);
  thudGain.gain.setValueAtTime(vol * 0.9, now);
  thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  thud.connect(thudGain);
  connectToOutput(thudGain, panner);
  thud.start(now);
  thud.stop(now + 0.25);

  // Layer 3: Noise burst (flesh tear)
  if (noiseBuffer) {
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 2000;
    noiseFilter.Q.value = 3;
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(vol * 0.7, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    connectToOutput(noiseGain, panner);
    noise.start(now);
    noise.stop(now + 0.08);
  }

  // Layer 4: Resonant ring (echo in giant's body)
  const ring = audioCtx.createOscillator();
  const ringGain = audioCtx.createGain();
  ring.type = 'triangle';
  ring.frequency.setValueAtTime(350, now + 0.01);
  ring.frequency.exponentialRampToValueAtTime(120, now + 0.3);
  ringGain.gain.setValueAtTime(0, now);
  ringGain.gain.linearRampToValueAtTime(vol * 0.4, now + 0.02);
  ringGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  ring.connect(ringGain);
  connectToOutput(ringGain, panner);
  ring.start(now);
  ring.stop(now + 0.4);
}

// ========== KILL STREAK SOUND ==========
export function playKillStreakSound(level) {
  if (!audioCtx || audioCtx.state === 'suspended') return;
  try {
    const now = audioCtx.currentTime;
    const notes = [523, 659, 784, 880, 1047, 1175]; // C5-E5-G5-A5-C6-D6
    const vol = 0.1 + level * 0.05;
    for (let i = 0; i < level; i++) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(notes[i], now + i * 0.08);
      gain.gain.setValueAtTime(vol, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.15);
      osc.connect(gain);
      connectToOutput(gain, null);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.2);
    }
    // Add drum kick for level >= 4
    if (level >= 4) {
      const kick = audioCtx.createOscillator();
      const kGain = audioCtx.createGain();
      kick.type = 'sine';
      kick.frequency.setValueAtTime(150, now);
      kick.frequency.exponentialRampToValueAtTime(30, now + 0.1);
      kGain.gain.setValueAtTime(0.3, now);
      kGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      kick.connect(kGain);
      connectToOutput(kGain, null);
      kick.start(now);
      kick.stop(now + 0.2);
    }
  } catch (e) {}
}

// ========== FISH SLAP SOUND ==========
function playFishSlapSound(now, vol, panner) {
  // Low thump (fish body impact)
  const thump = audioCtx.createOscillator();
  const tGain = audioCtx.createGain();
  thump.type = 'sine';
  thump.frequency.setValueAtTime(120, now);
  thump.frequency.exponentialRampToValueAtTime(40, now + 0.1);
  tGain.gain.setValueAtTime(vol * 0.9, now);
  tGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  thump.connect(tGain);
  connectToOutput(tGain, panner);
  thump.start(now);
  thump.stop(now + 0.2);
  // Wet noise burst
  if (noiseBuffer) {
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    const nf = audioCtx.createBiquadFilter();
    nf.type = 'bandpass'; nf.frequency.value = 800; nf.Q.value = 2;
    const nGain = audioCtx.createGain();
    nGain.gain.setValueAtTime(vol * 0.7, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    noise.connect(nf); nf.connect(nGain);
    connectToOutput(nGain, panner);
    noise.start(now); noise.stop(now + 0.1);
  }
  // High squelch
  const sq = audioCtx.createOscillator();
  const sqGain = audioCtx.createGain();
  sq.type = 'sawtooth';
  sq.frequency.setValueAtTime(600, now);
  sq.frequency.exponentialRampToValueAtTime(200, now + 0.05);
  sqGain.gain.setValueAtTime(vol * 0.4, now);
  sqGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  sq.connect(sqGain);
  connectToOutput(sqGain, panner);
  sq.start(now); sq.stop(now + 0.08);
}

// ========== FART SOUND ==========
export function playFartSound(sourcePos) {
  if (!audioCtx || audioCtx.state === 'suspended') return;
  try {
    const now = audioCtx.currentTime;
    const panner = createPanner(sourcePos);
    // Low rumble
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.linearRampToValueAtTime(30, now + 1.5);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    osc.connect(gain);
    connectToOutput(gain, panner);
    osc.start(now); osc.stop(now + 1.6);
    // Noise layer
    if (noiseBuffer) {
      const n = audioCtx.createBufferSource();
      n.buffer = noiseBuffer;
      const f = audioCtx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 200; f.Q.value = 0.5;
      const ng = audioCtx.createGain();
      ng.gain.setValueAtTime(0.3, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      n.connect(f); f.connect(ng);
      connectToOutput(ng, panner);
      n.start(now); n.stop(now + 1.5);
    }
  } catch (e) {}
}

// ========== DISCO SOUND ==========
export function playDiscoBeat() {
  if (!audioCtx || audioCtx.state === 'suspended') return;
  try {
    const now = audioCtx.currentTime;
    // 4-on-the-floor kick
    for (let i = 0; i < 4; i++) {
      const kick = audioCtx.createOscillator();
      const kg = audioCtx.createGain();
      kick.type = 'sine';
      kick.frequency.setValueAtTime(150, now + i * 0.25);
      kick.frequency.exponentialRampToValueAtTime(30, now + i * 0.25 + 0.05);
      kg.gain.setValueAtTime(0.2, now + i * 0.25);
      kg.gain.exponentialRampToValueAtTime(0.001, now + i * 0.25 + 0.1);
      kick.connect(kg); connectToOutput(kg, null);
      kick.start(now + i * 0.25); kick.stop(now + i * 0.25 + 0.15);
    }
    // Hi-hat on off-beats
    if (noiseBuffer) {
      for (let i = 0; i < 4; i++) {
        const hh = audioCtx.createBufferSource();
        hh.buffer = noiseBuffer;
        const hf = audioCtx.createBiquadFilter();
        hf.type = 'highpass'; hf.frequency.value = 8000;
        const hg = audioCtx.createGain();
        hg.gain.setValueAtTime(0.1, now + i * 0.25 + 0.125);
        hg.gain.exponentialRampToValueAtTime(0.001, now + i * 0.25 + 0.18);
        hh.connect(hf); hf.connect(hg); connectToOutput(hg, null);
        hh.start(now + i * 0.25 + 0.125); hh.stop(now + i * 0.25 + 0.2);
      }
    }
  } catch (e) {}
}

// ========== VICTORY MUSIC ==========
export function playVictoryMusic() {
  if (!audioCtx || audioCtx.state === 'suspended') return;
  try {
    const now = audioCtx.currentTime;
    const melody = [523, 659, 784, 1047]; // C5-E5-G5-C6
    melody.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.4);
      gain.gain.setValueAtTime(0.2, now + i * 0.4);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.4 + 0.5);
      osc.connect(gain); connectToOutput(gain, null);
      osc.start(now + i * 0.4); osc.stop(now + i * 0.4 + 0.6);
    });
    // Applause noise
    if (noiseBuffer) {
      const n = audioCtx.createBufferSource();
      n.buffer = noiseBuffer;
      const f = audioCtx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 3000; f.Q.value = 0.3;
      const ng = audioCtx.createGain();
      ng.gain.setValueAtTime(0, now);
      ng.gain.linearRampToValueAtTime(0.15, now + 0.5);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 3);
      n.connect(f); f.connect(ng); connectToOutput(ng, null);
      n.start(now + 0.3); n.stop(now + 3.5);
    }
  } catch (e) {}
}

// ========== EXPLOSION SOUND (8 layers — massive boom) ==========
function playExplosionSound(now, vol, panner) {
  // Layer 1: Massive low-frequency boom
  const boom = audioCtx.createOscillator();
  const boomG = audioCtx.createGain();
  boom.type = 'sine';
  boom.frequency.setValueAtTime(80, now);
  boom.frequency.exponentialRampToValueAtTime(10, now + 0.8);
  boomG.gain.setValueAtTime(vol * 1.5, now);
  boomG.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
  boom.connect(boomG); connectToOutput(boomG, panner);
  boom.start(now); boom.stop(now + 1.2);

  // Layer 2: Initial crack (noise burst with distortion)
  if (noiseBuffer) {
    const crack = audioCtx.createBufferSource();
    crack.buffer = noiseBuffer;
    const cg = audioCtx.createGain();
    const cf = audioCtx.createBiquadFilter();
    cf.type = 'lowpass'; cf.frequency.value = 3000; cf.Q.value = 0.5;
    const ws = audioCtx.createWaveShaper(); ws.curve = makeDistortionCurve(80);
    cg.gain.setValueAtTime(vol * 1.4, now);
    cg.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    crack.connect(cf); cf.connect(ws); ws.connect(cg);
    connectToOutput(cg, panner);
    crack.start(now); crack.stop(now + 0.2);
  }

  // Layer 3: Mid-range blast
  const blast = audioCtx.createOscillator();
  const blastG = audioCtx.createGain();
  blast.type = 'sawtooth';
  blast.frequency.setValueAtTime(400, now);
  blast.frequency.exponentialRampToValueAtTime(30, now + 0.3);
  blastG.gain.setValueAtTime(vol * 1.0, now);
  blastG.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
  blast.connect(blastG); connectToOutput(blastG, panner);
  blast.start(now); blast.stop(now + 0.5);

  // Layer 4: Sub-bass rumble (felt more than heard)
  const sub = audioCtx.createOscillator();
  const subG = audioCtx.createGain();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(30, now);
  sub.frequency.exponentialRampToValueAtTime(8, now + 1.5);
  subG.gain.setValueAtTime(vol * 0.8, now + 0.05);
  subG.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
  sub.connect(subG); connectToOutput(subG, panner);
  sub.start(now); sub.stop(now + 2.0);

  // Layer 5: Distorted saturation layer
  const sat = audioCtx.createOscillator();
  const satG = audioCtx.createGain();
  const ws2 = audioCtx.createWaveShaper(); ws2.curve = makeDistortionCurve(100);
  sat.type = 'sawtooth';
  sat.frequency.setValueAtTime(200, now);
  sat.frequency.exponentialRampToValueAtTime(40, now + 0.2);
  satG.gain.setValueAtTime(vol * 0.5, now);
  satG.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  sat.connect(ws2); ws2.connect(satG); connectToOutput(satG, panner);
  sat.start(now); sat.stop(now + 0.35);

  // Layer 6: Debris noise tail
  if (longNoiseBuffer) {
    const debris = audioCtx.createBufferSource();
    debris.buffer = longNoiseBuffer;
    const dg = audioCtx.createGain();
    const df = audioCtx.createBiquadFilter();
    df.type = 'lowpass'; df.frequency.setValueAtTime(2000, now);
    df.frequency.exponentialRampToValueAtTime(200, now + 1.5);
    dg.gain.setValueAtTime(0, now);
    dg.gain.linearRampToValueAtTime(vol * 0.4, now + 0.05);
    dg.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
    debris.connect(df); df.connect(dg); connectToOutput(dg, panner);
    debris.start(now); debris.stop(now + 2.0);
  }

  // Layer 7: Secondary explosion (delayed)
  const boom2 = audioCtx.createOscillator();
  const boom2G = audioCtx.createGain();
  boom2.type = 'sine';
  boom2.frequency.setValueAtTime(50, now + 0.15);
  boom2.frequency.exponentialRampToValueAtTime(12, now + 0.6);
  boom2G.gain.setValueAtTime(0, now);
  boom2G.gain.linearRampToValueAtTime(vol * 0.6, now + 0.15);
  boom2G.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
  boom2.connect(boom2G); connectToOutput(boom2G, panner);
  boom2.start(now + 0.1); boom2.stop(now + 1.0);

  // Layer 8: High-frequency sizzle
  if (noiseBuffer) {
    const sizzle = audioCtx.createBufferSource();
    sizzle.buffer = noiseBuffer;
    const sg = audioCtx.createGain();
    const sf = audioCtx.createBiquadFilter();
    sf.type = 'highpass'; sf.frequency.value = 4000;
    sg.gain.setValueAtTime(vol * 0.3, now + 0.02);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    sizzle.connect(sf); sf.connect(sg); connectToOutput(sg, panner);
    sizzle.start(now); sizzle.stop(now + 0.6);
  }
}

// ========== FOOTSTEP SOUND (3 layers) ==========
export function playFootstepSound(surface) {
  if (!audioCtx || audioCtx.state === 'suspended') return;
  try {
    const now = audioCtx.currentTime;
    const vol = 0.12;

    // Profiles for different surfaces
    const profiles = {
      dirt:   { freq: 120, end: 40, noiseFreq: 500,  noiseQ: 1.0, noiseVol: 0.3 },
      grass:  { freq: 180, end: 60, noiseFreq: 1200, noiseQ: 1.5, noiseVol: 0.25 },
      stone:  { freq: 250, end: 80, noiseFreq: 2500, noiseQ: 2.0, noiseVol: 0.4 },
      wood:   { freq: 200, end: 70, noiseFreq: 1800, noiseQ: 1.8, noiseVol: 0.35 },
      metal:  { freq: 400, end: 150, noiseFreq: 3500, noiseQ: 3.0, noiseVol: 0.45 },
      sand:   { freq: 80,  end: 30, noiseFreq: 400,  noiseQ: 0.8, noiseVol: 0.2 },
      water:  { freq: 150, end: 50, noiseFreq: 800,  noiseQ: 0.5, noiseVol: 0.5 },
    };
    const p = profiles[surface] || profiles.dirt;

    // Low thud
    const thud = audioCtx.createOscillator();
    const thudG = audioCtx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(p.freq, now);
    thud.frequency.exponentialRampToValueAtTime(p.end, now + 0.06);
    thudG.gain.setValueAtTime(vol * 0.8, now);
    thudG.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    thud.connect(thudG); connectToOutput(thudG, null);
    thud.start(now); thud.stop(now + 0.1);

    // Noise burst (surface texture)
    if (noiseBuffer) {
      const noise = audioCtx.createBufferSource();
      noise.buffer = noiseBuffer;
      const ng = audioCtx.createGain();
      const nf = audioCtx.createBiquadFilter();
      nf.type = 'bandpass'; nf.frequency.value = p.noiseFreq; nf.Q.value = p.noiseQ;
      ng.gain.setValueAtTime(vol * p.noiseVol, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      noise.connect(nf); nf.connect(ng); connectToOutput(ng, null);
      noise.start(now); noise.stop(now + 0.08);
    }

    // Subtle click
    const click = audioCtx.createOscillator();
    const clickG = audioCtx.createGain();
    click.type = 'triangle';
    click.frequency.setValueAtTime(800 + Math.random() * 400, now);
    click.frequency.exponentialRampToValueAtTime(200, now + 0.015);
    clickG.gain.setValueAtTime(vol * 0.2, now);
    clickG.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
    click.connect(clickG); connectToOutput(clickG, null);
    click.start(now); click.stop(now + 0.03);
  } catch (e) {}
}


// ========== MAIN PLAY SOUND DISPATCHER ==========
export function playSound(type, sourcePos = null, options = null) {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
    return;
  }
  try {
    const now = audioCtx.currentTime;
    const vol = sourcePos ? 0.85 : 0.55;
    const panner = createPanner(sourcePos);

    switch (type) {
      case 'dry_fire': playDryFireSound(now, vol, panner); break;
      case 'pistol': playPistolSound(now, vol, panner); break;
      case 'ar':
      case 'ar_fast': playARSound(now, vol, panner, type === 'ar_fast'); break;
      case 'sniper': playSniperSound(now, vol, panner); break;
      case 'shotgun': playShotgunSound(now, vol, panner); break;
      case 'hit': playHitSound(now, vol, panner); break;
      case 'giantHit': playGiantHitSound(now, vol, panner); break;
      case 'reload': playReloadSound(now, vol, panner); break;
      case 'melee': playMeleeSwingSound(now, vol, panner); break;
      case 'fish_slap': playFishSlapSound(now, vol, panner); break;
      case 'explosion': playExplosionSound(now, vol, panner); break;
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
