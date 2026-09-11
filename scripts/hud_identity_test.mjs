// The HUD identity plate: crest medallion, level medal, engraved name, class chip, skill-point gem.
// Per user: "Further improve the aesthetics for this section of HUD, make it better than AAA games".
// Sizes are read in LAYOUT px (offsetWidth / offsetHeight): the game frame is transform-scaled to the
// window, so on-screen rects are larger than the layout by that factor.
//   node scripts/hud_identity_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11277);
const checks = [];
const html = readFileSync(path.join(ROOT, PAGE), 'utf8');
checks.push(['the plate: medallion round the crest, level medal, class chip, skill-point gem',
  /class="lx-idp-portrait">\s*<img id="hud-class-icon"[\s\S]{0,260}class="lx-idp-lv"[\s\S]{0,700}<span id="level">/.test(html)
  && /<span id="class" class="lx-idp-class"/.test(html) && /class="lx-idp-sp"[\s\S]{0,1200}<span id="skill-points">/.test(html)]);
const IDS = ['hud-class-icon', 'hud-player-name', 'hud-player-title', 'level', 'class', 'skill-points'];
const counts = IDS.map((id) => html.split(`id="${id}"`).length - 1);
checks.push(['every id the HUD code writes survives, exactly once', counts.every((c) => c === 1), IDS.map((id, i) => id + ':' + counts[i]).join(' ')]);

