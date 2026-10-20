import * as THREE from 'three';

let gradientMap = null;
function getGradient() {
  if (gradientMap) return gradientMap;
  // 3 hard bands -> chunky, toy-like shading
  const data = new Uint8Array([90, 90, 90, 255, 180, 180, 180, 255, 255, 255, 255, 255]);
  gradientMap = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  gradientMap.minFilter = THREE.NearestFilter;
  gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.needsUpdate = true;
  return gradientMap;
}

const toonCache = new Map();
export function toon(color, { emissive = 0x000000 } = {}) {
  const key = `${color}|${emissive}`;
  if (!toonCache.has(key)) {
    toonCache.set(key, new THREE.MeshToonMaterial({ color, emissive, gradientMap: getGradient() }));
  }
  return toonCache.get(key);
}

const basicCache = new Map();
export function basic(color, { transparent = false, opacity = 1, side = THREE.FrontSide } = {}) {
  const key = `${color}|${transparent}|${opacity}|${side}`;
  if (!basicCache.has(key)) {
    basicCache.set(key, new THREE.MeshBasicMaterial({ color, transparent, opacity, side, depthWrite: !transparent }));
  }
  return basicCache.get(key);
}

const outlineMat = new THREE.MeshBasicMaterial({ color: 0x2a1a2e, side: THREE.BackSide });

// Inverted-hull outline. Works best on convex primitives (spheres, capsules, rounded boxes).
export function outline(mesh, thickness = 0.06) {
  const hull = new THREE.Mesh(mesh.geometry, outlineMat);
  const s = mesh.geometry.boundingSphere || (mesh.geometry.computeBoundingSphere(), mesh.geometry.boundingSphere);
  const r = Math.max(s.radius, 0.01);
  hull.scale.setScalar(1 + thickness / r);
  hull.raycast = () => {};
  mesh.add(hull);
  return hull;
}

const shadowGeo = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2);
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x3a3a10, transparent: true, opacity: 0.28, depthWrite: false });
export function blobShadow(radius = 0.5) {
  const m = new THREE.Mesh(shadowGeo, shadowMat);
  m.scale.setScalar(radius);
  m.position.y = 0.02;
  m.renderOrder = 1;
  return m;
}

// Shared geometry cache so lots of characters don't duplicate buffers.
const geoCache = new Map();
export function geo(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}
