#!/usr/bin/env node
// The death screen in dark pop, and its pop punk stone. Per user, over several rounds: "perhaps can just implement
// the dark pop designs at the buttons and the boxes", "the rest can try to make the design harmonize", then a new
// tombstone - twilight slate, a black R.I.P. with no drips, a checkerboard daisy, and "Remove the yellow outline
// behind the tombstone change to black".
//
// What is checked is what the look promises and what the layout must keep: the black faces and taxi-yellow
// lettering (computed, not grepped), the new stone actually served and decoded, its offset black rather than
// yellow, and the Respawn button - with its hard offset - still clear of the bottom letterbox bar at 720p, 1080p
// and a phone held sideways (the heavier boxes once pushed it into the bar at 1080p).
//   node scripts/death_pop_test.mjs      MOJI_GAME_FILE / PORT
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 10493);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errs = []; const seen = {};
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
page.on('response', (r) => { if (r.url().includes('death_tombstone_pop')) seen.tomb = r.status(); });
const INK = 'rgb(12, 11, 16)', YEL = 'rgb(255, 228, 92)';
const geom = () => page.evaluate(() => {
  const ov = document.getElementById('death-overlay'), b = document.getElementById('death-respawn-btn').getBoundingClientRect(), bar = ov.querySelector('.death-bar.bot').getBoundingClientRect();
  return { btn: Math.round(b.bottom), bar: Math.round(bar.top) };
});
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof player === 'object', null, { timeout: 180000 });
  await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    loadMap('forest', 300); await sleep(2200);
    for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
    game.paused = false; game.monsters.length = 0;
    player.mojicoins = 7520; player.exp = 26000; player._lastDamageSource = 'Shardlich';
    player._god = false; player.invulnerable = 0; player.hp = 0;
    const ov = document.getElementById('death-overlay');
    for (let i = 0; i < 150 && !ov.classList.contains('on'); i++) await sleep(100);
    const o = { shown: ov.classList.contains('on') };
    await sleep(2500);
    game.paused = true;                              // hold the 6 s stuck-dying watchdog while the layout is read
    const cs = (el) => getComputedStyle(el);
    const btn = cs(document.getElementById('death-respawn-btn'));
    o.btn = { bg: btn.backgroundColor, fg: btn.color, font: btn.fontFamily, tt: btn.textTransform, filter: btn.filter };
    o.plates = [...ov.querySelectorAll('.toll-plate')].map((p) => ({ bg: cs(p).backgroundColor, n: cs(p.querySelector('.n')).color, filter: cs(p).filter }));
    const t = cs(ov.querySelector('.title'));
    o.title = { fill: t.webkitTextFillColor, stroke: t.webkitTextStrokeColor, font: t.fontFamily };
    const chip = ov.querySelector('.death-slain b');
    o.chip = chip ? { bg: cs(chip).backgroundColor, fg: cs(chip).color } : null;
    const tomb = ov.querySelector('.death-tomb');
    for (let i = 0; i < 50 && !(tomb.complete && tomb.naturalWidth); i++) await sleep(100);
    const tr = tomb.getBoundingClientRect();
    o.tomb = { src: tomb.getAttribute('src'), nat: tomb.naturalWidth, w: Math.round(tr.width), h: Math.round(tr.height), filter: cs(tomb).filter };
    o.glow = getComputedStyle(ov.querySelector('.death-mark'), '::after').display;
    return o;
  });
  ok('the overlay opens on death', r.shown === true);
  ok('Respawn is a black face with taxi-yellow Nunito lettering', r.btn.bg === INK && r.btn.fg === YEL && /nunito/i.test(r.btn.font), `${r.btn.bg} / ${r.btn.fg} / ${r.btn.font.slice(0, 20)}`);
  ok('...on a hard yellow offset, in its own case (uppercase turned the "(5s)" countdown into "55")', /drop-shadow/.test(r.btn.filter) && r.btn.filter.includes(YEL) && r.btn.tt === 'none', r.btn.tt);
  ok('the toll boxes are black with yellow figures on a yellow offset', r.plates.length > 0 && r.plates.every((p) => p.bg === INK && p.n === YEL && p.filter.includes(YEL)), r.plates.length + ' plates');
  ok('OOPS! is yellow Nunito in an ink outline', r.title.fill === YEL && r.title.stroke === INK && /nunito/i.test(r.title.font), `${r.title.fill} / ${r.title.stroke}`);
  ok('the killer\'s name sits on a yellow chip with ink letters', r.chip && r.chip.bg === YEL && r.chip.fg === INK, r.chip && r.chip.bg);
  ok('the stone is the new pop punk art, served and decoded', /death_tombstone_pop\.webp$/.test(r.tomb.src) && seen.tomb === 200 && r.tomb.nat > 0, `HTTP ${seen.tomb}, ${r.tomb.nat}px wide`);
  ok('...shown at a readable size, taller than wide', r.tomb.h >= 90 && r.tomb.h <= 140 && r.tomb.w < r.tomb.h, `${r.tomb.w}x${r.tomb.h}`);
  ok('...on a black offset, not a yellow one (per user)', r.tomb.filter.includes(INK) && !r.tomb.filter.includes(YEL), r.tomb.filter.slice(0, 60));
  ok('the old violet ground-glow under the stone is gone (the grass is in the art)', r.glow === 'none', r.glow);
  for (const [w, h, name] of [[1280, 720, '720p'], [1920, 1080, '1080p'], [844, 390, 'a phone held sideways']]) {
    await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(500);
    const g = await geom();
    ok(`Respawn and its 5px offset clear the bottom bar at ${name}`, g.btn + 5 <= g.bar, `button ends ${g.btn}+5, bar starts ${g.bar}`);
  }
} catch (e) { ok('harness ran', false, e.message); }
if (errs.length) console.log('page errors: ' + errs.join(' | '));
console.log(`\n${pass}/${pass + fail} checks passed`);
await browser.close(); server.kill();
process.exit(fail ? 1 : 0);
