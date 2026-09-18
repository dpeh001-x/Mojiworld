// SCRATCH — the Block (A) slot in the real hotbar, next to that class's skill icons, one class per row; with
// candidate art served in place of Sprites/ui/block_<cls>.webp when CAND=<dir> and PICK=warrior=1,rogue=2,...
//   PORT=10461 TAG=now OUT=<dir> node scripts/_block_icon_shot.mjs          CAND=<dir> PICK=... TAG=new ...
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '10461', TAG = process.env.TAG || 'shot', OUT = process.env.OUT, CAND = process.env.CAND || null;
const PICK = Object.fromEntries((process.env.PICK || '').split(',').filter(Boolean).map((p) => p.split('=')));
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
mkdirSync(OUT, { recursive: true });
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 747 }, deviceScaleFactor: 2, serviceWorkers: 'block' })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  // the working copy can lag origin: serve origin's copy of any sprite missing here; candidates in place of the block art
  await page.route((u) => /[/]Sprites[/].*[.]webp$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    const m = rel.match(/^Sprites[/]ui[/]block_(warrior|rogue|mage|archer|shield)[.]webp$/);
    if (CAND && m && PICK[m[1]]) return r.fulfill({ status: 200, contentType: 'image/webp', body: readFileSync(path.join(CAND, `block_${m[1]}_v${PICK[m[1]]}.webp`)) });
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: 'image/webp', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
  });
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof renderSkillBar === 'function', null, { timeout: 120000 });
  await page.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false;
    player.level = 60; loadMap('duneSands'); await new Promise((s) => setTimeout(s, 3500)); try { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); } catch (e) {}
    for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
  });
  for (const cls of ['warrior', 'rogue', 'mage', 'archer', '']) {
    const ok = await page.evaluate(async (cls) => {
      player.cls = cls; player.job = null; player.master = null;
      try { renderSkillBar(); } catch (e) {}
      try { _lxRefreshBlockIcon(true); } catch (e) {}
      const img = document.querySelector('#skill-bar img[data-lx-block-icon]');
      for (let i = 0; i < 50 && !(img && img.complete && img.naturalWidth > 0); i++) await new Promise((s) => setTimeout(s, 100));
      for (const im of document.querySelectorAll('#skill-bar img')) { for (let i = 0; i < 30 && !(im.complete && im.naturalWidth > 0); i++) await new Promise((s) => setTimeout(s, 100)); }
      return img ? img.getAttribute('src') : null;
    }, cls);
    const bar = await page.$('#skill-bar');
    const bb = await bar.boundingBox();
    await page.screenshot({ path: path.join(OUT, `${TAG}_${cls || 'none'}.png`), clip: { x: bb.x - 4, y: bb.y - 4, width: Math.min(bb.width + 8, 560), height: bb.height + 8 } });
    console.log(TAG, cls || '(no class)', ok);
  }
  console.log('errors:', errs.length ? errs.slice(0, 3).join(' | ') : 'none');
} finally { await browser.close().catch(() => {}); srv.kill(); }
