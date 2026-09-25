// Live test: TITLES, GRAND POP. Per user: "For the titles make it a Grand Pop with strong accents style, highly
// aesthetic, not just purple, make it bombastic".
//
// Opens the real Titles panel and reads the computed style the player sees: the title in the pop face with a
// stacked colour extrusion and a burst badge, the card on a sunburst in more than one hue, earned rows as paper
// slabs with hard offsets in rotating accents, the worn row in yellow, unearned rows styled (not faded), and the
// ids the panel's own logic and tests read still in place.
//   node scripts/titles_pop_test.mjs [port]
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
await page.waitForFunction(() => typeof openTitlesPanel === 'function', null, { timeout: 120000 });
await page.waitForTimeout(2500);
const R = await page.evaluate(() => {
  player.titles = player.titles || {};
  const src = _lxTitleSources().map((s) => s.t);
  player.titles[src[0]] = true; player.titles[src[1]] = true; player.equippedTitle = src[1];
  openTitlesPanel();
  const m = document.getElementById('titles-modal'), cs = (sel) => { const e = m.querySelector(sel); return e ? getComputedStyle(e) : null; };
  const rows = [...m.querySelectorAll('.tt-row')];
  const earned = rows.filter((r) => !r.classList.contains('locked') && !r.classList.contains('on'));
  const worn = m.querySelector('.tt-row.on'), locked = m.querySelector('.tt-row.locked');
  const card = cs('.tt-card'), h2 = cs('.tt-head h2');
  const out = {
    h2Font: h2 && h2.fontFamily, h2Shadow: h2 && h2.textShadow, burst: (() => { const b = getComputedStyle(m.querySelector('.tt-head h2'), '::before'); return b.content !== 'none' && b.backgroundColor === 'rgb(255, 228, 92)'; })(), h2Text: (m.querySelector('.tt-head h2') || {}).textContent, h2Case: h2 && h2.textTransform,
    cardBg: card && card.backgroundImage,
    earnedBg: earned.map((r) => getComputedStyle(r).backgroundColor), earnedShadow: earned.map((r) => getComputedStyle(r).boxShadow),
    wornBg: worn && getComputedStyle(worn).backgroundColor, lockedOpacity: locked && getComputedStyle(locked).opacity,
    ids: { close: !!document.getElementById('tt-close'), x: !!m.querySelector('.tt-x'), favor: !!m.querySelector('.tt-favor'), dataTitle: rows.every((r) => r.hasAttribute('data-title')) },
  };
  document.getElementById('tt-close').click();
  out.closed = !document.getElementById('titles-modal');
  return out;
});
await b.close(); srv.kill();
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const colours = (s) => new Set((String(s).match(/rgba?\([^)]*\)/g) || []).map((c) => c.replace(/\s/g, '')));
ok('the title is in the pop face, in capitals, its medal on a yellow burst', /Fredoka/.test(R.h2Font) && R.burst && /Titles/.test(R.h2Text) && R.h2Case === 'uppercase', { font: R.h2Font, burst: R.burst, text: R.h2Text, case: R.h2Case });
ok('...and a stacked extrusion in pink AND yellow (not one purple glow)', /rgb\(255, 61, 139\)/.test(R.h2Shadow) && /rgb\(255, 228, 92\)/.test(R.h2Shadow), R.h2Shadow && R.h2Shadow.slice(0, 160));
ok('the card sits on a sunburst in more than one hue', /conic-gradient/.test(R.cardBg) && colours(R.cardBg).size >= 4, [...colours(R.cardBg)].slice(0, 6));
ok('earned rows are paper slabs with hard offsets in rotating accents', R.earnedBg.length >= 2 && R.earnedBg.every((c) => c === 'rgb(247, 245, 239)') && new Set(R.earnedShadow).size >= 2, { bg: R.earnedBg, shadow: R.earnedShadow.map((x) => x.slice(0, 40)) });
ok('the worn title is yellow', R.wornBg === 'rgb(255, 228, 92)', R.wornBg);
ok('unearned titles are styled, not faded out', R.lockedOpacity === '1', R.lockedOpacity);
ok('every id and class the panel reads is still there, and it closes', R.ids.close && R.ids.x && R.ids.favor && R.ids.dataTitle && R.closed, R.ids);
ok('no page errors', errs.length === 0, errs.slice(0, 3));
for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? '').slice(0, 260));
console.log(`${results.filter((q) => q.pass).length}/${results.length} checks passed`);
process.exit(results.every((q) => q.pass) ? 0 : 1);
