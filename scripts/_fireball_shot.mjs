// SCRATCH — the falling fireball in the running game, pinned at points of its fall, with its fall hitbox outlined.
//   PORT=10401 TAG=before OUT=<dir> MOJI_GAME_FILE=<build.html> node scripts/_fireball_shot.mjs [progs] [--nobox]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '10401', TAG = process.env.TAG || 'shot', OUT = process.env.OUT;
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html', MAP = process.env.MAP || 'duneSands';
const PROGS = (process.argv[2] || '0.25,0.55,0.8,0.97').split(',').map(Number);
const BOX = !process.argv.includes('--nobox');
mkdirSync(OUT, { recursive: true });
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 747 }, deviceScaleFactor: 2, serviceWorkers: 'block' })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  const TBL = path.join(process.env.TEMP, 'gs_tables');
  await page.route((u) => /data[/]sprite_(bbox|edges|frame_index)[.]js/.test(u.pathname), (r) => { try { r.fulfill({ status: 200, contentType: 'application/javascript', body: readFileSync(path.join(TBL, r.request().url().split('/').pop().split('?')[0])) }); } catch (e) { r.continue(); } });
  // the working copy can lag origin (art added since): serve origin's copy of any meteor art that is missing here
  await page.route((u) => /Sprites[/]projectiles[/](anim[/]meteor_[0-9]+|p_meteor(_blue)?)[.]webp$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: 'image/webp', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
  });
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof drawHazards === 'function', null, { timeout: 120000 });
  const info = await page.evaluate(async ({ MAP, BOX }) => {
    const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false;
    player.level = 60; player.cls = 'mage'; player.hp = player.maxHp = 9e7; player._god = true;
    loadMap(MAP); game.paused = false;
    await sleep(4000);
    for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
    for (const m of game.monsters) if (m) { m.x = -5000; m.y = -5000; }
    try { _projAnimFrame('meteor'); } catch (e) {}
    await sleep(1500);   // let the loop frames decode
    const camX = () => game.camera.x;
    // an enemy fireball (a 90-radius lane, like Skirra's / Aries's) and the Archmage's Meteor (a 180-radius lane)
    const mk = (cx, o) => Object.assign({ type: 'meteor_warn', cx, x: cx - 90, y: 0, w: 180, h: H, radius: 90, life: 60, maxLife: 60, fireAt: 60, damage: 1 }, o);
    const pin = window.__pin = { prog: 0.5, hz: [] };
    const place = () => {
      const c = camX();
      pin.hz = [mk(c + 300, { owner: 'enemy', color: '#ffaa33' }), mk(c + 690, { radius: 180, x: c + 510, w: 360 })];
    };
    place();
    const hold = () => {
      player.x = camX() + 470; player.vx = 0; player.hp = player.maxHp;
      game.hazards = game.hazards.filter((h) => h && h.type !== 'meteor_warn');
      for (const h of pin.hz) { h.life = Math.max(1, Math.round(h.maxLife * (1 - pin.prog))); h._passHit = true; h._passSet = new Set(game.monsters); game.hazards.push(h); }
      requestAnimationFrame(hold);
    };
    hold();
    if (BOX) {
      // the fall hitbox, outlined over the draw: the lane (|dx| < halfLane) x the fireball band (y +- r)
      const _dh = window.drawHazards;
      window.drawHazards = function () {
        const r = _dh.apply(this, arguments);
        try {
          const camY = (game.camera && game.camera.y) || 0;
          for (const h of pin.hz) {
            let y, rr, lane;
            let blast = null;
            if (typeof _lxMeteorGeom === 'function') { const g = _lxMeteorGeom(h, camY); y = g.hitY; rr = g.hitR; lane = g.halfW || h.radius; blast = (typeof _lxMeteorBlast === 'function') ? _lxMeteorBlast(h, camY) : null; }
            else { const p = 1 - h.life / h.maxLife; y = camY + 60 + p * 400; rr = 20 + p * 15; lane = h.radius; }
            const sx = h.cx - game.camera.x;
            ctx.save(); ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.strokeStyle = h.owner === 'enemy' ? '#39ff7a' : '#4ad8ff';
            ctx.strokeRect(sx - lane, y - rr, lane * 2, rr * 2);
            if (blast) { ctx.strokeStyle = '#ffe600'; ctx.lineWidth = 3.5; ctx.setLineDash([9, 5]); ctx.strokeRect(sx - blast.r, blast.top, blast.r * 2, blast.bot - blast.top); }
            else { ctx.strokeStyle = '#ffe600'; ctx.lineWidth = 3.5; ctx.setLineDash([9, 5]); ctx.strokeRect(sx - h.radius, camY, h.radius * 2, H); }
            ctx.restore();
          }
        } catch (e) {}
        return r;
      };
    }
    return { cam: Math.round(camX()) };
  }, { MAP, BOX });
  console.log(TAG, JSON.stringify(info));
  for (const p of PROGS) {
    await page.evaluate((p) => { window.__pin.prog = p; }, p);
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(OUT, `${TAG}_${String(Math.round(p * 100)).padStart(3, '0')}.png`), clip: { x: 0, y: 0, width: 1280, height: 747 } });
  }
  console.log('errors:', errs.length ? errs.slice(0, 3).join(' | ') : 'none');
} finally { await browser.close().catch(() => {}); srv.kill(); }
