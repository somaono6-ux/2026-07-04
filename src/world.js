// Builds the playable mothership decks and the farm used by the cutscenes.
import * as THREE from 'three';
import { deckTextures, wallTexture, earthTexture, skyTexture, labelTexture } from './textures.js';
import {
  geometries as G, mats, glowSprite, makeBarn, makeSilo, makeTree, makeFence, makeHayBale,
  makeSheep, makePig, makeChicken,
} from './models.js';
import { rand } from './util.js';

function mesh(parent, geo, mat, scale, pos, rot, { cast = true, receive = false } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(scale[0], scale[1], scale[2]);
  m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  m.castShadow = cast;
  m.receiveShadow = receive;
  parent.add(m);
  return m;
}

export function makeStars(count = 1400, radius = 220, minY = -1) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const v = new THREE.Vector3().randomDirection();
    if (v.y < minY) v.y = -v.y;
    v.multiplyScalar(radius * rand(0.9, 1));
    pos.set([v.x, v.y, v.z], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.9 });
  return new THREE.Points(geo, mat);
}

/* ------------------------------------------------------------------ */
/* Mothership arena                                                    */
/* ------------------------------------------------------------------ */

export class Arena {
  constructor(level, { shadows = true } = {}) {
    this.level = level;
    this.w = level.w;
    this.d = level.d;
    this.group = new THREE.Group();
    this.obstacles = [];
    this.animators = [];
    this.doorOpen = false;
    this.doorT = 0;
    this.shadows = shadows;
    this.build();
  }

