// The Lyra arc registers and is actually reachable.
//
// Story quests are easy to write and easy to get wrong in ways prose review
// cannot see: a giver who is not a placed NPC, a target no map spawns, a prereq
// pointing at nothing, a level gate above the maps the target lives in. Each of
// those makes a quest that reads beautifully and can never be completed.
// One spine (v0.30.1851, per user): The Tear V-VI are retired - the arc is chapters 0-IV, and its ending
// rides on The Last Step (q_last_step), which carries the roll and keys Lyra's lines.
// Run: node scripts/lyra_arc_test.mjs [file.html]
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
  const ids = ['q_lyra_aperture', 'q_lyra_loan', 'q_lyra_tear', 'q_lyra_cut', 'q_lyra_kin'];   // one spine: V-VI retired (the Last Step carries the roll, checked below)
  const out = { chapters: [] };
  const npcNames = new Set();
  for (const id in MAPS) for (const n of (MAPS[id].npcs || [])) if (n && n.name) npcNames.add(n.name);
  // v0.29.955 (421bf4f0, per user) — vigil_vermillion left every map roster: he is an
  // Elder spawned on the Fractured Reflection by his own 5-minute clock
  // (_lxVermillionTick). A roster-only scan reads "spawns nowhere" for chapter III,
  // so clocked spawners count too — but only when the game's own clock really
  // spawns that type on that map (read from the function source, not assumed).
  const clocked = {};
  try {
    const src = String(_lxVermillionTick);
    const map = (src.match(/currentMap\s*!==\s*'([A-Za-z0-9_]+)'/) || [])[1];
    const type = (src.match(/spawnMonster\([^)]*'([a-z_]+)'/) || [])[1];
    if (map && type && MAPS[map]) (clocked[type] = clocked[type] || []).push(map);
  } catch (e) {}
  const spawnMaps = (t) => Object.keys(MAPS).filter((id) => (MAPS[id].spawns || []).some((s) => s.type === t)
    || (clocked[t] || []).includes(id) || (t === 'pqConductor' && id === 'clockworkExpress'));   // the Master Conductor is spawned by Ticket Rush Stage 4's own flag (The Tear 0 hunts him, 2026-10-09)
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
      targetMapGate: Math.max(0, ...spawnMaps(q.target).map((m) => MAPS[m].levelReq || 1)),
      navResolves: !!d, navKind: d && d.kind, navWho: d && d.who,
      descChars: (q.desc || '').length,
      objectives: (q.objectives || []).map((o) => ({ target: o.target, count: o.count, spawns: spawnMaps(o.target).length })),
      rewardCoins: (q.rewards || {}).mojicoins,
    });
  }
  out.prereqExists = ['q_lyra_tear','q_lyra_cut','q_lyra_kin','q_last_step'].every((k) => [].concat((QUESTS[k] || {}).prereq || []).every((x) => !!QUESTS[x]));   // one spine: the Last Step stands in for the retired V-VI
  // the subtle Sovereign hint must still be present for chapter IV to pay off
  const _src = [...document.querySelectorAll('script')].map((x) => x.textContent).join('');
  out.sovereignHint = /sapphire signet/i.test(_src);
  // chapter V's equivalent: the soot is the only evidence in the game that the
  // distorted Barnaby was ever at a forge. Remove it and chapter V is asking the
  // player to find something that is no longer there.
  out.barnabySootHint = /old soot under the gauntlets/i.test(_src);
  // The Smith is NOT part of the Lyra arc and must not be absorbed into it. His
  // canon predates it - Brok's master, armourer of the Twelve, broke his own
  // anvil - and chapter V's first draft contradicted every word of that by
  // making the Forge a place the tear copied through. Chapter V now explains
  // only why the ROAD re-opened. If a later edit rewrites the Smith to suit a
  // newer idea, this fails and says so.
  // Anchored to `sundered_smith:` + the line, NOT the bare phrase. The bare
  // phrase matched TWICE - the second hit was the comment above chapter V
  // quoting the canon it was written to respect. That guard would have passed
  // on the strength of a comment with the real intro line deleted.
  out.smithCanonIntact = /sundered_smith:\s*'He shattered the anvil that outlived what he loved/.test(_src);
  // the Mirror Self trial must name the aperture, or the prelude has nothing to
  // attach to and the Lv 20 -> Lv 40 arc stops being one idea
  out.trialNamesAperture = /APERTURE/.test((QUESTS.q_inner_dim_trial || {}).desc || '');
  // the chain must be a LINE, not three quests that happen to exist
  out.chain = ids.map((i) => { const p = (QUESTS[i] || {}).prereq; return Array.isArray(p) ? p[0] : (p || null); });   // the first prerequisite is still the previous chapter
  // the target's maps must be enterable at the quest's own level gate
  out.targetMapLevels = spawnMaps('harea').map((m) => ({ map: m, levelReq: MAPS[m].levelReq }));
  out.totalQuests = Object.keys(QUESTS).length;
  // one spine: The Tear V-VI are retired; the Last Step carries the roll and Lyra's lines key on it
  out.retired = ['q_lyra_forge', 'q_lyra_last'].map((k) => QUESTS[k] === undefined && _LX_RETIRED_QUESTS.includes(k));
  { const q = QUESTS.q_last_step || {}; let d = null; try { d = _qnavDest('q_last_step'); } catch (_e) {}
    out.last = { prereq: q.prereq, critical: !!q.critical, story: !!q.story, target: q.target, levelReq: q.levelReq, desc: q.desc || '', coins: (q.rewards || {}).mojicoins,
      targetMaps: spawnMaps(q.target), targetMapGate: Math.max(0, ...spawnMaps(q.target).map((m) => MAPS[m].levelReq || 1)), navResolves: !!d }; }
  out.lyraLines = /_ld\.q_last_step\) text = "You told me what is written at the bottom/.test(_src) && /d\.q_last_step\) el\.textContent = 'You read me the roll from the bottom of the stair/.test(_src) && !/q_lyra_last\) (text|el\.textContent) =/.test(_src);
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
check(JSON.stringify(r.chain) === JSON.stringify(['q_pq_carriage', 'q_lyra_aperture', 'q_lyra_loan', 'q_lyra_tear', 'q_lyra_cut']), 'the five chapters form one ordered chain 0 -> I -> II -> III -> IV', r.chain);
// the prelude must be reachable BEFORE the Lv 40 chapters, or it is not a prelude
const pre = r.chapters[0], first = r.chapters[1];
check(pre && first && pre.levelReq < first.levelReq, 'the prelude gates lower than chapter I (it is genuinely a prelude)', { prelude: pre && pre.levelReq, chapterI: first && first.levelReq });
// every listed objective must be a mob that genuinely spawns, or the chapter is
// uncompletable no matter how well it reads
for (const c of r.chapters) {
  for (const o of (c.objectives || [])) {
    check(o.spawns > 0, `${c.qid} objective "${o.target}" spawns somewhere`, o);
  }
}
// Each chapter against ITS OWN target's maps. Comparing every chapter to
// future_lyra's Lv 40 maps is the v0.29.645 bug: the Lv 20 prelude targets
// mirrorSelf in the Inner Dimension and fails for a reason unrelated to it.
// Each chapter against ITS OWN target's maps. The first version compared every
// chapter to future_lyra's maps, which failed the Lv 20 prelude the moment it
// existed - the prelude targets mirrorSelf in the Inner Dimension, not the
// distorted chain. The assertion was measuring the wrong quest's geography.
for (const c of r.chapters) {
  if (c.missing) continue;
  check(c.levelReq >= c.targetMapGate, `${c.qid} is not gated BELOW the maps its own target lives in`, { gate: c.levelReq, targetMapGate: c.targetMapGate, maps: c.targetMaps });
}
check(r.sovereignHint, 'the Sovereign still carries the sapphire signet chapter IV asks you to look for', r.sovereignHint);
check(r.barnabySootHint, 'the distorted Barnaby still carries the forge-soot (his lore outlives the retired chapter V)', r.barnabySootHint);   // one spine
check(r.retired.every(Boolean), 'The Tear V-VI are retired (absent from QUESTS, listed in _LX_RETIRED_QUESTS)', r.retired);   // one spine
{ const L = r.last;   // one spine: the Last Step is where the arc's ending now lives
  check(L.prereq === 'q_boss_sundered_smith' && L.critical && L.story && L.target === 'miraFallen', 'the Last Step follows the Smith and hunts the copy (miraFallen), critical + story', L);
  check(L.targetMaps.length > 0 && L.levelReq >= L.targetMapGate && L.navResolves, "the Last Step's target spawns, is not gated below its maps, and resolves in the navigator", { maps: L.targetMaps, gate: L.targetMapGate, lv: L.levelReq, nav: L.navResolves });
  check(L.desc.length > 400 && (L.coins | 0) > 0, 'the Last Step carries real prose and pays out', { chars: L.desc.length, coins: L.coins });
  check(/It is a roll of twelve expeditions/.test(L.desc) && /one line she did not finish: "It was never meant to/.test(L.desc) && /Then tell Lyra what the roll says\.$/.test(L.desc.trim()), "the Last Step carries The Tear VI's roll (twelve expeditions, the unfinished line, tell Lyra)", L.desc.slice(-160));
}
check(r.lyraLines, "Lyra's after-the-stair lines key on q_last_step (not the retired q_lyra_last)", r.lyraLines);   // one spine
check(r.smithCanonIntact, 'the Sundered Smith\'s own story is untouched (chapter V explains the road, not the man)', r.smithCanonIntact);
check(r.trialNamesAperture, 'the Mirror Self trial names the aperture the prelude explains', r.trialNamesAperture);
check(errs.length === 0, 'no page errors', errs);
console.log(bad ? `\n${bad} FAILED` : `\nall green — ${r.totalQuests} quests total`);
process.exit(bad ? 1 : 0);
