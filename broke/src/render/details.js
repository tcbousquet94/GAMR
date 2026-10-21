// Street-level density, all instanced: litter, leaves, weeds in the cracks, puddles that mirror the sky, posters,
// manholes, soft contact shadows under props, and cloth that moves in the wind (laundry lines across alleys,
// banners on streetlight poles, fringes under storefront awnings). Placement is seeded from the city.

import * as THREE from 'three';
import { Rng } from '../core/rng.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

export function buildDetails(city, scene) {
  const rng = new Rng(`details:${city.seed}`);
  const world = city.world;
  const kit = city.kit;
  const S = city.size;
  const out = { meshes: [], time: { value: 0 }, night: { value: 0 } };
  const add = (mesh) => { mesh.receiveShadow = true; scene.add(mesh); out.meshes.push(mesh); return mesh; };

  // ---- sample street-level ground points, tagged by whether they hug a wall ----------------------------------
  const pts = [];
  for (let i = 0; i < 40000; i++) {
    const x = rng.range(4, S - 4), z = rng.range(4, S - 4);
    const gy = world.groundBelow(x, 1.2, z, 0.05, 6);
    if (!Number.isFinite(gy) || gy > 0.5) continue;
    if (!world.fits(x, gy + 0.02, z, 0.08, 0.3)) continue;
    const wall = !!world.overlapsSolid(x - 1.1, gy + 0.3, z - 1.1, x + 1.1, gy + 1.5, z + 1.1);
    pts.push({ x, y: gy, z, wall, curb: Math.abs(gy - 0.15) < 0.01 });
  }
  // Each layer draws its own shuffled subset so litter, weeds and leaves never stack on the same spots.
  const pick = (pred, n) => { const r = []; for (const p of rng.shuffle(pts.slice())) { if (r.length >= n) break; if (pred(p)) r.push(p); } return r; };

  // ---- contact shadows: a soft dark blob under every prop and shop ------------------------------------------
  const blobTex = blob();
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  const blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const SIZE = { car: [2.6, 5.2], van: [2.8, 6], truck: [3.2, 7.8], dumpster: [2.6, 4.2], busshelter: [2.4, 5], bench: [1.2, 2.4], planter: [2.8, 2.8], tree: [3.4, 3.4], kiosk: [3.2, 3.2], picnic: [2.4, 2.6], crate: [1.8, 1.8], trashcan: [1.1, 1.1], hydrant: [0.9, 0.9], ibeams: [2.2, 6.6], barrier: [1, 2.4], streetlight: [0.8, 0.8], trafficlight: [0.8, 0.8], bikerack: [0.8, 3] };
  const shadowed = kit.props.filter((p) => SIZE[p.type]);
  const its = city.interactables;
  const blobs = new THREE.InstancedMesh(blobGeo, blobMat, shadowed.length + its.length);
  let n = 0;
  for (const p of shadowed) {
    const [w, l] = SIZE[p.type];
    _q.setFromAxisAngle(UP, p.yaw || 0);
    _m.compose(_v.set(p.x, p.y + 0.02, p.z), _q, _s.set(w, 1, l));
    blobs.setMatrixAt(n++, _m);
  }
  for (const it of its) {
    _q.setFromAxisAngle(UP, it.yaw);
    _m.compose(_v.set(it.x, it.y + 0.02, it.z), _q, _s.set(1.8, 1, 1.6));
    blobs.setMatrixAt(n++, _m);
  }
  blobs.count = n;
  blobs.renderOrder = 1;
  add(blobs).receiveShadow = false;

  // ---- litter: paper scraps, cups, cans, flyers -------------------------------------------------------------
  const litter = pick((p) => p.wall || p.curb || rng.chance(0.55), 7500);
  const paperGeo = new THREE.PlaneGeometry(0.22, 0.28).rotateX(-Math.PI / 2);
  const cupGeo = new THREE.CylinderGeometry(0.045, 0.035, 0.11, 8).rotateZ(Math.PI / 2).translate(0, 0.045, 0);
  const smooth = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 });
  const litterPaper = new THREE.InstancedMesh(paperGeo, smooth(0xffffff), litter.length);
  const litterCup = new THREE.InstancedMesh(cupGeo, smooth(0xffffff), Math.ceil(litter.length / 3));
  let np = 0, nc = 0;
  const paperCols = [0xe8e2d4, 0xd8cfb8, 0xc9c2b0, 0xb8b0a0, 0xe0d0b0, 0x9aa4b8];
  const cupCols = [0xf0ece4, 0xa04a3a, 0x8a8a90, 0xc8a060, 0x6a7a5a];
  for (const p of litter) {
    if (rng.chance(0.7)) {
      _e.set(rng.range(-0.08, 0.08), rng.range(0, 6.28), rng.range(-0.08, 0.08));
      _q.setFromEuler(_e);
      const k = rng.range(0.6, 1.6);
      _m.compose(_v.set(p.x, p.y + 0.012, p.z), _q, _s.set(k, 1, k));
      litterPaper.setMatrixAt(np, _m); litterPaper.setColorAt(np++, _c.set(rng.pick(paperCols)));
    } else if (nc < litterCup.count) {
      _q.setFromAxisAngle(UP, rng.range(0, 6.28));
      _m.compose(_v.set(p.x, p.y, p.z), _q, _s.set(1, 1, 1));
      litterCup.setMatrixAt(nc, _m); litterCup.setColorAt(nc++, _c.set(rng.pick(cupCols)));
    }
  }
  litterPaper.count = np; litterCup.count = nc;
  add(litterPaper); add(litterCup);

  // ---- leaves: drifts near trees, planters and walls --------------------------------------------------------
  const trees = kit.props.filter((p) => p.type === 'tree');
  const leafGeo = leafShape();
  const leafPts = [];
  for (const t of trees) for (let i = 0; i < 26; i++) { const a = rng.range(0, 6.28), r = Math.sqrt(rng.next()) * 4.5; leafPts.push({ x: t.x + Math.cos(a) * r, z: t.z + Math.sin(a) * r }); }
  for (const p of pick((q) => q.wall, 2500)) leafPts.push({ x: p.x, z: p.z });
  const leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide }), leafPts.length);
  const leafCols = [0xb8743a, 0xc8903c, 0x9a5a30, 0x8a7a3a, 0xd0a050, 0x7a6a34];
  let nl = 0;
  for (const p of leafPts) {
    const gy = world.groundBelow(p.x, 3, p.z, 0.02, 8);
    if (!Number.isFinite(gy)) continue;
    _e.set(rng.range(-0.3, 0.3), rng.range(0, 6.28), rng.range(-0.3, 0.3));
    _q.setFromEuler(_e);
    const k = rng.range(0.7, 1.3);
    _m.compose(_v.set(p.x, gy + 0.015, p.z), _q, _s.set(k, k, k));
    leaves.setMatrixAt(nl, _m); leaves.setColorAt(nl++, _c.set(rng.pick(leafCols)));
  }
  leaves.count = nl;
  add(leaves);

  // ---- weeds and grass tufts in the cracks along walls and curbs --------------------------------------------
  const tuftGeo = tuft();
  const weedPts = pick((p) => p.wall || (p.curb && rng.chance(0.3)), 3200);
  const weeds = new THREE.InstancedMesh(tuftGeo, windMaterial(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide }), out.time, 0.06, 3.0), weedPts.length);
  const weedCols = [0x5f8a3e, 0x6f9446, 0x4f7a36, 0x86924a, 0x6a8a3c];
  weedPts.forEach((p, i) => {
    _q.setFromAxisAngle(UP, rng.range(0, 6.28));
    const k = rng.range(0.5, 1.4);
    _m.compose(_v.set(p.x, p.y, p.z), _q, _s.set(k, k * rng.range(0.7, 1.3), k));
    weeds.setMatrixAt(i, _m); weeds.setColorAt(i, _c.set(rng.pick(weedCols)));
  });
  add(weeds).castShadow = false;

  // ---- puddles: glossy, they reflect the sky through the environment map --------------------------------------
  const puddlePts = pick((p) => !p.wall && rng.chance(0.1), 420);
  const puddleMat = new THREE.MeshStandardMaterial({ color: 0x1a1822, roughness: 0.06, metalness: 0.4, envMapIntensity: 1.1, transparent: true, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -2 });
  const puddles = new THREE.InstancedMesh(puddleShape(), puddleMat, puddlePts.length);
  puddlePts.forEach((p, i) => {
    _q.setFromAxisAngle(UP, rng.range(0, 6.28));
    const k = rng.range(1.4, 3.4);
    _m.compose(_v.set(p.x, p.y + 0.008, p.z), _q, _s.set(k, 1, k * rng.range(0.45, 0.9)));
    puddles.setMatrixAt(i, _m);
  });
  add(puddles);

  // ---- manholes on the road ----------------------------------------------------------------------------------
  const roadPts = pick((p) => p.y < 0.05 && !p.wall && rng.chance(0.03), 120);
  const manholes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.42, 0.42, 0.02, 20), new THREE.MeshStandardMaterial({ color: 0x2a2826, roughness: 0.5, metalness: 0.6 }), roadPts.length);
  roadPts.forEach((p, i) => { _m.compose(_v.set(p.x, p.y + 0.01, p.z), _q.identity(), _s.set(1, 1, 1)); manholes.setMatrixAt(i, _m); });
  add(manholes);

  // ---- posters pasted on walls near street level -----------------------------------------------------------
  const posterCols = [0xd8c8a0, 0xc06a5a, 0x5a7aa0, 0xe0d8c8, 0x8a6aa0, 0xc8a050, 0x6a9a8a];
  const posters = [];
  for (const q of kit.quads) {
    if (q.cy > 3.5 || q.w < 4 || !rng.chance(0.5)) continue;
    for (let k = 0; k < rng.int(1, 3); k++) {
      const off = rng.range(-q.w / 2 - 2.5, q.w / 2 + 2.5);
      if (Math.abs(off) < q.w / 2 + 0.3) continue;
      posters.push({ x: q.cx + -q.nz * off + q.nx * 0.05, y: rng.range(1.1, 2.0), z: q.cz + q.nx * off + q.nz * 0.05, nx: q.nx, nz: q.nz });
    }
  }
  const posterMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.7, 1.0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), posters.length);
  posters.forEach((p, i) => {
    _q.setFromAxisAngle(UP, Math.atan2(p.nx, p.nz));
    _q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), rng.range(-0.08, 0.08)));
    _m.compose(_v.set(p.x, p.y, p.z), _q, _s.set(1, 1, 1));
    posterMesh.setMatrixAt(i, _m); posterMesh.setColorAt(i, _c.set(rng.pick(posterCols)));
  });
  add(posterMesh);

  // ---- cloth in the wind ---------------------------------------------------------------------------------------
  // Laundry lines between facing fire escapes / walls across alleys.
  const clothMat = windMaterial(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, side: THREE.DoubleSide }), out.time, 0.18, 2.2, true);
  const laundry = [];
  const lines = [];
  for (const bl of city.blocks) {
    const ls = (city.B - city.A) / 2;
    for (const axis of ['x', 'z']) {
      for (let k = 0; k < 4; k++) {
        const y = rng.range(5.5, 9.5);
        const u = rng.range(8, city.B - 8);
        if (Math.abs(u - city.B / 2) < 6) continue;
        let a, b;
        if (axis === 'x') { const x0 = bl.x0 + ls; a = { x: x0 - 0.2, y, z: bl.z0 + u }; b = { x: x0 + city.A + 0.2, y, z: bl.z0 + u }; }
        else { const z0 = bl.z0 + ls; a = { x: bl.x0 + u, y, z: z0 - 0.2 }; b = { x: bl.x0 + u, y, z: z0 + city.A + 0.2 }; }
        if (!world.overlapsSolid(a.x - 0.5, y - 0.5, a.z - 0.5, a.x + 0.5, y + 0.5, a.z + 0.5) || !world.overlapsSolid(b.x - 0.5, y - 0.5, b.z - 0.5, b.x + 0.5, y + 0.5, b.z + 0.5)) continue;
        lines.push(a, b);
        const nItems = rng.int(3, 7);
        for (let i = 0; i < nItems; i++) {
          const t = (i + 0.5 + rng.range(-0.2, 0.2)) / nItems;
          const sag = Math.sin(t * Math.PI) * 0.5;
          laundry.push({ x: a.x + (b.x - a.x) * t, y: y - sag, z: a.z + (b.z - a.z) * t, yaw: axis === 'x' ? 0 : Math.PI / 2, w: rng.range(0.5, 1.0), h: rng.range(0.6, 1.1) });
        }
      }
    }
  }
  const clothGeo = new THREE.PlaneGeometry(1, 1, 4, 6).translate(0, -0.5, 0);
  const laundryMesh = new THREE.InstancedMesh(clothGeo, clothMat, laundry.length);
  const clothCols = [0xe8e0d0, 0xc06a6a, 0x6a8ab0, 0xd8b860, 0x8a6aa0, 0xf0ece4, 0x6a9a7a, 0xd88a5a];
  laundry.forEach((l, i) => {
    _q.setFromAxisAngle(UP, l.yaw);
    _m.compose(_v.set(l.x, l.y, l.z), _q, _s.set(l.w, l.h, 1));
    laundryMesh.setMatrixAt(i, _m); laundryMesh.setColorAt(i, _c.set(rng.pick(clothCols)));
  });
  add(laundryMesh).castShadow = true;
  if (lines.length) {
    const g = new THREE.BufferGeometry();
    const arr = [];
    for (let i = 0; i < lines.length; i += 2) {
      const a = lines[i], b = lines[i + 1];
      for (let k = 0; k < 8; k++) {
        const t0 = k / 8, t1 = (k + 1) / 8;
        arr.push(a.x + (b.x - a.x) * t0, a.y - Math.sin(t0 * Math.PI) * 0.5, a.z + (b.z - a.z) * t0, a.x + (b.x - a.x) * t1, a.y - Math.sin(t1 * Math.PI) * 0.5, a.z + (b.z - a.z) * t1);
      }
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x2a2830 })));
  }
  // Banners on streetlight poles (pairs, like a downtown business district).
  const poles = kit.props.filter((p) => p.type === 'streetlight' && rng.chance(0.55));
  const bannerMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1, 3, 8).translate(0.5, -0.5, 0), windMaterial(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, side: THREE.DoubleSide }), out.time, 0.12, 1.6, false, true), poles.length);
  const bannerCols = [0x6a4a8a, 0x3a6a8a, 0x8a4a6a, 0x5a5a8a, 0x8a6a3a];
  poles.forEach((p, i) => {
    _q.setFromAxisAngle(UP, (p.yaw || 0) + Math.PI / 2);
    _m.compose(_v.set(p.x, p.y + 5.2, p.z), _q, _s.set(0.8, 1.7, 1));
    bannerMesh.setMatrixAt(i, _m); bannerMesh.setColorAt(i, _c.set(rng.pick(bannerCols)));
  });
  add(bannerMesh).castShadow = true;
  // Scalloped fringe hanging under each storefront awning.
  const awnings = kit.boxes.filter((b) => (b.rx || b.rz) && Math.abs(b.cy - 3.7) < 0.2 && b.sy < 0.25);
  const fringe = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 0.35, 8, 2).translate(0, -0.17, 0), windMaterial(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, side: THREE.DoubleSide }), out.time, 0.05, 3.2), awnings.length);
  awnings.forEach((b, i) => {
    const alongX = b.sx > b.sz;
    const nx = alongX ? 0 : (b.rz < 0 ? 1 : -1), nz = alongX ? (b.rx > 0 ? 1 : -1) : 0;
    const w = alongX ? b.sx : b.sz;
    _q.setFromAxisAngle(UP, alongX ? 0 : Math.PI / 2);
    _m.compose(_v.set(b.cx + nx * 0.85, b.cy - 0.28, b.cz + nz * 0.85), _q, _s.set(w, 1, 1));
    fringe.setMatrixAt(i, _m); fringe.setColorAt(i, _c.set(b.color).multiplyScalar(0.85));
  });
  add(fringe);

  out.update = (t) => { out.time.value = t; };
  out.stats = () => ({ litter: np + nc, leaves: nl, weeds: weedPts.length, puddles: puddlePts.length, posters: posters.length, laundry: laundry.length, banners: poles.length, fringes: awnings.length });
  return out;
}

