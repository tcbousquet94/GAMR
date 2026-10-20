import * as THREE from 'three';
import { Area } from '../Area.js';
import { Batch, groundRect, signMesh, place } from '../build.js';
import { PALETTE } from '../../core/config.js';

// Maplewood: one east-west street. Pip's house is at the west end (south side), Maplewood High
// closes off the east end. North = -Z, east = +X. The street runs along z = 0.

const C = {
  asphalt: 0x6f7390,
  lane: 0xffd23f,
  sidewalk: 0xece3cc,
  path: 0xf0dca0,
  grass: PALETTE.grass,
  grassDark: PALETTE.grassDark,
  hedge: 0x3f9a3c,
  trunk: 0x8a5a32,
  leaf: 0x46a83f,
  leafLight: 0x6cc24f,
  white: 0xfdf8ec,
  window: 0x7fc8f0,
  door: 0x8a4a2a,
  dark: 0x3a2a3e,
};

const HOUSE_FRONT = 10;   // z of south-side house fronts
const SHOP_FRONT = -9;    // z of north-side shop fronts

export class Town extends Area {
  constructor(game) {
    super(game, 'town');
    this.bounds = { minX: -42, maxX: 46, minZ: -16, maxZ: 20 };
    this.center.set(-4, 0, 0);
    this.background = 0xa8dcff;
    this.fog = { color: 0xf3f0c8, near: 50, far: 130 };

    // Pip starts on the sidewalk outside his house, facing down the street toward school.
    this.addSpawn('default', -26, 5.4, Math.PI / 2);
    this.addSpawn('pipHouse', -26, 8.2, Math.PI / 2);
    this.addSpawn('school', 30.5, 0, -Math.PI / 2);

    this.b = new Batch();
    this.buildGround();
    this.buildStreetFurniture();
    this.buildPipHouse();
    this.buildNeighbors();
    this.buildShops();
    this.buildSchoolFront();
    this.buildEdges();
    this.b.finish(this.root);
    this.buildClouds();
  }

  // ------------------------------------------------------------------ ground
  buildGround() {
    const r = this.root;
    groundRect(r, C.grass, 260, 260, 0, 0, 0);
    groundRect(r, C.asphalt, 88, 8, -16, 0, 0.02);                // street (ends at the school plaza)
    for (let x = -58; x < 26; x += 4) groundRect(r, C.lane, 1.8, 0.25, x, 0, 0.03);
    groundRect(r, C.sidewalk, 88, 2.5, -16, -5.25, 0.025);        // north sidewalk
    groundRect(r, C.sidewalk, 88, 2.5, -16, 5.25, 0.025);         // south sidewalk
    groundRect(r, C.path, 12, 16, 33, 0, 0.022);                  // school plaza
    for (let z = -3; z <= 3; z += 1.5) groundRect(r, C.white, 2.6, 0.7, 25, z, 0.035); // crosswalk
    // Darker lawn patches for that 16-bit blotchy look.
    const patches = [[-30, 14, 9, 5], [-12, 15, 7, 4], [4, 13, 6, 5], [20, 15, 10, 6], [-20, -13, 6, 3], [18, -12, 8, 4]];
    for (const [x, z, w, d] of patches) groundRect(r, C.grassDark, w, d, x, z, 0.012);
  }

  tree(x, z, s = 1) {
    const b = this.b;
    b.cyl(C.trunk, 0.22 * s, 0.32 * s, 2.2 * s, x, 0, z, { outline: 0.05 });
    b.sph(C.leaf, 1.35 * s, x, 3.0 * s, z, { outline: 0.08 });
    b.sph(C.leafLight, 0.95 * s, x + 0.6 * s, 3.7 * s, z + 0.3 * s, { outline: 0.07 });
    b.sph(C.leaf, 0.9 * s, x - 0.7 * s, 3.5 * s, z - 0.2 * s, { outline: 0.07 });
    this.post(x, z, 0.4 * s, 4.6 * s, 1.5 * s);
  }

  lamp(x, z) {
    const b = this.b;
    b.cyl(0x4a4e6a, 0.09, 0.12, 4, x, 0, z);
    b.box(0x4a4e6a, 0.12, 0.12, 0.9, x, 3.9, z + (z > 0 ? -0.4 : 0.4));
    b.sph(0xfff3a8, 0.26, x, 3.75, z + (z > 0 ? -0.8 : 0.8), { outline: 0.04 });
    this.post(x, z, 0.18, 4);
  }

