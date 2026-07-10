import * as THREE from 'three';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createBabyOctopus } from './baby-octopus.js';

const MODEL_URL = new URL('../pinata.glb', import.meta.url).href;
const PINATA_HEIGHT_METERS = 0.72;
const PINATA_DISTANCE_METERS = 1.55;
const PINATA_ARENA_RADIUS_METERS = 5;
const PINATA_MIN_DISTANCE_METERS = 1.15;
const PINATA_FALLBACK_ARC_RADIANS = THREE.MathUtils.degToRad(28);
const PINATA_HIT_RADIUS_METERS = 0.62;
const PINATA_WANDER_DURATION_MIN_SECONDS = 2.4;
const PINATA_WANDER_DURATION_MAX_SECONDS = 3.3;
const PINATA_WANDER_WAIT_MIN_SECONDS = 1.2;
const PINATA_WANDER_WAIT_MAX_SECONDS = 2;
const PINATA_POST_HIT_WAIT_MIN_SECONDS = 0.9;
const PINATA_POST_HIT_WAIT_MAX_SECONDS = 1.4;
const PINATA_HIT_MOVE_DURATION_SECONDS = 1.5;
const PINATA_LOOK_CONE_HALF_ANGLE_RADIANS = THREE.MathUtils.degToRad(30);
const PINATA_MAX_SIDE_TILT_RADIANS = THREE.MathUtils.degToRad(7);
const HITS_TO_EXPLODE = 6;
const HIT_CONFETTI_COUNT = 40;
const EXPLOSION_CONFETTI_COUNT = 340;
const BABY_BLUE = '#a9dcff';
const BABY_PINK = '#f6b6cf';
const FINAL_EFFECT_THEMES = Object.freeze({
  blue: {
    color: BABY_BLUE,
    glow: 'rgba(169, 220, 255, 0.58)',
  },
  pink: {
    color: BABY_PINK,
    glow: 'rgba(246, 182, 207, 0.62)',
  },
});
const CONFETTI_RAIN_RATE = 60;
const CONFETTI_RAIN_RADIUS_METERS = 1.8;
const ASSET_LOAD_TIMEOUT_MS = 15000;

const host = document.querySelector('#scene-root');
const overlay = document.querySelector('#overlay');
const cameraFeed = document.querySelector('#camera-feed');
const finalMessage = document.querySelector('#farewell');
const resetButton = document.querySelector('#reset-button');
const statusEl = document.querySelector('#status');

const clock = new THREE.Clock();
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.01, 35);
camera.position.set(0, 0, 0);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance',
});

renderer.xr.enabled = true;
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x4f6470, 2.45);
scene.add(hemiLight);

const cameraLight = new THREE.DirectionalLight(0xffffff, 2.8);
cameraLight.position.set(0.4, 1.2, 0.8);
camera.add(cameraLight);
scene.add(camera);

const arContent = new THREE.Group();
arContent.name = 'ar-content';
arContent.visible = false;
scene.add(arContent);

const pinataRoot = new THREE.Group();
pinataRoot.position.set(0, -0.08, -PINATA_DISTANCE_METERS);
arContent.add(pinataRoot);

const pinataBody = new THREE.Group();
pinataRoot.add(pinataBody);

let finalEffectThemeName = getInitialFinalEffectTheme();

const babyOctopus = createBabyOctopus(finalEffectThemeName);
arContent.add(babyOctopus.root);

const confettiGroup = new THREE.Group();
arContent.add(confettiGroup);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const tmpVector = new THREE.Vector3();
const tmpCameraPosition = new THREE.Vector3();
const tmpCameraDirection = new THREE.Vector3();
const tmpLookTarget = new THREE.Vector3();
const tmpMatrix = new THREE.Matrix4();
const unitScale = new THREE.Vector3(1, 1, 1);
const arenaCenter = new THREE.Vector3(0, -0.08, 0);
const confettiRainCenter = new THREE.Vector3();
const moveState = {
  active: false,
  elapsed: 0,
  duration: 1,
  lift: 0,
  lockHits: false,
  kind: 'idle',
  from: new THREE.Vector3(),
  to: new THREE.Vector3(),
};
const facingState = {
  yawOffset: 0,
  targetYawOffset: 0,
  sideTilt: 0,
  targetSideTilt: 0,
  changeCountdown: 0,
};

