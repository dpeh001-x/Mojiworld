// SCRATCH — where the dev lock sits on the public web: desktop, and a phone in landscape (with its on-screen deck).
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '10491', OUT = process.env.OUT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio', '--host-resolver-rules=MAP tester.mojiworld.example 127.0.0.1'] });
try {
  for (const [tag, opts] of [['desktop', { viewport: { width: 1280, height: 720 } }], ['phone', { viewport: { width: 842, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36' }]]) {
    const ctx = await browser.newContext({ ...opts, serviceWorkers: 'block' }); const page = await ctx.newPage();
    await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
    await page.goto(`http://tester.mojiworld.example:${PORT}/${FILE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => typeof loadMap === 'function' && document.getElementById('lx-dev-lock'), null, { timeout: 120000 });
    const hits = await page.evaluate(async () => {
      for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
      window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'warrior'; player.level = 30; loadMap('duneSands');
      await new Promise((s) => setTimeout(s, 4000));
      for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
      const lk = document.getElementById('lx-dev-lock'); lk.style.opacity = '0.9';   // (shown bright for the picture; it idles at 26%)
      const r = lk.getBoundingClientRect();
      const over = [...document.querySelectorAll('button, .mc-btn, .skill-slot, #fullscreen-btn, #settings-btn, [id$="-btn"]')].filter((e) => { if (e === lk) return false; const b = e.getBoundingClientRect(); if (!(b.width > 0 && b.height > 0)) return false; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return false; return b.left < r.right && b.right > r.left && b.top < r.bottom && b.bottom > r.top; }).map((e) => e.id || e.className);
      return { lock: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], over };
    });
    console.log(tag, JSON.stringify(hits));
    await page.screenshot({ path: path.join(OUT, `lock_${tag}.png`) });
    await ctx.close();
  }
} finally { await browser.close().catch(() => {}); srv.kill(); }
