// Every character and prop is built from primitive shapes here.
// Convention: models face +Z, stand on y = 0, and expose animatable parts in userData.
import * as THREE from 'three';
import { glowTexture, beamTexture } from './textures.js';

const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.SphereGeometry(0.5, 18, 14),
  ico: new THREE.IcosahedronGeometry(0.5, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 16),
  cone: new THREE.ConeGeometry(0.5, 1, 14),
  torus: new THREE.TorusGeometry(0.5, 0.08, 8, 28),
};
export const geometries = G;

// Resources reused across many objects; disposeTree() leaves these alone.
const SHARED = new Set(Object.values(G));
export function share(...items) {
  for (const it of items) SHARED.add(it);
}

export function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry && !SHARED.has(o.geometry)) o.geometry.dispose();
    const list = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of list) {
      if (SHARED.has(m)) continue;
      for (const key of ['map', 'emissiveMap']) {
        if (m[key] && !SHARED.has(m[key])) m[key].dispose();
      }
      m.dispose();
    }
  });
}

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...o });
const glowing = (color, intensity = 1.6) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4 });

export const mats = {
  cowBlack: std(0x1d1c22, { roughness: 0.9 }),
  pink: std(0xf3a1b0),
  horn: std(0xeadfc4),
  hoof: std(0x3b302b),
  gold: std(0xf2c14e, { metalness: 0.7, roughness: 0.3 }),
  collar: std(0xc23b2e),
  eyeBlack: std(0x0b0b10, { roughness: 0.15, metalness: 0.3 }),
  eyeShine: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  metal: std(0xb9c2d6, { metalness: 0.85, roughness: 0.28 }),
  darkMetal: std(0x3a4566, { metalness: 0.7, roughness: 0.4 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.1, depthWrite: false }),
  glowCyan: glowing(0x6fe3ff),
  glowYellow: glowing(0xffd84a),
  glowMagenta: glowing(0xff4fd8),
  glowGreen: glowing(0x8dff6a),
  glowRed: glowing(0xff3b3b, 2),
  hay: std(0xe8c35a, { roughness: 1 }),
  hayDark: std(0xb8902e, { roughness: 1 }),
  barnRed: std(0xb23a2c, { roughness: 0.9 }),
  trimWhite: std(0xf1ece1),
  roof: std(0x4a4b55, { roughness: 0.8 }),
  wood: std(0x7a5634, { roughness: 1 }),
  leaf: std(0x2f6b3a, { roughness: 1, flatShading: true }),
  trunk: std(0x5a3d26, { roughness: 1 }),
  wool: std(0xf4f1ea, { roughness: 1, flatShading: true }),
  pig: std(0xf2a7a0),
  beak: std(0xf2a33a),
  comb: std(0xd8322e),
};
share(...Object.values(mats), glowTexture(), beamTexture());

function add(parent, geo, mat, scale, pos, rot) {
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(scale[0], scale[1], scale[2]);
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  m.castShadow = true;
  parent.add(m);
  return m;
}

function pivot(parent, pos) {
  const g = new THREE.Group();
  g.position.set(pos[0], pos[1], pos[2]);
  parent.add(g);
  return g;
}

