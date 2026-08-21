// Live test: THE LAST WINDING — the sad dark conclusion cutscene that REPLACES
// the six-stanza epilogue text after Gravitos falls. Per user: "instead of the
// load of chunk of text after defeating gravitos, scrap that and with the new
// guguma as gravitos juxtaposition, using higgsfield develop a new cutscene
// for a sad dark conclusion".
//
// The contract has two halves and both are graded:
//   PLAYED PATH — the clip carries the ending: onClip fires, the epilogue
//   stanzas are NEVER shown, and the beat is marked seen so repeat kills stay
//   quiet exactly as they did under the text version.
//   FALLBACK PATH — a blocked/missing clip falls to the OLD text (the stanzas
//   survive in that one place only), fast, with no soft-lock.
//   node scripts/the_last_winding_test.mjs [port]
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
await page.waitForFunction(() => typeof _gugumaToyboxCutscene === 'function' || typeof drawSuperBossBar === 'function',
  null, { timeout: 120000 });

const r = await page.evaluate(() => {
  const out = {};
  out.fnExists = typeof _gugumaToyboxCutscene === 'function';
  const km = String(typeof triggerSuperBossDeath === 'function' ? triggerSuperBossDeath : '');
  out.chainWired = km.includes('_gugumaToyboxCutscene') && km.includes('_epilogueText');
  // The played path must mark the beat seen (repeat-kill parity with the old
  // text) and the fallback must be the ONLY route into _playStoryBeat.
  out.marksSeen = km.includes('_storyBeatsSeen.epilogue_gravitos = true');
  out.textOnlyViaFallback = (km.match(/_playStoryBeat\('epilogue_gravitos'/g) || []).length === 1;
  // The stanzas survive as the fallback cover — scrapped from play, not erased.
  const ep = (typeof STORY_BEATS !== 'undefined') && STORY_BEATS.epilogue_gravitos;
  const joined = ep ? ep.stanzas.map(s => typeof s.text === 'function' ? '' : s.text).join('\n') : '';
  out.fallbackCover = ep && ep.stanzas.length >= 5 && /KINDEST HAND/.test(joined);
  return out;
});
ok('the Last Winding cutscene helper exists', r.fnExists, '');
ok('kill chain: the clip replaces the text, with the text as explicit fallback', r.chainWired, '');
ok('the played path marks the beat seen (repeat kills stay quiet, as before)', r.marksSeen, '');
ok('the stanzas are reachable ONLY through the fallback', r.textOnlyViaFallback, '');
ok('the fallback cover still carries the reveal in text', r.fallbackCover, '');

// PLAYED PATH: real clip, real playback; the epilogue must never appear.
await page.waitForLoadState('load', { timeout: 120000 }).catch(() => {});
await page.waitForTimeout(3000);
const live = await page.evaluate(() => new Promise((resolve) => {
  const out = { onClip: false, onFallback: false, beatCalls: 0 };
  const origBeat = window._playStoryBeat;
  window._playStoryBeat = function () { out.beatCalls++; return origBeat.apply(this, arguments); };
  _gugumaToyboxCutscene(
    () => { out.onClip = true; },
    () => { out.onFallback = true; });
  const ov = document.getElementById('guguma-toybox-cine');
  out.overlay = !!ov;
  const vid = ov && ov.querySelector('#gug-toy-vid');
  out.srcRight = !!(vid && /clip_the_last_winding\.mp4$/.test(vid.src));
  const poll = setInterval(() => {
    if (vid && !vid.paused && vid.currentTime > 0.05) {
      clearInterval(poll);
      out.played = true;
      const sk = ov.querySelector('#gug-toy-skip'); if (sk) sk.click();
      setTimeout(() => {
        out.overlayGone = !document.getElementById('guguma-toybox-cine');
        window._playStoryBeat = origBeat;
        resolve(out);
      }, 300);
    }
  }, 100);
  setTimeout(() => { clearInterval(poll); window._playStoryBeat = origBeat; resolve(out); }, 15000);
}));
ok('overlay mounts with the new clip wired', live.overlay && live.srcRight, live);
ok('the real clip actually PLAYS (currentTime advances)', live.played === true, live);
ok('skip resolves via the CLIP exit and removes the overlay', live.onClip && live.overlayGone, live);
ok('THE SCRAP: the epilogue text never appears on the played path', live.onFallback === false && live.beatCalls === 0, live);

// FALLBACK PATH: blocked clip → the old text, fast.
const ctx2 = await b.newContext({ viewport: { width: 1280, height: 720 } });
const page2 = await ctx2.newPage();
await page2.route('**/clip_the_last_winding.mp4', route => route.abort());
await page2.goto(`http://localhost:${PORT}/${GAME}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page2.waitForFunction(() => typeof _gugumaToyboxCutscene === 'function', null, { timeout: 120000 });
const fo = await page2.evaluate(() => new Promise((resolve) => {
  const t0 = performance.now();
  _gugumaToyboxCutscene(
    () => resolve({ exit: 'clip', ms: Math.round(performance.now() - t0) }),
    () => resolve({ exit: 'fallback', ms: Math.round(performance.now() - t0), overlayGone: !document.getElementById('guguma-toybox-cine') }));
  setTimeout(() => resolve({ exit: 'none', ms: 9000 }), 9000);
}));
ok('FAIL-OPEN: a blocked clip exits via the TEXT fallback, fast, no soft-lock',
  fo.exit === 'fallback' && fo.ms < 6000, fo);
ok('...and cleans its overlay up', fo.overlayGone !== false, fo);
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
