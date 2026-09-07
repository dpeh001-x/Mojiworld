// UI panel plates (v0.30.408): the fourteen windows that sat on the bare dark gradient each carry
// a Persona-5 plate - the file ships at the panel recipe (1200x670, flat 20% alpha), is served,
// and is the computed background image of the window's panel element; a window with its own
// themed gradient keeps it under the plate.
//   MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override the served tree.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import sharp from 'sharp';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10211); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
const PANELS = {
  inventory: '#inventory-modal > .modal', skills: '#skills-modal > .modal', skilltree: '#skilltree-modal > .modal', codex: '#codex-modal > .modal', taxi: '#taxi-modal > .modal', craft: '#craft-modal > .modal', help: '#help-modal > .modal', advancement: '#advancement-modal > .modal',
  mojidex: '#mojidex-modal .mjx-modal', tutorial: '#tutorial-modal > .modal', jukebox: '#jukebox-modal', backup: '#backup-modal', powerup: '#powerup-modal > .modal', sage: '#sage-blessing-modal > .modal',
};
const THEMED = new Set(['mojidex', 'tutorial', 'jukebox', 'backup', 'powerup', 'sage']);
// 1. the files: the panel recipe
for (const n of Object.keys(PANELS)) {
  const f = path.join(SERVE_ROOT, 'Sprites', 'ui', `panel_p5_${n}.webp`);
  try { const m = await sharp(f).metadata(); const a = (await sharp(f).stats()).channels[3]; ok(`panel_p5_${n}.webp ships at 1200x670, flat 20% alpha`, m.width === 1200 && m.height === 670 && m.hasAlpha && Math.round(a.mean) === 51 && a.max === a.min, `${m.width}x${m.height} alpha ${a.mean}`); }
  catch (e) { ok(`panel_p5_${n}.webp ships at 1200x670, flat 20% alpha`, false, String(e.message).slice(0, 80)); }
}
// 2. the served build: each window's panel reads its plate as its computed background
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
try {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && document.querySelector('#inventory-modal'), null, { timeout: 180000 }); await page.waitForTimeout(4000);
  const r = await page.evaluate(async (PANELS) => {
    const o = { ver: GAME_VERSION, rows: {} };
    for (const n of Object.keys(PANELS)) {
      const el = document.querySelector(PANELS[n]); if (!el) { o.rows[n] = { err: 'no element for ' + PANELS[n] }; continue; }
      const bi = getComputedStyle(el).backgroundImage || '';
      let status = 0; try { status = (await fetch(`Sprites/ui/panel_p5_${n}.webp`, { method: 'HEAD' })).status; } catch (e) {}
      o.rows[n] = { plate: bi.includes(`panel_p5_${n}.webp`), first: bi.indexOf(`panel_p5_${n}.webp`) >= 0 && bi.indexOf(`panel_p5_${n}.webp`) < 60, layers: bi.split(/\),\s*(?=[a-z-]+\()/).length, status, bi: bi.slice(0, 90) };
    }
    return o;
  }, PANELS);
  console.log('build ' + r.ver);
  for (const n of Object.keys(PANELS)) { const x = r.rows[n]; ok(`${n}: the panel's computed background is its plate${THEMED.has(n) ? ' over the window\'s own gradient' : ' over the dark base'}, served 200`, !x.err && x.plate && x.first && x.status === 200 && x.layers >= 2, JSON.stringify(x)); }
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
