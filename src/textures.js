// Procedurally drawn canvas textures, so the game ships with no image files.
import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, { repeat = null, srgb = true } = {}) {
  const tex = new THREE.CanvasTexture(c);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  tex.anisotropy = 4;
  return tex;
}

// Metal deck plating for the mothership floor. Returns { map, emissiveMap }.
export function deckTextures(base, seam, glow, repeat) {
  const size = 256;
  const [c, g] = canvas(size, size);
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  // subtle brushed noise
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.035})`;
    g.fillRect(Math.random() * size, Math.random() * size, Math.random() * 30, 1);
  }
  g.strokeStyle = seam;
  g.lineWidth = 4;
  g.strokeRect(2, 2, size - 4, size - 4);
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(size / 2, 0);
  g.lineTo(size / 2, size);
  g.moveTo(0, size / 2);
  g.lineTo(size, size / 2);
  g.stroke();
  // rivets
  g.fillStyle = 'rgba(255,255,255,0.18)';
  for (const [x, y] of [[14, 14], [size - 14, 14], [14, size - 14], [size - 14, size - 14]]) {
    g.beginPath();
    g.arc(x, y, 3, 0, Math.PI * 2);
    g.fill();
  }

  const [e, eg] = canvas(size, size);
  eg.fillStyle = '#000';
  eg.fillRect(0, 0, size, size);
  eg.strokeStyle = glow;
  eg.lineWidth = 3;
  eg.beginPath();
  eg.moveTo(size * 0.25, size * 0.5);
  eg.lineTo(size * 0.75, size * 0.5);
  eg.stroke();
  eg.fillStyle = glow;
  eg.fillRect(size / 2 - 5, size / 2 - 5, 10, 10);

  return {
    map: toTexture(c, { repeat }),
    emissiveMap: toTexture(e, { repeat }),
  };
}

// Wall panels with a glowing strip.
export function wallTexture(base, strip) {
  const [c, g] = canvas(256, 128);
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = 'rgba(0,0,0,0.35)';
  for (let x = 0; x < 256; x += 64) g.fillRect(x, 0, 3, 128);
  g.fillStyle = strip;
  g.fillRect(0, 54, 256, 8);
  g.fillStyle = 'rgba(255,255,255,0.06)';
  g.fillRect(0, 0, 256, 20);
  return toTexture(c, { repeat: [1, 1] });
}

// Soft round glow, used by sprites (projectile halos, lights, portal).
let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const [c, g] = canvas(128, 128);
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glowTex = toTexture(c);
  return glowTex;
}

// Vertical fade used for the tractor beam and teleport columns.
let beamTex = null;
export function beamTexture() {
  if (beamTex) return beamTex;
  const [c, g] = canvas(16, 256);
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0.0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 16, 256);
  // scan lines
  g.fillStyle = 'rgba(255,255,255,0.25)';
  for (let y = 0; y < 256; y += 16) g.fillRect(0, y, 16, 3);
  beamTex = toTexture(c);
  beamTex.wrapT = THREE.RepeatWrapping;
  return beamTex;
}

// Sky dome gradient: canvas top maps to the zenith, the middle to the horizon.
export function skyTexture(top, horizon, bottom) {
  const [c, g] = canvas(4, 256);
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, top);
  grad.addColorStop(0.47, horizon);
  grad.addColorStop(0.53, horizon);
  grad.addColorStop(1, bottom);
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  return toTexture(c);
}

// Small printed sign, e.g. the label on Bessie's reserved specimen tube.
export function labelTexture(lines, { bg = '#f4efe4', fg = '#1d1c22', accent = '#c23b2e' } = {}) {
  const [c, g] = canvas(256, 128);
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = accent;
  g.fillRect(0, 0, 256, 18);
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.font = 'bold 30px sans-serif';
  g.fillText(lines[0], 128, 62);
  g.font = 'bold 22px sans-serif';
  if (lines[1]) g.fillText(lines[1], 128, 100);
  return toTexture(c);
}

// Earth seen from orbit: oceans, blobby continents, cloud wisps.
export function earthTexture() {
  const [c, g] = canvas(512, 256);
  g.fillStyle = '#1d4f9c';
  g.fillRect(0, 0, 512, 256);
  const land = ['#3f8f4a', '#5a9e45', '#8c8a4b'];
  for (let i = 0; i < 26; i++) {
    g.fillStyle = land[i % land.length];
    const x = Math.random() * 512;
    const y = 40 + Math.random() * 176;
    for (let j = 0; j < 7; j++) {
      g.beginPath();
      g.ellipse(x + Math.random() * 50 - 25, y + Math.random() * 30 - 15, 10 + Math.random() * 30, 6 + Math.random() * 16, Math.random() * 3, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < 40; i++) {
    g.beginPath();
    g.ellipse(Math.random() * 512, Math.random() * 256, 20 + Math.random() * 40, 2 + Math.random() * 4, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#f2f6ff';
  g.fillRect(0, 0, 512, 12);
  g.fillRect(0, 244, 512, 12);
  return toTexture(c);
}

// A soft studio-style environment so metal surfaces have something to reflect.
export function makeEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  const geo = new THREE.SphereGeometry(10, 48, 24);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const ground = new THREE.Color(0x0c0f1c);
  const horizon = new THREE.Color(0x8a9cc8);
  const sky = new THREE.Color(0x34406a);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 10;
    if (y < 0) c.copy(horizon).lerp(ground, Math.min(1, -y * 4));
    else c.copy(horizon).lerp(sky, Math.min(1, y * 2.2));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  env.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  // a few bright softboxes for crisp highlights
  const panel = new THREE.PlaneGeometry(1, 1);
  for (const [x, y, z, sx, sy, k] of [[0, 9, 0, 8, 8, 3], [8, 3, 4, 3, 6, 2.2], [-7, 4, -5, 4, 3, 1.6], [2, 2, -9, 6, 1.5, 1.4]]) {
    const m = new THREE.Mesh(panel, new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.scale.set(sx, sy, 1);
    m.lookAt(0, 0, 0);
    env.add(m);
  }
  const tex = pmrem.fromScene(env, 0.035).texture;
  pmrem.dispose();
  return tex;
}
