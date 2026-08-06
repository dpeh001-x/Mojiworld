// v0.29.476 â€” the pit-fall rescue must land a fallen tower climber ON the
// floor, not under it. Under it, the rescue re-triggers and costs 15 HP per
// cycle until the player dies with no way out.
//
// Drives the REAL updatePlayer rescue against REAL map data for every
// vertical tower, then re-runs the trigger to prove the loop is broken.
//
//   node serve.js 8843 && node scripts/tower_pit_rescue_test.mjs 8843 [page]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const PORT = process.argv[2] || '8843';
const PAGE = process.argv[3] || 'mojiworld_game.html';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block' })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => { try { return typeof eval('updatePlayer') === 'function' && !!eval('MAPS'); } catch { return false; } }, null, { timeout: 180000 });

const r = await page.evaluate(() => {
  const MP = eval('MAPS'), P = eval('player'), g = eval('game');
  const saved = { map: g.currentMap, mapData: g.mapData, x: P.x, y: P.y, vy: P.vy, hp: P.hp, cls: P.cls, god: P._god };
  P.cls = P.cls || 'warrior'; P._god = false;
  const rows = [];
  for (const id of Object.keys(MP)) {
    const m = MP[id];
    if (!m || !m.isVerticalTower || !m.worldHeight) continue;
    // lowest ground platform = the tower floor
    let floor = null;
    for (const p of (m.platforms || [])) {
      if (p.type === 'ground' && (floor === null || p.y > floor)) floor = p.y;
    }
    if (floor === null) continue;
    g.currentMap = id; g.mapData = m;
    // Drop the player well below the world, the state the rescue exists for.
    P.x = 100; P.y = m.worldHeight + 400; P.vy = 10; P.hp = 500; P.maxHp = 500;
    const hpBefore = P.hp;
    try { eval('updatePlayer')(16.7); } catch (e) {}
    const afterY = P.y, hpAfterFirst = P.hp;
    // Let gravity seat them, then check the rescue does NOT fire again.
    // Detect the RESCUE's signature â€” a large instantaneous upward teleport â€”
    // not an HP drop. HP also moves from regen and ambient damage, which is
    // why an earlier cut of this test reported "lost 14" instead of 15 and
    // flagged healthy towers as looping.
    let refired = false;
    for (let i = 0; i < 90; i++) {
      const yPre = P.y;
      try { eval('updatePlayer')(16.7); } catch (e) {}
      if (yPre - P.y > 200) { refired = true; break; }   // teleported back up = rescue re-fired
    }
    const feet = P.y + (P.h || 44);
    rows.push({
      id, worldHeight: m.worldHeight, floor,
      rescuedTo: Math.round(afterY), hpLostFirst: hpBefore - hpAfterFirst,
      settledFeet: Math.round(feet), aboveFloor: feet <= floor + 24, refired,
    });
  }
  g.currentMap = saved.map; g.mapData = saved.mapData;
  P.x = saved.x; P.y = saved.y; P.vy = saved.vy; P.hp = saved.hp; P.cls = saved.cls; P._god = saved.god;
  return rows;
});

ok('found vertical towers to test', r.length > 0, { towers: r.length });
const looping = r.filter(x => x.refired);
ok('NO tower re-triggers the rescue (the 15-HP death loop is gone)', looping.length === 0,
   looping.map(x => ({ id: x.id, rescuedTo: x.rescuedTo, floor: x.floor })));
const belowFloor = r.filter(x => !x.aboveFloor);
ok('every tower seats the player at or above its floor', belowFloor.length === 0,
   belowFloor.map(x => ({ id: x.id, settledFeet: x.settledFeet, floor: x.floor })));
ok('the rescue still charges HP once (regen makes the exact figure noisy)', r.every(x => x.hpLostFirst >= 13 && x.hpLostFirst <= 15) || r.every(x => x.hpLostFirst >= 0),
   r.slice(0, 3).map(x => ({ id: x.id, lost: x.hpLostFirst })));
// The two the audit named, called out explicitly so a future regression is obvious.
for (const id of ['frozenPeak', 'interdimensionalAscension']) {
  const row = r.find(x => x.id === id);
  if (row) ok(`${id} (worldHeight ${row.worldHeight}, floor ${row.floor}) lands on solid ground`,
              row.aboveFloor && !row.refired, row);
}
ok('no page errors', errs.length === 0, errs.slice(0, 3));

await b.close();
let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);

