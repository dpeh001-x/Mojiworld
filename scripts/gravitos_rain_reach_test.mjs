// Gravitos' COLLAPSE RAIN: every one-hit-KO box must be a shelter the player can see and reach.
//
// Per user: "ensure that there are safe portals when gravitos does his OHKO my tester played it and
// there seemed to have no safe portals". A rain box lives 84 frames (1.4 s) and was rolled anywhere
// across the 2200 px arena while the screen shows 960 of it - so most boxes landed off-screen, far past
// what the player can run in 1.4 s, and the player saw the veil and the countdown with no portal at all.
//
// Stands the player at both ends, between, and at the centre; forces rain boxes through the real
// collapseRain handler; checks each box is on screen, within reach at the player's own speed, and - for a
// mid-band box - on the centre platform. Also checks the alternation still produces mid-band boxes when
// the platform is in reach, so the rain keeps asking for a climb.
//   node scripts/gravitos_rain_reach_test.mjs [candidate.html]      (run from the tree root; PORT env)
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '9641';
const env = { ...process.env }; if (process.argv[2]) env.MOJI_GAME_FILE = process.argv[2]; else delete env.MOJI_GAME_FILE;
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log('  PASS  ' + m); } else { fail++; console.log('  FAIL  ' + m + (x !== undefined ? '  <- ' + x : '')); } };
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof getSpeed === 'function', null, { timeout: 120000 });
await page.evaluate(() => {
  for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) o.style.display = 'none'; }
  window._lxBootGateDone = true; window._prologueActive = false;
  player.level = 100; player.cls = 'warrior'; player.invulnerable = 9e9; player.hp = player.maxHp = 99999; player._god = true;
  loadMap('gravitosArena'); game.paused = false;
});
await page.waitForFunction(() => game.monsters.some((m) => m && m.type === 'gravitos' && m.currentHp > 0), null, { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(9000);

const r = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
  const clearOverlays = () => {
    for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
    const bi = document.getElementById('boss-intro'); if (bi) bi.style.display = 'none';
    game.paused = false;
  };
  clearOverlays();
  const m = game.monsters.find((x) => x && x.type === 'gravitos' && x.currentHp > 0);
  if (!m) return { err: 'no gravitos' };
  const SAFE_LIFE = 84, GROUND = 480;
  const out = { version: GAME_VERSION, W, ww: game.mapData.worldWidth, speed: getSpeed(), boxes: [] };
  let pinX = null;
  const pin = () => { if (pinX == null) return; player.x = pinX; player.y = GROUND - player.h; player.vx = 0; player.vy = 0; requestAnimationFrame(pin); };
  for (const standX of [120, 560, 1100, 1650, 2060]) {
    pinX = standX - player.w / 2; pin();
    await sleep(700);   // camera settles on the player
    for (let k = 0; k < 6; k++) {
      clearOverlays();
      game.hazards = game.hazards.filter((h) => h.type !== 'gravitos_singularity');
      m.patternState = 'collapseRain'; m._rainIdx = 0; m._rainBand0 = k % 2; m.patternTimer = 0; m._ohkoWarnUntil = null;
      let hz = null;
      for (let t = 0; t < 40 && !hz; t++) { await sleep(16); hz = game.hazards.find((h) => h.type === 'gravitos_singularity'); if (!hz && m.patternState !== 'collapseRain') { m.patternState = 'collapseRain'; m._rainIdx = 0; m.patternTimer = 0; } }
      if (!hz) { out.boxes.push({ standX, err: 'no box' }); continue; }
      const z = hz.safeZones[0], camX = game.camera.x, pcx = player.x + player.w / 2;
      out.boxes.push({ standX, band: (z.y + z.h === GROUND) ? 'ground' : 'mid', x: Math.round(z.x), w: z.w,
        camX: Math.round(camX), onScreen: z.x >= camX - 1 && z.x + z.w <= camX + W + 1,
        dist: Math.round(Math.abs(z.x + z.w / 2 - pcx)), wantMid: (k % 2) === 1 });
    }
  }
  pinX = null;
  game.hazards = game.hazards.filter((h) => h.type !== 'gravitos_singularity');
  m.patternState = 'idle'; m.patternTimer = 0; m._rainIdx = 0;
  return out;
});
if (r.err) { console.log('probe error: ' + r.err); process.exit(2); }
const reach = Math.max(110, Math.min(360, r.speed * (84 - 18) * 0.85));
const PAD_SLACK = 130;   // _lxSafeZoneOffPad may step a box clear of a launch pad
console.log(`\n  build ${r.version} · world ${r.ww} · view ${r.W} · warrior speed ${r.speed.toFixed(2)} px/frame · reach ${Math.round(reach)} px (+${PAD_SLACK} pad slack)`);
for (const b of r.boxes) console.log('   stand ' + String(b.standX).padEnd(5) + (b.err || `${b.band.padEnd(6)} box x ${String(b.x).padEnd(5)} cam ${String(b.camX).padEnd(5)} ${b.onScreen ? 'on-screen ' : 'OFF-SCREEN'} dist ${b.dist}`));
const boxes = r.boxes.filter((b) => !b.err);
ok(boxes.length === r.boxes.length && boxes.length >= 25, 'every forced rain tick spawned its box', r.boxes.length - boxes.length + ' missing');
const off = boxes.filter((b) => !b.onScreen);
ok(off.length === 0, 'every rain box is on screen when it appears', off.length + '/' + boxes.length + ' off-screen');
const far = boxes.filter((b) => b.dist > reach + PAD_SLACK);
ok(far.length === 0, 'every rain box is within reach at the player\'s own speed', far.length + '/' + boxes.length + ' too far (worst ' + Math.max(0, ...boxes.map((b) => b.dist)) + ' px)');
const mids = boxes.filter((b) => b.band === 'mid');
ok(mids.every((b) => b.x >= 900 && b.x + b.w <= 1300), 'a mid-band box stands on the centre platform', mids.map((b) => b.x).join(','));
const centreMids = boxes.filter((b) => b.standX === 1100 && b.wantMid && b.band === 'mid');
ok(centreMids.length >= 2, 'the rain still asks for the climb when the platform is in reach', centreMids.length + ' mid-band boxes from the centre');
ok(errs.length === 0, 'no page errors', errs.join(' | '));
await browser.close().catch(() => {}); srv.kill();
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
