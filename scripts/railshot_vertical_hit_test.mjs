// Railshot must hit anything its rail passes through.
//
// Per user: "Archer's Railshot does not hit enemies sometimes, i believe that
// the vertical height is too little, add on to that."
//
// The lane was narrow AND measured against the monster's CENTRE, so a tall
// monster whose body crossed the beam was skipped because its midpoint sat
// above it. Driven against the live skill with real monsters placed on the
// ground, because the interesting cases are the big ones.
//   node scripts/railshot_vertical_hit_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

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
await page.waitForFunction(() => typeof SKILL_FNS === 'object' && typeof monsterTypes === 'object', null, { timeout: 120000 });

const r = await page.evaluate(() => {
  const out = {};
  game.paused = true;                       // the suite owns the clock
  const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none';
  player.cls = 'archer'; player.job = 'sniper';
  player.hp = getMaxHp(); player.mp = 9999; player.skillCooldowns = {};
  player.facing = 1;

  // Stand the player on flat ground and place a dummy of the given height with
  // its FEET on the same line — the ordinary case the report is about.
  const GROUND = 480;
  const place = (h, w) => {
    player.y = GROUND - player.h;
    const m = { type: 'dummy', label: 'dummy', x: player.x + 260, y: GROUND - h, w: w || 80, h,
      hp: 1e9, maxHp: 1e9, currentHp: 1e9, atk: 1, def: 0, exp: 0, mojicoins: 0, speed: 0, facing: -1 };
    game.monsters = [m];
    return m;
  };
  const fire = (h, w) => {
    const m = place(h, w);
    const before = m.currentHp;
    player.skillCooldowns = {}; player.mp = 9999;
    SKILL_FNS.snipe_railgun();
    return { hit: m.currentHp < before, h };
  };

  // Heights taken from the real roster: the tallest boss down to a small mob.
  out.byHeight = [380, 300, 238, 160, 151, 150, 130, 90, 60, 40, 24].map(h => fire(h));

  // Every real monster type in the game, standing on the ground.
  const types = Object.keys(monsterTypes || {});
  out.typeTotal = 0; out.typeMissed = [];
  for (const t of types) {
    const d = monsterTypes[t];
    if (!d || !d.h || !d.w) continue;
    out.typeTotal++;
    const res = fire(d.h, d.w);
    if (!res.hit) out.typeMissed.push({ type: t, h: d.h });
  }

  // A monster genuinely out of the rail's path must still be missed, or the
  // fix is just "hit everything".
  {
    const m = place(40, 60);
    m.y = GROUND - 40 - 420;                // far overhead
    const before = m.currentHp;
    player.skillCooldowns = {}; player.mp = 9999;
    SKILL_FNS.snipe_railgun();
    out.overheadHit = m.currentHp < before;
  }
  // ...and so must something behind the archer.
  {
    const m = place(80, 60);
    m.x = player.x - 300;
    const before = m.currentHp;
    player.skillCooldowns = {}; player.mp = 9999;
    player.facing = 1;
    SKILL_FNS.snipe_railgun();
    out.behindHit = m.currentHp < before;
  }
  game.monsters = []; game.paused = false;
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

const missedHeights = r.byHeight.filter(x => !x.hit).map(x => x.h);
console.log('by height:', JSON.stringify(r.byHeight));
console.log('real types tested:', r.typeTotal, '| missed:', r.typeMissed.length, JSON.stringify(r.typeMissed.slice(0, 8)));
console.log('overhead hit (should be false):', r.overheadHit, '| behind hit (should be false):', r.behindHit);

ok('the tallest boss in the game is hit (Gravitos-sized, h=380)',
   r.byHeight.find(x => x.h === 380)?.hit === true, { h: 380 });
ok('the Sovereign-sized body is hit (h=300)', r.byHeight.find(x => x.h === 300)?.hit === true, {});
ok('Legosaurus-sized is hit (h=238)', r.byHeight.find(x => x.h === 238)?.hit === true, {});
ok('the 150px band that used to fall just outside the lane is hit',
   r.byHeight.find(x => x.h === 150)?.hit === true && r.byHeight.find(x => x.h === 151)?.hit === true, {});
ok('ordinary and small monsters still hit', missedHeights.length === 0, { missedHeights });
ok('NO monster type in the roster is missed standing on flat ground',
   r.typeMissed.length === 0, { missed: r.typeMissed.slice(0, 6), of: r.typeTotal });
ok('the roster check actually covered the game (100+ types)', r.typeTotal >= 100, { tested: r.typeTotal });
ok('something far overhead is still NOT hit (it is a rail, not a screen-wipe)',
   r.overheadHit === false, { overheadHit: r.overheadHit });
ok('something behind the archer is still NOT hit', r.behindHit === false, { behindHit: r.behindHit });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
