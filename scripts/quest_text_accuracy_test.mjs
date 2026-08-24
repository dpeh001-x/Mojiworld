// Live audit + regression test: DOES A QUEST STATE THE NUMBER IT ACTUALLY WANTS?
//
// Per user, with a screenshot of the Journal: "it says 20 but requires 400
// kills. please do a thorough check and fix".
//
// Three separate things had to be true and were not, so this file checks all
// three across EVERY counted quest, fresh and after a real page reload:
//
//   1. SINGLE-TARGET quests are governed by the per-accept hunt roll
//      (a.targetCount, 200-5000 by level). The prose is built at boot from the
//      authored count, and acceptQuest syncs it to the roll - but QUESTS is a
//      module table rebuilt on every page load while a.targetCount lives in the
//      save, so that sync is undone by the next reload and never re-applied.
//   2. MULTI-OBJECTIVE quests are NOT governed by that roll: tickQuestKill
//      returns from an earlier branch and completes when every quota is filled.
//      Showing the roll as the requirement painted a headline the quest could
//      neither reach nor need.
//   3. The headline total the player reads must be the number that actually
//      gates the turn-in, whichever shape the quest is.
//
//   node scripts/quest_text_accuracy_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof QUESTS === 'object' && typeof acceptQuest === 'function'
  && typeof _lxQuestKillTarget === 'function', null, { timeout: 120000 });
// the count normaliser is deferred to a setTimeout, so boot descs are not final
// on the first frame
await page.waitForTimeout(2500);

// One checker, injected into both passes, so the fresh and post-reload runs
// judge the text by exactly the same rule.
const CHECK = `(() => {
  window._lxQAudit = function () {
    const rows = [];
    const words = (s) => String(s || '');
    for (const id in QUESTS) {
      const q = QUESTS[id];
      if (!q || q.kind !== 'kill' || q.bossFight) continue;
      const a = player.quests && player.quests.active && player.quests.active[id];
      if (!a) continue;
      const objs = (Array.isArray(q.objectives) && q.objectives.length) ? q.objectives : null;
      const desc = words(q.desc);
      // What the player is SHOWN (journal + tracker read this exact expression)
      const shown = (a.targetCount != null) ? (a.targetCount | 0) : (q.count | 0);
      // What actually gates the turn-in, read off the two real branches of
      // tickQuestKill rather than assumed
      const gate = objs
        ? objs.reduce((t, o) => t + (o.count | 0), 0)
        : ((a.targetCount != null) ? (a.targetCount | 0) : (q.count | 0));
      if (gate <= 1) continue;
      const row = { id, name: q.name, shown, gate, authored: q.count | 0,
        multi: !!objs, desc: desc.slice(0, 200) };
      row.shownMatchesGate = (shown === gate);
      if (objs) {
        // every quota must be spelled out, and the total named
        row.quotas = objs.map(o => o.count | 0);
        row.statesEveryQuota = objs.every(o =>
          new RegExp('\\\\b' + (o.count | 0) + '\\\\b').test(desc));
        row.statesSum = new RegExp('\\\\b' + gate.toLocaleString().replace(',', ',?') + '\\\\b').test(desc)
          || new RegExp('\\\\b' + gate + '\\\\b').test(desc);
        row.oneLie = false;
        // The OBJECTIVE line being right is not enough - the BODY must not
        // contradict it. For each objective, every number the prose puts next
        // to that creature (in any spelling: display name, type key,
        // hyphenated, singular or plural) has to equal that creature's quota.
        // This is what caught "20 mournshades, 14 lantern-wisps and 8
        // echo-knights" sitting above quotas of 20/20/20.
        const body = desc.split('\\u25B8 OBJECTIVE:')[0];
        const esc2 = (x) => String(x).replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');
        const variants = (base) => {
          const outv = new Set();
          if (!base) return outv;
          const spaced = String(base).replace(/([a-z])([A-Z])/g, '$1 $2');
          for (const v of [String(base), spaced]) {
            const hy = v.replace(/\\s+/g, '-');
            for (const f of [v, v + 's', hy, hy + 's']) outv.add(f);
          }
          return outv;
        };
        row.bodyLies = [];
        for (const o of objs) {
          const nm2 = (typeof monsterTypes !== 'undefined' && monsterTypes[o.target] && monsterTypes[o.target].name)
            ? String(monsterTypes[o.target].name) : '';
          const forms = new Set([...variants(nm2), ...variants(o.target)]);
          for (const f of forms) {
            if (!f) continue;
            const re2 = new RegExp('(\\\\d[\\\\d,]*)\\\\s+(?:of\\\\s+the\\\\s+)?' + esc2(f) + '\\\\b', 'gi');
            let mm;
            while ((mm = re2.exec(body))) {
              const got = parseInt(String(mm[1]).replace(/,/g, ''), 10);
              if (got !== (o.count | 0)) row.bodyLies.push({ target: o.target, says: got, quota: o.count | 0 });
            }
          }
        }
      } else {
        row.statesLive = new RegExp('\\\\b' + gate + '\\\\b').test(desc)
          || desc.indexOf(gate.toLocaleString()) >= 0;
        // the pre-roll number must be gone from the prose entirely
        const n0 = q.count | 0;
        row.oneLie = (n0 > 0 && n0 !== gate && new RegExp('\\\\b' + n0 + '\\\\b').test(desc));
      }
      rows.push(row);
    }
    return rows;
  };
  window._lxAcceptAll = function () {
    player.level = 90;
    let n = 0;
    for (const id in QUESTS) {
      const q = QUESTS[id];
      if (!q || q.kind !== 'kill' || q.bossFight) continue;
      if ((q.count | 0) <= 1) continue;
      try { acceptQuest(id); } catch (e) {}
      if (player.quests && player.quests.active && player.quests.active[id]) n++;
    }
    return n;
  };
})()`;

