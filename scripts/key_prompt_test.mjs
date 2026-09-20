// KEY PROMPTS THAT NAMED THE WRONG KEY, OR NO KEY AT ALL (v0.30.929 audit). The ? Controls panel listed none
// of the world map, Compendium, MojiMon summon, quest guide or the Lv 50 ultimate; the pad translation table had
// no G or H, so a tour step told a controller player to "press G"; the touch legend still called E the journal,
// which moved to Q in v0.29.387; and the controller row counted its own skills from the wrong end.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/key_prompt_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11322';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1800));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof _tutTouchify === 'function' && document.getElementById('help-modal'), null, { timeout: 180000 });
  // 1. the ? panel names every door it opens
  const help = await page.evaluate(() => {
    // the two spans butt together in the markup ("World Map" + "W" reads as "World MapW"), so join them explicitly
    const el = document.getElementById('help-modal');
    const rows = [...el.querySelectorAll('.kb')].map((r) => [...r.querySelectorAll('span')].map((x) => x.textContent).join(' | ').replace(/\s+/g, ' ').trim());
    const named = (label, key) => rows.some((r) => new RegExp(label, 'i').test(r) && new RegExp('\\b' + key + '\\b').test(r));
    return { map: named('world map', 'W'), comp: named('compendium', 'L'), summon: named('summon', 'H'), guide: named('quest', 'E'), ult: named('master ultimate', 'B'),
             skills: rows.find((r) => /signature . ultimate/i.test(r)) || '' };
  });
  check(help.map && help.comp && help.summon && help.guide && help.ult, 'the Controls panel names the map, Compendium, summon, guide and the Lv 50 ultimate', J(help));
  check(/Skills 2 \/ 3/.test(help.skills), 'the controller row counts its skills from the right end', J({ row: help.skills.slice(0, 60) }));
  // 2. a pad player is never told to press G or H
  const pad = await page.evaluate(() => {
    try { _lxPadLastInput = performance.now(); _lxInputDevice = 'pad'; } catch (e) {}
    const out = _tutTouchify('press <kbd>G</kbd> and <kbd>H</kbd>, then <kbd>V</kbd>');
    const txt = out.replace(/<[^>]*>/g, '');
    return { txt, rawG: /\bG\b/.test(txt), rawH: /\bH\b/.test(txt) };
  });
  check(!pad.rawG && !pad.rawH, 'the tour speaks pad buttons for G and H, not the letters', J(pad));
  // 3. on a touch screen the journal is Q, and E is the guide
  await page.setViewportSize({ width: 800, height: 720 });
  const touch = await page.evaluate(() => {
    try { _lxPadLastInput = -1e9; _lxInputDevice = 'kb'; } catch (e) {}
    const strip = (h) => h.replace(/<[^>]*>/g, '');
    return { q: strip(_tutTouchify('open <kbd>Q</kbd>')), e: strip(_tutTouchify('press <kbd>E</kbd>')) };
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  check(/QUEST/.test(touch.q) && /NEXT/.test(touch.e), 'on touch, Q is the journal and E is the quest guide', J(touch));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 3)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
