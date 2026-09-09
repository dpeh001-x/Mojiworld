// Live test: EXPEDITION DIFFICULTY — Easy / Normal / Hard, chosen at Bravo.
//
// Per user: "For expedition mode can select difficulty level easy (Stats at 0.6x), normal
// (current), hard (Stats at 1.5x) and tailor the EXP gain and rewards accordingly", "this can
// be done while taking to bravo NPC", "change the wording to join seeded to join with a friend".
//
// The claims worth pinning, in the order they can break:
//   NO-OP     Normal is 1.00 in both columns, so it must be byte-identical to the mode before
//             this shipped - and a legacy run with no difficulty stamped must resolve to it.
//   STATS     0.6x / 1.5x reaches the floor mobs AND both tower bosses. Bosses are the easy
//             thing to forget, and forgetting them makes Hard a longer walk to the same fight.
//   REWARDS   0.50x / 1.75x reaches every payout: per-floor EXP, the clear bonus, mob EXP,
//             the completion coins and the setshards. A partial multiplier is the failure mode.
//   FROZEN    the pick is stamped on the run, not read live - otherwise Easy for nine floors
//             then Hard at Bravo collects the premium for a descent nobody made.
//   BRAVO     the submenu exists, selecting sticks, and the seeded option is reworded.
//   node scripts/expedition_difficulty_test.mjs      (MOJI_GAME_FILE serves a staged build)
import { chromium } from 'playwright-core';
import { existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const GAME = process.env.MOJI_GAME_FILE ? path.resolve(ROOT, process.env.MOJI_GAME_FILE) : path.join(ROOT, 'mojiworld_game.html');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS  ' : 'FAIL  ') + n + (x ? '  ' + x : '')); };
const near = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 0.02 : tol) * Math.abs(b || 1);

// ---- the source, for the things that are structural ---------------------------
const src = readFileSync(GAME, 'utf8').replace(/\r\n/g, '\n');
ok('the old "Begin a seeded run" wording is gone', !/Begin a seeded run/.test(src));
ok('Bravo offers to join a friend\'s descent instead', /Join a friend&#39;s descent|Join a friend\\'s descent/.test(src));
ok('the modal is retitled for it', /Join a Friend&rsquo;s Descent/.test(src));
ok('the pick survives a reload (it is in GAME_SAVE_FIELDS)', /'_expeditionDifficulty',/.test(src));
ok('the coin payout is multiplied at the call site', /_lxExpeditionCoinReward\(player\.level \|\| 1\) \* _dR\.reward/.test(src));
ok('the setshard bundle is multiplied too', /Math\.floor\(Math\.random\(\) \* 11\)\) \* _dR\.reward\)/.test(src));

const free = (p) => new Promise((r) => { const s = net.createServer(); s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT; for (let p = 8961; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1800));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof game === 'object' && typeof _expeditionScaleMob === 'function' && typeof loadMap === 'function', null, { timeout: 180000 });
await page.evaluate(() => new Promise((res) => { let n = 0;
  const t = () => { window._lxBootGateDone = true; try { _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const o = document.getElementById(id); if (o) o.style.display = 'none'; }
    const c = document.querySelector('.cls-card'); if (c) c.click();
    if (++n > 150) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); }));
await page.waitForTimeout(1200);

// ---- the table + the mob scaler ----------------------------------------------
const T = await page.evaluate(() => {
  const out = {};
  out.table = JSON.parse(JSON.stringify(LX_EXPEDITION_DIFFICULTY));
  const mob = (diff) => {
    game.currentMap = 'tower_b1';
    game.expedition = { active: true, floor: 1 };
    if (diff !== undefined) game.expedition.difficulty = diff;
    const m = { level: 20, isBoss: false, maxHp: 1, currentHp: 1, atk: 1, def: 1, exp: 1 };
    _expeditionScaleMob(m, 60);
    return { hp: m.maxHp, atk: m.atk, def: m.def, exp: m.exp, lv: m.level };
  };
  out.legacy = mob(undefined);          // a run stamped by an older build
  out.normal = mob('normal');
  out.easy = mob('easy');
  out.hard = mob('hard');
  out.bogus = mob('impossible');        // a corrupt save must not brick the scaler
  // FROZEN: the run's difficulty is what was stamped, never what the menu says now
  game.expedition = { active: true, floor: 9, difficulty: 'easy' };
  game._expeditionDifficulty = 'hard';
  out.frozenKey = _lxExpDiff().key;
  out.pickKey = _lxExpDiffPick().key;
  return out;
});
const D = T.table;
ok('the three difficulties carry the stat dial the user asked for',
  D.easy.stat === 0.6 && D.normal.stat === 1 && D.hard.stat === 1.5,
  `easy ${D.easy.stat} / normal ${D.normal.stat} / hard ${D.hard.stat}`);
