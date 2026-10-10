// The alien crew: Zorblets, Zappers, Probe Drones, Gloopzillas, and Overlord Zyx.
import * as THREE from 'three';
import { makeGrunt, makeShooter, makeDrone, makeBrute, makeBoss } from './models.js';
import { damp, dampAngle, rand, pick, clamp } from './util.js';
import { ENEMY_INFO } from './levels.js';

const easeOutBack = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

class Enemy {
  constructor(game, x, z, mesh, o) {
    this.game = game;
    this.mesh = mesh;
    this.mesh.position.set(x, o.y ?? 0, z);
    this.pos = this.mesh.position;
    this.vel = new THREE.Vector3();
    this.kb = new THREE.Vector3();
    this.hp = this.maxHp = o.hp;
    this.radius = o.radius;
    this.speed = o.speed * rand(0.9, 1.12);
    this.kbResist = o.kbResist ?? 1;
    this.score = ENEMY_INFO[o.type].score;
    this.type = o.type;
    this.spawnT = this.spawnDur = o.spawnTime ?? 0.7;
    this.dead = false;
    this.dying = false;
    this.flash = 0;
    this.stunT = 0;
    this.time = rand(0, 10);
    this.state = 'chase';
    this.t = 0;
    this.facing = Math.atan2(game.player.pos.x - x, game.player.pos.z - z);
    this.mesh.rotation.y = this.facing;
    this.skin = mesh.userData.skin;
    this.baseEmissive = this.skin.emissive.clone();
    this.mesh.scale.setScalar(0.01);
    this.dist = 99;
    this.nx = 0;
    this.nz = 1;
  }

  get active() {
    return !this.dead && this.spawnT <= 0;
  }

  hit(dmg, dx, dz, force = 5) {
    if (!this.active) return;
    this.hp -= dmg;
    this.flash = 0.09;
    this.kb.x += dx * force * this.kbResist;
    this.kb.z += dz * force * this.kbResist;
    this.game.sound.alienHit();
    if (this.hp <= 0) this.die(true);
  }

  stun(t) {
    this.stunT = Math.max(this.stunT, t * this.kbResist);
  }

  die(byPlayer) {
    if (this.dead) return;
    this.dead = true;
    this.game.onEnemyKilled(this, byPlayer);
  }

  update(dt) {
    if (this.dead) return;
    this.time += dt;
    if (this.spawnT > 0) {
      this.spawnT -= dt;
      const k = clamp(1 - this.spawnT / this.spawnDur, 0, 1);
      this.mesh.scale.setScalar(Math.max(0.01, easeOutBack(k)));
      return;
    }
    this.mesh.scale.setScalar(1);
    this.flash -= dt;
    if (this.flash > 0) this.skin.emissive.setRGB(1, 1, 1);
    else this.skin.emissive.copy(this.baseEmissive);

    const p = this.game.player.pos;
    const dx = p.x - this.pos.x;
    const dz = p.z - this.pos.z;
    this.dist = Math.hypot(dx, dz) || 0.001;
    this.nx = dx / this.dist;
    this.nz = dz / this.dist;

    if (this.stunT > 0) {
      this.stunT -= dt;
      this.vel.x = damp(this.vel.x, 0, 10, dt);
      this.vel.z = damp(this.vel.z, 0, 10, dt);
    } else {
      this.think(dt);
    }
    this.pos.x += (this.vel.x + this.kb.x) * dt;
    this.pos.z += (this.vel.z + this.kb.z) * dt;
    const decay = Math.exp(-7 * dt);
    this.kb.x *= decay;
    this.kb.z *= decay;
    this.hitWall = this.game.arena.resolve(this.pos, this.radius);
    this.mesh.rotation.y = dampAngle(this.mesh.rotation.y, this.facing, 10, dt);
    this.animate(dt);
  }

  faceTo(nx, nz) {
    this.facing = Math.atan2(nx, nz);
  }

  steer(tx, tz, dt, lambda = 6) {
    this.vel.x = damp(this.vel.x, tx, lambda, dt);
    this.vel.z = damp(this.vel.z, tz, lambda, dt);
  }

