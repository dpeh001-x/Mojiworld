// RELEASE 12b - EXP pacing (both per user):
//   FALLOFF  the v0.29.858 level-gap EXP falloff reaches ORDINARY monsters (it read m.level only, which they never carry): their level
//            is LX_MONSTER_STATS lv / MOB_NATURAL_LEVEL, against min(player level, 80); expedition / tower (m.level), bosses and
//            party-quest maps read exactly as before; a co-op guest's share agrees with the host, mirror present or gone
//   CURVE    Lv 41-100 of the level-cost table re-baked without the once-per-map elites (Blight Elder made Lv 69 cost x2.66 Lv 68;
//            Path's Bane / Ossuary Tyrant put Lv 81-100 at ~1.7x their line): no level 41-100 costs more than ~x1.35 the one before,
//            Lv 1-40 (and the unreachable 101-200) unchanged, every level 41-100 within 20% of the documented kill line (Lv 81+ in
//            kills of Lv 78-80 monsters - a hero past 80 is measured as Lv 80), the endgame band ~20,450 at Lv 85 / ~68,170 at 99, and
//            scripts/exp_raw_bake.mjs (the tool the table's comment names) agrees with the file
//   [SERVE_ROOT=<checkout>] [PORT=15061] node scripts/release12b_test.mjs
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn, spawnSync } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = process.env.PORT || '15061';
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d !== undefined ? '  [' + (typeof d === 'string' ? d : JSON.stringify(d)) + ']' : '')); ok ? pass++ : fail++; };
const fall = (gap) => (gap <= 5 ? 1 : Math.max(0.15, 1 - (gap - 5) * 0.055));
const near = (a, b) => Math.abs(a - b) < 1e-9;
const EXE = [process.env.PW_EXE, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => p && existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--disable-gpu'] });
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function' && typeof _lxLevelCost === 'function' && typeof _coopApplyKill === 'function', null, { timeout: 120000 });
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    const out = {};
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'warrior'; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    loadMap('forest', 300); await sleep(1500); try { closeAllModals(); } catch (e) {} game.paused = true;
    const clean = (lv) => { player.level = lv; player.mods.xpBoost = 0; player.equipped = {}; player.boons = []; player.boonsEquipped = [];
      game.comboMult = 1; game.combo = 0; player.buffs.comboXp = 0; game.prestige = null; game.difficulty = 'normal'; game._diffExpMul = null;
      game.mapKillStreak = 0; player._ksTier = 0; try { game._mapAffix = WORLD_AFFIXES[0]; } catch (e) {} player.exp = 0; player.expToNext = 1e12; };
    const mob = (type, isBoss) => { const m = spawnMonster(player.x + 200, player.y, type, !!isBoss); game.monsters.push(m); return m; };
    const gapAt = (lv, m) => { player.level = lv; return _lxExpLevelGapMul(m); };
    // FALLOFF - what the function returns for each kind of monster
    game.monsters.length = 0;
    const mush = mob('mushroom'), wraith = mob('boneWraith'), hare = mob('glasswindHare');
    out.lv = { mush: LX_MONSTER_STATS.mushroom.lv, wraith: LX_MONSTER_STATS.boneWraith.lv, hare: LX_MONSTER_STATS.glasswindHare.lv, mushLevel: mush.level };
    out.g = { mush25: gapAt(25, mush), mush14: gapAt(LX_MONSTER_STATS.mushroom.lv + 5, mush), mush60: gapAt(60, mush),
      wraith95: gapAt(95, wraith), hare95: gapAt(95, hare), hare80: gapAt(80, hare) };
    const exped = mob('boneWraith'); _lxStatToLevel(exped, 70, { stat: 1, exp: 1 });   // an expedition / tower monster: its level is stamped
    out.g.exped95 = gapAt(95, exped); out.g.lit70v10 = gapAt(70, { level: 10 });
    const bossy = mob('mushroom', true); out.g.bossNoLv60 = gapAt(60, bossy);
    const king = mob('king', true); out.g.king60 = gapAt(60, king); out.kingLv = king.level;
    const _cm = game.currentMap; game.currentMap = 'tower'; out.g.pqMech90 = gapAt(90, { type: 'ticketMech' }); game.currentMap = _cm;
    // the real kill path pays it
    clean(25); game.monsters.length = 0;
    const _mul = () => [(game.prestige && game.prestige.xpMult) || 1, _diffExpMul(), _affixExpMul(), _ksXpMul(), _lxDawnExpMul(), _edictExpMul()].reduce((a, v) => a * v, 1);
    out.killMul = _mul();
    { const m = mob('mushroom'); m.exp = 1000; m.currentHp = 0; const b4 = player.exp; try { killMonster(m); } catch (e) {} out.kill25 = player.exp - b4; }
    // CO-OP guest share: a mirror present, and a mirror already gone (the reward note is all that is left)
    clean(25); game.monsters.length = 0;
    net.connected = true; net.isHost = false; net.hostId = 1; net.myId = 7; net.peers = {};
    const mirror = mob('mushroom'); mirror.uid = 8801; mirror._coopMirror = true; _lxCoopRewardNote(mirror); mirror.exp = 1000;
    _lxCoopRewardNote({ uid: 8802, type: 'mushroom', exp: 1000, mojicoins: 0 });   // the note a mirror leaves (ordinary: no level)
    const _seen = _lxCoopRewardSeen.get(8801); if (_seen) _seen.e = 1000;
    const frame = (u) => ({ t: 'kill', id: 1, u, e: 1000, c: 0, x: Math.round(player.x) + 3000, y: Math.round(player.y), map: game.currentMap, tp: 'mushroom', b: 0 });
    out.guestMul = _mul();
    let b4 = player.exp; try { _coopApplyKill(frame(8801)); } catch (e) { out.coopErr = String(e).slice(0, 120); } out.guestMirror = player.exp - b4;
    b4 = player.exp; try { _coopApplyKill(frame(8802)); } catch (e) { out.coopErr = String(e).slice(0, 120); } out.guestGone = player.exp - b4;
    net.connected = false; net.isHost = true; net.hostId = null; net.peers = {}; game.monsters.length = 0;
    // CURVE - the costs, and the ordinary-monster reference (no boss / tower-type / once-per-map elite)
    out.costs = {}; for (let L = 1; L <= 200; L++) out.costs[L] = _lxLevelCost(L);
    const rare = new Set(['blightElder', 'ossuaryTyrant', 'pathsBane', 'vigil_vermillion']);
    const pool = Object.entries(LX_MONSTER_STATS).filter(([t, v]) => v && v.exp > 0 && v.lv > 0 && !rare.has(t)
      && !(monsterTypes[t] && (monsterTypes[t].boss || monsterTypes[t].zodiacSign)) && !/^(tower|express|ticket|conductor|mirror|octoLeg|zodiac_)/i.test(t)
      && (v.exp / Math.max(1, v.hp)) <= 0.04).map(([, v]) => v);
    out.adj = {}; let run = 0;
    for (let L = 41; L <= 100; L++) { const p = pool.filter((v) => Math.abs(v.lv - Math.min(L, 80)) <= 2); run = Math.max(run, p.reduce((s, v) => s + v.exp, 0) / p.length); out.adj[L] = run; }
    return out;
  });
  // ---- FALLOFF
  const L = r.lv;
  check(r.lv.mushLevel == null && near(r.g.mush25, fall(25 - L.mush)) && r.g.mush25 < 1,
    'an ordinary monster (no m.level) gets the falloff from its stats-table level: Lv 25 on a Lv ' + L.mush + ' mushroom', { got: r.g.mush25, want: fall(25 - L.mush) });
  check(r.g.mush14 === 1 && near(r.g.mush60, 0.15), '...full rate within 5 levels, the 15% floor far under', r.g);
  check(r.g.wraith95 === 1 && near(r.g.hare95, fall(80 - L.hare)) && near(r.g.hare80, r.g.hare95),
    'a Lv 95 hero is measured from Lv 80 (the top of the roster): full EXP on a Lv ' + L.wraith + ' Bone Wraith, a Lv 80 hero\'s rate on a Lv ' + L.hare + ' hare', r.g);
  check(near(r.g.exped95, 0.15) && near(r.g.lit70v10, 0.15), 'a monster WITH m.level (expedition / tower) reads exactly as before - uncapped', r.g);
  check(r.g.bossNoLv60 === 1 && near(r.g.king60, fall(60 - r.kingLv)), 'bosses unchanged: one without a level pays x1, one with its own level as before', { bossNoLv60: r.g.bossNoLv60, king60: r.g.king60, kingLv: r.kingLv });
  check(r.g.pqMech90 === 1, 'a party-quest map\'s level-less mech still pays x1', r.g.pqMech90);
  const wantKill = Math.max(1, Math.floor(1000 * r.killMul * fall(25 - L.mush)));
  check(r.kill25 === wantKill, 'the real kill path pays it: a 1,000-EXP mushroom at Lv 25', { got: r.kill25, want: wantKill, mul: r.killMul });
  const wantGuest = Math.max(1, Math.floor(1000 * r.guestMul * fall(25 - L.mush)));
  check(!r.coopErr && r.guestMirror === wantGuest && r.guestGone === wantGuest, 'a co-op guest\'s share agrees with the host - mirror present and mirror gone', { mirror: r.guestMirror, gone: r.guestGone, want: wantGuest, err: r.coopErr });
  // ---- CURVE
  const C = r.costs, OLD = { 40: 2381229 };
  const sum = (a, b) => { let s = 0; for (let i = a; i <= b; i++) s += C[i]; return s; };
  check(sum(1, 40) === 12708265 && C[40] === OLD[40] && sum(101, 200) === 1003368437500, 'Lv 1-40 (and the unreachable Lv 101-200) are unchanged', { s140: sum(1, 40), s101: sum(101, 200) });
  const steps = []; let worst = 0;
  for (let i = 41; i <= 100; i++) { const x = C[i] / C[i - 1]; worst = Math.max(worst, x); if (!(x > 1) || x > 1.35) steps.push(i + ':x' + x.toFixed(2)); }
  check(steps.length === 0, 'no level from 41 to 100 costs more than ~x1.35 the one before (and every one costs more)', 'worst x' + worst.toFixed(3) + ' ' + JSON.stringify(steps));
  check(C[69] / C[68] <= 1.35, 'the Lv 69 wall is gone (was x2.66 Lv 68)', 'x' + (C[69] / C[68]).toFixed(3));
  const line = (Lv) => ((Lv <= 80) ? 1500 + 300 * (Lv - 19) : (Lv <= 85) ? 19800 + 2040 * (Lv - 80) : 30000 + 5000 * (Lv - 85)) / 1.467;   // the documented kill line, in kills of today's (x1.467) monsters
  const off = []; for (let i = 41; i <= 100; i++) { const k = C[i] / r.adj[i]; if (Math.abs(k / line(i) - 1) > 0.2) off.push(i + ':' + Math.round(k) + ' vs ' + Math.round(line(i))); }
  check(off.length === 0, 'every level 41-100 sits on the kill line (within 20%) in kills of ordinary monsters', JSON.stringify(off));
  const k85 = C[85] / r.adj[85], k99 = C[99] / r.adj[99];
  check(Math.abs(k85 / 20450 - 1) <= 0.03 && Math.abs(k99 / 68166 - 1) <= 0.03, 'the endgame band is the documented one in ordinary Lv 78-80 kills: ~20,450 at Lv 85, ~68,170 for 99 -> 100 (was ~34,800 / ~116,000)', { k85: Math.round(k85), k99: Math.round(k99) });
  let kills = 0; for (let i = 41; i <= 99; i++) kills += C[i] / r.adj[i];
  console.log('      Lv 41 -> 100 in ordinary kills: ' + Math.round(kills) + ' (1,704,570 on the elite-lifted table)');
  const bake = path.join(ROOT, 'scripts', 'exp_raw_bake.mjs');
  const bk = existsSync(bake) ? spawnSync(process.execPath, [bake, '--check'], { cwd: ROOT, encoding: 'utf8' }) : null;
  check(!!bk && bk.status === 0, 'scripts/exp_raw_bake.mjs exists and its --check agrees with the file', bk ? String(bk.stdout).trim().split('\n').pop() : 'missing');
  check(errs.length === 0, 'no page errors', errs.slice(0, 3).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
