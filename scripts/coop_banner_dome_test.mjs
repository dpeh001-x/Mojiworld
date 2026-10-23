// Co-op banners + Leo's ward dome on a guest (fix-mp-joinfail, fix-mp-leave-banner, fix-mirror-ground).
//   node scripts/coop_banner_dome_test.mjs      (PORT=<port>: the relay + game port, PORT+1 must be free; MOJI_GAME_FILE=<build.html> for a private build)
// Bug hunt on v0.30.1874, real relay (mp/server.mjs, spawned here) and two real Chrome pages:
//   1. A relay that is not there: the player read the right "Could not join that party..." (Retry, x) for 1 s, then "Co-op connection lost - reconnecting..." with no buttons for ~105 s -
//      a connection that never existed. A join that never got its 'welcome' now keeps the join-failed banner and its Retry through every auto-retry; a REAL drop still says reconnecting.
//   2. Leave left "In party X - share the code" (and "Joining..." / "reconnecting...") on screen: mpDisconnect never dismissed the banner.
//   3. A guest's mirror of a boss never knew it stood on the ground (a mirror runs no physics: onGround sat at spawn's false), so Leo's zodiac anim played its pounce set through every idle,
//      the idle frame 0 the ward dome is measured off never came, and the dome on the guest's screen read 362 / 540 where the host's is a constant 348.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15992), DEAD = PORT + 1;
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const URL = `http://localhost:${PORT}/${FILE}?dev=1&lxhold=0`, WS = `ws://localhost:${PORT}`;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 600) + ']' : '')); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = (p, fn, arg) => p.evaluate(fn, arg);
const until = async (p, fn, arg, ms = 8000) => { const t0 = Date.now(); for (;;) { let r; try { r = await p.evaluate(fn, arg); } catch (e) { r = null; } if (r || Date.now() - t0 > ms) return r; await sleep(150); } };
const relay = spawn(process.execPath, [path.join(ROOT, 'mp', 'server.mjs')], { cwd: path.join(ROOT, 'mp'), env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('relay did not start')), 15000); relay.stdout.on('data', (d) => { if (String(d).includes('MP relay')) { clearTimeout(t); res(); } }); relay.on('exit', (c) => { clearTimeout(t); rej(new Error('relay exited ' + c)); }); });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
async function boot(name, cls, lv) {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 960, height: 560 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); localStorage.setItem('lx_drs', 'off'); } catch (e) {} });
  const page = await ctx.newPage(); page._errors = []; page.on('pageerror', (e) => page._errors.push(String(e.message).slice(0, 200)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function' && typeof mpConnect === 'function', null, { timeout: 240000 });
  await ev(page, async ({ nm, cls, lv }) => { const sl = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    { const ov = document.getElementById('loading-overlay'); if (ov) ov.classList.add('fade'); }
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootHold.release('menu'); } catch (e) {}
    applyClass(cls); player._tutorialSeen = true; player._gravitosCineSeen = true; if (player.look) player.look.name = nm;
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
    await sl(1500); try { devSetLevel(lv); } catch (e) { player.level = lv; }
    await sl(600); player.hp = getMaxHp(); player.mp = getMaxMp();
    try { closeAllModals(); } catch (e) {} loadMap('forest'); await sl(2500); try { closeAllModals(); } catch (e) {}
    try { const tm = document.getElementById('tutorial-modal'); if (tm && getComputedStyle(tm).display !== 'none') _closeTutorial(true); } catch (e) {} game.paused = false;
  }, { nm: name, cls, lv });
  return page;
}
const banner = (p) => ev(p, () => { const d = document.getElementById('mp-banner'); return d && d.style.display !== 'none' ? { t: d.innerText.replace(/\s+/g, ' '), btns: [...d.querySelectorAll('button')].map((b) => b.textContent) } : null; });
let A = null, B = null;
try {
  A = await boot('Alpha', 'warrior', 99);
  B = await boot('Beta', 'mage', 99);

  // ---- 1. the relay that is not there
  await ev(A, (u) => mpConnect(u, 'Alpha', 'DEADROOM'), `ws://localhost:${DEAD}`);
  await sleep(300);
  const d1 = await banner(A);
  ok('dead relay: the first failed dial says it could not JOIN, with Retry and x', !!d1 && /Could not join that party/.test(d1.t) && d1.btns.includes('Retry') && d1.btns.includes('x'), d1);
  const tries = await until(A, () => net._reconnectTries >= 2 ? net._reconnectTries : 0, null, 12000);
  await sleep(200);
  const d2 = await banner(A);
  ok('dead relay: after the SECOND failed dial it is still the join-failed banner with its Retry (it read "Co-op connection lost - reconnecting..." with no buttons)', !!tries && !!d2 && /Could not join that party/.test(d2.t) && !/lost|reconnecting/i.test(d2.t) && d2.btns.includes('Retry'), { tries, d2 });
  const st = await ev(A, () => document.getElementById('mp-status').textContent);
  ok('dead relay: the status line does not claim a party that was never joined', !/Reconnecting to your party/.test(st), st);
  const rt = await ev(A, () => { const b = [...document.querySelectorAll('#mp-banner button')].find((x) => x.textContent === 'Retry'); if (b) b.click();
    return { clicked: !!b, tries: net._reconnectTries, timer: !!net._reconnectTimer, txt: (document.getElementById('mp-banner') || {}).innerText || '' }; });   // read in the same turn: the next dial fails a few ms later
  ok('dead relay: Retry is a fresh join (the pending auto-retry is cancelled and the count restarts)', rt.clicked && rt.tries === 0 && !rt.timer && /Joining party/.test(rt.txt), rt);
  await ev(A, () => mpDisconnect());
  await sleep(300);
  ok('dead relay: Leave while it is retrying takes the banner down', (await banner(A)) === null, await banner(A));

  // ---- 2. a real party, a real drop
  await ev(A, (u) => mpConnect(u, 'Alpha', 'BNRTEST'), WS);
  await until(A, () => net.connected && net.myId != null, null, 15000);
  await ev(B, (u) => mpConnect(u, 'Beta', 'BNRTEST'), WS);
  await until(B, () => net.connected && net.myId != null, null, 15000);
  await sleep(800);
  const inParty = await banner(A);
  ok('join: the "In party X - share the code" banner is up', !!inParty && /In party BNRTEST/.test(inParty.t), inParty);
  await ev(A, () => { net.ws.close(); });   // not via mpDisconnect: an unexpected drop of an established party
  await sleep(350);
  const lost = await banner(A);
  ok('a REAL drop of a joined party still says "Co-op connection lost - reconnecting..."', !!lost && /connection lost/i.test(lost.t) && /reconnecting/i.test(lost.t) && !/Could not join/.test(lost.t), lost);
  await until(A, () => net.connected && net.myId != null && net._reconnectTries === 0, null, 15000);
  const back = await until(A, () => { const d = document.getElementById('mp-banner'); return d && d.style.display !== 'none' && /Back in party/.test(d.innerText) ? d.innerText : null; }, null, 4000);
  ok('...and when it comes back the banner says "Back in party"', !!back, back);

  // ---- 3. Leave within 10 s of joining
  await ev(A, () => mpDisconnect()); await sleep(500);
  await ev(A, (u) => mpConnect(u, 'Alpha', 'BNRTEST'), WS);
  await until(A, () => net.connected && net.myId != null, null, 15000);
  const fresh = await until(A, () => { const d = document.getElementById('mp-banner'); return d && d.style.display !== 'none' && /share the code/.test(d.innerText) ? d.innerText : null; }, null, 4000);
  ok('leave: a fresh join shows the invite banner', !!fresh, fresh);
  await ev(A, () => mpDisconnect());
  await sleep(300);
  const after = await banner(A);
  ok('leave: pressing Leave takes the "In party ..." banner down with it', after === null, after);
  await ev(A, (u) => mpConnect(u, 'Alpha', 'BNRTEST'), WS);
  await until(A, () => net.connected && net.myId != null, null, 15000);
  await sleep(500);
  await until(B, () => Object.keys(net.peers).length >= 1, null, 8000);

  // ---- 4. Leo's dome on the guest (the host is whoever holds the lowest id: the drop above handed it to B)
  const H = (await ev(A, () => !!net.isHost)) ? A : B, G = H === A ? B : A;
  for (const p of [A, B]) await ev(p, () => { try { closeAllModals(); } catch (e) {} player.hp = getMaxHp(); loadMap('zod_leo'); });
  await sleep(9000);
  const probe = (p) => ev(p, () => { const m = game.monsters.find((q) => q && q.isBoss && q.currentHp > 0); if (!m) return null; const b = _lxWardBox(m, m.x - game.camera.x, m.y); return { mir: !!m._coopMirror, og: m.onGround, ps: m.patternState || 'idle', z: m._zAnim && m._zAnim.state, size: Math.round(b.size), ref: !!(m._lxWardRef && m._lxWardRef.key === (m._phaseSprite || m.type)) }; });
  const rows = [];
  for (let t = 0; t < 26; t++) {
    for (const [p, side] of [[H, -1], [G, 1]]) await ev(p, (s) => { const b = game.monsters.find((m) => m && m.isBoss && m.currentHp > 0); if (!b) return; player._god = true; game.paused = false; player.x = s * 200 + b.x + b.w / 2 - 14; player.vx = 0; }, side);
    rows.push(await Promise.all([probe(H), probe(G)]));
    await sleep(280);
  }
  const live = rows.filter((r) => r[0] && r[1]);
  const idle = live.filter((r) => r[0].ps === 'idle' && r[0].og === true);
  const gSizes = [...new Set(live.map((r) => r[1].size))], hSizes = [...new Set(live.map((r) => r[0].size))];
  ok('dome: the boss arena has a host Leo and a guest mirror', live.length >= 20 && live[0][0].mir === false && live[0][1].mir === true, { live: live.length, first: live[0] });
  ok('dome: while the host\'s Leo stands idle on the floor, the guest\'s mirror stands on the floor too (onGround was false for ever)', idle.length >= 6 && idle.filter((r) => r[1].og === true).length >= idle.length * 0.8, { idle: idle.length, groundedOnGuest: idle.filter((r) => r[1].og === true).length });
  ok('dome: ...and draws his idle, not the pounce set', idle.length >= 6 && idle.filter((r) => r[1].z !== 'pounce').length >= idle.length * 0.8, { states: idle.map((r) => r[1].z) });
  ok('dome: the guest holds the idle-frame reference for the dome (it never did)', live.filter((r) => r[1].ref).length >= live.length * 0.8, { held: live.filter((r) => r[1].ref).length, of: live.length });
  ok('dome: the guest\'s dome is one constant size, equal to the host\'s (362 / 540 against 348)', gSizes.length === 1 && hSizes.length === 1 && gSizes[0] === hSizes[0], { guest: gSizes, host: hSizes });
  const errs = [...A._errors, ...B._errors];
  ok('no page errors', errs.length === 0, errs.slice(0, 4));
} catch (e) { fail++; console.log('FAIL harness: ' + String(e && e.stack || e).slice(0, 700)); }
finally { try { await browser.close(); } catch (e) {} try { relay.kill(); } catch (e) {} }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