const interactiveTargets = [];
let hitCount = 0;
let lastHitAt = 0;
let exploded = false;
let shakeTime = 0;
let explosionTime = 0;
let arExperienceActive = false;
let needsXRPlacement = false;
let wanderCountdown = PINATA_WANDER_WAIT_MIN_SECONDS;
let audioContext = null;
let textSprite = null;
let confettiRainActive = false;
let confettiRainAccumulator = 0;
let explosionRevealTimeout = null;

const confettiGeometry = new THREE.PlaneGeometry(0.026, 0.012);
const confettiMaterials = [
  '#f74f6b',
  '#ffcf4a',
  '#4fd5ff',
  '#85f27d',
  '#b985ff',
  '#ffffff',
].map((color) => new THREE.MeshBasicMaterial({
  color,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.95,
  depthWrite: false,
}));
const rainConfettiMaterial = new THREE.MeshBasicMaterial({
  color: FINAL_EFFECT_THEMES[finalEffectThemeName].color,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.95,
  depthWrite: false,
});

const groundRing = makeGroundRing();
pinataRoot.add(groundRing);

setFinalEffectTheme(finalEffectThemeName);
setStatus('Loading assets..');
loadPinata();
installArButton();
installEventHandlers();
setupFallbackCameraIfNeeded();
renderer.setAnimationLoop(render);

function installArButton() {
  if (!window.isSecureContext || !navigator.xr) {
    return;
  }

  const arButton = ARButton.createButton(renderer, {
    optionalFeatures: ['dom-overlay', 'local-floor'],
    domOverlay: { root: overlay },
  });
  document.body.appendChild(arButton);

  const controller = renderer.xr.getController(0);
  controller.addEventListener('select', handleXRSelect);
  scene.add(controller);

  renderer.xr.addEventListener('sessionstart', () => {
    arExperienceActive = true;
    arContent.visible = false;
    needsXRPlacement = true;
    overlay.classList.add('capture');
    stopFallbackCamera();
  });

  renderer.xr.addEventListener('sessionend', () => {
    arExperienceActive = false;
    needsXRPlacement = false;
    arContent.visible = false;
    overlay.classList.remove('capture');
  });
}

function installEventHandlers() {
  window.addEventListener('resize', handleResize);
  window.addEventListener('pointerdown', handlePointerDown, { passive: false });
  window.addEventListener('contextmenu', (event) => event.preventDefault());

  [resetButton].filter(Boolean).forEach((control) => {
    control.addEventListener('beforexrselect', (event) => event.preventDefault());
  });

  if (resetButton) {
    resetButton.addEventListener('pointerdown', (event) => event.stopPropagation());
    resetButton.addEventListener('click', (event) => {
      event.stopPropagation();
      resetExperience();
    });
  }
}

function getInitialFinalEffectTheme() {
  const configuredTheme = normalizeThemeName(
    window.AR_PINATA_ENV?.FINAL_EFFECT_THEME,
  );

  if (Object.hasOwn(FINAL_EFFECT_THEMES, configuredTheme)) {
    return configuredTheme;
  }
  return 'blue';
}

