#!/usr/bin/env node
// v0.30.1462 MOBBING SPREAD, every class (per user: "for mobbing skills if it spreads out to more foes make it such that the damage
// to multiple foes dip slightly but does not if its just to 1 foe", "ensure other classes also have the same treatment for the
// mobbing skills"). One AREA hit counts the foes it catches: a lone foe takes all of it, each foe past the first takes 5% off
// every share, down to 80% (_lxSpreadMul). Measured per foe in the running game, 1 / 2 / 3 / 6 foes inside the hit, crits and
// milestone procs off, Math.random seeded, foes pinned, every scenario from the same spot:
//   - KNIGHT  Holy Shield's waves, Bastion of Dawn's burst (a panic release), Skyfall Dominion's quake
//   - WARRIOR War Cry (a custom area loop)       - ROGUE Death Blossom (a custom area loop)
//   - MAGE    Arcane Burst (performAround)       - an explosive shot's impact blast (mage / archer projectiles)
//   - every foe of a hit takes the same share
//   - NOT SHARED: a basic swing (performMelee basic), performAround({ spread: false }); a group's share is spent on its own hits
//   - COVERAGE: the source queues 30 custom area loops on an _lxAreaGroup and pre-counts 3 (Grand Hex)
//   [PORT=n] [MOJI_GAME_FILE=x.html] node scripts/mob_spread_test.mjs
import { createRequire } from 'node:module'; import path from 'node:path'; import fs from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(import.meta.url)('playwright-core');
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const PORT = Number(process.env.PORT || 11761);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + x + ']' : '')); };
const srcPath = process.env.MOJI_GAME_FILE ? path.resolve(process.env.MOJI_GAME_FILE) : path.join(ROOT, 'mojiworld_game.html');
const src = fs.readFileSync(srcPath, 'utf8');
ok('coverage: 30 custom area loops queue their hits on an _lxAreaGroup', src.split('= _lxAreaGroup(); ').length - 1 === 30, src.split('= _lxAreaGroup(); ').length - 1);
ok('coverage: 3 Grand Hex loops count first and keep their hits in place (a hex stack follows each hit)', src.split('{ _lxShareCur = _mbS').length - 1 === 3, src.split('{ _lxShareCur = _mbS').length - 1);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const errs = [];
// one scenario per FRESH page: nothing a scenario leaves behind (ranks, windows, buffs, an armed Bastion) reaches the next
const GROUPS = ['holy', 'bastion', 'quake', 'warcry', 'blossom', 'arcane', 'shot', 'ctl'];
const PAGEFN = async (only) => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; window._lxAwaitingCreation = false;
    player.cls = 'warrior'; player.job = 'knight'; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    loadMap('forest', 300); await new Promise((res) => setTimeout(res, 1500)); game.paused = false;
    try { Object.defineProperty(game, 'comboMult', { get: () => 1, set() {}, configurable: true }); } catch (e) {}
    try { Object.defineProperty(game, 'critStreak', { get: () => 0, set() {}, configurable: true }); } catch (e) {}
    window.getCrit = () => 0; window.getCritDmg = () => 1;   // no crits: a forced crit (Shatter Point on a frozen foe) is a proc, not the share
    window._msWin = () => null;                             // no milestone windows: their chain arc is a proc, not the share
    { let a = 7; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let q = Math.imul(a ^ a >>> 15, 1 | a); q = q + Math.imul(q ^ q >>> 7, 61 | q) ^ q; return ((q ^ q >>> 14) >>> 0) / 4294967296; }; }
    player.level = 90; player._god = true; player.baseAtk = 1000; player.baseCrit = 0; player.mods = player.mods || {}; player.mods.crit = 0;
    const X0 = player.x, Y0 = player.y;   // every scenario starts from the same spot
    const snap = (v) => JSON.parse(JSON.stringify(v == null ? null : v));
    const R0 = { skillRanks: snap(player.skillRanks), skillRankPoints: snap(player.skillRankPoints), mastery: snap(player.mastery) };   // casting earns rank: restore it, or a later cast hits harder
    const t = (game.mapData.spawns.find((sp) => sp && sp.type && !sp.boss) || {}).type || Object.keys(monsterTypes)[0];
    let foes = [], by = new Map();
    const pin = () => { for (const x of foes) { x.currentHp = x.maxHp; x.x = x._px; x.y = x._py; x.vx = 0; x.vy = 0; x.freezeTimer = 0; x.stunTimer = 0; } player.mp = 9e9; player.hp = getMaxHp(); game.paused = false; };
    const setFoes = (n, dx0 = 50) => {
      game.monsters = []; game.projectiles.length = 0; if (game.hazards) game.hazards.length = 0; foes = []; by = new Map();
      for (let k = 0; k < n; k++) {
        spawnMonster(player.x + dx0 + k * 12, player.y, t, false);
        const x = game.monsters[game.monsters.length - 1];
        x.maxHp = x.currentHp = 9e12; x.def = 0; x.evasion = 0; x.invulnerable = 0; x.traits = {}; x._defVar = 1; x._dmgTakenMul = 1; x._px = x.x; x._py = x.y; foes.push(x);
      }
    };
    const orig = window.hitMonster;
    window.hitMonster = function (m, dmg, c, tag) {
      const b = m && m.currentHp; const rr = orig.apply(this, arguments);
      if (m && typeof b === 'number' && foes.includes(m)) { const e = by.get(m) || {}; e[tag || '?'] = (e[tag || '?'] || 0) + Math.max(0, b - m.currentHp); by.set(m, e); }
      return rr;
    };
    const run = async (ms) => { const t0 = performance.now(); while (performance.now() - t0 < ms) { pin(); await new Promise((res) => requestAnimationFrame(res)); } };
    const per = (tag, skip) => { const v = foes.filter((q) => q !== skip).map((q) => ((by.get(q) || {})[tag]) || 0); return { mean: v.reduce((a, b) => a + b, 0) / Math.max(1, v.length), lo: Math.min(...v), hi: Math.max(...v) }; };
    const unlock = () => { player._skillLockTimer = 0; player._castLockUntil = 0; player.attackCooldown = 0; };
    const reset = (cls, job, master) => {
      player.cls = cls; player.job = job; player.master = master; player.skillCooldowns = {}; player.buffs = {}; player._activeSynergies = {};
      player._bastionArmedUntil = 0; player._bastionArmAt = 0; player._dawnStored = 0; player.invulnerable = 0;
      player.x = X0; player.y = Y0; player.vx = 0; player.vy = 0; player.facing = 1; unlock();
      for (const k in R0) if (R0[k] != null) player[k] = snap(R0[k]);
    };
    const NS = [1, 2, 3, 6], out = {};
    const skill = async (label, [cls, job, master], id, tag, ms, release) => {
      const res = {};
      for (const n of NS) {
        reset(cls, job, master); await run(250); reset(cls, job, master); setFoes(n); pin();   // a class change settles over a frame or two
        castSkill(id);
        if (release) { await run(300); unlock(); player._bastionArmAt = game.time | 0; player._bastionArmHeld = false; player._dawnStored = 0; castSkill(id); }   // the key is let go (a held arm refuses a release inside 12 frames), then released at no charge
        await run(ms); res[n] = per(tag); await run(200);
      }
      out[label] = res;
    };
    const K = ['warrior', 'knight', 'crusader'];
    if (only === 'holy') await skill("Holy Shield's waves (Knight)", K, 'holyShield', 'holyShield', 1400);
    if (only === 'bastion') await skill("Bastion of Dawn's burst (Crusader)", K, 'crusader_ult', 'aoe', 1800, true);
    if (only === 'quake') await skill("Skyfall Dominion's quake (Dragoon)", ['warrior', 'knight', 'dragoon'], 'dragoon_ult', 'aoe', 2600);
    if (only === 'warcry') await skill('War Cry (warrior)', ['warrior', 'berserker', 'warlord'], 'warCry', 'warCry', 900);
    if (only === 'blossom') await skill('Death Blossom (rogue)', ['rogue', 'ninja', 'shinobi'], 'deathBlossom', 'deathBlossom', 1600);
    if (only === 'arcane') await skill('Arcane Burst (mage)', ['mage', 'archmage', 'sage'], 'arcaneBurst', 'aoe', 900);
    if (only === 'shot') { const res = {};   // an explosive shot: it strikes the first foe, and its impact blast is the area hit (0.7x) on the rest
      for (const n of [2, 3, 4, 7]) {
        reset('mage', 'archmage', 'sage'); await run(250); reset('mage', 'archmage', 'sage'); setFoes(n, 160); pin();
        game.projectiles.push({ x: player.x + 60, y: foes[0].y + foes[0].h / 2 - 5, vx: 12, vy: 0, w: 10, h: 10, life: 40, damage: 1000, owner: 'player', skill: 'fireball', explode: 170, noGravity: true });
        await run(900); res[n - 1] = per('fireball', foes[0]);
      }
      out['an explosive shot\'s impact blast (mage / archer)'] = res;
    }
    // not shared: a basic swing; performAround({ spread: false }); a queued group's share is spent on its own hits
    if (only === 'ctl') {
    const direct = async (n, f) => { reset('warrior', 'berserker', 'warlord'); await run(250); reset('warrior', 'berserker', 'warlord'); setFoes(n); pin(); f(); await run(60); };
    out.ctl = {};
    await direct(1, () => performMelee(200, 1.1, { basic: true })); out.ctl.basic1 = per('melee').mean;
    await direct(6, () => performMelee(200, 1.1, { basic: true })); out.ctl.basic6 = per('melee').mean;
    await direct(1, () => performMelee(200, 2, {})); out.ctl.skill1 = per('meleeSkill').mean;
    await direct(6, () => performMelee(200, 2, {})); out.ctl.skill6 = per('meleeSkill').mean;
    await direct(1, () => performAround(260, 3, { spread: false })); out.ctl.off1 = per('aoe').mean;
    await direct(6, () => performAround(260, 3, { spread: false })); out.ctl.off6 = per('aoe').mean;
    await direct(6, () => { const g = _lxAreaGroup(); for (const q of foes) g.hit(q, 5000, false, 'probe'); g.run(); hitMonster(foes[0], 5000, false, 'after'); });
    out.ctl.group6 = per('probe').mean; out.ctl.after = (by.get(foes[0]) || {}).after || 0; out.ctl.shareLeft = _lxShareCur;
    await direct(1, () => { const g = _lxAreaGroup(); g.hit(foes[0], 5000, false, 'probe'); g.run(); }); out.ctl.group1 = per('probe').mean;
    }
    window.hitMonster = orig;
    return out;
};
try {
  const r = {};
  for (const g of GROUPS) {
    const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } }); const page = await ctx.newPage();
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
    await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
    await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => typeof game === 'object' && typeof castSkill === 'function' && typeof loadMap === 'function', null, { timeout: 180000 });
    await page.waitForTimeout(5000);
    Object.assign(r, await page.evaluate(PAGEFN, g));
    await ctx.close();
  }
  const want = { 1: 1, 2: 0.95, 3: 0.9, 6: 0.8 };
  for (const [label, s] of Object.entries(r)) {
    if (label === 'ctl') continue;
    const one = s[1].mean;
    ok(`${label}: a lone foe takes the whole hit`, one > 0, `${Math.round(one)} per foe`);
    ok(`${label}: shared 1 / 0.95 / 0.9 / 0.8 across 1, 2, 3, 6 foes`, Object.keys(want).every((n) => Math.abs(s[n].mean / one - want[n]) < 0.02),
      Object.keys(want).map((n) => `${n}: ${(s[n].mean / one).toFixed(3)}`).join(', '));
    ok(`${label}: every foe of a hit takes the same share`, Object.keys(want).every((n) => s[n].hi - s[n].lo <= Math.max(2, 0.01 * s[n].hi)),
      Object.keys(want).map((n) => `${n}: ${Math.round(s[n].lo)}-${Math.round(s[n].hi)}`).join(', '));
  }
  const c = r.ctl;
  ok('not shared: a basic swing hits 6 foes as hard as 1', c.basic1 > 0 && Math.abs(c.basic6 / c.basic1 - 1) < 0.02, `${Math.round(c.basic1)} vs ${Math.round(c.basic6)}`);
  ok('a melee SKILL sweep is shared (6 foes -> 0.8)', c.skill1 > 0 && Math.abs(c.skill6 / c.skill1 - 0.8) < 0.02, (c.skill6 / c.skill1).toFixed(3));
  ok('performAround({ spread: false }) is not shared', c.off1 > 0 && Math.abs(c.off6 / c.off1 - 1) < 0.02, `${Math.round(c.off1)} vs ${Math.round(c.off6)}`);
  ok('an area group lands 6 hits at 0.8 and 1 hit whole; its share is spent', Math.abs(c.group6 / c.group1 - 0.8) < 0.02 && Math.abs(c.after / c.group1 - 1) < 0.02 && c.shareLeft === 1,
    `6: ${(c.group6 / c.group1).toFixed(3)}, the next hit ${(c.after / c.group1).toFixed(3)}, share left ${c.shareLeft}`);
} catch (e) { ok('harness ran', false, String(e).slice(0, 200)); }
if (errs.length) console.log('page errors: ' + errs.slice(0, 3).join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close(); server.kill();
process.exit(fail ? 1 : 0);