ok('Normal is a true no-op - 1.00 in BOTH columns', D.normal.stat === 1 && D.normal.reward === 1);
ok('a legacy run with no difficulty stamped plays exactly as Normal',
  JSON.stringify(T.legacy) === JSON.stringify(T.normal), JSON.stringify(T.legacy));
ok('a corrupt difficulty falls back to Normal rather than breaking the scaler',
  JSON.stringify(T.bogus) === JSON.stringify(T.normal), JSON.stringify(T.bogus));
ok('Easy mobs are 0.6x on HP, ATK and DEF',
  near(T.easy.hp, T.normal.hp * 0.6) && near(T.easy.atk, T.normal.atk * 0.6) && near(T.easy.def, T.normal.def * 0.6),
  `hp ${T.easy.hp}/${T.normal.hp}  atk ${T.easy.atk}/${T.normal.atk}  def ${T.easy.def}/${T.normal.def}`);
ok('Hard mobs are 1.5x on HP, ATK and DEF',
  near(T.hard.hp, T.normal.hp * 1.5) && near(T.hard.atk, T.normal.atk * 1.5) && near(T.hard.def, T.normal.def * 1.5),
  `hp ${T.hard.hp}/${T.normal.hp}  atk ${T.hard.atk}/${T.normal.atk}  def ${T.hard.def}/${T.normal.def}`);
ok('the EXP a mob drops follows the REWARD column, not the stat one',
  near(T.easy.exp, T.normal.exp * 0.5) && near(T.hard.exp, T.normal.exp * 1.75),
  `easy ${T.easy.exp} / normal ${T.normal.exp} / hard ${T.hard.exp}`);
ok('difficulty does not disturb the level a mob is built to',
  T.easy.lv === T.normal.lv && T.hard.lv === T.normal.lv, `lv ${T.normal.lv}`);
ok('the run keeps the difficulty it started with, whatever the menu now says',
  T.frozenKey === 'easy' && T.pickKey === 'hard', `run ${T.frozenKey}, menu ${T.pickKey}`);

// ---- both tower bosses --------------------------------------------------------
// MEASURED WITH Math.random PINNED, which makes the spawn exactly reproducible.
//
// It is not reproducible otherwise, and that cost two rounds of this test to work out. Boss
// stats vary per spawn despite spawnMonster explicitly exempting bosses from its own variance
// roll (_varHp = isBoss ? 1): four raw Arbiter spawns came back 17,305 / 18,037 / 17,385 /
// 17,478 HP with monsterTypes.towerArbiter.hp fixed at 58,000 the whole time. The culprit is
// _lxApplyStatTable, which overwrites the statline from LX_MONSTER_STATS through an
// LX_MONSTER_JITTER roll and never consults the isBoss flag it is handed. A first cut of this
// test compared one sample per difficulty and read 1.575 where the multiplier is 1.50 - noise
// wearing the shape of a bug. A second cut took medians over five spawns, which was slow and
// still flaked once. Pinning Math.random to 0.5 makes jit() return exactly 1, so the ratios can
// be asserted outright; the control below proves the pin actually took.
const B = await page.evaluate(async () => {
  const frames = (n) => new Promise((res) => { let i = 0; const t = () => { game.paused = false; if (++i >= n) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); });
  try { loadMap('forest'); } catch (e) {}          // any map with real mapData; the tower entry
  await frames(20);                                 // hook would spawn a second boss of its own
  player.level = 60;
  const _rand = Math.random;
  Math.random = () => 0.5;                          // jit() = 1 + (0.5*2-1)*J = 1, exactly neutral
  const boss = async (slot, diff) => {
    game.expedition = { active: true, floor: slot === 'mid' ? 5 : 10, difficulty: diff };
    game.monsters = [];
    _expeditionSpawnTowerBoss(slot);
    await new Promise((r) => setTimeout(r, 1400));
    const m = (game.monsters || []).find((x) => x && x._expeditionBoss);
    return m ? { hp: m.maxHp, atk: m.atk, def: m.def, exp: m.exp, lv: m.level } : null;
  };
  const out = {};
  out.midNormal = await boss('mid', 'normal');
  out.midControl = await boss('mid', 'normal');     // same difficulty, must come back identical
  out.midEasy = await boss('mid', 'easy');
  out.midHard = await boss('mid', 'hard');
  out.finNormal = await boss('final', 'normal');
  out.finHard = await boss('final', 'hard');
  Math.random = _rand;
  game.monsters = [];
  return out;
});
const ratio = (x, y) => (y ? x / y : 0);
ok('the B5 Arbiter spawns for the measurement', !!B.midNormal, B.midNormal ? `hp ${B.midNormal.hp}` : 'no boss');
ok('CONTROL: with the roll pinned, two Normal spawns are byte-identical',
  B.midControl && JSON.stringify(B.midControl) === JSON.stringify(B.midNormal),
  B.midControl ? `${B.midControl.hp} vs ${B.midNormal.hp}` : '');
