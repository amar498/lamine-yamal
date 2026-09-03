import * as THREE from "three";
import { Materials } from "./textures.js";
import {
  m, box, addCollider, pointLamp,
  createTree, createHedgeSegment, createFenceSegment, createGoal,
  createPoolLounger, createParasol, createPlantPot,
} from "./objects.js";

function rectsOverlap(a, b) {
  return !(a.x2 < b.x1 || a.x1 > b.x2 || a.z2 < b.z1 || a.z1 > b.z2);
}

function createWaterPlane(w, d, segX, segD, color) {
  const geo = new THREE.PlaneGeometry(w, d, segX, segD);
  const base = Float32Array.from(geo.attributes.position.array);
  const mat = Materials.water();
  if (color) mat.color.set(color);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = false;
  mesh.castShadow = false;
  mesh.userData.base = base;
  return mesh;
}

function animateWater(mesh, t) {
  const pos = mesh.geometry.attributes.position;
  const base = mesh.userData.base;
  for (let i = 0; i < pos.count; i++) {
    const x = base[i * 3], y = base[i * 3 + 1];
    const wave = Math.sin(x * 1.4 + t * 1.3) * 0.028 + Math.cos(y * 1.1 + t * 1.6) * 0.022;
    pos.setZ(i, wave);
  }
  pos.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
}

function createBubbles(count, radiusX, radiusZ, height, baseY) {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() * 2 - 1) * radiusX;
    positions[i * 3 + 1] = Math.random() * height;
    positions[i * 3 + 2] = (Math.random() * 2 - 1) * radiusZ;
    speeds[i] = 0.2 + Math.random() * 0.3;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.045, transparent: true, opacity: 0.75 });
  const points = new THREE.Points(geo, mat);
  points.position.y = baseY;
  points.userData = { speeds, height, radiusX, radiusZ };
  return points;
}

function updateBubbles(points, dt) {
  const pos = points.geometry.attributes.position;
  const { speeds, height } = points.userData;
  for (let i = 0; i < pos.count; i++) {
    let y = pos.getY(i) + speeds[i] * dt;
    if (y > height) y = 0;
    pos.setY(i, y);
  }
  pos.needsUpdate = true;
}

