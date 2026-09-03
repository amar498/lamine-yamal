import * as THREE from "three";
import { Materials } from "./textures.js";
import {
  m, box, wall, buildStairs, pointLamp, addCollider,
  createSofa, createArmchair, createCoffeeTable, createTVUnit, createDiningSet,
  createBed, createWardrobe, createKitchenSet, createBathroomSet, createBookshelf,
  createRug, createFloorLamp, createPlantPot, createSaunaStove, createSaunaBench,
} from "./objects.js";

const GROUND_H = 3.0;
const BASEMENT_Y = -3.2;
const BASEMENT_H = 2.6;

function place(group, obj, x, y, z, ry = 0) {
  obj.position.set(x, y, z);
  obj.rotation.y = ry;
  group.add(obj);
  return obj;
}

/** Build a wall along X (running east-west) at fixed z, with door gaps (array of [x1,x2]). */
function wallAlongX(world, group, { z, y = 0, h, thickness, x1, x2, gaps = [], mat, level = 0, collide = true }) {
  const segs = [];
  let cursor = x1;
  const sorted = [...gaps].sort((a, b) => a[0] - b[0]);
  for (const [g1, g2] of sorted) {
    if (g1 > cursor) segs.push([cursor, g1]);
    cursor = Math.max(cursor, g2);
  }
  if (cursor < x2) segs.push([cursor, x2]);
  for (const [s1, s2] of segs) {
    const w = s2 - s1;
    if (w <= 0.01) continue;
    wall(world, group, { w, h, d: thickness, x: (s1 + s2) / 2, y, z, mat, level, collide });
  }
}

/** Build a wall along Z (running north-south) at fixed x, with door gaps (array of [z1,z2]). */
function wallAlongZ(world, group, { x, y = 0, h, thickness, z1, z2, gaps = [], mat, level = 0, collide = true }) {
  const segs = [];
  let cursor = z1;
  const sorted = [...gaps].sort((a, b) => a[0] - b[0]);
  for (const [g1, g2] of sorted) {
    if (g1 > cursor) segs.push([cursor, g1]);
    cursor = Math.max(cursor, g2);
  }
  if (cursor < z2) segs.push([cursor, z2]);
  for (const [s1, s2] of segs) {
    const d = s2 - s1;
    if (d <= 0.01) continue;
    wall(world, group, { w: thickness, h, d, x, y, z: (s1 + s2) / 2, mat, level, collide });
  }
}

const FRAME_MAT = new THREE.MeshStandardMaterial({ color: 0x2b2620, roughness: 0.45, metalness: 0.35 });
const DOOR_MAT = new THREE.MeshStandardMaterial({ color: 0x3a271a, roughness: 0.55, metalness: 0.05 });
const HANDLE_MAT = new THREE.MeshStandardMaterial({ color: 0xd9c27a, metalness: 0.7, roughness: 0.3 });

/** Dark mullion frame (top/bottom/side bars + a cross) laid over a glass pane for a finished look. */
function windowFrame(house, cx, cy, cz, w, h) {
  const t = 0.06, d = 0.08;
  house.add(box(w + t, t, d, FRAME_MAT, { x: cx, y: cy + h / 2, z: cz, castShadow: false }));
  house.add(box(w + t, t, d, FRAME_MAT, { x: cx, y: cy - h / 2, z: cz, castShadow: false }));
  house.add(box(t, h, d, FRAME_MAT, { x: cx - w / 2, y: cy, z: cz, castShadow: false }));
  house.add(box(t, h, d, FRAME_MAT, { x: cx + w / 2, y: cy, z: cz, castShadow: false }));
  house.add(box(t * 0.8, h, d * 0.8, FRAME_MAT, { x: cx, y: cy, z: cz, castShadow: false }));
  house.add(box(w, t * 0.8, d * 0.8, FRAME_MAT, { x: cx, y: cy, z: cz, castShadow: false }));
}

/** A door leaf hinged at (hingeX, hingeZ), its panel spanning local +X before `rotationY` is applied. */
function makeSwingDoor(w, h, hingeX, hingeZ, rotationY) {
  const g = new THREE.Group();
  const leaf = box(w, h, 0.05, DOOR_MAT, { x: w / 2, y: h / 2 });
  g.add(leaf);
  g.add(m(new THREE.CylinderGeometry(0.015, 0.015, 0.12, 8), HANDLE_MAT, {
    x: w - 0.08, y: h / 2, z: 0.05 / 2 + 0.03, rz: Math.PI / 2, castShadow: false,
  }));
  g.position.set(hingeX, 0, hingeZ);
  g.rotation.y = rotationY;
  return g;
}

