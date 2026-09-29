// Live test: GRAVITOS-3 STANDS STILL WHEN HE IS STANDING STILL.
//
// Per user: "Gravitos3 idle sprite pulsates ... gravitos3 has wings so that can
// affect the size calibration, the calibration should be based on the head and
// body".
//
// The second sentence is the fix. Gravitos is in _BOSS_SIZE_STRICT, so the
// engine rescales each frame to put its CONTENT height on a reference - and
// content is the whole silhouette, wings and flame crest included. On the idle
// set the content height is FLAT (902 px on all nine), so the normalisation is a
// no-op and the head/body variation inside that constant box reaches the screen
// untouched. Levelling has to key on the head and body instead, which is what
// the baked fs[] does.
//
// This test multiplies the measured head+body height by the scale the ENGINE
// would actually apply to that frame (calib s x fs[i]), so it measures the
// drawn titan rather than the file on disk.
//   node scripts/gravitos3_idle_pulse_test.mjs [port]
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import net_ from 'node:net';
import { spawn } from 'node:child_process';
import { headBody } from './gravitos3_headbody_fs.mjs';
// v0.30.1449 - head+body = his chest core's height above his feet (the pop-style art inks his flames and wing bones as black as his armour, so dark-pixel extents follow the wings; the core is the
// brightest thing on him and the idle has no effects to compete with it). headBody() still supplies the wing span.
const coreUp = async (f) => { const { data: d, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); const W = info.width, H = info.height;
  let sx = 0, n = 0; for (let y = Math.round(H * 0.6); y < H; y++) for (let x = 0; x < W; x++) { const o = (y * W + x) * 4; if (d[o + 3] > 200 && Math.max(d[o], d[o + 1], d[o + 2]) < 80) { sx += x; n++; } }
  const cx = sx / n; let feet = -1; for (let y = H - 1; y >= 0 && feet < 0; y--) for (let x = Math.round(cx - 0.18 * H); x < cx + 0.18 * H; x++) { const o = (y * W + x) * 4; if (d[o + 3] > 200 && Math.max(d[o], d[o + 1], d[o + 2]) < 80) { feet = y; break; } }
  const px = []; for (let y = Math.round(H * 0.3); y < Math.round(H * 0.75); y++) for (let x = Math.round(cx - 0.12 * H); x < cx + 0.12 * H; x++) { const o = (y * W + x) * 4; if (d[o + 3] >= 200) px.push([0.3 * d[o] + 0.59 * d[o + 1] + 0.11 * d[o + 2], y]); }
  px.sort((a, b) => b[0] - a[0]); const top = px.slice(0, 60); return feet - top.reduce((a, p) => a + p[1], 0) / top.length; };
// tests-ports: PORT / MOJI_GAME_FILE from the environment (scripts/apply_tests_ports.mjs); unset = the old defaults
const FILE = process.env.MOJI_GAME_FILE ? process.env.MOJI_GAME_FILE.split(/[\\/]/).pop() : 'mojiworld_game.html';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const spread = (a) => Math.max(...a) / Math.min(...a);

// ---- measured off the files, wings and flames excluded ----
const idle = [], wings = [];
for (let i = 0; i < 9; i++) {
  const m = await headBody(`Sprites/bosses/idle/gravitos3_${i}.webp`);
  idle.push(await coreUp(`Sprites/bosses/idle/gravitos3_${i}.webp`)); wings.push(m.wingSpan);
}

// ---- the scale the engine would apply, read from the engine ----
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2] || process.env.PORT;
for (let p = 8771; p <= 8899 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof _lxAnimCalib === 'function', null, { timeout: 120000 });

const r = await page.evaluate(() => {
  const out = {};
  for (const st of ['idle', 'walk', 'attack']) {
    const c = _lxAnimCalib('gravitos3', st);
    out[st] = { s: c.s, fs: Array.isArray(c.fs) ? c.fs.slice() : null };
  }
  // the hitbox must NOT inherit the per-frame pulse
  out.hitboxUsesFs = /per-frame fs/.test(String(typeof _drawBossSprite === 'function' ? _drawBossSprite : ''));
  return out;
});
await b.close(); srv.kill();

const drawn = idle.map((h, i) => h * r.idle.s * ((r.idle.fs && r.idle.fs[i]) || 1));

// d3038e7d (2026-08-29, same day) - Gravitos-3's idle was REDRAWN (7 of 9 frames) with the pulse fixed in the art: new art, no fs
// 1.010x; the fs baked from the old frames made it 1.044x, so it was deleted rather than recomputed. The pulse is now guarded
// on the drawn titan (the old pulse was 1.055x) and on the calib staying free of a stale per-frame table.
ok('the idle calib carries NO per-frame scale (d3038e7d: the redrawn art is level on its own; a stale fs fights it)', !r.idle.fs,
  { fs: r.idle.fs, s: r.idle.s });
ok('the DRAWN head and body no longer pulses (v0.30.1449 re-animation 1.015x; the pulse was 1.055x)',
  spread(drawn) < 1.02,
  { beforePx: idle, drawnSpread: spread(drawn).toFixed(4) + 'x',
    wasSpread: spread(idle).toFixed(3) + 'x',
    note: 'head+body = the chest core\'s height above the feet (rigid; wings and flames cannot move it)' });
ok('...and the measure was right to ignore the wings',
  spread(wings) > spread(idle),
  { wingSpanSpread: spread(wings).toFixed(3) + 'x', headBodySpread: spread(idle).toFixed(3) + 'x',
    note: 'the wings move more than the titan does, so any content-height measure tracks the flap' });
ok('walk and attack are left alone - their size change is gait, not error',
  !r.walk.fs && !r.attack.fs,
  { walkFs: r.walk.fs, attackFs: r.attack.fs,
    note: 'levelling these would iron the bob out of the walk and the wind-up out of the swing' });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
process.exit(results.every(q => q.pass) ? 0 : 1);
