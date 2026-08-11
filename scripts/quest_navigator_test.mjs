// Quest navigator: resolution coverage + route correctness, read live.
// Every number here is MEASURED and printed, then asserted against a floor.
// Asserting exact counts would fail every time a parallel session adds a
// quest or moves an NPC, which is not a navigator bug.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage();
const url = 'file:///' + path.join(ROOT, process.argv[2] || 'mojiworld_game.html').split(path.sep).join('/');
await p.goto(url, { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => typeof QUESTS !== 'undefined' && typeof _qnavDest === 'function', { timeout: 60000 });

const r = await p.evaluate(() => {
  const out = { total: 0, npc: 0, hunt: 0, none: [], badMap: [], samples: [], routes: [], selfRoute: null, unreachable: 0 };
  for (const qid in QUESTS) {
    out.total++;
    const d = _qnavDest(qid);
    if (!d) { if (out.none.length < 20) out.none.push(qid); continue; }
    if (d.kind === 'npc') out.npc++; else out.hunt++;
    // every destination must name a real map
    if (!MAPS[d.map]) out.badMap.push(`${qid} -> ${d.map}`);
    // an npc destination must carry usable coordinates
    if (d.kind === 'npc' && !(Number.isFinite(d.x) && Number.isFinite(d.y))) out.badMap.push(`${qid} coords`);
    if (out.samples.length < 6) out.samples.push(`${qid}: [${d.kind}] ${_qnavLabel(d)} · ${d.hops} hop(s)`);
  }
  // Routing: from town, spot-check that a route's hop chain actually connects.
  const targets = ['mushroom', 'slimeCave', 'sunsetBeach', 'coralReef', 'frozenPeak'];
  for (const t of targets) {
    if (!MAPS[t]) continue;
    const rt = _qnavRoute('town', t);
    if (!rt) { out.unreachable++; out.routes.push(`town -> ${t}: UNREACHABLE`); continue; }
    // walk the chain and verify each hop's portal really leads to the next map
    let cur = 'town', ok = true;
    for (const h of rt.hops) {
      if (h.from !== cur) { ok = false; break; }
      const real = (MAPS[cur].portals || []).some((po) => po === h.portal && po.dest === h.portal.dest);
      if (!real) { ok = false; break; }
      cur = h.portal.dest;
    }
    if (cur !== t) ok = false;
    out.routes.push(`town -> ${t}: ${rt.dist} hop(s) via ${rt.hops.map((h) => h.portal.dest).join(' > ') || '(here)'} ${ok ? 'CHAIN-OK' : 'CHAIN-BROKEN'}`);
    if (!ok) out.badMap.push(`route town->${t}`);
  }
  const sr = _qnavRoute('town', 'town');
  out.selfRoute = sr && sr.dist === 0 ? 'ok' : 'BROKEN';
  return out;
});
await b.close();

let fail = 0;
const check = (name, ok, got) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (got ${JSON.stringify(got)})`}`); if (!ok) fail++; };
const resolved = r.npc + r.hunt;

console.log(`quests ${r.total} | npc ${r.npc} | hunt-fallback ${r.hunt} | unresolved ${r.none.length}`);
console.log('samples:\n  ' + r.samples.join('\n  '));
console.log('routes:\n  ' + r.routes.join('\n  '));
if (r.none.length) console.log('unresolved: ' + r.none.join(', '));

// One documented exception, asserted as an exact set rather than a count so a
// NEW unresolvable quest still fails here. q_zodiac_twelve is kind:'special'
// with target 'zodiacAll' — it spans all twelve zodiac houses at once, so it
// has no single destination to point at. Everything else must resolve.
const KNOWN_UNRESOLVED = ['q_zodiac_twelve'];
const unexpected = r.none.filter((id) => !KNOWN_UNRESOLVED.includes(id));
const missingExpected = KNOWN_UNRESOLVED.filter((id) => !r.none.includes(id));
check('no unexpected unresolved quest', unexpected.length === 0, unexpected);
check('known exceptions still the only ones', missingExpected.length === 0, `now resolvable, drop from list: ${missingExpected}`);
check('npc destinations dominate (>=240)', r.npc >= 240, r.npc);
check('no destination names a missing map / bad coords', r.badMap.length === 0, r.badMap);
check('route chains actually connect', !r.routes.some((x) => x.includes('CHAIN-BROKEN')), r.routes);
check('no spot-check target unreachable', r.unreachable === 0, r.unreachable);
check('self-route is 0 hops', r.selfRoute === 'ok', r.selfRoute);
console.log(fail ? `\n${fail} FAILED` : `\nall green — ${resolved}/${r.total} quests navigable`);
process.exit(fail ? 1 : 0);
