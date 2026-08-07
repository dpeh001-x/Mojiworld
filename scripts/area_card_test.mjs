// v0.29.491 — the area entry card: thicker lettering, more opaque shadow, and
// the SAME custom region icon the world-map (W) node shows.
//
//   node serve.js 8851 && node scripts/area_card_test.mjs 8851 [page]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const PORT = process.argv[2] || '8851';
const PAGE = process.argv[3] || 'mojiworld_game.html';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block' })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
const net = [];
page.on('response', r => { if (/world\/regions\//.test(r.url())) net.push({ s: r.status(), f: r.url().split('/').pop() }); });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => { try { return typeof eval('_lxAreaTitle') === 'function'; } catch { return false; } }, null, { timeout: 180000 });

const r = await page.evaluate(async () => {
  const g = eval('game');
  const el = document.getElementById('area-title');
  const show = (id) => { g._lastAreaCard = null; eval('_lxAreaTitle')(id); };

  // 'forest' IS Emerald Thicket, and it has a region sprite.
  show('forest');
  const nm = el.querySelector('.at-name'), ic = el.querySelector('.at-icon');
  const cs = getComputedStyle(nm);
  const img = ic.querySelector('img');
  let imgOk = false;
  if (img) { try { await img.decode(); imgOk = img.naturalWidth > 0; } catch (e) { imgOk = false; } }
  const withRegion = {
    name: nm.textContent,
    weight: +cs.fontWeight,
    strokeW: parseFloat(cs.webkitTextStrokeWidth || '0'),
    filter: cs.filter,
    usesImg: !!img,
    src: img && img.getAttribute('src'),
    decoded: imgOk,
    natural: img ? img.naturalWidth + 'x' + img.naturalHeight : null,
  };
  // A map with NO region sprite must still show something (the emoji).
  const MP = eval('MAPS');
  const noRegion = Object.keys(MP).find(k => MP[k] && MP[k].name && !MP[k].isVoid && !MP[k].isBossArena
    && !(typeof WM_REGION_ICON_IDS !== 'undefined' && WM_REGION_ICON_IDS.has(k)));
  let fallback = null;
  if (noRegion) {
    show(noRegion);
    const ic2 = el.querySelector('.at-icon');
    fallback = { id: noRegion, hasImg: !!ic2.querySelector('img'), text: (ic2.textContent || '').trim() };
  }
  const subCs = getComputedStyle(el.querySelector('.at-sub'));
  return { withRegion, fallback, subShadow: subCs.textShadow };
});

ok('the card names the map', r.withRegion.name === 'Emerald Thicket', { name: r.withRegion.name });

// 1. thicker
ok('THICKER: font-weight raised to 800', r.withRegion.weight >= 800, { weight: r.withRegion.weight });
ok('THICKER: a hairline stroke adds real weight (font-weight alone is weak here)',
   r.withRegion.strokeW >= 0.5, { strokeWidth: r.withRegion.strokeW });

// 2. more opaque
const alphas = [...String(r.withRegion.filter).matchAll(/rgba?\([^)]*?([\d.]+)\s*\)/g)].map(m => +m[1]);
ok('MORE OPAQUE: the darkest name shadow is >= 0.80 (was 0.62)',
   Math.max(...alphas) >= 0.8, { alphas, filter: String(r.withRegion.filter).slice(0, 110) });
ok('MORE OPAQUE: the sub-line gained a tight dark seat',
   /0\.8[0-9]|0\.86/.test(String(r.subShadow)), { subShadow: String(r.subShadow).slice(0, 110) });

// 3. the world-map icon
ok('ICON: renders an <img>, not an emoji glyph', r.withRegion.usesImg === true, r.withRegion);
ok('ICON: points at the same region sprite the W node uses',
   r.withRegion.src === 'Sprites/world/regions/forest.webp', { src: r.withRegion.src });
ok('ICON: the sprite actually loads and decodes', r.withRegion.decoded === true, { natural: r.withRegion.natural });
ok('ICON: it was fetched successfully', net.some(x => x.s === 200 && x.f === 'forest.webp'), net.slice(0, 3));
if (r.fallback) {
  ok('ICON: a map with no region sprite still shows the emoji fallback',
     r.fallback.hasImg === false && r.fallback.text.length > 0, r.fallback);
}
ok('no page errors', errs.length === 0, errs.slice(0, 3));

await b.close();
let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
