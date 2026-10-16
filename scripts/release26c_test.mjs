// RELEASE 26c (2026-10-16, per user) stays fixed - driven with the real keys, the real Settings select, the real Secure Save button, the
// real import file input and confirm, and the real Continue:
//   [A1] a tapped Siege Volley (Ballista G) streams at once (<= 0.4 s after the press) at normal power: arrows hit for 1.23x ATK + 10
//   [A2] a held Siege Volley (full draw) streams on release and EVERY arrow carries the draw - the arrows, the hits on a dummy and the
//        arrows fired after the class bonus's 2 s window all hit 1.5x a tap's (was 1.0x: the arrows are tagged 'siege'); they also
//        fly the draw's flatter arc (_drawPower ~1)
//   [A3] the measured full-draw bonus is the one the cards state (+50 %: the Siege Volley card and the archer's Hold to Draw card)
//   [B1] a difficulty picked in Settings (keyboard on the select) is the character's: live tier, player.difficulty, and the save it writes
//   [B2] the Secure Save file carries it
//   [B3] imported into a fresh browser (whose own setting is Normal) it loads as Hard: live tier, damage x1.5, EXP x1.3, the Settings select
//   [B4] ...and it stays the character's: the browser's store set to Story behind its back, a reload still loads Hard
//   [B5] a save from before the field keeps the browser's current setting once (Nightmare) and saves it from then on
//   [B6] a new game starts on the browser's current setting (Story) and its first save names it
//   [B7] on a public host (anti-cheat on) a console write to the saved difficulty / live tier is refused; a real Settings pick still works
//   [B8] no page errors
//   node release26c_test.mjs        PORT (default 15174) / MOJI_GAME_FILE / SERVE_ROOT
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15174), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--host-resolver-rules=MAP play.mojiworld.test 127.0.0.1'] });
const errs = [];
const step = async (fn) => { try { await fn(); } catch (e) { ok('a step completes', false, String(e && e.message || e).slice(0, 300)); } };   // one failing step does not skip the rest
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const med = (a) => { const v = a.slice().sort((x, y) => x - y); return v.length ? v[Math.floor(v.length / 2)] : 0; };
const menu = (page) => page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return window._lxBootMenuSeen && typeof _lxAc === 'object' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 240000 });
const fresh = async (host, init, q = '') => {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 }, acceptDownloads: true });
  await ctx.addInitScript(init || (() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} }));
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(host + ': ' + String(e.message).slice(0, 140)));
  await page.goto(`http://${host}:${PORT}/${FILE}?lxhold=0${q}`, { waitUntil: 'domcontentloaded', timeout: 180000 }); await menu(page);
  return { ctx, page };
};
// into the world without the menu (a new hero of a class) - the boot recipe the other release tests use
const enter = (page, k) => page.evaluate(async (k) => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
  { const ov = document.getElementById('loading-overlay'); if (ov) ov.classList.add('fade'); }
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  try { _lxBootHold.release('menu'); } catch (e) {}
  if (k.cls) { try { applyClass(k.cls); } catch (e) {} player.cls = k.cls; }
  if (k.lv) devSetLevel(k.lv); if (k.job) { try { applyJob(k.job); } catch (e) {} } if (k.master) { try { applyMaster(k.master); } catch (e) {} }
  player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const b in STORY_BEATS) player._storyBeatsSeen[b] = true;
  player._tutorialSeen = true; player._gravitosCineSeen = true; player._god = true;
  game._worldStateByMap = Object.assign(game._worldStateByMap || {}, { forest: null });
  const clear = () => { try { if (typeof _dismissBossIntro === 'function') _dismissBossIntro(); } catch (e) {} try { closeAllModals(); } catch (e) {} try { closeDialog(); } catch (e) {}
    for (const id of ['story-beat-overlay']) { const el = document.getElementById(id); if (el) el.classList.remove('on'); } document.body.classList.remove('cinematic', 'sb-active'); game.paused = false; };
  window._r26 = { clear };
  if (k.map) { clear(); loadMap(k.map, 1500); for (let i = 0; i < 5; i++) { await sleep(240); clear(); } }
}, k);
// the Settings difficulty select, changed with the keyboard (the select's own change handler runs, as a player's pick does)
const pickDiff = async (page, want) => {
  await page.evaluate(() => { try { openSettingsModal(); } catch (e) {} document.getElementById('set-difficulty').focus(); });
  const order = ['story', 'normal', 'hard', 'nightmare'];
  for (let i = 0; i < 4; i++) { const cur = await page.evaluate(() => document.getElementById('set-difficulty').value); if (cur === want) break;
    await page.keyboard.press(order.indexOf(want) > order.indexOf(cur) ? 'ArrowDown' : 'ArrowUp'); await page.waitForTimeout(150); }
  await page.waitForTimeout(300);
  await page.evaluate(() => { try { document.getElementById('set-difficulty').blur(); closeSettingsModal(); } catch (e) {} });
};
const stored = (page) => page.evaluate(() => { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); return { d: s && s.player ? s.player.difficulty : '(no save)', lv: s && s.player && s.player.level }; } catch (e) { return { d: '(unreadable)' }; } });
const live = (page) => page.evaluate(() => ({ tier: game._diffTier, mul: game._diffDmgMul, exp: _diffExpMul(), pd: player.difficulty, sel: document.getElementById('set-difficulty').value,
  ls: (() => { try { return JSON.parse(localStorage.getItem('LX_SETTINGS') || '{}').difficulty; } catch (e) { return '?'; } })(), lv: player.level, cls: player.cls }));
