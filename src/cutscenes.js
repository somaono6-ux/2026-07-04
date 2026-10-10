// Scripted scenes on the farm: the title backdrop, the abduction, and the homecoming.
import * as THREE from 'three';
import { makeCow, animateCow, makeUFO, setUFOBeam, animateUFO } from './models.js';
import { clamp, easeInOutSine, easeOutCubic, rand, pick } from './util.js';

class Scene {
  constructor(game, mode) {
    this.g = game;
    this.farm = game.loadFarm(mode);
    this.c = this.farm.cowSpot.clone();
    this.t = 0;
    this.cues = new Set();
    this.camPos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.first = true;
  }

  cue(name, at, fn) {
    if (this.t >= at && !this.cues.has(name)) {
      this.cues.add(name);
      fn();
    }
  }

  // Smoothly move the camera toward a shot.
  shot(dt, pos, look, speed = 2.5) {
    if (this.first) {
      this.camPos.copy(pos);
      this.look.copy(look);
      this.first = false;
    }
    const k = 1 - Math.exp(-speed * dt);
    this.camPos.lerp(pos, k);
    this.look.lerp(look, k);
    const cam = this.g.camera;
    cam.position.copy(this.camPos);
    cam.lookAt(this.look);
  }
}

export class TitleScene extends Scene {
  constructor(game) {
    super(game, 'night');
    this.cow = makeCow();
    this.cow.position.copy(this.c);
    this.cow.rotation.y = -0.9;
    game.world.add(this.cow);
    this.ufo = makeUFO();
    this.ufo.position.set(this.c.x + 4, 10, this.c.z - 14);
    game.world.add(this.ufo);
  }

  update(dt) {
    this.t += dt;
    const t = this.t;
    const c = this.c;
    animateCow(this.cow, dt, 0, { graze: 0.6 + Math.sin(t * 0.7) * 0.4 });
    this.ufo.position.y = 10 + Math.sin(t * 0.9) * 0.4;
    this.ufo.position.x = c.x + 4 + Math.sin(t * 0.35) * 1.5;
    this.ufo.rotation.y += dt * 0.6;
    animateUFO(this.ufo, t);
    // a faint scanning beam hints at what is coming
    setUFOBeam(this.ufo, 0.22 + Math.sin(t * 1.3) * 0.08, 0, t);
    const sway = Math.sin(t * 0.18) * 1.5;
    this.shot(dt, new THREE.Vector3(c.x - 3 + sway, 3, c.z + 12), new THREE.Vector3(c.x - 4.5 + sway * 0.5, 3.4, c.z), 3);
  }
}

export class IntroScene extends Scene {
  constructor(game) {
    super(game, 'night');
    const c = this.c;
    this.cow = makeCow();
    this.cow.position.copy(c);
    this.cow.rotation.y = -0.5;
    game.world.add(this.cow);
    this.ufo = makeUFO();
    this.ufoStart = new THREE.Vector3(-55, 55, -95);
    this.ufo.position.copy(this.ufoStart);
    game.world.add(this.ufo);
    this.stopHum = null;
    this.done = false;
    game.sound.stopMusic();
  }

  finish() {
    if (this.done) return;
    this.done = true;
    if (this.stopHum) this.stopHum();
    this.g.hud.clearMessages();
    this.g.onIntroDone();
  }

