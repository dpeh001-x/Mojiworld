// CO-OP GUESTS: A MOB KILLED BEFORE THE GUEST HAS MIRRORED IT STILL PAYS THE GUEST (bug hunt, fix-coop-fastkill-mirror).
// The host sends a monster to the guests at its first monster tick (48 ms); a mob killed before that was never mirrored, and a guest's kill
// handler pays nothing for a monster it never mirrored (the coop-trust rule, which stays). So a host kill 0 ms after spawn gave the host
// its EXP / coins / quest tick / streak and the guest none. _coopBroadcastKill now sends the monster once, as its first sight, before the kill.
// Two real clients over the real relay (mp/server.mjs, started here):
//   [1] a mirrored kill (900 ms after spawn): the guest's EXP, coins, quest tick, bestiary credit and kill streak move once - the reference
//   [2] a kill 0 ms after spawn: the guest gets the SAME EXP, a coin payout, and exactly one quest tick / bestiary credit / streak step (n = 5 each)
//   [3] a guest on another map is paid nothing for a host kill on its map (gating unchanged)
//   [4] a host kill with NO partner is untouched: the host is paid as before
//   node scripts/coop_guest_fastkill_test.mjs      PORT / MOJI_GAME_FILE override (an unfixed copy of the game in the repo root fails [2])
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11351), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 400) + ']' : '')); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 8000) => { const t0 = Date.now(); for (;;) { let v = null; try { v = await fn(); } catch (e) {} if (v || Date.now() - t0 > ms) return v; await sleep(200); } };
const relay = spawn(process.execPath, [path.join(ROOT, 'mp', 'server.mjs')], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' }); await sleep(1500);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--disable-gpu'] });
const errs = [];
const boot = async (name, cls, lv, map) => {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 960, height: 560 } });
  await ctx.addInitScript((ws) => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); localStorage.setItem('levelx_mp_url', ws); localStorage.setItem('lx_drs', 'off'); } catch (e) {} }, `ws://localhost:${PORT}`);
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(name + ': ' + String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1&lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function' && typeof mpConnect === 'function', null, { timeout: 240000 });
  await page.evaluate(async ({ nm, cls, lv, map }) => { const sl = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    { const ov = document.getElementById('loading-overlay'); if (ov) ov.classList.add('fade'); }
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootHold.release('menu'); } catch (e) {}
    applyClass(cls); player._tutorialSeen = true; player._gravitosCineSeen = true; if (player.look) player.look.name = nm;
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
    await sl(1500); try { devSetLevel(lv); } catch (e) { player.level = lv; }
    await sl(600); player.hp = getMaxHp(); player.mp = getMaxMp();
    try { closeAllModals(); } catch (e) {} loadMap(map); await sl(2500); try { closeAllModals(); } catch (e) {}
    try { const tm = document.getElementById('tutorial-modal'); if (tm && getComputedStyle(tm).display !== 'none') _closeTutorial(true); } catch (e) {} game.paused = false;
    player._god = true; player.invulnerable = 1e9;
    // what a kill gives THIS player: the quest tick, the bestiary credit and the kill-streak step each count their calls
    window.__k = { tick: 0, track: 0, streak: 0 };
    const t0 = window.tickQuestKill; window.tickQuestKill = function () { window.__k.tick++; return t0 && t0.apply(this, arguments); };
    const t1 = window.trackPickup; window.trackPickup = function (kind) { if (kind === 'kill') window.__k.track++; return t1 && t1.apply(this, arguments); };
    const t2 = window._ksOnKill; window._ksOnKill = function () { window.__k.streak++; return t2 && t2.apply(this, arguments); };
  }, { nm: name, cls, lv, map });
  return page;
};
const join = async (p, room) => { await p.evaluate(({ url, room }) => mpConnect(url, 'x' + Math.random().toString(36).slice(2, 5), room), { url: `ws://localhost:${PORT}`, room }); return until(() => p.evaluate(() => net.connected && net.myId != null), 15000); };
const read = (p) => p.evaluate(() => ({ exp: player.exp || 0, coins: player.mojicoins || 0, lv: player.level, k: { ...window.__k } }));
const delta = (a, b) => ({ exp: b.exp - a.exp, coins: b.coins - a.coins, tick: b.k.tick - a.k.tick, track: b.k.track - a.k.track, streak: b.k.streak - a.k.streak });
try {
  const A = await boot('Alpha', 'warrior', 12, 'forest'), B = await boot('Beta', 'mage', 12, 'forest');
  const code = 'FK' + Math.random().toString(36).slice(2, 7).toUpperCase();
  await join(A, code); await join(B, code);
  ok('both clients joined one party', await until(() => A.evaluate(() => Object.keys(net.peers).length === 1), 10000) && await until(() => B.evaluate(() => Object.keys(net.peers).length === 1), 10000));
  await sleep(4000);
  // a plain mob at the guest's own level, so the level-gap falloff leaves a real EXP number to compare (a Lv 12 hero on a snail is paid 1)
  const type = await A.evaluate(() => { const lv = (k) => (typeof MOB_NATURAL_LEVEL === 'object' && MOB_NATURAL_LEVEL[k]) | 0; const c = Object.entries(monsterTypes).filter(([k, t]) => !t.boss && !t.isBoss && !t.flies && !t.shoot && !(t.traits && (t.traits.explodesOnDeath || t.traits.packCall || t.traits.summonsHounds)) && lv(k) >= 1 && t.exp > 0 && !k.startsWith('zodiac') && !k.startsWith('tower') && !k.startsWith('pq')).sort((a, b) => Math.abs(lv(a[0]) - 12) - Math.abs(lv(b[0]) - 12)); return c.length ? c[0][0] : null; });
  ok('a plain mob type near the guest level exists to test with', !!type, type);
  await A.evaluate(() => { for (const m of game.monsters) m.currentHp = 0; game.monsters.length = 0; });
  await sleep(500);
  // the host's kill: spawn beside the host, kill after `delay` ms with one hit; the guest stands 80 px away (inside the 400 px party wedge)
  const kill = async (delay) => {
    await B.evaluate((x) => { player.x = x; player.vx = 0; }, await A.evaluate(() => player.x + 80));
    await sleep(300);
    const a0 = await read(B);
    await A.evaluate(async ({ t, d }) => { const m = spawnMonster(player.x + 40, 300, t, false, false); if (!m) return; m.x = player.x + 40; m.y = 436 + 44 - m.h; if (d) await new Promise((r) => setTimeout(r, d)); hitMonster(m, 1e9, false, 'basic'); }, { t: type, d: delay });
    await sleep(1800);
    return delta(a0, await read(B));
  };
  const mirrored = []; for (let i = 0; i < 3; i++) mirrored.push(await kill(900));
  const fast = []; for (let i = 0; i < 5; i++) fast.push(await kill(0));
  const lo = Math.min(...mirrored.map((d) => d.exp)), hi = Math.max(...mirrored.map((d) => d.exp));   // a kill's EXP carries its own +-15% roll, so the reference is the mirrored kills' span
  ok('[1] a mirrored kill pays the guest: EXP, coins, one quest tick, one bestiary credit, one streak step', mirrored.every((d) => d.exp > 3 && d.coins > 0 && d.tick === 1 && d.track === 1 && d.streak === 1), mirrored);
  ok('[2] a kill 0 ms after spawn pays the guest the EXP a mirrored kill pays (n = 5: inside the mirrored span +-20%, so neither nothing nor twice)', lo > 3 && fast.every((d) => d.exp >= lo * 0.8 && d.exp <= hi * 1.2), { mirrored: mirrored.map((d) => d.exp), fast: fast.map((d) => d.exp) });
  ok('[2] ...and coins, and exactly one quest tick, bestiary credit and streak step each (nothing doubled)', fast.every((d) => d.coins > 0 && d.tick === 1 && d.track === 1 && d.streak === 1), fast);
  // [3] a guest on another map: not on the host's map, so not paid
  await B.evaluate(() => loadMap('town')); await sleep(3500);
  const a1 = await read(B);
  await A.evaluate(async ({ t }) => { const m = spawnMonster(player.x + 40, 300, t, false, false); if (!m) return; m.x = player.x + 40; m.y = 436 + 44 - m.h; hitMonster(m, 1e9, false, 'basic'); }, { t: type });
  await sleep(1800);
  const d3 = delta(a1, await read(B));
  ok('[3] a guest on another map is paid nothing for the host\'s fast kill', d3.exp === 0 && d3.coins === 0 && d3.tick === 0 && d3.streak === 0, d3);
  // [4] no partner: the host's own payout is untouched
  await B.evaluate(() => { try { mpDisconnect(); } catch (e) {} }); await sleep(1500);
  const h0 = await read(A);
  await A.evaluate(async ({ t }) => { const m = spawnMonster(player.x + 40, 300, t, false, false); if (!m) return; m.x = player.x + 40; m.y = 436 + 44 - m.h; hitMonster(m, 1e9, false, 'basic'); }, { t: type });
  await sleep(1200);
  const d4 = delta(h0, await read(A));
  ok('[4] with no partner the host is paid as before (EXP and a quest tick)', d4.exp > 0 && d4.tick === 1, d4);
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { fail++; console.log('FAIL harness error', String(e && e.stack || e).slice(0, 600)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
await browser.close().catch(() => {}); try { relay.kill(); } catch (e) {}
process.exit(fail ? 1 : 0);
