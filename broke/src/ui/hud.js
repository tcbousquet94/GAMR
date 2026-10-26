// HUD in the elegant style of the target look: serif type, a thin health bar, a thin compass bar with the
// objective marker, translucent round ability buttons, an interact banner, intro cards and toasts.

import { ITEMS, EQUIPMENT, TIER_COLOR } from '../sim/items.js';
import { SHOP } from '../sim/economy.js';
import { formatMoney, formatTime } from '../core/math.js';
import { icon } from './icons.js';
import { TIERS } from '../core/config.js';
import { MAYOR } from '../sim/mayor/mayor.js';
import { statColor } from './townmap.js';
import { POWERS } from '../sim/turf/arcade.js';
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
// A power-up's toast icon: a gem in its colour.
const gem = (c) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><path d="M20 3 35 20 20 37 5 20Z" fill="${hex(c)}" stroke="#fff" stroke-width="2"/></svg>`)}`;


const $ = (sel, root = document) => root.querySelector(sel);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const DEG = 180 / Math.PI;
const PX_PER_DEG = 2.4;

export const ABILITY_ICONS = { primary: 'dart', secondary: 'clipboard', utility: 'salsa', special: 'codeblue', jump: 'jump', equipment: 'equip' };

export class Hud {
  constructor(root) {
    this.root = root;
    const ticks = [];
    for (let d = -360; d <= 720; d += 15) {
      const lab = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' }[((d % 360) + 360) % 360];
      ticks.push(`<i class="${lab ? (lab.length === 1 ? 'card' : 'mid') : ''}" style="left:${d * PX_PER_DEG}px">${lab ? `<b>${lab}</b>` : ''}</i>`);
    }
    root.innerHTML = `
      <div class="hud-tl">
        <div class="vital"><div class="emblem">✚</div><div class="hp"><div class="hp-fill" id="h-hpfill"></div><div class="hp-barrier" id="h-barrier"></div></div><span class="hp-text" id="h-hptext"></span></div>
        <div class="money" id="h-money">$3.40</div><div class="money-pop" id="h-pop"></div>
      </div>
      <div class="hud-tr"><div class="tier" id="h-tier">Light Traffic</div><div class="clock" id="h-clock">0:00</div><div class="tierbar"><div id="h-tierfill"></div></div><div class="combo" id="h-combo"></div><div class="powers" id="h-pow"></div></div>
      <div class="score-pops" id="h-pops"></div>
      <div class="compass" id="h-compass"><div class="c-strip" id="h-strip">${ticks.join('')}</div><div class="c-mark" id="h-mark"><span class="c-pin"></span><em id="h-dist"></em></div><div class="c-center"></div></div>
      <div class="objective" id="h-obj"></div>
      <div class="hud-top" id="h-top"></div>
      <div class="crosshair" id="h-cross"><i></i><i></i><i></i><i></i></div>
      <div class="reticle" id="h-ret"><b></b><div class="hitmark" id="h-hm"><i></i><i></i><i></i><i></i></div></div>
      <div class="ammo" id="h-ammo"><div class="cyl" id="h-cyl"></div><span id="h-ammotext"></span></div>
      <div class="prompt" id="h-prompt"></div>
      <div class="latched" id="h-latch"><span class="pill">Q</span><div><b>Got a minute?</b><em>Salsa Step to break free</em></div></div>
      <div class="abilities" id="h-abil"></div>
      <div class="items" id="h-items"></div>
      <div class="intro" id="h-intro"><div class="intro-name"></div><div class="intro-title"></div></div>
      <div class="banner" id="h-banner"></div>
      <div class="toasts" id="h-toasts"></div>
      <div class="vignette" id="h-vig"></div>`;
    this.el = {
      money: $('#h-money', root), pop: $('#h-pop', root), tier: $('#h-tier', root), clock: $('#h-clock', root), tierfill: $('#h-tierfill', root),
      top: $('#h-top', root), obj: $('#h-obj', root), strip: $('#h-strip', root), mark: $('#h-mark', root), compass: $('#h-compass', root), dist: $('#h-dist', root), cross: $('#h-cross', root),
      prompt: $('#h-prompt', root), latch: $('#h-latch', root), hpfill: $('#h-hpfill', root), barrier: $('#h-barrier', root), hptext: $('#h-hptext', root),
      abil: $('#h-abil', root), ret: $('#h-ret', root), hm: $('#h-hm', root), ammo: $('#h-ammo', root), cyl: $('#h-cyl', root), ammotext: $('#h-ammotext', root), combo: $('#h-combo', root), pow: $('#h-pow', root), pops: $('#h-pops', root), items: $('#h-items', root), intro: $('#h-intro', root), banner: $('#h-banner', root), toasts: $('#h-toasts', root), vig: $('#h-vig', root),
    };
    this.itemsKey = '';
    this.popT = 0; this.popAmt = 0;
    this.vig = 0;
    this.hitT = 0;
    this.touch = null;
  }

