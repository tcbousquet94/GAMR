// Title, pause, missed-train (death) and receipt (win) screens.

import { formatMoney, formatTime } from '../core/math.js';
import { ITEMS } from '../sim/items.js';
import { drawTownMap, statColor } from './townmap.js';
import { MAYOR, STATS } from '../sim/mayor/mayor.js';
import { CHOICES, setChoice, getChoice, randomLook } from './look.js';
import { CreatorPreview } from './creatorPreview.js';
import { topScores, submitScore, localBest, lastTag } from '../net/leaderboard.js';

const hex = (c) => '#' + (c >>> 0).toString(16).padStart(6, '0');
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export class Screens {
  constructor(root, handlers) {
    this.root = root;
    this.h = handlers; // { start(seed), resume(), restart(sameSeed), quality(name), volume(v), sens(v) }
    this.current = null;
  }

  show(name, data = {}) {
    this.preview?.dispose(); this.preview = null;
    this.current = name;
    this.root.innerHTML = '';
    this.root.className = `screen ${name}`;
    this.root.style.display = name ? '' : 'none';
    if (!name) return;
    this[name](data);
  }

  title(data) {
    const { survivor, seed } = data;
    if (survivor.aims) return this.gunTitle(data);
    const A = survivor.abilities, T = survivor.title || {};
    const sw = '#' + (survivor.accent ?? 0x1fa89a).toString(16).padStart(6, '0');
    this.root.innerHTML = `
      <div class="title-wrap">
        <h1${(T.game || '').length > 6 ? ' style="font-size:min(15vw, 104px);letter-spacing:0.06em;white-space:nowrap"' : ''}>${T.game || 'BROKE'}</h1>
        <p class="tagline">${T.tagline || "Last train's in 10 minutes. You have $3.40."}</p>
        <div class="lore">
          <div class="lore-head"><span class="swatch" style="background:${sw}"></span><div><b>${survivor.name}</b><span>${survivor.role}</span></div></div>
          <p>${survivor.lore}</p>
          <ul>
            <li><b>M1 · ${A.primary.name}</b> ${A.primary.desc}</li>
            <li><b>M2 · ${A.secondary.name}</b> ${A.secondary.desc}</li>
            <li><b>Q · ${A.utility.name}</b> ${A.utility.desc}</li>
            <li><b>R · ${A.special.name}</b> ${A.special.desc}</li>
            <li><b>Passive · ${A.passive.name}</b> ${A.passive.desc}</li>
          </ul>
        </div>
        <button class="primary-btn" id="s-start">${T.start || 'Start the commute'}</button>
        <div class="seed-row"><label>Seed <input id="s-seed" value="${seed}" spellcheck="false"></label></div>
        <p class="controls"><b>H</b> · switch between the city and the new-look test street (Palmetto Ave)</p>
        <p class="controls">WASD move · Mouse aim · Shift sprint · Space jump (twice to double jump) · push into a fire escape to climb · E buy / use · F equipment · Esc pause</p>
      </div>`;
    this.root.querySelector('#s-start').onclick = () => this.h.start(this.root.querySelector('#s-seed').value.trim() || String(seed));
  }

  // Title for the turf war played as your own character: who you are, how the gun works, and the creator.
  gunTitle({ survivor, seed, creator, town, modes }) {
    const sw = hex(survivor.accent ?? 0x8a6a44);
    if (town) return this.mayorTitle({ survivor, creator, modes });
    this.root.innerHTML = `
      <div class="title-wrap">
        <h1>BROKE</h1>
        <p class="tagline">Two crews. One city. Every block counts.</p>
        <div class="lore">
          <div class="lore-head"><span class="swatch" style="background:${sw}"></span><div><b>${esc(survivor.name)}</b><span>${esc(survivor.role)}</span></div></div>
          <p>${esc(survivor.lore)}</p>
          <ul>
            <li><b>The Vipers want your streets</b> They come in waves: gunmen, bruisers, then heavies. Last as long as you can.</li>
            <li><b>Right mouse · Aim</b> Hold to raise the revolver. Left click fires: one click, one shot.</li>
            <li><b>High score</b> How many you drop before you go down. Clearing a wave heals you a little.</li>
            <li><b>Power-ups</b> The fallen drop them: medkit, armor, double damage, rapid fire, adrenaline.</li>
          </ul>
        </div>
        <div class="board-mini" id="s-board">${localBest() ? `<p>Your best: <b>${localBest().score}</b> kills · wave ${localBest().wave}</p>` : ''}</div>
        <button class="primary-btn" id="s-start">Start</button>
        ${creator ? '<button id="s-create">Edit character</button>' : ''}
        ${modes ? '<button id="s-mayor">Be the President</button>' : ''}
        <div class="seed-row"><label>Seed <input id="s-seed" value="${seed}" spellcheck="false"></label></div>
        <p class="controls">WASD move · Mouse look · Shift sprint · Space jump · M town map · Esc pause</p>
      </div>`;
    if (this.root.querySelector('#s-mayor')) this.root.querySelector('#s-mayor').onclick = () => this.h.mode('town');
    // The online top five, when this page has a board.
    const board = this.root.querySelector('#s-board'), shown = this.current;
    topScores(5).then((rows) => { if (rows?.length && this.current === shown && board.isConnected) board.insertAdjacentHTML('beforeend', `<ol>${rows.map((r) => `<li${r.me ? ' class="me"' : ''}><span>${esc(r.tag)}</span><b>${r.score} kills</b></li>`).join('')}</ol>`); });
    this.root.querySelector('#s-start').onclick = () => this.h.start(this.root.querySelector('#s-seed').value.trim() || String(seed));
    const c = this.root.querySelector('#s-create');
    if (c) c.onclick = () => this.h.creator();
  }

  // Title for the mayor game: Palmetto Bay, City Hall, what you manage.
  mayorTitle({ survivor, creator, modes }) {
    this.root.innerHTML = `
      <div class="title-wrap">
        <h1>BROKE</h1>
        <p class="tagline">The country needs a president. It got you.</p>
        <div class="lore">
          <div class="lore-head"><span class="swatch" style="background:#d8b030"></span><div><b>President ${esc(survivor.name)}</b><span>The White House, Palmetto Bay</span></div></div>
          <p>Five neighbourhoods, a few hundred shops and two gangs who were here first. Set the taxes, fund the police, the street sweepers, the parks and the small shops. Every week the books settle and the city answers: safer streets and open shops, or boarded windows and angry residents.</p>
          <ul>
            <li><b>C · Oval Office</b> The budget, every neighbourhood's scores, and last week's report.</li>
            <li><b>Walk the streets</b> See what your choices did: closed shops are boarded up.</li>
            <li><b>Right mouse / click / R</b> The revolver still works. Some problems need a personal touch.</li>
          </ul>
        </div>
        <button class="primary-btn" id="s-start">Take office</button>
        ${creator ? '<button id="s-create">Edit character</button>' : ''}
        ${modes ? '<button id="s-turf">Play the turf war instead</button>' : ''}
        <p class="controls">WASD move · Mouse look · Shift sprint · Space jump · C Oval Office · M map · Esc pause</p>
      </div>`;
    this.root.querySelector('#s-start').onclick = () => this.h.start('palmetto');
    const c = this.root.querySelector('#s-create');
    if (c) c.onclick = () => this.h.creator();
    const t = this.root.querySelector('#s-turf');
    if (t) t.onclick = () => this.h.mode('turf');
  }

  // Character creator: a live preview on the left, the choices on the right. Done saves; Cancel keeps the old look.
  creator({ look }) {
    let cur = structuredClone(look);
    const rows = [
      ['Body', [['sex', 'Body type'], ['build', 'Build'], ['height', 'Height'], ['age', 'Age']]],
      ['Face', [['skin', 'Skin', 'swatches'], ['hairStyle', 'Hair'], ['hairColor', 'Hair colour', 'swatches'], ['facial', 'Facial hair']]],
      ['Clothes', [['top', 'Top'], ['topColor', 'Top colour', 'swatches'], ['bottom', 'Bottoms'], ['bottomColor', 'Bottoms colour', 'swatches'], ['shoes', 'Shoes'], ['shoeColor', 'Shoe colour', 'swatches']]],
    ];
    this.root.innerHTML = `
      <div class="creator">
        <div class="cr-preview"><canvas></canvas><span class="cr-hint">Drag to turn</span></div>
        <div class="cr-panel">
          <h2>Your character</h2>
          <label class="cr-name">Name <input id="c-name" maxlength="24" spellcheck="false" placeholder="Your name"></label>
          ${rows.map(([title, keys]) => `<h3>${title}</h3>${keys.map(([k, label, kind]) => `
            <div class="cr-row"><span>${label}</span><div class="cr-opts ${kind || ''}" data-k="${k}">${CHOICES[k].map(([v, l], i) => kind === 'swatches'
              ? `<button data-i="${i}" title="${esc(l)}" style="background:${hex(v)}"></button>`
              : `<button data-i="${i}">${esc(l)}</button>`).join('')}</div></div>`).join('')}`).join('')}
          <div class="cr-actions"><button id="c-rand">Randomise</button><button id="c-cancel">Cancel</button><button class="primary-btn" id="c-done">Done</button></div>
        </div>
      </div>`;
    const $ = (q) => this.root.querySelector(q);
    this.preview = new CreatorPreview($('.cr-preview canvas'));
    const name = $('#c-name');
    const sync = () => {
      this.preview.setLook(cur);
      name.value = cur.name || '';
      for (const box of this.root.querySelectorAll('.cr-opts')) {
        const k = box.dataset.k, v = getChoice(cur, k);
        // Highlight the option nearest the current value (numbers like height and age are snapped to the choices).
        let best = -1, bd = Infinity;
        CHOICES[k].forEach(([cv], i) => { const d = typeof cv === 'number' && typeof v === 'number' && k !== 'skin' && !/Color$/.test(k) ? Math.abs(cv - v) : cv === v ? 0 : Infinity; if (d < bd) { bd = d; best = i; } });
        box.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i === best));
      }
    };
    this.root.querySelectorAll('.cr-opts').forEach((box) => box.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      cur = setChoice(cur, box.dataset.k, CHOICES[box.dataset.k][+b.dataset.i][0]);
      sync();
    }));
    name.oninput = () => { cur = setChoice(cur, 'name', name.value); };
    $('#c-rand').onclick = () => { cur = { ...randomLook(), name: cur.name }; sync(); };
    $('#c-cancel').onclick = () => this.h.creatorDone(null);
    $('#c-done').onclick = () => this.h.creatorDone(cur);
    sync();
  }

  pause({ seed, quality, volume, sens, aimAssist }) {
    this.root.innerHTML = `
      <div class="panel">
        <h2>Paused</h2>
        <p class="seed">Seed <b>${seed}</b> · press <b>H</b> to switch city / new-look street</p>
        <button class="primary-btn" id="p-resume">Resume</button>
        ${this.h.map ? '<button id="p-map">Town map</button>' : ''}
        ${this.cityhallOn ? '<button id="p-hall">Oval Office</button>' : ''}
        <button id="p-replay">Replay this seed</button>
        <button id="p-new">New city</button>
        <div class="seed-row"><label>Play seed <input id="p-seed" value="${seed}" spellcheck="false"></label><button id="p-go">Go</button></div>
        <p class="controls">M town map · F1 free-fly camera · F2 debug overlay · F3 performance</p>
        <div class="opts">
          <label>Quality <select id="p-q">${['auto', 'high', 'medium', 'low'].map((q) => `<option ${q === quality ? 'selected' : ''}>${q}</option>`).join('')}</select></label>
          <label>Volume <input type="range" id="p-vol" min="0" max="1" step="0.05" value="${volume}"></label>
          <label>Mouse <input type="range" id="p-sens" min="0.0008" max="0.005" step="0.0002" value="${sens}"></label>
          ${aimAssist != null ? `<label>Aim assist <input type="checkbox" id="p-aa" ${aimAssist ? 'checked' : ''}></label>` : ''}
        </div>
      </div>`;
    const $ = (s) => this.root.querySelector(s);
    $('#p-resume').onclick = () => this.h.resume();
    $('#p-replay').onclick = () => this.h.restart(true);
    $('#p-new').onclick = () => this.h.restart(false);
    $('#p-go').onclick = () => this.h.start($('#p-seed').value.trim() || seed);
    if ($('#p-map')) $('#p-map').onclick = () => this.h.map();
    if ($('#p-hall')) $('#p-hall').onclick = () => this.h.cityhall();
    $('#p-q').onchange = (e) => this.h.quality(e.target.value);
    $('#p-vol').oninput = (e) => this.h.volume(+e.target.value);
    $('#p-sens').oninput = (e) => this.h.sens(+e.target.value);
    if ($('#p-aa')) $('#p-aa').onchange = (e) => this.h.aimAssist(e.target.checked);
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

  // City Hall (the mayor game): the map tinted by a neighbourhood score, the treasury and approval, the weekly
  // budget with a live projection, every neighbourhood's scores and shops, and last week's report. Changes apply at
  // once (the books settle at the end of the week).
  cityhall({ mayor, turf, player, seed }) {
    const M = mayor, money = (v) => `${v < 0 ? '-' : ''}$${Math.abs(Math.round(v)).toLocaleString('en-US')}`;
    const LABEL = { safety: 'Safety', cleanliness: 'Cleanliness', happiness: 'Happiness', wealth: 'Wealth' };
    const DEPTS = [['police', 'Police', 'Safer streets; pushes back on the gangs.'], ['services', 'City services', 'Trash, repairs and street cleaning.'], ['parks', 'Parks', 'Happier residents.'], ['grants', 'Small-business grants', 'Keeps struggling shops open.']];
    let stat = this.chStat || 'safety';
    const hoodCentre = (name) => { const bs = turf.blocks.filter((b) => (b.hood ?? 'Downtown') === name); return bs.length ? { x: bs.reduce((a, b) => a + b.center.x, 0) / bs.length, z: bs.reduce((a, b) => a + b.center.z, 0) / bs.length } : null; };
    this.root.innerHTML = `
      <div class="cityhall">
        <div class="ch-map">
          <canvas class="townmap"></canvas>
          <div class="ch-tabs">${STATS.map((k) => `<button data-stat="${k}" class="${k === stat ? 'on' : ''}">${LABEL[k]}</button>`).join('')}</div>
        </div>
        <div class="ch-side">
          <h2>Oval Office <span>Week ${M.week}</span></h2>
          <div class="ch-kpis">
            <div><em>Treasury</em><b id="ch-cash"></b></div>
            <div><em>Approval</em><b id="ch-appr"></b></div>
            <div><em>Shops open</em><b id="ch-open"></b></div>
          </div>
          <h3>This week's budget</h3>
          <label class="ch-row"><span>Tax rate <i>Higher taxes fund more, but hurt shops and moods.</i></span><input type="range" id="ch-tax" min="${MAYOR.tax.min}" max="${MAYOR.tax.max}" step="0.01" value="${M.budget.tax}"><b id="ch-tax-v"></b></label>
          ${DEPTS.map(([k, n, d]) => `<label class="ch-row"><span>${n} <i>${d}</i></span><input type="range" data-dept="${k}" min="0" max="${MAYOR.maxSpend}" step="500" value="${M.budget[k]}"><b data-v="${k}"></b></label>`).join('')}
          <label class="ch-row"><span>Focus <i>Twice the share of every department.</i></span><select id="ch-focus"><option value="">Whole city</option>${M.hoods.map((h) => `<option ${M.budget.focus === h.name ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}</select></label>
          <div class="ch-proj" id="ch-proj"></div>
          <h3>Neighbourhoods</h3>
          <div class="ch-hoods" id="ch-hoods"></div>
          <h3>Last week</h3>
          <div class="ch-report" id="ch-report"></div>
          <button class="primary-btn" id="ch-back">Back to the street</button>
        </div>
      </div>`;
    const $ = (q) => this.root.querySelector(q);
    const cv = $('canvas');
    const drawMap = () => drawTownMap(cv, turf, {
      player, subtitle: `${LABEL[stat]} by neighbourhood`,
      stat: { label: LABEL[stat], value: (b) => M.hood(b.hood ?? 'Downtown')?.[stat] },
      hoods: M.hoods.map((h) => ({ name: h.name, value: h[stat], ...hoodCentre(h.name) })).filter((h) => h.x != null),
      closed: M.businesses.filter((b) => !b.open),
    });
    const bar = (v) => `<span class="ch-bar"><i style="width:${Math.round(v)}%;background:${statColor(v, 1)}"></i></span>`;
    const refresh = () => {
      const p = M.projection();
      $('#ch-cash').textContent = money(M.cash); $('#ch-cash').className = M.cash < 0 ? 'neg' : '';
      $('#ch-appr').textContent = `${Math.round(M.approval)}%`; $('#ch-appr').style.color = statColor(M.approval, 1);
      $('#ch-open').textContent = `${M.openCount()} / ${M.businesses.length}`;
      $('#ch-tax-v').textContent = `${Math.round(M.budget.tax * 100)}%`;
      for (const [k] of DEPTS) this.root.querySelector(`[data-v="${k}"]`).textContent = money(M.budget[k]);
      $('#ch-proj').innerHTML = `<span>Income <b>${money(p.income)}</b> <i>(shops ${money(p.business)}, homes ${money(p.property)})</i></span><span>Spending <b>${money(p.spend)}</b></span><span>This week <b class="${p.net < 0 ? 'neg' : 'pos'}">${p.net >= 0 ? '+' : ''}${money(p.net)}</b></span>`;
      $('#ch-hoods').innerHTML = `<div class="ch-h head"><span></span>${STATS.map((k) => `<em>${LABEL[k]}</em>`).join('')}<em>Shops</em></div>` + M.hoods.map((h) => `<div class="ch-h"><span><b>${esc(h.name)}</b><i>${h.households} homes${h.gang > 0.2 ? ' · gang turf' : ''}</i></span>${STATS.map((k) => bar(h[k])).join('')}<em>${h.businesses.filter((b) => b.open).length}/${h.businesses.length}</em></div>`).join('');
      const r = M.reports[0];
      $('#ch-report').innerHTML = r ? `<p>Week ${r.week}: ${r.money.net >= 0 ? '+' : ''}${money(r.money.net)} · approval ${Math.round(r.approval)}%</p>${r.events.length ? `<ul>${r.events.slice(0, 8).map((e) => `<li class="${e.kind}">${esc(e.text)}</li>`).join('')}</ul>` : '<p class="quiet">No shops opened or closed.</p>'}` : '<p class="quiet">Your first week is under way. The books settle at the end of it.</p>';
    };
    for (const el of this.root.querySelectorAll('[data-stat]')) el.onclick = () => { stat = this.chStat = el.dataset.stat; for (const q of this.root.querySelectorAll('[data-stat]')) q.classList.toggle('on', q === el); drawMap(); };
    $('#ch-tax').oninput = (e) => { M.setBudget({ tax: +e.target.value }); refresh(); };
    for (const el of this.root.querySelectorAll('[data-dept]')) el.oninput = (e) => { M.setBudget({ [el.dataset.dept]: +e.target.value }); refresh(); };
    $('#ch-focus').onchange = (e) => { M.setBudget({ focus: e.target.value || null }); refresh(); };
    $('#ch-back').onclick = () => this.h.cityhallBack();
    refresh();
    requestAnimationFrame(drawMap);
    void seed;
  }

  loading({ text }) {
    this.root.innerHTML = `<div class="panel"><h2>${esc(text || 'Loading\u2026')}</h2></div>`;
  }

  // The end of a street fight: the run, a personal best, posting to the online board, and the board itself.
  streetOver({ r, newBest, best, name }) {
    const n = (v) => Number(v).toLocaleString('en-US');
    this.root.innerHTML = `
      <div class="panel over">
        <h2>YOU WENT DOWN</h2>
        <p class="final">${n(r.score)}</p>
        <p class="unit">kill${r.score === 1 ? '' : 's'}</p>
        <p class="sub">${newBest ? 'New personal best' : best ? `Your best: ${n(best.score)} kills` : ''}</p>
        <div class="runstats">
          <div><b>${r.wave}</b><span>wave</span></div>
          <div><b>${r.headshots}</b><span>headshots</span></div><div><b>${r.bestCombo}</b><span>best streak</span></div>
          <div><b>${Math.floor(r.time / 60)}:${String(r.time % 60).padStart(2, '0')}</b><span>survived</span></div>
        </div>
        <form class="post" id="o-post"><input id="o-tag" maxlength="16" placeholder="Your name" aria-label="Name for the leaderboard" spellcheck="false"><button type="submit" id="o-send">Post score</button></form>
        <p class="status" id="o-status"></p>
        <h3>Leaderboard</h3>
        <ol class="board" id="o-board"><li class="empty">Loading the board…</li></ol>
        <button class="primary-btn" id="o-again">Play again</button>
        <button id="o-title">Title screen</button>
      </div>`;
    const $ = (s) => this.root.querySelector(s), shown = this.current;
    const tag = $('#o-tag'), status = $('#o-status');
    tag.value = lastTag() || name || '';
    const render = (rows) => {
      if (this.current !== shown) return;
      if (!rows) { $('#o-board').innerHTML = '<li class="empty">The online board shows up in the published game on claude.ai.</li>'; return; }
      $('#o-board').innerHTML = rows.length ? rows.map((x, i) => `<li${x.me ? ' class="me"' : ''}><i>${i + 1}</i><span>${esc(x.tag)}</span><em>wave ${x.wave}</em><b>${n(x.score)} kills</b></li>`).join('') : '<li class="empty">No scores yet. Post the first one.</li>';
    };
    topScores(10).then(render);
    $('#o-post').onsubmit = async (e) => {
      e.preventDefault();
      $('#o-send').disabled = true;
      status.textContent = 'Posting…';
      const res = await submitScore(r, tag.value);
      if (this.current !== shown) return;
      $('#o-send').disabled = false;
      status.textContent = res.ok ? (res.improved ? 'Posted.' : 'Your best on the board is higher, so it stays. Name updated.') : res.reason;
      status.className = `status ${res.ok ? 'ok' : 'bad'}`;
      if (res.ok) topScores(10).then(render);
    };
    $('#o-again').onclick = () => this.h.restart(true);
    $('#o-title').onclick = () => this.h.title();
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