function normalizeThemeName(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function setFinalEffectTheme(themeName) {
  if (!Object.hasOwn(FINAL_EFFECT_THEMES, themeName)) {
    return;
  }

  finalEffectThemeName = themeName;
  const theme = FINAL_EFFECT_THEMES[themeName];
  document.documentElement.style.setProperty('--final-effect-color', theme.color);
  document.documentElement.style.setProperty('--final-effect-glow', theme.glow);
  rainConfettiMaterial.color.set(theme.color);
  babyOctopus.setTheme(themeName);

  refreshTextSpriteColor();
}

async function loadPinata() {
  try {
    const loader = new GLTFLoader();
    const gltf = await withTimeout(loader.loadAsync(MODEL_URL), ASSET_LOAD_TIMEOUT_MS);
    const model = gltf.scene;

    model.traverse((node) => {
      if (!node.isMesh) {
        return;
      }

      node.frustumCulled = false;
      node.castShadow = false;
      node.receiveShadow = false;
      interactiveTargets.push(node);

      if (node.material) {
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.forEach((material) => {
          material.needsUpdate = true;
        });
      }
    });

    normalizeModel(model, PINATA_HEIGHT_METERS);
    pinataBody.add(model);
    addHitProxy();
    placePinataAroundCurrentSpot(true);
    setStatus('');
  } catch (error) {
    console.error(error);
    setStatus('Assets could not be loaded. Please reload.');
  }
}

async function withTimeout(promise, timeoutMs) {
  let timeoutId;

  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(new Error(`Asset loading timed out after ${timeoutMs}ms.`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function normalizeModel(model, targetHeight) {
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const height = Math.max(size.y, 0.001);
  const scale = targetHeight / height;
  model.scale.setScalar(scale);
  model.position.copy(center).multiplyScalar(-scale);
}

function addHitProxy() {
  const proxyMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const proxy = new THREE.Mesh(new THREE.SphereGeometry(PINATA_HIT_RADIUS_METERS, 24, 16), proxyMaterial);
  proxy.name = 'pinata-hit-proxy';
  pinataBody.add(proxy);
  interactiveTargets.push(proxy);
}

function makeGroundRing() {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.34, 0.43, 64),
    new THREE.MeshBasicMaterial({
      color: BABY_BLUE,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -0.38;
  return ring;
}

function setupFallbackCameraIfNeeded() {
  if (!navigator.xr || !window.isSecureContext) {
    startFallbackCamera();
    return;
  }

  navigator.xr.isSessionSupported('immersive-ar')
    .then((supported) => {
      if (!supported) {
        startFallbackCamera();
      }
    })
    .catch(() => startFallbackCamera());
}

async function startFallbackCamera() {
  if (!navigator.mediaDevices?.getUserMedia || cameraFeed.srcObject) {
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });
    cameraFeed.srcObject = stream;
    document.body.classList.add('fallback-camera');
  } catch {
    document.body.classList.remove('fallback-camera');
  }
}

function stopFallbackCamera() {
  if (!cameraFeed.srcObject) {
    return;
  }

  for (const track of cameraFeed.srcObject.getTracks()) {
    track.stop();
  }
  cameraFeed.srcObject = null;
  document.body.classList.remove('fallback-camera');
}

function handleResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
}

function handlePointerDown(event) {
  if (!arExperienceActive || !arContent.visible || exploded
    || (event.button !== undefined && event.button !== 0)) {
    return;
  }

  if (event.target instanceof Element && event.target.closest('button')) {
    return;
  }

  event.preventDefault();
  unlockAudio();

  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  const raycastCamera = getViewCamera();
  raycastCamera.updateMatrixWorld(true);
  raycaster.setFromCamera(pointer, raycastCamera);
  tryHitPinata();
}

function handleXRSelect() {
  if (!arExperienceActive || !arContent.visible || exploded) {
    return;
  }

  unlockAudio();
  tmpMatrix.identity().extractRotation(this.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(this.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tmpMatrix);
  tryHitPinata();
}

function tryHitPinata() {
  if (!interactiveTargets.length || exploded || (moveState.active && moveState.lockHits)) {
    return false;
  }

  pinataRoot.updateMatrixWorld(true);
  pinataBody.updateMatrixWorld(true);

  const hits = raycaster.intersectObjects(interactiveTargets, true);
  if (!hits.length && !rayIntersectsPinataHitSphere()) {
    return false;
  }

  const now = performance.now();
  if (now - lastHitAt < 140) {
    return true;
  }
  lastHitAt = now;
  hitPinata();
  return true;
}

function rayIntersectsPinataHitSphere() {
  tmpVector.set(0, 0.12, 0);
  pinataBody.localToWorld(tmpVector);
  return raycaster.ray.distanceSqToPoint(tmpVector) <= PINATA_HIT_RADIUS_METERS * PINATA_HIT_RADIUS_METERS;
}

function hitPinata() {
  hitCount += 1;
  shakeTime = 0.42;

  const origin = getPinataBurstOrigin();

  if (hitCount >= HITS_TO_EXPLODE) {
    explodePinata(origin);
    return;
  }

  createConfettiBurst(origin, HIT_CONFETTI_COUNT, 0.9, 1.1);
  playHitSound();
  movePinataAfterHit();
}

function explodePinata(origin) {
  exploded = true;
  explosionTime = 0.28;
  moveState.active = false;
  confettiRainCenter.copy(origin);
  playExplosionSound();
  createConfettiBurst(origin, EXPLOSION_CONFETTI_COUNT, 2.1, 1.85);

  explosionRevealTimeout = window.setTimeout(() => {
    pinataBody.visible = false;
    groundRing.visible = false;
    confettiRainActive = true;
    showFinalMessage();
    babyOctopus.reveal(pinataRoot.position, getViewCamera());
    document.body.classList.add('pinata-done');
    explosionRevealTimeout = null;
  }, 260);
}

function getPinataBurstOrigin() {
  tmpVector.set(0, 0.12, 0);
  pinataBody.localToWorld(tmpVector);
  return tmpVector.clone();
}

function showFinalMessage() {
  if (!textSprite) {
    textSprite = makeTextSprite('See you soon little one!');
    textSprite.position.set(0, 0.62, 0);
    pinataRoot.add(textSprite);
  }

  textSprite.visible = true;
  finalMessage.classList.add('visible');
}

function refreshTextSpriteColor() {
  if (!textSprite) {
    return;
  }

  const wasVisible = textSprite.visible;
  pinataRoot.remove(textSprite);
  textSprite.material.map?.dispose();
  textSprite.material.dispose();

  textSprite = makeTextSprite('See you soon little one!');
  textSprite.position.set(0, 0.62, 0);
  textSprite.visible = wasVisible;
  pinataRoot.add(textSprite);
}

function makeTextSprite(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 512;
  const context = canvas.getContext('2d');

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = '800 156px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.shadowColor = 'rgba(8, 20, 32, 0.95)';
  context.shadowBlur = 26;
  context.shadowOffsetY = 8;
  context.fillStyle = FINAL_EFFECT_THEMES[finalEffectThemeName].color;
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.65, 0.42, 1);
  sprite.renderOrder = 12;
  sprite.visible = false;
  return sprite;
}

function createConfettiBurst(origin, count, force, radius) {
  for (let i = 0; i < count; i += 1) {
    const material = confettiMaterials[Math.floor(Math.random() * confettiMaterials.length)];
    const piece = new THREE.Mesh(confettiGeometry, material);
    const horizontalAngle = Math.random() * Math.PI * 2;
    const horizontalSpeed = (0.2 + Math.random() * radius) * force;
    const upwardSpeed = (0.55 + Math.random() * 1.35) * force;
    const baseScale = 0.72 + Math.random() * 1.3;

    piece.position.copy(origin);
    piece.position.x += (Math.random() - 0.5) * 0.12;
    piece.position.y += (Math.random() - 0.5) * 0.12;
    piece.position.z += (Math.random() - 0.5) * 0.12;
    piece.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    piece.scale.setScalar(baseScale);
    piece.renderOrder = 8;

    piece.userData.velocity = new THREE.Vector3(
      Math.cos(horizontalAngle) * horizontalSpeed,
      upwardSpeed,
      Math.sin(horizontalAngle) * horizontalSpeed,
    );
    piece.userData.spin = new THREE.Vector3(
      (Math.random() - 0.5) * 14,
      (Math.random() - 0.5) * 18,
      (Math.random() - 0.5) * 12,
    );
    piece.userData.life = 1.0 + Math.random() * 1.4;
    piece.userData.age = 0;
    piece.userData.baseScale = baseScale;
    piece.userData.gravity = 2.9;
    piece.userData.drag = 0.5;
    confettiGroup.add(piece);
  }
}

function createThemedConfettiRain(count) {
  for (let i = 0; i < count; i += 1) {
    const piece = new THREE.Mesh(confettiGeometry, rainConfettiMaterial);
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.sqrt(Math.random()) * CONFETTI_RAIN_RADIUS_METERS;
    const baseScale = 0.8 + Math.random() * 1.25;

    piece.position.set(
      confettiRainCenter.x + Math.cos(angle) * distance,
      confettiRainCenter.y + 2.1 + Math.random() * 1.2,
      confettiRainCenter.z + Math.sin(angle) * distance,
    );
    piece.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    piece.scale.setScalar(baseScale);
    piece.renderOrder = 8;

    piece.userData.velocity = new THREE.Vector3(
      THREE.MathUtils.randFloatSpread(0.16),
      THREE.MathUtils.randFloat(-0.82, -0.48),
      THREE.MathUtils.randFloatSpread(0.16),
    );
    piece.userData.spin = new THREE.Vector3(
      THREE.MathUtils.randFloatSpread(7),
      THREE.MathUtils.randFloatSpread(9),
      THREE.MathUtils.randFloatSpread(7),
    );
    piece.userData.life = 2.8 + Math.random() * 1.4;
    piece.userData.age = 0;
    piece.userData.baseScale = baseScale;
    piece.userData.gravity = 0.12;
    piece.userData.drag = 0.08;
    confettiGroup.add(piece);
  }
}

function updateConfettiRain(delta) {
  if (!confettiRainActive) {
    return;
  }

  confettiRainAccumulator += delta * CONFETTI_RAIN_RATE;
  const piecesToCreate = Math.floor(confettiRainAccumulator);
  if (piecesToCreate > 0) {
    createThemedConfettiRain(piecesToCreate);
    confettiRainAccumulator -= piecesToCreate;
  }
}

function updateConfetti(delta) {
  for (let i = confettiGroup.children.length - 1; i >= 0; i -= 1) {
    const piece = confettiGroup.children[i];
    const data = piece.userData;
    data.age += delta;

    data.velocity.y -= data.gravity * delta;
    data.velocity.multiplyScalar(1 - Math.min(delta * data.drag, 0.045));
    piece.position.addScaledVector(data.velocity, delta);
    piece.rotation.x += data.spin.x * delta;
    piece.rotation.y += data.spin.y * delta;
    piece.rotation.z += data.spin.z * delta;

    const fadeStart = data.life * 0.7;
    if (data.age > fadeStart) {
      const fade = 1 - (data.age - fadeStart) / (data.life - fadeStart);
      piece.scale.setScalar(data.baseScale * Math.max(fade, 0));
    }

    if (data.age >= data.life) {
      confettiGroup.remove(piece);
    }
  }
}

function unlockAudio() {
  const context = getAudioContext();
  if (context?.state === 'suspended') {
    context.resume();
  }
}

function getAudioContext() {
  if (audioContext) {
    return audioContext;
  }

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    return null;
  }

  audioContext = new AudioContext();
  return audioContext;
}

function playHitSound() {
  const context = getAudioContext();
  if (!context) {
    return;
  }

  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const filter = context.createBiquadFilter();

  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(520, now);
  oscillator.frequency.exponentialRampToValueAtTime(150, now + 0.13);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1200, now);
  filter.frequency.exponentialRampToValueAtTime(380, now + 0.16);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.2, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

  oscillator.connect(filter).connect(gain).connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.2);
}

