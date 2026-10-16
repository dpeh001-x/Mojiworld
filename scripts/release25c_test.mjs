// RELEASE 25c (the co-op + phone hunter round) stays fixed. A phone (844x390, isMobile + hasTouch, touch input only) and a desktop in a
// REAL party on the local relay (mp/server.mjs, which serves the page too); the phone joins through the real Multi window.
//   [4s] solo phone: the PQ objective pin on the four Ticket Rush maps clears every tappable (stats plate, Block, the deck, the menu row ...)
//   [3]  phone joins via Multi -> code -> "Play together": the "In party" banner sits under the menu row and a tap on MAP opens the map;
//        desktop keeps the banner at top 14
//   [4p] in the party: the pin also clears the partner plates, the Team Revive chip, PING and the chat log
//   [B]  both hold Stage 4, the desk host boards first, the phone (Lv 30) follows a Lv 44 host: one Conductor; the phone's copy reads the
//        host's Lv 44; the host's kill pays the phone its Stage 4, "The Master Conductor dropped N Setshards! (co-op)" and the epitaph
//   [A]  the host stays aboard after its duel; the phone boards for its own Stage 4: the host's world brings a Conductor in (one), the
//        phone keeps its debt until his kill, which completes its Stage 4
//   [2]  the phone taps Multi -> Leave on a hunting map: the map fills again; re-joined, its socket drops in King Krook's throne room
//        (Krook alive): Krook is back for the phone, as on entry
//   node release25c_test.mjs    PORT (relay + page, default 15290) / MOJI_SERVE_ROOT / MOJI_GAME_FILE (a file in that root) / PQ_SHOT=<png>
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15290), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const URL = `http://localhost:${PORT}/${FILE}?dev=1&lxhold=0`, WS = `ws://localhost:${PORT}`;
const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 600) + ']' : '')); };
const info = (n, x) => console.log('INFO ' + n + '  ' + JSON.stringify(x));
const on = (k) => !process.env.ONLY || process.env.ONLY.split(',').includes(k);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const relay = spawn(process.execPath, [path.join(ROOT, 'mp', 'server.mjs')], { cwd: path.join(ROOT, 'mp'), env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'] });
console.log('relay pid ' + relay.pid);
await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('relay did not start')), 15000); relay.stdout.on('data', (d) => { if (String(d).includes('MP relay')) { clearTimeout(t); res(); } }); relay.on('exit', (c) => { clearTimeout(t); rej(new Error('relay exited ' + c)); }); });
const EXE = [process.env.PW_EXE, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => p && existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
try { console.log('browser pid ' + browser.process().pid); } catch (e) {}
const ev = (p, fn, arg) => p.evaluate(fn, arg);
const until = async (p, fn, arg, ms = 8000) => { const t0 = Date.now(); for (;;) { let r; try { r = await p.evaluate(fn, arg); } catch (e) { r = null; } if (r || Date.now() - t0 > ms) return r; await sleep(200); } };
async function boot(phone, name, cls, lv) {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: phone ? { width: 844, height: 390 } : { width: 960, height: 560 }, ...(phone ? { isMobile: true, hasTouch: true, deviceScaleFactor: 1, userAgent: UA } : {}) });
  await ctx.addInitScript((ws) => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('levelx_mp_url', ws); localStorage.setItem('lx_drs', 'off'); } catch (e) {} }, WS);
  const page = await ctx.newPage(); page._errors = []; page._phone = phone; page._name = name;
  page.on('pageerror', (e) => page._errors.push(String(e.message).slice(0, 200)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function' && typeof mpConnect === 'function', null, { timeout: 240000 });
  if (!phone) console.log('  build', await ev(page, () => (typeof GAME_VERSION !== 'undefined' ? GAME_VERSION : '?')));
  await ev(page, async ({ nm, cls, lv }) => { const sl = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    { const ov = document.getElementById('loading-overlay'); if (ov) ov.classList.add('fade'); }
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootHold.release('menu'); } catch (e) {}
    applyClass(cls); player._tutorialSeen = true; player._gravitosCineSeen = true; if (player.look) player.look.name = nm;
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
    await sl(1500); try { devSetLevel(lv); } catch (e) { player.level = lv; }
    await sl(600); player.hp = getMaxHp(); player.mp = getMaxMp(); player._god = true;
    game._worldStateByMap = Object.assign(game._worldStateByMap || {}, { thunderPlateau: null, krookThrone: null, clockworkExpress: null });
    try { closeAllModals(); } catch (e) {} loadMap('town', 950); await sl(2500); try { closeAllModals(); } catch (e) {}
    try { const tm = document.getElementById('tutorial-modal'); if (tm && getComputedStyle(tm).display !== 'none') _closeTutorial(true); } catch (e) {} game.paused = false;
    window.__toasts = []; const _st = window.showToast; window.showToast = function (t) { try { window.__toasts.push(String(t).slice(0, 200)); } catch (e) {} return _st.apply(this, arguments); };
    window.__r = (el) => { if (typeof el === 'string') el = document.querySelector(el); if (!el || !el.getClientRects().length) return null; const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return null; const b = el.getBoundingClientRect(); return b.width ? { l: b.left, t: b.top, r: b.right, b: b.bottom } : null; };
    window.__ov = (a, b) => !!(a && b && a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5);
    window.__own = (el) => { if (typeof el === 'string') el = document.querySelector(el); if (!el) return 'none'; const b = el.getBoundingClientRect(); const t = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return t && (t === el || el.contains(t)) ? 'ok' : (t ? (t.id || String(t.className).slice(0, 40) || t.tagName) : 'null'); };
    window.__cond = () => game.monsters.filter((m) => m && m.type === 'pqConductor' && m.currentHp > 0);
    window.__live = () => game.monsters.filter((m) => m && m.currentHp > 0 && !m._coopMirror && !m.ally && !m.isSummon && !m._playerOwned).length;
  }, { nm: name, cls, lv });
  return page;
}
const center = (p, sel) => p.evaluate((s) => { const el = document.querySelector(s); if (!el) return null; const b = el.getBoundingClientRect(); if (!b.width) return null; return { x: b.left + b.width / 2, y: b.top + b.height / 2, own: __own(el) }; }, sel);
async function tap(p, sel) { const c = await center(p, sel); if (!c) return 'missing'; if (p._phone) await p.touchscreen.tap(c.x, c.y); else await p.mouse.click(c.x, c.y); return c.own; }
async function key(p, k, ms = 90) { await p.keyboard.down(k); await sleep(ms); await p.keyboard.up(k); await sleep(60); }
async function hold(p, sel, ms) { const c = await center(p, sel); if (!c) return 'missing'; const cdp = p._cdp || (p._cdp = await p.context().newCDPSession(p));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x, y: c.y, id: 1 }] }); await sleep(ms); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); return c.own; }
// the Multi window, the code, "Play together" - real taps / clicks and typing
async function joinUI(p, room) {
  const a = await tap(p, '#mp-btn'); await sleep(700);
  await tap(p, '#mp-name'); await p.keyboard.press('Control+A'); await p.keyboard.type(p._name);
  await tap(p, '#mp-room'); await p.keyboard.press('Control+A'); await p.keyboard.type(room);
  const b = await tap(p, '#mp-connect-btn');
  const c = await until(p, () => net.connected && net.myId != null, null, 15000);
  return { a, b, c };
}
// stand by an NPC (harness shortcut), open the dialog with real input (N / TALK), pick an option by a real click / tap
async function talkTo(p, name, re) {
  const prep = await ev(p, async (name) => { try { closeDialog(); } catch (e) {} const n = (game.npcs || []).find((q) => q && (q.name === name || q.id === name)); if (!n) return 'no npc';
    player.x = n.x - 10 - player.w / 2 + (n.w || 40) / 2; player.vx = 0; game.paused = false; await new Promise((r) => setTimeout(r, 500)); return 'ok'; }, name);
  if (prep !== 'ok') return { err: prep };
  if (p._phone) await tap(p, '#mobile-deck .mc-talk'); else await key(p, 'n');
  await sleep(1200);
  for (let k = 0; k < 8; k++) { const n = await ev(p, () => document.querySelectorAll('#dialog-options > *').length); if (n) break; if (p._phone) await p.touchscreen.tap(422, 300); else await p.mouse.click(480, 420); await sleep(500); }
  const opts = await ev(p, () => [...document.querySelectorAll('#dialog-options > *')].map((o, i) => { o.setAttribute('data-hopt', i); return o.textContent.trim(); }));
  const i = opts.findIndex((t) => re.test(t)); if (i < 0) return { err: 'no option', opts };
  await tap(p, `[data-hopt="${i}"]`); await sleep(900); return { picked: opts[i] };
}
// real-input swings at the nearest live (boss) monster: arrows / d-pad to close in, Z / the basic button to hit
async function fightStep(p, bossOnly) {
  const L = await ev(p, (bo) => { const cx = player.x + player.w / 2; let best = null, bd = 1e9; for (const m of game.monsters) { if (!m || !(m.currentHp > 0) || m._isLeg) continue; if (bo && !(m.isBoss || m.boss)) continue; const d = Math.abs(m.x + m.w / 2 - cx); if (d < bd) { bd = d; best = { dx: m.x + m.w / 2 - cx, w: m.w }; } } return best; }, !!bossOnly);
  if (!L) return null; const dir = L.dx > 0 ? 'right' : 'left';
  if (Math.abs(L.dx) > Math.max(50, L.w / 2 + 30)) { const ms = Math.min(600, Math.abs(L.dx) * 2.2); if (p._phone) await hold(p, '#mobile-deck .mc-' + dir, ms); else { await p.keyboard.down(dir === 'right' ? 'ArrowRight' : 'ArrowLeft'); await sleep(ms); await p.keyboard.up(dir === 'right' ? 'ArrowRight' : 'ArrowLeft'); } }
  else for (let i = 0; i < 3; i++) { if (p._phone) await tap(p, '#mobile-deck .mc-basic'); else await key(p, 'z'); await sleep(100); }
  return L;
}
// the PQ pin against everything a thumb can reach (and the chat log, which it must not cover)
const pinClash = (p) => ev(p, () => { const pin = __r('#pq-objective-pin'); if (!pin) return { pin: null };
  const obs = { stats: __r('#stats'), row: __r('#mobile-ctrl .mc-pots'), toggle: __r('#mobile-ctrl-toggle'), ping: __r('#lx-coop-ping'), pf: __r('#party-frames'), revive: __r('#party-frames .pf-revive'), tracker: __r('#quest-tracker'), chat: __r('#mp-chat-log'), settings: __r('#settings-btn'), fs: __r('#fullscreen-btn'), mp: __r('#mp-btn'), dpad: __r('#mobile-deck .mc-dpad') };
  let i = 0; for (const b of document.querySelectorAll('#mobile-deck .mc-btn, #mobile-ctrl .mc-menu')) { const r = __r(b); if (r) obs[(b.className.match(/mc-[a-z]+/g) || ['b']).slice(-1)[0] + (i++)] = r; }
  const hits = Object.keys(obs).filter((k) => __ov(pin, obs[k]));
  return { pin: { l: Math.round(pin.l), t: Math.round(pin.t), r: Math.round(pin.r), b: Math.round(pin.b) }, hits, inView: pin.l >= 0 && pin.t >= 0 && pin.r <= innerWidth && pin.b <= innerHeight, txt: document.getElementById('pq-objective-pin').textContent.slice(0, 40) }; });
