// CO-OP GUESTS: THE GORING AND CRUSHING CHARGES HURT A GUEST (bug hunt, fix-coop-gore-guest).
// The braceDash gore block (Taurus's goring charge: 99% of max HP; Legosaurus's goring charge 50% and his crushing charge, which leaves 5%)
// read the HOST's player only: a guest run over by the same body took the ordinary contact hit and nothing else. A partner the charge
// runs over is now gored through a brGore execute addressed to it (_lxBossExec), which applies the same landing to its own HP, Block,
// DR and Aegis (_lxGoreLand - the host's block, moved). Two real clients over the real relay (mp/server.mjs, started here); the boss's
// director is pinned (an "opening" would halt the trait block) and the charge is forced onto the victim, as the Taurus / Legosaurus tests do.
//   [1] Taurus: the host under the charge is gored (control); the GUEST under the same charge is gored too, for the same HP
//   [2] both in the lane: each is gored once (not twice, not only the first)
//   [3] a guest in Aegis (_god) and a guest outside the lane are not gored
//   [4] Legosaurus: goring charge and CRUSHING charge - host (control) and guest take the same label and the same HP
//   node scripts/coop_guest_gore_test.mjs      PORT / MOJI_GAME_FILE override (an unfixed copy of the game in the repo root fails [1] [2] [4] for the guest)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11354), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 600) + ']' : '')); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 8000) => { const t0 = Date.now(); for (;;) { let v = null; try { v = await fn(); } catch (e) {} if (v || Date.now() - t0 > ms) return v; await sleep(200); } };
const relay = spawn(process.execPath, [path.join(ROOT, 'mp', 'server.mjs')], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' }); await sleep(1500);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--disable-gpu'] });
const errs = [];
const boot = async (name) => {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 960, height: 560 } });
  await ctx.addInitScript((ws) => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); localStorage.setItem('levelx_mp_url', ws); localStorage.setItem('lx_drs', 'off'); } catch (e) {} }, `ws://localhost:${PORT}`);
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(name + ': ' + String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1&lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function' && typeof mpConnect === 'function', null, { timeout: 240000 });
  await page.evaluate(async ({ nm }) => { const sl = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    { const ov = document.getElementById('loading-overlay'); if (ov) ov.classList.add('fade'); }
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootHold.release('menu'); } catch (e) {}
    applyClass('warrior'); player._tutorialSeen = true; player._gravitosCineSeen = true; if (player.look) player.look.name = nm;
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;
    await sl(1500); try { devSetLevel(90); } catch (e) { player.level = 90; }
    await sl(600); player.hp = getMaxHp(); player.mp = getMaxMp();
    try { closeAllModals(); } catch (e) {} loadMap('town'); await sl(2500); try { closeAllModals(); } catch (e) {}
    try { const tm = document.getElementById('tutorial-modal'); if (tm && getComputedStyle(tm).display !== 'none') _closeTutorial(true); } catch (e) {} game.paused = false;
  }, { nm: name });
  return page;
};
const join = async (p, room) => { await p.evaluate(({ url, room }) => mpConnect(url, 'x' + Math.random().toString(36).slice(2, 5), room), { url: `ws://localhost:${PORT}`, room }); return until(() => p.evaluate(() => net.connected && net.myId != null), 15000); };
const rd = (p) => p.evaluate(() => ({ src: player._lastDamageSource, hp: Math.round(player.hp), max: getMaxHp() }));
// one charge: `lane` heroes stand at x 700 in the boss's way, the rest wait far away in Aegis. A hero in the lane has i-frames that outlast the run: the boss's ordinary contact hit
// (which would add a random share to the HP read) cannot land, while the gore - which deliberately ignores i-frames, the bull is on top of you - still does.
async function charge(A, B, lane, crush, o = {}) {
  const place = (p, inLane) => p.evaluate(({ inLane, god }) => { player._god = god; player.hp = getMaxHp(); player.invulnerable = inLane ? 1e9 : 0; player._downed = false; player.x = inLane ? 700 : 1650; player.y = 436; player.vx = 0; player.vy = 0; player._lastDamageSource = 'none'; game.paused = false; }, { inLane, god: inLane ? !!(o.god && o.god.has(p)) : !(o.farVuln && o.farVuln.has(p)) });
  await place(A, lane.includes(A)); await place(B, lane.includes(B)); await sleep(500);
  await A.evaluate(({ crush }) => { const b = game.monsters.find((m) => m && m.isBoss && m.currentHp > 0);
    try { clearInterval(window.__pinB); } catch (e) {}
    window.__pinB = setInterval(() => { b._dirOpenT = 0; b._dirRollT = 1e9; b._stagger = 0; b.stunTimer = 0; b.freezeTimer = 0; b._bdCd = 1e9; b.y = 480 - b.h; b.vy = 0; }, 16);   // no "opening" may halt the trait block, and the body stays on the floor (a boss idling on a ledge would not overlap a hero at floor level)
    b._braceDashing = true; b._bdPhase = 'dash'; b._bdT = 380; b._bdTravel = 0; b._bdDir = 1; b._bdGored = false; b._bdGoredPeers = null; b._bdCrush = !!crush; b._bdVx = 0.2; b.facing = 1; b.x = 700 - b.w / 2 + 14; b.vx = 0; }, { crush });
  // the charge is over when the boss says so (a loaded page can take a while to tick it through); then the strike has long reached a guest
  await until(() => A.evaluate(() => { const b = game.monsters.find((m) => m && m.isBoss && m.currentHp > 0); return !b || !b._braceDashing; }), 15000); await sleep(700);
  await A.evaluate(() => clearInterval(window.__pinB));
  const diag = await A.evaluate(() => { const b = game.monsters.find((m) => m && m.isBoss && m.currentHp > 0); return b ? { b: [Math.round(b.x), Math.round(b.y), b.w, b.h], gored: !!b._bdGored, dash: !!b._braceDashing, ph: b._bdPhase, p: [Math.round(player.x), Math.round(player.y)], god: !!player._god, hs: game.hitStop } : null; });
  return { host: await rd(A), guest: await rd(B), diag };
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;
// A forced charge sometimes does not take (the first one after an arena loads: the boss is mid-script and the gore tick never sees the overlap - the same on an unfixed copy). The
// harness repeats a stimulus that did not take, up to 4 times, until `want` says it did; a guest bug would fail every try.
async function tryCharge(A, B, lane, crush, o, want) { let r = null; for (let i = 1; i <= 4; i++) { r = await charge(A, B, lane, crush, o); r.tries = i; if (want(r)) return r; await sleep(1500); } return r; }
try {
  const A = await boot('Alpha'), B = await boot('Beta');
  const code = 'GR' + Math.random().toString(36).slice(2, 7).toUpperCase();
  await join(A, code); await join(B, code);
  ok('A (host) and B (guest) joined one party', await until(() => A.evaluate(() => Object.keys(net.peers).length === 1), 10000) && await until(() => B.evaluate(() => Object.keys(net.peers).length === 1), 10000));
  const arena = async (id) => { for (const p of [A, B]) await p.evaluate((a) => { player._god = true; loadMap(a); }, id); await sleep(9500); await charge(A, B, [A], false); await sleep(1500);   /* a throwaway charge: a boss that has only just arrived is still settling onto the floor */
    return A.evaluate(() => { const b = game.monsters.find((m) => m && m.isBoss && m.currentHp > 0); return b ? { type: b.type, gore: !!(b.traits && b.traits.braceDash && b.traits.braceDash.gore) } : null; }); };

  // ---- Taurus
  const tb = await arena('zod_taurus');
  ok('the Taurus arena holds a boss with a gore charge', !!(tb && tb.gore), tb);
  const LAB = 'a goring charge';
  const th = await tryCharge(A, B, [A], false, {}, (r) => r.host.src === LAB), tg = await tryCharge(A, B, [B], false, {}, (r) => r.guest.src === LAB);
  ok('[1] control: the HOST under the Taurus charge is gored (label, and a big share of max HP)', th.host.src === LAB && th.host.hp < th.host.max * 0.8, th);
  ok('[1] the GUEST under the same charge is gored too, for the same HP', tg.guest.src === LAB && near(tg.guest.hp, th.host.hp, th.host.max * 0.02), { guest: tg.guest, host: th.host });
  const tboth = await tryCharge(A, B, [A, B], false, {}, (r) => r.host.src === LAB && r.guest.src === LAB);
  ok('[2] both in the lane: each is gored once (the same HP as alone)', tboth.host.src === LAB && tboth.guest.src === LAB && near(tboth.host.hp, th.host.hp, th.host.max * 0.02) && near(tboth.guest.hp, th.host.hp, th.host.max * 0.02), tboth);
  const tgod = await tryCharge(A, B, [A, B], false, { god: new Set([B]) }, (r) => r.host.src === LAB);   // the host in the lane proves the charge took
  ok('[3] a guest in Aegis (in the lane beside a host who IS gored) is not gored', tgod.host.src === LAB && tgod.guest.src !== LAB && tgod.guest.hp > tgod.guest.max * 0.9, tgod);
  const tfar = await tryCharge(A, B, [A], false, { farVuln: new Set([B]) }, (r) => r.host.src === LAB);
  ok('[3] a guest outside the lane (vulnerable, far) is not gored; the host in it is', tfar.guest.src !== LAB && tfar.guest.hp > tfar.guest.max * 0.9 && tfar.host.src === LAB, tfar);

  // ---- Legosaurus
  const lb = await arena('blockland_apex');
  ok('the Legosaurus arena holds a boss with a gore charge', !!(lb && lb.type === 'legosaurus' && lb.gore), lb);
  for (const [crush, label] of [[false, "Legosaurus's goring charge"], [true, "Legosaurus's crushing charge"]]) {
    const h = await tryCharge(A, B, [A], crush, {}, (r) => r.host.src === label), g = await tryCharge(A, B, [B], crush, {}, (r) => r.guest.src === label);
    ok(`[4] control: the HOST under Legosaurus's ${crush ? 'crushing' : 'goring'} charge takes it`, h.host.src === label && h.host.hp < h.host.max * (crush ? 0.2 : 0.95), h);
    ok(`[4] the GUEST under it takes the same label and the same HP`, g.guest.src === label && near(g.guest.hp, h.host.hp, h.host.max * 0.02), { guest: g.guest, host: h.host });
  }
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { fail++; console.log('FAIL harness error', String(e && e.stack || e).slice(0, 700)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
await browser.close().catch(() => {}); try { relay.kill(); } catch (e) {}
process.exit(fail ? 1 : 0);