function playExplosionSound() {
  const context = getAudioContext();
  if (!context) {
    return;
  }

  const now = context.currentTime;
  const duration = 0.75;
  const sampleRate = context.sampleRate;
  const buffer = context.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
  const samples = buffer.getChannelData(0);

  for (let i = 0; i < samples.length; i += 1) {
    const t = i / samples.length;
    samples[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.2);
  }

  const noise = context.createBufferSource();
  const noiseGain = context.createGain();
  const noiseFilter = context.createBiquadFilter();

  noise.buffer = buffer;
  noiseFilter.type = 'lowpass';
  noiseFilter.frequency.setValueAtTime(2600, now);
  noiseFilter.frequency.exponentialRampToValueAtTime(320, now + duration);
  noiseGain.gain.setValueAtTime(0.0001, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.55, now + 0.025);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  noise.connect(noiseFilter).connect(noiseGain).connect(context.destination);
  noise.start(now);
  noise.stop(now + duration);

  const boom = context.createOscillator();
  const boomGain = context.createGain();
  boom.type = 'sine';
  boom.frequency.setValueAtTime(96, now);
  boom.frequency.exponentialRampToValueAtTime(34, now + 0.46);
  boomGain.gain.setValueAtTime(0.0001, now);
  boomGain.gain.exponentialRampToValueAtTime(0.42, now + 0.02);
  boomGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
  boom.connect(boomGain).connect(context.destination);
  boom.start(now);
  boom.stop(now + 0.58);
}

