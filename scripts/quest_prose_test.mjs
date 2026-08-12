// Plain language across the WHOLE quest registry, measured.
//
// Per user: "register to all storyline and quests, make language simple but
// with depth." Depth cannot be asserted in a suite. Plainness can, and the
// point of putting it here is that it applies to quest 279 as much as to the
// ones rewritten by hand — a new quest written in the old dense register fails
// this on the way in, instead of being noticed a year later.
//
// The thresholds are deliberately loose. This is a floor against prose that has
// stopped being readable, not a style straitjacket: an average sentence under
// 20 words and nothing over 45 still leaves plenty of room to write well.
// Run: node scripts/quest_prose_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = 'file:///' + path.join(ROOT, process.argv[2] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 180)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof QUESTS !== 'undefined', { timeout: 60000 });

const r = await page.evaluate(() => {
  const MAX_AVG = 20;      // words per sentence, averaged over one desc
  const MAX_SENT = 45;     // any single sentence
  // Words this project has replaced with plainer ones. Proper nouns are NOT
  // here: "Sundered Forge" and "Aperture" are names and canon, and the arc's
  // own tests require the latter — a banned-word list that fights the lore
  // tests would be a trap for the next person.
  const HARD = ['draught', 'quartermaster', 'billet', 'clerical duplication',
    'counterpart page', 'gauntlets', 'muster roll', 'whereupon', 'notwithstanding',
    'heretofore', 'thereupon', 'insofar', 'concomitant', 'brackish'];
  const rows = [];
  for (const id in QUESTS) {
    const d = (QUESTS[id].desc || '').replace(/\s+/g, ' ').trim();
    if (!d) continue;
    const se = d.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter((x) => x.length > 3);
    if (!se.length) continue;
    const w = se.map((x) => x.split(/\s+/).length);
    rows.push({
      id, chars: d.length, sent: se.length,
      avg: +(w.reduce((a, b) => a + b, 0) / w.length).toFixed(1),
      max: Math.max(...w),
      hard: HARD.filter((h) => d.toLowerCase().includes(h)),
    });
  }
  const withProse = rows.length;
  return {
    total: Object.keys(QUESTS).length,
    withProse,
    meanAvg: +(rows.reduce((a, x) => a + x.avg, 0) / withProse).toFixed(2),
    overAvg: rows.filter((x) => x.avg > MAX_AVG).map((x) => ({ id: x.id, avg: x.avg })),
    overSent: rows.filter((x) => x.max > MAX_SENT).map((x) => ({ id: x.id, max: x.max })),
    hardHits: rows.filter((x) => x.hard.length).map((x) => ({ id: x.id, hard: x.hard })),
    worstAvg: rows.slice().sort((a, b) => b.avg - a.avg).slice(0, 3).map((x) => `${x.id}:${x.avg}`),
    worstSent: rows.slice().sort((a, b) => b.max - a.max).slice(0, 3).map((x) => `${x.id}:${x.max}`),
    MAX_AVG, MAX_SENT,
  };
});
await browser.close();

console.log(`  ${r.withProse} quest descriptions of ${r.total} quests`);
console.log(`  mean average sentence: ${r.meanAvg} words`);
console.log(`  densest by average : ${r.worstAvg.join('  ')}`);
console.log(`  longest sentences  : ${r.worstSent.join('  ')}`);

// A floor that measures nothing would pass forever. Assert the corpus first.
check(r.withProse >= 250, 'the registry actually has prose to measure (guards against a vacuous pass)', r.withProse);
check(r.overAvg.length === 0, `no quest averages over ${r.MAX_AVG} words per sentence`, r.overAvg);
check(r.overSent.length === 0, `no quest has a sentence over ${r.MAX_SENT} words`, r.overSent);
check(r.hardHits.length === 0, 'no quest uses a word this project already replaced with a plainer one', r.hardHits);
check(r.meanAvg <= 14, 'the registry as a whole reads plainly, not just the worst offenders', r.meanAvg);
check(errs.length === 0, 'no page errors', errs);
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