try {
  // ======== A. Siege Volley
  const ONLY = process.env.R26C_ONLY || '';
  if (ONLY !== 'B') await step(async () => { const { ctx, page } = await fresh('localhost');
    await enter(page, { cls: 'archer', lv: 80, job: 'sniper', master: 'ballista', map: 'forest' });
    console.log('  build', await page.evaluate(() => GAME_VERSION));
    const KEY = await page.evaluate(() => Object.keys(KEY_TO_SLOT).find((k) => KEY_TO_SLOT[k] === 'x' && skillBySlot('x') && skillBySlot('x').id === 'ballista_volley'));
    // every arrow is judged against the formula at its own spawn (f = 1.23 x getAtk() + 10, read the frame it is first seen), every hit on
    // the dummy against the formula at the hit - so an ATK that moves during the 8 s stream cannot read as (or hide) a draw bonus
    const prep = () => page.evaluate(() => {
      window._r26.clear(); try { cancelPendingSkillTimers(); } catch (e) {}
      game.monsters = []; game.projectiles = []; player._ballistaChannel = null; player._warCharge = null; player.skillCooldowns = {}; player._castLockUntil = 0;
      player.mp = player.maxMp = 99999; player.hp = getMaxHp(); player.hitStun = 0; player.facing = 1; player.vx = 0; game.comboMult = 1; game.combo = 0; game.critStreak = 0;
      const m = spawnMonster(player.x + 230, player.y, 'slime', false, false); m.maxHp = m.currentHp = 1e12; m.evasion = 0; m._firstHit = true; m.vx = 0; window.__dm = m;
      window.__arr = []; window.__hits = []; window.__seen = new WeakSet(); window.__ch = null; window.__atk = [];
      const F = () => getAtk() * 1.23 + 10;
      if (!window.__hm) { window.__hm = window.hitMonster; window.hitMonster = function (mm, d, crit, sk) { if (mm === window.__dm && sk === 'siege' && window.__hits) window.__hits.push({ r: d / F(), crit: !!crit }); return window.__hm.apply(this, arguments); }; }
      clearInterval(window.__poll); window.__poll = setInterval(() => {
        const m = window.__dm; if (m) { m.currentHp = 1e12; m.x = player.x + 230; m.vx = 0; } player.mp = 99999; player.hp = getMaxHp(); player.hitStun = 0; game.hitStop = 0;
        const c = player._ballistaChannel; if (c && !window.__ch) window.__ch = { t: c.startedAt, at: performance.now() };
        if (c && window.__atk.length < 400) window.__atk.push(Math.round(getAtk()));
        for (const p of game.projectiles) if (p && p.skill === 'siege' && p.rs === 'ballista_volley' && !window.__seen.has(p)) { window.__seen.add(p); window.__arr.push({ r: p.damage / F(), dp: p._drawPower || 0, t: game.time }); }
      }, 30);
    });
    const run = async (hold) => {
      await prep(); await page.waitForTimeout(400);
      await page.evaluate(() => { window.__kdT = game.time; }); await page.keyboard.down(KEY);
      let noCast = true, drawn = 0;
      if (hold) { for (let i = 0; i < 100; i++) { await page.waitForTimeout(50); const w = await page.evaluate(() => ({ p: player._warCharge ? player._warCharge.power : -1, ch: !!player._ballistaChannel }));
        if (w.ch) noCast = false; drawn = w.p; if (w.p >= 1) break; } await page.waitForTimeout(120); } else await page.waitForTimeout(40);
      await page.keyboard.up(KEY);
      await page.waitForFunction(() => window.__ch && !player._ballistaChannel, null, { timeout: 40000 }).catch(() => {}); await page.waitForTimeout(800);
      return page.evaluate(([noCast, drawn]) => { clearInterval(window.__poll); const ch = window.__ch, atk = window.__atk;
        return { arr: window.__arr, hits: window.__hits.filter((h) => !h.crit).map((h) => h.r), lagF: ch ? ch.t - window.__kdT : null, t0: ch ? ch.t : null, noCast, drawn, atk: [Math.min(...atk), Math.max(...atk)] }; }, [noCast, drawn]);
    };
    const tap = await run(false), held = await run(true);
    const r = (x) => Math.round(x * 1000) / 1000;
    const tapR = med(tap.arr.map((a) => a.r)), heldR = med(held.arr.map((a) => a.r)), lateR = held.arr.filter((a) => a.t - held.t0 > 150).map((a) => a.r);
    const S = { key: KEY, lagFrames: tap.lagF, n: [tap.arr.length, held.arr.length], tapPerArrow: r(tapR), heldPerArrow: r(heldR), ratio: r(heldR / tapR), late: [lateR.length, r(med(lateR) / tapR)],
      hits: [tap.hits.length, held.hits.length, r(med(held.hits) / med(tap.hits))], dp: r(med(held.arr.map((a) => a.dp))), drawn: held.drawn, noCastWhileHeld: held.noCast, atk: [tap.atk, held.atk] };
    ok('[A1] a tapped Siege Volley streams at once (<= 24 frames after the press) at normal power (1.23x ATK + 10 an arrow)', tap.lagF != null && tap.lagF <= 24 && tap.arr.length >= 90 && near(tapR, 1, 0.02), S);
    ok('[A2] a full draw (held until the draw is full, no stream while held) puts 1.5x on every arrow, every hit and the arrows after the 2 s window, with the flatter arc',
      held.noCast && held.drawn >= 1 && held.arr.length >= 90 && near(heldR / tapR, 1.5, 0.02) && lateR.length >= 60 && near(med(lateR) / tapR, 1.5, 0.02) && held.hits.length >= 20 && near(med(held.hits) / med(tap.hits), 1.5, 0.04) && S.dp >= 0.99, S);
    const cards = await page.evaluate(() => ({ sv: SKILLS.ballista_volley.desc, cls: (CLASSES.archer.identity || {}).desc || '' }));
    const svPct = +((cards.sv.match(/hits up to \+(\d+) % harder/) || [])[1]), clsHas = /\+(\d+) % damage to Deadeye Protocol rounds and to every Siege Volley arrow/.exec(cards.cls);
    ok('[A3] the measured full-draw bonus is the one both cards state', svPct > 0 && clsHas && +clsHas[1] === svPct && near((heldR / tapR - 1) * 100, svPct, 2), { measured: Math.round((heldR / tapR - 1) * 1000) / 10, card: svPct || null, cls: clsHas && clsHas[1], clsText: cards.cls.slice(0, 60) });
    await ctx.close(); });
  // ======== B. the difficulty travels with the save
  let fileBuf = null, made = null;
  if (ONLY !== 'A') await step(async () => { const { ctx, page } = await fresh('localhost');
    await enter(page, { cls: 'archer', lv: 30, map: 'forest' });
    await page.evaluate(() => { _flushSaveStateNow(); });
    await pickDiff(page, 'hard');   // the pick's own (debounced, 1.5 s) save - waited for, up to 12 s on a loaded machine
    await page.waitForFunction(() => { try { return JSON.parse(localStorage.getItem(SAVE_KEY)).player.difficulty === 'hard'; } catch (e) { return false; } }, null, { timeout: 12000 }).catch(() => {});
    const L1 = await live(page), S1 = await stored(page);
    ok('[B1] a Settings pick is the character\'s: live Hard, player.difficulty, and the save it wrote', L1.tier === 'hard' && L1.mul === 1.5 && L1.pd === 'hard' && S1.d === 'hard', { live: L1, save: S1 });
    await page.evaluate(() => { try { openSettingsModal(); } catch (e) {} });
    const dl = page.waitForEvent('download', { timeout: 20000 });
    await page.click('button[onclick="exportSaveSecure()"]', { timeout: 15000 });
    const d = await dl; fileBuf = readFileSync(await d.path());
    let inner = null; try { inner = JSON.parse(JSON.parse(String(fileBuf)).data); } catch (e) {}
    ok('[B2] the Secure Save file carries it', !!inner && inner.player && inner.player.difficulty === 'hard', inner && inner.player ? { d: inner.player.difficulty, lv: inner.player.level } : String(fileBuf).slice(0, 80));
    made = await page.evaluate(() => { _flushSaveStateNow(); return { save: localStorage.getItem(SAVE_KEY), mark: localStorage.getItem(SAVE_KEY + '_verified') }; });
    await ctx.close(); });
  if (ONLY !== 'A') await step(async () => { const { ctx, page } = await fresh('localhost');   // a fresh browser: its own setting is Normal
    const L0 = await live(page);
    await page.evaluate(() => { const el = document.getElementById('save-import-file'); el.style.display = 'block'; });
    await page.setInputFiles('#save-import-file', { name: 'mojiworld-secure-lv30.mojisave', mimeType: 'application/json', buffer: fileBuf });
    const cbody = await page.evaluate(() => { const b = document.getElementById('confirm-body'); return b ? b.textContent.slice(0, 160) : null; });
    const nav = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log('  import confirm:', cbody);
    await page.click('#confirm-yes', { timeout: 15000 }); await nav.catch((e) => console.log('  (no reload after the import: ' + String(e.message).slice(0, 60) + ')'));
    await menu(page); await page.waitForTimeout(1200);
    const L3 = await live(page); console.log('  after the import', JSON.stringify(L3));
    let L3b = null;
    if (L3.lv === 30) { await page.click('#menu-continue', { timeout: 150000 }); await page.waitForFunction(() => game.mapData && _lxHeroInWorld(), null, { timeout: 120000 }); await page.waitForTimeout(1500); L3b = await live(page); }
    ok('[B3] imported into a fresh browser (own setting Normal) it loads as Hard: tier, damage x1.5, EXP x1.3, the Settings select', L0.ls !== 'hard' && L3.lv === 30 && L3.tier === 'hard' && L3.mul === 1.5 && L3.exp === 1.3 && L3.sel === 'hard' && !!L3b && L3b.tier === 'hard' && L3b.pd === 'hard', { before: L0, title: L3, inWorld: L3b });
    await page.evaluate(() => { localStorage.setItem('LX_SETTINGS', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('LX_SETTINGS') || '{}'), { difficulty: 'story' }))); });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 180000 }); await menu(page); await page.waitForTimeout(1200);
    const L4 = await live(page);
    ok('[B4] it stays the character\'s: the browser store set to Story behind its back, a reload loads Hard again', L4.lv === 30 && L4.tier === 'hard' && L4.pd === 'hard' && L4.sel === 'hard', L4);
    await ctx.close(); });
  if (ONLY !== 'A') await step(async () => { const old = JSON.parse(made.save); delete old.player.difficulty;   // a save from before the field (it is outside the signed set: the signature stands)
    const init = `(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1');
      localStorage.setItem('LX_SETTINGS', JSON.stringify({ difficulty: 'nightmare' })); if (!sessionStorage.getItem('r26o')) { sessionStorage.setItem('r26o', '1');
      localStorage.setItem('levelx_save_v1', ${JSON.stringify(JSON.stringify(old))}); localStorage.setItem('levelx_save_v1_verified', ${JSON.stringify(made.mark)}); } } catch (e) {} })();`;
    const { ctx, page } = await fresh('localhost', init);
    const L5 = await live(page);
    await page.click('#menu-continue', { timeout: 150000 }); await page.waitForFunction(() => game.mapData && _lxHeroInWorld(), null, { timeout: 120000 }); await page.waitForTimeout(1500);
    await page.evaluate(() => { _flushSaveStateNow(); }); const S5 = await stored(page);
    ok('[B5] a save from before the field keeps the browser\'s setting (Nightmare) and saves it from then on', L5.lv === 30 && L5.tier === 'nightmare' && L5.pd === 'nightmare' && S5.d === 'nightmare', { title: L5, save: S5 });
    await ctx.close(); });
  if (ONLY !== 'A') await step(async () => { const { ctx, page } = await fresh('localhost', () => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); localStorage.setItem('LX_SETTINGS', JSON.stringify({ difficulty: 'story' })); } catch (e) {} });
    await enter(page, { cls: 'mage', lv: 5, map: 'forest' });
    await page.evaluate(() => { _flushSaveStateNow(); }); const L6 = await live(page), S6 = await stored(page);
    ok('[B6] a new game starts on the browser\'s current setting (Story) and its first save names it', L6.tier === 'story' && L6.mul === 0.5 && S6.d === 'story', { live: L6, save: S6 });
    await ctx.close(); });
  if (ONLY !== 'A') await step(async () => { const init = `(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1');
      if (!sessionStorage.getItem('r26p')) { sessionStorage.setItem('r26p', '1'); localStorage.setItem('levelx_save_v1', ${JSON.stringify(made.save)}); localStorage.setItem('levelx_save_v1_verified', ${JSON.stringify(made.mark)}); } } catch (e) {} })();`;
    const { ctx, page } = await fresh('play.mojiworld.test', init);
    await page.click('#menu-continue', { timeout: 150000 }); await page.waitForFunction(() => game.mapData && _lxHeroInWorld(), null, { timeout: 120000 }); await page.waitForTimeout(1500);
    const on = await page.evaluate(() => _lxAc.on);
    const W = await page.evaluate(() => { game._diffTier = 'nightmare'; game._diffDmgMul = 0.5; player.difficulty = 'nightmare'; game._pendingDiffMul = 0.5; return { tier: game._diffTier, mul: game._diffDmgMul, pd: player.difficulty, pend: game._pendingDiffMul }; });
    await pickDiff(page, 'normal'); await page.waitForTimeout(400);
    const L7 = await live(page);
    ok('[B7] public host: console writes to the saved difficulty / live tier are refused; a real Settings pick still works', on && W.tier === 'hard' && W.mul === 1.5 && W.pd === 'hard' && W.pend == null && L7.tier === 'normal' && L7.pd === 'normal' && L7.mul === 1, { on, afterConsole: W, afterPick: L7 });
    await ctx.close(); });
} catch (e) { ok('the run completes', false, String(e && e.stack || e).slice(0, 400)); }
finally { try { server.kill(); } catch (e) {} await browser.close().catch(() => {}); }
ok('[B8] no page errors', !errs.length, errs.slice(0, 4));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
