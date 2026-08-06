// FIRST-BIND MODAL TEST (v0.29.452). The card is decorative, but its return
// value drives whether the MojiMon tab opens — so behaviour matters more than
// looks. Checks the resolve contract, dismissal paths, and that it cleans up.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await page.goto('file:///' + path.join(ROOT, 'mojiworld_game.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof _mojimonFirstBindModal === 'function', { timeout: 60000 });

const out = await page.evaluate(async () => {
  const R = [];
  const ok = (n, c, d) => R.push({ n, pass: !!c, d: d || '' });
  const el = () => document.getElementById('mojimon-firstbind');
  const settle = () => new Promise((r) => setTimeout(r, 420));

  // "Got it" -> false (do not open the tab)
  let p = _mojimonFirstBindModal('slime');
  await settle();
  ok('modal mounts', !!el());
  const btns = [...el().querySelectorAll('button')];
  ok('two actions offered', btns.length === 2, btns.map((b) => b.textContent).join(' | '));
  btns.find((b) => /Got it/.test(b.textContent)).click();
  ok('"Got it" resolves FALSE (stay in game)', (await p) === false);
  await settle();
  ok('cleans itself out of the DOM', !el());

  // "Open MojiMon tab" -> true
  p = _mojimonFirstBindModal('slime');
  await settle();
  [...el().querySelectorAll('button')].find((b) => /Open MojiMon/.test(b.textContent)).click();
  ok('"Open MojiMon tab" resolves TRUE', (await p) === true);
  await settle();

  // Escape dismisses as "Got it"
  p = _mojimonFirstBindModal('slime');
  await settle();
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  ok('Escape dismisses -> FALSE', (await p) === false);
  await settle();
  ok('no modal left after Escape', !el());

  // backdrop click dismisses, but a click INSIDE the card must not
  p = _mojimonFirstBindModal('slime');
  await settle();
  const card = el().firstChild;
  card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 120));
  ok('clicking the card does NOT dismiss', !!el());
  el().dispatchEvent(new MouseEvent('click', { bubbles: true }));
  ok('backdrop click dismisses -> FALSE', (await p) === false);
  await settle();

  // unknown species must not throw or show a broken portrait
  let threw = null;
  try { const q = _mojimonFirstBindModal('__no_such_species__'); await settle();
    const face = el() && el().querySelector('img[alt]:not([alt=""])');
    ok('unknown species hides the portrait instead of a broken image',
       !face || getComputedStyle(face).display === 'none' || face.naturalWidth > 0);
    el().dispatchEvent(new MouseEvent('click', { bubbles: true })); await q;
  } catch (e) { threw = e.message; }
  ok('unknown species does not throw', !threw, threw || '');
  await settle();
  ok('nothing left mounted at the end', !el());
  return R;
});
await browser.close();

let bad = 0;
for (const r of out) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.d ? '  (' + r.d + ')' : ''}`); }
console.log(errs.length ? 'page errors: ' + errs.join(' | ') : 'no page errors');
console.log(`${out.length - bad}/${out.length} passed`);
process.exit(bad || errs.length ? 1 : 0);