export function buildGrounds(world) {
  const grounds = new THREE.Group();
  world.scene.add(grounds);
  const animated = world.animated;
  const excluded = [];

  // ---------- Lawn ----------
  const lawn = m(new THREE.PlaneGeometry(140, 140), Materials.grass(), { rx: -Math.PI / 2, y: -0.01, castShadow: false });
  lawn.receiveShadow = true;
  grounds.add(lawn);

  // ---------- Entrance path (south, from gate to front door) ----------
  const pathMat = Materials.path();
  const path = m(new THREE.PlaneGeometry(2.4, 26), pathMat, { rx: -Math.PI / 2, y: 0.005, z: 19, castShadow: false });
  path.receiveShadow = true;
  grounds.add(path);
  excluded.push({ x1: -1.6, x2: 1.6, z1: 6, z2: 32 });

  // Low hedges framing the path
  for (let z = 8; z < 31; z += 3) {
    const hL = createHedgeSegment(2.6);
    hL.position.set(-2.4, 0, z);
    grounds.add(hL);
    addCollider(world, hL);
    const hR = createHedgeSegment(2.6);
    hR.position.set(2.4, 0, z);
    grounds.add(hR);
    addCollider(world, hR);
  }
  for (let z = 9; z < 30; z += 6) {
    grounds.add(shift(createPlantPot(0.7), -3.2, 0, z));
    grounds.add(shift(createPlantPot(0.7), 3.2, 0, z));
  }

  // Entrance gate posts
  const stoneMat = Materials.exteriorWall("#cdbfa0");
  for (const gx of [-1.9, 1.9]) {
    const post = box(0.4, 1.6, 0.4, stoneMat, { x: gx, y: 0.8, z: 32 });
    grounds.add(post);
    addCollider(world, post);
    grounds.add(pointLamp(0xffdca8, 4, 6, { x: gx, y: 1.7, z: 32 }));
  }

  // ---------- Pool + terrace (west of house) ----------
  const deckMat = Materials.deck();
  const deckX1 = -25.5, deckX2 = -9.4, deckZ1 = -7, deckZ2 = 10.5;
  const deck = m(new THREE.PlaneGeometry(deckX2 - deckX1, deckZ2 - deckZ1), deckMat, {
    x: (deckX1 + deckX2) / 2, y: 0.02, z: (deckZ1 + deckZ2) / 2, rx: -Math.PI / 2, castShadow: false,
  });
  deck.receiveShadow = true;
  grounds.add(deck);
  excluded.push({ x1: deckX1 - 1, x2: deckX2 + 1, z1: deckZ1 - 1, z2: deckZ2 + 1 });
  world.floorZones.push({ kind: "flat", x1: deckX1, x2: deckX2, z1: deckZ1, z2: deckZ2, y: 0, label: "Piscine & terrasse" });

  const poolX1 = -22.5, poolX2 = -14.5, poolZ1 = -3.5, poolZ2 = 4.5;
  const copingMat = Materials.marble();
  const copingH = 0.22, copingT = 0.35;
  const copingSpecs = [
    { w: poolX2 - poolX1 + copingT * 2, d: copingT, x: (poolX1 + poolX2) / 2, z: poolZ1 - copingT / 2 },
    { w: poolX2 - poolX1 + copingT * 2, d: copingT, x: (poolX1 + poolX2) / 2, z: poolZ2 + copingT / 2 },
    { w: copingT, d: poolZ2 - poolZ1, x: poolX1 - copingT / 2, z: (poolZ1 + poolZ2) / 2 },
    { w: copingT, d: poolZ2 - poolZ1, x: poolX2 + copingT / 2, z: (poolZ1 + poolZ2) / 2 },
  ];
  for (const s of copingSpecs) {
    const c = box(s.w, copingH, s.d, copingMat, { x: s.x, y: copingH / 2, z: s.z });
    grounds.add(c);
    addCollider(world, c);
  }
  const poolWater = createWaterPlane(poolX2 - poolX1, poolZ2 - poolZ1, 22, 14);
  poolWater.position.set((poolX1 + poolX2) / 2, -0.35, (poolZ1 + poolZ2) / 2);
  grounds.add(poolWater);
  animated.push({ update: (t) => animateWater(poolWater, t) });
  const poolFloor = m(new THREE.PlaneGeometry(poolX2 - poolX1, poolZ2 - poolZ1), Materials.tileFloor(), {
    x: (poolX1 + poolX2) / 2, y: -1.4, z: (poolZ1 + poolZ2) / 2, rx: -Math.PI / 2, castShadow: false,
  });
  grounds.add(poolFloor);

  for (const [lx, lz, ry] of [[-24, -5.5, 0], [-24, -3, 0], [-15.5, 8, Math.PI], [-13, 8, Math.PI]]) {
    grounds.add(shift(createPoolLounger(), lx, 0, lz, ry));
  }
  grounds.add(shift(createParasol(), -13.5, 0, 5));
  grounds.add(shift(createParasol(), -24.5, 0, -5.5));

  // Hot tub / jacuzzi on the terrace, near the pool
  const tubGroup = new THREE.Group();
  const tubWood = Materials.saunaWood();
  const tubW = 2.0, tubD = 2.0, tubH = 0.75;
  tubGroup.add(box(tubW, tubH, tubD, tubWood, { y: tubH / 2 }));
  const jacuzziWater = createWaterPlane(tubW - 0.2, tubD - 0.2, 10, 10, 0x3aa0c9);
  jacuzziWater.position.y = tubH - 0.08;
  tubGroup.add(jacuzziWater);
  animated.push({ update: (t) => animateWater(jacuzziWater, t) });
  const bubbles = createBubbles(140, tubW / 2 - 0.15, tubD / 2 - 0.15, 0.4, tubH - 0.05);
  tubGroup.add(bubbles);
  animated.push({ update: (t, dt) => updateBubbles(bubbles, dt) });
  tubGroup.add(pointLamp(0x66ccff, 3, 3, { x: 0, y: tubH + 0.3, z: 0 }));
  tubGroup.position.set(-11.5, 0, -5.2);
  grounds.add(tubGroup);
  addCollider(world, tubGroup);

  grounds.add(pointLamp(0xfff1d6, 6, 8, { x: -18.5, y: 3, z: -6 }));
  grounds.add(pointLamp(0xfff1d6, 6, 8, { x: -18.5, y: 3, z: 9 }));

  // ---------- Football field (east of house) ----------
  const fieldX1 = 11, fieldX2 = 43, fieldZ1 = -8, fieldZ2 = 8;
  excluded.push({ x1: fieldX1 - 1, x2: fieldX2 + 1, z1: fieldZ1 - 1, z2: fieldZ2 + 1 });
  world.floorZones.push({ kind: "flat", x1: fieldX1, x2: fieldX2, z1: fieldZ1, z2: fieldZ2, y: 0, label: "Terrain de foot" });
  const pitch = m(new THREE.PlaneGeometry(fieldX2 - fieldX1, fieldZ2 - fieldZ1), Materials.pitch(), {
    x: (fieldX1 + fieldX2) / 2, y: 0.01, z: (fieldZ1 + fieldZ2) / 2, rx: -Math.PI / 2, castShadow: false,
  });
  pitch.receiveShadow = true;
  grounds.add(pitch);
  grounds.add(shift(createGoal(5, 2, 1.4), fieldX1 + 0.6, 0, (fieldZ1 + fieldZ2) / 2, Math.PI / 2));
  grounds.add(shift(createGoal(5, 2, 1.4), fieldX2 - 0.6, 0, (fieldZ1 + fieldZ2) / 2, -Math.PI / 2));

  const ballTex = new THREE.CanvasTexture(makeBallCanvas());
  const ball = m(new THREE.SphereGeometry(0.22, 20, 20), new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.5 }), {
    x: (fieldX1 + fieldX2) / 2, y: 0.22, z: (fieldZ1 + fieldZ2) / 2,
  });
  grounds.add(ball);

  for (const bx of [fieldX1, fieldX2]) {
    for (const bz of [fieldZ1, fieldZ2]) {
      grounds.add(pointLamp(0xf5f8ff, 8, 14, { x: bx, y: 6, z: bz }));
      const pole = box(0.15, 6, 0.15, new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.6, roughness: 0.4 }), { x: bx, y: 3, z: bz });
      grounds.add(pole);
    }
  }

  // ---------- Perimeter fence ----------
  const fenceX1 = -29, fenceX2 = 47, fenceZ1 = -12, fenceZ2 = 33;
  buildFenceLine(world, grounds, fenceX1, fenceX2, fenceZ1, "x");
  buildFenceLine(world, grounds, fenceX1, fenceX2, fenceZ2, "x", [[-2.6, 2.6]]);
  buildFenceLine(world, grounds, fenceZ1, fenceZ2, fenceX1, "z");
  buildFenceLine(world, grounds, fenceZ1, fenceZ2, fenceX2, "z");

  // ---------- House exclusion + scattered trees ----------
  excluded.push({ x1: -10.5, x2: 10.5, z1: -7.5, z2: 7.5 });
  const rand = mulberry32(20260903);
  let placed = 0, attempts = 0;
  while (placed < 26 && attempts < 400) {
    attempts++;
    const x = fenceX1 + 3 + rand() * (fenceX2 - fenceX1 - 6);
    const z = fenceZ1 + 3 + rand() * (fenceZ2 - fenceZ1 - 6);
    const cand = { x1: x - 1.2, x2: x + 1.2, z1: z - 1.2, z2: z + 1.2 };
    if (excluded.some((e) => rectsOverlap(cand, e))) continue;
    const tree = createTree(0.9 + rand() * 0.6);
    tree.position.set(x, 0, z);
    grounds.add(tree);
    const trunkBox = new THREE.Box3(
      new THREE.Vector3(x - 0.25, 0, z - 0.25),
      new THREE.Vector3(x + 0.25, 2.2, z + 0.25)
    );
    world.colliders.push(trunkBox);
    placed++;
  }

  return grounds;
}

function shift(obj, x, y, z, ry = 0) {
  obj.position.set(x, y, z);
  obj.rotation.y = ry;
  return obj;
}

function buildFenceLine(world, group, a1, a2, fixed, axis, gaps = []) {
  const segLen = 3;
  let cursor = a1;
  while (cursor < a2) {
    let end = Math.min(cursor + segLen, a2);
    const gap = gaps.find((g) => cursor < g[1] && end > g[0]);
    if (gap) {
      if (cursor < gap[0]) end = gap[0];
      else {
        cursor = gap[1];
        continue;
      }
    }
    const len = end - cursor;
    if (len > 0.2) {
      const seg = createFenceSegment(len);
      if (axis === "x") seg.position.set(cursor + len / 2, 0, fixed);
      else {
        seg.rotation.y = Math.PI / 2;
        seg.position.set(fixed, 0, cursor + len / 2);
      }
      group.add(seg);
      addCollider(world, seg);
    }
    cursor = end;
  }
}

function makeBallCanvas() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#f4f4f0";
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = "#1a1a1a";
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    const x = Math.random() * 128, y = Math.random() * 128;
    ctx.moveTo(x, y);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      ctx.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14);
    }
    ctx.closePath();
    ctx.fill();
  }
  return c;
}

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
