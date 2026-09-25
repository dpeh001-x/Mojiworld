// IT DOES NOT RAIN UNDERWATER (v0.30.971).
//
// Per user: "for underwater maps there really shouldn't be rain weather". The daily weather roll
// picks a biome row by matching the map's id / bg / name, and the rain row matches 'reef' and
// 'kelp' - the very words Coral Reef Depths and the Sunken Kelp Forest are named with. Measured on
// v0.30.969: both rained 20 days in 40. Underwater maps now resolve to clear like indoor / arena /
// void maps, and the damage table that rides on the weather (rain: lightning +25%) goes quiet with it.
//   static: the gate names isUnderwater
//   live:   every MAPS entry with isUnderwater rolls clear on 40 consecutive days; a surface water
//           map (the rain row is still meant for it) still rains on some of them
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/weather_underwater_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11359';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const src = readFileSync(PAGE, 'utf8');
check(/if \(m && !m\.isVoid && !m\.isBossArena && !m\.isUnderwater && id\.indexOf\('tower_b'\) !== 0\) \{/.test(src), 'static: the weather gate names isUnderwater beside void / arena / tower');
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env, MOJI_GAME_FILE: PAGE } });
await new Promise((r) => setTimeout(r, 1800));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const ctx = await browser.newContext({ serviceWorkers: 'block' });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof _lxWeatherFor === 'function' && typeof MAPS === 'object', null, { timeout: 180000 });
  const r = await page.evaluate(() => {
    const roll = (id, days) => { const kinds = {}; const oD = window.dailyIndex; for (let d = 0; d < days; d++) { window.dailyIndex = () => 20000 + d; for (const k in _LX_WX_CACHE) delete _LX_WX_CACHE[k]; const w = _lxWeatherFor(id); kinds[w] = (kinds[w] || 0) + 1; } window.dailyIndex = oD; for (const k in _LX_WX_CACHE) delete _LX_WX_CACHE[k]; return kinds; };
    const under = Object.keys(MAPS).filter((k) => MAPS[k] && MAPS[k].isUnderwater);
    const out = {}; for (const id of under) out[id] = roll(id, 40);
    // a surface map the rain row is written for: not underwater, not an arena, name/bg matches the sea row
    const surface = Object.keys(MAPS).find((k) => { const m = MAPS[k]; return m && !m.isUnderwater && !m.isBossArena && !m.isVoid && k.indexOf('tower_b') !== 0 && /sea|reef|tide|ocean|coral|kelp|lagoon|harbor|harbour/i.test(k + ' ' + (m.bg || '') + ' ' + (m.name || '')); });
    return { under, out, surface, surfaceKinds: surface ? roll(surface, 40) : null };
  });
  check(r.under.length >= 5, 'the game has its underwater maps', J(r.under));
  for (const id of r.under) check(r.out[id].clear === 40, `${id}: clear on 40 of 40 days`, J(r.out[id]));
  check(!!r.surface && (r.surfaceKinds.rain || 0) > 0, `a surface water map (${r.surface}) still gets its rain days - the row is intact`, J(r.surfaceKinds));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await ctx.close(); await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
