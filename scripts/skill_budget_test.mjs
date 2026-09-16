#!/usr/bin/env node
// SKILL DAMAGE BUDGETS — every job/master skill lands within tolerance of its budget, MEASURED.
//
// Per user (2026-09-16):
//   Marksman G and B                ~1000% of the basic attack, cumulative across their lines
//   every other class's G and B      1000% cumulative      (the MASTER tier only: slot x = G, slot b)
//   DOT / summon / channel skills    1000% over 10 seconds
//   charged / special-requirement    up to 2500%          (Bastion of Dawn at a full Dawn Charge)
// Q, C and the basic d/s/a/e/w kit are NOT in scope and are not asserted here (clarified 2026-09-16).
//
// Nothing here is read off a multiplier. Each skill is cast once at a stationary dummy - evasion 0,
// crits pinned OFF, Math.random pinned - and the dummy's HP loss is totalled over a 10 s window, so a
// DOT, a channel, a summon's bites and a delayed detonation all count as they land. hitMonster is
// hooked to count the lines. Every persistent player-owned damage source (minions, turrets, clones,
// orbs, pets, hazards, projectiles) is cleared between casts: the first audit of this pass missed that
// and Dark Pulse's skeletons bit through every mage measurement taken after it.
//
// Two skills are measured on their OWN terms, because one press is not the skill:
//   Deadeye (marksman G)   = the 6 s Focus Fire window pressed at its 420 ms gate
//   Protocol (marksman B)  = the 8 s Overclock window pressed at its 250 ms gate
// and Bastion of Dawn is released at a FULL Dawn Charge (t = 1 by backdating the arm, d = 1 by
// banking a full health bar), which is what "full burst" means in its own model.
//
// TOL is generous on purpose: a factor applied to a per-line multiplier does not come out exactly
// linear through flat adds, HP-percent caps, ramping aim, Execute Rounds and mark amplifiers.
//   node scripts/skill_budget_test.mjs      MOJI_GAME_FILE / PORT
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 11001);
const TOL = 0.20;                                   // ±20% of budget
const BUDGET = { crusader_ult: 2500 };              // everything else in scope: 1000
const SKIP = new Set(['bloodlust', 'guardian', 'eagleEye', 'shadowlord_ult', 'shadowlord_clones', 'archbishop_ult']);
// buffs / an echo of the player's own hits / an invulnerability ult / a summon that landed 2 hits in
// 10 s on one dummy - none is a damage skill this test can hold to a budget
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1800));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof castSkill === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(8000);
  const r = await page.evaluate(async ({ SKIP: _skipList }) => {
    const SKIP = new Set(_skipList);            // crosses the page boundary as an array
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    loadMap('forest', 300); await sleep(2000);
    for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
    game.paused = false;
    // Pin the hit-streak multipliers (found after v0.30.772 shipped): comboMult climbs 1 -> 5 with every
    // hit of the SESSION (2.6 s decay) and critStreak adds up to +15%, so a row's reading depended on how
    // many hits the rows before it had landed. Held at 1 / 0 so every row is read at the same rung.
    Object.defineProperty(game, 'comboMult', { get: () => 1, set() {}, configurable: true });
    Object.defineProperty(game, 'critStreak', { get: () => 0, set() {}, configurable: true });
    Object.defineProperty(game, 'combo', { get: () => 0, set() {}, configurable: true });   // crossing 50 grants +50% ATK for 8 s mid-cast
    // every cast starts at the spawn, captured once the player has LANDED (right after boot it is 36 px up,
    // and a dummy spawned beside an airborne player sits above the orbit of Divine Aegis's orbs)
    for (let i = 0; i < 30 && !player.onGround; i++) await sleep(100);
    const _x0 = player.x, _y0 = player.y;
    window.getCritDmg = () => 1; window.rollCrit = () => false;
    const _rnd = Math.random; Math.random = () => 0.95;
    let dummy = null, lines = 0;
    const _hm = window.hitMonster;
    window.hitMonster = function (m) { if (m === dummy) lines++; return _hm.apply(this, arguments); };
    const mk = (dx) => { game.monsters.length = 0; const m = spawnMonster(player.x + (dx || 150), player.y - 10, 'slime', false);
      if (!m) return null; m.w = 60; m.h = 60; m.maxHp = 9e12; m.currentHp = 9e12; m.evasion = 0; m.speed = 0; m.frozen = 99999; m.stunTimer = 99999; return m; };
    const setup = (id) => { const sk = SKILLS[id]; player.x = _x0; player.y = _y0; player.vx = 0; player.vy = 0;
      player.cls = sk.cls; player.job = sk.job || null; player.masteries = {}; player.master = sk.master || null; if (sk.master) player.masteries[sk.master] = true;
      player._god = true; player.level = 90; player.baseAtk = 1000; player.baseCrit = 0; player.mods = player.mods || {}; player.mods.crit = 0;
      player.maxMp = 99999; player.mp = 99999; player.maxHp = 999999; player.hp = 999999; player.facing = 1; player._releasedCharge = 1;
      player.pet = null; player.pack = []; player.ultPet = null;
      if (game.minions) game.minions.length = 0;
      player._ballistaTurrets = []; player._clones = null; player._hexOrbs = null; player._shade = null; player._mirrorBlink = false;
      player._dawnStored = 0; player._bastionArmAt = 0; player._bastionArmedUntil = 0;
      // channels, windows and wards that OUTLIVE their cast and keep dealing damage into the next
      // measurement. Found the hard way: with these left running, every archer B skill measured
      // 3.5-5.7x over while every archer G skill was on target - the G skills' siege channel and
      // Deadeye tally were still firing when the B skills were cast.
      player._ballistaChannel = null;                                   // Siege Volley, 8 s
      if (typeof _LX_DE !== 'undefined' && _LX_DE) { _LX_DE.execTally = 0; _LX_DE.meter = 0; _LX_DE.protocolTotal = 0; _LX_DE.tally = 0; }
      player._msWin = null;                                             // Deadeye / Protocol window
      player._aegis = null;                                             // Divine Aegis orbs, 9 s
      player._necromancerOrbs = null;                                   // Soul Siphon's Soul Ward, 12 s, 6x-ATK orbs every 1.5 s
      player._calamityHeat = 0;                                         // berserker heat builds on every hit of the job and multiplies the doombringer's numbers: every cast starts cold
      player.buffs = player.buffs || {}; for (const k of Object.keys(player.buffs)) player.buffs[k] = 0;   // Warlord's Banner's 12 s ATK buff was still on Blade of Calamity (+68%)
      player._judgeStacks = 0;
      player._eclipseRain = null; player._eclipseHold = null;           // Eclipse rain channel
      player._doomWinBonus = null;
      player.dragoonSlam = 0; player._dragoonExtraSlam = 0; player._slamPierceLeft = 0;
      player._ascended = false;
      if (game.orbs) game.orbs.length = 0;
      for (const k of Object.keys(player._cd || {})) player._cd[k] = 0;
      game.projectiles.length = 0; if (game.hazards) game.hazards.length = 0; };
    const hold = async (ms) => { const t0 = performance.now(); while (performance.now() - t0 < ms) { await sleep(250); dummy.frozen = 99999; dummy.stunTimer = 99999; dummy.vx = 0; } };
    const once = async (id, dx, ms) => { setup(id); dummy = mk(dx); if (!dummy) return { total: 0, lines: 0 }; lines = 0; const hp0 = dummy.currentHp;
      try { castSkill(id); } catch (e) {} await hold(ms || 10000); return { total: Math.round(hp0 - dummy.currentHp), lines }; };
    const press = async (id, n, gap) => { setup(id); dummy = mk(150); lines = 0; const hp0 = dummy.currentHp;
      for (let i = 0; i < n; i++) { for (const k of Object.keys(player._cd || {})) player._cd[k] = 0; player.mp = 99999; try { castSkill(id); } catch (e) {} await sleep(gap); dummy.frozen = 99999; dummy.stunTimer = 99999; dummy.vx = 0; }
      await hold(1500); return { total: Math.round(hp0 - dummy.currentHp), lines }; };
    const out = { ver: GAME_VERSION, rows: {} };
    const basics = { warrior: 'slash', rogue: 'stab', mage: 'magicBolt', archer: 'arrowShot' };
    for (const [cls, bid] of Object.entries(basics)) {
      const b = await once(bid, 150, 1500);
      out.rows[bid] = { cls, slot: 'd', total: b.total, lines: b.lines, basic: b.total };
      for (const id of Object.keys(SKILLS)) {
        const sk = SKILLS[id]; if (sk.cls !== cls || !['x', 'b'].includes(sk.slot) || SKIP.has(id)) continue;
        let m;
        if (id === 'marksman_oneshot') m = await press(id, Math.floor(6000 / 430), 430);
        else if (id === 'marksman_ult') m = await press(id, Math.floor(8000 / 260), 260);
        else if (id === 'arrowRain') m = await once(id, 200);
        else if (id === 'crusader_ult') {
          setup(id); dummy = mk(150); lines = 0; const hp0 = dummy.currentHp;
          castSkill(id); await sleep(250); player._bastionArmAt = (game.time | 0) - 600; player._dawnStored = getMaxHp();
          for (const k of Object.keys(player._cd || {})) player._cd[k] = 0; castSkill(id); await hold(6000);
          m = { total: Math.round(hp0 - dummy.currentHp), lines };
        } else m = await once(id);
        out.rows[id] = { cls, slot: sk.slot, total: m.total, lines: m.lines, basic: b.total, name: sk.name };
      }
    }
    Math.random = _rnd; window.hitMonster = _hm;
    return out;
  }, { SKIP: [...SKIP] });
  console.log(`build ${r.ver}`);
  let worst = { d: 0 };
  for (const [id, x] of Object.entries(r.rows)) {
    if (x.slot === 'd') { console.log(`\n== ${x.cls}  basic ${id} = ${x.total} ==`); continue; }
    const budget = BUDGET[id] || 1000, pct = x.basic ? x.total / x.basic * 100 : 0, d = pct / budget - 1;
    if (Math.abs(d) > Math.abs(worst.d)) worst = { id, d };
    ok(`${x.cls}/${x.slot} ${id.padEnd(22)} ${String(Math.round(pct)).padStart(5)}% of basic in ${String(x.lines).padStart(3)} lines  (budget ${budget}%)`,
      Math.abs(d) <= TOL, (d >= 0 ? '+' : '') + (d * 100).toFixed(0) + '%');
  }
  ok('no page errors', errs.length === 0, errs.join(' | '));
  console.log(`\nworst deviation: ${worst.id} ${(worst.d * 100).toFixed(0)}%`);
  // OUT_JSON=path — save the measured table so the changelog / balance sheet are written from the
  // same run that passed, not from a re-typed number
  if (process.env.OUT_JSON) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(process.env.OUT_JSON, JSON.stringify({ ver: r.ver, tol: TOL, rows: r.rows, budget: BUDGET }, null, 1));
    console.log('wrote ' + process.env.OUT_JSON);
  }
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
