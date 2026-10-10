// Bessie: movement, milk blaster, Hoof Dash, and the Mega Moo.
import * as THREE from 'three';
import { makeCow, animateCow } from './models.js';
import { damp, dampAngle, clamp, rand } from './util.js';

export const COW = {
  maxHp: 100,
  speed: 9,
  fireRate: 0.15,
  goldenFireRate: 0.09,
  dashTime: 0.2,
  dashSpeed: 27,
  dashCooldown: 1.0,
  mooCooldown: 7,
  mooRadius: 9,
};

export class Player {
  constructor(game) {
    this.game = game;
    this.mesh = makeCow();
    this.mesh.scale.setScalar(1.15);
    this.pos = this.mesh.position;
    this.vel = new THREE.Vector3();
    this.radius = 0.95;
    this.dashHits = new Set();
    this.reset(0, 0);
  }

  reset(x, z) {
    this.pos.set(x, 0, z);
    this.vel.set(0, 0, 0);
    this.maxHp = COW.maxHp;
    this.hp = this.maxHp;
    this.facing = Math.PI;
    this.aimX = 0;
    this.aimZ = -1;
    this.fireCd = 0;
    this.dashCd = 0;
    this.dashT = 0;
    this.dashX = 0;
    this.dashZ = 0;
    this.mooCd = 0;
    this.invuln = 0;
    this.golden = 0;
    this.hurtFlash = 0;
    this.recoil = 0;
    this.dead = false;
    this.deadT = 0;
    this.dashHits.clear();
    this.mesh.rotation.set(0, this.facing, 0);
    this.mesh.visible = true;
    this.mesh.userData.white.emissive.setRGB(0, 0, 0);
  }

  get dashing() {
    return this.dashT > 0;
  }

  update(dt, input, controls) {
    const g = this.game;
    const u = this.mesh.userData;
    if (this.dead) {
      this.deadT += dt;
      const k = clamp(this.deadT / 0.5, 0, 1);
      this.mesh.rotation.z = k * (Math.PI / 2);
      this.mesh.position.y = Math.sin(k * Math.PI) * 0.6;
      u.legs.forEach((l, i) => (l.rotation.x = Math.sin(this.deadT * 30 + i) * 0.4 * Math.max(0, 1 - this.deadT)));
      return;
    }

    this.fireCd -= dt;
    this.dashCd -= dt;
    this.mooCd -= dt;
    this.invuln -= dt;
    this.hurtFlash -= dt;
    this.golden = Math.max(0, this.golden - dt);
    this.recoil = Math.max(0, this.recoil - dt * 6);

    const mv = controls ? input.moveVector() : { x: 0, z: 0 };
    const moving = Math.hypot(mv.x, mv.z) > 0.1;

    // aiming: right stick > mouse > auto-aim (touch/gamepad) > movement direction
    const stick = controls ? input.stickAim() : null;
    let aimed = false;
    if (stick) {
      const l = Math.hypot(stick.x, stick.z);
      this.aimX = stick.x / l;
      this.aimZ = stick.z / l;
      aimed = true;
    } else if (controls && input.device === 'mouse' && input.mouse.seen) {
      const p = g.mouseGround();
      if (p) {
        const dx = p.x - this.pos.x;
        const dz = p.z - this.pos.z;
        const l = Math.hypot(dx, dz);
        if (l > 0.4) {
          this.aimX = dx / l;
          this.aimZ = dz / l;
          aimed = true;
        }
      }
    }
    if (!aimed && controls && input.firing) {
      const t = g.nearestEnemy(this.pos, 18);
      if (t) {
        const dx = t.pos.x - this.pos.x;
        const dz = t.pos.z - this.pos.z;
        const l = Math.hypot(dx, dz) || 1;
        this.aimX = dx / l;
        this.aimZ = dz / l;
        aimed = true;
      }
    }
    if (!aimed && moving) {
      const l = Math.hypot(mv.x, mv.z);
      this.aimX = mv.x / l;
      this.aimZ = mv.z / l;
    }

    // Hoof Dash
    if (controls && input.take('dash') && this.dashCd <= 0) {
      let dx = mv.x;
      let dz = mv.z;
      if (!moving) {
        dx = this.aimX;
        dz = this.aimZ;
      }
      const l = Math.hypot(dx, dz) || 1;
      this.dashX = dx / l;
      this.dashZ = dz / l;
      this.dashT = COW.dashTime;
      this.dashCd = COW.dashCooldown;
      this.dashHits.clear();
      g.sound.dash();
      g.particles.emit(this.pos.x, 0.2, this.pos.z, { count: 14, color: 0xcfd6ea, speed: 4, up: 1.5, size: 0.3, life: 0.5, gravity: 2 });
    }

    // Mega Moo
    if (controls && input.take('moo') && this.mooCd <= 0) this.megaMoo();

    if (this.dashT > 0) {
      this.dashT -= dt;
      this.vel.set(this.dashX * COW.dashSpeed, 0, this.dashZ * COW.dashSpeed);
      if (Math.random() < 0.8) {
        g.particles.emit(this.pos.x, 0.9, this.pos.z, { count: 2, colors: [0xffffff, 0xfff1c9], speed: 1, up: 0.5, size: 0.35, life: 0.35, gravity: 0 });
      }
      for (const e of g.enemies) {
        if (!e.active || this.dashHits.has(e)) continue;
        const dx = e.pos.x - this.pos.x;
        const dz = e.pos.z - this.pos.z;
        if (dx * dx + dz * dz < (e.radius + this.radius + 0.3) ** 2) {
          this.dashHits.add(e);
          e.hit(25, this.dashX, this.dashZ, 16);
          g.floaters.spawn(e.pos.x, 2.4, e.pos.z, 'BONK!', { cls: 'bonk', life: 0.7 });
          g.shake(0.25);
        }
      }
    } else {
      this.vel.x = damp(this.vel.x, mv.x * COW.speed, 12, dt);
      this.vel.z = damp(this.vel.z, mv.z * COW.speed, 12, dt);
    }
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    g.arena.resolve(this.pos, this.radius, true);

    // milk blaster
    if (controls && input.firing && this.fireCd <= 0) {
      this.fire();
      this.fireCd = this.golden > 0 ? COW.goldenFireRate : COW.fireRate;
    }

    // facing and animation
    this.facing = dampAngle(this.facing, Math.atan2(this.aimX, this.aimZ), 18, dt);
    this.mesh.rotation.y = this.facing;
    const speed01 = clamp(Math.hypot(this.vel.x, this.vel.z) / COW.speed, 0, 1);
    animateCow(this.mesh, dt, this.dashT > 0 ? 1 : speed01, { lean: this.dashT > 0 ? 0.3 : 0 });
    u.head.position.z = 0.9 - this.recoil * 0.12;

    const white = u.white;
    if (this.hurtFlash > 0) white.emissive.setRGB(0.9, 0.1, 0.05);
    else if (this.golden > 0) {
      const p = 0.18 + Math.sin(g.time * 10) * 0.08;
      white.emissive.setRGB(p * 1.2, p * 0.9, 0);
    } else white.emissive.setRGB(0, 0, 0);
    this.mesh.visible = this.invuln > 0 ? Math.floor(this.invuln * 18) % 2 === 0 : true;
  }

