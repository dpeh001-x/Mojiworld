// v0.29.462 â€” per user: "when entering a portal that has monsters more than 10
// levels above player put a more prominent red distinct warning that the level
// of the monsters are higher than player".
//
// Drives the REAL tryPortal against REAL maps, not a synthetic fixture.
//
//   node serve.js 8827 && node scripts/portal_danger_warning_test.mjs 8827 [page]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const PORT = process.argv[2] || '8827';
const PAGE = process.argv[3] || 'mojiworld_game.html';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block' })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => { try { return typeof eval('tryPortal') === 'function' && typeof eval('_lxDestMobLevel') === 'function' && !!eval('MAPS'); } catch { return false; } }, null, { timeout: 180000 });

// --- the level predictor, against real maps ---------------------------------
const pred = await page.evaluate(() => {
  const MP = eval('MAPS'), NAT = eval('MOB_NATURAL_LEVEL');   // not MAPS — TDZ shadowing
  const f = eval('_lxDestMobLevel');
  const out = { samples: [], usesSpawns: false, usesLevelReq: false, unknownIsZero: f({}) };
  for (const id of Object.keys(MP)) {
    const m = MP[id];
    if (!m) continue;
    const v = f(m);
    const spawnMax = Math.max(0, ...(Array.isArray(m.spawns) ? m.spawns.map(s => (s && NAT[s.type]) || 0) : [0]));
    if (spawnMax > 0 && v === spawnMax) out.usesSpawns = true;
    if (spawnMax === 0 && (m.levelReq | 0) > 0 && v === (m.levelReq | 0)) out.usesLevelReq = true;
    if (out.samples.length < 4 && v > 0) out.samples.push({ id, predicted: v, spawnMax, levelReq: m.levelReq | 0 });
  }
  return out;
});
ok('predictor prefers the highest natural level among the map spawns', pred.usesSpawns === true, pred.samples);
ok('predictor falls back to the map recommended level when spawns are unknown', pred.usesLevelReq === true);
ok('an empty/unknown destination predicts 0 (never warns spuriously)', pred.unknownIsZero === 0);

// --- fires on a genuinely overlevelled portal --------------------------------
const fired = await page.evaluate(() => {
  const g = eval('game'), p = eval('player'), MP = eval('MAPS');   // not MAPS — TDZ shadowing
  const f = eval('_lxDestMobLevel');
  p.cls = 'warrior'; p.level = 5; p.hp = 100; p.maxHp = 100;
  g._lxDangerWarned = {};
  g._bossWarned = {};
  // Pick the steepest REAL ungated non-boss jump anywhere in the portal graph.
  // An earlier cut searched only town, whose portals at this point are three
  // Lv 1-4 destinations — it found nothing and the test blew up on undefined
  // rather than reporting "no target".
  let src = null, target = null, bestLv = 0;
  for (const id of Object.keys(MP)) {
    const m = MP[id];
    for (const po of (m && m.portals) || []) {
      const d = MP[po.dest];
      if (!d || d.isBossArena || po.levelGate) continue;
      const lv = f(d);
      if (lv > bestLv) { bestLv = lv; src = id; target = po; }
    }
  }
  if (!target) return { noTarget: true, text: '' };

  const town = MP[src];
  g.currentMap = src;
  g.mapData = town; g.portals = town.portals;
  const py = (typeof eval('_defaultPortalY') === 'function') ? eval('_defaultPortalY')() : 448;
  p.x = target.x - p.w / 2; p.y = py - p.h;
  const before = performance.now();
  eval('tryPortal')();
  const el = document.getElementById('lx-danger-banner');
  const cs = el ? getComputedStyle(el) : null;
  const out = {
    dest: target.dest, destLv: bestLv, playerLv: p.level,
    shown: !!el && el.style.display !== 'none',
    text: el ? el.textContent : '',
    z: cs ? +cs.zIndex : 0,
    borderColor: cs ? cs.borderTopColor : '',
    pointerEvents: cs ? cs.pointerEvents : '',
    insideModal: !!(el && el.closest('.modal-overlay')),
    warnedOnce: !!(g._lxDangerWarned && g._lxDangerWarned[target.dest]),
  };
  // second crossing must NOT re-fire (the v0.25.444 spam regression)
  if (el) el.style.display = 'none';
  eval('tryPortal')();
  out.reFired = !!el && el.style.display !== 'none';
  return out;
});
ok('found a real overlevelled portal to test', !fired.noTarget, { dest: fired.dest, destLv: fired.destLv });
ok('the warning appears on entry', fired.shown === true, { dest: fired.dest });
ok('it names the destination and BOTH levels', /DANGER/.test(fired.text) && new RegExp('Lv ' + fired.destLv).test(fired.text) && new RegExp('You are Lv ' + fired.playerLv).test(fired.text), fired.text.slice(0, 130));
ok('it states the gap in levels', /levels below them/.test(fired.text), fired.text.slice(0, 130));
ok('it is RED (distinct from the gold boss toast)', /rgb\(255,\s*77,\s*77\)/.test(fired.borderColor), { border: fired.borderColor });
ok('it is prominent â€” above the HUD', fired.z >= 10000, { z: fired.z });
ok('it never eats clicks (pointer-events none)', fired.pointerEvents === 'none', { pe: fired.pointerEvents });
ok('it is NOT inside a modal (visible wherever the player is)', fired.insideModal === false);
ok('it says entry is still allowed (non-blocking)', /still enter/.test(fired.text));
ok('it does not re-fire on the next crossing (no v0.25.444 spam)', fired.reFired === false);

