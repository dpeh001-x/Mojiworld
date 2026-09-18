// SUMMON CAP — one notice per press-burst, not a column of them.
// ============================================================================
// Per user, with a screenshot of four stacked copies: "For beast master this
// notifications keep spamming about summon cap being reached".
//
// A capped cast is refunded by design (v0.26.1030), so no cooldown is consumed
// and nothing rate-limits repeat presses — every attempt raised its own toast,
// and the pack lasts 100s. showToast has no dedupe of any kind, so the fix is
// on the caller.
//
// The checks count DOM toasts, which is what the player actually sees, rather
// than counting calls to a helper — a helper that was throttled but still
// somehow emitted would pass a call-count assertion and fail the player.
// Run: node scripts/summon_cap_toast_test.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 10811);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`,
  { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Beast');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*archer\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);
// every story beat counts as seen: the forest's first-visit beat is a multi-stanza scene, and a toast raised under a
// story scene waits for it (v0.30.872 / v0.30.920) - closing it once let the next stanza reopen it before the later casts
await page.evaluate(() => { player.level = 80; player._god = true; player._storyBeatsSeen = new Proxy({}, { get: () => true }); loadMap('forest', 300); });
await page.waitForTimeout(4500);

const R = await page.evaluate(async () => {
  const frame = () => new Promise(r => requestAnimationFrame(r));
  const out = { hasThrottle: typeof _lxSummonCapToast === 'function' };
  out.windowMs = (typeof LX_SUMMON_CAP_TOAST_MS !== 'undefined') ? LX_SUMMON_CAP_TOAST_MS : null;

  // Count what the PLAYER sees: toast nodes carrying this text.
  const capToasts = () => Array.from(document.querySelectorAll('.toast'))
    .filter(t => /Summon cap/.test(t.textContent || '')).length;
  // ...and the queues: since v0.30.906 a toast arriving over a full stack WAITS its turn, and the Lv 80 jump above pays
  // out a run of legendary quest rewards - a 'rare' cap notice queued behind them and never reached the DOM here
  const clearToasts = () => { document.querySelectorAll('.toast').forEach(t => t.remove()); try { _lxToastWait.length = 0; _lxToastQueue.length = 0; } catch (e) {} };
  // loadMap('forest') opens the forest's first-visit story beat, and since v0.30.872 a toast raised under a story scene
  // waits for it to close (v0.30.920 holds the queued ones too) - so close it, or no toast reaches the screen at all
  { const sb = document.getElementById('story-beat-overlay'); if (sb) sb.classList.remove('on'); try { _lxToastQueue.length = 0; } catch (e) {} }

  // Fill the pack so every further cast is a capped no-op. Cast the REAL skill once from empty:
  // beastmaster_pack tops up to the shared cap in one go, so the pack ends at whatever that cap is
  // and the test never has to know the number. (It used to push exactly four stubs and assert 4.)
  player.pack = [];
  player.pet = null;
  SKILL_FNS.beastmaster_pack(); await frame();
  out.cap = player.pack.length;
  out.packLen = player.pack.length;

  // --- the reported burst: mash the skill --------------------------------
  clearToasts();
  const before = capToasts();
  for (let i = 0; i < 6; i++) { SKILL_FNS.beastmaster_pack(); await frame(); }
  out.burstToasts = capToasts() - before;
  out.packAfterBurst = player.pack.length;      // must not have grown past the cap

  // --- after the window, it speaks again (not muted forever) -------------
  clearToasts();
  const t = performance.now();
  while (performance.now() - t < (out.windowMs || 2500) + 350) await frame();
  clearToasts();   // what the game raised during the wait (Lv 80 rewards) would hold a 'rare' notice back
  SKILL_FNS.beastmaster_pack(); await frame();
  out.afterWindow = capToasts();

  // --- the Ranger shares the cap and the wording -------------------------
  clearToasts();
  const t2 = performance.now();
  while (performance.now() - t2 < (out.windowMs || 2500) + 350) await frame();
  const b2 = capToasts();
  for (let i = 0; i < 5; i++) { SKILL_FNS.wildBond(); await frame(); }
  out.rangerBurst = capToasts() - b2;

  clearToasts();
  player.pack = []; player.pet = null;
  return out;
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 210) });

console.log(`  throttle window: ${R.windowMs}ms   pack filled to ${R.packLen} (shared wolf cap ${R.cap})`);
console.log(`  6 rapid casts -> ${R.burstToasts} toast(s)   ranger 5 casts -> ${R.rangerBurst}   after the window -> ${R.afterWindow}`);

ok('the throttle exists', R.hasThrottle && R.windowMs > 0, `LX_SUMMON_CAP_TOAST_MS = ${R.windowMs}`);
ok('CONTROL: the pack really is at the cap', R.cap >= 2 && R.packLen === R.cap, `${R.packLen} wolves (cap ${R.cap})`);
ok('six rapid casts raise ONE notice, not six', R.burstToasts === 1,
   `${R.burstToasts} toasts from 6 presses — the screenshot showed four stacked`);
ok('...and the first press still speaks', R.burstToasts >= 1,
   'silence would leave the player wondering why the key did nothing');
ok('CONTROL: the capped cast still summons nothing', R.packAfterBurst === R.cap,
   `pack is ${R.packAfterBurst} after 6 attempts, cap is ${R.cap} — the cap itself still holds`);
ok('the notice returns after the window (not muted forever)', R.afterWindow === 1,
   `${R.afterWindow} toast once the throttle expired`);
ok('the Ranger shares the fix', R.rangerBurst === 1,
   `${R.rangerBurst} toasts from 5 Wild Bond casts — same cap, same wording, would have spammed too`);

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
