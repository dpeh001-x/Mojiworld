// ANTI-CHEAT LAYER 2 - boxed containers, item / boon ceilings, two more counters (_lxAc). A save full of HONEST top-end
// gear is made on localhost (vault off): a top-tier legendary at 10 stars rolled at Lv 95, a god weapon, a transcended
// piece, a Lv 200 god roll, three boons, potions, ranks, an achievement. It is loaded on a public host by a real click.
//   [1] nothing honest is touched: after the load, three sweeps and a gear rebuild, every item and boon is unchanged, the
//       log is empty
//   [2] console edits to potions, ranks, achievements, the kill counter, and a whole container swap are refused
//   [3] an item's ATK typed to 10 million goes back under its ceiling, and the hero's ATK with it
//   [4] stars typed to 99 go back to 10; [5] a boon's roll typed to a million goes back to its range
//   [6] real fighting still counts kills and mastery, with nothing logged; [7] no page errors
//   node scripts/anticheat_boxes_test.mjs        PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11877), FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 600) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, channel: EXE ? undefined : 'msedge', headless: true,
  args: ['--mute-audio', '--host-resolver-rules=MAP play.mojiworld.test 127.0.0.1'] });
const errs = [];
const boot = async (host, init) => {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, serviceWorkers: 'block' });
  await ctx.addInitScript(init || (() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} }));
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(host + ': ' + String(e.message).slice(0, 140)));
  await page.goto(`http://${host}:${PORT}/${FILE}?lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof _lxAc === 'object' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  return { ctx, page };
};
const snap = () => JSON.stringify({ eq: player.equipped, inv: player.inventory, boons: player.boons }, (k, v) => (/^_eq/.test(k) ? undefined : v));   // _eqSid*: the sprite id the game caches on an item
try {
  const L = await boot('localhost');
  const made = await L.page.evaluate(async () => {
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootGateDone = true; } catch (e) {} window._prologueActive = false;
    applyClass('warrior'); player.level = 60; player._tutorialSeen = true;
    const top = (cat) => ITEM_POOL[cat].filter((x) => x.tier != null).sort((a, b) => b.tier - a.tier || (b.atk || b.def || b.hp || 0) - (a.atk || a.def || a.hp || 0))[0];
    const w = rollAffixedItem(top('weapons'), 'legendary', 95); w.slot = 'weapon'; w.stars = 10;
    const a = rollAffixedItem(top('armors'), 'god', 200); a.slot = 'armor';
    const acc = rollAffixedItem(top('accessories'), 'legendary', 95); acc.slot = 'accessory';
    for (const k in acc) if (typeof acc[k] === 'number' && !['price', 'tier', 'rarity', 'stars', 'dropLevel'].includes(k)) acc[k] = acc[k] * 1.079;   // as transcendItem does
    acc.transcended = true;
    const god = _lxMakeGodWeapon();
    player.equipped = { weapon: w, armor: a, accessory: acc };
    player.inventory = [god].filter(Boolean);
    player.boons = POWERUPS.slice(0, 3).map((p) => rollBoonInstance(p.id)).filter(Boolean);
    player.consumables = { hp_s: 10, mp_s: 5 };
    game.achievements = Object.assign({}, game.achievements || {}, { firstKill: Date.now() });
    refreshGearCache();
    _flushSaveStateNow();
    return { save: localStorage.getItem(SAVE_KEY), mark: localStorage.getItem(SAVE_KEY + '_verified'), atk: getAtk(), wAtk: w.atk };
  });
  const P = await boot('play.mojiworld.test', `(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1');
    localStorage.setItem('levelx_save_v1', ${JSON.stringify(made.save)}); localStorage.setItem('levelx_save_v1_verified', ${JSON.stringify(made.mark)}); } catch (e) {} })();`);
  const page = P.page;
  await page.click('#menu-continue', { timeout: 30000 });
  await page.waitForFunction(() => player.level === 60 && game.mapData, null, { timeout: 120000 });
  await page.waitForTimeout(1500);
  const s0 = await page.evaluate(snap);
  await page.waitForTimeout(9500);
  const honest = await page.evaluate((s0) => { refreshGearCache(); const atk = getAtk(); const s1 = JSON.stringify({ eq: player.equipped, inv: player.inventory, boons: player.boons }, (k, v) => (/^_eq/.test(k) ? undefined : v));
    return { same: s1 === s0, log: _lxAcReport(), atk, nInv: player.inventory.length, nBoons: player.boons.length }; }, s0);
  ok('[1] honest top-end gear, a god weapon, a transcended piece and boons are untouched (load + 3 sweeps + a rebuild)', honest.same && honest.log.length === 0 && honest.nBoons === 3, honest);
  const box = await page.evaluate(() => {
    const before = JSON.stringify({ c: player.consumables, r: player.skillRanks, a: game.achievements, k: game.kills });
    player.consumables.hp_s = 999; delete player.consumables.mp_s; player.skillRanks.cheat = 9;
    game.achievements.fakeOne = Date.now(); game.kills = 1e6; player.consumables = { hp_l: 999 };
    const after = JSON.stringify({ c: player.consumables, r: player.skillRanks, a: game.achievements, k: game.kills });
    return { same: before === after, log: _lxAcReport().length, after };
  });
  ok('[2] console edits to potions, ranks, achievements, kills and a container swap are refused', box.same && box.log === 6, box);
  const atkEdit = await page.evaluate(async (base) => {
    const w = player.equipped.weapon; const was = w.atk; w.atk = 1e7;
    await new Promise((r) => setTimeout(r, 3600));
    refreshGearCache();
    return { was, now: w.atk, heroAtk: getAtk(), base, log: _lxAcReport().filter((e) => e.kind === 'item').length };
  }, honest.atk);
  ok('[3] an item ATK typed to 10 million goes back to the item own best roll, and the hero ATK with it', atkEdit.now >= atkEdit.was && atkEdit.now <= atkEdit.was * 1.25 && atkEdit.heroAtk <= atkEdit.base * 1.15 && atkEdit.log >= 1, atkEdit);
  const stars = await page.evaluate(async () => { const a = player.equipped.armor; a.stars = 99; await new Promise((r) => setTimeout(r, 3600)); return { now: a.stars }; });
  ok('[4] stars typed to 99 go back to 10', stars.now === 10, stars);
  const boon = await page.evaluate(async () => { const b = player.boons[0]; const def = POWERUPS.find((p) => p.id === b.id); b.roll = 1e6; await new Promise((r) => setTimeout(r, 3600)); return { now: b.roll, max: def.max, min: def.min }; });
  ok('[5] a boon roll typed to a million goes back to its range', boon.now === Math.max(boon.min || 0, boon.max), boon);
  const n0 = await page.evaluate(() => { player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS || {})) player._storyBeatsSeen[k] = true; loadMap('forest', 200); return _lxAcReport().length; });
  await page.waitForTimeout(2500);
  const k0 = await page.evaluate(() => ({ kills: game.kills || 0, mast: JSON.stringify(player.mastery || {}) }));
  for (let i = 0; i < 14; i++) { await page.keyboard.down(i % 2 ? 'ArrowLeft' : 'ArrowRight'); for (let k = 0; k < 8; k++) { await page.keyboard.press('z'); await page.waitForTimeout(110); } await page.keyboard.up(i % 2 ? 'ArrowLeft' : 'ArrowRight'); }
  await page.waitForTimeout(1500);
  const k1 = await page.evaluate(() => ({ kills: game.kills || 0, mast: JSON.stringify(player.mastery || {}), log: _lxAcReport().length }));
  ok('[6] real fighting still counts kills and mastery, with nothing logged', k1.kills > k0.kills && k1.mast !== k0.mast && k1.log === n0, { k0, k1, n0 });
  ok('[7] no page errors', !errs.length, errs.slice(0, 3));
} catch (e) { ok('the run completes', false, String(e && e.message || e).slice(0, 300)); }
finally { server.kill(); await browser.close().catch(() => {}); }   // server first: closing pages mid-stream used to crash serve.js
console.log(`${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