  touchingPlayer(extra = 0) {
    return this.dist < this.radius + this.game.player.radius + extra;
  }

  think() {}
  animate() {}
}

/* Zorblet: small, fast, swarms and slaps. */
export class Grunt extends Enemy {
  constructor(game, x, z) {
    super(game, x, z, makeGrunt(), { type: 'grunt', hp: 30, radius: 0.65, speed: 4.4 });
  }

  think(dt) {
    this.faceTo(this.nx, this.nz);
    if (this.state === 'chase') {
      // slight sideways wobble so swarms spread out
      const wob = Math.sin(this.time * 2.3) * 0.35;
      this.steer((this.nx - this.nz * wob) * this.speed, (this.nz + this.nx * wob) * this.speed, dt, 5);
      if (this.touchingPlayer(0.5)) {
        this.state = 'windup';
        this.t = 0.32;
      }
    } else if (this.state === 'windup') {
      this.steer(0, 0, dt, 12);
      this.t -= dt;
      if (this.t <= 0) {
        if (this.touchingPlayer(1.1)) this.game.player.hurt(10, this.pos.x, this.pos.z);
        this.state = 'recover';
        this.t = 0.65;
      }
    } else {
      this.steer(this.nx * this.speed * 0.3, this.nz * this.speed * 0.3, dt);
      this.t -= dt;
      if (this.t <= 0) this.state = 'chase';
    }
  }

  animate() {
    const u = this.mesh.userData;
    const sp = Math.min(1, Math.hypot(this.vel.x, this.vel.z) / this.speed);
    u.body.position.y = Math.abs(Math.sin(this.time * 11)) * 0.28 * sp;
    const windup = this.state === 'windup';
    u.arms.forEach((a, i) => {
      a.rotation.x = windup ? -2.6 : Math.sin(this.time * 11 + i * Math.PI) * 0.8 * sp;
    });
    const glow = 0.8 + Math.sin(this.time * 8) * 0.4;
    u.balls.forEach((b) => b.scale.setScalar(0.13 * glow));
  }
}

/* Zapper: keeps its distance and fires plasma. */
export class Shooter extends Enemy {
  constructor(game, x, z) {
    super(game, x, z, makeShooter(), { type: 'shooter', hp: 40, radius: 0.7, speed: 3.4 });
    this.fireT = rand(1.2, 2.2);
    this.strafe = Math.random() < 0.5 ? 1 : -1;
    this.strafeT = rand(1.5, 3);
  }

  think(dt) {
    this.faceTo(this.nx, this.nz);
    let tx = 0;
    let tz = 0;
    if (this.dist > 12) {
      tx = this.nx;
      tz = this.nz;
    } else if (this.dist < 7.5) {
      tx = -this.nx;
      tz = -this.nz;
    } else {
      tx = -this.nz * this.strafe * 0.7;
      tz = this.nx * this.strafe * 0.7;
    }
    this.strafeT -= dt;
    if (this.strafeT <= 0 || this.hitWall) {
      this.strafe *= -1;
      this.strafeT = rand(1.5, 3);
    }
    this.steer(tx * this.speed, tz * this.speed, dt, 4);
    this.fireT -= dt;
    if (this.fireT <= 0) {
      if (this.dist < 22) {
        const pl = this.game.player;
        const lx = pl.pos.x + pl.vel.x * 0.3 - this.pos.x;
        const lz = pl.pos.z + pl.vel.z * 0.3 - this.pos.z;
        const l = Math.hypot(lx, lz) || 1;
        this.game.projectiles.fireBolt(this.pos.x + (lx / l) * 1.1, 1.05, this.pos.z + (lz / l) * 1.1, lx / l, lz / l, {
          speed: 11, damage: 12, color: 0xff4fd8,
        });
        this.game.sound.zap();
      }
      this.fireT = rand(1.8, 2.6);
    }
  }

  animate() {
    const u = this.mesh.userData;
    const sp = Math.min(1, Math.hypot(this.vel.x, this.vel.z) / this.speed);
    u.body.position.y = Math.abs(Math.sin(this.time * 8)) * 0.12 * sp;
    const charge = this.fireT < 0.55 ? 1 + (0.55 - this.fireT) * 3 : 1;
    u.tip.scale.setScalar(0.16 * charge);
  }
}

