// The ablation again — but only after the game has stopped warming up.
// ============================================================================
// The cumulative ablations that justified v0.30.271 are not trustworthy. They
// applied one effect after another and measured in sequence inside a single
// page, and the numbers rose almost monotonically through the run
// (19.4 -> 27.1 -> 50.9 -> 105.8). The game is still baking sprites for the
// first tens of seconds, so a later sample is faster than an earlier one for
// reasons that have nothing to do with the CSS being toggled. I read a
// settling curve as an ablation result.
//
// This does three things differently:
//   1. WAIT FOR SETTLE — sample fps repeatedly and only start once consecutive
//      samples agree within 12%, so warm-up is over before anything is toggled.
//   2. A/B/A — baseline, effect off, baseline again. If the two baselines do
//      not agree, the run is declared unusable rather than reported.
//   3. Each effect is tested against the untouched page, not stacked on the
//      previous one.
// Run: node scripts/firefox_settled_ablation.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { firefox, chromium } = require('playwright-core');
const FF = (process.env.LOCALAPPDATA || '').split(String.fromCharCode(92)).join('/')
  + '/ms-playwright/firefox-1538/firefox/firefox.exe';
const PORT = Number(process.env.PORT || 10987);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));

const measure = () => new Promise((d) => {
  const t0 = performance.now(); let n = 0;
  const tick = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(tick);
    else d(+(n / ((performance.now() - t0) / 1000)).toFixed(1)); };
  requestAnimationFrame(tick);
});
const setCss = (css) => {
  if (css === 'CLASS:lx-nobackdrop') { document.documentElement.classList.add('lx-nobackdrop'); return; }
  document.documentElement.classList.remove('lx-nobackdrop');
  let el = document.getElementById('__lx_ab');
  if (!el) { el = document.createElement('style'); el.id = '__lx_ab'; document.head.appendChild(el); }
  el.textContent = css;
};

// Not CSS strings this time but the ACTUAL shipped mechanism: the game already
// has html.lx-nobackdrop, which drops all 110 backdrop-filter declarations and
// the #game colour grade. It is measured here as the candidate fix.
const EFFECTS = [
  ['html.lx-nobackdrop (the existing mechanism)', 'CLASS:lx-nobackdrop'],
  ['#game colour grade alone', '#game{filter:none !important}'],
  ['backdrop-filter alone', '*,*::before,*::after{backdrop-filter:none !important;-webkit-backdrop-filter:none !important}'],
  ['the faded loading overlay', '#loading-overlay{visibility:hidden !important}'],
  ['my shipped v0.30.271 animation gate', '.cs-rays,.cs-stars,#loading-overlay .lo-bg,#loading-overlay .lo-embers{animation:none !important}'],
];

const drive = async (name, launch) => {
  const b = await launch();
  const page = await b.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(12000);

  // 1. settle
  let prev = await page.evaluate(measure), settled = false, hist = [prev];
  for (let i = 0; i < 10; i++) {
    const cur = await page.evaluate(measure);
    hist.push(cur);
    if (Math.abs(cur - prev) <= Math.max(1.5, prev * 0.12)) { settled = true; prev = cur; break; }
    prev = cur;
  }
  console.log(`\n### ${name}`);
  console.log(`  warm-up samples: ${hist.join(' → ')} fps    ${settled ? 'settled' : 'NEVER SETTLED — results below are unreliable'}`);

  const rows = [];
  for (const [label, css] of EFFECTS) {
    await page.evaluate(setCss, ''); await page.waitForTimeout(800);
    const a = await page.evaluate(measure);
    await page.evaluate(setCss, css); await page.waitForTimeout(800);
    const off = await page.evaluate(measure);
    await page.evaluate(setCss, ''); await page.waitForTimeout(800);
    const a2 = await page.evaluate(measure);
    const drift = Math.abs(a2 - a) > Math.max(2, a * 0.18);
    rows.push({ label, a, off, a2, drift });
  }
  await b.close();

  console.log('   baseline   effect-off   baseline    verdict');
  for (const r of rows) {
    const mean = (r.a + r.a2) / 2;
    const gain = ((r.off / mean - 1) * 100).toFixed(0);
    const verdict = r.drift ? 'UNUSABLE (the two baselines disagree)'
      : (Math.abs(r.off - mean) <= Math.max(1.5, mean * 0.12) ? 'no effect'
        : (r.off > mean ? `+${gain}% faster without it` : `${gain}% — removing it HURT`));
    console.log(`  ${String(r.a).padStart(8)} ${String(r.off).padStart(10)} ${String(r.a2).padStart(11)}    ${r.label} — ${verdict}`);
  }
};

const list = [['FIREFOX', () => firefox.launch({ executablePath: FF, headless: false })]];
if (!process.env.LX_FFONLY) list.push(['CHROMIUM', () => chromium.launch({ channel: 'msedge', headless: false })]);
for (const [nm, launch] of list) await drive(nm, launch).catch((e) => console.log(`${nm}: ${String(e.message).slice(0, 160)}`));
server.kill();