function resetExperience() {
  hitCount = 0;
  lastHitAt = 0;
  exploded = false;
  shakeTime = 0;
  explosionTime = 0;
  moveState.active = false;
  wanderCountdown = PINATA_WANDER_WAIT_MIN_SECONDS;
  confettiRainActive = false;
  confettiRainAccumulator = 0;
  babyOctopus.reset();
  if (explosionRevealTimeout !== null) {
    window.clearTimeout(explosionRevealTimeout);
    explosionRevealTimeout = null;
  }
  pinataBody.visible = true;
  groundRing.visible = true;
  pinataBody.position.set(0, 0, 0);
  pinataBody.rotation.set(0, 0, 0);
  pinataBody.scale.setScalar(1);
  finalMessage.classList.remove('visible');
  document.body.classList.remove('pinata-done');

  if (textSprite) {
    textSprite.visible = false;
  }

  while (confettiGroup.children.length) {
    confettiGroup.remove(confettiGroup.children[0]);
  }

  if (renderer.xr.isPresenting) {
    arContent.visible = false;
    needsXRPlacement = true;
  } else {
    placePinataAroundCurrentSpot(true);
  }
}

function placePinataInFrontOfCamera() {
  placePinataAroundCurrentSpot(true);
}

function placePinataAroundCurrentSpot(immediate = false) {
  refreshArenaCenter();
  movePinataWithinArena(immediate);
}

