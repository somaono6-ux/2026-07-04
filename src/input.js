// Keyboard + mouse, touch twin-sticks, and gamepad, merged into one interface.

const KEY_ACTIONS = {
  Space: 'dash', ShiftLeft: 'dash', ShiftRight: 'dash',
  KeyQ: 'moo', KeyE: 'moo',
  Escape: 'pause', KeyP: 'pause',
  KeyM: 'mute',
  Enter: 'confirm',
};

const STICK_RADIUS = 56;

export class Input {
  constructor(canvas, touchLayer) {
    this.canvas = canvas;
    this.keys = new Set();
    this.actions = new Set();
    this.mouse = { ndcX: 0, ndcY: 0, down: false, seen: false };
    this.device = 'mouse';
    this.touchLayer = touchLayer;
    this.sticks = {
      move: this.makeStick('move'),
      aim: this.makeStick('aim'),
    };
    this.pad = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, fire: false, prev: [] };
    this.anyKeyHandlers = [];
    this.bind();
  }

  makeStick(kind) {
    const base = document.createElement('div');
    base.className = `stick stick-${kind}`;
    base.hidden = true;
    const knob = document.createElement('div');
    knob.className = 'stick-knob';
    base.appendChild(knob);
    this.touchLayer.appendChild(base);
    return { id: null, ox: 0, oy: 0, x: 0, y: 0, base, knob };
  }

  bind() {
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      this.device = this.device === 'touch' ? 'touch' : 'mouse';
      if (!e.repeat) {
        const a = KEY_ACTIONS[e.code];
        if (a) this.actions.add(a);
        this.anyKeyHandlers.forEach((h) => h(e));
      }
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.down = false;
    });

    // one full-screen layer above the canvas receives mouse clicks and touch sticks
    const L = this.touchLayer;
    L.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      this.updateMouse(e);
    });
    window.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'mouse' && e.button === 0) this.mouse.down = false;
    });
    L.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') {
        this.device = 'mouse';
        this.updateMouse(e);
        if (e.button === 0) this.mouse.down = true;
        if (e.button === 2) this.actions.add('moo');
        return;
      }
      const btn = e.target.closest('[data-action]');
      if (btn) {
        this.actions.add(btn.dataset.action);
        btn.classList.add('pressed');
        setTimeout(() => btn.classList.remove('pressed'), 140);
        e.preventDefault();
        return;
      }
      this.device = 'touch';
      const kind = e.clientX < window.innerWidth / 2 ? 'move' : 'aim';
      const s = this.sticks[kind];
      if (s.id !== null) return;
      s.id = e.pointerId;
      s.ox = e.clientX;
      s.oy = e.clientY;
      s.x = s.y = 0;
      s.base.hidden = false;
      s.base.style.transform = `translate(${s.ox}px, ${s.oy}px)`;
      s.knob.style.transform = 'translate(0px, 0px)';
      try { L.setPointerCapture(e.pointerId); } catch (_) { /* capture is optional */ }
      e.preventDefault();
    });
    L.addEventListener('pointermove', (e) => {
      for (const s of Object.values(this.sticks)) {
        if (s.id !== e.pointerId) continue;
        let dx = e.clientX - s.ox;
        let dy = e.clientY - s.oy;
        const len = Math.hypot(dx, dy);
        if (len > STICK_RADIUS) {
          dx = (dx / len) * STICK_RADIUS;
          dy = (dy / len) * STICK_RADIUS;
        }
        s.x = dx / STICK_RADIUS;
        s.y = dy / STICK_RADIUS;
        s.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      }
    });
    const end = (e) => {
      for (const s of Object.values(this.sticks)) {
        if (s.id !== e.pointerId) continue;
        s.id = null;
        s.x = s.y = 0;
        s.base.hidden = true;
      }
    };
    L.addEventListener('pointerup', end);
    L.addEventListener('pointercancel', end);
  }

  updateMouse(e) {
    const r = this.canvas.getBoundingClientRect();
    this.mouse.ndcX = ((e.clientX - r.left) / r.width) * 2 - 1;
    this.mouse.ndcY = -((e.clientY - r.top) / r.height) * 2 + 1;
    this.mouse.seen = true;
    if (this.device !== 'touch') this.device = 'mouse';
  }

  onAnyKey(fn) {
    this.anyKeyHandlers.push(fn);
  }

  pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads && Array.from(pads).find((p) => p && p.connected);
    if (!gp) return;
    const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
    this.pad.move.x = dz(gp.axes[0] || 0);
    this.pad.move.y = dz(gp.axes[1] || 0);
    this.pad.aim.x = dz(gp.axes[2] || 0);
    this.pad.aim.y = dz(gp.axes[3] || 0);
    const b = gp.buttons.map((x) => x.pressed || x.value > 0.5);
    const edge = (i) => b[i] && !this.pad.prev[i];
    if (edge(0) || edge(4)) this.actions.add('dash');
    if (edge(1) || edge(5)) this.actions.add('moo');
    if (edge(9)) this.actions.add('pause');
    if (edge(0) || edge(9)) this.actions.add('confirm');
    this.pad.fire = !!b[7] || !!b[6] || Math.hypot(this.pad.aim.x, this.pad.aim.y) > 0.5;
    const used = b.some(Boolean) || Math.hypot(this.pad.move.x, this.pad.move.y) > 0 || Math.hypot(this.pad.aim.x, this.pad.aim.y) > 0;
    if (used) this.device = 'gamepad';
    this.pad.prev = b;
  }

  // Edge-triggered: returns true once per press.
  take(action) {
    if (this.actions.has(action)) {
      this.actions.delete(action);
      return true;
    }
    return false;
  }

  clearActions() {
    this.actions.clear();
  }

  // Movement on the ground plane: x = right, z = toward the camera (down-screen).
  moveVector() {
    let x = 0;
    let z = 0;
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) z -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) z += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    x += this.sticks.move.x + this.pad.move.x;
    z += this.sticks.move.y + this.pad.move.y;
    const len = Math.hypot(x, z);
    if (len > 1) {
      x /= len;
      z /= len;
    }
    return { x, z };
  }

  // Stick-based aim direction, or null when the mouse should be used.
  stickAim() {
    const a = this.sticks.aim;
    if (a.id !== null && Math.hypot(a.x, a.y) > 0.3) return { x: a.x, z: a.y };
    const p = this.pad.aim;
    if (Math.hypot(p.x, p.y) > 0.3) return { x: p.x, z: p.y };
    return null;
  }

  get firing() {
    return this.mouse.down || this.sticks.aim.id !== null || this.pad.fire || this.keys.has('KeyJ');
  }

  get isTouch() {
    return this.device === 'touch';
  }
}
