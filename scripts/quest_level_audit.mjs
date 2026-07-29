// v0.29.317 — quest gate vs content audit.
// A quest's levelReq is a promise about what is behind it. This checks that
// promise against the ACTUAL level of every monster it asks you to kill, and
// against the chain it sits in.
//
//   node serve.js 8781 && node scripts/quest_level_audit.mjs 8781
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const PORT = process.argv[2] || '8781';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block' })).newPage();
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => typeof QUESTS !== 'undefined' && typeof monsterTypes !== 'undefined', null, { timeout: 60000 });
await page.waitForTimeout(2000);

const data = await page.evaluate(() => {
  // Resolve a monster's effective level from every source the game uses.
  const lvOf = (id) => {
    const t = monsterTypes[id];
    if (!t) return null;
    if (typeof MOB_NATURAL_LEVEL !== 'undefined' && MOB_NATURAL_LEVEL[id] != null) return MOB_NATURAL_LEVEL[id];
    if (t.level != null) return t.level;
    return null;   // genuinely unlevelled — a defect in itself
  };
  const targetsOf = (q) => {
    const out = [];
    if (Array.isArray(q.objectives) && q.objectives.length) {
      for (const o of q.objectives) if (o && o.target) out.push(o.target);
    } else if (q.target) out.push(q.target);
    return out.filter(t => monsterTypes[t]);
  };
  const rows = [], unlevelled = new Set();
  for (const [qid, q] of Object.entries(QUESTS)) {
    if (!q || q.levelReq == null) continue;
    if (q.kind !== 'kill' && q.kind !== 'boss') continue;
    const tg = targetsOf(q);
    if (!tg.length) continue;
    const lvls = [];
    for (const t of tg) {
      const lv = lvOf(t);
      if (lv == null) unlevelled.add(t); else lvls.push({ t, lv });
    }
    if (!lvls.length) continue;
    const maxLv = Math.max(...lvls.map(x => x.lv));
    const minLv = Math.min(...lvls.map(x => x.lv));
    rows.push({ qid, name: q.name, kind: q.kind, levelReq: q.levelReq, prereq: q.prereq || null,
      story: !!q.story, targets: lvls, maxLv, minLv, gap: q.levelReq - maxLv,
      unlevelledTargets: tg.filter(t => lvOf(t) == null) });
  }
  // prereq chain: a quest must not gate LOWER than what it requires first
  const byId = Object.fromEntries(Object.entries(QUESTS));
  const chain = [];
  for (const [qid, q] of Object.entries(QUESTS)) {
    if (!q || !q.prereq || q.levelReq == null) continue;
    const p = byId[q.prereq];
    if (!p || p.levelReq == null) continue;
    if (q.levelReq < p.levelReq) {
      chain.push({ qid, name: q.name, levelReq: q.levelReq,
        prereq: q.prereq, prereqName: p.name, prereqLevelReq: p.levelReq });
    }
  }
  return { rows, chain, unlevelled: [...unlevelled] };
});
await b.close();

// BOSS quests intentionally unlock ~10 levels BELOW their target — see the
// "boss-line quests must only appear within ~10 levels of the boss" rule in
// the bestiary generator. Reporting those as anomalies was noise, and would
// have led to "fixing" deliberate design. Only flag a boss quest when it sits
// further than that allowance below its target.
const BOSS_EARLY_ALLOWANCE = 12;
const underLimit = (r) => (r.kind === 'boss' ? -BOSS_EARLY_ALLOWANCE : -10);
const over = data.rows.filter(r => r.gap >= 10).sort((a, b) => b.gap - a.gap);
const under = data.rows.filter(r => r.gap <= underLimit(r)).sort((a, b) => a.gap - b.gap);

console.log(`audited ${data.rows.length} kill/boss quests\n`);
console.log(`=== GATE FAR ABOVE THE CONTENT (${over.length}) — trivial when reached ===`);
console.log('  gate  topMob  gap   quest');
for (const r of over) {
  console.log('  ' + String(r.levelReq).padStart(4) + String(r.maxLv).padStart(8)
    + ('+' + r.gap).padStart(6) + '   ' + r.qid + (r.story ? ' [story]' : '')
    + '  → ' + r.targets.map(t => `${t.t}(${t.lv})`).join(', ').slice(0, 70));
}
console.log(`\n=== GATE FAR BELOW THE CONTENT (${under.length}) — brick wall ===`);
console.log('  gate  topMob  gap   quest');
for (const r of under) {
  console.log('  ' + String(r.levelReq).padStart(4) + String(r.maxLv).padStart(8)
    + String(r.gap).padStart(6) + '   ' + r.qid + (r.story ? ' [story]' : '')
    + '  → ' + r.targets.map(t => `${t.t}(${t.lv})`).join(', ').slice(0, 70));
}
console.log(`\n=== PREREQ CHAIN INVERSIONS (${data.chain.length}) — gate lower than its own prerequisite ===`);
for (const c of data.chain) {
  console.log(`  ${c.qid} (Lv ${c.levelReq}) requires ${c.prereq} (Lv ${c.prereqLevelReq})  — unreachable below ${c.prereqLevelReq}`);
}
console.log(`\n=== TARGETS WITH NO LEVEL AT ALL (${data.unlevelled.length}) ===`);
console.log('  ' + (data.unlevelled.join(', ') || 'none'));
