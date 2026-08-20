// Live test: the Guguma rebirth cutscene is RETIRED from the ending chain.
// Per user (v0.29.977 chain rework): "clip_gravitos_to_guguma should not play
// at all" — the ending now runs defeat → A Mere Shadow → the Amnesiac's
// "It's him" → The Last Winding. This file used to assert the rebirth PLAYED;
// it now asserts the inverse, which is just as easy to regress by accident:
// a future chain edit that re-adds the call, or a stray _playStoryBeat
// pointing at it, puts a scrapped scene back into the ending.
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
const GAME = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/${GAME}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof triggerSuperBossDeath === 'function', null, { timeout: 120000 });

const r = await page.evaluate(() => {
  const out = {};
  const km = String(triggerSuperBossDeath);
  // The function may exist (dead code is harmless; the clip could return),
  // but NOTHING in the kill chain may invoke it.
  out.chainDoesNotCallIt = !/_gugumaRebirthCutscene\s*\(/.test(km);
  // The chain that replaced it is present and ordered by its own plumbing.
  out.newChain = km.includes('_gravitosShadowRevealCutscene(_toAmnesiac)')
    && km.includes('_amnesiacItsHimCutscene(_afterGravDefeat)');
  // The epilogue stanzas survive as the Last Winding's fail-open cover.
  const ep = (typeof STORY_BEATS !== 'undefined') && STORY_BEATS.epilogue_gravitos;
  const joined = ep ? ep.stanzas.map(s => typeof s.text === 'function' ? '' : s.text).join('\n') : '';
  out.fallbackCover = ep && ep.stanzas.length >= 5 && /KINDEST HAND/.test(joined);
  return out;
});
ok('the kill chain never invokes the rebirth cutscene (clip does not play)', r.chainDoesNotCallIt, '');
ok('the replacement chain is wired: shadow reveal → Amnesiac → Last Winding', r.newChain, r);
ok('the epilogue stanzas survive as the fail-open cover', r.fallbackCover, '');
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
