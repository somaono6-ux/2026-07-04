// Milk shots (Bessie) and plasma bolts (aliens).
import * as THREE from 'three';
import { glowSprite, share, makeHayBale, makeMilkCarton, disposeTree } from './models.js';
import { segmentHitsCircle } from './util.js';

export class Projectiles {
  constructor(game) {
    this.game = game;
    this.milk = [];
    this.bolts = [];
    this.milkPool = [];
    this.boltPools = new Map();
    this.geo = new THREE.SphereGeometry(0.5, 10, 8);
    this.milkMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4dc, emissiveIntensity: 0.5, roughness: 0.15 });
    this.goldMat = new THREE.MeshStandardMaterial({ color: 0xffd84a, emissive: 0xffc23a, emissiveIntensity: 1.4, roughness: 0.2 });
    this.boltMats = new Map();
    share(this.geo, this.milkMat, this.goldMat);
  }

  fireMilk(x, y, z, dx, dz, { damage = 12, golden = false } = {}) {
    let m = this.milkPool.pop();
    if (!m) {
      m = { mesh: new THREE.Mesh(this.geo, this.milkMat) };
      m.mesh.castShadow = true;
    }
    m.mesh.material = golden ? this.goldMat : this.milkMat;
    m.mesh.scale.set(0.3, 0.3, 0.55);
    m.mesh.position.set(x, y, z);
    m.mesh.rotation.set(0, Math.atan2(dx, dz), 0);
    m.dx = dx;
    m.dz = dz;
    m.speed = 30;
    m.life = 0.75;
    m.damage = damage;
    m.golden = golden;
    this.game.world.add(m.mesh);
    this.milk.push(m);
  }

  boltMat(color) {
    let mat = this.boltMats.get(color);
    if (!mat) {
      mat = new THREE.MeshBasicMaterial({ color });
      this.boltMats.set(color, mat);
      share(mat);
    }
    return mat;
  }

  fireBolt(x, y, z, dx, dz, { speed = 10, damage = 10, color = 0xff4fd8, size = 0.45, life = 4 } = {}) {
    let pool = this.boltPools.get(color);
    if (!pool) this.boltPools.set(color, (pool = []));
    let b = pool.pop();
    if (!b) {
      const mesh = new THREE.Mesh(this.geo, this.boltMat(color));
      const halo = glowSprite(color, 1, 0.9);
      mesh.add(halo);
      b = { mesh, color };
    }
    b.mesh.scale.setScalar(size);
    b.mesh.children[0].scale.setScalar(3.2);
    b.mesh.position.set(x, y, z);
    b.dx = dx;
    b.dz = dz;
    b.speed = speed;
    b.damage = damage;
    b.life = life;
    b.size = size;
    b.t = Math.random() * 6;
    this.game.world.add(b.mesh);
    this.bolts.push(b);
  }

  update(dt) {
    const g = this.game;
    const arena = g.arena;
    for (let i = this.milk.length - 1; i >= 0; i--) {
      const m = this.milk[i];
      const p = m.mesh.position;
      const ox = p.x;
      const oz = p.z;
      p.x += m.dx * m.speed * dt;
      p.z += m.dz * m.speed * dt;
      m.life -= dt;
      let done = false;
      for (const e of g.enemies) {
        if (!e.active) continue;
        if (segmentHitsCircle(ox, oz, p.x, p.z, e.pos.x, e.pos.z, e.radius + 0.25)) {
          e.hit(m.damage, m.dx, m.dz, 5);
          g.particles.emit(p.x, p.y, p.z, { count: 6, colors: m.golden ? [0xffd84a, 0xffffff] : [0xffffff, 0xf3ecdc], speed: 4, up: 2, size: 0.18, life: 0.4 });
          if (!e.dead) g.particles.emit(p.x, p.y, p.z, { count: 3, color: e.isBoss ? 0xf29bb5 : 0x8dff6a, speed: 3, up: 2, size: 0.14, life: 0.35 });
          done = true;
          break;
        }
      }
      if (!done && arena.blocks(p.x, p.z)) {
        g.particles.emit(p.x - m.dx * 0.3, p.y, p.z - m.dz * 0.3, { count: 5, color: 0xffffff, speed: 3, up: 1.5, size: 0.16, life: 0.35 });
        done = true;
      }
      if (!done && m.life <= 0) {
        g.particles.emit(p.x, 0.1, p.z, { count: 3, color: 0xffffff, speed: 1.5, up: 0.5, size: 0.15, life: 0.3 });
        done = true;
      }
      if (done) this.removeMilk(i);
    }

    const pl = g.player;
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      const p = b.mesh.position;
      const ox = p.x;
      const oz = p.z;
      p.x += b.dx * b.speed * dt;
      p.z += b.dz * b.speed * dt;
      b.life -= dt;
      b.t += dt;
      b.mesh.children[0].scale.setScalar(3 + Math.sin(b.t * 18) * 0.5);
      let done = b.life <= 0;
      if (!done && !pl.dead && !pl.dashing && segmentHitsCircle(ox, oz, p.x, p.z, pl.pos.x, pl.pos.z, pl.radius * 0.75 + b.size * 0.5)) {
        pl.hurt(b.damage, p.x - b.dx, p.z - b.dz);
        g.particles.emit(p.x, p.y, p.z, { count: 8, color: b.color, speed: 4, up: 2, size: 0.2, life: 0.4 });
        done = true;
      }
      if (!done && arena.blocks(p.x, p.z)) {
        g.particles.emit(p.x, p.y, p.z, { count: 5, color: b.color, speed: 3, up: 1.5, size: 0.18, life: 0.3 });
        done = true;
      }
      if (done) this.removeBolt(i);
    }
  }

  removeMilk(i) {
    const m = this.milk[i];
    this.game.world.remove(m.mesh);
    this.milk.splice(i, 1);
    this.milkPool.push(m);
  }

  removeBolt(i) {
    const b = this.bolts[i];
    this.game.world.remove(b.mesh);
    this.bolts.splice(i, 1);
    this.boltPools.get(b.color).push(b);
  }

  clearBoltsNear(x, z, r) {
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const p = this.bolts[i].mesh.position;
      if ((p.x - x) ** 2 + (p.z - z) ** 2 < r * r) {
        this.game.particles.emit(p.x, p.y, p.z, { count: 3, color: 0xfff6e6, speed: 2, up: 1, size: 0.18, life: 0.3 });
        this.removeBolt(i);
      }
    }
  }

  // Safe to call while milk shots are being updated (it only touches bolts).
  clearBolts() {
    while (this.bolts.length) this.removeBolt(this.bolts.length - 1);
  }

  clear() {
    while (this.milk.length) this.removeMilk(this.milk.length - 1);
    this.clearBolts();
  }
}

