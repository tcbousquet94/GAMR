import * as THREE from 'three';
import { toon, basic, outline, blobShadow, geo } from '../core/materials.js';
import { damp } from '../core/math.js';

// Toy-like proportions: huge head, stubby body. Feet at y=0, facing +Z. ~1.65 units tall.
const G = {
  head: () => geo('kid.head', () => new THREE.SphereGeometry(0.46, 20, 16)),
  torso: () => geo('kid.torso', () => new THREE.CapsuleGeometry(0.3, 0.22, 4, 12)),
  stripe: () => geo('kid.stripe', () => new THREE.CylinderGeometry(0.315, 0.315, 0.09, 14, 1, true)),
  limb: () => geo('kid.limb', () => new THREE.CapsuleGeometry(0.09, 0.2, 3, 8).translate(0, -0.15, 0)),
  leg: () => geo('kid.leg', () => new THREE.CapsuleGeometry(0.11, 0.14, 3, 8).translate(0, -0.12, 0)),
  hand: () => geo('kid.hand', () => new THREE.SphereGeometry(0.1, 10, 8)),
  shoe: () => geo('kid.shoe', () => new THREE.SphereGeometry(0.14, 10, 8).scale(1, 0.6, 1.4)),
  eye: () => geo('kid.eye', () => new THREE.SphereGeometry(0.065, 8, 8).scale(0.8, 1.3, 0.5)),
  shine: () => geo('kid.shine', () => new THREE.SphereGeometry(0.022, 6, 6)),
  cheek: () => geo('kid.cheek', () => new THREE.CircleGeometry(0.085, 12)),
  hairCap: () => geo('kid.hairCap', () => new THREE.SphereGeometry(0.48, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55)),
  brim: () => geo('kid.brim', () => new THREE.CylinderGeometry(0.3, 0.3, 0.05, 14, 1, false, -Math.PI / 2, Math.PI).scale(1, 1, 1.3)),
  bun: () => geo('kid.bun', () => new THREE.SphereGeometry(0.17, 10, 8)),
  pack: () => geo('kid.pack', () => new THREE.BoxGeometry(0.42, 0.42, 0.22)),
  lens: () => geo('kid.lens', () => new THREE.TorusGeometry(0.1, 0.022, 6, 14)),
  band: () => geo('kid.band', () => new THREE.TorusGeometry(0.45, 0.05, 6, 20)),
  bat: () => geo('kid.bat', () => new THREE.CylinderGeometry(0.09, 0.04, 0.95, 8).translate(0, 0.42, 0)),
  book: () => geo('kid.book', () => new THREE.BoxGeometry(0.34, 0.44, 0.1)),
  mouth: () => geo('kid.mouth', () => new THREE.TorusGeometry(0.07, 0.018, 4, 10, Math.PI)),
};

