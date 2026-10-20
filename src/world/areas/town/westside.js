import { groundRect } from '../../build.js';
import { C, frame, building, tree, car, palm, bush } from './props.js';

// 5. Arcade & Mall: west of the river, reached over the Main St bridge. West Ave runs north-south.
export function buildWestside(t) {
  // Maple Mall (north of Main, west of West Ave), front faces east onto its parking lot.
  const m = frame(t, -63.5, -33, Math.PI / 2);
  m.box(0xf2c1d1, 22, 6, 8, 0, 0, 0, { outline: 0.08 });
  m.box(C.white, 22.6, 0.6, 8.6, 0, 6, 0, { outline: 0.05 });
  m.box(C.window, 14, 3.2, 0.14, 0, 0.5, 4.04, { outline: 0.05 });
  for (let i = -3; i <= 3; i++) m.box(C.white, 0.18, 3.2, 0.2, i * 2.2, 0.5, 4.1);
  m.sph(C.window, 2.2, 0, 6.3, 0, { scale: [1.6, 0.8, 1.2], outline: 0.05 });
  m.sign(['MAPLE MALL', 'now with 40% fewer escalators'], { w: 8, h: 1.25, px: 60, bg: '#ffffff', fg: '#d1407a' }, 0, 4.6, 4.1);
  m.solid(22, 8, 0, 0, 7);
  m.door(3, 1.2, 0, 4.6, { message: { speaker: '', text: 'The mall is closed. Through the glass, a mannequin waves at you. You did not see it move. It definitely moved.' } });
  groundRect(t.root, C.asphalt, 7, 24, -56, -33, 0.02);
  for (let i = 0; i < 6; i++) groundRect(t.root, C.lane, 3, 0.15, -56, -43 + i * 4, 0.03);
  car(t, -56.3, -41, 0x4f8fe0, Math.PI / 2);
  car(t, -56.3, -29, 0xffd23f, -Math.PI / 2);
  car(t, -56.3, -25, 0x5fd18a, Math.PI / 2);

  // Skate park (north of Main, east of West Ave)
  groundRect(t.root, 0xc9c3b4, 9, 20, -40.5, -33, 0.02);
  const sk = frame(t, -40.5, -33, 0);
  sk.gable(0xb0aa9a, 4, 1.6, 3, 0, 0, -6, { outline: 0.05 });
  sk.gable(0xb0aa9a, 4, 2.2, 3.4, 0, 0, 1, { outline: 0.05 });
  sk.box(0xb0aa9a, 5, 0.6, 2, 0, 0, 7, { outline: 0.04 });
  sk.solid(4, 3, 0, -6, 1.6).solid(4, 3.4, 0, 1, 2.2).solid(5, 2, 0, 7, 0.6);
  sk.sign(['SKATE AT OWN RISK', "(and everyone else's)"], { w: 3, h: 0.9, px: 40, bg: '#ffe680' }, 0, 1.6, 9.9);
  sk.cyl(0x8a5a32, 0.06, 0.06, 1.2, 0, 0, 9.85);

  // Pixel Palace arcade (south of Main, east of West Ave), front faces west. Loud. Very loud.
  const a = frame(t, -40.5, -0.5, -Math.PI / 2);
  a.box(0x5a3fd1, 14, 5.5, 8, 0, 0, 0, { outline: 0.08 });
  a.box(0xff4fbf, 14.4, 0.5, 8.4, 0, 5.5, 0, { outline: 0.05 });
  a.box(0x3fe0ff, 14.1, 0.3, 8.1, 0, 2.8, 0);
  a.box(0x1a1030, 2.4, 3, 0.2, 0, 0, 4.03, { outline: 0.04 });
  a.box(0xffe14f, 3, 0.25, 0.25, 0, 3.1, 4.1);
  a.sign(['PIXEL PALACE', 'ARCADE · 2 TOKENS = 1 FEELING'], { w: 9, h: 1.4, px: 66, bg: '#1a1030', fg: '#ffe14f', border: '#ff4fbf' }, 0, 4.4, 4.06);
  // Giant joystick on the roof
  a.box(0x2a2a33, 3, 0.6, 3, 3.5, 6, 0, { outline: 0.04 });
  a.cyl(C.metal, 0.18, 0.18, 2.6, 3.5, 6.6, 0);
  a.sph(0xff3c5a, 0.7, 3.5, 9.4, 0, { outline: 0.05 });
  // Speaker stacks
  for (const sx of [-8.0, 8.0]) {
    for (let i = 0; i < 3; i++) {
      a.box(0x1a1a22, 2.2, 1.6, 1.8, sx, i * 1.6, 1.5, { outline: 0.04 });
      a.cyl(0x6a6a7a, 0.55, 0.55, 0.1, sx, i * 1.6 + 0.8, 2.42, { rx: Math.PI / 2 });
    }
    a.solid(2.2, 1.8, sx, 1.5, 4.8);
  }
  a.solid(14, 8, 0, 0, 7);
  a.door(2.6, 1.2, 0, 4.6, { message: { speaker: '', text: 'The arcade is closed until 3pm. Inside, a cabinet plays its attract music to nobody. It sounds lonely.' } });

  // Pizza Pagoda (south of Main, west of West Ave)
  building(t, -61.5, -1, Math.PI / 2, {
    w: 10, d: 8, h: 4.5, wall: 0xffd86a, roof: C.roofRed, roofType: 'hip', roofH: 2.6, sign: ['PIZZA PAGODA', 'pizza, but taller'],
    awning: [C.roofRed, C.white],
    doorTarget: { message: { speaker: '', text: 'A sign says "BACK AFTER LUNCH RUSH." It is 7:52am.' } },
  });

  for (const [x, z] of [[-46, -46.5], [-37, -46.5], [-66, -46.5], [-66, -19.5], [-46, 6.5], [-56, 7], [-66, 7.5]]) tree(t, x, z, 1.1);
  for (const [x, z] of [[-36.5, 7.8], [-44, 8.2]]) palm(t, x, z, 0.9);
  for (const [x, z] of [[-36.5, -21.5], [-44.5, -21.5]]) bush(t, x, z);
}
