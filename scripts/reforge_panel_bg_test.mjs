// Live test: THE REFORGE BENCH CONFIRM WEARS ITS PERSONA-5 PLATE - AND ONLY IT.
//
// Per user (with a screenshot of the plain confirm box): "generate a nice
// background similar to the persona 5 style we have been using for this".
//   ASSET - Sprites/ui/panel_p5_reforge.webp is 1200x670 at a FLAT 20% alpha
//           (the panel_p5_shop / _enhance recipe) with a calm centre: the
//           luminance stddev where the copy sits is <= 0.55x the corners'
//   GAME  - uiConfirm({ skin: 'reforge' }) puts skin-reforge on #confirm-modal
//           and the dialog's computed background-image resolves the plate
//           (served 200, not a 404 painted over by the gradient)
//   SCOPE - after that dialog resolves, a PLAIN uiConfirm has no skin class
//           and no plate - the skin never leaks to delete-save / prestige
//   node scripts/reforge_panel_bg_test.mjs
import { chromium } from 'playwright-core';
import { existsSync, readFileSync } from 'node:fs';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp'); sharp.cache(false);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const SHOT = process.env.REFORGE_SHOT || '';

// ---- asset -----------------------------------------------------------------
const ART = 'Sprites/ui/panel_p5_reforge.webp';
const buf = readFileSync(ART);
const meta = await sharp(buf).metadata();
const st = await sharp(buf).stats();
const A = st.channels[3];
ok('panel_p5_reforge.webp is a 1200x670 plate with alpha', meta.width === 1200 && meta.height === 670 && meta.hasAlpha,
  { w: meta.width, h: meta.height, alpha: meta.hasAlpha });
ok('...baked at a FLAT 20% alpha like the shop / enhance plates', Math.round(A.mean) === 51 && A.min === A.max,
  { mean: A.mean, min: A.min, max: A.max });
const busy = async (left, top, width, height) => {
  const { data } = await sharp(buf).flatten({ background: { r: 11, g: 7, b: 18 } })
    .extract({ left, top, width, height }).removeAlpha().greyscale().raw().toBuffer({ resolveWithObject: true });
  let s = 0, s2 = 0; for (let i = 0; i < data.length; i++) { s += data[i]; s2 += data[i] * data[i]; }
  const m = s / data.length; return Math.sqrt(Math.max(0, s2 / data.length - m * m));
};
const W = 1200, H = 670, cw = 672, ch = 335, k = 336, kh = 228;
const centre = await busy((W - cw) / 2, Math.round((H - ch) / 2), cw, ch);
const corners = (await busy(0, 0, k, kh) + await busy(W - k, H - kh, k, kh)) / 2;
ok('the centre (where the copy sits) is calm - <= 0.55x the corners\' detail', centre <= corners * 0.55,
  { centre: +centre.toFixed(1), corners: +corners.toFixed(1), ratio: +(centre / corners).toFixed(2) });

// ---- game ------------------------------------------------------------------
const free = (p) => new Promise((res) => { const s = net.createServer();
  s.once('error', () => res(false)); s.once('listening', () => s.close(() => res(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8961; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], {
  stdio: 'ignore', env: { ...process.env, MOJI_GAME_FILE: process.env.MOJI_GAME_FILE || '' } });
await new Promise((r) => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
const plateStatus = []; page.on('response', (r) => { if (r.url().includes('panel_p5_reforge.webp')) plateStatus.push(r.status()); });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof uiConfirm === 'function' && typeof loadMap === 'function', null, { timeout: 120000 });
await page.evaluate(() => new Promise((res) => { let n = 0;
  const t = () => { window._lxBootGateDone = true;
    const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
    const c = document.querySelector('.cls-card'); if (c) c.click();
    const m = document.getElementById('class-select-modal'); if (m) m.style.display = 'none';
    if (++n > 150) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); }));
await page.waitForTimeout(1200);

// open the Reforge-skinned confirm and hold it open for inspection
await page.evaluate(() => {
  try { loadMap('everdawnCentral'); } catch (e) {}
  window.__reforgeP = uiConfirm({ title: '\u21bb Reforge Bench', skin: 'reforge',
    body: 'The Reforge Bench re-rolls the RANDOM bonus affixes on one of your equipped gear pieces.\n\n\u2022 Cost: 500\u25c8 setshards\n\u2022 It picks ONE eligible piece at random and gives it fresh affix rolls.\n\u2022 Your \u2605 enhancement level and rarity are kept.\n\nEligible right now: Stalwart Vicious Cosmic Lens of Antidote.',
    yesLabel: 'Reforge (500\u25c8)', noLabel: 'Cancel' });
});
await page.waitForTimeout(900);
const open = await page.evaluate(() => {
  const modal = document.getElementById('confirm-modal');
  const box = modal && modal.querySelector('.modal');
  const cs = box && getComputedStyle(box);
  return { shown: modal && modal.style.display !== 'none', cls: modal && modal.className,
    bg: cs && cs.backgroundImage, size: cs && cs.backgroundSize };
});
if (SHOT) { try { await page.screenshot({ path: SHOT }); } catch (e) {} }
ok('uiConfirm({ skin: "reforge" }) opens with skin-reforge on #confirm-modal',
  open.shown && /\bskin-reforge\b/.test(open.cls || ''), { cls: open.cls, shown: open.shown });
ok('...and the dialog\'s computed background stacks the P5 plate over the dark base',
  /panel_p5_reforge\.webp/.test(open.bg || '') && /radial-gradient/.test(open.bg || ''), { bg: String(open.bg).slice(0, 160) });
ok('...sized cover, like the shop / enhance plates', /cover/.test(open.size || ''), { size: open.size });
await page.waitForTimeout(600);
ok('the plate is actually served (200), not a 404 hidden under the gradient',
  plateStatus.length > 0 && plateStatus.every((s) => s === 200), { statuses: plateStatus });

// resolve it, then open a PLAIN confirm: the skin must not leak
const plain = await page.evaluate(async () => {
  document.getElementById('confirm-no').click();
  await window.__reforgeP;
  const afterCls = document.getElementById('confirm-modal').className;
  const p2 = uiConfirm({ title: 'Delete save?', body: 'plain', danger: true });
  await new Promise((r) => setTimeout(r, 200));
  const modal = document.getElementById('confirm-modal');
  const cs = getComputedStyle(modal.querySelector('.modal'));
  const out = { afterCls, plainCls: modal.className, plainBg: cs.backgroundImage };
  document.getElementById('confirm-no').click(); await p2;
  return out;
});
ok('resolving the reforge confirm strips the skin (per-dialog, not sticky)', !/\bskin-/.test(plain.afterCls || ''), { cls: plain.afterCls });
ok('a following PLAIN confirm (delete save) has no skin class and no plate',
  !/\bskin-/.test(plain.plainCls || '') && !/panel_p5_reforge/.test(plain.plainBg || ''), { cls: plain.plainCls, bg: String(plain.plainBg).slice(0, 120) });
ok('no page errors', errs.length === 0, { errs: errs.slice(0, 3) });

await b.close(); srv.kill();
let pass = 0;
for (const t of results) {
  console.log((t.pass ? '  PASS  ' : '  FAIL  ') + t.n);
  if (!t.pass) console.log('        ' + JSON.stringify(t.x).slice(0, 320));
  if (t.pass) pass++;
}
console.log('\n' + pass + '/' + results.length + ' checks passed');
process.exit(pass === results.length ? 0 : 1);
