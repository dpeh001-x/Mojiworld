// Emoji icons + art CDN on the WEB build (v0.30.x emoji-atlas-cdn).
//   node scripts/emoji_atlas_cdn_test.mjs      (MOJI_GAME_FILE=<build.html> to test a private build; uses PORT and PORT+1)
// Emulates the GitHub Pages deploy instead of the plain local server, because every bug here only exists there:
//   - the art-folder rewrite is READ from .github/workflows/deploy-pages.yml (its `for d in ...` list and its sed rule) and
//     applied to the build in memory, with the jsDelivr root swapped for a second local origin (PORT+1, ACAO *);
//   - the site origin (PORT) serves only what the workflow's rsync publishes: Sprites/, audio/, backgrounds/ ... are 404.
// Files missing from the (stale, OneDrive) working copy are served from `git show origin/main:<path>`, like the font route.
import { chromium } from 'playwright-core';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFile, execFileSync } from 'node:child_process';
import { readFileSync, statSync, createReadStream } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || '11300'), CDN_PORT = PORT + 1;
const GAME = process.env.MOJI_GAME_FILE ? path.resolve(ROOT, process.env.MOJI_GAME_FILE) : path.join(ROOT, 'mojiworld_game.html');
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const gitShow = (rel) => new Promise((res) => execFile('git', ['show', 'origin/main:' + rel], { cwd: ROOT, encoding: 'buffer', maxBuffer: 1 << 27 }, (e, out) => res(e ? null : out)));