function movePinataWithinArena(immediate = false) {
  const target = getRandomArenaPosition({
    minDistance: PINATA_MIN_DISTANCE_METERS,
    maxDistance: PINATA_ARENA_RADIUS_METERS,
    avoidCurrent: false,
  });

  if (immediate) {
    pinataRoot.position.copy(target);
    moveState.active = false;
    wanderCountdown = THREE.MathUtils.randFloat(
      PINATA_WANDER_WAIT_MIN_SECONDS,
      PINATA_WANDER_WAIT_MAX_SECONDS,
    );
    choosePinataFacing(true);
    updatePinataFacing(0);
    return;
  }

  startPinataMove(target, {
    duration: THREE.MathUtils.randFloat(
      PINATA_WANDER_DURATION_MIN_SECONDS,
      PINATA_WANDER_DURATION_MAX_SECONDS,
    ),
    lift: 0.12,
    lockHits: false,
    kind: 'wander',
  });
}

function movePinataAfterHit() {
  const target = getRandomArenaPosition({
    minDistance: PINATA_MIN_DISTANCE_METERS,
    maxDistance: PINATA_ARENA_RADIUS_METERS,
    avoidCurrent: true,
  });

  startPinataMove(target, {
    duration: PINATA_HIT_MOVE_DURATION_SECONDS,
    lift: 0.58,
    lockHits: true,
    kind: 'hit',
  });
}

