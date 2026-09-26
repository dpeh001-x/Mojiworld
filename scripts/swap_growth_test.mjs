// The pre-advancement class swap keeps what your levels earned (v0.30.x swap-growth).
//   node scripts/swap_growth_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// Bug hunt: the Amnesiac's swap kept the level but reset HP/MP/ATK/DEF to the new class's Lv-1 base (a Lv-19 Rogue on
// Lv-1 stats). Now the swap re-grants the levels' growth, and a save already hurt by it heals on load (jobless only).
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '10969';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const errs = [];
const boot = async (ctx, fresh) => {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: 'font/woff2', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
  });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof applyClass === 'function' && typeof _openPreAdvanceClassSwap === 'function', null, { timeout: 150000 });
  if (fresh) await p.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true });
    loadMap('town'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
  });
  return p;
};
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const p = await boot(ctx, true);
  // 1) the swap itself: a Lv-19 Warrior becomes a Rogue, against a Rogue that levelled natively to 19
  const A = await p.evaluate(async () => {
    const pick = (o) => ({ lv: player.level, maxHp: o.maxHp, maxMp: o.maxMp, baseAtk: o.baseAtk, baseDef: o.baseDef });
    const grow = (cls) => {
      applyClass(cls); player.job = null; player.master = null;
      player.level = 1; player.exp = 0; player.expToNext = _lxLevelCost(1); player._levelUpSpent = {};
      let need = 0; for (let L = 1; L < 19; L++) need += _lxLevelCost(L);
      player.exp = need; _maybeLevelUp();
      return pick(player);
    };
    const native = grow('rogue');
    const warrior = grow('warrior');
    _openPreAdvanceClassSwap();
    return { native, warrior };
  });
  await p.waitForTimeout(500);
  await p.click('#confirm-yes'); await p.waitForTimeout(800);
  const B = await p.evaluate(() => ({ cls: player.cls, lv: player.level, maxHp: player.maxHp, maxMp: player.maxMp, baseAtk: player.baseAtk, baseDef: player.baseDef, hp: player.hp, full: getMaxHp() }));
  console.log('swap', JSON.stringify({ A, B }));
  check(B.cls === 'rogue' && B.lv === 19 && B.maxHp === A.native.maxHp && B.maxMp === A.native.maxMp && B.baseAtk === A.native.baseAtk && B.baseDef === A.native.baseDef,
    'a Lv-19 Warrior swapped to Rogue has a native Lv-19 Rogue\'s HP / MP / ATK / DEF (not Lv-1 stats)', { swapped: B, native: A.native });
  check(B.hp === B.full, 'and is refilled to that max', [B.hp, B.full]);

  // 2) a save the old swap already hurt heals on load; a healthy one and a job-holder are left alone
  const saveWith = async (patch) => {
    await p.evaluate((pt) => { Object.assign(player, pt); saveState(); if (typeof _flushSaveStateNow === 'function') _flushSaveStateNow(); }, patch);
    await p.waitForTimeout(400);
    const q = await boot(ctx, false);
    await q.waitForFunction(() => typeof player === 'object' && player && player.cls, null, { timeout: 60000 });
    await q.evaluate(async () => { const b = document.getElementById('menu-continue'); if (b && b.offsetParent) b.click(); await new Promise((s) => setTimeout(s, 3000)); });
    const r = await q.evaluate(() => ({ lv: player.level, job: player.job, maxHp: player.maxHp, maxMp: player.maxMp, baseAtk: player.baseAtk, baseDef: player.baseDef, toast: [...document.querySelectorAll('.toast, [class*=toast]')].map((t) => t.textContent).join(' | ').slice(0, 300) }));
    await q.close();
    return r;
  };
  const hurt = await saveWith({ cls: 'rogue', level: 19, job: null, master: null, maxHp: 100, maxMp: 50, baseAtk: 15, baseDef: 3 });
  const floor = await p.evaluate(() => { const c = CLASSES.rogue.stats, g = _devLevelGains('rogue'); return { maxHp: c.hp + 18 * g.hp, maxMp: c.mp + 18 * g.mp, baseAtk: c.atk + 18 * g.atk, baseDef: c.def + 18 * g.def }; });
  console.log('hurt save', JSON.stringify({ hurt, floor }));
  check(hurt.maxHp === floor.maxHp && hurt.maxMp === floor.maxMp && hurt.baseAtk === floor.baseAtk && hurt.baseDef === floor.baseDef, 'a jobless Lv-19 save stuck on Lv-1 stats is lifted to its level\'s floor on load', { hurt, floor });
  const healthy = await saveWith({ cls: 'rogue', level: 19, job: null, master: null, maxHp: floor.maxHp + 40, maxMp: floor.maxMp, baseAtk: floor.baseAtk + 5, baseDef: floor.baseDef });
  check(healthy.maxHp === floor.maxHp + 40 && healthy.baseAtk === floor.baseAtk + 5, 'a healthy save (stats invested on top) is left exactly as it was', { healthy, floor });
  const jobbed = await saveWith({ cls: 'rogue', level: 19, job: 'ninja', master: null, maxHp: 100, maxMp: 50, baseAtk: 15, baseDef: 3 });
  check(jobbed.maxHp === 100 && jobbed.baseDef === 3, 'a save holding a job is not touched by the floor (jobs can carry negative stats)', jobbed);
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await ctx.close();
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
process.exit(bad ? 1 : 0);
