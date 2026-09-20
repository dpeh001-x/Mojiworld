// THE FORGE AND THE EXPEDITION KEEP THEIR CONTRACTS (2026-09-20 hunt). Nothing here was broken when it was
// written — it is the characterisation the next refactor gets to break loudly instead of quietly. Both systems
// move Mojicoins, Setshards and gear, and both have had silent-loss bugs before (v0.26.221 reordered the reforge
// so a throw could not hand out a free one; v0.30.931 stopped a tower run refunding the potions it bought).
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/forge_economy_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11333';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
const env = { ...process.env, MOJI_GAME_FILE: PAGE };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1800));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof attemptEnhance === 'function' && typeof _startExpedition === 'function', null, { timeout: 180000 });
  await page.evaluate(async () => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player.level = 60; player._tutorialSeen = true; player._god = true;
    loadMap('forest', 300); await new Promise((r) => setTimeout(r, 1000));
    window.__mk = () => ({ name: 'Probe Blade', baseName: 'Probe Blade', slot: 'weapon', rarity: 'rare', atk: 50, dropLevel: 50, stars: 0 });
    window.__roll = (v) => { const r = Math.random; Math.random = () => v; return () => { Math.random = r; }; };
  });
  // 1. one attempt, one charge - whichever way the roll lands
  const charge = await page.evaluate(() => {
    const cost = STAR_COSTS[0];
    const run = (roll) => { const it = __mk(); player.mojicoins = 1e7; const u = __roll(roll); const c0 = player.mojicoins;
      attemptEnhance(it); u(); return { charged: c0 - player.mojicoins, stars: it.stars, pity: it._pity | 0 }; };
    return { cost, win: run(0), lose: run(0.999) };
  });
  check(charge.win.charged === charge.cost && charge.lose.charged === charge.cost,
    'an enhance attempt charges its rung exactly once, win or lose', J(charge));
  check(charge.win.stars === 1 && charge.lose.stars === 0,
    'a failed attempt at the first rung grants no star and loses none', J(charge));
  check(charge.win.pity === 0 && charge.lose.pity === 1,
    'pity accrues on the failure and resets on the win', J(charge));
  // 2. the two refusals take nothing
  const refuse = await page.evaluate(() => {
    const capIt = __mk(); capIt.stars = MAX_STARS; player.mojicoins = 1e7;
    const c0 = player.mojicoins; attemptEnhance(capIt);
    const atCap = { charged: c0 - player.mojicoins, stars: capIt.stars };
    const poor = __mk(); player.mojicoins = STAR_COSTS[0] - 1;
    const c1 = player.mojicoins; attemptEnhance(poor);
    return { cap: MAX_STARS, atCap, broke: { charged: c1 - player.mojicoins, stars: poor.stars } };
  });
  check(refuse.atCap.charged === 0 && refuse.atCap.stars === refuse.cap && refuse.broke.charged === 0 && refuse.broke.stars === 0,
    'a capped item and an empty wallet are refused without a charge', J(refuse));
  // 3. a star on WORN gear reaches the stat sheet the same frame
  const worn = await page.evaluate(() => {
    const it = __mk(); player.equipped = player.equipped || {}; player.equipped.weapon = it;
    player.mojicoins = 1e7; if (typeof refreshGearCache === 'function') refreshGearCache();
    const before = getAtk(); const u = __roll(0); attemptEnhance(it); u();
    const after = getAtk(); delete player.equipped.weapon;
    if (typeof refreshGearCache === 'function') refreshGearCache();
    return { before, after, stars: it.stars };
  });
  check(worn.stars === 1 && worn.after > worn.before, 'enhancing worn gear moves ATK at once', J(worn));
  // 4. the expedition gives back exactly what it took
  const run = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    player.level = Math.max(player.level, (typeof EXPEDITION_LEVEL_GATE === 'number' ? EXPEDITION_LEVEL_GATE : 30));
    player.consumables = { hp_l: 7, mp_l: 4 };
    player.inventory = [{ name: 'Heirloom', slot: 'weapon', rarity: 'rare', atk: 9, dropLevel: 50 }];
    player.mojicoins = 50000; player.setshards = 100;
    const before = { cons: JSON.stringify(player.consumables), inv: player.inventory.length, coins: player.mojicoins, shards: player.setshards };
    if (!_startExpedition()) return { err: 'run refused' };
    await sleep(1200);
    const active = !!(game.expedition && game.expedition.active);
    player.inventory.push({ name: 'Run Loot', slot: 'weapon', rarity: 'epic', atk: 99, dropLevel: 50 });
    player.consumables.hp_l = (player.consumables.hp_l | 0) + 2;
    player.setshards += 25;
    _endExpedition('test');
    await sleep(1400);
    const after = { cons: JSON.stringify(player.consumables), inv: player.inventory.length, coins: player.mojicoins,
      shards: player.setshards, active: !!(game.expedition && game.expedition.active) };
    return { before, active, after };
  });
  check(!run.err && run.active === true && run.after.active === false, 'a run starts and ends', J({ a: run.active, b: run.after && run.after.active }));
  check(!run.err && run.after.cons === run.before.cons && run.after.inv === run.before.inv,
    'the run hands back exactly the bag it took', J(run && { before: run.before, after: run.after }));
  check(!run.err && run.after.shards === run.before.shards + 25,
    'Setshards earned in the run are kept', J(run && { was: run.before.shards, now: run.after.shards }));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 3)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
