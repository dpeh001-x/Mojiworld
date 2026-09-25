// SCRATCH — the Skills tab's RP bar in the running game, cropped. PORT= OUT= MOJI_GAME_FILE= node scripts/_rp_shot.mjs tag
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT, OUT = process.env.OUT, FILE = process.env.MOJI_GAME_FILE, TAG = process.argv[2] || 'rp';
mkdirSync(OUT, { recursive: true });
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  await page.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: 'font/woff2', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
  });
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof openLevelUpPanel === 'function', null, { timeout: 120000 });
  const box = await page.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'rogue'; player.level = 99;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true });
    loadMap('town'); await new Promise((s) => setTimeout(s, 3000));
    const ew = document.getElementById('everdawn-welcome-overlay'); if (ew) ew.remove();
    player.rankPoints = 995; if (typeof player.skillRankPoints !== 'undefined') player.skillRankPoints = 995;
    game._uTab = 'skills'; openLevelUpPanel(); const b = document.querySelector('[data-utab="skills"]'); if (b) b.click();
    await document.fonts.ready; await new Promise((s) => setTimeout(s, 800));
    const c = document.querySelector('.skl-sp-card'); if (!c) return null; c.scrollIntoView({ block: 'center' });
    await new Promise((s) => setTimeout(s, 300));
    const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, pool: (document.getElementById('rank-pool') || {}).textContent };
  });
  if (!box) { console.log('no RP card'); process.exit(1); }
  await page.screenshot({ path: path.join(OUT, TAG + '.png'), clip: { x: Math.max(0, box.x - 20), y: Math.max(0, box.y - 26), width: box.w + 40, height: box.h + 52 } });
  console.log('ok', JSON.stringify(box));
} finally { await browser.close().catch(() => {}); srv.kill(); }
