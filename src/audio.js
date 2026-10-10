// All sound is synthesized with the Web Audio API: no audio files needed.

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicMode = null;
    this.nextNoteTime = 0;
    this.step = 0;
    this.timer = null;
  }

  // Must be called from a user gesture (click / key / tap).
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      this.master.connect(this.ctx.destination);
      this.sfx = this.ctx.createGain();
      this.sfx.gain.value = 0.7;
      this.sfx.connect(this.master);
      this.music = this.ctx.createGain();
      this.music.gain.value = 0.22;
      this.music.connect(this.master);
      this.noiseBuf = this.makeNoise();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.ensureTimer();
  }

  ensureTimer() {
    if (this.timer || !this.ctx || !this.musicMode) return;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 50);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  makeNoise() {
    const len = this.ctx.sampleRate * 1;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  get ready() {
    return this.ctx && this.ctx.state === 'running';
  }

  tone({ type = 'sine', f0 = 440, f1 = null, dur = 0.2, vol = 0.3, attack = 0.005, when = 0, dest = null }) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest || this.sfx);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noise({ dur = 0.2, vol = 0.3, type = 'lowpass', freq = 1200, freq1 = null, q = 1, when = 0 }) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (freq1) f.frequency.exponentialRampToValueAtTime(freq1, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfx);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  // A cartoon "mooooo": buzzy source, vibrato, and an opening/closing filter.
  moo(pitch = 1, length = 1, vol = 0.5) {
    if (!this.ready) return;
    const c = this.ctx;
    const t = c.currentTime;
    const d = 1.0 * length;
    const out = c.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(vol, t + 0.08);
    out.gain.setValueAtTime(vol, t + d * 0.7);
    out.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.15);
    const filt = c.createBiquadFilter();
    filt.type = 'lowpass';
    filt.Q.value = 7;
    filt.frequency.setValueAtTime(260, t);
    filt.frequency.exponentialRampToValueAtTime(1150, t + d * 0.3);
    filt.frequency.exponentialRampToValueAtTime(420, t + d);
    const formant = c.createBiquadFilter();
    formant.type = 'peaking';
    formant.frequency.value = 720;
    formant.gain.value = 8;
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.frequency.value = 5.5;
    lfoGain.gain.value = 3.5 * pitch;
    lfo.connect(lfoGain);
    for (const [type, mul, v] of [['sawtooth', 1, 0.6], ['square', 0.5, 0.25]]) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      g.gain.value = v;
      o.frequency.setValueAtTime(118 * pitch * mul, t);
      o.frequency.linearRampToValueAtTime(152 * pitch * mul, t + d * 0.18);
      o.frequency.linearRampToValueAtTime(104 * pitch * mul, t + d);
      lfoGain.connect(o.frequency);
      o.connect(g);
      g.connect(filt);
      o.start(t);
      o.stop(t + d + 0.2);
    }
    filt.connect(formant);
    formant.connect(out);
    out.connect(this.sfx);
    lfo.start(t);
    lfo.stop(t + d + 0.2);
  }

  shoot() {
    this.tone({ type: 'sine', f0: 980, f1: 380, dur: 0.09, vol: 0.12 });
    this.noise({ dur: 0.05, vol: 0.05, type: 'highpass', freq: 3000 });
  }
  splat() {
    this.noise({ dur: 0.08, vol: 0.12, type: 'bandpass', freq: 1400, q: 2 });
  }
  alienHit() {
    this.tone({ type: 'square', f0: 520, f1: 300, dur: 0.06, vol: 0.06 });
  }
  alienDie() {
    this.tone({ type: 'square', f0: 820, f1: 110, dur: 0.28, vol: 0.09 });
    this.tone({ type: 'triangle', f0: 1500, f1: 400, dur: 0.18, vol: 0.08, when: 0.03 });
    this.noise({ dur: 0.18, vol: 0.12, type: 'bandpass', freq: 900, freq1: 300, q: 1.5 });
  }
  hurt() {
    this.tone({ type: 'sawtooth', f0: 190, f1: 60, dur: 0.28, vol: 0.22 });
    this.noise({ dur: 0.2, vol: 0.2, type: 'lowpass', freq: 800 });
  }
  zap() {
    this.tone({ type: 'sawtooth', f0: 1300, f1: 240, dur: 0.16, vol: 0.06 });
  }
  charge() {
    this.tone({ type: 'sawtooth', f0: 120, f1: 900, dur: 0.6, vol: 0.06, attack: 0.3 });
  }
  dash() {
    this.noise({ dur: 0.25, vol: 0.22, type: 'bandpass', freq: 400, freq1: 2400, q: 1.2 });
  }
  pickup() {
    [660, 880, 1320].forEach((f, i) => this.tone({ type: 'triangle', f0: f, dur: 0.12, vol: 0.15, when: i * 0.06 }));
  }
  powerup() {
    [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone({ type: 'square', f0: f, dur: 0.14, vol: 0.07, when: i * 0.06 }));
  }
  explosion(big = false) {
    this.noise({ dur: big ? 1.4 : 0.6, vol: big ? 0.5 : 0.3, type: 'lowpass', freq: big ? 1600 : 1200, freq1: 80 });
    this.tone({ type: 'sine', f0: big ? 120 : 160, f1: 30, dur: big ? 1.0 : 0.4, vol: big ? 0.5 : 0.3 });
  }
  alarm() {
    this.tone({ type: 'square', f0: 660, dur: 0.14, vol: 0.06 });
    this.tone({ type: 'square', f0: 440, dur: 0.14, vol: 0.06, when: 0.16 });
  }
  door() {
    this.tone({ type: 'sawtooth', f0: 80, f1: 260, dur: 0.8, vol: 0.12, attack: 0.1 });
    this.noise({ dur: 0.8, vol: 0.08, type: 'bandpass', freq: 300, freq1: 1200 });
  }
  teleport() {
    this.tone({ type: 'sine', f0: 300, f1: 1800, dur: 0.5, vol: 0.12, attack: 0.05 });
    this.tone({ type: 'triangle', f0: 450, f1: 2400, dur: 0.5, vol: 0.06, attack: 0.05 });
  }
  laser() {
    this.tone({ type: 'sawtooth', f0: 90, f1: 70, dur: 2.2, vol: 0.14, attack: 0.05 });
    this.tone({ type: 'square', f0: 180, f1: 150, dur: 2.2, vol: 0.05, attack: 0.05 });
  }
  firework() {
    this.noise({ dur: 0.9, vol: 0.2, type: 'highpass', freq: 1500, freq1: 400 });
    this.tone({ type: 'sine', f0: 90, f1: 40, dur: 0.4, vol: 0.2 });
  }
  click() {
    this.tone({ type: 'triangle', f0: 900, dur: 0.05, vol: 0.08 });
  }

  // Returns a stop() function for a looping UFO hum.
  hum() {
    if (!this.ready) return () => {};
    const c = this.ctx;
    const g = c.createGain();
    g.gain.value = 0.0001;
    g.gain.exponentialRampToValueAtTime(0.18, c.currentTime + 1.5);
    const o1 = c.createOscillator();
    const o2 = c.createOscillator();
    const lfo = c.createOscillator();
    const lg = c.createGain();
    o1.type = 'sine';
    o2.type = 'triangle';
    o1.frequency.value = 62;
    o2.frequency.value = 93.5;
    lfo.frequency.value = 3;
    lg.gain.value = 9;
    lfo.connect(lg);
    lg.connect(o1.frequency);
    lg.connect(o2.frequency);
    o1.connect(g);
    o2.connect(g);
    g.connect(this.sfx);
    o1.start();
    o2.start();
    lfo.start();
    return () => {
      const t = c.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      [o1, o2, lfo].forEach((o) => o.stop(t + 0.7));
    };
  }

  /* ---------------- music: a tiny step sequencer ---------------- */

  playMusic(mode) {
    if (this.musicMode === mode) return;
    this.musicMode = mode;
    this.step = 0;
    if (this.ctx) this.nextNoteTime = Math.max(this.nextNoteTime, this.ctx.currentTime + 0.05);
    this.ensureTimer();
  }

  stopMusic() {
    this.musicMode = null;
  }

  schedule() {
    if (!this.ready || !this.musicMode) return;
    const song = SONGS[this.musicMode];
    if (!song) return;
    const stepDur = 60 / song.bpm / 4;
    // after a throttled background tab, skip missed notes instead of playing them all at once
    if (this.nextNoteTime < this.ctx.currentTime - 0.1) this.nextNoteTime = this.ctx.currentTime + 0.05;
    while (this.nextNoteTime < this.ctx.currentTime + 0.15) {
      this.playStep(song, this.step, this.nextNoteTime, stepDur);
      this.nextNoteTime += stepDur;
      this.step = (this.step + 1) % (song.bars * 16);
    }
  }

  playStep(song, step, t, stepDur) {
    const bar = Math.floor(step / 16) % song.chords.length;
    const s = step % 16;
    const root = song.chords[bar];
    const when = t - this.ctx.currentTime;
    if (song.bass[s]) {
      this.tone({ type: 'square', f0: midi(root - 24 + song.bass[s] - 1), dur: stepDur * 1.6, vol: 0.18, when, dest: this.music });
    }
    if (song.arp && s % song.arpEvery === 0) {
      const iv = song.arp[(s / song.arpEvery) % song.arp.length];
      this.tone({ type: 'triangle', f0: midi(root + iv), dur: stepDur * 1.2, vol: 0.1, when, dest: this.music });
    }
    if (song.kick && song.kick[s]) {
      this.tone({ type: 'sine', f0: 150, f1: 40, dur: 0.18, vol: 0.4, when, dest: this.music });
    }
    if (song.hat && song.hat[s]) {
      this.noiseAt(when, this.music);
    }
  }

  noiseAt(when, dest) {
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    src.connect(f);
    f.connect(g);
    g.connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + 0.06);
  }
}

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
const X = 1;
const _ = 0;

