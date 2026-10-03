// BACKSTAB SNAPS IN (per user: "For backstab skill sprite the animation needs to be much faster such that the slash comes in
// ultra fast"). The effect's build-up (the dark orb streaking in, frames 3-5) plays in 3 ticks of the burst's life, so the full
// triple slash (frame 6) lands on tick 3, ~50 ms (it was tick 10, ~165 ms). The slash, its sparkles and its seal keep their old
// pace and each frame keeps the size it always had, so the bursts are shorter (26 -> 19 ticks, the Lv-10 bonus 28 -> 21).
//   draw: a 19-tick burst drawn tick by tick never shows the slow orb swell (frames 0-2), streaks in on 3-5, shows the full
//         slash by tick 3, plays every later frame in order to the last, gives the slash and its seal 16 ticks, and draws each
//         frame at its old size (grow 0.5 + 0.6 x that frame's share of the set)
//   cast: Backstab cast for real at a dummy spawns its three finisher bursts at 19 ticks and the Lv-10 bonus stab's at 21,
//         and draws the slash frames on screen
//   node scripts/backstab_snap_test.mjs [port]      (MOJI_SERVE_ROOT overrides the served tree)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.argv[2] || process.env.PORT || 10297);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  ' + JSON.stringify(x).slice(0, 400) : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT }); await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] }); const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
try {
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof castSkill === 'function' && typeof _fxAnimFrames === 'function', null, { timeout: 180000 }); await page.waitForTimeout(5000);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    loadMap('forest', 300); await sleep(2500); game.paused = false; for (let i = 0; i < 30 && !player.onGround; i++) await sleep(100);
    try { window._perfTick = () => {}; } catch (e) {}   // the headless frame watchdog flips FX tiers on its own
    Object.assign(LX_PERF, { lowFx: false, lowFxUntil: 0, slowFrames: 0, veryLowFx: false, veryLowFxUntil: 0 });
    _fxAnimFrames('backstab'); try { _lxFxReady(LX_FX.backstab); } catch (e) {}
    const ready = () => { const a = FX_ANIM_FRAMES.backstab; return a && a.length === 16 && a.every((f) => f && (f.tagName === 'CANVAS' || (f.complete && f.naturalWidth > 0))); };
    const t0 = performance.now(); while (!ready() && performance.now() - t0 < 60000) await sleep(200);
    const keyOf = (img) => { const s = String((img && (img.src || (img._lxSrc && img._lxSrc.src))) || ''); const mm = s.match(/fx\/anim\/([a-z0-9_]+)_(\d+)\.webp/); return mm ? [mm[1], +mm[2]] : null; };
    let rec = null; const P = CanvasRenderingContext2D.prototype, oDI = P.drawImage;
    P.drawImage = function (img) { if (rec && this.canvas && this.canvas.isConnected) { const k = keyOf(img); if (k && k[0] === 'backstab') rec.push({ f: k[1], w: arguments.length === 5 ? arguments[3] : arguments.length === 9 ? arguments[7] : null }); } return oDI.apply(this, arguments); };
    const out = { ready: ready(), mul: _LX_FX_SIZE_MUL.backstab, draw: [], cast: null };
    try {
      // 1. one finisher burst, drawn tick by tick (life 19 .. 1) - what the screen shows on each tick of its life
      game.monsters.length = 0; game.smoothFx = [];
      spawnSpriteBurst(player.x + 200, player.y, 'backstab', { size: 320, life: 19, angle: 0 });
      const fx = game.smoothFx[game.smoothFx.length - 1];
      for (let life = fx.maxLife; life >= 1; life--) { fx.life = life; game._lowFxCache = null; rec = []; ctx.save(); try { drawSmoothFx(false); } finally { ctx.restore(); } out.draw.push(rec.length ? rec[rec.length - 1] : null); rec = null; }
      game.smoothFx = [];
      // 2. a real cast at a dummy, with the Lv-10 bonus stab forced
      const sk = SKILLS.backstab; player.cls = sk.cls; player.job = null; player.master = null; player.masteries = {};
      player._god = true; player.level = 90; player.maxMp = player.mp = 99999; player.maxHp = player.hp = 999999; player.facing = 1; player.attackTimer = 0; player.state = 'idle';
      for (const k of Object.keys(player.skillCooldowns || {})) player.skillCooldowns[k] = 0;
      const mm = spawnMonster(player.x + 160, player.y - 10, 'slime', false); if (mm) { mm.maxHp = mm.currentHp = 9e12; mm.speed = 0; mm.atk = 0; mm.frozen = 99999; }
      const oL10 = window.getSkillLv10, seen = new Set(), lives = [];
      window.getSkillLv10 = (id) => (id === 'backstab' ? { chainHits: 1, chainChance: 1 } : (oL10 ? oL10(id) : null));
      rec = [];
      try { castSkill('backstab'); const e = performance.now() + 1200; while (performance.now() < e) { for (const f of (game.smoothFx || [])) if (f.spriteKey === 'backstab' && !seen.has(f)) { seen.add(f); lives.push(f.maxLife); } await sleep(10); } }
      finally { window.getSkillLv10 = oL10; }
      out.cast = { lives, frames: [...new Set(rec.map((r) => r.f))].sort((a, b) => a - b) }; rec = null;
    } finally { P.drawImage = oDI; }
    return out;
  });
  const d = R.draw, fs = d.map((r) => (r ? r.f : -1));
  console.log('frame by tick:', fs.join(' '));
  ok('the 16 Backstab frames decode', R.ready);
  ok('a 19-tick burst draws a frame on every tick of its life', d.length === 19 && d.every(Boolean), fs);
  ok('it never shows the slow orb swell (frames 0-2): the build-up starts on frame 3', fs.every((f) => f >= 3) && fs[0] === 3, fs.slice(0, 4));
  ok('the dagger streaks in on frames 4-5 and the full slash (frame 6) lands by tick 3 (~50 ms; was tick 10)', fs.indexOf(6) >= 0 && fs.indexOf(6) <= 3 && fs.slice(0, 3).includes(4) && fs.slice(0, 3).includes(5), fs.slice(0, 5));
  ok('every later frame plays in order to the last (6 .. 15, none skipped, never back)', fs.every((f, i) => !i || f >= fs[i - 1]) && [6, 7, 8, 9, 10, 11, 12, 13, 14, 15].every((f) => fs.includes(f)) && fs[fs.length - 1] === 15, fs);
  ok('the slash and its seal keep their old pace: frames 6-15 hold 16 ticks (26 x 10/16 = 16.25 before)', fs.filter((f) => f >= 6).length === 16, fs.filter((f) => f >= 6).length);
  const base = 320 * R.mul, sz = d.filter(Boolean).map((r) => ({ f: r.f, g: (r.w / base - 0.5) / 0.6 }));
  ok('each frame is drawn at the size it always had (its grow sits inside that frame\'s share of the set)', sz.every((q) => q.g >= q.f / 16 - 1e-6 && q.g < (q.f + 1) / 16 + 1e-6), sz.map((q) => q.f + ':' + q.g.toFixed(3)).join(' '));
  const c = R.cast || { lives: [], frames: [] };
  ok('a real cast spawns the three finisher bursts at 19 ticks and the Lv-10 bonus stab\'s at 21', c.lives.filter((l) => l === 19).length === 3 && c.lives.filter((l) => l === 21).length === 1 && c.lives.length === 4, c.lives);
  ok('the cast draws the full slash frames on screen', c.frames.includes(6) && c.frames.some((f) => f > 6), c.frames);
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('HARNESS ERROR', false, String(e && e.stack || e).slice(0, 300)); }
finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
