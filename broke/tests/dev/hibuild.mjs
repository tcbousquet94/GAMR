// Dev check: build close-up humans in Node, report build time, vertex counts and normal orientation.
import * as THREE from 'three';
const { HiHuman } = await import('../../src/render/people/hi.js');
const { LOU_LOOK, makePerson } = await import('../../src/render/people/person.js');
const { loModel } = await import('../../src/render/people/lo.js');
for (const spec of [LOU_LOOK, makePerson(3), makePerson(8, 'crew', 1)]) {
  const h = new HiHuman(spec, loModel(spec));
  const rep = h.group.children.map((m) => {
    const g = m.geometry, p = g.attributes.position, n = g.attributes.normal;
    g.computeBoundingBox(); const c = g.boundingBox.getCenter(new THREE.Vector3());
    let out = 0; for (let i = 0; i < p.count; i++) { const d = new THREE.Vector3(p.getX(i) - c.x, p.getY(i) - c.y, p.getZ(i) - c.z); if (d.dot(new THREE.Vector3(n.getX(i), n.getY(i), n.getZ(i))) > 0) out++; }
    return `${m.name}:${p.count}v/${(out / p.count * 100).toFixed(0)}%out`;
  });
  console.log(spec.id, spec.outfit.top.type, Math.round(h.buildMs) + 'ms', rep.join(' '));
}
