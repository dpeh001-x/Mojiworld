// Kills-to-level-up against SAME-LEVEL monsters, sampled every 5 levels.
// Fully empirical: for each level it sets the player there, spawns a monster
// whose level matches, kills it through the real damage/kill pipeline, and
// measures the actual EXP delta. That captures every multiplier in the chain
// rather than re-deriving it (and so cannot drift from the game).
//
//   node serve.js 8774 && node scripts/levelup_kill_curve.mjs 8774
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const PORT = process.argv[2] || '8774';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => typeof game !== 'undefined' && typeof monsterTypes !== 'undefined', null, { timeout: 60000 });
await page.waitForTimeout(2500);

const data = await page.evaluate(() => {
  const out = { rows: [], cap: (typeof MAX_LEVEL === 'number' ? MAX_LEVEL : null), notes: [] };

  // Catalogue ordinary field monsters by their NATURAL level. MOB_NATURAL_LEVEL
  // is the real per-type level table (100 mobs, Lv 1-80); monsterTypes[].level
  // is sparse and unreliable for this. Tower / express / ticket / summon mobs
  // are excluded — they carry bespoke EXP that is not representative of what a
  // player actually grinds.
  const EXCLUDE = /^(tower|express|ticket|conductor|mirror)/i;
  const byLevel = {};
  for (const [id, lv] of Object.entries(
        (typeof MOB_NATURAL_LEVEL !== 'undefined') ? MOB_NATURAL_LEVEL : {})) {
    const t = monsterTypes[id];
    if (!t || t.isBoss || t.boss) continue;
    if (EXCLUDE.test(id)) continue;
    if (!(lv > 0)) continue;
    (byLevel[lv] ||= []).push({ id, exp: t.exp | 0 });
  }
  out.levelsAvailable = Object.keys(byLevel).map(Number).sort((a, b) => a - b);

  // Nearest authored monster level to a target (same-level if it exists).
  const nearest = (lv) => {
    if (byLevel[lv]) return { lv, list: byLevel[lv] };
    let best = null;
    for (const k of out.levelsAvailable) {
      if (best === null || Math.abs(k - lv) < Math.abs(best - lv)) best = k;
    }
    return best === null ? null : { lv: best, list: byLevel[best] };
  };

  // Neutralise everything that is not "a plain kill on Normal difficulty":
  // no combo, no prestige, no gear/boon XP boost, solo, no world affix.
  const neutralise = () => {
    game.comboMult = 1; game.combo = 0; game.comboTimer = 0;
    game.prestige = null; game._mapAffix = null;
    player.mods = player.mods || {}; player.mods.xpBoost = 0;
    player.equipment = {}; player.boonsEquipped = []; player.boons = [];
    player._msWin = null;
    try { if (typeof _lxSetSettings === 'function') _lxSetSettings({ difficulty: 'normal' }); } catch (e) {}
    if (game.settings) game.settings.difficulty = 'normal';
    game.expedition = null; game.tower = null;
  };

  const measure = (lv) => {
    const pick = nearest(lv);
    if (!pick) return null;
    neutralise();
    player.level = lv;
    player.exp = 0;
    player.expToNext = _lxLevelCost(lv);
    const cost = player.expToNext;

    // Sample EVERY monster at that level and take the MEDIAN. Averaging a
    // handful picks up outliers — a few late-game types carry bespoke EXP
    // several times their neighbours', which would misrepresent the grind.
    const samples = [];
    const types = pick.list;
    for (const t of types) {
      neutralise();
      player.level = lv; player.exp = 0; player.expToNext = 1e15;   // never level mid-sample
      game.monsters.length = 0;
      // Spawns fail intermittently (platform/geometry checks), which silently
      // dropped whole levels from the table on earlier runs. Retry a few times
      // and only give up on a type after that.
      let m = null;
      for (let attempt = 0; attempt < 4 && !m; attempt++) {
        game.monsters.length = 0;
        try { m = spawnMonster(player.x + 60 + attempt * 30, player.y, t.id, false, false); } catch (e) { m = null; }
        if (m && m._suppressed) m = null;
      }
      if (!m) continue;
      m.currentHp = 1;
      const before = player.exp;
      try { hitMonster(m, 1e9, false, 'aoe'); } catch (e) { continue; }
      const gain = player.exp - before;
      if (gain > 0) samples.push({ type: t.id, mobLevel: m.level | 0, gain });
    }
    if (!samples.length) return null;
    const gains = samples.map(s => s.gain).sort((a, b) => a - b);
    const med = gains.length % 2
      ? gains[(gains.length - 1) / 2]
      : (gains[gains.length / 2 - 1] + gains[gains.length / 2]) / 2;
    return { level: lv, monsterLevel: pick.lv, exact: pick.lv === lv, cost,
             perKill: med, kills: Math.ceil(cost / med),
             sampleTypes: samples.map(s => s.type), n: samples.length,
             spread: [gains[0], gains[gains.length - 1]] };
  };

  out.maxMobLevel = Math.max(...out.levelsAvailable);
  out.levelCap = (typeof MAX_LEVEL === 'number') ? MAX_LEVEL
                : (typeof LEVEL_CAP === 'number') ? LEVEL_CAP : null;
  const cap = out.cap || 100;
  for (let lv = 5; lv <= Math.min(cap, 100); lv += 5) {
    const r = measure(lv);
    if (r) out.rows.push(r); else out.notes.push('no monster data at Lv ' + lv);
  }
  // Cumulative kills Lv1 -> Lv N. Cost per level is exact (_lxLevelCost);
  // EXP/kill is interpolated between the measured sample points, so this is
  // an estimate rather than a second measurement pass (re-measuring every
  // level doubled the spawn load and was the main source of flakiness).
  const pts = out.rows.map(r => ({ lv: r.level, per: r.perKill })).sort((a, b) => a.lv - b.lv);
  const perAt = (lv) => {
    if (!pts.length) return null;
    if (lv <= pts[0].lv) return pts[0].per;
    if (lv >= pts[pts.length - 1].lv) return pts[pts.length - 1].per;
    for (let i = 1; i < pts.length; i++) {
      if (lv <= pts[i].lv) {
        const a = pts[i - 1], b2 = pts[i], f = (lv - a.lv) / (b2.lv - a.lv);
        return a.per + (b2.per - a.per) * f;
      }
    }
    return pts[pts.length - 1].per;
  };
  let cum = 0; const cumAt = {};
  for (let lv = 1; lv <= Math.min(cap, 100); lv++) {
    const per = perAt(lv);
    if (per > 0) cum += Math.ceil(_lxLevelCost(lv) / per);
    if (lv % 5 === 0) cumAt[lv] = cum;
  }
  out.cumAt = cumAt;
  return out;
});

