// skill_measure.js - measure what skills ACTUALLY deal, inside a running game. One implementation for
// the page that edits the numbers (tools/skill_tuner.html drives a hidden frame) and for the harness
// that tabulates them (scripts/skill_tabulation.mjs carries the same routine). The routine is written
// to run INSIDE the game's realm - it names `player`, `game`, `SKILLS`, `castSkill` bare, because the
// game declares them with let/const and they are not properties of its window - so a driver evals its
// source in the target window: lxMeasureSkills(W, ids, opts) does that.
//
// What it holds still, so a number means the same thing every time it is read:
//   crits off (getCritDmg -> 1, rollCrit -> false), Math.random -> 0.95, comboMult -> 1 and critStreak -> 0
//   (the hit-streak multipliers climb 1 -> 5 with every hit of the session), the dummy frozen + stunned and
//   never moved (a piercing shard passes through it once, as in play), ATK 1000 at level 90, no mastery on
//   the basic. "One use" = one press, except Deadeye (6 s window pressed every 430 ms), Protocol (8 s
//   window, every 260 ms) and Bastion of Dawn (armed, pinned to full Dawn Charge, released).
(function (root) {
  'use strict';
  async function lxMeasureInPage(ids, opts) {
    opts = opts || {};
    const WINDOW = opts.window || 10000, BASIC_MS = 1500;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const report = (row) => { try { if (opts.onRow) opts.onRow(row); } catch (e) {} };
    // ---- boot into a map once ----
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!window.__lxMeasureBooted) {
      loadMap('forest', 300); await sleep(2000); game.paused = false;
      for (let i = 0; i < 30 && !player.onGround; i++) await sleep(100);   // the spawn is 36 px above the ground until the first physics frames
      window.__lxMeasureBooted = { x: player.x, y: player.y };
    }
    const spawn = window.__lxMeasureBooted;   // every cast starts here: dash skills carry the player to spots where a dummy spawned ahead drops into a gap
    for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
    game.paused = false;
    try { Object.defineProperty(game, 'comboMult', { get: () => 1, set() {}, configurable: true }); Object.defineProperty(game, 'critStreak', { get: () => 0, set() {}, configurable: true }); Object.defineProperty(game, 'combo', { get: () => 0, set() {}, configurable: true }); } catch (e) {}   // combo 50 grants +50% ATK for 8 s mid-cast
    const _gcd = window.getCritDmg, _rc = window.rollCrit, _rnd = Math.random;
    window.getCritDmg = () => 1; window.rollCrit = () => false; Math.random = () => 0.95;
    let dummies = [], hits = 0;
    const _hm = window.hitMonster;
    window.hitMonster = function (m) { if (dummies.indexOf(m) >= 0) hits++; return _hm.apply(this, arguments); };
    const mk = () => {
      game.monsters.length = 0; dummies = [];
      const m = spawnMonster(player.x + 150, player.y - 10, 'slime', false); if (!m) return;
      m.w = 60; m.h = 60; m.maxHp = 9e12; m.currentHp = 9e12; m.evasion = 0; m.speed = 0; m.atk = 0; m.vx = 0; m.vy = 0;
      m.frozen = 99999; m.stunTimer = 99999; dummies.push(m);
    };
    const setup = (id, bare) => {
      const sk = SKILLS[id];
      player.x = spawn.x; player.y = spawn.y; player.vx = 0; player.vy = 0;
      player.cls = sk.cls; player.job = bare ? null : (sk.job || null); player.masteries = {}; player.master = bare ? null : (sk.master || null); if (player.master) player.masteries[player.master] = true;
      player._god = true; player.level = 90; player.baseAtk = 1000; player.baseCrit = 0; player.mods = player.mods || {}; player.mods.crit = 0;
      player.maxMp = 99999; player.mp = 99999; player.maxHp = 999999; player.hp = 999999; player.facing = 1; player._releasedCharge = 1;
      player.pet = null; player.pack = []; player.ultPet = null; player.buffs = player.buffs || {}; for (const k of Object.keys(player.buffs)) player.buffs[k] = 0;
      if (game.minions) game.minions.length = 0;
      player._ballistaTurrets = []; player._clones = null; player._hexOrbs = null; player._shade = null; player._judgeStacks = 0; player._mirrorBlink = false;
      player._ballistaChannel = null; if (typeof _LX_DE !== 'undefined' && _LX_DE) { _LX_DE.execTally = 0; _LX_DE.meter = 0; _LX_DE.protocolTotal = 0; _LX_DE.tally = 0; }
      player._msWin = null; player._aegis = null; player._eclipseRain = null; player._eclipseHold = null; player._doomWinBonus = null;
      player._necromancerOrbs = null;   // Soul Siphon's Soul Ward, 12 s, 6x-ATK orbs every 1.5 s
      player.dragoonSlam = 0; player._dragoonExtraSlam = 0; player._slamPierceLeft = 0; player._ascended = false;
      player._dawnStored = 0; player._bastionArmAt = 0; player._bastionArmedUntil = 0; player._calamityHeat = 0;
      if (game.orbs) game.orbs.length = 0;
      for (const k of Object.keys(player._cd || {})) player._cd[k] = 0; if (player.cooldowns) for (const k of Object.keys(player.cooldowns)) player.cooldowns[k] = 0;
      game.projectiles.length = 0; if (game.hazards) game.hazards.length = 0;
    };
    const USES = { marksman_oneshot: [Math.floor(6000 / 430), 430], marksman_ult: [Math.floor(8000 / 260), 260] };
    const cast = async (id) => {
      const u = USES[id];
      if (id === 'crusader_ult') { castSkill(id); await sleep(150); player._bastionArmAt = game.time - 600; player._dawnStored = getMaxHp(); castSkill(id); return 2; }
      if (!u) { castSkill(id); return 1; }
      for (let i = 0; i < u[0]; i++) { for (const k of Object.keys(player._cd || {})) player._cd[k] = 0; player.mp = 99999; try { castSkill(id); } catch (e) {} await sleep(u[1]); }
      return u[0];
    };
    const measure = async (id, ms, bare) => {
      setup(id, bare); mk(); hits = 0; if (!dummies.length) return { err: 'no dummy' };
      const d = dummies[0], hp0 = d.currentHp; let presses = 1;
      try { presses = await cast(id); } catch (e) { return { err: 'threw: ' + String(e.message).slice(0, 80) }; }
      const t0 = performance.now();
      while (performance.now() - t0 < ms) { await sleep(200); d.frozen = 99999; d.stunTimer = 99999; d.vx = 0; d.vy = 0; }
      return { total: Math.round(hp0 - d.currentHp), lines: hits, presses };
    };
    const basics = {}; const rows = [];
    try {
      for (const id of ids) {
        const sk = SKILLS[id]; if (!sk) { rows.push({ id, err: 'unknown skill' }); continue; }
        if (basics[sk.cls] === undefined) { const bid = Object.keys(SKILLS).find((k) => SKILLS[k].cls === sk.cls && SKILLS[k].slot === 'd'); basics[sk.cls] = bid ? (await measure(bid, BASIC_MS, true)).total : 0; }
        const r = await measure(id, WINDOW, false);
        const row = Object.assign({ id, name: sk.name, cls: sk.cls, slot: sk.slot, basic: basics[sk.cls], pct: r.total && basics[sk.cls] ? r.total / basics[sk.cls] * 100 : 0 }, r);
        rows.push(row); report(row);
      }
    } finally {
      window.hitMonster = _hm; window.getCritDmg = _gcd; window.rollCrit = _rc; Math.random = _rnd;
    }
    return { ver: (typeof GAME_VERSION !== 'undefined') ? GAME_VERSION : '', rows, basics };
  }
  // Driver: run the routine inside window W (a same-origin frame that has booted the game).
  async function lxMeasureSkills(W, ids, opts) {
    const fn = W.eval('(' + lxMeasureInPage.toString() + ')');
    return fn(ids, opts || {});
  }
  root.lxMeasureInPage = lxMeasureInPage; root.lxMeasureSkills = lxMeasureSkills;
})(typeof globalThis !== 'undefined' ? globalThis : this);