export function buildKid(look) {
  const bulk = look.bulk || 1;
  const root = new THREE.Group();
  root.add(blobShadow(0.55 * bulk));

  // `rig` pivots around the body center so rolls / KO look right.
  const rig = new THREE.Group();
  rig.position.y = 0.62;
  root.add(rig);

  const body = new THREE.Group();
  body.position.y = -0.62;
  rig.add(body);

  // Torso
  const torso = new THREE.Mesh(G.torso(), toon(look.shirt));
  torso.position.y = 0.66;
  torso.scale.set(bulk, 1, bulk);
  outline(torso, 0.035);
  body.add(torso);
  if (look.stripe != null) {
    const stripe = new THREE.Mesh(G.stripe(), toon(look.stripe));
    stripe.position.y = 0.05;
    torso.add(stripe);
  }

  // Head
  const head = new THREE.Group();
  head.position.y = 1.14;
  body.add(head);
  const skinMat = toon(look.skin);
  const blushMat = toon(0xff8a8a);
  const face = new THREE.Mesh(G.head(), skinMat);
  outline(face, 0.04);
  head.add(face);

  const eyeMat = basic(0x1a1020);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(G.eye(), eyeMat);
    eye.position.set(0.15 * s, 0.02, 0.41);
    head.add(eye);
    const shine = new THREE.Mesh(G.shine(), basic(0xffffff));
    shine.position.set(0.15 * s + 0.02, 0.06, 0.445);
    head.add(shine);
  }
  const mouth = new THREE.Mesh(G.mouth(), eyeMat);
  mouth.position.set(0, -0.17, 0.42);
  mouth.rotation.z = Math.PI; // smile
  head.add(mouth);

  const cheeks = [];
  const cheekMat = basic(0xff6f8f, { transparent: true, opacity: 0.85 });
  for (const s of [-1, 1]) {
    const c = new THREE.Mesh(G.cheek(), cheekMat);
    c.position.set(0.27 * s, -0.08, 0.37);
    c.rotation.y = 0.55 * s;
    c.visible = false;
    head.add(c);
    cheeks.push(c);
  }

  buildHair(head, look);

  if (look.accessory === 'glasses') {
    const frameMat = basic(0x3a2a5a);
    for (const s of [-1, 1]) {
      const lens = new THREE.Mesh(G.lens(), frameMat);
      lens.position.set(0.15 * s, 0.03, 0.44);
      head.add(lens);
    }
  }
  if (look.accessory === 'headband') {
    const band = new THREE.Mesh(G.band(), toon(0xff4f6a));
    band.rotation.x = Math.PI / 2 - 0.25;
    band.position.y = 0.17;
    band.scale.setScalar(1.02);
    head.add(band);
  }
  if (look.accessory === 'backpack') {
    const pack = new THREE.Mesh(G.pack(), toon(0x3fbf9f));
    pack.position.set(0, 0.7, -0.33 * bulk);
    outline(pack, 0.03);
    body.add(pack);
  }

  // Arms: pivot at shoulder
  const mkArm = (s) => {
    const pivot = new THREE.Group();
    pivot.position.set(0.36 * s * bulk, 0.86, 0);
    const sleeve = new THREE.Mesh(G.limb(), toon(look.shirt));
    sleeve.scale.setScalar(bulk);
    pivot.add(sleeve);
    const hand = new THREE.Mesh(G.hand(), skinMat);
    hand.position.y = -0.36 * bulk;
    hand.scale.setScalar(look.weapon === 'fists' ? 1.6 : 1);
    pivot.add(hand);
    body.add(pivot);
    return { pivot, hand };
  };
  const armL = mkArm(-1);
  const armR = mkArm(1);

  // Weapon lives in the right hand
  const weaponPivot = new THREE.Group();
  armR.hand.add(weaponPivot);
  if (look.weapon === 'bat') {
    const bat = new THREE.Mesh(G.bat(), toon(0xd9a35a));
    bat.rotation.x = Math.PI / 2;
    outline(bat, 0.025);
    weaponPivot.add(bat);
  } else if (look.weapon === 'book') {
    const book = new THREE.Mesh(G.book(), toon(0x7b5fd1));
    book.position.set(0, -0.05, 0.12);
    outline(book, 0.025);
    weaponPivot.add(book);
  }

  // Legs: pivot at hip
  const mkLeg = (s) => {
    const pivot = new THREE.Group();
    pivot.position.set(0.14 * s * bulk, 0.4, 0);
    const leg = new THREE.Mesh(G.leg(), toon(look.pants));
    leg.scale.set(bulk, 1, bulk);
    pivot.add(leg);
    const shoe = new THREE.Mesh(G.shoe(), toon(look.shoes));
    shoe.position.set(0, -0.32, 0.05);
    outline(shoe, 0.02);
    pivot.add(shoe);
    body.add(pivot);
    return pivot;
  };
  const legL = mkLeg(-1);
  const legR = mkLeg(1);

  const parts = { rig, body, torso, head, face, armL: armL.pivot, armR: armR.pivot, legL, legR, weaponPivot };

  let cycle = 0;
  let blush = false;

  function setBlush(on) {
    if (on === blush) return;
    blush = on;
    face.material = on ? blushMat : skinMat;
    for (const c of cheeks) c.visible = on;
    mouth.rotation.z = on ? 0 : Math.PI; // frown when embarrassed
  }

  // Procedural animation. Cheap: a handful of rotations per frame.
  function update(dt, anim) {
    const speed = anim.speed01 || 0;
    cycle += dt * (6 + speed * 9);
    const sw = Math.sin(cycle) * speed;
    const k = 18; // damping rate

    let armLx = -sw * 1.0, armRx = sw * 1.0, armLz = 0.12, armRz = -0.12, armRy = 0;
    let legLx = sw * 1.1, legRx = -sw * 1.1;
    let rigX = 0, rigZ = 0, bodyY = Math.abs(Math.sin(cycle)) * 0.08 * speed, headX = 0;
    let rigRotOverride = null;

    if (!anim.grounded) {
      armLx = -2.4; armRx = -2.4; armLz = 0.5; armRz = -0.5;
      legLx = 0.5; legRx = -0.3;
    }

    const t = anim.actionT || 0;
    switch (anim.action) {
      case 'attack': {
        const c = anim.combo || 0;
        const e = t < 0.35 ? -Math.sin((t / 0.35) * Math.PI * 0.5) : Math.sin(((t - 0.35) / 0.65) * Math.PI * 0.5);
        if (c === 0) { armRx = -1.5; armRz = -0.4 - e * 1.6; armRy = e * 1.4; rigZ = 0; body.rotation.y = -e * 0.5; }
        else if (c === 1) { armRx = -1.5; armRz = 0.9 + e * 1.4; armRy = -e * 1.4; body.rotation.y = e * 0.6; }
        else { armRx = -3.0 + (e + 1) * 1.9; armRz = -0.1; armLx = armRx; rigX = Math.max(0, e) * 0.35; body.rotation.y = 0; }
        legLx = 0.4; legRx = -0.4;
        break;
      }
      case 'dodge':
        rigRotOverride = t * Math.PI * 2;
        armLx = armRx = -1.2; legLx = legRx = -1.2;
        break;
      case 'hurt':
        rigX = -0.35 * Math.sin(t * Math.PI); headX = -0.3;
        armLz = 0.9; armRz = -0.9;
        break;
      case 'ko':
        rigRotOverride = -Math.PI / 2 * Math.min(1, t * 3);
        armLz = 1.4; armRz = -1.4;
        break;
      case 'cast':
        armLx = armRx = -2.8; armLz = 0.3; armRz = -0.3; headX = -0.2;
        break;
      case 'cheer':
        armLx = armRx = -3; bodyY = Math.abs(Math.sin(t * Math.PI * 4)) * 0.25;
        break;
    }
    if (anim.action !== 'attack') body.rotation.y = damp(body.rotation.y, 0, k, dt);

    armL.pivot.rotation.x = damp(armL.pivot.rotation.x, armLx, k, dt);
    armR.pivot.rotation.x = anim.action === 'attack' ? armRx : damp(armR.pivot.rotation.x, armRx, k, dt);
    armL.pivot.rotation.z = damp(armL.pivot.rotation.z, armLz, k, dt);
    armR.pivot.rotation.z = anim.action === 'attack' ? armRz : damp(armR.pivot.rotation.z, armRz, k, dt);
    armR.pivot.rotation.y = damp(armR.pivot.rotation.y, armRy, 30, dt);
    legL.rotation.x = damp(legL.rotation.x, legLx, k, dt);
    legR.rotation.x = damp(legR.rotation.x, legRx, k, dt);
    head.rotation.x = damp(head.rotation.x, headX + (blush ? 0.25 : 0), 10, dt);
    body.position.y = -0.62 + bodyY;
    if (rigRotOverride !== null) rig.rotation.x = rigRotOverride;
    else rig.rotation.x = damp(rig.rotation.x, rigX, k, dt);
    rig.rotation.z = damp(rig.rotation.z, rigZ, k, dt);
  }

  return { root, parts, setBlush, update };
}