ok('the Arbiter takes the difficulty on HP, ATK and DEF',
  B.midEasy && B.midHard && near(ratio(B.midEasy.hp, B.midNormal.hp), 0.6) && near(ratio(B.midHard.hp, B.midNormal.hp), 1.5)
    && near(ratio(B.midEasy.atk, B.midNormal.atk), 0.6) && near(ratio(B.midHard.atk, B.midNormal.atk), 1.5)
    && near(ratio(B.midEasy.def, B.midNormal.def), 0.6) && near(ratio(B.midHard.def, B.midNormal.def), 1.5),
  B.midEasy ? `hp x${ratio(B.midEasy.hp, B.midNormal.hp).toFixed(3)} / x${ratio(B.midHard.hp, B.midNormal.hp).toFixed(3)}  atk x${ratio(B.midEasy.atk, B.midNormal.atk).toFixed(3)} / x${ratio(B.midHard.atk, B.midNormal.atk).toFixed(3)}` : '');
ok('the B10 Sovereign takes it too - Hard is not a longer walk to the same apex',
  B.finNormal && B.finHard && near(ratio(B.finHard.hp, B.finNormal.hp), 1.5) && near(ratio(B.finHard.atk, B.finNormal.atk), 1.5),
  B.finNormal ? `hp x${ratio(B.finHard.hp, B.finNormal.hp).toFixed(3)}  atk x${ratio(B.finHard.atk, B.finNormal.atk).toFixed(3)}` : 'no boss');
ok('boss EXP follows the reward column, not the stat one',
  B.midHard && near(ratio(B.midHard.exp, B.midNormal.exp), 1.75) && near(ratio(B.midEasy.exp, B.midNormal.exp), 0.5),
  B.midHard ? `easy x${ratio(B.midEasy.exp, B.midNormal.exp).toFixed(3)} / hard x${ratio(B.midHard.exp, B.midNormal.exp).toFixed(3)}` : '');
ok('difficulty does not move the boss level (still player + 10)',
  B.midEasy && B.midHard && B.midEasy.lv === B.midNormal.lv && B.midHard.lv === B.midNormal.lv,
  B.midNormal ? `lv ${B.midNormal.lv}` : '');

