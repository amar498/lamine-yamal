import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";

const WALK_SPEED = 3.4;
const RUN_SPEED = 6.2;
const EYE_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.32;
const GRAVITY = 15;
const JUMP_SPEED = 5.4;
const NORMAL_FOV = 72;
const ZOOM_FOV = 32;

export class FirstPersonController {
  constructor(camera, domElement, world) {
    this.camera = camera;
    this.world = world;
    this.controls = new PointerLockControls(camera, domElement);

    this.keys = { forward: false, back: false, left: false, right: false, run: false, jump: false };
    this.velocitySmooth = new THREE.Vector3();
    this.jumpOffset = 0;
    this.jumpVelocity = 0;
    this.grounded = true;
    this.bobPhase = 0;
    this.zoomed = false;
    this.currentFov = NORMAL_FOV;
    this.currentFloorY = 0;
    this.level = 0;

    camera.position.copy(world.spawnPoint);
    camera.fov = NORMAL_FOV;
    camera.updateProjectionMatrix();

    this._bindKeys();
    domElement.addEventListener("wheel", (e) => {
      this.zoomed = e.deltaY < 0 ? true : e.deltaY > 0 ? false : this.zoomed;
    }, { passive: true });
  }

  _bindKeys() {
    const down = (e) => this._setKey(e.code, true);
    const up = (e) => this._setKey(e.code, false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
  }

  _setKey(code, val) {
    switch (code) {
      case "KeyW":
      case "ArrowUp":
        this.keys.forward = val;
        break;
      case "KeyS":
      case "ArrowDown":
        this.keys.back = val;
        break;
      case "KeyA":
      case "ArrowLeft":
        this.keys.left = val;
        break;
      case "KeyD":
      case "ArrowRight":
        this.keys.right = val;
        break;
      case "ShiftLeft":
      case "ShiftRight":
        this.keys.run = val;
        break;
      case "Space":
        if (val && this.grounded) this.keys.jump = true;
        break;
      case "KeyF":
        if (val) this.zoomed = !this.zoomed;
        break;
      case "KeyM":
        if (val) window.dispatchEvent(new CustomEvent("toggle-map"));
        break;
    }
  }

  // Zones are 2D (x,z) footprints; basement zones sit directly under the ground
  // floor so they are gated by `this.level`, a small state machine only ever
  // changed while inside the stairs ramp zone. This prevents the basement's
  // footprint from hijacking the ground floor above it.
  getFloorY(x, z) {
    const zones = this.world.floorZones;
    for (let i = 0; i < zones.length; i++) {
      const zn = zones[i];
      if (zn.kind === "ramp") {
        const zmin = Math.min(zn.z1, zn.z2), zmax = Math.max(zn.z1, zn.z2);
        if (x >= zn.x1 && x <= zn.x2 && z >= zmin && z <= zmax) {
          const t = THREE.MathUtils.clamp((z - zn.z1) / (zn.z2 - zn.z1), 0, 1);
          this.level = t > 0.5 ? 1 : 0;
          return { y: zn.y0 + (zn.y1 - zn.y0) * t, label: zn.label || null };
        }
      } else if (zn.kind === "flat") {
        if (zn.level !== undefined && zn.level !== this.level) continue;
        if (x >= zn.x1 && x <= zn.x2 && z >= zn.z1 && z <= zn.z2) {
          return { y: zn.y, label: zn.label || null };
        }
      }
    }
    return { y: this.level === 1 ? -3.2 : 0, label: null };
  }

  _collidesAt(x, z, feetY) {
    const r = PLAYER_RADIUS;
    const box = new THREE.Box3(
      new THREE.Vector3(x - r, feetY + 0.05, z - r),
      new THREE.Vector3(x + r, feetY + 1.75, z + r)
    );
    const colliders = this.world.colliders;
    for (let i = 0; i < colliders.length; i++) {
      if (box.intersectsBox(colliders[i])) return true;
    }
    return false;
  }

  update(dt) {
    const camera = this.camera;
    const speed = this.keys.run ? RUN_SPEED : WALK_SPEED;

    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
    right.y = 0;
    right.normalize();
    const forward = new THREE.Vector3().crossVectors(camera.up, right).normalize();

    let moveX = 0, moveZ = 0;
    if (this.keys.forward) { moveX += forward.x; moveZ += forward.z; }
    if (this.keys.back) { moveX -= forward.x; moveZ -= forward.z; }
    if (this.keys.right) { moveX += right.x; moveZ += right.z; }
    if (this.keys.left) { moveX -= right.x; moveZ -= right.z; }

    const len = Math.hypot(moveX, moveZ);
    const isMoving = len > 0.001 && this.controls.isLocked;
    if (len > 0.001) { moveX /= len; moveZ /= len; }

    const targetVX = moveX * speed;
    const targetVZ = moveZ * speed;
    this.velocitySmooth.x += (targetVX - this.velocitySmooth.x) * Math.min(1, dt * 10);
    this.velocitySmooth.z += (targetVZ - this.velocitySmooth.z) * Math.min(1, dt * 10);

    const curFeet = camera.position.y - EYE_HEIGHT - this.jumpOffset;
    const dx = this.velocitySmooth.x * dt;
    const dz = this.velocitySmooth.z * dt;

    let px = camera.position.x, pz = camera.position.z;
    if (dx !== 0 && !this._collidesAt(px + dx, pz, curFeet)) px += dx;
    if (dz !== 0 && !this._collidesAt(px, pz + dz, curFeet)) pz += dz;

    const floor = this.getFloorY(px, pz);
    this.currentFloorY = floor.y;
    this.currentLabel = floor.label;

    if (this.keys.jump) {
      this.jumpVelocity = JUMP_SPEED;
      this.grounded = false;
      this.keys.jump = false;
    }
    if (!this.grounded) {
      this.jumpOffset += this.jumpVelocity * dt;
      this.jumpVelocity -= GRAVITY * dt;
      if (this.jumpOffset <= 0) {
        this.jumpOffset = 0;
        this.jumpVelocity = 0;
        this.grounded = true;
      }
    }

    let bobOffset = 0;
    if (isMoving && this.grounded) {
      this.bobPhase += dt * (this.keys.run ? 11 : 7.5);
      bobOffset = Math.sin(this.bobPhase) * (this.keys.run ? 0.045 : 0.03);
    } else {
      this.bobPhase = 0;
    }

    camera.position.set(px, floor.y + EYE_HEIGHT + this.jumpOffset + bobOffset, pz);

    const targetFov = this.zoomed ? ZOOM_FOV : NORMAL_FOV;
    this.currentFov += (targetFov - this.currentFov) * Math.min(1, dt * 8);
    if (Math.abs(this.currentFov - camera.fov) > 0.05) {
      camera.fov = this.currentFov;
      camera.updateProjectionMatrix();
    }
  }
}