await b.close();

console.log('KILLS TO LEVEL UP — same-level monsters, Normal difficulty, no combo/gear/prestige\n');
console.log('  Lv    EXP to next        EXP/kill    KILLS      cumulative kills 1->Lv');
console.log('  ---   ---------------    --------    ------     ----------------------');
for (const r of data.rows) {
  const star = r.exact ? ' ' : '*';
  console.log('  ' + String(r.level).padStart(3) + star
    + Math.round(r.cost).toLocaleString().padStart(16)
    + Math.round(r.perKill).toLocaleString().padStart(12)
    + String(r.kills).toLocaleString().padStart(11)
    + (data.cumAt[r.level] != null ? String(data.cumAt[r.level].toLocaleString()).padStart(21) : ''.padStart(21)));
}
const anyApprox = data.rows.some(r => !r.exact);
if (anyApprox) {
  console.log('\n  * no monster authored at exactly that level — nearest used:');
  for (const r of data.rows) if (!r.exact) console.log(`      Lv ${r.level} -> used Lv ${r.monsterLevel} monsters (${r.sampleTypes.join(', ')})`);
}
if (data.notes.length) console.log('\n  notes: ' + data.notes.join('; '));
console.log('\n  highest field-monster level in the game: Lv ' + data.maxMobLevel
  + (data.levelCap ? '   (player level cap: ' + data.levelCap + ')' : ''));
console.log('  spread of EXP/kill within each sampled level (min-max):');
for (const r of data.rows) {
  console.log('    Lv ' + String(r.level).padStart(3) + '  n=' + String(r.n).padStart(2)
    + '   ' + r.spread[0].toLocaleString() + ' - ' + r.spread[1].toLocaleString());
}
