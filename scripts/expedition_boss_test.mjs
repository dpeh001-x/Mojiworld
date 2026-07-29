// v0.29.316 — expedition bosses: level = capped player level + 10, stats to
// match, and decisively above a field monster of that level.
//
//   node serve.js 8779 && node scripts/expedition_boss_test.mjs 8779
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const PORT = process.argv[2] || '8779';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
try {
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof game !== 'undefined' && typeof _expeditionSpawnTowerBoss === 'function', null, { timeout: 60000 });
  await page.waitForTimeout(2500);

  const r = await page.evaluate(async () => {
    const out = { rows: [], cap: LX_SCALED_LEVEL_CAP, mul: EXPEDITION_BOSS_MUL };
    const prevMap = game.currentMap;
    for (const L of [20, 30, 50, 70, 85, 120, 200]) {
      const row = { L };
      for (const slot of ['mid', 'final']) {
        game.expedition = { active: true, floor: slot === 'mid' ? 5 : 10 };
        game.currentMap = slot === 'mid' ? 'tower_b5' : 'tower_b10';
        game.mapData = game.mapData || {};
        player.level = L;
        game.monsters.length = 0;
        _expeditionSpawnTowerBoss(slot);
        await new Promise(res => setTimeout(res, 1400));   // spawn is deferred
        const m = game.monsters.find(x => x && x._expeditionBoss);
        if (m) row[slot] = { lv: m.level, hp: m.maxHp, atk: m.atk, def: m.def, exp: m.exp, type: m.type };
        game.monsters.length = 0;
      }
      row.fieldAtBossLv = row.final ? _lxFieldBaseline(row.final.lv) : null;
      out.rows.push(row);
    }
    game.expedition = null; game.currentMap = prevMap;
    return out;
  });

  console.log('EXPEDITION BOSSES — level should be capped(player)+10, max ' + (r.cap + 10) + '\n');
  console.log('  player |  mid-boss lv / hp        | final-boss lv / hp       | field mob hp at boss lv');
  for (const row of r.rows) {
    const f = (n) => n == null ? '-' : Math.round(n).toLocaleString();
    console.log('  ' + String(row.L).padStart(6)
      + ' | ' + ((row.mid ? 'Lv ' + row.mid.lv + '  ' + f(row.mid.hp) : '-')).padEnd(24)
      + ' | ' + ((row.final ? 'Lv ' + row.final.lv + '  ' + f(row.final.hp) : '-')).padEnd(24)
      + ' | ' + (row.fieldAtBossLv ? f(row.fieldAtBossLv.hp) : '-'));
  }
  console.log('');

  const want = (L) => Math.min(L, r.cap) + 10;
  for (const row of r.rows) {
    ok(`Lv ${row.L}: mid-boss level == capped+10 (${want(row.L)})`,
       row.mid && row.mid.lv === want(row.L), row.mid && { got: row.mid.lv, want: want(row.L) });
    ok(`Lv ${row.L}: final-boss level == capped+10 (${want(row.L)})`,
       row.final && row.final.lv === want(row.L), row.final && { got: row.final.lv, want: want(row.L) });
  }
  const top = r.rows[r.rows.length - 1];
  ok('boss level never exceeds the cap+10 ceiling',
     r.rows.every(x => (!x.mid || x.mid.lv <= r.cap + 10) && (!x.final || x.final.lv <= r.cap + 10)),
     { maxMid: Math.max(...r.rows.map(x => x.mid ? x.mid.lv : 0)),
       maxFinal: Math.max(...r.rows.map(x => x.final ? x.final.lv : 0)) });
  ok('boss level never exceeds the game level cap (200)',
     r.rows.every(x => (!x.final || x.final.lv <= 200)));
  ok('stats stop growing past the cap (Lv 120 == Lv 200)',
     top.final && r.rows.find(x => x.L === 120).final.hp === top.final.hp,
     { at120: r.rows.find(x => x.L === 120).final, at200: top.final });
  ok('bosses scale UP with player level below the cap',
     r.rows[0].final && top.final && top.final.hp > r.rows[0].final.hp,
     { at20: r.rows[0].final && r.rows[0].final.hp, at200: top.final && top.final.hp });
  // "higher stats" — decisively above a field monster of the same level
  for (const row of r.rows) {
    if (!row.final || !row.fieldAtBossLv) continue;
    ok(`Lv ${row.L}: final boss HP >> field mob at its level`,
       row.final.hp > row.fieldAtBossLv.hp * 3,
       { boss: row.final.hp, field: row.fieldAtBossLv.hp,
         ratio: +(row.final.hp / row.fieldAtBossLv.hp).toFixed(1) });
  }
  ok('final boss is tougher than the mid boss at every level',
     r.rows.every(x => !x.mid || !x.final || x.final.hp > x.mid.hp));
  ok('boss levels are monotonic in player level', (() => {
    let last = 0; for (const x of r.rows) { if (!x.final) continue; if (x.final.lv < last) return false; last = x.final.lv; } return true;
  })());
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} finally { await b.close(); }

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
