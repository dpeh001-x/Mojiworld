// The introduction never buffers on camera, and the card never idles after.
// Per user: "Further improve on this as the introduction is the most
// important part."
//   1. sanctum warms BOTH cinematic clips for a player who hasn't seen them
//   2. the REAL first-entry chain buffers the entrance clip during the POV clip
//   3. the boss-intro card's unpause tail is short (was a flat 600 ms)
// Run: node scripts/intro_first_entry_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9226;
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

// ── 1+2: first-entry chain on a fresh page ──────────────────────────────────
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(9000);
  const out = await page.evaluate(async () => {
    const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade');
    for (const id of ['class-select-modal', 'advancement-modal', 'tutorial-modal'])
      { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'rogue'; player.level = 100; player.hp = 9e6; player.maxHp = 9e6;
    player._gravitosCineSeen = false;                    // the introduction is ahead
    game.paused = false;
    const clipFetches = [];
    const of = window.fetch.bind(window);
    window.fetch = (u, o) => {
      const url = String((u && u.url) || u || '');
      if (/cinematics\/clip_/.test(url)) clipFetches.push(url.split('/').pop());
      return of(u, o);
    };
    // walking into the antechamber should warm both clips
    loadMap('sanctum', 300);
    await new Promise(r => setTimeout(r, 700));
    const warmed = clipFetches.slice();
    // the real first entry: the entrance clip must be buffering during the POV
    loadMap('gravitosArena', 300);
    await new Promise(r => setTimeout(r, 1200));
    const pre = window._prologueEntryPreload;
    return {
      warmed,
      daggerUp: !!document.getElementById('prologue-dagger-cine'),
      preload: pre ? { isVideo: pre.tagName === 'VIDEO', src: (pre.src || '').split('/').pop() } : null,
    };
  });
  ok('the antechamber warms both introduction clips for a first-timer',
     out.warmed.includes('clip_prologue_pov.mp4') && out.warmed.includes('clip_gravitos_entry.mp4'),
     'warmed: ' + (out.warmed.join(', ') || 'nothing'));
  ok('the first-entry chain opens on the POV clip', out.daggerUp);
  ok('the entrance clip is buffering during the POV clip (frame-one handoff)',
     !!(out.preload && out.preload.isVideo && out.preload.src === 'clip_gravitos_entry.mp4'),
     out.preload ? JSON.stringify(out.preload) : 'no preload element on the real-entry chain');
  await page.close();
}

// ── 3: the card's unpause tail, measured on a re-entry ──────────────────────
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(9000);
  const out = await page.evaluate(async () => {
    const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade');
    for (const id of ['class-select-modal', 'advancement-modal', 'tutorial-modal'])
      { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'rogue'; player.level = 100; player.hp = 9e6; player.maxHp = 9e6;
    player._gravitosCineSeen = true;
    if (!player._storyBeatsSeen) player._storyBeatsSeen = {};
    player._storyBeatsSeen.gravitos_gate = true;
    game.paused = false;
    loadMap('gravitosArena', 300);
    let tClose = null, tUnpause = null;
    const t0 = performance.now();
    for (let i = 0; i < 400; i++) {                      // 20 s @ 50 ms
      await new Promise(r => setTimeout(r, 50));
      const ov = document.getElementById('boss-intro-overlay');
      const on = !!(ov && ov.classList.contains('on'));
      if (tClose == null && game.paused && !on && game._bossIntroShownAt) tClose = performance.now() - t0;
      if (tClose != null && !game.paused) { tUnpause = performance.now() - t0; break; }
    }
    return { tail: (tClose != null && tUnpause != null) ? Math.round(tUnpause - tClose) : null };
  });
  ok('the card-to-fight handoff is short (was a flat 600 ms of dead air)',
     out.tail != null && out.tail < 450, `tail: ${out.tail}ms`);
  await page.close();
}

let pass = 0, failed = 0;
for (const r of res) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
console.log(`${pass} passed, ${failed} failed`);
await browser.close(); server.kill();
process.exit(failed ? 1 : 0);