// Hay bales heal, Golden Milk gives a triple-shot blaster.
export class Pickups {
  constructor(game) {
    this.game = game;
    this.items = [];
  }

  spawn(type, x, z) {
    const mesh = type === 'hay' ? makeHayBale() : makeMilkCarton();
    if (type === 'hay') mesh.scale.setScalar(0.75);
    mesh.position.set(x, 0, z);
    this.game.world.add(mesh);
    this.items.push({ type, mesh, t: 0, life: 18 });
    this.game.rings.spawn(x, z, { color: type === 'hay' ? 0xe8c35a : 0xffd84a, from: 0.3, to: 1.8, life: 0.4 });
  }

  update(dt) {
    const g = this.game;
    const pl = g.player;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      it.life -= dt;
      const inner = it.mesh.userData.inner;
      inner.rotation.y += dt * 2;
      inner.position.y = (it.type === 'hay' ? 0.45 : 0.6) + 0.25 + Math.sin(it.t * 3) * 0.15;
      it.mesh.visible = it.life > 3 || Math.floor(it.life * 8) % 2 === 0;
      const d = Math.hypot(pl.pos.x - it.mesh.position.x, pl.pos.z - it.mesh.position.z);
      if (!pl.dead && d < 1.6) {
        this.collect(it);
        this.remove(i);
      } else if (it.life <= 0) {
        this.remove(i);
      }
    }
  }

  collect(it) {
    const g = this.game;
    const p = it.mesh.position;
    if (it.type === 'hay') {
      g.player.heal(30);
      g.sound.pickup();
      g.floaters.spawn(p.x, 2, p.z, '+30 HAY', { cls: 'heal' });
      g.particles.emit(p.x, 0.8, p.z, { count: 14, colors: [0xe8c35a, 0xb8902e], speed: 4, up: 3, size: 0.2, life: 0.6 });
    } else {
      g.player.golden = 10;
      g.sound.powerup();
      g.floaters.spawn(p.x, 2.2, p.z, 'GOLDEN MILK!', { cls: 'gold', life: 1.2 });
      g.hud.toast('Golden Milk: triple shot for 10 seconds', 2.5);
      g.particles.emit(p.x, 0.8, p.z, { count: 20, colors: [0xffd84a, 0xffffff], speed: 5, up: 4, size: 0.22, life: 0.7 });
    }
  }

  remove(i) {
    const it = this.items[i];
    this.game.world.remove(it.mesh);
    disposeTree(it.mesh);
    this.items.splice(i, 1);
  }

  clear() {
    while (this.items.length) this.remove(this.items.length - 1);
  }
}
