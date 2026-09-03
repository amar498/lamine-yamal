import * as THREE from "three";
import { Materials, leafClusterTexture } from "./textures.js";

let _leafTexture = null;
function leafMaterial() {
  if (!_leafTexture) _leafTexture = leafClusterTexture();
  return new THREE.MeshStandardMaterial({ map: _leafTexture, roughness: 0.95 });
}

export function m(geo, mat, opt = {}) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(opt.x || 0, opt.y || 0, opt.z || 0);
  if (opt.rx) mesh.rotation.x = opt.rx;
  if (opt.ry) mesh.rotation.y = opt.ry;
  if (opt.rz) mesh.rotation.z = opt.rz;
  mesh.castShadow = opt.castShadow !== false;
  mesh.receiveShadow = opt.receiveShadow !== false;
  return mesh;
}

export function box(w, h, d, mat, opt) {
  return m(new THREE.BoxGeometry(w, h, d), mat, opt);
}

export function addCollider(world, obj) {
  obj.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(obj);
  world.colliders.push(b);
  return b;
}

export function addFloorZone(world, zone) {
  world.floorZones.push(zone);
}

/** Wall segment: axis-aligned box wall with optional collision + floor registration. */
export function wall(world, group, { w, h, d, x, y = 0, z, mat, collide = true, level = 0 }) {
  const wallMesh = box(w, h, d, mat, { x, y: y + h / 2, z });
  group.add(wallMesh);
  if (collide) {
    wallMesh.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(wallMesh);
    b.userData = { level };
    world.colliders.push(b);
  }
  return wallMesh;
}

export function pointLamp(color, intensity, distance, opt = {}) {
  const light = new THREE.PointLight(color, intensity, distance, 2);
  light.position.set(opt.x || 0, opt.y || 0, opt.z || 0);
  light.castShadow = !!opt.castShadow;
  if (light.castShadow) {
    light.shadow.mapSize.set(512, 512);
    light.shadow.bias = -0.003;
  }
  return light;
}

/* ---------------- Structural: stairs ---------------- */

export function buildStairs(world, group, { x, z, dirZ = 1, topY = 0, bottomY = -3.2, steps = 14, stepW = 1.6, mat }) {
  const run = Math.abs(topY - bottomY);
  const stepH = run / steps;
  const stepD = 0.32;
  for (let i = 0; i < steps; i++) {
    const y = topY - stepH * (i + 1);
    const zz = z + dirZ * (i * stepD + stepD / 2);
    const stepMesh = box(stepW, stepH, stepD, mat, { x, y: y + stepH / 2, z: zz });
    group.add(stepMesh);
  }
  // side stringers as handrails along the run
  const horizontalRun = steps * stepD;
  const railMatA = new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.4, metalness: 0.6 });
  for (const side of [-1, 1]) {
    const rail = box(0.06, 0.9, horizontalRun, railMatA, {
      x: x + side * (stepW / 2 + 0.03),
      y: (topY + bottomY) / 2 + 0.4,
      z: z + (dirZ * horizontalRun) / 2,
      castShadow: false,
    });
    group.add(rail);
  }
  return { stepH, stepD, run };
}

/* ---------------- Furniture ---------------- */

export function createSofa(color = 0x5b7a8c) {
  const g = new THREE.Group();
  const fab = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.7 });
  g.add(box(2.1, 0.45, 0.9, fab, { y: 0.28 }));
  g.add(box(2.1, 0.5, 0.22, fab, { y: 0.62, z: -0.34 }));
  g.add(box(0.22, 0.5, 0.9, fab, { x: -0.94, y: 0.55 }));
  g.add(box(0.22, 0.5, 0.9, fab, { x: 0.94, y: 0.55 }));
  for (const cx of [-0.55, 0, 0.55]) {
    g.add(box(0.55, 0.18, 0.8, fab, { x: cx, y: 0.55 }));
  }
  for (const [lx, lz] of [[-0.95, -0.4], [0.95, -0.4], [-0.95, 0.4], [0.95, 0.4]]) {
    g.add(box(0.08, 0.22, 0.08, wood, { x: lx, y: 0.1, z: lz }));
  }
  return g;
}

