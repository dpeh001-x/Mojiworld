// BOSS POLISH (final polish audit B1-B4, per user "Work on all the above"). Gravitos and Octobaby fall in their own
// words, not Aetherion's; Pisces' Tidal Crush gives the 1 s it promises and draws its spot; a move that takes a flat
// share of max HP (Taurus's gore, the Arbiter's VERDICT) draws its lane however tough the player is; a Gemini split
// does not replay the entrance banner, and killing the twin plays neither the kill slow-mo nor "Choose a powerup!".
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/boss_polish_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11197';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof ZODIAC_AI === 'object' && typeof killMonster === 'function', null, { timeout: 120000 });
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms)); const out = {};
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'warrior'; player.level = 90; player._tutorialSeen = true; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    loadMap('forest', 300); await sleep(2500); game.paused = false; try { closeAllModals(); } catch (e) {}
    const toasts = []; const _st = showToast; window.showToast = function (m) { toasts.push(String(m)); return _st.apply(this, arguments); };
    const spawn = (type) => { game.monsters.length = 0; spawnMonster(player.x + 300, player.y - 40, type, true, false); return game.monsters[game.monsters.length - 1]; };
    // B1 — super boss lines
    out.lines = {};
    for (const type of ['gravitos', 'octobaby', 'aetherion']) {
      const m = spawn(type); toasts.length = 0;
      try { _triggerSuperBossDeathRaw(m); } catch (e) { out.lines[type] = 'threw ' + e.message; continue; }
      await sleep(1100); out.lines[type] = toasts.filter((x) => /FALLS|DETHRONED|trembles|moods|weight/i.test(x));
    }
    game.drops.length = 0;
    // B2 — Pisces' Tidal Crush
    const zp = ZODIAC_SIGNS.find((z) => z.id === 'pisces'); const p = spawn('zodiac_pisces');
    p._piscesSplit = true; p._piscesDreamAt = 1e12; p._tidalAt = (game.time | 0) - 1;
    player.invulnerable = 0; player._god = false; player.hp = getMaxHp(); const hp0 = player.hp;
    ZODIAC_AI.pisces(p, 16, 300, 2, zp);
    out.tidal = { armedT: p._tidalT, zone: (_lxAttackZones().find((z) => z.tg === 'gravitos_riftring') || null) };
    let t = 0; while (p._tidalArmed && t < 3000) { p.x = player.x + 300; player.invulnerable = 0; ZODIAC_AI.pisces(p, 16, 300, 2, zp); t += 16; }
    out.tidal.resolvedAfterMs = t; out.tidal.hit = player.hp < hp0;
    // B3 — flat-share lanes on a player whose HP dwarfs the boss's ATK
    const _gm = window.getMaxHp; window.getMaxHp = () => 1e9;
    const arb = spawn('towerArbiter'); arb._bigMeleeFiring = true; arb._bigMeleeT = 200;
    out.worthy = _lxZoneWorthy(arb, 2.2); out.verdictLane = _lxAttackZones().some((z) => z.kind === 'swing');
    const tau = spawn('zodiac_taurus'); tau._braceDashing = true; tau._bdPhase = 'brace'; tau._bdT = 400; tau._bdDir = 1;
    out.goreLane = _lxAttackZones().some((z) => z.kind === 'dash');
    window.getMaxHp = _gm;
    // B4 — a Gemini split and the twin's death
    const zg = ZODIAC_SIGNS.find((z) => z.id === 'gemini'); const g = spawn('zodiac_gemini'); g.currentHp = Math.floor(g.maxHp * 0.4);
    const bi = document.getElementById('boss-intro'); bi.style.display = 'none'; await sleep(50);
    ZODIAC_AI.gemini(g, 16, 300, 2, zg);
    const twin = game.monsters.find((x) => x && x._isTwin);
    out.split = { twin: !!twin, banner: bi.style.display };
    toasts.length = 0; game._slowmoFrames = 0;
    if (twin) { twin.currentHp = 0; killMonster(twin); }
    let _smMax = game._slowmoFrames || 0; for (let i = 0; i < 30; i++) { await sleep(10); _smMax = Math.max(_smMax, game._slowmoFrames || 0); }
    out.twinKill = { toasts: toasts.slice(0, 4), slowmo: _smMax };
    return out;
  });
  const L = r.lines;
  check(Array.isArray(L.gravitos) && L.gravitos.some((x) => /WEIGHT-BEARER FALLS/.test(x)) && !L.gravitos.some((x) => /SHARDFATHER/.test(x)), 'Gravitos falls in his own words, not "THE SHARDFATHER FALLS!"', J(L.gravitos));
  check(Array.isArray(L.octobaby) && L.octobaby.some((x) => /OCTOBABY IS DETHRONED/.test(x)) && !L.octobaby.some((x) => /SHARDFATHER/.test(x)), 'Octobaby falls in her own words', J(L.octobaby));
  check(Array.isArray(L.aetherion) && L.aetherion.some((x) => /SHARDFATHER FALLS/.test(x)), 'Aetherion keeps "THE SHARDFATHER FALLS!"', J(L.aetherion));
  check(r.tidal.armedT >= 960 && r.tidal.resolvedAfterMs + 16 >= 950 && r.tidal.hit, 'Tidal Crush lands a full second after it is called (was ~60 ms), on a player who stayed', J({ armedT: r.tidal.armedT, ms: r.tidal.resolvedAfterMs, hit: r.tidal.hit }));
  const z = r.tidal.zone;
  check(!!z && z.w >= 226 && z.h >= 226, 'the crush spot is drawn, covering the whole box it hits', J(z && { w: z.w, h: z.h, tg: z.tg }));
  check(!r.worthy && r.verdictLane, 'the Arbiter\'s swing (a VERDICT takes a flat third of max HP) draws its lane even when his ATK is small next to your HP', J({ worthy: r.worthy, lane: r.verdictLane }));
  check(r.goreLane, 'Taurus\'s goring charge (a flat share of max HP) always draws its lane', J(r.goreLane));
  check(r.split.twin && r.split.banner !== 'block', 'a Gemini split does not replay the entrance banner', J(r.split));
  check(r.twinKill.toasts.some((x) => /twin falls/i.test(x)) && !r.twinKill.toasts.some((x) => /Choose a powerup/.test(x)), 'killing the twin says a twin fell, not "Choose a powerup!" (no boon follows)', J(r.twinKill.toasts));
  check(r.twinKill.slowmo < 40, 'killing the twin does not play the boss-kill slow-mo', J(r.twinKill.slowmo));
  check(errs.length === 0, 'no page errors', errs.slice(0, 2).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
