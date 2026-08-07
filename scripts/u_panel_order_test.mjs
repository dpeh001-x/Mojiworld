// U PANEL vs CHARACTER SHEET — first-open order must not matter (v0.29.470).
//
// Both panels own `#attributes-modal .modal` and both rewrite its innerHTML.
// Before this fix the Character Sheet's authored markup was snapshotted lazily,
// on the sheet's own first open, and only if it was still intact — so opening
// the U panel first (the common order: U is a HUD keybind, the sheet is not)
// left the snapshot null forever. The sheet then "opened" with display:flex and
// silently rendered the U panel's DOM, for the rest of the session, with no
// throw and no console error. A fresh page per scenario, because the bug is
// specifically about which panel runs FIRST.
// Run: node scripts/u_panel_order_test.mjs
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = 'file:///' + path.join(ROOT, 'mojiworld_game.html').replace(/\\/g, '/');
const browser = await chromium.launch({ channel: 'chrome' });
let bad = 0, allErrs = [];

for (const [label, order] of [
  ['sheet FIRST, then U', ['attr', 'lp', 'attr', 'lp']],
  ['U FIRST, then sheet', ['lp', 'attr', 'lp', 'attr']],   // the order that used to break
  ['U twice, then sheet', ['lp', 'lp', 'attr']],
]) {
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof openAttributes === 'function' && typeof openLevelUpPanel === 'function', { timeout: 60000 });
  const rows = await page.evaluate((seq) => {
    const card = document.querySelector('#class-select-modal .cls-card');
    if (card && !player.cls) { try { card.click(); } catch (e) {} }
    if (!player.cls) player.cls = 'warrior';
    const gate = document.getElementById('class-select-modal');
    if (gate) gate.style.display = 'none';
    player.hp = Math.max(1, player.maxHp || 100);
    const steps = [];
    for (const s of seq) {
      closeAllModals();
      let threw = null;
      try { s === 'attr' ? openAttributes() : openLevelUpPanel(); }
      catch (e) { threw = String(e && e.message || e).slice(0, 90); }
      const m = document.getElementById('attributes-modal');
      // Each panel has a marker node the other never renders.
      const sheet = !!document.getElementById('attr-derived');
      const upanel = !!document.getElementById('u-tabs');
      steps.push({ s, threw, shown: !!m && m.style.display === 'flex', sheet, upanel });
    }
    return steps;
  }, order);

  console.log(`\n=== ${label} ===`);
  for (const r of rows) {
    const want = r.s === 'attr' ? 'sheet' : 'upanel';
    const got = r.sheet && !r.upanel ? 'sheet' : (r.upanel && !r.sheet ? 'upanel' : (r.sheet && r.upanel ? 'both' : 'neither'));
    const pass = r.shown && !r.threw && got === want;
    if (!pass) bad++;
    console.log(`  ${pass ? 'PASS' : 'FAIL'}  open ${(r.s === 'attr' ? 'sheet' : 'U').padEnd(5)} -> shown=${String(r.shown).padEnd(5)} rendered=${got}${r.threw ? '  THREW: ' + r.threw : ''}`);
  }
  allErrs = allErrs.concat(errs);
  await page.close();
}
await browser.close();
console.log(allErrs.length ? '\npage errors: ' + allErrs.slice(0, 3).join(' | ') : '\nno page errors');
console.log(bad ? `\n${bad} step(s) rendered the wrong panel` : '\nall good — first-open order does not matter');
process.exit(bad || allErrs.length ? 1 : 0);
