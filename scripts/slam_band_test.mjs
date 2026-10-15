// ARENA-WIDE SLAM BANDS (final polish audit B5; per user "Work on all the above"). Mooma's quake, King Krook's earthquake
// and stomp, the Sundered Smith's anvil toll and Capricorn's hoofquake draw a floor band across the visible arena for
// exactly their windup - on at the call, gone once the slam lands - at the level the boss stands on.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/slam_band_test.mjs [page.html] [--shot=<png>]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11209';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const SHOT = (process.argv.find((a) => a.startsWith('--shot=')) || '').slice(7);
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
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _lxAttackZones === 'function', null, { timeout: 120000 });
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms)); const out = {};
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'warrior'; player.level = 40; player._tutorialSeen = true; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    try { LX_PERF.veryLowFx = false; } catch (e) {}
    loadMap('forest', 300); await sleep(2000); try { closeAllModals(); } catch (e) {} game.paused = true;
    const one = (type) => { game.monsters.length = 0; spawnMonster(player.x + 200, player.y - 40, type, true, false); const m = game.monsters[game.monsters.length - 1]; m.patternState = 'idle'; m.patternTimer = 0; return m; };
    const bands = (m) => { const z = _lxAttackZones().filter((q) => q.tg === 'tg_smash' && q.kind === 'smash' && q.w >= 280); return { n: z.length, prog: z.length ? +z[0].prog.toFixed(2) : null, y: z.length ? Math.round(z[0].y) : null, feet: Math.round(m.y + m.h) }; };
    // v0.30.1778 quake-bands: Krook, the Smith and Capricorn wear their own bands on the surfaces they reach too, once their art has decoded
    const art = async (t) => { for (let i = 0; i < 60 && !(LX_FX['tg_smash_' + t] && _lxFxReady(LX_FX['tg_smash_' + t])); i++) await sleep(100); };
    const surf = () => { const z = _lxAttackZones().filter((q) => q.kind === 'smash'), P = game.mapData.platforms || []; return { n: z.length, tg: [...new Set(z.map((q) => q.tg))].join(), prog: z.length ? +z[0].prog.toFixed(2) : null,
      onSurf: z.length > 0 && z.every((q) => P.some((p) => q.x >= p.x - 0.5 && q.x + q.w <= p.x + p.w + 0.5 && q.y + q.h > p.y - 2 && q.y + q.h < p.y + 30)) }; };
    let m = one('mooma');
    // v0.30.1773 mooma-quake: her own band, laid on the surfaces themselves (where exactly: mooma_quake_band_test), once her art has decoded
    for (let i = 0; i < 60 && !(LX_FX.tg_smash_mooma && _lxFxReady(LX_FX.tg_smash_mooma)); i++) await sleep(100);
    m.patternState = 'quake'; m.patternTimer = 600; m._quakeFired = false;
    { const z = _lxAttackZones().filter((q) => q.kind === 'smash'); out.mooma = { n: z.length, tg: [...new Set(z.map((q) => q.tg))].join(), prog: z.length ? +z[0].prog.toFixed(2) : null,
      onSurf: z.length > 0 && z.every((q) => (game.mapData.platforms || []).some((p) => Math.abs(q.y + q.h - 5 - p.y) <= 1 && q.x >= p.x - 0.5 && q.x + q.w <= p.x + p.w + 0.5)) }; }
    m.patternTimer = 1250; out.moomaAfter = _lxAttackZones().filter((q) => q.kind === 'smash').length;
    m = one('kingKrook'); await art('kingKrook'); m.patternState = 'earthquake'; m.patternTimer = 300; m._kFired = false; out.krookQuake = surf();
    m.patternState = 'stomp'; m.patternTimer = 550; out.krookStomp = surf();
    m._kFired = true; out.krookFired = surf().n;
    m.patternState = 'fireBreath'; m._kFired = false; m.patternTimer = 300; out.krookOther = surf().n;
    m = one('sundered_smith'); await art('sundered_smith');
    { let gy = null; for (const p of game.mapData.platforms || []) if (p && p.type === 'ground' && m.x + m.w / 2 >= p.x && m.x + m.w / 2 <= p.x + p.w && (gy == null || p.y < gy)) gy = p.y; if (gy != null) m.y = gy - m.h; }   // on the ground: his toll's waves run the floor he stands on
    m._smithTollTellAt = performance.now() - 200; out.smith = surf(); m._smithTollTellAt = performance.now() - 900; out.smithAfter = surf().n;
    m = one('zodiac_capricorn'); await art('zodiac_capricorn'); m._capQuakeFiring = true; m._capQuakeT = 400; out.cap = surf(); m._capQuakeT = 0; out.capAfter = surf().n;
    // a frame with Mooma winding up, for the eye
    m = one('mooma'); m.patternState = 'quake'; m.patternTimer = 900; m._quakeFired = false;
    for (let i = 0; i < 30 && !(LX_FX.tg_smash && _lxFxReady(LX_FX.tg_smash)); i++) await sleep(100);
    return out;
  });
  const band = (b) => b && b.n >= 4 && Math.abs(b.y - (b.feet - 42)) <= 2;
  const own = (b, t) => !!(b && b.n >= 1 && b.tg === 'tg_smash_' + t && b.onSurf);   // v0.30.1778 quake-bands - its own band, on the surfaces (quake_bands_test pins which)
  check(r.mooma.n >= 1 && r.mooma.tg === 'tg_smash_mooma' && r.mooma.onSurf && Math.abs(r.mooma.prog - 0.5) < 0.05, 'Mooma\'s quake lays her own band on the surfaces themselves (floor and ledges), filling with the windup (v0.30.1773)', J(r.mooma));
  check(r.moomaAfter === 0, '...and it is gone once the quake lands', J(r.moomaAfter));
  check(own(r.krookQuake, 'kingKrook') && own(r.krookStomp, 'kingKrook'), 'King Krook\'s earthquake and stomp both draw it - his own band, on the surfaces (v0.30.1778)', J({ q: r.krookQuake, s: r.krookStomp }));
  check(r.krookFired === 0 && r.krookOther === 0, '...not after the slam fires, and not for his other attacks', J({ fired: r.krookFired, other: r.krookOther }));
  check(own(r.smith, 'sundered_smith') && r.smithAfter === 0, 'the Sundered Smith\'s anvil toll draws his own band on his floor for its 700 ms tell (v0.30.1778)', J({ s: r.smith, after: r.smithAfter }));
  check(own(r.cap, 'zodiac_capricorn') && Math.abs(r.cap.prog - 0.5) < 0.05 && r.capAfter === 0, 'Capricorn\'s hoofquake draws her own band near her for its windup (v0.30.1778)', J({ c: r.cap, after: r.capAfter }));
  if (SHOT) { await page.evaluate(() => { game.paused = false; }); await page.waitForTimeout(250); await page.evaluate(() => { game.paused = true; }); await page.screenshot({ path: SHOT }); }
  check(errs.length === 0, 'no page errors', errs.slice(0, 2).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