// Vertex wind: displaces along local z by a travelling wave, scaled by how far a vertex hangs from its anchor.
export function windMaterial(mat, time, amp, freq, hangDown = false, flag = false) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 ip = vec3(0.0);
        #ifdef USE_INSTANCING
          ip = instanceMatrix[3].xyz;
        #endif
        float hang = ${flag ? 'clamp(position.x, 0.0, 1.0)' : hangDown ? 'clamp(-position.y, 0.0, 1.0)' : 'clamp(position.y * 3.0 + 0.4, 0.0, 1.0)'};
        float ph = uTime * ${freq.toFixed(2)} + ip.x * 0.37 + ip.z * 0.21;
        float w = sin(ph + position.x * 3.0 + position.y * 2.0) * 0.7 + sin(ph * 1.7 + position.y * 5.0) * 0.3;
        transformed.z += w * ${amp.toFixed(3)} * hang * ${flag ? '4.0' : '1.0'};
        ${flag ? 'transformed.y += abs(w) * 0.03 * hang;' : ''}`);
  };
  mat.customProgramCacheKey = () => `wind-${amp}-${freq}-${hangDown}-${flag}`;
  return mat;
}

export function blob() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)'); grd.addColorStop(0.55, 'rgba(255,255,255,0.45)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  return alphaOnly(t);
}
function alphaOnly(t) { t.format = THREE.RGBAFormat; return t; }

function leafShape() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.06); s.quadraticCurveTo(0.05, 0, 0, 0.07); s.quadraticCurveTo(-0.05, 0, 0, -0.06);
  return new THREE.ShapeGeometry(s, 3).rotateX(-Math.PI / 2);
}

function tuft() {
  const geos = [];
  for (let i = 0; i < 9; i++) {
    const g = new THREE.PlaneGeometry(0.06, 0.3 + (i % 3) * 0.06, 1, 3).translate(0, 0.15, 0);
    const pos = g.attributes.position;
    for (let k = 0; k < pos.count; k++) { const y = pos.getY(k); pos.setX(k, pos.getX(k) * (1 - y * 3)); pos.setZ(k, y * y * 0.6); }
    g.rotateY((i / 9) * Math.PI * 2 + i);
    geos.push(g);
  }
  const merged = mergeSimple(geos);
  merged.computeVertexNormals();
  return merged;
}

function puddleShape() {
  const s = new THREE.Shape();
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2, r = 0.5 * (0.75 + 0.25 * Math.sin(a * 3 + 1.3) + 0.12 * Math.sin(a * 7));
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r); else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2);
}

function mergeSimple(geos) {
  const pos = [], idx = [];
  let base = 0;
  for (const g of geos) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) pos.push(p.getX(i), p.getY(i), p.getZ(i));
    const ix = g.index.array;
    for (let i = 0; i < ix.length; i++) idx.push(ix[i] + base);
    base += p.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}
