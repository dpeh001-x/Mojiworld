// LAUNCH SWEEP - runaway loops and soft-locks (v0.30.834). Each check reproduces the failure, then expects the guard.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/launch_hardening_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync, readFileSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11139';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const SRC = readFileSync(cand ? path.resolve(SERVE_ROOT, cand) : path.join(SERVE_ROOT, 'mojiworld_game.html'), 'utf8');
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block' })).newPage(); const errs = [], loopLogs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160))); page.on('console', (m) => { if (m.type() === 'error' && /^\[loop\]/.test(m.text())) loopLogs.push(1); });
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof tryPortal === 'function' && typeof _prologueFinish === 'function', null, { timeout: 180000 }); await page.waitForTimeout(3500);
  await page.evaluate(() => { try { _lxBootGateDone = true; window._prologueActive = false; _playStoryBeat = function () { return false; }; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'warrior'; player.level = 60; player._god = true; loadMap('forest', 600); game.paused = false; });
  // ---- 1. the prologue's poll ends with the prologue, and never touches a boss outside it ----
  const poll = await page.evaluate(() => { const st = window.setTimeout; let rearmed = 0; window.setTimeout = function (fn) { if (fn === _prologueHardenBoss) { rearmed++; return 0; } return st.apply(this, arguments); };
    game.monsters.length = 0; window._prologueActive = false; _prologueHardenBoss(); const idle = rearmed;
    const g = spawnMonster(player.x + 300, player.y - 60, 'gravitos', true, false); const hp = g.maxHp; _prologueHardenBoss(); const outside = { same: g.maxHp === hp, echo: !!g._echoBoss, exp: g.exp > 0 };
    window._prologueActive = true; _prologueHardenBoss(); const inside = { x4: g.maxHp === hp * 4, echo: !!g._echoBoss }; window._prologueActive = false; window.setTimeout = st; game.monsters.length = 0; return { idle, outside, inside }; });
  check(poll.idle === 0 && poll.outside.same && !poll.outside.echo && poll.outside.exp && poll.inside.x4 && poll.inside.echo, 'prologue boss-hardening: no poll and no touch outside the prologue (the REAL Gravitos keeps his HP, EXP and kill); inside it, unchanged', J(poll));
  // ---- 2. the prologue ends once; no portals inside it; its Void cutscene survives a play() that throws ----
  const pro = await page.evaluate(() => { const lm = loadMap; let loads = 0; loadMap = function () { loads++; }; window._prologueActive = false; try { _prologueFinish(false); } catch (e) {} const second = loads;
    loadMap = lm; loadMap('void', 400); game.paused = false; const po = game.portals[0]; player.x = po.x - player.w / 2; let went = 0; loadMap = function () { went++; }; const st = startTutorial; startTutorial = function () { went++; };
    window._prologueActive = true; try { tryPortal(); } catch (e) {} window._prologueActive = false; const inPrologue = went; loadMap = lm; startTutorial = st; return { second, inPrologue }; });
  check(pro.second === 0 && pro.inPrologue === 0, 'a second _prologueFinish does nothing; Up on the Void portal does nothing during the prologue', J(pro));
  const vc = await page.evaluate(async () => { const pl = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { throw new Error('sync play failure'); }; let cb = 0, threw = '', keys = 0;
    // count the keydown listeners it leaves on window (the game's own key handler prevents Enter too, so "was Enter eaten" proves nothing)
    const ae = window.addEventListener, re = window.removeEventListener; window.addEventListener = function (t) { if (t === 'keydown') keys++; return ae.apply(this, arguments); }; window.removeEventListener = function (t) { if (t === 'keydown') keys--; return re.apply(this, arguments); };
    try { _prologueVoidCutscene(() => { cb++; }); } catch (e) { threw = String(e.message); } HTMLMediaElement.prototype.play = pl; window.addEventListener = ae; window.removeEventListener = re; await new Promise((r) => setTimeout(r, 200));
    const left = !!document.getElementById('prologue-void-cine'); const el = document.getElementById('prologue-void-cine'); if (el) el.remove(); return { cb, threw, left, keysLeft: keys }; });
  check(vc.cb === 1 && !vc.threw && !vc.left && vc.keysLeft <= 0, 'the Void cutscene whose play() throws: finishes, removes its black cover, leaves no key-eating listener', J(vc));
  // ---- 3. Aetherion's teleport on a narrow arena (run ONLY when the bound is in the source: unbounded, it hangs the tab) ----
  if (!SRC.includes('++_tpTries < 24')) check(false, 'Aetherion teleport search is bounded', 'unbounded do-while in source - not executed, it would freeze this test');
  else { await page.evaluate(() => { loadMap('forest', 600); game.paused = false; }); await page.waitForTimeout(2500);   // the map's loading slices hold the sim for a moment
    const tp = await page.evaluate(() => { game.paused = false; game.monsters.length = 0; const w0 = game.mapData.worldWidth; game.mapData.worldWidth = 760; player.x = 380;
      const m = spawnMonster(300, player.y - 80, 'aetherion', true, false); m.maxHp = m.currentHp = 9e9; updateMonsters(16.67);   // his first update sets the phase and resets the pattern: let it, THEN force the teleport
      const t0 = performance.now(); for (let i = 0; i < 4 && !m._teleported; i++) { m.patternState = 'teleport'; m.patternTimer = 360; m._teleported = false; bossAI(m, 16.67, 80); }
      const r = { ms: Math.round(performance.now() - t0), x: m.x, moved: !!m._teleported }; game.mapData.worldWidth = w0; game.monsters.length = 0; return r; });
    check(tp.ms < 2000 && Number.isFinite(tp.x) && tp.moved, 'Aetherion teleports on a 760 px arena without hanging (no spot is 300 px from a centred player there)', J(tp)); }
  // ---- 4. the Titles panel holds its pause ----
  const tt = await page.evaluate(async () => { game.paused = false; openTitlesPanel(); const at0 = !!game.paused; await new Promise((r) => setTimeout(r, 5500)); const at5 = !!game.paused; const open = !!document.getElementById('titles-modal');
    const x = document.querySelector('#titles-modal .tt-x'); if (x) x.click(); await new Promise((r) => setTimeout(r, 300)); return { at0, at5, open, after: !!game.paused, closed: !document.getElementById('titles-modal') }; });
  check(tt.at0 && tt.at5 && tt.open && !tt.after && tt.closed, 'the Titles panel keeps the world paused for as long as it is open (it was released after 3 s), and closing it resumes', J(tt));
  // ---- 5. Steam Cloud: no reload unless the adopted save is really stored ----
  const sc = await page.evaluate(async () => { const keep = localStorage.getItem(SAVE_KEY); const cloudRaw = JSON.stringify({ v: 1, t: Date.now() + 5000, player: { level: 50, cls: 'warrior' } });
    window.SteamAPI = { available: true, cloud: { read: async () => cloudRaw, write: async () => true } }; localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, t: 1, player: { level: 1, cls: 'warrior' } }));
    game._resetting = false; const okRun = await _lxSteamCloudSync(); const stored = localStorage.getItem(SAVE_KEY) === cloudRaw; game._resetting = false;
    localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, t: 1, player: { level: 1, cls: 'warrior' } })); const si = Storage.prototype.setItem; Storage.prototype.setItem = function (k) { if (k === SAVE_KEY) throw new Error('QuotaExceededError'); return si.apply(this, arguments); };
    const failRun = await _lxSteamCloudSync(); Storage.prototype.setItem = si; const resetting = !!game._resetting; game._resetting = false; delete window.SteamAPI; if (keep == null) localStorage.removeItem(SAVE_KEY); else localStorage.setItem(SAVE_KEY, keep);
    return { okRun, stored, failRun: failRun === undefined ? 'none' : failRun, resetting }; });
  check(sc.okRun === 'reloading' && sc.stored && sc.failRun === 'none' && !sc.resetting, 'Steam Cloud: a stored cloud save reloads once; a write that FAILS does not ask for a reload (it looped for ever) and saving stays on', J(sc));
  // ---- 6. co-op reconnect gives up, and only 'welcome' resets the backoff ----
  const rc = await page.evaluate(() => { net._userClosed = false; net._lastUrl = 'ws://127.0.0.1:9'; net._lastName = 'T'; net._lastRoom = 'r'; if (net._reconnectTimer) { clearTimeout(net._reconnectTimer); net._reconnectTimer = null; }
    net._reconnectTries = 2; _mpScheduleReconnect(); const armed = !!net._reconnectTimer; clearTimeout(net._reconnectTimer); net._reconnectTimer = null;
    net._reconnectTries = 10; _mpScheduleReconnect(); const gaveUp = !net._reconnectTimer && net._reconnectTries === 0; if (net._reconnectTimer) { clearTimeout(net._reconnectTimer); net._reconnectTimer = null; }
    net._reconnectTries = 5; try { _mpHandle({ t: 'welcome', id: 7, room: 'r', players: [] }); } catch (e) {} const welcomed = net._reconnectTries === 0; net._userClosed = true; net._lastUrl = null; return { armed, gaveUp, welcomed }; });
  check(rc.armed && rc.gaveUp && rc.welcomed && !/ws\.onopen = \(\) => \{[\s\S]{0,400}?net\._reconnectTries = 0;/.test(SRC), 'co-op reconnect: retries normally, stops after 10 with a Retry banner, and the backoff resets on welcome - not on socket open', J(rc));
  // ---- 7. LAST (it walks the hero to town): a frame that throws every time is counted, recovered from, and not logged for ever ----
  await page.evaluate(() => { loadMap('forest', 600); game.paused = false; window.__poison = new Proxy({}, { get(t, k) { if (k === '__isPoison') return true; throw new Error('poisoned entity'); } }); game.monsters.push(window.__poison); });
  const rec = await page.waitForFunction(() => game.currentMap === 'town' && !game.monsters.some((m) => { try { return m.__isPoison; } catch (e) { return true; } }), null, { timeout: 40000 }).then(() => true).catch(() => false);
  await page.waitForTimeout(1500);
  const after = await page.evaluate(async () => { const has = typeof _lxLoopThrowRun !== 'undefined'; const a = has ? _lxLoopThrowRun : -1; await new Promise((r) => setTimeout(r, 1500)); return { map: game.currentMap, stillThrowing: has ? _lxLoopThrowRun - a : 'n/a', iter: !!game._iteratingMonsters }; });
  check(rec && after.stillThrowing === 0 && !after.iter && loopLogs.length <= 6, 'a poisoned monster that throws every frame: the scene is cleared and the hero is back in town within seconds, frames are clean again, the console got a handful of lines - not thousands', J({ recovered: rec, ...after, loopLogs: loopLogs.length }));
  // ---- 8. a throw INSIDE the death path: no overlay can show and every respawn handler refuses (they ask for game.dying > 0) ----
  await page.evaluate(() => { loadMap('forest', 600); game.paused = false; }); await page.waitForTimeout(2500);
  await page.evaluate(() => { window.__ks = _ksOnDeath; _ksOnDeath = function () { throw new Error('death preamble threw'); }; game.paused = false; player._god = false; player.invulnerable = 0; game.dying = 0; player.hp = 0; });
  const stood = await page.waitForFunction(() => player.hp > 0 && game.currentMap === 'town' && !(game.dying > 0), null, { timeout: 40000 }).then(() => true).catch(() => false);
  const dstate = await page.evaluate(() => { _ksOnDeath = window.__ks; const r = { hp: player.hp, dying: game.dying || 0, map: game.currentMap }; player._god = true; return r; });
  check(stood, 'a throw inside the death path (0 HP, no overlay, no respawn possible): the hero is stood up in town instead of being stuck until a reload', J(dstate));
  check(errs.length === 0, 'no uncaught page errors', J(errs.slice(0, 3)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
