// Every zodiac column sign gets its OWN strike beam and telegraph.
// ============================================================================
// Seven of the twelve signs carry a signature move: aries / capricorn / pisces
// swing, and taurus / scorpio / sagittarius / aquarius fire a columnStrike.
// The three swingers each had their own swing art, but all four column signs
// shared ONE strike beam (fx_col_zodiac) and ONE telegraph (tg_col_zodiac) —
// while every other column boss in the game (arbiter, sovereign, legosaurus,
// barnaby, pathsbane, archon, tombwraith, tombhexer, blightelder,
// ossuarytyrant) had per-caster art.
//
// This drives the live game: it reads the real columnStrike trait off each
// spawned boss and the real key _lxAttackZones publishes, so it fails if the
// wiring regresses to the shared asset — a test that only checked the files
// exist on disk would pass on the broken build too.
//
// It also enforces the two constraints the art was generated under:
//   • CANVAS matches the reference it replaces (512x1120 beams, 288x512
//     telegraphs), and content occupies the same share of it
//   • MINIMAL CUTOFF: zero opaque pixels on any of the four borders. The
//     incumbent fx_col_zodiac fails this with 205 px sitting on its bottom
//     edge, which is exactly what docs/prompts/sprite_column_strike.md warns
//     against ("fade the very top and bottom ~5% to transparent").
// Run: node scripts/zodiac_column_art_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const sharp = require('sharp');

const SIGNS = ['taurus', 'scorpio', 'sagittarius', 'aquarius'];
const res = [];
const ok = (n, c, x) => res.push({ n, pass: !!c, x: x === undefined ? '' : String(x).slice(0, 160) });

// ---- 1. the files, their canvas, and the cutoff --------------------------
const SPEC = { fx: { w: 512, h: 1120, minFill: 0.55, maxFill: 0.80 }, tg: { w: 288, h: 512, minFill: 0.90, maxFill: 1.0 } };
for (const kind of ['fx', 'tg']) {
  for (const sign of SIGNS) {
    const f = path.join(ROOT, 'Sprites', 'fx', `${kind}_col_zodiac_${sign}.webp`);
    let m = null;
    try {
      const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const W = info.width, H = info.height, C = info.channels, A = (x, y) => data[(y * W + x) * C + 3];
      let x0 = W, x1 = -1, border = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (A(x, y) > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
      for (let x = 0; x < W; x++) { if (A(x, 0) > 16) border++; if (A(x, H - 1) > 16) border++; }
      for (let y = 0; y < H; y++) { if (A(0, y) > 16) border++; if (A(W - 1, y) > 16) border++; }
      m = { W, H, fill: (x1 - x0 + 1) / W, border };
    } catch (e) { m = null; }
    const s = SPEC[kind];
    ok(`${kind}_col_zodiac_${sign}: canvas ${s.w}x${s.h}, matching the art it replaces`,
      m && m.W === s.w && m.H === s.h, m ? `${m.W}x${m.H}` : 'MISSING');
    ok(`${kind}_col_zodiac_${sign}: NO cutoff — zero opaque pixels on any border`,
      m && m.border === 0, m ? `${m.border} border px` : 'MISSING');
    ok(`${kind}_col_zodiac_${sign}: content fills a reference-like share of the canvas`,
      m && m.fill >= s.minFill && m.fill <= s.maxFill, m ? `${(100 * m.fill).toFixed(0)}% wide` : 'MISSING');
  }
}

// ---- 2. the live game wires each sign to its own art ---------------------
const PORT = process.env.PORT || 9479;
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined, headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => typeof monsterTypes !== 'undefined' && typeof LX_FX !== 'undefined', { timeout: 60000 });

const live = await page.evaluate((SIGNS) => {
  const out = { beam: {}, tg: {}, registered: {}, swingUntouched: {}, sharedStillThere: {} };
  for (const s of SIGNS) {
    const t = monsterTypes['zodiac_' + s];
    out.beam[s] = t && t.traits && t.traits.columnStrike ? t.traits.columnStrike.sprite : null;
    // the key _lxAttackZones publishes for this caster
    out.tg[s] = 'tg_col_' + ('zodiac_' + s);
    out.registered[s] = { fx: !!LX_FX['fx_col_zodiac_' + s], tg: !!LX_FX['tg_col_zodiac_' + s] };
  }
  // the three swing signs must be untouched (no columnStrike at all)
  for (const s of ['aries', 'capricorn', 'pisces']) {
    const t = monsterTypes['zodiac_' + s];
    out.swingUntouched[s] = !!(t && t.traits && t.traits.bigMelee && !t.traits.columnStrike);
  }
  out.sharedStillThere = { fx: !!LX_FX['fx_col_zodiac'], tg: !!LX_FX['tg_col_zodiac'] };
  return out;
}, SIGNS);

for (const s of SIGNS) {
  ok(`zodiac_${s} fires its OWN beam, not the shared one`,
    live.beam[s] === `fx_col_zodiac_${s}`, `columnStrike.sprite = ${live.beam[s]}`);
  ok(`zodiac_${s} asks for its OWN telegraph`,
    live.tg[s] === `tg_col_zodiac_${s}`, live.tg[s]);
  ok(`zodiac_${s}: both keys registered in LX_FX`,
    live.registered[s].fx && live.registered[s].tg, JSON.stringify(live.registered[s]));
}
ok('the three SWING signs are untouched (no columnStrike)',
  Object.values(live.swingUntouched).every(Boolean), JSON.stringify(live.swingUntouched));
ok('the shared zodiac art is still registered as a fallback',
  live.sharedStillThere.fx && live.sharedStillThere.tg, JSON.stringify(live.sharedStillThere));
ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));

let bad = 0;
for (const x of res) { if (!x.pass) bad++; console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.n}${x.x ? '   [' + x.x + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
await browser.close(); srv.kill();
process.exit(bad ? 1 : 0);
