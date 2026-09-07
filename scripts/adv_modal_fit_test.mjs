// The Class Advancement modal fits the canvas — and says so when it cannot.
// ============================================================================
// Per user: the Berserker / Knight cards were clipped at the modal frame.
// Measured before the fix (screen px at the 960x560 canvas, 1.333 scale):
// job tier 199px hidden at rest, 257px once a card was armed — the "click
// again to become the ..." prompt that makes the choice work sat entirely
// below the fold; master tier 168px hidden.
//
// Four screens share #advancement-modal; every one is opened for real:
//   1. job tier, resting          -> row content fits its viewport (overflow 0)
//   2. job tier, armed            -> still fits, AND the confirm prompt's box
//                                    lies inside the row's visible box
//   3. master tier, resting       -> fits
//   4. talent picker (3 cards)    -> fits (it shares the .class-card padding)
//   5. POSITIVE CONTROL: force the row to overflow by 900px, run the hint
//      toggler, and the "scroll for more" hint must appear — then vanish once
//      scrolled to the end. Without this row a "fits" pass could hide a dead
//      affordance.
// On the unpatched build rows 1-3 FAIL (199 / 257 / 168) and row 5 fails
// because the toggler does not exist.
// Run: node scripts/adv_modal_fit_test.mjs
//      MOJI_GAME_FILE=_prefit.html node scripts/adv_modal_fit_test.mjs   (baseline)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 11291);
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
let browser = null;
for (let a = 1; a <= 3 && !browser; a++) {
  try { browser = await chromium.launch({ channel: 'msedge', headless: true }); }
  catch (e) { if (a === 3) throw e; await new Promise((r) => setTimeout(r, 2000 * a)); }
}
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(12000);
const click = async (sel, ms) => {
  const el = await page.$(sel);
  if (!el || !(await el.isVisible().catch(() => false))) return false;
  try { await el.click({ timeout: ms || 2500 }); return true; } catch (e) { return false; }
};
await click('#menu-newgame', 8000); await page.waitForTimeout(1500);
await click('#auth-submit', 8000);  await page.waitForTimeout(2500);
for (let i = 0; i < 8; i++) {
  const r = await page.evaluate(() => { const o = document.getElementById('class-options');
    return !!(o && o.firstElementChild && o.firstElementChild.getBoundingClientRect().width > 40); });
  if (r) break;
  if (!(await click('#cs-nav-next'))) break;
  await page.waitForTimeout(1000);
}
await page.evaluate(() => { const o = document.getElementById('class-options'); if (o && o.firstElementChild) o.firstElementChild.click(); });
for (let i = 0; i < 45; i++) {
  for (const sel of ['#plg-dagger-skip', '#plg-skip', '#boss-intro-skip', '#tut-skip']) await click(sel, 1200);
  await page.keyboard.press('Enter').catch(() => {});
  await page.waitForTimeout(2000);
  const st = await page.evaluate(() => ({ p: (typeof game !== 'undefined') ? game.paused : null, pro: !!window._prologueActive }));
  if (st.p === false && !st.pro) break;
}
await page.evaluate(() => { const o = document.getElementById('loading-overlay'); if (o) o.classList.add('fade'); });
await page.waitForTimeout(800);

