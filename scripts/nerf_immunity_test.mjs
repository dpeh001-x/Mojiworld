#!/usr/bin/env node
// v0.30.1525 - OVERPOWERED SKILLS, PART 1: IMMUNITY, EXECUTES, RETALIATION (per user: "Fix all that you have suggested", after the
// audit of "skills that might be too overpowered, especially the buffs and those with miscellaneous effects").
//   HOLY    - at rank 10 Holy Shield's near-invulnerable +9999 DEF lasts its 2.5 s (it grew to 12.5 s with rank), partners get a
//             flat 5 s buff, and the reflect window still grows with rank
//   APOTH   - Apotheosis' invulnerability is a flat 5 s at rank 10 (it was 15 s), rank no longer claims to lengthen it, and a
//             Quickening proc cannot re-arm it
//   EXECUTE - an execute window kills a normal foe under its threshold but only damages a mini-boss (it killed them outright)
//   AEGIS   - Divine Aegis' half damage ends at 9 s whatever the rank; its orbs fly on for the rank's extra seconds
//   RETAL   - the Knight's ATK retaliation ('retaliate') is a thorns hit (no miss, combo, weakness; the boss ward is
//             _lxKnightRetaliation's alone) that meets the foe armour
//   [PORT=n] [MOJI_GAME_FILE=x.html] node scripts/nerf_immunity_test.mjs
import { createRequire } from 'node:module'; import path from 'node:path'; import fs from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(import.meta.url)('playwright-core');
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const PORT = Number(process.env.PORT || 11787);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } });
await ctx.addInitScript(() => { try { localStorage.mojiworld_prologue_seen = '1'; } catch (e) {} });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return !!(m && m.offsetParent !== null && m.getClientRects().length); }, null, { timeout: 180000 });
  await page.waitForTimeout(800);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const frames = async (n) => { const t0 = game.time; for (let i = 0; i < 600 && game.time - t0 < n; i++) { game.paused = false; await sleep(20); } };   // a cast's toast or modal can pause the game
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player._storyBeatsSeen = new Proxy({}, { get: () => true });
    loadMap('forest', 300); await sleep(1500); game.paused = true; player.level = 99; player.invulnerable = 0;
    for (const m of game.monsters) if (m) m.x = player.x + 4000;   // nothing touches the hero
    const out = {};
    // HOLY - a crusader at rank 10, a fake socket to read what the partners get
    { const _ca = window._coopActive, _ws = net.ws, sent = [];
      window._coopActive = () => true; net.ws = { readyState: 1, send: (s) => sent.push(JSON.parse(s)) }; net._lastPbufAt = 0; net._pbufHeld = null;
      player.job = 'knight'; player.master = 'crusader'; player.skillRanks = { holyShield: 10 };
      const t0 = game.time; SKILL_FNS.holyShield();
      out.holy = { buff: player.buffs.holyShield, reflectFrames: (player._holyReflectUntil | 0) - t0, defNow: getDef() };
      game.paused = false; await frames(180); game.paused = true;   // 3 s on
      out.holy.defAt3s = getDef(); out.holy.buffAt3s = player.buffs.holyShield;
      out.holy.share = (sent.find((f) => f.pbf && f.bl.some((x) => x[0] === 'holyShield')) || { bl: [] }).bl.find((x) => x[0] === 'holyShield');
      window._coopActive = _ca; net.ws = _ws; player.skillRanks = {}; player.buffs.holyShield = 0; player.invulnerable = 0; }
    // APOTH - an archbishop at rank 10; Quickening at 100%
    applyClass('mage'); player.level = 99; player.job = SKILLS.archbishop_ult.job; player.master = 'archbishop'; player.skillRanks = { archbishop_ult: 10 };
    player.invulnerable = 0; SKILL_FNS.archbishop_ult(); out.apoth = { invuln: player.invulnerable, inRankDur: LX_RANK_DUR_IDS.has('archbishop_ult') };
    player.invulnerable = 0; player.mods.cdrChance = 1; player.skillCooldowns = {}; player.mp = player.maxMp = 99999; player._castLockUntil = 0;
    try { castSkill('archbishop_ult'); } catch (e) { out.apoth.err = String(e).slice(0, 80); }
    out.apoth.cdAfterQuicken = player.skillCooldowns.archbishop_ult | 0; player.mods.cdrChance = 0; player.skillRanks = {};
    // EXECUTE - a 25% window, a normal foe and a mini-boss each at 20% before the hit
    { const _mw = window._msWin; window._msWin = () => ({ execute: { frac: 0.25, bossMul: 1.25 } });
      const mk = (mini) => { const m = game.monsters.find((x) => x && x.currentHp > 0 && !x.isBoss && !x.boss && !x._t); m._t = 1;
        Object.assign(m, { maxHp: 1000, currentHp: 200, isMiniBoss: mini, isElite: false }); return m; };
      const a = mk(false), b = mk(true);
      out.exec = { normal: _msApplyOnHit(a, 10, false, 'melee'), mini: _msApplyOnHit(b, 10, false, 'melee'), miniBossMul: Math.floor(10 * 1.25) };
      window._msWin = _mw; }
    // AEGIS - a crusader at rank 10: half damage 9 s, orbs 9 x 1.2 + 10 = 20.8 s
    applyClass('warrior'); player.level = 99; player.job = 'knight'; player.master = 'crusader'; player.skillRanks = { crusader_aegis: 10 };
    player._aegis = null; player._aegisOrbs = null; SKILL_FNS.crusader_aegis();
    out.aegis = { drLife: player._aegis && player._aegis.life, orbLife: player._aegis && player._aegis.orbLife, orbs: player._aegis ? player._aegis.orbs.length : 0 };
    player._aegis.life = 30; player._aegis.orbLife -= 9000 - 30;   // fast-forward to the end of the 9 s window
    // the cast's own hit-stop (addHitStop(60)) skips updates while game.time runs on, so wait for the hand-off, not a frame count
    for (let i = 0; i < 300 && player._aegis; i++) { game.paused = false; game.hitStop = 0; await sleep(20); } game.paused = true;
    out.aegis.drAfter = !!player._aegis; out.aegis.orbsAfter = player._aegisOrbs ? player._aegisOrbs.orbs.length : 0; out.aegis.orbLeft = player._aegisOrbs ? Math.round(player._aegisOrbs.life) : 0;
    player._aegisOrbs = null; player.skillRanks = {};
    // RETAL - a 1000-DEF foe that dodges everything and is weak to the hero, combo x5: thorns land whole; the retaliation meets
    // the armour curve and nothing else (it is a thorns hit in every other way)
    { const m = game.monsters.find((x) => x && x.currentHp > 0 && !x.isBoss && !x.boss);
      Object.assign(m, { maxHp: 1e9, currentHp: 1e9, def: 1000, evasion: 9999, traits: null, isElite: false, isMiniBoss: false, _firstHit: true });
      const _wk = LX_MOB_WEAK[m.type]; LX_MOB_WEAK[m.type] = _lxDmgClass('melee'); const weakSetUp = _lxWeakAffinity(m, 'melee') === 'weak';
      game.comboMult = 5; game.critStreak = 0;
      const h0 = m.currentHp; hitMonster(m, 100000, false, 'thorns'); const th = h0 - m.currentHp;
      const h1 = m.currentHp; hitMonster(m, 100000, false, 'retaliate'); const re = h1 - m.currentHp;
      game.comboMult = 1; if (_wk === undefined) delete LX_MOB_WEAK[m.type]; else LX_MOB_WEAK[m.type] = _wk;
      const dv = ((m.def || 0) * _mobArmorClass(m) + _lvGapDefAdd(m)) * _mobDefVar(m) * (1 - _lxDefPierce('thorns'));
      out.retal = { weakSetUp, thorns: th, retaliate: re, armourOnly: Math.max(1, Math.floor(100000 * 300 / (dv + 300))) }; }
    // RETAL vs a boss ward: _lxKnightRetaliation already sends 1 in a ward and x1.5 in its break, so the hit layer must not add
    // the ward again (it fed the gauge twice and made a break x2.25)
    { spawnMonster(player.x + 4000, player.y, 'kingKrook', true); const bm = game.monsters[game.monsters.length - 1];
      Object.assign(bm, { maxHp: 9e12, currentHp: 9e12, _wardNextAt: 1e12, _wardUntil: 0, _wardBreakUntil: 0, _wardGauge: 0 });
      const hit = (raw) => { bm._stagger = 0; bm._dirOpenT = 0; game.critStreak = 0; const h = bm.currentHp; hitMonster(bm, raw, false, 'retaliate'); return h - bm.currentHp; };
      const plain = hit(_lxKnightRetaliation(bm, 5));
      bm._wardBreakUntil = (game.time | 0) + 600; const broken = hit(_lxKnightRetaliation(bm, 5)); bm._wardBreakUntil = 0;
      bm._wardUntil = (game.time | 0) + 600; bm._wardGauge = 0; const warded = hit(_lxKnightRetaliation(bm, 5)); const fed = bm._wardGauge;
      bm.currentHp = 0; bm._dying = true; game.monsters = game.monsters.filter((x) => x !== bm);
      out.ward = { isBoss: !!bm.isBoss, plain, broken, ratio: +(broken / plain).toFixed(3), warded, fed, oneFeed: LX_WARD_FILL_MIN }; }
    return out;
  });
  const H = R.holy;
  ok('HOLY: rank 10 still buys the full 2.5 s near-invulnerability at cast', H.buff === 5000 && H.defNow > 9000, JSON.stringify({ buff: H.buff, def: H.defNow }));
  ok('HOLY: 3 s in, the +9999 DEF is over (rank no longer stretches it)', H.defAt3s < 9000, JSON.stringify({ def: H.defAt3s, buff: Math.round(H.buffAt3s) }));
  ok('HOLY: partners get a flat 5 s buff (2.5 s shield)', !!H.share && H.share[1] === 5000, JSON.stringify(H.share));
  ok('HOLY: the reflect window still grows with rank (15 s at rank 10)', H.reflectFrames >= 890 && H.reflectFrames <= 910, H.reflectFrames);
  ok('APOTH: rank 10 Apotheosis is 5 s of invulnerability, and rank no longer claims a longer duration', R.apoth.invuln === 5000 && R.apoth.inRankDur === false, JSON.stringify(R.apoth));
  ok('APOTH: a 100% Quickening proc cannot re-arm it', !R.apoth.err && R.apoth.cdAfterQuicken > 0, JSON.stringify(R.apoth));
  ok('EXECUTE: a normal foe under the threshold dies outright', R.exec.normal === 200, JSON.stringify(R.exec));
  ok('EXECUTE: a mini-boss under the threshold takes the boss multiplier instead', R.exec.mini === R.exec.miniBossMul, JSON.stringify(R.exec));
  const A = R.aegis;
  ok('AEGIS: half damage lasts 9 s at rank 10; the orbs get 9 x 1.2 + 10 = 20.8 s', A.drLife === 9000 && A.orbLife === 20800 && A.orbs === 5, JSON.stringify(A));
  ok('AEGIS: when the 9 s end, the half damage is gone and the 5 orbs fly on for their remaining ~11.8 s', !A.drAfter && A.orbsAfter === 5 && A.orbLeft > 10500 && A.orbLeft < 12000, JSON.stringify(A));
  const T = R.retal;
  ok('RETAL: against a 1000-DEF foe that dodges everything and is weak to the hero, at combo x5, the share (thorns) lands whole', T.weakSetUp && T.thorns === 100000, JSON.stringify(T));
  ok('RETAL: the retaliation lands too, at exactly the armour curve - no miss, combo, weakness or resistance', T.retaliate === T.armourOnly && T.retaliate < 40000, JSON.stringify(T));
  const W = R.ward;
  ok('RETAL: in a boss ward-break window the retaliation is x1.5 once (the hit layer no longer adds a second x1.5)', W.isBoss && W.ratio >= 1.45 && W.ratio <= 1.55, JSON.stringify(W));
  ok('RETAL: in a boss ward the retaliation lands 1 and fills the break gauge once', W.warded === 1 && Math.abs(W.fed - W.oneFeed) < 1e-9, JSON.stringify(W));
  ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
} catch (e) { ok('harness ran', false, String(e).slice(0, 200)); }
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close(); server.kill();
process.exit(fail ? 1 : 0);