export function createArmchair(color = 0xb0714a) {
  const g = new THREE.Group();
  const fab = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
  g.add(box(0.85, 0.42, 0.85, fab, { y: 0.26 }));
  g.add(box(0.85, 0.55, 0.2, fab, { y: 0.58, z: -0.32 }));
  g.add(box(0.18, 0.45, 0.85, fab, { x: -0.42, y: 0.5 }));
  g.add(box(0.18, 0.45, 0.85, fab, { x: 0.42, y: 0.5 }));
  return g;
}

export function createCoffeeTable() {
  const g = new THREE.Group();
  const glassM = Materials.glass();
  const wood = new THREE.MeshStandardMaterial({ color: 0x2c1c10, roughness: 0.4, metalness: 0.2 });
  g.add(box(1.1, 0.04, 0.6, glassM, { y: 0.42 }));
  for (const [lx, lz] of [[-0.48, -0.24], [0.48, -0.24], [-0.48, 0.24], [0.48, 0.24]]) {
    g.add(box(0.06, 0.42, 0.06, wood, { x: lx, y: 0.21, z: lz }));
  }
  return g;
}

export function createTVUnit() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x241812, roughness: 0.55 });
  const screen = new THREE.MeshStandardMaterial({ color: 0x0b0e12, roughness: 0.3, metalness: 0.4, emissive: 0x1a2c3a, emissiveIntensity: 0.4 });
  g.add(box(1.6, 0.45, 0.4, wood, { y: 0.25 }));
  g.add(box(1.5, 0.85, 0.06, screen, { y: 1.1, z: -0.05 }));
  return g;
}

export function createDiningSet(seats = 6) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4327, roughness: 0.6 });
  const w = 2.0, d = 1.0;
  g.add(box(w, 0.06, d, wood, { y: 0.75 }));
  for (const [lx, lz] of [[-w / 2 + 0.1, -d / 2 + 0.1], [w / 2 - 0.1, -d / 2 + 0.1], [-w / 2 + 0.1, d / 2 - 0.1], [w / 2 - 0.1, d / 2 - 0.1]]) {
    g.add(box(0.07, 0.75, 0.07, wood, { x: lx, y: 0.375, z: lz }));
  }
  const chairPositions = [];
  const perSide = Math.max(1, Math.floor(seats / 2));
  for (let i = 0; i < perSide; i++) {
    const cx = -w / 2 + 0.35 + (i * (w - 0.7)) / Math.max(1, perSide - 1);
    chairPositions.push([cx, -d / 2 - 0.35, 0]);
    chairPositions.push([cx, d / 2 + 0.35, Math.PI]);
  }
  for (const [cx, cz, ry] of chairPositions) {
    g.add(createChair(wood, cx, cz, ry));
  }
  return g;
}

function createChair(wood, x, z, ry) {
  const g = new THREE.Group();
  g.add(box(0.42, 0.05, 0.42, wood, { y: 0.45 }));
  g.add(box(0.42, 0.5, 0.05, wood, { y: 0.7, z: -0.19 }));
  for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) {
    g.add(box(0.04, 0.45, 0.04, wood, { x: lx, y: 0.225, z: lz }));
  }
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  return g;
}

export function createBed(size = "double") {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x4a3222, roughness: 0.6 });
  const mattress = new THREE.MeshStandardMaterial({ color: 0xf4efe4, roughness: 0.9 });
  const blanket = new THREE.MeshStandardMaterial({ color: 0x8899b3, roughness: 0.95 });
  const pillow = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  const w = size === "double" ? 1.7 : 1.0;
  const l = 2.05;
  g.add(box(w, 0.32, l, wood, { y: 0.18 }));
  g.add(box(w - 0.06, 0.2, l - 0.06, mattress, { y: 0.44 }));
  g.add(box(w - 0.06, 0.14, l * 0.55, blanket, { y: 0.58, z: l * 0.18 }));
  g.add(box(w, 0.7, 0.1, wood, { y: 0.55, z: -l / 2 }));
  for (const px of w === 1.7 ? [-w / 4, w / 4] : [0]) {
    g.add(box(0.4, 0.14, 0.28, pillow, { x: px, y: 0.58, z: -l / 2 + 0.28 }));
  }
  return g;
}

