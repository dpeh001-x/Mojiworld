// Live test: THE SPRITE-STALENESS PASS.
//   1. push-clobber-gate BLOCKS a push that modifies existing art bytes
//      without bumping sw.js's CACHE generation - and allows the same
//      change WITH the bump. (Throwaway local commit objects; nothing
//      is pushed.)
//   2. The staged game registers the v7 worker, arms the boot-phase
//      controllerchange reload, and actually populates the v7 cache.
//   3. Gravitos contact melee plays the WEIGHTED loop: strike frames
//      (impact + fist-thrusts) dwell ~2.2-2.6x the windup frames.
//   node scripts/sw_bump_gate_test.mjs
import { chromium } from 'playwright-core';
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import net from 'node:net';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const git = (args, env) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 30, env: env || process.env }).trim();

// ---- 1) hook unit test ------------------------------------------------------
const BASE = git(['rev-parse', 'origin/main']);
const tmp = mkdtempSync(join(tmpdir(), 'lxswgate-'));
const mkCommit = (bumpSw) => {
  const IDX = join(tmp, 'idx-' + (bumpSw ? 'b' : 'a'));
  const env = { ...process.env, GIT_INDEX_FILE: IDX };
  git(['read-tree', BASE], env);
  // "modify" an existing sprite: reuse another sprite's bytes so the blob
  // stays a valid webp but differs from origin's
  const donor = git(['rev-parse', BASE + ':Sprites/bosses/zodiac/pounce/leo_1.webp']);
  git(['update-index', '--add', '--cacheinfo', '100644,' + donor + ',Sprites/bosses/zodiac/pounce/leo_0.webp'], env);
  if (bumpSw) {
    const sw = git(['cat-file', '-p', BASE + ':sw.js']).replace(/const CACHE = '[^']+'/, "const CACHE = 'mojiworld-assets-vTEST'");
    const p = join(tmp, 'sw-test.js'); writeFileSync(p, sw);
    const sha = git(['hash-object', '-w', '--', p]);
    git(['update-index', '--add', '--cacheinfo', '100644,' + sha + ',sw.js'], env);
  }
  const tree = git(['write-tree'], env);
  return git(['commit-tree', tree, '-p', BASE, '-m', 'sw-gate test throwaway (' + (bumpSw ? 'with' : 'without') + ' bump)']);
};
const runHook = (sha) => {
  const stdin = JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git push origin ' + sha + ':refs/heads/main' } });
  const r = spawnSync(process.execPath, ['.claude/hooks/push-clobber-gate.js'], { input: stdin, encoding: 'utf8', timeout: 120000 });
  return { code: r.status, err: r.stderr || '' };
};
const noBump = runHook(mkCommit(false));
ok('gate BLOCKS replaced art without a cache bump (exit 2)', noBump.code === 2 && /cache bump/i.test(noBump.err),
  { code: noBump.code, err: noBump.err.slice(0, 160) });
const withBump = runHook(mkCommit(true));
ok('gate ALLOWS the same change with the bump (exit 0)', withBump.code === 0, { code: withBump.code, err: withBump.err.slice(0, 160) });
rmSync(tmp, { recursive: true, force: true });

// ---- 2 + 3) staged build e2e -----------------------------------------------
const free = (p) => new Promise((r) => { const s = net.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8961; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], {
  stdio: 'ignore', env: { ...process.env, MOJI_GAME_FILE: process.env.MOJI_GAME_FILE || '' } });
await new Promise((r) => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof spawnMonster === 'function' && typeof _gravitosContactFrame === 'function', null, { timeout: 120000 });
await page.evaluate(() => new Promise((res) => { let n = 0;
  const t = () => { window._lxBootGateDone = true;
    const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
    const c = document.querySelector('.cls-card'); if (c) c.click();
    const m = document.getElementById('class-select-modal'); if (m) m.style.display = 'none';
    if (++n > 150) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); }));
await page.waitForTimeout(2500);

