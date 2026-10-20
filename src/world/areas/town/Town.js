import * as THREE from 'three';
import { Area } from '../../Area.js';
import { Batch, groundRect, place } from '../../build.js';
import { PALETTE } from '../../../core/config.js';
import { C, tree, signpost, lamp } from './props.js';
import { buildSchool } from './school.js';
import { buildPark } from './park.js';
import { buildWestside } from './westside.js';
import { buildDowntown } from './downtown.js';
import { buildFair } from './fair.js';
import { buildNeighborhood } from './neighborhood.js';
import { buildBeach } from './beach.js';

// Maplewood. The layout follows the reference map (north = -Z, east = +X):
//
//      [Mall]  ~river~  [1 High School] [2 Park] [Town Hall]   [6 Fairground]
//   ===West Ave==|bridge|======================= Main St ======================
//      [5 Arcade] ~river~        [3 Downtown plaza]       Elm St [4 Pip's street]
//   ~~~~~~~ bay ~~~~~~~~~~ ======= Shore Rd ===========================
//   ~~~~~~~~~~~~~~~~~~~~~~ [7 Beach, lighthouse, pier] ~~~~~~~~~~ sea ~~~~~~~~
//
// Roads are 7 wide with 1.5 sidewalks. Each district lives in its own file.

export const ROADS = {
  main: { z: -15, x0: -68, x1: 88 },
  shore: { z: 14, x0: 4, x1: 88 },
  schoolAve: { x: -4, z0: -48, z1: -18.5 },
  elm: { x: 48, z0: -48, z1: 10.5 },
  westAve: { x: -50, z0: -48, z1: 8 },
};
export const RIVER = { x0: -34, x1: -27 };

export class Town extends Area {
  constructor(game) {
    super(game, 'town');
    this.bounds = { minX: -68, maxX: 88, minZ: -48, maxZ: 47.5 };
    this.center.set(23, 0, -4);
    this.background = 0xa8dcff;
    this.fog = { color: 0xeef3d0, near: 70, far: 190 };
    this.anims = []; // per-frame callbacks from districts (ferris wheel, boat, ...)
    this.raised = []; // walkable platforms: { minX, maxX, minZ, maxZ, y }

    this.waterTex = makeWaterTexture();
    this.waterMat = new THREE.MeshBasicMaterial({ map: this.waterTex, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -12 });

    this.b = new Batch();
    this.buildGround();
    this.buildRoads();
    this.buildWater();
    this.buildEdges();
    buildSchool(this);
    buildPark(this);
    buildWestside(this);
    buildDowntown(this);
    buildFair(this);
    buildNeighborhood(this); // also sets the default spawn outside Pip's house
    buildBeach(this);
    this.buildWayfinding();
    this.b.finish(this.root);
    this.buildClouds();
  }

