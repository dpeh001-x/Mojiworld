// Projectile animation loops are shrunk BEFORE their first draw, and a loop never hands the drawer a raw frame while a
// baked sibling is ready (v0.30.1271 proj-warm). Fails on the build before it: the lazy-fx 'pa:' ask only created the
// Image objects, so the Bloodlust wave's nine 768 px frames were still raw webps at the first swing, and _lxProjScaled
// baked each from the raw file on the main thread (51-57 ms a frame at CPU x4).
//   [SERVE_ROOT=<tree>] node scripts/proj_loop_prewarm_test.mjs [build.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import net from 'node:net';
import { spawn } from 'node:child_process';
const S = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const ROOT = process.env.SERVE_ROOT || path.resolve(S, '..'); const require = createRequire(path.join(ROOT, 'x.js'));
const { chromium } = require('playwright-core');
const free = (p) => new Promise((r) => { const s = net.createServer(); s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = 0; for (let p = 11520; p < 11600 && !PORT; p++) if (await free(p)) PORT = p;
const env = { ...process.env }; if (process.argv[2]) env.MOJI_GAME_FILE = process.argv[2]; else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
let fails = 0; const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails++; };
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _projAnimFrame === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(4000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu', 'void-intro-overlay']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { tutorial_intro: true, everdawn_welcome: true }); player._tutorialSeen = true;
    player.cls = 'warrior'; player.job = 'berserker'; player.master = 'warlord'; player.masteries = { warlord: true }; player.level = 60; player._god = true;
    loadMap('mushroom'); game.paused = false;
    // 1) the class ask alone - no swing, no draw of the wave - must leave all nine frames baked (canvases)
    const t0 = performance.now(); let arr = null, baked = 0;
    while (performance.now() - t0 < 60000) {
      await sleep(250); if (game.paused) game.paused = false;
      arr = PROJ_ANIM_FRAMES.bloodlust_wave;
      baked = arr ? arr.filter((f) => f && f.tagName === 'CANVAS').length : 0;
      if (arr && arr.length && baked === arr.length) break;
    }
    const out = { n: arr ? arr.length : 0, baked, waitMs: Math.round(performance.now() - t0) };
    if (!arr || baked !== arr.length) return out;
    // 2) the loop still animates: distinct frames over one cycle
    const seen = new Set(); for (let i = 0; i < 24; i++) { seen.add(_projAnimFrame('bloodlust_wave', i * 48)); }
    out.distinct = seen.size; out.allCanvas = [...seen].every((f) => f && f.tagName === 'CANVAS');
    // 3) a frame put back to its raw source (a bake not landed yet) is never handed out while a sibling is baked
    const k = 3, cv = arr[k], raw = cv && cv._lxSrc;
    out.hasRaw = !!(raw && raw.tagName === 'IMG');
    if (out.hasRaw) {
      arr[k] = raw; raw._lxHoldT = 0; arr._readyN = 0; const was = arr._lxShrunk; arr._lxShrunk = true; arr._lxShrunkCap = arr._lxShrunkCap || 0;
      let rawOut = 0; for (let i = 0; i < 48; i++) { const f = _projAnimFrame('bloodlust_wave', i * 12); if (f === raw) rawOut++; }
      out.rawHandedOut = rawOut; arr[k] = cv; arr._readyN = 0; arr._lxShrunk = was;
    }
    return out;
  });
  console.log(JSON.stringify(r));
  check(r.n === 9 && r.baked === r.n, `the Bloodlust wave's frames are baked before any swing (${r.baked}/${r.n} after ${r.waitMs} ms)`);
  if (r.baked === r.n && r.n) {
    check(r.distinct >= 6 && r.allCanvas, `the loop still animates on baked frames (${r.distinct} distinct over a cycle)`);
    check(r.hasRaw && r.rawHandedOut === 0, `a raw frame is not drawn while a baked sibling is ready (handed out ${r.rawHandedOut} of 48)`);
  }
} catch (e) { console.log('FAIL harness: ' + String(e.message).slice(0, 200)); fails++; }
await browser.close(); server.kill();
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
