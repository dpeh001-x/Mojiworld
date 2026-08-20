// Every Ticket Rush stage quotes ONE number - the one the quest actually wants
// - per user "Ensure that the PQ numbers and objectives are bugless" and
// "Further ensure that this is seamless without errors".
//
// The defect this guards: ticket-mech kills never reach tickQuestKill. The kill
// pipeline routes the whole ticket family through _lxPqDirectTick and marks
// m._pqDirectTicked so the standard path skips them. v0.29.843 keyed the
// stage-clear fanfare to the live target - but only inside tickQuestKill, the
// branch these mobs never take. The live branch kept `_a.progress === 8`, so
// once Stage 3 was retuned 8 -> 20 the game threw its legendary "STAGE 3
// cleared! Talk to Milo" fanfare on kill 8 of 20 and Milo had nothing to say
// when the player walked over. Four strings said "8" as well, while the pin and
// tracker said 20.
//
// So this grades the number the player is SHOWN against the number the quest
// CHECKS, at every surface, rather than against a literal - a future retune
// must not be able to make any of them lie again.
// Run: node scripts/pq_stage_count_test.mjs [file.html]
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
await page.waitForFunction(() => typeof loadMap === 'function', { timeout: 90000 });
const r = await page.evaluate(async () => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  player.level = 60; player.hp = player.maxHp = 9e8;

  const IDS = ['q_clockwork_underpass', 'q_pq_spire', 'q_pq_carriage', 'q_pq_finale'];
  const clear = () => { for (const k of IDS) {
    delete player.quests.active[k]; delete player.quests.completed[k];
    if (player.quests.unlocked) delete player.quests.unlocked[k];
  } };
  const goTo = async (id) => { loadMap(id);
    for (let i = 0; i < 240; i++) { if (game.currentMap === id) return true;
      await new Promise((res) => requestAnimationFrame(res)); } return false; };
  const settle = async (n) => { for (let i = 0; i < (n || 25); i++) await new Promise((res) => requestAnimationFrame(res)); };
  // Toast capture - every player-facing number graded below comes from here.
  const toasts = [];
  const origToast = window.showToast;
  window.showToast = function (t) { toasts.push(String(t)); return origToast.apply(this, arguments); };
  // One spawn is not one death: the elite affix pool includes `undying`
  // (traits.revivesOnce), and such a mob absorbs a killMonster() call and comes
  // back at 35% HP. Swing until it has actually left game.monsters, which is
  // killMonster's own liveness test.
  const killOne = () => {
    let m = null; try { m = spawnMonster(300, 200, 'ticketMech'); } catch (e) { return false; }
    if (!m) return false;
    for (let s = 0; s < 5 && game.monsters.indexOf(m) >= 0; s++) {
      m.currentHp = 0; try { killMonster(m); } catch (e) { return false; }
    }
    const ok = game.monsters.indexOf(m) < 0;
    game.monsters = [];
    return ok;
  };
  const liveTarget = (id) => {
    const a = player.quests.active[id];
    return (a && a.targetCount != null) ? a.targetCount : QUESTS[id].count;
  };
  const out = {};

  // ---- Stage 3: what it wants vs what it announces ----
  clear();
  player.quests.completed.q_clockwork_underpass = true;
  player.quests.completed.q_pq_spire = true;
  if (typeof tickQuestUnlocks === 'function') tickQuestUnlocks();
  toasts.length = 0;
  await goTo('tower'); await settle();
  const t3 = liveTarget('q_pq_carriage');
  out.s3 = { target: t3, authored: QUESTS.q_pq_carriage.count, accepted: !!player.quests.active.q_pq_carriage };
  const entry = toasts.filter((t) => /Carriage of Ascension\. Defeat/.test(t)).pop() || '';
  out.s3.entryToast = entry.slice(0, 90);
  out.s3.entryQuotes = new RegExp('Defeat ' + t3 + ' Ticket Mech').test(entry);
  if (typeof _renderPqObjectivePin === 'function') _renderPqObjectivePin();
  const pinEl = document.getElementById('pq-objective-pin');
  const pin = pinEl ? (pinEl.textContent || '').replace(/\s+/g, ' ') : '';
  out.s3.pinQuotes = pin.includes('Defeat ' + t3 + ' Ticket Mechs') && pin.includes('/' + t3);
  // the fanfare must fire on the clearing kill, not before
  let firedAt = null, fires = 0;
  for (let i = 1; i <= t3; i++) {
    const seen = toasts.length;
    if (!killOne()) { out.s3.killFail = i; break; }
    for (let k = seen; k < toasts.length; k++) {
      if (/STAGE 3 cleared/.test(toasts[k])) { fires++; if (firedAt == null) firedAt = i; }
    }
  }
  out.s3.fanfareAtKill = firedAt;
  out.s3.fanfareCount = fires;
  out.s3.completed = !!player.quests.completed.q_pq_carriage;

  // ---- Milo's own words ----
  clear();
  player.quests.completed.q_clockwork_underpass = true;
  player.quests.completed.q_pq_spire = true;
  if (typeof tickQuestUnlocks === 'function') tickQuestUnlocks();
  // The stage-offer script belongs to the TOWN Milo. The Milo standing in the
  // PQ maps is the warp/ferry variant ("Where to, friend?") and never speaks
  // this sentence - reading him graded an empty string.
  await goTo('town'); await settle();
  const milo = (game.npcs || []).find((n) => n && n.name === 'Milo');
  out.miloFound = !!milo;
  if (milo) {
    try { openNPC(milo); } catch (e) { out.miloErr = String(e).slice(0, 80); }
    // The body is typed a character at a time; _twSkip drains it instantly, so
    // this reads the finished sentence rather than racing the caret.
    const dlg = document.getElementById('dialog');
    for (let i = 0; i < 40; i++) await new Promise((res) => requestAnimationFrame(res));
    try { if (dlg && typeof dlg._twSkip === 'function') dlg._twSkip(); } catch (e) {}
    for (let i = 0; i < 20; i++) await new Promise((res) => requestAnimationFrame(res));
    const body = document.getElementById('dialog-text');
    const said = body ? (body.textContent || '').replace(/\s+/g, ' ') : '';
    const want = liveTarget('q_pq_carriage');
    out.miloOffer = { onOfferBranch: /Carriage of Ascension/.test(said),
                      quotes: said.includes(want + ' last stowaway'),
                      staleEight: /eight last stowaway/.test(said),
                      said: said.slice(-110) };
    try { closeDialog(); } catch (e) {}
  }

  // ---- Stage 1 announces its own live number too ----
  clear();
  if (typeof tickQuestUnlocks === 'function') tickQuestUnlocks();
  acceptQuest('q_clockwork_underpass');
  await goTo('clockworkUnderpassLobby'); await settle();
  const t1 = liveTarget('q_clockwork_underpass');
  let firedAt1 = null;
  toasts.length = 0;
  for (let i = 1; i <= t1; i++) {
    const seen = toasts.length;
    if (!killOne()) { out.s1KillFail = i; break; }
    for (let k = seen; k < toasts.length; k++) {
      if (/STAGE 1 cleared/.test(toasts[k]) && firedAt1 == null) firedAt1 = i;
    }
  }
  out.s1 = { target: t1, fanfareAtKill: firedAt1, completed: !!player.quests.completed.q_clockwork_underpass };
  window.showToast = origToast;
  return out;
});
await browser.close();