  bind(game, survivor, touch) {
    this.game = game;
    this.survivor = survivor;
    this.touch = touch || this.touch;
    this.offs?.forEach((o) => o());
    const E = game.events;
    const A = survivor.abilities;
    this.el.abil.innerHTML = '';
    this.slots = {};
    const keys = { primary: 'M1', secondary: 'M2', utility: 'Q', special: 'R' };
    for (const slot of ['primary', 'secondary', 'utility', 'special']) {
      const d = h('div', 'abil', `<div class="ring"><img src="${icon((survivor.icons || ABILITY_ICONS)[slot], '#ffffff', 64, true)}"><div class="cd"></div><span class="key">${keys[slot]}</span></div><span class="lab">${A[slot].name.split(' ')[0]}</span>`);
      d.title = `${A[slot].name}: ${A[slot].desc}`;
      this.el.abil.appendChild(d);
      this.slots[slot] = d;
    }
    this.equipEl = h('div', 'abil equip', `<div class="ring"><img><div class="cd"></div><span class="key">F</span></div><span class="lab">Equip</span>`);
    this.el.abil.appendChild(this.equipEl);
    this.el.abil.style.display = this.touch?.enabled || survivor.hudAbilities === false ? 'none' : '';
    // Guns: a dot reticle and the cylinder instead of the ability rings.
    const gun = game.player.gun;
    this.el.ammo.style.display = gun ? '' : 'none';
    this.el.ret.style.display = gun ? '' : 'none';
    this.el.cross.style.display = gun ? 'none' : '';
    if (gun) this.el.cyl.innerHTML = Array.from({ length: gun.def.cylinder }, (_, i) => `<i style="transform:rotate(${(i * 360) / gun.def.cylinder}deg) translateY(-11px)"></i>`).join('');
    this.hmT = 0; this.hmKind = '';
    // Touch buttons mirror the cooldowns.
    this.tslots = {};
    if (this.touch?.enabled) for (const b of this.touch.root.querySelectorAll('.t-btn')) this.tslots[b.dataset.id] = b;
    this.itemsKey = '';
    this.el.top.innerHTML = '';
    this._topHtml = null; this.bossFill = null;
    this.el.toasts.innerHTML = '';
    this.offs = [
      E.on('change', (d) => { this.popAmt += d.amount; this.popT = 1.2; }),
      E.on('item', (d) => { const it = ITEMS[d.item]; if (it) this.toast(it.name, it.desc, TIER_COLOR[it.tier], icon(it.icon, TIER_COLOR[it.tier])); }),
      E.on('purchase', (d) => { if (d.equipment) { const q = EQUIPMENT[d.item]; this.toast(q.name, q.desc, TIER_COLOR.equipment, icon(q.icon, TIER_COLOR.equipment)); } }),
      E.on('cantAfford', (d) => this.flashPrompt('Not enough change', `It costs ${formatMoney(d.price)}. You have ${formatMoney(d.have)}.`)),
      E.on('intro', (d) => this.intro(d.name, d.title, d.boss)),
      E.on('tier', (d) => this.banner(d.label, 'Prices are going up.')),
      E.on('trainCalled', () => this.banner('Train called', 'Hold out until it arrives.')),
      E.on('trainArrived', () => this.banner('The train is here', 'Get to the doors.')),
      E.on('bossDefeated', () => this.banner('Motion denied', 'The HOA President has been overruled.')),
      E.on('bossAttack', (d) => this.bossCall(d.name)),
      E.on('playerHurt', (d) => { this.vig = Math.min(1, this.vig + 0.25 + d.amount / 30); }),
      E.on('hit', (d) => { this.hitT = 0.12; if (d.source === 'revolver') this.hitmark(d.part === 'head' ? 'head' : 'body'); }),
      E.on('kill', (d) => { if (game.enemies.find((e) => e.id === d.id)?.lastHitBy === 'revolver') this.hitmark('kill'); }),
      E.on('recover', () => this.flashPrompt('Back on your feet', 'You fell. It cost you a little health.')),
      // Street fights.
      E.on('waveStart', (d) => this.banner(`Wave ${d.wave}`, `${d.count} Vipers coming for you.`)),
      E.on('waveClear', (d) => this.banner('Street cleared', `+${d.bonus.toLocaleString('en-US')} · +25 health`)),
      E.on('power', (d) => this.toast(d.name, d.desc, hex(d.color), gem(d.color))),
      E.on('score', (d) => this.scorePop(d)),
    ];
    this.el.combo.textContent = ''; this.el.pow.innerHTML = ''; this.el.pops.innerHTML = '';
  }