await page.evaluate(CHECK);
const fresh = await page.evaluate(() => {
  if (!player.quests) player.quests = { active: {}, completed: {} };
  player.quests.active = {};
  const n = window._lxAcceptAll();
  try { if (typeof renderQuestJournal === 'function') renderQuestJournal(); } catch (e) {}
  return { accepted: n, rows: window._lxQAudit() };
});

// ---- the reload. This is the whole point: QUESTS is rebuilt from source, the
// save restores a.targetCount, and nothing used to re-state the prose.
await page.evaluate(() => { try { if (typeof saveGame === 'function') saveGame(); } catch (e) {} });
await page.reload({ waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof QUESTS === 'object' && typeof acceptQuest === 'function', null, { timeout: 120000 });
await page.waitForTimeout(2500);
await page.evaluate(CHECK);
const reloaded = await page.evaluate(() => {
  try { if (typeof loadGame === 'function') loadGame(); } catch (e) {}
  // exactly what the load path does, and then what opening the Journal does
  try { if (typeof renderQuestTracker === 'function') renderQuestTracker(); } catch (e) {}
  try { if (typeof renderQuestJournal === 'function') renderQuestJournal(); } catch (e) {}
  return { active: Object.keys((player.quests && player.quests.active) || {}).length,
    rows: window._lxQAudit() };
});

const single = (rs) => rs.filter(r => !r.multi);
const multi = (rs) => rs.filter(r => r.multi);
const badText = (rs) => single(rs).filter(r => !r.statesLive || r.oneLie);
const badMulti = (rs) => multi(rs).filter(r => !r.statesEveryQuota || !r.statesSum
  || (r.bodyLies && r.bodyLies.length));
const badShown = (rs) => rs.filter(r => !r.shownMatchesGate);
const ex = (rs) => rs.slice(0, 4).map(r => ({ quest: r.name, shown: r.shown, reallyNeeds: r.gate,
  quotas: r.quotas, bodyLies: r.bodyLies, desc: r.desc.slice(0, 90) }));

ok('the audit covered a real body of quests, both shapes',
  fresh.accepted > 40 && single(fresh.rows).length > 100 && multi(fresh.rows).length >= 10,
  { accepted: fresh.accepted, singleTarget: single(fresh.rows).length, multiObjective: multi(fresh.rows).length });
ok('the number shown IS the number that gates the turn-in (fresh)',
  badShown(fresh.rows).length === 0,
  { wrong: badShown(fresh.rows).length, of: fresh.rows.length, examples: ex(badShown(fresh.rows)) });
ok('every single-target quest states its real requirement (fresh)',
  badText(fresh.rows).length === 0,
  { wrong: badText(fresh.rows).length, of: single(fresh.rows).length, examples: ex(badText(fresh.rows)) });
ok('every multi-objective quest spells out each quota and the total (fresh)',
  badMulti(fresh.rows).length === 0,
  { wrong: badMulti(fresh.rows).length, of: multi(fresh.rows).length, examples: ex(badMulti(fresh.rows)) });
ok('the save round-trips the active quests',
  reloaded.active > 40 && reloaded.rows.length > 40,
  { activeAfterReload: reloaded.active, counted: reloaded.rows.length });
ok('AFTER A RELOAD the shown number still gates the turn-in',
  badShown(reloaded.rows).length === 0,
  { wrong: badShown(reloaded.rows).length, of: reloaded.rows.length, examples: ex(badShown(reloaded.rows)) });
ok('AFTER A RELOAD every single-target quest still states its requirement',
  badText(reloaded.rows).length === 0,
  { wrong: badText(reloaded.rows).length, of: single(reloaded.rows).length, examples: ex(badText(reloaded.rows)) });
ok('AFTER A RELOAD every multi-objective quest still spells out its quotas',
  badMulti(reloaded.rows).length === 0,
  { wrong: badMulti(reloaded.rows).length, of: multi(reloaded.rows).length, examples: ex(badMulti(reloaded.rows)) });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
if (process.env.LXDEBUG) {
  console.log('\n--- after reload, anything still wrong ---');
  for (const r of [...badShown(reloaded.rows), ...badText(reloaded.rows), ...badMulti(reloaded.rows)].slice(0, 12))
    console.log(`${r.name}: shown ${r.shown}, gate ${r.gate}, quotas ${JSON.stringify(r.quotas)} :: ${r.desc}`);
}
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