function startPinataMove(target, { duration, lift, lockHits, kind }) {
  if (exploded) {
    return;
  }

  moveState.active = true;
  moveState.elapsed = 0;
  moveState.duration = duration;
  moveState.lift = lift;
  moveState.lockHits = lockHits;
  moveState.kind = kind;
  moveState.from.copy(pinataRoot.position);
  moveState.to.copy(target);
}

function getRandomArenaPosition({ minDistance, maxDistance, avoidCurrent }) {
  refreshCameraDirection();

  const forwardAngle = Math.atan2(tmpCameraDirection.z, tmpCameraDirection.x);
  const angleSpread = renderer.xr.isPresenting ? Math.PI * 2 : PINATA_FALLBACK_ARC_RADIANS;
  const minDistanceSq = minDistance * minDistance;
  const maxDistanceSq = maxDistance * maxDistance;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const angle = forwardAngle + THREE.MathUtils.randFloatSpread(angleSpread);
    const distance = Math.sqrt(THREE.MathUtils.randFloat(minDistanceSq, maxDistanceSq));
    tmpVector.set(
      arenaCenter.x + Math.cos(angle) * distance,
      arenaCenter.y,
      arenaCenter.z + Math.sin(angle) * distance,
    );

    if (!avoidCurrent || tmpVector.distanceTo(pinataRoot.position) > 0.9 || attempt === 11) {
      return tmpVector.clone();
    }
  }

  return arenaCenter.clone().add(new THREE.Vector3(0, 0, -PINATA_DISTANCE_METERS));
}

function refreshArenaCenter() {
  const viewCamera = getViewCamera();
  viewCamera.updateMatrixWorld(true);
  viewCamera.getWorldPosition(tmpCameraPosition);
  updateCameraDirection(viewCamera);

  arenaCenter.set(
    tmpCameraPosition.x,
    renderer.xr.isPresenting ? tmpCameraPosition.y - 0.12 : -0.08,
    tmpCameraPosition.z,
  );
}

function refreshCameraDirection() {
  const viewCamera = getViewCamera();
  viewCamera.updateMatrixWorld(true);
  updateCameraDirection(viewCamera);
}

function updateCameraDirection(viewCamera) {
  viewCamera.getWorldDirection(tmpCameraDirection);
  tmpCameraDirection.y = 0;

  if (tmpCameraDirection.lengthSq() < 0.0001) {
    tmpCameraDirection.set(0, 0, -1);
  } else {
    tmpCameraDirection.normalize();
  }
}

function choosePinataFacing(immediate = false) {
  facingState.targetYawOffset = THREE.MathUtils.randFloatSpread(
    PINATA_LOOK_CONE_HALF_ANGLE_RADIANS * 2,
  );

  facingState.targetSideTilt = Math.random() < 0.45
    ? THREE.MathUtils.randFloatSpread(PINATA_MAX_SIDE_TILT_RADIANS * 2)
    : 0;
  facingState.changeCountdown = THREE.MathUtils.randFloat(1.8, 3.4);

  if (immediate) {
    facingState.yawOffset = facingState.targetYawOffset;
    facingState.sideTilt = facingState.targetSideTilt;
  }
}

function updatePinataFacing(delta) {
  if (exploded || !pinataBody.visible) {
    return;
  }

  facingState.changeCountdown -= delta;
  if (facingState.changeCountdown <= 0) {
    choosePinataFacing();
  }

  facingState.yawOffset = THREE.MathUtils.damp(
    facingState.yawOffset,
    facingState.targetYawOffset,
    2.8,
    delta,
  );
  facingState.sideTilt = THREE.MathUtils.damp(
    facingState.sideTilt,
    facingState.targetSideTilt,
    3.2,
    delta,
  );

  const viewCamera = getViewCamera();
  viewCamera.getWorldPosition(tmpLookTarget);
  const cameraOffsetX = tmpLookTarget.x - pinataRoot.position.x;
  const cameraOffsetZ = tmpLookTarget.z - pinataRoot.position.z;
  const cameraBearing = Math.atan2(cameraOffsetX, cameraOffsetZ);
  const lookBearing = cameraBearing + facingState.yawOffset;

  tmpLookTarget.set(
    pinataRoot.position.x + Math.sin(lookBearing),
    pinataRoot.position.y,
    pinataRoot.position.z + Math.cos(lookBearing),
  );
  pinataRoot.lookAt(tmpLookTarget);
}

