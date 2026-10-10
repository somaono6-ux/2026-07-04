// DOM heads-up display: health, score, abilities, boss bar, banners, edge arrows.
import * as THREE from 'three';
import { COW } from './player.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor(game) {
    this.game = game;
    this.el = {
      hud: $('hud'),
      hpFill: $('hpFill'),
      hpText: $('hpText'),
      hpBar: $('hpBar'),
      power: $('powerChip'),
      powerTime: $('powerTime'),
      level: $('levelName'),
      kicker: $('levelKicker'),
      wave: $('waveText'),
      score: $('scoreText'),
      combo: $('comboText'),
      dash: $('abDash'),
      moo: $('abMoo'),
      tDash: $('tDash'),
      tMoo: $('tMoo'),
      boss: $('bossBar'),
      bossFill: $('bossFill'),
      banner: $('banner'),
      bannerKicker: $('bannerKicker'),
      bannerTitle: $('bannerTitle'),
      subtitle: $('subtitle'),
      toast: $('toast'),
      vignette: $('hurtVignette'),
      indicators: $('indicators'),
      flash: $('flash'),
    };
    this.cache = {};
    this.bannerT = 0;
    this.subT = 0;
    this.toastT = 0;
    this.arrows = [];
    this.v = new THREE.Vector3();
  }

  show(on) {
    this.el.hud.hidden = !on;
  }

  set(key, value, fn) {
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    fn(value);
  }

  setLevel(level) {
    this.el.kicker.textContent = level.kicker;
    this.el.level.textContent = level.name;
  }

  setWave(text) {
    this.el.wave.textContent = text;
  }

  banner(kicker, title, dur = 2.4) {
    this.el.bannerKicker.textContent = kicker;
    this.el.bannerTitle.textContent = title;
    this.el.banner.classList.remove('show');
    void this.el.banner.offsetWidth;
    this.el.banner.classList.add('show');
    this.bannerT = dur;
  }

  subtitle(text, dur = 3) {
    this.el.subtitle.textContent = text;
    this.el.subtitle.classList.add('show');
    this.subT = dur;
  }

  clearSubtitle() {
    this.subT = 0;
    this.el.subtitle.classList.remove('show');
  }

  toast(text, dur = 3) {
    this.el.toast.textContent = text;
    this.el.toast.classList.add('show');
    this.toastT = dur;
  }

  clearMessages() {
    this.bannerT = 0;
    this.toastT = 0;
    this.el.banner.classList.remove('show');
    this.el.toast.classList.remove('show');
    this.clearSubtitle();
  }

  hurt() {
    const v = this.el.vignette;
    v.classList.remove('hit');
    void v.offsetWidth;
    v.classList.add('hit');
  }

  flash() {
    const f = this.el.flash;
    f.classList.remove('go');
    void f.offsetWidth;
    f.classList.add('go');
  }

  // Timers for messages run in every state, including cutscenes.
  tick(dt) {
    if (this.bannerT > 0 && (this.bannerT -= dt) <= 0) this.el.banner.classList.remove('show');
    if (this.subT > 0 && (this.subT -= dt) <= 0) this.el.subtitle.classList.remove('show');
    if (this.toastT > 0 && (this.toastT -= dt) <= 0) this.el.toast.classList.remove('show');
  }

  update() {
    const g = this.game;
    const p = g.player;
    const e = this.el;
    const hp = Math.ceil(p.hp);
    this.set('hp', hp, (v) => {
      e.hpFill.style.transform = `scaleX(${v / p.maxHp})`;
      e.hpText.textContent = String(v);
      e.hpBar.classList.toggle('low', v <= 30);
    });
    this.set('score', g.score, (v) => (e.score.textContent = v.toLocaleString('en-US')));
    const mult = g.comboMult();
    this.set('combo', g.comboTimer > 0 && mult > 1 ? mult : 0, (v) => {
      e.combo.textContent = v ? `×${v} combo` : '';
      e.combo.classList.toggle('on', !!v);
    });
    const gold = Math.ceil(p.golden);
    this.set('gold', gold, (v) => {
      e.power.hidden = v <= 0;
      e.powerTime.textContent = String(v);
    });
    const dashK = Math.max(0, p.dashCd) / COW.dashCooldown;
    this.set('dash', Math.round(dashK * 40), (v) => {
      for (const el of [e.dash, e.tDash]) {
        el.style.setProperty('--cd', String(v / 40));
        el.classList.toggle('ready', v === 0);
      }
    });
    const mooK = Math.max(0, p.mooCd) / COW.mooCooldown;
    this.set('moo', Math.round(mooK * 60), (v) => {
      for (const el of [e.moo, e.tMoo]) {
        el.style.setProperty('--cd', String(v / 60));
        el.classList.toggle('ready', v === 0);
      }
    });
    const boss = g.boss && !g.boss.dead ? g.boss : null;
    this.set('bossOn', !!boss, (v) => (e.boss.hidden = !v));
    if (boss) {
      this.set('bossHp', Math.ceil((boss.hp / boss.maxHp) * 200), (v) => {
        e.bossFill.style.transform = `scaleX(${Math.max(0, v / 200)})`;
      });
    }
    this.updateIndicators();
  }

  // Arrows at the screen edge for aliens (and the open exit) that are out of view.
  updateIndicators() {
    const g = this.game;
    const cam = g.camera;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const targets = [];
    for (const en of g.enemies) if (en.active) targets.push({ x: en.pos.x, y: 1, z: en.pos.z, kind: en.isBoss ? 'boss' : 'alien' });
    if (g.arena && g.arena.doorOpen && g.levelState === 'exit') targets.push({ x: 0, y: 1, z: -g.arena.d / 2 - 0.5, kind: 'exit' });
    let n = 0;
    const margin = 34;
    for (const t of targets) {
      this.v.set(t.x, t.y, t.z).project(cam);
      let { x, y } = this.v;
      const behind = this.v.z > 1;
      if (!behind && Math.abs(x) < 0.94 && Math.abs(y) < 0.92) continue;
      if (behind) {
        x = -x;
        y = -y;
      }
      const sx = (x * 0.5 + 0.5) * w;
      const sy = (-y * 0.5 + 0.5) * h;
      const cx = w / 2;
      const cy = h / 2;
      const ang = Math.atan2(sy - cy, sx - cx);
      const scale = Math.min((w / 2 - margin) / Math.abs(Math.cos(ang) || 1e-6), (h / 2 - margin) / Math.abs(Math.sin(ang) || 1e-6));
      const ex = cx + Math.cos(ang) * scale;
      const ey = cy + Math.sin(ang) * scale;
      let a = this.arrows[n];
      if (!a) {
        a = document.createElement('div');
        this.el.indicators.appendChild(a);
        this.arrows.push(a);
      }
      a.className = `edge-arrow ${t.kind}`;
      a.style.transform = `translate(${ex}px, ${ey}px) rotate(${ang}rad)`;
      a.hidden = false;
      n++;
      if (n >= 14) break;
    }
    for (let i = n; i < this.arrows.length; i++) this.arrows[i].hidden = true;
  }

  hideIndicators() {
    for (const a of this.arrows) a.hidden = true;
  }
}
