// Toasts live in the top-right corner: off the map pill, off the quest
// banner, click-through, capped, and arriving with the corner slide.
// Per user: "the popups are blocking and are very clunky, fix it to make it
// neater and not block others."
// Run: node scripts/toast_layout_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9228;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });

const out = await page.evaluate(async () => {
  const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade');
  for (const id of ['class-select-modal', 'advancement-modal', 'tutorial-modal'])
    { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  player.cls = player.cls || 'warrior'; player.level = 50; game.paused = false;
  loadMap('forest', 300);
  await new Promise(r => setTimeout(r, 400));

  // a burst of six mixed toasts — like a combat/achievement chain
  showToast('Quest complete — The Name You Left Behind', 'legendary');
  showToast('+1,240 EXP', 'success');
  showToast('Rare drop: Dawnshard fragment', 'rare');
  showToast('Combo x25!', 'epic');
  showToast('Achievement unlocked: First Steps', 'story');
  showToast('MojiCoins +400', 'success');
  await new Promise(r => setTimeout(r, 350));

  const wrap = document.querySelector('.game-wrapper') || document.body;
  const wr = wrap.getBoundingClientRect();
  const cont = document.getElementById('toast-container');
  const cr = cont.getBoundingClientRect();
  const toasts = [...cont.querySelectorAll('.toast')];
  const rects = toasts.map(t => t.getBoundingClientRect());
  // the band other top-centre UI occupies: the map pill + the quest banner
  const band = { l: wr.left + wr.width / 2 - 260, r: wr.left + wr.width / 2 + 260, t: wr.top, b: wr.top + 130 };
  const overlapsBand = rects.some(q => q.left < band.r && q.right > band.l && q.top < band.b && q.bottom > band.t && q.width > 0);
  return {
    count: toasts.length,
    contRightGap: Math.round(wr.right - cr.right),
    contLeftFrac: +(((cr.left - wr.left) / wr.width)).toFixed(2),
    overlapsBand,
    anim: toasts.length ? getComputedStyle(toasts[toasts.length - 1]).animationName : null,
    pe: toasts.length ? getComputedStyle(toasts[0]).pointerEvents : null,
    contPe: getComputedStyle(cont).pointerEvents,
    widest: Math.round(Math.max(...rects.map(q => q.width), 0)),
  };
});

ok('the burst is capped (no flooding)', out.count <= 4, `${out.count} visible of 6 fired`);
ok('the column is anchored to the top-right corner',
   out.contRightGap >= 0 && out.contRightGap < 60 && out.contLeftFrac > 0.6,
   `right gap ${out.contRightGap}px, left edge at ${Math.round(out.contLeftFrac * 100)}% of the wrapper`);
ok('no toast sits on the map-pill / quest-banner band (top centre)',
   !out.overlapsBand);
ok('toasts are corner-sized, not banners', out.widest > 0 && out.widest <= 360, `widest ${out.widest}px`);
ok('toasts arrive with the corner slide-in', out.anim === 'toastSlideR', `animation: ${out.anim}`);
ok('clicks pass straight through (nothing is blocked)',
   out.pe === 'none' && out.contPe === 'none', `toast ${out.pe}, container ${out.contPe}`);

let pass = 0, failed = 0;
for (const r of res) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
console.log(`${pass} passed, ${failed} failed`);
await browser.close(); server.kill();
process.exit(failed ? 1 : 0);
