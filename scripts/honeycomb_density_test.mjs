// BUG10 regression: Honeycomb Hollow must not carry endgame spawn pressure.
//
// Tester, at Lv 85 via the dev console: "very difficult stage ... the bees at
// the start are already quite overwhelming, but going up, monsters cluster and
// it becomes a bullet hell with you having limited mobility".
//
// Measured across all 62 spawning maps — pressure = alive cap / respawn
// multiplier — it ranked 4th at 71 against a median of 15. Its only superiors
// were the Sovereign boss arena, Stardust Atrium (Lv 40) and Abyssal Trench
// (Lv 44+): a Lv 15-26 map with endgame density, on a vertical tower where
// kiting is impossible.
//
// This asserts the dials AND the live population, because the dials alone
// proved nothing the last time a map was tuned — the runtime normalises them.
//   node scripts/honeycomb_density_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const net = await import('node:net');
let PORT = process.argv[2];
if (!PORT) {
  const free = (p) => new Promise((r) => { const s = net.createServer();
    s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
  for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
}
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext()).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof MAPS === 'object' && typeof game === 'object', { timeout: 120000 });

const r = await page.evaluate(async () => {
  const norm = (raw) => Math.round(15 + ((raw || 15) - 15) * 0.85);
  const normMul = (raw) => 1 + ((raw || 1) - 1) * 0.85;
  const out = {};
  const hh = MAPS.honeycombHollow;
  out.rawCap = hh.monsterCap; out.rawMul = hh.respawnDelayMul;
  out.cap = norm(hh.monsterCap); out.mul = normMul(hh.respawnDelayMul);
  out.queued = (hh.spawns || []).reduce((a, s) => a + (s.count | 0), 0);
  out.pressure = Math.round(out.cap / out.mul);

  // Pressure of every spawning map, so this is a RANK not a bare number.
  const all = [];
  for (const id in MAPS) {
    const m = MAPS[id];
    if (!m || !m.spawns || !m.spawns.length) continue;
    const q = m.spawns.reduce((a, s) => a + (s.count | 0), 0);
    if (!q) continue;
    all.push({ id, p: norm(m.monsterCap) / normMul(m.respawnDelayMul) });
  }
  all.sort((a, b2) => b2.p - a.p);
  out.rank = all.findIndex(x => x.id === 'honeycombHollow') + 1;
  out.of = all.length;
  out.median = all.map(x => x.p).sort((a, b2) => a - b2)[all.length >> 1];

  // Live population: walk in and let it settle.
  try {
    game.currentMap = 'honeycombHollow';
    if (typeof loadMap === 'function') loadMap('honeycombHollow');
  } catch (e) { out.loadErr = String(e).slice(0, 100); }
  const peak = [];
  for (let i = 0; i < 40; i++) {
    await new Promise(z => setTimeout(z, 250));
    try { peak.push((game.monsters || []).filter(m => m && m.hp > 0 && !m.isBoss).length); } catch (e) {}
  }
  out.alivePeak = peak.length ? Math.max(...peak) : -1;
  out.aliveLast = peak.length ? peak[peak.length - 1] : -1;
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

ok('map dials were actually lowered', r.rawCap <= 24 && r.rawMul >= 0.7, { cap: r.rawCap, mul: r.rawMul });
ok('effective alive cap is early-map sized (<= 24)', r.cap <= 24, { cap: r.cap });
ok('spawn queue was scaled with the cap, not left at 88', r.queued <= 60, { queued: r.queued });
ok('pressure is no longer endgame tier (<= 35, was 71)', r.pressure <= 35, { pressure: r.pressure });
ok('no longer a top-3 density outlier', r.rank > 3, { rank: r.rank, of: r.of });
ok('still denser than the median map (it is a hive)', r.pressure > r.median, { pressure: r.pressure, median: r.median });
ok('live population respects the cap', r.alivePeak >= 0 && r.alivePeak <= r.cap + 2, { peak: r.alivePeak, cap: r.cap });
ok('the map still populates (this is not an empty-map fix)', r.alivePeak >= 8, { peak: r.alivePeak });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
