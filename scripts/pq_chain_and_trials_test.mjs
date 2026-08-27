// Live test: FOUR REPORTED DEFECTS, ONE SUITE.
//
//  1. "spiky mushrooms have a weird dash animation sprite occasionally" - the
//     Horncap fired its mob-sized horn point-blank from inside its own
//     silhouette during dashCharge. Invariant: no mob shot spawns while
//     _dashCharging is live; the ripe shot fires once the dash ends.
//  2. "highlight who is the npc that gives the [Lv-20 advancement] quest" -
//     the journal pill must name the player's own instructor, and that
//     instructor (alone) must carry the gold quest marker.
//  3. Mirror Self: +35% hp via the stats table, evasion 190 / speed 3.5 via
//     the literal, and the new recurring MIRROR JUDGEMENT (70% max HP + all
//     MP, telegraphed, OHKO-clamped, evadable by distance).
//  4. "completed part 1 of the PQ but milo dont let me proceed" - Milo must
//     offer the next stage at every boundary, in PQ maps and in town, even
//     when the unlocked flag has drifted; and stages 2-4 no longer out-level
//     the Lv-29 entry.
//   node scripts/pq_chain_and_trials_test.mjs
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
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof spawnMonster === 'function' && typeof QUESTS === 'object', null, { timeout: 120000 });
await page.evaluate(() => new Promise((res) => { let n = 0;
  const t = () => { window._lxBootGateDone = true;
    const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
    const c = document.querySelector('.cls-card'); if (c) c.click();
    const m = document.getElementById('class-select-modal'); if (m) m.style.display = 'none';
    if (++n > 150) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); }));
await page.evaluate(() => { try { loadMap('sauroSlope'); } catch (e) {} });
await page.waitForTimeout(1500);

// ---------- 1. Horncap holds its shot while dashing -------------------------
const r1 = await page.evaluate(async () => {
  const out = {};
  game.monsters = [];
  spawnMonster(Math.round(player.x) + 200, player.y - 20, 'horny', false);
  const m = game.monsters[0];
  m.hp = m.currentHp = 1e6; m.aggroTarget = true;
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 60) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  const count = () => game.projectiles.filter((p) => p.skill === 'mhornshot').length;
  // dash live + shot ripe: nothing may fire
  m.shootTimer = -1; m._dashCharging = 280; m.vx = -6;
  const before = count();
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; m._dashCharging = 280; m.shootTimer = Math.min(m.shootTimer, -1);
    if (++n > 25) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  out.firedWhileDashing = count() - before;
  // dash over: the ripe shot goes out
  m._dashCharging = 0; m.shootTimer = -1;
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false; if (++n > 30) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  out.firedAfterDash = count() - before;
  game.monsters = []; game.projectiles = [];
  return out;
});
ok('Horncap holds its horn while dashing (the "weird dash sprite")',
  r1.firedWhileDashing === 0, r1);
ok('...and the ripe shot fires normally once the dash ends',
  r1.firedAfterDash >= 1, r1);

// ---------- 2. the advancement quest names its giver ------------------------
const r2 = await page.evaluate(() => {
  const out = {};
  player.cls = 'rogue'; player.level = 20;
  if (typeof _ensureQuests === 'function') _ensureQuests();
  if (typeof tickQuestUnlocks === 'function') tickQuestUnlocks();
  out.label = (typeof _lxQuestNpcLabel === 'function') ? _lxQuestNpcLabel(QUESTS.q_inner_dim_trial) : null;
  const mk = (name) => { const fake = { name }; const r = (typeof _npcQuestMarker === 'function') ? _npcQuestMarker(fake) : null; return r ? r.rank : 0; };
  out.taigaRank = mk('Taiga');          // the rogue's instructor: gold offer marker
  out.willRank = mk('Will');            // the warrior's instructor: nothing, wrong class
  player.cls = 'warrior';
  const fake2 = { name: 'Will' };
  out.willRankAsWarrior = (typeof _npcQuestMarker === 'function') ? ((_npcQuestMarker(fake2) || {}).rank || 0) : 0;
  player.cls = 'rogue';
  return out;
});
ok('the journal pill names the rogue\'s own instructor and map',
  r2.label === 'Taiga — the Shadow-Woven Hood', r2);
ok('Taiga carries the gold marker for a Lv-20 rogue; Will does not',
  r2.taigaRank === 2 && r2.willRank === 0, r2);
ok('...and Will lights up the moment the class is warrior',
  r2.willRankAsWarrior === 2, r2);