  build() {
    const { w, d, level } = this;
    const t = level.theme;
    const g = this.group;
    const glowColor = new THREE.Color(t.glow);
    const stripMat = new THREE.MeshStandardMaterial({ color: t.strip, emissive: t.strip, emissiveIntensity: 1.8 });
    this.stripMat = stripMat;

    // floor and hull
    const tex = deckTextures(t.floor, t.seam, t.glow, [w / 4, d / 4]);
    const floorMat = new THREE.MeshStandardMaterial({
      map: tex.map, emissiveMap: tex.emissiveMap, emissive: 0xffffff, emissiveIntensity: 0.55,
      metalness: 0.35, roughness: 0.62,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    g.add(floor);
    mesh(g, G.box, mats.darkMetal, [w + 8, 1.5, d + 8], [0, -0.77, 0], null, { cast: false, receive: true });
    // underside lights along the hull rim
    for (const s of [1, -1]) {
      mesh(g, G.box, stripMat, [w + 8, 0.12, 0.12], [0, -0.3, s * (d / 2 + 4)], null, { cast: false });
      mesh(g, G.box, stripMat, [0.12, 0.12, d + 8], [s * (w / 2 + 4), -0.3, 0], null, { cast: false });
    }

    // walls
    const side = new THREE.MeshStandardMaterial({ map: wallTexture(t.wall, t.strip), metalness: 0.5, roughness: 0.5 });
    const top = new THREE.MeshStandardMaterial({ color: t.seam, metalness: 0.6, roughness: 0.45 });
    // BoxGeometry face order: +x, -x, +y, -y, +z, -z
    const wallMat = [side, side, top, top, side, side];
    for (const s of [1, -1]) {
      mesh(g, G.box, wallMat, [1, 2.4, d + 2], [s * (w / 2 + 0.5), 1.2, 0], null, { receive: true });
      mesh(g, G.box, stripMat, [0.14, 0.08, d + 2], [s * (w / 2 + 0.07), 2.42, 0], null, { cast: false });
    }
    mesh(g, G.box, wallMat, [w + 2, 0.9, 1], [0, 0.45, d / 2 + 0.5], null, { receive: true });
    mesh(g, G.box, stripMat, [w + 2, 0.08, 0.14], [0, 0.92, d / 2 + 0.07], null, { cast: false });

    // north wall: low base, tall windows, the exit door in the middle
    const seg = w / 2 + 1 - 2.6;
    for (const s of [1, -1]) {
      const cx = s * (2.6 + seg / 2);
      mesh(g, G.box, wallMat, [seg, 1.4, 1], [cx, 0.7, -d / 2 - 0.5], null, { receive: true });
      mesh(g, G.box, mats.glass, [seg, 2.8, 0.15], [cx, 2.8, -d / 2 - 0.5], null, { cast: false });
      mesh(g, G.box, stripMat, [seg, 0.08, 0.14], [cx, 1.42, -d / 2 - 0.07], null, { cast: false });
      for (let x = 2.6; x <= w / 2 + 1; x += 4) {
        mesh(g, G.box, mats.darkMetal, [0.3, 4.2, 0.4], [s * x, 2.1, -d / 2 - 0.5]);
      }
      mesh(g, G.box, mats.darkMetal, [seg, 0.3, 0.5], [cx, 4.2, -d / 2 - 0.5]);
    }
    // door frame
    for (const s of [1, -1]) mesh(g, G.box, mats.darkMetal, [0.8, 4.4, 1.4], [s * 2.6, 2.2, -d / 2 - 0.5]);
    mesh(g, G.box, mats.darkMetal, [6, 0.9, 1.4], [0, 4.2, -d / 2 - 0.5]);
    this.doorLightMat = new THREE.MeshStandardMaterial({ color: 0xff3b3b, emissive: 0xff3b3b, emissiveIntensity: 2 });
    mesh(g, G.sphere, this.doorLightMat, [0.4, 0.4, 0.4], [0, 4.25, -d / 2 + 0.25], null, { cast: false });
    // the door itself hangs from a pivot so it can roll up
    this.doorPivot = new THREE.Group();
    this.doorPivot.position.set(0, 3.75, -d / 2 - 0.5);
    g.add(this.doorPivot);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x4a5577, metalness: 0.7, roughness: 0.35 });
    mesh(this.doorPivot, G.box, doorMat, [4.4, 3.75, 0.5], [0, -1.875, 0]);
    for (let i = 0; i < 3; i++) {
      mesh(this.doorPivot, G.box, this.doorLightMat, [3.6, 0.12, 0.55], [0, -0.7 - i * 1.1, 0], null, { cast: false });
    }
    // exit portal behind the door
    const portalMat = new THREE.MeshBasicMaterial({ color: 0x9dff7a, transparent: true, opacity: 0.85 });
    this.portal = mesh(g, new THREE.PlaneGeometry(1, 1), portalMat, [4.4, 3.7, 1], [0, 1.85, -d / 2 - 1.1], null, { cast: false });
    this.portalGlow = glowSprite(0x9dff7a, 9, 0.6);
    this.portalGlow.position.set(0, 1.8, -d / 2 - 0.9);
    this.portalGlow.visible = false;
    g.add(this.portalGlow);
    this.portal.visible = false;
    // floor chevrons pointing at the exit
    this.chevronMat = new THREE.MeshStandardMaterial({ color: 0x9dff7a, emissive: 0x9dff7a, emissiveIntensity: 0.1, transparent: true, opacity: 0.25 });
    this.chevrons = [];
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Group();
      c.position.set(0, 0.03, -d / 2 + 1.6 + i * 1.4);
      for (const s of [1, -1]) mesh(c, G.box, this.chevronMat, [1.3, 0.04, 0.32], [s * 0.45, 0, 0.35], [0, s * 0.6, 0], { cast: false });
      g.add(c);
      this.chevrons.push(c);
    }

