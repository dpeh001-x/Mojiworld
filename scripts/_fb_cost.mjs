// SCRATCH — drawHazards cost with six fireballs mid-fall (loop frames decoded), both builds in one run each.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
const ROOT = 'C:/Users/dpeh0/Mojiworld', PORT = process.env.PORT || '10431', FILE = process.argv[2];
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 747 }, deviceScaleFactor: 2, serviceWorkers: 'block' })).newPage();
  await page.route((u) => /Sprites[/]projectiles[/]anim[/]meteor_[0-9]+[.]webp$/.test(u.pathname), async (r) => { const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, ''); if (existsSync(path.join(ROOT, rel))) return r.continue(); r.fulfill({ status: 200, contentType: 'image/webp', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); });
  const TBL = path.join(process.env.TEMP, 'gs_tables');
  await page.route((u) => /data[/]sprite_(bbox|edges|frame_index)[.]js/.test(u.pathname), (r) => { try { r.fulfill({ status: 200, contentType: 'application/javascript', body: readFileSync(path.join(TBL, r.request().url().split('/').pop().split('?')[0])) }); } catch (e) { r.continue(); } });
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof drawHazards === 'function', null, { timeout: 120000 });
  const out = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; player.cls = 'mage'; loadMap('duneSands'); await sleep(3000); game.paused = true;
    let fr = null; for (let i = 0; i < 300 && !(fr && (fr.naturalWidth || fr.width)); i++) { fr = _projAnimFrame('meteor'); await sleep(100); }
    const hz = []; for (let i = 0; i < 6; i++) hz.push({ type: 'meteor_warn', cx: 120 + i * 150, x: 30 + i * 150, y: 0, w: 180, h: H, radius: 90, life: 50, maxLife: 100, fireAt: 100, owner: 'enemy', damage: 1 });
    const run = (flush) => { const t0 = performance.now(); for (let k = 0; k < 120; k++) { for (const h of hz) h.life = 20 + (k % 60); game.hazards = hz.slice(); game.time++; drawHazards(); } if (flush) ctx.getImageData(0, 0, 1, 1); return (performance.now() - t0) / 120; };
    run(true); const rec = [], all = [];
    for (let r = 0; r < 7; r++) { rec.push(run(false)); ctx.getImageData(0, 0, 1, 1); all.push(run(true)); }
    const med = (a) => { a.sort((x, y) => x - y); return +a[a.length >> 1].toFixed(3); };
    return { frame: fr ? (fr.naturalWidth || fr.width) : 0, mainThreadMs: med(rec), withRasterMs: med(all) };
  });
  console.log(FILE, JSON.stringify(out));
} finally { await browser.close().catch(() => {}); srv.kill(); }