// ---------- 3. Mirror Self: stats + Judgement -------------------------------
const r3 = await page.evaluate(async () => {
  const out = {};
  game.monsters = [];
  spawnMonster(Math.round(player.x) + 60, player.y - 20, 'mirrorSelf', true);
  const m = game.monsters[0];
  out.hp = m.maxHp || m.hp; out.evasion = m.evasion; out.speed = m.speed;
  // enough HP that the Mirror's ordinary kit cannot kill the probe mid-window
  // (a prior run died to contact damage before the Judgement resolved and
  // read as 100% taken with MP untouched)
  player.level = 30; player.hp = 200000; player.maxHp = 200000; player.mp = 300; player.maxMp = 300;
  player._god = false; player.invulnerable = 0;
  // force the judgement: cooldown about to expire, player point-blank
  m._judgeCd = 950; m._judgeWarned = false;
  let warned = false;
  const origToast = window.showToast;
  window.showToast = function (msg) { if (/JUDGEMENT charging/.test(String(msg))) warned = true; return origToast.apply(this, arguments); };
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false;
    player.x = m.x - 60; player.vx = 0; player.invulnerable = 0;
    if (++n > 90) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  window.showToast = origToast;
  out.warned = warned;
  out.hpAfter = player.hp; out.mpAfter = player.mp;
  out.tookPct = Math.round((200000 - player.hp) / 200000 * 100);
  // OHKO clamp: at 2 HP the judgement may not kill
  player.hp = 2; player.mp = 300; player.invulnerable = 0; m._judgeCd = 60; m._judgeWarned = true;
  await new Promise((res) => { let n = 0; const t = () => { game.paused = false;
    player.x = m.x - 60; player.invulnerable = 0;
    if (++n > 40) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  out.aliveAfterClamp = player.hp >= 1;
  game.monsters = [];
  player.hp = player.maxHp;
  return out;
});
ok('Mirror Self hp comes from the stats table at ~288000 (+35%, spawn variance on top)',
  r3.hp >= 275000 && r3.hp <= 305000, { hp: r3.hp, was: 213116 });
ok('...evasion 190 and speed 3.5 from the literal',
  r3.evasion === 190 && Math.abs(r3.speed - 3.5) < 0.01, { evasion: r3.evasion, speed: r3.speed });
ok('MIRROR JUDGEMENT telegraphs, then takes ~70% max HP and ALL the MP',
  r3.warned && r3.mpAfter <= 6 && r3.tookPct >= 40 && r3.tookPct <= 88,   // mp is zeroed AT impact; passive regen trickles 1-3 back before this read
  { warned: r3.warned, tookPct: r3.tookPct + '%', mpAfter: r3.mpAfter,
    note: 'DEF lessens the 70%, then _diffDmg difficulty scaling raises it - the same two dials as the class burst, hence the wide band' });
ok('...and the OHKO clamp keeps a 2-HP player alive',
  r3.aliveAfterClamp === true, { alive: r3.aliveAfterClamp });

// ---------- 4. the Ticket Rush chain has no dead-ends -----------------------
// openNPC is the real dialog entry (the first cut called a nonexistent
// openDialog and read empty options from a dialog that never opened)
const openMilo = async () => {
  await page.evaluate(() => { window._dlgErr = null; try { openNPC({ name: 'Milo', role: 'usher' }); } catch (e) { window._dlgErr = String(e).slice(0, 90); } });
  await page.waitForTimeout(250);
  return page.evaluate(() => {
    const opts = [...document.querySelectorAll('#dialog-options button')].map((x) => x.textContent.trim());
    const txt = (document.getElementById('dialog-text') || {}).textContent || '';
    try { if (typeof closeDialog === 'function') closeDialog(); } catch (e) {}
    return { opts, txt: txt.slice(0, 60), err: window._dlgErr };
  });
};
const r4 = await page.evaluate(() => {
  // the screenshot state: part 1 completed, unlocked flags DRIFTED (deleted),
  // player parked in the PQ lobby at the minimum entry level
  player.level = 29;
  if (typeof _ensureQuests === 'function') _ensureQuests();
  const Q = player.quests;
  Q.completed = {}; Q.active = {}; Q.unlocked = {};
  Q.completed.q_clockwork_underpass = Date.now();
  return { lv: player.level };
});
await page.evaluate(() => { try { loadMap('clockworkUnderpassLobby'); } catch (e) {} });
await page.waitForTimeout(900);
const d1 = await openMilo();
ok('LOBBY, part 1 done, drifted flags, Lv 29: Milo offers Stage 2',
  d1.opts.some((t) => /Begin Stage 2/.test(t)), d1);

await page.evaluate(() => { player.quests.completed.q_pq_spire = Date.now(); player.quests.unlocked = {}; });
const d2 = await openMilo();
ok('...Spire done too: Milo offers Stage 3 IN the PQ map (used to be town-only)',
  d2.opts.some((t) => /Begin Stage 3/.test(t)), d2);

await page.evaluate(() => { player.quests.completed.q_pq_carriage = Date.now(); player.quests.unlocked = {}; });
const d3 = await openMilo();
ok('...Carriage done: Milo offers the Stage 4 duel',
  d3.opts.some((t) => /Begin Stage 4|Master Conductor/.test(t)), d3);

await page.evaluate(() => { try { loadMap('town'); } catch (e) {} });
await page.waitForTimeout(900);
await page.evaluate(() => { player.quests.completed = { q_clockwork_underpass: Date.now() }; player.quests.active = {}; player.quests.unlocked = {}; });
const d4 = await openMilo();
ok('TOWN, same drifted state: Stage 2 offered there too',
  d4.opts.some((t) => /Begin Stage 2/.test(t)), d4);

const r5 = await page.evaluate(() => ({
  s2: QUESTS.q_pq_spire.levelReq, s3: QUESTS.q_pq_carriage.levelReq, s4: QUESTS.q_pq_finale.levelReq,
  entry: QUESTS.q_clockwork_underpass.levelReq }));
ok('no stage out-levels the entry any more (29/29/29/29)',
  r5.entry === 29 && r5.s2 === 29 && r5.s3 === 29 && r5.s4 === 29, r5);

ok('no page errors', errs.length === 0, { errs: errs.slice(0, 3) });

await b.close(); srv.kill();
let pass = 0;
for (const t of results) {
  console.log((t.pass ? '  PASS  ' : '  FAIL  ') + t.n);
  if (!t.pass) console.log('        ' + JSON.stringify(t.x));
  if (t.pass) pass++;
}
console.log('\n' + pass + '/' + results.length + ' checks passed');
process.exit(pass === results.length ? 0 : 1);