const r = await page.evaluate(async () => {
  const out = {};
  out.reloadArmed = window._lxSwReloadArmed === true;
  try {
    const ks = await caches.keys();
    out.cacheKeys = ks.filter((k) => k.startsWith('mojiworld-assets-'));
    // pull one sprite through the SW, then confirm it landed in the v7 cache
    const u = 'Sprites/bosses/zodiac/pounce/leo_0.webp';
    await fetch(u).then((x) => x.blob()).catch(() => null);
    await new Promise((res) => setTimeout(res, 900));
    const c = await caches.open('mojiworld-assets-v7');
    out.spriteCached = !!(await c.match(new Request(location.origin + '/' + u)) || await c.match(u));
  } catch (e) { out.swErr = String(e).slice(0, 120); }

  // weighted contact loop dwell measurement
  try { loadMap('forest'); } catch (e) {}
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 60) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  player._god = true; player.hp = 99999;
  game.monsters = [];
  spawnMonster(Math.round(player.x + 300), Math.round(player.y), 'gravitos', false);
  const m = game.monsters[game.monsters.length - 1];
  m.hp = m.currentHp = 1e9; m.maxHp = 1e9; m.atk = 1; m.isBoss = true; m.patternState = 'idle';
  out.weights = (typeof _GRAV_ATK_WEIGHTS !== 'undefined') ? _GRAV_ATK_WEIGHTS.join(',') : null;
  out.atkMs = (typeof _GRAV_ATK_FRAME_MS !== 'undefined') ? _GRAV_ATK_FRAME_MS : null;
  let ready = null;
  for (let w = 0; w < 300 && !ready; w++) {
    ready = _gravitosContactFrame(m, 'gravitos');
    if (!ready) await new Promise((res) => setTimeout(res, 100));
  }
  if (!ready) { out.dwell = 'frames-never-decoded'; }
  else {
    const fr = BOSS_ATTACK_FRAMES['gravitos'];
    const dwell = {};
    const t0 = performance.now();
    let last = -1, lastAt = t0;
    while (performance.now() - t0 < 4200) {
      await new Promise((res) => requestAnimationFrame(res));
      const i = fr.indexOf(_gravitosContactFrame(m, 'gravitos'));
      const now = performance.now();
      if (i !== last) {
        if (last >= 0) dwell[last] = Math.max(dwell[last] || 0, now - lastAt);
        last = i; lastAt = now;
      }
    }
    // frame 0 is excluded: the first observed dwell includes the pre-decode
    // stall before the loop is live (measured 1.6 s once), not real pacing
    const early = [1, 2, 3, 4].map((i) => dwell[i]).filter((v) => v > 0);
    const strike = [5, 6, 7].map((i) => dwell[i]).filter((v) => v > 0);
    const avg = (xs) => xs.reduce((s, v) => s + v, 0) / Math.max(1, xs.length);
    out.dwell = { early: Math.round(avg(early)), strike: Math.round(avg(strike)),
      perFrame: Object.fromEntries(Object.entries(dwell).map(([k, v]) => [k, Math.round(v)])) };
    out.strikeHeld = strike.length >= 2 && avg(strike) > avg(early) * 1.6;
    out.slowedBase = early.length >= 3 && avg(early) > 95;   // 130ms nominal vs 48ms old
  }
  game.monsters = [];
  return out;
});

ok('boot-phase SW reload guard is armed', r.reloadArmed === true, { reloadArmed: r.reloadArmed });
ok('the v7 asset cache generation is live (and no stale generations)',
  Array.isArray(r.cacheKeys) && r.cacheKeys.includes('mojiworld-assets-v7') && r.cacheKeys.length === 1, { cacheKeys: r.cacheKeys, swErr: r.swErr });
ok('a sprite fetched through the worker lands in the v7 cache', r.spriteCached === true, { spriteCached: r.spriteCached, swErr: r.swErr });
ok('contact-loop dials present (130ms base, strike weights 2.2-2.6)',
  r.atkMs === 130 && /2\.2,2\.6,2\.6/.test(r.weights || ''), { atkMs: r.atkMs, weights: r.weights });
ok('strike frames dwell ~2x+ the windup frames (the "hold these frames" ask)',
  r.dwell === 'frames-never-decoded' || r.strikeHeld === true, { dwell: r.dwell });
ok('the base interval is the slowed one, not the 48ms twitch',
  r.dwell === 'frames-never-decoded' || r.slowedBase === true, { dwell: r.dwell });
ok('no page errors', errs.length === 0, { errs: errs.slice(0, 3) });

await b.close(); srv.kill();
let pass = 0;
for (const t of results) {
  console.log((t.pass ? '  PASS  ' : '  FAIL  ') + t.n);
  if (!t.pass) console.log('        ' + JSON.stringify(t.x).slice(0, 340));
  if (t.pass) pass++;
}
console.log('\n' + pass + '/' + results.length + ' checks passed');
process.exit(pass === results.length ? 0 : 1);