  car(x, z, color, ry = 0) {
    const b = this.b;
    b.box(color, 4, 0.9, 1.9, x, 0.35, z, { ry, outline: 0.05 });
    b.box(color, 2.2, 0.75, 1.7, x - 0.2, 1.25, z, { ry, outline: 0.05 });
    b.box(C.window, 2.25, 0.5, 1.72, x - 0.2, 1.35, z, { ry });
    for (const dx of [-1.3, 1.3]) for (const dz of [-0.95, 0.95]) {
      b.cyl(0x2a2a33, 0.38, 0.38, 0.3, x + dx, 0.38, z + dz, { rx: Math.PI / 2, seg: 10 });
    }
    this.solid(x, z, 4.2, 2.1, 2);
  }

  buildStreetFurniture() {
    for (const x of [-34, -18, -2, 14]) this.tree(x, 7.4);
    for (const x of [-30, -12, 2, 18]) this.tree(x, -7.6);
    for (const x of [-38, -22, -6, 10, 24]) { this.lamp(x, 4.6); this.lamp(x + 8, -4.6); }
    this.car(-15, -2.6, 0xe8423c);
    this.car(12, 2.6, 0x4f8fe0, Math.PI);
    // Fire hydrant that is clearly too proud of itself.
    this.b.cyl(0xe8423c, 0.22, 0.26, 0.75, -4.5, 0, 4.4, { outline: 0.04 });
    this.b.sph(0xe8423c, 0.22, -4.5, 0.78, 4.4);
    this.post(-4.5, 4.4, 0.3, 1);
    const sign = signMesh(['BEST HYDRANT', '3 years running'], { w: 1.6, h: 0.6, px: 34 });
    place(this.root, sign, -4.5, 1.35, 4.15, 0);
    this.b.cyl(0x4a4e6a, 0.04, 0.04, 1.1, -4.5, 0, 4.12);
  }

  // A one-story house whose front faces the street (north). Returns the door's x.
  house(x, { w = 9, wall, roof, trim = C.white, door = C.door }) {
    const b = this.b;
    const z = HOUSE_FRONT + 3.5;
    b.box(wall, w, 4.2, 7, x, 0, z, { outline: 0.06 });
    b.gable(roof, w + 0.8, 2.6, 7.8, x, 4.2, z, { outline: 0.06 });
    b.box(trim, w + 0.2, 0.3, 7.2, x, 4.0, z);
    b.box(door, 1.4, 2.4, 0.2, x, 0, HOUSE_FRONT - 0.02, { outline: 0.03 });
    b.sph(0xffd23f, 0.08, x + 0.45, 1.2, HOUSE_FRONT - 0.15);
    for (const dx of [-w * 0.3, w * 0.3]) {
      b.box(C.window, 1.6, 1.3, 0.12, x + dx, 1.5, HOUSE_FRONT - 0.03, { outline: 0.04 });
      b.box(trim, 1.9, 0.18, 0.3, x + dx, 1.35, HOUSE_FRONT - 0.1);
    }
    b.box(0xb8a98a, 2.2, 0.25, 1.2, x, 0, HOUSE_FRONT - 0.6); // doorstep
    groundRect(this.root, C.path, 1.6, 3.5, x, HOUSE_FRONT - 2.1, 0.02);
    this.solid(x, z, w, 7, 6.8);
    return x;
  }

  picketFence(x0, x1, z) {
    const b = this.b;
    const len = x1 - x0;
    b.box(C.white, len, 0.12, 0.08, (x0 + x1) / 2, 0.55, z);
    b.box(C.white, len, 0.12, 0.08, (x0 + x1) / 2, 0.25, z);
    for (let x = x0; x <= x1 + 0.01; x += 0.5) b.box(C.white, 0.14, 0.95, 0.1, x, 0, z);
    this.solid((x0 + x1) / 2, z, len, 0.3, 1);
  }

