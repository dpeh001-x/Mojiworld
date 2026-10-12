// RELEASE 13c (bug hunt round 13) stays fixed:
//   1 the Expedition unlocks the three old Tower cosmetics (per user): Frost Cape at floor B5, Sunfire at a full B10 clear, the
//     Astral Cape at five clears; the counters are lifetime fields (saved, untouched by the run's restore); the hints name the
//     Expedition; an old save whose Tower best met the old numbers keeps them; an unlock already held stays held
//   2 a boon picked up inside an Expedition is not "held" in the Boon Codex (during the run or after it); one the hero walked in
//     with still is
//   3 the boss Setshard toast names the boss ("King Krook dropped ...", not "King dropped ...")
//   4 the MojiMon panel says the mon is fighting beside you while it is out, not "ready to play"
//   5 Ticket Rush Stage 2: pieces 1-3 say "keep climbing", the fourth does not
//   6 one pass of the first-hour ladder that claims two rungs announces ONE Next, and never a claimed rung
//   7 a full clear with every eligible title owned "earns" no title (no toast); with one left it earns that one
//   node scripts/release13c_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 11987), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
const URL = `http://localhost:${PORT}/${FILE}?dev=1`;
const boot = async (page) => {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof loadMap === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  await page.evaluate(async () => {
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    player._tutorialSeen = true; window._prologueAfterCreation = false;
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) applyClass('warrior'); player.level = Math.max(player.level || 1, 60); player._gravitosCineSeen = true; player.invulnerable = 1e12; player._god = true;
    player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
    window.__toasts = []; const st = window.showToast; window.showToast = function (m) { window.__toasts.push(String(m)); return st.apply(this, arguments); };
    window.__sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    game.expedition = game.expedition || {}; game.expedition.active = false;
    loadMap('forest', 300); await new Promise((r) => setTimeout(r, 1200)); game.paused = false;
  });
};
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await boot(page);
  // ---- 6. the first-hour ladder: two rungs in one pass, one Next
  let r = await page.evaluate(async () => {
    const lv0 = player.level; player.level = 4; game.early = { kills: 1, quests: 0, done: {} };
    __toasts.length = 0; _checkEarlyHooks(); await __sleep(2400);
    const out = { done: Object.keys(game.early.done), nexts: __toasts.filter((t) => /Next:/.test(t)) };
    player.level = lv0; for (const h of EARLY_HOOKS.concat(STORY_HOOKS)) game.early.done[h.id] = game.early.done[h.id] || Date.now();
    return out;
  });
  ok('6. one pass claims First Blood + Finding Your Feet', r.done.includes('first_blood') && r.done.includes('lv3') && r.done.length === 2, r);
  ok('6. ...and announces ONE Next: Pest Control (never the rung just claimed)', r.nexts.length === 1 && /Pest Control/.test(r.nexts[0]) && !r.nexts.some((t) => /Finding Your Feet/.test(t)), r.nexts);
  // ---- 4. the MojiMon panel while the mon is out
  r = await page.evaluate(async () => {
    let host = document.getElementById('u-pane-mojimon'), made = false;
    if (!host) { host = document.createElement('div'); host.id = 'u-pane-mojimon'; document.body.appendChild(host); made = true; }
    const mm = _mojimonEnsure(), keep = { out: mm.out, cd: mm.cdUntil, as: mm.assigned };
    const sub = () => { renderMojiMonPanel(); const e = host.querySelector('.mmc-cd .mmc-sub'); return e ? e.textContent : null; };
    mm.assigned = null; mm.cdUntil = 0; mm.out = { type: 'slime', hpFrac: 1 };
    const out = { outSub: sub(), name: monsterTypes.slime.name };
    mm.out = null; out.homeSub = sub();
    mm.out = keep.out; mm.cdUntil = keep.cd; mm.assigned = keep.as; if (made) host.remove(); else host.innerHTML = '';
    return out;
  });
  ok('4. while the mon is out the panel says it is fighting beside you', /fighting beside you/.test(r.outSub || '') && r.outSub.includes(r.name) && !/ready to play/.test(r.outSub), r);
  ok('4. ...and with none out it is not "fighting"', r.homeSub !== null && !/fighting/.test(r.homeSub), r);
  // ---- 5. Ticket Rush Stage 2 pieces
  r = await page.evaluate(async () => {
    loadMap('clockworkSpire', 300); await __sleep(1500); game.paused = false;
    player._pqSpirePieces = {}; game.chests = (game.chests || []).filter((c) => !c._pqPuzzlePiece);
    const cs = [8, 18, 28, 38].map((i) => ({ x: 100 + i * 10, y: 300, w: 35, h: 30, opened: false, tier: 'gold', _pqPuzzlePiece: true, _pqPieceIndex: i }));
    game.chests.push(...cs);
    const per = [];
    for (const c of cs) { __toasts.length = 0; openChest(c); await __sleep(80); per.push(__toasts.slice()); }
    return per;
  });
  ok('5. pieces 1-3 say "keep climbing"', [0, 1, 2].every((i) => r[i].some((t) => /Ticket Piece \d\/4 .*keep climbing/.test(t))), r);
  ok('5. the fourth piece does not (the summit portal toast says it)', !r[3].some((t) => /keep climbing/.test(t)) && r[3].some((t) => /All 4 pieces/.test(t)), r[3]);
  // ---- 3. the boss Setshard toast names the boss
  r = await page.evaluate(async () => {
    loadMap('krookThrone', 300); await __sleep(1500); game.paused = false;
    for (const q of game.monsters) q.currentHp = 0; game.monsters.length = 0;
    __toasts.length = 0;
    const b = spawnMonster(700, 300, 'kingKrook', true, false); if (!b) return { err: 'no boss' };
    const nm = b.name; killMonster(b, 'melee'); game.paused = false; await __sleep(1300);
    return { nm, shard: __toasts.filter((t) => /dropped \d[\d,]* Setshard/.test(t)) };
  });
  ok('3. the Setshard toast says "King Krook dropped" (the boon wheel short name)', r.shard && r.shard.length === 1 && /King Krook dropped/.test(r.shard[0]), r);
  // ---- 1 / 2 / 7. the Expedition
  r = await page.evaluate(async () => {
    try { document.querySelectorAll('#boon-wheel-modal, .boon-wheel-modal').forEach((e) => e.remove()); closeAllModals(); } catch (e) {}
    game.paused = false; loadMap('town', 600); await __sleep(1200); game.paused = false;
    const out = {};
    player.cosmetics = { hair: {}, cape: {}, weapon: {} }; game.towerBestFloor = 0; game.expeditionBestFloor = 0; game.expeditionClears = 0;
    out.descs = { frost: COSMETICS.cape.find((c) => c.id === 'frost').desc, astral: COSMETICS.cape.find((c) => c.id === 'astral').desc, sunfire: COSMETICS.weapon.find((c) => c.id === 'sunfire').desc };
    out.saved = GAME_SAVE_FIELDS.includes('expeditionBestFloor') && GAME_SAVE_FIELDS.includes('expeditionClears');
    // 2: one boon walked in with (A), one picked up in the run (B)
    const ids = POWERUPS.map((p) => p.id), A = ids[0], B = ids[1];
    const dx = _boonDex(); for (const k of [A, B]) { delete dx.held[k]; delete dx.seen[k]; }
    player.boons = [rollBoonInstance(A)]; player.boonsEquipped = [];
    const cos = () => ({ frost: !!player.cosmetics.cape.frost, astral: !!player.cosmetics.cape.astral, sunfire: !!player.cosmetics.weapon.sunfire });
    if (!_startExpedition()) return { err: 'no start' };
    await __sleep(1200); game.paused = false;
    acquirePowerup({ id: B }); _applyEquippedBoons();
    out.inRun = { A: !!_boonDex().held[A], B: !!_boonDex().held[B], bagHasB: player.boons.some((b) => b && b.id === B) };
    for (let f = 0; f < 3; f++) { _expeditionAdvanceFloor('combat'); await __sleep(500); game.paused = false; }
    out.atB4 = { floor: game.expedition.floor, cos: cos() };
    _expeditionAdvanceFloor('combat'); await __sleep(500); game.paused = false;
    out.atB5 = { floor: game.expedition.floor, best: game.expeditionBestFloor, cos: cos() };
    _completeExpedition(); await __sleep(3300); game.paused = false;
    out.after1 = { clears: game.expeditionClears, best: game.expeditionBestFloor, cos: cos(), active: game.expedition.active, B: !!_boonDex().held[B], A: !!_boonDex().held[A] };
    out.astralHint = COSMETICS.cape.find((c) => c.id === 'astral').desc;
    for (let i = 0; i < 4; i++) { _startExpedition(); await __sleep(700); game.paused = false; _completeExpedition(); await __sleep(3100); game.paused = false; }
    out.after5 = { clears: game.expeditionClears, cos: cos() };
    // 7: every eligible title owned -> no title; one left -> that one
    if (!player.titles || typeof player.titles !== 'object') player.titles = {};
    const tk = (typeof _lxTwelveKnown === 'function' && _lxTwelveKnown());
    const pool = EXPEDITION_TITLES.filter((t) => tk || !['Twelvefold', 'Zodiac Cracked', 'Constellation-Slayer'].includes(t));
    for (const t of pool) player.titles[t] = true;
    const R0 = Math.random;
    const run = async () => { _startExpedition(); await __sleep(700); game.paused = false; __toasts.length = 0; Math.random = () => 0.01; try { _completeExpedition(); } finally { Math.random = R0; } await __sleep(3300); game.paused = false; return __toasts.filter((t) => /Title earned/.test(t)); };
    const nT0 = Object.keys(player.titles).length;
    out.allOwned = { toasts: await run(), added: Object.keys(player.titles).length - nT0 };
    const left = pool[pool.length - 1]; delete player.titles[left];
    out.oneLeft = { left, toasts: await run(), has: !!player.titles[left] };
    return out;
  });
  if (r.err) ok('1. expedition setup', false, r);
  else {
    ok('1. the counters are saved fields', r.saved, r);
    ok('1. the hints name the Expedition (B5 / B10 / B10 five times)', /Expedition floor B5/.test(r.descs.frost) && /B10 five times/.test(r.descs.astral) && /Expedition floor B10/.test(r.descs.sunfire) && !/tower floor/i.test(JSON.stringify(r.descs)), r.descs);
    ok('1. at B4 nothing is unlocked yet', r.atB4.floor === 4 && !r.atB4.cos.frost && !r.atB4.cos.sunfire && !r.atB4.cos.astral, r.atB4);
    ok('1. reaching B5 unlocks the Frost Cape (only)', r.atB5.floor === 5 && r.atB5.best === 5 && r.atB5.cos.frost && !r.atB5.cos.sunfire && !r.atB5.cos.astral, r.atB5);
    ok('1. a full clear unlocks Sunfire; the counters survive the run ending (1 clear, best B10)', !r.after1.active && r.after1.clears === 1 && r.after1.best === 10 && r.after1.cos.sunfire && r.after1.cos.frost && !r.after1.cos.astral, r.after1);
    ok('1. the Astral hint counts the clears (1/5)', /\(1\/5\)/.test(r.astralHint || ''), r.astralHint);
    ok('1. five clears unlock the Astral Cape', r.after5.clears === 5 && r.after5.cos.astral && r.after5.cos.sunfire && r.after5.cos.frost, r.after5);
    ok('2. in the run: the boon walked in with is held, the one picked up is in the bag but NOT held', r.inRun.A && r.inRun.bagHasB && !r.inRun.B, r.inRun);
    ok('2. ...and after the run it is still not held', !r.after1.B && r.after1.A, r.after1);
    ok('7. every eligible title owned: no "Title earned" toast, no title added', r.allOwned.toasts.length === 0 && r.allOwned.added === 0, r.allOwned);
    ok('7. one title left: the clear earns exactly that one', r.oneLeft.has && r.oneLeft.toasts.length === 1 && r.oneLeft.toasts[0].includes(r.oneLeft.left), r.oneLeft);
  }
  // ---- 1. old saves + held unlocks
  r = await page.evaluate(async () => {
    const out = {};
    player.cosmetics = { hair: {}, cape: {}, weapon: {} }; game.expeditionBestFloor = 0; game.expeditionClears = 0; game.towerBestFloor = 25;
    checkCosmeticUnlocks(); out.legacy = { frost: !!player.cosmetics.cape.frost, astral: !!player.cosmetics.cape.astral, sunfire: !!player.cosmetics.weapon.sunfire };
    player.cosmetics = { hair: {}, cape: { astral: true }, weapon: {} }; game.towerBestFloor = 9;
    checkCosmeticUnlocks(); out.held = { astral: !!player.cosmetics.cape.astral, frost: !!player.cosmetics.cape.frost };
    return out;
  });
  ok('1. an old save whose Tower best met the old numbers keeps all three', r.legacy.frost && r.legacy.astral && r.legacy.sunfire, r.legacy);
  ok('1. an unlock already held stays held (and nothing new without progress)', r.held.astral && !r.held.frost, r.held);
  ok('no page errors', errs.length === 0, errs.slice(0, 5));
} catch (e) { fail++; console.log('FAIL harness: ' + String(e && e.stack || e).slice(0, 400)); }
await browser.close().catch(() => {}); try { server.kill(); } catch (e) {}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
