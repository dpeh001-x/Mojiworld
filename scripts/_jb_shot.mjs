// SCRATCH — DJ Vinyl's console in the running game: desktop and a phone on its side, some tracks found, one playing.
//   PORT=10501 OUT=<dir> ICONS=<dir> MOJI_GAME_FILE=<build.html> node scripts/_jb_shot.mjs [tag]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '10501', OUT = process.env.OUT, ICONS = process.env.ICONS || null, TAG = process.argv[2] || 'jb';
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
mkdirSync(OUT, { recursive: true });
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
const SIZES = [
  ['desktop', { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5 }],
  ['phone', { viewport: { width: 842, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36' }],
];
try {
  for (const [tag, opts] of SIZES) {
    const ctx = await browser.newContext({ ...opts, serviceWorkers: 'block' }); const page = await ctx.newPage();
    const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
    await page.route((u) => /[/]Sprites[/].*[.]webp$/.test(u.pathname), async (r) => {
      const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
      const m = rel.match(/^Sprites[/]ui[/]jukebox[/]([A-Za-z_]+)[.]webp$/);
      if (m && ICONS) { const f = path.join(ICONS, m[1] + '.webp'); if (existsSync(f)) return r.fulfill({ status: 200, contentType: 'image/webp', body: readFileSync(f) }); }
      if (existsSync(path.join(ROOT, rel))) return r.continue();
      try { r.fulfill({ status: 200, contentType: 'image/webp', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
    });
    await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
    await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => typeof loadMap === 'function' && typeof openJukebox === 'function', null, { timeout: 120000 });
    await page.evaluate(async () => {
      for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
      window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'warrior'; player.level = 30;
      loadMap('town'); await new Promise((s) => setTimeout(s, 3500));
      for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
      // a mid-game save: most tracks found, a few still locked in each zone
      game._jukeboxHeard = {}; let k = 0;
      for (const g of JUKEBOX_TRACKS) for (const t of g.tracks) { if (k++ % 5 !== 3) game._jukeboxHeard[t.id] = true; }
      openJukebox();
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, `${TAG}_${tag}_idle.png`) });
    await page.evaluate(() => { const p = document.querySelector('#jukebox-list .jb-track[data-track-id="lavaCavern"]'); if (p) p.click(); });
    await page.waitForTimeout(1600);
    await page.screenshot({ path: path.join(OUT, `${TAG}_${tag}_playing.png`) });
    if (tag === 'desktop') { await page.evaluate(() => { document.getElementById('jukebox-list').scrollTop = 9999; }); await page.waitForTimeout(400); await page.screenshot({ path: path.join(OUT, `${TAG}_${tag}_scrolled.png`) }); }
    const info = await page.evaluate(() => { const m = document.getElementById('jukebox-modal').getBoundingClientRect(); return { modal: [Math.round(m.width), Math.round(m.height)], vw: innerWidth, vh: innerHeight, pads: document.querySelectorAll('#jukebox-list .jb-track').length }; });
    console.log(tag, JSON.stringify(info), 'errors:', errs.length ? errs.slice(0, 2).join(' | ') : 'none');
    await ctx.close();
  }
} finally { await browser.close().catch(() => {}); srv.kill(); }
