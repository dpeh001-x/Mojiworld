// CO-OP KILL TRUST (v0.30.862, per user "co-op guests trust the host's kill rewards; fix this"): a guest pays a host kill
// frame only for a monster it mirrored itself, of the same type, and never more than a bounded multiple of its own table.
// One page plays the guest: net says a host exists, mirrors are real spawns flagged as mirrors, frames go through
// _coopApplyKill exactly as the relay would deliver them.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/coop_kill_trust_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11165';
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
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _coopApplyKill === 'function', null, { timeout: 180000 }); await page.waitForTimeout(4000);
  const r = await page.evaluate(async () => { const sleep = (ms) => new Promise((r2) => setTimeout(r2, ms));
    try { _lxBootGateDone = true; _prologueActive = false; _playStoryBeat = function () { return false; }; _playBossIntro = function () {}; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'warrior'; player.level = 40; player._god = true; player._tutorialSeen = true;
    loadMap('glasswindSteppe', 900); await sleep(1500); game.paused = false;
    net.isHost = false; net.hostId = 7; let uid = 880000;
    const mirror = (type, boss) => { const m = spawnMonster(player.x + 300, player.y - 20, type, !!boss, false); m.uid = ++uid; m._coopMirror = true; return m; };
    const frame = (m, e, c, over) => Object.assign({ t: 'kill', id: 7, u: m ? m.uid : ++uid, e, c, x: player.x + 300, y: player.y, map: game.currentMap, tp: m ? m.type : 'slime', b: m && m.isBoss ? 1 : 0, il: 0 }, over || {});
    const pay = (f) => { const e0 = player.exp, lv0 = player.level, c0 = player.mojicoins || 0, k0 = (player.quests && JSON.stringify(player.quests.active || {})) || '';
      player.level = 40; _coopApplyKill(f); const out = { exp: player.exp - e0 + (player.level - lv0) * 1e9, coins: (player.mojicoins || 0) - c0 }; player.level = 40; return out; };
    const a = mirror('slime'); const honest = pay(frame(a, a.exp, a.mojicoins));
    const b = mirror('slime'); const inflated = pay(frame(b, 1e9, 1e9));
    const forged = pay(frame(null, 5000, 5000));
    const c = mirror('slime'); const wrongType = pay(frame(c, c.exp, c.mojicoins, { tp: 'dragon' }));
    const d = mirror('mooma', true); const bossHonest = pay(frame(d, d.exp * 10, d.mojicoins * 10));
    const e = mirror('mooma', true); const bossInflated = pay(frame(e, 1e12, 1e12));
    return { mirrorExp: a.exp, mirrorCoins: a.mojicoins, honest, inflated, forged, wrongType, bossHonest, bossInflated, bossExp: d.exp, bossLv: d.level };
  });
  check(r.honest.exp > 0, 'an honest kill of a mirrored monster still pays', J({ honest: r.honest, mirrorExp: r.mirrorExp }));
  check(r.inflated.exp > 0 && r.inflated.exp <= r.honest.exp * 6 + 6 && r.inflated.coins <= Math.max(1, r.honest.coins) * 6 + 6, 'a frame claiming 1e9 EXP and coins pays at most 6x what the guest\u2019s own table gives (was: all of it)', J({ inflated: r.inflated, honest: r.honest }));
  check(r.forged.exp === 0 && r.forged.coins === 0, 'a kill of a uid the guest never mirrored pays nothing (was: 5000 EXP base)', J(r.forged));
  check(r.wrongType.exp === 0, 'a kill frame naming a different type than the mirror pays nothing', J(r.wrongType));
  check(r.bossHonest.exp > 0, 'a boss kill paying 10x the guest\u2019s table (e.g. a Nightmare echo) still pays in full', J({ bossHonest: r.bossHonest, bossExp: r.bossExp, bossLv: r.bossLv }));
  check(r.bossInflated.exp < 1e9, 'a boss frame claiming 1e12 is bounded', J(r.bossInflated));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 3)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