// ---- the payouts, end to end --------------------------------------------------
const R = await page.evaluate(async () => {
  const _rand = Math.random;
  Math.random = () => 0.4;      // < 0.50 so the setshard bundle always drops; > 0.05 so no title
  const _lvUp = window._maybeLevelUp;
  window._maybeLevelUp = () => {};   // see above: let player.exp accumulate as a raw total
  const run = (diff, lv) => {
    player.level = lv; player.exp = 0; player.mojicoins = 0; player.setshards = 0;
    game.currentMap = 'tower_b10';
    game.expedition = { active: true, floor: 10, difficulty: diff, seed: 1, seedCode: 'TEST',
      snapshot: null, _expPaidFloors: {}, _baselineBoonCount: (player.boons || []).length | 0,
      _baselineEquipCount: (player.boonsEquipped || []).length | 0 };
    _completeExpedition();
    return { exp: player.exp | 0, coins: player.mojicoins | 0, shards: player.setshards | 0 };
  };
  const out = { n60: run('normal', 60), e60: run('easy', 60), h60: run('hard', 60),
                n200: run('normal', 200), h200: run('hard', 200) };
  Math.random = _rand;
  window._maybeLevelUp = _lvUp;
  game.expedition = { active: false, floor: 0, bravoReady: false, currentQuest: null };
  return out;
});
ok('a full clear pays EXP scaled by the reward column',
  near(R.e60.exp, R.n60.exp * 0.5, 0.03) && near(R.h60.exp, R.n60.exp * 1.75, 0.03),
  `easy ${R.e60.exp} / normal ${R.n60.exp} / hard ${R.h60.exp}`);
ok('completion mojicoins scale with it',
  near(R.e60.coins, R.n60.coins * 0.5, 0.03) && near(R.h60.coins, R.n60.coins * 1.75, 0.03),
  `easy ${R.e60.coins} / normal ${R.n60.coins} / hard ${R.h60.coins}`);
ok('the setshard bundle scales with it',
  R.e60.shards < R.n60.shards && R.h60.shards > R.n60.shards,
  `easy ${R.e60.shards} / normal ${R.n60.shards} / hard ${R.h60.shards}`);
ok('the coin CAP is per-difficulty: Hard clears the Normal ceiling instead of tying with it',
  R.n200.coins === 6000 && R.h200.coins === 10500,
  `normal ${R.n200.coins} (cap 6000) vs hard ${R.h200.coins}`);

// ---- Bravo's card -------------------------------------------------------------
// Three separate claims: the difficulty is a TAB STRIP above the speech (not an answer button),
// the rulebook lives behind "Find out more" and answers in place, and the whole card FITS ON
// SCREEN. The last one is the regression guard that matters: the panel is bottom-anchored and
// content-sized, so before this it grew upward until the NPC's name and the difficulty strip
// were both off the top of the window - the control the player was there to set, invisible.
const M = await page.evaluate(async () => {
  const out = {};
  const optLabels = () => [...document.querySelectorAll('#dialog-options button')].map((b) => b.textContent);
  const tabs = () => [...document.querySelectorAll('#dialog-tabs button')];
  const click = (frag) => { const b = [...document.querySelectorAll('#dialog-options button')].find((x) => x.textContent.indexOf(frag) >= 0); if (b) { b.click(); return true; } return false; };
  const clickTab = (frag) => { const b = tabs().find((x) => x.textContent.indexOf(frag) >= 0); if (b) { b.click(); return true; } return false; };
  const box = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom) }; };
  player.level = Math.max(player.level | 0, (typeof EXPEDITION_LEVEL_GATE === 'number' ? EXPEDITION_LEVEL_GATE : 20) + 5);
  game.expedition = { active: false, floor: 0, bravoReady: false, currentQuest: null };
  game._expeditionDifficulty = 'normal'; game._expInfo = null;
  const npc = { x: 0, y: 0, name: 'Bravo', role: 'expedition', color: '#ffb0d8' };
  openNPC(npc);
  await new Promise((r) => setTimeout(r, 400));
  out.firstOpts = optLabels();
  out.firstTabs = tabs().map((b) => ({ t: b.textContent, on: b.getAttribute('aria-checked'), role: b.getAttribute('role') }));
  // the card has to be entirely on screen, with the strip and the header visible
  out.fit = { vh: window.innerHeight, dialog: box('#dialog'), header: box('#dialog .dialog-header'),
              tabs: box('#dialog-tabs'), opts: box('#dialog-options') };
  const t = document.getElementById('dialog-text');
  out.proseCapped = !!t.style.maxHeight && t.style.maxHeight !== 'none';
  // one click on the strip switches it
  out.tabSwitched = clickTab('Hard');
  await new Promise((r) => setTimeout(r, 300));
  out.prefAfter = game._expeditionDifficulty;
  out.tabsAfter = tabs().map((b) => b.getAttribute('aria-checked'));
  out.optsAfter = optLabels();
  // find out more
  out.openedInfo = click('Find out more');
  await new Promise((r) => setTimeout(r, 250));
  out.infoOpts = optLabels();
  out.tabsOnInfo = tabs().length;
  out.pickedTopic = click('What you keep');
  await new Promise((r) => setTimeout(r, 250));
  out.topicText = document.getElementById('dialog-text').innerText || '';
  out.optsCountAfterTopic = optLabels().length;
  out.backed = click('Back to the portal');
  await new Promise((r) => setTimeout(r, 250));
  out.afterBack = optLabels();
  click('Maybe later');
  return out;
});
ok('the difficulty is a tab strip, not an answer button',
  M.firstTabs.length === 3 && M.firstTabs.every((t) => t.role === 'radio') && !M.firstOpts.some((t) => /enemies d+%/.test(t)),
  M.firstTabs.map((t) => t.t).join(' | '));
