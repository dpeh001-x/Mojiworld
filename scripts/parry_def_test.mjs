#!/usr/bin/env node
// v0.30.1506 - THE PARRY STRIKES BACK FROM DEF (per user: "Parry skill should deal damage based on a player's DEF, try to scale it
// such that it does about 3-10x the DEF appropriately to deal sufficient amount that does not OHKO monsters").
// v0.30.1509 (per user: "raise the cap so parries stay big late game"): the multiple climbs on past 10x
//   MULTIPLE  - 3x through Lv 30, 6.5x at 40, 18x at 50, 40x at 60, 60x at 70, 120x from Lv 80 (straight lines between),
//               never falling
//   NEUTRAL   - the counter is reactive force, like thorns: the foe's weakness / resistance does not touch it
//   COUNTER   - every class's parry hits its attacker for exactly multiple x DEF (an armourless dummy, combo x1), tagged 'parry'
//   ROGUE     - the rogue's ATK counter-strike still lands on top of it
//   SHIELD    - Holy Shield's +9999 (2.5 s of invulnerability) is held out of the DEF the counter reads, and the buff is left as it was
//   SURE HIT  - an untouchable dummy (evasion 9999) is still struck by every parry
//   NO OHKO   - a full-health foe always survives, at combo x5 under War Cry, and the rogue's extra strike shares the same budget
//   FINISH    - a foe already under half its health can be finished by a parry
//   TEXT      - the skill-bar tooltip and the K panel quote it
//   [PORT=n] [MOJI_GAME_FILE=x.html] node scripts/parry_def_test.mjs
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(import.meta.url)('playwright-core');
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const PORT = Number(process.env.PORT || 11783);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } });
await ctx.addInitScript(() => { try { localStorage.mojiworld_prologue_seen = '1'; } catch (e) {} });   // no prologue film over the game
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return !!(m && m.offsetParent !== null && m.getClientRects().length); }, null, { timeout: 180000 });
  await page.waitForTimeout(800);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player._storyBeatsSeen = new Proxy({}, { get: () => true });
    loadMap('forest', 300); await sleep(1500); game.paused = true;   // nothing moves: every number below is the parry's alone
    player.invulnerable = 9e9;
    const out = {};
    // an armourless, trait-free stand-in made from a live forest monster. Its type keeps its weakness (the counter must ignore
    // it), and it is marked as already shot so the archer's +30% first-hit perk (a class perk on every hit) stays out of the sums
    const dummy = (hp, max, eva) => {
      const m = game.monsters.find((x) => x && x.currentHp > 0 && !x.isBoss && !x.boss && !x.zodiacBoss && !x.isMiniBoss);
      Object.assign(m, { def: 0, traits: null, evasion: eva || 0, isElite: false, _dirGhostT: 0, _libraShield: 0, _libraOrb: false, maxHp: max, currentHp: hp, stunTimer: 0, _firstHit: true });
      return m;
    };
    out.weak = (() => { const m = dummy(1e7, 1e7); return { type: m.type, weak: LX_MOB_WEAK[m.type] || null, melee: _lxWeakAffinity(m, 'melee'), parry: _lxWeakAffinity(m, 'parry') }; })();
    // combo and crit streak reset each time: the rogue's strike counts as a crit, and the streak's +3% a hit would otherwise carry
    // into the next parry (the sim is paused, so its 2.5 s decay never runs)
    const parry = (m, combo) => { player.invulnerable = 9e9; player.blockTimer = 0; player.parryWindow = 0; game.combo = 0; game.comboMult = combo || 1; game.critStreak = 0; const h = m.currentHp; triggerParry(m); return h - m.currentHp; };
    const as = (cls, lv) => { applyClass(cls); player.level = lv; player.buffs = {}; player.invulnerable = 9e9; };
    // MULTIPLE
    out.mul = [1, 20, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 99].map((l) => +_lxParryMul(l).toFixed(3));
    out.mono = true; for (let l = 2; l <= 120; l++) if (_lxParryMul(l) < _lxParryMul(l - 1)) out.mono = false;
    // COUNTER, every class at Lv 40 (6.5x) and the warrior at Lv 10 and 60
    out.cls = {};
    for (const [cls, lv] of [['warrior', 40], ['mage', 40], ['archer', 40], ['rogue', 40], ['warrior', 10], ['warrior', 60]]) {
      as(cls, lv); const m = dummy(1e7, 1e7); const gap = _lvGapDefAdd(m);
      const _af = _lxWeakAffinity(m, 'melee'), _am = _af === 'weak' ? LX_WEAK_MUL : _af === 'resist' ? LX_RESIST_MUL : 1;
      const want = Math.floor(getDef() * _lxParryMul(lv)), atk = Math.max(1, Math.floor(Math.floor(getAtk() * 6.46) * _am));   // the rogue's 'melee' strike does take affinity
      const got = parry(m);
      out.cls[cls + lv] = { def: getDef(), want, got, gap, tag: m._lastHitTag, atk };
    }
    // SHIELD
    as('warrior', 40); { const m = dummy(1e7, 1e7); const d0 = getDef(); player.buffs.holyShield = 5000; const dS = getDef();
      const got = parry(m); out.shield = { d0, dS, want: Math.floor(d0 * 6.5), got, left: player.buffs.holyShield }; }
    // SURE HIT
    as('warrior', 40); { const m = dummy(1e7, 1e7, 9999); let landed = 0; for (let i = 0; i < 20; i++) { if (parry(m) > 0) landed++; } out.sure = landed; }
    // NO OHKO: 20 parries each on a 100-HP foe at full health, combo x5, War Cry up
    out.ohko = {};
    for (const cls of ['warrior', 'rogue', 'mage', 'archer']) {
      as(cls, 60); player.buffs.warCry = 9e9; let minHp = Infinity, kills = 0, raw = 0;
      for (let i = 0; i < 20; i++) { const m = dummy(100, 100); raw = Math.floor(_lxParryDmg() * 5); parry(m, 5); minHp = Math.min(minHp, m.currentHp); if (m.currentHp <= 0) kills++; }
      out.ohko[cls] = { minHp, kills, raw };
    }
    // FINISH: 40 of 100 left
    as('warrior', 60); { const m = dummy(40, 100); parry(m); out.finish = m.currentHp; }
    // TEXT
    as('warrior', 40);
    out.title = (document.querySelector('#skill-bar .skill-slot.defense') || {}).title || '';
    { const host = document.createElement('div'); try { renderSkillsReference(host); } catch (e) { out.kerr = String(e).slice(0, 120); } out.k = host.textContent.replace(/\s+/g, ' '); out.kNum = _lxParryDmg().toLocaleString('en-US'); }
    return out;
  });
  ok('MULTIPLE: 3x through Lv 30, then 6.5x / 18x / 40x / 60x at Lv 40 / 50 / 60 / 70 and 120x from Lv 80, never falling', JSON.stringify(R.mul) === JSON.stringify([3, 3, 3, 4.75, 6.5, 12.25, 18, 29, 40, 50, 60, 90, 120, 120]) && R.mono, JSON.stringify(R.mul));
  ok('NEUTRAL: the counter takes no weakness or resistance, where a melee hit on the same foe does', !!R.weak.weak && !!R.weak.melee && R.weak.parry === null, JSON.stringify(R.weak));
  for (const k of ['warrior40', 'mage40', 'archer40']) { const c = R.cls[k];
    ok(`COUNTER: a ${k.replace(/\d+/, '')} parry at Lv 40 strikes for exactly 6.5x DEF, tagged 'parry'`, c.gap === 0 && c.got === c.want && c.got > 0 && c.tag === 'parry', JSON.stringify(c)); }
  { const a = R.cls.warrior10, b = R.cls.warrior60;
    ok('COUNTER: the multiple follows the level (3x at Lv 10, 40x at Lv 60)', a.got === a.want && b.got === b.want && a.got / a.def === 3 && Math.abs(b.got / b.def - 40) < 0.01, JSON.stringify({ lv10: a.got / a.def, lv60: +(b.got / b.def).toFixed(3) })); }
  ok('COUNTER: DEF decides it - the warrior out-hits the other classes', R.cls.warrior40.got > R.cls.archer40.got && R.cls.warrior40.got > R.cls.mage40.got && R.cls.warrior40.got > R.cls.rogue40.want, JSON.stringify([R.cls.warrior40.got, R.cls.archer40.got, R.cls.mage40.got, R.cls.rogue40.want]));
  { const c = R.cls.rogue40;
    ok('ROGUE: the DEF counter, plus its ATK counter-strike when that lands', c.got === c.want || c.got === c.want + c.atk, JSON.stringify(c)); }
  ok('SHIELD: Holy Shield\'s +9999 is held out of the counter, and the buff is left as it was', R.shield.dS > R.shield.d0 + 9000 && R.shield.got === R.shield.want && R.shield.left === 5000, JSON.stringify(R.shield));
  ok('SURE HIT: an untouchable foe (evasion 9999) is struck by all 20 parries', R.sure === 20, R.sure + '/20');
  for (const c of ['warrior', 'rogue', 'mage', 'archer']) { const o = R.ohko[c];
    ok(`NO OHKO: a ${c}'s parry never kills a full-health foe (combo x5, War Cry), leaving at least half`, o.kills === 0 && o.minHp >= 50 && o.raw >= 100, JSON.stringify(o)); }
  ok('FINISH: a foe already under half its health can be finished', R.finish <= 0, R.finish);
  ok('TEXT: the skill-bar tooltip quotes the counter', /struck back for 3× your DEF up to Lv 30, rising to 120× at Lv 80 \(never more than half its health\)/.test(R.title), R.title.slice(-140));
  ok('TEXT: the K panel gives the multiple and the number for this character', !R.kerr && R.k.includes('strikes it back for 6.5× your DEF, ' + R.kNum + ' now'), R.kerr || R.k.slice(R.k.indexOf('PARRIED'), R.k.indexOf('PARRIED') + 170));
  ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
} catch (e) { ok('harness ran', false, String(e).slice(0, 200)); }
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close(); server.kill();
process.exit(fail ? 1 : 0);
