// Minimal HUD: health, change, difficulty clock, abilities, equipment, items, boss bar, train countdown, objective
// marker, interact prompt, intro cards, toasts. Everything on screen has a job.

import { ITEMS, EQUIPMENT, TIER_COLOR } from '../sim/items.js';
import { SHOP } from '../sim/economy.js';
import { formatMoney, formatTime } from '../core/math.js';
import { icon } from './icons.js';
import { TIERS } from '../core/config.js';

const $ = (sel, root = document) => root.querySelector(sel);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

export class Hud {
  constructor(root) {
    this.root = root;
    root.innerHTML = `
      <div class="hud-tl"><div class="money" id="h-money">$3.40</div><div class="money-pop" id="h-pop"></div></div>
      <div class="hud-tr"><div class="tier" id="h-tier">Light Traffic</div><div class="clock" id="h-clock">0:00</div><div class="tierbar"><div id="h-tierfill"></div></div></div>
      <div class="hud-top" id="h-top"></div>
      <div class="objective" id="h-obj"><span class="arrow" id="h-arrow">▲</span><span id="h-objtext">Find the subway</span></div>
      <div class="crosshair" id="h-cross"><i></i><i></i><i></i><i></i></div>
      <div class="prompt" id="h-prompt"></div>
      <div class="latched" id="h-latch">Got a minute? <b>[Q] Salsa Step</b> to break free</div>
      <div class="hud-bl">
        <div class="hp"><div class="hp-fill" id="h-hpfill"></div><div class="hp-barrier" id="h-barrier"></div><div class="hp-text" id="h-hptext"></div></div>
        <div class="abilities" id="h-abil"></div>
      </div>
      <div class="items" id="h-items"></div>
      <div class="intro" id="h-intro"><div class="intro-name"></div><div class="intro-title"></div></div>
      <div class="banner" id="h-banner"></div>
      <div class="toasts" id="h-toasts"></div>
      <div class="vignette" id="h-vig"></div>`;
    this.el = {
      money: $('#h-money', root), pop: $('#h-pop', root), tier: $('#h-tier', root), clock: $('#h-clock', root), tierfill: $('#h-tierfill', root),
      top: $('#h-top', root), obj: $('#h-obj', root), arrow: $('#h-arrow', root), objtext: $('#h-objtext', root), cross: $('#h-cross', root),
      prompt: $('#h-prompt', root), latch: $('#h-latch', root), hpfill: $('#h-hpfill', root), barrier: $('#h-barrier', root), hptext: $('#h-hptext', root),
      abil: $('#h-abil', root), items: $('#h-items', root), intro: $('#h-intro', root), banner: $('#h-banner', root), toasts: $('#h-toasts', root), vig: $('#h-vig', root),
    };
    this.itemsKey = '';
    this.popT = 0; this.popAmt = 0;
    this.vig = 0;
    this.hitT = 0;
  }

