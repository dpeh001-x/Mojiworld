// RELEASE 9a (bug hunt) stays fixed:
//   1 a monster's burn / poison ticks while it is stunned, frozen or in the far tier - and exactly once per update otherwise
//   2 a shackle lock ends when its caster really dies (killMonster), and survives a revivesOnce fake death
//   3 the downed beat clears _slowTimer / _skillLockTimer / _iceFloor
//   4 the service worker registration asks for an update at boot
//   5 a monster frame that failed to load is re-requested (rate-limited), not left blank for the session
//   node scripts/release9a_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 11991), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
const URL = `http://localhost:${PORT}/${FILE}?dev=1`;
const bootIn = async (page) => {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof loadMap === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
};
const setup = `try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
  player._tutorialSeen = true; window._prologueAfterCreation = false;
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  if (!player.cls) applyClass('warrior'); player._gravitosCineSeen = true; player.invulnerable = 1e12; player._god = true;
  player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true;`;
const FAIL_FRAME = 'Sprites/monsters/idle/petalfly_0.webp';
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  // 5 - the first IMAGE request for one monster frame fails as if offline; later ones go through
  const req = { failed: 0, img: 0, healthy: 0 };
  await ctx.route('**/Sprites/monsters/idle/petalfly_*.webp', (route) => {
    const r = route.request(), u = r.url();
    if (r.resourceType() === 'image') { if (u.endsWith('petalfly_0.webp')) req.img++; else if (u.endsWith('petalfly_1.webp')) req.healthy++; }
    if (r.resourceType() === 'image' && u.endsWith('petalfly_0.webp') && !req.failed) { req.failed++; return route.abort('internetdisconnected'); }
    return route.continue();
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await bootIn(page);
  const D = await page.evaluate(async ({ setup, FAIL_FRAME }) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    eval(setup);
    for (let i = 0; i < 3 && game.currentMap !== 'forest'; i++) { loadMap('forest', 300); await sleep(1500); }
    game.paused = true; await sleep(300);   // the real loop stops; updateMonsters is driven by hand below
    // ---- 1: four burning mobs, stepped 150 x 16.67 ms = 2.5 s -> 3 ticks at LX_BURN_TICK_MS 800
    game.monsters.length = 0;
    const mk = (dx) => { const m = spawnMonster(player.x + dx, player.y - 20, 'horny', false); m.atk = 0; m.maxHp = m.currentHp = 200000; m.burnTimer = 1e9; m.burnDmg = 50; m._burnStack = 0; m._burnTickAcc = 0; return m; };
    const plain = mk(120), stunned = mk(160), frozen = mk(200);
    stunned.stunTimer = 1e9; frozen.freezeTimer = 1e9;
    const far = mk(0); far.flies = true;
    const placeFar = () => { far.x = _lxPlayCamX() + W_PLAY / 2 + 1100; /* past the 400 px ACTIVE_PAD band, inside the 1200 px very-far skip */ far.y = ((game.camera && game.camera.y) || 0) + H / 2 - far.h / 2; far.vx = 0; far.vy = 0; };
    const hp0 = (m) => m.currentHp;
    const h = { plain: hp0(plain), stunned: hp0(stunned), frozen: hp0(frozen), far: hp0(far) };
    for (let i = 0; i < 150; i++) {
      placeFar(); game._burnTickedThisFrame = 0; game._pendingKills = [];
      try { updateMonsters(16.67); } catch (e) { out.err = String(e).slice(0, 120); break; }
      game._iteratingMonsters = false;
    }
    const tk = (m, k) => ({ ticks: m._burnStack | 0, lost: Math.round(h[k] - m.currentHp), left: Math.round(m.burnTimer) });
    out.dot = { tickMs: LX_BURN_TICK_MS, plain: tk(plain, 'plain'), stunned: tk(stunned, 'stunned'), frozen: tk(frozen, 'frozen'), far: tk(far, 'far'), err: out.err || null };
    // ---- 2: a shackle lock from a caster that dies
    game.monsters.length = 0; player._god = false; player.invulnerable = 0; player.hp = getMaxHp();
    const c1 = spawnMonster(player.x + 150, player.y - 20, 'horny', false);
    _qteShackleStart(c1); const started = !!_QTE.active;
    c1.currentHp = 0; game._iteratingMonsters = false; killMonster(c1);
    out.lock = { started, activeAfterKill: !!_QTE.active, stun: player.stunTimer | 0, card: (_QTE.el && _QTE.el.style.display) || '' };
    if (_QTE.active) { _qteEnd(false); _qteHide(0); }
    // ...a revivesOnce caster's first fall is not a death: the lock stays
    const c2 = spawnMonster(player.x + 150, player.y - 20, 'horny', false);
    c2.traits = Object.assign({}, c2.traits || {}, { revivesOnce: { hpPct: 0.3 } }); c2._revivedOnce = false;
    player.hp = getMaxHp(); _qteShackleStart(c2); const started2 = !!_QTE.active;
    c2.currentHp = 0; killMonster(c2);
    out.lockRevive = { started: started2, revived: c2.currentHp > 0 && game.monsters.includes(c2), active: !!_QTE.active };
    if (_QTE.active) { _qteEnd(false); _qteHide(0); }
    // ---- 3: the downed beat clears the slow / skill lock / ice floor
    player._slowTimer = 5000; player._skillLockTimer = 5000; player._iceFloor = 5000;
    let downed = null; try { downed = _coopTryDowned(); } catch (e) { downed = 'threw ' + String(e).slice(0, 80); }
    out.down = { downed, isDown: !!player._downed, slow: player._slowTimer | 0, lock: player._skillLockTimer | 0, ice: player._iceFloor | 0 };
    player._downed = false; player.hp = getMaxHp(); player._god = true; player.invulnerable = 1e12;
    // ---- 5: the failed frame
    const set = _monsterFramesFor('petalfly');
    for (let i = 0; i < 40 && !(set.idle[0] && set.idle[0].complete); i++) await sleep(100);
    out.frame = { first: { complete: !!set.idle[0].complete, w: set.idle[0].naturalWidth } };
    const t0 = performance.now();
    while (performance.now() - t0 < 8000 && !(set.idle[0].naturalWidth > 0)) { _monsterFramesFor('petalfly'); await sleep(250); }
    for (let i = 0; i < 8; i++) { _monsterFramesFor('petalfly'); await sleep(250); }   // lookups after the recovery cost nothing
    out.frame.after = { w: set.idle[0].naturalWidth, same: _monsterFramesFor('petalfly') === set, ms: Math.round(performance.now() - t0) };
    return out;
  }, { setup, FAIL_FRAME });
  // 4 - the registration asks for an update (a stub container: the real worker never installs)
  const sctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await sctx.addInitScript(() => {
    window.__swUpd = 0; window.__swReg = 0;
    try { if (window.ServiceWorkerContainer) ServiceWorkerContainer.prototype.register = function () { window.__swReg++; return Promise.resolve({ update() { window.__swUpd++; return Promise.resolve(); } }); }; } catch (e) {}
  });
  const sp = await sctx.newPage(); sp.on('pageerror', (e) => errs.push('sw: ' + String(e.message).slice(0, 120)));
  await bootIn(sp); await sp.waitForTimeout(800);
  const S = await sp.evaluate(() => ({ reg: window.__swReg, upd: window.__swUpd }));

  ok('1. a burning mob ticks exactly once per interval (no double tick): 3 ticks in 2.5 s', D.dot.plain.ticks === 3 && D.dot.plain.lost > 0 && !D.dot.err, D.dot.plain);
  ok('1. ...a STUNNED mob burns on (same 3 ticks)', D.dot.stunned.ticks === 3 && D.dot.stunned.lost === D.dot.plain.lost, D.dot.stunned);
  ok('1. ...a FROZEN mob burns on (same 3 ticks)', D.dot.frozen.ticks === 3 && D.dot.frozen.lost === D.dot.plain.lost, D.dot.frozen);
  ok('1. ...a mob in the far (off-screen) tier burns on (same 3 ticks)', D.dot.far.ticks === 3 && D.dot.far.lost === D.dot.plain.lost, D.dot.far);
  ok('2. a shackle lock ends when its caster dies (no lock, no stun, card hidden)', D.lock.started && !D.lock.activeAfterKill && D.lock.stun === 0 && D.lock.card === 'none', D.lock);
  ok('2. ...but a revivesOnce fall keeps it', D.lockRevive.started && D.lockRevive.revived && D.lockRevive.active, D.lockRevive);
  ok('3. going down clears the slow, the skill lock and the ice floor', D.down.isDown && D.down.slow === 0 && D.down.lock === 0 && D.down.ice === 0, D.down);
  ok('4. the service worker registration asks for an update at boot', S.reg >= 1 && S.upd >= 1, S);
  // (the set may be built by the boot warm-up, so the first lookup here can already be the retry - the route proves the failure)
  ok('5. the frame really failed first (its first image request was dropped as offline)', req.failed === 1 && (D.frame.first.w === 0 || req.img >= 2), { ...D.frame.first, req });
  ok('5. ...and is re-requested and drawn (same set), within a few requests', D.frame.after.w > 0 && D.frame.after.same && req.img >= 2 && req.img <= 3, { ...D.frame.after, req });
  ok('no page errors', errs.length === 0, errs);
} finally { await browser.close(); server.kill(); }
console.log(`\n${fail ? 'FAIL' : 'PASS'}(${fail}) - ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