  fire() {
    const g = this.game;
    const base = Math.atan2(this.aimX, this.aimZ);
    const spread = this.golden > 0 ? [-0.17, 0, 0.17] : [0];
    for (const s of spread) {
      const a = base + s + rand(-0.035, 0.035);
      const dx = Math.sin(a);
      const dz = Math.cos(a);
      g.projectiles.fireMilk(this.pos.x + this.aimX * 1.35, 1.2, this.pos.z + this.aimZ * 1.35, dx, dz, {
        damage: this.golden > 0 ? 11 : 12,
        golden: this.golden > 0,
      });
    }
    this.recoil = 1;
    g.sound.shoot();
  }

  megaMoo() {
    const g = this.game;
    this.mooCd = COW.mooCooldown;
    const { x, z } = this.pos;
    g.sound.moo(1, 0.9, 0.6);
    g.rings.spawn(x, z, { color: 0xfff6e6, from: 1, to: COW.mooRadius + 0.5, life: 0.5, opacity: 1 });
    g.rings.spawn(x, z, { color: 0x7fe7ff, from: 0.5, to: COW.mooRadius - 1.5, life: 0.7, y: 0.25 });
    g.rings.spawn(x, z, { color: 0xffd84a, from: 0.5, to: COW.mooRadius * 0.6, life: 0.4, y: 0.4 });
    g.floaters.spawn(x, 3, z, 'MOOOO!', { cls: 'moo', life: 1.1, rise: 1.2 });
    g.shake(0.6);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      g.particles.emit(x + Math.cos(a) * 1.5, 0.4, z + Math.sin(a) * 1.5, {
        count: 1, color: 0xfff6e6, speed: 0, up: 0.5, size: 0.5, life: 0.5, gravity: 0,
        dir: { x: Math.cos(a) * 1.6, z: Math.sin(a) * 1.6 }, drag: 0.5,
      });
    }
    for (const e of g.enemies) {
      if (!e.active) continue;
      const dx = e.pos.x - x;
      const dz = e.pos.z - z;
      const d = Math.hypot(dx, dz);
      if (d < COW.mooRadius + e.radius) {
        e.hit(e.isBoss ? 60 : 40, dx / (d || 1), dz / (d || 1), e.isBoss ? 0 : 22);
        e.stun?.(0.8);
      }
    }
    g.projectiles.clearBoltsNear(x, z, COW.mooRadius);
  }

  heal(n) {
    this.hp = Math.min(this.maxHp, this.hp + n);
  }

  // Returns true when the hit lands.
  hurt(dmg, fromX, fromZ) {
    const g = this.game;
    if (this.dead || this.invuln > 0 || this.dashT > 0 || g.state !== 'playing') return false;
    this.hp -= dmg;
    this.invuln = 0.8;
    this.hurtFlash = 0.15;
    const dx = this.pos.x - fromX;
    const dz = this.pos.z - fromZ;
    const l = Math.hypot(dx, dz) || 1;
    this.vel.x += (dx / l) * 11;
    this.vel.z += (dz / l) * 11;
    g.onPlayerHurt(dmg);
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.deadT = 0;
      this.mesh.visible = true;
      g.onPlayerDied();
    }
    return true;
  }
}