/* Probe Drone: circles, then dive-bombs. */
export class Drone extends Enemy {
  constructor(game, x, z) {
    super(game, x, z, makeDrone(), { type: 'drone', hp: 22, radius: 0.8, speed: 7, y: 2.2 });
    this.orbitA = Math.atan2(z - game.player.pos.z, x - game.player.pos.x);
    this.dir = Math.random() < 0.5 ? 1 : -1;
    this.state = 'orbit';
    this.t = rand(2, 3.5);
    this.height = 2.2;
  }

  think(dt) {
    const pl = this.game.player;
    const u = this.mesh.userData;
    if (this.state === 'orbit') {
      this.orbitA += dt * 0.9 * this.dir;
      const tx = pl.pos.x + Math.cos(this.orbitA) * 6.5 - this.pos.x;
      const tz = pl.pos.z + Math.sin(this.orbitA) * 6.5 - this.pos.z;
      const l = Math.hypot(tx, tz) || 1;
      const sp = Math.min(this.speed, l * 2);
      this.steer((tx / l) * sp, (tz / l) * sp, dt, 3);
      this.faceTo(this.nx, this.nz);
      this.height = damp(this.height, 2.2, 3, dt);
      this.t -= dt;
      if (this.t <= 0) {
        this.state = 'aim';
        this.t = 0.6;
      }
    } else if (this.state === 'aim') {
      this.steer(0, 0, dt, 8);
      this.faceTo(this.nx, this.nz);
      this.height = damp(this.height, 2.8, 6, dt);
      this.t -= dt;
      if (this.t <= 0) {
        this.state = 'dive';
        this.t = 0.95;
        this.diveX = this.nx;
        this.diveZ = this.nz;
      }
    } else if (this.state === 'dive') {
      this.vel.set(this.diveX * 16, 0, this.diveZ * 16);
      this.height = damp(this.height, 1.0, 5, dt);
      this.t -= dt;
      if (this.touchingPlayer(0.1) && !pl.dashing) {
        pl.hurt(15, this.pos.x, this.pos.z);
        this.explode();
        return;
      }
      if (this.t <= 0 || this.hitWall) {
        this.state = 'recover';
        this.t = 0.8;
      }
    } else {
      this.steer(0, 0, dt, 4);
      this.height = damp(this.height, 2.2, 3, dt);
      this.t -= dt;
      if (this.t <= 0) {
        this.state = 'orbit';
        this.t = rand(2, 3.5);
        this.orbitA = Math.atan2(this.pos.z - pl.pos.z, this.pos.x - pl.pos.x);
      }
    }
    const alarm = this.state === 'aim' || this.state === 'dive';
    u.lightMat.emissive.set(alarm ? 0xff3b3b : 0x6fe3ff);
    u.lightMat.color.set(alarm ? 0xff3b3b : 0x6fe3ff);
  }

  explode() {
    const g = this.game;
    g.particles.emit(this.pos.x, this.pos.y, this.pos.z, { count: 26, colors: [0xffb347, 0xff6b3b, 0xfff1a8], speed: 8, up: 4, size: 0.35, life: 0.6 });
    g.rings.spawn(this.pos.x, this.pos.z, { color: 0xffb347, from: 0.5, to: 3.5, life: 0.35 });
    g.sound.explosion();
    g.shake(0.35);
    this.die(false);
  }

  animate(dt) {
    const u = this.mesh.userData;
    this.pos.y = this.height + Math.sin(this.time * 3) * 0.15;
    u.body.rotation.y += dt * (this.state === 'dive' ? 14 : 3);
    u.body.rotation.z = clamp(this.vel.x * -0.03, -0.4, 0.4);
    u.body.rotation.x = clamp(this.vel.z * 0.03, -0.4, 0.4);
  }
}

/* Gloopzilla: slow, tanky, and charges. */
export class Brute extends Enemy {
  constructor(game, x, z) {
    super(game, x, z, makeBrute(), { type: 'brute', hp: 170, radius: 1.35, speed: 2.7, kbResist: 0.3, spawnTime: 1.0 });
    this.state = 'walk';
    this.chargeCd = 2;
    this.swipeCd = 0;
  }