// --- stays quiet where it should --------------------------------------------
const quiet = await page.evaluate(() => {
  const g = eval('game'), p = eval('player'), MP = eval('MAPS');   // not MAPS — TDZ shadowing
  const f = eval('_lxDestMobLevel');
  const el = document.getElementById('lx-danger-banner');
  // Same steepest-jump search as above, so all three cases use one real portal
  // and differ ONLY by the player's level — the variable actually under test.
  let src = null, po = null, bestLv = 0;
  for (const id of Object.keys(MP)) {
    const m = MP[id];
    for (const q of (m && m.portals) || []) {
      const d = MP[q.dest];
      if (!d || d.isBossArena || q.levelGate) continue;
      const lv = f(d);
      if (lv > bestLv) { bestLv = lv; src = id; po = q; }
    }
  }
  if (!po) return { noTarget: true };
  const run = (playerLv) => {
    g._lxDangerWarned = {}; g._bossWarned = {};
    if (el) el.style.display = 'none';
    p.level = playerLv;
    const m = MP[src];
    g.currentMap = src; g.mapData = m; g.portals = m.portals;
    const py = (typeof eval('_defaultPortalY') === 'function') ? eval('_defaultPortalY')() : 448;
    p.x = po.x - p.w / 2; p.y = py - p.h;
    eval('tryPortal')();
    return { dest: po.dest, destLv: bestLv, playerLv, shown: !!el && el.style.display !== 'none' };
  };
  return {
    highLv:   run(bestLv + 5),        // above the zone -> silent
    boundary: run(bestLv - 10),       // gap EXACTLY 10 -> silent (">10", not ">=")
    over:     run(bestLv - 11),       // gap 11 -> the first level that warns
    bLv: bestLv,
  };
});
ok('silent for a player at/above the zone level', quiet.highLv && quiet.highLv.shown === false, quiet.highLv);
ok('silent at EXACTLY a 10-level gap (threshold is >10, not >=)', quiet.boundary && quiet.boundary.shown === false, quiet.boundary);
ok('fires at an 11-level gap (the first level that qualifies)', quiet.over && quiet.over.shown === true, quiet.over);

ok('no page errors', errs.length === 0, errs.slice(0, 3));

await b.close();
let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);