  buildPipHouse() {
    const x = this.house(-26, { wall: 0xffd86a, roof: 0xd2493f });
    this.door(x, HOUSE_FRONT - 0.5, 1.8, 1.2, {
      message: { speaker: 'Mom', text: "(from inside) Pip, honey, you'll be late for homeroom! Scoot! Love you! SCOOT!" },
    });
    this.picketFence(-31, -27.2, 7.0);
    this.picketFence(-24.8, -21, 7.0);
    // Mailbox
    this.b.cyl(0x8a5a32, 0.07, 0.07, 1.1, -29.6, 0, 6.4);
    this.b.box(0x3b6fd8, 0.5, 0.42, 0.75, -29.6, 1.05, 6.4, { outline: 0.04 });
    this.b.box(0xe8423c, 0.06, 0.4, 0.12, -29.33, 1.3, 6.55);
    const plaque = signMesh(['THE PIP RESIDENCE', 'no solicitors · no ghosts'], { w: 2.6, h: 0.9, px: 42, bg: '#fff3c4' });
    place(this.root, plaque, -22.2, 1.0, 9.0, 0);
    this.b.cyl(0x8a5a32, 0.05, 0.05, 0.6, -22.2, 0, 9.05);
    // Pip's bike, abandoned dramatically on the lawn.
    this.b.cyl(0x2a2a33, 0.35, 0.35, 0.06, -28, 0.35, 8.8, { rx: Math.PI / 2, rz: 0.4, seg: 12 });
    this.b.cyl(0x2a2a33, 0.35, 0.35, 0.06, -27.1, 0.35, 8.5, { rx: Math.PI / 2, rz: 0.4, seg: 12 });
    this.b.box(0xe8423c, 1.0, 0.08, 0.08, -27.55, 0.55, 8.65, { ry: 0.32 });
  }

