// The POPULATED advancement and sage-blessing modals are fully operable with a
// controller: the ring reaches their choices, and Ⓐ actually commits.
// Per user: "advancement and sage-blessing populated content does not allow me
// to use controller".
// Run: node scripts/adv_sage_pad_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9204;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript(() => {
  window.__pad = { id: 'probe', index: 0, connected: true, mapping: 'standard', timestamp: 0,
    axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
  navigator.getGamepads = () => [window.__pad, null, null, null];
  window.__setBtn = (i, v) => { window.__pad.buttons[i] = { pressed: !!v, touched: !!v, value: v ? 1 : 0 };
                                window.__pad.timestamp = performance.now(); };
});
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(10000);
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });

const out = await page.evaluate(async () => {
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade');
  window.dispatchEvent(new Event('gamepadconnected'));
  player.cls = 'warrior'; player.level = 20; player.hp = getMaxHp();
  player.job = null; player._tutorialSeen = true;
  player._storyBeatsSeen = new Proxy({}, { get: () => true });
  try { closeAllModals(); } catch (e) {}
  for (const id of ['class-select-modal', 'story-beat-overlay', 'tutorial-modal']) {
    const el = document.getElementById(id);
    if (el) { el.style.display = 'none'; el.classList.remove('on', 'shown'); }
  }
  game.paused = false;
  await wait(300);
  const r = {};
  const rootNow = () => { try { _lxPadRootAt = -1; const e = _lxPadModalRoot(); return e ? e.id : null; } catch (e) { return 'ERR'; } };
  const ringLabel = () => { const f = document.querySelector('.pad-focus');
    return f ? (f.id || f.className).toString().slice(0, 40) : null; };

  // ── ADVANCEMENT, populated ──
  openAdvancement();
  await wait(500);
  const adv = document.getElementById('advancement-modal');
  r.advShown = !!(adv && getComputedStyle(adv).display !== 'none');
  r.advRoot = rootNow();
  r.advCards = adv ? adv.querySelectorAll('.class-card').length : 0;
  let landed = false;
  for (let i = 0; i < 10 && !landed; i++) {
    window.__setBtn(15, 1); await wait(90); window.__setBtn(15, 0); await wait(150);
    landed = /class-card/.test(ringLabel() || '');
  }
  r.advRingOnCard = landed;
  if (landed) {
    window.__setBtn(0, 1); await wait(120); window.__setBtn(0, 0); await wait(300);
    r.advArmed = !!document.querySelector('#advancement-modal .cls-armed');
    window.__setBtn(0, 1); await wait(120); window.__setBtn(0, 0); await wait(600);
    r.advJobAfter = player.job;
  }
  try { document.getElementById('advancement-modal').style.display = 'none'; game.paused = false; } catch (e) {}
  await wait(300);

  // ── SAGE BLESSING, populated (the shower is driven directly — the 12h/price
  //    gates live in the CALLER, and the pad question is about the modal) ──
  const pw = _weightedBoonPick(POWERUPS);
  r.sageReturned = showSageBlessing(pw, { roll: 5, tier: 'common' }, false);
  await wait(400);
  const sg = document.getElementById('sage-blessing-modal');
  r.sageShown = !!(sg && getComputedStyle(sg).display !== 'none');
  r.sageRoot = rootNow();
  let sLanded = false;
  for (let i = 0; i < 6 && !sLanded; i++) {
    window.__setBtn(15, 1); await wait(90); window.__setBtn(15, 0); await wait(150);
    sLanded = /sb-btn|close-btn/.test(ringLabel() || '');
  }
  r.sageRingOnBtn = sLanded;
  if (sLanded) {
    window.__setBtn(0, 1); await wait(120); window.__setBtn(0, 0); await wait(400);
    r.sageClosed = !(sg && getComputedStyle(sg).display !== 'none');
  }
  return r;
});

ok('the populated advancement modal routes to the pad',
   out.advShown === true && out.advRoot === 'advancement-modal' && out.advCards >= 2,
   `shown=${out.advShown} root=${out.advRoot} cards=${out.advCards}`);
ok('the ring reaches a job card', out.advRingOnCard === true, String(out.advRingOnCard));
ok('Ⓐ arms the card (first press of the two-press confirm)', out.advArmed === true, String(out.advArmed));
ok('a second Ⓐ COMMITS the advancement', !!out.advJobAfter, `job=${out.advJobAfter}`);
ok('the populated sage blessing routes to the pad',
   out.sageReturned === true && out.sageShown === true && out.sageRoot === 'sage-blessing-modal',
   `shown=${out.sageShown} root=${out.sageRoot}`);
ok('the ring reaches its button and Ⓐ dismisses it',
   out.sageRingOnBtn === true && out.sageClosed === true,
   `onBtn=${out.sageRingOnBtn} closed=${out.sageClosed}`);

let pass = 0, failed = 0;
for (const r of res) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
console.log(`${pass} passed, ${failed} failed`);
await browser.close(); server.kill();
process.exit(failed ? 1 : 0);
