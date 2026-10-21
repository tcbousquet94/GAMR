// Title, pause, missed-train (death) and receipt (win) screens.

import { formatMoney, formatTime } from '../core/math.js';
import { ITEMS } from '../sim/items.js';
import { drawTownMap } from './townmap.js';

export class Screens {
  constructor(root, handlers) {
    this.root = root;
    this.h = handlers; // { start(seed), resume(), restart(sameSeed), quality(name), volume(v), sens(v) }
    this.current = null;
  }

  show(name, data = {}) {
    this.current = name;
    this.root.innerHTML = '';
    this.root.className = `screen ${name}`;
    this.root.style.display = name ? '' : 'none';
    if (!name) return;
    this[name](data);
  }

  title({ survivor, seed }) {
    const A = survivor.abilities;
    this.root.innerHTML = `
      <div class="title-wrap">
        <h1>BROKE</h1>
        <p class="tagline">Last train's in 10 minutes. You have $3.40.</p>
        <div class="lore">
          <div class="lore-head"><span class="swatch" style="background:#1fa89a"></span><div><b>${survivor.name}</b><span>${survivor.role}</span></div></div>
          <p>${survivor.lore}</p>
          <ul>
            <li><b>M1 · ${A.primary.name}</b> ${A.primary.desc}</li>
            <li><b>M2 · ${A.secondary.name}</b> ${A.secondary.desc}</li>
            <li><b>Q · ${A.utility.name}</b> ${A.utility.desc}</li>
            <li><b>R · ${A.special.name}</b> ${A.special.desc}</li>
            <li><b>Passive · ${A.passive.name}</b> ${A.passive.desc}</li>
          </ul>
        </div>
        <button class="primary-btn" id="s-start">Start the commute</button>
        <div class="seed-row"><label>Seed <input id="s-seed" value="${seed}" spellcheck="false"></label></div>
        <p class="controls">WASD move · Mouse aim · Shift sprint · Space jump (twice to double jump) · push into a fire escape to climb · E buy / use · F equipment · Esc pause</p>
      </div>`;
    this.root.querySelector('#s-start').onclick = () => this.h.start(this.root.querySelector('#s-seed').value.trim() || String(seed));
  }

  pause({ seed, quality, volume, sens }) {
    this.root.innerHTML = `
      <div class="panel">
        <h2>Paused</h2>
        <p class="seed">Seed <b>${seed}</b></p>
        <button class="primary-btn" id="p-resume">Resume</button>
        ${this.h.map ? '<button id="p-map">Town map</button>' : ''}
        <button id="p-replay">Replay this seed</button>
        <button id="p-new">New city</button>
        <div class="seed-row"><label>Play seed <input id="p-seed" value="${seed}" spellcheck="false"></label><button id="p-go">Go</button></div>
        <p class="controls">M town map · F1 free-fly camera · F2 debug overlay · F3 performance</p>
        <div class="opts">
          <label>Quality <select id="p-q">${['auto', 'high', 'medium', 'low'].map((q) => `<option ${q === quality ? 'selected' : ''}>${q}</option>`).join('')}</select></label>
          <label>Volume <input type="range" id="p-vol" min="0" max="1" step="0.05" value="${volume}"></label>
          <label>Mouse <input type="range" id="p-sens" min="0.0008" max="0.005" step="0.0002" value="${sens}"></label>
        </div>
      </div>`;
    const $ = (s) => this.root.querySelector(s);
    $('#p-resume').onclick = () => this.h.resume();
    $('#p-replay').onclick = () => this.h.restart(true);
    $('#p-new').onclick = () => this.h.restart(false);
    $('#p-go').onclick = () => this.h.start($('#p-seed').value.trim() || seed);
    if ($('#p-map')) $('#p-map').onclick = () => this.h.map();
    $('#p-q').onchange = (e) => this.h.quality(e.target.value);
    $('#p-vol').oninput = (e) => this.h.volume(+e.target.value);
    $('#p-sens').oninput = (e) => this.h.sens(+e.target.value);
  }

  // Town map (pause menu, M): drawn from the territory data, back returns to wherever you came from.
  map({ turf, player, buildings, seed }) {
    this.root.innerHTML = `
      <div class="map-wrap">
        <canvas class="townmap"></canvas>
        <div class="map-bar"><span>Seed ${seed}</span><button class="primary-btn" id="m-back">Back</button></div>
      </div>`;
    const cv = this.root.querySelector('canvas');
    const draw = () => drawTownMap(cv, turf, { player, buildings, subtitle: turf.district.personality });
    requestAnimationFrame(draw);
    this.root.querySelector('#m-back').onclick = () => this.h.mapBack();
  }

  dead({ cents }) {
    this.root.innerHTML = `
      <div class="panel dead">
        <h2>YOU MISSED THE TRAIN.</h2>
        <p class="big">A rideshare home costs $87. You have ${formatMoney(cents)}.</p>
        <button class="primary-btn" id="d-again">Try again</button>
        <button id="d-same">Same city</button>
      </div>`;
    this.root.querySelector('#d-again').onclick = () => this.h.restart(false);
    this.root.querySelector('#d-same').onclick = () => this.h.restart(true);
  }

  won(r) {
    const items = Object.entries(r.items).filter(([id]) => ITEMS[id]);
    const lines = items.map(([id, n]) => `<div class="r-line"><span>${ITEMS[id].name}${n > 1 ? ` x${n}` : ''}</span><span></span></div>`).join('');
    this.root.innerHTML = `
      <div class="receipt">
        <div class="r-head">YOU MADE THE TRAIN.</div>
        <div class="r-sub">METRO TRANSIT · DOWNTOWN<br>SEED ${r.seed} · ${r.tier.toUpperCase()}</div>
        <div class="r-rule"></div>
        <div class="r-line"><span>CHANGE EARNED</span><span>${formatMoney(r.earned)}</span></div>
        <div class="r-line"><span>CHANGE SPENT</span><span>-${formatMoney(r.spent)}</span></div>
        <div class="r-line"><span>ITEMS BOUGHT</span><span>${r.bought}</span></div>
        <div class="r-line"><span>ENEMIES DEFEATED</span><span>${r.kills}</span></div>
        <div class="r-line"><span>HOA PRESIDENT</span><span>${r.bossDefeated ? 'OVERRULED' : 'STILL MAD'}</span></div>
        <div class="r-line"><span>TIME</span><span>${formatTime(r.time)}</span></div>
        <div class="r-rule"></div>
        ${lines || '<div class="r-line"><span>NO ITEMS. RESPECT.</span><span></span></div>'}
        <div class="r-rule"></div>
        <div class="r-line total"><span>BALANCE</span><span>${formatMoney(r.cents)}</span></div>
        <div class="r-foot">FARE PAID · THANK YOU FOR RIDING<br>* NO REFUNDS *</div>
        <button class="primary-btn" id="w-again">Next commute</button>
      </div>`;
    this.root.querySelector('#w-again').onclick = () => this.h.restart(false);
  }
}