  think(dt) {
    const g = this.game;
    this.chargeCd -= dt;
    this.swipeCd -= dt;
    if (this.state === 'walk') {
      this.faceTo(this.nx, this.nz);
      this.steer(this.nx * this.speed, this.nz * this.speed, dt, 4);
      if (this.touchingPlayer(0.3) && this.swipeCd <= 0) {
        g.player.hurt(15, this.pos.x, this.pos.z);
        this.swipeCd = 1.2;
      }
      if (this.dist < 12 && this.dist > 3 && this.chargeCd <= 0) {
        this.state = 'windup';
        this.t = 0.8;
        g.sound.charge();
        g.floaters.spawn(this.pos.x, 3.6, this.pos.z, '!', { cls: 'warn', life: 0.8, rise: 0.4 });
      }
    } else if (this.state === 'windup') {
      this.faceTo(this.nx, this.nz);
      this.chargeX = this.nx;
      this.chargeZ = this.nz;
      this.steer(0, 0, dt, 10);
      this.t -= dt;
      if (this.t <= 0) {
        this.state = 'charge';
        this.t = 0.9;
      }
    } else if (this.state === 'charge') {
      this.vel.set(this.chargeX * 17, 0, this.chargeZ * 17);
      if (Math.random() < 0.6) g.particles.emit(this.pos.x, 0.2, this.pos.z, { count: 2, color: 0x9aa3bd, speed: 2, up: 1, size: 0.35, life: 0.4 });
      this.t -= dt;
      if (this.touchingPlayer(0.2)) {
        if (g.player.hurt(25, this.pos.x, this.pos.z)) g.shake(0.5);
        this.state = 'recover';
        this.t = 0.8;
      } else if (this.hitWall) {
        this.state = 'stunned';
        this.t = 1.5;
        this.vel.set(0, 0, 0);
        g.shake(0.4);
        g.sound.explosion();
        g.floaters.spawn(this.pos.x, 3.6, this.pos.z, 'DIZZY', { cls: 'bonk', life: 1 });
      } else if (this.t <= 0) {
        this.state = 'recover';
        this.t = 0.6;
      }
    } else if (this.state === 'stunned') {
      this.steer(0, 0, dt, 10);
      this.t -= dt;
      if (Math.random() < 0.3) {
        const a = this.time * 6;
        g.particles.emit(this.pos.x + Math.cos(a), 3.4, this.pos.z + Math.sin(a), { count: 1, color: 0xffd84a, speed: 0.2, up: 0.2, size: 0.3, life: 0.4, gravity: 0 });
      }
      if (this.t <= 0) {
        this.state = 'walk';
        this.chargeCd = 2.5;
      }
    } else {
      this.steer(0, 0, dt, 6);
      this.t -= dt;
      if (this.t <= 0) {
        this.state = 'walk';
        this.chargeCd = 2.5;
      }
    }
  }

  animate() {
    const u = this.mesh.userData;
    const shake = this.state === 'windup' ? Math.sin(this.time * 70) * 0.08 : 0;
    u.body.position.x = shake;
    const sp = Math.min(1, Math.hypot(this.vel.x, this.vel.z) / 6);
    u.body.position.y = Math.abs(Math.sin(this.time * 6)) * 0.12 * sp;
    u.body.rotation.x = this.state === 'charge' ? 0.35 : 0;
    u.arms.forEach((a, i) => {
      a.rotation.x = this.state === 'charge' ? -1.3 : Math.sin(this.time * 6 + i * Math.PI) * 0.5 * sp;
    });
    u.pupil.position.x = clamp(this.nx * 0.08, -0.08, 0.08);
  }
}

