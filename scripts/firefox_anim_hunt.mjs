// WHICH animations cost the frame? One name at a time.
// ============================================================================
// The shipped v0.30.271 Gecko gate turns off four selectors and is worth
// nothing: 11.6 / 12.7 / 12.6 fps with it active, defeated, active again.
//
// The earlier ablation that justified it used `* { animation: none }` — EVERY
// animation on the page — and I attributed that win to the three largest
// layers without checking. That was the error: largest area is not the same as
// largest cost, and this run tests the assumption instead of repeating it.
//
// Enumerates every running animation, then disables them one NAME at a time
// (each measured against the untouched page, so the effects do not compound),
// and finally all together as the upper bound the earlier ablation measured.
// Whatever actually carries the cost will stand out; if nothing does, then the
// cost is not in animations at all and the gate should be reverted rather than
// retuned.
// Run: node scripts/firefox_anim_hunt.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { firefox } = require('playwright-core');
const FF = (process.env.LOCALAPPDATA || '').split(String.fromCharCode(92)).join('/')
  + '/ms-playwright/firefox-1538/firefox/firefox.exe';
const PORT = Number(process.env.PORT || 10981);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));

const CENSUS = () => {
  const out = {};
  for (const e of document.querySelectorAll('*')) {
    const cs = getComputedStyle(e);
    if (!cs.animationName || cs.animationName === 'none') continue;
    const r = e.getBoundingClientRect();
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    for (const n of cs.animationName.split(',').map((x) => x.trim())) {
      const o = out[n] || (out[n] = { n: 0, area: 0 });
      o.n++; o.area += Math.round(r.width * r.height);
    }
  }
  return Object.entries(out).map(([name, v]) => ({ name, count: v.n, area: v.area }))
    .sort((a, b) => b.area - a.area);
};

const measure = () => new Promise((d) => {
  const t0 = performance.now(); let n = 0;
  const tick = () => { n++; if (performance.now() - t0 < 2600) requestAnimationFrame(tick);
    else d(+(n / ((performance.now() - t0) / 1000)).toFixed(1)); };
  requestAnimationFrame(tick);
});
// Disabling by NAME needs a rule that matches whatever element carries it, so
// this stamps a data attribute on the elements running that name instead.
const apply = (names) => {
  let el = document.getElementById('__lx_hunt');
  if (!el) { el = document.createElement('style'); el.id = '__lx_hunt'; document.head.appendChild(el); }
  el.textContent = '[data-lxkill] { animation: none !important; }';
  for (const e of document.querySelectorAll('[data-lxkill]')) e.removeAttribute('data-lxkill');
  if (!names.length) return 0;
  let k = 0;
  for (const e of document.querySelectorAll('*')) {
    const an = getComputedStyle(e).animationName;
    if (!an || an === 'none') continue;
    const mine = an.split(',').map((x) => x.trim());
    if (mine.some((m) => names.includes(m))) { e.setAttribute('data-lxkill', '1'); k++; }
  }
  return k;
};

const b = await firefox.launch({ executablePath: FF, headless: false });
const page = await b.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 90000 });
await page.waitForTimeout(15000);

const census = await page.evaluate(CENSUS);
console.log('  running animations, by total area:');
for (const c of census) console.log(`    ${String(c.area).padStart(9)}px2  x${String(c.count).padStart(3)}  ${c.name}`);

const ref = async () => { await page.evaluate(apply, []); await page.waitForTimeout(700); return page.evaluate(measure); };
const base1 = await ref();
console.log(`\n  reference (nothing disabled): ${base1} fps`);

const results = [];
for (const c of census) {
  const k = await page.evaluate(apply, [c.name]);
  await page.waitForTimeout(700);
  const fps = await page.evaluate(measure);
  results.push({ name: c.name, fps, k });
}
const allNames = census.map((c) => c.name);
const kAll = await page.evaluate(apply, allNames);
await page.waitForTimeout(700);
const allOff = await page.evaluate(measure);
const base2 = await ref();
await b.close(); server.kill();

const base = (base1 + base2) / 2;
console.log(`  reference again (drift check): ${base2} fps   -> using mean ${base.toFixed(1)}\n`);
console.log('  each row: that ONE animation name disabled, everything else left running');
for (const r of results.sort((a, b2) => b2.fps - a.fps)) {
  const d = r.fps - base;
  console.log(`    ${String(r.fps).padStart(7)} fps  ${(d >= 0 ? '+' : '') + d.toFixed(1)}   ${r.name} (${r.k} elements)`);
}
console.log(`\n    ${String(allOff).padStart(7)} fps  ${(allOff - base >= 0 ? '+' : '') + (allOff - base).toFixed(1)}   ALL ${allNames.length} names off (${kAll} elements) — the upper bound`);