ok('the tabs are checkbox-style, with exactly one ticked',
  M.firstTabs.filter((t) => t.on === 'true').length === 1 && M.firstTabs.some((t) => t.t.indexOf('☑') === 0) && M.firstTabs.some((t) => t.t.indexOf('☐') === 0),
  M.firstTabs.map((t) => t.t.slice(0, 1) + t.t.slice(1, 7)).join(' | '));
ok('THE WHOLE CARD IS ON SCREEN - header and strip included',
  M.fit.header && M.fit.header.top >= 0 && M.fit.tabs.top >= 0 && M.fit.dialog.top >= 0
    && M.fit.opts.bottom <= M.fit.vh && M.fit.dialog.bottom <= M.fit.vh,
  `dialog ${M.fit.dialog.top}..${M.fit.dialog.bottom} · header top ${M.fit.header && M.fit.header.top} · strip top ${M.fit.tabs && M.fit.tabs.top} · viewport ${M.fit.vh}`);
ok('the prose is what got capped, so it scrolls instead of pushing the card off screen', M.proseCapped);
ok('ONE click on the strip switches the difficulty',
  M.tabSwitched && M.prefAfter === 'hard' && M.tabsAfter.join(',') === 'false,false,true', `pref ${M.prefAfter}`);
ok('the Begin button follows the strip', M.optsAfter.some((t) => /Begin Expedition — .*Hard/.test(t)), M.optsAfter[0]);
ok('her speech is the metaphor only - the rulebook is not in it',
  !M.firstOpts.some((t) => /Rules/.test(t)) && M.openedInfo, 'find-out-more opened: ' + M.openedInfo);
ok('"Find out more" lists the expedition section by section',
  ['The descent', 'The blessings', 'The trials', 'What you keep', 'The weight'].every((k) => M.infoOpts.some((t) => t.indexOf(k) >= 0)),
  M.infoOpts.join(' | ').slice(0, 190));
ok('a topic answers IN PLACE, so several can be read without walking back out',
  M.pickedTopic && /Roguelite rules/.test(M.topicText) && M.optsCountAfterTopic === M.infoOpts.length,
  `${M.optsCountAfterTopic} options still listed`);
ok('the strip stays reachable while reading the sections', M.tabsOnInfo === 3, `${M.tabsOnInfo} tabs`);
ok('Back returns to the portal card', M.backed && M.afterBack.some((t) => /Begin Expedition/.test(t)), M.afterBack[0]);
ok('the friend option survives the restructure',
  M.firstOpts.some((t) => /Join a friend/.test(t)) && !M.firstOpts.some((t) => /seeded run/.test(t)),
  M.firstOpts.join(' | ').slice(0, 160));

