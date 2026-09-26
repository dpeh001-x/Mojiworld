// Launch meta (v0.30.x launch-meta): share cards + manifest, the dev lock off the public web, and the repo half
// (the Pages deploy, README, steam/package.json, the launcher links, the portable zip build).
//   node scripts/launch_meta_test.mjs     (MOJI_GAME_FILE=<build.html> to test a private build;
//                                          LX_META_ROOT=<dir> to read the repo files from another tree, default: this repo)
// The public web is simulated like dev_lock_test.mjs does: a host name that is not local, mapped to this machine's server.
import { chromium } from 'playwright-core';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const META = path.resolve(process.env.LX_META_ROOT || ROOT);
const PORT = process.env.PORT || '11391';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const GAME_SRC = fs.readFileSync(path.join(ROOT, FILE), 'utf8');
const GV = (/GAME_VERSION = 'v(\d+\.\d+\.\d+)'/.exec(GAME_SRC) || [])[1] || null;
const PUBLIC = 'play.launchmeta.test';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const readMeta = (rel) => { try { return fs.readFileSync(path.join(META, rel), 'utf8'); } catch (e) { return null; } };
const fromOrigin = (rel) => execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 26 });
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio', `--host-resolver-rules=MAP ${PUBLIC} 127.0.0.1`] });
const errs = [];
// files a private tree may lack: fonts/icons from origin, the new manifest/robots from the META tree
async function routes(ctx) {
  await ctx.route((u) => /[/]assets[/].*[.](woff2|png|jpg|svg)$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: /woff2$/.test(rel) ? 'font/woff2' : 'image/' + (rel.endsWith('svg') ? 'svg+xml' : rel.split('.').pop().replace('jpg', 'jpeg')), body: fromOrigin(rel) }); } catch (e) { r.continue(); }
  });
  await ctx.route((u) => /^[/](manifest[.]webmanifest|robots[.]txt)$/.test(u.pathname), async (r) => {
    const rel = new URL(r.request().url()).pathname.slice(1);
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    const body = readMeta(rel); if (body == null) return r.continue();
    r.fulfill({ status: 200, contentType: rel.endsWith('txt') ? 'text/plain' : 'application/manifest+json', body });
  });
}
async function openPage(host, query, init) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
  await routes(ctx);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  if (init) await p.addInitScript(init);
  await p.goto(`http://${host}:${PORT}/${FILE}${query}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  return { ctx, p };
}
const lockState = (p) => p.evaluate(() => { const el = document.getElementById('lx-dev-lock'); return { lock: el ? el.textContent : null, surface: (typeof _lxDevSurface === 'function') ? _lxDevSurface() : 'n/a' }; });
const waitLockReady = (p) => p.waitForFunction(() => typeof openDevConsole === 'function' && typeof _lxDevSurface === 'function' && document.body && document.readyState !== 'loading', null, { timeout: 150000 }).then(() => p.waitForTimeout(800));

try {
  // ---- 1) the game, booted on a developer machine (localhost, ?dev=1) --------------------------------------------
  { const { ctx, p } = await openPage('localhost', '?dev=1');
    await p.waitForFunction(() => typeof loadMap === 'function' && typeof game === 'object' && typeof player === 'object', null, { timeout: 150000 });
    await p.evaluate(async () => {
      for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
      window._lxBootGateDone = true; window._prologueActive = false;
      player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
      loadMap('mushroom'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
      player.invulnerable = 999999;
    });
    const head = await p.evaluate(async () => {
      const m = (sel) => { const el = document.head.querySelector(sel); return el ? (el.getAttribute('content') || el.getAttribute('href')) : null; };
      const r = { description: m('meta[name="description"]'), ogTitle: m('meta[property="og:title"]'), ogDesc: m('meta[property="og:description"]'), ogType: m('meta[property="og:type"]'),
        ogUrl: m('meta[property="og:url"]'), ogImage: m('meta[property="og:image"]'), twitter: m('meta[name="twitter:card"]'), manifest: m('link[rel="manifest"]') };
      r.man = null; r.icons = [];
      if (r.manifest) { try { const href = new URL(r.manifest, location.href).href; const res = await fetch(href, { cache: 'no-store' }); r.manStatus = res.status; r.man = JSON.parse(await res.text());
        for (const ic of (r.man.icons || [])) { const ir = await fetch(new URL(ic.src, href).href, { cache: 'no-store' }); r.icons.push(ic.src + ' ' + ir.status + ' ' + ic.sizes); } } catch (e) { r.manErr = String(e).slice(0, 120); } }
      return r;
    });
    console.log('head:', JSON.stringify(head).slice(0, 700));
    check(head.description && head.description.length >= 60 && head.description.length <= 170, 'the page has a meta description (60-170 chars)', head.description);
    check(head.ogTitle && /Mojiworld/.test(head.ogTitle) && head.ogDesc && head.ogType === 'website' && head.ogUrl === 'https://play.moji-studios.com/',
      'Open Graph: og:title, og:description, og:type website, og:url https://play.moji-studios.com/', head);
    const img = /^https:\/\/cdn\.jsdelivr\.net\/gh\/dpeh001-x\/Mojiworld@[^/]+\/(.+)$/.exec(head.ogImage || '') || /^https:\/\/play\.moji-studios\.com\/(.+)$/.exec(head.ogImage || '');
    let imgInRepo = false; if (img) { try { imgInRepo = execFileSync('git', ['ls-tree', '--name-only', 'origin/main', '--', img[1]], { cwd: ROOT, encoding: 'utf8' }).trim() === img[1]; } catch (e) {} }
    check(!!img && imgInRepo, 'og:image is an absolute URL (jsDelivr / the Pages site) to key art that exists in the repo', { ogImage: head.ogImage, imgInRepo });
    check(head.twitter === 'summary_large_image', 'a twitter:card (summary_large_image)', head.twitter);
    const man = head.man || {};
    check(head.manifest && head.manStatus === 200 && man.name && man.short_name && man.start_url && /^(fullscreen|standalone)$/.test(man.display) && /^#[0-9a-f]{6}$/i.test(man.background_color || '') && /^#[0-9a-f]{6}$/i.test(man.theme_color || '')
      && head.icons.length >= 2 && head.icons.every((s) => / 200 /.test(s)), 'a <link rel="manifest">; the manifest parses (name, short_name, start_url, display, colours) and every icon loads', head);
    const ls = await lockState(p);
    check((ls.lock === '🔒' || ls.lock === '🔓') && ls.surface === true, 'on localhost (a developer surface) the dev lock is still there (🔓 with ?dev=1)', ls);
    await ctx.close(); }

  // ---- 2) the dev lock on the public web -------------------------------------------------------------------------
  { const { ctx, p } = await openPage(PUBLIC, '?dev=1'); await waitLockReady(p); const s = await lockState(p);
    check(s.lock === null && s.surface === false, 'on the public web there is no dev lock icon (?dev=1 does not bring it back)', s); await ctx.close(); }
  { const { ctx, p } = await openPage(PUBLIC, '?devlock=1'); await waitLockReady(p); const s = await lockState(p);
    check(s.lock === '🔒' && s.surface === false, 'with ?devlock=1 the public web shows the lock (the tester\'s way in), still locked', s); await ctx.close(); }
  { const { ctx, p } = await openPage(PUBLIC, '?devlock=1', () => { window.MOJI_PACKAGED = true; }); await waitLockReady(p); const s = await lockState(p);
    check(s.lock === null, 'the packaged Steam app still never shows it, even with ?devlock=1', s); await ctx.close(); }
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close().catch(() => {}); srv.kill(); }

// ---- 3) the repo half (static + small functional runs on temp copies) -------------------------------------------
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'lx_launch_meta_'));
try {
  // the Pages workflow: parses, excludes the dev files, trims steam/, versions data/*.js
  const yml = readMeta('.github/workflows/deploy-pages.yml') || '';
  let doc = null, yerr = null, yamlLib = null;
  for (const base of [ROOT, META]) { try { yamlLib = createRequire(path.join(base, 'steam', 'package.json'))('js-yaml'); break; } catch (e) {} }
  try { doc = yamlLib ? yamlLib.load(yml) : null; if (!yamlLib) yerr = 'js-yaml not found under steam/node_modules'; } catch (e) { yerr = String(e).slice(0, 200); }
  const run = (((doc && doc.jobs && doc.jobs.build && doc.jobs.build.steps) || []).find((s) => s.name === 'Assemble site') || {}).run || '';
  fs.writeFileSync(path.join(TMP, 'assemble.sh'), run);
  const bn = spawnSync('bash', ['-n', path.join(TMP, 'assemble.sh')], { encoding: 'utf8' });
  check(!!doc && run.length > 500 && bn.status === 0, 'deploy-pages.yml parses (js-yaml) and its "Assemble site" script passes bash -n', { yerr, runLen: run.length, bash: bn.status, err: (bn.stderr || '').slice(0, 200) });
  const want = ['/.gitignore', '/render.yaml', '/package.json', '/package-lock.json', '/mp*/', 'scripts', 'docs', 'server', 'tools', 'mp-cf', '*.md', 'node_modules', 'Sprites', 'audio', 'backgrounds'];
  const missing = want.filter((x) => !run.includes(`--exclude '${x}'`));
  check(missing.length === 0 && /for d in Sprites audio backgrounds; do/.test(run), 'the deploy excludes .gitignore, render.yaml, package*.json, mp*/, scripts/, docs/, server/, tools/, *.md (and still CDN-rewrites the art)', { missing });
  // run the new steam/ + data/*.js block for real on a fake _site (the part between .nojekyll and the custom domain)
  const a = run.indexOf('touch _site/.nojekyll'), b = run.indexOf('# Custom domain');
  const snippet = (a >= 0 && b > a) ? run.slice(a, b) : '';
  const D = path.join(TMP, 'deploy'); const CIN = path.join(D, '_site', 'steam', 'higgsfield', 'cinematics');
  fs.mkdirSync(path.join(CIN, 'thumbs'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, FILE), path.join(D, 'mojiworld_game.html'));
  for (const f of ['index.html', 'mojiworld_game.html']) fs.copyFileSync(path.join(ROOT, FILE), path.join(D, '_site', f));
  for (const f of ['clip_prologue_pov.mp4', 'zz_never_played.mp4', 'cinematics_review.html', 'thumbs/t_zz.webp']) fs.writeFileSync(path.join(CIN, f), 'x');
  fs.writeFileSync(path.join(D, 'snippet.sh'), snippet);
  const sr = spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', 'snippet.sh'], { cwd: D, encoding: 'utf8', env: { ...process.env, GITHUB_SHA: '0123456789abcdef0123' } });
  const left = fs.existsSync(CIN) ? fs.readdirSync(CIN, { recursive: true }).map(String).sort() : [];
  const tags = (GAME_SRC.match(/<script src="data\/[A-Za-z0-9_.-]+\.js"/g) || []).length;
  const idx = fs.readFileSync(path.join(D, '_site', 'index.html'), 'utf8');
  const vtags = (idx.match(new RegExp('<script src="data/[A-Za-z0-9_.-]+\\.js\\?v=v' + (GV || 'x').replace(/\./g, '\\.') + '"', 'g')) || []).length;
  check(sr.status === 0 && left.join(',') === 'clip_prologue_pov.mp4', 'the deploy ships only the steam/ files the game names (a clip, the review page and thumbs it never loads are dropped)', { rc: sr.status, left, out: (sr.stdout + sr.stderr).slice(0, 200) });
  check(sr.status === 0 && tags >= 5 && vtags === tags, 'the deploy loads every data/*.js as ?v=<GAME_VERSION> (HTML and tables cannot skew)', { tags, vtags, GV });
  // README, steam/package.json, the launcher, the new root files
  const readme = readMeta('README.md') || '';
  check(!/\| *Reset save[^|]*\| *`T`/.test(readme) && !/Dev console[^|]*\| *hold `1`/.test(readme) && /\[\*\*Releases\*\*\]\(https:\/\/github\.com\/dpeh001-x\/Mojiworld\/releases\)/.test(readme),
    'README: the stale "Reset save (T)" and "Dev console 1+2+3" rows are gone; Download still links Releases', { resetRow: /Reset save/.test(readme), devRow: /Dev console \|/.test(readme) });
  let spkg = null; try { spkg = JSON.parse(readMeta('steam/package.json')); } catch (e) {}
  const filt = spkg ? (spkg.build.extraResources.find((e) => e.from === '..') || {}).filter || [] : [];
  check(!!spkg && GV && spkg.version === GV && filt.includes('manifest.webmanifest') && filt.includes('assets/mojiworld_icon_512.png'), 'steam/package.json version = GAME_VERSION, and the depot/zip filter ships the manifest + its 512 icon', { steam: spkg && spkg.version, game: GV });
  const cmd = readMeta('Mojiworld.cmd') || '', bpz = readMeta('scripts/build_portable_zip.mjs') || '';
  check(/start "" "https:\/\/play\.moji-studios\.com\/"/.test(cmd) && !/raw\.githack/.test(cmd) && /https:\/\/play\.moji-studios\.com\//.test(bpz) && !/raw\.githack/.test(bpz),
    'the launcher fallback (Mojiworld.cmd) and PLAY_ME_FIRST.txt point at https://play.moji-studios.com/', { cmd: /play\.moji-studios/.test(cmd), bpz: /play\.moji-studios/.test(bpz) });
  let wm = null; try { wm = JSON.parse(readMeta('manifest.webmanifest')); } catch (e) {}
  check(!!wm && wm.name && (wm.icons || []).length >= 2 && /User-agent: \*/.test(readMeta('robots.txt') || ''), 'manifest.webmanifest (parses) and robots.txt sit at the repo root, so Pages ships them', { manifest: !!wm, robots: !!readMeta('robots.txt') });

  // the portable zip build, on a stub tree: "!" entries are exclusions, the backups stay out, it completes
  const Z = path.join(TMP, 'zip'); fs.mkdirSync(path.join(Z, 'scripts'), { recursive: true }); fs.mkdirSync(path.join(Z, 'steam'), { recursive: true });
  fs.writeFileSync(path.join(Z, 'scripts', 'build_portable_zip.mjs'), bpz);
  fs.writeFileSync(path.join(Z, 'steam', 'package.json'), readMeta('steam/package.json') || '{}');
  const put = (rel, body = 'x') => { fs.mkdirSync(path.dirname(path.join(Z, rel)), { recursive: true }); fs.writeFileSync(path.join(Z, rel), body); };
  put('mojiworld_game.html', "const GAME_VERSION = 'v" + (GV || '0.0.1') + "';");
  for (const e of filt) { if (e.startsWith('!')) continue; if (e.endsWith('/**')) put(e.slice(0, -3) + '/keep.txt'); else if (!fs.existsSync(path.join(Z, e))) put(e); }
  for (const f of ['Sprites/ui/block_shield.webp', 'audio/voice/keep.mp3', 'audio/voice/_orig_backup/old.mp3', 'audio/_regen_backup/old.mp3', 'Sprites/ui/hud/_icon_backup/old.webp', 'serve.js', 'Mojiworld.cmd', 'fake-node.exe']) put(f);
  const zr = spawnSync(process.execPath, [path.join(Z, 'scripts', 'build_portable_zip.mjs'), '--zip', '--node', path.join(Z, 'fake-node.exe')], { cwd: Z, encoding: 'utf8', timeout: 240000 });
  const zdir = path.join(Z, 'scripts', '_tmp_portable'); const zip = fs.existsSync(zdir) ? fs.readdirSync(zdir).find((f) => f.endsWith('.zip')) : null;
  const names = zip ? zipNames(fs.readFileSync(path.join(zdir, zip))) : [];
  const backups = names.filter((n) => /(^|[\\/])_[^\\/]*backup[^\\/]*([\\/]|$)/i.test(n));
  const play = (() => { try { return fs.readFileSync(path.join(zdir, 'Mojiworld', 'PLAY_ME_FIRST.txt'), 'utf8'); } catch (e) { return ''; } })();
  check(zr.status === 0 && !!zip && names.some((n) => /audio[\\/]voice[\\/]keep\.mp3$/.test(n)) && backups.length === 0 && /play\.moji-studios\.com/.test(play),
    'build_portable_zip.mjs completes in a temp dir; its zip has the audio but no _*backup* folder; PLAY_ME_FIRST names play.moji-studios.com', { rc: zr.status, zip, entries: names.length, backups: backups.slice(0, 3), err: (zr.stderr || '').slice(-240) });
} finally { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} }

// zip central directory -> entry names (no dependency)
function zipNames(buf) {
  let e = buf.length - 22; while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) return [];
  const n = buf.readUInt16LE(e + 10); let o = buf.readUInt32LE(e + 16); const out = [];
  for (let i = 0; i < n && buf.readUInt32LE(o) === 0x02014b50; i++) { const fl = buf.readUInt16LE(o + 28), xl = buf.readUInt16LE(o + 30), cl = buf.readUInt16LE(o + 32); out.push(buf.toString('utf8', o + 46, o + 46 + fl)); o += 46 + fl + xl + cl; }
  return out;
}
console.log(bad === 0 ? `\nall ${total} passed` : `\n${bad} of ${total} FAILED`);
process.exit(bad === 0 ? 0 : 1);
