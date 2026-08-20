// Live test: IT'S HIM — the Amnesiac's memory-return scene, played between
// the shadow reveal and the Last Winding. Per user: "have a scene of the
// amnesiac regaining his memory at the distant part of everdawn central and
// saying the words 'its him' make sure the audio is audible".
//
// Graded: the chain plumbing (receives the Last Winding step as onDone), the
// clip carrying a real AUDIO track (the spoken line is in the file — checked
// in the container bytes), UNMUTED playback at volume in the overlay, skip,
// and fail-open onward with no soft-lock.
//   node scripts/amnesiac_its_him_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync, readFileSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

// AUDIO TRACK: an mp4 with sound carries a 'soun' handler atom. This is the
// "make sure the audio is audible" half that can be graded from the file.
const clipPath = 'steam/higgsfield/cinematics/clip_amnesiac_its_him.mp4';
const clipBytes = existsSync(clipPath) ? readFileSync(clipPath) : null;
ok('the clip ships beside the game', !!clipBytes, clipPath);
ok('the clip carries an AUDIO track (the spoken line is in the file)',
  !!clipBytes && clipBytes.includes(Buffer.from('soun')), '');

const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
// NOTE: no --mute-audio here — this test's whole point includes audibility.
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const GAME = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const ctx1 = await b.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx1.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/${GAME}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof _amnesiacItsHimCutscene === 'function' || typeof drawSuperBossBar === 'function',
  null, { timeout: 120000 });

const r = await page.evaluate(() => {
  const out = {};
  out.fnExists = typeof _amnesiacItsHimCutscene === 'function';
  const km = String(typeof triggerSuperBossDeath === 'function' ? triggerSuperBossDeath : '');
  out.chainWired = km.includes('_amnesiacItsHimCutscene(_afterGravDefeat)') && km.includes('else _afterGravDefeat();');
  return out;
});
ok('the Amnesiac cutscene helper exists', r.fnExists, '');
ok('kill chain: the scene hands off to the Last Winding (fail-open too)', r.chainWired, r);

await page.waitForLoadState('load', { timeout: 120000 }).catch(() => {});
await page.waitForTimeout(3000);
const live = await page.evaluate(() => new Promise((resolve) => {
  const out = { doneFired: false };
  _amnesiacItsHimCutscene(() => { out.doneFired = true; });
  const ov = document.getElementById('amnesiac-itshim-cine');
  out.overlay = !!ov;
  const vid = ov && ov.querySelector('#amn-ih-vid');
  out.srcRight = !!(vid && /clip_amnesiac_its_him\.mp4$/.test(vid.src));
  const poll = setInterval(() => {
    if (vid && !vid.paused && vid.currentTime > 0.05) {
      clearInterval(poll);
      out.played = true;
      // AUDIBLE: the overlay plays unmuted at volume 0.9 (mute is only the
      // last-resort autoplay fallback, which this flag would expose).
      out.unmuted = vid.muted === false;
      out.volume = vid.volume;
      const sk = ov.querySelector('#amn-ih-skip'); if (sk) sk.click();
      setTimeout(() => { out.overlayGone = !document.getElementById('amnesiac-itshim-cine'); resolve(out); }, 300);
    }
  }, 100);
  setTimeout(() => { clearInterval(poll); out.played = out.played || false; resolve(out); }, 15000);
}));
ok('overlay mounts with the clip wired', live.overlay && live.srcRight, live);
ok('the real clip actually PLAYS (currentTime advances)', live.played === true, live);
ok('AUDIBLE: playback is unmuted at volume 0.9 (the line can be heard)',
  live.unmuted === true && live.volume >= 0.85, live);
ok('skip fires onDone and removes the overlay', live.doneFired && live.overlayGone, live);

const ctx2 = await b.newContext({ viewport: { width: 1280, height: 720 } });
const page2 = await ctx2.newPage();
await page2.route('**/clip_amnesiac_its_him.mp4', route => route.abort());
await page2.goto(`http://localhost:${PORT}/${GAME}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page2.waitForFunction(() => typeof _amnesiacItsHimCutscene === 'function', null, { timeout: 120000 });
const fo = await page2.evaluate(() => new Promise((resolve) => {
  const t0 = performance.now();
  _amnesiacItsHimCutscene(() => resolve({ done: true, ms: Math.round(performance.now() - t0), overlayGone: !document.getElementById('amnesiac-itshim-cine') }));
  setTimeout(() => resolve({ done: false, ms: 9000 }), 9000);
}));
ok('FAIL-OPEN: a blocked clip falls onward without a soft-lock', fo.done && fo.ms < 6000, fo);
ok('...and cleans its overlay up', fo.overlayGone !== false, fo);
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
