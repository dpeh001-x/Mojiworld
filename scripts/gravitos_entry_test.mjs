// GRAVITOS ENTRY - the "I still get stuck here" chain, end to end.
// =============================================================================
//   1. HAPPY PATH   POV clip -> entry clip -> manifesto beat -> clicks -> fight
//   2. THE FREEZE   loading overlay never fades -> the boot gate must SELF-OPEN
//                   (on the old build this parks the entire game forever)
// Run: node scripts/gravitos_entry_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9164;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });

// ── 1. happy path ───────────────────────────────────────────────────────────
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(9000);
  await page.evaluate(() => {
    for (const id of ['class-select-modal','advancement-modal','tutorial-modal'])
      { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    const lo = document.getElementById('loading-overlay');
    if (lo) lo.classList.add('fade');                 // legitimate boot reveal
    player.cls = player.cls || 'warrior'; player.level = 100; player.hp = 99999; player.maxHp = 99999;
    player._gravitosCineSeen = false; player._storyBeatsSeen = {};
    game.paused = false;
    loadMap('gravitosArena', 300);
  });
  // Poll rather than fixed-wait: the chain is ~16 s of video plus load
  // latency that varies run to run (a fixed 19 s beat once caught the entry
  // clip still on screen and failed a healthy chain).
  let mid = null;
  for (let w = 0; w < 40; w++) {
    await page.waitForTimeout(1000);
    mid = await page.evaluate(() => ({
      gate: !!window._lxBootGateDone,
      beatVisible: (() => { const sb = document.getElementById('story-beat-overlay'); return !!sb && sb.getClientRects().length > 0 && getComputedStyle(sb).display !== 'none'; })(),
      cineGone: !document.getElementById('gravitos-entry-cine') && !document.querySelector('video'),
    }));
    if (mid.cineGone && mid.beatVisible) break;
  }
  ok('both cinematics complete on their own', mid.cineGone);
  ok('the manifesto story beat is VISIBLE and owns the pause', mid.beatVisible,
     mid.beatVisible ? 'clickable' : 'invisible pause owner — the frozen state');
  let released = false;
  for (let i = 0; i < 10 && !released; i++) {
    await page.mouse.click(640, 400);
    await page.waitForTimeout(900);
    released = await page.evaluate(() => !game.paused &&
      !(document.getElementById('story-beat-overlay') || {}).getClientRects?.().length);
  }
  ok('clicking through the beat releases into the live fight', released, released ? '' : 'never unpaused');
  ok('no page errors on the happy path', errs.length === 0, errs.slice(0, 2).join(' | '));
  await page.close();
}

// ── 2. the freeze: overlay never fades ──────────────────────────────────────
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const warns = [];
  page.on('console', m => { if (/BootGate|StuckPause/.test(m.text())) warns.push(m.text().slice(0, 140)); });
  await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(9000);
  await page.evaluate(() => {
    for (const id of ['class-select-modal','advancement-modal','tutorial-modal'])
      { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    // simulate the missed reveal: hide the overlay visually but NEVER add
    // 'fade' — on the old build this parks the boot gate forever
    const lo = document.getElementById('loading-overlay');
    if (lo) { lo.style.display = 'none'; lo.classList.remove('fade'); }
    window._lxBootGateDone = false;                    // gate re-armed, as at boot
    player.cls = player.cls || 'warrior';
    game.paused = false;
    loadMap('forest', 300);
  });
  const t0 = await page.evaluate(() => game.time);
  await page.waitForTimeout(20000);                    // past the 15 s failsafe
  const st = await page.evaluate(() => ({ gate: !!window._lxBootGateDone, time: game.time }));
  ok('the boot gate self-opens after a missed fade (the actual freeze)',
     st.gate, st.gate ? `gate opened, warns: ${warns.filter(w => /BootGate/.test(w)).length}` : 'gate still parked — game frozen forever');
  ok('the simulation is running again after the failsafe', st.time > t0 + 60,
     `game.time ${t0} -> ${st.time}`);
  await page.close();
}

let pass = 0, failed = 0;
for (const r of res) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
console.log(`${pass} passed, ${failed} failed`);
await browser.close(); server.kill();
process.exit(failed ? 1 : 0);
