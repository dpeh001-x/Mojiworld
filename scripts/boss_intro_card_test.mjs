// Live test: THE BOSS INTRO CARD, TAGGED. Per user: "Boss introduction could use a MAJOR revamp, a mix of the
// graffiti pop style, improvement of the font, the size of the boss / silhouette needs to be sufficient, less
// wordy, more artistic design".
//
// Plays the REAL _playBossIntro for every boss that has a card - the named ones in BOSS_INTROS and all twelve
// zodiac signs - and grades what the player sees: one card (no strip, no red banner, no toasts over it), the
// boss big (his art cropped to its pixels, 300+ px), the name in the bubble face and fitting its column in at
// most two lines, no lore paragraph, a level sticker, and the whole text block inside the 960x560 box. Then the
// skip: a key after the grace closes it and gives the game back.
//   node scripts/boss_intro_card_test.mjs [port]
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
await page.waitForFunction(() => typeof _playBossIntro === 'function' && typeof loadMap === 'function', null, { timeout: 120000 });
await page.waitForLoadState('load', { timeout: 120000 }).catch(() => {});
const types = await page.evaluate(() => {
  try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  const c = document.querySelector('.cls-card'); if (c && !player.cls) { try { c.click(); } catch (e) {} }
  player._storyBeatsSeen = new Proxy({}, { get: () => true });
  loadMap('town', 400); game.paused = false;
  return Object.keys(BOSS_INTROS).concat((ZODIAC_SIGNS || []).map((z) => 'zodiac_' + z.id));
});
await page.waitForTimeout(2500);
const rows = [];
for (const t of types) {
  await page.evaluate((t) => { try { _dismissBossIntro(); } catch (e) {} _playBossIntro(t); if (game._bossIntroTimer) { clearTimeout(game._bossIntroTimer); game._bossIntroTimer = null; } try { showToast('a toast raised under the card', 'epic'); } catch (e) {} }, t);
  await page.waitForFunction(() => { const o = document.getElementById('boss-intro-overlay'); return o.classList.contains('bi-grav') || o.classList.contains('bi-noart') || !!o.querySelector('.bi-art.bi-in'); }, null, { timeout: 6000 }).catch(() => {});   // ready, not a fixed pause: a cold page can still be decoding his art
  await page.waitForTimeout(700);
  rows.push(await page.evaluate((t) => {
    const o = document.getElementById('boss-intro-overlay'), nm = document.getElementById('boss-intro-name');
    const cs = (e) => (e ? getComputedStyle(e) : null), box = o.getBoundingClientRect(), tb = o.querySelector('.bi-text').getBoundingClientRect();
    const crop = o.querySelector('.bi-crop'), strip = document.getElementById('bis-anime-strip');
    const k = box.height / 560, fs = parseFloat(nm.style.fontSize || cs(nm).fontSize);
    return { t, on: o.classList.contains('on'), grav: o.classList.contains('bi-grav'), noart: o.classList.contains('bi-noart'),
      font: cs(nm).fontFamily, fs, lines: Math.round(nm.offsetHeight / (fs * 0.95)), fits: nm.scrollWidth <= nm.clientWidth + 1,
      artH: (crop && cs(crop).visibility === 'visible') ? crop.offsetHeight : 0, artW: (crop && cs(crop).visibility === 'visible') ? crop.offsetWidth : 0,
      glyph: cs(document.getElementById('boss-intro-glyph')).display !== 'none',
      lore: cs(document.getElementById('boss-intro-lore')).display !== 'none' && !!document.getElementById('boss-intro-lore').textContent,
      strip: !!(strip && cs(strip).display !== 'none'), banner: cs(document.getElementById('boss-intro')).display !== 'none' && cs(document.getElementById('boss-intro')).visibility !== 'hidden',
      toasts: cs(document.getElementById('toast-container')).visibility, tag: (o.querySelector('.bi-tag') || {}).textContent || '',
      title: document.getElementById('boss-intro-title').textContent, chip: document.getElementById('boss-intro-drops').textContent,
      inBox: tb.left >= box.left - 1 && tb.right <= box.right + 1 && tb.top >= box.top - 1 && (tb.bottom - box.top) / k <= 560 - 44 };
  }, t));
}
// the skip: past the grace, any key closes the card and the game resumes
const skip = await page.evaluate(async () => {
  try { _dismissBossIntro(); } catch (e) {}
  _playBossIntro('kingKrook');
  const o = document.getElementById('boss-intro-overlay'), was = o.classList.contains('on') && game.paused;
  await new Promise((r) => setTimeout(r, 700));
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }));
  await new Promise((r) => setTimeout(r, 400));
  return { was, on: o.classList.contains('on'), paused: game.paused };
});
await b.close(); srv.kill();
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const bad = (f) => rows.filter((r) => !f(r)).map((r) => r.t);
ok(`every boss with a card gets one (${rows.length}: the named ones and the twelve signs)`, rows.length >= 26 && !bad((r) => r.on).length, bad((r) => r.on));
ok('one card: the old top strip never shows', !bad((r) => !r.strip).length, bad((r) => !r.strip));
ok('...the red spawn banner and the toasts step back while it is up', !bad((r) => !r.banner && r.toasts === 'hidden').length, bad((r) => !r.banner && r.toasts === 'hidden'));
ok('THE BOSS, BIG: his own art at 300+ px (Gravitos: his band, no sprite; no art at all: his glyph, huge)',
  !bad((r) => r.grav ? r.artH === 0 : (r.noart ? r.glyph : (r.artH >= 300 || r.artW >= 440))).length,
  rows.map((r) => `${r.t} ${r.grav ? 'band' : r.noart ? 'glyph' : r.artW + 'x' + r.artH}`).join(', '));
ok('the name is set in the bubble face (Fredoka)', !bad((r) => /Fredoka/.test(r.font)).length, bad((r) => /Fredoka/.test(r.font)));
ok('...and fits its column in at most two lines, never below 40 px', !bad((r) => r.fits && r.lines <= 2 && r.fs >= 40).length,
  rows.filter((r) => !(r.fits && r.lines <= 2 && r.fs >= 40)).map((r) => `${r.t} ${r.fs}px ${r.lines}L`));
ok('less wordy: no lore paragraph on the card', !bad((r) => !r.lore).length, bad((r) => !r.lore));
ok('a level sticker, a title on the tape and the first-kill shards on the chip', !bad((r) => /^BOSS/.test(r.tag) && r.title.length > 2 && /\d/.test(r.chip) && /first kill/i.test(r.chip)).length,
  bad((r) => /^BOSS/.test(r.tag) && r.title.length > 2 && /\d/.test(r.chip)));
ok('the text block stays inside the 960x560 box, clear of the hint at its foot', !bad((r) => r.inBox).length, bad((r) => r.inBox));
ok('a key after the grace closes the card and gives the game back', skip.was && !skip.on && skip.paused === false, skip);
ok('no page errors', errs.length === 0, errs.slice(0, 3));
for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? '').slice(0, 400));
console.log(`${results.filter((q) => q.pass).length}/${results.length} checks passed`);
process.exit(results.every((q) => q.pass) ? 0 : 1);
