// The damage a monster does to you is drawn bigger than the damage you deal, ringed in white (per user: "increasing the size of
// the damage number done by monster onto player bigger", then "make it 2x bigger with white outline as well"; LX_DN_TAKEN_SCALE). Read off the renderer itself: each case pushes ONE number,
// calls drawDamageNumbers() and records the font size it sets (every draw path - live glyph, settled bake, glyph atlas -
// sizes off that same baseSize) and where it places the number.
//   1. a damage figure you TAKE ("-123", "1,234") draws LX_DN_TAKEN_SCALE x the size of the same figure dealt
//   2. CONTROL: a dealt figure keeps its size; so does a crit
//   3. CONTROL: the status pops the same pushes tag as taken (DODGE, a "+500" gain) keep their size
//   4. a big taken figure at the screen edge is held a wider margin in, so it stays whole
//   5. WHITE RING (per user: "make it 2x bigger with white outline as well"): a taken figure wears a white ring around its
//      black outline in the settled bake, the glyph atlas and the live frames (a constant 11 device px); a dealt one never
// Run: node scripts/taken_dmg_size_test.mjs   (PORT / MOJI_GAME_FILE from the environment)
import { createRequire } from 'node:module';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const PORT = Number(process.env.PORT || 12913);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1200));
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 220) });
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' })).newPage();
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1&lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof drawDamageNumbers === 'function', null, { timeout: 180000 });
  const out = await page.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = player.cls || 'warrior';
    try { if (window._lxBootHold && window._lxBootHold.release) window._lxBootHold.release('menu'); } catch (e) {}
    player._storyBeatsSeen = player._storyBeatsSeen || {}; if (typeof STORY_BEATS === 'object') for (const id in STORY_BEATS) player._storyBeatsSeen[id] = true;
    loadMap('forest'); await new Promise((r) => setTimeout(r, 2500));
    game.paused = true; game.monsters.length = 0;
    const P = CanvasRenderingContext2D.prototype, FD = Object.getOwnPropertyDescriptor(P, 'font');
    const draw = (num, dx) => {   // one number alone, drawn once by the real renderer: the font size it set, where it went
      game.damageNumbers.length = 0;
      game.damageNumbers.push(Object.assign({ x: game.camera.x + (dx === undefined ? 480 : dx), y: (game.camera.y || 0) + 220, vy: 0, life: 200, maxLife: 230, color: '#ff5555' }, num));
      const fonts = [], moves = []; const oT = ctx.translate;
      Object.defineProperty(ctx, 'font', { configurable: true, get() { return FD.get.call(this); }, set(v) { fonts.push(v); FD.set.call(this, v); } });
      ctx.translate = function (x, y) { moves.push(x); return oT.call(this, x, y); };
      try { drawDamageNumbers(); } finally { delete ctx.font; ctx.translate = oT; }
      const px = fonts.map((v) => +(((v || '').match(/([0-9]+)px Impact/) || [])[1] || 0)).filter(Boolean);
      return { px: px.length ? px[0] : null, x: moves.length ? moves[0] : null };
    };
    const k = (game._uiScale > 0) ? game._uiScale : 1, sc = (typeof LX_DN_TAKEN_SCALE === 'number') ? LX_DN_TAKEN_SCALE : null;
    const r = {
      k, sc,
      dealt: draw({ text: '-123' }), taken: draw({ text: '-123', taken: true }), takenComma: draw({ text: '1,234', taken: true }),
      crit: draw({ text: '999', crit: true, size: 22, color: '#ffcc44' }),
      dodge: draw({ text: 'DODGE', taken: true, size: 14, color: '#88ffcc' }), dodgeP: draw({ text: 'DODGE', size: 14, color: '#88ffcc' }),
      gain: draw({ text: '+500', taken: true }), gainP: draw({ text: '+500' }),
      edge: draw({ text: '-8888', taken: true }, 2), edgeP: draw({ text: '-8888' }, 2),
    };
    // THE WHITE RING (per user: "with white outline as well"), read off each path's own output. "White" = r, g, b and alpha
    // all >= 240: a red figure's gradient, rim and crown never reach it, the ring is nothing else.
    const white = (cv, y0, y1) => { const c2 = document.createElement('canvas'); c2.width = cv.width; c2.height = cv.height; const x = c2.getContext('2d', { willReadFrequently: true }); x.drawImage(cv, 0, 0);
      const px = x.getImageData(0, 0, c2.width, c2.height).data, W4 = c2.width * 4; let n = 0;
      for (let i = 0; i < px.length; i += 4) { const yy = (i / W4) | 0; if (y0 !== undefined && (yy < y0 || yy >= y1)) continue; if (px[i] >= 240 && px[i + 1] >= 240 && px[i + 2] >= 240 && px[i + 3] >= 240) n++; } return n; };
    const bakeW = (num) => { const d = Object.assign({ vy: 0, life: 200, maxLife: 230, color: '#ff5a5a' }, num); const b = _dnBake(d, String(d.text), d.color, 18); return b && b.cv ? white(b.cv) : -1; };
    r.bakeTaken = bakeW({ text: '-1,337', taken: true }); r.bakeDealt = bakeW({ text: '-1,337' });
    const atlasW = (tk) => { const at = _lxDnAtlasBuild(36, 36, 36, { crit: false, big: false }, '#ff5a5a', tk, false, false, 1); if (!at) return null;
      const perRow = []; for (let rr = 0; rr < at.rows; rr++) perRow.push(white(at.cv, rr * at.rowH, rr * at.rowH + at.cellH)); return { rows: at.rows, perRow }; };
    r.atlasTaken = atlasW(true); r.atlasDealt = atlasW(false);
    { // the live frames: a fresh colour (no atlas for it yet) popping in - every white stroke, in device px
      game.damageNumbers.length = 0; const col = '#ff5a' + (16 + Math.floor(Math.random() * 64)).toString(16).padStart(2, '0');
      game.damageNumbers.push({ x: game.camera.x + 480, y: (game.camera.y || 0) + 220, vy: 0, life: 226, maxLife: 230, color: col, text: '-4,242', taken: true });
      const ws = [], oS = ctx.strokeText, dp = (typeof _LX_DPR === 'number' && _LX_DPR > 0) ? _LX_DPR : 1;
      ctx.strokeText = function () { if (String(this.strokeStyle).toLowerCase() === '#ffffff') { const m = this.getTransform(); ws.push(+(this.lineWidth * Math.hypot(m.a, m.b) / dp).toFixed(2)); } return oS.apply(this, arguments); };
      try { drawDamageNumbers(); } finally { ctx.strokeText = oS; }
      r.liveWhite = ws; }
    game.damageNumbers.length = 0; game.paused = false;
    return r;
  });
  const want = (base) => Math.floor(base * out.k), big = Math.floor(18 * out.k * (out.sc || 0));
  ok('the build carries one taken-damage scale, and it is bigger than 1', out.sc > 1, 'LX_DN_TAKEN_SCALE ' + out.sc);
  ok('a damage figure you take draws at the taken scale ("-123")', out.taken.px === big, `taken ${out.taken.px}px, dealt ${out.dealt.px}px, want ${big}px`);
  ok('...a comma figure too ("1,234")', out.takenComma.px === big, `${out.takenComma.px}px`);
  ok('CONTROL: a dealt figure keeps its size', out.dealt.px === want(18), `${out.dealt.px}px, want ${want(18)}px`);
  ok('CONTROL: a crit keeps its size', out.crit.px === want(26), `${out.crit.px}px, want ${want(26)}px`);
  ok('CONTROL: a taken DODGE pop keeps its size', out.dodge.px === out.dodgeP.px && out.dodge.px === want(18), `${out.dodge.px}px vs ${out.dodgeP.px}px`);
  ok('CONTROL: a taken "+500" gain keeps its size', out.gain.px === out.gainP.px && out.gain.px === want(18), `${out.gain.px}px vs ${out.gainP.px}px`);
  ok('a big taken figure at the screen edge is held a wider margin in (stays whole)', out.edge.x >= big * 1.5 - 1 && out.edgeP.x === 28,
     `taken placed at x ${out.edge.x}, dealt at ${out.edgeP.x}`);
  const ringRow = out.atlasTaken ? out.atlasTaken.perRow.findIndex((n) => n > 50) : -1;
  ok('WHITE RING, settled bake: a taken figure is ringed in white, the same figure dealt is not',
     out.bakeTaken > 300 && out.bakeTaken > 4 * out.bakeDealt, `white px: taken ${out.bakeTaken}, dealt ${out.bakeDealt}`);
  ok('WHITE RING, glyph atlas: a taken figure\'s atlas carries a white layer, a dealt figure\'s none',
     ringRow >= 0 && !!out.atlasDealt && out.atlasDealt.perRow.every((n) => n < 20),
     `taken rows ${out.atlasTaken && out.atlasTaken.rows} white/row ${JSON.stringify(out.atlasTaken && out.atlasTaken.perRow)}, dealt ${JSON.stringify(out.atlasDealt && out.atlasDealt.perRow)}`);
  ok('WHITE RING, live frames: a popping taken figure strokes white at a constant 11 device px (the black stays 5)',
     out.liveWhite.length > 0 && out.liveWhite.every((w) => Math.abs(w - 11) < 0.6), `white strokes ${JSON.stringify(out.liveWhite)}`);
} catch (e) { ok('harness ran', false, e.message); }
await browser.close(); server.kill();
let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
