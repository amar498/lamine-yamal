import * as THREE from "three";
import { Sky } from "three/addons/objects/Sky.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { waterNormalsTexture } from "./textures.js";
import { buildHouse } from "./house.js";
import { buildGrounds } from "./grounds.js";
import { FirstPersonController } from "./player.js";

const loadingScreen = document.getElementById("loading-screen");
const progressBar = document.getElementById("progress-bar");
const loadingText = document.getElementById("loading-text");
const menuScreen = document.getElementById("menu-screen");
const pauseScreen = document.getElementById("pause-screen");
const hud = document.getElementById("hud");
const startBtn = document.getElementById("start-btn");
const resumeBtn = document.getElementById("resume-btn");
const zoneLabel = document.getElementById("zone-label");
const compassNeedle = document.getElementById("compass-needle");
const fpsEl = document.getElementById("fps");
const minimapWrap = document.getElementById("minimap-wrap");
const minimapCanvas = document.getElementById("minimap");
const minimapDot = document.getElementById("minimap-dot");

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 400);

const world = { scene, colliders: [], floorZones: [], animated: [], spawnPoint: new THREE.Vector3(0, 1.7, 26) };

function setProgress(pct, text) {
  progressBar.style.width = `${pct}%`;
  if (text) loadingText.textContent = text;
}