  bind(game, survivor) {
    this.game = game;
    this.survivor = survivor;
    this.offs?.forEach((o) => o());
    const E = game.events;
    const A = survivor.abilities;
    this.el.abil.innerHTML = '';
    this.slots = {};
    for (const [slot, key, glyph] of [['primary', 'M1', 'dart'], ['secondary', 'M2', 'clipboard'], ['utility', 'Q', 'salsa'], ['special', 'R', 'codeblue']]) {
      const d = h('div', 'abil', `<img src="${icon(glyph, '#1fa89a')}"><div class="cd"></div><span class="key">${key}</span>`);
      d.title = `${A[slot].name}: ${A[slot].desc}`;
      this.el.abil.appendChild(d);
      this.slots[slot] = d;
    }
    this.equipEl = h('div', 'abil equip', `<img><div class="cd"></div><span class="key">F</span>`);
    this.el.abil.appendChild(this.equipEl);
    this.itemsKey = '';
    this.el.top.innerHTML = '';
    this.el.toasts.innerHTML = '';
    this.offs = [
      E.on('change', (d) => { this.popAmt += d.amount; this.popT = 1.2; }),
      E.on('item', (d) => { const it = ITEMS[d.item]; if (it) this.toast(it.name, it.desc, TIER_COLOR[it.tier], icon(it.icon, TIER_COLOR[it.tier])); }),
      E.on('purchase', (d) => { if (d.equipment) { const q = EQUIPMENT[d.item]; this.toast(q.name, q.desc, TIER_COLOR.equipment, icon(q.icon, TIER_COLOR.equipment)); } }),
      E.on('cantAfford', (d) => this.flashPrompt(`Need ${formatMoney(d.price)} — you have ${formatMoney(d.have)}`)),
      E.on('intro', (d) => this.intro(d.name, d.title, d.boss)),
      E.on('tier', (d) => this.banner(d.label.toUpperCase(), 'Prices are going up.')),
      E.on('trainCalled', () => this.banner('TRAIN CALLED', 'Survive until it arrives.')),
      E.on('trainArrived', () => this.banner('THE TRAIN IS HERE', 'Get to the doors!')),
      E.on('bossDefeated', () => this.banner('MOTION DENIED', 'The HOA President has been overruled.')),
      E.on('bossAttack', (d) => this.bossCall(d.name)),
      E.on('playerHurt', (d) => { this.vig = Math.min(1, this.vig + 0.25 + d.amount / 30); }),
      E.on('hit', () => { this.hitT = 0.12; }),
      E.on('recover', () => this.flashPrompt('Back on your feet.')),
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

  flashPrompt(text) { this.forcePrompt = { text, t: 1.6 }; }

  update(dt) {
    const g = this.game, P = g.player, st = P.stats;
    const el = this.el;
    // Change.
    el.money.textContent = formatMoney(g.economy.cents);
    if (this.popT > 0) { this.popT -= dt; el.pop.textContent = `+${formatMoney(this.popAmt)}`; el.pop.style.opacity = Math.min(1, this.popT * 2); if (this.popT <= 0) this.popAmt = 0; }
    else el.pop.style.opacity = 0;
    // Clock.
    el.tier.textContent = g.clock.label;
    el.tier.dataset.tier = g.clock.tier;
    el.clock.textContent = formatTime(g.clock.time);
    const T = TIERS, i = g.clock.tier;
    const span = i < T.length - 1 ? T[i + 1].at - T[i].at : 4;
    el.tierfill.style.width = `${Math.min(100, ((g.clock.minutes - T[i].at) / span) * 100)}%`;
    // Health.
    const frac = Math.max(0, P.hp / st.maxHp);
    el.hpfill.style.width = `${frac * 100}%`;
    el.hpfill.classList.toggle('low', frac < 0.3);
    el.barrier.style.width = `${Math.min(100, (P.barrier / st.maxHp) * 100)}%`;
    el.hptext.textContent = `${Math.ceil(P.hp)} / ${Math.round(st.maxHp)}`;
    // Abilities.
    const cds = { secondary: [P.cooldowns.secondary, this.survivor.abilities.secondary.cooldown], utility: [P.cooldowns.utility, this.survivor.abilities.utility.cooldown], special: [P.cooldowns.special, this.survivor.abilities.special.cooldown] };
    for (const [k, [c, max]] of Object.entries(cds)) {
      const d = this.slots[k];
      d.classList.toggle('cooling', c > 0);
      d.querySelector('.cd').style.height = `${(c / max) * 100}%`;
    }
    if (P.equipment) {
      const q = EQUIPMENT[P.equipment];
      const img = this.equipEl.querySelector('img');
      const src = icon(q.icon, TIER_COLOR.equipment);
      if (img.getAttribute('src') !== src) img.setAttribute('src', src);
      this.equipEl.style.display = '';
      this.equipEl.title = `${q.name}: ${q.desc}`;
      this.equipEl.classList.toggle('cooling', P.equipCd > 0);
      this.equipEl.querySelector('.cd').style.height = `${(P.equipCd / q.cooldown) * 100}%`;
    } else this.equipEl.style.display = 'none';
    // Items row (rebuild only when it changes).
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
    if (ex.state === 'called') top += `<div class="countdown">TRAIN ARRIVING <b>${formatTime(ex.remaining)}</b></div>`;
    if (ex.state === 'arrived') top += `<div class="countdown go">THE TRAIN IS HERE — <b>BOARD NOW</b></div>`;
    if (top !== this._topHtml) { this._topHtml = top; el.top.innerHTML = top + (boss ? this.bossHtml() : ''); this.bossNameEl = el.top.querySelector('.boss-call'); this.bossFill = el.top.querySelector('.boss-fill'); }
    if (boss && !this.bossFill) { el.top.innerHTML = top + this.bossHtml(); this.bossNameEl = el.top.querySelector('.boss-call'); this.bossFill = el.top.querySelector('.boss-fill'); }
    if (!boss && this.bossFill) { el.top.innerHTML = top; this.bossFill = null; this.bossNameEl = null; }
    if (boss && this.bossFill) this.bossFill.style.width = `${(boss.hp / boss.maxHp) * 100}%`;
    // Objective marker toward the subway (or the doors once the train is here).
    const target = ex.state === 'idle' ? ex.data.panel : ex.state === 'arrived' ? { x: (ex.data.board.x0 + ex.data.board.x1) / 2, z: (ex.data.board.z0 + ex.data.board.z1) / 2 } : null;
    if (target && g.state === 'playing') {
      const dx = target.x - P.pos.x, dz = target.z - P.pos.z;
      const dist = Math.hypot(dx, dz);
      const ang = Math.atan2(-dx, -dz) - P.yaw;
      el.obj.style.display = '';
      el.arrow.style.transform = `rotate(${-ang}rad)`;
      el.objtext.textContent = ex.state === 'idle' ? (dist < 12 ? 'Call the train at the panel' : `Find the subway · ${Math.round(dist)} m`) : `Board the train · ${Math.round(dist)} m`;
    } else el.obj.style.display = ex.state === 'called' ? 'none' : '';
    if (ex.state === 'called') { el.obj.style.display = ''; el.objtext.textContent = 'Survive until the train arrives'; el.arrow.style.transform = 'none'; }
    // Interact prompt.
    let prompt = '';
    const it = g.state === 'playing' ? g.economy.focus(P) : null;
    if (it) {
      if (it.type === 'callpanel') prompt = ex.state === 'idle' ? '<b>[E]</b> Call the train' : '';
      else {
        const price = g.economy.price(it);
        const ok = g.economy.cents >= price;
        const tier = SHOP[it.type].tier;
        prompt = `<b>[E]</b> ${SHOP[it.type].label} <span class="price ${ok ? '' : 'no'}" style="--c:${TIER_COLOR[tier]}">${formatMoney(price)}</span>`;
      }
    }
    if (this.forcePrompt) { this.forcePrompt.t -= dt; prompt = this.forcePrompt.text; if (this.forcePrompt.t <= 0) this.forcePrompt = null; }
    if (prompt !== this._prompt) { this._prompt = prompt; el.prompt.innerHTML = prompt; el.prompt.style.display = prompt ? '' : 'none'; }
    el.latch.style.display = P.latchedBy ? '' : 'none';
    // Crosshair hit marker + damage vignette.
    this.hitT -= dt;
    el.cross.classList.toggle('hit', this.hitT > 0);
    this.vig = Math.max(frac < 0.3 ? 0.35 : 0, this.vig - dt * 1.5);
    el.vig.style.opacity = this.vig;
  }

  bossHtml() {
    const b = this.game.boss;
    return `<div class="bossbar"><div class="boss-name">${b.def.name} <span class="boss-call"></span></div><div class="boss-track"><div class="boss-fill"></div></div></div>`;
  }

  setVisible(v) { this.root.style.display = v ? '' : 'none'; }
}
