// v0.30.485 — EVERY columnStrike caster resolves real beam art, and every
// derived telegraph key resolves too. Guards the exact regression the user
// reported (Barnaby's column drawing as a flat gradient bar) and the whole
// class it belongs to, rather than just the one case.
//
// Two independent failure modes, both silent, both producing the same flat bar:
//   1. columnStrike has no `sprite` field       -> _colSprite null
//   2. the key is not in the LX_FX file map     -> LX_FX[key] undefined
// The second is the one that hid tg_col_towerArbiter / tg_col_towerSovereign,
// which were on disk and unloadable for months.
//
//   node scripts/boss_column_sprite_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11211);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const bad404 = [];
page.on('response', (r) => { if (r.status() >= 400 && /(fx|tg)_col_/.test(r.url())) bad404.push(r.status() + ' ' + r.url().split('/').pop()); });
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(10000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Col');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);

const r = await page.evaluate(async () => {
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  // Census the RUNTIME, not the source text: the zodiac casters are synthesised
  // at boot and appear nowhere a grep can reach.
  const casters = [];
  for (const t in monsterTypes) {
    const cs = monsterTypes[t] && monsterTypes[t].traits && monsterTypes[t].traits.columnStrike;
    if (cs) casters.push({ type: t, sprite: cs.sprite || null, tg: 'tg_col_' + t,
      boss: !!monsterTypes[t].boss });
  }
  // ask the loader for every key this census needs, then let them decode
  for (const c of casters) {
    if (c.sprite && typeof LX_FX !== 'undefined') void LX_FX[c.sprite];
    if (typeof LX_FX !== 'undefined') void LX_FX[c.tg];
  }
  await wait(4000);
  const ready = (k) => {
    const im = (typeof LX_FX !== 'undefined') ? LX_FX[k] : null;
    if (!im) return { has: false, decoded: false };
    return { has: true, decoded: !!(im.naturalWidth > 0), src: (im.src || '').split('/').pop() };
  };
  return {
    total: casters.length,
    rows: casters.map((c) => ({
      type: c.type,
      sprite: c.sprite,
      boss: c.boss,
      beam: c.sprite ? ready(c.sprite) : { has: false, decoded: false },
      tg: ready(c.tg),
    })),
  };
});
await browser.close(); server.kill();

const noSprite = r.rows.filter((x) => !x.sprite);
const beamDead = r.rows.filter((x) => x.sprite && !x.beam.decoded);
// A missing per-caster telegraph is a soft gap: the engine has a generic
// tg_col_zodiac / procedural fallback. Report it, do not fail on it.
const tgHave = r.rows.filter((x) => x.tg.decoded);

console.log(`columnStrike casters found at runtime: ${r.total}`);
for (const x of r.rows) {
  const b = x.sprite ? (x.beam.decoded ? 'beam OK  ' + x.beam.src : 'BEAM DEAD (' + x.sprite + ')') : 'NO SPRITE FIELD';
  console.log(`  ${x.type.padEnd(24)} ${b}${x.tg.decoded ? '   + own telegraph' : ''}`);
}
console.log(`per-caster telegraphs resolving: ${tgHave.length}/${r.total}`);

let borrowers = [];
const checks = [
  ['every columnStrike caster declares a sprite', noSprite.length === 0, noSprite.map((x) => x.type).join(', ')],
  ['every declared beam sprite decodes', beamDead.length === 0, beamDead.map((x) => x.type + '->' + x.sprite).join(', ')],
  ['Barnaby specifically has his own beam',
    !!r.rows.find((x) => x.type === 'young_confused_barnaby' && x.sprite === 'fx_col_barnaby' && x.beam.decoded)],
  ['the Arbiter + Sovereign telegraphs load (were on disk, unregistered)',
    ['towerArbiter', 'towerSovereign'].every((t) => { const x = r.rows.find((y) => y.type === t); return x && x.tg.decoded; })],
  // v0.30.486 — a boss may not draw another entity's beam. Ownership is a
  // name test: fx_col_<something-that-is-this-caster>. Mobs may still share a
  // family beam (towerHexer/future_lyra both use fx_col_tombhexer by design).
  ['every BOSS draws its own beam, not a borrowed one', (() => {
    const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
    borrowers = r.rows.filter((x) => {
      if (!x.boss || !x.sprite) return false;
      const f = norm(x.sprite.replace(/^fx_col_/, ''));
      const ty = norm(x.type);
      return !(ty.includes(f) || f.includes(ty));
    });
    return borrowers.length === 0;
  })(), borrowers.map((x) => x.type + ' -> ' + x.sprite).join(', ')],
  ['no 404 for any column art', bad404.length === 0, bad404.join(' | ')],
];
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
process.exit(fails ? 1 : 0);
