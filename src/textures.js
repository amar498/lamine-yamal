import * as THREE from "three";

function canvas(size) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return c;
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function toTexture(c, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function woodFloorTexture(base = "#a9754d", dark = "#7c5232", repeat = 6) {
  const size = 256;
  const c = canvas(size);
  const ctx = c.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const plankH = size / 8;
  for (let i = 0; i < 8; i++) {
    const y = i * plankH;
    const shade = rand(-18, 14);
    ctx.fillStyle = shadeColor(base, shade);
    ctx.fillRect(0, y, size, plankH - 2);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(0, y + plankH - 2, size, 2);
    for (let g = 0; g < 3; g++) {
      const gx = rand(0, size);
      ctx.strokeStyle = `rgba(0,0,0,${rand(0.03, 0.09)})`;
      ctx.beginPath();
      ctx.moveTo(gx, y);
      ctx.lineTo(gx + rand(-6, 6), y + plankH);
      ctx.stroke();
    }
  }
  return toTexture(c, repeat, repeat);
}

export function grassTexture(repeat = 40) {
  const size = 256;
  const c = canvas(size);
  const ctx = c.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, "#4c8c3a");
  grad.addColorStop(1, "#3f7a2f");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 3200; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const l = rand(2, 5);
    ctx.strokeStyle = Math.random() > 0.5 ? "rgba(90,160,60,0.5)" : "rgba(30,60,20,0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + rand(-1, 1), y - l);
    ctx.stroke();
  }
  return toTexture(c, repeat, repeat);
}

export function stuccoTexture(color = "#e9dfc9", repeat = 4) {
  const size = 256;
  const c = canvas(size);
  const ctx = c.getContext("2d");
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = rand(-10, 10);
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(c, repeat, repeat);
}

export function tileTexture(color = "#f1f1ee", line = "#c9c9c2", repeat = 8) {
  const size = 128;
  const c = canvas(size);
  const ctx = c.getContext("2d");
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = line;
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, size, size);
  return toTexture(c, repeat, repeat);
}

export function marbleTexture(repeat = 3) {
  const size = 256;
  const c = canvas(size);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#e9e7e2";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 10; i++) {
    ctx.strokeStyle = `rgba(150,150,145,${rand(0.15, 0.35)})`;
    ctx.lineWidth = rand(1, 3);
    ctx.beginPath();
    let x = rand(0, size), y = 0;
    ctx.moveTo(x, y);
    for (let s = 0; s < 5; s++) {
      x += rand(-40, 40);
      y += size / 5;
      ctx.quadraticCurveTo(x + rand(-20, 20), y - size / 10, x, y);
    }
    ctx.stroke();
  }
  return toTexture(c, repeat, repeat);
}

export function saunaWoodTexture(repeat = 4) {
  const size = 256;
  const c = canvas(size);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#c99a5b";
  ctx.fillRect(0, 0, size, size);
  const plankW = size / 10;
  for (let i = 0; i < 10; i++) {
    const x = i * plankW;
    ctx.fillStyle = shadeColor("#c99a5b", rand(-16, 14));
    ctx.fillRect(x, 0, plankW - 2, size);
    for (let k = 0; k < 6; k++) {
      ctx.strokeStyle = "rgba(90,55,20,0.15)";
      ctx.beginPath();
      const kx = x + rand(2, plankW - 2);
      ctx.moveTo(kx, 0);
      ctx.lineTo(kx + rand(-3, 3), size);
      ctx.stroke();
    }
  }
  return toTexture(c, repeat, repeat);
}

export function roofTexture(repeat = 8) {
  const size = 128;
  const c = canvas(size);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#9b4a30";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#7c3a24";
  for (let row = 0; row < 4; row++) {
    const y = row * (size / 4);
    for (let col = 0; col < 4; col++) {
      const x = col * (size / 4) + (row % 2 === 0 ? 0 : size / 8);
      ctx.beginPath();
      ctx.arc(x, y, size / 8, 0, Math.PI, false);
      ctx.fill();
    }
  }
  return toTexture(c, repeat, repeat / 2);
}