const spriteMats = new Map();
export function glowSprite(color, size, opacity = 1) {
  const key = `${color}-${opacity}`;
  let mat = spriteMats.get(key);
  if (!mat) {
    mat = new THREE.SpriteMaterial({
      map: glowTexture(), color, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    spriteMats.set(key, mat);
    share(mat);
  }
  const s = new THREE.Sprite(mat);
  s.scale.set(size, size, 1);
  return s;
}

// A sprite with its own material, for glows that fade independently.
export function uniqueGlowSprite(color, size, opacity = 1) {
  const mat = new THREE.SpriteMaterial({
    map: glowTexture(), color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const s = new THREE.Sprite(mat);
  s.scale.set(size, size, 1);
  return s;
}

/* ------------------------------------------------------------------ */
/* Bessie                                                              */
/* ------------------------------------------------------------------ */

export function makeCow() {
  const root = new THREE.Group();
  const body = pivot(root, [0, 0, 0]);
  const white = std(0xf6f1e7, { roughness: 0.85 });
  const B = mats.cowBlack;

  add(body, G.box, white, [1.1, 0.85, 1.7], [0, 1.05, 0]);
  // spots: sides, top, rump
  const spots = [
    [0.56, 1.12, 0.25, 0.04, 0.42, 0.5], [0.56, 0.95, -0.45, 0.04, 0.35, 0.38],
    [-0.56, 1.15, -0.2, 0.04, 0.48, 0.62], [-0.56, 0.9, 0.5, 0.04, 0.28, 0.3],
    [0.15, 1.48, -0.1, 0.45, 0.04, 0.55], [-0.25, 1.48, 0.55, 0.3, 0.04, 0.28],
    [0.2, 1.2, -0.86, 0.4, 0.38, 0.04],
  ];
  for (const s of spots) add(body, G.box, B, [s[3], s[4], s[5]], [s[0], s[1], s[2]]);

  // udder
  add(body, G.sphere, mats.pink, [0.5, 0.36, 0.5], [0, 0.62, -0.38]);
  for (const [x, z] of [[0.1, -0.28], [-0.1, -0.28], [0.1, -0.48], [-0.1, -0.48]]) {
    add(body, G.cyl, mats.pink, [0.07, 0.16, 0.07], [x, 0.44, z]);
  }

  // legs (pivot at the hip so they can swing)
  const legs = [];
  for (const [x, z] of [[0.36, 0.58], [-0.36, 0.58], [0.36, -0.58], [-0.36, -0.58]]) {
    const hip = pivot(root, [x, 0.72, z]);
    add(hip, G.box, white, [0.26, 0.6, 0.26], [0, -0.3, 0]);
    add(hip, G.box, mats.hoof, [0.29, 0.14, 0.29], [0, -0.63, 0]);
    legs.push(hip);
  }

  // head
  const head = pivot(body, [0, 1.38, 0.9]);
  add(head, G.box, white, [0.72, 0.66, 0.66], [0, 0.05, 0.12]);
  add(head, G.box, B, [0.28, 0.3, 0.04], [0.18, 0.16, 0.46]);
  add(head, G.box, mats.pink, [0.62, 0.36, 0.26], [0, -0.14, 0.52]);
  for (const x of [0.14, -0.14]) add(head, G.box, B, [0.08, 0.1, 0.03], [x, -0.1, 0.66]);
  for (const x of [0.21, -0.21]) {
    add(head, G.sphere, mats.eyeBlack, [0.15, 0.15, 0.12], [x, 0.13, 0.46]);
    add(head, G.sphere, mats.eyeShine, [0.05, 0.05, 0.03], [x * 0.92, 0.17, 0.52]);
  }
  for (const s of [1, -1]) {
    add(head, G.cone, mats.horn, [0.15, 0.4, 0.15], [0.27 * s, 0.5, 0.06], [0, 0, -0.6 * s]);
    add(head, G.box, white, [0.4, 0.11, 0.24], [0.52 * s, 0.2, 0.04], [0, 0, 0.3 * s]);
    add(head, G.box, mats.pink, [0.26, 0.02, 0.15], [0.55 * s, 0.25, 0.07], [0, 0, 0.3 * s]);
  }
  // tuft of hair
  add(head, G.box, B, [0.22, 0.12, 0.2], [0, 0.42, 0.18]);

  // collar and bell
  add(body, G.torus, mats.collar, [0.95, 0.85, 1.2], [0, 1.2, 0.86], [-0.25, 0, 0]);
  const bell = add(body, G.sphere, mats.gold, [0.2, 0.22, 0.2], [0, 0.86, 1.02]);

  // tail
  const tail = pivot(body, [0, 1.38, -0.86]);
  tail.rotation.x = -0.35;
  add(tail, G.cyl, white, [0.07, 0.72, 0.07], [0, -0.36, 0]);
  add(tail, G.sphere, B, [0.17, 0.24, 0.17], [0, -0.74, 0]);

  root.userData = { body, head, legs, tail, bell, white, phase: 0, time: 0 };
  return root;
}

// speed01: 0 idle .. 1 full run. graze: 0..1 lowers the head to munch.
export function animateCow(cow, dt, speed01, { graze = 0, lean = 0 } = {}) {
  const u = cow.userData;
  u.time += dt;
  u.phase += dt * (2 + speed01 * 11);
  const swing = Math.sin(u.phase) * 0.75 * speed01;
  u.legs[0].rotation.x = swing;
  u.legs[3].rotation.x = swing;
  u.legs[1].rotation.x = -swing;
  u.legs[2].rotation.x = -swing;
  u.body.position.y = Math.abs(Math.sin(u.phase)) * 0.06 * speed01;
  u.body.rotation.x = lean;
  u.tail.rotation.z = Math.sin(u.time * 3.2) * 0.35;
  u.tail.rotation.x = -0.35 - speed01 * 0.5;
  const munch = graze > 0 ? Math.sin(u.time * 9) * 0.05 * graze : 0;
  u.head.rotation.x = graze * 0.75 + munch + Math.sin(u.time * 1.7) * 0.03;
  u.head.position.y = 1.38 - graze * 0.35;
  u.bell.rotation.z = Math.sin(u.phase * 0.5) * 0.4 * speed01;
}

/* ------------------------------------------------------------------ */
/* Aliens                                                              */
/* ------------------------------------------------------------------ */

function alienBase(skinColor) {
  const root = new THREE.Group();
  const body = pivot(root, [0, 0, 0]);
  const skin = std(skinColor, { roughness: 0.5 });
  return { root, body, skin };
}

export function makeGrunt() {
  const { root, body, skin } = alienBase(0x7ed957);
  add(body, G.sphere, skin, [0.7, 0.8, 0.6], [0, 0.78, 0]);
  add(body, G.box, mats.glowCyan, [0.2, 0.2, 0.05], [0, 0.88, 0.3]);
  add(body, G.sphere, skin, [1.05, 0.9, 0.95], [0, 1.45, 0]);
  for (const s of [1, -1]) {
    add(body, G.sphere, mats.eyeBlack, [0.28, 0.42, 0.12], [0.21 * s, 1.5, 0.4], [0, 0.35 * s, -0.4 * s]);
    add(body, G.sphere, mats.eyeShine, [0.06, 0.08, 0.03], [0.17 * s, 1.6, 0.46]);
  }
  add(body, G.box, mats.eyeBlack, [0.12, 0.03, 0.02], [0, 1.2, 0.45]);
  const balls = [];
  for (const s of [1, -1]) {
    add(body, G.cyl, skin, [0.04, 0.42, 0.04], [0.17 * s, 2.02, 0], [0, 0, -0.3 * s]);
    balls.push(add(body, G.sphere, mats.glowYellow, [0.13, 0.13, 0.13], [0.24 * s, 2.22, 0]));
  }
  const arms = [];
  for (const s of [1, -1]) {
    const a = pivot(body, [0.36 * s, 0.98, 0]);
    add(a, G.cyl, skin, [0.1, 0.5, 0.1], [0, -0.22, 0]);
    add(a, G.sphere, skin, [0.15, 0.15, 0.15], [0, -0.48, 0]);
    a.rotation.z = 0.25 * s;
    arms.push(a);
  }
  for (const s of [1, -1]) add(root, G.cyl, skin, [0.14, 0.42, 0.14], [0.17 * s, 0.21, 0]);
  root.userData = { body, skin, arms, balls };
  return root;
}

export function makeShooter() {
  const { root, body, skin } = alienBase(0xb07cff);
  const suit = std(0x28406e, { metalness: 0.4, roughness: 0.5 });
  add(body, G.sphere, suit, [0.78, 0.95, 0.66], [0, 0.88, 0]);
  add(body, G.box, mats.glowMagenta, [0.5, 0.06, 0.04], [0, 0.95, 0.32]);
  add(body, G.sphere, skin, [0.86, 0.86, 0.86], [0, 1.66, 0]);
  for (const x of [-0.22, 0, 0.22]) {
    add(body, G.sphere, mats.eyeBlack, [0.16, 0.2, 0.1], [x, 1.7 - Math.abs(x) * 0.2, 0.38]);
  }
  add(body, G.sphere, mats.glass, [1.2, 1.2, 1.2], [0, 1.66, 0]);
  add(body, G.torus, mats.metal, [1.2, 1.2, 1.2], [0, 1.18, 0], [Math.PI / 2, 0, 0]);
  const arms = [];
  for (const s of [1, -1]) {
    const a = pivot(body, [0.38 * s, 1.12, 0.05]);
    add(a, G.cyl, suit, [0.12, 0.45, 0.12], [0, -0.2, 0]);
    a.rotation.x = -1.1;
    arms.push(a);
  }
  const gun = pivot(body, [0, 1.02, 0.5]);
  add(gun, G.box, mats.darkMetal, [0.22, 0.22, 0.5], [0, 0, 0]);
  add(gun, G.cyl, mats.metal, [0.1, 0.4, 0.1], [0, 0.02, 0.4], [Math.PI / 2, 0, 0]);
  const tip = add(gun, G.sphere, mats.glowMagenta, [0.16, 0.16, 0.16], [0, 0.02, 0.62]);
  for (const s of [1, -1]) add(root, G.cyl, suit, [0.15, 0.45, 0.15], [0.18 * s, 0.22, 0]);
  root.userData = { body, skin, arms, gun, tip };
  return root;
}

export function makeDrone() {
  const root = new THREE.Group();
  const body = pivot(root, [0, 0, 0]);
  const skin = std(0xc9d2e6, { metalness: 0.85, roughness: 0.25 });
  add(body, G.sphere, skin, [1.7, 0.36, 1.7], [0, 0, 0]);
  add(body, G.sphere, mats.glass, [0.8, 0.6, 0.8], [0, 0.18, 0]);
  const pilot = add(body, G.sphere, std(0x7ed957), [0.36, 0.4, 0.36], [0, 0.18, 0]);
  const lights = [];
  const lightMat = glowing(0x6fe3ff, 2);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    lights.push(add(body, G.sphere, lightMat, [0.12, 0.12, 0.12], [Math.cos(a) * 0.8, -0.02, Math.sin(a) * 0.8]));
  }
  const eye = add(body, G.sphere, mats.glowRed, [0.22, 0.14, 0.14], [0, -0.04, 0.84]);
  const glow = glowSprite(0x6fe3ff, 1.6, 0.5);
  glow.position.y = -0.3;
  body.add(glow);
  root.userData = { body, skin, lights, lightMat, eye, pilot };
  return root;
}

export function makeBrute() {
  const { root, body, skin } = alienBase(0xc9478f);
  const belly = std(0xf08cc0, { roughness: 0.6 });
  add(body, G.sphere, skin, [2.0, 1.8, 1.6], [0, 1.35, 0]);
  add(body, G.sphere, belly, [1.4, 1.2, 0.6], [0, 1.15, 0.55]);
  add(body, G.sphere, skin, [0.95, 0.85, 0.85], [0, 2.25, 0.55]);
  add(body, G.sphere, mats.trimWhite, [0.5, 0.5, 0.3], [0, 2.3, 0.94]);
  const pupil = add(body, G.sphere, mats.eyeBlack, [0.24, 0.24, 0.12], [0, 2.3, 1.08]);
  add(body, G.box, mats.eyeBlack, [0.4, 0.05, 0.04], [0, 2.02, 0.95]);
  for (let i = 0; i < 4; i++) {
    add(body, G.cone, mats.glowGreen, [0.28, 0.5, 0.28], [0, 2.45 - i * 0.32, -0.45 - i * 0.18], [-0.6 - i * 0.25, 0, 0]);
  }
  for (const s of [1, -1]) add(body, G.cone, mats.horn, [0.18, 0.4, 0.18], [0.32 * s, 2.7, 0.5], [0, 0, -0.5 * s]);
  const arms = [];
  for (const s of [1, -1]) {
    const a = pivot(body, [1.0 * s, 1.75, 0.15]);
    add(a, G.cyl, skin, [0.42, 1.0, 0.42], [0, -0.45, 0]);
    add(a, G.sphere, skin, [0.65, 0.6, 0.65], [0, -1.05, 0.1]);
    a.rotation.z = 0.25 * s;
    arms.push(a);
  }
  for (const s of [1, -1]) add(root, G.cyl, skin, [0.5, 0.55, 0.5], [0.5 * s, 0.27, 0]);
  root.userData = { body, skin, arms, pupil };
  return root;
}

function bumpyBrain(radius) {
  const geo = new THREE.IcosahedronGeometry(radius, 4);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 7) * Math.sin(v.y * 9) * Math.sin(v.z * 8);
    const groove = Math.abs(v.x) < radius * 0.08 ? -0.12 : 0;
    v.multiplyScalar(1 + n * 0.06 + groove);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

export function makeBoss() {
  const root = new THREE.Group();
  const body = pivot(root, [0, 0, 0]);
  const skin = std(0x9cc98a, { roughness: 0.45 });
  const hull = std(0xaab4cc, { metalness: 0.85, roughness: 0.3 });
  add(body, G.sphere, hull, [6.2, 1.2, 6.2], [0, 1.1, 0]);
  add(body, G.cyl, mats.darkMetal, [5.4, 0.3, 5.4], [0, 1.1, 0]);
  const under = add(body, G.cyl, mats.glowCyan, [2.4, 0.2, 2.4], [0, 0.48, 0]);
  const lights = [];
  const lightMat = glowing(0xffd84a, 2);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    lights.push(add(body, G.sphere, lightMat, [0.26, 0.26, 0.26], [Math.cos(a) * 3.05, 1.1, Math.sin(a) * 3.05]));
  }
  // head
  add(body, G.sphere, skin, [2.9, 2.5, 2.6], [0, 2.9, 0.1]);
  for (const s of [1, -1]) {
    add(body, G.sphere, mats.eyeBlack, [0.8, 1.15, 0.3], [0.62 * s, 2.95, 1.2], [0, 0.4 * s, -0.45 * s]);
    add(body, G.sphere, mats.eyeShine, [0.16, 0.2, 0.06], [0.52 * s, 3.25, 1.38]);
  }
  add(body, G.box, mats.eyeBlack, [0.5, 0.06, 0.05], [0, 2.2, 1.28]);
  // exposed brain under a glass dome
  const brainMat = std(0xf29bb5, { roughness: 0.5, emissive: 0x5a1030, emissiveIntensity: 0.5 });
  const brain = new THREE.Mesh(bumpyBrain(1.15), brainMat);
  brain.position.set(0, 4.05, 0);
  brain.scale.set(1.1, 0.8, 1.15);
  brain.castShadow = true;
  body.add(brain);
  add(body, G.sphere, mats.glass, [2.9, 2.0, 2.9], [0, 4.0, 0]);
  // cannon arms
  const cannons = [];
  for (const s of [1, -1]) {
    const arm = pivot(body, [3.2 * s, 1.6, 0.4]);
    add(arm, G.cyl, mats.darkMetal, [0.5, 1.4, 0.5], [0, 0.5, 0]);
    add(arm, G.sphere, hull, [0.9, 0.9, 0.9], [0, 1.2, 0]);
    const orb = add(arm, G.sphere, mats.glowMagenta, [0.5, 0.5, 0.5], [0, 1.2, 0.4]);
    cannons.push({ arm, orb });
  }
  const glow = glowSprite(0x6fe3ff, 7, 0.5);
  glow.position.y = 0.2;
  body.add(glow);
  root.userData = { body, skin, brain, brainMat, lights, lightMat, cannons, under };
  return root;
}

/* ------------------------------------------------------------------ */
/* Ships and props                                                     */
/* ------------------------------------------------------------------ */

export function makeUFO() {
  const root = new THREE.Group();
  const hull = std(0xc4cce0, { metalness: 0.65, roughness: 0.3 });
  add(root, G.sphere, hull, [10, 1.6, 10], [0, 0, 0]);
  add(root, G.cyl, mats.darkMetal, [9.4, 0.35, 9.4], [0, 0, 0]);
  const domeMat = new THREE.MeshStandardMaterial({ color: 0x8ff0ff, emissive: 0x2aa8c8, emissiveIntensity: 0.8, transparent: true, opacity: 0.75, roughness: 0.1 });
  const dome = add(root, G.sphere, domeMat, [4.2, 3.0, 4.2], [0, 0.7, 0]);
  const lights = [];
  const colors = [0xffd84a, 0xff4fd8, 0x6fe3ff, 0x8dff6a];
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const m = glowing(colors[i % 4], 2.5);
    lights.push(add(root, G.sphere, m, [0.35, 0.35, 0.35], [Math.cos(a) * 4.75, -0.05, Math.sin(a) * 4.75]));
  }
  add(root, G.cyl, mats.glowCyan, [3, 0.3, 3], [0, -0.72, 0]);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0x9ff4ff, map: beamTexture(), transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 4.0, 1, 28, 1, true), beamMat);
  beam.visible = false;
  root.add(beam);
  const halo = glowSprite(0x6fe3ff, 14, 0.35);
  halo.position.y = -1;
  root.add(halo);
  root.userData = { lights, beam, beamMat, dome };
  return root;
}

