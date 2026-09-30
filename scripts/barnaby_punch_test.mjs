// Confused Barnaby's haymaker plays once and lands on the full lunge (per user: "fully lunge like in gravitos").
// ============================================================================
// His punch set is redrawn from his idle (f0 = the idle frame, f1-5 cock the burning fist back, f6 the drive, f7-8 the
// full lunge) and _barnabyPunchFrame plays it on his boxer clock instead of the generic loop.
//   1. CALIB: the attack set draws at the idle's scale and offset (its f0 IS the idle), and its blow is f6 (720 ms)
//   2. PICKER: each boxer state shows its frames - the tell f0-5, the dash f6, the throw f7 then the lunge f8, the slip
//      back to guard in reverse, the settle f0; the footwork is left to the generic sets
//   3. HEAVY SWING: a live swing telegraph does not take the haymaker's body, but does own the settle beat
//   4. DRAWN: the boss draw asks the picker, and the jab draws the full lunge at the idle's exact rect (size + plant)
//   5. LIVE: over a real fight every throw draws the full lunge, the tell only f0-5, and nothing throws an error
// Run: node scripts/barnaby_punch_test.mjs   (PORT=..., MOJI_GAME_FILE=... for another build)
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = (process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')).replace(/\\/g, '/');
const require = createRequire(import.meta.url);
const { chromium } = require(ROOT + '/node_modules/playwright-core');
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const PORT = Number(process.env.PORT || 12867);
const res = [];
const ok = (n, c, extra) => { res.push({ n, pass: !!c }); console.log((c ? 'PASS ' : 'FAIL ') + n + (extra === undefined ? '' : '  [' + String(extra).slice(0, 220) + ']')); };

// 1. calib, straight from the data file
const cs = fs.readFileSync(ROOT + '/data/anim_calib.js', 'utf8');
const C = JSON.parse(cs.match(/window\.LX_ANIM_CALIB = ([\s\S]*?);\r?\nwindow\.LX_ATK_HITBOX = /)[1]).young_confused_barnaby;
const ft = C.attack.ft || [];
ok('1. CALIB: attack s/dx/dy = idle, blow f6, 720 ms', C.attack.s === C.idle.s && C.attack.dx === C.idle.dx && C.attack.dy === C.idle.dy
  && ft.length === 9 && ft.indexOf(Math.max(...ft)) === 6 && ft.reduce((a, b) => a + b, 0) === 720, JSON.stringify(C.attack));

const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1&lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function' && game.mapData, null, { timeout: 180000 });
  await page.waitForTimeout(4000);
  await page.evaluate(() => { try { _lxBootGateDone = true; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player._storyBeatsSeen = player._storyBeatsSeen || {}; if (typeof STORY_BEATS === 'object') for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true; });
  await page.waitForTimeout(2000);
  await page.evaluate(() => { window._prologueActive = false; player.level = 45; loadMap('forest');
    setInterval(() => { if ('maxHp' in player) player.maxHp = 1e7; for (const k of ['hp', 'currentHp']) if (k in player) player[k] = 1e7; game.paused = false; }, 60); });
  await page.waitForTimeout(3000);
  await page.evaluate(() => { for (const q of game.monsters) if (q) q.currentHp = 0; game.monsters = game.monsters.filter((q) => q && q.currentHp > 0);
    spawnMonster(player.x + 300, player.y - 150, 'young_confused_barnaby', true); if (typeof _lxWarmBossFrames === 'function') _lxWarmBossFrames('young_confused_barnaby'); });
  await page.waitForFunction(() => { const f = BOSS_ATTACK_FRAMES.young_confused_barnaby; return f && _lxFtReadyN(f) === 9; }, null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);

  // 2-4 with his AI frozen (the draw still runs)
  const P = await page.evaluate(async () => {
    const K = 'young_confused_barnaby', m = window.__bm = game.monsters.find((q) => q && q.type === K), FR = BOSS_ATTACK_FRAMES[K];
    const oB = window.bossAI; window.bossAI = function (mm) { if (mm === m) return; return oB.apply(this, arguments); };
    window.__traits = m.traits; m.traits = {}; m.speed = 0;
    const idx = (st, T, extra) => { m._bxState = st; m._bxT = T; Object.assign(m, extra || {}); const r = _barnabyPunchFrame(m, K); return r ? FR.indexOf(r) : null; };
    const pick = {
      wind: [260, 150, 0].map((T) => idx('wind', T)), dashIn: idx('dashIn', 300), jab: [0, 140, 60].map((T) => idx('jab', T)),
      fade: [420, 300, 150, 0].map((T) => idx('fade', T)), settle: idx('settle', 500), stalk: idx('stalk', 500),
    };
    const tel = { _bigMeleeFiring: true, _bigMeleeT: 400 };
    const heavy = { jab: idx('jab', 60, tel), settle: idx('settle', 500, tel) };
    m.traits = { bigMelee: window.__traits.bigMelee }; heavy.jab = idx('jab', 60, tel); heavy.settle = idx('settle', 500, tel);
    m._bigMeleeFiring = false; m._bigMeleeT = 0; m.traits = {};
    // drawn: rect of his sprite, scoped to his _drawBossSprite call
    const Pr = CanvasRenderingContext2D.prototype, oI = Pr.drawImage, oD = window._drawBossSprite, oP = window._barnabyPunchFrame;
    let inB = false, st = null, rect = {}, asked = 0, last = -1;
    window._drawBossSprite = function (a0, mm) { inB = mm === m; st = a0 && a0._lxSt; try { return oD.apply(this, arguments); } finally { inB = false; } };
    window._barnabyPunchFrame = function () { const r = oP.apply(this, arguments); asked++; last = r ? FR.indexOf(r) : -1; return r; };
    Pr.drawImage = function (im, ...a) { if (this === ctx && inB && a.length >= 4) { const n = a.length === 8 ? 4 : 0, t = this.getTransform(), xs = [a[n], a[n] + a[n + 2]].map((x) => t.a * x + t.e), ys = [a[n + 1], a[n + 1] + a[n + 3]].map((y) => t.d * y + t.f);
      rect[st] = [Math.min(...xs), Math.min(...ys), Math.abs(xs[1] - xs[0]), Math.abs(ys[1] - ys[0])].map(Math.round); } return oI.call(this, im, ...a); };
    const pose = async (st, ps, T, atk) => { m._bxState = st; m.patternState = ps; m._bxT = T; m.vx = 0; m.vy = 0; m.facing = 1; m.atkAnimUntil = atk ? performance.now() + 1e6 : 0; m._lxLastMoveAt = 0;
      asked = 0; rect = {}; await new Promise((r) => setTimeout(r, 900)); return { rect: rect[atk ? 'attack' : 'idle'] || null, asked, last }; };   // his idle FRAMES (a walk frame drawn while he settles is walk-calibrated)
    const idle = await pose('settle', 'idle', 0, false), jab = await pose('jab', 'jab', 60, true);
    Pr.drawImage = oI; window._drawBossSprite = oD; window._barnabyPunchFrame = oP; window.bossAI = oB; m.traits = window.__traits; m.speed = monsterTypes[K].speed;
    return { pick, heavy, idle, jab };
  });
  const p = P.pick, J = JSON.stringify;
  ok('2a. PICKER: the tell cocks the fist back f0 -> f2 -> f5', J(p.wind) === J([0, 2, 5]), J(p.wind));
  ok('2b. PICKER: the dash drives (f6), the throw is f7 then the full lunge f8', p.dashIn === 6 && J(p.jab) === J([7, 7, 8]), p.dashIn + ' ' + J(p.jab));
  ok('2c. PICKER: the slip holds the lunge, then back to guard in reverse (f8 -> f7 -> ... -> f0)', J(p.fade) === J([8, 7, 3, 0]), J(p.fade));
  ok('2d. PICKER: the settle beat is f0 (his idle), the footwork is left to the generic sets', p.settle === 0 && p.stalk === null, p.settle + ' ' + p.stalk);
  ok('3. HEAVY SWING: the haymaker keeps its body (f8), the settle yields to the swing\'s windup', P.heavy.jab === 8 && P.heavy.settle === null, J(P.heavy));
  ok('4a. DRAWN: the draw asks the picker in the jab and draws the full lunge', P.jab.asked > 0 && P.jab.last === 8, J(P.jab));
  ok('4b. DRAWN: the lunge is drawn at the idle\'s rect (same size, same plant, +-3 px)', P.idle.rect && P.jab.rect && P.idle.rect.every((v, i) => Math.abs(v - P.jab.rect[i]) <= 3), J(P.idle.rect) + ' vs ' + J(P.jab.rect));

  // 5. live
  const L = await page.evaluate(async () => {
    const K = 'young_confused_barnaby', m = window.__bm, FR = BOSS_ATTACK_FRAMES[K], oP = window._barnabyPunchFrame, rows = [];
    window._barnabyPunchFrame = function (mm) { const r = oP.apply(this, arguments); if (r) rows.push([mm._bxState, FR.indexOf(r)]); return r; };
    let throws = 0, prev = m._bxState; const t0 = performance.now();
    while (performance.now() - t0 < 22000 && throws < 4) { await new Promise((r) => setTimeout(r, 16)); if (m._bxState === 'jab' && prev !== 'jab') throws++; prev = m._bxState; player.x = m.x - 230; }
    await new Promise((r) => setTimeout(r, 900));
    window._barnabyPunchFrame = oP;
    const by = {}; for (const [s, i] of rows) (by[s] = by[s] || new Set()).add(i);
    let eps = 0, lunges = 0, cur = false, pv = null;   // one episode per throw: did its jab / slip reach the full lunge?
    for (const [s, i] of rows) { if (s === 'jab' && pv !== 'jab') { eps++; cur = true; } if (cur && i === 8 && (s === 'jab' || s === 'fade')) { lunges++; cur = false; } pv = s; }
    return { throws, eps, lunges, by: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, [...v].sort((a, b) => a - b)])) };
  });
  ok('5a. LIVE: he threw the haymaker, and every throw drew the full lunge', L.throws >= 2 && L.eps >= 2 && L.lunges === L.eps, J(L));
  ok('5b. LIVE: the tell only shows f0-5, the throw only f7-8', (L.by.wind || []).every((i) => i <= 5) && (L.by.jab || []).every((i) => i >= 7), J(L.by));
  ok('5c. no page errors', errs.length === 0, J(errs));
} finally { await browser.close(); server.kill(); }
const fail = res.filter((r) => !r.pass).length;
console.log(`\n${res.length - fail}/${res.length} passed`);
process.exit(fail ? 1 : 0);
