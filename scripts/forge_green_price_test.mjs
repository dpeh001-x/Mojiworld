// Forge tweaks (v0.29.747) — the two user asks, verified end-to-end:
//   1. "when have enough mojicoins to upgrade button should be green":
//      the REAL modal is driven at rich / exact-cost / broke coin levels and
//      the button's COMPUTED background is read back — green must dominate
//      when affordable (including the exact-cost boundary), never when broke.
//   2. Prices, two asks reconciled: "increase the price of upgrading from 2
//      star onwards" then "the 7 8 and 9 star are too high, change it to
//      25000, 35000, 50000". So: ★0→1 holds at 100 (the durable "early
//      upgrades easy" rule), the ★2-★7 forges all cost MORE than before,
//      the ★8/★9/★10 forges are pinned to the user's exact numbers, and
//      the curve stays strictly increasing.
// Run: node scripts/forge_green_price_test.mjs [file.html]
// Negative control: a pre-.747 build fails the green checks (class absent)
// and the price checks (old curve) — proving neither is a tautology.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const URL = 'file:///' + path.join(ROOT, args[0] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof renderEnhancementModal === 'function' && typeof STAR_COSTS !== 'undefined', { timeout: 60000 });
await page.evaluate(() => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
});
await page.waitForTimeout(2500);

const r = await page.evaluate(() => {
  const out = { costs: STAR_COSTS.slice() };
  game.paused = true;
  // A real inventory item so the modal renders the standard preview path.
  const it = { name: 'Test Blade', slot: 'weapon', atk: 12, tier: 1, stars: 1, price: 100 };
  player.inventory.push(it);
  const probe = (coins) => {
    player.mojicoins = coins;
    openEnhancementModal();
    renderEnhancementModal(it);
    const btn = document.getElementById('do-enhance');
    if (!btn) return { missing: true };
    const cs = getComputedStyle(btn);
    // computed background-image carries the gradient; grab its first rgb()
    const mm = (cs.backgroundImage || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    const rgb = mm ? { r: +mm[1], g: +mm[2], b: +mm[3] } : null;
    return { go: btn.classList.contains('enhance-btn-go'), disabled: btn.disabled,
             text: btn.textContent.trim(), rgb };
  };
  out.rich = probe(999999);
  out.exact = probe(STAR_COSTS[1]);          // the ★1→★2 forge, to the coin
  out.oneShort = probe(STAR_COSTS[1] - 1);
  out.broke = probe(0);
  document.getElementById('enhance-modal').style.display = 'none';
  player.inventory.pop();
  return out;
});
await browser.close();

const OLD = [100, 250, 600, 1400, 3200, 7000, 16000, 40000, 90000, 210000];
console.log(`  costs: [${r.costs.join(', ')}]`);
console.log(`  rich ${JSON.stringify(r.rich)}\n  exact ${JSON.stringify(r.exact)}\n  broke ${JSON.stringify(r.broke)}`);
check(r.costs[0] === 100, 'the ★0→1 step stays at 100 (early upgrades stay easy — durable rule)', r.costs[0]);
check(r.costs.slice(1, 7).every((c, i) => c > OLD[i + 1]), 'the ★2 through ★7 forges all cost more than before', r.costs.slice(1, 7));
check(r.costs[7] === 25000 && r.costs[8] === 35000 && r.costs[9] === 50000, 'the ★8/★9/★10 forges are exactly 25000 / 35000 / 50000 (per user)', r.costs.slice(7));
check(r.costs.every((c, i) => i === 0 || c > r.costs[i - 1]), 'the curve is still strictly increasing', r.costs);
const isGreen = (p) => p && p.rgb && p.rgb.g > p.rgb.r && p.rgb.g > p.rgb.b;
check(r.rich.go && isGreen(r.rich) && !r.rich.disabled, 'affordable → button carries the go-class and computes GREEN', r.rich);
check(/Forge ★2/.test(r.rich.text), 'and still reads Forge ★2', r.rich.text);
check(r.exact.go && isGreen(r.exact) && !r.exact.disabled, 'exactly-enough coins count as affordable (boundary is >=)', r.exact);
check(!r.oneShort.go && r.oneShort.disabled, 'one coin short → not green, disabled', r.oneShort);
check(!r.broke.go && r.broke.disabled && !isGreen(r.broke), 'broke → grey disabled button, not green', r.broke);
check(errs.length === 0, 'no page errors', errs);
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
