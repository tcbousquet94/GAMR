// Frame-time and draw-call counter. Toggle with F3 or ?perf=1; also exposed on window.__broke.perf.
export class Perf {
  constructor(el) { this.el = el; this.on = /perf=1/.test(location.search); this.frames = []; this.t = 0; }
  toggle() { this.on = !this.on; this.el.style.display = this.on ? 'block' : 'none'; }
  frame(dt, view, game) {
    if (dt <= 0) return; // skip zero-length frames (they would poison the average)
    this.frames.push(dt * 1000);
    if (this.frames.length > 120) this.frames.shift();
    const s = this.frames.slice().sort((a, b) => a - b);
    const avg = s.reduce((a, b) => a + b, 0) / s.length;
    this.stats = {
      fps: +(1000 / avg).toFixed(1), avgMs: +avg.toFixed(2), p95Ms: +s[Math.floor(s.length * 0.95)].toFixed(2),
      cpuMs: +(view.perf?.cpuMs ?? 0).toFixed(2), calls: view.perf?.calls ?? 0, triangles: view.perf?.triangles ?? 0,
      enemies: game.enemies.filter((e) => e.alive).length, quality: view.qualityName, scale: view.dynScale,
    };
    this.el.style.display = this.on ? 'block' : 'none';
    if (!this.on || (this.t = (this.t + 1) % 10)) return;
    const st = this.stats;
    this.el.textContent = `${st.fps} fps  ${st.avgMs} ms (p95 ${st.p95Ms})\ncpu ${st.cpuMs} ms  calls ${st.calls}  tris ${(st.triangles / 1000).toFixed(0)}k\nenemies ${st.enemies}  ${st.quality} x${st.scale.toFixed(2)}`;
  }
}
