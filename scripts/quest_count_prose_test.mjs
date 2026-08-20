// Every quest's prose quotes the number the quest actually wants, per user
// "make sure all quest misquotes are fixed".
//
// The defect this guards: the v0.29.902 count normalisation rounds kill counts
// up (floor 20, multiples of 10, cap 500) and rewrites each desc in step — but
// the rewrite was digit-blind. Four Act-1 quests spell their objective ("ten
// snails", "ten mushpups", "ten mushrooms", "ten sproutles"), so their counts
// moved 10 -> 20 while the prose kept saying ten; a fifth (q_act1_sleepers)
// carried the number as its own sentence ("Ten. She counts."), which no
// rewrite can reach, so the sentence now names no number at all.
//
// The load-bearing check is the SWEEP, not the four known cases: after the
// normalisation pass has run, no kill quest may carry a number — digit or
// spelled — directly beside its own target's name that differs from the live
// count. That is graded against the quest data, never against literals, so
// any future retune that re-breaks prose fails here by construction.
// Run: node scripts/quest_count_prose_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const URL = 'file:///' + path.join(ROOT, args[0] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  - ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof QUESTS === 'object', { timeout: 90000 });
const r = await page.evaluate(async () => {
  // the normalisation pass is deferred via setTimeout(0) — let it land first
  await new Promise((res) => setTimeout(res, 150));
  const out = { known: {}, sweep: [] };
  const esc = (t) => String(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const plural = (typeof _lxPluralMob === 'function') ? _lxPluralMob : ((s) => s + 's');
  const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
    nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
    sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30,
    forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100 };

  // --- the four spelled cases + the standalone sentence ---
  // Graded against the SPECIES WORD the prose actually uses ("ten snails"),
  // not the display name — snail's display name is "Slippy" and mushroom's is
  // "Shroom", which is exactly how the display-name-only rewrite missed two of
  // these four in the first place.
  const KNOWN = { q_act1_waking: 'snails', q_act1_recipe: 'mushpups', q_act1_name: 'mushrooms', q_act1_firstword: 'sproutles' };
  for (const id in KNOWN) {
    const q = QUESTS[id];
    const word = KNOWN[id];
    const desc = (q && q.desc) || '';
    out.known[id] = {
      count: q ? q.count : null,
      saysTen: new RegExp('\\bten\\s+' + esc(word), 'i').test(desc),
      saysLive: q ? new RegExp('\\b' + q.count + '\\s+' + esc(word), 'i').test(desc) : false,
    };
  }
  const sleepers = (QUESTS.q_act1_sleepers && QUESTS.q_act1_sleepers.desc) || '';
  out.sleepers = {
    count: QUESTS.q_act1_sleepers ? QUESTS.q_act1_sleepers.count : null,
    standaloneTen: /\bTen\.\s/.test(sleepers),
    namesNoStaleNumber: /She counts\./.test(sleepers),
  };

  // --- THE SWEEP: no quest quotes a wrong number beside its own creature ---
  const grade = (desc, target, count) => {
    if (!desc || !(count > 0) || !target) return;
    const nm = (typeof monsterTypes !== 'undefined' && monsterTypes[target] && monsterTypes[target].name);
    if (!nm) return;
    // Both the display name AND the species key — prose uses either.
    const forms = [];
    for (const base of [nm, target]) if (base) forms.push(plural(base), base);
    for (const form of forms) {
      const re = new RegExp('\\b(\\d{1,4}|' + Object.keys(WORDS).join('|') + ')\\s+(?:of\\s+the\\s+)?' + esc(form) + '\\b', 'gi');
      let m;
      while ((m = re.exec(desc))) {
        const tok = m[1].toLowerCase();
        const n = /^\d+$/.test(tok) ? +tok : WORDS[tok];
        if (n !== count) return { quoted: n, via: m[0].slice(0, 50) };
      }
    }
  };
  for (const id in QUESTS) {
    const q = QUESTS[id];
    if (!q || q.kind !== 'kill') continue;
    const text = [q.title || '', q.desc || ''].join('\n');
    if (Array.isArray(q.objectives) && q.objectives.length) {
      for (const ob of q.objectives) {
        const hit = grade(text, ob.target, ob.count | 0);
        if (hit) out.sweep.push({ id, target: ob.target, count: ob.count, ...hit });
      }
    } else {
      const hit = grade(text, q.target, q.count | 0);
      if (hit) out.sweep.push({ id, target: q.target, count: q.count, ...hit });
    }
  }
  return out;
});
await browser.close();

for (const id in r.known) console.log(`  ${id}: ${JSON.stringify(r.known[id])}`);
console.log(`  q_act1_sleepers: ${JSON.stringify(r.sleepers)}`);
console.log(`  sweep hits: ${JSON.stringify(r.sweep.slice(0, 6))}${r.sweep.length > 6 ? ' +' + (r.sweep.length - 6) : ''}`);

for (const id in r.known) {
  const k = r.known[id];
  check(!k.saysTen, `${id}: no longer says "ten" beside its creature`, k);
  check(k.saysLive, `${id}: quotes the live count beside its creature`, k);
}
check(!r.sleepers.standaloneTen, 'q_act1_sleepers: the standalone "Ten." sentence is gone', r.sleepers);
check(r.sleepers.namesNoStaleNumber, 'and Joyce still counts - the beat survives without a number', r.sleepers);
check(r.sweep.length === 0, 'SWEEP: no kill quest quotes a wrong number beside its own creature', r.sweep.slice(0, 5));
check(errs.length === 0, 'no page errors', [...new Set(errs)].slice(0, 3));
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
