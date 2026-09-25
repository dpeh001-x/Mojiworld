// Live test: THE MOJIDEX (Y), POP COMIC, DARK. Per user: "for the Besiary and codex do make it more POP comic with a
// better more suitable font", then (v0.30.1090) "Make it darker themed, try to reduce the white, more black and dark
// purple" - the MojiDex, matched to the Compendium.
//
// Opens the real book (openLoreMap) on the Bestiary, a dossier and a prose section, and reads computed style: the
// pop pair (Fredoka for headings, names and labels, Nunito for reading) instead of the tome's serifs, the section
// title as a comic logo with an ink outline and a pink drop, the epigraph in a dark narration box with a yellow edge,
// dex cells as dark panels (the picked one yellow-edged), NO paper-white backgrounds anywhere in the book, the unmet
// still silhouettes, and the apex (Gravitos) entry still in its crimson.
//   node scripts/codex_pop_test.mjs [port]
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
await page.waitForFunction(() => typeof openLoreMap === 'function' && typeof _loreDexSelect === 'function', null, { timeout: 120000 });
await page.waitForTimeout(2500);
const R = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  game.mojidexSeen = game.mojidexSeen || {}; game.bestiary = game.bestiary || {};
  for (const k of ['archon', 'kingKrook']) game.mojidexSeen[k] = true; game.bestiary.archon = 6;
  document.documentElement.classList.remove('lx-nobackdrop');
  openLoreMap('bestiary'); await sleep(400);
  // an unmet cell only gets its silhouette <img> once _monsterDexSprite has the sprite; re-render until one is drawn
  for (let i = 0; i < 25 && !document.querySelector('#lore-modal .ldx-spr.ldx-dark'); i++) { await sleep(300); if (typeof _renderLoreTab === 'function') _renderLoreTab('bestiary'); }
  const cs = (sel) => { const e = document.querySelector(sel); return e ? getComputedStyle(e) : null; };
  const fam = (sel) => { const c = cs(sel); return c ? c.fontFamily : ''; };
  const h1 = cs('#lore-modal h2.cdx-h1'), epi = cs('#lore-modal .cdx-epi');
  const seen = document.querySelector('#lore-modal .ldx-cell:not(.locked):not(.on)'), sel = document.querySelector('#lore-modal .ldx-cell.on'), locked = document.querySelector('#lore-modal .ldx-cell.locked');
  const whites = () => [...document.querySelectorAll('#lore-modal *')].filter((e) => { const m = getComputedStyle(e).backgroundColor.match(/[0-9.]+/g); return m && (m.length < 4 || +m[3] > 0.5) && +m[0] >= 225 && +m[1] >= 225 && +m[2] >= 225 && e.getClientRects().length; }).map((e) => e.className || e.tagName);
  const dark = document.querySelector('#lore-modal .ldx-spr.ldx-dark'), apex = document.querySelector('#lore-modal .ldx-cell.apex .ldx-frame');
  const out = {
    h1Font: h1 && h1.fontFamily, h1Fill: h1 && (h1.webkitTextFillColor || h1.color), h1Shadow: h1 && h1.textShadow,
    epiBg: epi && epi.backgroundColor, epiEdge: epi && epi.borderLeftColor, epiFont: epi && epi.fontFamily, modalBg: (cs('#lore-modal .modal.lore-modal') || {}).backgroundColor,
    brand: fam('#lore-modal .cdx-brand'), sec: fam('#lore-modal .cdx-sec'), chip: fam('#lore-modal .cdx-chip'), cellName: fam('#lore-modal .ldx-name'),
    cellBg: seen && getComputedStyle(seen).backgroundColor, selBg: sel && getComputedStyle(sel).backgroundColor, selBorder: sel && getComputedStyle(sel).borderTopColor,
    secBg: (cs('#lore-modal .cdx-sec:not(.on)') || {}).backgroundColor, white1: whites(),
    lockedStyle: locked && getComputedStyle(locked).borderTopStyle, darkFilter: dark && getComputedStyle(dark).filter,
    apexBg: apex && getComputedStyle(apex).backgroundImage,
  };
  _loreDexSelect('archon'); await sleep(300);
  out.ddName = fam('#lore-modal .ldd-name'); out.ddSec = fam('#lore-modal .ldd-sec'); out.felledClip = (cs('#lore-modal .ldd-felled') || {}).clipPath || '';
  out.white2 = whites();
  // the speech bubble only renders for a creature with a signature line - pick one the game really has
  const sigK = Object.keys(monsterTypes).find((k) => monsterTypes[k] && monsterTypes[k].signature && monsterTypes[k].name);
  if (sigK) { game.mojidexSeen[sigK] = true; _loreDexSelect(sigK); await sleep(300); out.sigK = sigK; out.bubbleBg = (cs('#lore-modal .ldd-lore') || {}).backgroundColor; out.white2 = out.white2.concat(whites()); }
  openLoreMap('world'); await sleep(400);
  out.prose = fam('#lore-modal .lore-body p'); out.h3 = fam('#lore-modal .lore-body h3'); out.white3 = whites();
  return out;
});
await b.close(); srv.kill();
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const pop = (f) => /^"?Fredoka/.test(f || ''), read = (f) => /^"?Nunito/.test(f || '');
ok('the section title is a comic logo: Fredoka, white, inked, with a pink drop', pop(R.h1Font) && /255, 255, 255/.test(R.h1Fill) && /rgb[(]255, 61, 139[)]/.test(R.h1Shadow) && /rgb[(]12, 11, 16[)]/.test(R.h1Shadow), { font: R.h1Font, fill: R.h1Fill });
ok('its epigraph sits in a dark-purple narration box with a yellow edge, in Nunito', R.epiBg === 'rgb(29, 22, 40)' && R.epiEdge === 'rgb(255, 228, 92)' && read(R.epiFont), { bg: R.epiBg, edge: R.epiEdge, font: R.epiFont });
ok('the page is black, the rail tabs dark panels', R.modalBg === 'rgb(12, 11, 16)' && R.secBg === 'rgb(21, 19, 28)', { modal: R.modalBg, tab: R.secBg });
ok('no paper-white backgrounds anywhere in the book (dex, dossier, prose)', !R.white1.length && !R.white2.length && !R.white3.length, { dex: R.white1.slice(0, 4), dossier: R.white2.slice(0, 4), prose: R.white3.slice(0, 4) });
ok('the brand, the rail, the filters and the dex names are in Fredoka (no Cinzel / Alegreya)', [R.brand, R.sec, R.chip, R.cellName].every(pop), { brand: R.brand, sec: R.sec, chip: R.chip, name: R.cellName });
ok('the dossier: name and section heads in Fredoka, the kill count in a POW burst', pop(R.ddName) && pop(R.ddSec) && /polygon/.test(R.felledClip), { name: R.ddName, sec: R.ddSec });
ok('prose reads in Nunito, headings in Fredoka (no Cormorant)', read(R.prose) && pop(R.h3), { prose: R.prose, h3: R.h3 });
ok('a met creature is a dark panel, the picked one dark purple with a yellow edge; the creature line a dark bubble', R.cellBg === 'rgb(21, 19, 28)' && R.selBg === 'rgb(36, 26, 51)' && R.selBorder === 'rgb(255, 228, 92)' && R.bubbleBg === 'rgb(29, 22, 40)', { bg: R.cellBg, sel: R.selBg, edge: R.selBorder, bubble: R.bubbleBg, of: R.sigK });
ok('the unmet are dashed panels and still silhouettes', R.lockedStyle === 'dashed' && /brightness\(0\)/.test(R.darkFilter || ''), { style: R.lockedStyle, filter: R.darkFilter });
ok('the apex entry keeps its crimson frame', !R.apexBg || /96, 18, 40/.test(R.apexBg), (R.apexBg || '').slice(0, 90));
ok('no page errors', errs.length === 0, errs.slice(0, 3));
for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? '').slice(0, 260));
console.log(`${results.filter((q) => q.pass).length}/${results.length} checks passed`);
process.exit(results.every((q) => q.pass) ? 0 : 1);
