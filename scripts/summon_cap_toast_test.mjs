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
await page.evaluate(() => { player.level = 80; player._god = true; loadMap('forest', 300); });
await page.waitForTimeout(4500);

const R = await page.evaluate(async () => {
  const frame = () => new Promise(r => requestAnimationFrame(r));
  const out = { hasThrottle: typeof _lxSummonCapToast === 'function' };
  out.windowMs = (typeof LX_SUMMON_CAP_TOAST_MS !== 'undefined') ? LX_SUMMON_CAP_TOAST_MS : null;

  // Count what the PLAYER sees: toast nodes carrying this text.
  const capToasts = () => Array.from(document.querySelectorAll('.toast'))
    .filter(t => /Summon cap/.test(t.textContent || '')).length;
  const clearToasts = () => document.querySelectorAll('.toast').forEach(t => t.remove());

  // Fill the pack so every further cast is a capped no-op.
  player.pack = [];
  player.pet = null;
  for (let i = 0; i < 4; i++) player.pack.push({ x: player.x, y: player.y, vx: 0, vy: 0, hp: 1, maxHp: 1, life: 99999, maxLife: 99999, cdAtk: 0, facing: 1, scale: 2.4 });
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

console.log(`  throttle window: ${R.windowMs}ms   pack filled to ${R.packLen}`);
console.log(`  6 rapid casts -> ${R.burstToasts} toast(s)   ranger 5 casts -> ${R.rangerBurst}   after the window -> ${R.afterWindow}`);

ok('the throttle exists', R.hasThrottle && R.windowMs > 0, `LX_SUMMON_CAP_TOAST_MS = ${R.windowMs}`);
ok('CONTROL: the pack really is at the cap', R.packLen === 4, `${R.packLen} wolves`);
ok('six rapid casts raise ONE notice, not six', R.burstToasts === 1,
   `${R.burstToasts} toasts from 6 presses — the screenshot showed four stacked`);
ok('...and the first press still speaks', R.burstToasts >= 1,
   'silence would leave the player wondering why the key did nothing');
ok('CONTROL: the capped cast still summons nothing', R.packAfterBurst === 4,
   `pack is ${R.packAfterBurst} after 6 attempts — the cap itself still holds`);
ok('the notice returns after the window (not muted forever)', R.afterWindow === 1,
   `${R.afterWindow} toast once the throttle expired`);
ok('the Ranger shares the fix', R.rangerBurst === 1,
   `${R.rangerBurst} toasts from 5 Wild Bond casts — same cap, same wording, would have spammed too`);

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
