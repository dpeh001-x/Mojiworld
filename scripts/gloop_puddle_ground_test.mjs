// King Gloopaloo's Brimming Leak lands on platforms, in a real fight.
//
// Watches game.hazards during an actual encounter and checks every gloop_puddle
// against the map's platform list. Asserts BOTH that none float AND that a
// healthy number still spawn — a "fix" that simply stopped the drip would pass
// the first check on its own, and this mechanic is the boss's identity.
// Run: node scripts/gloop_puddle_ground_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = 'file:///' + path.join(ROOT, process.argv[2] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof MAPS !== 'undefined' && typeof loadMap === 'function', { timeout: 60000 });
await page.evaluate(() => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  game.paused = false;
  player.level = 40; player._god = true;          // survive long enough to observe
});
await page.evaluate(() => { try { loadMap('slimeCave'); } catch (_e) {} });
await page.waitForTimeout(6000);

await page.evaluate(() => {
  window.__seen = new Set();
  window.__log = [];
  const support = (x, feet) => {
    const plats = (game.mapData && game.mapData.platforms) || [];
    let best = Infinity;
    for (const pl of plats) {
      if (!pl || x < pl.x || x > pl.x + pl.w) continue;
      if (pl.y >= feet - 6 && pl.y < best) best = pl.y;
    }
    return best === Infinity ? null : best;
  };
  window.__watch = setInterval(() => {
    for (const h of (game.hazards || [])) {
      if (h.type !== 'gloop_puddle' || window.__seen.has(h)) continue;
      window.__seen.add(h);
      const king = (game.monsters || []).find((m) => m && m.type === 'king' && !m.dead);
      const sup = support(h.cx, h.cy + 4);
      window.__log.push({
        cx: Math.round(h.cx), cy: Math.round(h.cy),
        supportY: sup === null ? null : Math.round(sup),
        gap: sup === null ? null : Math.round(sup - h.cy),
        kingSole: king ? Math.round(king.y + king.h) : null,
        kingOnGround: king ? !!king.onGround : null,
      });
    }
  }, 60);
  const king = (game.monsters || []).find((m) => m && m.type === 'king');
  if (king) { king.x = 700; king.aggro = true; }
  player.x = 760;
});
await page.waitForTimeout(22000);

const r = await page.evaluate(() => {
  clearInterval(window.__watch);
  const log = window.__log;
  const unsupported = log.filter((e) => e.supportY === null);
  const airborne = log.filter((e) => e.supportY !== null && Math.abs(e.gap) > 24);
  // did the boss actually hover during the run? if it never did, this run did
  // not exercise the bug and a green result would mean nothing
  const hovered = log.filter((e) => e.kingSole !== null && e.supportY !== null && (e.supportY - e.kingSole) > 40);
  return {
    total: log.length,
    unsupported: unsupported.length,
    airborne: airborne.length,
    hoverSamples: hovered.length,
    worstGap: log.reduce((a, e) => (e.gap == null ? a : Math.max(a, Math.abs(e.gap))), 0),
    sample: log.slice(0, 4),
    badSample: [...unsupported, ...airborne].slice(0, 5),
  };
});
await browser.close();

console.log(`puddles ${r.total} | unsupported ${r.unsupported} | airborne ${r.airborne} | worst gap ${r.worstGap}px | spawned while boss hovered: ${r.hoverSamples}`);
check(r.total >= 8, 'the leak still spawns puddles (the mechanic is intact)', r.total);
check(r.unsupported === 0, 'no puddle spawns where no platform supports it', r.badSample);
check(r.airborne === 0, 'no puddle hangs in the air above its platform', r.badSample);
check(r.worstGap <= 24, 'every puddle sits on its surface', r.worstGap);
check(errs.length === 0, 'no page errors', errs);
if (!r.hoverSamples) console.log('  NOTE: the boss never hovered this run — the regression path was not exercised');
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
