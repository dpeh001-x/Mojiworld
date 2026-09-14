// Every "walk up and press a key" prompt goes through the one renderer.
//
// Per user, of the chest prompt: "for this N Open interaction make it look nicer than the N Talk for
// NPC, then look for other N interactions that show on screen and make it nicer".
//
// There were three of these and they had nothing in common: the NPC had a real pill, the CHEST was a
// bare ctx.fillText('[N] Open') with no plate at all (so on bright art it was yellow on yellow, and
// on the hero it simply vanished), and the PORTAL was a hard black rectangle. This asserts the shape
// of the fix rather than the pixels: the bare-text form is gone, all three draw the shared pill, and
// the portal's baked plate is the new taller one.
//   node scripts/interact_prompt_test.mjs [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.argv[2] || 29330);
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
let pass = 0, fail = 0;
const ok = (c, m, extra) => { if (c) { pass++; console.log('  PASS  ' + m); }
  else { fail++; console.log('  FAIL  ' + m + (extra !== undefined ? '  <- ' + extra : '')); } };
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));

// Record what the main canvas is asked to draw: the text of every fillText, and the destination rect
// of every CANVAS blit (the portal label is baked to a canvas, which is what makes it identifiable).
await page.addInitScript(() => {
  window.__seen = { texts: [], blits: [], caps: [] };
  window.__anyKeyText = [];
  const P = CanvasRenderingContext2D.prototype;
  const oft = P.fillText;
  P.fillText = function (t) {
    try {
      const s = String(t);
      if (this.canvas && this.canvas.id === 'game') window.__seen.texts.push(s);
      // the key cap is drawn on whatever context the pill is drawn into - main OR the portal's bake
      if (/^(N|↑)$/.test(s)) window.__seen.caps.push(s);
      // ANY context, not just the main canvas: the portal bakes its label offscreen, so a
      // main-canvas filter never sees the old '[↑] Enter' and this check would pass on the
      // unfixed build too - which it did, until it was moved here.
      if (/\[(N|↑)\]/.test(s)) window.__anyKeyText.push(s);
    } catch (e) {}
    return oft.apply(this, arguments);
  };
  const odi = P.drawImage;
  P.drawImage = function (img, ...a) {
    try {
      if (this.canvas && this.canvas.id === 'game' && img instanceof HTMLCanvasElement && a.length >= 4) {
        const [, , dw, dh] = a.slice(-4);
        if (dh >= 18 && dh <= 70 && dw >= 110 && dw <= 460) window.__seen.blits.push({ w: dw, h: dh });
      }
    } catch (e) {}
    return odi.apply(this, arguments);
  };
});

await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load', timeout: 120000 });
const clickText = (src) => page.evaluate((s) => { const rx = new RegExp(s, 'i');
  for (const b of document.querySelectorAll('button')) {
    if (getComputedStyle(b).display === 'none' || !b.offsetParent) continue;
    if (rx.test((b.textContent || '').trim())) { b.click(); return true; } } return false; }, src);
const waitFor = async (l, fn, cap = 180000) => { const t0 = Date.now();
  while (Date.now() - t0 < cap) { try { if (await fn()) return true; } catch (e) {} await page.waitForTimeout(400); }
  console.log('  (timeout: ' + l + ')'); return false; };
await waitFor('form', () => page.evaluate(() => !!document.querySelector('#hero-name-input')));
await page.fill('#hero-name-input', 'Prompt').catch(() => {});
await page.evaluate(() => { const m = document.getElementById('class-select-modal'); if (!m) return;
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; } } });
await clickText('^Next');
await waitFor('menu', async () => await clickText('New Game'));
await waitFor('reveal', async () => { await clickText('Skip prologue'); await page.keyboard.press('Enter').catch(() => {});
  return page.evaluate(() => { const o = document.getElementById('loading-overlay');
    return !o || o.classList.contains('fade') || getComputedStyle(o).display === 'none'; }); });
await page.evaluate(() => { const o = document.getElementById('story-beat-overlay');
  if (o) { o.classList.remove('on'); o.style.display = 'none'; }
  try { game.paused = false; window._lxBootGateDone = true; player.level = 40; } catch (e) {} });
await page.waitForTimeout(1200);

// A scripted loadMap re-pauses the sim, and a paused sim never ramps npc._talkA, so the prompt could
// never appear however close the hero stands. Hold position AND keep it running.
const pin = (src) => page.evaluate((code) => {
  const at = new Function('return (' + code + ')')();
  if (window.__pin) cancelAnimationFrame(window.__pin);
  const step = () => {
    try { game.paused = false; } catch (e) {}
    try { const t = at(); if (t) { player.x = t.x; player.y = t.y; player.vy = 0; player.vx = 0; } } catch (e) {}
    window.__pin = requestAnimationFrame(step);
  };
  step();
}, src);
const clear = () => page.evaluate(() => { window.__seen = { texts: [], blits: [], caps: [] }; });
const seen = () => page.evaluate(() => Object.assign({}, window.__seen, { anyKeyText: window.__anyKeyText }));

// ---------------------------------------------------------------- NPC
await page.evaluate(() => { try { loadMap('town', 300); } catch (e) {} });
await page.waitForTimeout(2600);
await pin('() => { const n = (game.npcs || [])[0]; return n ? { x: n.x - player.w / 2, y: n.y - 4 } : null; }');
await page.waitForTimeout(1500); await clear(); await page.waitForTimeout(700);
let s = await seen();
ok(s.texts.includes('Talk'), 'the NPC prompt draws its verb through the pill');
ok(s.caps.includes('N'), 'and carries an N key cap');

// ---------------------------------------------------------------- portal
await pin("() => { const p = (game.portals || [])[0]; if (!p) return null; const fy = (typeof p.y === 'number') ? p.y : 480; return { x: p.x - player.w / 2, y: fy - player.h }; }");
await page.waitForTimeout(1500); await clear(); await page.waitForTimeout(700);
s = await seen();
const blit = s.blits[s.blits.length - 1];
ok(!!blit, 'the portal blits its baked label');
ok(!!blit && blit.h >= 40, 'the portal label is the new taller plate (name + key pill), not the old 26px black box',
  blit ? blit.h + 'px tall' : 'no blit');
ok(s.anyKeyText.length === 0, 'the key is no longer spelled out inside the hint string',
  [...new Set(s.anyKeyText)].join(','));

// ---------------------------------------------------------------- chest
const chest = await page.evaluate(async () => {
  for (const id of ['forest', 'mushroom', 'ancient', 'cryptHollow', 'duneSands']) {
    try { loadMap(id, 300); } catch (e) { continue; }
    await new Promise((r) => setTimeout(r, 1900));
    if ((game.chests || []).some((c) => !c.opened)) return id;
  } return null;
});
ok(!!chest, 'found a map with a closed chest', chest);
await pin('() => { const c = (game.chests || []).filter((q) => !q.opened)[0]; return c ? { x: c.x + c.w / 2 - player.w / 2, y: c.y - player.h } : null; }');
await page.waitForTimeout(1500); await clear(); await page.waitForTimeout(700);
s = await seen();
ok(s.texts.includes('Open'), 'the chest prompt draws its verb through the pill');
ok(s.caps.includes('N'), 'and carries an N key cap');
ok(!s.texts.includes('[N] Open'), 'the old bare-text chest prompt is gone',
  s.texts.filter((t) => /\[N\]/.test(t)).join(','));
ok(errs.length === 0, 'no page errors', errs.join(' | '));

await browser.close().catch(() => {}); server.kill();
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
