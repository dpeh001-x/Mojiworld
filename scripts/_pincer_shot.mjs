// SCRATCH — the Pincer in the running game on Dune Sands, its idle loop pinned to given frames, with the fixed
// frames served in place of the originals when FIXED=<dir>.
//   PORT=10391 TAG=before node scripts/_pincer_shot.mjs [frames]      FIXED=<dir> TAG=after ...
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '10391', TAG = process.env.TAG || 'shot', FIXED = process.env.FIXED || null, OUT = process.env.OUT;
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const PIN = (process.argv[2] || '4,5,6,7').split(',').map(Number);
mkdirSync(OUT, { recursive: true });
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2, serviceWorkers: 'block' })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  const TBL = path.join(process.env.TEMP, 'gs_tables');
  await page.route((u) => /data[/]sprite_(bbox|edges|frame_index)[.]js/.test(u.pathname), (r) => { try { r.fulfill({ status: 200, contentType: 'application/javascript', body: readFileSync(path.join(TBL, r.request().url().split('/').pop().split('?')[0])) }); } catch (e) { r.continue(); } });
  if (FIXED) await page.route((u) => /monsters[/]idle[/]scorpion_[56][.]webp$/.test(u.pathname), (r) => r.fulfill({ status: 200, contentType: 'image/webp', body: readFileSync(path.join(FIXED, r.request().url().split('/').pop().split('?')[0])) }));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _bossPingPongFrame === 'function', null, { timeout: 120000 });
  const info = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false;
    player.level = 40; player.cls = 'warrior'; player.hp = player.maxHp = 99999; player._god = true;
    loadMap('duneSands'); game.paused = false;
    await sleep(4000);
    for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
    let m = game.monsters.find((x) => x && x.type === 'scorpion' && x.currentHp > 0);
    if (!m) { if (typeof spawnMonster === 'function') { try { spawnMonster('scorpion', player.x + 260, player.y); } catch (e) {} } m = game.monsters.find((x) => x && x.type === 'scorpion'); }
    if (!m) return { err: 'no scorpion', types: [...new Set(game.monsters.map((x) => x && x.type))] };
    // only one mob on screen: park the rest far away
    for (const o of game.monsters) if (o && o !== m) { o.x = -5000; o.y = -5000; o.vx = o.vy = 0; }
    // pin the Pincer's idle frame; keep it idle, still, and the hero out of its attack reach
    const orig = window._monsterStateFrame;
    window._monsterStateFrame = function (mm) { const f = orig.apply(this, arguments); const set = MONSTER_FRAMES.scorpion; if (window.__pin != null && mm && mm.type === 'scorpion' && set && set.idle && set.idle[window.__pin]) { window.__pinHit = (window.__pinHit || 0) + 1; return set.idle[window.__pin]; } return f; };
    const hold = () => { m.x = 900; m.vx = 0; m.aggro = false; m.target = null; m.atkAnimUntil = 0; m.attackTimer = 0; m.hitFlash = 0; player.x = 1250; player.vx = 0; player.hp = player.maxHp; requestAnimationFrame(hold); };
    hold();
    await sleep(2500);
    return { x: Math.round(m.x), y: Math.round(m.y), w: m.w, h: m.h };
  });
  console.log(TAG, JSON.stringify(info));
  for (const f of PIN) {
    await page.evaluate((f) => { window.__pin = f; }, f);
    await page.waitForTimeout(400);
    const box = await page.evaluate(() => { const m = game.monsters.find((x) => x && x.type === 'scorpion' && x.x > -4000); const cv = document.getElementById('game'), R = cv.getBoundingClientRect(), k = R.width / W; const cx = R.left + (m.x + m.w / 2 - game.camera.x) * k, cy = R.top + (m.y + m.h / 2 - ((game.camera && game.camera.y) || 0)) * k; return { cx, cy, k }; });
    const CW = 200, CH = 140;
    await page.screenshot({ path: path.join(OUT, `${TAG}_${f}.png`), clip: { x: Math.round(box.cx - CW / 2), y: Math.round(box.cy - CH * 0.62), width: CW, height: CH } });
  }
  console.log('errors:', errs.length ? errs.slice(0, 3).join(' | ') : 'none');
} finally { await browser.close().catch(() => {}); srv.kill(); }
