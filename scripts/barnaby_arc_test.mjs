// The Barnaby conspiracy arc registers, is reachable, and its evidence exists.
//
// Story quests fail in ways prose review cannot see: a giver who is not a
// placed NPC, a target no map spawns, a prereq pointing at nothing, a gate
// below the maps the target lives in. This arc has one extra failure mode:
// chapter III is built on a physical detail in ANOTHER entity's intro (the
// forge soot under the Vigil double's gauntlets). If that line is edited away,
// the chapter is asking the player to notice something the game no longer says.
// Run: node scripts/barnaby_arc_test.mjs [file.html]
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
await page.waitForFunction(() => typeof QUESTS !== 'undefined' && typeof MAPS !== 'undefined' && typeof _qnavDest === 'function', { timeout: 60000 });

const r = await page.evaluate(() => {
  const ids = ['q_barnaby_five', 'q_barnaby_roll', 'q_barnaby_hands'];
  const out = { chapters: [] };
  const npcNames = new Set();
  for (const id in MAPS) for (const n of (MAPS[id].npcs || [])) if (n && n.name) npcNames.add(n.name);
  const spawnMaps = (t) => Object.keys(MAPS).filter((id) => (MAPS[id].spawns || []).some((s) => s.type === t));
  for (const qid of ids) {
    const q = QUESTS[qid];
    if (!q) { out.chapters.push({ qid, missing: true }); continue; }
    let d = null; try { d = _qnavDest(qid); } catch (e) {}
    out.chapters.push({
      qid, name: q.name, giver: q.giver, story: !!q.story, noScale: !!q.noScale,
      handIn: !!q.handIn, levelReq: q.levelReq, target: q.target, prereq: q.prereq || null,
      giverPlaced: npcNames.has(q.giver),
      targetMaps: spawnMaps(q.target),
      targetMapGate: Math.max(0, ...spawnMaps(q.target).map((m) => MAPS[m].levelReq || 1)),
      navResolves: !!d, navKind: d && d.kind, navWho: d && d.who,
      descChars: (q.desc || '').length,
      objectives: (q.objectives || []).map((o) => ({ target: o.target, spawns: spawnMaps(o.target).length })),
      rewardCoins: (q.rewards || {}).mojicoins,
    });
  }
  out.chain = ids.map((i) => ((QUESTS[i] || {}).prereq) || null);
  out.prereqsReal = ids.every((i) => { const p = (QUESTS[i] || {}).prereq; return !p || !!QUESTS[p]; });

  const _src = [...document.querySelectorAll('script')].map((x) => x.textContent).join('');
  // The linchpin: chapter III's whole reveal is that BOTH men have forge soot
  // they never wash off. Anchored to the entity key so a comment quoting the
  // line cannot satisfy it - the Smith guard in lyra_arc_test passed on exactly
  // that mistake before it was tightened.
  out.sootIntact = /young_confused_barnaby: 'A sentinel who never chose[^']*old soot under the gauntlets/.test(_src);
  // The five theories are the point of chapter I. Count the labelled ones, so a
  // later trim that guts the prose fails loudly instead of leaving a chapter
  // called "Five Stories" with three.
  const five = (QUESTS.q_barnaby_five || {}).desc || '';
  out.theoryLabels = ['HE DIED THAT NIGHT', 'HE NEVER TRAINED HERE', 'SOMEONE IS WATCHING HIM',
                      'THERE WERE ALWAYS TWO'].filter((t) => five.includes(t));
  out.unsignedFifth = /put their name to/i.test(five);
  // Chapter II's evidence and chapter III's contradiction must both survive.
  out.rollDouble = /on it twice/i.test((QUESTS.q_barnaby_roll || {}).desc || '');
  out.copiedOut = /pushed one out/i.test((QUESTS.q_barnaby_hands || {}).desc || '');

  // --- plain language, measured ------------------------------------------
  // Per user: "make the language used a bit more plainly understood and
  // simpler, but carry a strong sense of depth still". Depth is not testable;
  // plainness is. Two things that actually track it: sentence length, and a
  // list of the words this arc reached for when it was showing off.
  const descs = ids.map((i) => (QUESTS[i] || {}).desc || '').join(' ');
  const sentences = descs.split(/[.!?]+\s/).map((x) => x.trim()).filter((x) => x.length > 3);
  const words = sentences.map((x) => x.split(/\s+/).length);
  out.sentenceCount = sentences.length;
  out.avgWords = words.length ? words.reduce((a, b) => a + b, 0) / words.length : 0;
  out.longest = Math.max(0, ...words);
  const JARGON = ['billet', 'clerical duplication', 'muster roll', 'quartermaster',
                  'apprenticeship', 'counterpart page', 'gauntlets', 'recognises as his own'];
  out.jargonHits = JARGON.filter((w) => new RegExp(w, 'i').test(descs));
  // It must sit INSIDE the Sundered Smith arc, not beside it.
  out.smithArcLink = ((QUESTS.q_barnaby_five || {}).prereq === 'q_visit_lavaCavern')
    && (QUESTS.q_barnaby_roll || {}).target === 'sundered_smith';
  out.totalQuests = Object.keys(QUESTS).length;
  return out;
});
await browser.close();

