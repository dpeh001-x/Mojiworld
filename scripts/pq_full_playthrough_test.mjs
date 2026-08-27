// Live test: THE TICKET RUSH PLAYS THROUGH, END TO END, WITH NO GATE BUGS.
//
// Per user: "ensure that PQ has no gate bugs and that players can play through
// without issue". So this does not plant flags and assert them back - it runs
// the chain the way a player does: talk to Milo, click the option he offers,
// satisfy the objective through the REAL credit functions (tickQuestKill /
// openChest / boss death), and demand the next option exists at every seam.
//
// Then it sweeps the states a clean run never reaches, which is where gate
// bugs actually live: entering under-levelled, leaving mid-stage and coming
// back, re-talking to Milo at every point, a mid-stage reload, and arriving in
// each PQ map out of order.
//   node scripts/pq_full_playthrough_test.mjs
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import net from 'node:net';
import { spawn } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const free = (p) => new Promise((r) => { const s = net.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8961; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], {
  stdio: 'ignore', env: { ...process.env, MOJI_GAME_FILE: process.env.MOJI_GAME_FILE || '' } });
await new Promise((r) => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
const loopErrs = [];
page.on('console', (m) => { if (m.type() === 'error' && /\[loop|LoopWatchdog/.test(m.text())) loopErrs.push(m.text().slice(0, 200)); });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof openNPC === 'function' && typeof QUESTS === 'object', null, { timeout: 120000 });
await page.evaluate(() => new Promise((res) => { let n = 0;
  const t = () => { window._lxBootGateDone = true;
    const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
    const c = document.querySelector('.cls-card'); if (c) c.click();
    const m = document.getElementById('class-select-modal'); if (m) m.style.display = 'none';
    if (++n > 150) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); }));
await page.waitForTimeout(1200);

const frames = (n) => page.evaluate((k) => new Promise((res) => { let i = 0;
  const t = () => { game.paused = false; if (++i > k) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); }), n);
const go = async (map) => { await page.evaluate((m) => { try { loadMap(m); } catch (e) {} }, map); await page.waitForTimeout(700); };
// Milo's real dialog. Returns his options; can also CLICK one by substring.
const milo = async (clickRe) => {
  // open first, let the dialog settle (the body text types out, so reading it
  // in the same synchronous evaluate returned "" on every build), then read.
  await page.evaluate(() => {
    window._dlgErr = null;
    try { openNPC({ name: 'Milo', role: 'usher' }); } catch (e) { window._dlgErr = String(e).slice(0, 100); }
  });
  await page.waitForTimeout(450);
  const r = await page.evaluate((re) => {
    const btns = [...document.querySelectorAll('#dialog-options button')];
    const opts = btns.map((x) => x.textContent.trim());
    // read the text BEFORE closing - closeDialog() clears it, and reading
    // after returned "" for every no-click call, which looked like a dialog
    // that never opened
    const txt = ((document.getElementById('dialog-text') || {}).textContent || '').slice(0, 240);
    let clicked = null;
    if (re) { const hit = btns.find((x) => new RegExp(re).test(x.textContent)); if (hit) { clicked = hit.textContent.trim(); hit.click(); } }
    if (!clicked) { try { if (typeof closeDialog === 'function') closeDialog(); } catch (e) {} }
    return { opts, clicked, err: window._dlgErr, txt,
      map: (typeof game !== 'undefined' && game) ? game.currentMap : null };
  }, clickRe || null);
  await page.waitForTimeout(600);
  return r;
};
const state = () => page.evaluate(() => {
  const Q = player.quests || {};
  const pick = (o) => Object.keys(o || {});
  return { map: game.currentMap, active: pick(Q.active), completed: pick(Q.completed), unlocked: pick(Q.unlocked),
    pieces: Object.keys(player._pqSpirePieces || {}).length, lv: player.level };
});

// ---------------- entry gate: the number Milo quotes must be the real one ----
const entry = await page.evaluate(() => {
  if (typeof _ensureQuests === 'function') _ensureQuests();
  player.quests.active = {}; player.quests.completed = {}; player.quests.unlocked = {};
  player.level = 20; player.cls = player.cls || 'warrior'; player._god = true;
  if (typeof tickQuestUnlocks === 'function') tickQuestUnlocks();
  return { need: QUESTS.q_clockwork_underpass.levelReq, lv: player.level,
    acceptWouldWork: (player.level >= QUESTS.q_clockwork_underpass.levelReq) };
});
await go('town');
const d20 = await milo();
const accepted20 = await page.evaluate(() => !!(player.quests.active && player.quests.active.q_clockwork_underpass));
// An under-levelled player must be told the REAL requirement, not handed the
// "your record isn't in my logbook / blame the filing clerks" edge-case line
// that made a level gate look like a broken save.
// Assert the BRANCH, not the typed characters: the body types out, so racing
// it for the literal "Lv 29" measured the typewriter. What matters is that an
// under-levelled player gets the level refusal and never the "your record
// isn't in my logbook / blame the filing clerks" line, which reads as a broken
// save when the player is simply too low.
ok('an under-levelled player gets the level refusal, not "the game is broken"',
  !/logbook|filing clerks|squints at his clipboard/i.test(d20.txt || '')
  && /looks you over|minimum|Lv\s*29/i.test(d20.txt || ''),
  { lv: 20, levelReq: entry.need, milo: (d20.txt || '').slice(0, 150) });

ok('an under-levelled player is never offered a Start button that cannot work',
  !(d20.opts.some((t) => /Begin Stage 1/.test(t)) && !entry.acceptWouldWork),
  { lv: entry.lv, levelReq: entry.need, offered: d20.opts, acceptedAnyway: accepted20,
    note: 'Milo quoted "Lv 15 minimum" while acceptQuest enforces levelReq - the button did nothing' });

// ---------------- the actual playthrough ------------------------------------
await page.evaluate(() => { player.level = 29; if (typeof tickQuestUnlocks === 'function') tickQuestUnlocks(); });
const s0 = await milo('Begin Stage 1');
ok('Stage 1: Milo offers it and the click both accepts and warps',
  !!s0.clicked && (await state()).active.includes('q_clockwork_underpass') && (await state()).map === 'clockworkUnderpassLobby',
  { clicked: s0.clicked, after: await state() });

// clear stage 1 through the real kill-credit path
await page.evaluate(() => {
  const need = (QUESTS.q_clockwork_underpass.count || 150);
  for (let i = 0; i < need; i++) tickQuestKill('ticketMech', false);
});
await frames(20);
const afterS1 = await state();
ok('Stage 1 completes on the real kill counter (no hand-in dead-end)',
  afterS1.completed.includes('q_clockwork_underpass') && !afterS1.active.includes('q_clockwork_underpass'), afterS1);

const s2 = await milo('Begin Stage 2');
const afterS2Start = await state();
ok('Stage 2: offered in the PQ map immediately after Stage 1, click warps to the Spire',
  !!s2.clicked && afterS2Start.active.includes('q_pq_spire') && afterS2Start.map === 'clockworkSpire',
  { clicked: s2.clicked, after: afterS2Start });

// collect the 4 pieces through the real chest path
const pieceRes = await page.evaluate(async () => {
  const cfgs = (MAPS.clockworkSpire._pqChestPieces || []).slice();
  const out = { cfgs: cfgs.length, opened: 0 };
  for (const cfg of cfgs) {
    let ch = game.chests.find((c) => c && c._pqPuzzlePiece && c._pqPieceIndex === cfg.pieceIndex);
    if (!ch) { spawnChest(cfg.x, cfg.y, 'gold'); ch = game.chests[game.chests.length - 1]; ch._pqPuzzlePiece = true; ch._pqPieceIndex = cfg.pieceIndex; }
    openChest(ch); out.opened++;
    await new Promise((r) => requestAnimationFrame(r));
  }
  out.pieces = Object.keys(player._pqSpirePieces || {}).length;
  out.portal = (game.portals || []).some((p) => p && (p._spireReturn || /carriage|tower/i.test(String(p.target || p.to || ''))));
  return out;
});
await frames(20);
const afterPieces = await state();
ok('Stage 2 completes when all four piece chests are opened',
  pieceRes.pieces === 4 && afterPieces.completed.includes('q_pq_spire'),
  { ...pieceRes, after: afterPieces });

const s3 = await milo('Begin Stage 3');
const afterS3Start = await state();
ok('Stage 3: offered right there in the Spire, click warps to the Carriage',
  !!s3.clicked && afterS3Start.active.includes('q_pq_carriage') && afterS3Start.map === 'tower',
  { clicked: s3.clicked, after: afterS3Start });

await page.evaluate(() => {
  const need = (QUESTS.q_pq_carriage.count || 8);
  for (let i = 0; i < need; i++) tickQuestKill('ticketMech', false);
});
await frames(20);
const afterS3 = await state();
ok('Stage 3 completes on its own kill counter',
  afterS3.completed.includes('q_pq_carriage'), afterS3);

const s4 = await milo('Begin Stage 4|Master Conductor');
const afterS4Start = await state();
ok('Stage 4: offered after Stage 3, click warps to the Express',
  !!s4.clicked && afterS4Start.active.includes('q_pq_finale') && afterS4Start.map === 'clockworkExpress',
  { clicked: s4.clicked, after: afterS4Start });

const bossRes = await page.evaluate(async () => {
  const out = { pendingConsumed: !player._pqFinaleBossPending };
  let boss = game.monsters.find((m) => m && m.type === 'pqConductor');
  out.spawned = !!boss;
  if (!boss) { spawnMonster(Math.round(player.x) + 200, player.y - 40, 'pqConductor', true, false); boss = game.monsters.find((m) => m && m.type === 'pqConductor'); }
  // He must be BEATEN, not one-shot: boss damage mitigation lands only ~17% of
  // a hit, so a single 999999999 leaves him standing and credits nothing. The
  // first cut of this test did exactly that and reported a Stage-4 gate bug
  // that does not exist.
  if (boss) {
    for (let i = 0; i < 400 && boss.currentHp > 0; i++) {
      boss.invulnerable = 0;
      hitMonster(boss, Math.max(1000, Math.ceil((boss.maxHp || 1e6) / 8)), false, 'test');
      await new Promise((r) => requestAnimationFrame(r));
    }
    out.hits = 400; out.bossHp = boss.currentHp;
  }
  out.bossGone = !game.monsters.some((m) => m && m.type === 'pqConductor');
  return out;
});
await frames(30);
const afterBoss = await state();
ok('the Master Conductor spawns on arrival and his death completes Stage 4',
  bossRes.spawned && afterBoss.completed.includes('q_pq_finale'),
  { ...bossRes, after: afterBoss });

ok('the whole chain is completed — all four stages, nothing left active',
  ['q_clockwork_underpass', 'q_pq_spire', 'q_pq_carriage', 'q_pq_finale'].every((q) => afterBoss.completed.includes(q))
    && afterBoss.active.length === 0, afterBoss);

// ---------------- the states a clean run never reaches ----------------------
// mid-stage: leave to town, talk to Milo, get sent back (not stranded)
const resume = await page.evaluate(() => {
  player.quests.completed = { q_clockwork_underpass: Date.now(), q_pq_spire: Date.now() };
  player.quests.active = { q_pq_carriage: { progress: 3 } };
  player.quests.unlocked = {};
  return true;
});
await go('town');
const dResume = await milo();
const resumedMap = (await state()).map;
ok('mid-stage in town: Milo resumes the run instead of stranding the player',
  resumedMap === 'tower' || dResume.opts.some((t) => /Continue Stage 3|Stage 3/.test(t)),
  { map: resumedMap, opts: dResume.opts });

// every PQ map, every stage boundary, must offer a way onward
const stuck = [];
for (const [label, setup] of [
  ['S1 done, in lobby',   () => ({ completed: ['q_clockwork_underpass'], active: [], map: 'clockworkUnderpassLobby' })],
  ['S2 done, in spire',   () => ({ completed: ['q_clockwork_underpass', 'q_pq_spire'], active: [], map: 'clockworkSpire' })],
  ['S3 done, in carriage',() => ({ completed: ['q_clockwork_underpass', 'q_pq_spire', 'q_pq_carriage'], active: [], map: 'tower' })],
  ['S3 done, in express', () => ({ completed: ['q_clockwork_underpass', 'q_pq_spire', 'q_pq_carriage'], active: [], map: 'clockworkExpress' })],
  ['S1 done, in town',    () => ({ completed: ['q_clockwork_underpass'], active: [], map: 'town' })],
  ['S2 done, in town',    () => ({ completed: ['q_clockwork_underpass', 'q_pq_spire'], active: [], map: 'town' })],
]) {
  const cfg = setup();
  await page.evaluate((c) => {
    player.quests.completed = {}; player.quests.active = {}; player.quests.unlocked = {};
    for (const id of c.completed) player.quests.completed[id] = Date.now();
  }, cfg);
  await go(cfg.map);
  const d = await milo();
  const onward = d.opts.some((t) => /Begin Stage|Continue Stage|Master Conductor/.test(t));
  if (!onward) stuck.push({ label, map: cfg.map, opts: d.opts });
}
ok('no stage boundary, in any map, leaves the player with only "ride home"',
  stuck.length === 0, { stuck });

// a reload mid-run must not lose the pieces or the stage
const persist = await page.evaluate(() => {
  player.quests.completed = { q_clockwork_underpass: Date.now() };
  player.quests.active = { q_pq_spire: { progress: 2 } };
  player._pqSpirePieces = { 0: true, 1: true };
  // saveState() only marks dirty and schedules a debounced flush; reading
  // localStorage straight after returns nothing and looks like data loss.
  if (typeof _flushSaveStateNow === 'function') _flushSaveStateNow();
  else if (typeof saveState === 'function') saveState();
  // the real key is SAVE_KEY = 'levelx_save_v1' (guessed names read empty and
  // looked like a persistence bug)
  const raw = (() => { try { return localStorage.getItem(typeof SAVE_KEY !== 'undefined' ? SAVE_KEY : 'levelx_save_v1') || ''; } catch (e) { return ''; } })();
  return { savedHasPieces: /_pqSpirePieces/.test(raw), savedHasSpire: /q_pq_spire/.test(raw), rawLen: raw.length };
});
ok('a mid-Spire save carries the collected pieces and the active stage',
  persist.savedHasPieces && persist.savedHasSpire, persist);

ok('no page errors and no swallowed frame throws across the whole run',
  errs.length === 0 && loopErrs.length === 0,
  { errs: errs.slice(0, 2), loopErrs: loopErrs.slice(0, 2) });

await b.close(); srv.kill();
let pass = 0;
for (const t of results) {
  console.log((t.pass ? '  PASS  ' : '  FAIL  ') + t.n);
  if (!t.pass) console.log('        ' + JSON.stringify(t.x).slice(0, 400));
  if (t.pass) pass++;
}
console.log('\n' + pass + '/' + results.length + ' checks passed');
process.exit(pass === results.length ? 0 : 1);
