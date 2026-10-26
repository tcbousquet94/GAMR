// High scores: a run's score is its kill count. Your best run is kept in this browser; the online board lives in
// the published page's shared store (the claude.ai `db` capability): one document per player at scores/<their id>,
// holding only their best run and the tag they typed. Everyone who can open the page reads the board; each player writes only their own row (the rules
// are declared when the page is published: scores readable by all, scores/{self} writable by its owner).
//
// Anywhere else (vite dev, a saved copy of the page, a viewer who can't write) the board degrades: the local best
// always works, the online list shows when it can be read, and posting says why it can't.

const LOCAL = 'broke.best.v2'; // v1 held points, from before the score became the kill count
const TAG = 'broke.tag.v1';

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked: this visit only */ } },
};

export function cleanTag(t) {
  return String(t || '').replace(/[^A-Za-z0-9 _.\-']/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
}

export function localBest() {
  try { const b = JSON.parse(store.get(LOCAL)); return b && Number.isFinite(b.score) ? b : null; } catch { return null; }
}

// Keep a run as the local best if it beats it. Returns true when it did.
export function saveLocal(r) {
  const b = localBest();
  if (b && b.score >= r.score) return false;
  store.set(LOCAL, JSON.stringify({ score: r.score, wave: r.wave, kills: r.kills, at: Date.now() }));
  return true;
}

export const lastTag = () => store.get(TAG) || '';

let ready = null;
// Connect once: { db, uid } or null when this view has no shared store.
function connect() {
  if (ready) return ready;
  ready = (async () => {
    const C = typeof window !== 'undefined' ? window.claude : null;
    if (!C?.use) return null;
    const [db, user] = await Promise.all([C.use('db'), C.use('user')]);
    if (!db) return null;
    const uid = user ? await user.id() : null;
    return { db, uid };
  })().catch(() => null);
  return ready;
}

// The top runs, best first: [{ tag, score, wave, kills, me }], or null when the board can't be read here.
export async function topScores(n = 10) {
  const c = await connect();
  if (!c) return null;
  try {
    const snap = await c.db.collection('scores').orderBy('score', 'desc').limit(n).get();
    return snap.docs.map((d) => {
      const v = d.data() || {};
      return { tag: cleanTag(v.tag) || 'Anonymous', score: Math.max(0, Math.floor(+v.score || 0)), wave: +v.wave || 0, kills: +v.kills || 0, me: d.id === c.uid };
    });
  } catch { return null; }
}

// Post a run under a tag. Only a run that beats this player's online best replaces it.
// Resolves { ok: true, improved } or { ok: false, reason } with a sentence a player can act on.
export async function submitScore(r, tag) {
  tag = cleanTag(tag);
  if (!tag) return { ok: false, reason: 'Type a name for the board first.' };
  store.set(TAG, tag);
  const c = await connect();
  if (!c) return { ok: false, reason: 'The online board only works in the published game on claude.ai.' };
  if (!c.uid) return { ok: false, reason: 'Sign in to claude.ai to post a score.' };
  const ref = c.db.doc(`scores/${c.uid}`);
  try {
    const cur = await ref.get();
    const prev = cur.exists ? +cur.data().score || 0 : -1;
    const body = r.score > prev
      ? { tag, score: r.score, wave: r.wave, kills: r.kills, headshots: r.headshots, at: new Date().toISOString() }
      : { ...cur.data(), tag }; // keep the better run, update the name
    await ref.set(body);
    return { ok: true, improved: r.score > prev };
  } catch (e) {
    if (e?.code === 'invalid_argument') return { ok: false, reason: "You can see the board but can't post to it. Ask the game's owner to add you as a Contributor." };
    if (e?.code === 'quota_exceeded') return { ok: false, reason: 'The board is full.' };
    return { ok: false, reason: "Couldn't reach the board. Try again in a moment." };
  }
}
