// WEB DEPLOY PATHS (v0.30.888 launch audit). The Pages deploy rewrites quote/paren-prefixed "Sprites/" (and audio/,
// backgrounds/) in the two HTML files to a jsDelivr pin, and nothing else. This test applies the workflow's own rule
// (read from .github/workflows/deploy-pages.yml) to the page, serves the "CDN" from a second origin with jsDelivr's
// CORS header, and checks what broke on play.moji-studios.com: the emoji atlas (data/emoji_atlas.js is not rewritten),
// the sprite-edge and tile-crop tables (keyed on paths the rewrite changes), the mobile skill-button art, and that the
// site no longer publishes docs/, mp-cf/ or the Steam shell's scripts. The same checks run on a plain local page.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/web_deploy_paths_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync, readFileSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11195';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const GAME = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
const env = { ...process.env, MOJI_GAME_FILE: GAME };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const yml = readFileSync(path.join(ROOT, '.github', 'workflows', 'deploy-pages.yml'), 'utf8');
const CDN = `http://127.0.0.1:${PORT}/gh/test/Mojiworld@pin`;   // another origin, like jsDelivr
const dirs = ((/for d in ([^;\n]+); do/.exec(yml) || [])[1] || '').trim().split(/\s+/);
const MIME = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.js': 'text/javascript', '.json': 'application/json' };
const probe = async (page, cdn) => page.evaluate(async (cdn) => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const load = (src, cors) => new Promise((res) => { const im = new Image(); if (cors) im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  const base = cdn ? cdn + '/' : new URL('.', location.href).href;
  const A = window._lxEmojiAtlasImg; for (let i = 0; i < 40 && !(A && A.complete && A.naturalWidth); i++) await sleep(250);
  const ek = Object.keys(window.LX_SPRITE_EDGES || {})[0];
  const ei = ek ? await load(base + 'Sprites/' + ek, !!cdn) : null;
  const ck = Object.keys(window.LX_TILE_CROPS || {}).find((k) => /^Sprites\/floors\//.test(k));
  const ci = ck ? await load(base + ck, false) : null;
  const mob = document.querySelector('.mc-basic .mc-icon');
  return {
    atlas: { src: A && A.src, ok: !!(A && A.complete && A.naturalWidth > 0) },
    edges: { key: ek, loaded: !!ei, hit: ei ? _lxEdgesFromTable(ei) !== undefined : null },
    crop: { key: ck, loaded: !!ci, hit: ci ? _lxTileCropFromTable(ci, 'auto') !== undefined : null },
    mobile: mob ? (mob.getAttribute('style') || '').slice(0, 160) : null,
  };
}, cdn);
try {
  const ex = ['docs', 'mp-cf', 'steam/*.js', 'steam/*.json'].filter((p) => !yml.includes("--exclude '" + p + "'"));
  check(ex.length === 0, 'the Pages site no longer publishes docs/, mp-cf/ or the Steam shell scripts', J(ex));
  check(dirs.includes('Sprites'), 'the workflow rewrite rule was read', J(dirs));
  // the web build, as the workflow makes it
  let html = readFileSync(GAME, 'utf8');
  for (const d of dirs) html = html.replace(new RegExp('(["\'(])' + d + '/', 'g'), '$1' + CDN + '/' + d + '/');
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.route(/\/mojiworld_game\.html(\?.*)?$/, (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }));
  await ctx.route(CDN.replace('@pin', '@pin') + '/**', (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname.split('@pin/')[1] || '');
    const f = path.join(SERVE_ROOT, rel);
    if (!rel || !existsSync(f)) return r.fulfill({ status: 404, headers: { 'access-control-allow-origin': '*' }, body: '' });
    r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' }, body: readFileSync(f) });
  });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof _lxEdgesFromTable === 'function' && typeof _lxTileCropFromTable === 'function', null, { timeout: 180000 }); await page.waitForTimeout(2500);
  const w = await probe(page, CDN);
  check(w.atlas.ok && String(w.atlas.src).startsWith(CDN), 'web: the emoji atlas loads from the art CDN (it 404ed on the game\u2019s own site)', J(w.atlas));
  check(w.edges.loaded && w.edges.hit === true, 'web: the sprite-edge table answers for a CDN sprite', J(w.edges));
  check(w.crop.loaded && w.crop.hit === true, 'web: the tile-crop table answers for a CDN floor', J(w.crop));
  check(String(w.mobile).includes(CDN), 'web: the mobile skill buttons point at the CDN', J(w.mobile));
  check(errs.length === 0, 'web: no page errors', J(errs.slice(0, 3)));
  await ctx.close();
  // the same page served plainly (localhost, file-relative art) still works
  const ctx2 = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  const p2 = await ctx2.newPage();
  await p2.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p2.waitForFunction(() => typeof _lxEdgesFromTable === 'function', null, { timeout: 180000 }); await p2.waitForTimeout(2500);
  const l = await probe(p2, null);
  check(l.atlas.ok && l.edges.hit === true && l.crop.hit === true, 'local: the atlas, edge and crop tables still work unrewritten', J({ atlas: l.atlas.ok, edges: l.edges.hit, crop: l.crop.hit }));
  await ctx2.close();
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
