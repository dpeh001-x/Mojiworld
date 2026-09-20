// THE TOUR CARD STANDS IN THE HUD'S GAP, NOT ON IT (v0.30.948). The docked tutorial is anchored bottom-left and
// the skill bar is centred, so at every size they met: 272x60 px of overlap at 1280x720, 291x65 at 1366x768 and
// 409x90 at 1920x1080 - the card covering the first slots of the bar that step 2 tells you to press. _lxTutFit
// measures the band under the stats card and above the bar and puts the card there, at every step and on resize.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/tutorial_card_fit_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11334';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
const env = { ...process.env, MOJI_GAME_FILE: PAGE };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1800));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const SIZES = [[1280, 720], [1366, 768], [1920, 1080]];
try {
  for (const [w, h] of SIZES) {
    const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: w, height: h } });
    await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
    await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => typeof loadMap === 'function' && typeof _showTutorialModal === 'function', null, { timeout: 180000 });
    const r = await page.evaluate(async ({ w, h }) => {
      try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
      for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
      applyClass('warrior'); player.level = 12; player._tutorialSeen = false;
      loadMap('town', 300); await new Promise((x) => setTimeout(x, 1500)); game.paused = false;
      try { _tutStep = 0; _showTutorialModal(); } catch (e) {}
      await new Promise((x) => setTimeout(x, 1200));
      const modal = document.getElementById('tutorial-modal');
      const card = modal && modal.querySelector('.modal');
      if (!card || !card.getClientRects().length) return { open: false };
      const B = (el) => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, r: b.right, b: b.bottom }; };
      const c = B(card);
      const panels = [];
      for (const id of ['skill-bar', 'top-ui', 'stats', 'quest-tracker', 'minimap', 'map-label', 'hotkey-hint', 'lx-corner']) {
        const el = document.getElementById(id); if (!el || !el.getClientRects().length) continue;
        const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || +cs.opacity < 0.05) continue;
        if (modal.contains(el)) continue;
        panels.push({ id, ...B(el) });
      }
      const hits = panels.map((p) => ({ id: p.id,
        ox: Math.min(c.r, p.r) - Math.max(c.x, p.x), oy: Math.min(c.b, p.b) - Math.max(c.y, p.y) }))
        .filter((o) => o.ox > 2 && o.oy > 2);
      const bar = panels.find((p) => p.id === 'skill-bar');
      return { open: true, card: { x: Math.round(c.x), y: Math.round(c.y), r: Math.round(c.r), b: Math.round(c.b) },
        barTop: bar ? Math.round(bar.y) : null, hits,
        onScreen: c.x >= -2 && c.y >= -2 && c.r <= w + 2 && c.b <= h + 2,
        panels: panels.map((p) => p.id) };
    }, { w, h });
    const tag = w + 'x' + h;
    check(r.open, tag + ': the docked tour card is on screen', J({ open: r.open, panels: r.panels }));
    if (r.open) {
      check(r.hits.length === 0, tag + ': the card overlaps no HUD surface', J(r.hits.length ? r.hits : { card: r.card }));
      check(r.barTop == null || r.card.b <= r.barTop + 2, tag + ': the card sits above the skill bar',
        J({ cardBottom: r.card.b, barTop: r.barTop }));
      check(r.onScreen, tag + ': and stays on screen', J(r.card));
    }
    check(errs.length === 0, tag + ': no page errors', J(errs.slice(0, 2)));
    await ctx.close();
  }
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
