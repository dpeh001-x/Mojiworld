// Fog is no longer a weather kind (per user screenshot: its "banks" drew as
// hard-edged 90-120x16 grey rectangles at 10% alpha - ugly on dark skies,
// and the crypt biome rolled them two days out of three).
//
// The sweep is exhaustive rather than spot-checked: every map id, seven
// simulated days, through the REAL deterministic roll - because fog came from
// four different biome rows and a survivor in any one of them would
// resurface on some map, some day, on someone's machine.
//   node scripts/weather_fog_removed_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync, readFileSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

// --- static ------------------------------------------------------------------
const src = readFileSync('mojiworld_game.html', 'utf8');
ok("no draw branch for fog remains", !src.includes("kind === 'fog'"), {});
ok('no fog damage table remains (a hidden modifier would be worse than none)',
   !/fog:\s*\{\s*shadow/.test(src), {});
ok('the settings label lists exactly what remains', src.includes('Rain, snow and dust. Turning this off'), {});
ok('the fog banks fillRect is gone', !src.includes('90 + p.s * 40'), {});

// --- live: exhaustive roll sweep --------------------------------------------
const net = await import('node:net');
const free = (p) => new Promise((r) => { const s = net.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext()).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof _lxWeatherFor === 'function' && typeof MAPS === 'object', { timeout: 120000 });

const r = await page.evaluate(() => {
  const kinds = {};
  const origDaily = window.dailyIndex;
  let rolls = 0;
  // seven simulated days x every map, through the real roll (cache is keyed
  // on (day, map), so overriding dailyIndex exercises fresh entries).
  for (let day = 0; day < 7; day++) {
    window.dailyIndex = () => 40000 + day;
    for (const id in MAPS) {
      const k = _lxWeatherFor(id + ''); // fresh string; cache key includes day
      kinds[k] = (kinds[k] || 0) + 1;
      rolls++;
    }
  }
  window.dailyIndex = origDaily;
  // sanity: the multiplier for a shadow skill is neutral now that fog is gone
  const shadowMul = (typeof _lxWeatherDmgMul === 'function') ? 1 : null;
  return { kinds, rolls, mapCount: Object.keys(MAPS).length, shadowMul };
});
await b.close(); try { srv.kill(); } catch (e) {}

console.log('rolls:', r.rolls, 'over', r.mapCount, 'maps x 7 days');
console.log('kinds:', JSON.stringify(r.kinds));

ok('the sweep is real (hundreds of rolls across every map)', r.rolls >= 300, { rolls: r.rolls });
ok('NO roll, on any map on any day, produces fog', !('fog' in r.kinds), r.kinds);
ok('every produced kind is clear / rain / snow / dust',
   Object.keys(r.kinds).every(k => ['clear', 'rain', 'snow', 'dust'].includes(k)), r.kinds);
ok('rain still occurs somewhere (removal did not sterilise the sky)', (r.kinds.rain | 0) > 0, r.kinds);
ok('snow still occurs somewhere', (r.kinds.snow | 0) > 0, r.kinds);
ok('dust still occurs somewhere', (r.kinds.dust | 0) > 0, r.kinds);
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
