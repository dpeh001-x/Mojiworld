// Live test: A MERE SHADOW — the mastermind-reveal cutscene that continues
// clip_gravitos_defeat_dragonknight. Per user: "from the
// clip_gravitos_defeat_dragonknight should extend and continue to reveal that
// guguma was the mastermind of moji world and that gravitos is a mere shadow
// of it".
//
// Chain contract: defeat cine → SHADOW REVEAL → rebirth → the Last Winding.
// Graded here: the wiring order, real playback in the overlay, skip, and the
// fail-open path (blocked clip → straight to the rebirth, no soft-lock).
//   node scripts/gravitos_shadow_reveal_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
const GAME = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const ctx1 = await b.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx1.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/${GAME}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof _gravitosShadowRevealCutscene === 'function' || typeof drawSuperBossBar === 'function',
  null, { timeout: 120000 });

const r = await page.evaluate(() => {
  const out = {};
  out.fnExists = typeof _gravitosShadowRevealCutscene === 'function';
  const km = String(typeof triggerSuperBossDeath === 'function' ? triggerSuperBossDeath : '');
  // ORDER is proven by the callback plumbing itself: the shadow reveal
  // receives the Amnesiac continuation (_toAmnesiac) as its onDone, so it can
  // only ever run BEFORE the "It's him" scene — and its fail-open exits into
  // it too. (v2 of this chain: the rebirth clip was removed entirely per
  // user; the shadow used to hand to _toRebirth.)
  out.chainWired = km.includes('_gravitosShadowRevealCutscene(_toAmnesiac)');
  out.failOpenToRebirth = km.includes('else _toAmnesiac();');
  return out;
});
ok('the shadow-reveal cutscene helper exists', r.fnExists, '');
ok('kill chain: the reveal hands off to the Amnesiac scene (fail-open too)', r.chainWired && r.failOpenToRebirth, r);

// live: real clip, real playback, skip.
await page.waitForLoadState('load', { timeout: 120000 }).catch(() => {});
await page.waitForTimeout(3000);
const live = await page.evaluate(() => new Promise((resolve) => {
  const out = { doneFired: false };
  _gravitosShadowRevealCutscene(() => { out.doneFired = true; });
  const ov = document.getElementById('gravitos-shadow-cine');
  out.overlay = !!ov;
  const vid = ov && ov.querySelector('#grav-shd-vid');
  out.srcRight = !!(vid && /clip_gravitos_shadow_reveal\.mp4$/.test(vid.src));
  const poll = setInterval(() => {
    if (vid && !vid.paused && vid.currentTime > 0.05) {
      clearInterval(poll);
      out.played = true;
      const sk = ov.querySelector('#grav-shd-skip'); if (sk) sk.click();
      setTimeout(() => { out.overlayGone = !document.getElementById('gravitos-shadow-cine'); resolve(out); }, 300);
    }
  }, 100);
  setTimeout(() => { clearInterval(poll); out.played = out.played || false; resolve(out); }, 15000);
}));
ok('overlay mounts with the clip wired', live.overlay && live.srcRight, live);
ok('the real clip actually PLAYS (currentTime advances)', live.played === true, live);
ok('skip fires onDone and removes the overlay', live.doneFired && live.overlayGone, live);

// fail-open: blocked clip → straight through to the rebirth handoff, fast.
const ctx2 = await b.newContext({ viewport: { width: 1280, height: 720 } });
const page2 = await ctx2.newPage();
await page2.route('**/clip_gravitos_shadow_reveal.mp4', route => route.abort());
await page2.goto(`http://localhost:${PORT}/${GAME}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page2.waitForFunction(() => typeof _gravitosShadowRevealCutscene === 'function', null, { timeout: 120000 });
const fo = await page2.evaluate(() => new Promise((resolve) => {
  const t0 = performance.now();
  _gravitosShadowRevealCutscene(() => resolve({ done: true, ms: Math.round(performance.now() - t0), overlayGone: !document.getElementById('gravitos-shadow-cine') }));
  setTimeout(() => resolve({ done: false, ms: 9000 }), 9000);
}));
ok('FAIL-OPEN: a blocked clip falls through to the rebirth without a soft-lock', fo.done && fo.ms < 6000, fo);
ok('...and cleans its overlay up', fo.overlayGone !== false, fo);
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
