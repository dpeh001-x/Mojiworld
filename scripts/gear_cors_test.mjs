// GEAR CORS (found while building the armour garments, 2026-10-01). The web build streams Sprites/ from jsDelivr (deploy-pages.yml
// rewrites every Sprites/ path), so equipment art there is cross-origin; loaded without CORS it tainted every canvas it touched and
// the gear light (which reads each piece's pixels) silently skipped every animated piece with no Gear Align erase. This test
// rebuilds that setup locally: the page on one origin, Sprites/ rewritten exactly like the deploy to a second origin that answers
// CORS (like jsDelivr).
//   [1] a cross-origin equipment image asks for CORS (crossOrigin = anonymous) and loads from the second origin
//   [2] the gear light bakes for animated pieces with no erase (eclipse_daggers, oblivion_whisper, nebula_staff): ready, not failed
//   [3] a canvas the art is drawn to stays readable (getImageData does not throw)
//   [4] on the page's own origin (local server, Steam, zip) nothing changes: no crossOrigin attribute
//   [5] no page errors
// The build before fails [1]-[3].   node scripts/gear_cors_test.mjs [page.html] [port]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import http from 'node:http';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const fs = require('node:fs');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html', PORT = +(process.argv[3] || process.env.PORT || 11892), CDN = PORT + 1;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 600) + ']' : '')); };
// the deploy's rewrite, applied to a copy served beside the page
const src = fs.readFileSync(path.isAbsolute(PAGE) ? PAGE : path.join(ROOT, PAGE), 'utf8');
const WEB = '_gear_cors_web.html', webFile = path.join(ROOT, WEB);
fs.writeFileSync(webFile, src.replace(/(["'(])Sprites\//g, '$1http://127.0.0.1:' + CDN + '/Sprites/'));
// the "CDN": a static server for Sprites/ that answers CORS
const TYPES = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml' };
const cdn = http.createServer((req, res) => { const p = decodeURIComponent((req.url || '/').split('?')[0]); const fp = path.join(ROOT, p);
  if (!fp.startsWith(ROOT) || !p.startsWith('/Sprites/')) { res.writeHead(404); return res.end(); }
  fs.readFile(fp, (err, buf) => { if (err) { res.writeHead(404, { 'Access-Control-Allow-Origin': '*' }); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(fp)] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }); res.end(buf); }); });
await new Promise((r) => cdn.listen(CDN, '127.0.0.1', r));
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const PIECES = ['wpn:eclipse_daggers', 'wpn:oblivion_whisper', 'wpn:nebula_staff'];
const run = async (file) => { const errs = [];
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://127.0.0.1:${PORT}/${file}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof _lxEquipSprite === 'function' && typeof _lxBakedDownscale === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(async (PIECES) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    for (const sid of PIECES) { const img = _lxEquipSprite('weapons', sid.slice(4)); if (img && typeof _lxWantImg === 'function') _lxWantImg(img, true);
      for (let i = 0; i < 150 && !(img.complete && img.naturalWidth && _lxBakedDownscale(img, 256)); i++) await sleep(100);
      let readable = null; try { const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d'); g.drawImage(img, 0, 0, 16, 16); g.getImageData(0, 0, 1, 1); readable = true; } catch (e) { readable = false; }
      let A = null; if (typeof _lxEqAnimGet === 'function') { _lxEqAnimGet(sid, img); for (let i = 0; i < 200; i++) { A = _LX_EQ_ANIM_CACHE.get(sid); if (A && (A.ready || A.failed)) break; await sleep(50); } }
      out[sid] = { src: img.src.slice(0, 40), crossOrigin: img.crossOrigin, loaded: !!(img.complete && img.naturalWidth), readable, light: A ? (A.ready ? 'ready' : A.failed ? 'failed' : 'pending') : 'none' }; }
    return out; }, PIECES);
  await page.close(); return { r, errs }; };
try {
  const web = await run(WEB), local = await run(path.relative(ROOT, path.isAbsolute(PAGE) ? PAGE : path.join(ROOT, PAGE)).split(path.sep).join('/'));
  const W = web.r, L = local.r;
  ok('[1] on the web setup a cross-origin equipment image asks for CORS and loads from the second origin',
    PIECES.every((s) => W[s].crossOrigin === 'anonymous' && W[s].loaded && W[s].src.indexOf(':' + CDN + '/') > 0), W);
  ok('[2] the gear light bakes there for animated pieces with no erase', PIECES.every((s) => W[s].light === 'ready'), Object.fromEntries(PIECES.map((s) => [s, W[s].light])));
  ok('[3] a canvas the art is drawn to stays readable', PIECES.every((s) => W[s].readable === true), Object.fromEntries(PIECES.map((s) => [s, W[s].readable])));
  ok('[4] on the page\'s own origin nothing changes: no crossOrigin attribute, the light bakes', PIECES.every((s) => L[s].crossOrigin == null && L[s].loaded && L[s].light === 'ready'), L);
  ok('[5] no page errors', !web.errs.length && !local.errs.length, web.errs.concat(local.errs).slice(0, 3).join(' | '));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 300), false); }
await browser.close(); server.kill(); cdn.close(); try { fs.unlinkSync(webFile); } catch (e) {}
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
