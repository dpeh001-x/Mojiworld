import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const URL = 'http://localhost:8080/mojiworld_game.html';
// Resolve a browser that actually EXISTS. The Linux path stays first so CI is
// untouched, but it is the only candidate this line used to have - and with
// PW_EXE unset on a dev machine that made the launch throw before a single
// assertion ran. 66 scripts shared the line, so 66 gates were passing by never
// executing. Falling through to the local Chrome is what the tests that do run
// already rely on (they pass channel:'chrome').
const EXE = [process.env.PW_EXE,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find((p) => p && existsSync(p));
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

// v0.29.9 — Per user: the painted SYMBOL now shows on UNVISITED nodes too
// (was fog-gated). The NAME/level stay fogged as "???"; only the icon reveals.
const undisc = await page.evaluate(() => {
  const seen = new Set(Object.keys(game.visitedMaps || {}));
  const cand = [...WM_REGION_ICON_IDS].find(id => !seen.has(id) && MAPS[id]);
  if (!cand) return { skipped: true };
  const node = document.querySelector('#worldmap-grid [data-map-id="' + cand + '"]');
  const hrefs = node ? Array.from(node.querySelectorAll('image'))
    .map(im => im.getAttribute('href') || im.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || '') : [];
  const spriteShown = hrefs.some(h => h === 'Sprites/world/regions/' + cand + '.webp');
  const labelText = node ? Array.from(node.querySelectorAll('.wm-node-label, text'))
    .map(t => t.textContent).join(' ') : '';
  const nameFogged = /\?\?\?/.test(labelText) && !(labelText.includes((MAPS[cand].name || '')) && (MAPS[cand].name || '').length > 2);
  return { cand, spriteShown, nameFogged, labelText };
});
ok('undiscovered region NOW shows its painted symbol', undisc.skipped || undisc.spriteShown, undisc);
ok('undiscovered region keeps its NAME fogged as "???"', undisc.skipped || undisc.nameFogged, undisc);

ok('no page errors', errs.length === 0, errs.slice(0, 3));
console.log(`\n${pass}/${pass + fail} checks passed`);
await browser.close();
process.exit(fail ? 1 : 0);
