// Cowsmic Escape: game state, level flow, camera, and the main loop.
import * as THREE from 'three';
import { Sound } from './audio.js';
import { Input } from './input.js';
import { Particles, Rings, Columns, FloatingText } from './effects.js';
import { Arena, buildFarm } from './world.js';
import { LEVELS } from './levels.js';
import { Player } from './player.js';
import { ENEMY_TYPES } from './enemies.js';
import { Projectiles, Pickups } from './projectiles.js';
import { HUD } from './hud.js';
import { TitleScene, IntroScene, EndingScene } from './cutscenes.js';
import { disposeTree } from './models.js';
import { makeEnvironment } from './textures.js';
import { clamp, rand } from './util.js';

const $ = (id) => document.getElementById(id);
const store = {
  get(k) {
    try { return localStorage.getItem(k); } catch (_) { return null; }
  },
  set(k, v) {
    try { localStorage.setItem(k, v); } catch (_) { /* storage is optional */ }
  },
};

const ALIEN_NAMES = { grunt: 'Zorblets', shooter: 'Zappers', drone: 'Probe Drones', brute: 'Gloopzillas' };
const GORE = {
  grunt: [0x8dff6a, 0x5fd14a, 0xffd84a],
  shooter: [0xb07cff, 0xff4fd8, 0x28406e],
  drone: [0xc9d2e6, 0x6fe3ff, 0xffb347],
  brute: [0xc9478f, 0xf08cc0, 0x8dff6a],
  boss: [0x9cc98a, 0xf29bb5],
};
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