function setupSkyAndLights() {
  const sky = new Sky();
  sky.scale.setScalar(450);
  scene.add(sky);

  // Sun direction: mid-morning, coming from the south-east over the garden.
  const sunDir = new THREE.Vector3();
  const elevation = 32, azimuth = 150;
  const phi = THREE.MathUtils.degToRad(90 - elevation);
  const theta = THREE.MathUtils.degToRad(azimuth);
  sunDir.setFromSphericalCoords(1, phi, theta);
  world.sunDirection = sunDir;
  world.waterNormals = waterNormalsTexture(256);
  world.waterNormals.wrapS = world.waterNormals.wrapT = THREE.RepeatWrapping;

  const skyUniforms = sky.material.uniforms;
  skyUniforms.turbidity.value = 3.4;
  skyUniforms.rayleigh.value = 1.7;
  skyUniforms.mieCoefficient.value = 0.006;
  skyUniforms.mieDirectionalG.value = 0.82;
  skyUniforms.sunPosition.value.copy(sunDir);

  scene.fog = new THREE.Fog(0xcfe0ea, 40, 180);

  const sun = new THREE.DirectionalLight(0xfff2d9, 1.4);
  sun.position.copy(sunDir).multiplyScalar(80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -45;
  sun.shadow.camera.right = 45;
  sun.shadow.camera.top = 40;
  sun.shadow.camera.bottom = -30;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 160;
  sun.shadow.bias = -0.0015;
  scene.add(sun);
  scene.add(sun.target);

  const hemi = new THREE.HemisphereLight(0xaed4f5, 0x4c7a3a, 0.55);
  scene.add(hemi);
  const fill = new THREE.AmbientLight(0xffffff, 0.18);
  scene.add(fill);

  // Note: deliberately not using scene.environment (a PMREM sky env map) here —
  // three.js applies it globally with no occlusion, so it lit interior rooms
  // as brightly as the open sky and blew out the whole scene. The Sky dome
  // plus the sun/hemisphere/point lights above give a realistic look without
  // that problem.
}

function drawMinimap() {
  const ctx = minimapCanvas.getContext("2d");
  const W = minimapCanvas.width, H = minimapCanvas.height;
  const worldMinX = -30, worldMaxX = 48, worldMinZ = -13, worldMaxZ = 34;
  const scaleX = W / (worldMaxX - worldMinX);
  const scaleZ = H / (worldMaxZ - worldMinZ);
  const scl = Math.min(scaleX, scaleZ);
  const toPx = (x, z) => [
    W / 2 + (x - (worldMinX + worldMaxX) / 2) * scl,
    H / 2 + (z - (worldMinZ + worldMaxZ) / 2) * scl,
  ];

  ctx.fillStyle = "#20401f";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#8fae63";
  rectPx(ctx, toPx(-1.6, 6), toPx(1.6, 32));

  ctx.fillStyle = "#c8bfa0";
  rectPx(ctx, toPx(-9, -6), toPx(9, 6));

  ctx.fillStyle = "#2a8fc4";
  rectPx(ctx, toPx(-22.5, -3.5), toPx(-14.5, 4.5));

  ctx.fillStyle = "#3a8f36";
  rectPx(ctx, toPx(11, -8), toPx(43, 8));
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 1;
  const p1 = toPx(11, -8), p2 = toPx(43, 8);
  ctx.strokeRect(Math.min(p1[0], p2[0]), Math.min(p1[1], p2[1]), Math.abs(p2[0] - p1[0]), Math.abs(p2[1] - p1[1]));

  ctx.fillStyle = "#e8b23a";
  const [gx, gy] = toPx(0, 32);
  ctx.beginPath();
  ctx.arc(gx, gy, 3, 0, Math.PI * 2);
  ctx.fill();
}

function rectPx(ctx, a, b) {
  ctx.fillRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
}

async function boot() {
  const steps = [
    { pct: 12, text: "Préparation du ciel et des lumières…", fn: setupSkyAndLights },
    { pct: 55, text: "Construction de la villa, du sous-sol et du sauna…", fn: () => buildHouse(world) },
    { pct: 90, text: "Aménagement du jardin, de la piscine et du terrain de foot…", fn: () => buildGrounds(world) },
    { pct: 100, text: "Dernière touche…", fn: () => drawMinimap() },
  ];

  for (const step of steps) {
    setProgress(step.pct, step.text);
    await new Promise((r) => setTimeout(r, 30));
    step.fn();
  }

  const controller = new FirstPersonController(camera, renderer.domElement, world);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.32, 0.5, 0.86);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  window.__scene = { camera, controller, world, scene, renderer, composer };

  loadingScreen.classList.add("hidden");
  menuScreen.classList.remove("hidden");

  let started = false;

  startBtn.addEventListener("click", () => controller.controls.lock());
  resumeBtn.addEventListener("click", () => controller.controls.lock());

  controller.controls.addEventListener("lock", () => {
    started = true;
    menuScreen.classList.add("hidden");
    pauseScreen.classList.add("hidden");
    hud.classList.remove("hidden");
  });
  controller.controls.addEventListener("unlock", () => {
    hud.classList.add("hidden");
    if (started) pauseScreen.classList.remove("hidden");
  });

  window.addEventListener("toggle-map", () => minimapWrap.classList.toggle("expanded"));

  let lastLabel = "";
  const clock = new THREE.Clock();
  let fpsAccum = 0, fpsFrames = 0, fpsTimer = 0;
  const worldMinX = -30, worldMaxX = 48, worldMinZ = -13, worldMaxZ = 34;

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(0.05, clock.getDelta());
    const t = clock.elapsedTime;

    if (controller.controls.isLocked) controller.update(dt);

    for (const item of world.animated) item.update(t, dt);

    if (controller.currentLabel !== lastLabel) {
      lastLabel = controller.currentLabel;
      if (lastLabel) {
        zoneLabel.textContent = lastLabel;
        zoneLabel.classList.add("show");
      } else {
        zoneLabel.classList.remove("show");
      }
    }

    const yaw = THREE.MathUtils.radToDeg(camera.rotation.y);
    const normYaw = ((yaw % 360) + 360) % 360;
    compassNeedle.style.left = `${(normYaw / 360) * 100}%`;

    const px = THREE.MathUtils.clamp((camera.position.x - worldMinX) / (worldMaxX - worldMinX), 0, 1);
    const pz = THREE.MathUtils.clamp((camera.position.z - worldMinZ) / (worldMaxZ - worldMinZ), 0, 1);
    minimapDot.style.left = `${px * 100}%`;
    minimapDot.style.top = `${pz * 100}%`;

    fpsAccum += dt;
    fpsFrames++;
    fpsTimer += dt;
    if (fpsTimer > 0.5) {
      fpsEl.textContent = `FPS: ${Math.round(fpsFrames / fpsAccum)}`;
      fpsAccum = 0;
      fpsFrames = 0;
      fpsTimer = 0;
    }

    composer.render();
  }
  animate();

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    bloom.setSize(window.innerWidth, window.innerHeight);
  });
}

boot();
