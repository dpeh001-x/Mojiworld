// The title menu goes pop punk (v0.30.x title-pop).
//   node scripts/title_pop_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// Per user: "the ornate gold frame can be changed to more pop punk style", "the background image can be swapped out
// with a more POP render", "do something to the rectangular modal and icons", "for the class icon it could be more
// fitting", "remake the ko-fi discord instagram and website logos", "Once upon a time ... a better colour", "Lemon".
// Also runs start_menu_test (the menu's own behaviour: Continue, New Game, Co-op, Settings, Backups).
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '10871';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const errs = [];
const open = async (vp, save) => {
  const ctx = await browser.newContext({ ...vp, serviceWorkers: 'block' }); const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await page.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: 'font/woff2', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
  });
  if (save) await page.addInitScript((cls) => { try { localStorage.setItem('levelx_save_v1', JSON.stringify({ v: 1, t: Date.now(), player: { cls, level: 42, look: { name: 'Dadpeh' } }, game: { currentMap: 'town' } })); } catch (e) {} }, save);
  await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const o = document.getElementById('loading-overlay'); return o && o.classList.contains('menu-up'); }, null, { timeout: 150000 });
  await page.waitForTimeout(2600);   // the card slam + the menu cascade
  return { ctx, page };
};
try {
  const { ctx, page } = await open({ viewport: { width: 1280, height: 800 } }, 'mage');
  const D = await page.evaluate(async () => {
    const cs = (e, pe) => getComputedStyle(e, pe || null), q = (s) => document.querySelector(s);
    const load = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im.naturalWidth); im.onerror = () => res(0); im.src = src; });
    const frame = q('.lo-frame'), logo = q('#lo-logo'), lede = q('.lede'), rule = q('.lo-rule');
    const hits = [...document.querySelectorAll('#lo-menu .menu-item')].filter((b) => b.offsetParent).map((b) => { const r = b.getBoundingClientRect(), h = document.elementFromPoint(r.left + r.width * 0.6, r.top + r.height / 2); return [b.id, !!h && b.contains(h)]; });
    const coop = q('#menu-coop'), prim = q('#lo-menu .menu-item.primary'), cont = q('#menu-continue-icon');
    const fr = frame.getBoundingClientRect(), cp = q('.lo-copy').getBoundingClientRect();
    return {
      bg: cs(q('.lo-bg')).backgroundImage, bgLoads: await load('backgrounds/title_keyart_pop.webp'),
      ornate: cs(q('.lo-ornate')).borderImageSource, paperClip: cs(frame, '::after').clipPath.slice(0, 8), offset: cs(q('.lo-corner.br')).backgroundColor, tilt: cs(frame).rotate,
      logo: { content: cs(logo).content, loads: await load('Sprites/ui/mojiworld_logo_pop.webp'), filter: cs(logo).filter, anim: cs(logo).animationName },
      lede: { col: cs(lede).color, ink: cs(lede, '::before').backgroundColor, off: cs(lede, '::after').backgroundColor }, rule: cs(rule).backgroundImage.includes('H294'),
      icons: [...document.querySelectorAll('#lo-menu .mi-art')].map((i) => [i.getAttribute('src'), i.complete && i.naturalWidth > 0]),
      cont: cont && [cont.getAttribute('src'), cont.complete && cont.naturalWidth > 0, q('#menu-continue').offsetParent !== null],
      face: [cs(coop, '::before').backgroundColor, cs(coop, '::before').borderTopColor, cs(prim, '::before').backgroundColor], hits,
      badges: [...document.querySelectorAll('.lo-link')].map((a) => [a.id, a.getAttribute('href'), !!a.querySelector('svg [id^="lxp-"]')]), oldBadges: document.querySelectorAll('[id^="lxs-"]').length,
      fits: fr.left >= 0 && fr.right <= innerWidth, copyShown: cp.bottom <= innerHeight && cp.top > fr.bottom - 40,
    };
  });
  await page.hover('#menu-coop'); await page.waitForTimeout(300);
  const hov = await page.evaluate(() => getComputedStyle(document.getElementById('menu-coop'), '::after').backgroundColor);
  await ctx.close();
  console.log('desktop', JSON.stringify(D).slice(0, 1400));
  check(D.bg.includes('title_keyart_pop.webp') && D.bgLoads > 1000, 'the backdrop is the POP render (title_keyart_pop.webp), and it loads', [D.bg.slice(0, 90), D.bgLoads]);
  check(D.ornate === 'none' && D.paperClip === 'polygon(' && D.offset === 'rgb(255, 46, 136)' && D.tilt === '-1.2deg', 'the gold filigree frame is gone: a hand-cut ink card with a hot-pink offset, tilted', [D.ornate, D.paperClip, D.offset, D.tilt]);
  check(D.logo.content.includes('mojiworld_logo_pop.webp') && D.logo.loads > 500 && /drop-shadow/.test(D.logo.filter) && !/lo-logo-glow/.test(D.logo.anim), 'MOJIWORLD is the lemon recolour, with a hard ink drop and no glow box', D.logo);
  check(D.lede.col === 'rgb(255, 228, 92)' && D.lede.ink === 'rgb(12, 11, 16)' && D.lede.off === 'rgb(255, 46, 136)' && D.rule, '"Once upon a time" is lemon on an ink tag with a pink offset; the divider is straight rules', [D.lede, D.rule]);
  check(D.icons.length === 4 && D.icons.every(([s, ok]) => /menu_pop_(newgame|coop|settings|backups)\.webp$/.test(s) && ok), 'the four menu icons are the new pop stickers, all loaded', D.icons);
  check(D.cont && /menu_pop_class_mage\.webp$/.test(D.cont[0]) && D.cont[1] && D.cont[2], "a saved Mage's Continue card wears the pop mage sticker, not the gold crest", D.cont);
  check(D.face[0] === 'rgb(18, 13, 28)' && D.face[1] === 'rgb(244, 241, 234)' && D.face[2] === 'rgb(255, 228, 92)' && hov === 'rgb(255, 46, 136)', 'buttons are ink stickers with a white keyline, the primary one yellow; hover throws a pink offset', [D.face, hov]);
  check(D.hits.length === 5 && D.hits.every((h) => h[1]), 'every menu button still takes its own click (tape and stickers never cover one)', D.hits);
  check(D.badges.length === 4 && D.badges.every((b) => b[2]) && D.oldBadges === 0 && D.badges.map((b) => b[1]).join(' ').includes('ko-fi.com') && D.badges.map((b) => b[1]).join(' ').includes('discord.gg'), 'Ko-fi, Discord, Instagram and Website are the pop redraws, links unchanged', D.badges);
  check(D.fits && D.copyShown, 'the card fits the screen and the copyright line shows under it', [D.fits, D.copyShown]);

  const P = await open({ viewport: { width: 842, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, null);
  const R = await P.page.evaluate(async () => {
    const ng = document.getElementById('menu-newgame'); ng.scrollIntoView({ block: 'center' }); await new Promise((s) => setTimeout(s, 300));
    const r = ng.getBoundingClientRect(), h = document.elementFromPoint(r.left + r.width * 0.6, r.top + r.height / 2);
    return { primary: ng.classList.contains('primary'), hit: !!h && ng.contains(h), cont: document.getElementById('menu-continue').offsetParent === null };
  });
  await P.ctx.close();
  console.log('phone', JSON.stringify(R));
  check(R.primary && R.hit && R.cont, 'phone on its side, first visit: New Game is the yellow one and takes its tap', R);
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close().catch(() => {}); }
const r1 = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'start_menu_test.mjs')], { env: { ...process.env, MOJI_URL: `http://localhost:${PORT}/${FILE}` }, encoding: 'utf8', timeout: 420000 });
srv.kill();
const out1 = (r1.stdout || '') + (r1.stderr || ''), m1 = out1.match(/(\d+)\/(\d+) checks passed/);
check(r1.status === 0 && m1 && m1[1] === m1[2], 'start_menu_test still passes (Continue, New Game, Co-op, Settings, Backups)', [r1.status, m1 && m1[0], out1.split('\n').filter((l) => /^FAIL/.test(l)).slice(0, 3)]);
console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
process.exit(bad ? 1 : 0);
