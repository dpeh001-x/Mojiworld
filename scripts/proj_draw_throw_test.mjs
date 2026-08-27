// Live test: A PROJECTILE ON SCREEN MUST NOT EAT THE REST OF THE FRAME.
//
// Per user, with a video: "when elementalist does G and B skill, animation is
// clunky, also characters and monsters disappear". The mechanism: v0.30.252's
// projectile-scale cache call read `_bw`/`_bh` six lines before their `const`
// declaration - a temporal-dead-zone ReferenceError on every frame that drew a
// projectile whose dedicated art (bspr) had decoded. The per-frame watchdog
// catches the throw and keeps the loop alive, so the only symptom is that
// everything drawn after drawProjectiles - the PLAYER, orbs, pet, particles,
// all fx - vanishes for the projectile's entire life. The Elementalist's
// catastrophes live 110-150 frames, so the player disappeared for seconds; but
// EVERY class's bspr projectile (sage meteors, doombringer wave, phantom
// shurikens...) triggered the same erasure.
//
// The invariant pinned here is engine-wide, not elementalist-specific: while a
// bspr projectile is being drawn, the frame must complete - zero caught loop
// throws, and the player's pixels must stay on the canvas.
//   node scripts/proj_draw_throw_test.mjs
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import net from 'node:net';
import { spawn } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const free = (p) => new Promise((r) => { const s = net.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8961; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], {
  stdio: 'ignore', env: { ...process.env, MOJI_GAME_FILE: process.env.MOJI_GAME_FILE || '' } });
await new Promise((r) => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; const loopErrs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
page.on('console', (m) => { if (m.type() === 'error' && /\[loop|LoopWatchdog/.test(m.text())) loopErrs.push(m.text().slice(0, 240)); });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof skillBySlot === 'function' && typeof spawnMonster === 'function', null, { timeout: 120000 });
await page.evaluate(() => new Promise((res) => { let n = 0;
  const t = () => { window._lxBootGateDone = true;
    const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
    const c = document.querySelector('.cls-card'); if (c) c.click();
    const m = document.getElementById('class-select-modal'); if (m) m.style.display = 'none';
    if (++n > 150) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); }));
await page.evaluate(() => { try { loadMap('tidalLagoon'); } catch (e) {} });
await page.waitForTimeout(1500);

const heroSd = () => page.evaluate(() => {
  const cv = document.querySelector('canvas'); const g2 = cv.getContext('2d');
  const dpr = cv.width / ((typeof W === 'number') ? W : 960);
  const px = Math.round((player.x - game.camera.x + player.w / 2) * dpr);
  const py = Math.round((player.y - game.camera.y + player.h * 0.5) * dpr);
  try { const d = g2.getImageData(px - 12, py - 12, 24, 24).data;
    let mean = 0; for (let i = 0; i < d.length; i += 4) mean += d[i] + d[i + 1] + d[i + 2];
    mean /= (d.length / 4) * 3;
    let vr = 0; for (let i = 0; i < d.length; i += 4) { const v = (d[i] + d[i + 1] + d[i + 2]) / 3; vr += (v - mean) * (v - mean); }
    return Math.sqrt(vr / (d.length / 4));
  } catch (e) { return -1; }
});

const before = loopErrs.length;
const r = await page.evaluate(async () => {
  const out = {};
  player.cls = 'mage'; player.job = 'archmage'; player.master = 'elementalist';
  player.level = 80; player.mp = player.maxMp = 9999; player._god = true;
  for (const k in (player.skillCooldowns || {})) player.skillCooldowns[k] = 0;
  game.monsters = [];
  spawnMonster(Math.round(player.x) + 160, player.y - 20, 'slime', false);
  const m = game.monsters[0];
  if (m) { m.hp = m.currentHp = 5e8; m.maxHp = 5e8; m.atk = 0; m.speed = 0; }
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 60) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  castSkill('elementalist_ult');
  // let the catastrophe fly; confirm a bspr projectile with DECODED art is live
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 20) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  const live = game.projectiles.filter((p) => p.bspr);
  out.bsprLive = live.length;
  out.artDecoded = live.some((p) => { try { return typeof LX_BULT_PROJ !== 'undefined' && _lxPlayerProjReady(LX_BULT_PROJ[p.bspr]); } catch (e) { return false; } });
  return out;
}, );
// a single sample can land on the cast flash or between projectiles - on the
// broken build EVERY frame with a live bspr projectile loses the player, so
// the MAX over the flight window is what discriminates
let sdDuring = -1;
for (let i = 0; i < 12; i++) {
  const live = await page.evaluate(() => game.projectiles.some((pp) => pp.bspr));
  if (live) sdDuring = Math.max(sdDuring, await heroSd());
  await page.evaluate(() => new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 6) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); }));
}
await page.evaluate(() => new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 180) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); }));
const thrown = loopErrs.length - before;

const g2before = loopErrs.length;
await page.evaluate(async () => {
  player.skillCooldowns.elementalist_cascade = 0;
  castSkill('elementalist_cascade');
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 150) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
});
const gThrown = loopErrs.length - g2before;

ok('the catastrophe is airborne with its dedicated art decoded (premise)',
  r.bsprLive >= 1 && r.artDecoded, r);
ok('no frame throws while the catastrophe is on screen - the v0.30.252 TDZ',
  thrown === 0, { caughtLoopErrors: thrown, first: loopErrs[before] || '',
    note: 'the watchdog eats the throw, so the only visible symptom was the player and all fx vanishing' });
ok('the PLAYER is still painted mid-catastrophe - the symptom in the video',
  sdDuring > 12, { chestPixelSd: +(+sdDuring).toFixed(1), note: 'flat water reads < 8; a drawn hero > 25' });
ok('Prismatic Cascade (G) also completes every frame', gThrown === 0, { caughtLoopErrors: gThrown });
ok('no uncaught page errors', errs.length === 0, { errs: errs.slice(0, 3) });

await b.close(); srv.kill();
let pass = 0;
for (const t of results) {
  console.log((t.pass ? '  PASS  ' : '  FAIL  ') + t.n);
  if (!t.pass) console.log('        ' + JSON.stringify(t.x));
  if (t.pass) pass++;
}
console.log('\n' + pass + '/' + results.length + ' checks passed');
process.exit(pass === results.length ? 0 : 1);
