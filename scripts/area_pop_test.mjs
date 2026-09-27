// The area entry card, pop punk (final polish, area-pop). Per user, on "EVERDAWN CENTRAL": "make it more POP and PUNK style
// including the icons". Held: the name is chunky Nunito caps in butter yellow with an ink outline on a berry slab with an ink
// edge; the icon is a die-cut sticker on a yellow comic burst; the level line is on black tape; a two-part name keeps the plate
// narrow (the sub-area on its own smaller line); every drop is a filter, so html.lx-nobackdrop (which strips box-shadows) keeps
// the look; and the region icon still resolves exactly as the world map's does.
//   node scripts/area_pop_test.mjs [page.html] [port]    (MOJI_GAME_FILE / this repo's game by default)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html', PORT = +(process.argv[3] || 9947);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ ...(process.env.PW_EXE ? { executablePath: process.env.PW_EXE } : { channel: 'msedge' }), headless: true, args: ['--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof _lxAreaTitle === 'function', null, { timeout: 180000 });
await page.waitForTimeout(3000);
const r = await page.evaluate(async () => {
  const el = document.getElementById('area-title');
  const show = (id) => { game._lastAreaCard = null; window._prologueActive = false; _lxAreaTitle(id); };
  const read = () => {
    const nm = el.querySelector('.at-name'), ic = el.querySelector('.at-icon'), sub = el.querySelector('.at-sub'), img = ic.querySelector('img');
    const n = getComputedStyle(nm), i = getComputedStyle(ic, '::after'), ib = getComputedStyle(ic, '::before'), s = getComputedStyle(sub), g = img ? getComputedStyle(img) : null;
    return { text: nm.childNodes[0] ? nm.childNodes[0].textContent : '', part: (nm.querySelector('.at-part') || {}).textContent || null,
      family: n.fontFamily, weight: +n.fontWeight, upper: n.textTransform, fill: n.webkitTextFillColor, stroke: parseFloat(n.webkitTextStrokeWidth),
      slab: n.backgroundImage, border: n.borderTopColor + ' ' + n.borderTopWidth, nameFilter: n.filter, width: nm.getBoundingClientRect().width,
      wrapW: document.querySelector('.game-wrapper').getBoundingClientRect().width,
      burst: i.clipPath.slice(0, 8), burstBg: i.backgroundImage.slice(0, 16), ink: ib.backgroundColor,
      imgFilter: g ? g.filter : null, src: img ? img.getAttribute('src') : null, subBg: s.backgroundColor, subShown: s.display !== 'none' };
  };
  show('town'); const town = read();
  const two = Object.keys(MAPS).find((k) => MAPS[k].name && / · /.test(MAPS[k].name) && !MAPS[k].isVoid && !MAPS[k].isBossArena);
  show(two); const split = read(); split.id = two; split.full = MAPS[two].name;
  const lvMap = Object.keys(MAPS).find((k) => MAPS[k].name && (+MAPS[k].levelReq || 0) > 1 && !MAPS[k].isVoid && !MAPS[k].isBossArena);
  show(lvMap); const lv = read();
  document.documentElement.classList.add('lx-nobackdrop'); show('town'); const nb = read(); document.documentElement.classList.remove('lx-nobackdrop');
  return { town, split, lv, nb };
});
await browser.close(); server.kill();
let fails = 0; const ok = (n, c, x) => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}  ${c ? '' : JSON.stringify(x).slice(0, 260)}`); };
const t = r.town;
ok('the name is chunky Nunito caps, butter yellow with a real ink outline', /Nunito/.test(t.family) && t.weight >= 900 && t.upper === 'uppercase' && t.fill === 'rgb(255, 224, 122)' && t.stroke >= 4, t);
ok('it sits on a berry slab with an ink edge and a hard drop', /linear-gradient/.test(t.slab) && /rgb\(13, 10, 20\) 3px/.test(t.border) && /drop-shadow\(rgb\(13, 10, 20\) 5px 5px/.test(t.nameFilter), t);
ok('the icon is a sticker (white + ink rim, hard drop) on a comic burst', /drop-shadow\(rgb\(255, 255, 255\)/.test(t.imgFilter || '') && t.burst === 'polygon(' && /gradient/.test(t.burstBg) && t.ink === 'rgb(13, 10, 20)', t);
ok('the icon still comes from the same region sprite the world map shows', t.src === 'Sprites/world/regions/town.webp', t.src);
ok('a two-part name keeps the plate narrow: the sub-area on its own line', r.split.part && r.split.text && !r.split.text.includes('·') && r.split.width < r.split.wrapW * 0.75, r.split);
ok('the level line is on black tape', r.lv.subShown && r.lv.subBg === 'rgb(13, 10, 20)', r.lv);
ok('the look survives lx-nobackdrop (filters, not box-shadows)', /drop-shadow/.test(r.nb.nameFilter) && /drop-shadow/.test(r.nb.imgFilter || ''), r.nb);
ok('no page errors', errs.length === 0, errs.slice(0, 3));
console.log(fails ? `FAIL(${fails})` : 'ALL PASS');
process.exit(fails ? 1 : 0);
