// Live test: THE CYCLE COMPLETES — the Guguma rebirth cutscene. Verifies the
// kill-chain wiring (defeat cine → rebirth cine → epilogue), the epilogue
// stanzas carrying the reveal in text, the real clip playing in the overlay,
// skip, and the fail-open path (clip blocked → straight through, no soft-lock).
//   node scripts/guguma_rebirth_test.mjs [port]
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
const ctx1 = await b.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx1.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof _gugumaRebirthCutscene === 'function' || typeof drawSuperBossBar === 'function',
  null, { timeout: 120000 });

const r = await page.evaluate(() => {
  const out = {};
  out.fnExists = typeof _gugumaRebirthCutscene === 'function';
  const km = String(typeof triggerSuperBossDeath === 'function' ? triggerSuperBossDeath : '');
  out.chainWired = km.includes('_afterDefeatCine') && km.includes('_gugumaRebirthCutscene');
  const ep = (typeof STORY_BEATS !== 'undefined') && STORY_BEATS.epilogue_gravitos;
  const joined = ep ? ep.stanzas.map(s => typeof s.text === 'function' ? '' : s.text).join('\n') : '';
  out.stanzas = ep ? ep.stanzas.length : 0;
  // The TEXT reveal is the parallel line of work (v0.29.962, "small. Golden.
  // Feathered." / "THE KINDEST HAND"); the cutscene must not duplicate it —
  // the clip shows the event, those stanzas then name it. Assert both: the
  // reveal exists in text (fail-open story cover) and appears only once.
  out.revealInText = /Feathered/.test(joined) && /KINDEST HAND/.test(joined);
  out.noDuplicateReveal = !/It was an egg/.test(joined) && !/cycle is complete/.test(joined);
  return out;
});
ok('the rebirth cutscene helper exists', r.fnExists, '');
ok('kill chain: defeat cine hands off to the rebirth cine (fail-open wrapped)', r.chainWired, '');
ok('epilogue carries the text reveal exactly once (v0.29.962 stanzas, no cutscene duplicate)',
  r.stanzas >= 5 && r.revealInText && r.noDuplicateReveal, { stanzas: r.stanzas });

// live path: drive the cutscene with the real clip, then skip. Settle the
// page first — in real play this fires at ENDGAME on a long-loaded page;
// driving it mid-boot hits Chrome's deferred-media state instead (the fetch
// parks behind the asset stream), which is the guard's job, not this check's.
await page.waitForLoadState('load', { timeout: 120000 }).catch(() => {});
await page.waitForTimeout(3000);
const live = await page.evaluate(() => new Promise((resolve) => {
  const out = { doneFired: false };
  const t0 = performance.now();
  _gugumaRebirthCutscene(() => { out.doneFired = true; out.doneAt = Math.round(performance.now() - t0); });
  const ov = document.getElementById('guguma-rebirth-cine');
  out.overlay = !!ov;
  const vid = ov && ov.querySelector('#gug-reb-vid');
  out.srcRight = !!(vid && /clip_gravitos_to_guguma\.mp4$/.test(vid.src));
  const poll = setInterval(() => {
    if (vid && !vid.paused && vid.currentTime > 0.05) {
      clearInterval(poll);
      out.played = true;
      const sk = ov.querySelector('#gug-reb-skip'); if (sk) sk.click();
      setTimeout(() => { out.overlayGone = !document.getElementById('guguma-rebirth-cine'); resolve(out); }, 300);
    }
  }, 100);
  setTimeout(() => { clearInterval(poll); out.played = out.played || false; resolve(out); }, 15000);
}));
ok('overlay mounts with the clip wired', live.overlay && live.srcRight, live);
ok('the real clip actually PLAYS (currentTime advances)', live.played === true, live);
ok('skip fires onDone and removes the overlay', live.doneFired && live.overlayGone, live);

// fail-open path: block the clip, the ending must fall straight through
const ctx2 = await b.newContext({ viewport: { width: 1280, height: 720 } });
const page2 = await ctx2.newPage();
await page2.route('**/clip_gravitos_to_guguma.mp4', route => route.abort());
await page2.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page2.waitForFunction(() => typeof _gugumaRebirthCutscene === 'function', null, { timeout: 120000 });
const fo = await page2.evaluate(() => new Promise((resolve) => {
  const t0 = performance.now();
  _gugumaRebirthCutscene(() => resolve({ done: true, ms: Math.round(performance.now() - t0), overlayGone: !document.getElementById('guguma-rebirth-cine') }));
  setTimeout(() => resolve({ done: false, ms: 9000 }), 9000);
}));
ok('FAIL-OPEN: blocked clip falls through to the epilogue without a soft-lock', fo.done && fo.ms < 6000, fo);
ok('...and cleans its overlay up', fo.overlayGone !== false, fo);
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
