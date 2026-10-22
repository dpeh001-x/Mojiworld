// The Barnaby conspiracy arc registers, is reachable, and its evidence exists.
// one spine (v0.30.1851, per user): Barnaby I-IV are retired - one fight per boss. Their lore is folded into the
// Sundered Smith's card, so this now pins the retirement, the spine order (Portal -> Smith -> Last Step) and that the
// folded lore survives on the Smith card.
//
// Story quests fail in ways prose review cannot see: a target no map spawns, a prereq pointing at nothing, a gate
// below the maps the target lives in. This arc has one extra failure mode: its reveal is built on a physical detail
// in ANOTHER entity's intro (the forge soot under the Vigil double's gauntlets). If that line is edited away,
// the arc is asking the player to notice something the game no longer says.
// Run: node scripts/barnaby_arc_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// tests-ports: PORT / MOJI_GAME_FILE from the environment (scripts/apply_tests_ports.mjs); unset = the old defaults
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = 'file:///' + path.join(ROOT, process.argv[2] || FILE).split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 180)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof QUESTS !== 'undefined' && typeof MAPS !== 'undefined' && typeof _qnavDest === 'function', { timeout: 60000 });

const r = await page.evaluate(() => {
  const retired = ['q_barnaby_five', 'q_barnaby_roll', 'q_barnaby_hands', 'q_barnaby_finish'];   // one spine
  const ids = ['q_distorted_portal', 'q_boss_sundered_smith'];   // one spine: the two cards that carry the arc now
  const out = { chapters: [] };
  out.retired = retired.map((id) => ({ id, gone: !QUESTS[id], listed: typeof _LX_RETIRED_QUESTS !== 'undefined' && _LX_RETIRED_QUESTS.includes(id) }));
  const spawnMaps = (t) => Object.keys(MAPS).filter((id) => (MAPS[id].spawns || []).some((s) => s.type === t));
  for (const qid of ids) {
    const q = QUESTS[qid];
    if (!q) { out.chapters.push({ qid, missing: true }); continue; }
    let d = null; try { d = _qnavDest(qid); } catch (e) {}
    const tm = spawnMaps(q.target);
    out.chapters.push({
      qid, name: q.name, story: !!(q.story || q.advancement), critical: !!q.critical, levelReq: q.levelReq, target: q.target,
      targetMaps: tm, targetMapGate: Math.max(0, ...tm.map((m) => MAPS[m].levelReq || 1)),
      navResolves: !!d, navKind: d && d.kind, navWho: d && d.who,
      descChars: (q.desc || '').length, rewardCoins: (q.rewards || {}).mojicoins,
    });
  }
  out.prereqsReal = Object.keys(QUESTS).every((i) => { const p = QUESTS[i].prereq; return !p || [].concat(p).every((x) => !!QUESTS[x]); });
  out.smithPre = [].concat((QUESTS.q_boss_sundered_smith || {}).prereq || []);
  out.lastPre = [].concat((QUESTS.q_last_step || {}).prereq || []);

  const _src = [...document.querySelectorAll('script')].map((x) => x.textContent).join('');
  // The linchpin: BOTH men have forge soot they never wash off. Anchored to the entity key so a comment quoting the
  // line cannot satisfy it - the Smith guard in lyra_arc_test passed on exactly that mistake before it was tightened.
  out.sootIntact = /young_confused_barnaby: 'A talented smith who (?:reached for something|tried to fuse magic)[^']*old soot under the gauntlets/.test(_src);
  const smith = (QUESTS.q_boss_sundered_smith || {}).desc || '';
  // one spine: chapter I's five theories survive on the Smith card as "five times, in five hands" + the unsigned fifth.
  out.fiveHands = /names Barnaby, the Bastion's old smith, five times, in five hands/.test(smith);
  out.unsignedFifth = /The fifth, nobody will sign/.test(smith) && /underlined that one twice/.test(smith);
  // one spine: chapter II's two signatures (her order at his bench, "Done" in a hand better than his) moved to the Smith card.
  out.rollDouble = /the woman at the gate came to his bench with one order/.test(smith) && /Make it honest\./.test(smith) && /one word\. Done\./.test(smith);
  // one spine: chapter IV's close - the Smith is his own hundred years reaching back - and the Forge-Ember Shard.
  out.finish = /his own hundred years reaching back/.test(smith) && /Forge-Ember Shard/.test(smith);
  out.portalNote = /Barnaby's note: put it down\./.test((QUESTS.q_distorted_portal || {}).desc || '');
  // one spine: chapter III's "the tear does not only pull people in" reveal went with the chapter (no card carries it).

  // --- plain language, measured (per user: plain, with depth) - over the two spine cards that carry the arc now
  const descs = ids.map((i) => (QUESTS[i] || {}).desc || '').join(' ');
  const sentences = descs.split(/[.!?]+\s/).map((x) => x.trim()).filter((x) => x.length > 3);
  const words = sentences.map((x) => x.split(/\s+/).length);
  out.sentenceCount = sentences.length;
  out.avgWords = words.length ? words.reduce((a, b) => a + b, 0) / words.length : 0;
  out.longest = Math.max(0, ...words);
  const JARGON = ['billet', 'clerical duplication', 'muster roll', 'quartermaster',
                  'apprenticeship', 'counterpart page', 'gauntlets', 'recognises as his own'];
  out.jargonHits = JARGON.filter((w) => new RegExp(w, 'i').test(descs));
  out.totalQuests = Object.keys(QUESTS).length;
  return out;
});
await browser.close();