// bass values are 1 + semitone offset from the chord root (0 = rest)
const SONGS = {
  title: {
    bpm: 92, bars: 4, chords: [57, 53, 55, 52],
    bass: [1, _, _, _, _, _, 8, _, 1, _, _, _, _, _, _, _],
    arp: [0, 7, 12, 15, 12, 7], arpEvery: 2,
  },
  battle: {
    bpm: 128, bars: 4, chords: [57, 57, 53, 55],
    bass: [1, _, 1, _, 13, _, 1, _, 1, _, 1, 8, _, 11, _, 13],
    arp: [12, 15, 19, 15], arpEvery: 4,
    kick: [X, _, _, _, X, _, _, _, X, _, _, _, X, _, X, _],
    hat: [_, _, X, _, _, _, X, _, _, _, X, _, _, _, X, X],
  },
  boss: {
    bpm: 140, bars: 4, chords: [52, 52, 53, 51],
    bass: [1, 1, _, 1, 13, _, 1, 1, _, 1, 12, _, 1, 13, 1, 12],
    arp: [0, 3, 7, 10, 7, 3], arpEvery: 2,
    kick: [X, _, X, _, X, _, X, _, X, _, X, _, X, _, X, X],
    hat: [X, X, X, X, X, X, X, X, X, X, X, X, X, X, X, X],
  },
  home: {
    bpm: 100, bars: 4, chords: [60, 65, 67, 60],
    bass: [1, _, _, _, 8, _, _, _, 1, _, _, _, 8, _, 5, _],
    arp: [0, 4, 7, 12, 7, 4], arpEvery: 2,
    kick: [X, _, _, _, _, _, _, _, X, _, _, _, _, _, _, _],
  },
};
