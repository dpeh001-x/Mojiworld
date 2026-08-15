// The title menu always fits (scrolls when it must) and wears its version
// at the bottom right of the menu card.
// Per user: "The menu is truncated at the bottom, fix it, and put a small
// version number at the bottom right side of the menu."
// Run: node scripts/menu_fit_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9212;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
// a short viewport, where the reported truncation bites
const page = await browser.newPage({ viewport: { width: 900, height: 540 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });

let up = false;
for (let i = 0; i < 30 && !up; i++) { await page.waitForTimeout(1000);
  up = await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); return !!(lo && lo.classList.contains('menu-up')); }); }
ok('boot menu reached (900x540 viewport)', up);

// Reproduce the reported state: the user HAS a save, so the tall CONTINUE
// card is on the menu — and their window is short relative to the stack.
await page.evaluate(() => {
  const c = document.getElementById('menu-continue');
  if (c) { c.hidden = false; c.style.display = 'flex'; }
});
await page.setViewportSize({ width: 900, height: 430 });
await page.waitForTimeout(400);

const out = await page.evaluate(() => {
  const stack = document.querySelector('#loading-overlay .lo-stack');
  const backups = document.getElementById('menu-backups');
  const logo = document.getElementById('lo-logo');
  const vt = document.getElementById('lo-version');
  const H = window.innerHeight;
  if (!stack || !backups) return { err: 'stack/backups missing' };
  const r = { H };

  // is the whole menu reachable? scroll the stack to its bottom and check
  stack.scrollTop = stack.scrollHeight;
  const rb = backups.getBoundingClientRect();
  r.bottomReachable = rb.bottom <= H + 1 && rb.height > 10;
  r.backupsBottom = Math.round(rb.bottom);
  r.stackScrollable = stack.scrollHeight > stack.clientHeight + 4;

  // and back to the top — the logo must be reachable too
  stack.scrollTop = 0;
  const rl = logo ? logo.getBoundingClientRect() : null;
  r.topReachable = !rl || rl.top >= -2;

  // the version tag: inside the menu card, right-aligned, visible, versioned
  if (vt) {
    const auth = document.getElementById('lo-auth');
    stack.scrollTop = stack.scrollHeight;
    const rv = vt.getBoundingClientRect();
    const ra = auth ? auth.getBoundingClientRect() : null;
    r.vt = {
      insideMenuCard: !!(auth && auth.contains(vt)),
      text: (vt.textContent || '').trim(),
      opacity: +getComputedStyle(vt).opacity,
      rightAligned: ra ? (rv.right >= ra.right - ra.width * 0.35) : false,
      onScreen: rv.bottom <= H + 1 && rv.width > 0,
    };
  } else r.vt = null;
  return r;
});

ok('no layout pieces missing', !out.err, out.err || '');
if (!out.err) {
  ok('the last menu item is reachable on a short viewport (scrolls if needed)',
     out.bottomReachable, `backups bottom ${out.backupsBottom} vs viewport ${out.H}, stack scrollable: ${out.stackScrollable}`);
  ok('the top of the menu (logo) stays reachable too', out.topReachable);
  ok('the version tag lives inside the menu card', !!(out.vt && out.vt.insideMenuCard),
     out.vt ? JSON.stringify(out.vt) : 'no lo-version element');
  ok('the version tag shows the bare version, visibly',
     !!(out.vt && /^v\d+\.\d+/.test(out.vt.text) && out.vt.opacity > 0.5 && out.vt.onScreen),
     out.vt ? `"${out.vt.text}" opacity ${out.vt.opacity} onScreen ${out.vt.onScreen}` : '');
  ok('the version tag sits at the right side of the menu', !!(out.vt && out.vt.rightAligned));
}

let pass = 0, failed = 0;
for (const r of res) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
console.log(`${pass} passed, ${failed} failed`);
await browser.close(); server.kill();
process.exit(failed ? 1 : 0);