export function createWardrobe() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x3b2717, roughness: 0.55 });
  const knob = new THREE.MeshStandardMaterial({ color: 0xc9a84a, metalness: 0.7, roughness: 0.3 });
  g.add(box(1.4, 2.0, 0.6, wood, { y: 1.0 }));
  g.add(box(0.02, 0.06, 0.02, knob, { x: -0.15, y: 1.0, z: 0.31 }));
  g.add(box(0.02, 0.06, 0.02, knob, { x: 0.15, y: 1.0, z: 0.31 }));
  return g;
}

export function createKitchenSet() {
  const g = new THREE.Group();
  const cab = new THREE.MeshStandardMaterial({ color: 0x2f3a3d, roughness: 0.5 });
  const counter = Materials.marble();
  const steel = new THREE.MeshStandardMaterial({ color: 0xcfd6da, metalness: 0.8, roughness: 0.25 });
  const black = new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.4 });

  const run = new THREE.Group();
  run.add(box(3.2, 0.85, 0.6, cab, { y: 0.425 }));
  run.add(box(3.3, 0.06, 0.65, counter, { y: 0.88 }));
  run.add(box(0.6, 0.05, 0.5, black, { x: -0.9, y: 0.92 }));
  for (let i = 0; i < 3; i++) run.add(box(0.14, 0.02, 0.02, steel, { x: -1.35 + i * 0.9, y: 0.7, z: 0.31 }));
  g.add(run);

  const island = new THREE.Group();
  island.add(box(1.6, 0.85, 0.9, cab, { y: 0.425 }));
  island.add(box(1.7, 0.06, 1.0, counter, { y: 0.88 }));
  island.position.set(0, 0, 1.6);
  g.add(island);

  const fridge = box(0.9, 1.9, 0.7, steel, { x: -1.75, y: 0.95, z: -0.05 });
  g.add(fridge);

  const hood = box(0.7, 0.35, 0.5, steel, { x: -0.9, y: 1.55 });
  g.add(hood);

  return g;
}

export function createBathroomSet() {
  const g = new THREE.Group();
  const ceramic = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd9dee1, metalness: 0.9, roughness: 0.15 });
  const glassM = Materials.glass();

  const tub = new THREE.Group();
  tub.add(box(1.7, 0.55, 0.75, ceramic, { y: 0.275 }));
  tub.add(box(1.5, 0.4, 0.55, new THREE.MeshStandardMaterial({ color: 0xdff2f6, transparent: true, opacity: 0.85, roughness: 0.1 }), { y: 0.45 }));
  g.add(tub);

  const vanity = new THREE.Group();
  vanity.add(box(1.1, 0.75, 0.55, Materials.marble(), { y: 0.375 }));
  const basin = m(new THREE.CylinderGeometry(0.24, 0.2, 0.15, 20), ceramic, { y: 0.82 });
  vanity.add(basin);
  const mirror = box(0.8, 0.9, 0.03, new THREE.MeshStandardMaterial({ color: 0xdfeef2, metalness: 0.6, roughness: 0.05 }), { y: 1.6, z: -0.25 });
  vanity.add(mirror);
  vanity.position.set(0, 0, 1.3);
  g.add(vanity);

  const toilet = new THREE.Group();
  toilet.add(m(new THREE.CylinderGeometry(0.22, 0.24, 0.4, 16), ceramic, { y: 0.2 }));
  toilet.add(box(0.4, 0.12, 0.45, ceramic, { y: 0.42 }));
  toilet.add(box(0.36, 0.4, 0.14, ceramic, { y: 0.62, z: -0.18 }));
  toilet.position.set(1.1, 0, -0.6);
  g.add(toilet);

  return g;
}

export function createBookshelf() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x40291a, roughness: 0.6 });
  g.add(box(1.2, 2.0, 0.35, wood, { y: 1.0 }));
  const bookColors = [0xb33, 0x3a6, 0x36a, 0xa93, 0x963, 0x699];
  for (let shelf = 0; shelf < 4; shelf++) {
    let x = -0.5;
    while (x < 0.5) {
      const w = 0.05 + Math.random() * 0.05;
      const h = 0.22 + Math.random() * 0.08;
      const c = bookColors[Math.floor(Math.random() * bookColors.length)];
      g.add(box(w, h, 0.25, new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }), { x: x + w / 2, y: 0.25 + shelf * 0.45 + h / 2, z: 0.02 }));
      x += w + 0.01;
    }
  }
  return g;
}