// Stretch the beam so it reaches from the saucer down to groundY (world).
export function setUFOBeam(ufo, strength, groundY = 0, time = 0) {
  const { beam, beamMat } = ufo.userData;
  beam.visible = strength > 0.01;
  const h = Math.max(0.1, ufo.position.y - groundY - 0.6);
  beam.scale.set(1, h, 1);
  beam.position.y = -0.6 - h / 2;
  beamMat.opacity = strength * (0.55 + Math.sin(time * 14) * 0.08);
  beamMat.map.offset.y = -time * 0.8;
}

export function animateUFO(ufo, time) {
  ufo.userData.lights.forEach((l, i) => {
    const on = (Math.floor(time * 6) + i) % 4 === 0;
    l.material.emissiveIntensity = on ? 4 : 0.8;
  });
}

export function makeBarn() {
  const g = new THREE.Group();
  add(g, G.box, mats.barnRed, [7, 4.6, 9], [0, 2.3, 0]);
  // triangular gable prism on top of the walls
  const prism = new THREE.CylinderGeometry(1, 1, 1, 3);
  prism.rotateX(-Math.PI / 2);
  const gable = new THREE.Mesh(prism, mats.barnRed);
  gable.scale.set(4.04, 1, 9);
  gable.position.set(0, 5.1, 0);
  gable.castShadow = true;
  g.add(gable);
  add(g, G.box, mats.roof, [4.2, 0.25, 9.6], [-1.75, 5.48, 0], [0, 0, 0.405]);
  add(g, G.box, mats.roof, [4.2, 0.25, 9.6], [1.75, 5.48, 0], [0, 0, -0.405]);
  // door with white X trim on the +Z face
  add(g, G.box, mats.trimWhite, [3.2, 0.2, 0.15], [0, 3.2, 4.56]);
  add(g, G.box, mats.trimWhite, [0.2, 3.2, 0.15], [-1.5, 1.6, 4.56]);
  add(g, G.box, mats.trimWhite, [0.2, 3.2, 0.15], [1.5, 1.6, 4.56]);
  add(g, G.box, mats.trimWhite, [0.18, 4.2, 0.12], [0, 1.6, 4.58], [0, 0, 0.74]);
  add(g, G.box, mats.trimWhite, [0.18, 4.2, 0.12], [0, 1.6, 4.58], [0, 0, -0.74]);
  add(g, G.box, mats.trimWhite, [1.2, 1.0, 0.1], [0, 4.0, 4.55]);
  add(g, G.box, mats.eyeBlack, [0.9, 0.7, 0.12], [0, 4.0, 4.57]);
  return g;
}

