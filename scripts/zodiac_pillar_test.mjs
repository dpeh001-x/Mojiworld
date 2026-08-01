// v0.29.396 — the rune column must appear ONLY in zodiac boss domains, not in
// every isBossArena map.
//
//   node serve.js 8793 && node scripts/zodiac_pillar_test.mjs 8793
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const PORT = process.argv[2] || '8793';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => { try { return typeof eval('drawBossDecor') === 'function' && !!eval('MAPS'); } catch { return false; } }, null, { timeout: 120000 });
// The decor bails early until the sprite has decoded. Without this wait every
// case draws 0 and the "non-zodiac draws none" check passes for the wrong
// reason — the gate would look correct even if it were absent.
await page.waitForFunction(() => {
  try { const i = eval('LX_OBJECTS')['column_pillar']; return !!(i && i.complete && i.naturalWidth); }
  catch { return false; }
}, null, { timeout: 120000 });

// Census: how many boss arenas exist, and how many are zodiac domains.
const census = await page.evaluate(() => {
  const M = eval('MAPS');
  const boss = [], zodiac = [], bossNotZodiac = [];
  for (const id of Object.keys(M)) {
    const m = M[id];
    if (!m || !m.isBossArena) continue;
    boss.push(id);
    if (m.isZodiac) zodiac.push(id); else bossNotZodiac.push(id);
  }
  return { boss: boss.length, zodiac: zodiac.length, other: bossNotZodiac.length, sampleOther: bossNotZodiac.slice(0, 6), sampleZodiac: zodiac.slice(0, 3) };
});
ok('the game has boss arenas to gate', census.boss > 0, census);
ok('zodiac domains are a strict subset of boss arenas',
   census.zodiac > 0 && census.other > 0 && census.zodiac + census.other === census.boss, census);

// Count actual pillar draws by spying on the blit the decor uses.
const draws = await page.evaluate(() => {
  const decor = eval('drawBossDecor');
  const g = eval('game');
  const savedMap = g.mapData, savedCam = g.camera;
  const savedSoft = eval('_lxDrawSoft');
  let n = 0;
  try { eval('_lxDrawSoft = function () { n++; }'); } catch (e) { return { err: 'cannot spy: ' + e }; }
  // The spy above closes over this scope's `n` via eval, so it increments here.
  // The two pillars sit at worldWidth*0.12 and *0.88 (216 and 1584 on an 1800
  // wide arena) and are culled when off-screen. At camera 0 only the near one
  // is in view; camera 300 frames both. Pass the camera explicitly so the
  // expected count is a property of the gate, not of an accidental viewport.
  const run = (mapData, camX) => {
    n = 0;
    g.mapData = mapData;
    g.camera = { x: camX || 0, y: 0 };
    try { decor(); } catch (e) { return -1; }
    return n;
  };
  const M = eval('MAPS');
  const zodiacId = Object.keys(M).find(k => M[k] && M[k].isZodiac);
  const otherId  = Object.keys(M).find(k => M[k] && M[k].isBossArena && !M[k].isZodiac);
  const out = {
    zodiac: run(Object.assign({}, M[zodiacId], { worldWidth: 1800 }), 300),
    zodiacNearOnly: run(Object.assign({}, M[zodiacId], { worldWidth: 1800 }), 0),
    otherBoss: run(Object.assign({}, M[otherId], { worldWidth: 1800 }), 300),
    plainMap: run({ worldWidth: 1800 }, 300),
    noMap: run(null, 300),
    // CONTROL: the same non-zodiac arena, with only isZodiac flipped on. If
    // this draws, then the isZodiac gate is genuinely what suppresses the
    // other case — not a missing sprite or a broken spy.
    otherBossForcedZodiac: run(Object.assign({}, M[otherId], { worldWidth: 1800, isZodiac: true }), 300),
    zodiacId, otherId,
  };
  try { eval('_lxDrawSoft = savedSoft'); } catch (e) {}
  g.mapData = savedMap; g.camera = savedCam;
  return out;
});
ok('spy installed', !draws.err, draws.err);
ok('a ZODIAC domain still draws BOTH rune columns', draws.zodiac === 2,
   { drew: draws.zodiac, map: draws.zodiacId });
ok('off-screen culling still works (camera 0 shows only the near column)',
   draws.zodiacNearOnly === 1, { drew: draws.zodiacNearOnly });
ok('a non-zodiac BOSS arena draws none', draws.otherBoss === 0,
   { drew: draws.otherBoss, map: draws.otherId });
ok('an ordinary map draws none', draws.plainMap === 0, { drew: draws.plainMap });
ok('a null mapData does not throw', draws.noMap === 0, { drew: draws.noMap });
ok('CONTROL: same arena with isZodiac forced on DOES draw — so the gate is what suppresses it',
   draws.otherBossForcedZodiac === 2, { drew: draws.otherBossForcedZodiac, map: draws.otherId });

ok('no page errors', errs.length === 0, errs.slice(0, 3));
await b.close();

console.log(`\n  ${census.boss} boss arenas: ${census.zodiac} zodiac (keep pillars), ${census.other} other (lose them)`);
console.log(`  e.g. losing them: ${census.sampleOther.join(', ')}\n`);
let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
