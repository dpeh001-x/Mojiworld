// BOON CARDS: every number on a card is in the sentence's own units, and true.
// ============================================================================
// Per user (Lifesteal card reading "Heal 1.5% of damage dealt / Roll 15 ·
// range 5-15"): "inaccurate boon description: i think you mean 0.5 to 1.5%.
// ensure other boon descriptions are completely accurate".
//
// The roll and range were printed in raw roll units (tenths of a percent for
// Lifesteal, tenths of a second for Mirror Step, an inverted count for Second
// Skin) while the sentence spoke in percent or seconds. Now a shared formatter
// derives the value from the sentence itself, the range follows the level
// band the roll is actually drawn from, and the sentences that hid their
// effect (Burning Touch, Mana Surge) say what they do.
// Run: node scripts/boon_desc_test.mjs   (MOJI_GAME_FILE / MOJI_SERVE_ROOT override)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 9891);
const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const SERVE_JS = existsSync(path.join(SERVE_ROOT, 'serve.js')) ? path.join(SERVE_ROOT, 'serve.js') : path.join(ROOT, 'serve.js');
const server = spawn(process.execPath, [SERVE_JS, String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT });
await new Promise((r) => setTimeout(r, 1200));
const EXE = [process.env.PW_EXE, process.env.MOJI_PW_EXE,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => p && existsSync(p));
const browser = await chromium.launch({ channel: EXE ? undefined : 'msedge', executablePath: EXE || undefined, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 150)));
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof game === 'object' && typeof POWERUPS !== 'undefined', null, { timeout: 180000 });
await page.waitForTimeout(6000);
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 240) });
const ev = async (fn, arg) => { try { return await page.evaluate(fn, arg); } catch (e) { return { err: String(e).slice(0, 160) }; } };

const r = await ev(() => {
  const has = typeof _boonValText === 'function' && typeof _boonRangeText === 'function' && typeof _boonBand === 'function';
  if (!has) return { has };
  const bad = [];
  for (const def of POWERUPS) {
    const band = _boonBand(def);                              // lvlScale boons range over the level band, not the table
    const lo = _boonValText(def, band.lo), hi = _boonValText(def, band.hi);
    if (!lo || !hi) { bad.push(def.id + ': empty value'); continue; }
    // the value is the sentence's own number — or, for a sentence that changes in several places, the raw roll + unit
    const okVal = (r, v) => def.fmt(r).includes(v) || v === String(r) + (def.unit || '');
    if (!okVal(band.lo, lo) || !okVal(band.hi, hi)) bad.push(def.id + ': value not in sentence (' + lo + '/' + hi + ')');
    const rg = _boonRangeText(def);
    if (band.lo !== band.hi && !(rg.includes(lo) && rg.includes(hi))) bad.push(def.id + ': range ' + rg);
  }
  const ls = POWERUPS.find((p) => p.id === 'ls'), skin = POWERUPS.find((p) => p.id === 'skin'), mirror = POWERUPS.find((p) => p.id === 'mirror'), atk = POWERUPS.find((p) => p.id === 'atk'), burn = POWERUPS.find((p) => p.id === 'burn'), mp = POWERUPS.find((p) => p.id === 'mpreg');
  const lsVal = _boonValText(ls, 15), lsRange = _boonRangeText(ls);
  const skinRange = _boonRangeText(skin), mirrorRange = _boonRangeText(mirror);
  // the level band: at Lv 45 Keen Edge rolls inside [27, 55], never the table's 10..110
  const lv0 = player.level; player.level = 45;
  const band = _boonBand(atk); const rolls = []; for (let i = 0; i < 300; i++) rolls.push(_rollBoonValue(atk));
  const atkRange = _boonRangeText(atk); player.level = lv0;
  const rmin = Math.min(...rolls), rmax = Math.max(...rolls);
  // the panel: an equipped Lifesteal at roll 15 prints its numbers in percent
  const hadBoons = player.boons, hadEq = player.boonsEquipped;
  player.boons = [{ id: 'ls', roll: 15, rerolls: 0 }]; player.boonsEquipped = [0];   // the panel reads equipped SLOT indices
  let panelHtml = '';
  try {
    if (typeof openLevelUpPanel === 'function') openLevelUpPanel();   // builds the loadout DOM (#lp-boons) lazily
    if (typeof renderBoonPanel === 'function') renderBoonPanel();
    const el = document.getElementById('lp-boons'); panelHtml = el ? el.innerHTML : '';
    if (typeof closeAllModals === 'function') closeAllModals();
  } catch (e) { panelHtml = 'ERR ' + e; }
  player.boons = hadBoons; player.boonsEquipped = hadEq;
  return { has, bad, lsVal, lsRange, skinRange, mirrorRange, band, rmin, rmax, atkRange, burn2: burn.fmt(2), burn3: burn.fmt(3), mp5: mp.fmt(5), panelHas: /Roll 1\.5%/.test(panelHtml) && /0\.5%.{1,3}1\.5%/.test(panelHtml), panelRaw: /range 5-15/.test(panelHtml), panelLen: panelHtml.length };
});
ok('the shared boon value/range formatters exist', !r.err && r.has, r.err || '');
ok('every boon: its formatted value is literally the number the sentence shows (both ends of the range)', !r.err && r.bad && r.bad.length === 0, r.err || (r.bad && r.bad.join(' | ')));
ok('Lifesteal: roll 15 reads 1.5%, and the range reads 0.5%–1.5% (was "5-15")', !r.err && r.lsVal === '1.5%' && /^0\.5%.{1,3}1\.5%$/.test(r.lsRange || ''), r.err || `${r.lsVal} / ${r.lsRange}`);
ok('Second Skin: its inverted count reads as seconds, low to high (8s–14s); Mirror Step in seconds (1.5s–3.0s)', !r.err && /^8s.{1,3}14s$/.test(r.skinRange || '') && /^1\.5s.{1,3}3\.0s$/.test(r.mirrorRange || ''), r.err || `${r.skinRange} / ${r.mirrorRange}`);
ok('Keen Edge at Lv 45: the range shown is the level band the roll is drawn from (27–55), not the table\'s 10–110', !r.err && r.band && r.band.lo === 27 && r.band.hi === 55 && r.rmin >= 27 && r.rmax <= 55 && /27.{1,3}55/.test(r.atkRange || ''), r.err || `band ${JSON.stringify(r.band)} rolls ${r.rmin}-${r.rmax} range "${r.atkRange}"`);
ok('Burning Touch says what it does: ×2 → 40% chance, 16% of the hit per tick for 3s; ×3 → 60% / 24%', !r.err && /40%/.test(r.burn2) && /16%/.test(r.burn2) && /3s/.test(r.burn2) && /60%/.test(r.burn3) && /24%/.test(r.burn3), r.err || `${r.burn2} | ${r.burn3}`);
ok('Mana Surge says what a tier is (regen interval), not just "+5 tier"', !r.err && /every|interval|faster|s\b/.test(r.mp5 || '') && !/tier\s*$/.test(r.mp5 || ''), r.err || r.mp5);
ok('the boon panel prints an equipped Lifesteal as "Roll 1.5% · range 0.5%–1.5%", never "range 5-15"', !r.err && r.panelLen > 0 && r.panelHas && !r.panelRaw, r.err || `len ${r.panelLen} has ${r.panelHas} raw ${r.panelRaw}`);
ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' · '));

await browser.close(); server.kill();
let fail = 0;
for (const x of res) { if (!x.pass) fail++; console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.extra ? '  — ' + x.extra : '')); }
console.log(`\n${res.length - fail}/${res.length} checks passed`);
process.exit(fail ? 1 : 0);
