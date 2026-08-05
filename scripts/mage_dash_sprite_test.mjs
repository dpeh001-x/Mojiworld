// v0.29.x — the mage blink must spawn ONE dash lance, not two.
//
// dash_mage.png is a directional lance. The original code fired it twice
// (departure at the origin, arrival at the destination) because that pairing
// was written for the symmetrical procedural rings still used as fallback.
// Two lances pointing the same way read as one effect drawn twice.
//
//   node serve.js 8802 && node scripts/mage_dash_sprite_test.mjs 8802
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const PORT = process.argv[2] || '8802';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block' })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => { try { return typeof eval('quickDash') === 'function' && !!eval('player'); } catch { return false; } }, null, { timeout: 180000 });

const out = await page.evaluate(() => {
  const p = eval('player'), g = eval('game');
  const saved = { cls: p.cls, x: p.x, t: p.quickDashTimer };
  // Spy on the sprite spawner so we count bursts rather than infer from pixels.
  const savedBurst = eval('spawnSpriteBurst');
  let calls = [];
  eval('spawnSpriteBurst = function (x, y, key, opts) { calls.push({ x: Math.round(x), key, size: opts && opts.size }); }');
  // Force the dash sprite to be considered ready so we exercise the art path,
  // not the procedural-ring fallback.
  const savedReady = eval('_classDashSpriteReady');
  eval('_classDashSpriteReady = function () { return "dash_mage"; }');

  const run = (cls) => {
    p.cls = cls; p.quickDashTimer = 0; p.x = 400; p.vx = 0;
    calls = [];
    try { eval('quickDash')(1); } catch (e) { return { err: String(e).slice(0, 90) }; }
    return { bursts: calls.filter(c => /dash/.test(c.key || '')).length, detail: calls.slice(0, 4) };
  };
  const res = { mage: run('mage'), warrior: run('warrior'), archer: run('archer'), rogue: run('rogue') };

  eval('spawnSpriteBurst = savedBurst'); eval('_classDashSpriteReady = savedReady');
  p.cls = saved.cls; p.x = saved.x; p.quickDashTimer = saved.t;
  return res;
});

ok('mage blink spawns exactly ONE dash sprite', out.mage.bursts === 1, out.mage);
ok('warrior still spawns one', out.warrior.bursts === 1, out.warrior);
ok('archer still spawns one', out.archer.bursts === 1, out.archer);
ok('rogue still spawns one', out.rogue.bursts === 1, out.rogue);
// The single lance should sit between origin and destination, not on top of either.
const mx = out.mage.detail && out.mage.detail[0] ? out.mage.detail[0].x : null;
ok('the lance is placed mid-blink, not at the origin', mx != null && mx > 410, { x: mx, origin: 400 });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

await b.close();
let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
