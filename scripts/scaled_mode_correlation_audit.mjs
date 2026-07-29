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
  // hitMonster rolls a random miss on every non-exempt skill; a missed probe
  // recorded 0 EXP and showed up as "ratio 0" / a monotonicity break. Retry
  // until the blow lands (a miss changes nothing, so retrying is safe).
  const killFor = (m) => {
    player.exp = 0; player.expToNext = 1e15;
    for (let i = 0; i < 60; i++) {
      m.currentHp = 1;
      try { hitMonster(m, 1e9, false, 'aoe'); } catch (e) {}
      if (player.exp > 0) return player.exp;
    }
    return 0;
  };
  const out = { rows: [], errors: [] };
  const prevMap = game.mapData, prevMapId = game.currentMap;

  for (const L of [20, 30, 40, 50, 60, 70, 80, 85]) {
    const row = { L };
    // ---- FIELD baseline at this level ----
    // Average across EVERY mob within +/-3 levels, which is the same
    // population _lxFieldBaseline() averages. Comparing against a single
    // sampled monster was apples-to-oranges: individual mobs sit 2-3x either
    // side of their level's mean, which showed up as false correlation error.
    const at = Math.min(L, Math.max(...lvls));
    let pool = [];
    for (const k of lvls) if (Math.abs(k - at) <= 3) pool = pool.concat(byLevel[k]);
    if (!pool.length) pool = byLevel[nearest(at)];
    row.fieldLv = at; row.poolSize = pool.length;
    const hps = [], atks = [], exps = [];
    for (const id of pool) {
      neutral(); game.mapData = prevMap; player.level = L;
      const m = spawn(id);
      if (!m) continue;
      hps.push(m.maxHp); atks.push(m.atk);
      { const g = killFor(m); if (g > 0) exps.push(g); }
    }
    if (hps.length) { row.field = { hp: med(hps), atk: med(atks), exp: exps.length ? med(exps) : null }; }
    // what the in-game helper predicts for this level, for direct comparison
    try { row.predicted = _lxFieldBaseline(L); } catch (e) { row.predicted = null; }

    // ---- TRAIN RUSH mech at this level ----
    neutral();
    game.mapData = Object.assign({}, prevMap || {}, { expressScaling: true });
    player.level = L;
    const em = spawn('slime');
    if (em) {
      row.express = { lv: em.level, hp: em.maxHp, atk: em.atk };
      row.express.exp = killFor(em);
      // the level baseline before the map multiplier, to separate the two
      try { row.expressBaseExp = _lxFieldBaseline(L).exp; } catch (e) {}
    }
    game.mapData = prevMap;

    // ---- TOWER EXPEDITION mob at this level ----
    neutral();
    game.expedition = { active: true, floor: 3 };
    game.currentMap = 'tower_b3';
    // Spawn a REAL tower mob rather than hand-building one: _expeditionScaleMob
    // recovers this map's EXP multiplier by comparing the mob's spawned EXP
    // against its authored value, so a synthetic `exp` fed it a fake ratio.
    let base = spawn('towerWarden');
    if (!base) {
      base = { uid: 1, type: 'towerWarden', name: 'W', level: 20, maxHp: 1000,
        currentHp: 1000, atk: 50, def: 10, exp: 100, mojicoins: 7,
        x: 300, y: 300, w: 40, h: 40, traits: {} };
    }
    game.expedition = { active: true, floor: 3 };
    game.currentMap = 'tower_b3';
    const xm = _expeditionScaleMob(base, L);
    row.exped = { lv: xm.level, hp: xm.maxHp, atk: xm.atk, expField: xm.exp };
    // deliver its EXP through the real pipeline for an apples-to-apples number
    neutral(); game.expedition = { active: true, floor: 3 }; game.currentMap = 'tower_b3';
    player.level = L;
    game.monsters.length = 0;
    const live = Object.assign({}, xm, { currentHp: 1 });
    game.monsters.push(live);
    row.exped.exp = killFor(live);
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
// ---------------------------------------------------------------- assertions
// Design intent: Train Rush = 2x a field monster of the same level on HP/ATK
// and 1x on EXP; Tower Expedition = 1x on all three. Tolerances are wide (x2)
// because the "field" figure is a median over a +/-3-level population whose
// members legitimately differ severalfold — the point is that the modes track
// their level, not that they hit a decimal.
const checks = [];
const chk = (n, c, x) => checks.push({ n, pass: !!c, x });
const near = (got, want, tol) => got != null && want != null && want > 0
  && (got / want) >= (1 / tol) && (got / want) <= tol;

for (const r of data.rows) {
  chk(`Lv ${r.L}: level stamped on both modes`,
      r.express && r.express.lv === r.L && r.exped && r.exped.lv === r.L,
      { trainRush: r.express && r.express.lv, expedition: r.exped && r.exped.lv });
}
// the helper must reproduce what the game actually spawns
for (const r of data.rows) {
  if (!r.field || !r.predicted) continue;
  chk(`Lv ${r.L}: _lxFieldBaseline HP matches measured field median`,
      near(r.predicted.hp, r.field.hp, 2.0),
      { predicted: Math.round(r.predicted.hp), measured: Math.round(r.field.hp),
        ratio: +(r.predicted.hp / r.field.hp).toFixed(2) });
}
for (const r of data.rows) {
  if (!r.field || !r.express) continue;
  chk(`Lv ${r.L}: Train Rush HP ~2x field`, near(r.express.hp / 2, r.field.hp, 2.0),
      { ratio: +(r.express.hp / r.field.hp).toFixed(2), want: 2 });
  // Train Rush re-applies its map's EXP multiplier, so it IS comparable to the
  // field figure measured on the same map.
  if (r.field.exp) chk(`Lv ${r.L}: Train Rush EXP ~1x field`, near(r.express.exp, r.field.exp, 2.0),
      { ratio: +(r.express.exp / r.field.exp).toFixed(2), want: 1 });
}
for (const r of data.rows) {
  if (!r.field || !r.exped) continue;
  chk(`Lv ${r.L}: Expedition HP ~1x field`, near(r.exped.hp, r.field.hp, 2.0),
      { ratio: +(r.exped.hp / r.field.hp).toFixed(2), want: 1 });
  // The Expedition pays the flat level baseline with NO map bonus, so it can't
  // be compared against a field figure measured on a map that has one (the
  // Void pays 2.1x). Assert the thing that is actually well-defined: the mob's
  // own EXP field equals the level baseline for its level.
  if (r.predicted) {
    chk(`Lv ${r.L}: Expedition EXP field == level baseline`,
        near(r.exped.expField, r.predicted.exp, 1.05),
        { got: r.exped.expField, baseline: r.predicted.exp });
  }
}
// monotonicity: both modes must grow with level, never regress
const mono = (key, pick) => {
  let last = 0, bad = null;
  for (const r of data.rows) { const v = pick(r); if (v == null) continue; if (v < last) { bad = r.L; break; } last = v; }
  chk(key + ' grows monotonically with level', bad === null, bad ? { regressedAt: bad } : null);
};
mono('Train Rush HP', r => r.express && r.express.hp);
mono('Expedition HP', r => r.exped && r.exped.hp);
mono('Expedition EXP field', r => r.exped && r.exped.expField);
mono('level baseline EXP', r => r.predicted && r.predicted.exp);
// NOTE: DELIVERED Train Rush EXP is deliberately NOT asserted monotonic. It
// tracks the field roster 1:1, and the roster itself is not monotonic — Lv-30
// monsters genuinely pay less per kill than Lv-20 ones. Forcing the mode
// monotonic would BREAK its correlation with the field, which is the property
// being tested here. The baseline it is built from IS monotonic (checked above).
chk('no page errors', errs.length === 0, errs.slice(0, 3));

console.log('');
let pass = 0, fail = 0;
for (const c of checks) {
  (c.pass ? pass++ : fail++);
  console.log((c.pass ? 'PASS  ' : 'FAIL  ') + c.n + (c.x != null ? '  ' + JSON.stringify(c.x) : ''));
}
console.log(`\n${pass}/${pass + fail} correlation checks passed`);
process.exit(fail ? 1 : 0);
