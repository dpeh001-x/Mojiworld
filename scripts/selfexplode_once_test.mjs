// A PIERCING EXPLOSIVE SHOT HURTS EACH MONSTER ONCE (v0.30.1437). Such a shot (Apotheosis's Inferno and Glacial comet)
// strikes what it passes, splashes on its first impact, and bursts again at the end of its flight - and that last blast
// hit everyone in it again. In the running game a piercing, self-exploding comet falls through monster A onto the floor:
//   A (struck directly) takes the direct hit only - not the landing blast as well;
//   B (beside A, inside the impact splash) takes that splash only - not the landing blast as well;
//   C (further out, reached only by the landing) still takes the landing blast - the landing still bursts.
//   node scripts/selfexplode_once_test.mjs [port]      (MOJI_SERVE_ROOT overrides the served tree)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.argv[2] || process.env.PORT || 10263); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  ' + JSON.stringify(note) : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof spawnMonster === 'function', null, { timeout: 180000 }); await page.waitForTimeout(5000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const out = { ver: GAME_VERSION };
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {} try { _cineScoreStop(1, false); } catch (e) {}
    try { loadMap('forest', 300); } catch (e) {} await sleep(600); player.level = 99; player._god = true; player.invulnerable = 1e9;
    game.paused = false; { const tl = performance.now(); while (!player.onGround && performance.now() - tl < 4000) await sleep(30); } await sleep(200);
    const floor = player.y + player.h; game.monsters.length = 0; game.projectiles = []; game.hazards = [];
    const mk = (type, cx) => { spawnMonster(cx, floor - monsterTypes[type].h, type, false); const m = game.monsters[game.monsters.length - 1]; m.x = cx - m.w / 2; m.y = floor - m.h; m.currentHp = m.maxHp = 1e12; m.evasion = 0; return m; };
    const ax = player.x + 260;
    const A = mk('mummy', ax), B = mk('slime', ax + 50), C = mk('slime', ax + 95);
    const pos = [A, B, C].map((m) => ({ m, x: m.x, y: m.y }));
    const hold = () => { for (const q of pos) { q.m.x = q.x; q.m.y = q.y; q.m.vx = 0; q.m.vy = 0; q.m.currentHp = q.m.maxHp; } player.x = ax - 330; player.vx = 0; };
    const R = 100, top = A.y - 150, landY = floor - 10;   // the comet's centre lands 10 px over the floor
    // geometry the test relies on: B inside the impact splash (at A's top), C outside it but inside the landing blast
    const impact = { x: ax, y: A.y - 10 }, land = { x: ax, y: landY }, ctr = (m) => ({ x: m.x + m.w / 2, y: m.y + m.h / 2 }), d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    out.geo = { bImpact: Math.round(d(ctr(B), impact)), bLand: Math.round(d(ctr(B), land)), cImpact: Math.round(d(ctr(C), impact)), cLand: Math.round(d(ctr(C), land)), aLand: Math.round(d(ctr(A), land)) };
    const hits = new Map([[A, []], [B, []], [C, []]]); const oHit = window.hitMonster;
    window.hitMonster = function (m, dmg) { if (hits.has(m)) hits.get(m).push(Math.round(dmg)); return oHit.apply(this, arguments); };
    try {
      hold(); await sleep(100);
      const shot = { x: ax - 10, y: top, w: 20, h: 20, vx: 0, vy: 8, life: Math.ceil((landY - (top + 10)) / 8) + 1, owner: 'player', skill: 'bolt', damage: 1000,
        pierce: true, explode: R, selfExplode: true, noGravity: true, _arc: true, _msHandled: true, color: '#8ef' };
      game.projectiles.push(shot);
      const t0 = performance.now(); while (performance.now() - t0 < 3000 && game.projectiles.includes(shot)) { hold(); await sleep(8); }
      await sleep(100); out.gone = !game.projectiles.includes(shot);
    } finally { window.hitMonster = oHit; game.paused = true; }
    out.A = hits.get(A); out.B = hits.get(B); out.C = hits.get(C);
    return out;
  });
  console.log('build ' + r.ver + '   geometry ' + JSON.stringify(r.geo));
  ok('harness: B sits inside the impact splash, C only inside the landing blast', r.geo.bImpact < 100 && r.geo.cImpact >= 100 && r.geo.cLand < 100 && r.geo.bLand < 100 && r.geo.aLand < 100, r.geo);
  ok('the comet fell through and landed', r.gone, null);
  ok('A, struck directly on the way down, takes that hit ONLY (was: + the landing blast)', r.A.length === 1 && r.A[0] >= 900, r.A);
  ok('B, splashed on impact, takes that splash ONLY (was: + the landing blast, 0.7 x twice)', r.B.length === 1, r.B);
  ok('C, reached only by the landing, still takes the landing blast', r.C.length === 1, r.C);
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('HARNESS ERROR', false, String(e && e.stack || e).slice(0, 300)); }
finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
