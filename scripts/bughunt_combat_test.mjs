// BUG HUNT 2026-10-02, combat cluster (fixer `combat`). One page, direct function calls; a few static source checks for text / dead-code fixes.
//   combat-1/2  freeze + stun procs and the three live stuns go through the boss rules (_lxCcPin)
//   combat-4    heat aura / glass spikes take Block, warrior DR, Aegis and the mana shield, and skip a paused hero
//   combat-5/6  a reactive hit never triggers the Gemini Lie penalty; the parry budget survives ward-break and execute
//   combat-9    Taurus gore / Leo pounce never cut a longer immunity
//   combat-10   a skill timer that comes due behind a SOLO menu waits for it (a Holy Shield wave is no longer eaten)
//   diff-c-2/3/4, diff-a-1/2, sibling-5..10, sibling2A-1, sibling2B-2, D1 (Mind Over Matter + Quick Scholar), timers-3/5/6
//   [SERVE_ROOT=<dir with serve.js>] [PORT=n] node scripts/bughunt_combat_test.mjs [page.html]      (a page argument = the candidate build)
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync, readFileSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '13990';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const SRC = readFileSync(cand ? path.resolve(SERVE_ROOT, cand) : path.join(SERVE_ROOT, 'mojiworld_game.html'), 'utf8').replace(/\r\n/g, '\n');
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d !== undefined ? '  [' + (typeof d === 'string' ? d : JSON.stringify(d)) + ']' : '')); ok ? pass++ : fail++; };
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const has = (s) => SRC.includes(s), count = (s) => SRC.split(s).length - 1;
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } })).newPage(); const errs = [];
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof castSkill === 'function' && typeof GAME_VERSION === 'string' && !!document.getElementById('lo-menu'), null, { timeout: 180000 });
  await page.waitForTimeout(3000);
  const ver = await page.evaluate(() => GAME_VERSION); console.log('build ' + ver + (cand ? '  (' + cand + ')' : ''));
  // shared in-page toolkit, installed once as window.__T
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootHold.release('menu'); } catch (e) {}
    applyClass('archer'); player._storyBeatsSeen = new Proxy({}, { get: () => true, set: () => true }); player._gravitosCineSeen = true; player._tutorialSeen = true;
    loadMap('forest', 300); await sleep(1500); game.paused = true;
    const T = window.__T = {};
    T.sleep = sleep;
    // run the live sim for n game.time steps (a hit's hit-stop skips updates while game.time runs on); `each` samples every ~20 ms
    T.frames = async (n, each) => { const t0 = game.time; for (let i = 0; i < 900 && game.time - t0 < n; i++) { game.paused = false; game.hitStop = 0; await sleep(20); if (each) each(); } game.paused = true; };
    T.hero = (cls, job, master) => { if (player.cls !== cls) applyClass(cls); player.job = job || null; player.master = master || null; player.masteries = master ? { [master]: true } : {};
      player.level = 99; player._god = true; player.invulnerable = 0; player.mp = player.maxMp = 99999; player.skillCooldowns = {}; player.skillRanks = {}; player._castLockUntil = 0; player.vx = 0; player.buffs = {}; };
    T.clear = () => { game.monsters.length = 0; game.projectiles.length = 0; game.hazards.length = 0; };
    // kind: 'normal' | 'mini' | 'boss'
    T.foe = (kind, dx, type) => { const m = spawnMonster(player.x + (dx == null ? 120 : dx), player.y - 10, type || (kind === 'boss' ? 'kingKrook' : 'slime'), kind === 'boss', kind === 'mini');
      Object.assign(m, { maxHp: 1e9, currentHp: 1e9, stunTimer: 0, freezeTimer: 0, _ccGraceUntil: 0, _lxSlowT: 0, evasion: 0, traits: null, isElite: false });
      if (kind === 'boss') Object.assign(m, { _wardNextAt: 1e12, _wardUntil: 0 }); return m; };
    T.withRandom = (fn, v) => { const r = Math.random; Math.random = typeof v === 'function' ? v : () => v; try { return fn(); } finally { Math.random = r; } };
  });
  const E = (fn, arg) => page.evaluate(fn, arg);
  // ---- combat-1: the gear / boon freeze proc, Stormfront, Winter Garden and a guest's procs obey the boss rules ----------------------------
  const A = await E(() => { const T = __T, out = {}; T.hero('mage'); player.mods = player.mods || {};
    const procs = (kind, rnd) => { T.clear(); const m = T.foe(kind); player.mods.freezeChance = 1; try { T.withRandom(() => _lxOnHitProcs(m, 100, 'melee'), rnd); } finally { player.mods.freezeChance = 0; }
      return { frz: m.freezeTimer | 0, grace: m._ccGraceUntil > 0 }; };
    out.trash = procs('normal', 0.1);
    out.miniResisted = procs('mini', 0.1);   // the proc roll (0.1 < 0.6) lands, the mini-boss's own resist roll (0.1 < 0.5) holds it off
    { T.clear(); const m = T.foe('mini'); player.mods.freezeChance = 1; let n = 0; const seq = () => (n++ % 2 === 0 ? 0.1 : 0.9);   // proc lands, resist roll fails
      T.withRandom(() => _lxOnHitProcs(m, 100, 'melee'), seq); out.miniApplied = { frz: m.freezeTimer | 0, grace: m._ccGraceUntil > 0 };
      m.freezeTimer = 0; n = 0; T.withRandom(() => _lxOnHitProcs(m, 100, 'melee'), seq); out.miniAgain = { frz: m.freezeTimer | 0 }; player.mods.freezeChance = 0; }
    out.boss = procs('boss', 0.1);
    { T.clear(); const mi = T.foe('mini'), bo = T.foe('boss', 220), tr = T.foe('normal', 330); [mi, bo, tr].forEach((m, i) => { m.uid = 7100 + i; });
      const wasHost = net.isHost; net.isHost = true;
      try { T.withRandom(() => { for (const m of [mi, bo, tr]) _coopHostApplyDamage(m.uid, 10, false, 'melee', { fz: 900, st: 800 }, 'g'); }, 0.1); } finally { net.isHost = wasHost; }
      out.host = { mini: [mi.freezeTimer | 0, mi.stunTimer | 0], boss: [bo.freezeTimer | 0, bo.stunTimer | 0, Math.round(bo._lxSlowT || 0)], trash: [tr.freezeTimer | 0, tr.stunTimer | 0] }; }
    T.clear(); return out; });
  console.log('  combat-1 ' + JSON.stringify(A));
  check(A.trash.frz === 900, 'combat-1: a normal foe still freezes 0.9 s on the proc', A.trash);
  check(A.miniResisted.frz === 0, 'combat-1: a mini-boss resists the freeze proc half the time (resist roll lands: nothing)', A.miniResisted);
  check(A.miniApplied.frz === 900 && A.miniApplied.grace && A.miniAgain.frz === 0, 'combat-1: an applied freeze on a mini-boss gives it the re-freeze grace (no chain lock)', JSON.stringify([A.miniApplied, A.miniAgain]));
  check(A.boss.frz === 0, 'combat-1: a boss is never frozen by the proc', A.boss);
  check(A.host.mini[0] === 0 && A.host.boss[0] === 0 && A.host.boss[1] === 0 && A.host.boss[2] > 0 && A.host.trash[0] === 900 && A.host.trash[1] === 800,
    'combat-1: the host applies a guest freeze / stun under the same rules (mini resists, boss slowed not stunned, trash pinned)', A.host);
  check(!has('closest.freezeTimer = Math.max') && has("_lxCcPin(closest, 'freeze', 900)") && !has('o.freezeTimer = Math.max(o.freezeTimer || 0, 1400)') && has("_lxCcPin(o, 'freeze', 1400)"),
    'combat-1: Stormfront and Winter Garden pin through the helper (no direct freezeTimer write)');
  // ---- combat-2: Evade Roll blast, Eagle Eye kick, Voidrift nova stun by the boss rules ----------------------------------------------------
  const B = await E(async () => { const T = __T, out = {}; const calls = []; const _ams = window._applyMobStatus; window._applyMobStatus = function (m, kind, ms) { calls.push({ m, kind, ms }); return _ams.apply(this, arguments); };
    const run = async (name, cls, job, master, id, dx, wait) => { const res = {};
      for (const kind of ['normal', 'mini', 'boss']) { T.clear(); T.hero(cls, job, master); player.facing = 1; const m = T.foe(kind, dx); calls.length = 0; let maxStun = 0, maxSlow = 0, err = null;
        try { SKILL_FNS[id](); } catch (e) { err = String(e).slice(0, 80); }
        await T.frames(wait, () => { maxStun = Math.max(maxStun, m.stunTimer | 0); maxSlow = Math.max(maxSlow, m._lxSlowT | 0); });
        res[kind] = { maxStun, maxSlow, viaStatus: calls.filter((c) => c.m === m && c.kind === 'stun').length, err }; }
      return res; };
    out.evade = await run('evade', 'archer', null, null, 'evadeRoll', 60, 12);
    out.eagle = await run('eagle', 'archer', 'sniper', 'skyhunter', 'eagleEye', 50, 12);
    out.void = await run('void', 'rogue', 'assassin', 'phantom', 'phantom_cut', 150, 80);
    window._applyMobStatus = _ams; T.clear(); return out; });
  console.log('  combat-2 ' + JSON.stringify(B));
  for (const [k, label] of [['evade', 'Evade Roll blast'], ['eagle', 'Eagle Eye kick'], ['void', 'Voidrift nova']]) {
    const r = B[k];
    check(!r.normal.err && r.normal.maxStun > 0, `combat-2: ${label} still stuns a normal foe`, r.normal);
    check(r.mini.viaStatus > 0 && r.mini.maxStun <= 700, `combat-2: ${label} stuns a mini-boss through the status rules (resist + grace)`, r.mini);
    check(r.boss.maxStun === 0 && r.boss.maxSlow > 0, `combat-2: ${label} slows a boss and never stuns it`, r.boss);
  }
  // ---- combat-4: heat aura (Forgewight) and glass spikes (Shardlich) take Block / warrior DR / Aegis / mana shield, and skip a paused hero -----
  const C = await E(() => { const T = __T, out = {}; const _aabb = window.aabb; const _war = window._warriorDr;
    game.camera.x = Math.max(0, player.x - 400); game.paused = true;
    // one hand-driven monster step (the live loop is paused; aabb is stubbed false so only the trait under test can hurt)
    const hurt = (type, trait, preset, opt) => { T.clear(); T.hero('warrior'); player._god = false; player.invulnerable = 0; player.hitStun = 0; player.blockTimer = 0; player._aegis = null; player.tree = player.tree || {}; player.tree.manaShield = false;
      player.hp = getMaxHp(); player.mp = 99999; if (opt && opt.setup) opt.setup();
      const m = spawnMonster(player.x + 40, player.y - 20, type, false, false); m.currentHp = m.maxHp = 1e9; m.aggroTarget = player; game.camera.x = Math.max(0, player.x - 400);
      if (trait === 'aura') m._heatT = 0; else { m._spikeFiring = true; m._spikeT = 1; m._spikeX = player.x + player.w / 2; m._spikeY = player.y + player.h; m._spikeCd = 9e9; }
      const hp0 = player.hp, mp0 = player.mp; game.damageNumbers.length = 0; window.aabb = () => false;
      const wasPaused = game.paused; game.paused = !!(opt && opt.paused);
      try { game.time++; updateMonsters(16.67); } finally { window.aabb = _aabb; window._warriorDr = _war; game.paused = true; }
      const col = trait === 'aura' ? '#ff8844' : '#a0c8ff'; const nums = game.damageNumbers.filter((d) => d.taken && d.color === col).map((d) => d.text);
      return { has: !!(m.traits && (trait === 'aura' ? m.traits.heatAura : m.traits.groundSpikes)), loss: hp0 - player.hp, mpLoss: mp0 - player.mp, nums }; };
    for (const [trait, type] of [['aura', 'forgewight'], ['spikes', 'shardlich']]) { const o = out[trait] = {};
      o.plain = hurt(type, trait);
      o.block = hurt(type, trait, 0, { setup: () => { player.blockTimer = 3000; } });
      o.aegis = hurt(type, trait, 0, { setup: () => { player._aegis = { life: 9999, orbs: [] }; } });
      o.dr = hurt(type, trait, 0, { setup: () => { window._warriorDr = () => 0.5; } });
      o.mana = hurt(type, trait, 0, { setup: () => { player.tree.manaShield = true; } });
      o.paused = hurt(type, trait, 0, { paused: true }); }
    window.aabb = _aabb; window._warriorDr = _war; T.clear(); return out; });
  console.log('  combat-4 ' + JSON.stringify(C));
  for (const [trait, label] of [['aura', 'heat aura'], ['spikes', 'glass spikes']]) { const o = C[trait];
    check(o.plain.has && o.plain.loss > 0, `combat-4: the ${label} still hurts an open hero`, o.plain);
    check(o.block.loss > 0 && o.block.loss <= Math.floor(o.plain.loss * 0.3) + 1 && o.block.loss < o.plain.loss, `combat-4: Block takes 70% off the ${label}`, [o.plain.loss, o.block.loss]);
    check(o.aegis.loss > 0 && o.aegis.loss <= Math.floor(o.plain.loss * 0.5) + 1 && o.aegis.loss < o.plain.loss, `combat-4: Divine Aegis halves the ${label}`, [o.plain.loss, o.aegis.loss]);
    check(o.dr.loss < o.plain.loss && o.dr.loss <= Math.floor(o.plain.loss * 0.6), `combat-4: the warrior's damage reduction applies to the ${label}`, [o.plain.loss, o.dr.loss]);
    check(o.mana.loss < o.plain.loss && o.mana.mpLoss > 0, `combat-4: the mana shield trades MP for HP on the ${label}`, [o.plain.loss, o.mana.loss, o.mana.mpLoss]);
    check(o.paused.loss === 0 && o.paused.nums.length === 0, `combat-4: a paused hero is not hit by the ${label}`, o.paused); }
  // ---- combat-5: the Gemini Lie penalty is for swings the player CHOSE; the parry counter skips an untargetable source -------------------------------
  const D = await E(() => { const T = __T, out = {}; T.hero('warrior'); player._god = true; out.pen = {};
    for (const skill of ['melee', 'thorns', 'parry', 'aegis', 'nova', 'shade', 'pack', 'meleeSkill']) {
      T.clear(); const m = T.foe('normal'); m.zodiacSign = 'gemini'; m._geminiLying = true; player._poisonTimer = 0; player._slowTimer = 0; const hp0 = m.currentHp; game.damageNumbers.length = 0;
      try { hitMonster(m, 100, false, skill); } catch (e) {}
      out.pen[skill] = { penalised: (player._poisonTimer | 0) > 0 || (player._slowTimer | 0) > 0, rejected: m.currentHp === hp0, label: game.damageNumbers.some((d) => d.text === 'DECEIVED') }; }
    player._poisonTimer = 0; player._slowTimer = 0;
    { T.clear(); const m = T.foe('normal'); m.zodiacSign = 'gemini'; m._geminiLying = true; let n = 0; const _hm = window.hitMonster; window.hitMonster = function () { n++; return _hm.apply(this, arguments); };
      try { _lxParryCounter(m); } finally { window.hitMonster = _hm; } out.counterAtLiar = n;
      const m2 = T.foe('normal', 200); n = 0; window.hitMonster = function () { n++; return _hm.apply(this, arguments); };
      try { _lxParryCounter(m2); } finally { window.hitMonster = _hm; } out.counterAtNormal = n; }
    T.clear(); return out; });
  console.log('  combat-5 ' + JSON.stringify(D));
  check(D.pen.melee.penalised && D.pen.melee.rejected && D.pen.meleeSkill.penalised, 'combat-5: a chosen swing at the lying twin is still punished and still rejected', [D.pen.melee, D.pen.meleeSkill]);
  check(['thorns', 'parry', 'aegis', 'nova', 'shade', 'pack'].every((k) => !D.pen[k].penalised && !D.pen[k].label && D.pen[k].rejected), 'combat-5: thorns, the parry counter, Aegis orbs, Riposte Nova, the Shade echo and pack bites bounce off without poisoning you', D.pen);
  check(D.counterAtLiar === 0 && D.counterAtNormal > 0, 'combat-5: the parry counter does not strike an untargetable source (the lying twin), and still strikes a normal one', [D.counterAtLiar, D.counterAtNormal]);
  // ---- combat-6: the parry's half-max-HP budget holds after ward-break and execute -------------------------------------------------------------
  const F6 = await E(() => { const T = __T, out = {}; T.hero('warrior'); player._god = true; const _pd = window._lxParryDmg; window._lxParryDmg = () => 1e7; const _c = Math.random;
    const parryAt = (kind, setup) => { T.clear(); const m = T.foe(kind); m.maxHp = 10000; m.currentHp = 6000; m._wardNextAt = 1e12; if (setup) setup(m); game.comboMult = 1; game.combo = 0; game.damageNumbers.length = 0;
      try { _lxParryCounter(m); } catch (e) { return { err: String(e).slice(0, 80) }; }
      const hp = m.currentHp > 0 ? m.currentHp : 0; return { hp, executed: !!m._msExecuted, label: game.damageNumbers.some((d) => d.text === 'EXECUTE') }; };
    const win = () => { player._msWin = { id: 'bughunt', until: (game.time | 0) + 9e6, execute: { frac: 0.5, bossMul: 1.4 } }; };
    out.bossWardBreak = parryAt('boss', (m) => { m._wardBreakUntil = (game.time | 0) + 9e6; });
    out.bossExecute = parryAt('boss', win);
    out.normalExecute = parryAt('normal', win);
    out.plain = parryAt('boss', null);
    // the control: the SAME execute window still executes a normal (non-parry) hit
    { T.clear(); const m = T.foe('normal'); m.maxHp = 10000; m.currentHp = 5100; win(); game.comboMult = 1; game.combo = 0; try { hitMonster(m, 100, false, 'melee'); } catch (e) {} out.controlExecuted = !!m._msExecuted || m.currentHp <= 0; }
    player._msWin = null; window._lxParryDmg = _pd; Math.random = _c; T.clear(); return out; });
  console.log('  combat-6 ' + JSON.stringify(F6));
  check(F6.bossWardBreak.hp === 1000 && F6.plain.hp === 1000, 'combat-6: a parry spends at most half the boss\'s max HP, ward-break window or not (60% -> 10%)', [F6.bossWardBreak, F6.plain]);
  check(F6.bossExecute.hp === 1000 && !F6.bossExecute.label, 'combat-6: an open execute window does not multiply a parry past its budget on a boss', F6.bossExecute);
  check(F6.normalExecute.hp === 1000 && !F6.normalExecute.executed && !F6.normalExecute.label, 'combat-6: nor does it execute a normal foe a parry left under the threshold', F6.normalExecute);
  check(F6.controlExecuted, 'combat-6: the same execute window still finishes a foe on an ordinary hit', F6.controlExecuted);
  // ---- combat-9: Taurus gore / Leo pounce never cut a longer immunity --------------------------------------------------------------------------
  const G9 = await E(() => { const T = __T, out = {}; const _aabb = window.aabb; T.hero('warrior'); player._god = false; player.hp = getMaxHp(); game.paused = true; game.camera.x = Math.max(0, player.x - 400);
    T.clear(); const m = spawnMonster(player.x - 10, player.y - 30, 'slime', false, false); m.currentHp = m.maxHp = 1e9; m.aggroTarget = player;
    m.traits = { braceDash: { gore: { frac: 0.2, label: 'bughunt gore' }, dashMs: 380, distance: 520, cdMs: 9000, range: 700 } };
    m._braceDashing = true; m._bdPhase = 'dash'; m._bdT = 400; m._bdVx = 0; m._bdDir = 1; m._bdTravel = 0; m._bdGored = false; m._bdCd = 9e9;
    player.invulnerable = 3000; player.x = m.x + m.w / 2 - player.w / 2; player.y = m.y + m.h / 2 - player.h / 2; window.aabb = () => false;
    const hp0 = player.hp; game.paused = false; try { game.time++; updateMonsters(16.67); } finally { window.aabb = _aabb; game.paused = true; }
    out.gore = { goreLanded: m._bdGored === true, loss: hp0 - player.hp, invul: Math.round(player.invulnerable) };
    T.clear(); player.invulnerable = 0; return out; });
  console.log('  combat-9 ' + JSON.stringify(G9));
  check(G9.gore.goreLanded && G9.gore.loss > 0, 'combat-9: the gore still lands through a live immunity (by design: the overlap is the contract)', G9.gore);
  check(G9.gore.invul >= 2900, 'combat-9: ...but it no longer cuts a 3 s immunity down to 0.9 s', G9.gore);
  check(has('player.invulnerable = Math.max(player.invulnerable || 0, 800);   // v0.30.x bughunt combat-9'), 'combat-9: the Sun Pounce takes the longer of the two as well (source)');
  // ---- combat-10: a skill timer that comes due behind a SOLO menu waits for it ---------------------------------------------------------------
  const H = await E(async () => { const T = __T, out = {}; const hold = async (ms) => { const t0 = performance.now(); while (performance.now() - t0 < ms) { game.paused = true; await T.sleep(15); } };
    T.hero('warrior', 'knight', null); T.clear(); cancelPendingSkillTimers();
    { const log = []; game.paused = true;
      scheduleSkillTimer(() => { if (game.paused) return; log.push('guarded'); }, 30);
      scheduleSkillTimer(() => { log.push('unguarded:' + (game.paused ? 'paused' : 'live')); }, 60);
      await hold(400); out.whilePaused = log.slice(); game.paused = false; await T.sleep(400); out.afterResume = log.slice(); game.paused = true; }
    { const hits = []; const _hm = window.hitMonster; window.hitMonster = function (m, d, c, s) { if (s === 'holyShield') hits.push(game.paused ? 'paused' : 'live'); return _hm.apply(this, arguments); };
      try { T.clear(); const m = T.foe('normal', 100); game.paused = false; SKILL_FNS.holyShield(); game.paused = true; await hold(700); out.hsPaused = hits.slice(); await T.frames(40); await T.sleep(300); out.hsAfter = hits.slice(); }
      finally { window.hitMonster = _hm; } }
    { const log = []; game.paused = true; scheduleSkillTimer(() => { log.push('late'); }, 30); await hold(250);
      out.heldBeforeCancel = (scheduleSkillTimer._hold || []).length; cancelPendingSkillTimers(); out.heldAfterCancel = (scheduleSkillTimer._hold || []).length;
      game.paused = false; await T.sleep(400); out.cancelled = log.slice(); game.paused = true; }
    { const log = []; const _ca = window._coopActive; window._coopActive = () => true;   // co-op: a pause does not stop the world, so the old behaviour stays
      try { scheduleSkillTimer(() => { if (game.paused) return; log.push('guarded'); }, 30); scheduleSkillTimer(() => { log.push('unguarded:' + (game.paused ? 'paused' : 'live')); }, 60); await hold(300); out.coop = { log: log.slice(), held: (scheduleSkillTimer._hold || []).length }; }
      finally { window._coopActive = _ca; } }
    cancelPendingSkillTimers(); game.paused = true; T.clear(); return out; });
  console.log('  combat-10 ' + JSON.stringify(H));
  check(H.whilePaused.length === 0, 'combat-10: nothing a skill timer does runs while the solo menu is open (no payload lands behind it)', H.whilePaused);
  check(H.afterResume.join() === 'guarded,unguarded:live', 'combat-10: both timers fire, in the order they came due, once the menu closes (the guarded payload is no longer dropped)', H.afterResume);
  check(H.hsPaused.length === 0 && H.hsAfter.filter((x) => x === 'live').length >= 3 && !H.hsAfter.includes('paused'), 'combat-10: a menu open when Holy Shield\'s waves come due no longer eats them: all three land after it closes', [H.hsPaused, H.hsAfter]);
  check(H.heldBeforeCancel === 1 && H.heldAfterCancel === 0 && H.cancelled.length === 0, 'combat-10: cancelPendingSkillTimers (death / map change) drops what is held', [H.heldBeforeCancel, H.heldAfterCancel, H.cancelled]);
  check(H.coop.held === 0 && H.coop.log.join() === 'unguarded:paused', 'combat-10: in co-op nothing is held (a pause does not stop the world there): behaviour unchanged', H.coop);
  // ---- diff-c-2 / diff-c-3 / diff-a-1 / sibling2A-1 / sibling-7 / sibling-9 / sibling-10 (one page, small direct calls) ----------------------------
  const K = await E(async () => { const T = __T, out = {};
    // diff-c-2: Apotheosis' follow-up presses are free, and isReady has to know it
    T.hero('mage', 'archmage', 'elementalist'); player.mp = 0; player._apoCharges = 2; delete player.skillCooldowns.elementalist_ult; player._castLockUntil = 0;
    out.apoReadyAtZeroMp = isReady('elementalist_ult'); player._apoCharges = 0; out.apoOpenerNeedsMp = isReady('elementalist_ult'); player._apoCharges = 0; player.mp = player.maxMp;
    // diff-c-3: a self-cast never cuts a longer buff
    out.buff = {}; T.hero('warrior', 'berserker', null);
    for (const [id, key, long] of [['warCry', 'warCry', 12000], ['bloodlust', 'bloodlust', 30000], ['rampage', 'rampage', 9000], ['guardian', 'guardian', 90000]]) {
      player.buffs = {}; player.buffs[key] = long; try { SKILL_FNS[id](); } catch (e) { out.buff[id] = 'ERR ' + String(e).slice(0, 60); continue; } out.buff[id] = player.buffs[key] >= long; }
    T.hero('archer', 'sniper', 'skyhunter'); player.buffs = { eagleEye: 90000 }; try { SKILL_FNS.eagleEye(); out.buff.eagleEye = player.buffs.eagleEye >= 90000; } catch (e) { out.buff.eagleEye = 'ERR'; }
    T.clear();
    // diff-a-1: the tour's potion-step bypass is for hp / mp / full only
    T.hero('warrior'); player.hp = getMaxHp(); player.mp = getMaxMp(); player.frozenTimer = player.freezeTimer = player._slowTimer = player._poisonTimer = player._skillLockTimer = player.burnTimer = player.hitStun = player.stunTimer = 0;
    const _sl = window._lxTutPotionStepLive; window._lxTutPotionStepLive = () => true;
    try { out.drink = { hpAtFull: _lxDrinkUseless('hp'), full: _lxDrinkUseless('full'), cureNothing: _lxDrinkUseless('cure') }; } finally { window._lxTutPotionStepLive = _sl; }
    // sibling2A-1: a Warrior's area hit is physical, a Mage's is magic
    player.cls = 'warrior'; out.aoeWarrior = _lxDmgClass('aoe'); out.splashWarrior = _lxDmgClass('splash'); player.cls = 'mage'; out.aoeMage = _lxDmgClass('aoe'); player.cls = 'warrior';
    // sibling-7: a swing trail past its peak frames cannot be parried; a live one can
    { T.clear(); player.invulnerable = 0; const mk = (spent) => ({ x: player.x, y: player.y, w: 24, h: 24, vx: 0, vy: 0, life: 10, owner: 'enemy', skill: 'swing', _sgL0: 14, _spent: spent });
      const _ss = window._lxSwingSpent; window._lxSwingSpent = (p) => !!p._spent;
      try { game.projectiles.length = 0; game.projectiles.push(mk(true)); out.parrySpent = _lxParryCatch(); game.projectiles.length = 0; game.projectiles.push(mk(false)); player.invulnerable = 0; out.parryLive = _lxParryCatch(); }
      finally { window._lxSwingSpent = _ss; game.projectiles.length = 0; player.invulnerable = 0; } }
    // sibling-9: the number is the HP the 1 HP floor let through
    { T.hero('warrior'); player._god = false; player.invulnerable = 0; player.onGround = true; player.maxHp = Math.max(player.maxHp, 2000); player.hp = Math.min(100, getMaxHp()); const before = player.hp; game.damageNumbers.length = 0;
      try { _lxBossExecLocal('kkQuake', { x: player.x, y: player.y }); } catch (e) { out.quakeErr = String(e).slice(0, 80); }
      const n = game.damageNumbers.find((d) => /EARTHQUAKE/.test(String(d.text))); out.quake = { before, after: player.hp, shown: n ? +String(n.text).replace(/\D/g, '') : null };
      player._god = true; player.hp = getMaxHp(); }
    // sibling-10: a Flame Dash burn on a boss is resisted like every other DOT
    { T.hero('rogue', 'assassin', null); player.mods = player.mods || {}; player.mods.dashFlame = 0.3; T.clear(); const bo = T.foe('boss', 40), tr = T.foe('normal', 60); game.flameTrail = [{ x: bo.x + bo.w / 2, y: bo.y + bo.h / 2, r: 400, life: 200, max: 200, hitAt: {} }];
      const _r = Math.random; Math.random = () => 0.1; try { game.time += 40; _updateDashTrail(16.67); } finally { Math.random = _r; }
      out.flame = { boss: bo.burnTimer | 0, trash: tr.burnTimer | 0, trashKind: tr._dotKind || null }; player.mods.dashFlame = 0; game.flameTrail = []; }
    T.clear(); return out; });
  console.log('  misc ' + JSON.stringify(K));
  check(K.apoReadyAtZeroMp === true && K.apoOpenerNeedsMp === false, 'diff-c-2: with charges left, Apotheosis is ready at 0 MP (catastrophes 2 and 3 are free); the opener still needs the MP', [K.apoReadyAtZeroMp, K.apoOpenerNeedsMp]);
  check(Object.values(K.buff).every((v) => v === true), 'diff-c-3: War Cry / Bloodlust / Rampage / Guardian / Eagle Eye never cut a longer buff', K.buff);
  check(K.drink.hpAtFull === false && K.drink.full === false && K.drink.cureNothing === true, 'diff-a-1: during the tour\'s potion step an HP / MP / full drink works at a full bar, but a Cure Remedy with nothing to cure is still kept', K.drink);
  check(K.aoeWarrior === 'phys' && K.splashWarrior === 'phys' && K.aoeMage === 'magic', 'sibling2A-1: an area hit takes the hero\'s class (Warrior physical, Mage magic)', [K.aoeWarrior, K.splashWarrior, K.aoeMage]);
  check(K.parrySpent === false && K.parryLive === true, 'sibling-7: a spent swing trail is not parried (no free PARRY + counter); a live one is', [K.parrySpent, K.parryLive]);
  check(K.quake && K.quake.shown === K.quake.before - K.quake.after && K.quake.before - K.quake.after > 0, 'sibling-9: the earthquake\'s number is the HP the 1 HP floor let through, not the raw 55%', K.quake);
  check(K.flame.boss === 0 && K.flame.trash > 0 && K.flame.trashKind === 'burn', 'sibling-10: Flame Dash\'s burn goes through the status rules (a boss resists it, a normal foe burns with the burn icon)', K.flame);
  // ---- sibling-6: summons, orbs, turret and the Deadeye lock skip a foe that cannot be hit -------------------------------------------------------
  const S6 = await E(() => { const T = __T, out = {}; const step = () => { game.hitStop = 0; game.time++; player._lxTimersTickedAt = -1; updatePlayer(16.67); };
    const near = (dx) => { const m = T.foe('normal', dx); return m; };
    // a shrouded (immune) boss stands CLOSER than an ordinary foe
    const pair = () => { T.clear(); T.hero('mage', 'warlock', 'necromancer'); player._god = true; player.hitStun = 0; player.stunTimer = 0; player.x = Math.max(300, player.x); game.paused = true;
      const imm = T.foe('normal', 50); imm._shroudUntil = (game.time | 0) + 9e6; const ok = near(220); return { imm, ok }; };
    { const { imm, ok } = pair(); player._necromancerOrbs = { life: 9e6, maxLife: 9e6, orbs: [{ baseAng: 0, phase: 0, hitCd: 0 }], regenMs: 0 }; for (let i = 0; i < 3; i++) step();
      out.soulWard = { tgt: player._necromancerOrbs && player._necromancerOrbs.orbs[0] && (player._necromancerOrbs.orbs[0].tgt === ok ? 'ok' : player._necromancerOrbs.orbs[0].tgt === imm ? 'immune' : 'none') }; player._necromancerOrbs = null; }
    { const { imm, ok } = pair(); player._hexOrbs = { life: 9e6, maxLife: 9e6, orbs: [{ baseAng: 0, phase: 0, rearm: 0, seen: [] }] }; for (let i = 0; i < 3; i++) step();
      const o = player._hexOrbs && player._hexOrbs.orbs[0]; out.hexOrb = { tgt: o && (o.tgt === ok ? 'ok' : o.tgt === imm ? 'immune' : 'none') }; player._hexOrbs = null; }
    { const { imm, ok } = pair(); player._ballistaTurrets = [{ anchorX: player.x + 20, anchorY: player.y + 20, life: 9e6, fireCd: 0, muzzle: 0, facing: 1 }]; const n0 = game.projectiles.length; step();
      const sh = game.projectiles.slice(n0).find((p) => p.skill === 'siege'); out.turret = { tgt: sh ? (sh.homing === ok ? 'ok' : sh.homing === imm ? 'immune' : 'other') : 'none' }; player._ballistaTurrets = null; }
    { const { imm, ok } = pair(); player.facing = 1; const t = _lxDeadeyeAcquire(); out.deadeye = t === ok ? 'ok' : t === imm ? 'immune' : 'none'; }
    T.clear(); player._god = true; return out; });
  console.log('  sibling-6 ' + JSON.stringify(S6));
  check(S6.soulWard.tgt === 'ok' && S6.hexOrb.tgt === 'ok' && S6.turret.tgt === 'ok' && S6.deadeye === 'ok', 'sibling-6: Soul Ward orbs, Grand Hex orbs, the War Machine turret and the Deadeye lock all pass over an untargetable (shrouded) boss for the foe beside it', S6);
  // ---- D1: Mind Over Matter = +20% cooldown speed, Quick Scholar in the normal tail -----------------------------------------------------------
  const D1 = await E(async () => { const T = __T, out = {}; T.hero('warrior'); player._god = true; game.paused = true;
    const drain = (syn) => { player._activeSynergies = syn ? { mindOverMatter: true } : {}; player.skillCooldowns = { __bhA: 10000, __bhB: 3000 }; player._lxTimersTickedAt = -1; _lxTickPlayerTimers(1000);
      const r = { a: player.skillCooldowns.__bhA, b: player.skillCooldowns.__bhB }; player.skillCooldowns = {}; return r; };
    out.plain = drain(false); out.syn = drain(true);
    // through the live sim: the same card, unstunned, drains 1.2x the steps it ran for (steps counted where updatePlayer ran)
    { T.clear(); player._activeSynergies = { mindOverMatter: true }; player.skillCooldowns = { __bhLive: 200000 }; player.hitStun = 0; player.stunTimer = 0; let steps = 0; const _up = window.updatePlayer; window.updatePlayer = function (dt) { steps++; return _up.apply(this, arguments); };
      try { await T.frames(60); } finally { window.updatePlayer = _up; } const left = player.skillCooldowns.__bhLive; out.live = { steps, drained: left == null ? null : 200000 - left, perStep: left == null || !steps ? null : (200000 - left) / steps };
      player.skillCooldowns = {}; player._activeSynergies = {}; }
    // Quick Scholar: +max(1, floor(speed x 0.3)) EXP per second spent running (|vx| > 1.5), none standing still
    { player._activeSynergies = { quickScholar: true }; player.exp = 0; player.expToNext = 1e9; player.hp = getMaxHp(); player._qsAcc = 0; player.vx = 3;
      const gain = Math.max(1, Math.floor(getSpeed() * 0.3)); let e1 = 0; const qs = (typeof _lxQuickScholarTick === 'function') ? _lxQuickScholarTick : () => {}; for (let i = 0; i < 61; i++) qs(1000 / 60); e1 = player.exp;
      player.exp = 0; player._qsAcc = 0; player.vx = 0; for (let i = 0; i < 180; i++) qs(1000 / 60); const e2 = player.exp;
      out.scholar = { gain, runningSecond: e1, standing3s: e2 }; player._activeSynergies = {}; player.vx = 0; }
    T.clear(); return out; });
  console.log('  D1 ' + JSON.stringify(D1));
  check(D1.plain.a === 9000 && D1.syn.a === 8800 && D1.plain.b === 2000 && D1.syn.b === 1800, 'D1: Mind Over Matter drains cooldowns 1.2x as fast (1000 ms of game time takes 1200 ms off), unstunned', [D1.plain, D1.syn]);
  check(D1.live.steps >= 10 && D1.live.perStep > 16.667 * 1.15 && D1.live.perStep < 16.667 * 1.25, 'D1: ...and so does the live sim, step for step (no stun needed)', D1.live);
  check(D1.scholar.runningSecond === D1.scholar.gain && D1.scholar.standing3s === 0, 'D1: Quick Scholar pays max(1, floor(speed x 0.3)) EXP for each second of running, nothing standing still', D1.scholar);
  check(has('+20% skill cooldown speed') && !has('shave 200 ms off your active skill cooldowns') && !has('player.skillCooldowns[k] - 200') && has('_lxQuickScholarTick(dt);'), 'D1: the card says +20% cooldown speed; the stun-branch copies of both synergies are gone (source)');
  // ---- timers-3 / timers-5 / timers-6 ----------------------------------------------------------------------------------------------------------
  const TM = await E(async () => { const T = __T, out = {}; T.hero('warrior'); player._god = false; game.paused = true; T.clear();
    // timers-3: a contact hit's hit-stop leaves updatePlayer 3 steps behind game.time; the +100 ms i-frames and the grunt still count it
    { player.invulnerable = 1000; player._lxInvPrev = 0; player._lxHitSeen = -99; player.lastHitTime = (game.time | 0) - 3; _lxHitIframeBonus(); out.bonus = Math.round(player.invulnerable); player.invulnerable = 0; }
    { const voices = []; const _v = window._playPlayerVoice; window._playPlayerVoice = (k) => { voices.push(k); }; T.clear(); player.hp = getMaxHp(); player.hitStun = 0; player.stunTimer = 0; game.hitStop = 0; player._lastHpForVoice = player.hp; player.hp -= 20; player._monsterHitAt = (game.time | 0) - 3;
      try { game.time++; updatePlayer(16.67); } finally { window._playPlayerVoice = _v; } out.voice = voices.slice(); player.hp = getMaxHp(); }
    // timers-5: a downed hero's buffs and cooldowns keep running
    { player._downed = true; player._downedUntil = performance.now() + 9e6; player.buffs = { warCry: 20000 }; player.skillCooldowns = { __bhDown: 20000 }; player._lxTimersTickedAt = -1; game.time++;
      try { updatePlayer(1000); } catch (e) { out.downedErr = String(e).slice(0, 80); } out.downed = { buff: player.buffs.warCry, cd: player.skillCooldowns.__bhDown }; player._downed = false; player._downedUntil = 0; player.buffs = {}; player.skillCooldowns = {}; }
    // timers-6: every 20th step is a hit-stopped one (updatePlayer does not run) - a `game.time % N` tick (N a multiple of 20) never fired, a dt accumulator loses ~5%
    const run = (steps, setup) => { T.clear(); player._god = true; player.hitStun = 0; player.stunTimer = 0; player.blockTimer = 0; player.buffs = {}; setup(); let ran = 0; const start = (game.time | 0) - ((game.time | 0) % 60) + 60; game.time = start;
      for (let i = 0; i < steps; i++) { game.time++; if (game.time % 20 === 0) continue; player._lxTimersTickedAt = -1; game.hitStop = 0; updatePlayer(1000 / 60); ran++; } return ran; };
    { const _gb = window.getEquipBonus; window.getEquipBonus = function (k) { return k === 'hpRegen' ? 5 : _gb.apply(this, arguments); }; player.mods = player.mods || {}; player.mods.mpRegen = 1;
      try { let hp0, mp0; const ran = run(360, () => { player.cls = 'warrior'; player.lastHitTime = -9999; player.maxHp = 5000; player.hp = 100; player.mp = 0; hp0 = player.hp; mp0 = player.mp; game.mapData && (game.mapData.isTown = false); });
        out.regen = { ran, hpGain: player.hp - hp0, mpGain: player.mp - mp0, hpRate: 40 }; } finally { window.getEquipBonus = _gb; player.mods.mpRegen = 0; } }
    { const _pa = window.performAround; let pulses = 0; window.performAround = function (r, m) { if (m === 1.32) pulses++; return _pa.apply(this, arguments); };
      try { run(370, () => { player.buffs = { rampage: 9e6 }; player._rampAcc = 0; player.hp = getMaxHp(); }); out.rampagePulses = pulses; } finally { window.performAround = _pa; player.buffs = {}; } }
    T.clear(); player._god = true; player.hp = getMaxHp(); return out; });
  console.log('  timers ' + JSON.stringify(TM));
  check(TM.bonus === 1100, 'timers-3: the +100 ms hit i-frames apply to a contact hit seen 3 steps late (hit-stop)', TM.bonus);
  check(TM.voice && TM.voice.includes('hit'), 'timers-3: ...and the hit grunt plays for it', TM.voice);
  check(TM.downed && TM.downed.buff <= 19100 && TM.downed.cd <= 19100, 'timers-5: a downed hero\'s buffs and skill cooldowns keep draining', TM.downed);
  check(TM.regen && TM.regen.hpGain >= 5 * 4 && TM.regen.mpGain >= 14, 'timers-6: equipment HP regen (per second), base HP regen and base MP regen still tick when their `game.time %` step is a hit-stopped one', TM.regen);
  check(TM.rampagePulses >= 5, 'timers-6: Rampage pulses once a second of simulated time even when its modulo step is hit-stopped (6 s -> 5-6 pulses)', TM.rampagePulses);
  // ---- text / dead-code fixes: source checks ---------------------------------------------------------------------------------------------------
  check(count('hitMonster(tgt, Math.floor(getAtk() * 1.12), false, \'pack\')') === 2 && has("4.4 : 1.6)), false, 'pet')") && !has("rollCrit(), 'pack')") && !has("rollCrit(), 'pet')"), 'sibling-5: pack and pet bites pass false for crit (no gold number, no burnt guaranteed-crit charge)');
  check(has('and each foe held also heals 2% max HP, up to 3 foes a drain') && !has('shared 30%-of-drain return.'), 'sibling-8: Necrotic Ascendance\'s skill text names the 2% rider (3 foes a drain), and the stale 30% comment is gone');
  check(has('_lxMonHitD2(m, ax, ay) <= _R2') && has('_lxMonHitD2(m, _cx, _cy) < 240 * 240'), 'sibling2B-2: the Mirror Shadow finale and the rebirth burn measure the body, not the centre');
  check(has('const _aghLife = (_agh.orbLife != null) ? _agh.orbLife : _agh.life;'), 'diff-c-4: the Aegis orbs fade by their own (longer) life');
  check(has("text: '-' + (player._god ? dmg : _bhLost)") && has("text: '-' + (player._god ? dmg : _mLost)"), 'diff-a-2: the black-hole and meteor-warning numbers print the HP they took');
  check(has("'-' + _sShown + ' STOMP'") && has("'-' + _stShown + ' STINGER'") && has("'-' + _vjShown + ' JUDGMENT'"), 'sibling-9: the stomp, stinger and judgment numbers print the HP they took (floored at 1 HP)');
  // @@SECTIONS@@
  check(errs.length === 0, 'no page errors', errs.slice(0, 3).join(' | '));
} catch (e) { check(false, 'harness ran', String(e && e.stack || e).slice(0, 400)); }
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close(); server.kill();
process.exit(fail ? 1 : 0);