const PQ = [['clockworkUnderpassLobby', 'q_clockwork_underpass'], ['clockworkSpire', 'q_pq_spire'], ['tower', 'q_pq_carriage'], ['clockworkExpress', 'q_pq_finale']];
const toPq = (p, m, q) => ev(p, ({ m, q }) => { player.quests.active = {}; player.quests.active[q] = { progress: 3 }; player._pqFinaleBossPending = false; loadMap(m, 300); }, { m, q });
let P = null, D = null;
try {
  [P, D] = await Promise.all([boot(true, 'Pip', 'archer', 30), boot(false, 'Dex', 'warrior', 44)]);
  // ---------------- [4s] the PQ pin, solo phone ----------------
  if (on('4')) for (const [m, q] of PQ) {
    await toPq(P, m, q); await sleep(3500); await ev(P, () => { try { closeAllModals(); } catch (e) {} try { _dismissBossIntro(); } catch (e) {} game.paused = false; }); await sleep(900);
    const C = await pinClash(P);
    ok(`4. solo phone, ${m}: the PQ pin is up, on screen, and clears every tappable`, !!C.pin && C.inView && C.hits.length === 0, C);
  }
  await ev(P, () => { player.quests.active = {}; loadMap('town', 950); }); await sleep(2500);
  // ---------------- [3] a real join through the Multi window ----------------
  const room = 'R25C' + Math.floor(Math.random() * 1e4);
  const jd = await joinUI(D, room); ok('3. the desktop joins through the Multi window', !!jd.c, jd);
  const jp = await joinUI(P, room); ok('3. the phone joins through the Multi window (taps)', !!jp.c, jp);
  await sleep(350);
  const B3 = await ev(P, () => { const bn = document.getElementById('mp-banner'); return { r: __r(bn), row: __r('#mobile-ctrl .mc-pots'), txt: bn ? bn.textContent.slice(0, 50) : '', mapOwn: __own('#mobile-ctrl .mc-pots .mc-menu[data-mkey="w"]') }; });
  ok('3. phone: the "In party" banner sits under the menu row', !!B3.r && !!B3.row && /In party/.test(B3.txt) && B3.r.t >= B3.row.b - 0.5, B3);
  await tap(P, '#mobile-ctrl .mc-pots .mc-menu[data-mkey="w"]');
  const map3 = await until(P, () => { const w = document.getElementById('worldmap-modal'); return !!w && getComputedStyle(w).display !== 'none'; }, null, 2500);
  ok('3. phone: a tap on MAP right after joining opens the world map', !!map3, B3.mapOwn);
  await ev(P, () => { try { closeAllModals(); } catch (e) {} game.paused = false; });
  ok('3. desktop: the banner keeps its place (top 14 px)', (await ev(D, () => { const bn = document.getElementById('mp-banner'); return bn ? bn.style.top || getComputedStyle(bn).top : null; })) === '14px');
  for (const p of [P, D]) await ev(p, () => { try { _mpBannerDismiss(); } catch (e) {} });
  // ---------------- [4p] the PQ pin in the party ----------------
  if (on('4')) for (const [m, q] of PQ) {
    for (const p of [D, P]) await toPq(p, m, q);
    await sleep(4500); await ev(P, () => { try { closeAllModals(); } catch (e) {} try { _dismissBossIntro(); } catch (e) {} game.paused = false; for (let i = 0; i < 3; i++) _mpPushLog('Dex: a chat line ' + i, ''); });
    await until(P, () => !!__r('#party-frames .pf-row'), null, 6000); await sleep(1200);
    const C = await pinClash(P);
    ok(`4. party phone, ${m}: the pin clears the partner plates, Team Revive, PING, the chat log and every tappable`, !!C.pin && C.inView && C.hits.length === 0, C);
    if (m === 'clockworkUnderpassLobby' && process.env.PQ_SHOT) await P.screenshot({ path: process.env.PQ_SHOT, scale: 'css' }).catch(() => {});
  }
  if (on('4')) ok('4. desktop: the pin keeps its corner (14, 84)', await ev(D, () => { const p = document.getElementById('pq-objective-pin'); return !!p && p.style.display !== 'none' && p.offsetLeft === 14 && p.offsetTop === 84 && !p.classList.contains('pq-phone'); }));
  for (const p of [D, P]) await ev(p, () => { player.quests.active = {}; loadMap('town', 950); }); await sleep(3000);
  // ---------------- [B] both owe Stage 4: one Conductor, the host's level, the guest's toasts ----------------
  const stage4 = (p) => ev(p, () => { for (const q of ['q_clockwork_underpass', 'q_pq_spire', 'q_pq_carriage']) { delete player.quests.active[q]; player.quests.completed[q] = Date.now() - 1e6; }
    delete player.quests.completed.q_pq_finale; delete player.quests.active.q_pq_finale; player.quests.unlocked.q_pq_finale = true; player._pqFinaleBossPending = false; });
  const killCond = async (p) => { const t0 = Date.now(); let b = 1;
    while (Date.now() - t0 < 60000) { b = await ev(p, () => { const b = __cond()[0]; if (b) { if (b.currentHp > 40) b.currentHp = 40; b.evasion = 0; } return b ? 1 : 0; }); if (!b) break; await fightStep(p, true); }
    return !b; };
  const condState = (p) => ev(p, () => ({ n: __cond().length, lv: (__cond()[0] || {}).level, mir: !!(__cond()[0] || {})._coopMirror, pend: !!player._pqFinaleBossPending, done: !!player.quests.completed.q_pq_finale, map: game.currentMap, fol: _coopFollowingHost() }));
  if (on('B') || on('A')) {
    for (const p of [D, P]) await stage4(p);
    const td = await talkTo(D, 'Milo', /Stage 4/); await until(D, () => game.currentMap === 'clockworkExpress', null, 9000); await sleep(1500);
    await ev(D, () => { try { _dismissBossIntro(); } catch (e) {} game.paused = false; });
    const tp = await talkTo(P, 'Milo', /Stage 4/); await until(P, () => game.currentMap === 'clockworkExpress', null, 9000);
    let maxN = 0; for (let i = 0; i < 12; i++) { await sleep(500); maxN = Math.max(maxN, await ev(D, () => __cond().length)); await ev(P, () => { try { _dismissBossIntro(); } catch (e) {} game.paused = false; }); }
    const sB = await condState(P), hB = await condState(D);
    info('B boarding', { td, tp, host: hB, guest: sB });
    ok('B. both owe Stage 4: the host\'s world has exactly one Conductor, and the phone sees him', maxN === 1 && hB.n === 1 && sB.n === 1 && sB.mir, { maxN, hB, sB });
    ok('B. the phone\'s copy of a Lv 44 host\'s Conductor reads Lv 44 (not its own 30)', sB.lv === 44 && hB.lv === 44, { guest: sB.lv, host: hB.lv });
    const r0 = await ev(P, () => ({ sh: player.setshards || 0, exp: player.exp || 0, lv: player.level, c: player.mojicoins || 0 })); await ev(P, () => { window.__toasts = []; });
    const killed = await killCond(D); await sleep(4500);
    const r1 = await ev(P, () => ({ sh: player.setshards || 0, exp: player.exp || 0, lv: player.level, c: player.mojicoins || 0 }));
    const sB2 = await condState(P), toastsB = await ev(P, () => window.__toasts.slice());
    info('B guest reward at the host\'s kill', { setshards: r1.sh - r0.sh, exp: r1.exp - r0.exp, levels: r1.lv - r0.lv, coins: r1.c - r0.c });
    ok('B. the host fells him; the phone\'s Stage 4 completes and its debt is cleared', killed && sB2.done && !sB2.pend, sB2);
    ok('B. the phone\'s Setshard toast names "The Master Conductor"', toastsB.some((t) => /The Master Conductor dropped \d+ Setshards?! \(co-op\)/.test(t)), toastsB.filter((t) => /Setshard/.test(t)));
    ok('B. the phone reads the Conductor\'s epitaph', toastsB.some((t) => /sets down his whistle/.test(t)), toastsB.slice(-6));
  }
  // ---------------- [A] the phone boards after the host's duel, the host still aboard ----------------
  if (on('A')) {
    await stage4(P); await ev(P, () => loadMap('town', 950)); await sleep(3000); await ev(P, () => { window.__toasts = []; });
    const tp = await talkTo(P, 'Milo', /Stage 4/); await until(P, () => game.currentMap === 'clockworkExpress', null, 9000);
    let maxN = 0, got = null; const t0 = Date.now();
    while (Date.now() - t0 < 16000) { await sleep(500); const n = await ev(D, () => __cond().length); maxN = Math.max(maxN, n); await ev(P, () => { try { _dismissBossIntro(); } catch (e) {} game.paused = false; }); if (n && !got) got = Date.now() - t0; }
    const sA = await condState(P), hA = await condState(D), tA = await ev(P, () => window.__toasts.slice());
    info('A boarding', { tp, ms: got, host: hA, guest: sA, toasts: tA.slice(-4) });
    ok('A. a partner boarding after the host\'s duel gets a Conductor in the host\'s world (one) and sees him', !!got && maxN === 1 && sA.n === 1 && sA.mir, { got, maxN, hA, sA });
    ok('A. the phone keeps its debt until the duel is fought, and was told he descends', sA.pend && !sA.done && tA.some((t) => /MASTER CONDUCTOR descends/.test(t)), { sA, t: tA.slice(-4) });
    const killed = await killCond(D); await sleep(4000); const sA2 = await condState(P);
    ok('A. the host fells him: the phone\'s Stage 4 completes, its debt is paid, no second Conductor follows', killed && sA2.done && !sA2.pend && (await sleep(7000), await ev(D, () => __cond().length)) === 0, sA2);
  }
  // ---------------- [2] left alone on an emptied map ----------------
  if (on('2')) {
    for (const p of [D, P]) await ev(p, () => { player.quests.active = {}; try { closeAllModals(); } catch (e) {} });
    await ev(D, () => loadMap('thunderPlateau', 300)); await sleep(2500); await ev(P, () => loadMap('thunderPlateau', 260));
    const fol = await until(P, () => _coopFollowingHost() && game.monsters.some((m) => m && m._coopMirror && m.currentHp > 0), null, 12000);
    const t0 = Date.now(); while (Date.now() - t0 < 5000) await Promise.all([fightStep(D), fightStep(P)]);
    const before = await ev(P, () => ({ mir: game.monsters.filter((m) => m && m._coopMirror).length, live: __live() }));
    await tap(P, '#mp-btn'); await sleep(700); const lv = await tap(P, '#mp-disconnect-btn'); await sleep(600); await ev(P, () => { try { closeAllModals(); } catch (e) {} game.paused = false; });
    const back = await until(P, () => __live() >= 3 ? { live: __live(), r: game._lxRefilled || null } : null, null, 9000);
    info('2 leave', { fol: !!fol, before, leave: lv, back });
    ok('2. the phone taps Multi -> Leave on a hunting map: within 9 s the map has monsters again', !!fol && lv === 'ok' && !!back, { fol: !!fol, before, lv, back });
    ok('2. ... and the desktop host keeps its own world', await ev(D, () => game.currentMap === 'thunderPlateau' && game.monsters.some((m) => m && m.currentHp > 0)));
    // re-join, then the socket drops in King Krook's throne room with Krook alive
    const jp2 = await joinUI(P, room); await ev(P, () => { try { _mpBannerDismiss(); closeAllModals(); } catch (e) {} game.paused = false; });
    for (const p of [D, P]) await ev(p, () => { game.bossDefeated = game.bossDefeated || {}; delete game.bossDefeated.krookThrone; if (game._bossDefeatedAt) delete game._bossDefeatedAt.krookThrone; });
    await ev(D, () => loadMap('krookThrone', 200)); await sleep(2500); await ev(D, () => { try { _dismissBossIntro(); } catch (e) {} game.paused = false; });
    await ev(P, () => loadMap('krookThrone', 160)); await sleep(1500); await ev(P, () => { try { _dismissBossIntro(); } catch (e) {} game.paused = false; });
    const folK = await until(P, () => _coopFollowingHost() && game.monsters.some((m) => m && m._coopMirror && m.type === 'kingKrook' && m.currentHp > 0), null, 12000);
    await ev(P, () => { net._r25Url = net._lastUrl; net._lastUrl = 'ws://localhost:1'; net.ws.close(); });
    const krook = await until(P, () => { try { _dismissBossIntro(); } catch (e) {} const k = game.monsters.find((m) => m && m.type === 'kingKrook' && m.currentHp > 0 && !m._coopMirror); return k ? { hp: Math.round(k.currentHp), max: k.maxHp, r: game._lxRefilled || null } : null; }, null, 10000);
    info('2 drop', { rejoined: !!jp2.c, folK: !!folK, krook });
    ok('2. the phone\'s socket drops in the throne room, Krook alive: Krook is back for it (local, full HP), as on entry', !!jp2.c && !!folK && !!krook && krook.hp === krook.max, { rejoined: !!jp2.c, folK: !!folK, krook });
    await ev(P, () => { net._lastUrl = net._r25Url; });
  }
  const errs = [...P._errors, ...D._errors].filter((e) => !/ResizeObserver|play\(\) request|NotAllowedError|AbortError|Failed to load resource/.test(e));
  ok('no page errors', errs.length === 0, errs.slice(0, 4));
} catch (e) { fail++; console.log('FAIL harness: ' + String(e && e.stack || e).slice(0, 800)); }
finally { try { await browser.close(); } catch (e) {} try { relay.kill(); } catch (e) {} }
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
