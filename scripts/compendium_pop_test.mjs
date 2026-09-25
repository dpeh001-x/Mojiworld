// Live test: THE COMPENDIUM, POP PUNK. Per user: "For the U compendium could you ensure that the monsters picture is
// placed on the circle, ensure blackoutline, the bestiary seems to be the same thing so for the U compendium can cut
// down make a more pop punk style, the information can be more infographics style".
//
// Opens the real Compendium (openMojidex) with a few creatures on record and grades what the player sees: every
// seen creature's own art ON its disc, placed and inked (list and dossier), the dossier as infographic tiles plus a
// mastery ring with no lore quote and no section headings, an unseen creature as a "?" disc, and the whole window
// inside the 960x560 game box.
//   node scripts/compendium_pop_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import net from 'node:net';
import { spawn } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const free = (p) => new Promise((r) => { const s = net.createServer(); s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2]; for (let p = 18631; p <= 18729 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore', env: { ...process.env, MOJI_GAME_FILE: process.env.MOJI_GAME_FILE || '' } });
await new Promise((r) => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof openMojidex === 'function' && typeof loadMap === 'function', null, { timeout: 120000 });
await page.waitForLoadState('load', { timeout: 120000 }).catch(() => {});
await page.evaluate(() => {
  try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  const c = document.querySelector('.cls-card'); if (c && !player.cls) { try { c.click(); } catch (e) {} }
  player._storyBeatsSeen = new Proxy({}, { get: () => true });
  loadMap('town', 400); game.paused = false;
  game.mojidexSeen = game.mojidexSeen || {}; game.bestiary = game.bestiary || {};
  for (const k of ['archon', 'kingKrook', 'octobaby'].concat(_mjxAllTypes().slice(0, 8))) game.mojidexSeen[k] = true;
  game.bestiary.archon = 6;
});
await page.waitForTimeout(2500);
const readDossier = () => page.evaluate(() => {
  const d = document.getElementById('mjx-detail'), im = d.querySelector('.mjx-disc img'), disc = d.querySelector('.mjx-disc');
  const cs = im ? getComputedStyle(im) : null;
  return { img: !!im, placed: !!(im && im.classList.contains('mjx-in') && cs.visibility === 'visible' && im.offsetWidth > 60),
    inked: !!(cs && /drop-shadow/.test(cs.filter) && /rgb\(12, 11, 16\)/.test(cs.filter)), onDisc: !!(im && disc && im.parentElement === disc),
    tiles: [...d.querySelectorAll('.mjx-tile .tl')].map((e) => e.textContent), nums: [...d.querySelectorAll('.mjx-tile .tv')].map((e) => e.textContent),
    ring: !!d.querySelector('.mjx-mring'), lore: !!d.querySelector('.mjx-lore'), sections: d.querySelectorAll('.mjx-section').length,
    stickers: [...d.querySelectorAll('.mjx-sticker')].map((e) => e.textContent), q: /\?/.test((d.querySelector('.mjx-disc') || {}).textContent || '') };
});
await page.evaluate(() => { _MJX.sel = 'kingKrook'; openMojidex(); });
await page.waitForFunction(() => !!document.querySelector('#mjx-detail .mjx-disc img.mjx-in'), null, { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(600);
const krook = await readDossier();
const shell = await page.evaluate(() => {
  const m = document.querySelector('#mojidex-modal .mjx-modal').getBoundingClientRect(), box = (document.querySelector('.game-wrapper') || document.body).getBoundingClientRect();
  const thumbs = [...document.querySelectorAll('#mjx-list .mjx-row:not(.locked) .mjx-dot img')];
  return { fits: m.top >= box.top - 1 && m.bottom <= box.bottom + 1, mh: Math.round(m.height), bh: Math.round(box.height),
    font: getComputedStyle(document.querySelector('#mojidex-modal .mjx-title')).fontFamily,
    seenRows: document.querySelectorAll('#mjx-list .mjx-row:not(.locked)').length, thumbs: thumbs.length,
    placedThumbs: thumbs.filter((im) => im.classList.contains('mjx-in') && im.offsetWidth > 10).length,
    thumbInked: thumbs.length ? /drop-shadow/.test(getComputedStyle(thumbs[0]).filter) : false };
});
await page.evaluate(() => { _mjxSelect('archon'); });
await page.waitForFunction(() => !!document.querySelector('#mjx-detail .mjx-disc img.mjx-in'), null, { timeout: 8000 }).catch(() => {});
const archon = await readDossier();
const unseen = await page.evaluate(() => { const k = _mjxAllTypes().find((x) => !_mjxSeen(x)); _mjxSelect(k); return k; });
const locked = await readDossier();
await b.close(); srv.kill();
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
ok('the creature\'s own picture sits ON its disc, placed (King Krook)', krook.img && krook.onDisc && krook.placed, krook);
ok('...inked with a black outline', krook.inked, { inked: krook.inked });
ok('...and for an ordinary beast too (Archon)', archon.placed && archon.inked, archon);
ok('the list: every seen creature has its picture on its disc, and the visible ones are placed and inked', shell.seenRows >= 5 && shell.thumbs === shell.seenRows && shell.placedThumbs >= 4 && shell.thumbInked, shell);
ok('infographics: four stat tiles with numbers, and a mastery ring', krook.tiles.join() === 'VIGOR,POWER,WARD,EVASION' && krook.nums.every((v) => /\d/.test(v)) && krook.ring, { tiles: krook.tiles, nums: krook.nums });
ok('cut down: no lore quote and no section headings on the card', !krook.lore && krook.sections === 0, { lore: krook.lore, sections: krook.sections });
ok('stickers for tier and level', krook.stickers.includes('BOSS') && krook.stickers.some((s) => /^LV \d+$/.test(s)), krook.stickers);
ok('an undiscovered creature is a "?" disc', !!unseen && locked.q && !locked.img, { unseen, locked });
ok('the window fits the 960x560 game box, title in the pop face', shell.fits && /Fredoka/.test(shell.font), { mh: shell.mh, bh: shell.bh, font: shell.font });
ok('no page errors', errs.length === 0, errs.slice(0, 3));
for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? '').slice(0, 300));
console.log(`${results.filter((q) => q.pass).length}/${results.length} checks passed`);
process.exit(results.every((q) => q.pass) ? 0 : 1);
