// In the creator, pad DOWN walks the column: preview -> Name -> Gender, and
// only then the look dropdowns.
// Per user: "using the directional game pad pressing down from here should go
// to name and gender before hair".
// Run: node scripts/pad_creator_nav_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9203;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.addInitScript(() => {
  window.__pad = { id: 'probe', index: 0, connected: true, mapping: 'standard', timestamp: 0,
    axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
  navigator.getGamepads = () => [window.__pad, null, null, null];
  window.__setBtn = (i, v) => { window.__pad.buttons[i] = { pressed: !!v, touched: !!v, value: v ? 1 : 0 };
                                window.__pad.timestamp = performance.now(); };
});
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });

const out = await page.evaluate(async () => {
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade');
  player.cls = null;
  window.dispatchEvent(new Event('gamepadconnected'));
  await wait(250);
  openClassSelect();
  await wait(800);
  const r = { root: (_lxPadModalRoot() || {}).id || null };
  // start the ring on the randomiser, which is where the report starts
  const dice = document.querySelector('#class-select-modal .cs-randomize-btn');
  r.diceFound = !!dice;
  if (!dice) return r;
  const modal = document.getElementById('class-select-modal');
  const els = [...modal.querySelectorAll('button, [role="button"], input, select, .toggle, .cs-dd-item, .class-card, .cs-skin-swatch, .cs-dd-trigger')]
    .filter((e) => { const b = e.getBoundingClientRect(); return b.width >= 5 && b.height >= 5 && getComputedStyle(e).visibility !== 'hidden'; });
  modal._padIdx = els.indexOf(dice);
  const label = (e) => !e ? null
    : (e.id || e.className || e.tagName).toString().split(' ').slice(0, 2).join('.');
  // press DOWN four times, recording where the ring lands each time
  const trail = [];
  for (let i = 0; i < 4; i++) {
    window.__setBtn(13, 1); await wait(120); window.__setBtn(13, 0); await wait(220);
    trail.push(label(document.querySelector('.pad-focus')));
  }
  r.trail = trail;
  return r;
});

ok('the creator is the pad surface and the randomiser exists',
   out.root === 'class-select-modal' && out.diceFound === true, `root=${out.root}`);
const t = out.trail || [];
const joined = t.join(' -> ');
ok('the first DOWN leaves the preview for the NAME field',
   /name/i.test(t[0] || ''), t[0] || '(nothing)');
ok('GENDER comes next, before any look dropdown',
   t.slice(0, 3).some(x => /gender/i.test(x || '')), joined);
ok('hair is NOT reached before name and gender',
   !/hair/i.test(t[0] || '') && !/hair/i.test(t[1] || ''), joined);

let pass = 0, failed = 0;
for (const r of res) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
console.log(`trail: ${joined}`);
console.log(`${pass} passed, ${failed} failed`);
await browser.close(); server.kill();
process.exit(failed ? 1 : 0);