function floorSlab(group, x1, x2, z1, z2, y, mat) {
  const f = m(new THREE.PlaneGeometry(x2 - x1, z2 - z1), mat, {
    x: (x1 + x2) / 2, y, z: (z1 + z2) / 2, rx: -Math.PI / 2,
  });
  f.receiveShadow = true;
  group.add(f);
  return f;
}

function ceilingSlab(group, x1, x2, z1, z2, y, mat) {
  const c = m(new THREE.PlaneGeometry(x2 - x1, z2 - z1), mat, {
    x: (x1 + x2) / 2, y, z: (z1 + z2) / 2, rx: Math.PI / 2, castShadow: false,
  });
  group.add(c);
  return c;
}

export function buildHouse(world) {
  const house = new THREE.Group();
  world.scene.add(house);

  const extMat = Materials.exteriorWall("#ece1ca");
  const intMat = Materials.interiorWall("#f4efe4");
  const woodFloor = Materials.woodFloor();
  const darkWoodFloor = Materials.darkWoodFloor();
  const tileFloor = Materials.tileFloor();
  const ceilingMat = new THREE.MeshStandardMaterial({ color: 0xfaf7f0, roughness: 0.95 });

  const X1 = -9, X2 = 9, Z1 = -6, Z2 = 6;
  const T = 0.25;
  // Stairwell hole cut out of the south-wing floor so the staircase is an open shaft.
  const HX1 = 2.1, HX2 = 4.3, HZ2 = 4.8;

  // ---------- Floors & ceiling ----------
  floorSlab(house, X1, HX1, 0, Z2, 0, woodFloor); // south wing: living/kitchen/dining (west of stairwell)
  floorSlab(house, HX2, X2, 0, Z2, 0, woodFloor); // south wing (east of stairwell)
  floorSlab(house, HX1, HX2, HZ2, Z2, 0, woodFloor); // south wing strip past the bottom of the stairs
  floorSlab(house, X1, -3, Z1, 0, 0, darkWoodFloor); // bedroom 1
  floorSlab(house, -3, 0, Z1, 0, 0, tileFloor); // bathroom
  floorSlab(house, 0, X2, Z1, 0, 0, darkWoodFloor); // bedroom 2
  ceilingSlab(house, X1, X2, Z1, Z2, GROUND_H, ceilingMat);

  // ---------- Exterior walls ----------
  wallAlongZ(world, house, { x: X1, h: GROUND_H, thickness: T, z1: Z1, z2: Z2, mat: extMat, gaps: [[-1, 1]] }); // west: pool side door
  wallAlongZ(world, house, { x: X2, h: GROUND_H, thickness: T, z1: Z1, z2: Z2, mat: extMat, gaps: [[-1, 1]] }); // east: football side door
  wallAlongX(world, house, { z: Z1, h: GROUND_H, thickness: T, x1: X1, x2: X2, mat: extMat, gaps: [] }); // north: solid
  wallAlongX(world, house, {
    z: Z2, h: GROUND_H, thickness: T, x1: X1, x2: X2, mat: extMat,
    gaps: [[-1.0, 1.0], [-4.2, -1.6], [1.6, 4.2]],
  }); // south: entrance + two big window openings (glass panels added below)

  // Glass "windows" flanking the entrance so the garden is visible from inside.
  const glassMat = Materials.glass();
  const glassA = box(2.6, 2.0, 0.06, glassMat, { x: -2.9, y: 1.5, z: Z2, castShadow: false });
  const glassB = box(2.6, 2.0, 0.06, glassMat, { x: 2.9, y: 1.5, z: Z2, castShadow: false });
  house.add(glassA);
  house.add(glassB);
  addCollider(world, glassA);
  addCollider(world, glassB);
  windowFrame(house, -2.9, 1.5, Z2, 2.6, 2.0);
  windowFrame(house, 2.9, 1.5, Z2, 2.6, 2.0);

  // Entrance: open double door, swung inward so the opening stays walkable.
  house.add(makeSwingDoor(0.95, 2.15, -1, Z2 - 0.03, 1.3));
  house.add(makeSwingDoor(0.95, 2.15, 1, Z2 - 0.03, -1.3));
  house.add(box(2.1, 0.1, 0.15, FRAME_MAT, { x: 0, y: 2.2, z: Z2, castShadow: false })); // lintel

  // Side doors (pool terrace / football field access), also open.
  house.add(makeSwingDoor(0.95, 2.15, X1 + 0.03, -1, 0.35));
  house.add(box(0.1, 2.1, 2.05, FRAME_MAT, { x: X1, y: 1.1, z: 0, castShadow: false }));
  house.add(makeSwingDoor(0.95, 2.15, X2 - 0.03, 1, Math.PI - 0.35));
  house.add(box(0.1, 2.1, 2.05, FRAME_MAT, { x: X2, y: 1.1, z: 0, castShadow: false }));

  // ---------- Interior partition wall separating north (bedrooms) / south (living) wings ----------
  wallAlongX(world, house, {
    z: 0, h: GROUND_H, thickness: T, x1: X1, x2: X2, mat: intMat,
    gaps: [[-6.55, -5.45], [-2.05, -0.95], [3.95, 5.05]],
  });
  wallAlongZ(world, house, { x: -3, h: GROUND_H, thickness: T, z1: Z1, z2: 0, mat: intMat });
  wallAlongZ(world, house, { x: 0, h: GROUND_H, thickness: T, z1: Z1, z2: 0, mat: intMat });

  // ---------- Roof (flat modern slab with overhang) ----------
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xdedad3, roughness: 0.85 });
  house.add(box(X2 - X1 + 1.0, 0.3, Z2 - Z1 + 1.0, roofMat, { y: GROUND_H + 0.15, x: 0, z: 0 }));
  const parapet = Materials.exteriorWall("#dcd2b8");
  wallAlongX(world, house, { z: Z1 - 0.4, h: 0.4, thickness: 0.15, x1: X1 - 0.4, x2: X2 + 0.4, mat: parapet, y: GROUND_H + 0.3, collide: false });
  wallAlongX(world, house, { z: Z2 + 0.4, h: 0.4, thickness: 0.15, x1: X1 - 0.4, x2: X2 + 0.4, mat: parapet, y: GROUND_H + 0.3, collide: false });

  // Dark fascia trim tracing the roof overhang, plus a shallow gutter lip — grounds the flat roof visually.
  const fasciaMat = new THREE.MeshStandardMaterial({ color: 0x332e28, roughness: 0.55 });
  const roofEdgeY = GROUND_H + 0.02;
  house.add(box(X2 - X1 + 1.1, 0.14, 0.05, fasciaMat, { x: 0, y: roofEdgeY, z: Z1 - 0.5, castShadow: false }));
  house.add(box(X2 - X1 + 1.1, 0.14, 0.05, fasciaMat, { x: 0, y: roofEdgeY, z: Z2 + 0.5, castShadow: false }));
  house.add(box(0.05, 0.14, Z2 - Z1 + 1.1, fasciaMat, { x: X1 - 0.5, y: roofEdgeY, z: 0, castShadow: false }));
  house.add(box(0.05, 0.14, Z2 - Z1 + 1.1, fasciaMat, { x: X2 + 0.5, y: roofEdgeY, z: 0, castShadow: false }));

  // ---------- Lighting ----------
  house.add(pointLamp(0xfff1d6, 12, 9, { x: -4.5, y: 2.7, z: 1.5 }));
  house.add(pointLamp(0xfff1d6, 10, 8, { x: 4.5, y: 2.7, z: 1.5 }));
  house.add(pointLamp(0xfff1d6, 9, 7, { x: -6, y: 2.5, z: -3 }));
  house.add(pointLamp(0xfff1d6, 9, 7, { x: 4.5, y: 2.5, z: -3 }));
  house.add(pointLamp(0xfff1d6, 6, 6, { x: -1.5, y: 2.5, z: -3 }));

  // ---------- Furniture: Living room (west, south wing) ----------
  place(house, createSofa(0x4d6b7a), -6.2, 0, 2.0, Math.PI);
  place(house, createArmchair(0xb0714a), -7.6, 0, 4.0, Math.PI * 0.75);
  place(house, createCoffeeTable(), -6.2, 0, 3.0);
  place(house, createTVUnit(), -8.6, 0, 2.0, Math.PI / 2);
  place(house, createBookshelf(), -8.7, 0, 4.8, Math.PI / 2);
  house.add(createRug(3.2, 2.4).translateX(-6.2).translateZ(2.6));
  place(house, createFloorLamp(), -4.3, 0, 4.5);
  place(house, createPlantPot(1.2), -1.3, 0, -1.4);

  // ---------- Kitchen + dining (east, south wing — clear of the stairwell at x 2.1..4.3) ----------
  place(house, createKitchenSet(), 6.9, 0, 0.9);
  place(house, createDiningSet(6), 6.6, 0, 3.6);
  house.add(createRug(2.6, 2.0, 0x8a5a3a).translateX(6.6).translateZ(3.6));

  // ---------- Bedroom 1 (master, NW) ----------
  place(house, createBed("double"), -6.5, 0, -1.4);
  place(house, createWardrobe(), -8.5, 0, -4.8, Math.PI / 2);
  place(house, createPlantPot(0.9), -3.6, 0, -5.4);
  house.add(pointLamp(0xffdca8, 6, 6, { x: -6.5, y: 2.4, z: -1.4 }));
  house.add(createRug(1.8, 2.2, 0x774f66).translateX(-6.5).translateZ(-1.4));

  // ---------- Bathroom (N center) ----------
  place(house, createBathroomSet(), -2.9, 0, -1.0, Math.PI / 2);
  house.add(pointLamp(0xeaf6ff, 5, 5, { x: -1.5, y: 2.4, z: -3 }));

  // ---------- Bedroom 2 (NE) ----------
  place(house, createBed("single"), 2.0, 0, -1.6, Math.PI);
  place(house, createWardrobe(), 8.4, 0, -4.8, -Math.PI / 2);
  place(house, createPlantPot(0.9), 1.2, 0, -5.2);
  house.add(pointLamp(0xffdca8, 6, 6, { x: 4.0, y: 2.4, z: -2.5 }));
  house.add(createRug(1.4, 1.9, 0x3a5a77).translateX(2.0).translateZ(-1.6));

  // ================= BASEMENT (cave) =================
  const basement = new THREE.Group();
  world.scene.add(basement);
  const cellarFloor = new THREE.MeshStandardMaterial({ map: Materials.marble().map, roughness: 0.7 });
  const bT = 0.25;
  const BX1 = -8.5, BX2 = 8.5, BZ1 = -5.5, BZ2 = 5.5;

  floorSlab(basement, BX1, BX2, BZ1, BZ2, BASEMENT_Y, cellarFloor);
  // Basement ceiling leaves the same stairwell hole open so the shaft connects the two levels.
  const ceilY = BASEMENT_Y + BASEMENT_H;
  ceilingSlab(basement, BX1, HX1, BZ1, BZ2, ceilY, ceilingMat);
  ceilingSlab(basement, HX2, BX2, BZ1, BZ2, ceilY, ceilingMat);
  ceilingSlab(basement, HX1, HX2, BZ1, 0, ceilY, ceilingMat);
  ceilingSlab(basement, HX1, HX2, HZ2, BZ2, ceilY, ceilingMat);

  const stoneWall = Materials.exteriorWall("#cfc6b4");
  wallAlongZ(world, basement, { x: BX1, y: BASEMENT_Y, h: BASEMENT_H, thickness: bT, z1: BZ1, z2: BZ2, mat: stoneWall, level: 1 });
  wallAlongZ(world, basement, { x: BX2, y: BASEMENT_Y, h: BASEMENT_H, thickness: bT, z1: BZ1, z2: BZ2, mat: stoneWall, level: 1 });
  wallAlongX(world, basement, { z: BZ1, y: BASEMENT_Y, h: BASEMENT_H, thickness: bT, x1: BX1, x2: BX2, mat: stoneWall, level: 1 });
  wallAlongX(world, basement, { z: BZ2, y: BASEMENT_Y, h: BASEMENT_H, thickness: bT, x1: BX1, x2: BX2, mat: stoneWall, level: 1, gaps: [[2.1, 4.3]] }); // stairwell opening

  // Sauna room, walled corner (NE of basement)
  const saunaWood = Materials.saunaWood();
  const SX1 = 3.6, SX2 = 8.2, SZ1 = -5.2, SZ2 = -1.2;
  floorSlab(basement, SX1, SX2, SZ1, SZ2, BASEMENT_Y + 0.02, saunaWood);
  wallAlongX(world, basement, { z: SZ1, y: BASEMENT_Y, h: 2.2, thickness: 0.15, x1: SX1, x2: SX2, mat: saunaWood, level: 1 });
  wallAlongZ(world, basement, { x: SX1, y: BASEMENT_Y, h: 2.2, thickness: 0.15, z1: SZ1, z2: SZ2, mat: saunaWood, level: 1, gaps: [[-2.4, -1.6]] });
  wallAlongX(world, basement, { z: SZ2, y: BASEMENT_Y, h: 2.2, thickness: 0.15, x1: SX1, x2: SX2, mat: saunaWood, level: 1 });
  place(basement, createSaunaStove(), SX2 - 0.9, BASEMENT_Y, SZ1 + 0.9);
  place(basement, createSaunaBench(), (SX1 + SX2) / 2 - 0.4, BASEMENT_Y, SZ2 - 0.55);
  place(basement, createSaunaBench(), (SX1 + SX2) / 2 - 0.4, BASEMENT_Y, SZ1 + 1.9, Math.PI);
  basement.add(pointLamp(0xffb066, 5, 5, { x: (SX1 + SX2) / 2, y: BASEMENT_Y + 1.9, z: (SZ1 + SZ2) / 2 }));

  // Wine cellar / lounge, rest of basement
  const wineRackMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.7 });
  const bottleMat = new THREE.MeshStandardMaterial({ color: 0x2c4a2e, roughness: 0.3, metalness: 0.2 });
  const rack = new THREE.Group();
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 8; col++) {
      const bottle = m(new THREE.CylinderGeometry(0.035, 0.035, 0.3, 8), bottleMat, {
        x: -1.4 + col * 0.14, y: 0.25 + row * 0.32, z: 0, rx: Math.PI / 2, castShadow: false,
      });
      rack.add(bottle);
    }
  }
  rack.add(box(2.3, 1.5, 0.35, wineRackMat, { y: 0.75, z: -0.2 }));
  place(basement, rack, -7.6, BASEMENT_Y, -4.6, Math.PI / 2);

  place(basement, createArmchair(0x5a4433), -6.5, BASEMENT_Y, 3.2, Math.PI * 0.25);
  place(basement, createArmchair(0x5a4433), -4.6, BASEMENT_Y, 4.0, Math.PI * 0.9);
  place(basement, createCoffeeTable(), -5.6, BASEMENT_Y, 3.6);
  const cellarRug = createRug(3, 2.4, 0x5a2f2f);
  cellarRug.position.set(-5.6, BASEMENT_Y + 0.02, 3.6);
  basement.add(cellarRug);
  basement.add(pointLamp(0xffdca8, 6, 7, { x: -6, y: BASEMENT_Y + 2.0, z: 2.5 }));
  basement.add(pointLamp(0xffe6c0, 5, 6, { x: 0, y: BASEMENT_Y + 2.0, z: 0 }));
  basement.add(pointLamp(0xffe6c0, 4, 6, { x: 1, y: BASEMENT_Y + 2.0, z: -3.5 }));

  // ---------- Stairs connecting ground floor to basement ----------
  const stairMat = Materials.marble();
  buildStairs(world, house, { x: 3.2, z: 0.15, dirZ: 1, topY: 0, bottomY: BASEMENT_Y, steps: 14, stepW: 1.6, mat: stairMat });
  // Guard rail opening in ground floor around stairwell: leave a visual edge
  const stairOpeningTrim = new THREE.MeshStandardMaterial({ color: 0x8a8f96, metalness: 0.5, roughness: 0.4 });
  house.add(box(2.2, 0.9, 0.06, stairOpeningTrim, { x: 3.2, y: 0.45, z: 0.02, castShadow: false }));

  world.floorZones.push({
    kind: "ramp", x1: 2.35, x2: 4.05, z1: 0.15, z2: 0.15 + 14 * 0.32,
    axis: "z", y0: 0, y1: BASEMENT_Y, label: "Escalier vers la cave",
  });
  world.floorZones.push({
    kind: "flat", x1: SX1, x2: SX2, z1: SZ1, z2: SZ2, y: BASEMENT_Y, label: "Sauna", level: 1,
  });
  world.floorZones.push({
    kind: "flat", x1: BX1, x2: BX2, z1: BZ1, z2: BZ2, y: BASEMENT_Y, label: "Cave à vin", level: 1,
  });

  return {
    spawnPoint: new THREE.Vector3(0, 1.7, 26),
    houseGroup: house,
    basementGroup: basement,
  };
}
