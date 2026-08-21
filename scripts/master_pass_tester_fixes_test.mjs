// Live+source test: the tester's master-class pass (audit items 1,5,6,7,9,
// 11,12,13 — #14 Crusader is judgement_bastion_test.mjs, #2/#3 are the summon
// and vortex suites). Each check discriminates: it fails on the pre-pass build.
//   node scripts/master_pass_tester_fixes_test.mjs [port]   (MOJI_GAME_FILE honored)
import { chromium } from 'playwright-core';
import { existsSync, readFileSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const GAME = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const src = readFileSync(GAME, 'utf8');

// ---- source assertions (constants and structure) ---------------------------
ok('#1 Bishop G: the 2.5s untargetable window is gone (0.8s cast guard)',
  src.includes('player.invulnerable = Math.max(player.invulnerable, 800);') &&
  src.includes("the 5s immortality is the B's identity"), '');
ok('#1 Bishop G: pillar MP refund halved to 3%',
  src.includes('getMaxMp() * 0.03') && !src.includes('getMaxMp() * 0.06'), '');
ok('#1 Bishop B: pulses 2.6x, finale 6x (the priest stops out-nuking warlocks)',
  src.includes('performAround(440, 2.6,') && src.includes('performAround(620, 6.0,'), '');
ok('#6 Dragoon: no-prey bail on the chase finisher',
  src.includes('if (!nearest) return;'), '');
ok('#6 Dragoon: dive gaps tightened (1000->700, 700->450)',
  src.includes("}, 700);   // v0.30.x — 1000 -> 700ms") && src.includes("}, 450);   // v0.30.x — 700 -> 450ms"), '');
ok('#7 Nightreaper: every batch answers audibly',
  !src.includes("if ((b & 1) === 0) audio.play('hit');"), '');
ok('#7 Nightreaper: the dagger has a visible fall (moon-height streak)',
  src.includes('spawnSmoothSlash(tx, ty - 170, Math.PI / 2, 240,'), '');
ok('#11 Doombringer: heat 0.007, waves 9.5/5.5, melee 6.0',
  src.includes('LX_DOOM_HEAT_DMG = 0.007') && src.includes('wave(9.5 * _heatMul') &&
  src.split('wave(5.5 * _heatMul').length - 1 === 2 && src.includes('performMelee(440, 6.0 * _heatMul'), '');
ok('#12 Ballista: turret cadence 700->900ms',
  src.includes('tu.fireCd = 900;') && !src.includes('tu.fireCd = 700;'), '');

// ---- live checks -----------------------------------------------------------
const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext()).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/${GAME}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof SKILL_FNS === 'object' && typeof updatePlayer === 'function', null, { timeout: 120000 });

const live = await page.evaluate(async () => {
  const out = {};
  game.paused = false;
  const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none';
  // --- #1 Bishop G live: cast guard is short ---
  player.cls = 'mage'; player.job = 'priest'; player.master = 'archbishop';
  player.invulnerable = 0;
  SKILL_FNS.archbishop_grail();
  out.grailInvuln = player.invulnerable;
  player._ascended = 0; player._ascendLockX = 0; player.invulnerable = 0;

  // --- #5 maelstrom live: guard + pool anchoring ---
  player.master = 'necromancer'; player.job = 'warlock';
  game.hazards.length = 0;
  SKILL_FNS.necromancer_ult();
  const noPool = game.hazards.find(h => h && h.type === 'necro_maelstrom');
  out.nmWalk = { follows: !!(noPool && noPool.follow), guard: (player.buffs && player.buffs.maelstromGuard) | 0 };
  updatePlayer(16);
  out.nmAegis = !!player._aegis;
  game.hazards.length = 0; player._aegis = null; player.buffs.maelstromGuard = 0;
  const poolCx = player.x + player.w / 2 + 400;
  game.hazards.push({ type: 'soul_vortex', cx: poolCx, x: poolCx - 230, y: player.y - 56, w: 460, h: 192, life: 1700, maxLife: 1800, atk: 1, tick: 0 });
  SKILL_FNS.necromancer_ult();
  const anch = game.hazards.find(h => h && h.type === 'necro_maelstrom');
  out.nmAnchor = { follows: !!(anch && anch.follow), cxMatch: !!anch && Math.abs(anch.cx - poolCx) <= 1 };
  game.hazards.length = 0;

  // --- #9 grand hex echo live: a latecomer is caught, a veteran keeps pacing ---
  player.master = 'hexmaster';
  const mk = (x) => { const m = { x, y: player.y, w: 40, h: 40, hp: 1e9, maxHp: 1e9, currentHp: 1e9,
    def: 0, type: 'slime', level: 1, speed: 0, facing: 1, vx: 0, vy: 0, _noGravity: true, name: 'dummy' };
    game.monsters.push(m); return m; };
  game.monsters.length = 0;
  const vet = mk(player.x + 100);                       // inside at cast
  const late = mk(player.x + 3000);                     // far outside at cast
  SKILL_FNS.hexmaster_grandhex();
  const stAtCast = { vet: vet._hexStacks | 0, late: late._hexStacks | 0 };
  late.x = player.x + 120;                              // walks in during the window
  await new Promise(r => setTimeout(r, 1900));          // the 1.5s echo fires in here
  out.hexEcho = { atCast: stAtCast,
    lateAfter: late._hexStacks | 0, lateHurt: late.currentHp < 1e9,
    vetAfter: vet._hexStacks | 0 };
  game.monsters.length = 0;

  // --- #13 skymark live: marked prey takes +15% from the player ---
  const dm = mk(player.x + 60);
  dm._skyMarkUntil = 0;
  const hp0 = dm.currentHp;
  hitMonster(dm, 1000, false, 'probe');
  const plain = hp0 - dm.currentHp;
  const hp1 = dm.currentHp;
  dm._skyMarkUntil = (game.time || 0) + 900;
  hitMonster(dm, 1000, false, 'probe');
  const marked = hp1 - dm.currentHp;
  out.skymark = { plain, marked, ratio: plain > 0 ? marked / plain : 0 };
  game.monsters.length = 0;
  return out;
});
ok('#1 LIVE: Grail ascend guards ~0.8s, not 2.5s', live.grailInvuln > 0 && live.grailInvuln <= 900, live.grailInvuln);
ok('#5 LIVE: no pool -> the storm walks and wears the Storm\'s Eye guard',
  live.nmWalk.follows === true && live.nmWalk.guard === 6000, live.nmWalk);
ok('#5 LIVE: the guard bridges into the half-damage machinery', live.nmAegis === true, '');
ok('#5 LIVE: with a Soul Vortex open the storm anchors INTO the pool',
  live.nmAnchor.follows === false && live.nmAnchor.cxMatch === true, live.nmAnchor);
ok('#9 LIVE: a latecomer walking into the ring is hexed by the echo pulse',
  live.hexEcho.atCast.late === 0 && live.hexEcho.lateAfter === 1 && live.hexEcho.lateHurt, live.hexEcho);
ok('#9 LIVE: a veteran keeps exact stack pacing (no echo double-dip)',
  live.hexEcho.atCast.vet === 1 && live.hexEcho.vetAfter === 1, live.hexEcho);
// The x1.15 lands mid-pipeline; flat additive terms downstream dilute the
// end-to-end ratio a little (measured 1.13 on a flat dummy). The band proves
// the mark bites without pinning unrelated pipeline arithmetic.
ok('#13 LIVE: the eagle\'s mark makes the hunter\'s own hit bite ~+15%',
  live.skymark.ratio > 1.08 && live.skymark.ratio < 1.22, live.skymark);
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