function getViewCamera() {
  if (!renderer.xr.isPresenting) {
    return camera;
  }

  const xrCamera = renderer.xr.getCamera(camera);
  if (xrCamera.isArrayCamera && xrCamera.cameras.length) {
    return xrCamera.cameras[0];
  }
  return xrCamera;
}

function render() {
  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  if (needsXRPlacement && renderer.xr.isPresenting) {
    placePinataInFrontOfCamera();
    arContent.visible = true;
    needsXRPlacement = false;
  }

  if (arExperienceActive && arContent.visible) {
    updatePinataMovement(delta);
    updatePinataFacing(delta);
    updatePinataAnimation(delta, elapsed);
    babyOctopus.update(delta, elapsed, getViewCamera());
    updateConfettiRain(delta);
    updateConfetti(delta);
  }
  renderer.render(scene, camera);
}

function updatePinataMovement(delta) {
  if (exploded || !pinataBody.visible) {
    return;
  }

  if (moveState.active) {
    moveState.elapsed += delta;
    const progress = Math.min(1, moveState.elapsed / moveState.duration);
    const eased = easeInOutCubic(progress);
    pinataRoot.position.lerpVectors(moveState.from, moveState.to, eased);
    pinataRoot.position.y += Math.sin(progress * Math.PI) * moveState.lift;

    if (progress >= 1) {
      pinataRoot.position.copy(moveState.to);
      moveState.active = false;
      moveState.lockHits = false;
      wanderCountdown = moveState.kind === 'hit'
        ? THREE.MathUtils.randFloat(
          PINATA_POST_HIT_WAIT_MIN_SECONDS,
          PINATA_POST_HIT_WAIT_MAX_SECONDS,
        )
        : THREE.MathUtils.randFloat(
          PINATA_WANDER_WAIT_MIN_SECONDS,
          PINATA_WANDER_WAIT_MAX_SECONDS,
        );
    }
    return;
  }

  wanderCountdown -= delta;
  if (wanderCountdown <= 0) {
    movePinataWithinArena(false);
  }
}

function easeInOutCubic(value) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function updatePinataAnimation(delta, elapsed) {
  if (!pinataBody.visible) {
    return;
  }

  const littleJump = Math.max(0, Math.sin(elapsed * 4.2)) * 0.055;
  pinataBody.position.y = littleJump;

  if (shakeTime > 0) {
    shakeTime = Math.max(0, shakeTime - delta);
    const strength = shakeTime / 0.42;
    pinataBody.rotation.z = Math.sin(elapsed * 42) * 0.17 * strength;
    pinataBody.rotation.x = Math.sin(elapsed * 31) * 0.08 * strength;
    pinataBody.rotation.y = Math.sin(elapsed * 28) * 0.08 * strength;
    pinataBody.scale.setScalar(1 + Math.sin(elapsed * 38) * 0.045 * strength);
  } else if (!exploded) {
    pinataBody.rotation.x *= 0.86;
    pinataBody.rotation.z = THREE.MathUtils.damp(
      pinataBody.rotation.z,
      facingState.sideTilt,
      6,
      delta,
    );
    pinataBody.rotation.y = Math.sin(elapsed * 2.2) * 0.04;
    pinataBody.scale.lerp(unitScale, 0.18);
  }

  if (explosionTime > 0) {
    explosionTime = Math.max(0, explosionTime - delta);
    const burst = explosionTime / 0.28;
    pinataBody.scale.setScalar(1 + (1 - burst) * 0.24);
  }
}

function setStatus(message) {
  statusEl.textContent = message;
  statusEl.classList.toggle('visible', Boolean(message));
}
