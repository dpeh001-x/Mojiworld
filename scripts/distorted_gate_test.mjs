// distorted-gate (per user: "add a nice object before the distorted portal entrance" / "A gate perhaps"): the Hidden Pagoda's
// Distorted Portal stands inside a rift-cracked torii.
//   1. the torii is placed at the portal (centred within 4 px), its art is registered, has a bounds row and decodes
//   2. the portal stands in the torii's open middle: the drawn art is clear (alpha 0) at the portal and solid on both posts
//   3. it draws through no platform (the low "pagoda base" ledge now starts clear of it) and the climb beside it still
//      reaches the pagoda's next tier; its cracks carry a violet glow row
//   4. the portal is where the user's stage bake put it (x 100), and there are no page errors
// The build before fails 1-3.   node scripts/distorted_gate_test.mjs      PORT / MOJI_GAME_FILE override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11887), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const env = { ...process.env }; if (FILE !== 'mojiworld_game.html') env.MOJI_GAME_FILE = FILE; else delete env.MOJI_GAME_FILE;   // served AT /mojiworld_game.html
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 300) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && document.getElementById('lo-menu'), null, { timeout: 180000 }); await page.waitForTimeout(2500);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player.level = 45; try { closeAllModals(); } catch (e) {}
    game.visitedMaps = game.visitedMaps || {}; game.visitedMaps.hiddenPagoda = true; loadMap('hiddenPagoda', 700); await sleep(2500);
    const md = game.mapData, po = (md.portals || []).find((p) => p.dest === 'distortedThreshold'), pr = (MAP_PROPS.hiddenPagoda || []).find((p) => p.key === 'pagoda_rift_torii');
    out.portal = po && po.x; out.prop = pr ? { x: pr.x, y: pr.y, glow: pr.glow || null } : null;
    out.reg = LX_OBJECTS_FILES.includes('pagoda_rift_torii'); out.bbox = !!(window.LX_SPRITE_BBOX && LX_SPRITE_BBOX['objects/pagoda_rift_torii.webp']);
    const img = LX_OBJECTS.pagoda_rift_torii; const t0 = performance.now(); while (img && !(img.complete && img.naturalWidth > 0) && performance.now() - t0 < 15000) await sleep(100);
    out.decoded = !!(img && img.naturalWidth > 0);
    if (pr && out.decoded) {
      const meta = LX_OBJECTS_META[pr.key] || { bboxTopY: 0, bboxBottomY: img.naturalHeight - 1 };
      const f = Math.max(0.7, Math.min(1.4, Math.max(img.naturalWidth, img.naturalHeight) / 512)), h = 80 * (pr.scale || 1) * f, w = h * img.naturalWidth / img.naturalHeight;
      const vis = h * ((meta.bboxBottomY - meta.bboxTopY + 1) / img.naturalHeight), left = pr.x - w / 2, right = pr.x + w / 2, top = pr.y - vis;
      out.hits = md.platforms.filter((q) => !(Math.abs(q.y - pr.y) <= 2 && pr.x >= q.x && pr.x <= q.x + q.w) && q.x < right && q.x + q.w > left && q.y < pr.y - 3 && q.y + (q.h || 12) > top + 3).map((q) => q.x + ',' + q.y);
      // sample the art where the portal stands (mid-height) and on both posts
      const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight; const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
      const sy = Math.round(img.naturalHeight * 0.72), col = (x) => Math.round(((x - left) / w) * img.naturalWidth);
      const a = (x) => g.getImageData(Math.max(0, Math.min(cv.width - 1, col(x))), sy, 1, 1).data[3];
      let postL = 0, postR = 0; for (let x = Math.round(left); x < pr.x - 20; x++) postL = Math.max(postL, a(x)); for (let x = Math.round(pr.x + 20); x < right; x++) postR = Math.max(postR, a(x));
      out.open = a(po ? po.x : pr.x); out.posts = [postL, postR]; out.rect = [Math.round(left), Math.round(right)];
    }
    const low = md.platforms.find((q) => q.y === 420 && q.x < 300), tier = md.platforms.find((q) => q.y === 370 && q.x === 340);
    out.low = low ? [low.x, low.w] : null; out.climb = !!(low && tier && (low.y - tier.y) <= 90 && tier.x - (low.x + low.w) <= 120);
    return out;
  });
  ok('1. the torii stands at the Distorted Portal, its art registered, bounded and decoded', !!R.prop && R.portal != null && Math.abs(R.prop.x - R.portal) <= 4 && R.prop.y === 480 && R.reg && R.bbox && R.decoded, R);
  ok('2. the portal stands in its open middle (clear art there, solid posts either side)', R.open === 0 && R.posts.every((v) => v > 200), { open: R.open, posts: R.posts, rect: R.rect });
  ok('3. it draws through no platform, the low ledge starts clear of it and still leads up to the next tier', Array.isArray(R.hits) && R.hits.length === 0 && R.low && R.rect && R.low[0] >= R.rect[1] && R.climb, { hits: R.hits, low: R.low, rect: R.rect, climb: R.climb });
  ok('3. its cracks carry a violet glow row', !!(R.prop && R.prop.glow && typeof R.prop.glow.c === 'string' && R.prop.glow.r > 0 && R.prop.glow.a > 0 && R.prop.glow.a <= 1), R.prop && R.prop.glow);
  ok('4. the portal is where the stage bake put it (x 100)', R.portal === 100, R.portal);
  ok('4. no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 200), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