for (const c of r.chapters) {
  console.log(`  ${c.qid}: "${c.name}" — giver ${c.giver} (placed:${c.giverPlaced}), target ${c.target}, Lv${c.levelReq}, ${c.descChars} chars`);
  console.log(`     nav -> ${c.navKind}:${c.navWho}   spawns in [${(c.targetMaps || []).join(', ')}]`);
}
console.log(`  theories labelled: ${JSON.stringify(r.theoryLabels)} (+unsigned fifth: ${r.unsignedFifth})`);

for (const c of r.chapters) {
  check(!c.missing, `${c.qid} is registered`, c);
  if (c.missing) continue;
  check(c.giverPlaced, `${c.qid}'s giver "${c.giver}" is a placed NPC (else it can never be handed in)`, c.giver);
  check((c.targetMaps || []).length > 0, `${c.qid}'s target actually spawns somewhere`, c.targetMaps);
  check(c.navResolves, `${c.qid} resolves in the quest navigator`, c);
  check(c.story && c.noScale, `${c.qid} is flagged story + noScale like its siblings`, c);
  check(c.handIn, `${c.qid} hands in (every chapter is someone reporting back)`, c.handIn);
  check(c.descChars > 700, `${c.qid} carries real prose, not a stub`, c.descChars);
  check((c.rewardCoins | 0) > 0, `${c.qid} pays out`, c.rewardCoins);
  check(c.levelReq >= c.targetMapGate, `${c.qid} is not gated BELOW the maps its own target lives in`, { gate: c.levelReq, targetMapGate: c.targetMapGate });
  for (const o of (c.objectives || [])) check(o.spawns > 0, `${c.qid} objective "${o.target}" spawns somewhere`, o);
}
check(r.prereqsReal, 'every prereq points at a real quest', r.chain);
check(JSON.stringify(r.chain) === JSON.stringify(['q_visit_lavaCavern', 'q_barnaby_five', 'q_barnaby_roll']),
  'the three chapters form one ordered chain hanging off Brok\'s errand', r.chain);
check(r.smithArcLink, 'it runs INSIDE the Sundered Smith arc (Brok\'s errand in, the Smith as chapter II\'s target)', r.smithArcLink);
check(r.theoryLabels.length === 4 && r.unsignedFifth, 'chapter I still carries four named theories plus the unsigned fifth', { labelled: r.theoryLabels, fifth: r.unsignedFifth });
console.log(`  plain-language: ${r.sentenceCount} sentences, avg ${r.avgWords.toFixed(1)} words, longest ${r.longest}`);
check(r.avgWords <= 20, 'the prose averages under 20 words per sentence (plain, not clipped)', r.avgWords);
check(r.longest <= 55, 'no runaway sentence', r.longest);
check(r.jargonHits.length === 0, 'no jargon the plain-language pass removed has crept back', r.jargonHits);
check(r.rollDouble, 'chapter II still puts him on the roll twice', r.rollDouble);
check(r.copiedOut, 'chapter III still turns the realm\'s assumption around (copied one OUT)', r.copiedOut);
check(r.sootIntact, 'the Vigil double still carries the forge soot the whole reveal rests on', r.sootIntact);
check(errs.length === 0, 'no page errors', errs);
console.log(bad ? `\n${bad} FAILED` : `\nall green — ${r.totalQuests} quests total`);
process.exit(bad ? 1 : 0);
