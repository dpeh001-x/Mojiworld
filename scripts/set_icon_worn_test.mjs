// SET ICONS = THE WORN ART (per user, after the gear audit: the five legendary sets' icons were "completely different drawings";
// "change only the 10 set icons"). Each of the ten set pieces' inventory icon now shows exactly what the hero wears.
//   [1] each set icon's pixels match the art the hero wears (the baked erase, else the equipment file): mean difference small
//   [2] they do NOT match the old Sprites/items/ drawings any more
//   [3] every other piece's icon is untouched - still its equipment file
//   [4] in a real inventory render each set icon is an <img> that loads (with the inventory's ink outline)
//   [5] no page errors
// The build before fails [1] and [2].   node scripts/set_icon_worn_test.mjs [page.html] [port]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html', PORT = +(process.argv[3] || process.env.PORT || 11899);
const PAGE_URL = (path.isAbsolute(PAGE) ? path.relative(ROOT, PAGE) : PAGE).split(path.sep).join('/');
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 600) + ']' : '')); };
const SETS = { dawnshard_blade: 'weapons', doomforged_greatsword: 'weapons', shadowweave_dagger: 'weapons', skyhunter_longbow: 'weapons', voidcaller_staff: 'weapons',
  dawnshard_aegis: 'armors', doomforged_plate: 'armors', shadowweave_cloak: 'armors', skyhunter_vest: 'armors', voidcaller_robe: 'armors' };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${PAGE_URL}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof itemIconHtml === 'function' && typeof LX_ITEMS === 'object' && typeof renderInventory === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(2000);
  const R = await page.evaluate(async (SETS) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), N = 128;
    const icon = (k) => LX_ITEMS['_pending_' + k];
    const worn = (k, cat) => _lxEqErasedImg((cat === 'weapons' ? 'wpn:' : 'arm:') + k) || _lxEquipSprite(cat, k);
    const old = {}; for (const k in SETS) { const im = new Image(); im.src = 'Sprites/items/' + k + '.webp'; old[k] = im; }
    for (const k in SETS) { const ic = icon(k); if (ic && ic._lxLazy && typeof _lxWantImg === 'function') _lxWantImg(ic, true); worn(k, SETS[k]); }
    for (let i = 0; i < 200; i++) { if (Object.keys(SETS).every((k) => { const a = icon(k), b = worn(k, SETS[k]), c = old[k]; return a && a.complete && a.naturalWidth && b && b.complete && b.naturalWidth && c.complete && c.naturalWidth; })) break; await sleep(100); }
    const px = (img) => { const c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, N, N); return g.getImageData(0, 0, N, N).data; };
    const diff = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return +(s / a.length).toFixed(2); };
    const sets = {};
    for (const k in SETS) { const a = icon(k), b = worn(k, SETS[k]);
      sets[k] = (a && a.naturalWidth && b && b.naturalWidth) ? { worn: diff(px(a), px(b)), old: diff(px(a), px(old[k])), src: a.src.slice(0, 40) } : { err: 'not loaded', src: a && a.src }; }
    // every other piece: still its equipment file
    const others = []; for (const cat of ['weapons', 'armors']) for (const k of LX_EQUIP_FILES[cat]) { if (SETS[k]) continue; const a = icon(k);
      const want = 'Sprites/equipment/' + cat + '/' + k + '.webp'; if (!a || decodeURIComponent(new URL(a.src, location.href).pathname).indexOf('/' + want) < 0) others.push(k); }
    // a real inventory render with the ten set pieces
    const pool = [].concat(ITEM_POOL.weapons, ITEM_POOL.armors), items = Object.keys(SETS).map((k) => pool.find((d) => _itemKey(d) === k)).filter(Boolean)
      .map((d) => ({ ...d, slot: SETS[_itemKey(d)] === 'weapons' ? 'weapon' : 'armor', stars: 0, level: 10 }));
    player.inventory = (player.inventory || []).filter((it) => _itemTab(it) !== 'equip').concat(items);
    const modal = document.getElementById('inventory-modal'); modal.style.display = 'flex'; game._invTab = 'equip'; renderInventory('');
    await sleep(500);
    const inv = {}; for (const it of items) { const im = [...modal.querySelectorAll('img')].find((q) => q.getAttribute('alt') === it.name);
      inv[_itemKey(it)] = im ? { ok: im.complete && im.naturalWidth > 0, filter: getComputedStyle(im).filter.slice(0, 30), sameAsIcon: im.src === icon(_itemKey(it)).src } : null; }
    modal.style.display = 'none';
    return { sets, others, inv };
  }, SETS);
  const K = Object.keys(SETS);
  ok('[1] each set icon is the art the hero wears (mean pixel difference under 2)', K.every((k) => R.sets[k] && R.sets[k].worn < 2), R.sets);
  ok('[2] none of them is the old Sprites/items/ drawing any more (mean difference over 10)', K.every((k) => R.sets[k] && R.sets[k].old > 10), Object.fromEntries(K.map((k) => [k, R.sets[k] && R.sets[k].old])));
  ok('[3] every other piece\'s icon is untouched - still its equipment file', R.others.length === 0, R.others);
  ok('[4] in the inventory each set icon is a loaded <img> of that art, with the ink outline', K.every((k) => R.inv[k] && R.inv[k].ok && R.inv[k].sameAsIcon && /url/.test(R.inv[k].filter)), R.inv);
  ok('[5] no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 300), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