  // Water plane with world-scaled UVs so the ripple texture tiles evenly at any size.
  water(w, d, x, z, y = 0.015) {
    const g = new THREE.PlaneGeometry(w, d);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 10, uv.getY(i) * d / 10);
    g.rotateX(-Math.PI / 2);
    return place(this.root, new THREE.Mesh(g, this.waterMat), x, y, z);
  }

  getGroundHeight(x, z) {
    for (const r of this.raised) if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) return r.y;
    return 0;
  }

  waterDisc(r, x, z, y = 0.015) {
    const g = new THREE.CircleGeometry(r, 24);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * r / 5, uv.getY(i) * r / 5);
    g.rotateX(-Math.PI / 2);
    return place(this.root, new THREE.Mesh(g, this.waterMat), x, y, z);
  }

  buildGround() {
    const r = this.root;
    groundRect(r, C.grass, 420, 420, 10, 0, 0);
    const patches = [[-12, -30, 14, 8], [20, -38, 10, 6], [70, -30, 18, 10], [64, 30, 14, 4], [-60, -40, 6, 8], [30, 24, 10, 6]];
    for (const [x, z, w, d] of patches) groundRect(r, C.grassDark, w, d, x, z, 0.008);
  }

  hroad(z, x0, x1) {
    const r = this.root, w = x1 - x0, cx = (x0 + x1) / 2;
    groundRect(r, C.sidewalk, w, 10, cx, z, 0.02);
    groundRect(r, C.asphalt, w, 7, cx, z, 0.025);
    for (let x = x0 + 2; x < x1 - 1; x += 4) groundRect(r, C.laneYellow, 1.8, 0.22, x, z, 0.03);
  }

  vroad(x, z0, z1) {
    const r = this.root, d = z1 - z0, cz = (z0 + z1) / 2;
    groundRect(r, C.sidewalk, 10, d, x, cz, 0.021);
    groundRect(r, C.asphalt, 7, d, x, cz, 0.026);
    for (let z = z0 + 2; z < z1 - 1; z += 4) groundRect(r, C.laneYellow, 0.22, 1.8, x, z, 0.031);
  }

  crosswalk(x, z, alongX) {
    for (let i = -3; i <= 3; i += 1.5) {
      if (alongX) groundRect(this.root, C.lane, 0.7, 2.4, x + i, z, 0.034);
      else groundRect(this.root, C.lane, 2.4, 0.7, x, z + i, 0.034);
    }
  }

  buildRoads() {
    const R = ROADS;
    this.hroad(R.main.z, R.main.x0, R.main.x1);
    this.hroad(R.shore.z, R.shore.x0, R.shore.x1);
    this.vroad(R.schoolAve.x, R.schoolAve.z0, R.schoolAve.z1);
    this.vroad(R.elm.x, R.elm.z0, R.elm.z1);
    this.vroad(R.westAve.x, R.westAve.z0, R.westAve.z1);
    this.crosswalk(R.schoolAve.x, -22, false);
    this.crosswalk(R.elm.x, -22, false);
    this.crosswalk(R.elm.x, 7, false);
    this.crosswalk(23, -15, true);
    for (const x of [-60, -42, -14, 6, 30, 58, 76]) lamp(this, x, -10.6, -1);
    for (const x of [-58, -44, -21, 9, 27, 40, 60, 80]) lamp(this, x, -19.4, 1);
    for (const x of [10, 30, 56, 72]) { lamp(this, x, 9.4, 1); }
  }

  buildWater() {
    const b = this.b;
    // River from the north edge down into the bay, with rocky banks.
    const { x0, x1 } = RIVER;
    const rw = x1 - x0, rx = (x0 + x1) / 2;
    this.water(rw, 70, rx, -16);
    groundRect(this.root, C.sandDark, rw + 2, 70, rx, -16, 0.012);
    for (let z = -46; z < 10; z += 3.2) {
      if (z > -21 && z < -9) continue;
      b.sph(C.rock, 0.7 + ((z * 7) % 3) * 0.12, x0 - 0.6, 0.1, z, { scale: [1, 0.6, 1.3], outline: 0.04 });
      b.sph(C.rock, 0.7 + ((z * 5) % 3) * 0.12, x1 + 0.6, 0.1, z + 1.4, { scale: [1, 0.6, 1.3], outline: 0.04 });
    }
    this.colliders.push({ type: 'box', minX: x0, maxX: x1, minZ: -60, maxZ: -20.2, h: 0 });
    this.colliders.push({ type: 'box', minX: x0, maxX: x1, minZ: -9.8, maxZ: 12, h: 0 });
    // Bridge on Main St: railings + stone sides.
    for (const z of [-20.1, -9.9]) {
      b.box(C.rock, rw + 3, 0.9, 0.5, rx, 0, z, { outline: 0.04 });
      for (let x = x0 - 1; x <= x1 + 1; x += 1.8) b.box(C.white, 0.25, 1.2, 0.25, x, 0, z);
      this.solid(rx, z, rw + 3, 0.5, 1.2);
    }

    // The bay (south-west) and the open sea (south).
    this.water(200, 200, -96, 111);   // bay + beyond, x < 4, z > 11
    groundRect(this.root, C.sand, 76, 4.5, -32, 9.6, 0.013);
    this.water(300, 200, 150, 140);   // sea, z > 40
    this.colliders.push({ type: 'box', minX: -200, maxX: 4, minZ: 11.5, maxZ: 200, h: 0 });
    this.colliders.push({ type: 'box', minX: 4, maxX: 28.8, minZ: 40.5, maxZ: 200, h: 0 });
    this.colliders.push({ type: 'box', minX: 31.2, maxX: 300, minZ: 40.5, maxZ: 200, h: 0 });
    // Coast sand behind Pip's street
    groundRect(this.root, C.sand, 46, 8, 66, 36.5, 0.013);
    for (const [x, z, s] of [[-6, 10.5, 1.2], [-20, 11, 0.9], [-44, 10.8, 1.1], [-62, 10.4, 1], [52, 40, 1.2], [70, 40.3, 1], [86, 39.8, 1.3]]) {
      b.sph(C.rock, s, x, 0.1, z, { scale: [1.4, 0.7, 1], outline: 0.05 });
    }
  }

  buildEdges() {
    const b = this.b;
    // EarthBound beige plateaus ring the town to the north, west and east.
    const plateaus = [
      [10, -62, 180, 22, 9], [-80, -20, 22, 80, 7], [100, -16, 22, 70, 10], [-30, -60, 60, 14, 12],
    ];
    for (const [x, z, w, d, h] of plateaus) {
      b.box(PALETTE.cliff, w, h, d, x, 0, z, { outline: 0.12 });
      b.box(PALETTE.cliffShade, w + 0.05, 0.7, d + 0.05, x, h * 0.45, z);
      b.box(C.grass, w + 0.5, 0.6, d + 0.5, x, h, z);
    }
    // A wall of trees along the northern edge so the town doesn't just stop.
    for (let x = -66; x < 88; x += 5.5) {
      if (x > -36 && x < -25) continue; // river
      tree(this, x + ((x * 13) % 3), -50.5, 1.2 + ((x * 7) % 3) * 0.1);
    }
    for (let z = -44; z < 8; z += 6) tree(this, 91, z, 1.2);
  }

  buildWayfinding() {
    signpost(this, 52.5, 10, ['← DOWNTOWN · SCHOOL', '↑ FAIRGROUND'], 0);
    signpost(this, 44, -10.6, ['← HIGH SCHOOL', '↓ BEACH · HOME'], 0);
    signpost(this, -0.5, -10.6, ['↑ MAPLEWOOD HIGH', '← ARCADE & MALL'], 0);
    signpost(this, -25, -10.6, ['→ DOWNTOWN', '← ARCADE & MALL'], 0);
  }

  buildClouds() {
    this.clouds = [];
    const geo = new THREE.SphereGeometry(1, 10, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let i = 0; i < 7; i++) {
      const c = new THREE.Group();
      for (let k = 0; k < 4; k++) {
        const s = new THREE.Mesh(geo, mat);
        s.position.set(k * 1.6 - 2.4, Math.sin(k * 2) * 0.4, (k % 2) * 0.6);
        s.scale.setScalar(1.4 + (k % 3) * 0.5);
        c.add(s);
      }
      c.position.set(-120 + i * 40, 26 + (i % 3) * 4, -60 + (i % 3) * 50);
      this.root.add(c);
      this.clouds.push(c);
    }
  }

  update(dt) {
    super.update(dt);
    const t = this.t;
    this.waterTex.offset.set((t * 0.02) % 1, Math.sin(t * 0.6) * 0.04);
    for (const c of this.clouds) {
      c.position.x += dt * 1.4;
      if (c.position.x > 160) c.position.x = -140;
    }
    for (const fn of this.anims) fn(t, dt);
  }
}

function makeWaterTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#4fb4f0';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#9fe0ff';
  for (const [x, y, w] of [[6, 10, 12], [36, 22, 16], [14, 42, 10], [44, 52, 12], [26, 4, 8]]) g.fillRect(x, y, w, 3);
  g.fillStyle = '#3a9ad8';
  for (const [x, y, w] of [[20, 30, 14], [50, 8, 10], [2, 58, 12]]) g.fillRect(x, y, w, 3);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