// ---- the card survives an ANSWER-IN-PLACE swap ---------------------------------
// The guard for the v0.30.489 regression. openNPC rebuilds the whole card, so measuring only
// after it proves very little: the failure mode is a follow-up that swaps the TEXT and nothing
// else. Every lore topic, the Sovereign rumour and the 51 legacy `textContent = ...` call sites
// in openNPC's role branches take that path, and for one build they all left the prose box
// uncapped - the card grew to a top of -540 with the NPC's name at -502.
const SWAP = await page.evaluate(async () => {
  const box = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom) }; };
  // ON the player: the walk-away auto-dismiss closes a dialog whose NPC is far away.
  game.expedition = { active: false, floor: 0, bravoReady: false, currentQuest: null };
  game._expInfo = null;
  try { closeDialog(); } catch (e) {}
  await new Promise((r) => setTimeout(r, 1500));   // let the post-expedition warp finish landing
  const dlgEl = document.getElementById('dialog');
  let npc = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    npc = { x: player.x, y: player.y, name: 'Bravo', role: 'expedition', color: '#ffb0d8' };
    openNPC(npc);
    await new Promise((r) => setTimeout(r, 600));
    if (dlgEl.style.display === 'block') break;
  }
  if (dlgEl.style.display !== 'block') return { err: 'could not keep a dialog open to measure' };
  const before = { dialog: box('#dialog'), header: box('#dialog .dialog-header'), tabs: box('#dialog-tabs') };
  const b = [...document.querySelectorAll('#dialog-options button')].find((x) => x.textContent.indexOf('thing at the top') >= 0);
  if (!b) return { err: 'no rumour option' };
  b.click();
  await new Promise((r) => setTimeout(r, 900));
  const t = document.getElementById('dialog-text');
  return { before, after: { dialog: box('#dialog'), header: box('#dialog .dialog-header'), tabs: box('#dialog-tabs') },
           capped: !!t.style.maxHeight && t.style.maxHeight !== 'none', locked: !!t.style.height,
           openAfter: document.getElementById('dialog').style.display === 'block',
           vh: window.innerHeight };
});
ok('an answer-in-place swap keeps the card on screen', !SWAP.err && SWAP.openAfter
  && SWAP.after.dialog.bottom > 0
  && SWAP.after.dialog.top >= 0 && SWAP.after.header.top >= 0 && SWAP.after.tabs.top >= 0
  && SWAP.after.dialog.bottom <= SWAP.vh,
  SWAP.err || `after the swap: dialog ${SWAP.after.dialog.top}..${SWAP.after.dialog.bottom} · header ${SWAP.after.header.top} · strip ${SWAP.after.tabs.top} · viewport ${SWAP.vh}`);
ok('...and the prose is still both capped and locked, so the box cannot creep',
  SWAP.capped && SWAP.locked, `max-height set: ${SWAP.capped}, height set: ${SWAP.locked}`);
ok('...and the card does not jump when the text changes',
  SWAP.before && Math.abs(SWAP.after.dialog.top - SWAP.before.dialog.top) <= 2,
  SWAP.before ? `top ${SWAP.before.dialog.top} -> ${SWAP.after.dialog.top}` : '');

// ---- the rumour ---------------------------------------------------------------
const RUM = await page.evaluate(async () => {
  const npc = { x: 0, y: 0, name: 'Bravo', role: 'expedition', color: '#ffb0d8' };
  game.expedition = { active: false, floor: 0, bravoReady: false, currentQuest: null };
  openNPC(npc);
  const b = [...document.querySelectorAll('#dialog-options button')].find((x) => x.textContent.indexOf('the thing at the top') >= 0);
  if (!b) return { err: 'no rumour option' };
  b.click();
  await new Promise((r) => setTimeout(r, 250));
  return { text: document.getElementById('dialog-text').innerText || '' };
});
ok('the rumour option still opens', !RUM.err && RUM.text.length > 200, RUM.err || `${RUM.text.length} chars`);
ok('it no longer tells the player who they had been talking to', !/talking to Innie/i.test(RUM.text || ''));
ok('it no longer names the old man in the plaza, which was the answer', !/old man in the plaza/i.test(RUM.text || ''));
ok('the detail that carries the whole thing survives',
  /It watches your hands/.test(RUM.text || '') && /does not attack while you are still deciding/.test(RUM.text || ''));
ok('and the resemblance is left for the player to make',
  /one other thing that does that/.test(RUM.text || '') && /not in the tower/.test(RUM.text || ''));
ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));

await b.close(); srv.kill();
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exitCode = fail ? 1 : 0;