export function makeSilo() {
  const g = new THREE.Group();
  add(g, G.cyl, std(0xd9d4c7), [3, 8, 3], [0, 4, 0]);
  add(g, G.sphere, mats.metal, [3.1, 2.4, 3.1], [0, 8, 0]);
  for (let y = 1.5; y < 8; y += 1.6) add(g, G.cyl, mats.darkMetal, [3.08, 0.12, 3.08], [0, y, 0]);
  return g;
}

export function makeTree(scale = 1) {
  const g = new THREE.Group();
  add(g, G.cyl, mats.trunk, [0.5, 1.6, 0.5], [0, 0.8, 0]);
  add(g, G.cone, mats.leaf, [2.8, 2.4, 2.8], [0, 2.4, 0]);
  add(g, G.cone, mats.leaf, [2.2, 2.0, 2.2], [0, 3.4, 0]);
  add(g, G.cone, mats.leaf, [1.5, 1.6, 1.5], [0, 4.3, 0]);
  g.scale.setScalar(scale);
  return g;
}

export function makeFence(length) {
  const g = new THREE.Group();
  const posts = Math.max(2, Math.round(length / 2.5) + 1);
  for (let i = 0; i < posts; i++) {
    const x = -length / 2 + (length * i) / (posts - 1);
    add(g, G.box, mats.wood, [0.22, 1.3, 0.22], [x, 0.65, 0]);
  }
  add(g, G.box, mats.wood, [length, 0.14, 0.08], [0, 0.95, 0]);
  add(g, G.box, mats.wood, [length, 0.14, 0.08], [0, 0.5, 0]);
  return g;
}