  buildNeighbors() {
    const b = this.b;
    // Mint house with a lawn-gnome army. They all face the street. Always.
    const x1 = this.house(-10, { wall: 0xb8ead0, roof: 0x4aa3a0 });
    this.door(x1, HOUSE_FRONT - 0.5, 1.8, 1.2, {
      message: { speaker: '', text: 'You knock. Somewhere inside, forty garden gnomes go quiet.' },
    });
    for (let i = 0; i < 7; i++) {
      const gx = -14 + (i % 4) * 1.0 + (i >= 4 ? 4.6 : 0), gz = 8 + (i % 2) * 0.6;
      b.cyl(0x3b6fd8, 0.16, 0.2, 0.35, gx, 0, gz);
      b.sph(0xffd3a8, 0.13, gx, 0.47, gz);
      b.cyl(0xe8423c, 0.0, 0.15, 0.35, gx, 0.55, gz);
      b.sph(C.white, 0.09, gx, 0.38, gz + 0.1);
    }
    const g = signMesh(['GNOME CROSSING'], { w: 2.2, h: 0.55, px: 40, bg: '#ffe680' });
    place(this.root, g, -6.2, 1.0, 8.8, 0);
    b.cyl(0x8a5a32, 0.05, 0.05, 0.75, -6.2, 0, 8.85);

    // The beige house.
    const x2 = this.house(6, { wall: 0xe6d8b8, roof: 0xc9b48a, trim: 0xd8caa8, door: 0xc9b48a });
    this.door(x2, HOUSE_FRONT - 0.5, 1.8, 1.2, {
      message: { speaker: '', text: 'The doorbell plays a single, perfectly average note.' },
    });
    const n = signMesh(['THIS HOUSE IS', 'AGGRESSIVELY NORMAL'], { w: 2.6, h: 0.95, px: 40, bg: '#efe4cc' });
    place(this.root, n, 9.6, 1.05, 8.6, 0);
    b.cyl(0x8a5a32, 0.05, 0.05, 0.65, 9.6, 0, 8.65);

    // Empty lot with a hole nobody talks about.
    const hole = new THREE.Mesh(new THREE.CircleGeometry(2.2, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x120a18 }));
    place(this.root, hole, 21, 0.03, 13, 0);
    const rim = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.7, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x8a6a4a }));
    place(this.root, rim, 21, 0.025, 13, 0);
    this.post(21, 13, 2.2, 0.3);
    const h = signMesh(['DO NOT LOOK', 'IN HOLE'], { w: 1.8, h: 0.9, px: 44, bg: '#ffffff', fg: '#c11f4f' });
    place(this.root, h, 21, 1.2, 9.6, 0);
    b.cyl(0x8a5a32, 0.05, 0.05, 0.8, 21, 0, 9.65);
  }

  // A flat-roofed shop whose front faces the street (south).
  shop(x, { w = 10, wall, awningA, awningB, title, sub }) {
    const b = this.b;
    const z = SHOP_FRONT - 3;
    b.box(wall, w, 4.6, 6, x, 0, z, { outline: 0.06 });
    b.box(0xfdf8ec, w + 0.3, 0.5, 6.3, x, 4.6, z, { outline: 0.05 });
    b.box(C.window, w * 0.32, 1.7, 0.12, x - w * 0.27, 0.6, SHOP_FRONT + 0.03, { outline: 0.04 });
    b.box(C.window, w * 0.32, 1.7, 0.12, x + w * 0.27, 0.6, SHOP_FRONT + 0.03, { outline: 0.04 });
    b.box(C.window, 1.6, 2.5, 0.14, x, 0, SHOP_FRONT + 0.03, { outline: 0.04 });
    // Striped awning
    const n = 8;
    for (let i = 0; i < n; i++) {
      b.box(i % 2 ? awningA : awningB, w / n, 0.15, 1.6, x - w / 2 + (i + 0.5) * (w / n), 2.85, SHOP_FRONT + 0.75, { rx: -0.25 });
    }
    const s = signMesh(sub ? [title, sub] : [title], { w: w * 0.8, h: 1.1, px: 54 });
    place(this.root, s, x, 3.75, SHOP_FRONT + 0.05, 0);
    this.solid(x, z, w, 6, 5.1);
  }

  buildShops() {
    this.shop(-24, { wall: 0xf7b7c8, awningA: 0xe8423c, awningB: 0xfdf8ec, title: "ROXY'S CORNER MART", sub: 'we have ice' });
    this.door(-24, SHOP_FRONT + 0.5, 1.8, 1.2, {
      message: { speaker: '', text: "CLOSED FOR \"INVENTORY.\" You can hear someone inside playing the same guitar chord over and over." },
    });
    this.shop(8, { wall: 0x9fd8f0, awningA: 0x4aa3a0, awningB: 0xfdf8ec, title: 'SUDS CITY', sub: 'home of the missing sock' });
    this.door(8, SHOP_FRONT + 0.5, 1.8, 1.2, {
      message: { speaker: '', text: 'One dryer inside is tumbling a single sock. A sign says it has been running since 1987.' },
    });

    // Bus stop that the bus has heard about but never visited.
    const b = this.b;
    b.box(0x4aa3a0, 4, 0.18, 1.8, -8, 2.5, -7.4, { outline: 0.04 });
    b.box(C.window, 4, 2.3, 0.1, -8, 0.2, -8.25);
    b.box(0x8a5a32, 3, 0.15, 0.6, -8, 0.55, -7.8);
    b.box(0x4a4e6a, 0.1, 0.55, 0.1, -9.3, 0, -7.8);
    b.box(0x4a4e6a, 0.1, 0.55, 0.1, -6.7, 0, -7.8);
    this.solid(-8, -7.9, 4, 0.8, 2.6);
    b.cyl(0x4a4e6a, 0.06, 0.06, 2.6, -5.4, 0, -6.6);
    const bus = signMesh(['BUS STOP', 'bus comes thursdays. sometimes.'], { w: 1.6, h: 0.9, px: 38, bg: '#ffffff', fg: '#3b6fd8' });
    place(this.root, bus, -5.4, 2.3, -6.55, 0);
    this.post(-5.4, -6.6, 0.12, 2.6);

    // The town founder, captured forever mid-shrug.
    b.box(0xc9c3b4, 2, 1.2, 2, 20, 0, -11, { outline: 0.05 });
    b.cyl(0xb0aa9a, 0.45, 0.55, 1.4, 20, 1.2, -11, { outline: 0.05 });
    b.sph(0xb0aa9a, 0.55, 20, 3.0, -11, { outline: 0.05 });
    for (const s of [-1, 1]) {
      b.box(0xb0aa9a, 0.9, 0.22, 0.22, 20 + s * 0.8, 2.55, -11, { rz: s * 0.5, outline: 0.03 });
      b.box(0xb0aa9a, 0.22, 0.6, 0.22, 20 + s * 1.2, 2.75, -11, { outline: 0.03 });
    }
    this.solid(20, -11, 2.2, 2.2, 3.5);
    const plaque = signMesh(['ELIAS MAPLE, FOUNDER', '"I guess here is fine."'], { w: 1.9, h: 0.75, px: 30, bg: '#d9c9a0' });
    place(this.root, plaque, 20, 0.6, -9.98, 0);
    this.tree(15, -12, 1.1);
    this.tree(26, -12.5, 0.9);
    this.tree(-34, -12, 1.2);
  }

  buildSchoolFront() {
    const b = this.b;
    const fx = 36; // facade plane (faces west)
    b.box(0xfbe9c0, 12, 8, 30, fx + 6, 0, 0, { outline: 0.08 });
    b.box(0xe88a6a, 12.4, 0.6, 30.4, fx + 6, 8, 0, { outline: 0.06 });
    b.box(0xe88a6a, 0.3, 8, 0.8, fx - 0.1, 0, -6.4);
    b.box(0xe88a6a, 0.3, 8, 0.8, fx - 0.1, 0, 6.4);
    // Entrance block with a gable, doors, steps
    b.box(0xe88a6a, 3, 9.5, 8, fx - 1, 0, 0, { outline: 0.07 });
    b.gable(0x4aa3a0, 3.4, 2.4, 8.8, fx - 1, 9.5, 0, { ry: 0, outline: 0.06 });
    b.box(0x2f8f8a, 0.2, 3.2, 1.3, fx - 2.55, 0.6, -0.68, { outline: 0.03 });
    b.box(0x2f8f8a, 0.2, 3.2, 1.3, fx - 2.55, 0.6, 0.68, { outline: 0.03 });
    b.box(C.window, 0.22, 1.2, 0.9, fx - 2.6, 2.3, -0.68);
    b.box(C.window, 0.22, 1.2, 0.9, fx - 2.6, 2.3, 0.68);
    for (let i = 0; i < 3; i++) b.box(0xd8ccb0, 1, 0.2, 6 - i * 0.6, fx - 3 - (2 - i) * 0.9 + 0.5, i * 0.2, 0, { outline: 0.03 });
    // Window rows
    for (const z of [-12, -9, -3.6 - 0.9, 4.5, 9, 12]) {
      for (const y of [1.6, 5.0]) b.box(C.window, 0.14, 1.7, 1.6, fx - 0.04, y, z, { outline: 0.04 });
    }
    // Clock
    b.cyl(0xfdf8ec, 0.9, 0.9, 0.2, fx - 2.6, 6.8, 0, { rz: Math.PI / 2, outline: 0.06, seg: 20 });
    this.clockHand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.08).translate(0, 0.3, 0), new THREE.MeshBasicMaterial({ color: 0x2a1a2e }));
    this.clockHand.position.set(fx - 2.75, 6.8, 0);
    this.clockHand.rotation.y = -Math.PI / 2;
    this.root.add(this.clockHand);
    const sign = signMesh(['MAPLEWOOD HIGH'], { w: 6.5, h: 1.1, px: 76, bg: '#2a3a6a', fg: '#ffe680', border: '#ffe680' });
    place(this.root, sign, fx - 2.58, 4.9, 0, -Math.PI / 2);
    const motto = signMesh(['GO FIGHTING POSSUMS!', 'est. probably 1950-something'], { w: 3.2, h: 1.1, px: 40, bg: '#ffffff', fg: '#c11f4f' });
    place(this.root, motto, 31, 1.3, 5.8, -Math.PI / 2 + 0.6);
    b.cyl(0x8a5a32, 0.06, 0.06, 1.0, 31, 0, 5.8);
    b.cyl(0x8a5a32, 0.06, 0.06, 1.0, 31.8, 0, 7.0);

    // Flagpole
    b.cyl(0xc9c9d6, 0.08, 0.1, 9, 31, 0, -7);
    b.sph(0xffd23f, 0.2, 31, 9.1, -7);
    this.post(31, -7, 0.25, 9);
    this.flag = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1, 8, 1).translate(0.9, 0, 0), new THREE.MeshBasicMaterial({ color: 0x4aa3a0, side: THREE.DoubleSide }));
    this.flag.position.set(31, 8.3, -7);
    this.root.add(this.flag);
    this.flagBase = this.flag.geometry.attributes.position.array.slice();

    // Bike rack
    for (let i = 0; i < 4; i++) b.cyl(0x9aa0b8, 0.35, 0.35, 0.08, 31.5, 0.35, 9 + i * 0.6, { rx: Math.PI / 2, seg: 10 });
    this.solid(31.5, 9.9, 0.4, 2.6, 0.8);

    this.solid(fx + 6, 0, 12, 30, 8.5);   // main building
    this.solid(fx - 1, 0, 3, 8, 11);      // entrance block
    // The doors: step 3 adds the school interior; until then they're locked.
    this.door(fx - 3.1, 0, 1.4, 3, { to: 'school', spawn: 'entrance' });
  }

  buildEdges() {
    const b = this.b;
    // West: the road is closed. Forever.
    for (let i = 0; i < 4; i++) {
      b.box(i % 2 ? 0xfdf8ec : 0xff8a3a, 2, 0.4, 0.2, -40, 1.0, -3 + i * 2, { outline: 0.04 });
      b.box(0xfdf8ec, 0.12, 1.0, 0.12, -40, 0, -3.6 + i * 2);
    }
    this.solid(-40, 0, 0.6, 9, 1.4);
    const closed = signMesh(['ROAD CLOSED', '(forever)'], { w: 2.4, h: 1.1, px: 50, bg: '#ff8a3a', fg: '#2a1a2e' });
    place(this.root, closed, -40.2, 1.9, 0, Math.PI / 2);
    // Hedges close off the back of every yard and lot.
    b.box(C.hedge, 80, 2.4, 1.6, -4, 0, 19.6, { outline: 0.06 });
    b.box(C.hedge, 1.6, 2.4, 36, -42.6, 0, 2, { outline: 0.06 });
    b.box(C.hedge, 70, 2.4, 1.6, -7, 0, -15.8, { outline: 0.06 });
    // Beige EarthBound plateaus on the horizon.
    for (const [x, z, w, d, h] of [[-20, 38, 70, 14, 7], [30, 40, 50, 14, 9], [-10, -34, 90, 14, 8], [-62, 0, 14, 80, 6], [62, -10, 14, 70, 10]]) {
      b.box(PALETTE.cliff, w, h, d, x, 0, z, { outline: 0.1 });
      b.box(PALETTE.cliffShade, w + 0.05, 0.6, d + 0.05, x, h * 0.45, z);
      b.box(C.grass, w + 0.4, 0.6, d + 0.4, x, h, z);
    }
    for (const [x, z] of [[-30, 26], [-8, 27], [14, 25], [-36, -24], [-6, -25], [24, -24]]) this.tree(x, z, 1.3);
  }

  buildClouds() {
    this.clouds = [];
    const geo = new THREE.SphereGeometry(1, 10, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let i = 0; i < 5; i++) {
      const c = new THREE.Group();
      for (let k = 0; k < 4; k++) {
        const s = new THREE.Mesh(geo, mat);
        s.position.set(k * 1.6 - 2.4, Math.sin(k * 2) * 0.4, (k % 2) * 0.6);
        s.scale.setScalar(1.3 + (k % 3) * 0.4);
        c.add(s);
      }
      c.position.set(-80 + i * 38, 24 + (i % 3) * 3, -40 + (i % 2) * 70);
      this.root.add(c);
      this.clouds.push(c);
    }
  }

  update(dt) {
    super.update(dt);
    const t = this.t;
    for (const c of this.clouds) {
      c.position.x += dt * 1.2;
      if (c.position.x > 100) c.position.x = -100;
    }
    if (this.clockHand) this.clockHand.rotation.x = -t * 0.8; // school time moves weirdly fast
    if (this.flag) {
      const p = this.flag.geometry.attributes.position;
      const a = p.array, base = this.flagBase;
      for (let i = 0; i < a.length; i += 3) {
        const x = base[i];
        a[i + 2] = Math.sin(x * 2.6 - t * 6) * 0.18 * (x / 1.8);
      }
      p.needsUpdate = true;
    }
  }
}
