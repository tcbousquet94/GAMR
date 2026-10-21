// HUD in the elegant style of the target look: serif type, a thin health bar, a thin compass bar with the
// objective marker, translucent round ability buttons, an interact banner, intro cards and toasts.

import { ITEMS, EQUIPMENT, TIER_COLOR } from '../sim/items.js';
import { SHOP } from '../sim/economy.js';
import { formatMoney, formatTime } from '../core/math.js';
import { icon } from './icons.js';
import { TIERS } from '../core/config.js';

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
      <div class="hud-tr"><div class="tier" id="h-tier">Light Traffic</div><div class="clock" id="h-clock">0:00</div><div class="tierbar"><div id="h-tierfill"></div></div></div>
      <div class="compass" id="h-compass"><div class="c-strip" id="h-strip">${ticks.join('')}</div><div class="c-mark" id="h-mark"><span class="c-pin"></span><em id="h-dist"></em></div><div class="c-center"></div></div>
      <div class="objective" id="h-obj"></div>
      <div class="hud-top" id="h-top"></div>
      <div class="crosshair" id="h-cross"><i></i><i></i><i></i><i></i></div>
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
      top: $('#h-top', root), obj: $('#h-obj', root), strip: $('#h-strip', root), mark: $('#h-mark', root), dist: $('#h-dist', root), cross: $('#h-cross', root),
      prompt: $('#h-prompt', root), latch: $('#h-latch', root), hpfill: $('#h-hpfill', root), barrier: $('#h-barrier', root), hptext: $('#h-hptext', root),
      abil: $('#h-abil', root), items: $('#h-items', root), intro: $('#h-intro', root), banner: $('#h-banner', root), toasts: $('#h-toasts', root), vig: $('#h-vig', root),
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
      const d = h('div', 'abil', `<div class="ring"><img src="${icon(ABILITY_ICONS[slot], '#ffffff', 64, true)}"><div class="cd"></div><span class="key">${keys[slot]}</span></div><span class="lab">${A[slot].name.split(' ')[0]}</span>`);
      d.title = `${A[slot].name}: ${A[slot].desc}`;
      this.el.abil.appendChild(d);
      this.slots[slot] = d;
    }
    this.equipEl = h('div', 'abil equip', `<div class="ring"><img><div class="cd"></div><span class="key">F</span></div><span class="lab">Equip</span>`);
    this.el.abil.appendChild(this.equipEl);
    this.el.abil.style.display = this.touch?.enabled ? 'none' : '';
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
      E.on('hit', () => { this.hitT = 0.12; }),
      E.on('recover', () => this.flashPrompt('Back on your feet', 'You fell. It cost you a little health.')),
    ];
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

  flashPrompt(title, sub) { this.forcePrompt = { title, sub, t: 1.8 }; }

  update(dt) {
    const g = this.game, P = g.player, st = P.stats;
    const el = this.el;
    el.money.textContent = formatMoney(g.economy.cents);
    if (this.popT > 0) { this.popT -= dt; el.pop.textContent = `+${formatMoney(this.popAmt)}`; el.pop.style.opacity = Math.min(1, this.popT * 2); if (this.popT <= 0) this.popAmt = 0; }
    else el.pop.style.opacity = 0;
    el.tier.textContent = g.clock.label;
    el.tier.dataset.tier = g.clock.tier;
    el.clock.textContent = formatTime(g.clock.time);
    const T = TIERS, i = g.clock.tier;
    const span = i < T.length - 1 ? T[i + 1].at - T[i].at : 4;
    el.tierfill.style.width = `${Math.min(100, ((g.clock.minutes - T[i].at) / span) * 100)}%`;
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
    if (ex.state === 'called') top += `<div class="countdown">The train arrives in <b>${formatTime(ex.remaining)}</b></div>`;
    if (ex.state === 'arrived') top += `<div class="countdown go">The train is here. <b>Board now</b></div>`;
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
    const target = ex.state === 'idle' ? ex.data.panel : ex.state === 'arrived' ? { x: (ex.data.board.x0 + ex.data.board.x1) / 2, z: (ex.data.board.z0 + ex.data.board.z1) / 2 } : ex.data.panel;
    const dx = target.x - P.pos.x, dz = target.z - P.pos.z;
    const dist = Math.hypot(dx, dz);
    let rel = Math.atan2(dx, -dz) * DEG - heading;
    rel = ((rel + 540) % 360) - 180;
    const half = 92;
    const clampRel = Math.max(-half, Math.min(half, rel));
    el.mark.style.transform = `translateX(${clampRel * PX_PER_DEG}px)`;
    el.mark.classList.toggle('edge', Math.abs(rel) > half);
    el.dist.textContent = `${Math.round(dist)} m`;
    const objText = ex.state === 'idle' ? (dist < 12 ? 'Call the train at the panel' : 'Find the subway') : ex.state === 'called' ? 'Survive until the train arrives' : 'Board the train';
    if (objText !== this._obj) { this._obj = objText; el.obj.textContent = objText; }
    // Interact banner.
    let pr = null;
    const it = g.state === 'playing' ? g.economy.focus(P) : null;
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
    const html = pr ? `<button class="pill" id="h-use">${this.touch?.enabled ? 'Use' : 'E'}</button><div><b>${pr.title}</b><em>${pr.sub}</em></div>` : '';
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
    this.vig = Math.max(frac < 0.3 ? 0.35 : 0, this.vig - dt * 1.5);
    el.vig.style.opacity = this.vig;
  }

  bossHtml() {
    const b = this.game.boss;
    return `<div class="bossbar"><div class="boss-name">${b.def.name}<span class="boss-call"></span></div><div class="boss-track"><div class="boss-fill"></div></div></div>`;
  }

  setVisible(v) { this.root.style.display = v ? '' : 'none'; this.touch?.setVisible(v); }
}
