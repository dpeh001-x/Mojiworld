// The Continue button shows how far the world has loaded (per user: "I will always need to click on this twice to boot, the
// loading takes quite long and im not sure how much have loaded"). ONE real mouse click on Continue the moment the menu shows,
// never a second:
//   - the world opens (the overlay fades) - one click is enough
//   - while it loads, the button shows a percentage and the phase, and a bar whose width follows it
//   - the percentage starts low (not a stale 100% left by the pre-menu load), rises, and never goes backwards
// node scripts/boot_progress_test.mjs   (MOJI_GAME_FILE / PORT override)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json')); const { chromium } = require('playwright-core');
const PORT = +(process.env.PORT || 9187), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1200));
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 300) + ']' : '')); };
try {
  let blob;   // a real save, made and signed by the game itself
  { const p = await b.newPage(); await p.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load', timeout: 90000 }); await p.waitForTimeout(11000);
    blob = await p.evaluate(() => { player.cls = 'warrior'; player.level = 40; player.look = player.look || {}; player.look.name = 'ProbeHero';
      window._prologuePending = false; window._prologueActive = false; window._lxAwaitingCreation = false;
      const c = document.getElementById('class-select-modal'); if (c) c.style.display = 'none'; _flushSaveStateNow(); return localStorage.getItem('levelx_save_v1'); });
    await p.close(); }
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } }), p = await ctx.newPage();
  await p.addInitScript((bl) => { try { if (!sessionStorage.getItem('_probe')) { localStorage.setItem('levelx_save_v1', bl); sessionStorage.setItem('_probe', '1'); } } catch (e) {} }, blob);
  await p.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'domcontentloaded', timeout: 150000 });
  await p.waitForFunction(() => { const m = document.getElementById('menu-continue'); return m && m.offsetParent && getComputedStyle(m).display !== 'none'; }, null, { timeout: 150000 });
  const bx = await p.locator('#menu-continue').boundingBox();
  await p.mouse.click(bx.x + bx.width / 2, bx.y + bx.height / 2);
  const seen = []; let opened = false;
  for (let i = 0; i < 300 && !opened; i++) {
    await p.waitForTimeout(200);
    const s = await p.evaluate(() => { const o = document.getElementById('loading-overlay'), pe = document.querySelector('#menu-continue .lx-tf-pct'), ph = document.querySelector('#menu-continue .lx-tf-ph'), bar = document.querySelector('#menu-continue .lx-tf-bar > i');
      return { fade: !o || o.classList.contains('fade'), pct: pe ? parseInt(pe.textContent, 10) : null, ph: ph ? ph.textContent : null, bar: bar ? bar.style.width : null }; });
    if (s.fade) opened = true; else seen.push(s);
  }
  const pcts = seen.map((s) => s.pct).filter((v) => v != null);
  ok('one click opens the world (no second click)', opened, { samples: seen.length });
  ok('the button shows a percentage while it loads', pcts.length >= 3, pcts.slice(0, 12));
  ok('it starts low - not a stale 100% from the pre-menu load', pcts.length && pcts[0] < 50, pcts[0]);
  ok('it rises and never goes backwards', pcts.length >= 2 && pcts[pcts.length - 1] > pcts[0] && pcts.every((v, i) => !i || v >= pcts[i - 1]), pcts);
  ok('the phase is named (e.g. "decoding sprites")', seen.some((s) => /[a-z]{4,}/.test(s.ph || '')), [...new Set(seen.map((s) => s.ph))]);
  ok('the bar follows the percentage', seen.some((s) => s.pct > 0 && s.bar === s.pct + '%'), seen.slice(-2));
} finally { await b.close(); srv.kill(); }
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