export function makeHayBale() {
  const g = new THREE.Group();
  const inner = pivot(g, [0, 0.45, 0]);
  add(inner, G.cyl, mats.hay, [0.95, 0.85, 0.95], [0, 0, 0], [0, 0, Math.PI / 2]);
  for (const x of [-0.22, 0.22]) add(inner, G.cyl, mats.hayDark, [0.97, 0.06, 0.97], [x, 0, 0], [0, 0, Math.PI / 2]);
  g.userData.inner = inner;
  return g;
}

export function makeMilkCarton() {
  const g = new THREE.Group();
  const inner = pivot(g, [0, 0.6, 0]);
  add(inner, G.box, mats.gold, [0.5, 0.7, 0.5], [0, 0, 0]);
  add(inner, G.box, mats.trimWhite, [0.52, 0.22, 0.52], [0, 0.05, 0]);
  add(inner, G.box, mats.gold, [0.36, 0.36, 0.5], [0, 0.4, 0], [0, 0, Math.PI / 4]);
  add(inner, G.box, mats.gold, [0.08, 0.16, 0.36], [0, 0.62, 0]);
  const glow = glowSprite(0xffd84a, 2.2, 0.7);
  inner.add(glow);
  g.userData.inner = inner;
  return g;
}

export function makeSheep() {
  const g = new THREE.Group();
  const puffs = [[0, 0.9, 0], [0.3, 1.0, 0.25], [-0.3, 1.0, 0.25], [0.3, 1.0, -0.25], [-0.3, 1.0, -0.25], [0, 1.2, 0]];
  for (const p of puffs) add(g, G.ico, mats.wool, [0.75, 0.7, 0.75], p);
  add(g, G.box, mats.cowBlack, [0.4, 0.45, 0.45], [0, 1.1, 0.6]);
  for (const [x, z] of [[0.25, 0.3], [-0.25, 0.3], [0.25, -0.3], [-0.25, -0.3]]) add(g, G.box, mats.cowBlack, [0.12, 0.5, 0.12], [x, 0.35, z]);
  return g;
}

