import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { state } from './state.js';

export function initScene() {
  // Scene
  state.scene = new THREE.Scene();
  state.scene.background = new THREE.Color(0x87CEEB); // Sky blue background

  // Light fog for atmosphere but good visibility (~800 units)
  state.scene.fog = new THREE.FogExp2(0x87CEEB, 0.0015);

  // Camera - generous far plane for long visibility
  state.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.5, 2000);
  state.camera.position.set(0, 400, 0);

  // Single ambient light (remove directional for performance)
  state.ambLight = new THREE.AmbientLight(0xffffff, 1.0);
  state.scene.add(state.ambLight);
  state.dirLight = new THREE.DirectionalLight(0xffffff, 0.4);
  state.dirLight.position.set(500, 1000, 500);
  state.scene.add(state.dirLight);

  // Renderer - maximum performance settings
  state.renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: "high-performance",
    stencil: false,
    depth: true,
    alpha: false,
    logarithmicDepthBuffer: false
  });
  state.renderer.setSize(window.innerWidth, window.innerHeight);
  state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0)); // Force 1x pixel ratio
  state.renderer.sortObjects = false;
  state.renderer.info.autoReset = false;
  document.body.appendChild(state.renderer.domElement);

  // Controls
  state.controls = new PointerLockControls(state.camera, document.body);
  state.scene.add(state.controls.getObject());

  // Raycaster
  state.raycaster = new THREE.Raycaster();

  // Physics vectors
  state.velocity = new THREE.Vector3();
  state.direction = new THREE.Vector3();

  // Window resize handler
  window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
  state.camera.aspect = window.innerWidth / window.innerHeight;
  state.camera.updateProjectionMatrix();
  state.renderer.setSize(window.innerWidth, window.innerHeight);
}
