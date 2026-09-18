// SIEGE ARROWS (v0.30.855, per user "do not cut monsters atk"): Siege Volley / War Machine arrows stagger their target and change
// nothing else. Before: each arrow multiplied a non-boss target's ATK by 0.85 with no floor and no end - one volley (104 hits) took a
// normal monster and an elite from 1000 ATK to 1 inside two seconds, permanently (bosses and mini-bosses were exempted in v0.30.850).
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/siege_arrows_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11149';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } })).newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof castSkill === 'function', null, { timeout: 180000 }); await page.waitForTimeout(5000);
  const r = await page.evaluate(async () => { const sleep = (ms) => new Promise((r2) => setTimeout(r2, ms));
    try { _lxBootGateDone = true; _prologueActive = false; _playStoryBeat = function () { return false; }; _playBossIntro = function () {}; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    loadMap('glasswindSteppe', 900); await sleep(2500); game.paused = false; for (let i = 0; i < 30 && !player.onGround; i++) await sleep(100);
    const x0 = player.x, y0 = player.y;
    const hero = () => { player.cls = 'archer'; player.job = 'sniper'; player.master = 'ballista'; player.masteries = { ballista: true }; player._god = true; player.level = 90; player.baseAtk = 1000; player.maxMp = 99999; player.mp = 99999; player.hp = player.maxHp = 999999; player.facing = 1; player.x = x0; player.y = y0;
      for (const k of Object.keys(player.skillCooldowns || {})) player.skillCooldowns[k] = 0; game.projectiles.length = 0; player._ballistaChannel = null; player._ballistaTurrets = []; };
    const mob = (kind) => { const m = kind === 'boss' ? spawnMonster(player.x + 260, player.y - 40, 'king', true, false) : spawnMonster(player.x + 260, player.y - 10, 'slime', false, kind === 'miniboss'); if (kind === 'elite') m.isElite = true; m.maxHp = m.currentHp = 9e12; m.evasion = 0; m.speed = 0; m.atk = 1000; m.stunTimer = 0; return m; };
    let log = null; const _hm = window.hitMonster; window.hitMonster = function (m, d, c, tag) { if (log && m === log.m) log.n++; return _hm.apply(this, arguments); };
    const out = {};
    for (const kind of ['normal', 'elite', 'miniboss', 'boss']) { hero(); game.monsters.length = 0; const m = mob(kind); await sleep(400);
      log = { m, n: 0 }; castSkill('ballista_volley'); let low = m.atk, stunned = 0; const t1 = performance.now();
      while (performance.now() - t1 < 9500) { await sleep(100); m.x = player.x + 260; m.vx = 0; if (kind === "boss" || kind === "miniboss") { m.frozen = 99999; m.vy = 0; m.patternState = "idle"; }   /* a boss leaps out of the stream otherwise */ low = Math.min(low, m.atk); if ((m.stunTimer | 0) > 0) stunned++; }
      out[kind] = { hits: log.n, low, after: m.atk, stunnedSamples: stunned }; log = null; player._ballistaChannel = null; game.projectiles.length = 0; }
    // the turret too (War Machine): a few homing arrows, ATK untouched
    hero(); game.monsters.length = 0; const t = mob('normal'); await sleep(400); log = { m: t, n: 0 }; castSkill('ballista_ult'); const t2 = performance.now();
    while (performance.now() - t2 < 5000) { await sleep(100); t.x = player.x + 260; t.vx = 0; } out.turret = { hits: log.n, atk: t.atk }; log = null; player._ballistaTurrets = [];
    window.hitMonster = _hm; game.monsters.length = 0; return out; });
  for (const k of ['normal', 'elite', 'miniboss', 'boss']) check(r[k].hits >= 40 && r[k].low === 1000 && r[k].after === 1000, `a full Siege Volley never changes a ${k} monster's ATK (it used to reach 1 on a normal monster and an elite)`, J(r[k]));
  check(r.normal.stunnedSamples > 0 && r.elite.stunnedSamples > 0, 'the arrows still stagger (the 0.4 s stun is kept)', J({ normal: r.normal.stunnedSamples, elite: r.elite.stunnedSamples }));
  check(r.turret.hits >= 2 && r.turret.atk === 1000, 'War Machine\u2019s turret arrows leave ATK alone too', J(r.turret));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 3)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