export function makePig() {
  const g = new THREE.Group();
  add(g, G.box, mats.pig, [0.8, 0.7, 1.1], [0, 0.75, 0]);
  add(g, G.box, mats.pig, [0.6, 0.55, 0.45], [0, 0.85, 0.7]);
  add(g, G.box, std(0xe4838a), [0.3, 0.22, 0.12], [0, 0.8, 0.96]);
  for (const s of [1, -1]) add(g, G.box, mats.pig, [0.18, 0.18, 0.06], [0.2 * s, 1.15, 0.62], [0.4, 0, 0]);
  for (const [x, z] of [[0.25, 0.35], [-0.25, 0.35], [0.25, -0.35], [-0.25, -0.35]]) add(g, G.box, mats.pig, [0.16, 0.4, 0.16], [x, 0.2, z]);
  return g;
}

export function makeChicken() {
  const g = new THREE.Group();
  add(g, G.sphere, mats.wool, [0.6, 0.6, 0.7], [0, 0.6, 0]);
  add(g, G.sphere, mats.wool, [0.38, 0.38, 0.38], [0, 1.0, 0.25]);
  add(g, G.cone, mats.beak, [0.12, 0.18, 0.12], [0, 0.98, 0.48], [Math.PI / 2, 0, 0]);
  add(g, G.box, mats.comb, [0.06, 0.16, 0.2], [0, 1.22, 0.24]);
  for (const x of [0.1, -0.1]) add(g, G.cyl, mats.beak, [0.04, 0.32, 0.04], [x, 0.16, 0]);
  return g;
}
