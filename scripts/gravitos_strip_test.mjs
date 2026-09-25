// Live test: THE GRAVITOS INTRO CARD IS THE SINGULARITY BAND - NO SPRITE.
//
// Per user: "this strip here should be specially tailored in the gravitos map,
// generate an image that fits the theme and remove the gravitos sprite" and
// "make the gravitos intro strip more impactful". Since v0.30.1068 (per user: "Boss
// introduction could use a MAJOR revamp") the strip is folded into the card: the
// band is Gravitos's WALL, and every other boss stands big on the right of his.
//
// Drives the REAL _playBossIntro and reads the DOM the player sees: the gravitos
// card must carry the generated band and no boss art, and a control boss must
// keep its art and a plain wall - both directions, because a class toggle that
// sticks would leak the band onto every boss (or the art off Gravitos's).
//   node scripts/gravitos_strip_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import net_ from 'node:net';
import { spawn } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8761; p <= 8899 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore', env: { ...process.env, MOJI_GAME_FILE: process.env.MOJI_GAME_FILE || '' } });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof _playBossIntro === 'function', null, { timeout: 120000 });
await page.waitForTimeout(2500);

const read = () => page.evaluate(() => {
  const o = document.getElementById('boss-intro-overlay');
  const wall = o.querySelector('.bi-wall'), crop = o.querySelector('.bi-crop'), img = crop && crop.querySelector('img');
  const strip = document.getElementById('bis-anime-strip');
  return {
    on: o.classList.contains('on'), grav: o.classList.contains('bi-grav'),
    wallBg: wall ? getComputedStyle(wall).backgroundImage : '',
    artShown: !!(crop && getComputedStyle(crop).visibility === 'visible' && crop.offsetHeight > 0),
    artSrc: img ? (img.getAttribute('src') || '') : '', artH: crop ? crop.offsetHeight : 0,
    stripShown: !!(strip && getComputedStyle(strip).display !== 'none'),
    name: (document.getElementById('boss-intro-name') || {}).textContent || '',
  };
});
// Play a card and wait for it to be READY - his art in (or the band / the glyph) - not a fixed pause: the first
// card of a cold page can still be decoding its art at 900 ms. The auto-close is held off while it waits.
const play = async (t) => {
  await page.evaluate((t) => { _playBossIntro(t); if (game._bossIntroTimer) { clearTimeout(game._bossIntroTimer); game._bossIntroTimer = null; } }, t);
  await page.waitForFunction(() => { const o = document.getElementById('boss-intro-overlay'); return o.classList.contains('bi-grav') || o.classList.contains('bi-noart') || !!o.querySelector('.bi-art.bi-in'); }, null, { timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(700);
};
const close = () => page.evaluate(() => { try { _dismissBossIntro(); } catch (e) {} const o = document.getElementById('boss-intro-overlay'); if (o) o.classList.remove('on'); game.paused = false; });

// CONTROL FIRST - before any gravitos state exists, so the plain card is judged clean.
await play('aetherion');
const ctl = await read();
await close(); await page.waitForTimeout(400);

await play('gravitos');
const grav = await read();
await page.screenshot({ path: 'scripts/_tmp_grav_card.png' });   // visual proof for the user
await close(); await page.waitForTimeout(400);

// ...and back: the band must not stick to the next boss.
await play('aetherion');
const after = await read();
await close();
await b.close(); srv.kill();

ok('the gravitos card carries the singularity band as its wall, named',
  grav.on && grav.grav && /bis_gravitos_bg\.webp/.test(grav.wallBg) && /GRAVITOS/.test(grav.name), grav);
ok('...and NO gravitos sprite', !grav.artShown, { artShown: grav.artShown, artSrc: grav.artSrc });
ok('a control boss keeps a plain wall and stands big on it', !ctl.grav && !/bis_gravitos_bg/.test(ctl.wallBg) && ctl.artShown && ctl.artSrc.length > 0 && ctl.artH >= 300, ctl);
ok('the band does not stick: the next boss gets his own wall and art back', !after.grav && !/bis_gravitos_bg/.test(after.wallBg) && after.artShown, after);
ok('one card: the old top strip never shows', !ctl.stripShown && !grav.stripShown && !after.stripShown, { ctl: ctl.stripShown, grav: grav.stripShown });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
process.exit(results.every(q => q.pass) ? 0 : 1);
