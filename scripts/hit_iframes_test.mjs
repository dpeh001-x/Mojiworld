// About 100 ms more immunity after a hit (v0.30.x hit-iframes), and no "+N" coin text on the character (no-coin-pop).
//   node scripts/hit_iframes_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// Per user: "when being hit, add about 100ms more immunity time"; "To reduce lag can also omit and not show the gain in
// mojicoin on the character".
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '10630';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' }); const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof updatePlayer === 'function', null, { timeout: 120000 });
  const R = await page.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'warrior'; player.level = 60;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true });
    loadMap('town'); await new Promise((s) => setTimeout(s, 3000));
    for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
    const ew = document.getElementById('everdawn-welcome-overlay'); if (ew) ew.remove();
    const frames = (n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
    // the headless page runs ~17 game ticks a second: wait on game.time, not on frames or the clock
    const ticks = async (n) => { const t = game.time; const s0 = performance.now(); while (game.time - t < n && performance.now() - s0 < 20000) await frames(1); };
    const settle = async () => { player.invulnerable = 0; player.maxHp = 1e9; player.hp = 1e9; await ticks(3); };
    const out = {};
    // 1. a real hit: the co-op boss hit grants a 600 ms window
    await settle();
    const t0 = performance.now();
    _coopSelfBossHit(player.x + player.w / 2, player.y + player.h / 2, 400, 5, 0, 'test hit', '#fff');
    out.granted = player.invulnerable;
    const g0 = game.time;
    await ticks(1);
    out.after1 = player.invulnerable;
    // how long the window really lasts, in game ticks and in game ms (the per-tick dt the player update subtracts)
    const s1 = performance.now(); while (player.invulnerable > 0 && performance.now() - s1 < 30000) await frames(1);
    out.ticks = game.time - g0; out.dtMs = 1000 / 60;
    // 2. a tick that grants no i-frames (a burn / poison) must not open one
    await settle();
    player.lastHitTime = game.time; await ticks(3); out.tick = player.invulnerable;
    // 3. a hit that only tops up a running window adds nothing
    await settle();
    player.invulnerable = 500; await ticks(1);
    const before = player.invulnerable; player.lastHitTime = game.time; player.invulnerable = Math.max(player.invulnerable, 360);
    await ticks(2); out.topUp = { before, after: player.invulnerable };
    // 4. a coin pickup: coins granted, sound path intact, no "+N" text particle
    await settle();
    const c0 = player.mojicoins | 0, p0 = (game.particles || []).filter((p) => p && typeof p.text === 'string' && /^\+\d/.test(p.text)).length;
    game.drops = game.drops || [];
    game.drops.push({ type: 'mojicoin', x: player.x + player.w / 2, y: player.y + player.h / 2, value: 30, vx: 0, vy: 0, life: 9999, noMagnet: true, onGround: true });
    await ticks(4);
    out.coins = (player.mojicoins | 0) - c0;
    out.coinText = (game.particles || []).filter((p) => p && typeof p.text === 'string' && /^\+\d/.test(p.text)).length - p0;
    return out;
  });
  console.log(JSON.stringify(R));
  check(R.granted === 600, 'the test hit is a real hit with a 600 ms window', R.granted);
  check(R.after1 > 650, 'a fresh hit window gets its extra ~100 ms (above 650 one update in, where 600 would be ~583)', R.after1);
  check(R.ticks >= 40 && R.ticks <= 45, 'it lasts about 700 ms of game time - ~42 updates at 60 a second, where 600 ms is ~36', R.ticks);
  check(R.tick === 0, 'a damage tick that grants no immunity does not open a window', R.tick);
  check(R.topUp.after < R.topUp.before, 'a hit that only tops up a running window adds nothing', R.topUp);
  check(R.coins > 0 && R.coinText === 0, 'a coin pickup grants the coins but shows no "+N" text on the character', { coins: R.coins, text: R.coinText });
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await ctx.close();
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
process.exit(bad ? 1 : 0);
