// Live test: THE GRAVITOS INTRO STRIP IS THE SINGULARITY BAND - NO SPRITE.
//
// Per user: "this strip here should be specially tailored in the gravitos map,
// generate an image that fits the theme and remove the gravitos sprite" and
// "make the gravitos intro strip more impactful".
//
// Drives the REAL _playBossIntro and reads the DOM the player sees: the
// gravitos strip must carry the generated band and no boss portrait, and a
// control boss must keep the classic strip untouched - both directions,
// because a class toggle that sticks would leak the band onto every boss.
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
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof _playBossIntro === 'function', null, { timeout: 120000 });
await page.waitForTimeout(2500);

const read = () => page.evaluate(() => {
  const s = document.getElementById('bis-anime-strip');
  if (!s) return { noStrip: true };
  const bg = s.querySelector('.bis-bg');
  const boss = s.querySelector('.bis-boss');
  const cs = getComputedStyle(s);
  return {
    grav: s.classList.contains('bis-grav'),
    height: cs.height,
    bgShown: bg ? getComputedStyle(bg).display !== 'none' : false,
    bgSrc: bg ? (bg.getAttribute('src') || '') : '',
    bossShown: boss ? getComputedStyle(boss).display !== 'none' : false,
    bossSrc: boss ? (boss.getAttribute('src') || '') : '',
    name: (s.querySelector('.bis-name') || {}).textContent || '',
  };
});

// CONTROL FIRST - before any gravitos state exists, so the classic strip is
// judged clean. (Running it second flaked: force-closing the first intro
// mid-machinery left the follow-up call with a half-reset strip, while a
// direct _zodiacAnimeStrip probe proved the branch itself correct.)
await page.evaluate(() => { _playBossIntro('aetherion'); });
await page.waitForTimeout(700);
const ctl = await read();
await page.evaluate(() => { const o = document.getElementById('boss-intro-overlay'); if (o) o.classList.remove('on'); game.paused = false; });
await page.waitForTimeout(400);

await page.evaluate(() => { _playBossIntro('gravitos'); });
await page.waitForTimeout(700);
const grav = await read();
// visual proof for the user
await page.screenshot({ path: 'scripts/_tmp_grav_strip.png',
  clip: { x: 0, y: Math.round(720 * 0.09) - 10, width: 1280, height: 220 } });
await page.evaluate(() => { const o = document.getElementById('boss-intro-overlay'); if (o) o.classList.remove('on'); game.paused = false; });
await b.close(); srv.kill();

ok('the gravitos strip carries the singularity band, taller, named',
  grav.grav && grav.bgShown && /bis_gravitos_bg\.webp/.test(grav.bgSrc) && grav.height === '190px' && /GRAVITOS/.test(grav.name),
  grav);
ok('...and NO gravitos sprite', !grav.bossShown, { bossShown: grav.bossShown, bossSrc: grav.bossSrc });
ok('a control boss keeps the classic strip - no band, portrait back',
  !ctl.grav && !ctl.bgShown && ctl.bossShown && ctl.bossSrc.length > 0 && ctl.height === '152px',
  ctl);
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
process.exit(results.every(q => q.pass) ? 0 : 1);
