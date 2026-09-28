// v0.29.x — the mage blink must spawn ONE dash lance, not two.
// (v0.30.547: the lance is procedural now — see the note above the evaluate.)
//
// dash_mage.png is a directional lance. The original code fired it twice
// (departure at the origin, arrival at the destination) because that pairing
// was written for the symmetrical procedural rings still used as fallback.
// Two lances pointing the same way read as one effect drawn twice.
//
//   node serve.js 8802 && node scripts/mage_dash_sprite_test.mjs 8802
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
// tests-ports: PORT / MOJI_GAME_FILE from the environment (scripts/apply_tests_ports.mjs); unset = the old defaults
const FILE = process.env.MOJI_GAME_FILE ? process.env.MOJI_GAME_FILE.split(/[\\/]/).pop() : 'mojiworld_game.html';
const PORT = process.argv[2] || process.env.PORT || '8802';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block' })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => { try { return typeof eval('quickDash') === 'function' && !!eval('player'); } catch { return false; } }, null, { timeout: 180000 });

// v0.30.547 (273ee3cc) — the four class dash sprites (dash_mage & co.) and
// _classDashSpriteReady were REMOVED per user; the dash is procedural now
// (spawnDashFx / _spawnBlinkFx / _spawnDashLaunchFx). The "one lance, not two"
// promise carries over to the new art: a blink lays down ONE set of streaks,
// mid-path, bookended by a departure ring and an arrival ring — never a
// duplicated directional effect — and no class spawns a dash sprite at all.
const out = await page.evaluate(() => {
  const p = eval('player'), g = eval('game');
  const saved = { cls: p.cls, x: p.x, t: p.quickDashTimer };
  // Spy on the sprite spawner: any /dash/ sprite burst would mean the removed art crept back.
  const savedBurst = eval('spawnSpriteBurst');
  let calls = [];
  eval('spawnSpriteBurst = function (x, y, key, opts) { calls.push({ x: Math.round(x), key, size: opts && opts.size }); }');

  const run = (cls) => {
    p.cls = cls; p.quickDashTimer = 0; p.x = 400; p.vx = 0;
    calls = []; g.dashFx = [];
    try { eval('quickDash')(1); } catch (e) { return { err: String(e).slice(0, 90) }; }
    const fx = (g.dashFx || []).map(f => ({ type: f.type, x: f.x != null ? Math.round(f.x) : null, follow: !!f.follow }));
    return { sprites: calls.filter(c => /dash/.test(c.key || '')).length, endX: Math.round(p.x),
      streaks: fx.filter(f => f.type === 'streaks'), rings: fx.filter(f => f.type === 'ring').length, fx };
  };
  const res = { mage: run('mage'), warrior: run('warrior'), archer: run('archer'), rogue: run('rogue') };

  eval('spawnSpriteBurst = savedBurst'); g.dashFx = [];
  p.cls = saved.cls; p.x = saved.x; p.quickDashTimer = saved.t;
  return res;
});

ok('the class dash sprite gate is gone (v0.30.547)', await page.evaluate(() => typeof window._classDashSpriteReady === 'undefined'), null);
ok('mage blink spawns ONE streak set, not two', out.mage.streaks && out.mage.streaks.length === 1, out.mage);
ok('...bookended by exactly two rings (departure + arrival)', out.mage.rings === 2, out.mage);
for (const c of ['warrior', 'archer', 'rogue'])
  ok(c + ' dash spawns one streak set riding the hero', out[c].streaks && out[c].streaks.length === 1 && out[c].streaks[0].follow, out[c]);
ok('no class spawns a dash sprite any more', ['mage', 'warrior', 'archer', 'rogue'].every(c => out[c].sprites === 0), ['mage', 'warrior', 'archer', 'rogue'].map(c => out[c].sprites));
// The single streak set should sit between origin and destination, not on top of either.
const mx = out.mage.streaks && out.mage.streaks[0] ? out.mage.streaks[0].x : null;
ok('the blink streaks are placed mid-blink, not at the origin', mx != null && mx > 410 && mx < out.mage.endX + 40, { x: mx, origin: 400, end: out.mage.endX });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

await b.close();
let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