console.log(`  stage 3:  ${JSON.stringify(r.s3)}`);
console.log(`  milo:     ${JSON.stringify(r.miloOffer || { found: r.miloFound })}`);
console.log(`  stage 1:  ${JSON.stringify(r.s1)}`);

check(r.s3.accepted === true, 'Stage 3 arms on walk-in', r.s3);
check(r.s3.target === r.s3.authored, 'Stage 3 target is the authored count (noScale honoured)', r.s3);
check(r.s3.entryQuotes === true, 'the walk-in toast quotes the LIVE target, not a literal', r.s3.entryToast);
check(r.s3.pinQuotes === true, 'the objective pin quotes that same number', r.s3);
check(r.s3.fanfareAtKill === r.s3.target,
      'the "STAGE 3 cleared" fanfare fires on the CLEARING kill (fired on 8 of 20)', r.s3);
check(r.s3.fanfareCount === 1, 'and fires exactly once', r.s3);
check(r.s3.completed === true, 'and the stage really is complete when it says so', r.s3);
check(r.miloFound === true, 'Milo is there to ask', r.miloFound);
check(!!(r.miloOffer && r.miloOffer.onOfferBranch),
      'and his Stage-3 offer actually rendered (else the two checks below are vacuous)', r.miloOffer);
check(!!(r.miloOffer && r.miloOffer.quotes), "Milo's offer quotes the live target", r.miloOffer);
check(!!(r.miloOffer && !r.miloOffer.staleEight), 'and no longer says "eight"', r.miloOffer);
check(r.s1.fanfareAtKill === r.s1.target, 'Stage 1 fanfare is keyed to its live target too', r.s1);
check(r.s1.completed === true, 'and Stage 1 completes on that kill', r.s1);
check(errs.length === 0, 'no page errors', [...new Set(errs)].slice(0, 3));
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