function buildHair(head, look) {
  const hairMat = toon(look.hair);
  switch (look.hairStyle) {
    case 'cap': {
      const cap = new THREE.Mesh(G.hairCap(), toon(look.capColor ?? 0xe8423c));
      cap.position.y = 0.04;
      cap.rotation.x = -0.15;
      outline(cap, 0.03);
      head.add(cap);
      const brim = new THREE.Mesh(G.brim(), toon(look.capColor ?? 0xe8423c));
      brim.position.set(0, 0.2, 0.32);
      brim.rotation.x = 0.12;
      head.add(brim);
      const tuft = new THREE.Mesh(G.bun(), hairMat);
      tuft.position.set(0, -0.05, -0.38);
      tuft.scale.set(1.6, 1, 0.8);
      head.add(tuft);
      break;
    }
    case 'pigtails': {
      const top = new THREE.Mesh(G.hairCap(), hairMat);
      top.position.y = 0.03;
      top.rotation.x = -0.3;
      outline(top, 0.03);
      head.add(top);
      for (const s of [-1, 1]) {
        const tail = new THREE.Mesh(G.bun(), hairMat);
        tail.position.set(0.48 * s, 0.05, -0.05);
        tail.scale.set(0.9, 1.5, 0.9);
        outline(tail, 0.03);
        head.add(tail);
        const bow = new THREE.Mesh(G.bun(), toon(look.bow ?? 0xff5f9e));
        bow.position.set(0.4 * s, 0.2, -0.05);
        bow.scale.set(0.5, 0.35, 0.35);
        head.add(bow);
      }
      break;
    }
    case 'buzz':
    default: {
      const top = new THREE.Mesh(G.hairCap(), hairMat);
      top.position.y = 0.02;
      top.rotation.x = -0.25;
      top.scale.setScalar(0.99);
      head.add(top);
    }
  }
}
