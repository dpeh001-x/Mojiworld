// The stats card, compact: narrower bars stepped down in weight, finer frames, legible numbers, a
// tighter plate and ribbons, nothing overflowing. Per user: "this HUD can be further improved, made
// smaller, more compact and aesthetic". Sizes are LAYOUT px (the game frame is transform-scaled).
//   node scripts/compact_card_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11298);
const checks = [];
const html = readFileSync(path.join(ROOT, PAGE), 'utf8');
checks.push(['the compact card rules ship', /COMPACT CARD/.test(html) && /#stats \.bar:has\(#mp-bar\) \{ height: 11px; \}/.test(html) && /#stats \.bar:has\(#exp-bar\) \{ height: 10px;/.test(html)]);

const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
try {   // the run; a throw anywhere below is reported as a failing check
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.waitForFunction(() => typeof updateUI === 'function', null, { timeout: 90000 });
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Compact'); await page.click('#cs-nav-next').catch(() => {}); await page.waitForTimeout(800);
await page.evaluate(() => { const c = document.querySelector('#class-options .class-card'); if (c) c.click(); });
await page.waitForTimeout(2500);
for (let i = 0; i < 12; i++) {
  const h = await page.evaluate(() => { let n = 0; for (const id of ['plg-skip', 'plg-dagger-skip', 'plg-punch-skip', 'grav-entry-skip', 'boss-intro-skip']) { const b = document.getElementById(id); if (b && b.offsetParent !== null) { b.click(); n++; } } const sb = document.getElementById('story-beat-overlay'); if (sb && sb.classList.contains('on')) { sb.click(); n++; } return n; });
  if (!h) break; await page.waitForTimeout(700);
}
await page.evaluate(() => { for (const el of document.querySelectorAll('#tutorial-modal')) el.style.display = 'none'; });
const measure = () => page.evaluate(() => {
  const st = document.getElementById('stats');
  const bar = (id) => { const b = document.getElementById(id).parentElement; const t = b.querySelector('.bar-text'); const tc = getComputedStyle(t);
    return { w: b.offsetWidth, h: b.offsetHeight, font: parseFloat(tc.fontSize), stroke: tc.webkitTextStrokeWidth, tab: tc.fontVariantNumeric, clip: t.scrollWidth > t.clientWidth + 1, text: t.textContent }; };
  const ghost = document.getElementById('hp-ghost');
  return { cardW: st.offsetWidth, cardH: st.offsetHeight, overflow: st.scrollWidth > st.clientWidth + 1,
    hp: bar('hp-bar'), mp: bar('mp-bar'), exp: bar('exp-bar'),
    ghostH: ghost ? ghost.offsetHeight : -1, hpInner: document.getElementById('hp-bar').parentElement.clientHeight,
    plate: document.querySelector('.stats-id-row').offsetHeight, crest: document.querySelector('.lx-idp-portrait').offsetWidth,
    rows: [...document.querySelectorAll('.stats-footer .stats-footer-row')].map((r) => r.offsetHeight) };
});
const a = await measure();
checks.push(['the card is smaller: under 244 x 136 layout px (it was 286 x 158)', a.cardW <= 244 && a.cardW >= 200 && a.cardH <= 136, `${a.cardW} x ${a.cardH}`]);
checks.push(['the bars narrow to 220 and step down in weight: HP 13, MP 11, EXP 10', [a.hp, a.mp, a.exp].every((b) => b.w === 220) && a.hp.h === 13 && a.mp.h === 11 && a.exp.h === 10, `${a.hp.w}: ${a.hp.h}/${a.mp.h}/${a.exp.h}`]);
checks.push(['the numbers stay legible: 9.5 / 8.5 / 8 px, tabular, no hard stroke', a.hp.font >= 9.5 && a.mp.font >= 8.5 && a.exp.font >= 8 && [a.hp, a.mp, a.exp].every((b) => /tabular-nums/.test(b.tab) && parseFloat(b.stroke) === 0), `${a.hp.font}/${a.mp.font}/${a.exp.font}px`]);
checks.push(['the plate tightens: crest 36, row 44 or less', a.crest === 36 && a.plate <= 44, `crest ${a.crest}, row ${a.plate}`]);
checks.push(['the ribbons tighten: 15 px rows', a.rows.length === 2 && a.rows.every((h) => h === 15), a.rows.join('/')]);
checks.push(['the HP ghost still fills the HP bar\'s height', a.ghostH === a.hpInner && a.ghostH > 0, `${a.ghostH} vs ${a.hpInner}`]);
checks.push(['nothing overflows the card', !a.overflow]);
await page.evaluate(() => { try { player.exp = 1234567; } catch (e) {} updateUI(); });
await page.waitForTimeout(250);
const b = await measure();
checks.push(['late-game numbers still fit inside their bars', ![b.hp, b.mp, b.exp].some((x) => x.clip), b.exp.text]);
checks.push(['no page errors', errs.length === 0, errs.slice(0, 2).join(' | ')]);
} catch (e) {
  checks.push(['the run completed without a crash', false, String((e && e.message) || e).split('\n')[0].slice(0, 160)]);
}
await browser.close().catch(() => {}); server.kill();
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
process.exit(fails ? 1 : 0);
