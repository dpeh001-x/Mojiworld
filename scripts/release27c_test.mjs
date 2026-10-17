// RELEASE 27c (co-op endgame) stays fixed - REAL parties of 2-3 clients on the local relay (mp/server.mjs, which also serves the game):
//   [1] Gravitos's wheel is not thrown away by the ending: the host (seen the form films) kills form 3 while the guest (has not) is still
//       in a film; the guest's wheel never opens while an ending film / card / credits are up, survives Titles, opens after, and pays
//   [2] the Hall of Echoes for the party: guests follow the host's echo count, the host leaves mid-rush and a guest carries the run on,
//       and every guest gets its own results card + payout + reward day
//   [3] a boss's calls reach the guest: a star's desperation warning (toast + charging motes) before the hit, the forwarded mechanic
//       toasts (same words, once), none for a guest on another map, none for the host's personal calls
//   [4] phone: the chat log is not over the boss bar, fades when quiet, returns with a new line (R27C_SHOT=<prefix> saves the phone shot)
//   [5] a won fight stops the bleed: a downed guest stays down (no death, no toll) 40 s after the kill, gets the wheel, a partner lifts
//       them; on a second map nobody lifts them and the party leaves -> they stand up where they lie, no toll
//   node release27c_test.mjs     PORT (relay; default 15721) / MOJI_GAME_FILE / SERVE_ROOT; ONLY=1,2,...
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15721), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const URL = `http://localhost:${PORT}/${FILE}?dev=1&lxhold=0`, WS = `ws://localhost:${PORT}`;
const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 600) + ']' : '')); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const on = (k) => !process.env.ONLY || process.env.ONLY.split(',').includes(k);
const relay = spawn(process.execPath, [path.join(ROOT, 'mp', 'server.mjs')], { cwd: path.join(ROOT, 'mp'), env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'] });
console.log('  relay pid ' + relay.pid);
await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('relay did not start')), 15000); relay.stdout.on('data', (d) => { if (String(d).includes('MP relay')) { clearTimeout(t); res(); } }); relay.on('exit', (c) => { clearTimeout(t); rej(new Error('relay exited ' + c)); }); });
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'] });
try { console.log('  browser pid ' + browser.process().pid); } catch (e) {}
const errs = [];
// every page: its toasts, wheel offers, kills, deaths and a hero / scene helper
const hooks = () => {
  if (window.__hk) return; window.__hk = 1;
  window.__toasts = []; const _st0 = window.showToast; window.showToast = function (t) { try { window.__toasts.push([Date.now(), String(t).slice(0, 160)]); if (window.__toasts.length > 400) window.__toasts.splice(0, 100); } catch (e) {} return _st0.apply(this, arguments); };
  window.__offers = []; const _sp = window.showPowerupChoice; window.showPowerupChoice = function (bi) { try { window.__offers.push([Date.now(), String((bi && bi.name) || '')]); } catch (e) {} return _sp.apply(this, arguments); };
  window.__deaths = 0; const _td = window.triggerDeath; window.triggerDeath = function () { window.__deaths++; return _td.apply(this, arguments); };
  window.__wheelUnder = []; window.__opens = 0; let _was = false;
  setInterval(() => { try { const pm = document.getElementById('powerup-modal'), up = !!(pm && pm.style.display === 'flex'); if (up && !_was) window.__opens++; _was = up;
    if (up) { const vis = (el) => !!(el && el.getClientRects().length && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden');
      const cov = [...document.querySelectorAll('[id$="-cine"], .lx-ending-card')].filter(vis).map((e) => e.id || e.className); const gc = document.getElementById('game-complete-overlay');
      if (gc && gc.classList.contains('on')) cov.push('credits'); if (document.getElementById('kill-film-overlay')) cov.push('kill-film'); if (document.getElementById('titles-modal')) cov.push('titles');
      if (cov.length) window.__wheelUnder.push(cov.join(',')); } } catch (e) {} }, 100);
  const sl = (ms) => new Promise((r) => setTimeout(r, ms));
  const clear = () => { try { if (typeof _dismissBossIntro === 'function') _dismissBossIntro(); } catch (e) {} try { closeAllModals(); } catch (e) {} try { closeDialog(); } catch (e) {} for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const e = document.getElementById(id); if (e) e.classList.remove('on'); } { const tm = document.getElementById('tutorial-modal'); if (tm && getComputedStyle(tm).display !== 'none') try { _closeTutorial(true); } catch (e) {} } game.paused = false; };
  window._h = { sleep: sl, clear,
    hero: (lv, o) => { o = o || {}; const hold = o.hold || [], up = o.up || [], unsee = o.unsee || [];
      devSetLevel(lv); player.exp = 0; player.expToNext = _lxLevelCost(lv); player.quests = { active: {}, completed: {}, unlocked: {} }; _ensureQuests(); game.qnav = null; game.qnavPins = [];
      for (const id of _QUEST_STORY_CHAIN) if (hold.indexOf(id) < 0) player.quests.completed[id] = Date.now() - 864e5;
      for (const id in QUESTS) if (QUESTS[id] && QUESTS[id].critical && hold.indexOf(id) < 0) player.quests.completed[id] = Date.now() - 864e5;
      player.dawnFragments = ['frag_smith', 'frag_aetherion', 'frag_hourglass', 'frag_aries', 'frag_vigil'];
      game.bestiary = game.bestiary || {}; game.bestiary.aetherion = 1; game.bestiary.miraFallen = 1; player._lxTwelveLegacy = 0;
      for (const z of ZODIAC_SIGNS) { if (up.indexOf(z.id) < 0) game.bestiary['_boss_zodiac_' + z.id] = 1; else delete game.bestiary['_boss_zodiac_' + z.id]; }
      player._storyBeatsSeen = {}; for (const k in STORY_BEATS) if (unsee.indexOf(k) < 0) player._storyBeatsSeen[k] = true;
      player._tutorialSeen = true; player._gravitosCineSeen = !o.cine; delete player._lxBeatsOwed; delete player._lxEndingDue;
      player.boons = []; player.boonsEquipped = []; game._lxBoonOwed = null; game._pendingBossBoon = null;
      player.hp = getMaxHp(); player.mp = getMaxMp(); },
    go: async (map, x) => { clear(); game.visitedMaps = game.visitedMaps || {}; game.visitedMaps[map] = true; game._worldStateByMap = Object.assign(game._worldStateByMap || {}, { [map]: null }); loadMap(map, x || 300); await sl(900); clear(); },
    boss: () => (game.monsters || []).find((m) => m && (m.isBoss || m.boss || m.zodiacBoss) && !m._isLeg && m.currentHp > 0) || null };
};
async function boot(o) {
  const phone = !!o.phone;
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: phone ? { width: 844, height: 390 } : { width: 960, height: 560 }, ...(phone ? { isMobile: true, hasTouch: true, deviceScaleFactor: 1, userAgent: UA } : {}) });
  await ctx.addInitScript((ws) => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); localStorage.setItem('levelx_mp_url', ws); localStorage.setItem('lx_drs', 'off'); } catch (e) {} }, WS);
  const page = await ctx.newPage(); page._phone = phone; page._name = o.name;
  page.on('pageerror', (e) => errs.push(o.name + ': ' + String(e.message).slice(0, 160)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function' && typeof mpConnect === 'function', null, { timeout: 240000 });
  await page.evaluate((src) => { (0, eval)('(' + src + ')')(); }, hooks.toString());
  const v = await page.evaluate(async (o) => { const sl = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    { const ov = document.getElementById('loading-overlay'); if (ov) ov.classList.add('fade'); }
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootHold.release('menu'); } catch (e) {}
    applyClass(o.cls); if (player.look) player.look.name = o.name; player.name = o.name;
    window._h.hero(o.lv || 85, o.hero || {});
    await sl(1200); { const am = document.getElementById('advancement-modal'); if (am) am.style.display = 'none'; } try { closeAllModals(); } catch (e) {}
    await sl(300); player.hp = getMaxHp(); player.mp = getMaxMp(); window._h.clear();
    return GAME_VERSION + ' ' + player.cls + ' Lv' + player.level;
  }, o);
  console.log('  boot', o.name, phone ? 'phone' : 'desk', v);
  return { ctx, page };
}
const ev = (p, fn, arg) => p.evaluate(fn, arg);
const until = async (p, fn, arg, ms = 8000) => { const t0 = Date.now(); for (;;) { let r; try { r = await p.evaluate(fn, arg); } catch (e) { r = null; } if (r || Date.now() - t0 > ms) return r; await sleep(250); } };
const key = async (p, k, ms = 90) => { await p.keyboard.down(k); await sleep(ms); await p.keyboard.up(k); await sleep(50); };
const center = (p, sel) => p.evaluate((s) => { const el = document.querySelector(s); if (!el) return null; const b = el.getBoundingClientRect(); if (!b.width) return null; return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
const tap = async (p, sel) => { const c = await center(p, sel); if (!c) return false; if (p._phone) await p.touchscreen.tap(c.x, c.y); else await p.mouse.click(c.x, c.y); return true; };
// a party: members boot in parallel, connect in order (the first is the host), all walk onto `map`
async function party(members, map, room, pre) {
  const R = await Promise.all(members.map((o) => boot(o)));
  const P = R.map((r) => r.page), C = R.map((r) => r.ctx);
  if (pre) for (let i = 0; i < P.length; i++) await ev(P[i], pre, members[i].name);
  room = room + Math.floor(Math.random() * 1e5);
  for (const p of P) { await ev(p, ({ ws, room, nm }) => mpConnect(ws, nm, room), { ws: WS, room, nm: p._name }); await until(p, () => net.connected && net.myId != null, null, 15000); await sleep(400); }
  await sleep(1500);
  if (map) { await ev(P[0], (m) => window._h.go(m, 300), map); await sleep(1500);
    await Promise.all(P.slice(1).map((p, i) => ev(p, ({ m, x }) => window._h.go(m, x), { m: map, x: 260 + 60 * i }))); await sleep(4000); }
  return { P, C, room };
}
const closeParty = async (C) => { for (const c of C) { try { await c.close(); } catch (e) {} } };
const killBoss = (p, hpLeft) => p.evaluate((h) => { const b = window._h.boss(); if (!b || b._coopMirror) return null; b.evasion = 0; b.def = 0; if (h != null) { b.currentHp = Math.min(b.currentHp, h); return b.currentHp; } try { b.currentHp = 1; hitMonster(b, 1e7); } catch (e) {} if (b.currentHp > 0 && game.monsters.includes(b)) try { killMonster(b); } catch (e) {} return b.type; }, hpLeft);

// ---- [1] the Gravitos wheel and the ending
if (on('1')) {
  const HO = { hold: ['q_boss_gravitos'], unsee: ['epilogue_gravitos', 'gravitos_reason'] };
  const { P, C } = await party([{ name: 'Ann', cls: 'warrior', lv: 92, hero: HO }, { name: 'Cat', cls: 'archer', lv: 90, hero: Object.assign({ cine: true }, HO) }], 'gravitosArena', 'R27C1',
    (nm) => { try { acceptQuest('q_boss_gravitos', true); } catch (e) {} player._god = true; if (nm === 'Ann') { player._storyBeatsSeen.gravitos_awaken = true; player._storyBeatsSeen.gravitos_ascend = true; } });
  const [A, G] = P;
  await ev(A, () => window._h.clear());
  // the host ends all three forms while the guest is still in its entrance / form films
  for (let form = 1; form <= 3; form++) {
    const ph0 = await ev(A, () => { const b = window._h.boss(); return b ? (b._gravitosPhase || 1) : 0; });
    for (let i = 0; i < 40; i++) { const r = await ev(A, () => { const b = window._h.boss(); if (!b) return 'gone'; b.evasion = 0; b.def = 0; b.currentHp = Math.min(b.currentHp, 300); try { hitMonster(b, 1e6); } catch (e) {} return b._gravitosPhase || 1; });
      if (r === 'gone' || r !== ph0) break; await sleep(500); }
    await sleep(form < 3 ? 2500 : 500); if (form < 3) await ev(A, () => window._h.clear());
  }
  const gone = await until(A, () => !window._h.boss(), null, 10000);
  ok('[1] the host ended form 3', !!gone);
  // the guest plays its ending with real input; the host just takes its own wheel
  const t0 = Date.now(); let titlesSeen = false, last = ''; const seq = [];
  while (Date.now() - t0 < 170000) {
    await ev(A, () => { const pm = document.getElementById('powerup-modal'); if (pm && pm.style.display === 'flex') { const c = document.querySelector('#powerup-options .powerup-card'); if (c) c.click(); } }).catch(() => {});
    const b = await ev(G, () => { const vis = (el) => !!(el && el.getClientRects().length && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden' && +getComputedStyle(el).opacity > 0.05);
      if (document.getElementById('titles-modal')) return 'titles';
      const gc = document.getElementById('game-complete-overlay'); if (gc && gc.classList.contains('on')) return vis(document.getElementById('gc-close')) ? 'credits-btn' : 'credits';
      const sk = [...document.querySelectorAll('[id$="-skip"]')].find((e) => vis(e) && e.id !== 'tut-skip' && e.id !== 'coop-downed-skip'); if (sk) return 'skip:' + sk.id;
      if ([...document.querySelectorAll('.lx-ending-card')].some(vis)) return 'card';
      const sb = document.getElementById('story-beat-overlay'); if (sb && sb.classList.contains('on')) return 'beat';
      const pm = document.getElementById('powerup-modal'); if (pm && pm.style.display === 'flex') return 'wheel';
      if ((player.boons || []).length) return 'done';
      return game._lxBoonOwed ? 'owed' : 'none'; }).catch(() => 'err');
    if (b !== last) { console.log('  [1] guest: ' + b + ' @' + Math.round((Date.now() - t0) / 1000) + 's'); last = b; seq.push(b); }
    if (b === 'done') break;
    if (b === 'titles') { titlesSeen = true; await sleep(1500); await tap(G, '#tt-close'); await sleep(800); continue; }
    if (b === 'credits-btn') { await sleep(800); await tap(G, '#gc-close'); await sleep(1200); continue; }
    if (b.startsWith('skip:')) { await sleep(1300); await tap(G, '#' + b.slice(5)); await sleep(700); continue; }
    if (b === 'card' || b === 'beat') { await sleep(1300); await key(G, 'Enter'); await sleep(600); continue; }
    if (b === 'wheel') { await sleep(600); await key(G, '1', 80); await sleep(900); continue; }
    if (b === 'none' && titlesSeen && Date.now() - t0 > 60000) { await sleep(4000); const again = await ev(G, () => (player.boons || []).length || (document.getElementById('powerup-modal').style.display === 'flex')); if (!again) break; }
    await sleep(500);
  }
  const g = await ev(G, () => ({ boons: (player.boons || []).length, owed: game._lxBoonOwed ? game._lxBoonOwed.name : null, under: [...new Set(window.__wheelUnder)].slice(0, 6), offers: window.__offers.map((o) => o[1]), opens: window.__opens, ending: !!(player._storyBeatsSeen || {}).epilogue_gravitos }));
  const a = await ev(A, () => ({ boons: (player.boons || []).length }));
  ok('[1] the guest\'s ending ran to the credits and Titles', titlesSeen && g.ending, { titlesSeen, ending: g.ending });
  ok('[1] the guest\'s wheel never opened under an ending film, card, the credits or Titles', g.under.length === 0 && g.opens >= 1, g);
  ok('[1] the guest\'s wheel waited for the credits AND Titles (it never came up between them)', seq.indexOf('titles') >= 0 && seq.indexOf('wheel') > seq.indexOf('titles'), seq.filter((x) => !/^(owed|none)$/.test(x)).slice(-8));
  ok('[1] the guest\'s Gravitos boon was paid (not thrown away by Titles)', g.boons >= 1 && !g.owed, g);
  ok('[1] the host\'s own wheel paid too', a.boons >= 1, a);
  await closeParty(C);
}

// ---- [2] the Hall of Echoes for the party
if (on('2')) {
  const ROSTER = ['king', 'mooma'];
  const { P, C } = await party([{ name: 'Ann', cls: 'warrior', lv: 85 }, { name: 'Bob', cls: 'mage', lv: 86 }, { name: 'Cat', cls: 'archer', lv: 84 }], null, 'R27C2',
    () => { player._god = true; });
  for (const p of P) await ev(p, (R) => { game.mojidexSeen = {}; for (const t of R) game.mojidexSeen[t] = true; game._bossRushRewardDay = -1; game.bossRush = null; game.bossRushBest = null; }, ROSTER);
  const [A, B, Cc] = P;
  const rush = (p) => p.evaluate(() => { const br = game.bossRush, hud = document.getElementById('boss-rush-hud'), res = document.getElementById('boss-rush-results'), b = window._h.boss();
    return { a: br ? br.active : null, idx: br ? br.idx : -1, downs: br ? br.downs : -1, q: br ? br.queue.length : 0, hud: hud ? hud.textContent : null, res: res ? res.textContent.slice(0, 40) : null, shards: player.setshards || 0, day: game._bossRushRewardDay,
      boss: b ? { t: b.type, mir: !!b._coopMirror, rush: !!b._rushBoss } : null, host: net.isHost }; });
  await ev(A, () => window._h.go('boss_rush', 300)); await sleep(1500);
  await ev(B, () => window._h.go('boss_rush', 260)); await ev(Cc, () => window._h.go('boss_rush', 320));
  const s0 = [await until(A, () => window._h.boss() && game.bossRush, null, 15000) && await rush(A), await rush(B), await rush(Cc)];
  for (const p of P) await ev(p, () => { try { _dismissBossIntro(); } catch (e) {} game.paused = false; });
  const shards0 = [s0[1].shards, s0[2].shards];
  await killBoss(A);
  await until(B, () => game.bossRush && game.bossRush.idx >= 1, null, 8000); await until(Cc, () => game.bossRush && game.bossRush.idx >= 1, null, 4000);
  await sleep(700);   // the HUD repaints every 250 ms
  const s1 = [await rush(A), await rush(B), await rush(Cc)];
  ok('[2] after the first echo the guests count it with the host (idx, downs, HUD)', s1[0].idx === 1 && s1.every((r) => r.a && r.idx === 1 && r.downs === 1 && r.q === s1[0].q && /1\//.test(r.hud || '')), s1.map((r) => [r.idx, r.downs, r.q, r.hud]));
  // the next echo comes up on the host; then the host leaves the hall for good
  await until(A, () => !!window._h.boss(), null, 10000); await sleep(1500);
  for (const p of P) await ev(p, () => { try { _dismissBossIntro(); } catch (e) {} game.paused = false; });
  await C[0].close();
  // the guests carry on: whoever runs the hall now lays the remaining echoes to rest
  const t0 = Date.now(); let lead = null;
  while (Date.now() - t0 < 90000) {
    const r = [await rush(B), await rush(Cc)];
    if (r.every((x) => x.a === false && x.res)) break;
    for (const [i, p] of [[0, B], [1, Cc]]) { if (r[i].boss && !r[i].boss.mir) { if (!lead) lead = p._name; await ev(p, () => { try { _dismissBossIntro(); } catch (e) {} game.paused = false; }); await killBoss(p); } }
    await sleep(1500);
  }
  const s2 = [await rush(B), await rush(Cc)];
  ok('[2] a guest took the hall over when the host left (the echo on the floor or the next one was its own)', !!lead, { lead });
  ok('[2] both guests finished the run with every echo counted', s2.every((r) => r.a === false && r.downs === r.q && r.q === s1[0].q), s2.map((r) => [r.a, r.idx, r.downs, r.q]));
  ok('[2] both guests got their own results card', s2.every((r) => /RUSH COMPLETE/i.test(r.res || '')), s2.map((r) => r.res));
  ok('[2] both guests were paid and stamped the day (their own once-per-day rule)', s2.every((r, i) => r.shards >= shards0[i] + 500 && typeof r.day === 'number' && r.day > 0), s2.map((r, i) => [shards0[i], r.shards, r.day]));
  await closeParty(C.slice(1));
}

// ---- [3] a boss's calls reach the guest
if (on('3')) {
  const H = { hold: ['q_zodiac_twelve', 'q_boss_gravitos'], up: ['leo'] };
  const { P, C } = await party([{ name: 'Ann', cls: 'warrior', lv: 85, hero: H }, { name: 'Bob', cls: 'mage', lv: 86, hero: H }], 'zod_leo', 'R27C3', () => { player._god = true; });
  const [A, B] = P;
  for (const p of P) await ev(p, () => window._h.clear());
  const bossOk = await until(B, () => { const b = window._h.boss(); return b && b._coopMirror; }, null, 10000);
  ok('[3] the guest mirrors the star', !!bossOk);
  // (a) phase / enrage calls raised by the host's boss AI
  const tA = Date.now();
  await ev(A, () => { const b = window._h.boss(); b.currentHp = Math.floor(b.maxHp * 0.2); b._despCD = 99999; });
  await sleep(5000);
  const said = await ev(A, (t) => window.__toasts.filter((x) => x[0] >= t && typeof _lxBossSayOk === 'function' && _lxBossSayOk(x[1])).map((x) => x[1]), tA);
  // (a call raised just before the snapshot is still on the wire - the local relay also serves art and delays frames up to ~1 s)
  await until(B, ({ t, s }) => { const h = window.__toasts.filter((x) => x[0] >= t).map((x) => x[1]); return s.every((x) => h.includes(x)); }, { t: tA, s: said }, 4000);
  await sleep(1500);
  const heard = await ev(B, (t) => window.__toasts.filter((x) => x[0] >= t).map((x) => x[1]), tA);
  ok('[3] the host\'s phase / enrage calls reached the guest in the same words', said.length > 0 && said.every((t) => heard.includes(t)), { said, heard: heard.slice(-8) });
  ok('[3] ...each once', said.every((t) => heard.filter((h) => h === t).length === 1), heard.slice(-8));
  // (b) the desperation windup: the guest is warned (toast + charging motes) before the move lands
  await ev(A, () => { window.__df = []; const b = window._h.boss(); let st = null; window.__dfI = setInterval(() => { try { const s = b._despState || null; if (s !== st) { window.__df.push([Date.now(), s, b._despMove]); st = s; } } catch (e) {} }, 20); });
  await ev(B, () => { window.__mote = 0; window.__moteI = setInterval(() => { try { for (const q of game.particles || []) if ((q.color === '#66aaff' || q.color === '#ff4466') && !q.__c) { q.__c = 1; window.__mote++; } } catch (e) {} }, 50); });
  const tB = Date.now();
  await ev(A, () => { const b = window._h.boss(); b._despCD = 1; b._despState = null; b._zSpentMs = 0; });
  // the windup is 1.5 s of SIM time (dt-counted): a slow headless sim stretches it, so wait for the host's fire, not a fixed time
  await until(A, () => window.__df.some((x, i) => i > 0 && x[1] === null && window.__df[i - 1][1] === 'warning'), null, 20000);
  await sleep(500);
  const df = await ev(A, () => window.__df);
  const warn = df.find((x) => x[1] === 'warning'), fire = df.find((x, i) => i > 0 && x[1] === null && df[i - 1][1] === 'warning');
  const gw = await ev(B, (t) => ({ w: window.__toasts.filter((x) => x[0] >= t && /HEAVENSPLIT incoming|MANA REND incoming/.test(x[1])), mote: window.__mote }), tB);
  ok('[3] the guest got the desperation warning once, before the move fired', !!(warn && fire && gw.w.length === 1 && gw.w[0][0] < fire[0] - 300), { warn, fire, gw });
  ok('[3] ...with the host\'s wording', !!(gw.w[0] && /^\S+ Leo — (HEAVENSPLIT|MANA REND) incoming!$/.test(gw.w[0][1])), gw.w);
  ok('[3] ...and the charging motes over the guest\'s mirror', gw.mote >= 3, gw);
  // (c) the forwarder: a mechanic call reaches a partner on the map, a personal call does not, nor a partner elsewhere
  const tC = Date.now();
  await ev(A, () => { showToast('🌊 TIDAL SWEEP — JUMP IT!', 'legendary'); showToast('⚖ Sin 3/5', 'rare'); });
  await sleep(2500);
  const hc = await ev(B, (t) => window.__toasts.filter((x) => x[0] >= t).map((x) => x[1]), tC);
  ok('[3] a mechanic call reaches the guest; the host\'s personal call does not', hc.includes('🌊 TIDAL SWEEP — JUMP IT!') && !hc.includes('⚖ Sin 3/5'), hc);
  const named = await ev(B, () => typeof _lxBossSayOk === 'function' && ['⚖ Libra summons two Scale Stormcallers — break BOTH to drop her defense!', '⚖ Libra — UNBALANCED! Cross the center line!', '💢 Leo ENRAGED — final stand!', '♌ Leo — Phase 3!'].every(_lxBossSayOk));
  ok('[3] Libra\'s two calls, ENRAGED and Phase are on the forwarded list', named);
  await ev(B, () => window._h.go('forest', 300)); await sleep(2000);
  const tD = Date.now();
  await ev(A, () => { showToast('🦖 LEGOSAURUS — EARTHQUAKE! Jump!', 'epic'); });
  await sleep(2500);
  const hd = await ev(B, (t) => window.__toasts.filter((x) => x[0] >= t).map((x) => x[1]), tD);
  ok('[3] a partner on another map hears nothing', !hd.some((t) => /LEGOSAURUS/.test(t)), hd);
  await closeParty(C);
}

// ---- [4] phone: the chat log and the boss bar
if (on('4')) {
  const H = { hold: ['q_zodiac_twelve', 'q_boss_gravitos'], up: ['libra'] };
  const { P, C } = await party([{ name: 'Ann', cls: 'warrior', lv: 85, hero: H }, { name: 'Cat', cls: 'archer', lv: 84, hero: H, phone: true }], 'zod_libra', 'R27C4', () => { player._god = true; });
  const [A, G] = P;
  for (const p of P) await ev(p, () => window._h.clear());
  await until(G, () => game._superBossRef && game._lxBossPlateBox, null, 10000); await sleep(1500);
  const meas = () => G.evaluate(() => { const el = document.getElementById('mp-chat-log'), w = document.querySelector('.game-wrapper'); const bx = game._lxBossPlateBox;
    if (!el || !w || !bx) return null; const r = el.getBoundingClientRect(), wr = w.getBoundingClientRect(), k = wr.width / W;
    const plate = { l: wr.left + bx[0] * k, r: wr.left + bx[1] * k, b: wr.top + bx[2] * k };
    const over = r.width > 0 && el.style.display !== 'none' && r.left < plate.r && r.right > plate.l && r.top < plate.b;
    return { log: [r.left | 0, r.top | 0, r.right | 0, r.bottom | 0], plate: [plate.l | 0, plate.r | 0, plate.b | 0], over, op: +getComputedStyle(el).opacity, shown: el.style.display !== 'none' && !el.classList.contains('hud-collapsed'), lines: el.children.length }; });
  const m0 = await meas();
  if (process.env.R27C_SHOT) await G.screenshot({ path: process.env.R27C_SHOT + '_fight.png' });
  ok('[4] phone: the chat log is up in the party boss fight', !!(m0 && m0.shown && m0.lines > 0), m0);
  ok('[4] phone: the chat log does not cover the boss bar', !!(m0 && !m0.over), m0);
  await sleep(9500);
  const m1 = await meas();
  ok('[4] phone: the quiet log fades', !!(m1 && m1.op < 0.1), m1);
  await ev(A, () => _mpSendChat('focus the left scale'));
  await sleep(2000);
  const m2 = await meas();
  if (process.env.R27C_SHOT) await G.screenshot({ path: process.env.R27C_SHOT + '_chat.png' });
  ok('[4] phone: a new line brings it back, still clear of the bar', !!(m2 && m2.op > 0.9 && !m2.over), m2);
  await closeParty(C);
}

// ---- [5] a won fight stops the bleed
if (on('5')) {
  const { P, C } = await party([{ name: 'Ann', cls: 'warrior', lv: 85 }, { name: 'Bob', cls: 'mage', lv: 80 }], 'slimeCave', 'R27C5', () => { player._god = true; });
  const [A, B] = P;
  for (const p of P) await ev(p, () => window._h.clear());
  await until(B, () => { const b = window._h.boss(); return b && b._coopMirror; }, null, 10000);
  const goDown = () => ev(B, () => { player._god = false; player._noDownUntil = 0; player._coopReviveMapAt = {}; window.__w0 = { exp: player.exp, lv: player.level, coins: player.mojicoins || 0, shards: player.setshards || 0, offers: window.__offers.length }; const r = _coopTryDowned(); return { r, downed: !!player._downed, rev: !!player._downRevivable }; });
  const d1 = await goDown();
  ok('[5] the guest goes down beside a partner (revivable)', d1.downed && d1.rev, d1);
  await killBoss(A);
  const t0 = Date.now(); let st = null;
  while (Date.now() - t0 < 40000) {
    st = await ev(B, () => { const pm = document.getElementById('powerup-modal'); const bn = document.getElementById('coop-downed-banner');
      return { downed: !!player._downed, hp: Math.round(player.hp), map: game.currentMap, deaths: window.__deaths, dying: !!game.dying, wheel: !!(pm && pm.style.display === 'flex'), card: bn ? bn.textContent.replace(/\s+/g, ' ').slice(0, 120) : null,
        exp: player.exp, lv: player.level, coins: player.mojicoins || 0, shards: player.setshards || 0, offers: window.__offers.length - window.__w0.offers, w0: window.__w0 }; });
    if (st.wheel) { await sleep(500); await key(B, '1', 80); }
    if (!st.downed || st.deaths) break;
    await sleep(1000);
  }
  const notCharged = st && (st.lv > st.w0.lv || st.exp >= st.w0.exp) && st.coins >= st.w0.coins;
  ok('[5] 40 s after the kill the guest is still down, alive, unharmed by what is left, on the map', !!(st && st.downed && st.hp >= 1 && !st.deaths && !st.dying && st.map === 'slimeCave'), st);
  ok('[5] ...not charged a death toll', !!(notCharged && !st.deaths), st);
  ok('[5] ...the card says the fight is won', !!(st && /fight is won/i.test(st.card || '')), st && st.card);
  ok('[5] ...and still got the kill\'s wheel / credit', !!(st && (st.offers >= 1 || st.shards > st.w0.shards)), st && { offers: st.offers, shards: [st.w0.shards, st.shards] });
  // a partner lifts them
  // (the host takes its own wheel first - a wheel pauses its world, and a paused partner channels nothing), then stands on the body
  await ev(A, () => { const pm = document.getElementById('powerup-modal'); if (pm && pm.style.display === 'flex') { const c = document.querySelector('#powerup-options .powerup-card'); if (c) c.click(); } window._h.clear();
    if (window.__pin) clearInterval(window.__pin); const t0 = Date.now();
    window.__pin = setInterval(() => { try { const id = Object.keys(net.peers).find((k) => net.peers[k] && net.peers[k]._downed); const p = id && net.peers[id]; if (p) { player.x = p.x; player.y = p.y; player.vx = 0; } game.paused = false; if (Date.now() - t0 > 12000) clearInterval(window.__pin); } catch (e) {} }, 100); });
  const up = await until(B, () => !player._downed && player.hp > 1, null, 9000);
  const u = await ev(B, () => ({ downed: !!player._downed, hpPct: Math.round(100 * player.hp / getMaxHp()), deaths: window.__deaths, map: game.currentMap }));
  ok('[5] a partner lifts them (team revive), no death', !!up && !u.deaths && u.map === 'slimeCave', u);
  // second map: nobody lifts them and the party leaves -> they stand up where they lie, no toll
  await ev(A, () => window._h.go('boss', 300)); await sleep(1000); await ev(B, () => window._h.go('boss', 360)); await sleep(3000);
  for (const p of P) await ev(p, () => window._h.clear());
  await until(B, () => { const b = window._h.boss(); return b && b._coopMirror; }, null, 10000);
  const d2 = await goDown();
  await killBoss(A); await sleep(3000);
  for (let i = 0; i < 6; i++) { const w = await ev(B, () => document.getElementById('powerup-modal').style.display === 'flex'); if (!w) break; await key(B, '1', 80); await sleep(800); }
  const s2 = await ev(B, () => ({ downed: !!player._downed, stopped: !!player._downBleedStopped }));
  ok('[5] second map: the guest is down and safe after the kill', d2.downed && s2.downed && s2.stopped, { d2, s2 });
  await ev(A, () => window._h.go('forest', 300));
  const stood = await until(B, () => !player._downed, null, 12000);
  const f = await ev(B, () => ({ downed: !!player._downed, hp: Math.round(player.hp), hpPct: Math.round(100 * player.hp / getMaxHp()), map: game.currentMap, deaths: window.__deaths, dying: !!game.dying, exp: player.exp, lv: player.level, coins: player.mojicoins || 0, w0: window.__w0 }));
  ok('[5] with the party gone they stand up where they lie (no death, no toll)', !!stood && !f.deaths && !f.dying && f.map === 'boss' && f.hpPct >= 25 && (f.lv > f.w0.lv || f.exp >= f.w0.exp) && f.coins >= f.w0.coins, f);
  await closeParty(C);
}
try { await browser.close(); } catch (e) {}
try { relay.kill(); } catch (e) {}
if (errs.length) console.log('  page errors: ' + JSON.stringify(errs.slice(0, 8)));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