  update(dt) {
    const g = this.g;
    this.t += dt;
    const t = this.t;
    const c = this.c;
    const hud = g.hud;

    this.cue('s1', 0.3, () => hud.subtitle('Iowa. 2:14 AM.', 1.6));
    this.cue('s2', 2.0, () => hud.subtitle('Bessie is enjoying a midnight snack.', 2.0));
    this.cue('hum', 3.4, () => {
      this.stopHum = g.sound.hum();
      hud.subtitle('Then the sky starts to hum.', 2.4);
    });
    this.cue('look', 5.8, () => {
      g.floaters.spawn(c.x, 3, c.z, '?!', { cls: 'warn', life: 1.2 });
      g.sound.moo(1.3, 0.4, 0.4);
    });
    this.cue('beam', 6.4, () => g.sound.teleport());
    this.cue('moo', 7.3, () => {
      g.sound.moo(1.45, 1.1, 0.55);
      g.floaters.spawn(c.x, 4.5, c.z, 'MOOO?!', { cls: 'moo', life: 1.4, rise: 2 });
      hud.subtitle('Bessie has been abducted!', 2.6);
    });
    this.cue('away', 10.4, () => {
      if (this.stopHum) this.stopHum();
      this.stopHum = null;
      g.sound.teleport();
    });
    this.cue('s4', 11.2, () => hud.subtitle('Now she has to fight her way home.', 2.6));
    this.cue('fade', 12.6, () => g.fadeTo(1, 0.7));
    if (t > 13.5) this.finish();

    // Bessie
    const rise = t > 7 ? easeInOutSine(clamp((t - 7) / 3.1, 0, 1)) : 0;
    let graze = 1;
    if (t > 5.5) graze = -0.45 * clamp((t - 5.5) / 0.3, 0, 1);
    this.cow.position.y = rise * 10.4;
    this.cow.visible = t < 10.1;
    if (t > 7) {
      this.cow.rotation.y += dt * 1.6 * rise;
      this.cow.rotation.z = Math.sin(t * 3) * 0.3 * rise;
    }
    animateCow(this.cow, dt, t > 7 ? 1 : 0, { graze });

    // the saucer
    const u = this.ufo;
    if (t < 3.4) u.position.copy(this.ufoStart);
    else if (t < 6.1) {
      const k = easeInOutSine((t - 3.4) / 2.7);
      u.position.lerpVectors(this.ufoStart, new THREE.Vector3(c.x, 11, c.z), k);
    } else if (t < 10.4) {
      u.position.set(c.x + Math.sin(t * 1.3) * 0.3, 11 + Math.sin(t * 2) * 0.25, c.z);
    } else {
      const k = t - 10.4;
      u.position.set(c.x + k * k * 14, 11 + k * k * 22, c.z - k * k * 26);
    }
    u.rotation.y += dt * 1.2;
    animateUFO(u, t);
    let beam = 0;
    if (t > 6.4 && t < 10.3) beam = Math.min(1, (t - 6.4) / 0.3, (10.3 - t) / 0.3);
    setUFOBeam(u, beam, 0, t);
    if (beam > 0.5 && Math.random() < 0.5) {
      g.particles.emit(c.x + rand(-2, 2), rand(0, this.cow.position.y + 1), c.z + rand(-2, 2), { count: 1, color: 0x9ff4ff, speed: 0.2, up: 3, size: 0.18, life: 0.8, gravity: -2 });
    }

    // camera
    const cowY = this.cow.position.y;
    if (t < 3.4) {
      const k = t / 3.4;
      this.shot(dt, new THREE.Vector3(c.x + 14 - k * 5, 5 - k * 2, c.z + 16 - k * 6), new THREE.Vector3(c.x, 1, c.z), 3);
    } else if (t < 6.1) {
      this.shot(dt, new THREE.Vector3(c.x + 11, 1.3, c.z + 15), new THREE.Vector3(c.x, 1, c.z).lerp(u.position, 0.42), 1.5);
    } else if (t < 10.4) {
      this.shot(dt, new THREE.Vector3(c.x + 11, 1.3 + cowY * 0.3, c.z + 15), new THREE.Vector3(c.x, cowY + 1, c.z).lerp(u.position, 0.35), 2.5);
    } else {
      this.shot(dt, new THREE.Vector3(c.x + 8, 5, c.z + 12), u.position, 3);
    }
  }
}

export class EndingScene extends Scene {
  constructor(game) {
    super(game, 'dawn');
    const c = this.c;
    this.cow = makeCow();
    this.cow.position.set(c.x, 16, c.z);
    game.world.add(this.cow);
    this.pod = makeUFO();
    this.pod.scale.setScalar(0.4);
    this.pod.position.set(c.x, 19, c.z);
    game.world.add(this.pod);
    this.mother = makeUFO();
    this.mother.scale.setScalar(2.4);
    this.motherPos = new THREE.Vector3(-30, 52, -130);
    this.mother.position.copy(this.motherPos);
    game.world.add(this.mother);
    this.shownVictory = false;
    this.nextFirework = 0;
    game.sound.playMusic('home');
  }