const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
try {   // the run; a throw anywhere below is reported as a failing check
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.waitForFunction(() => typeof updateUI === 'function' && typeof openLevelUpPanel === 'function', null, { timeout: 90000 });
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Moji'); await page.click('#cs-nav-next').catch(() => {}); await page.waitForTimeout(800);
await page.evaluate(() => { const c = document.querySelector('#class-options .class-card'); if (c) c.click(); });
await page.waitForTimeout(2500);
for (let i = 0; i < 12; i++) {
  const hit = await page.evaluate(() => { let n = 0; for (const id of ['plg-skip', 'plg-dagger-skip', 'plg-punch-skip', 'grav-entry-skip', 'boss-intro-skip']) { const b = document.getElementById(id); if (b && b.offsetParent !== null) { b.click(); n++; } } const sb = document.getElementById('story-beat-overlay'); if (sb && sb.classList.contains('on')) { sb.click(); n++; } return n; });
  if (!hit) break; await page.waitForTimeout(700);
}
await page.evaluate(() => { for (const el of document.querySelectorAll('#tutorial-modal')) el.style.display = 'none'; });
const r = await page.evaluate(async () => {
  const wait = (ms) => new Promise((x) => setTimeout(x, ms));
  const $ = (sel) => document.querySelector(sel);
  const out = {};
  const por = $('.lx-idp-portrait'), img = document.getElementById('hud-class-icon'), badge = $('.lx-idp-lv');
  const pr = por.getBoundingClientRect(), br = badge.getBoundingClientRect();
  out.crest = { loaded: img.complete && img.naturalWidth > 0, inFrame: img.parentElement === por, w: por.offsetWidth, h: por.offsetHeight };
  out.badge = { text: document.getElementById('level').textContent.trim(), lv: String(player.level), cx: (br.left + br.right) / 2, pl: pr.left, pr: pr.right, bb: br.bottom, bt: br.top, pb: pr.bottom };
  const nm = document.getElementById('hud-player-name'), ncs = getComputedStyle(nm);
  out.name = { font: ncs.fontFamily, size: parseFloat(ncs.fontSize), clip: ncs.webkitBackgroundClip || ncs.backgroundClip, cinzel: document.fonts.check('700 15px Cinzel') };
  const stats = document.getElementById('stats'); const w0 = stats.getBoundingClientRect().width;
  const nm0 = player.look.name; player.look.name = 'Maximiliana Starborne of the Ninth Tide'; updateUI(); await wait(120);
  out.long = { overflow: nm.scrollWidth > nm.clientWidth + 2, dw: Math.abs(stats.getBoundingClientRect().width - w0) };
  player.look.name = nm0; updateUI();
  const chip = document.getElementById('class'), ccs = getComputedStyle(chip);
  out.chip = { color: ccs.color, border: ccs.borderTopColor, inline: chip.style.color };
  const spc = document.getElementById('skill-points').parentElement; const sp0 = player.skillPoints;
  player.skillPoints = 0; updateUI(); out.quiet = !spc.classList.contains('sp-live');
  player.skillPoints = 3; updateUI(); out.lit = spc.classList.contains('sp-live');
  player.skillPoints = 0; updateUI(); out.out = !spc.classList.contains('sp-live');
  player.skillPoints = sp0; updateUI();
  const lv0 = player.level; badge.classList.remove('lv-up');
  player.level = lv0 + 1; updateUI(); out.pulse = badge.classList.contains('lv-up');
  badge.classList.remove('lv-up'); player.level = lv0 + 25; updateUI(); out.jumpQuiet = !badge.classList.contains('lv-up');
  player.level = lv0; updateUI(); badge.classList.remove('lv-up');
  out.rowH = document.querySelector('.stats-id-row.lx-idp').offsetHeight;
  return out;
});
checks.push(['the crest sits in the gilded medallion and loads', r.crest.loaded && r.crest.inFrame && r.crest.w >= 40 && r.crest.h >= 40, JSON.stringify(r.crest)]);
checks.push(['the level medal shows the level on the medallion\'s lower edge', r.badge.text === r.badge.lv && r.badge.cx > r.badge.pl && r.badge.cx < r.badge.pr && r.badge.bb > r.badge.pb && r.badge.bt < r.badge.pb, `Lv ${r.badge.text}`]);
checks.push(['the name is engraved gold, set in Cinzel', /^"?Cinzel/.test(r.name.font) && r.name.size >= 14 && r.name.clip === 'text' && r.name.cinzel, `${r.name.font.split(',')[0]} ${r.name.size}px clip:${r.name.clip}`]);
checks.push(['a long name ends in an ellipsis instead of widening the panel', r.long.overflow && r.long.dw <= 1, `panel width moved ${r.long.dw.toFixed(1)} px`]);
// color-mix() reports the rim as color(srgb r g b / a) with 0-1 channels; bring it to 0-255 to compare
const rgb = (s) => { const k = /^color\(srgb/.test(s) ? 255 : 1; return (s.match(/[\d.]+/g) || []).slice(0, 3).map((v) => Math.round(Number(v) * k)).join(','); };
checks.push(['the class chip wears the class colour, rim and all', !!r.chip.inline && rgb(r.chip.border) === rgb(r.chip.color), `${r.chip.color} / rim ${r.chip.border}`]);
checks.push(['with no unspent points the gem is quiet', r.quiet]);
checks.push(['unspent points light the gem, and spending them puts it out', r.lit && r.out]);
checks.push(['a level-up pulses the medal; a save loading in does not', r.pulse && r.jumpQuiet]);
checks.push(['the plate stays compact', r.rowH <= 50, r.rowH + ' layout px']);
await page.click('.lx-idp-sp', { timeout: 5000 }); await page.waitForTimeout(700);
const opened = await page.evaluate(() => { const m = document.getElementById('attributes-modal'); if (!m) return false; const cs = getComputedStyle(m); return cs.display !== 'none' && cs.visibility !== 'hidden' && m.getBoundingClientRect().width > 0; });
checks.push(['clicking the gem opens the Level Up panel', opened]);
checks.push(['no page errors', errs.length === 0, errs.slice(0, 2).join(' | ')]);
} catch (e) {
  checks.push(['the run completed without a crash', false, String((e && e.message) || e).split('\n')[0].slice(0, 160)]);
}
await browser.close().catch(() => {}); server.kill();
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
process.exit(fails ? 1 : 0);