class Game {
  constructor() {
    this.canvas = $('game');
    this.coarse = matchMedia('(pointer: coarse)').matches;
    this.shadows = !this.coarse;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.coarse ? 1.5 : 2));
    this.renderer.shadowMap.enabled = this.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.scene.environment = makeEnvironment(this.renderer);
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 900);
    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.particles = new Particles(this.scene);
    this.particles.mesh.material.fog = false;
    this.rings = new Rings(this.scene);
    this.columns = new Columns(this.scene);
    this.floaters = new FloatingText($('floaters'));
    this.sound = new Sound();
    this.input = new Input(this.canvas, $('touch'));
    this.hud = new HUD(this);
    this.player = new Player(this);
    this.projectiles = new Projectiles(this);
    this.pickups = new Pickups(this);

    this.enemies = [];
    this.boss = null;
    this.arena = null;
    this.cutscene = null;
    this.state = 'title';
    this.levelIndex = 0;
    this.levelState = 'none';
    this.time = 0;
    this.score = 0;
    this.runTime = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.shakeAmt = 0;
    this.fade = 1;
    this.fadeTarget = 0;
    this.fadeSpeed = 1;
    this.lastTeleportSfx = 0;
    this.camPos = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
    this.camScale = 1;
    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.2);
    this.tmp = new THREE.Vector3();
    this.best = Number(store.get('cowsmic-best') || 0);
    this.muted = store.get('cowsmic-muted') === '1';
    this.sound.setMuted(this.muted);

    this.bindUI();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause(true);
    });
    this.showTitle();
    this.last = performance.now();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  get level() {
    return LEVELS[this.levelIndex];
  }

  /* ---------------- UI wiring ---------------- */

  bindUI() {
    const on = (id, fn) => $(id).addEventListener('click', (e) => {
      e.stopPropagation();
      this.sound.unlock();
      this.sound.click();
      fn();
    });
    on('playBtn', () => this.startIntro());
    on('skipBtn', () => this.newRun());
    on('resumeBtn', () => this.pause(false));
    on('restartBtn', () => {
      this.pause(false);
      this.retryLevel();
    });
    on('quitBtn', () => this.showTitle());
    on('retryBtn', () => this.retryLevel());
    on('overQuitBtn', () => this.showTitle());
    on('againBtn', () => this.newRun());
    on('winTitleBtn', () => this.showTitle());
    on('pauseBtn', () => this.pause(this.state === 'playing'));
    on('muteBtn', () => this.toggleMute());
    this.updateMuteButton();

    window.addEventListener('pointerdown', () => this.sound.unlock(), { capture: true });
    window.addEventListener('pointerdown', (e) => {
      if (this.state === 'intro' && this.cutscene && this.cutscene.t > 0.6 && !e.target.closest('button')) this.cutscene.finish();
    });
    this.input.onAnyKey((e) => {
      this.sound.unlock();
      if (this.state === 'intro' && this.cutscene && this.cutscene.t > 0.6 && !['KeyM', 'Escape', 'KeyP'].includes(e.code)) {
        this.cutscene.finish();
      }
    });
  }

  showScreen(id) {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    for (const el of document.querySelectorAll('.screen')) el.hidden = el.id !== id;
    document.body.classList.toggle('menu-open', !!id);
  }

  toggleMute() {
    this.muted = !this.muted;
    this.sound.setMuted(this.muted);
    store.set('cowsmic-muted', this.muted ? '1' : '0');
    this.updateMuteButton();
  }

  updateMuteButton() {
    const b = $('muteBtn');
    b.classList.toggle('off', this.muted);
    b.setAttribute('aria-label', this.muted ? 'Turn sound on' : 'Mute sound');
    b.title = this.muted ? 'Sound off (M)' : 'Sound on (M)';
  }

  pause(on) {
    if (on && this.state === 'playing') {
      this.state = 'paused';
      this.showScreen('pauseScreen');
      if (this.sound.ctx) this.sound.ctx.suspend();
    } else if (!on && this.state === 'paused') {
      this.state = 'playing';
      this.showScreen(null);
      if (this.sound.ctx) this.sound.ctx.resume();
      this.last = performance.now();
    }
  }

  fadeTo(target, dur = 0.6) {
    this.fadeTarget = target;
    this.fadeSpeed = 1 / Math.max(0.01, dur);
  }

  flash() {
    this.hud.flash();
  }

  shake(a) {
    this.shakeAmt = Math.max(this.shakeAmt, a * (reducedMotion ? 0.25 : 1));
  }

  /* ---------------- scenes ---------------- */

  clearWorld() {
    this.projectiles.clear();
    this.pickups.clear();
    this.enemies = [];
    this.boss = null;
    this.rings.clear();
    this.columns.clear();
    this.floaters.clear();
    this.particles.hideAll();
    for (const child of [...this.world.children]) {
      this.world.remove(child);
      if (child !== this.player.mesh) disposeTree(child);
    }
    this.arena = null;
  }

  loadFarm(mode) {
    this.clearWorld();
    const farm = buildFarm(mode, { shadows: this.shadows });
    this.world.add(farm.group);
    this.scene.fog = farm.fog;
    this.scene.background = farm.background;
    return farm;
  }

  loadArena(level) {
    this.clearWorld();
    this.arena = new Arena(level, { shadows: this.shadows });
    this.world.add(this.arena.group);
    this.scene.fog = new THREE.Fog(level.theme.fog, 55, 150);
    this.scene.background = new THREE.Color(level.theme.fog);
  }

  showTitle() {
    this.state = 'title';
    this.hud.show(false);
    this.hud.clearMessages();
    this.hud.hideIndicators();
    this.showScreen('titleScreen');
    document.body.classList.remove('playing');
    this.cutscene = new TitleScene(this);
    this.sound.playMusic('title');
    if (this.sound.ctx && this.sound.ctx.state === 'suspended') this.sound.ctx.resume();
    $('bestLine').hidden = this.best <= 0;
    $('bestScore').textContent = this.best.toLocaleString('en-US');
    this.fade = 1;
    this.fadeTo(0, 1.2);
  }

  startIntro() {
    this.state = 'intro';
    this.showScreen(null);
    this.hud.show(false);
    this.cutscene = new IntroScene(this);
    this.fade = 1;
    this.fadeTo(0, 0.8);
  }

  onIntroDone() {
    this.newRun();
  }

  newRun() {
    this.score = 0;
    this.runTime = 0;
    this.startLevel(0);
  }

  retryLevel() {
    this.score = this.levelStartScore;
    this.startLevel(this.levelIndex);
  }

  startLevel(i) {
    this.levelIndex = i;
    const L = LEVELS[i];
    this.cutscene = null;
    this.loadArena(L);
    this.player.reset(0, L.d / 2 - 4);
    this.world.add(this.player.mesh);
    this.levelStartScore = this.score;
    this.combo = 0;
    this.comboTimer = 0;
    this.waveIndex = -1;
    this.spawnQueue = [];
    this.waveDelay = 2.6;
    this.levelState = 'intro';
    this.levelTime = 0;
    this.hintStep = 0;
    this.state = 'playing';
    this.showScreen(null);
    this.hud.show(true);
    this.hud.clearMessages();
    this.hud.setLevel(L);
    this.hud.setWave('Get ready');
    this.hud.banner(L.kicker, L.name, 2.4);
    this.hud.subtitle(L.taunt, 4.2);
    document.body.classList.add('playing');
    this.sound.playMusic(L.boss ? 'boss' : 'battle');
    this.updateCamera(0, true);
    this.fade = 1;
    this.fadeTo(0, 0.7);
  }

  startEnding() {
    this.state = 'ending';
    this.hud.show(false);
    this.hud.clearMessages();
    this.hud.hideIndicators();
    document.body.classList.remove('playing');
    this.cutscene = new EndingScene(this);
    this.fade = 1;
    this.fadeTo(0, 1.4);
  }

  showVictory() {
    this.state = 'victory';
    const newBest = this.score > this.best;
    if (newBest) {
      this.best = this.score;
      store.set('cowsmic-best', String(this.best));
    }
    $('winScore').textContent = this.score.toLocaleString('en-US');
    const s = Math.floor(this.runTime);
    $('winTime').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    $('winBest').textContent = this.best.toLocaleString('en-US');
    $('newBest').hidden = !newBest;
    this.showScreen('winScreen');
  }

  showGameOver() {
    this.state = 'gameover';
    if (this.score > this.best) {
      this.best = this.score;
      store.set('cowsmic-best', String(this.best));
    }
    $('overLine').textContent = `You reached ${this.level.kicker.toLowerCase()}, ${this.level.name}, with ${this.score.toLocaleString('en-US')} points. The aliens are already warming up the cheese vat.`;
    this.showScreen('overScreen');
  }

  /* ---------------- waves ---------------- */

  startWave(i) {
    const L = this.level;
    this.waveIndex = i;
    const def = L.waves[i];
    this.levelState = 'wave';
    this.sound.alarm();
    if (def.boss) {
      this.spawnQueue = [];
      this.spawnEnemy('boss', 0, -L.d / 2 + 7.5);
      this.hud.banner('Final boss', 'Overlord Zyx', 2.6);
      this.hud.setWave('Defeat Overlord Zyx');
      return;
    }
    const queue = [];
    for (const [type, n] of Object.entries(def)) for (let k = 0; k < n; k++) queue.push(type);
    for (let k = queue.length - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1));
      [queue[k], queue[j]] = [queue[j], queue[k]];
    }
    this.spawnQueue = queue;
    this.spawnTimer = 0.2;
    const names = Object.keys(def).map((t) => ALIEN_NAMES[t]);
    this.hud.banner(`Wave ${i + 1} of ${L.waves.length}`, names.join(' + '), 1.8);
    if (i > 0 && this.player.hp < 55) {
      const s = this.arena.freeSpot(1.2);
      this.pickups.spawn('hay', s.x, s.z);
    }
  }

  waveCleared() {
    const L = this.level;
    if (this.waveIndex < L.waves.length - 1) {
      this.levelState = 'between';
      this.waveDelay = 2.6;
      this.hud.toast('Wave cleared', 1.6);
      if (L.tutorial) this.showHint(this.waveIndex + 1);
    } else {
      this.levelCleared();
    }
  }

  levelCleared() {
    this.levelState = 'exit';
    this.arena.openDoor();
    this.sound.door();
    this.projectiles.clearBolts();
    const last = this.levelIndex === LEVELS.length - 1;
    this.hud.banner('Deck clear', last ? 'Escape beam open' : 'Door open', 2.4);
    this.hud.toast(last ? 'Run through the north door to beam home' : 'Head through the north door', 4);
    this.hud.setWave('Exit open: go north');
  }

  leaveLevel() {
    this.levelState = 'leaving';
    this.leaveT = 1.1;
    this.sound.teleport();
    this.columns.spawn(this.player.pos.x, this.player.pos.z, { color: 0x9dff7a, radius: 1.6, height: 8, life: 1.1 });
    this.fadeTo(1, 0.9);
  }

  choosePad() {
    const p = this.player.pos;
    const pads = this.arena.pads
      .map(([x, z]) => ({ x, z, d: Math.hypot(x - p.x, z - p.z) }))
      .sort((a, b) => b.d - a.d);
    const far = pads.filter((pd) => pd.d > 8);
    const pool = far.length ? far.slice(0, Math.max(3, Math.ceil(far.length * 0.7))) : pads.slice(0, 1);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  spawnEnemy(type, x, z) {
    const Cls = ENEMY_TYPES[type];
    const e = new Cls(this, x, z);
    this.world.add(e.mesh);
    this.enemies.push(e);
    this.columns.spawn(x, z, {
      color: type === 'boss' ? 0xff4fd8 : 0x8dff6a,
      radius: e.radius + 0.5,
      height: type === 'boss' ? 14 : 6,
      life: e.spawnDur + 0.25,
    });
    if (this.time - this.lastTeleportSfx > 0.2) {
      this.sound.teleport();
      this.lastTeleportSfx = this.time;
    }
    if (type === 'boss') this.boss = e;
    return e;
  }

  updateWaves(dt) {
    const L = this.level;
    switch (this.levelState) {
      case 'intro':
      case 'between':
        this.waveDelay -= dt;
        if (this.waveDelay <= 0) this.startWave(this.waveIndex + 1);
        break;
      case 'wave': {
        if (this.spawnQueue.length) {
          this.spawnTimer -= dt;
          if (this.spawnTimer <= 0) {
            const pad = this.choosePad();
            this.spawnEnemy(this.spawnQueue.shift(), pad.x + rand(-0.5, 0.5), pad.z + rand(-0.5, 0.5));
            this.spawnTimer = 0.45;
          }
        } else if (this.enemies.length === 0) {
          this.waveCleared();
          break;
        }
        if (!L.waves[this.waveIndex].boss) {
          const left = this.spawnQueue.length + this.enemies.filter((e) => !e.dead).length;
          this.hud.setWave(`Wave ${this.waveIndex + 1}/${L.waves.length} · ${left} alien${left === 1 ? '' : 's'} left`);
        }
        break;
      }
      case 'exit':
        if (this.arena.reachedExit(this.player.pos)) this.leaveLevel();
        break;
      case 'leaving':
        this.leaveT -= dt;
        this.player.mesh.position.y += dt * 5;
        this.player.facing += dt * 8;
        if (this.leaveT <= 0) {
          if (this.levelIndex < LEVELS.length - 1) this.startLevel(this.levelIndex + 1);
          else this.startEnding();
        }
        break;
      default:
        break;
    }
  }

  showHint(step) {
    const dev = this.input.device;
    const hints = {
      touch: [
        'Left thumb moves. Hold your right thumb down to squirt milk, drag it to aim.',
        'Tap DASH to charge through aliens. Nothing can hit you mid-dash.',
        'Tap MOO for a Mega Moo shockwave that also erases plasma shots.',
      ],
      gamepad: [
        'Left stick moves. Right stick aims and squirts milk.',
        'Press A to Hoof Dash. Nothing can hit you mid-dash.',
        'Press B for a Mega Moo shockwave that also erases plasma shots.',
      ],
      mouse: [
        'WASD to move. Aim with the mouse and hold click to squirt milk.',
        'Press Space to Hoof Dash. Nothing can hit you mid-dash.',
        'Press Q or right-click for a Mega Moo shockwave that also erases plasma shots.',
      ],
    };
    const set = hints[dev] || hints.mouse;
    if (set[step]) this.hud.toast(set[step], 6);
  }

  /* ---------------- events from entities ---------------- */

  comboMult() {
    return this.combo > 0 ? Math.min(5, 1 + Math.floor((this.combo - 1) / 2)) : 1;
  }

  onEnemyKilled(e, byPlayer) {
    const p = e.pos;
    const y = e.type === 'drone' ? p.y : 1;
    this.particles.emit(p.x, y, p.z, {
      count: e.type === 'brute' ? 40 : 22, colors: GORE[e.type], speed: 7, up: 4, size: e.type === 'brute' ? 0.4 : 0.3, life: 0.75,
    });
    this.rings.spawn(p.x, p.z, { color: GORE[e.type][0], from: 0.4, to: e.radius * 3, life: 0.35 });
    this.sound.alienDie();
    this.shake(e.type === 'brute' ? 0.35 : 0.12);
    if (!byPlayer || e.isBoss) return;
    this.combo = this.comboTimer > 0 ? this.combo + 1 : 1;
    this.comboTimer = 2.5;
    const mult = this.comboMult();
    const pts = e.score * mult;
    this.score += pts;
    this.floaters.spawn(p.x, 2.4, p.z, mult > 1 ? `+${pts} ×${mult}` : `+${pts}`, { cls: mult > 1 ? 'score combo' : 'score' });
    const lowHp = this.player.hp < 50;
    const r = Math.random();
    const hayChance = lowHp ? 0.16 : 0.08;
    if (r < hayChance) this.pickups.spawn('hay', p.x, p.z);
    else if (r < hayChance + 0.055) this.pickups.spawn('golden', p.x, p.z);
  }

  onBossDown(boss) {
    this.score += boss.score;
    this.floaters.spawn(boss.pos.x, 5, boss.pos.z, `+${boss.score}`, { cls: 'score combo', life: 1.6 });
    this.hud.subtitle('OVERLORD ZYX: "Impossible! Defeated by a... COW?!"', 3.2);
    this.projectiles.clearBolts();
    for (const e of this.enemies) if (e !== boss && !e.dead) e.die(false);
    this.sound.stopMusic();
  }

  onBossGone() {
    this.hud.banner('Overlord defeated', 'The ship is yours', 2.4);
    this.sound.playMusic('home');
  }

  onPlayerHurt() {
    this.shake(0.4);
    this.hud.hurt();
    this.sound.hurt();
    const p = this.player.pos;
    this.particles.emit(p.x, 1.2, p.z, { count: 10, colors: [0xffffff, 0x1d1c22, 0xf3a1b0], speed: 4, up: 3, size: 0.22, life: 0.5 });
  }

  onPlayerDied() {
    this.state = 'dead';
    this.deadT = 0;
    this.sound.stopMusic();
    this.sound.moo(0.72, 1.5, 0.5);
    this.hud.subtitle('ALIEN PA: "Specimen recovered. Prepare the cheese vat."', 3);
  }

  /* ---------------- queries ---------------- */

  mouseGround() {
    this.ndc.set(this.input.mouse.ndcX, this.input.mouse.ndcY);
    this.ray.setFromCamera(this.ndc, this.camera);
    return this.ray.ray.intersectPlane(this.aimPlane, this.tmp);
  }

  nearestEnemy(pos, range) {
    let best = null;
    let bd = range;
    for (const e of this.enemies) {
      if (!e.active) continue;
      const d = Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z) - e.radius;
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  /* ---------------- per-frame ---------------- */

  separate() {
    const es = this.enemies;
    const pl = this.player;
    for (let i = 0; i < es.length; i++) {
      const a = es[i];
      if (!a.active) continue;
      for (let j = i + 1; j < es.length; j++) {
        const b = es[j];
        if (!b.active || (a.type === 'drone') !== (b.type === 'drone')) continue;
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const min = a.radius + b.radius;
        const d2 = dx * dx + dz * dz;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2) || 0.01;
        const push = min - d;
        const wa = a.isBoss ? 0 : b.isBoss ? 1 : 0.5;
        const wb = 1 - wa;
        a.pos.x -= (dx / d) * push * wa;
        a.pos.z -= (dz / d) * push * wa;
        b.pos.x += (dx / d) * push * wb;
        b.pos.z += (dz / d) * push * wb;
      }
      if (a.type === 'drone' || pl.dead) continue;
      const dx = a.pos.x - pl.pos.x;
      const dz = a.pos.z - pl.pos.z;
      const min = a.radius + pl.radius;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min) {
        const d = Math.sqrt(d2) || 0.01;
        const push = min - d;
        if (a.isBoss) {
          pl.pos.x -= (dx / d) * push;
          pl.pos.z -= (dz / d) * push;
        } else {
          a.pos.x += (dx / d) * push;
          a.pos.z += (dz / d) * push;
        }
      }
    }
  }

  cleanupEnemies() {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.dead && !e.dying) {
        this.world.remove(e.mesh);
        if (e.dispose) e.dispose();
        disposeTree(e.mesh);
        this.enemies.splice(i, 1);
      }
    }
  }

  updatePlaying(dt) {
    const controls = this.state === 'playing' && this.levelState !== 'leaving';
    this.levelTime += dt;
    if (this.state === 'playing') this.runTime += dt;
    this.player.update(dt, this.input, controls);
    for (const e of this.enemies) e.update(dt);
    this.separate();
    this.cleanupEnemies();
    this.projectiles.update(dt);
    this.pickups.update(dt);
    this.arena.update(dt, this.time);
    if (this.state === 'playing') this.updateWaves(dt);
    this.comboTimer -= dt;
    if (this.comboTimer <= 0) this.combo = 0;
    if (this.level.tutorial && this.hintStep === 0 && this.levelTime > 2.8) {
      this.hintStep = 1;
      this.showHint(0);
    }
    this.updateCamera(dt);
    this.hud.update();
    if (this.state === 'dead') {
      this.deadT += dt;
      if (this.deadT > 2) this.showGameOver();
    }
  }

  updateCamera(dt, snap = false) {
    const p = this.player.pos;
    const s = this.camScale * (this.level && this.level.boss ? 1.14 : 1);
    let tx = p.x + this.player.aimX * 1.2;
    let tz = p.z + this.player.aimZ * 1.2 - 1;
    // keep the view over the deck instead of the void beyond its walls
    if (this.arena) {
      const mx = Math.max(0, this.arena.w / 2 - 9 * s);
      const mz = Math.max(0, this.arena.d / 2 - 6.5 * s);
      tx = clamp(tx, -mx, mx);
      tz = clamp(tz, -mz - 1.5, mz);
    }
    const desired = this.tmp.set(tx, 16 * s, tz + 13.5 * s);
    if (snap) {
      this.camPos.copy(desired);
      this.camLook.set(tx, 0, tz);
    } else {
      const k = 1 - Math.exp(-6 * dt);
      this.camPos.lerp(desired, k);
      this.camLook.x += (tx - this.camLook.x) * k;
      this.camLook.y = 0;
      this.camLook.z += (tz - this.camLook.z) * k;
    }
    this.camera.position.copy(this.camPos);
    if (this.shakeAmt > 0.001) {
      const a = this.shakeAmt;
      this.camera.position.x += (Math.random() - 0.5) * a;
      this.camera.position.y += (Math.random() - 0.5) * a;
      this.camera.position.z += (Math.random() - 0.5) * a;
    }
    this.camera.lookAt(this.camLook);
    this.camera.updateMatrixWorld();
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // widen the view on tall phone screens so the arena stays readable
    this.camScale = clamp(22 / (19.6 * this.camera.aspect), 1, 2.1);
  }

  frame() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.step(dt);
    this.renderer.render(this.scene, this.camera);
  }

  // Advance the game by dt seconds (rendering happens separately).
  step(dt) {
    const input = this.input;
    input.pollGamepad();
    if (input.take('mute')) this.toggleMute();
    if (input.take('pause')) {
      if (this.state === 'playing') this.pause(true);
      else if (this.state === 'paused') this.pause(false);
    }
    if (this.state === 'paused') {
      input.clearActions();
      return;
    }

    this.time += dt;
    this.hud.tick(dt);
    switch (this.state) {
      case 'title':
        this.cutscene.update(dt);
        if (input.take('confirm')) {
          this.sound.unlock();
          this.startIntro();
        }
        break;
      case 'intro':
      case 'ending':
      case 'victory':
        if (this.cutscene) this.cutscene.update(dt);
        break;
      case 'playing':
      case 'dead':
        this.updatePlaying(dt);
        break;
      case 'gameover':
        if (this.arena) this.arena.update(dt, this.time);
        break;
      default:
        break;
    }
    document.body.classList.toggle('touch', input.isTouch);

    this.particles.update(dt);
    this.rings.update(dt);
    this.columns.update(dt);
    this.floaters.update(dt, this.camera, window.innerWidth, window.innerHeight);
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.2);

    if (this.fade !== this.fadeTarget) {
      const stepAmt = this.fadeSpeed * dt;
      this.fade = Math.abs(this.fadeTarget - this.fade) <= stepAmt ? this.fadeTarget : this.fade + Math.sign(this.fadeTarget - this.fade) * stepAmt;
      $('fade').style.opacity = String(this.fade);
    }
    input.clearActions();
  }
}

function boot() {
  try {
    window.game = new Game();
    document.getElementById('bootError').hidden = true;
  } catch (err) {
    console.error(err);
    const el = document.getElementById('bootError');
    if (el) el.hidden = false;
  }
}

boot();