  firework(x, y, z, big = false) {
    const palette = pick([
      [0xff4fd8, 0xffd84a], [0x6fe3ff, 0xffffff], [0x8dff6a, 0xffd84a], [0xff6b5a, 0xfff1a8], [0xb07cff, 0x6fe3ff],
    ]);
    this.g.particles.emit(x, y, z, {
      count: big ? 140 : 70, colors: palette, speed: big ? 26 : 16, up: 2, size: big ? 1.6 : 1.1,
      life: 1.7, gravity: 3, drag: 1.1,
    });
    this.g.sound.firework();
  }

  update(dt) {
    const g = this.g;
    this.t += dt;
    const t = this.t;
    const c = this.c;
    const hud = g.hud;

    this.cue('s1', 0.4, () => hud.subtitle('Dawn. Back on the farm.', 2.6));
    this.cue('land', 3.4, () => {
      g.rings.spawn(c.x, c.z, { color: 0xffffff, from: 0.5, to: 5, life: 0.6 });
      g.particles.emit(c.x, 0.2, c.z, { count: 30, colors: [0xc9b48a, 0x8fbf63], speed: 6, up: 2, size: 0.3, life: 0.7 });
      g.sound.explosion();
    });
    this.cue('moo', 3.9, () => {
      g.sound.moo(1.05, 1.2, 0.55);
      g.floaters.spawn(c.x, 3.4, c.z, 'MOO!', { cls: 'moo', life: 1.4 });
    });
    this.cue('boom', 5.6, () => {
      this.mother.visible = false;
      this.firework(this.motherPos.x, this.motherPos.y, this.motherPos.z, true);
      g.sound.explosion(true);
      g.hud.flash();
    });
    this.cue('s2', 6.2, () => hud.subtitle('The mothership won\'t be bothering anyone again.', 3));
    this.cue('s3', 9.4, () => hud.subtitle('Bessie is home.', 2.5));
    this.cue('win', 11.5, () => {
      this.shownVictory = true;
      g.showVictory();
    });

    // Bessie floats down in the escape pod's beam, then munches grass
    const k = clamp(t / 3.4, 0, 1);
    this.cow.position.y = (1 - easeOutCubic(k)) * 16;
    this.cow.rotation.y = -0.4 + (1 - k) * 4;
    const grazing = t > 7 ? 1 : 0;
    animateCow(this.cow, dt, t < 3.4 ? 0.5 : 0, { graze: grazing });

    const p = this.pod;
    if (t > 4.4) {
      const f = t - 4.4;
      p.position.set(c.x + f * f * 8, 19 + f * f * 14, c.z - f * f * 18);
    }
    p.rotation.y += dt * 2;
    animateUFO(p, t);
    setUFOBeam(p, t < 3.7 ? 1 : Math.max(0, 1 - (t - 3.7) * 3), 0, t);

    this.mother.position.x = this.motherPos.x + Math.sin(t * 0.5) * 2;
    this.mother.rotation.y += dt * 0.4;
    animateUFO(this.mother, t);

    if (t > 5.8 && t > this.nextFirework) {
      this.nextFirework = t + rand(0.35, 0.9);
      this.firework(this.motherPos.x + rand(-40, 40), this.motherPos.y + rand(-10, 20), this.motherPos.z + rand(-20, 20));
    }

    // camera
    if (t < 3.6) {
      this.shot(dt, new THREE.Vector3(c.x + 7, 1.8, c.z + 10), new THREE.Vector3(c.x, this.cow.position.y + 1, c.z), 3);
    } else if (t < 5.2) {
      this.shot(dt, new THREE.Vector3(c.x + 6, 2.2, c.z + 9), new THREE.Vector3(c.x, 1.4, c.z), 2);
    } else {
      const a = (t - 5.2) * 0.04;
      this.shot(dt, new THREE.Vector3(c.x + 7 + Math.sin(a) * 2, 2.4, c.z + 12), new THREE.Vector3(c.x - 12, 9, c.z - 20), 1.2);
    }
  }
}
