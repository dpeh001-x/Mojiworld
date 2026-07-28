// v0.29.292 — RUNTIME smoke test for the v0.29.288-291 grind-texture features.
// The unit suites (seeded_run / world_affix / mastery_bar) prove the MATH in
// isolation by extracting functions from source. This one boots the real game
// in a real browser and exercises the code paths in situ, which is the only
// way to catch a missing DOM node, a bad selector, a TDZ/hoisting fault, or a
// helper that was renamed out from under a call site.
//
//   node scripts/new_features_smoke_test.mjs [port]
// Requires a local server (node serve.js <port>) and Chrome/Edge.
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const PORT = process.argv[2] || '8770';
const EXES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
];
const EXE = EXES.find(p => existsSync(p));
if (!EXE) { console.error('No Chromium-family browser found.'); process.exit(2); }

const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const browser = await chromium.launch({
  executablePath: EXE, headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--mute-audio', '--autoplay-policy=no-user-gesture-required'],
});
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const pageErrors = [], consoleErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e).slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });

  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  // Wait for the game globals rather than a fixed sleep. NOTE: `game` and
  // `player` are top-level `const`s, so they live in the global LEXICAL scope
  // and never appear on `window` — probe the bare identifiers.
  await page.waitForFunction(() => typeof game !== 'undefined' && typeof player !== 'undefined',
    null, { timeout: 60000 });
  await page.waitForTimeout(2500);

  ok('game boots with no uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 4));

  // ---- 1) every new symbol actually exists at runtime ----
  const syms = await page.evaluate(() => {
    const names = ['_lxMulberry32', '_lxSeedFromString', '_lxSeedToCode', '_lxCodeToSeed', '_expRand',
      '_setExpeditionSeed', '_expeditionSeedPrompt', '_worldAffixDay', '_worldAffixFor', '_activeAffix',
      '_affixExpMul', '_affixCoinMul', '_affixDropMul', '_affixBuffText', '_renderAffixPin',
      '_renderMasteryBar', '_masteryTierOf', '_lxDustPing'];
    // eval, not window[...] — these are lexical globals (const/function decls
    // in a classic script), which are unreachable through `window`.
    const missing = names.filter(n => {
      try { return eval('typeof ' + n) !== 'function'; } catch (e) { return true; }
    });
    const consts = { LX_DUST_TRICKLE_CHANCE: typeof LX_DUST_TRICKLE_CHANCE,
                     WORLD_AFFIXES: Array.isArray(WORLD_AFFIXES) ? WORLD_AFFIXES.length : 'missing',
                     _LX_SEED_SPACE: _LX_SEED_SPACE };
    return { missing, consts };
  });
  ok('all 18 new functions are defined at runtime', syms.missing.length === 0, syms.missing);
  ok('new constants are live', syms.consts.LX_DUST_TRICKLE_CHANCE === 'number'
      && syms.consts.WORLD_AFFIXES === 6 && syms.consts._LX_SEED_SPACE === 887503681, syms.consts);

  // ---- 2) required DOM nodes exist ----
  const dom = await page.evaluate(() => ({
    affixPin: !!document.getElementById('world-affix-pin'),
    masteryBar: !!document.getElementById('mastery-bar'),
    mbParts: ['mb-face', 'mb-name', 'mb-stars', 'mb-fill', 'mb-count'].filter(id => !document.getElementById(id)),
  }));
  ok('#world-affix-pin present', dom.affixPin);
  ok('#mastery-bar present with all 5 sub-nodes', dom.masteryBar && dom.mbParts.length === 0, dom.mbParts);

  // ---- 3) the mastery-bar CSS actually reached the stylesheet ----
  const css = await page.evaluate(() => {
    const el = document.getElementById('mastery-bar');
    el.style.display = 'block'; el.classList.add('mb-show');
    const cs = getComputedStyle(el);
    const fill = document.getElementById('mb-fill');
    const fs = getComputedStyle(fill);
    return { radius: cs.borderRadius, opacity: cs.opacity, pos: cs.position,
             fillBg: fs.backgroundImage.slice(0, 40), hasStripes: fs.backgroundImage.includes('gradient') };
  });
  ok('mastery bar is styled (capsule radius applied)', css.radius === '999px', css.radius);
  ok('.mb-show makes it visible', css.opacity === '1', css.opacity);
  ok('candy-stripe fill gradient applied', css.hasStripes, css.fillBg);

  // ---- 4) render the bar for real, at each tier ----
  const bar = await page.evaluate(() => {
    const out = [];
    for (const [kills, label] of [[47, 't0'], [300, 't1'], [750, 't2'], [1000, 'max']]) {
      _renderMasteryBar({ name: 'Test Quarry ' + label, type: 'slime', x: 100, y: 100, w: 30 }, kills, kills === 1000);
      const el = document.getElementById('mastery-bar');
      out.push({ kills, width: document.getElementById('mb-fill').style.width,
                 face: document.getElementById('mb-face').textContent,
                 stars: document.getElementById('mb-stars').textContent,
                 count: document.getElementById('mb-count').textContent,
                 shown: el.classList.contains('mb-show'), max: el.classList.contains('mb-max') });
    }
    return out;
  });
  ok('bar renders at every tier without throwing', bar.length === 4);
  ok('tier 0 (47/100) fills 47%', bar[0].width === '47%' && bar[0].face === '🥚', bar[0]);
  ok('tier 1 (300/500) fills 50%', bar[1].width === '50%' && bar[1].face === '🐣', bar[1]);
  ok('tier 2 (750/1000) fills 50%', bar[2].width === '50%' && bar[2].face === '🐤', bar[2]);
  ok('mastered pins 100% + MASTERED label', bar[3].width === '100%' && bar[3].count === 'MASTERED'
      && bar[3].face === '🦅' && bar[3].max, bar[3]);

  // ---- 5) affix pin renders + buff text matches the table ----
  const affix = await page.evaluate(() => {
    const out = {};
    for (const a of WORLD_AFFIXES) {
      if (a.id === 'none') continue;
      game._mapAffix = a;
      _renderAffixPin();
      const el = document.getElementById('world-affix-pin');
      out[a.id] = { disp: el.style.display, txt: el.textContent.trim(),
                    accent: el.style.getPropertyValue('--afx'), buff: _affixBuffText(a) };
    }
    game._mapAffix = WORLD_AFFIXES[0];
    _renderAffixPin();
    out._noneHidden = document.getElementById('world-affix-pin').style.display === 'none';
    return out;
  });
  ok('affix pin renders for all 5 real affixes', Object.keys(affix).filter(k => k[0] !== '_').length === 5);
  ok('pin hides when the map has no affix', affix._noneHidden);
  ok('Gilded pin shows its accent + buff text', affix.gilded.disp === 'flex'
      && affix.gilded.buff === '+60% coin' && affix.gilded.accent.trim() === '#ffd870', affix.gilded);
  ok('Teeming buff text lists all three riders',
      affix.teeming.buff === '+15% EXP · +25% drop · +14% elite', affix.teeming.buff);

  // ---- 6) affix multipliers are live and feed the reward chain ----
  const mul = await page.evaluate(() => {
    const g = WORLD_AFFIXES.find(a => a.id === 'gilded');
    game._mapAffix = g;
    const r = { coin: _affixCoinMul(), exp: _affixExpMul(), drop: _affixDropMul() };
    game._mapAffix = WORLD_AFFIXES[0];
    const base = { coin: _affixCoinMul(), exp: _affixExpMul(), drop: _affixDropMul() };
    return { gilded: r, none: base };
  });
  ok('Gilded returns 1.6x coin, 1x elsewhere', mul.gilded.coin === 1.6 && mul.gilded.exp === 1 && mul.gilded.drop === 1, mul.gilded);
  ok('no affix is a clean 1x on every lever',
      mul.none.coin === 1 && mul.none.exp === 1 && mul.none.drop === 1, mul.none);

  // ---- 7) seeded RNG in situ, including rehydration after a save round-trip ----
  const seed = await page.evaluate(() => {
    const code = _setExpeditionSeed('BANANA');
    const s = game._nextExpeditionSeed;
    // simulate a run
    game.expedition = { active: true, seed: s, _draws: 0 };
    const first = [_expRand(), _expRand(), _expRand()];
    // simulate save -> reload: the function cannot be serialised
    const revived = JSON.parse(JSON.stringify(game.expedition));
    game.expedition = revived;
    const afterReload = [_expRand(), _expRand()];
    // replay from scratch to compare
    game.expedition = { active: true, seed: s, _draws: 0 };
    const replay = [_expRand(), _expRand(), _expRand(), _expRand(), _expRand()];
    const outsideRun = (game.expedition = null, typeof _expRand() === 'number');
    return { code, s, first, afterReload, replay, outsideRun,
             roundtrip: _lxCodeToSeed(_lxSeedToCode(s)) === s };
  });
  ok('_setExpeditionSeed returns a shareable code', /^[23456789A-HJ-NP-Z]{6}$/.test(seed.code), seed.code);
  ok('seed code round-trips at runtime', seed.roundtrip, { seed: seed.s, code: seed.code });
  ok('draws resume identically after a save/reload round-trip',
      JSON.stringify(seed.afterReload) === JSON.stringify(seed.replay.slice(3, 5)),
      { afterReload: seed.afterReload, expected: seed.replay.slice(3, 5) });
  ok('first 3 draws match a fresh replay of the same seed',
      JSON.stringify(seed.first) === JSON.stringify(seed.replay.slice(0, 3)));
  ok('_expRand falls back to Math.random outside a run', seed.outsideRun);

  // ---- 8) dust ping writes a damage number without throwing ----
  const dust = await page.evaluate(() => {
    game.damageNumbers = game.damageNumbers || [];
    const before = game.damageNumbers.length;
    _lxDustPing({ x: 200, y: 300, w: 32 });
    const added = game.damageNumbers[game.damageNumbers.length - 1];
    _lxDustPing(null);            // must not throw
    return { grew: game.damageNumbers.length === before + 1, added };
  });
  ok('dust ping pushes a +1 mote and tolerates a null mob',
      dust.grew && dust.added && dust.added.text === '+1◈', dust.added);

  // ---- 9) affix picker runs against the REAL MAPS table ----
  const real = await page.evaluate(() => {
    const ids = Object.keys(MAPS).slice(0, 140);
    const counts = {}; let threw = null;
    for (const id of ids) {
      for (let d = 0; d < 12; d++) {
        try { const a = _worldAffixFor(id, d); counts[a.id] = (counts[a.id] || 0) + 1; }
        catch (e) { threw = id + ': ' + e.message; break; }
      }
    }
    return { counts, threw, mapCount: ids.length,
             townClean: _worldAffixFor('town', 5).id === 'none' };
  });
  ok('affix picker survives every real map id', real.threw === null, real.threw);
  ok('produces a spread of affixes over the real map table',
      Object.keys(real.counts).length >= 5, real.counts);
  ok('town stays unaffixed against the real MAPS table', real.townClean);

  // ---- 10) nothing broke during all of that ----
  await page.waitForTimeout(600);
  ok('no uncaught errors after exercising every path', pageErrors.length === 0, pageErrors.slice(0, 4));
  const realConsoleErrors = consoleErrors.filter(e =>
    !/favicon|net::ERR|Failed to load resource|404/i.test(e));
  ok('no console errors (asset 404s ignored)', realConsoleErrors.length === 0, realConsoleErrors.slice(0, 4));

  await page.screenshot({ path: process.env.LX_SHOT || 'lx_smoke.png' });
} finally {
  await browser.close();
}

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x !== undefined ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} runtime checks passed`);
process.exit(fail ? 1 : 0);
