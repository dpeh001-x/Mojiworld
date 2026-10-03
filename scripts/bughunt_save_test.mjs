// BUG HUNT 2026-10-02 - the `save` cluster (save-1..10, diff-b-4/5, systems-1/3/6/7/8, world-4/5/6, ui-3, L2e).
// One page, direct calls. Sections (each prints PASS/FAIL lines; BASE = the build before, FIX = this one):
//   A. the ls4 generation (save-1 / save-5 / save-9 / diff-b-5): the shipped ls3 lists are byte-identical, ls4 = ls3 + the new
//      keys, the WRITER is still ls3 (one constant, flipped here to test ls4), every old-save shape still loads, an ls4 marker
//      rolls back an edited Tower run and every signed ledger, and a tagged marker refuses an older-generation replay.
//   B. D2 (save-4 / diff-b-4): the legacy-save allowance is closed (stripped / junk-marker saves are refused, kept in Backups).
//   C. save-1 stop-gap: an edited `game.expedition.snapshot` cannot raise the wallet / bank, its items are repaired.
//   D. save-2 / save-3 / save-6 / save-7 / save-8 / save-10, E. systems-1/3/6/7/8, F. world-4/5/6, ui-3, L2e.
//   [MOJI_GAME_FILE=scripts/_tmp_x.html] [PORT=13985] node scripts/bughunt_save_test.mjs
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 13985), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 420) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
// the ls3 lists as v0.30.1604 shipped them: never edited again (save-9). The test pins them literally.
const PK3 = ['cls', 'job', 'master', 'level', 'exp', 'expToNext', 'mojicoins', 'bankBalance', 'bankAccrueMs', 'setshards', 'skillPoints', 'skillRankPoints', 'skillRanks', 'baseAtk', 'baseDef', 'baseAcc', 'baseCrit', 'baseSpeed', 'baseJump', 'maxHp', 'maxMp', 'equipped', 'inventory', 'consumables', 'talents', 'boons', 'boonsEquipped', 'prestige', 'quests', '_pqChainRuns', '_pqStagePaid', '_downPending'];
const GK2 = ['boonDex', '_bossKills', 'bossDefeated', '_bossDefeatedAt', '_playMs', 'kills', 'dexMilestones', 'dexPerm', 'prestige', 'bossRushBest', '_bossRushRewardDay', '_chestCooldown'];
const GK3 = GK2.concat(['achievements', 'comboRecord', 'duoTrials', '_steamAchBaseline', '_importVerdict', '_devTouched']);
const PK4X = ['_levelUpSpent', '_trainerSpent', 'claimedMilestones', 'mastery', '_qBank', '_sageNextAt', 'treeUnlocked', 'tree', 'invCap', '_cdCarry'];
const GK4X = ['expedition', 'dailyState', '_dailyMilesPaid', '_dailyBestStreak', '_timeHW'];
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof loadState === 'function' && typeof _lxLocalSaveVerdict === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  await page.evaluate(() => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player.level = 60; player._tutorialSeen = true; player._storyBeatsSeen = new Proxy({}, { get: () => true, set: () => true });
    window.saveState = () => {};   // only the explicit flushes write
    window.__notes = []; window._lxSaveNotice = (msg) => { window.__notes.push(String(msg)); };
    // the harness helpers every section shares
    window.__KEY = SAVE_KEY; window.__MK = SAVE_KEY + '_verified';
    window.__snap = () => ({ raw: localStorage.getItem(__KEY), mark: localStorage.getItem(__MK) });
    window.__put = (raw, mark) => { localStorage.setItem(__KEY, raw); if (mark == null) localStorage.removeItem(__MK); else localStorage.setItem(__MK, mark); };
    window.__load = (obj, mark) => {   // store `obj` (+ marker), reset the player to garbage, loadState, report
      __put(typeof obj === 'string' ? obj : JSON.stringify(obj), mark);
      player.level = 1; player.setshards = -1; player.mojicoins = -1; player.inventory = []; player.mastery = { garbage: 1 }; player._levelUpSpent = { garbage: 1 };
      game._saveVerdict = null; let r; try { r = loadState(); } catch (e) { r = 'threw ' + e.message; }
      return { loaded: r, verdict: game._saveVerdict, lv: player.level, shards: player.setshards, coins: player.mojicoins, bank: player.bankBalance, mastery: JSON.stringify(player.mastery), lus: JSON.stringify(player._levelUpSpent), exp: game.expedition ? JSON.stringify(game.expedition).slice(0, 200) : null };
    };
  });
  // ---------------------------------------------------------------- A. the generations
  const A = await page.evaluate(async () => {
    const out = {}, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    out.hasWriter = (typeof LX_SAVE_SIG_WRITE !== 'undefined');
    out.writer = out.hasWriter ? LX_SAVE_SIG_WRITE : null;
    out.lists = { pk: JSON.stringify(_LX_SIGNED_PLAYER_KEYS), gk: JSON.stringify(_LX_SIGNED_GAME_KEYS), gk3: JSON.stringify(_LX_SIGNED_GAME_KEYS3),
      pk4: (typeof _LX_SIGNED_PLAYER_KEYS4 !== 'undefined') ? JSON.stringify(_LX_SIGNED_PLAYER_KEYS4) : null, gk4: (typeof _LX_SIGNED_GAME_KEYS4 !== 'undefined') ? JSON.stringify(_LX_SIGNED_GAME_KEYS4) : null };
    // a rich honest state: ledgers, a tree, caps, a daily, an idle Tower object
    player.setshards = 1234; player.mojicoins = 55555; player.bankBalance = 777;
    player.mastery = { slime: 77, snail: 12 }; player._levelUpSpent = { acc: 4, atk: 2 }; player._trainerSpent = { atk: 1, def: 0, hp: 0 };
    player.claimedMilestones = { slime_100: true }; player.treeUnlocked = { a: true }; player._sageNextAt = 123456789;
    game.dailyState = { day: dailyIndex(), streak: 3, challenge: 'kill10', progress: 2, claimed: false, seenMaps: [], seenNpcs: [] };
    game._dailyMilesPaid = { 14: 99 }; game._dailyBestStreak = 3;
    game.expedition = { active: false, floor: 0, bravoReady: false, currentQuest: null };
    const gen = (w) => { if (out.hasWriter) LX_SAVE_SIG_WRITE = w; _flushSaveStateNow(); return __snap(); };
    const s3 = gen(3); out.raw3 = s3.raw; out.mark3 = s3.mark;
    const base3 = JSON.parse(s3.raw), m3 = JSON.parse(s3.mark);
    out.mark3Shape = { tag: m3.tag === undefined, keys: Object.keys(m3).sort().join(','), verifies3: _lxSigEqual(_lxHmacSaveHex('ls3\n' + m3.v + '\n' + m3.t + '\n' + m3.p + '\n' + m3.g), m3.sig), sigIsSave: m3.sig === base3.sig };
    out.verdictsOwn = { strictFalse: _lxLocalSaveVerdict(base3), strictTrue: _lxLocalSaveVerdict(base3, true) };
    // ls2 / ls3 / ls4 bodies of the SAME save
    const sig = (body) => _lxHmacSaveHex(body);
    const withSig = (o, body) => { const c = JSON.parse(JSON.stringify(o)); c.sig = sig(body(c)); return c; };
    const has4 = typeof _lxLocalSaveSigBody4 === 'function';
    const sv2 = withSig(base3, _lxLocalSaveSigBody2), sv3 = withSig(base3, _lxLocalSaveSigBody), sv4 = has4 ? withSig(base3, _lxLocalSaveSigBody4) : null;
    out.shapes = {
      ls3: __load(sv3, null),
      ls3mark: __load(sv3, s3.mark),
      ls2: __load(sv2, null),
      ls4plain: has4 ? __load(sv4, null) : null,
      ls4w3: has4 ? __load(sv4, s3.mark) : null,
    };
    // an ls3 save from a build that predates optional keys (v0.30.917 had no _downPending / _pqStagePaid / _cdCarry)
    const old = JSON.parse(JSON.stringify(base3)); for (const k of ['_downPending', '_pqStagePaid', '_pqChainRuns', '_cdCarry']) delete old.player[k];
    out.shapes.ls3old = __load(withSig(old, _lxLocalSaveSigBody), null);
    out.shapes.ls2old = __load(withSig(old, _lxLocalSaveSigBody2), null);
    // junk / unknown tags on the marker never make an honest ls3 save fail
    const tagged = (o) => JSON.stringify(Object.assign(JSON.parse(s3.mark), o));
    out.shapes.tagJunk = __load(sv3, tagged({ tag: 'zzz' }));
    out.shapes.tagNull = __load(sv3, tagged({ tag: null }));
    // ls4 writer: flip the constant, flush, check the marker and the round trip
    if (out.hasWriter) {
      const s4 = gen(4); out.raw4 = s4.raw; out.mark4 = s4.mark;
      const b4 = JSON.parse(s4.raw), m4 = JSON.parse(s4.mark);
      out.mark4Shape = { tag: m4.tag, verifies4: _lxSigEqual(_lxHmacSaveHex('ls4\n' + m4.v + '\n' + m4.t + '\n' + m4.p + '\n' + m4.g), m4.sig), sigIsSave: m4.sig === b4.sig, verdict: _lxLocalSaveVerdict(b4, true), p4: Object.keys(JSON.parse(m4.p)).filter((k) => ['_levelUpSpent', 'mastery', 'treeUnlocked', 'invCap', '_cdCarry'].includes(k)).length, g4: Object.keys(JSON.parse(m4.g)).filter((k) => ['expedition', 'dailyState', '_timeHW'].includes(k)).length };
      out.w4 = { honest: __load(s4.raw, s4.mark), honestNoMark: __load(s4.raw, null), honestStrictOk: _lxLocalSaveVerdict(b4, true) };
      // edit EVERY ls4-only ledger in the stored save (unsigned in ls3, signed now): rolled back from the ls4 copy
      const ed = JSON.parse(s4.raw);
      ed.player.mastery = { slime: 99999 }; ed.player._levelUpSpent = { acc: 1, atk: 999 }; ed.player._trainerSpent = { atk: 999, def: 0, hp: 0 }; ed.player.claimedMilestones = {}; ed.player.treeUnlocked = { a: true, b: true, c: true, d: true };
      ed.player.invCap = { equip: 60, use: 60, etc: 60 }; ed.player._sageNextAt = 0; ed.game.dailyState = { day: 1, streak: 1, challenge: 'x', progress: 0, claimed: false }; ed.game._dailyBestStreak = 0; ed.game._timeHW = 1;
      ed.game.expedition = { active: true, floor: 5, snapshot: { mojicoins: 1e12, bankBalance: 1e12 }, _heldCoins: 5e9 };
      const r4 = __load(ed, s4.mark); r4.expAfter = game.expedition && game.expedition.active; r4.mastery2 = JSON.stringify(player.mastery); r4.tree = JSON.stringify(player.treeUnlocked); r4.daily = game.dailyState && game.dailyState.streak; r4.notes = window.__notes.length;
      out.w4.edited = r4;
      // every one of them individually (a single edited ledger must be caught, not only the lot)
      out.w4.single = {};
      for (const [k, where, val] of [['mastery', 'player', { x: 1 }], ['_levelUpSpent', 'player', { acc: 1 }], ['claimedMilestones', 'player', {}], ['_qBank', 'player', { z: 1 }], ['treeUnlocked', 'player', { q: 1 }], ['tree', 'player', { q: 1 }], ['invCap', 'player', { equip: 60 }], ['_cdCarry', 'player', { zz: 1 }], ['_sageNextAt', 'player', 5], ['_trainerSpent', 'player', { atk: 5 }],
        ['expedition', 'game', { active: true }], ['dailyState', 'game', { day: 0 }], ['_dailyMilesPaid', 'game', { 1: 1 }], ['_dailyBestStreak', 'game', 77], ['_timeHW', 'game', 5]]) {
        const e1 = JSON.parse(s4.raw); e1[where][k] = val; const r = __load(e1, s4.mark); out.w4.single[k] = r.verdict;
      }
      // strict: an ls3-signed save (an old copy replayed) next to the ls4 copy is not an old save: rolled forward to the copy
      out.w4.replay = __load(s3.raw, s4.mark);
      out.w4.replayNoMark = __load(s3.raw, null);   // ...but with no marker it is an honest older save: 'ok'
      // a tampered ls4 marker restores nothing: the edited save is refused, not trusted
      const mt = JSON.parse(s4.mark); mt.p = mt.p.replace('"warrior"', '"mage"'); const e2 = JSON.parse(s4.raw); e2.player.level = 99;
      out.w4.tamperedMark = __load(e2, JSON.stringify(mt));
      out.w4.backups = (typeof _lxGetBackups === 'function') ? ((_lxGetBackups() || [])[0] || {}).label || '' : '';
      // the ls4 save read back with the writer flipped to ls3 again (a rollback of the constant): still 'ok', and it re-signs ls3
      LX_SAVE_SIG_WRITE = 3; out.w4.backTo3 = __load(s4.raw, s4.mark);
      _flushSaveStateNow(); const s3b = __snap(); out.w4.backTo3Mark = { tag: JSON.parse(s3b.mark).tag === undefined, verdict: _lxLocalSaveVerdict(JSON.parse(s3b.raw)) };
      // an active Tower run with its snapshot, signed in ls4: cost of the flush and the round trip
      LX_SAVE_SIG_WRITE = 4;
      const bag0 = player.inventory;   // a worst-case run: 160 affixed items in the bag, so the snapshot (and the live bag) are as big as they get
      player.inventory = Array.from({ length: 160 }, (_, i) => ({ id: 'bulk' + i, name: 'Bulk Item ' + i, slot: 'weapon', rarity: 'epic', stars: 3, tier: 3, atk: 100 + i, def: 5, dropLevel: 50, affixes: [{ k: 'atk', v: i }, { k: 'crit', v: 2 }] }));
      game.expedition = { active: true, floor: 3, snapshot: _expeditionSnapshotPlayer(), _spentInRun: 10, _heldCoins: 5 };
      const t0 = performance.now(); for (let i = 0; i < 5; i++) _flushSaveStateNow(); out.w4.flushMs = (performance.now() - t0) / 5;
      const sx = __snap(); out.w4.runVerdict = _lxLocalSaveVerdict(JSON.parse(sx.raw), true); out.w4.runBytes = sx.raw.length;
      LX_SAVE_SIG_WRITE = 3; game.expedition = { active: false, floor: 0, bravoReady: false, currentQuest: null }; player.inventory = bag0;
    }
    return out;
  });
  {
    const L = A.lists;
    ok('[A1] the ls3 lists are byte-identical to what v0.30.1604 shipped (save-9: a shipped list is never edited)', L.pk === JSON.stringify(PK3) && L.gk === JSON.stringify(GK2) && L.gk3 === JSON.stringify(GK3), L);
    ok('[A1] ls4 = ls3 + exactly the new keys (the Tower run, the SP ledgers, mastery, claims, quest bank, daily state + streak ledgers, clock mark, tree, bag caps, cooldown carry, Sage timer)', L.pk4 === JSON.stringify(PK3.concat(PK4X)) && L.gk4 === JSON.stringify(GK3.concat(GK4X)), { pk4: L.pk4, gk4: L.gk4 });
    ok('[A2] the WRITER is still ls3 in this release (old Steam builds would refuse an ls4 save)', A.hasWriter && A.writer === 3 && A.mark3Shape.verifies3 && A.mark3Shape.tag && A.mark3Shape.sigIsSave, { writer: A.writer, mark: A.mark3Shape });
    ok('[A2] the ls3 marker keeps its exact shape (no tag key): t, setshards, mojicoins, bankBalance, v, p, g, sig', A.mark3Shape.keys === 'bankBalance,g,mojicoins,p,setshards,sig,t,v', A.mark3Shape);
    ok('[A3] honest ls3 saves verify "ok" with and without a marker, strict or not', A.verdictsOwn.strictFalse === 'ok' && A.shapes.ls3.verdict === 'ok' && A.shapes.ls3.loaded === true && A.shapes.ls3mark.verdict === 'ok' && A.shapes.ls3mark.mastery === '{"slime":77,"snail":12}', { own: A.verdictsOwn, a: A.shapes.ls3, b: A.shapes.ls3mark });
    ok('[A3] a save signed ls2 still loads as "legacy" (the allowance for old signatures stays)', A.shapes.ls2.verdict === 'legacy' && A.shapes.ls2.loaded === true && A.shapes.ls2.lv === 60, A.shapes.ls2);
    ok('[A3] older shapes (a save without _downPending / _pqStagePaid / _pqChainRuns / _cdCarry) verify in ls3 and ls2', A.shapes.ls3old.verdict === 'ok' && A.shapes.ls2old.verdict === 'legacy' && A.shapes.ls3old.loaded === true, { ls3old: A.shapes.ls3old, ls2old: A.shapes.ls2old });
    ok('[A3] an unknown or null tag on the marker changes nothing for an ls3 save', A.shapes.tagJunk.verdict === 'ok' && A.shapes.tagNull.verdict === 'ok', { junk: A.shapes.tagJunk, nul: A.shapes.tagNull });
    ok('[A4] the verifier accepts an ls4 signature (written by a later release) with or without a marker', A.shapes.ls4plain && A.shapes.ls4plain.verdict === 'ok' && A.shapes.ls4plain.loaded === true && A.shapes.ls4w3.verdict === 'ok', { plain: A.shapes.ls4plain, w3: A.shapes.ls4w3 });
    if (A.hasWriter) {
      const W = A.w4;
      ok('[A5] flipping the constant writes ls4: the marker is tagged ls4, signs the ls4 lists, and the save verifies strictly', A.mark4Shape.tag === 'ls4' && A.mark4Shape.verifies4 && A.mark4Shape.sigIsSave && A.mark4Shape.verdict === 'ok' && A.mark4Shape.p4 === 5 && A.mark4Shape.g4 === 3, A.mark4Shape);
      ok('[A5] an honest ls4 save loads "ok" (marker, no marker, strict)', W.honest.verdict === 'ok' && W.honest.loaded === true && W.honestNoMark.verdict === 'ok' && W.honestStrictOk === 'ok', W);
      ok('[A6] edited Tower run + every ls4-only ledger in an ls4 save: verdict "restored", all rolled back to the signed copy (mastery, SP ledger, tree, daily, expedition)', W.edited.verdict === 'restored' && W.edited.mastery === '{"slime":77,"snail":12}' && W.edited.lus === '{"acc":4,"atk":2}' && W.edited.expAfter === false && W.edited.daily === 3 && W.edited.notes >= 0, W.edited);
      const bad = Object.entries(W.single).filter(([k, v]) => v !== 'restored').map(([k, v]) => k + ':' + v);
      ok('[A6] each of the fifteen ls4 keys, edited ALONE, is caught and rolled back', bad.length === 0 && Object.keys(W.single).length === 15, { bad });
      ok('[A7] an ls3-signed save next to an ls4 copy is a replay: strict verdict "bad", rolled forward to the copy ("restored"); with no copy it is an honest older save ("ok")', A.verdictsOwn.strictTrue === 'bad' && W.replay.verdict === 'restored' && W.replayNoMark.verdict === 'ok', { replay: W.replay, noMark: W.replayNoMark });
      ok('[A7] a tampered ls4 marker cannot repair an edited save: refused, kept in Save Backups', W.tamperedMark.loaded === false && /edited, not verified/.test(W.backups), { r: W.tamperedMark, bk: W.backups });
      ok('[A8] the constant flipped back to 3: an ls4 save still loads "ok" and the next flush is a plain ls3 marker again', W.backTo3.verdict === 'ok' && W.backTo3Mark.tag && W.backTo3Mark.verdict === 'ok', { a: W.backTo3, b: W.backTo3Mark });
      ok('[A9] an ls4 save with an active Tower run (snapshot, ~' + Math.round(W.runBytes / 1024) + ' KB save) flushes in under 40 ms and verifies', W.flushMs < 40 && W.runVerdict === 'ok', { ms: W.flushMs, v: W.runVerdict });
    } else ok('[A5-A9] the ls4 generation exists', false, 'no LX_SAVE_SIG_WRITE');
  }
  // ---------------------------------------------------------------- B. D2: the legacy-save allowance is closed
  const B = await page.evaluate(async (a) => {
    const out = {}, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    if (typeof LX_SAVE_SIG_WRITE !== 'undefined') LX_SAVE_SIG_WRITE = 3;
    const raw = a.raw3, mark = a.mark3, base = JSON.parse(raw);
    const bk0 = (_lxGetBackups() || []).length;
    const ed = JSON.parse(raw); ed.player.level = 200; ed.player.setshards = 999999; ed.player.mojicoins = 5e9;
    const st = JSON.parse(JSON.stringify(ed)); delete st.sig;                                   // stripped, edited
    out.stripped = __load(st, mark);                                                          // marker present: rolled back (unchanged behaviour)
    out.strippedNoMark = __load(st, null);                                                    // _cdCarry present, no marker: refused (unchanged)
    const lg = JSON.parse(raw); delete lg.sig; delete lg.player._cdCarry; lg.player.level = 99; lg.player.setshards = 999999;   // the documented "legacy" allowance
    out.legacy = __load(lg, null); const bkAfterLegacy = (_lxGetBackups() || []).length;
    out.legacyLabel = ((_lxGetBackups() || [])[0] || {}).label || ''; out.legacyBk = bkAfterLegacy - bk0;
    const junk = (o) => __load(o, '{}');                                                      // a junk marker is not a verified copy
    const lg2 = JSON.parse(JSON.stringify(lg)); out.junkUnsigned = junk(lg2);
    const bad = JSON.parse(raw); bad.player.level = 150; bad.player.mojicoins = 7e9; out.junkBad = junk(bad);
    const old4 = JSON.stringify({ t: base.t, setshards: 1, mojicoins: 1, bankBalance: 1 });   // the pre-copy 4-field marker shape
    out.old4Unsigned = __load(lg, old4); out.old4Bad = __load(bad, old4);
    out.legacySig = __load(JSON.parse(JSON.stringify((() => { const o = JSON.parse(raw); o.sig = _lxHmacSaveHex(_lxLocalSaveSigBody2(o)); return o; })())), '{}');   // an ls2 signature next to a junk marker still loads
    out.honest = __load(raw, mark);
    await sleep(3300); out.noteRefused = window.__notes.some((n) => /could not be verified, so it was not loaded/.test(n));
    return out;
  }, { raw3: A.raw3, mark3: A.mark3 });
  ok('[B1] a stripped + edited save with a verified copy is still rolled back (unchanged)', B.stripped.loaded === true && B.stripped.verdict === 'restored' && B.stripped.lv === 60, B.stripped);
  ok('[B2] D2: a legacy save (no signature, no marker, no _cdCarry) is no longer grandfathered: refused, kept in Save Backups as "edited, not verified", and the player is told', B.legacy.loaded === false && /edited, not verified/.test(B.legacyLabel) && B.legacyBk >= 1 && B.noteRefused, { r: B.legacy, label: B.legacyLabel, bk: B.legacyBk, note: B.noteRefused });
  ok('[B3] D2 / diff-b-4: a junk marker ({}) next to an edited unsigned or edited signed save repairs nothing: both are refused', B.junkUnsigned.loaded === false && B.junkBad.loaded === false, { u: B.junkUnsigned, b: B.junkBad });
  ok('[B3] the old 4-field marker (no verified copy) is no different', B.old4Unsigned.loaded === false && B.old4Bad.loaded === false, { u: B.old4Unsigned, b: B.old4Bad });
  ok('[B4] a stripped modern save with no marker stays refused, and an ls2 signature next to a junk marker still loads ("legacy")', B.strippedNoMark.loaded === false && B.legacySig.loaded === true && B.legacySig.verdict === 'legacy', { s: B.strippedNoMark, l: B.legacySig });
  ok('[B4] an honest save with its marker is untouched by all of it', B.honest.loaded === true && B.honest.verdict === 'ok' && B.honest.lv === 60 && B.honest.shards === 1234, B.honest);
  // ---------------------------------------------------------------- C. save-1 stop-gap: the unsigned Tower snapshot
  const C = await page.evaluate(async () => {
    const out = {}; if (typeof LX_SAVE_SIG_WRITE !== 'undefined') LX_SAVE_SIG_WRITE = 3;
    const item = (id, extra) => Object.assign({ id, name: id, slot: 'weapon', rarity: 'rare', stars: 2, tier: 2, atk: 10, dropLevel: 20 }, extra || {});
    player.mojicoins = 100000; player.bankBalance = 5000; player.setshards = 1234; player.mastery = {}; player._levelUpSpent = {};
    player.inventory = [item('bag1')]; player.equipped = { weapon: item('worn', { atk: 30, rarity: 'epic' }), armor: null, accessory: null };
    const snap = _expeditionSnapshotPlayer();
    game.expedition = { active: true, floor: 2, difficulty: 'normal', snapshot: snap, _spentInRun: 3000, _heldCoins: 500, _baselineBoonCount: 0, _baselineEquipCount: 0, startLevel: 60 };
    player.mojicoins = 97000; player.inventory.push(item('loot', { _expLoot: true, atk: 99 }));
    _flushSaveStateNow(); const sv = __snap(); out.snapMoney = [snap.mojicoins, snap.bankBalance];
    out.honest = __load(sv.raw, sv.mark); out.honestInv = (player.inventory || []).map((i) => i.id).join(',');
    const edit = (fn, text) => { const e = JSON.parse(sv.raw); fn(e.game.expedition); let t = JSON.stringify(e); if (text) t = text(t); return t; };
    out.verdictUnsigned = _lxLocalSaveVerdict(JSON.parse(edit((x) => { x.snapshot.mojicoins = 1e12; })));   // ls3: `expedition` is not signed, so the signature still holds
    out.editedMoney = __load(edit((x) => { x.snapshot.mojicoins = 1e12; x.snapshot.bankBalance = 1e12; }), sv.mark);
    out.editedBank = player.bankBalance;
    out.editedHeld = __load(edit((x) => { x._heldCoins = 9e9; }), sv.mark);
    out.editedSpent = __load(edit((x) => { x._spentInRun = 2e9; }), sv.mark);   // an edit that only hurts the editor
    out.editedItems = __load(edit((x) => { x.snapshot.inventory.push({ id: 'inj', name: 'Inj"ected<b>', slot: 'weapon', rarity: 'x" onmouseover="1', stars: 'INFS', tier: 1, dropLevel: 1, atk: 'INFA' }); x.snapshot.equipped.weapon.def = 'INFD'; x.snapshot.consumables = { hp_s: 'INFC', hp_m: -5, mp_s: 3 }; },
      (t) => t.replace('"INFS"', '1e999').replace('"INFA"', '1e999').replace('"INFD"', '1e999').replace('"INFC"', '1e999')), sv.mark);
    const inj = (player.inventory || []).find((i) => i.id === 'inj') || {};
    out.inj = { rarity: inj.rarity, stars: inj.stars, atk: inj.atk, name: inj.name, wDef: player.equipped && player.equipped.weapon && player.equipped.weapon.def, cons: JSON.stringify(player.consumables), fin: Object.values(inj).every((v) => typeof v !== 'number' || Number.isFinite(v)) };
    return out;
  });
  ok('[C1] an honest interrupted run comes back right: the wallet the run left (97,000) plus its held 500; bank, bag and gear as before the run (the loot is gone)', C.honest.loaded === true && C.honest.verdict === 'ok' && C.honest.coins >= 97500 && C.honest.coins < 97500 + 300 && C.honest.bank === 5000 && C.honestInv === 'bag1', { honest: C.honest, inv: C.honestInv });
  ok('[C2] the edit leaves the signature standing (ls3 does not sign `expedition`), so the clamp is what stops it', C.verdictUnsigned === 'ok', C.verdictUnsigned);
  ok('[C2] save-1: a snapshot edited to 1e12 coins + 1e12 bank hands back no more than the verified wallet / bank', C.editedMoney.coins >= 97500 && C.editedMoney.coins < 97500 + 300 && C.editedBank === 5000, { r: C.editedMoney, bank: C.editedBank });
  ok('[C3] held rewards are capped at 1,000,000 (a real run holds well under 300,000)', C.editedHeld.coins >= 97000 + 1e6 && C.editedHeld.coins < 97000 + 1e6 + 300, C.editedHeld);
  ok('[C3] an inflated _spentInRun can only cost the editor (the snapshot cap rises with it, the restore charges it back)', C.editedSpent.coins <= 100000 && C.editedSpent.coins >= 0 && C.editedSpent.coins < 97500, C.editedSpent);
  ok('[C4] the snapshot bag gets a normal load\'s repair: rarity -> common, stars / tier finite, quotes + brackets out of the name, 1e999 stats -> 0, bad potion counts -> 0', C.inj.rarity === 'common' && C.inj.stars === 0 && C.inj.fin && !/["<>]/.test(C.inj.name || '') && C.inj.wDef === 0 && /"hp_s":0/.test(C.inj.cons) && /"hp_m":0/.test(C.inj.cons) && /"mp_s":3/.test(C.inj.cons), C.inj);

  // ---------------------------------------------------------------- D. the Tower, the forge, imports and the parcel
  const D = await page.evaluate(async () => {
    const out = {}, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    if (typeof LX_SAVE_SIG_WRITE !== 'undefined') LX_SAVE_SIG_WRITE = 3;
    const run = (extra) => { game.expedition = Object.assign({ active: true, floor: 4, snapshot: _expeditionSnapshotPlayer(), _spentInRun: 0, _heldCoins: 0, _baselineBoonCount: 0, _baselineEquipCount: 0, startLevel: 60 }, extra || {}); };
    loadMap('forest', 300); await sleep(1200); game.paused = false; player.invulnerable = 9e9;
    // save-2: a held reward survives the run's end (death, Abandon and completion share _endExpedition)
    player.mojicoins = 50000; run(); const got = _grantMojicoins(1000, { full: true, hold: true }); out.held = game.expedition._heldCoins;
    try { _endExpedition('abandon'); } catch (e) { out.endErr = String(e.message).slice(0, 120); }
    out.endWallet = player.mojicoins; out.heldPaid = got;
    // save-3: the potion shop opened inside a run (P) - the purchase is tallied, so the wallet restore cannot refund it
    await sleep(400); game.paused = false; player.mojicoins = 100000; run();
    try { openShop('potion', {}); } catch (e) { out.shopErr = String(e.message).slice(0, 120); }
    await sleep(250);
    const hp0 = player.consumables.hp_s | 0, qty = document.getElementById('pot-qty-hp_s');
    if (qty) { qty.value = '3'; qty.dispatchEvent(new Event('input', { bubbles: true })); const btn = document.getElementById('pot-buy-hp_s'); if (btn) btn.click(); }
    out.shop = { found: !!qty, wallet: player.mojicoins, spent: game.expedition._spentInRun | 0, gained: (player.consumables.hp_s | 0) - hp0 };
    out.shopRestore = (() => { try { const w0 = player.mojicoins, sp = game.expedition._spentInRun | 0; _expeditionRestorePlayer(game.expedition.snapshot); return { wallet: player.mojicoins, spent: sp, w0 }; } catch (e) { return { err: String(e.message) }; } })();
    try { closeAllModals(); } catch (e) {}
    game.expedition = { active: false, floor: 0, bravoReady: false, currentQuest: null };
    // save-7: the death card inside a run says the tower's rule, not "you keep your gear"
    await sleep(300); game.paused = false; player.mojicoins = 50000; player._god = false; player.invulnerable = 0; run();
    try { player.hp = 0; triggerDeath(); } catch (e) { out.deathErr = String(e.message).slice(0, 120); }
    await sleep(300); out.deathSub = (document.getElementById('death-sub') || {}).textContent || '';
    try { const ov = document.getElementById('death-overlay'); if (ov) ov.classList.remove('on'); closeAllModals(); } catch (e) {}
    player.hp = player.maxHp; player.invulnerable = 9e9; game.paused = false;
    // save-8: the weekly parcel's gear piece respects the bag cap
    game.expedition = { active: false }; loadMap('town', 600); await sleep(900); game.paused = false;
    const dummy = (i) => ({ id: 'd' + i, name: 'Dummy ' + i, slot: 'weapon', rarity: 'common', tier: 1, atk: 1, dropLevel: 1, stars: 0 });
    const cap = player.invCap && player.invCap.equip;
    const claim = (fill) => { player.inventory = []; for (let i = 0; i < fill; i++) player.inventory.push(dummy(i)); game.drops.length = 0; player.postbox = [];
      game.dailyState = { day: dailyIndex(), streak: 7, challenge: 'kill10', progress: 0, claimed: false, seenMaps: [], seenNpcs: [], parcelClaimed: false };
      _claimDailyParcel(); return { inv: player.inventory.length, away: game.drops.filter((d) => d.type === 'item').length + (player.postbox || []).length, claimed: game.dailyState.parcelClaimed }; };
    out.parcel = { cap, room: claim(0), full: claim(cap), nearly: claim(cap - 1) };
    return out;
  });
  ok('[D1] save-2: coins a run HELD (daily / codex rewards earned inside it) are paid when it ends: wallet 50,000 + ' + D.held, D.held > 0 && D.endWallet === 50000 + D.held, D);
  ok('[D2] save-3: a potion bought from the shop inside a run is tallied in _spentInRun, so the restore re-charges it', D.shop.found && D.shop.spent > 0 && D.shop.spent === 100000 - D.shop.wallet && D.shop.gained === 3 && D.shop.wallet < 100000 && D.shopRestore.wallet === D.shop.wallet, D);
  ok('[D3] save-7 / ui-4: the death card inside a Tower run reads the tower rule', /looted in the tower is removed/.test(D.deathSub) && !D.deathErr, { sub: D.deathSub, err: D.deathErr });
  ok('[D4] save-8: the weekly parcel\'s gear piece goes into a bag with room, and to the post office / the ground when the tab is full (never past the cap)', D.parcel.room.inv === 1 && D.parcel.full.inv === D.parcel.cap && D.parcel.full.away === 1 && D.parcel.nearly.inv === D.parcel.cap && D.parcel.nearly.claimed && D.parcel.full.claimed, D.parcel);
  // save-6: a full browser store at import: a refusal dialog, not a silent unhandled rejection
  const E6 = await page.evaluate(async (a) => {
    const out = {}, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    if (typeof LX_SAVE_SIG_WRITE !== 'undefined') LX_SAVE_SIG_WRITE = 3;
    __put(a.raw3, a.mark3);
    const input = { files: [new File([_lxSecureSavePayload(a.raw3, Date.now())], 'save.mojisave')], value: 'C:/fake/save.mojisave' };
    const realSet = Storage.prototype.setItem; let thrown = 0;
    Storage.prototype.setItem = function (k, v) { if (k === SAVE_KEY && String(v).length > 1000) { thrown++; const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; } return realSet.call(this, k, v); };
    window.__lxStay = 1; importSave(input); await sleep(700);
    try { document.getElementById('confirm-yes').click(); } catch (e) {} await sleep(500);
    Storage.prototype.setItem = realSet;
    const mm = document.getElementById('confirm-modal');
    out.dlg = { shown: !!mm && getComputedStyle(mm).display !== 'none', title: (document.getElementById('confirm-title') || {}).textContent || '', body: (document.getElementById('confirm-body') || {}).textContent || '', noShown: getComputedStyle(document.getElementById('confirm-no')).display !== 'none' };
    out.thrown = thrown; out.inputValue = input.value; out.stay = window.__lxStay === 1; out.stored = localStorage.getItem(SAVE_KEY) === a.raw3;
    try { document.getElementById('confirm-no').click(); } catch (e) {} await sleep(100);
    return out;
  }, { raw3: A.raw3, mark3: A.mark3 });
  ok('[D5] save-6: a full browser store at "Load a save file" shows the refusal dialog (storage full), clears the file input, and does not reload', E6.thrown >= 1 && E6.dlg.shown && /Import failed/.test(E6.dlg.title) && /storage is full/i.test(E6.dlg.body) && E6.inputValue === '' && E6.stay, E6);
  // save-10: the forge shows the odds the roll uses (the item's pity included)
  const F10 = await page.evaluate(async () => {
    const out = {}; const it = { id: 'forge1', name: 'Pity Blade', slot: 'weapon', rarity: 'epic', tier: 3, stars: 9, atk: 100, dropLevel: 60, _pity: 3 };
    out.hasFn = typeof _lxEnhRate === 'function';
    out.base9 = starSuccessRate(9); out.fnPity = out.hasFn ? _lxEnhRate(it, 9) : null; out.fnFresh = out.hasFn ? _lxEnhRate(Object.assign({}, it, { _pity: 0 }), 9) : null; out.fnCap = out.hasFn ? _lxEnhRate(Object.assign({}, it, { _pity: 99 }), 9) : null;
    const star5 = Object.assign({}, it, { stars: 4, _pity: 2 }); out.star4 = starSuccessRate(4);
    out.track = _forgeStarTrack(it).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    out.trackTitle = (/title="[^"]*"/.exec(_forgeStarTrack(star5).split('ft-next')[1] || '') || [''])[0];
    out.cost4 = _forgeExpectedCost(4, star5).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '); out.cost4fresh = _forgeExpectedCost(4, Object.assign({}, star5, { _pity: 0 })).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    try { player.inventory = [Object.assign({}, star5)]; player.mojicoins = 1e7; openEnhancementModal(); renderEnhancementModal(player.inventory[0]); out.preview = (document.getElementById('enhance-preview') || {}).textContent || ''; closeAllModals(); } catch (e) { out.previewErr = String(e.message).slice(0, 120); }
    out.rollRate = starSuccessRate(4) + Math.min(30, (star5._pity || 0) * 6);
    return out;
  });
  ok('[D6] save-10 / ui-2: one _lxEnhRate(item, star) = the table rate + the item\'s pity (+6% a failed try, cap +30%)', F10.hasFn && F10.fnPity === F10.base9 + 18 && F10.fnFresh === F10.base9 && F10.fnCap === F10.base9 + 30, F10);
  ok('[D6] the star track, the expected-cost chip and the preview badge all show the rate the roll uses (star 4 with 2 failed tries: ' + F10.rollRate + '%)', new RegExp('\\b' + F10.rollRate + '%').test(F10.trackTitle) && new RegExp(F10.rollRate + '% success').test(F10.preview || '') && F10.cost4 !== F10.cost4fresh, { title: F10.trackTitle, prev: (F10.preview || '').slice(0, 200), cost: F10.cost4, fresh: F10.cost4fresh, err: F10.previewErr });

  // ---------------------------------------------------------------- E. systems
  const S = await page.evaluate(async () => {
    const out = {}, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    game.expedition = { active: false };
    // systems-1: the free class swap gives the ACC points back as SP AND takes the +5 each bought
    applyClass('warrior'); player.baseAcc = 50; player._levelUpSpent = { acc: 10, atk: 3 }; player.skillPoints = 0;
    applyClass('mage'); out.acc1 = { acc: player.baseAcc, sp: player.skillPoints };
    applyClass('warrior'); player.baseAcc = 53; player._levelUpSpent = { acc: 10 }; applyClass('mage'); out.acc2 = player.baseAcc;   // 3 from elsewhere survives
    applyClass('warrior'); player.baseAcc = 4; player._levelUpSpent = { acc: 10 }; applyClass('mage'); out.acc3 = player.baseAcc;       // never negative
    applyClass('warrior'); player.baseAcc = 0; player._levelUpSpent = {}; applyClass('mage'); out.acc4 = player.baseAcc;
    // systems-3: a reforge rebuilds from the catalog - signature pieces are refused
    const rit = (x) => Object.assign({ id: 'r', name: 'Piece', slot: 'weapon', rarity: 'epic', dropLevel: 60, affixes: [{ k: 'atk' }], stars: 1, tier: 4 }, x || {});
    out.reforge = { plain: _reforgeWhy(rit()), shard: _reforgeWhy(rit({ _shardsight: true })), god: _reforgeWhy(rit({ godTier: true })), trans: _reforgeWhy(rit({ transcended: true })), low: _reforgeWhy(rit({ dropLevel: 10 })) };
    // systems-6: the dailies roll only what can be done
    const lv0 = player.level; const seen = {};
    for (const lv of [1, 6, 12, 15, 19, 20, 25, 30, 35, 40, 69, 70, 99]) { player.level = lv; const ids = new Set(); for (let d = 0; d < 400; d++) ids.add(_pickDailyChallenge(d).id); seen[lv] = [...ids].join(','); }
    player.level = lv0; out.daily = seen;
    const ch = (id) => DAILY_CHALLENGES.find((c) => c.id === id); out.dailyRows = { reach20: ch('reach20'), gravitos1: ch('gravitos1') };
    // systems-7: a run's tray does not write the lifetime codex ledger; the two titles differ
    game.boonDex = undefined; player.boons = []; player.boonsEquipped = []; player.level = 75;
    const syn = BOON_SYNERGIES[0];
    acquirePowerup(POWERUPS.find((p) => p.id === syn.pair[0])); acquirePowerup(POWERUPS.find((p) => p.id === syn.pair[1]));
    game.boonDex = undefined; _boonDex();
    game.expedition = { active: true, floor: 1, snapshot: null };
    _applyEquippedBoons(); _detectActiveSynergies(); out.synInRun = !!(game.boonDex && game.boonDex.syn && game.boonDex.syn[syn.key]); out.activeInRun = !!(player._activeSynergies && player._activeSynergies[syn.key]);
    game.expedition = { active: false }; _applyEquippedBoons(); _detectActiveSynergies(); out.synOutside = !!(game.boonDex && game.boonDex.syn && game.boonDex.syn[syn.key]);
    out.titleDup = EXPEDITION_TITLES.includes('Synergist'); out.codexTitle = (BOON_DEX_MILESTONES.find((m) => m.key === 'syn100') || {}).title;
    player.level = lv0;
    return out;
  });
  ok('[E1] systems-1: a class swap takes back the ACC it refunded (+5 per ledger point): 50 -> 0, 53 -> 3, never negative, and the SP still comes back', S.acc1.acc === 0 && S.acc1.sp >= 13 && S.acc2 === 3 && S.acc3 === 0 && S.acc4 === 0, S);
  ok('[E2] systems-3: a reforge refuses Shardsight and Godforged pieces (it would erase their signature stats); plain, transcended and low-level pieces answer as before', S.reforge.plain === null && /signature stats are permanent/.test(S.reforge.shard || '') && /signature stats are permanent/.test(S.reforge.god || '') && /Transcended/.test(S.reforge.trans || '') && /Lv 50\+/.test(S.reforge.low || ''), S.reforge);
  { const d = S.daily; const has = (lv, id) => (d[lv] || '').split(',').includes(id);
    ok('[E3] systems-6: reach20 is rolled only for Lv 12-19 (it completed the instant it was rolled at Lv 20+)', [12, 15, 19].every((l) => has(l, 'reach20')) && [20, 25, 30, 35, 40, 69, 70, 99].every((l) => !has(l, 'reach20')) && [1, 6].every((l) => !has(l, 'reach20')), d);
    ok('[E3] gravitos1 is rolled only from Lv 70 (the Singularity\'s gate), and the rest of the table is untouched', [35, 40, 69].every((l) => !has(l, 'gravitos1')) && [70, 99].every((l) => has(l, 'gravitos1')) && has(35, 'kill200') && has(35, 'enhance10') && S.dailyRows.reach20.maxLv === 19 && S.dailyRows.gravitos1.minLv === 70, S.dailyRows); }
  ok('[E4] systems-7: a synergy awakened by a Tower tray does not write the lifetime codex ledger (it still works in the run); outside a run it does; the two "Synergist" titles are one', S.synInRun === false && S.activeInRun === true && S.synOutside === true && S.titleDup === false && S.codexTitle === 'Synergist', S);
  // ---------------------------------------------------------------- F. world, ui-3, systems-8, L2e
  const W = await page.evaluate(async () => {
    const out = {}, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    game.expedition = { active: false }; loadMap('forest', 300); await sleep(1500); game.paused = false; player.invulnerable = 9e9; player.cls = 'warrior'; player.level = 40;
    const mk = (type, extra) => { const m = spawnMonster(player.x + 150, player.y - 40, type, false, false); m.evasion = 0; Object.assign(m, extra || {}); game.monsters.push(m); return m; };
    // world-4: an away summon's kill pays no mastery and no Setshards (an Elder rolls 2-3 of them on a real kill)
    const realRoll = Math.random; Math.random = () => 0;
    const kill = (m) => { m.currentHp = 0; try { killMonster(m); } catch (e) { out.killErr = String(e.message).slice(0, 100); } };
    player.mastery = {}; player.setshards = 0; game.monsters.length = 0;
    const m1 = mk('snail', { isMiniBoss: true }); kill(m1); out.real = { mastery: player.mastery.snail | 0, shards: player.setshards };
    player.mastery = {}; player.setshards = 0;
    const m2 = mk('snail', { isMiniBoss: true, _afkKill: true }); kill(m2); out.afk = { mastery: player.mastery.snail | 0, shards: player.setshards };
    const m3 = mk('snail', { isMiniBoss: true, _isMirage: true }); kill(m3); out.mirage = { mastery: player.mastery.snail | 0, shards: player.setshards };
    Math.random = realRoll;
    // world-6: the Edict Weight EXP bonus (+8% each) reaches ordinary kills
    const pay = (edicts) => { game.edicts = edicts; game.monsters.length = 0; player.mods.xpBoost = 0; player.equipped = {}; player.boons = []; player.boonsEquipped = []; game.comboMult = 1; game.combo = 0; player.buffs.comboXp = 0; game.prestige = null; game.difficulty = 'normal';
      player.expToNext = 1e12; player.exp = 0; const m = mk('slime'); m.exp = 100000; const e0 = player.exp; kill(m); return player.exp - e0; };
    out.edict0 = pay({}); out.edict2 = pay({ glassSkin: true, frayedThread: true }); out.edict4 = pay({ glassSkin: true, frayedThread: true, waningHand: true, ironVerdict: true }); game.edicts = {};
    // world-5: the quest toast shows the EXP the turn-in pays (the four Ticket Rush stages pay a tenth of the authored number)
    const toasts = []; const realToast = window.showToast; window.showToast = (m) => { toasts.push(String(m)); }; const realLvl = window._maybeLevelUp; window._maybeLevelUp = () => {};
    out.quest = [];
    for (const id of ['q_pq_spire', 'q_pq_carriage', 'q_pq_finale', 'q_clockwork_underpass', 'q_road_1']) {
      if (!QUESTS[id]) continue; player.level = 29; player.exp = 0; player.expToNext = 1e12; player._pqStagePaid = {}; player.quests.completed[id] = undefined; delete player.quests.completed[id]; toasts.length = 0;
      _completeQuest(id); const t = toasts.find((x) => /Quest complete/.test(x)) || ''; out.quest.push({ id, authored: QUESTS[id].rewards && QUESTS[id].rewards.exp, paid: player.exp, toast: (/\+([\d,]+) EXP/.exec(t) || [])[1] });
    }
    window.showToast = realToast; window._maybeLevelUp = realLvl;
    // world-5 journal: the listed EXP of a Ticket Rush stage is marked as scaled
    try { player.level = 29; openQuestJournal && openQuestJournal(); out.journal = (document.getElementById('quest-journal') || document.body).innerHTML.indexOf('scaled') >= 0; closeAllModals(); } catch (e) { out.journalErr = String(e.message).slice(0, 100); }
    return out;
  });
  ok('[F1] world-4: a real Elder kill pays mastery + Setshards; the same kill by an away summon or a mirage pays neither', W.real.mastery === 1 && W.real.shards >= 2 && W.afk.mastery === 0 && W.afk.shards === 0 && W.mirage.mastery === 0 && W.mirage.shards === 0 && !W.killErr, W);
  ok('[F2] world-6: Edict Weight EXP (+8% per Weight, as the panel promises) is paid on an ordinary kill: 0 / 2 / 4 Weight = x1 / x1.16 / x1.32', W.edict0 > 0 && Math.abs(W.edict2 / W.edict0 - 1.16) < 0.01 && Math.abs(W.edict4 / W.edict0 - 1.32) < 0.01, { e0: W.edict0, e2: W.edict2, e4: W.edict4 });
  ok('[F3] world-5: the quest toast prints the EXP the turn-in paid, for every quest tried (the Ticket Rush stages included)', W.quest.length >= 4 && W.quest.every((q) => q.toast && Number(q.toast.replace(/,/g, '')) === q.paid), W.quest);
  ok('[F3] ...and the four Ticket Rush stages really do pay less than the authored number (so the old toast was wrong)', W.quest.filter((q) => /pq|clockwork_underpass/.test(q.id)).every((q) => q.paid < q.authored), W.quest);
  // static source checks for the text and dead-guard fixes
  const src = readFileSync(path.join(SERVE_ROOT, process.env.MOJI_GAME_FILE || 'mojiworld_game.html'), 'utf8').replace(/\r\n/g, '\n');
  ok('[F4] ui-3: the Boons tab quotes the Sage\'s price from SAGE_PRICE, not "5,000"', /from <b>\?\?\?<\/b>'s offering \(once every 12 hours, \$\{SAGE_PRICE\.toLocaleString\(\)\} Mojicoins\)/.test(src) && !/once every 12 hours, 5,000 Mojicoins/.test(src), 'source');
  ok('[F5] L2e: the reset-stats cost chips format through the top-level _FMT_BIG (the old typeof read an inner-scope name and fell back to raw digits)', /const _fmt = \(n\) => \(typeof _FMT_BIG === 'function'\) \? _FMT_BIG\(n\) : String\(n\);/.test(src) && !/typeof _fmtBig === 'function'\) \? _fmtBig\(n\) : String\(n\)/.test(src), 'source');
  ok('[F6] systems-8: the Transcend text no longer claims "50% of its current ★10 totals" (the bake keeps half of the ORIGINAL flat curve: +8%)', !/50% of its current ★/.test(src) && !/keeps <b>50% of its current/.test(src) && /half of a ★/.test(src), 'source');

  const T = await page.evaluate(async () => {
    const out = {}, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    game.expedition = { active: false };
    // systems-8: the Steam stat lifetime_coins counts what was EARNED (monotonic), not the wallet
    const pushed = []; window.SteamAPI = { available: true, deck: false, input: { snapshot() { return null; } }, stats: { set(o) { pushed.push(o); return Promise.resolve(true); } }, achievement: { unlock() { return Promise.resolve(true); } }, cloud: { read: async () => null, write: async () => true, writeSync: () => true } };
    try {
      game._saveVerdict = 'ok'; game._importVerdict = 'ok'; game._devTouched = false; player.mojicoins = 1000; player.bankBalance = 0; game._coinsEarned = 0;
      const stat = () => { pushed.length = 0; try { _lxSteamStatsAt = 0; } catch (e) {} _lxSteamPushStats(true); return pushed.length ? pushed[0].lifetime_coins : null; };
      out.s0 = stat();
      const before = player.mojicoins; const got = _grantMojicoins(5000, { full: true }); out.got = got; out.s1 = stat();
      player.mojicoins = 10; out.s2 = stat();                       // spend nearly everything: a lifetime figure does not drop
      _grantMojicoins(100, { full: true, hold: true }); out.heldNow = game._coinsEarned;   // not in a run: a hold grant is an ordinary grant
      out.inList = GAME_SAVE_FIELDS.includes('_coinsEarned');
    } catch (e) { out.err = String(e.message).slice(0, 160); }
    delete window.SteamAPI;
    // an older save (no counter) starts it at what it holds, on load
    player.mojicoins = 4000; player.bankBalance = 1000; _flushSaveStateNow(); const sv = JSON.parse(localStorage.getItem(SAVE_KEY)); out.savedCounter = sv.game._coinsEarned;
    delete sv.game._coinsEarned; sv.sig = _lxLocalSaveSig(sv); localStorage.setItem(SAVE_KEY, JSON.stringify(sv)); game._coinsEarned = undefined;
    try { loadState(); } catch (e) { out.loadErr = String(e.message).slice(0, 100); }
    out.seeded = game._coinsEarned; out.walletAfter = player.mojicoins;
    // L2e: the reset-stats dialog's cost chip reads 246.9K, not 246913
    player.mojicoins = 1234567; player.bankBalance = 0; player.setshards = 5000; player._levelUpSpent = { atk: 2 }; player.skillPoints = 0;
    let cap = null; const realConfirm = window.uiConfirm; window.uiConfirm = (o) => { cap = o; return Promise.resolve(false); };
    try { resetStats(); } catch (e) { out.resetErr = String(e.message).slice(0, 100); }
    window.uiConfirm = realConfirm; out.chip = cap && cap.bodyHtml ? String((/rc-chip">([^<]*)</.exec(cap.bodyHtml) || [])[1] || '').trim() : null;
    return out;
  });
  ok('[F7] systems-8: the Steam stat lifetime_coins reads Mojicoins earned in play: 0 -> ' + T.s1 + ' after a 5,000 grant and it does not fall when the wallet is spent (the saved counter is _coinsEarned)', !T.err && T.s0 === 0 && T.s1 > 0 && T.s1 === T.got && T.s2 === T.s1 && T.inList && T.savedCounter >= 0, T);
  ok('[F7] a save from before the counter starts it at the wallet + bank it holds (so the stat never starts below what the player has)', T.seeded === 5000 && !T.loadErr, { seeded: T.seeded, err: T.loadErr });
  ok('[F8] L2e: the reset-stats dialog chip reads "246.9K" (was "246913")', T.chip === '246.9K' && !T.resetErr, { chip: T.chip, err: T.resetErr });

} catch (e) { ok('harness: ' + String(e.message).slice(0, 300), false); }
await browser.close(); server.kill();
ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
