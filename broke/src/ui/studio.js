// The studio card (designXR studios): the very first screen, shown while the game loads. The page's own HTML carries
// it (tools/artifact.mjs puts it in the published page, main.js adds it in dev), so it paints before the game's
// script runs; main.js lifts it once the title is ready and it has been up long enough to read.
//
// Its animations are opacity and transform only: those keep running on the compositor while the city is built on the
// main thread, where anything else would freeze.

// The mark: a tipi of two crossed poles over a campfire.
export const STUDIO_MARK = `<svg class="mark" viewBox="40 50 420 400" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">
  <path pathLength="1" d="M200 74 L378 424"/><path pathLength="1" d="M300 74 L122 424"/><path pathLength="1" d="M68 426 H432"/>
  <path class="fire" pathLength="1" d="M250 421 C206 421 181 398 182 364 C183 330 222 316 238 296 C246 286 250 277 252 268 C285 290 320 330 320 370 C320 402 294 421 250 421 Z"/>
  <path class="fire" pathLength="1" d="M250 421 C226 421 210 405 211 382 C212 359 236 348 248 330 C263 350 289 366 289 392 C289 410 273 421 250 421 Z"/></g></svg>`;

export const STUDIO_BOOT = `<div id="boot" class="studio" role="img" aria-label="designXR studios"><div class="s-mark">${STUDIO_MARK}<div class="s-glow">${STUDIO_MARK}</div></div><p>designXR <span>studios</span></p></div>`;