    // teleport pads where aliens beam in
    const px = w / 2 - 2.6;
    const pz = d / 2 - 2.6;
    this.pads = [[-px, -pz], [px, -pz], [-px, pz], [px, pz], [-px, 0], [px, 0], [-w / 4, -pz], [w / 4, -pz]];
    const padMat = new THREE.MeshStandardMaterial({ color: 0x8dff6a, emissive: 0x8dff6a, emissiveIntensity: 0.7 });
    for (const [x, z] of this.pads) {
      mesh(g, G.cyl, mats.darkMetal, [2.2, 0.08, 2.2], [x, 0.04, z], null, { cast: false, receive: true });
      mesh(g, G.torus, padMat, [2, 2, 1.2], [x, 0.1, z], [Math.PI / 2, 0, 0], { cast: false });
    }

    this.buildProps(level.props);
    this.buildSpace();
    this.buildLights(glowColor);
  }

  addObstacle(x, z, r) {
    this.obstacles.push({ x, z, r });
  }

  buildProps(kind) {
    const g = this.group;
    if (kind === 'pen') {
      for (const [x, z] of [[-6.5, -2.5], [6.5, -2.5]]) this.cage(x, z);
      for (const [x, z] of [[-9.5, 4.5], [9.5, 4.5], [-3, -6.5]]) {
        mesh(g, G.box, mats.wood, [1.8, 1.6, 1.8], [x, 0.8, z], [0, rand(-0.3, 0.3), 0], { receive: true });
        mesh(g, G.box, mats.darkMetal, [1.9, 0.18, 1.9], [x, 1.55, z]);
        this.addObstacle(x, z, 1.25);
      }
      for (const [x, z] of [[3.5, 3.2], [-3.8, 3.4]]) this.barrel(x, z);
      // a pile of stolen Earth hay
      for (const [x, z, ry] of [[11.6, -7.6, 0.2], [10.4, -8.1, 1.4]]) {
        const h = makeHayBale();
        h.position.set(x, 0, z);
        h.rotation.y = ry;
        g.add(h);
      }
      this.addObstacle(11, -7.8, 1.3);
    } else if (kind === 'lab') {
      const animals = [makeSheep(), makePig(), makeChicken(), null];
      [[-7, -4], [7, -4], [-7, 4], [7, 4]].forEach(([x, z], i) => this.tube(x, z, animals[i]));
      for (const s of [1, -1]) {
        mesh(g, G.box, mats.metal, [1.2, 1.0, 5], [s * (this.w / 2 - 0.7), 0.5, -1], null, { receive: true });
        mesh(g, G.box, mats.glowMagenta, [0.8, 0.05, 4.4], [s * (this.w / 2 - 0.7), 1.03, -1], null, { cast: false });
        this.addObstacle(s * (this.w / 2 - 0.7), -2.6, 0.9);
        this.addObstacle(s * (this.w / 2 - 0.7), 0.6, 0.9);
      }
    } else if (kind === 'reactor') {
      this.reactor();
      for (const [x, z] of [[-9, -6], [9, -6], [-9, 6], [9, 6]]) this.barrel(x, z, true);
    } else if (kind === 'bridge') {
      const ringMat = new THREE.MeshStandardMaterial({ color: 0xffd84a, emissive: 0xffd84a, emissiveIntensity: 0.8, side: THREE.DoubleSide });
      for (const [r0, r1] of [[7.6, 8], [5.2, 5.35]]) {
        mesh(g, new THREE.RingGeometry(r0, r1, 72), ringMat, [1, 1, 1], [0, 0.03, -2], [-Math.PI / 2, 0, 0], { cast: false });
      }
      for (const s of [1, -1]) {
        for (const z of [-8, -2, 4]) {
          mesh(g, G.box, mats.darkMetal, [1.4, 1.1, 2.6], [s * (this.w / 2 - 0.6), 0.55, z], null, { receive: true });
          const scr = new THREE.MeshStandardMaterial({ color: 0xff6b5a, emissive: z === -2 ? 0x6fe3ff : 0xff6b5a, emissiveIntensity: 1.4 });
          mesh(g, G.box, scr, [0.9, 0.05, 2], [s * (this.w / 2 - 0.65), 1.12, z], [0, 0, s * 0.5], { cast: false });
          this.addObstacle(s * (this.w / 2 - 0.6), z - 0.6, 0.85);
          this.addObstacle(s * (this.w / 2 - 0.6), z + 0.6, 0.85);
        }
      }
    }
  }

  cage(x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    this.group.add(g);
    mesh(g, G.cyl, mats.darkMetal, [2.6, 0.2, 2.6], [0, 0.1, 0], null, { receive: true });
    mesh(g, G.cyl, mats.darkMetal, [2.6, 0.2, 2.6], [0, 2.6, 0]);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      mesh(g, G.cyl, mats.metal, [0.08, 2.5, 0.08], [Math.cos(a) * 1.22, 1.35, Math.sin(a) * 1.22]);
    }
    for (let i = 0; i < 6; i++) mesh(g, G.box, mats.hay, [0.6, 0.04, 0.08], [rand(-0.7, 0.7), 0.22, rand(-0.7, 0.7)], [0, rand(0, 3), 0], { cast: false });
    this.addObstacle(x, z, 1.4);
  }

  barrel(x, z, toxic = false) {
    const mat = toxic ? new THREE.MeshStandardMaterial({ color: 0x3d4f2f, metalness: 0.5, roughness: 0.5 }) : mats.darkMetal;
    mesh(this.group, G.cyl, mat, [1.1, 1.3, 1.1], [x, 0.65, z], null, { receive: true });
    mesh(this.group, G.cyl, toxic ? mats.glowGreen : this.stripMat, [1.14, 0.1, 1.14], [x, 0.9, z], null, { cast: false });
    this.addObstacle(x, z, 0.75);
  }

  tube(x, z, animal) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    this.group.add(g);
    mesh(g, G.cyl, mats.darkMetal, [2.3, 0.5, 2.3], [0, 0.25, 0], null, { receive: true });
    mesh(g, G.cyl, mats.darkMetal, [2.3, 0.4, 2.3], [0, 3.3, 0]);
    const liquid = new THREE.MeshStandardMaterial({ color: 0x7dffcf, emissive: 0x1d8f6a, emissiveIntensity: 0.9, transparent: true, opacity: 0.32, depthWrite: false });
    mesh(g, G.cyl, liquid, [1.9, 2.6, 1.9], [0, 1.8, 0], null, { cast: false });
    mesh(g, G.cyl, mats.glass, [2.05, 2.7, 2.05], [0, 1.8, 0], null, { cast: false });
    if (animal) {
      animal.scale.setScalar(0.85);
      animal.position.y = 1.0;
      g.add(animal);
      const phase = rand(0, 6);
      this.animators.push((dt, time) => {
        animal.position.y = 1.0 + Math.sin(time * 1.4 + phase) * 0.2;
        animal.rotation.y += dt * 0.4;
      });
    } else {
      // the empty tube was reserved for Bessie
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), new THREE.MeshStandardMaterial({ map: labelTexture(['RESERVED', 'SPECIMEN: COW']), emissive: 0x333333 }));
      sign.position.set(0, 0.55, 1.18);
      sign.rotation.x = -0.35;
      g.add(sign);
    }
    this.addObstacle(x, z, 1.25);
  }

  reactor() {
    const g = new THREE.Group();
    this.group.add(g);
    mesh(g, G.cyl, mats.darkMetal, [6.2, 0.6, 6.2], [0, 0.3, 0], null, { receive: true });
    const coreMat = new THREE.MeshStandardMaterial({ color: 0x9dff7a, emissive: 0x9dff7a, emissiveIntensity: 2.2, transparent: true, opacity: 0.9 });
    const core = mesh(g, G.cyl, coreMat, [2.2, 3.4, 2.2], [0, 2.2, 0], null, { cast: false });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      mesh(g, G.cyl, mats.metal, [0.26, 3.6, 0.26], [Math.cos(a) * 2.5, 2.2, Math.sin(a) * 2.5]);
    }
    mesh(g, G.cyl, mats.darkMetal, [5.6, 0.4, 5.6], [0, 4.0, 0]);
    const rings = [];
    const ringGeo = new THREE.TorusGeometry(3.3, 0.09, 8, 56);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: 0xffb347, emissiveIntensity: 1.2 });
    for (let i = 0; i < 2; i++) rings.push(mesh(g, ringGeo, ringMat, [1, 1, 1], [0, 1.5 + i * 1.4, 0], [Math.PI / 2, 0, 0], { cast: false }));
    const halo = glowSprite(0x9dff7a, 8, 0.35);
    halo.position.y = 2.2;
    g.add(halo);
    this.animators.push((dt, time) => {
      coreMat.emissiveIntensity = 1.8 + Math.sin(time * 3) * 0.6;
      rings.forEach((r, i) => {
        r.rotation.x = Math.PI / 2 + Math.sin(time * 0.8 + i) * 0.25;
        r.rotation.y = Math.cos(time * 0.7 + i * 2) * 0.25;
      });
      core.rotation.y += dt;
    });
    this.addObstacle(0, 0, 3.2);
  }

  buildSpace() {
    const g = this.group;
    g.add(makeStars());
    const earthMat = new THREE.MeshStandardMaterial({ map: earthTexture(), roughness: 0.9, emissive: 0x16306a, emissiveIntensity: 0.35, fog: false });
    const earth = new THREE.Mesh(new THREE.SphereGeometry(48, 48, 32), earthMat);
    const big = this.level.boss;
    earth.position.set(big ? -6 : 10, big ? -52 : -62, -this.d / 2 - (big ? 42 : 52));
    earth.rotation.z = 0.3;
    g.add(earth);
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(50.5, 48, 32),
      new THREE.MeshBasicMaterial({ color: 0x6fb8ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, side: THREE.BackSide, fog: false, depthWrite: false }),
    );
    atmo.position.copy(earth.position);
    g.add(atmo);
    this.animators.push((dt) => {
      earth.rotation.y += dt * 0.02;
    });
  }

  buildLights(glowColor) {
    const g = this.group;
    const t = this.level.theme;
    g.add(new THREE.HemisphereLight(0xa8b8ff, 0x2a1f36, 0.8));
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(8, 26, 12);
    key.target.position.set(0, 0, 0);
    g.add(key, key.target);
    if (this.shadows) {
      key.castShadow = true;
      const s = Math.max(this.w, this.d) / 2 + 3;
      Object.assign(key.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 5, far: 70 });
      key.shadow.mapSize.set(2048, 2048);
      key.shadow.bias = -0.0008;
      key.shadow.normalBias = 0.02;
    }
    const p1 = new THREE.PointLight(t.light, 60, 40, 1.4);
    p1.position.set(-this.w / 3, 5, -this.d / 3);
    const p2 = new THREE.PointLight(t.light2, 60, 40, 1.4);
    p2.position.set(this.w / 3, 5, this.d / 3);
    g.add(p1, p2);
    this.exitLight = new THREE.PointLight(0x9dff7a, 0, 14, 1.5);
    this.exitLight.position.set(0, 2.5, -this.d / 2 + 1);
    g.add(this.exitLight);
    this.glowColor = glowColor;
  }

  openDoor() {
    this.doorOpen = true;
    this.doorLightMat.color.set(0x8dff6a);
    this.doorLightMat.emissive.set(0x8dff6a);
    this.portal.visible = true;
    this.portalGlow.visible = true;
  }

  update(dt, time) {
    for (const a of this.animators) a(dt, time);
    if (this.doorOpen && this.doorT < 1) {
      this.doorT = Math.min(1, this.doorT + dt * 1.2);
      this.doorPivot.scale.y = Math.max(0.03, 1 - this.doorT);
    }
    if (this.doorOpen) {
      const pulse = 0.5 + Math.sin(time * 5) * 0.5;
      this.chevronMat.emissiveIntensity = 1 + pulse * 1.5;
      this.chevronMat.opacity = 0.6 + pulse * 0.4;
      this.chevrons.forEach((c, i) => {
        c.position.y = 0.03 + Math.max(0, Math.sin(time * 6 - i * 1.2)) * 0.06;
      });
      this.exitLight.intensity = 25 + pulse * 15;
      this.portal.material.opacity = 0.65 + pulse * 0.3;
    }
  }

  // Keep a circle inside the room and out of obstacles. Returns true on contact.
  resolve(pos, r, isPlayer = false) {
    const hw = this.w / 2;
    const hd = this.d / 2;
    let hit = false;
    let minZ = -hd + r;
    if (isPlayer && this.doorOpen && Math.abs(pos.x) < 2.2 - r * 0.4) minZ = -hd - 1.4;
    if (pos.x < -hw + r) { pos.x = -hw + r; hit = true; }
    if (pos.x > hw - r) { pos.x = hw - r; hit = true; }
    if (pos.z < minZ) { pos.z = minZ; hit = true; }
    if (pos.z > hd - r) { pos.z = hd - r; hit = true; }
    for (const o of this.obstacles) {
      const dx = pos.x - o.x;
      const dz = pos.z - o.z;
      const min = o.r + r;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min) {
        const dist = Math.sqrt(d2) || 0.001;
        pos.x = o.x + (dx / dist) * min;
        pos.z = o.z + (dz / dist) * min;
        hit = true;
      }
    }
    return hit;
  }

  // Projectiles stop at walls and props.
  blocks(x, z) {
    if (Math.abs(x) > this.w / 2 + 0.2 || Math.abs(z) > this.d / 2 + 0.2) return true;
    for (const o of this.obstacles) {
      const dx = x - o.x;
      const dz = z - o.z;
      if (dx * dx + dz * dz < o.r * o.r * 0.8) return true;
    }
    return false;
  }

  reachedExit(pos) {
    return this.doorOpen && this.doorT > 0.6 && pos.z < -this.d / 2 - 0.6 && Math.abs(pos.x) < 2.4;
  }

  freeSpot(r = 1, tries = 40) {
    for (let i = 0; i < tries; i++) {
      const x = rand(-this.w / 2 + 2, this.w / 2 - 2);
      const z = rand(-this.d / 2 + 2, this.d / 2 - 2);
      if (this.obstacles.every((o) => Math.hypot(x - o.x, z - o.z) > o.r + r + 0.5)) return { x, z };
    }
    return { x: 0, z: this.d / 2 - 3 };
  }
}

