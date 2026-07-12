import { chromium } from 'playwright-core';
const URL = 'http://localhost:8090/mojiworld_game.html';
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const page = await (await browser.newContext()).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e)));
let pass = 0, fail = 0;
const ok = (n, c, d) => { (c ? pass++ : fail++); console.log((c ? 'PASS  ' : 'FAIL  ') + n + (d ? '  ' + JSON.stringify(d) : '')); };

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => { const a = document.getElementById('lo-auth'); return a && !a.hidden; }, null, { timeout: 45000 }).catch(() => {});
await page.click('#menu-newgame').catch(() => {});
await page.waitForSelector('#auth-user', { state: 'visible', timeout: 10000 }).catch(() => {});
await page.fill('#auth-user', 'Mapper').catch(() => {});
await page.click('#auth-submit').catch(() => {});
await page.waitForFunction(() => { const c = document.getElementById('class-select-modal'); return c && getComputedStyle(c).display !== 'none'; }, null, { timeout: 15000 }).catch(() => {});
await page.evaluate(() => { try { applyClass('warrior'); } catch (e) {} });
await page.waitForTimeout(1500);

// Mark a spread of regions visited so the fog gate reveals their sprites, then render.
const TEST_IDS = ['town', 'forest', 'mushroom', 'glasswindSteppe', 'boss', 'abyssalTrench'];
const res = await page.evaluate((ids) => {
  game.visitedMaps = game.visitedMaps || {};
  ids.forEach(id => { game.visitedMaps[id] = true; });
  if (typeof renderWorldMap === 'function') renderWorldMap();
  const imgs = Array.from(document.querySelectorAll('#worldmap-modal image, #worldmap-grid image'))
    .map(im => im.getAttribute('href') || im.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || '')
    .filter(h => h.indexOf('Sprites/world/regions/') === 0);
  const manifestOk = typeof WM_REGION_ICON_IDS !== 'undefined' && WM_REGION_ICON_IDS.size >= 15;
  return { hrefs: imgs, count: imgs.length, manifestSize: (typeof WM_REGION_ICON_IDS !== 'undefined' ? WM_REGION_ICON_IDS.size : 0), manifestOk };
}, TEST_IDS);

ok('WM_REGION_ICON_IDS manifest present (>=15)', res.manifestOk, { size: res.manifestSize });
ok('region-sprite <image> elements rendered for visited maps', res.count >= TEST_IDS.length, { count: res.count, want: TEST_IDS.length });
ok('sprite hrefs point at Sprites/world/regions/', res.hrefs.every(h => h.startsWith('Sprites/world/regions/')), res.hrefs.slice(0, 3));

// Each referenced sprite actually loads (HTTP 200 + decodes).
const loadResults = await page.evaluate(async (hrefs) => {
  const uniq = [...new Set(hrefs)];
  const out = [];
  for (const h of uniq) {
    const r = await new Promise(res => { const im = new Image(); im.onload = () => res(im.naturalWidth > 0); im.onerror = () => res(false); im.src = h; });
    out.push([h.split('/').pop(), r]);
  }
  return out;
}, res.hrefs);
ok('every rendered region sprite loads (naturalWidth>0)', loadResults.every(([, r]) => r), loadResults.filter(([, r]) => !r).map(([n]) => n));

// Fog-of-war: an UNVISITED region must NOT leak a sprite.
const leak = await page.evaluate(() => {
  const seen = new Set(Object.keys(game.visitedMaps || {}));
  // pick a region id in the manifest that is NOT visited
  const cand = [...WM_REGION_ICON_IDS].find(id => !seen.has(id) && MAPS[id]);
  if (!cand) return { skipped: true };
  const imgs = Array.from(document.querySelectorAll('#worldmap-grid image'))
    .map(im => im.getAttribute('href') || '').filter(Boolean);
  return { cand, leaked: imgs.some(h => h === 'Sprites/world/regions/' + cand + '.webp') };
});
ok('fog-safe: unvisited region does not render its sprite', leak.skipped || !leak.leaked, leak);

ok('no page errors', errs.length === 0, errs.slice(0, 3));
console.log(`\n${pass}/${pass + fail} checks passed`);
await browser.close();
process.exit(fail ? 1 : 0);
