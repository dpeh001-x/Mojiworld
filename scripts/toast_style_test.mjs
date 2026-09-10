// v0.30.x — Toast notifications are backlit violet glass plates (per user: match the game's aesthetic).
//   node scripts/toast_style_test.mjs [file.html] [port] [screenshot.png]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11311);
const SHOT = process.argv[4] || '';
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(10000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Toast');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);

const r = await page.evaluate(() => {
  const out = {};
  { const sb = document.getElementById('story-beat-overlay'); if (sb) { sb.classList.remove('on'); sb.style.display = 'none'; } }
  try { loadMap('forest', 300); } catch (e) {}
  const host = document.getElementById('toast-container');
  while (host && host.firstChild) host.removeChild(host.firstChild);
  const tiers = [['legendary', '☀ Finding Your Feet — +500c · 🍷 ×4 · 💧 ×3'], ['epic', '✨ Innate growth: +1 SP (lucky roll!)'], ['rare', '🩸 Hex: 1 more…'], [undefined, '▶ Next: reach Lv 5 → Adventurer']];
  for (const [rar, txt] of tiers) showToast(txt, rar);
  const els = [...host.querySelectorAll('.toast')];
  for (const t of els) { t.style.animation = 'none'; t.style.opacity = '1'; }   // freeze for the read + shot
  out.count = els.length;
  const cs = (el, pseudo) => getComputedStyle(el, pseudo || null);
  const base = els[3], leg = els[0], rare = els[2];
  out.radius = cs(base).borderRadius;
  out.leftStripe = cs(base).borderLeftWidth;
  out.shadowStops = (cs(base).textShadow.match(/rgb/g) || []).length;   // the old ring had 9
  out.weight = cs(base).fontWeight;
  out.tracking = parseFloat(cs(base).letterSpacing);
  out.gem = cs(base, '::before').borderTopLeftRadius;   // v0.30.x — the stripe became a gem
  out.padTop = parseFloat(cs(base).paddingTop); out.fontPx = parseFloat(cs(base).fontSize);
  out.bodyA = cs(base).getPropertyValue('--tc-body-a').trim();
  out.glint = cs(base, '::after').height;
  out.accentBase = cs(base).getPropertyValue('--tc-accent').trim();
  out.accentLeg = cs(leg).getPropertyValue('--tc-accent').trim();
  out.accentRare = cs(rare).getPropertyValue('--tc-accent').trim();
  out.legStripe = cs(leg).borderLeftColor; out.rareStripe = cs(rare).borderLeftColor;
  out.align = cs(base).textAlign;
  const rc = host.getBoundingClientRect();
  out.rect = { x: rc.left, y: rc.top, w: rc.width, h: rc.height };
  return out;
});
console.log(JSON.stringify(r));
if (SHOT) {
  const wr = await page.evaluate(() => { const r = document.querySelector('.game-wrapper').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await page.screenshot({ path: SHOT, clip: { x: Math.max(0, wr.x + wr.w * 0.55), y: Math.max(0, wr.y + 40), width: wr.w * 0.45, height: 300 } });
}
const checks = [
  ['four toasts rendered', r.count === 4],
  ['the plate is a 9px-radius glass with a rarity gem, not a stripe', r.radius === '9px' && r.leftStripe === '1px' && r.gem === '50%', `${r.radius} / ${r.leftStripe} / gem ${r.gem}`],
  ['the plate is compact (<= 4px pad, <= 11px type)', r.padTop <= 4 && r.fontPx <= 11, `${r.padTop}px / ${r.fontPx}px`],
  ['the body is translucent (alpha <= 0.7)', parseFloat(r.bodyA.slice(r.bodyA.lastIndexOf(',') + 1)) <= 0.7, r.bodyA],
  ['the 8-way black outline ring is gone (one edge + halo)', r.shadowStops === 2, `stops ${r.shadowStops}`],
  ['tracking is tight, weight 700', r.tracking <= 0.5 && String(r.weight) === '700', `${r.tracking}px / ${r.weight}`],
  ['the top glint is drawn', r.glint === '1px', `${r.glint}`],
  ['rarities recolour the same plate', r.accentLeg && r.accentRare && r.accentBase && r.accentLeg !== r.accentRare && r.accentRare !== r.accentBase && r.legStripe !== r.rareStripe, `${r.accentBase} / ${r.accentLeg} / ${r.accentRare}`],
  ['text is left-aligned beside the stripe', r.align === 'left'],
  ['no page errors', errs.length === 0, errs.join(' | ')],
];
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
await browser.close(); server.kill();
process.exit(fails ? 1 : 0);