export function pathTexture(repeat = 6) {
  const size = 200;
  const c = canvas(size);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#b7ab97";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "#8a7f6d";
  ctx.lineWidth = 4;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(0, (i * size) / 4);
    ctx.lineTo(size, (i * size) / 4);
    ctx.stroke();
  }
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const x = (i * size) / 4 + rand(4, 10);
      const w = size / 4 - rand(8, 16);
      ctx.strokeStyle = "#8a7f6d";
      ctx.beginPath();
      ctx.moveTo(x, (j * size) / 4);
      ctx.lineTo(x, ((j + 1) * size) / 4);
      ctx.stroke();
      ctx.fillStyle = shadeColor("#b7ab97", rand(-14, 10));
      ctx.fillRect((i * size) / 4 + 2, (j * size) / 4 + 2, w, size / 4 - 4);
    }
  }
  return toTexture(c, repeat, repeat);
}

export function deckTexture(repeat = 6) {
  return woodFloorTexture("#c8ab7d", "#a8895a", repeat);
}

export function pitchTexture(w = 1024, h = 640) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#3f8f3a" : "#38832f";
    ctx.fillRect((i * w) / 12, 0, w / 12, h);
  }
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth = 5;
  const m = 24;
  ctx.strokeRect(m, m, w - m * 2, h - m * 2);
  ctx.beginPath();
  ctx.moveTo(w / 2, m);
  ctx.lineTo(w / 2, h - m);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, h * 0.14, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 4, 0, Math.PI * 2);
  ctx.fillStyle = "white";
  ctx.fill();
  const boxW = w * 0.12, boxH = h * 0.5;
  ctx.strokeRect(m, h / 2 - boxH / 2, boxW, boxH);
  ctx.strokeRect(w - m - boxW, h / 2 - boxH / 2, boxW, boxH);
  const gBoxW = w * 0.05, gBoxH = h * 0.26;
  ctx.strokeRect(m, h / 2 - gBoxH / 2, gBoxW, gBoxH);
  ctx.strokeRect(w - m - gBoxW, h / 2 - gBoxH / 2, gBoxW, gBoxH);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function skyTexture() {
  const c = canvas(512);
  const ctx = c.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, "#3c7dc9");
  grad.addColorStop(0.45, "#7fb8e6");
  grad.addColorStop(0.75, "#cfe9f5");
  grad.addColorStop(1, "#f3ede0");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function shadeColor(hex, amt) {
  const num = parseInt(hex.replace("#", ""), 16);
  let r = (num >> 16) + amt;
  let g = ((num >> 8) & 0xff) + amt;
  let b = (num & 0xff) + amt;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `rgb(${r},${g},${b})`;
}

export const Materials = {
  interiorWall: (color = "#f2ede3") =>
    new THREE.MeshStandardMaterial({ map: stuccoTexture(color, 3), roughness: 0.9, metalness: 0.02 }),
  exteriorWall: (color = "#e7dcc4") =>
    new THREE.MeshStandardMaterial({ map: stuccoTexture(color, 5), roughness: 0.95, metalness: 0.02 }),
  woodFloor: () =>
    new THREE.MeshStandardMaterial({ map: woodFloorTexture(), roughness: 0.55, metalness: 0.05 }),
  darkWoodFloor: () =>
    new THREE.MeshStandardMaterial({ map: woodFloorTexture("#5b3c26", "#3f2717"), roughness: 0.55, metalness: 0.05 }),
  tileFloor: () =>
    new THREE.MeshStandardMaterial({ map: tileTexture(), roughness: 0.35, metalness: 0.05 }),
  marble: () =>
    new THREE.MeshStandardMaterial({ map: marbleTexture(), roughness: 0.25, metalness: 0.1 }),
  saunaWood: () =>
    new THREE.MeshStandardMaterial({ map: saunaWoodTexture(), roughness: 0.85, metalness: 0.0 }),
  roof: () =>
    new THREE.MeshStandardMaterial({ map: roofTexture(), roughness: 0.8, metalness: 0.05 }),
  grass: () =>
    new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1, metalness: 0 }),
  path: () =>
    new THREE.MeshStandardMaterial({ map: pathTexture(), roughness: 0.9, metalness: 0 }),
  deck: () =>
    new THREE.MeshStandardMaterial({ map: deckTexture(), roughness: 0.6, metalness: 0.02 }),
  pitch: () =>
    new THREE.MeshStandardMaterial({ map: pitchTexture(), roughness: 0.95, metalness: 0 }),
  water: () =>
    new THREE.MeshPhysicalMaterial({
      color: 0x2a8fc4, transparent: true, opacity: 0.86, roughness: 0.06,
      metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.15,
    }),
  glass: () =>
    new THREE.MeshPhysicalMaterial({
      color: 0xbfe3ea, transparent: true, opacity: 0.28, roughness: 0.05,
      metalness: 0, transmission: 0.6, thickness: 0.05,
    }),
};