for (const c of r.chapters) {
  console.log(`  ${c.qid}: "${c.name}" — target ${c.target}, Lv${c.levelReq}, ${c.descChars} chars`);
  console.log(`     nav -> ${c.navKind}:${c.navWho}   spawns in [${(c.targetMaps || []).join(', ')}]`);
}
for (const x of r.retired) check(x.gone && x.listed, `${x.id} is retired (absent from QUESTS, listed in _LX_RETIRED_QUESTS)`, x);   // one spine
for (const c of r.chapters) {
  check(!c.missing, `${c.qid} is registered`, c);
  if (c.missing) continue;
  check((c.targetMaps || []).length > 0, `${c.qid}'s target actually spawns somewhere`, c.targetMaps);
  check(c.navResolves, `${c.qid} resolves in the quest navigator`, c);
  check(c.story && c.critical, `${c.qid} is a critical story quest`, c);   // one spine: spine quests have no giver / hand-in
  check(c.descChars > 700, `${c.qid} carries real prose, not a stub`, c.descChars);
  check((c.rewardCoins | 0) > 0, `${c.qid} pays out`, c.rewardCoins);
  check(c.levelReq >= c.targetMapGate, `${c.qid} is not gated BELOW the maps its own target lives in`, { gate: c.levelReq, targetMapGate: c.targetMapGate });
}
check(r.prereqsReal, 'every prereq in QUESTS points at a real quest (none at a retired chapter)', r.smithPre);
check(JSON.stringify(r.smithPre) === JSON.stringify(['q_distorted_portal', 'q_visit_lavaCavern']) && JSON.stringify(r.lastPre) === '["q_boss_sundered_smith"]',
  'one spine: the Smith waits on the Portal and Brok\'s Forge-Key, the Last Step on the Smith', { smith: r.smithPre, last: r.lastPre });
check(r.fiveHands && r.unsignedFifth, 'the Smith card keeps chapter I: five hands on Brok\'s list, the unsigned fifth underlined twice', { five: r.fiveHands, fifth: r.unsignedFifth });
console.log(`  plain-language: ${r.sentenceCount} sentences, avg ${r.avgWords.toFixed(1)} words, longest ${r.longest}`);
check(r.avgWords <= 20, 'the prose averages under 20 words per sentence (plain, not clipped)', r.avgWords);
check(r.longest <= 55, 'no runaway sentence', r.longest);
check(r.jargonHits.length === 0, 'no jargon the plain-language pass removed has crept back', r.jargonHits);
check(r.rollDouble, 'the Smith card keeps chapter II\'s two signatures (her one order at his bench, "Make it honest.", the one word "Done")', r.rollDouble);
check(r.finish && r.portalNote, 'the Smith card closes on his own hundred years and the Forge-Ember Shard; the Portal carries Barnaby\'s note', { finish: r.finish, note: r.portalNote });
check(r.sootIntact, 'the Vigil double still carries the forge soot the whole reveal rests on', r.sootIntact);
check(errs.length === 0, 'no page errors', errs);
console.log(bad ? `\n${bad} FAILED` : `\nall green — ${r.totalQuests} quests total`);
process.exit(bad ? 1 : 0);