/* ------------------------------------------------------------------ */
/* The farm                                                            */
/* ------------------------------------------------------------------ */

export function buildFarm(mode = 'night', { shadows = true } = {}) {
  const night = mode === 'night';
  const g = new THREE.Group();

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(320, 32, 16),
    new THREE.MeshBasicMaterial({
      map: night ? skyTexture('#050818', '#1b2a5c', '#0b1226') : skyTexture('#5a7fd0', '#ffb98a', '#d68a6a'),
      side: THREE.BackSide, fog: false, depthWrite: false,
    }),
  );
  g.add(sky);
  const stars = makeStars(night ? 1600 : 400, 300, 0.05);
  stars.material.opacity = night ? 0.95 : 0.25;
  g.add(stars);

  // rolling ground with painted color variation
  const geo = new THREE.PlaneGeometry(320, 320, 80, 80);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const base = new THREE.Color(night ? 0x3b6b3c : 0x5f9a45);
  const alt = new THREE.Color(night ? 0x24452a : 0x7aa84d);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const dist = Math.hypot(x, z);
    const hill = dist > 30 ? (Math.sin(x * 0.04) + Math.cos(z * 0.05)) * Math.min(1, (dist - 30) / 40) * 4 : 0;
    p.setY(i, hill);
    c.copy(base).lerp(alt, (Math.sin(x * 0.3) * Math.cos(z * 0.27) + 1) / 2 * 0.8 + Math.random() * 0.2);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  ground.receiveShadow = true;
  g.add(ground);

  // grass tufts
  const tuftGeo = new THREE.ConeGeometry(0.12, 0.5, 4);
  tuftGeo.translate(0, 0.25, 0);
  const tufts = new THREE.InstancedMesh(tuftGeo, new THREE.MeshStandardMaterial({ color: night ? 0x3d7040 : 0x79b552, roughness: 1 }), 900);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let i = 0; i < 900; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * 28;
    v.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 3);
    const sc = rand(0.7, 1.5);
    s.set(sc, sc, sc);
    m.compose(v, q, s);
    tufts.setMatrixAt(i, m);
  }
  g.add(tufts);

  const barn = makeBarn();
  barn.position.set(-11, 0, -12);
  barn.rotation.y = 0.45;
  g.add(barn);
  const silo = makeSilo();
  silo.position.set(-19, 0, -16);
  g.add(silo);
  // warm light spilling from the barn loft
  const loft = new THREE.PointLight(0xffb45a, night ? 30 : 0, 18, 1.5);
  loft.position.set(-9.2, 4, -7.6);
  g.add(loft);
  if (night) {
    const lamp = glowSprite(0xffc070, 3, 0.8);
    lamp.position.set(-9.4, 4.0, -7.9);
    g.add(lamp);
  }

  // pasture fence
  const fence = [
    [6, -10, 24, 0], [6, 14, 24, 0], [-6, 2, 24, Math.PI / 2], [18, 2, 24, Math.PI / 2],
  ];
  for (const [x, z, len, ry] of fence) {
    const f = makeFence(len);
    f.position.set(x, 0, z);
    f.rotation.y = ry;
    g.add(f);
  }
  for (const [x, z, ry] of [[-4, -5, 0.3], [-3, -2.6, 1.2], [12, 10, 0.8]]) {
    const h = makeHayBale();
    h.position.set(x, 0, z);
    h.rotation.y = ry;
    g.add(h);
  }
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + rand(-0.1, 0.1);
    const r = rand(34, 70);
    const t = makeTree(rand(1.2, 2.2));
    t.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    g.add(t);
  }

  // moon or rising sun
  const orb = new THREE.Mesh(new THREE.SphereGeometry(night ? 9 : 14, 24, 16), new THREE.MeshBasicMaterial({ color: night ? 0xfff4d6 : 0xffd27a, fog: false }));
  orb.position.set(night ? -80 : 120, night ? 110 : 26, -230);
  g.add(orb);
  const orbGlow = glowSprite(night ? 0xfff0c0 : 0xffb070, night ? 60 : 110, night ? 0.35 : 0.6);
  orbGlow.position.copy(orb.position);
  orbGlow.material.fog = false;
  g.add(orbGlow);

  // lights
  g.add(new THREE.HemisphereLight(night ? 0x8098e0 : 0xffd6b0, night ? 0x1d3a22 : 0x40603a, night ? 1.6 : 1.4));
  const sun = new THREE.DirectionalLight(night ? 0xc8d6ff : 0xffc890, night ? 2.2 : 2.6);
  sun.position.set(night ? -20 : 40, night ? 40 : 22, night ? -14 : -30);
  sun.target.position.set(0, 0, 0);
  g.add(sun, sun.target);
  if (shadows) {
    sun.castShadow = true;
    Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 });
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0008;
  }

  return {
    group: g,
    fog: night ? new THREE.Fog(0x0d1530, 70, 260) : new THREE.Fog(0xf0b48c, 80, 300),
    background: new THREE.Color(night ? 0x050818 : 0xf0b48c),
    cowSpot: new THREE.Vector3(4, 0, 2),
  };
}
