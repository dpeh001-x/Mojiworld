// v0.29.313 — certify the Lv-85 scaling cap for Train Rush + Tower Expedition.
// Runtime, against the real spawn/scale paths: both modes must track the
// player's level and then stop dead at 85.
//
//   node serve.js 8776 && node scripts/scaled_mode_cap_test.mjs 8776
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const PORT = process.argv[2] || '8776';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
try {
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof game !== 'undefined' && typeof _expeditionScaleMob === 'function', null, { timeout: 60000 });
  await page.waitForTimeout(2500);

  const r = await page.evaluate(() => {
    const out = {};
    out.cap = LX_SCALED_LEVEL_CAP;
    // helper mirrors the shared clamp
    out.clamp = [1, 20, 84, 85, 86, 150, 200].map(L => _lxScaledMobLevel(L));

    // ---- TOWER EXPEDITION ----
    // _expeditionScaleMob requires an active run on a tower_b* floor.
    game.expedition = { active: true, floor: 3 };
    const realMap = game.currentMap;
    game.currentMap = 'tower_b3';
    const mk = () => ({ uid: 1, type: 'towerWarden', name: 'Warden', level: 20,
      maxHp: 1000, currentHp: 1000, atk: 50, def: 10, exp: 100, mojicoins: 7,
      x: 300, y: 300, w: 40, h: 40, traits: {} });
    out.expedition = {};
    for (const L of [20, 50, 85, 120, 200]) {
      const m = _expeditionScaleMob(mk(), L);
      out.expedition[L] = { level: m.level, hp: m.maxHp, atk: m.atk, exp: m.exp, coins: m.mojicoins };
    }
    game.expedition = null; game.currentMap = realMap;

    // ---- TRAIN RUSH (expressScaling) ----
    // Drive the real spawnMonster path with the express flag on the map.
    const prevMapData = game.mapData;
    game.mapData = Object.assign({}, game.mapData || {}, { expressScaling: true });
    out.express = {};
    for (const L of [20, 50, 85, 120, 200]) {
      player.level = L;
      game.monsters.length = 0;
      let m = null;
      for (let a = 0; a < 5 && !m; a++) {
        game.monsters.length = 0;
        try { m = spawnMonster(player.x + 60 + a * 20, player.y, 'slime', false, false); } catch (e) { m = null; }
        if (m && m._suppressed) m = null;
      }
      if (m) out.express[L] = { level: m.level, hp: m.maxHp, atk: m.atk, exp: m.exp, name: m.name };
    }
    game.mapData = prevMapData;
    game.monsters.length = 0;

    // ---- non-scaled content must be untouched ----
    game.mapData = Object.assign({}, prevMapData || {}, { expressScaling: false });
    player.level = 200;
    game.monsters.length = 0;
    let plain = null;
    for (let a = 0; a < 5 && !plain; a++) {
      game.monsters.length = 0;
      try { plain = spawnMonster(player.x + 60 + a * 20, player.y, 'slime', false, false); } catch (e) { plain = null; }
      if (plain && plain._suppressed) plain = null;
    }
    out.plain = plain ? { level: plain.level, hp: plain.maxHp } : null;
    game.mapData = prevMapData;
    return out;
  });

  ok('cap constant is 85', r.cap === 85, r.cap);
  ok('clamp tracks level then stops at 85',
     JSON.stringify(r.clamp) === JSON.stringify([1, 20, 84, 85, 85, 85, 85]), r.clamp);

  const e = r.expedition;
  ok('expedition: Lv 50 player -> Lv 50 mobs', e[50] && e[50].level === 50, e[50]);
  ok('expedition: Lv 85 player -> Lv 85 mobs', e[85] && e[85].level === 85, e[85]);
  ok('expedition: Lv 120 player CAPPED at 85', e[120] && e[120].level === 85, e[120]);
  ok('expedition: Lv 200 player CAPPED at 85', e[200] && e[200].level === 85, e[200]);
  ok('expedition: stats stop growing past the cap',
     e[120] && e[200] && e[120].hp === e[200].hp && e[120].atk === e[200].atk,
     { at120: e[120], at200: e[200] });
  ok('expedition: still grants no mojicoins', e[85] && e[85].coins === 0, e[85]);

  const x = r.express;
  ok('train rush: Lv 50 player -> Lv 50 mechs', x[50] && x[50].level === 50, x[50]);
  ok('train rush: Lv 85 player -> Lv 85 mechs', x[85] && x[85].level === 85, x[85]);
  ok('train rush: Lv 120 player CAPPED at 85', x[120] && x[120].level === 85, x[120]);
  ok('train rush: Lv 200 player CAPPED at 85', x[200] && x[200].level === 85, x[200]);
  ok('train rush: stats stop growing past the cap',
     x[120] && x[200] && x[120].hp === x[200].hp && x[120].atk === x[200].atk && x[120].exp === x[200].exp,
     { at120: x[120], at200: x[200] });
  ok('train rush: scales UP with level below the cap',
     x[20] && x[85] && x[85].hp > x[20].hp && x[85].exp > x[20].exp,
     { at20: x[20], at85: x[85] });

  // Ordinary field monsters carry no m.level at all — their level lives in
  // MOB_NATURAL_LEVEL — so the regression to guard against is the scalers
  // leaking onto normal maps and stamping a level / inflating HP.
  ok('ordinary maps are NOT scaled (Lv 200 player, plain slime untouched)',
     r.plain && r.plain.level == null && r.plain.hp < 200, r.plain);
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} finally { await b.close(); }

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x !== undefined ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
