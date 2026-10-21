// Life on the district edges: a commuter train crosses the east viaduct every so often and traffic streams both
// ways along the west overpass. Pure decoration (nothing collides), driven by game time so it pauses with the sim.

import * as THREE from 'three';
import { sbox, at, smoothMerge, facetMaterial } from './facet.js';

const CAR_LEN = 17, CARS = 5;
const TRAIN_EVERY = 38, TRAIN_SPEED = 26;
const LANES = [-3.4, -1.2, 1.2, 3.4];
const VEHICLE_COLORS = [0x7a8090, 0x9a9ea6, 0xb8b6ba, 0x5d6478, 0x8a7a70, 0xc8c4bc, 0xa04838, 0x384858];

function trainCar(lead) {
  const body = 0xc8c6c0, stripe = 0x3a6aa8, glass = 0x2a3440, glow = 0xffe4a8;
  const g = [
    sbox(3.0, 3.4, CAR_LEN - 0.6, body, at(0, 2.0, 0), 0.35),
    sbox(3.04, 0.35, CAR_LEN - 0.7, stripe, at(0, 1.2, 0), 0.05),
    sbox(3.06, 1.0, CAR_LEN - 2.4, glass, at(0, 2.5, 0), 0.1),
    sbox(2.4, 0.5, CAR_LEN - 2, 0x8a8880, at(0, 3.85, 0), 0.2),
    sbox(2.6, 0.6, 2.4, 0x3a3840, at(0, 0.35, -CAR_LEN / 2 + 3), 0.1),
    sbox(2.6, 0.6, 2.4, 0x3a3840, at(0, 0.35, CAR_LEN / 2 - 3), 0.1),
  ];
  if (lead) g.push(sbox(2.6, 1.2, 0.2, glass, at(0, 2.6, -CAR_LEN / 2 + 0.25), 0.1), sbox(0.5, 0.3, 0.1, glow, at(-0.9, 1.4, -CAR_LEN / 2 + 0.3)), sbox(0.5, 0.3, 0.1, glow, at(0.9, 1.4, -CAR_LEN / 2 + 0.3)));
  return smoothMerge(g);
}

function vehicle() {
  const g = [
    sbox(1.8, 0.8, 4.2, 0xffffff, at(0, 0.65, 0), 0.25),
    sbox(1.6, 0.6, 2.2, 0xffffff, at(0, 1.3, 0.2), 0.25),
    sbox(1.62, 0.42, 2.0, 0x283038, at(0, 1.32, 0.2), 0.15),
  ];
  return smoothMerge(g);
}

export function buildEdges(city, scene) {
  const e = city.edges;
  if (!e) return { update() {} };
  const mat = facetMaterial({ flat: false });
  const group = new THREE.Group();
  scene.add(group);

  // Train: a chain of meshes sharing two geometries, placed each frame along the viaduct.
  const train = [];
  const lead = trainCar(true), mid = trainCar(false);
  for (let i = 0; i < CARS; i++) {
    const m = new THREE.Mesh(i === 0 || i === CARS - 1 ? lead : mid, mat);
    if (i === CARS - 1) m.rotation.y = Math.PI;
    m.castShadow = true;
    m.visible = false;
    group.add(m);
    train.push(m);
  }

  // Overpass traffic: one instanced mesh, vehicles loop along their lane at their own speed.
  const N = 26;
  const cars = new THREE.InstancedMesh(vehicle(), mat, N);
  cars.castShadow = true;
  const traffic = [];
  const len = e.road.z1 - e.road.z0;
  const col = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const lane = i % LANES.length;
    traffic.push({ lane, dir: LANES[lane] < 0 ? 1 : -1, speed: 13 + ((i * 7919) % 9), s: ((i * 104729) % 1000) / 1000 * len });
    cars.setColorAt(i, col.setHex(VEHICLE_COLORS[i % VEHICLE_COLORS.length]));
  }
  group.add(cars);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);

  return {
    group,
    update(t) {
      // Train: southbound on even passes, northbound on odd, then the viaduct is quiet until the next one.
      const k = Math.floor(t / TRAIN_EVERY), u = t - k * TRAIN_EVERY;
      const span = e.rail.z1 - e.rail.z0 + CARS * CAR_LEN * 2;
      const head = u * TRAIN_SPEED;
      const on = head < span;
      const dir = k % 2 ? -1 : 1;
      for (let i = 0; i < CARS; i++) {
        const m = train[i];
        m.visible = on;
        if (!on) continue;
        const s = head - CARS * CAR_LEN - i * CAR_LEN;
        const z = dir > 0 ? e.rail.z0 + s : e.rail.z1 - s;
        m.position.set(e.rail.x + (dir > 0 ? -1.6 : 1.6), e.rail.y + 0.2, z);
        m.rotation.y = (dir > 0 ? Math.PI : 0) + (i === CARS - 1 ? Math.PI : 0);
      }
      for (let i = 0; i < N; i++) {
        const c = traffic[i];
        const s = ((c.s + t * c.speed) % len + len) % len;
        const z = c.dir > 0 ? e.road.z0 + s : e.road.z1 - s;
        q.setFromAxisAngle(up, c.dir > 0 ? Math.PI : 0);
        m4.compose(v.set(e.road.x + LANES[c.lane], e.road.y, z), q, one);
        cars.setMatrixAt(i, m4);
      }
      cars.instanceMatrix.needsUpdate = true;
    },
  };
}