  // Hit marker on the reticle: white for a body hit, gold for a headshot, red for a kill.
  hitmark(kind) {
    if (kind === 'body' && this.hmKind === 'kill' && this.hmT > 0.1) return;
    this.hmKind = kind; this.hmT = kind === 'kill' ? 0.4 : 0.22;
    this.el.hm.className = `hitmark show ${kind}`;
  }

  toast(title, desc, color, img) {
    const t = h('div', 'toast', `<img src="${img}"><div><b style="color:${color}">${title}</b><span>${desc}</span></div>`);
    this.el.toasts.appendChild(t);
    setTimeout(() => t.classList.add('out'), 3200);
    setTimeout(() => t.remove(), 3700);
    while (this.el.toasts.children.length > 3) this.el.toasts.firstChild.remove();
  }

  intro(name, title, boss) {
    const el = this.el.intro;
    el.querySelector('.intro-name').textContent = name;
    el.querySelector('.intro-title').textContent = title;
    el.className = `intro show ${boss ? 'boss' : ''}`;
    clearTimeout(this._introT);
    this._introT = setTimeout(() => (el.className = 'intro'), boss ? 3600 : 2400);
  }

  banner(title, sub) {
    const el = this.el.banner;
    el.innerHTML = `<b>${title}</b><span>${sub}</span>`;
    el.className = 'banner show';
    clearTimeout(this._banT);
    this._banT = setTimeout(() => (el.className = 'banner'), 2600);
  }

  bossCall(name) {
    if (!this.bossNameEl) return;
    this.bossNameEl.textContent = name;
    this.bossNameEl.classList.add('call');
    clearTimeout(this._bcT);
    this._bcT = setTimeout(() => this.bossNameEl?.classList.remove('call'), 1600);
  }

  // A kill's points float up from the top-right score for a moment.
  scorePop(d) {
    const t = h('div', `pop${d.head ? ' head' : ''}`, `+${d.points}${d.head ? ' HEADSHOT' : ''}`);
    this.el.pops.appendChild(t);
    setTimeout(() => t.remove(), 1100);
    while (this.el.pops.children.length > 4) this.el.pops.firstChild.remove();
  }

  // Informational banner: no key pill, since there is nothing to press.
  flashPrompt(title, sub) { this.forcePrompt = { title, sub, t: 1.8, info: true }; }

