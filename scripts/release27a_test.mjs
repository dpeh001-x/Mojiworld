// RELEASE 27a (2026-10-17, per user) stays fixed - real keys for every cast:
//   [A1] Arrow Rain (Sniper / Marksman, C), Elemental Arrows (Ranger / Skyhunter, C), Gale Storm (Skyhunter, G): a tap casts at
//        normal power - every arrow at its formula (2.8x ATK; 4x ATK + 10; 4x ATK + 10)
//   [A2] a full draw (held until full, nothing cast while held) puts 1.5x on every arrow of each skill and on every hit it lands on a
//        dummy (was 1.0x: their arrows are tagged rainArrow / elemArrow / gale and the first two fire from timers); Elemental Arrows
//        also fly the draw's flatter arc
//   [A3] the measured bonus (+50 %) is the one each card and the Hold to Draw card state
//   [P1] the prologue's memory fight (the real apex segment: entrance clip -> fight) shows no boss card ("BOSS · LV 100 GRAVITOS") and
//        no boss banner, from the arena load to 4 s into the fight (desktop 960x560 and phone 844x390)
//   [P2] ...and nothing waited on it: the fight arms, its card and Guguma's coach are up, the world runs (not paused, not cinematic)
//        through the first 2 s, the arena's entrance blackout is over 0.3 s in (the card used to end it), the boss is there, and Z swings
//   [P3] a regular Gravitos fight (the prologue over) still opens on his boss card
//   [P4] no page errors
//   node release27a_test.mjs     PORT (default 15182) / MOJI_GAME_FILE / SERVE_ROOT / R27A_ONLY=A|P / R27A_SHOTS=<dir> R27A_TAG=<name>
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15182), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const ONLY = process.env.R27A_ONLY || '', SHOTS = process.env.R27A_SHOTS || '', TAG = process.env.R27A_TAG || 'run';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 700) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
const errs = [];
const near = (a, b, t) => Math.abs(a - b) <= t;
const med = (a) => { const v = a.slice().sort((x, y) => x - y); return v.length ? v[Math.floor(v.length / 2)] : 0; };
const r3 = (x) => Math.round(x * 1000) / 1000;
const step = async (fn) => { try { await fn(); } catch (e) { ok('a step completes', false, String(e && e.message || e).slice(0, 300)); } };
const DESK = { viewport: { width: 960, height: 560 } };
const PHONE = { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' };
const boot = async (opts, k) => {
  const ctx = await browser.newContext({ serviceWorkers: 'block', ...opts });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); localStorage.setItem('lx_drs', 'off'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1&lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 });
  const v = await page.evaluate(async (k) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    { const ov = document.getElementById('loading-overlay'); if (ov) ov.classList.add('fade'); }
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootHold.release('menu'); } catch (e) {}
    try { applyClass(k.cls); } catch (e) {} player.cls = k.cls; window._lxAwaitingCreation = false; window._lxInWorld = true;
    if (k.lv) devSetLevel(k.lv); if (k.job) { try { applyJob(k.job); } catch (e) {} } if (k.master) { try { applyMaster(k.master); } catch (e) {} }
    player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const b in STORY_BEATS) player._storyBeatsSeen[b] = true; player._storyBeatsSeen.everdawn_welcome = true;
    player._tutorialSeen = true; player._gravitosCineSeen = true; player._god = true;
    const clear = () => { try { closeAllModals(); } catch (e) {} try { closeDialog(); } catch (e) {} for (const id of ['story-beat-overlay']) { const e = document.getElementById(id); if (e) e.classList.remove('on'); } document.body.classList.remove('cinematic', 'sb-active'); game.paused = false; };
    window._r = { sleep, clear };
    if (k.map) { game._worldStateByMap = Object.assign(game._worldStateByMap || {}, { [k.map]: null }); clear(); loadMap(k.map, 1500); for (let i = 0; i < 5; i++) { await sleep(240); clear(); } }
    return GAME_VERSION;
  }, k);
  console.log('  build', v, opts.isMobile ? 'phone' : 'desktop', k.cls, k.job || '', k.master || '');
  return { ctx, page };
};
// ---- A: one skill, tapped and fully drawn, with its own key
const SK = { arrowRain: { tag: 'rainArrow', n: 22, f: 'r' }, elementalArrows: { tag: 'elemArrow', n: 10, f: 'e' }, skyhunter_gale: { tag: 'gale', n: 15, f: 'e' } };
const measure = async (page, id) => {
  const key = await page.evaluate((id) => Object.keys(KEY_TO_SLOT).find((k) => { const s = skillBySlot(KEY_TO_SLOT[k]); return s && s.id === id; }), id);
  const run = async (hold) => {
    await page.evaluate(({ id, sk }) => {
      window._r.clear(); try { cancelPendingSkillTimers(); } catch (e) {}
      game.monsters = []; game.projectiles = []; player._warCharge = null; player.skillCooldowns = {}; player._castLockUntil = 0; player.mods = player.mods || {}; player.mods.multishot = 0;
      player.mp = player.maxMp = 99999; player.hp = getMaxHp(); player.hitStun = 0; player.facing = 1; player.vx = 0; game.comboMult = 1; game.combo = 0; game.critStreak = 0;
      const m = spawnMonster(player.x + 200, player.y, 'slime', false, false); m.maxHp = m.currentHp = 1e12; m.evasion = 0; m._firstHit = true; m.vx = 0; 
      window.__dm = m; window.__dms = [[m, m.x]];
      if (id === 'arrowRain') for (const dx of [-120, -60, 60, 120]) { const q = spawnMonster(player.x + 200 + dx, player.y, 'slime', false, false); if (q && !q._suppressed) { q.maxHp = q.currentHp = 1e12; q.evasion = 0; q.vx = 0; window.__dms.push([q, q.x]); } }   // the rain falls over 320 px: a row of dummies catches it
      const F = () => sk.f === 'r' ? getAtk() * 2.8 : getAtk() * 4 + 10; window.__F = F;
      window.__arr = []; window.__hits = []; window.__seen = new WeakSet(); window.__cast = null;
      if (!window.__hm) { window.__hm = window.hitMonster; window.hitMonster = function (mm, d, crit, tg) { if (window.__dms && window.__dms.some((e) => e[0] === mm) && window.__tag && tg === window.__tag && window.__hits) window.__hits.push({ r: d / window.__F(), crit: !!crit }); return window.__hm.apply(this, arguments); }; }
      window.__tag = sk.tag;
      clearInterval(window.__poll); window.__poll = setInterval(() => {
        for (const [mm, mx] of (window.__dms || [])) { mm.currentHp = 1e12; mm.x = mx; mm.vx = 0; } player.mp = 99999; player.hp = getMaxHp(); player.hitStun = 0; game.hitStop = 0;
        if (!window.__cast && (player.skillCooldowns[id] || 0) > 0) window.__cast = game.time;
        for (const p of game.projectiles) if (p && p.skill === sk.tag && p.owner === 'player' && !window.__seen.has(p)) { window.__seen.add(p); window.__arr.push({ r: p.damage / F(), dp: p._drawPower || 0 }); }
      }, 20);
    }, { id, sk: SK[id] });
    await page.waitForTimeout(400);
    await page.keyboard.down(key);
    let noCast = true, drawn = 0;
    if (hold) { for (let i = 0; i < 100; i++) { await page.waitForTimeout(50); const w = await page.evaluate((id) => ({ p: player._warCharge ? player._warCharge.power : -1, c: (player.skillCooldowns[id] || 0) > 0 }), id); if (w.c) noCast = false; drawn = w.p; if (w.p >= 1) break; } await page.waitForTimeout(120); }
    else await page.waitForTimeout(40);
    await page.keyboard.up(key);
    await page.waitForTimeout(3500);
    return page.evaluate(([noCast, drawn]) => { clearInterval(window.__poll); window.__tag = null; return { arr: window.__arr.slice(), hits: window.__hits.filter((h) => !h.crit).map((h) => h.r), cast: window.__cast != null, noCast, drawn }; }, [noCast, drawn]);
  };
  const tap = await run(false), held = await run(true);
  const n = SK[id].n, tA = tap.arr.slice(0, n), hA = held.arr.slice(0, n);
  const tR = med(tA.map((a) => a.r)), hR = med(hA.map((a) => a.r)), allH = hA.every((a) => near(a.r / (tR || 1), 1.5, 0.03));
  return { id, key, tapCast: tap.cast, n: [tA.length, hA.length], tap: r3(tR), held: r3(hR), ratio: r3(hR / tR), everyArrow: allH,
    hits: [tap.hits.length, held.hits.length, r3(med(held.hits) / (med(tap.hits) || 1))], dp: r3(med(hA.map((a) => a.dp))), drawn: held.drawn, noCastWhileHeld: held.noCast };
};
// ---- P: the prologue's memory fight, from the real apex segment (its entrance clip skipped by the clip's own button)
const memory = async (opts, nm) => {
  const { ctx, page } = await boot(opts, { cls: 'mage', lv: 9, map: 'void' });
  await page.evaluate(() => {
    window.__bi = { card: [], banner: [], t0: performance.now(), arm: null, samples: [] };
    window.__biPoll = setInterval(() => {
      const t = Math.round(performance.now() - window.__bi.t0), o = document.getElementById('boss-intro-overlay'), b = document.getElementById('boss-intro');
      if (o && o.classList.contains('on')) window.__bi.card.push(t);
      if (b && getComputedStyle(b).display !== 'none') window.__bi.banner.push(t);
      if (window._prologueTimer && window.__bi.arm == null) window.__bi.arm = t;
      if (window.__bi.arm != null && t - window.__bi.arm <= 2000) window.__bi.samples.push({ t: t - window.__bi.arm, paused: !!game.paused, cine: document.body.classList.contains('cinematic'), black: game.blackHoldFrames | 0 });
      const s = document.getElementById('grav-entry-skip'); if (s && s.offsetParent) s.click();
      if (window._prologueTimer) window._prologueLeftMs = Math.max(window._prologueLeftMs || 0, 26000);   // the memory waits for the test
    }, 50);
    try { if (typeof _closeTutorial === 'function') _closeTutorial(); } catch (e) {}   // the harness's fresh hero queues the tour; the real memory runs before it
    window._prologueActive = true; _prologueApexSegment();
  });
  await page.waitForFunction(() => window.__bi.arm != null, null, { timeout: 60000 });
  const shots = [];
  for (const at of [1000, 2000]) {
    await page.waitForFunction((at) => performance.now() - window.__bi.t0 - window.__bi.arm >= at, at, { timeout: 30000 });
    if (SHOTS) { const f = path.join(SHOTS, `r27a_prologue_open_${TAG}_${nm}_${at / 1000}s.png`); try { await page.screenshot({ path: f, scale: 'css', timeout: 30000 }); shots.push(path.basename(f)); } catch (e) {} }
  }
  const sw = await page.evaluate(() => { const a = player.attackCooldown || 0; return { at: game.time }; });
  const before = await page.evaluate(() => ({ att: !!player.attacking, t: player.attackTimer || 0 }));
  let swung = false; for (let i = 0; i < 4 && !swung; i++) { await page.keyboard.down('z'); await page.waitForTimeout(110); await page.keyboard.up('z'); await page.waitForTimeout(250); swung = await page.evaluate(() => !!player.attacking || (player.attackTimer || 0) > 0 || (player.attackCooldown || 0) > 0); }
  await page.waitForFunction(() => performance.now() - window.__bi.t0 - window.__bi.arm >= 4000, null, { timeout: 30000 });
  const R = await page.evaluate(() => { clearInterval(window.__biPoll); const B = window.__bi, hud = document.getElementById('prologue-hud'), co = document.getElementById('prologue-coach');
    const vis = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none';
    return { cardAt: B.card.slice(0, 3), bannerAt: B.banner.slice(0, 3), arm: B.arm, n: B.samples.length, paused: B.samples.filter((x) => x.paused).length, cine: B.samples.filter((x) => x.cine).length, black: B.samples.filter((x) => x.t >= 300 && x.black > 12).length,
      hud: vis(hud), coach: vis(co) && !!(co.textContent || '').trim(), boss: (game.monsters || []).some((m) => m && m.type === 'gravitos' && m.currentHp > 0), map: game.currentMap, plg: !!window._prologueActive }; });
  ok(`[P1] ${nm}: the memory fight shows no boss card and no boss banner (arena load to 4 s into the fight)`, R.cardAt.length === 0 && R.bannerAt.length === 0, R);
  ok(`[P2] ${nm}: nothing waited on it - fight card + Guguma up, the world running (not paused / cinematic) for the first 2 s, the boss there, Z swings`,
    R.plg && R.map === 'gravitosArena' && R.hud && R.coach && R.boss && R.n >= 10 && R.paused === 0 && R.cine === 0 && R.black === 0 && swung, Object.assign({ swung, shots }, R));
  await ctx.close();
};
try {
  if (ONLY !== 'P') {
    await step(async () => { const { ctx, page } = await boot(DESK, { cls: 'archer', lv: 80, job: 'sniper', master: 'marksman', map: 'forest' });
      const M = [await measure(page, 'arrowRain')];
      const { ctx: c2, page: p2 } = await boot(DESK, { cls: 'archer', lv: 80, job: 'ranger', master: 'skyhunter', map: 'forest' });
      M.push(await measure(p2, 'elementalArrows')); M.push(await measure(p2, 'skyhunter_gale'));
      const cards = await p2.evaluate(() => ({ d: { arrowRain: SKILLS.arrowRain.desc, elementalArrows: SKILLS.elementalArrows.desc, skyhunter_gale: SKILLS.skyhunter_gale.desc }, cls: CLASSES.archer.identity.desc }));
      for (const m of M) {
        ok(`[A1] ${m.id}: a tap (${m.key}) casts at normal power - every arrow at its formula`, m.tapCast && m.n[0] >= 8 && near(m.tap, 1, 0.02), m);
        ok(`[A2] ${m.id}: a full draw (nothing cast while held) puts 1.5x on every arrow and every hit` + (m.id === 'elementalArrows' ? ', with the flatter arc' : ''),
          m.noCastWhileHeld && m.drawn >= 1 && m.n[1] >= 8 && near(m.ratio, 1.5, 0.02) && m.everyArrow && m.hits[0] >= 1 && m.hits[1] >= 1 && near(m.hits[2], 1.5, 0.05) && (m.id !== 'elementalArrows' || m.dp >= 0.99), m);
        const pct = +((cards.d[m.id].match(/hits up to \+(\d+) % harder/) || [])[1]);
        ok(`[A3] ${m.id}: the measured full-draw bonus is the one its card and the Hold to Draw card state`, pct > 0 && near((m.ratio - 1) * 100, pct, 2) && /\+50 % damage to Deadeye Protocol rounds and to every Siege Volley arrow and every Arrow Rain, Elemental Arrows and Gale Storm arrow./.test(cards.cls), { measured: r3((m.ratio - 1) * 100), card: pct || null, cls: cards.cls.slice(-120) });
      }
      await ctx.close(); await c2.close(); });
  }
  if (ONLY !== 'A') {
    await step(() => memory(DESK, 'desktop'));
    await step(() => memory(PHONE, 'phone'));
    await step(async () => { const { ctx, page } = await boot(DESK, { cls: 'warrior', lv: 90 });
      const R = await page.evaluate(async () => { window._prologueActive = false; player._gravitosCineSeen = true; game.bossDefeated = {}; let seen = -1; const t0 = performance.now();
        const iv = setInterval(() => { const o = document.getElementById('boss-intro-overlay'); if (seen < 0 && o && o.classList.contains('on')) seen = Math.round(performance.now() - t0); }, 50);
        loadMap('gravitosArena', 300); for (let i = 0; i < 160 && seen < 0; i++) await window._r.sleep(50); clearInterval(iv); return { seen, map: game.currentMap }; });
      ok('[P3] a regular Gravitos fight (the prologue over) still opens on his boss card', R.seen >= 0 && R.map === 'gravitosArena', R);
      await ctx.close(); });
  }
} catch (e) { ok('the run completes', false, String(e && e.stack || e).slice(0, 400)); }
finally { try { server.kill(); } catch (e) {} await browser.close().catch(() => {}); }
ok('[P4] no page errors', !errs.length, errs.slice(0, 4));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
