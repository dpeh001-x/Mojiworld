// The Lyra arc registers and is actually reachable.
//
// Story quests are easy to write and easy to get wrong in ways prose review
// cannot see: a giver who is not a placed NPC, a target no map spawns, a prereq
// pointing at nothing, a level gate above the maps the target lives in. Each of
// those makes a quest that reads beautifully and can never be completed.
// Run: node scripts/lyra_arc_test.mjs [file.html]
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
  const ids = ['q_lyra_loan', 'q_lyra_tear', 'q_lyra_cut', 'q_lyra_kin'];
  const out = { chapters: [] };
  const npcNames = new Set();
  for (const id in MAPS) for (const n of (MAPS[id].npcs || [])) if (n && n.name) npcNames.add(n.name);
  const spawnMaps = (t) => Object.keys(MAPS).filter((id) => (MAPS[id].spawns || []).some((s) => s.type === t));
  for (const qid of ids) {
    const q = QUESTS[qid];
    if (!q) { out.chapters.push({ qid, missing: true }); continue; }
    let d = null; try { d = _qnavDest(qid); } catch (_e) {}
    out.chapters.push({
      qid, name: q.name, giver: q.giver, story: !!q.story, noScale: !!q.noScale,
      handIn: !!q.handIn, levelReq: q.levelReq, target: q.target, count: q.count,
      prereq: q.prereq || null,
      giverPlaced: npcNames.has(q.giver),
      targetMaps: spawnMaps(q.target),
      navResolves: !!d, navKind: d && d.kind, navWho: d && d.who,
      descChars: (q.desc || '').length,
      objectives: (q.objectives || []).map((o) => ({ target: o.target, count: o.count, spawns: spawnMaps(o.target).length })),
      rewardCoins: (q.rewards || {}).mojicoins,
    });
  }
  out.prereqExists = ['q_lyra_tear','q_lyra_cut','q_lyra_kin'].every((k) => !!QUESTS[(QUESTS[k] || {}).prereq]);
  // the subtle Sovereign hint must still be present for chapter IV to pay off
  out.sovereignHint = /sapphire signet/i.test([...document.querySelectorAll('script')].map((x) => x.textContent).join(''));
  // the chain must be a LINE, not three quests that happen to exist
  out.chain = ids.map((i) => ((QUESTS[i] || {}).prereq) || null);
  // the target's maps must be enterable at the quest's own level gate
  out.targetMapLevels = spawnMaps('future_lyra').map((m) => ({ map: m, levelReq: MAPS[m].levelReq }));
  out.totalQuests = Object.keys(QUESTS).length;
  return out;
});
await browser.close();

for (const c of r.chapters) {
  console.log(`  ${c.qid}: "${c.name}" — giver ${c.giver} (placed:${c.giverPlaced}), target ${c.target}x${c.count}, Lv${c.levelReq}, ${c.descChars} chars of prose`);
  console.log(`     nav -> ${c.navKind}:${c.navWho}   target spawns in [${(c.targetMaps || []).join(', ')}]`);
}
console.log(`  target maps + gates: ${JSON.stringify(r.targetMapLevels)}`);

for (const c of r.chapters) {
  check(!c.missing, `${c.qid} is registered`, c);
  if (c.missing) continue;
  check(c.giverPlaced, `${c.qid}'s giver "${c.giver}" is a placed NPC (else it can never be handed in)`, c.giver);
  check((c.targetMaps || []).length > 0, `${c.qid}'s target actually spawns somewhere`, c.targetMaps);
  check(c.navResolves, `${c.qid} resolves in the quest navigator`, c);
  check(c.story && c.noScale, `${c.qid} is flagged story + noScale like its siblings`, c);
  check(c.handIn, `${c.qid} hands in (the arc is about going back to tell someone)`, c.handIn);
  check(c.descChars > 400, `${c.qid} carries real prose, not a stub`, c.descChars);
  check((c.rewardCoins | 0) > 0, `${c.qid} pays out`, c.rewardCoins);
}
check(r.prereqExists, 'chapter II\'s prereq points at a real quest', r.chapters[1] && r.chapters[1].prereq);
check(JSON.stringify(r.chain) === JSON.stringify([null, 'q_lyra_loan', 'q_lyra_tear', 'q_lyra_cut']), 'the four chapters form one ordered chain I -> II -> III -> IV', r.chain);
// every listed objective must be a mob that genuinely spawns, or the chapter is
// uncompletable no matter how well it reads
for (const c of r.chapters) {
  for (const o of (c.objectives || [])) {
    check(o.spawns > 0, `${c.qid} objective "${o.target}" spawns somewhere`, o);
  }
}
// the gate must not exceed the maps the target lives in, or it is uncompletable
const maxMapGate = Math.max(...r.targetMapLevels.map((m) => m.levelReq || 1));
check(r.chapters.every((c) => c.missing || c.levelReq >= maxMapGate), 'the level gate is not BELOW the maps the target lives in', { questGates: r.chapters.map((c) => c.levelReq), maxMapGate });
check(r.sovereignHint, 'the Sovereign still carries the sapphire signet chapter IV asks you to look for', r.sovereignHint);
check(errs.length === 0, 'no page errors', errs);
console.log(bad ? `\n${bad} FAILED` : `\nall green — ${r.totalQuests} quests total`);
process.exit(bad ? 1 : 0);