  update(dt) {
    if (this.game.mode === 'hero') return; // the look-development street runs without a HUD
    const g = this.game, P = g.player, st = P.stats;
    const el = this.el;
    const turf = g.mode === 'turf'; // turf war: no shop money, clock or train; district + seed instead
    el.money.style.display = turf ? 'none' : '';
    el.money.textContent = formatMoney(g.economy.cents);
    if (this.popT > 0) { this.popT -= dt; el.pop.textContent = `+${formatMoney(this.popAmt)}`; el.pop.style.opacity = Math.min(1, this.popT * 2); if (this.popT <= 0) this.popAmt = 0; }
    else el.pop.style.opacity = 0;
    if (turf && g.arcade) {
      // Street fights: the score, the wave, the streak and the power-ups running.
      const A = g.arcade;
      el.tier.textContent = A.score.toLocaleString('en-US');
      el.tier.dataset.tier = 0;
      el.clock.textContent = A.phase === 'break' ? (A.wave ? `Wave ${A.wave + 1} in ${Math.ceil(A.timer)}` : 'Get ready') : `Wave ${A.wave} · ${A.enemiesLeft()} left`;
      el.tierfill.parentElement.style.display = 'none';
      el.combo.textContent = A.combo.n >= 2 ? `${A.combo.n} streak · x${A.mult.toFixed(1)}` : '';
      const pk = Object.entries(A.powers).map(([id, t]) => `${id}:${Math.ceil(t)}`).join(',');
      if (pk !== this._powKey) {
        this._powKey = pk;
        el.pow.innerHTML = Object.entries(A.powers).map(([id, t]) => `<span style="--c:${hex(POWERS[id].color)}">${POWERS[id].name} <b>${Math.ceil(t)}</b></span>`).join('');
      }
    } else if (turf) {
      el.tier.textContent = g.city.district.name;
      el.tier.dataset.tier = 0;
      el.clock.textContent = `Seed ${g.seed}`;
      el.tierfill.parentElement.style.display = 'none';
    } else {
      el.tierfill.parentElement.style.display = '';
      el.tier.textContent = g.clock.label;
      el.tier.dataset.tier = g.clock.tier;
      el.clock.textContent = formatTime(g.clock.time);
      const T = TIERS, i = g.clock.tier;
      const span = i < T.length - 1 ? T[i + 1].at - T[i].at : 4;
      el.tierfill.style.width = `${Math.min(100, ((g.clock.minutes - T[i].at) / span) * 100)}%`;
    }
    const frac = Math.max(0, P.hp / st.maxHp);
    el.hpfill.style.width = `${frac * 100}%`;
    el.hpfill.classList.toggle('low', frac < 0.3);
    el.barrier.style.width = `${Math.min(100, (P.barrier / st.maxHp) * 100)}%`;
    el.hptext.textContent = `${Math.ceil(P.hp)}`;
    // Abilities (desktop round buttons and touch buttons share cooldown display).
    const A = this.survivor.abilities;
    const cds = { secondary: [P.cooldowns.secondary, A.secondary.cooldown], utility: [P.cooldowns.utility, A.utility.cooldown], special: [P.cooldowns.special, A.special.cooldown] };
    if (P.equipment) cds.equipment = [P.equipCd, EQUIPMENT[P.equipment].cooldown];
    for (const [k, [c, max]] of Object.entries(cds)) {
      for (const d of [this.slots[k], this.tslots[k]]) {
        if (!d) continue;
        d.classList.toggle('cooling', c > 0);
        const cd = d.querySelector('.cd');
        if (cd) cd.style.background = `conic-gradient(rgba(10,8,18,0.55) ${(c / max) * 360}deg, transparent 0)`;
      }
    }
    if (P.equipment) {
      const q = EQUIPMENT[P.equipment];
      const img = this.equipEl.querySelector('img');
      const src = icon(q.icon, '#ffffff', 64, true);
      if (img.getAttribute('src') !== src) img.setAttribute('src', src);
      this.equipEl.style.display = '';
      this.equipEl.querySelector('.lab').textContent = q.name.split(' ').pop();
      this.equipEl.title = `${q.name}: ${q.desc}`;
      if (this.tslots.equipment) { this.tslots.equipment.style.display = ''; const ti = this.tslots.equipment.querySelector('img'); if (ti.getAttribute('src') !== src) ti.setAttribute('src', src); }
    } else {
      this.equipEl.style.display = 'none';
      if (this.tslots.equipment) this.tslots.equipment.style.display = 'none';
    }
    const key = JSON.stringify(P.inv);
    if (key !== this.itemsKey) {
      this.itemsKey = key;
      el.items.innerHTML = '';
      for (const [id, n] of Object.entries(P.inv)) {
        const it = ITEMS[id];
        if (!it || n <= 0) continue;
        const d = h('div', 'item', `<img src="${icon(it.icon, TIER_COLOR[it.tier])}">${n > 1 ? `<span>${n}</span>` : ''}`);
        d.title = `${it.name}: ${it.desc}`;
        el.items.appendChild(d);
      }
    }
    // Boss bar + train countdown.
    const boss = g.boss && g.boss.alive ? g.boss : null;
    const ex = g.exit;
    let top = '';
    if (!turf && ex.state === 'called') top += `<div class="countdown">The train arrives in <b>${formatTime(ex.remaining)}</b></div>`;
    if (!turf && ex.state === 'arrived') top += `<div class="countdown go">The train is here. <b>Board now</b></div>`;
    if (g.mayor) {
      // The mayor's bar: week, treasury, approval, time to the next settlement.
      const M = g.mayor, left = Math.max(0, Math.ceil(MAYOR.weekSeconds - M.clock)), cash = Math.round(M.cash);
      top += `<div class="mayor-bar"><span>Week <b>${M.week}</b></span><span class="${cash < 0 ? 'neg' : ''}">${cash < 0 ? '-' : ''}$${Math.abs(cash).toLocaleString('en-US')}</span><span>Approval <b style="color:${statColor(M.approval, 1)}">${Math.round(M.approval)}%</b></span><span class="dim">${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</span></div>`;
    }
    const want = top + (boss ? '|boss' : '');
    if (want !== this._topHtml) {
      this._topHtml = want;
      el.top.innerHTML = top + (boss ? this.bossHtml() : '');
      this.bossNameEl = el.top.querySelector('.boss-call');
      this.bossFill = el.top.querySelector('.boss-fill');
    }
    if (boss && this.bossFill) this.bossFill.style.width = `${(boss.hp / boss.maxHp) * 100}%`;
    // Compass: heading strip + objective marker.
    const heading = (((-P.yaw * DEG) % 360) + 360) % 360;
    el.strip.style.transform = `translateX(${-heading * PX_PER_DEG}px)`;
    const target = turf ? g.compassTarget() : ex.state === 'idle' ? ex.data.panel : ex.state === 'arrived' ? { x: (ex.data.board.x0 + ex.data.board.x1) / 2, z: (ex.data.board.z0 + ex.data.board.z1) / 2 } : ex.data.panel;
    const dx = target.x - P.pos.x, dz = target.z - P.pos.z;
    const dist = Math.hypot(dx, dz);
    let rel = Math.atan2(dx, -dz) * DEG - heading;
    rel = ((rel + 540) % 360) - 180;
    // Keep the marker inside the unfaded middle of the bar (the mask fades the outer 18% on each side); when the
    // target is further round, it parks at the edge with an arrow pointing the way to turn.
    if (!this.compassW) { this.compassW = el.compass.clientWidth || 440; addEventListener('resize', () => { this.compassW = 0; }, { once: true }); }
    const half = (this.compassW * 0.31) / PX_PER_DEG;
    const clampRel = Math.max(-half, Math.min(half, rel));
    el.mark.style.transform = `translateX(${clampRel * PX_PER_DEG}px)`;
    const edge = Math.abs(rel) > half;
    el.mark.classList.toggle('edge', edge);
    el.dist.textContent = edge ? (rel < 0 ? `‹ ${Math.round(dist)} m` : `${Math.round(dist)} m ›`) : `${Math.round(dist)} m`;
    const objText = turf ? g.objective() : ex.state === 'idle' ? (dist < 12 ? 'Call the train at the panel' : 'Find the subway') : ex.state === 'called' ? 'Survive until the train arrives' : 'Board the train';
    if (objText !== this._obj) { this._obj = objText; el.obj.textContent = objText; }
    // Interact banner.
    let pr = null;
    const it = !turf && g.state === 'playing' ? g.economy.focus(P) : null;
    if (turf && !this.flying && !(P.aimBlend > 0)) { const b = g.businessNear(P.pos, 7); if (b) pr = { title: b.name, sub: `${b.label} \u00b7 Block ${b.block} \u00b7 ${b.hq != null ? `Gang ${b.hq + 1} HQ` : b.owner === 'neutral' ? 'Neutral' : `Gang ${+b.owner.slice(4) + 1}`}`, info: true }; }
    if (it) {
      if (it.type === 'callpanel') { if (ex.state === 'idle') pr = { title: 'Call the train', sub: 'The ride home is 75 seconds out. Hold the platform.' }; }
      else {
        const price = g.economy.price(it);
        const ok = g.economy.cents >= price;
        const tier = SHOP[it.type].tier;
        pr = { title: SHOP[it.type].label, sub: `${tier === 'equipment' ? 'Equipment' : `${tier[0].toUpperCase()}${tier.slice(1)} item`} · <span class="price ${ok ? '' : 'no'}" style="--c:${TIER_COLOR[tier]}">${formatMoney(price)}</span>` };
      }
    }
    if (this.forcePrompt) { this.forcePrompt.t -= dt; pr = this.forcePrompt; if (this.forcePrompt.t <= 0) this.forcePrompt = null; }
    const html = pr?.info ? `<div><b>${pr.title}</b><em>${pr.sub}</em></div>` : pr ? `<button class="pill" id="h-use">${this.touch?.enabled ? 'Use' : 'E'}</button><div><b>${pr.title}</b><em>${pr.sub}</em></div>` : '';
    if (html !== this._prompt) {
      this._prompt = html;
      el.prompt.innerHTML = html;
      el.prompt.style.display = html ? '' : 'none';
      const use = el.prompt.querySelector('#h-use');
      if (use && this.touch?.enabled) use.onpointerdown = (e) => { e.preventDefault(); this.touch.latched.interact = true; };
    }
    el.latch.style.display = P.latchedBy ? '' : 'none';
    this.hitT -= dt;
    el.cross.classList.toggle('hit', this.hitT > 0);
    el.cross.classList.toggle('on', P.aimT > 0 || this.hitT > 0); // crosshair only while shooting (GTA-style)
    if (P.gun) {
      // Reticle: a dot while the gun is up, sized by the current spread, red when it's on an enemy.
      const g2 = P.gun, up = P.aimBlend > 0 || P.aimT > 0;
      el.ret.classList.toggle('on', up && !P.dead);
      el.ret.classList.toggle('target', !!this.aimOn);
      const px = Math.max(6, Math.min(46, Math.tan(g2.spread(P)) * (window.innerHeight / 2) / Math.tan((this.fov || 48) * Math.PI / 360) * 2));
      el.ret.style.setProperty('--spread', `${px.toFixed(1)}px`);
      this.hmT -= dt;
      if (this.hmT <= 0 && this.hmKind) { this.hmKind = ''; el.hm.className = 'hitmark'; }
      const ak = `${g2.ammo}|${g2.reloading}`;
      if (ak !== this._ammo) {
        this._ammo = ak;
        el.cyl.querySelectorAll('i').forEach((c, i) => c.classList.toggle('spent', i >= g2.ammo));
        el.ammotext.textContent = g2.reloading ? 'Reloading' : g2.ammo === 0 ? 'R to reload' : `${g2.ammo} / ${g2.def.cylinder}`;
        el.ammo.classList.toggle('empty', g2.ammo === 0);
      }
    }
    this.vig = Math.max(frac < 0.3 ? 0.35 : 0, this.vig - dt * 1.5);
    el.vig.style.opacity = this.vig;
  }

  bossHtml() {
    const b = this.game.boss;
    return `<div class="bossbar"><div class="boss-name">${b.def.name}<span class="boss-call"></span></div><div class="boss-track"><div class="boss-fill"></div></div></div>`;
  }

  setVisible(v) { this.root.style.display = v ? '' : 'none'; this.touch?.setVisible(v); }
}