export function createRug(w, d, color = 0xaa5544) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 1 });
  return m(new THREE.PlaneGeometry(w, d), mat, { rx: -Math.PI / 2, y: 0.015, castShadow: false });
}

export function createFloorLamp() {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.6, roughness: 0.4 });
  const shade = new THREE.MeshStandardMaterial({ color: 0xf3e3c0, emissive: 0xf3e3c0, emissiveIntensity: 0.6, roughness: 0.7 });
  g.add(m(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 8), metal, { y: 0.7, castShadow: false }));
  g.add(m(new THREE.CylinderGeometry(0.2, 0.16, 0.3, 12, 1, true), shade, { y: 1.45, castShadow: false }));
  const light = pointLamp(0xffd9a0, 8, 6, { x: 0, y: 1.45, z: 0 });
  g.add(light);
  return g;
}

export function createPlantPot(scale = 1) {
  const g = new THREE.Group();
  const pot = new THREE.MeshStandardMaterial({ color: 0x7a4a33, roughness: 0.8 });
  const leaf = new THREE.MeshStandardMaterial({ color: 0x2f6b34, roughness: 0.85 });
  g.add(m(new THREE.CylinderGeometry(0.22, 0.18, 0.3, 12), pot, { y: 0.15 }));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.add(m(new THREE.ConeGeometry(0.08, 0.6, 6), leaf, {
      x: Math.cos(a) * 0.08, z: Math.sin(a) * 0.08, y: 0.6, ry: a,
    }));
  }
  g.scale.setScalar(scale);
  return g;
}

/* ---------------- Outdoor ---------------- */

export function createTree(scale = 1) {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4126, roughness: 0.92 });
  const h = 2.4 + Math.random() * 1.4;

  const trunk = m(new THREE.CylinderGeometry(0.1, 0.2, h, 7), trunkMat, { y: h / 2 });
  trunk.rotation.z = (Math.random() - 0.5) * 0.1;
  g.add(trunk);

  // A couple of angled branch stubs break up the silhouette under the canopy.
  for (let i = 0; i < 2; i++) {
    const bl = 0.5 + Math.random() * 0.4;
    const branch = m(new THREE.CylinderGeometry(0.035, 0.07, bl, 6), trunkMat, {
      y: h * 0.55 + i * 0.35, ry: Math.random() * Math.PI * 2,
    });
    branch.rotation.z = (Math.random() > 0.5 ? 1 : -1) * (0.8 + Math.random() * 0.35);
    branch.translateY(bl / 2);
    g.add(branch);
  }

  const leafMat = leafMaterial();
  const clumps = 6 + Math.floor(Math.random() * 3);
  for (let i = 0; i < clumps; i++) {
    const s = 0.7 + Math.random() * 0.55;
    const foliage = m(new THREE.IcosahedronGeometry(s, 1), leafMat, {
      x: (Math.random() - 0.5) * 1.15,
      z: (Math.random() - 0.5) * 1.15,
      y: h + Math.random() * 1.3 - 0.15,
      ry: Math.random() * Math.PI,
    });
    foliage.scale.set(1 + Math.random() * 0.3, 0.72 + Math.random() * 0.3, 1 + Math.random() * 0.3);
    g.add(foliage);
  }

  g.scale.setScalar(scale);
  g.rotation.y = Math.random() * Math.PI * 2;
  return g;
}

export function createHedgeSegment(length) {
  const mat = new THREE.MeshStandardMaterial({ map: leafMaterial().map, color: 0x3a7a38, roughness: 1 });
  const g = new THREE.Group();
  g.add(box(length, 0.62, 0.42, mat, { y: 0.31 }));
  // Slightly irregular top so the hedge doesn't read as a single flat-shaded box.
  const bumps = Math.max(2, Math.round(length / 0.6));
  for (let i = 0; i < bumps; i++) {
    const bw = length / bumps;
    g.add(box(bw * 0.85, 0.14, 0.38, mat, {
      x: -length / 2 + bw * (i + 0.5), y: 0.62 + Math.random() * 0.05,
    }));
  }
  return g;
}

