// v0.30.x — The story-beat card at AAA standard: letterbox, a feathered plate, outlined gold lettering,
// ornaments, a dimmer ground, a quiet cue.
//   node scripts/story_beat_card_test.mjs [file.html] [port] [shot.png]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11363);
const SHOT = process.argv[4] || '';
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(10000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Card');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);

const r = await page.evaluate(async () => {
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const out = {};
  try { _playStoryBeat('tutorial_intro'); } catch (e) { out.err = String(e.message); }
  await wait(800);
  const ov = document.getElementById('story-beat-overlay');
  ov.click(); await wait(900);   // the second stanza: "Below, a world holds its breath"
  out.on = ov.classList.contains('on') && ov.classList.contains('mode-epilogue');
  out.text = (document.getElementById('story-beat-text').textContent || '').slice(0, 30);
  const cs = (el, p) => getComputedStyle(el, p || null);
  const txt = document.getElementById('story-beat-text'), stage = document.getElementById('story-beat-stage'), hint = document.getElementById('story-beat-hint');
  out.letterbox = cs(ov, '::after').content !== 'none' && /030108/.test(cs(ov, '::after').backgroundImage.replace(/rgb\((\d+), (\d+), (\d+)\)/g, (m, a, b, c) => [a, b, c].map((v) => (+v).toString(16).padStart(2, '0')).join('')));
  out.plate = cs(stage, '::before').content !== 'none' && /radial-gradient/.test(cs(stage, '::before').backgroundImage);
  out.ornamentTop = cs(stage, '::after').content.indexOf('◆') >= 0;
  out.ornamentBottom = cs(hint, '::before').content.indexOf('◆') >= 0;
  out.shadowStops = (cs(txt).textShadow.match(/rgba?\(/g) || []).length;   // the ink ring (8) + drop + bloom
  out.fontPx = parseFloat(cs(txt).fontSize); out.weight = cs(txt).fontWeight; out.font = cs(txt).fontFamily.split(',')[0];
  out.stroke = cs(txt).webkitTextStrokeWidth;
  out.hintAnim = cs(hint).animationName;
  return out;
});
const html = await (await fetch(`http://localhost:${PORT}/${PAGE}`)).text();
const dimmer = html.includes("linear-gradient(180deg, rgba(7,4,16,0.74) 0%, rgba(7,4,16,0.58) 42%, rgba(9,5,20,0.78) 100%),");
console.log(JSON.stringify({ ...r, dimmer }));
if (SHOT) await page.screenshot({ path: SHOT });
const checks = [
  ['the prologue beat is up on its second stanza', r.on === true && /^Below, a world/.test(r.text), r.text],
  ['the card is letterboxed', r.letterbox === true],
  ['the words sit on a feathered plate', r.plate === true],
  ['gold rules with a jewel frame the stanza', r.ornamentTop === true && r.ornamentBottom === true, `${r.ornamentTop}/${r.ornamentBottom}`],
  ['the lettering carries an ink ring, a drop shadow and a bloom', r.shadowStops >= 10 && parseFloat(r.stroke) > 0, `stops ${r.shadowStops}, stroke ${r.stroke}`],
  ['the epilogue face is a 28px bold serif', r.fontPx === 28 && String(r.weight) === '700', `${r.fontPx}px / ${r.weight} / ${r.font}`],
  ['the ground is dimmer', dimmer],
  ['the cue pulses instead of bouncing', r.hintAnim === 'storyBeatCue', r.hintAnim],
  ['no page errors', errs.length === 0, errs.join(' | ')],
];
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
await browser.close(); server.kill();
process.exit(fails ? 1 : 0);
