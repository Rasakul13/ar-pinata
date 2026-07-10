import * as THREE from 'three';

const OCTOPUS_BASE_Y = -0.36;
const OCTOPUS_MODEL_SCALE = 0.82;
const REVEAL_DURATION_SECONDS = 1.15;
const TENTACLE_COUNT = 8;
const OCTOPUS_THEMES = Object.freeze({
  blue: {
    body: 0x8fcff5,
    bodyLight: 0xbfe8ff,
    tentacle: 0x79bfe9,
    sucker: 0xf0c2dc,
    blush: 0xf3b5c7,
  },
  pink: {
    body: 0xf6b6cf,
    bodyLight: 0xffdce8,
    tentacle: 0xe99abb,
    sucker: 0xffedf3,
    blush: 0xdc739d,
  },
});

/**
 * Builds a lightweight, original baby octopus from Three.js primitives.
 * The returned controller owns its reveal and idle animation state.
 */
export function createBabyOctopus(initialTheme = 'blue') {
  const root = new THREE.Group();
  root.name = 'baby-octopus';
  root.visible = false;

  const entrance = new THREE.Group();
  root.add(entrance);

  const octopus = new THREE.Group();
  octopus.scale.setScalar(OCTOPUS_MODEL_SCALE);
  entrance.add(octopus);

  const headPivot = new THREE.Group();
  octopus.add(headPivot);

  const viewerPosition = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  const tentaclePivots = [];

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: OCTOPUS_THEMES.blue.body,
    roughness: 0.7,
    metalness: 0,
  });
  const bodyLightMaterial = new THREE.MeshStandardMaterial({
    color: OCTOPUS_THEMES.blue.bodyLight,
    roughness: 0.74,
    metalness: 0,
  });
  const tentacleMaterial = new THREE.MeshStandardMaterial({
    color: OCTOPUS_THEMES.blue.tentacle,
    roughness: 0.76,
    metalness: 0,
  });
  const suckerMaterial = new THREE.MeshStandardMaterial({
    color: OCTOPUS_THEMES.blue.sucker,
    roughness: 0.8,
    metalness: 0,
  });
  const blushMaterial = new THREE.MeshStandardMaterial({
    color: OCTOPUS_THEMES.blue.blush,
    roughness: 0.82,
    metalness: 0,
  });
  const eyeMaterial = new THREE.MeshStandardMaterial({
    color: 0x142a38,
    roughness: 0.42,
    metalness: 0,
  });
  const eyeGlintMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

  setTheme(initialTheme);

  const bodyGeometry = new THREE.SphereGeometry(1, 22, 16);
  const detailGeometry = new THREE.SphereGeometry(1, 14, 10);

  addEllipsoid(headPivot, bodyGeometry, bodyMaterial, [0, 0.29, 0], [0.25, 0.29, 0.23]);
  addEllipsoid(headPivot, detailGeometry, bodyLightMaterial, [0, 0.48, 0.055], [0.13, 0.095, 0.17]);

  for (const x of [-0.085, 0.085]) {
    addEllipsoid(headPivot, detailGeometry, eyeMaterial, [x, 0.325, 0.213], [0.036, 0.052, 0.025]);
    addEllipsoid(
      headPivot,
      detailGeometry,
      eyeGlintMaterial,
      [x - 0.011, 0.344, 0.237],
      [0.01, 0.014, 0.007],
    );
  }

  addEllipsoid(headPivot, detailGeometry, blushMaterial, [-0.145, 0.245, 0.198], [0.047, 0.027, 0.013]);
  addEllipsoid(headPivot, detailGeometry, blushMaterial, [0.145, 0.245, 0.198], [0.047, 0.027, 0.013]);

  const smileCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-0.065, 0.235, 0.225),
    new THREE.Vector3(0, 0.19, 0.245),
    new THREE.Vector3(0.065, 0.235, 0.225),
  );
  headPivot.add(new THREE.Mesh(new THREE.TubeGeometry(smileCurve, 10, 0.009, 5, false), eyeMaterial));

  for (let i = 0; i < TENTACLE_COUNT; i += 1) {
    const angle = (i / TENTACLE_COUNT) * Math.PI * 2;
    const length = 0.29 + (i % 2) * 0.035;
    const curlDirection = i % 2 === 0 ? 1 : -1;
    const tentaclePivot = new THREE.Group();
    tentaclePivot.rotation.y = angle;
    tentaclePivot.userData.restRotationY = angle;
    tentaclePivot.userData.phase = i * 0.73;

    const tentacleCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.15, 0.035),
      new THREE.Vector3(0, 0.075, 0.13),
      new THREE.Vector3(curlDirection * 0.024, 0.025, length * 0.72),
      new THREE.Vector3(curlDirection * 0.055, 0.045, length),
    ]);
    const tentacle = new THREE.Mesh(
      new THREE.TubeGeometry(tentacleCurve, 15, 0.029, 7, false),
      tentacleMaterial,
    );
    tentaclePivot.add(tentacle);
    addEllipsoid(
      tentaclePivot,
      detailGeometry,
      suckerMaterial,
      [curlDirection * 0.055, 0.047, length + 0.002],
      [0.033, 0.021, 0.04],
    );
    octopus.add(tentaclePivot);
    tentaclePivots.push(tentaclePivot);
  }

  octopus.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = false;
      node.receiveShadow = false;
      node.frustumCulled = false;
    }
  });

  let active = false;
  let revealTime = 0;

  reset();

  function reveal(worldPosition, viewCamera) {
    active = true;
    revealTime = 0;
    root.position.copy(worldPosition);
    root.visible = true;
    entrance.position.set(0, OCTOPUS_BASE_Y - 0.18, 0);
    entrance.rotation.set(0, -0.3, -0.07);
    entrance.scale.setScalar(0.001);
    faceViewer(viewCamera);
  }

  function reset() {
    active = false;
    revealTime = 0;
    root.visible = false;
    entrance.position.set(0, OCTOPUS_BASE_Y, 0);
    entrance.rotation.set(0, 0, 0);
    entrance.scale.setScalar(1);
    octopus.position.set(0, 0, 0);
    octopus.rotation.set(0, 0, 0);
    headPivot.rotation.set(0, 0, 0);

    tentaclePivots.forEach((tentaclePivot) => {
      tentaclePivot.rotation.set(0, tentaclePivot.userData.restRotationY, 0);
    });
  }

  function update(delta, elapsed, viewCamera) {
    if (!active || !root.visible) {
      return;
    }

    faceViewer(viewCamera);

    if (revealTime < REVEAL_DURATION_SECONDS) {
      revealTime = Math.min(REVEAL_DURATION_SECONDS, revealTime + delta);
      const progress = revealTime / REVEAL_DURATION_SECONDS;
      const eased = easeOutBack(progress);
      entrance.scale.setScalar(Math.max(0.001, eased));
      entrance.position.y = THREE.MathUtils.lerp(
        OCTOPUS_BASE_Y - 0.18,
        OCTOPUS_BASE_Y,
        easeOutCubic(progress),
      );
      entrance.rotation.y = THREE.MathUtils.lerp(-0.3, 0, easeOutCubic(progress));
      entrance.rotation.z = THREE.MathUtils.lerp(-0.07, 0, easeOutCubic(progress));
    }

    const idleStrength = Math.min(1, revealTime / REVEAL_DURATION_SECONDS);
    octopus.position.y = Math.sin(elapsed * 2.1) * 0.016 * idleStrength;
    octopus.rotation.y = Math.sin(elapsed * 0.85) * 0.04 * idleStrength;
    headPivot.rotation.z = Math.sin(elapsed * 1.5) * 0.025 * idleStrength;

    tentaclePivots.forEach((tentaclePivot) => {
      const phase = tentaclePivot.userData.phase;
      tentaclePivot.rotation.x = Math.sin(elapsed * 1.8 + phase) * 0.075 * idleStrength;
      tentaclePivot.rotation.y = tentaclePivot.userData.restRotationY
        + Math.sin(elapsed * 1.25 + phase) * 0.055 * idleStrength;
      tentaclePivot.rotation.z = Math.cos(elapsed * 1.55 + phase) * 0.045 * idleStrength;
    });
  }

  return { root, reveal, reset, setTheme, update };

  function setTheme(themeName) {
    const theme = OCTOPUS_THEMES[themeName] ?? OCTOPUS_THEMES.blue;
    bodyMaterial.color.setHex(theme.body);
    bodyLightMaterial.color.setHex(theme.bodyLight);
    tentacleMaterial.color.setHex(theme.tentacle);
    suckerMaterial.color.setHex(theme.sucker);
    blushMaterial.color.setHex(theme.blush);
  }

  function faceViewer(viewCamera) {
    if (!viewCamera) {
      return;
    }

    viewCamera.getWorldPosition(viewerPosition);
    lookTarget.set(viewerPosition.x, root.position.y, viewerPosition.z);
    if (lookTarget.distanceToSquared(root.position) > 0.0001) {
      root.lookAt(lookTarget);
    }
  }
}

function addEllipsoid(parent, geometry, material, position, scale) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  parent.add(mesh);
  return mesh;
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

function easeOutBack(value) {
  const overshoot = 1.18;
  return 1 + (overshoot + 1) * Math.pow(value - 1, 3) + overshoot * Math.pow(value - 1, 2);
}
