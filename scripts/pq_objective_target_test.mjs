// The PQ objective pin quotes the target the quest is actually counting to,
// per user ("error in quest quantity, 150 vs 500").
//
// Kill quests are retargeted at accept time onto the hunt curve
// (_lxQuestKillTarget) and the real number is stored as targetCount. Every
// consumer reads it — except the PQ pin, which quoted the AUTHORED count. Stage
// 1 showed 150 against the tracker's 500, and past 150 it counted down through
// zero: "444/150 — -294 left to clear".
//
// This drives the real pin renderer and reads the DOM it produces, so it fails
// if the pin and the quest system ever disagree again.
// Run: node scripts/pq_objective_target_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const URL = 'file:///' + path.join(ROOT, args[0] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof QUESTS !== 'undefined' && typeof acceptQuest === 'function', { timeout: 90000 });
const r = await page.evaluate(() => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  player.level = 99;
  const out = { stages: {} };

  // The pin only renders on a PQ map.
  loadMap('clockworkUnderpassLobby');

  const readPin = () => {
    if (typeof _renderPqObjectivePin === 'function') _renderPqObjectivePin();
    const el = document.getElementById('pq-objective-pin') ||
               document.querySelector('[id*="pq-objective"]');
    return el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null;
  };
  out.pinFound = readPin() !== null;

  const stage = (id, progress) => {
    for (const k of ['q_clockwork_underpass', 'q_pq_spire', 'q_pq_carriage', 'q_pq_finale']) {
      delete player.quests.active[k];
    }
    // v0.29.900 gated acceptQuest on the prereq chain, so accepting Stage 3
    // cold now (correctly) fails. Seed the earlier stages as done first —
    // this test grades the pin's arithmetic, not the order gate (that is
    // pq_chain_integrity_test's job).
    player.quests.completed.q_clockwork_underpass = true;
    player.quests.completed.q_pq_spire = true;
    delete player.quests.completed[id];
    acceptQuest(id);
    const a = player.quests.active[id];
    if (!a) return { notAccepted: true };
    const target = (a.targetCount != null) ? a.targetCount : QUESTS[id].count;
    a.progress = progress;
    const text = readPin();
    return {
      authored: QUESTS[id].count, target, progress,
      text,
      quotesTarget: !!(text && text.indexOf('/' + target) !== -1),
      quotesAuthored: !!(text && target !== QUESTS[id].count
                         && text.indexOf('/' + QUESTS[id].count + ' ') !== -1),
      negative: !!(text && /-\d+ left/.test(text)),
      leftShown: text ? ((text.match(/(-?\d+) left/) || [])[1] ?? null) : null,
    };
  };

  // Stage 1 at the exact count from the report.
  out.stages.s1 = stage('q_clockwork_underpass', 444);
  // Stage 1 pushed PAST the authored 150 and past the real target too.
  out.stages.s1over = stage('q_clockwork_underpass', 9999);
  // Stage 3 — same defect class, authored 8 against a much larger real target.
  out.stages.s3 = stage('q_pq_carriage', 50);

  // The journal prose must not quote a number the quest is not counting to.
  // Since v0.29.916 the prose may instead name NO number (static strings have
  // nowhere to interpolate a live target) — that is fine; a WRONG number is not.
  out.desc = {};
  for (const id of ['q_clockwork_underpass', 'q_pq_carriage']) {
    delete player.quests.active[id]; delete player.quests.completed[id];
    player.quests.completed.q_clockwork_underpass = (id !== 'q_clockwork_underpass');
    player.quests.completed.q_pq_spire = (id === 'q_pq_carriage');
    acceptQuest(id);
    const a = player.quests.active[id];
    const t = (a && a.targetCount != null) ? a.targetCount : QUESTS[id].count;
    const d = QUESTS[id].desc || '';
    out.desc[id] = { target: t, quotesTarget: d.indexOf(String(t)) !== -1,
                     quotesAuthored: t !== QUESTS[id].count && new RegExp('\\b' + QUESTS[id].count + '\\b').test(d),
                     namesAnyMechCount: /\b\d+\s+(?:last\s+)?(?:stowaways?|Ticket Mechs?)/i.test(d) };
  }
  return out;
});
await browser.close();

console.log(`  stage 1 @444 : ${JSON.stringify(r.stages.s1)}`);
console.log(`  stage 1 @9999: left="${r.stages.s1over.leftShown}" negative=${r.stages.s1over.negative}`);
console.log(`  stage 3 @50  : ${JSON.stringify({ authored: r.stages.s3.authored, target: r.stages.s3.target, quotesTarget: r.stages.s3.quotesTarget })}`);
console.log(`  journal prose: ${JSON.stringify(r.desc)}`);

check(r.pinFound, 'the PQ objective pin renders on a PQ map', r.pinFound);
// Deliberately NOT asserting a number. v0.29.843 exempted the PQ quests from
// the hunt curve (noScale), so the live target is the authored 150 again — and
// it may move again. What must hold is that the pin quotes whatever the quest is
// counting to, authored or scaled, and never the other one.
check(r.stages.s1.target > 0, 'Stage 1 has a live target to quote', r.stages.s1.target);
check(r.stages.s1.quotesTarget, 'the pin quotes the target the quest is counting to', r.stages.s1.text);
check(!r.stages.s1.quotesAuthored, 'and never the dead authored count', r.stages.s1.text);
check(!r.stages.s1.negative, 'no negative remainder at the reported 444 progress', r.stages.s1.text);
check(!r.stages.s1over.negative && r.stages.s1over.leftShown === '0',
      'overshooting the target shows 0 left, never a negative', r.stages.s1over);
check(r.stages.s3.target > 0, 'Stage 3 has a live target to quote', r.stages.s3.target);
check(r.stages.s3.quotesTarget, 'and its pin quotes the real target as well', r.stages.s3.text);
check(!r.stages.s3.negative, 'Stage 3 shows no negative remainder past its authored count', r.stages.s3.text);
check(r.desc.q_clockwork_underpass.quotesTarget && !r.desc.q_clockwork_underpass.quotesAuthored,
      'Stage 1 journal text states the real target', r.desc.q_clockwork_underpass);
// Stage 3's prose deliberately names no number since v0.29.916 (a static
// string cannot follow a retune, so it stopped trying). Either the live
// target or silence is honest; a stale count is the only failure.
check(!r.desc.q_pq_carriage.quotesAuthored
      && (r.desc.q_pq_carriage.quotesTarget || !r.desc.q_pq_carriage.namesAnyMechCount),
      'Stage 3 journal text quotes the live target or no number at all', r.desc.q_pq_carriage);
check(errs.length === 0, 'no page errors', [...new Set(errs)].slice(0, 3));
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
