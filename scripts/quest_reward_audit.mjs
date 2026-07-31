// v0.29.320 — do quest REWARDS make sense against the level curve they pay into?
// Mirrors the payout formula in _completeQuest exactly (authored × early-ramp,
// floored at a curve-relative fraction, × the quest knob × mid/late weighting,
// clamped to 80% of a level) and expresses every quest's EXP as a FRACTION OF
// A LEVEL at its own design level — the only unit in which "is this a good
// reward" has an answer.
//
//   node serve.js 8784 && node scripts/quest_reward_audit.mjs 8784
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const PORT = process.argv[2] || '8784';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block' })).newPage();
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => typeof QUESTS !== 'undefined' && typeof _lxLevelCost === 'function', null, { timeout: 60000 });
await page.waitForTimeout(1500);

const data = await page.evaluate(() => {
  // Faithful copy of the _completeQuest EXP path. _huntScale is left at 1: it
  // is banked at ACCEPT time from the live kill-count retarget, so it cannot be
  // known statically — meaning kill quests pay AT LEAST what is modelled here.
  const payout = (qid, q) => {
    const r = q.rewards || {};
    if (!r.exp) return null;
    const L = Math.max(1, q.levelReq || 1);
    const early = _lxQuestExpMul(L);
    const authored = Math.floor(r.exp * early);
    const frac = Math.max(0.04, Math.min(0.35, r.exp / 30000));
    const floor = Math.floor(_lxLevelCost(L) * frac);
    // v0.29.320 — multipliers apply to the AUTHORED value only; the floor is
    // already curve-relative. Mirrors _completeQuest.
    const authoredPaid = Math.floor(authored * LX_QUEST_EXP_MULT * _lxQuestRewardMul(L));
    const raw = q.noExpFloor ? authoredPaid : Math.max(authoredPaid, floor);
    const ceiling = Math.floor(_lxLevelCost(L) * 0.80);
    const paid = Math.min(raw, ceiling);
    return { qid, name: q.name, L, kind: q.kind, story: !!q.story,
      authoredExp: r.exp, coins: r.mojicoins || 0,
      levelCost: _lxLevelCost(L), paid, pctOfLevel: paid / _lxLevelCost(L),
      clamped: raw > ceiling, drivenBy: (authoredPaid >= floor ? 'authored' : 'curve-floor'),
      fragment: r.dawnFragment || null, gearTier: r.gearTier || null };
  };
  const rows = [];
  for (const [qid, q] of Object.entries(QUESTS)) {
    if (!q || q.levelReq == null) continue;
    const p = payout(qid, q);
    if (p) rows.push(p);
  }
  // story-chain monotonicity: a later chapter should not pay less than an earlier
  const chains = {};
  for (const [qid, q] of Object.entries(QUESTS)) {
    const m = qid.match(/^(q_hourglass|q_long_dawn|q_pq)_(\d+)$/);
    if (m) (chains[m[1]] ||= []).push({ qid, n: +m[2] });
  }
  for (const k in chains) chains[k].sort((a, c) => a.n - c.n);
  return { rows, chains };
});
await b.close();

const pct = (x) => (x * 100).toFixed(1) + '%';
const byLevel = data.rows.slice().sort((a, b2) => a.L - b2.L);

console.log('QUEST EXP AS A FRACTION OF ONE LEVEL (at the quest\'s own design level)\n');
const bands = [[1, 9], [10, 29], [30, 49], [50, 69], [70, 200]];
for (const [lo, hi] of bands) {
  const g = byLevel.filter(r => r.L >= lo && r.L <= hi);
  if (!g.length) continue;
  const vals = g.map(r => r.pctOfLevel).sort((a, b2) => a - b2);
  const med = vals[Math.floor(vals.length / 2)];
  console.log(`  Lv ${String(lo).padStart(3)}-${String(hi).padEnd(3)}  n=${String(g.length).padStart(3)}`
    + `  median ${pct(med).padStart(7)}`
    + `  min ${pct(vals[0]).padStart(7)}  max ${pct(vals[vals.length - 1]).padStart(7)}`
    + `  clamped ${g.filter(r => r.clamped).length}`);
}

const negligible = data.rows.filter(r => r.pctOfLevel < 0.02).sort((a, b2) => a.pctOfLevel - b2.pctOfLevel);
const huge = data.rows.filter(r => r.pctOfLevel > 0.79).sort((a, b2) => b2.pctOfLevel - a.pctOfLevel);
console.log(`\n=== NEGLIGIBLE (<2% of a level) — ${negligible.length} ===`);
for (const r of negligible.slice(0, 15)) console.log(`  Lv ${String(r.L).padStart(3)}  ${pct(r.pctOfLevel).padStart(7)}  ${r.qid}`);
console.log(`\n=== AT/OVER THE 80% CEILING — ${huge.length} ===`);
for (const r of huge.slice(0, 15)) console.log(`  Lv ${String(r.L).padStart(3)}  ${pct(r.pctOfLevel).padStart(7)}  ${r.qid}${r.clamped ? '  [clamped]' : ''}`);

console.log('\n=== STORY CHAINS — payout must not go DOWN as the chain advances ===');
let chainFail = 0;
for (const [k, list] of Object.entries(data.chains)) {
  const seq = list.map(x => data.rows.find(r => r.qid === x.qid)).filter(Boolean);
  if (seq.length < 2) continue;
  const parts = seq.map(r => `${r.qid.replace(k + '_', 'ch')}:${pct(r.pctOfLevel)}`);
  let bad = null;
  for (let i = 1; i < seq.length; i++) if (seq[i].paid < seq[i - 1].paid) { bad = seq[i].qid; break; }
  if (bad) chainFail++;
  console.log(`  ${bad ? 'DROP ' : 'ok   '} ${k}: ` + parts.join('  '));
}

// coins should broadly rise with level too
const coinRows = data.rows.filter(r => r.coins > 0).sort((a, b2) => a.L - b2.L);
console.log('\n=== COIN REWARD BY LEVEL BAND (authored, before _payMul) ===');
for (const [lo, hi] of bands) {
  const g = coinRows.filter(r => r.L >= lo && r.L <= hi);
  if (!g.length) continue;
  const v = g.map(r => r.coins).sort((a, b2) => a - b2);
  console.log(`  Lv ${String(lo).padStart(3)}-${String(hi).padEnd(3)}  n=${String(g.length).padStart(3)}  median ${v[Math.floor(v.length / 2)].toLocaleString().padStart(9)}`);
}
console.log(`\nchains with a payout drop: ${chainFail}`);
