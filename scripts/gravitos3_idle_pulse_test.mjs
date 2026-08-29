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
import { existsSync } from 'node:fs';
import net_ from 'node:net';
import { spawn } from 'node:child_process';
import { headBody } from './gravitos3_headbody_fs.mjs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const spread = (a) => Math.max(...a) / Math.min(...a);

// ---- measured off the files, wings and flames excluded ----
const idle = [], wings = [];
for (let i = 0; i < 9; i++) {
  const m = await headBody(`Sprites/bosses/idle/gravitos3_${i}.webp`);
  idle.push(m.h); wings.push(m.wingSpan);
}

// ---- the scale the engine would apply, read from the engine ----
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8771; p <= 8899 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
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

ok('the idle calib carries a per-frame scale', Array.isArray(r.idle.fs) && r.idle.fs.length === 9,
  { fs: r.idle.fs, s: r.idle.s });
ok('the DRAWN head and body no longer pulses',
  spread(drawn) < 1.005,
  { beforePx: idle, drawnSpread: spread(drawn).toFixed(4) + 'x',
    wasSpread: spread(idle).toFixed(3) + 'x',
    note: 'head+body = opaque AND dark (excludes the lava veins and flame crest), inside a 40% central band (excludes the wings)' });
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