// ---- 1. the deploy's rewrite, read from the workflow ----
let WF; try { WF = execFileSync('git', ['show', 'origin/main:.github/workflows/deploy-pages.yml'], { cwd: ROOT, encoding: 'utf8' }); }
catch (e) { WF = readFileSync(path.join(ROOT, '.github/workflows/deploy-pages.yml'), 'utf8'); }
const dirsM = /for d in ([A-Za-z_ ]+); do/.exec(WF), sedM = /sed -i -E "s#(.+?)#(.+?)#g" "\$f"/.exec(WF);
const rootM = /CDN_ROOT="https:\/\/cdn\.jsdelivr\.net\/gh\/\$\{GITHUB_REPOSITORY\}"/.exec(WF);
const EXCL = new Set([...WF.matchAll(/--exclude '([A-Za-z_][\w.-]*)'/g)].map((m) => m[1]));
const CDN_ROOT = `http://127.0.0.1:${CDN_PORT}/gh/dpeh001-x/Mojiworld`;
const DIRS = dirsM ? dirsM[1].trim().split(/\s+/) : [];
const PIN = Object.fromEntries(DIRS.map((d) => [d, crypto.createHash('sha1').update('pin:' + d).digest('hex')]));
const unq = (t) => t.replace(/\\(["\\$`])/g, '$1');   // the sed rule sits in a double-quoted shell string
let SITE = readFileSync(GAME, 'utf8'), rewrites = 0;
if (sedM) for (const d of DIRS) {
  const pat = unq(sedM[1]).split('${d}').join(d);
  const rep = unq(sedM[2]).split('${d}').join(d).split('${CDN_ROOT}').join(CDN_ROOT).split('${pin}').join(PIN[d]).replace(/\\1/g, '$$1');
  SITE = SITE.replace(new RegExp(pat, 'g'), (...a) => { rewrites++; return rep.replace('$1', a[1]); });
}
const SPRITES = `${CDN_ROOT}@${PIN.Sprites}/Sprites/`;

// ---- 2. two origins: the Pages site and the art CDN ----
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.webm': 'video/webm', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };
async function serveFile(res, rel, hdr) {
  const fp = path.resolve(ROOT, rel);
  if (!fp.startsWith(ROOT + path.sep)) { res.writeHead(403, hdr); res.end(); return 403; }
  const head = { 'Content-Type': TYPES[path.extname(fp).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache', ...hdr };
  let st = null; try { st = statSync(fp); } catch (e) {}
  if (st && st.isFile()) { res.writeHead(200, { ...head, 'Content-Length': st.size }); createReadStream(fp).pipe(res); return 200; }
  const buf = await gitShow(rel.replace(/\\/g, '/'));
  if (!buf) { res.writeHead(404, hdr); res.end('not found'); return 404; }
  res.writeHead(200, head); res.end(buf); return 200;
}
const log = { site: [], cdn: [] };
const site = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'), p = decodeURIComponent(u.pathname); let s;
  if (p === '/' || p === '/index.html' || p === '/mojiworld_game.html') { res.writeHead(200, { 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-cache' }); res.end(SITE); s = 200; }
  else if (EXCL.has(p.split('/')[1]) || /\.md$/i.test(p)) { res.writeHead(404); res.end('not on Pages'); s = 404; }
  else s = await serveFile(res, p.slice(1), {});
  log.site.push({ p, q: u.search, s, t: Date.now() });
});
const PFX = /^\/gh\/dpeh001-x\/Mojiworld@([0-9a-f]{40})\/(.*)$/, failedOnce = new Set();
const cdn = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'), m = PFX.exec(u.pathname), H = { 'Access-Control-Allow-Origin': '*' }; let s;
  if (!m) { res.writeHead(404, H); res.end(); s = 404; }
  else if (/[?&]lxprobe=/.test(u.search) && !/[?&]lxretry=/.test(u.search) && !failedOnce.has(req.url)) {
    failedOnce.add(req.url); res.writeHead(503, { ...H, 'Content-Type': 'text/html' }); res.end('<html>edge hiccup</html>'); s = 503;   // a transient edge failure (ORB-blocked for an image)
  } else s = await serveFile(res, decodeURIComponent(m[2]), H);
  log.cdn.push({ p: m ? '/' + decodeURIComponent(m[2]) : u.pathname, q: u.search, s, t: Date.now() });
});
await new Promise((r) => site.listen(PORT, '127.0.0.1', r)); await new Promise((r) => cdn.listen(CDN_PORT, '127.0.0.1', r));

const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
try {
  check(DIRS.includes('Sprites') && !!sedM && !!rootM && EXCL.has('Sprites') && rewrites > 100, 'deploy emulation: the workflow rewrite was read and applied', { dirs: DIRS, sed: !!sedM, root: !!rootM, rewrites });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = [], reqUrls = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160))); p.on('request', (r) => reqUrls.push(r.url()));
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof _lxEmojiSvgTile === 'function' && typeof _probeMonsterCustomSfx === 'function' && typeof _lxLoadNpcSpriteInto === 'function', null, { timeout: 150000 });
  await p.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'rogue'; player.level = 70;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    loadMap('mushroom'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
    player.invulnerable = 999999; game.monsters.length = 0;
    const t0 = game.time, w0 = Date.now(); while (game.time - t0 < 20 && Date.now() - w0 < 60000) await new Promise((s) => setTimeout(s, 100));   // the sim is stepping
  });
  const sameOrigin = await p.evaluate(() => fetch('/Sprites/npc/Taiga.webp').then((r) => r.status, () => -1));
  check(sameOrigin === 404, 'deploy emulation: the site itself has no Sprites/ (as on Pages)', { sameOrigin });

  // ---- 3. the emoji atlas: page tiles, SVG and canvas ----
  const emo = await p.evaluate(async () => {
    const d = document.createElement('div'); d.id = 'lx-emo-probe'; d.style.cssText = 'position:fixed;left:4px;top:4px;z-index:2147483647;font-size:24px;background:#fff';
    d.textContent = 'atlas ⭐'; document.body.appendChild(d);
    const w0 = Date.now(); let el = null;
    while (!(el = d.querySelector('.lx-emo')) && Date.now() - w0 < 10000) await new Promise((r) => setTimeout(r, 100));
    const A = window.LX_EMOJI_ATLAS || {}, bg = el ? getComputedStyle(el).backgroundImage : null;
    const cm = bg ? /^url\("(.*)"\)$/.exec(bg) : null, cssUrl = cm ? cm[1] : null;
    const sv = _lxEmojiSvgTile('⭐', 20, 10, 10), im = sv && sv.querySelector('image');
    const href = im ? im.getAttribute('href') : null, svgUrl = href ? new URL(href, document.baseURI).href : null;
    if (sv) { const host = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); host.setAttribute('width', '24'); host.setAttribute('height', '24');
      host.style.cssText = 'position:fixed;left:120px;top:4px;z-index:2147483647'; host.appendChild(sv); document.body.appendChild(host); }
    let decoded = null;
    if (cssUrl) { const t = new Image(); t.src = cssUrl;
      try { await Promise.race([t.decode(), new Promise((_, j) => setTimeout(() => j(new Error('timeout')), 15000))]); decoded = t.naturalWidth; } catch (e) { decoded = 'error: ' + e.message; } }
    await new Promise((r) => setTimeout(r, 1500));   // let the tile's own CSS background request land in the logs
    const I = window._lxEmojiAtlasImg;
    return { tile: !!el, bg, cssUrl, href, svgUrl, canvasUrl: I ? I.src : null, canvasW: I ? I.naturalWidth : null, decoded, want: (A.cols || 0) * (A.cell || 0) };
  });
  const ATLAS = SPRITES + 'ui/emoji_atlas.webp';
  const siteAtlas = log.site.filter((r) => r.p === '/Sprites/ui/emoji_atlas.webp'), cdnAtlas = log.cdn.filter((r) => r.p === '/Sprites/ui/emoji_atlas.webp');
  check(emo.tile && !!emo.cssUrl && emo.cssUrl.startsWith(ATLAS), 'the .lx-emo page tiles take their sheet from the art CDN (was the site itself: 404, every tile blank)', { tile: emo.tile, bg: emo.bg, want: ATLAS });
  check(emo.want > 0 && emo.decoded === emo.want && siteAtlas.length === 0 && cdnAtlas.some((r) => r.s === 200),
    'that sheet loads (200 from the CDN, decodes to the full atlas) and the site is never asked for it', { decoded: emo.decoded, want: emo.want, site: siteAtlas.map((r) => r.s), cdn: cdnAtlas.map((r) => r.s) });
  check(!!emo.href && emo.href.startsWith(ATLAS), 'SVG emoji tiles point their <image> at the art CDN too', { href: emo.href });
  check(!!emo.canvasUrl && emo.canvasUrl === emo.cssUrl && emo.svgUrl === emo.cssUrl && emo.canvasW === emo.want,
    'canvas, page tiles and SVG share ONE resolved atlas URL (the canvas one, which already worked)', { canvas: emo.canvasUrl, css: emo.cssUrl, svg: emo.svgUrl, canvasW: emo.canvasW });

  // ---- 4. monster sounds: no probe for a type with no clip ----
  await p.evaluate(async () => {
    try { _playMonsterSfx({ type: 'sovCrownShard' }, 'hit'); } catch (e) {}
    await new Promise((r) => setTimeout(r, 300));
    try { _playMonsterSfx({ type: 'sovCrownShard' }, 'die'); } catch (e) {}
    _probeMonsterCustomSfx('sovCrownShard', 'hit'); _probeMonsterCustomSfx('sovCrownShard', 'die');   // the chokepoint itself, past the mute / cooldown gates
    _probeMonsterCustomSfx('towerSovereign', 'hit');   // control: a type WITH its own clip
  });
  const ctl = '/audio/monster/mob_towerSovereign_hit.mp3'; { const w0 = Date.now(); while (!log.cdn.some((r) => r.p === ctl) && Date.now() - w0 < 20000) await p.waitForTimeout(250); }
  await p.waitForTimeout(1000);
  check(log.cdn.some((r) => r.p === ctl && r.s === 200), 'control: a monster with its own clip still loads it from the CDN', { cdnAudio: log.cdn.filter((r) => /audio\/monster/.test(r.p)).map((r) => r.p + ' ' + r.s) });
  const crown = [...log.site, ...log.cdn].filter((r) => /mob_sovCrownShard_/.test(r.p)).map((r) => r.p + ' ' + r.s).concat(reqUrls.filter((u) => /mob_sovCrownShard_/.test(u)));
  check(crown.length === 0, 'sovCrownShard never asks for mob_sovCrownShard_hit/die.mp3 (they do not exist: a 404 each)', { crown });

  // ---- 5. one retry for art-CDN images ----
  const rt = await p.evaluate(async () => {
    NPC_SPRITE_FILES.__lxRetryProbe = 'Taiga.webp?lxprobe=1';   // the real NPC loader, on a URL whose first fetch the CDN fails
    const ok = await Promise.race([_lxLoadNpcSpriteInto('__lxRetryProbe'), new Promise((r) => setTimeout(() => r('timeout'), 20000))]);
    const img = NPC_SPRITES.__lxRetryProbe, r = { ok, w: img ? img.naturalWidth : 0, src: img ? img.src : null };
    delete NPC_SPRITE_FILES.__lxRetryProbe; delete NPC_SPRITES.__lxRetryProbe; delete NPC_SPRITE_META.__lxRetryProbe;
    return r;
  });
  const pr = log.cdn.filter((r) => /[?&]lxprobe=1/.test(r.q)).map((r) => ({ q: r.q, s: r.s, t: r.t }));
  check(rt.ok === true && rt.w > 0 && pr.length === 2 && pr[0].s === 503 && !/lxretry/.test(pr[0].q) && pr[1].s === 200 && /[?&]lxretry=1/.test(pr[1].q) && pr[1].t - pr[0].t >= 900,
    'a CDN sprite whose first fetch fails is retried once, later, and loads (the NPC loader never sees the failure)', { rt, pr });
  check(!!rt.src && !/lxretry/.test(rt.src), 'the retried image still reads back the URL the loader set', { src: rt.src });
  const miss = await p.evaluate(async (base) => {
    let errs = 0, loads = 0; const img = new Image();
    const done = new Promise((r) => { img.onerror = () => { errs++; r(); }; img.onload = () => { loads++; r(); }; });
    img.src = base + 'ui/__lx_missing_probe.webp?v=1';
    await Promise.race([done, new Promise((r) => setTimeout(r, 15000))]); await new Promise((r) => setTimeout(r, 2500));   // a 2nd retry would be in by now
    const loc = new Image(); let le = 0; loc.onerror = () => { le++; }; loc.src = '/__lx_local_missing_probe.png';   // same-origin: never retried
    await new Promise((r) => setTimeout(r, 2500));
    return { errs, loads, le };
  }, SPRITES);
  const mr = log.cdn.filter((r) => r.p === '/Sprites/ui/__lx_missing_probe.webp').map((r) => r.q + ' ' + r.s);
  check(miss.errs === 1 && miss.loads === 0 && mr.length === 2 && /lxretry=1/.test(mr[1]), 'a CDN image that is really missing is retried exactly once, then the page hears one error', { miss, mr });
  const lr = log.site.filter((r) => r.p === '/__lx_local_missing_probe.png').length;
  check(miss.le === 1 && lr === 1, 'images that are not on the art CDN are never retried', { le: miss.le, requests: lr });
  check(errs.length === 0, 'no page errors', errs.slice(0, 5));
} finally {
  await browser.close(); site.closeAllConnections(); cdn.closeAllConnections(); site.close(); cdn.close();
}
console.log(bad ? `${bad} of ${total} FAILED` : `all ${total} passed`);
process.exit(bad ? 1 : 0);
