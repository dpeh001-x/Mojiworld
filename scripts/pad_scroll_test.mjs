// The right stick scrolls the panel the pad is on, without disturbing the ring.
// Per user: "allow the analogue stick of the game pad to scroll up and down the UI".
// Run: node scripts/pad_scroll_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9202;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => {
  window.__pad = { id: 'probe', index: 0, connected: true, mapping: 'standard', timestamp: 0,
    axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
  navigator.getGamepads = () => [window.__pad, null, null, null];
  window.__ax = (i, v) => { window.__pad.axes[i] = v; window.__pad.timestamp = performance.now(); };
});
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });

const out = await page.evaluate(async () => {
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade');
  player.cls = 'rogue'; player.job = 'ninja'; player.level = 13; player.hp = getMaxHp();
  player.skillRankPoints = 2;
  window.dispatchEvent(new Event('gamepadconnected'));
  await wait(300);
  openLevelUpPanel(); await wait(400);
  const tab = [...document.querySelectorAll('#u-tabs .inv-tab')].find(b => b.dataset.utab === 'skills');
  if (tab) tab.click();
  await wait(700);

  const r = {};
  const root = _lxPadModalRoot();
  r.root = root ? root.id : null;
  // the tallest scrollable node in the surface — what the stick should move
  const findSc = () => {
    let best = null;
    for (const e of [root, ...root.querySelectorAll('*')]) {
      if (!e || !e.scrollHeight) continue;
      if (e.scrollHeight - e.clientHeight < 12) continue;
      const ov = getComputedStyle(e).overflowY;
      if (ov !== 'auto' && ov !== 'scroll' && e !== root) continue;
      if (!best || (e.scrollHeight - e.clientHeight) > (best.scrollHeight - best.clientHeight)) best = e;
    }
    return best;
  };
  const sc = findSc();
  r.hasScrollable = !!sc;
  r.overflow = sc ? (sc.scrollHeight - sc.clientHeight) : 0;
  if (!sc) return r;
  sc.scrollTop = 0; await wait(120);
  r.top0 = sc.scrollTop;
  // remember the ring so we can prove scrolling does not move the selection
  const ringBefore = (document.querySelector('.pad-focus') || {}).className || null;

  // full push DOWN on the right stick
  window.__ax(3, 1); await wait(60); window.__ax(3, 0); await wait(100);
  r.afterDown = sc.scrollTop;
  // a few frames only: 199px of overflow saturates in under 200ms at full
  // speed, which made a full push and a nudge measure identical.
  r.ringAfter = (document.querySelector('.pad-focus') || {}).className || null;
  r.ringUnchanged = (ringBefore === r.ringAfter);

  // a gentle nudge must travel LESS than a full push over the same time
  sc.scrollTop = 0; await wait(120);
  window.__ax(3, 0.30); await wait(60); window.__ax(3, 0); await wait(100);
  r.afterNudge = sc.scrollTop;

  // and back UP
  sc.scrollTop = r.afterDown; await wait(120);
  sc.scrollTop = sc.scrollHeight; await wait(100); const _fromTop = sc.scrollTop;
  window.__ax(3, -1); await wait(500); window.__ax(3, 0); await wait(150);
  r.fromTop = _fromTop;
  r.afterUp = sc.scrollTop;

  // deadzone: a resting stick must not drift
  sc.scrollTop = 50; await wait(120);
  window.__ax(3, 0.10); await wait(600); window.__ax(3, 0);
  r.afterDeadzone = sc.scrollTop;
  return r;
});

ok('the Skills tab is a pad surface with something to scroll',
   out.hasScrollable === true && out.overflow > 12, `root=${out.root} overflow=${out.overflow}px`);
ok('right stick DOWN scrolls the panel down', out.afterDown > out.top0 + 10,
   `${out.top0} -> ${out.afterDown}`);
ok('right stick UP scrolls it back', out.afterUp < out.fromTop - 10,
   `${out.fromTop} -> ${out.afterUp}`);
ok('speed is analogue — a nudge travels less than a full push',
   out.afterNudge > 0 && out.afterNudge < out.afterDown,
   `nudge ${out.afterNudge}px vs full ${out.afterDown}px`);
ok('a resting stick does not drift (deadzone)', out.afterDeadzone === 50, `${out.afterDeadzone}`);
ok('scrolling does not move the focus ring', out.ringUnchanged === true,
   `${out.ringAfter}`);

let pass = 0, failed = 0;
for (const r of res) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
console.log(`${pass} passed, ${failed} failed`);
await browser.close(); server.kill();
process.exit(failed ? 1 : 0);