/* Overlord Zyx: the final boss, three phases. */
export class Boss extends Enemy {
  constructor(game, x, z) {
    super(game, x, z, makeBoss(), { type: 'boss', hp: 1900, radius: 3.0, speed: 3, kbResist: 0, spawnTime: 1.6 });
    this.isBoss = true;
    this.phase = 1;
    this.attack = null;
    this.idle = 1.5;
    this.lastAttack = '';
    this.summonCd = 4;
    this.pathT = 0;
    this.home = new THREE.Vector3(x, 0, z);
    this.deathT = 0;
    this.contactCd = 0;
    // laser beam pivots around the boss
    this.laserMat = new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    this.laser = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.laserMat);
    this.laserLen = 34;
    this.laser.visible = false;
    game.world.add(this.laser);
  }

  get name() {
    return 'Overlord Zyx';
  }

  hit(dmg, dx, dz, force) {
    if (!this.active) return;
    super.hit(dmg, dx, dz, force);
    const f = this.hp / this.maxHp;
    if (this.phase === 1 && f < 0.66) this.enterPhase(2);
    else if (this.phase === 2 && f < 0.33) this.enterPhase(3);
  }

  enterPhase(n) {
    const g = this.game;
    this.phase = n;
    if (n === 2) {
      g.hud.banner('Phase 2', 'Zyx is furious', 1.8);
      g.hud.subtitle('OVERLORD ZYX: "Minions! Defend your Overlord!"', 3);
    } else {
      g.hud.banner('Phase 3', 'Brain overheating', 1.8);
      g.hud.subtitle('OVERLORD ZYX: "Enough! Behold my DEATH RAY!"', 3);
      this.mesh.userData.brainMat.emissive.set(0xff2040);
      this.mesh.userData.brainMat.emissiveIntensity = 0.9;
    }
    g.sound.alarm();
    g.shake(0.4);
    // supplies fall out of the ceiling to keep the fight fair
    for (const type of ['hay', 'golden']) {
      const s = g.arena.freeSpot(1.2);
      g.pickups.spawn(type, s.x, Math.max(s.z, 2));
    }
  }

  die(byPlayer) {
    if (this.dead) return;
    this.dead = true;
    this.dying = true;
    this.deathT = 0;
    this.endLaser();
    this.game.onBossDown(this, byPlayer);
  }

  update(dt) {
    if (this.dying) {
      this.deathT += dt;
      const g = this.game;
      this.mesh.rotation.y += dt * (2 + this.deathT * 4);
      this.mesh.position.x += Math.sin(this.deathT * 40) * 0.05;
      if (Math.random() < dt * 14) {
        g.particles.emit(this.pos.x + rand(-3, 3), rand(1, 4.5), this.pos.z + rand(-3, 3), { count: 18, colors: [0xffb347, 0xff4fd8, 0xfff1a8, 0x9cc98a], speed: 9, up: 5, size: 0.45, life: 0.8 });
        g.sound.explosion();
        g.shake(0.3);
      }
      if (this.deathT > 2.4) {
        g.particles.emit(this.pos.x, 2.5, this.pos.z, { count: 120, colors: [0xffb347, 0xff4fd8, 0xfff1a8, 0x9cc98a, 0x6fe3ff], speed: 16, up: 8, size: 0.6, life: 1.4 });
        g.rings.spawn(this.pos.x, this.pos.z, { color: 0xfff1a8, from: 1, to: 22, life: 0.9 });
        g.sound.explosion(true);
        g.shake(1.2);
        g.flash();
        this.dying = false;
        this.game.onBossGone(this);
      }
      return;
    }
    super.update(dt);
  }

  think(dt) {
    const g = this.game;
    this.faceTo(this.nx, this.nz);
    // drift along a lazy figure-eight in the north half of the bridge
    this.pathT += dt * (0.25 + this.phase * 0.06);
    const tx = this.home.x + Math.sin(this.pathT) * 8;
    const tz = this.home.z + Math.sin(this.pathT * 2) * 3;
    const mx = tx - this.pos.x;
    const mz = tz - this.pos.z;
    const l = Math.hypot(mx, mz) || 1;
    const sp = Math.min(this.speed, l);
    const slow = this.attack && this.attack.name === 'laser' ? 0.15 : 1;
    this.steer((mx / l) * sp * slow, (mz / l) * sp * slow, dt, 2);

    this.contactCd -= dt;
    if (this.touchingPlayer(0) && this.contactCd <= 0) {
      g.player.hurt(12, this.pos.x, this.pos.z);
      this.contactCd = 0.8;
    }
    this.summonCd -= dt;
    this.runAttack(dt);
  }

  pickAttack() {
    const options = ['radial', 'aimed'];
    if (this.phase >= 2) options.push('spiral', 'aimed');
    if (this.phase >= 2 && this.summonCd <= 0 && this.game.enemies.length < 6) options.push('summon', 'summon');
    if (this.phase >= 3) options.push('laser', 'laser');
    let choice = pick(options);
    if (choice === this.lastAttack && options.length > 1) choice = pick(options.filter((o) => o !== choice));
    this.lastAttack = choice;
    return choice;
  }

  runAttack(dt) {
    const g = this.game;
    if (!this.attack) {
      this.idle -= dt;
      if (this.idle <= 0) this.attack = { name: this.pickAttack(), t: 0, fired: 0, angle: rand(0, Math.PI * 2) };
      return;
    }
    const a = this.attack;
    a.t += dt;
    const fast = this.phase === 3 ? 1.25 : 1;
    const boltSpeed = this.phase === 3 ? 9 : 8;
    switch (a.name) {
      case 'radial': {
        const volleys = this.phase === 1 ? 2 : 3;
        const n = this.phase === 3 ? 22 : 16;
        while (a.fired < volleys && a.t >= 0.4 + a.fired * 0.55 / fast) {
          const off = a.angle + a.fired * (Math.PI / n);
          for (let i = 0; i < n; i++) this.shoot(off + (i / n) * Math.PI * 2, boltSpeed, 0x8dff6a);
          a.fired++;
          g.sound.zap();
        }
        if (a.t > 0.6 + volleys * 0.55) this.endAttack();
        break;
      }
      case 'aimed': {
        const volleys = 3;
        while (a.fired < volleys && a.t >= 0.3 + a.fired * 0.38 / fast) {
          const base = Math.atan2(this.nx, this.nz);
          const count = this.phase === 1 ? 5 : 7;
          for (let i = 0; i < count; i++) {
            const s = (i - (count - 1) / 2) * 0.14;
            this.shootDir(base + s, 11, 0xff4fd8);
          }
          a.fired++;
          g.sound.zap();
        }
        if (a.t > 0.5 + volleys * 0.38) this.endAttack();
        break;
      }
      case 'spiral': {
        const dur = 3;
        const every = 0.075;
        while (a.fired * every < Math.min(a.t, dur)) {
          a.angle += 0.32;
          const arms = this.phase === 3 ? 3 : 2;
          for (let k = 0; k < arms; k++) this.shoot(a.angle + (k / arms) * Math.PI * 2, 7.5, 0xffd84a);
          a.fired++;
          if (a.fired % 4 === 0) g.sound.zap();
        }
        if (a.t > dur + 0.3) this.endAttack();
        break;
      }
      case 'summon': {
        if (a.fired === 0 && a.t > 0.5) {
          a.fired = 1;
          const kinds = this.phase === 3 ? ['grunt', 'grunt', 'drone', 'shooter'] : ['grunt', 'grunt', 'grunt', 'drone'];
          kinds.forEach((k, i) => {
            const ang = (i / kinds.length) * Math.PI * 2 + rand(0, 1);
            const spot = { x: this.pos.x + Math.cos(ang) * 5.5, z: this.pos.z + Math.sin(ang) * 5.5 + 2 };
            g.spawnEnemy(k, spot.x, spot.z);
          });
          g.hud.subtitle('OVERLORD ZYX: "Seize the cow!"', 2);
          this.summonCd = 14;
        }
        if (a.t > 1.2) this.endAttack();
        break;
      }
      case 'laser': {
        const tele = 1.1;
        const sweep = 2.4;
        if (a.t < tele) {
          // telegraph: thin line that tracks the player
          a.aim = Math.atan2(this.nx, this.nz);
          this.showLaser(a.aim, 0.12, 0.35 + Math.sin(a.t * 30) * 0.15);
          if (!a.charged) {
            a.charged = true;
            g.sound.charge();
          }
        } else if (a.t < tele + sweep) {
          if (!a.fireStart) {
            a.fireStart = true;
            a.dir = Math.random() < 0.5 ? 1 : -1;
            a.from = a.aim - 1.0 * a.dir;
            g.sound.laser();
            g.shake(0.4);
          }
          const k = (a.t - tele) / sweep;
          const ang = a.from + a.dir * 2.0 * k;
          this.showLaser(ang, 1.0, 0.9);
          this.laserHits(ang);
          if (Math.random() < 0.5) {
            const d = rand(4, this.laserLen);
            g.particles.emit(this.pos.x + Math.sin(ang) * d, 0.3, this.pos.z + Math.cos(ang) * d, { count: 2, colors: [0xff3b3b, 0xffb347], speed: 3, up: 3, size: 0.3, life: 0.4 });
          }
        } else {
          this.endLaser();
          this.endAttack();
        }
        break;
      }
      default:
        this.endAttack();
    }
  }

  showLaser(ang, width, opacity) {
    const L = this.laserLen;
    this.laser.visible = true;
    this.laser.scale.set(width, width * 0.6, L);
    this.laser.rotation.y = ang;
    this.laser.position.set(this.pos.x + Math.sin(ang) * (L / 2 + 2), 1.2, this.pos.z + Math.cos(ang) * (L / 2 + 2));
    this.laserMat.opacity = opacity;
  }

  laserHits(ang) {
    const pl = this.game.player;
    const dx = pl.pos.x - this.pos.x;
    const dz = pl.pos.z - this.pos.z;
    const along = dx * Math.sin(ang) + dz * Math.cos(ang);
    const perp = Math.abs(dx * Math.cos(ang) - dz * Math.sin(ang));
    if (along > 0 && along < this.laserLen + 2 && perp < 0.5 + pl.radius * 0.7) {
      pl.hurt(20, this.pos.x, this.pos.z);
    }
  }

  endLaser() {
    this.laser.visible = false;
    this.laserMat.opacity = 0;
  }

  endAttack() {
    this.attack = null;
    this.idle = this.phase === 3 ? 0.55 : this.phase === 2 ? 0.85 : 1.2;
  }

  shoot(ang, speed, color) {
    const dx = Math.sin(ang);
    const dz = Math.cos(ang);
    this.game.projectiles.fireBolt(this.pos.x + dx * 3.2, 1.2, this.pos.z + dz * 3.2, dx, dz, { speed, damage: 10, color, size: 0.55 });
  }

  shootDir(ang, speed, color) {
    // aimed shots leave from the cannon arms
    const side = this.fireSide = -(this.fireSide || 1);
    const ox = Math.cos(this.mesh.rotation.y) * 3.2 * side;
    const oz = -Math.sin(this.mesh.rotation.y) * 3.2 * side;
    const dx = Math.sin(ang);
    const dz = Math.cos(ang);
    this.game.projectiles.fireBolt(this.pos.x + ox + dx * 0.8, 1.6, this.pos.z + oz + dz * 0.8, dx, dz, { speed, damage: 10, color, size: 0.5 });
  }

  animate(dt) {
    const u = this.mesh.userData;
    u.body.position.y = 0.6 + Math.sin(this.time * 1.6) * 0.25;
    u.brain.rotation.y += dt * 0.5;
    u.brain.scale.y = 0.8 + Math.sin(this.time * (this.phase === 3 ? 9 : 3)) * 0.04;
    const flick = Math.floor(this.time * (4 + this.phase * 2));
    u.lights.forEach((l, i) => l.scale.setScalar((flick + i) % 3 === 0 ? 0.34 : 0.22));
    const charging = this.attack && (this.attack.name === 'aimed' || this.attack.name === 'laser');
    u.cannons.forEach((c) => c.orb.scale.setScalar(charging ? 0.6 + Math.sin(this.time * 20) * 0.1 : 0.5));
  }

  dispose() {
    this.game.world.remove(this.laser);
    this.laser.geometry.dispose();
    this.laserMat.dispose();
  }
}

export const ENEMY_TYPES = { grunt: Grunt, shooter: Shooter, drone: Drone, brute: Brute, boss: Boss };