export function createFenceSegment(length) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.6 });
  g.add(box(length, 0.06, 0.06, mat, { y: 0.5 }));
  g.add(box(length, 0.06, 0.06, mat, { y: 0.9 }));
  const posts = Math.max(2, Math.round(length / 1.2));
  for (let i = 0; i <= posts; i++) {
    g.add(box(0.08, 1.0, 0.08, mat, { x: -length / 2 + (i * length) / posts, y: 0.5 }));
  }
  return g;
}

export function createGoal(width = 5, height = 2, depth = 1.4) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
  const r = 0.06;
  g.add(m(new THREE.CylinderGeometry(r, r, height, 10), mat, { x: -width / 2, y: height / 2 }));
  g.add(m(new THREE.CylinderGeometry(r, r, height, 10), mat, { x: width / 2, y: height / 2 }));
  g.add(m(new THREE.CylinderGeometry(r, r, width, 10), mat, { y: height, rz: Math.PI / 2 }));
  const netMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.5 });
  const net = m(new THREE.BoxGeometry(width, height, depth), netMat, { y: height / 2, z: depth / 2, castShadow: false, receiveShadow: false });
  g.add(net);
  return g;
}

export function createPoolLounger(color = 0x3a4a5c) {
  const g = new THREE.Group();
  const frame = new THREE.MeshStandardMaterial({ color: 0xe8e6df, roughness: 0.6 });
  const fab = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
  g.add(box(0.6, 0.06, 1.9, frame, { y: 0.3 }));
  g.add(box(0.55, 0.05, 1.7, fab, { y: 0.34 }));
  g.add(box(0.55, 0.05, 0.7, fab, { y: 0.55, z: -0.75, rx: -0.5 }));
  for (const [lx, lz] of [[-0.28, -0.85], [0.28, -0.85], [-0.28, 0.85], [0.28, 0.85]]) {
    g.add(box(0.05, 0.3, 0.05, frame, { x: lx, y: 0.15, z: lz }));
  }
  return g;
}

export function createParasol() {
  const g = new THREE.Group();
  const pole = new THREE.MeshStandardMaterial({ color: 0xdedad0, metalness: 0.3, roughness: 0.5 });
  const canopy = new THREE.MeshStandardMaterial({ color: 0xd9622f, roughness: 0.8, side: THREE.DoubleSide });
  g.add(m(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 8), pole, { y: 1.2 }));
  g.add(m(new THREE.ConeGeometry(1.1, 0.5, 12), canopy, { y: 2.5 }));
  return g;
}

export function createSaunaStove() {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, metalness: 0.5, roughness: 0.5 });
  const rocks = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.95, emissive: 0xff5522, emissiveIntensity: 0.25 });
  g.add(box(0.5, 0.6, 0.5, body, { y: 0.3 }));
  for (let i = 0; i < 10; i++) {
    g.add(m(new THREE.DodecahedronGeometry(0.06, 0), rocks, {
      x: (Math.random() - 0.5) * 0.35, z: (Math.random() - 0.5) * 0.35, y: 0.6 + Math.random() * 0.08,
    }));
  }
  const glow = pointLamp(0xff6a2f, 3, 4, { x: 0, y: 0.5, z: 0 });
  g.add(glow);
  return g;
}

export function createSaunaBench() {
  const wood = new THREE.MeshStandardMaterial({ color: 0xd8ad72, roughness: 0.8 });
  const g = new THREE.Group();
  g.add(box(1.8, 0.08, 0.55, wood, { y: 0.45 }));
  g.add(box(1.8, 0.08, 0.5, wood, { y: 0.85, z: -0.24, rx: -0.15 }));
  for (const lx of [-0.8, 0.8]) {
    g.add(box(0.06, 0.45, 0.06, wood, { x: lx, y: 0.225, z: -0.2 }));
    g.add(box(0.06, 0.45, 0.06, wood, { x: lx, y: 0.225, z: 0.2 }));
  }
  return g;
}
