// Particles, shockwave rings, teleport columns, and floating comic text.
import * as THREE from 'three';
import { beamTexture } from './textures.js';
import { rand } from './util.js';

export class Particles {
  constructor(scene, max = 900) {
    this.max = max;
    const geo = new THREE.IcosahedronGeometry(0.5, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    const white = new THREE.Color(1, 1, 1);
    for (let i = 0; i < max; i++) this.mesh.setColorAt(i, white);
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh);
    this.p = new Float32Array(max * 3);
    this.v = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.size = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.cursor = 0;
    this.color = new THREE.Color();
    const m = this.mesh.instanceMatrix.array;
    for (let i = 0; i < max; i++) m[i * 16 + 15] = 1;
    this.mesh.count = max;
    this.hideAll();
  }

  hideAll() {
    const m = this.mesh.instanceMatrix.array;
    for (let i = 0; i < this.max; i++) {
      this.life[i] = 0;
      m[i * 16] = m[i * 16 + 5] = m[i * 16 + 10] = 0;
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  emit(x, y, z, o = {}) {
    const {
      count = 10, color = 0xffffff, speed = 5, up = 2, size = 0.25, life = 0.6,
      gravity = 12, drag = 1.5, spread = 1, colors = null, dir = null,
    } = o;
    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;
      const a = Math.random() * Math.PI * 2;
      const s = speed * rand(0.35, 1);
      let vx = Math.cos(a) * s * spread;
      let vz = Math.sin(a) * s * spread;
      let vy = up * rand(0.4, 1.2) + (Math.random() - 0.3) * s * 0.6;
      if (dir) {
        vx += dir.x * speed;
        vz += dir.z * speed;
      }
      this.p[i * 3] = x;
      this.p[i * 3 + 1] = y;
      this.p[i * 3 + 2] = z;
      this.v[i * 3] = vx;
      this.v[i * 3 + 1] = vy;
      this.v[i * 3 + 2] = vz;
      this.life[i] = this.maxLife[i] = life * rand(0.6, 1.2);
      this.size[i] = size * rand(0.6, 1.3);
      this.grav[i] = gravity;
      this.drag[i] = drag;
      this.color.set(colors ? colors[n % colors.length] : color);
      this.mesh.setColorAt(i, this.color);
    }
    this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt) {
    const m = this.mesh.instanceMatrix.array;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const o = i * 16;
      if (this.life[i] <= 0) {
        m[o] = m[o + 5] = m[o + 10] = 0;
        continue;
      }
      const k = i * 3;
      const dr = Math.exp(-this.drag[i] * dt);
      this.v[k] *= dr;
      this.v[k + 2] *= dr;
      this.v[k + 1] -= this.grav[i] * dt;
      this.p[k] += this.v[k] * dt;
      this.p[k + 1] += this.v[k + 1] * dt;
      this.p[k + 2] += this.v[k + 2] * dt;
      if (this.p[k + 1] < 0.05 && this.grav[i] > 0) {
        this.p[k + 1] = 0.05;
        this.v[k + 1] *= -0.35;
        this.v[k] *= 0.6;
        this.v[k + 2] *= 0.6;
      }
      const s = this.size[i] * Math.min(1, (this.life[i] / this.maxLife[i]) * 2.2);
      m[o] = m[o + 5] = m[o + 10] = s;
      m[o + 12] = this.p[k];
      m[o + 13] = this.p[k + 1];
      m[o + 14] = this.p[k + 2];
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// Flat expanding rings on the floor (Mega Moo, landings, explosions).
export class Rings {
  constructor(scene) {
    this.scene = scene;
    this.geo = new THREE.RingGeometry(0.82, 1, 56);
    this.geo.rotateX(-Math.PI / 2);
    this.items = [];
  }

  spawn(x, z, { color = 0xffffff, from = 0.5, to = 8, life = 0.45, y = 0.12, opacity = 0.9 } = {}) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(this.geo, mat);
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.items.push({ mesh, mat, t: 0, life, from, to, opacity });
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const r = this.items[i];
      r.t += dt;
      const k = Math.min(1, r.t / r.life);
      const ease = 1 - Math.pow(1 - k, 3);
      const s = r.from + (r.to - r.from) * ease;
      r.mesh.scale.set(s, 1, s);
      r.mat.opacity = r.opacity * (1 - k);
      if (k >= 1) {
        this.scene.remove(r.mesh);
        r.mat.dispose();
        this.items.splice(i, 1);
      }
    }
  }

  clear() {
    for (const r of this.items) {
      this.scene.remove(r.mesh);
      r.mat.dispose();
    }
    this.items.length = 0;
  }
}

// Vertical light columns that mark aliens teleporting in.
export class Columns {
  constructor(scene) {
    this.scene = scene;
    this.geo = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true);
    this.items = [];
  }

  spawn(x, z, { color = 0x8dff6a, radius = 0.9, height = 6, life = 0.8 } = {}) {
    const mat = new THREE.MeshBasicMaterial({
      color, map: beamTexture(), transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(this.geo, mat);
    mesh.scale.set(radius, height, radius);
    mesh.position.set(x, height / 2, z);
    mesh.rotation.x = Math.PI;
    this.scene.add(mesh);
    this.items.push({ mesh, mat, t: 0, life, radius });
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const c = this.items[i];
      c.t += dt;
      const k = c.t / c.life;
      c.mat.opacity = 0.8 * Math.sin(Math.min(1, k) * Math.PI);
      const r = c.radius * (1 - k * 0.6);
      c.mesh.scale.x = c.mesh.scale.z = r;
      if (k >= 1) {
        this.scene.remove(c.mesh);
        c.mat.dispose();
        this.items.splice(i, 1);
      }
    }
  }

  clear() {
    for (const c of this.items) {
      this.scene.remove(c.mesh);
      c.mat.dispose();
    }
    this.items.length = 0;
  }
}

// Comic-book words and score popups that float above the action.
export class FloatingText {
  constructor(container) {
    this.container = container;
    this.items = [];
    this.pool = [];
    this.v = new THREE.Vector3();
  }

  spawn(x, y, z, text, { cls = '', life = 0.9, rise = 1.6 } = {}) {
    const el = this.pool.pop() || document.createElement('div');
    el.className = `floater ${cls}`;
    el.textContent = text;
    this.container.appendChild(el);
    this.items.push({ el, x, y, z, t: 0, life, rise });
  }

  update(dt, camera, w, h) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const f = this.items[i];
      f.t += dt;
      const k = f.t / f.life;
      if (k >= 1) {
        f.el.remove();
        this.pool.push(f.el);
        this.items.splice(i, 1);
        continue;
      }
      this.v.set(f.x, f.y + f.rise * k, f.z).project(camera);
      const sx = (this.v.x * 0.5 + 0.5) * w;
      const sy = (-this.v.y * 0.5 + 0.5) * h;
      const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.5 : 1.1 - Math.min(0.1, (k - 0.15));
      f.el.style.transform = `translate(-50%, -50%) translate(${sx}px, ${sy}px) scale(${pop})`;
      f.el.style.opacity = k > 0.7 ? String(1 - (k - 0.7) / 0.3) : '1';
    }
  }

  clear() {
    for (const f of this.items) {
      f.el.remove();
      this.pool.push(f.el);
    }
    this.items.length = 0;
  }
}