const R = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const ov = document.getElementById('advancement-modal');
  const row = () => document.getElementById('advancement-options');
  const overflow = () => row().scrollHeight - row().clientHeight;
  const hintOn = () => !!ov.querySelector('.modal.adv-overflowing');
  const close = () => { ov.style.display = 'none'; };

  player.cls = 'warrior';
  player._storyBeatsSeen = Object.assign({}, player._storyBeatsSeen || {}, { advancement_1: true, advancement_2: true });

  // 1. job tier, resting
  openAdvancement(); await sleep(500);
  const job = { overflow: overflow(), cards: row().querySelectorAll('.class-card').length, hint: hintOn() };

  // 2. armed: the confirm prompt must be INSIDE the visible row box
  const first = row().querySelector('.class-card');
  if (first) first.click();
  await sleep(400);
  const cf = row().querySelector('.cls-confirm');
  const rb = row().getBoundingClientRect();
  const cb = cf ? cf.getBoundingClientRect() : null;
  const armed = { overflow: overflow(), hasConfirm: !!cf,
    confirmInside: !!(cb && cb.bottom <= rb.bottom + 1 && cb.top >= rb.top - 1), hint: hintOn() };

  // 5. positive control: force overflow, the hint must show, then hide at the end
  let control = { fnPresent: typeof _advOverflowHint === 'function' };
  if (control.fnPresent) {
    const spacer = document.createElement('div');
    spacer.style.height = '900px';
    first.appendChild(spacer);
    _advOverflowHint();
    await sleep(60);
    const hintEl = ov.querySelector('.adv-scroll-hint');
    control.forcedOverflow = overflow();
    control.shown = hintOn() && !!hintEl && getComputedStyle(hintEl).display !== 'none';
    row().scrollTop = row().scrollHeight;
    row().dispatchEvent(new Event('scroll'));
    await sleep(60);
    control.hiddenAtEnd = !hintOn();
    spacer.remove();
    row().scrollTop = 0; row().dispatchEvent(new Event('scroll'));
  }
  close();

  // 3. master tier
  player.job = 'berserker'; game._devAdvBypass = true;
  openMasterAdvancement(); await sleep(500);
  const master = { overflow: overflow(), cards: row().querySelectorAll('.class-card').length, hint: hintOn() };
  close();

  // 4. talent picker (three cards, shares .class-card)
  let talent = { err: null };
  try {
    const masters = Object.keys(MASTERS).filter((id) => MASTERS[id].from === 'berserker');
    player.master = masters[0];
    openTalentPick(masters[0]); await sleep(600);
    talent = { overflow: overflow(), cards: row().querySelectorAll('.class-card').length, hint: hintOn() };
  } catch (e) { talent.err = String(e.message).slice(0, 100); }
  close();
  return { job, armed, control, master, talent };
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 200) });
console.log(`  job: overflow ${R.job.overflow} (${R.job.cards} cards)   armed: overflow ${R.armed.overflow}, confirm inside ${R.armed.confirmInside}`);
console.log(`  master: overflow ${R.master.overflow} (${R.master.cards} cards)   talent: ${R.talent.err ? 'ERR ' + R.talent.err : 'overflow ' + R.talent.overflow + ' (' + R.talent.cards + ' cards)'}`);
console.log(`  control: ${JSON.stringify(R.control)}`);
ok('job tier: both cards fit the row (no hidden content)', R.job.cards >= 2 && R.job.overflow <= 0,
   `overflow ${R.job.overflow}px (pre-fix 199)`);
ok('job tier, armed: still fits — and the "click again" prompt is inside the visible box',
   R.armed.hasConfirm && R.armed.overflow <= 0 && R.armed.confirmInside,
   `overflow ${R.armed.overflow}px (pre-fix 257), confirm inside: ${R.armed.confirmInside}`);
ok('master tier: both cards fit', R.master.cards >= 2 && R.master.overflow <= 0, `overflow ${R.master.overflow}px (pre-fix 168)`);
ok('talent picker (shares the modal): three cards fit', !R.talent.err && R.talent.cards >= 3 && R.talent.overflow <= 0,
   R.talent.err || `overflow ${R.talent.overflow}px, ${R.talent.cards} cards`);
ok('CONTROL: nothing overflows, so the hint is correctly hidden on every screen',
   !R.job.hint && !R.armed.hint && !R.master.hint && !R.talent.hint);
ok('POSITIVE CONTROL: forced overflow shows the "scroll for more" hint, and it hides at the end',
   R.control.fnPresent && R.control.forcedOverflow > 400 && R.control.shown && R.control.hiddenAtEnd,
   R.control.fnPresent ? `forced ${R.control.forcedOverflow}px: shown ${R.control.shown}, hidden at end ${R.control.hiddenAtEnd}` : '_advOverflowHint absent (unpatched build)');

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
