// v0.29.314 — does a scaled-mode monster actually match its stamped level?
// For each level, measure a REAL field monster of that level (HP / ATK / EXP
// delivered), then build a Train Rush mech and a Tower Expedition mob at the
// same level and compare. Anything that does not track the field baseline is
// a correlation bug: the nameplate says Lv 60 but the creature is not Lv 60.
//
//   node serve.js 8777 && node scripts/scaled_mode_correlation_audit.mjs 8777
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const PORT = process.argv[2] || '8777';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => typeof game !== 'undefined' && typeof _expeditionScaleMob === 'function', null, { timeout: 60000 });
await page.waitForTimeout(2500);

const data = await page.evaluate(() => {
  const EXCLUDE = /^(tower|express|ticket|conductor|mirror)/i;
  const byLevel = {};
  for (const [id, lv] of Object.entries(MOB_NATURAL_LEVEL)) {
    const t = monsterTypes[id];
    if (!t || t.isBoss || t.boss || EXCLUDE.test(id)) continue;
    (byLevel[lv] ||= []).push(id);
  }
  const lvls = Object.keys(byLevel).map(Number).sort((a, c) => a - c);
  const nearest = (L) => { let best = lvls[0]; for (const k of lvls) if (Math.abs(k - L) < Math.abs(best - L)) best = k; return best; };
  const neutral = () => {
    game.comboMult = 1; game.combo = 0; game.prestige = null; game._mapAffix = null;
    player.mods = player.mods || {}; player.mods.xpBoost = 0;
    player.equipment = {}; player.boonsEquipped = []; player.boons = [];
    player._msWin = null; game.expedition = null; game.tower = null;
    player.maxHp = 1e7; player.hp = 1e7;
  };
  const med = (a) => { a = a.slice().sort((x, y) => x - y); return a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2; };
  // Reject elite / mini-boss rolls. spawnMonster promotes a small % of spawns
  // (elite 3x HP, mini-boss 5x), and catching one made the field baseline jump
  // 5x for the SAME monster between two rows of this table — which read as a
  // correlation failure that was really a sampling artifact.
  const spawn = (id) => {
    let m = null;
    for (let a = 0; a < 12; a++) {
      game.monsters.length = 0;
      let c = null;
      try { c = spawnMonster(player.x + 60 + (a % 5) * 22, player.y, id, false, false); } catch (e) { c = null; }
      if (!c || c._suppressed) continue;
      if (c.isElite || c.isMiniBoss || c._miniElitePromoted) continue;   // reroll
      m = c; break;
    }
    return m;
  };
  const out = { rows: [], errors: [] };
  const prevMap = game.mapData, prevMapId = game.currentMap;

  for (const L of [20, 30, 40, 50, 60, 70, 80, 85]) {
    const row = { L };
    // ---- FIELD baseline at this level ----
    const srcLv = byLevel[L] ? L : nearest(L);
    row.fieldLv = srcLv;
    const hps = [], atks = [], exps = [];
    for (const id of byLevel[srcLv]) {
      neutral(); game.mapData = prevMap; player.level = L;
      const m = spawn(id);
      if (!m) continue;
      hps.push(m.maxHp); atks.push(m.atk);
      player.exp = 0; player.expToNext = 1e15;
      m.currentHp = 1;
      try { hitMonster(m, 1e9, false, 'aoe'); } catch (e) {}
      if (player.exp > 0) exps.push(player.exp);
    }
    if (hps.length) { row.field = { hp: med(hps), atk: med(atks), exp: exps.length ? med(exps) : null }; }

    // ---- TRAIN RUSH mech at this level ----
    neutral();
    game.mapData = Object.assign({}, prevMap || {}, { expressScaling: true });
    player.level = L;
    const em = spawn('slime');
    if (em) {
      row.express = { lv: em.level, hp: em.maxHp, atk: em.atk };
      player.exp = 0; player.expToNext = 1e15; em.currentHp = 1;
      try { hitMonster(em, 1e9, false, 'aoe'); } catch (e) {}
      row.express.exp = player.exp;
    }
    game.mapData = prevMap;

    // ---- TOWER EXPEDITION mob at this level ----
    neutral();
    game.expedition = { active: true, floor: 3 };
    game.currentMap = 'tower_b3';
    const base = { uid: 1, type: 'towerWarden', name: 'W', level: 20, maxHp: 1000,
      currentHp: 1000, atk: 50, def: 10, exp: 100, mojicoins: 7,
      x: 300, y: 300, w: 40, h: 40, traits: {} };
    const xm = _expeditionScaleMob(base, L);
    row.exped = { lv: xm.level, hp: xm.maxHp, atk: xm.atk, expField: xm.exp };
    // deliver its EXP through the real pipeline for an apples-to-apples number
    neutral(); game.expedition = { active: true, floor: 3 }; game.currentMap = 'tower_b3';
    player.level = L; player.exp = 0; player.expToNext = 1e15;
    game.monsters.length = 0;
    const live = Object.assign({}, xm, { currentHp: 1 });
    game.monsters.push(live);
    try { hitMonster(live, 1e9, false, 'aoe'); } catch (e) {}
    row.exped.exp = player.exp;
    game.expedition = null; game.currentMap = prevMapId;

    out.rows.push(row);
  }
  game.mapData = prevMap; game.currentMap = prevMapId;
  return out;
});
await b.close();

const f = (n) => n == null ? '   -' : Math.round(n).toLocaleString();
const rat = (a, c) => (a == null || !c) ? '  -' : (a / c).toFixed(2) + 'x';
console.log('SCALED MODES vs A REAL FIELD MONSTER OF THE SAME LEVEL\n');
console.log('  Lv |        field (hp/atk/exp)  |     Train Rush  ratio vs field |    Expedition  ratio vs field');
console.log('  ---+----------------------------+--------------------------------+------------------------------');
for (const r of data.rows) {
  const fd = r.field || {};
  console.log('  ' + String(r.L).padStart(3)
    + ' | ' + (f(fd.hp) + '/' + f(fd.atk) + '/' + f(fd.exp)).padEnd(26)
    + ' | ' + (r.express ? (f(r.express.hp) + '/' + f(r.express.atk) + '/' + f(r.express.exp)) : '-').padEnd(22)
    + ' hp ' + rat(r.express && r.express.hp, fd.hp) + ' exp ' + rat(r.express && r.express.exp, fd.exp)
    + ' | ' + (r.exped ? (f(r.exped.hp) + '/' + f(r.exped.atk) + '/' + f(r.exped.exp)) : '-').padEnd(20)
    + ' hp ' + rat(r.exped && r.exped.hp, fd.hp) + ' exp ' + rat(r.exped && r.exped.exp, fd.exp));
}
console.log('\nlevel stamped correctly:');
for (const r of data.rows) {
  const okE = r.express && r.express.lv === r.L, okX = r.exped && r.exped.lv === r.L;
  console.log('  Lv ' + String(r.L).padStart(3) + '  trainRush=' + (r.express ? r.express.lv : '-') + (okE ? ' ok' : ' MISMATCH')
    + '   expedition=' + (r.exped ? r.exped.lv : '-') + (okX ? ' ok' : ' MISMATCH'));
}
if (errs.length) console.log('\npage errors: ' + errs.slice(0, 3).join(' | '));
