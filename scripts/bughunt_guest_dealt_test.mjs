// BUG HUNT guest-dealt (2026-10-03): what a co-op GUEST is dealt when the HOST's world resolves a hit or a kill. One page, the guest simulated
// by posing net as a live session (the way coop_handler_audit_test does), so every assertion is a direct function call.
//   parityB-5  the guest's early return in _hitMonsterCore skipped the post-hit tail: combo, crit streak, gear / boon lifesteal
//   parityB-2  _coopApplyKill skipped the per-player kill credit: kills, the 'kills' daily, mastery + the shard roll, Trainee Path, achievements
//   parityB-3  the guest EXP lacked the level-gap falloff and Dawn's Favor
//   parityB-4  the guest coin payout bypassed every per-kill economy ceiling (_lxKillCoinValue)
//   parityB-1  Octobaby's arms gate was judged on the guest's mirror (which has no arms): now host-side in _coopHostApplyDamage
//   parityB-7  guests get the Zodiac Sigil and the post-boss boon wheel (per user)
//   parityB-9  a super boss's +50% EXP / +50% coin rain reach guests (sb:1 on the kill frame)
//   [SERVE_ROOT=<dir with serve.js, data/, art>] [PORT=n] node scripts/bughunt_guest_dealt_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '13975';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d !== undefined ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } })).newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _coopApplyKill === 'function' && typeof hitMonster === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(4000);
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; _playStoryBeat = function () { return false; }; _playBossIntro = function () {}; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'warrior'; player.level = 60; player._god = true; player.hp = player.maxHp = 99999; player._tutorialSeen = true;
    loadMap('forest', 300); await sleep(1200); game.paused = false;
    // shared helpers for every group below (pinned: no world affix, no kill streak, no random drift)
    const W = window.__gd = {};
    W.pin = () => { game._mapAffix = WORLD_AFFIXES[0]; game.mapKillStreak = 0; player._ksTier = 0; game.paused = false; player._god = true; player.hp = player.maxHp = 99999; player.expToNext = 1e12; };
    W.sent = [];
    W.guest = () => { net.isHost = false; net.hostId = 7; net.myId = 2; net.connected = true; net.ws = { readyState: 1, send(s) { try { W.sent.push(JSON.parse(s)); } catch (e) {} } };
      net.peers = { 7: { id: 7, name: 'Hosty', map: game.currentMap, x: 0, y: 0, _last: performance.now(), cap: 0 } }; };
    W.host = () => { net.isHost = true; net.hostId = null; net.connected = false; net.ws = null; net.peers = {}; };
    W.mirror = (type, uid, level) => { net._coopSpawning = true; let m; try { m = spawnMonster(player.x + 120, player.y, type, false, false); } finally { net._coopSpawning = false; } m.uid = uid; m._coopMirror = true; if (level) m.level = level;
      m.evasion = 0; m.def = 0; m.maxHp = m.currentHp = 1e12; m.aggroRange = 0; m.exp = 100; return m; };
    W.frame = (o) => Object.assign({ t: 'kill', id: 7, u: 0, e: 100, c: 0, x: Math.round(player.x) + 3000, y: Math.round(player.y), map: game.currentMap, tp: 'slime', b: 0, il: 0 }, o);
    W.toasts = []; const _st = showToast; W.restoreToast = () => { showToast = _st; }; showToast = function (t) { W.toasts.push(String(t)); };
    W.sigils = () => (player.inventory || []).filter((i) => i && i.zodiacSigil).length;
    W.boons = []; W.realPowerup = showPowerupChoice; showPowerupChoice = function (info) { W.boons.push(info); };
    game.monsters.length = 0;
  });
  const E = (fn, arg) => page.evaluate(fn, arg);

  // ---- parityB-5: the guest's post-hit tail --------------------------------------------------------------------------------------
  const t5 = await E(() => {
    const W = window.__gd; W.pin(); const out = {};
    const hit = (m, d, crit, skill) => { try { hitMonster(m, d, crit, skill); } catch (e) { out.err = String(e).slice(0, 200); } };
    const m = W.mirror('slime', 910001); player.mods = player.mods || {}; player.mods.lifesteal = 0; player.mods.burn = 0;
    // (a) a SOLO / host hit still does all of it (the lifesteal block moved into _lxHitLifesteal)
    W.host(); player.mods.lifesteal = 0.05; player.hp = Math.floor(getMaxHp() / 2); game.combo = 0; game.comboMult = 1; game.critStreak = 0;
    const h0 = player.hp; hit(m, 2000, false, 'basic');
    out.soloCombo = game.combo; out.soloHeal = player.hp - h0;
    // (b) the guest: 20 hits -> combo 20; lifesteal heals; 3 crits -> critStreak 3; thorns bump nothing
    W.guest(); player.mods.lifesteal = 0; game.combo = 0; game.comboMult = 1; game.critStreak = 0;
    for (let i = 0; i < 20; i++) hit(m, 50, false, 'basic');
    out.combo = game.combo; out.comboMult = game.comboMult; out.sentN = W.sent.filter((f) => f.t === 'dmg').length;
    game.combo = 0; game.comboMult = 1;
    player.mods.lifesteal = 0.05; player.hp = Math.floor(getMaxHp() / 2); const g0 = player.hp; hit(m, 2000, false, 'basic');
    out.guestHeal = player.hp - g0; player.mods.lifesteal = 0;
    game.critStreak = 0; player.lastCritT = -1e9; for (let i = 0; i < 3; i++) hit(m, 50, true, 'basic');
    out.critStreak = game.critStreak; out.lastCritSet = player.lastCritT === game.time;
    const c0 = game.combo, ls0 = player.hp; player.mods.lifesteal = 0.05; player.hp = Math.floor(getMaxHp() / 2); const t0 = player.hp;
    hit(m, 5, false, 'thorns'); out.thornsCombo = game.combo - c0; out.thornsHeal = player.hp - t0; player.mods.lifesteal = 0;
    out.hpFloor = m.currentHp > 0;
    game.monsters.length = 0; W.host();
    return out;
  });
  check(t5.err === undefined, 'parityB-5: no throw in the hit path', t5.err);
  check(t5.soloCombo === 1 && t5.soloHeal > 0, 'solo / host hit unchanged: combo 1 and a lifesteal heal', J({ c: t5.soloCombo, heal: t5.soloHeal }));
  check(t5.combo === 20 && t5.sentN >= 20, 'parityB-5: 20 guest hits -> game.combo === 20 (and every hit still forwarded)', J({ combo: t5.combo, sent: t5.sentN }));
  check(Math.abs(t5.comboMult - 1.6) < 1e-9, 'parityB-5: comboMult engages (x1.6 at a 20 combo)', t5.comboMult);
  check(t5.guestHeal > 0, 'parityB-5: gear / boon lifesteal heals a guest', t5.guestHeal);
  check(t5.critStreak === 3 && t5.lastCritSet, 'parityB-5: three guest crits -> critStreak 3 and the crit flash stamp', J({ s: t5.critStreak, st: t5.lastCritSet }));
  check(t5.thornsCombo === 0 && t5.thornsHeal === 0, 'parityB-5: a thorns hit bumps no combo and heals nothing', J({ c: t5.thornsCombo, h: t5.thornsHeal }));
  check(t5.hpFloor, 'parityB-5: the mirror is still floored above 0 (the host owns the kill)');

  // ---- parityB-2: the per-player kill credit -------------------------------------------------------------------------------------
  const t2 = await E(() => {
    const W = window.__gd; W.pin(); W.guest(); const out = {}; let uid = 920000;
    const note = (tp, o) => { const u = ++uid; _lxCoopRewardNote(Object.assign({ uid: u, type: tp, exp: 100, mojicoins: 0, level: 60 }, o || {})); return u; };
    const rnd = Math.random; Math.random = () => 0;   // every shard roll wins (dust 0.5%, elite 25%, elder 50%)
    try {
      game.kills = 0; game.achievements = {}; player.mastery = {}; player.setshards = 0; player.level = 60;
      game.dailyState = { day: dailyIndex(), challenge: 'kill10', progress: 0, claimed: false };
      const e0 = _earlyHooksComplete() ? null : _earlyState().kills; out.earlyActive = e0 !== null;
      _coopApplyKill(W.frame({ u: note('slime') }));
      out.kills = game.kills; out.mastery = player.mastery.slime; out.daily = game.dailyState.progress; out.first = !!game.achievements.firstBlood;
      out.early = e0 === null ? null : _earlyState().kills - e0; out.dust = player.setshards;
      // an illusion counts for nothing; a replayed frame (same uid) counts once
      const u2 = note('slime'); _coopApplyKill(W.frame({ u: u2, il: 1 })); out.ilKills = game.kills; out.ilMastery = player.mastery.slime;
      const u3 = note('slime'); _coopApplyKill(W.frame({ u: u3 })); _coopApplyKill(W.frame({ u: u3 })); out.dupKills = game.kills;
      // the elite / elder shard roll reads the tier the reward note kept (the mirror is gone here), and the star toast fires at 100
      player.setshards = 0; _coopApplyKill(W.frame({ u: note('slime', { isElite: true }) })); out.elite = player.setshards;
      player.setshards = 0; _coopApplyKill(W.frame({ u: note('slime', { isMiniBoss: true }) })); out.elder = player.setshards;
      player.mastery.slime = 99; W.toasts.length = 0; _coopApplyKill(W.frame({ u: note('slime') })); out.star = W.toasts.some((t) => /MASTERY/.test(t)); out.m100 = player.mastery.slime;
      // a boss is not a mastery kill, but it is a kill
      const k0 = game.kills, ms0 = JSON.stringify(player.mastery); _coopApplyKill(W.frame({ u: note('zodiac_aries', { isBoss: true }), tp: 'zodiac_aries', b: 1, zs: 'aries', bl: 70, ec: 1 }));
      out.bossKill = game.kills - k0; out.bossMastery = JSON.stringify(player.mastery) === ms0;
      // with the mirror still alive its own tier is read BEFORE the splice
      const mm = W.mirror('slime', ++uid); mm.isElite = true; player.setshards = 0; _coopApplyKill(W.frame({ u: mm.uid })); out.mirrorElite = player.setshards; out.mirrorGone = game.monsters.indexOf(mm) < 0;
    } finally { Math.random = rnd; }
    W.host(); return out;
  });
  check(t2.kills === 1 && t2.mastery === 1 && t2.daily === 1 && t2.first, 'parityB-2: one guest kill -> game.kills 1, mastery.slime 1, the kill10 daily 1, First Blood unlocked', J(t2));
  check(t2.dust === 1, 'parityB-2: the dust-trickle shard roll runs for a guest (roll pinned to win)', t2.dust);
  check(!t2.earlyActive || t2.early === 1, 'parityB-2: the Trainee Path kill count advances', J({ active: t2.earlyActive, early: t2.early }));
  check(t2.ilKills === 1 && t2.ilMastery === 1, 'parityB-2: an illusion kill (il:1) counts nothing', J({ k: t2.ilKills, m: t2.ilMastery }));
  check(t2.dupKills === 2, 'parityB-2: a replayed frame counts once', t2.dupKills);
  check(t2.elite === 1 && t2.elder === 2, 'parityB-2: elite pays 1 shard, elder 2 (tier read from the reward note)', J({ elite: t2.elite, elder: t2.elder }));
  check(t2.star && t2.m100 === 100, 'parityB-2: the 100th kill raises the mastery star toast', J({ star: t2.star, m: t2.m100 }));
  check(t2.bossKill === 1 && t2.bossMastery, 'parityB-2: a boss counts as a kill but not as a mastery kill', J({ k: t2.bossKill, m: t2.bossMastery }));
  check(t2.mirrorElite === 1 && t2.mirrorGone, 'parityB-2: a live mirror\'s own tier is read before it is removed', J({ shards: t2.mirrorElite, gone: t2.mirrorGone }));

  // ---- parityB-3: level-gap falloff and Dawn's Favor on a guest's EXP --------------------------------------------------------------
  const t3 = await E(() => {
    const W = window.__gd; W.pin(); W.guest(); const out = {}; let uid = 930000;
    const exp = (fr) => { player.exp = 0; player.expToNext = 1e12; _coopApplyKill(fr); return player.exp; };
    const note = (lv) => { const u = ++uid; _lxCoopRewardNote({ uid: u, type: 'slime', exp: 100, mojicoins: 0, level: lv }); return u; };
    const mult = [(game.prestige && game.prestige.xpMult) || 1, _diffExpMul(), _affixExpMul(), _ksXpMul()].reduce((a, v) => a * v, 1); out.mult = mult;
    player.level = 70; out.gap70v10 = _lxExpLevelGapMul({ level: 10 });
    out.far70v10 = exp(W.frame({ u: note(10), e: 100 }));              // far kill: no co-op wedge (x1)
    out.near70v10 = exp(W.frame({ u: note(10), e: 100, x: Math.round(player.x), y: Math.round(player.y) }));
    const mm = W.mirror('slime', ++uid, 10); out.mirror70v10 = exp(W.frame({ u: mm.uid, e: 100 }));   // with the live mirror carrying the host's level
    player.level = 12; out.far12v10 = exp(W.frame({ u: note(10), e: 100 }));   // within 5 levels: x1
    player.level = 70; const sc = window._lxStoryComplete; window._lxStoryComplete = () => true;
    out.dawn70v69 = exp(W.frame({ u: note(69), e: 100 })); out.dawnMul = _lxDawnExpMul();
    window._lxStoryComplete = sc; out.noDawn70v69 = exp(W.frame({ u: note(69), e: 100 }));
    player.level = 70; out.floor1 = exp(W.frame({ u: note(10), e: 1 }));       // a kill that pays anything pays at least 1
    player.level = 60; W.host(); return out;
  });
  check(Math.abs(t3.gap70v10 - 0.15) < 1e-9 && t3.mult === 1, 'parityB-3: pins (Lv70 vs Lv10 = x0.15, guest multipliers neutral)', J({ g: t3.gap70v10, m: t3.mult }));
  check(t3.far70v10 === Math.floor(100 * 0.15), 'parityB-3: a Lv70 guest on a Lv10 mob (far kill) gets x0.15, not 100%', J({ got: t3.far70v10, want: 15 }));
  check(t3.near70v10 === Math.floor(100 * 2 * 0.15), 'parityB-3: and the near-kill co-op wedge still doubles it (x2 x0.15)', J({ got: t3.near70v10, want: 30 }));
  check(t3.mirror70v10 === 15, 'parityB-3: the same through a live mirror that carries the host\'s level', t3.mirror70v10);
  check(t3.far12v10 === 100, 'parityB-3: within five levels the falloff is x1', t3.far12v10);
  check(Math.abs(t3.dawnMul - 1.1) < 1e-9 && t3.dawn70v69 === Math.floor(100 * 1.1) && t3.noDawn70v69 === 100, 'parityB-3: Dawn\'s Favor adds +10% after the story, nothing before', J({ dawn: t3.dawn70v69, plain: t3.noDawn70v69 }));
  check(t3.floor1 === 1, 'parityB-3: the host\'s max(1, ...) floor holds for a guest', t3.floor1);

  // ---- parityB-4: the guest's coins ride the host's per-kill ceilings --------------------------------------------------------------
  const t4 = await E(() => {
    const W = window.__gd; W.pin(); W.guest(); const out = {}; let uid = 940000;
    player.mods = player.mods || {}; player.mods.greed = 0; player.level = 60; game._bossKills = {};
    const coins = (fr) => { const w0 = player.mojicoins || 0; _coopApplyKill(fr); return (player.mojicoins || 0) - w0; };
    out.gainMul = MOJICOIN_GAIN_MULT; out.greedBonus = (typeof getEquipBonus === 'function') ? getEquipBonus('greed') : 0;
    // an ordinary Lv60 mirror whose table bag is 973: the host's kill is its level number (~300, +/-12%), the old guest line paid 729
    const got = []; for (let i = 0; i < 40; i++) { const m = W.mirror('slime', ++uid, 60); m.mojicoins = 973; got.push(coins(W.frame({ u: m.uid, e: 100, c: 973 }))); game.monsters.length = 0; W.pin(); }
    out.min = Math.min(...got); out.max = Math.max(...got); out.mean = got.reduce((a, v) => a + v, 0) / got.length;
    // the same kill with no mirror left (the stub stands in)
    const u2 = ++uid; _lxCoopRewardNote({ uid: u2, type: 'slime', exp: 100, mojicoins: 973, level: 60 }); out.stub = coins(W.frame({ u: u2, e: 100, c: 973 }));
    // a zero-coin frame (mirage, echo) still pays nothing
    const u3 = ++uid; _lxCoopRewardNote({ uid: u3, type: 'slime', exp: 100, mojicoins: 973, level: 60 }); out.zero = coins(W.frame({ u: u3, e: 100, c: 0 }));
    // a level-10 mob: its own small number, never above the old line
    const m10 = W.mirror('slime', ++uid, 10); m10.mojicoins = 87; out.lv10 = coins(W.frame({ u: m10.uid, e: 100, c: 87 })); game.monsters.length = 0;
    // greed still counts (x2 gear greed, the host's pickup line), under the host's x3.5 gear cap
    player.mods.greed = 1; const mg = W.mirror('slime', ++uid, 60); mg.mojicoins = 973; out.greed = coins(W.frame({ u: mg.uid, e: 100, c: 973 })); player.mods.greed = 0; game.monsters.length = 0;
    // a zodiac boss bag: first kill under the boss ceiling, a refight at x0.30 of the bag - read off THIS guest's own history
    const bag = (refight) => { game._bossKills = refight ? { zodiac_aries: 1 } : {}; const u = ++uid; _lxCoopRewardNote({ uid: u, type: 'zodiac_aries', exp: 1000, mojicoins: 340000, level: 70, isBoss: true });
      return coins(W.frame({ u, e: 1000, c: 340000, tp: 'zodiac_aries', b: 1, zs: 'aries', bl: 70, ec: 1 })); };   // ec:1 - no sigil / wheel noise
    out.bossFirst = bag(false); out.bossRefight = bag(true); game._bossKills = {};
    W.host(); return out;
  });
  check(t4.gainMul === 0.375 && t4.greedBonus === 0, 'parityB-4: pins (MOJICOIN_GAIN_MULT 0.375, no greed gear)', J({ g: t4.gainMul, b: t4.greedBonus }));
  check(t4.min >= 255 && t4.max <= 345 && Math.abs(t4.mean - 300) < 15, 'parityB-4: a Lv60 mirror (bag 973) pays the host\'s ~300 +/-12%, not 729', J({ min: t4.min, max: t4.max, mean: Math.round(t4.mean) }));
  check(t4.stub >= 255 && t4.stub <= 345, 'parityB-4: the same through the stand-in (no mirror left)', t4.stub);
  check(t4.zero === 0, 'parityB-4: a zero-coin frame (mirage / echo) pays nothing', t4.zero);
  check(t4.lv10 > 0 && t4.lv10 <= 53 * 1.15, 'parityB-4: a Lv10 mob pays its own small number', t4.lv10);
  check(t4.greed > 500 && t4.greed < 700, 'parityB-4: greed still multiplies (x2 -> ~600, the host\'s pickup line)', t4.greed);
  check(t4.bossFirst === 127500, 'parityB-4: a first zodiac kill is held under the boss ceiling (22,500 + 1,500 x 70 = 127,500)', t4.bossFirst);
  check(t4.bossRefight === 76500, 'parityB-4: a refight reads this guest\'s own history: the bag x0.30 -> 76,500 (not 255,000)', t4.bossRefight);

  // ---- parityB-1: Octobaby's arms gate, judged on the host -------------------------------------------------------------------------
  const t1 = await E(() => {
    const W = window.__gd; W.pin(); W.host(); const out = {};
    const m = spawnMonster(player.x + 200, player.y, 'octobaby', true, false);
    out.spawned = !!m && !m._suppressed; if (!out.spawned) return out;
    const lose = (arms, breakT) => { m.maxHp = m.currentHp = 1e9; m.invulnerable = 0; m._stagger = 0; m._dirOpenT = 0; m._wardUntil = 0; m._shroudUntil = 0; m._burrowed = false; m._underground = false;
      m._octoInit = true; m._legRefs = Array.from({ length: arms }, () => ({})); m._octoBreakT = breakT; const h = m.currentHp; _coopHostApplyDamage(m.uid, 1000, false, 'x', null, 'g'); return h - m.currentHp; };
    out.arms4 = lose(4, 0); out.arms3 = lose(3, 0); out.arms1 = lose(1, 0); out.exposed = lose(0, 5000); out.bare = lose(0, 0);
    m._octoInit = false; m._legRefs = [{}, {}, {}, {}]; out.helperNoInit = _lxOctoArmsAlive(m);
    // a different boss is not touched by the rule
    const o = spawnMonster(player.x + 260, player.y, 'slime', false, false); o.maxHp = o.currentHp = 1e9; o._octoInit = true; o._legRefs = [{}, {}, {}, {}];
    const h = o.currentHp; _coopHostApplyDamage(o.uid, 1000, false, 'x', null, 'g'); out.other = h - o.currentHp;
    game.monsters.length = 0; return out;
  });
  check(t1.spawned, 'parityB-1: an Octobaby could be spawned for the test', J(t1));
  check(t1.arms4 === 91, 'parityB-1: four living arms: a 1000 hit costs the head floor(1000 x 0.55^4) = 91 HP', t1.arms4);
  check(t1.arms3 === 166 && t1.arms1 === 550, 'parityB-1: three arms 166, one arm 550', J({ a3: t1.arms3, a1: t1.arms1 }));
  check(t1.exposed === 2000, 'parityB-1: all arms down and the body exposed: x2 -> 2000', t1.exposed);
  check(t1.bare === 1000, 'parityB-1: no arms and no exposed window: x1', t1.bare);
  check(t1.helperNoInit === 0 && t1.other === 1000, 'parityB-1: the helper still needs _octoInit; other monsters are untouched', J({ h: t1.helperNoInit, o: t1.other }));

  // ---- parityB-7: the Zodiac Sigil and the post-boss boon wheel reach a guest ------------------------------------------------------
  const t7 = await E(async () => {
    const W = window.__gd; W.pin(); W.guest(); const out = { cases: {} }; let uid = 950000; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const J2 = (o) => JSON.stringify(o);
    player.level = 70; player.inventory = (player.inventory || []).filter((i) => !(i && i.zodiacSigil));
    const kill = (name, over, noteOver) => {
      game._bossKills = {}; game._pendingBossBoon = null; W.boons.length = 0; W.toasts.length = 0;
      const u = ++uid; const tp = (over && over.tp) || 'zodiac_aries';
      _lxCoopRewardNote(Object.assign({ uid: u, type: tp, exp: 1000, mojicoins: 1000, level: 70, isBoss: true, name: 'Ariel the Ember Ram' }, noteOver || {}));
      const s0 = W.sigils(); _coopApplyKill(W.frame(Object.assign({ u, e: 1000, c: 1000, tp, b: 1, zs: 'aries', bl: 70 }, over || {})));
      const r = { sigil: W.sigils() - s0, queued: !!game._pendingBossBoon, info: game._pendingBossBoon ? J2(game._pendingBossBoon) : null };
      out.cases[name] = r; game._pendingBossBoon = null; return r;
    };
    kill('real', {}); kill('duoTrial', { dt: 1 }); kill('illusion', { il: 1 }); kill('echo', { ec: 1, bx: 1 }); kill('expedition', { ex: 1, bx: 1 }); kill('twin', { tw: 1, bx: 1 });
    kill('conductor', { tp: 'pqConductor', zs: undefined }); kill('plain', { b: 0 }, { isBoss: false }); kill('gravitos', { tp: 'gravitos', zs: undefined }, { name: 'Gravitos, the Weight-Bearer' });
    // delivery: the queued wheel opens through showPowerupChoice about 1.5 s later, once
    const u = ++uid; _lxCoopRewardNote({ uid: u, type: 'gravitos', exp: 1000, mojicoins: 1000, level: 100, isBoss: true, name: 'Gravitos, the Weight-Bearer' }); game._bossKills = {}; W.boons.length = 0; game._pendingBossBoon = null;
    _coopApplyKill(W.frame({ u, e: 1000, c: 1000, tp: 'gravitos', b: 1, bl: 100 })); out.before = W.boons.length; await sleep(1900); out.after = W.boons.slice();
    W.host(); return out;
  });
  const c7 = t7.cases;
  check(c7.real.sigil === 1 && c7.real.queued, 'parityB-7: a real zodiac boss kill pays a guest the Sigil and queues the boon wheel', J(c7.real));
  check(c7.duoTrial.sigil === 1 && c7.duoTrial.queued, 'parityB-7: a Duo Trial clear (dt:1) pays the sigil too - the host does (outside the dt clause)', J(c7.duoTrial));
  for (const k of ['illusion', 'echo', 'expedition', 'twin']) check(c7[k].sigil === 0 && !c7[k].queued, 'parityB-7: ' + k + ' kill: no sigil, no wheel', J(c7[k]));
  check(c7.conductor.sigil === 0 && !c7.conductor.queued, 'parityB-7: the PQ Conductor: no wheel', J(c7.conductor));
  check(c7.plain.sigil === 0 && !c7.plain.queued, 'parityB-7: an ordinary monster: neither', J(c7.plain));
  check(c7.gravitos.queued && /"maxRoll":true/.test(c7.gravitos.info || '') && c7.gravitos.sigil === 0, 'parityB-7: a Gravitos kill queues the max-roll wheel and no sigil', J(c7.gravitos));
  check(t7.before === 0 && t7.after.length === 1 && t7.after[0].maxRoll === true, 'parityB-7: the wheel opens once, about 1.5 s later, through showPowerupChoice (Gravitos: god-roll cards)', J({ before: t7.before, after: t7.after }));

  // ---- parityB-9: a super boss's death bonuses reach a guest -----------------------------------------------------------------------
  const t9 = await E(() => {
    const W = window.__gd; W.pin(); W.guest(); const out = {}; let uid = 960000;
    player.level = 65; player.mods = player.mods || {}; player.mods.greed = 0; player.mods.xpBoost = 0;
    const run = (sb, tp) => { game._bossKills = {}; game._pendingBossBoon = null; player.exp = 0; player.expToNext = 1e12; const w0 = player.mojicoins || 0; const u = ++uid;
      _lxCoopRewardNote({ uid: u, type: tp, exp: 1000, mojicoins: 20000, level: 65, isBoss: true });
      _coopApplyKill(W.frame({ u, e: 1000, c: 20000, tp, b: 1, bl: 65, sb })); game._pendingBossBoon = null; return { exp: player.exp, coins: (player.mojicoins || 0) - w0 }; };
    for (let i = 0; i < 3; i++) run(0, 'aetherion');   // warm-up: the first boss kills of a save also trip one-time quest / achievement rewards (Boss Hunter pays coins one kill late)
    const base = run(0, 'aetherion'), sup = run(1, 'aetherion');
    out.dExp = sup.exp - base.exp; out.dCoins = sup.coins - base.coins; out.base = base;
    out.mult = [(game.prestige && game.prestige.xpMult) || 1, _diffExpMul(), _edictExpMul(), _lxDawnExpMul()].reduce((a, v) => a * v, 1);
    game._bossKills = {}; player.exp = 0; const ui = ++uid; _lxCoopRewardNote({ uid: ui, type: 'aetherion', exp: 1000, mojicoins: 20000, level: 65, isBoss: true });
    _coopApplyKill(W.frame({ u: ui, e: 1000, c: 20000, tp: 'aetherion', b: 1, il: 1, sb: 1 })); game._pendingBossBoon = null; out.illusion = player.exp;
    // the HOST side: the kill frame carries sb:1 for a super boss and only for one
    window.__gdKeep = window._coopKeyHasPeers; window._coopKeyHasPeers = () => true;
    net.isHost = true; net.connected = true; net.myId = 1; const sent = []; net.ws = { readyState: 1, send(s) { sent.push(JSON.parse(s)); } };
    const bc = (m) => { sent.length = 0; _coopBroadcastKill(m, 100, 100); return sent[0]; };
    const base0 = { x: 10, y: 10, uid: 1, level: 65 };
    out.fAeth = bc(Object.assign({ type: 'aetherion', isBoss: true }, base0));
    out.fSuperFlag = bc(Object.assign({ type: 'octobaby', isBoss: true, superBoss: true }, base0));
    out.fZodiac = bc(Object.assign({ type: 'zodiac_aries', isBoss: true, zodiacSign: 'aries' }, base0));
    out.fMob = bc(Object.assign({ type: 'slime', isBoss: false }, base0));
    out.fRush = bc(Object.assign({ type: 'aetherion', isBoss: true, _rushBoss: true }, base0));
    window._coopKeyHasPeers = window.__gdKeep; W.host(); return out;
  });
  check(t9.mult === 1, 'parityB-9: pins (prestige / difficulty / edict / Dawn neutral on this save)', t9.mult);
  check(t9.dExp === 500, 'parityB-9: a guest gets the super boss +50% EXP bonus: floor(1000 x 0.5) = 500 on top', J({ d: t9.dExp, base: t9.base }));
  check(t9.dCoins === 3750, 'parityB-9: and the +50% coin rain: floor(10,000 x 0.375) = 3,750', t9.dCoins);
  check(t9.illusion === t9.base.exp, 'parityB-9: an illusion frame carries no bonus (it pays only the base the frame names)', J({ il: t9.illusion, base: t9.base.exp }));
  check(t9.fAeth && t9.fAeth.sb === 1 && t9.fSuperFlag && t9.fSuperFlag.sb === 1, 'parityB-9: the host kill frame carries sb:1 for Aetherion and for a superBoss', J({ a: t9.fAeth && t9.fAeth.sb, s: t9.fSuperFlag && t9.fSuperFlag.sb }));
  check(t9.fZodiac && t9.fZodiac.sb === undefined && t9.fMob && t9.fMob.sb === undefined && t9.fRush && t9.fRush.sb === undefined, 'parityB-9: no sb on a zodiac boss, an ordinary mob or a Boss Rush echo', J({ z: t9.fZodiac && t9.fZodiac.sb, m: t9.fMob && t9.fMob.sb, r: t9.fRush && t9.fRush.sb }));

  check(errs.length === 0, 'no page errors', errs.slice(0, 3).join(' | '));
} finally { await browser.close(); try { server.kill(); } catch (e) {} }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
