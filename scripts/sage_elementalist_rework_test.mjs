// Live+source test: Sage (#8) + Elementalist (#10) rework.
//   node scripts/sage_elementalist_rework_test.mjs [port]   (MOJI_GAME_FILE honored)
import { chromium } from 'playwright-core';
import { existsSync, readFileSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const GAME = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const src = readFileSync(GAME, 'utf8');

// ---- source ---------------------------------------------------------------
ok('Sage G is Pyre Columns: 16-frame telegraph, 110ms stagger, 95px lane at 3x',
  src.includes("name:'Pyre Columns'") && src.includes('_sageDmgMul: 3.0, _fireColumn: true,') &&
  src.includes('life: 16, maxLife: 16, fireAt: 16, cx: ox') && src.includes('}, i * 110);'), '');
ok('pyre lanes launch foes skyward and erupt a pillar (no rock-fall)',
  src.includes('m.vy = h._fireColumn ? -9 : -4;') && src.includes("if (h._fireColumn) {\n        // v0.30.x - PYRE telegraph"), '');
ok('Sage B window runs on SIM time with an updatePlayer watcher',
  src.includes('player._sageUntilFr = game.time + 480;') && src.includes('game.time >= player._sageUntilFr) _sageSigilClose();') &&
  !src.includes('player._sageUntil = _now + 8000'), '');
ok('Sage B tooltip is honest (tap x10, ahead, refund)',
  /desc:'Open an 8s sigil: tap B up to 10 times[^']*AHEAD of you/.test(src), '');
ok('Cascade: the glacier wall is gone, four beats remain',
  !src.includes('const ICE_BLOCKS = [') && src.includes("showToast('FROST - ' + n + ' frozen', 'rare');") &&
  src.includes("showToast('STORM - ' + hops + ' chained', 'rare');") && src.includes("showToast('CONVERGENCE x' + amp.toFixed(2)"), '');
ok('Cascade + Apotheosis tooltips describe the real skills',
  /desc:'Four elements in sequence: a Pyre column/.test(src) && /desc:'HOLD B to charge \(1\.5s\)/.test(src), '');

// ---- live -----------------------------------------------------------------
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
await page.waitForFunction(() => typeof SKILL_FNS === 'object' && typeof updateProjectiles === 'function', null, { timeout: 120000 });
await page.waitForLoadState('load', { timeout: 120000 }).catch(() => {});
await page.waitForTimeout(2500);

const live = await page.evaluate(async () => {
  const out = {};
  game.paused = false;
  const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none';
  player.cls = 'mage'; player.job = 'archmage'; player.master = 'sage'; player.level = 60; player.facing = 1;
  player.hp = getMaxHp(); player.mp = 9999;
  const mk = (dx, dy) => { const m = { x: player.x + dx, y: player.y + (dy || 0), w: 40, h: 40, hp: 1e9, maxHp: 1e9, currentHp: 1e9,
    def: 0, type: 'slime', level: 1, speed: 0, facing: 1, vx: 0, vy: 0, _noGravity: true, name: 'dummy' };
    game.monsters.push(m); return m; };
  // --- Sage G: pyre lanes spawn, resolve as columns, launch what they hit ---
  game.monsters.length = 0; game.hazards.length = 0;
  const inLane = mk(100);                       // first pillar at +70..+(70+..) with 95px radius covers x+100
  SKILL_FNS.sage_meteorshower();
  await new Promise(r => setTimeout(r, 700));   // all 5 pillars scheduled (110ms apart)
  const lanes = game.hazards.filter(h => h && h.type === 'meteor_warn' && h._fireColumn);
  out.pyre = { lanesAtCast: lanes.length, radius: lanes[0] && lanes[0].radius, life: lanes[0] && lanes[0].maxLife };
  for (let f = 0; f < 40; f++) updateProjectiles(16);   // the 16-frame telegraphs resolve
  out.pyre.hurt = inLane.currentHp < 1e9; out.pyre.launched = inLane.vy <= -9;
  out.pyre.lanesLeft = game.hazards.filter(h => h && h._fireColumn).length;

  // --- Sage B: front-only targeting + sim-time window ---
  game.monsters.length = 0; game.hazards.length = 0; game.projectiles.length = 0;
  player.skillCooldowns.sage_ult = 0; player._sageUntilFr = 0; player._sageShots = 0;
  const behind = mk(-200);
  SKILL_FNS.sage_ult();
  const c1 = game.projectiles.find(p => p && p.bspr === 'bult_sage');
  out.sigil = { opened: (player._sageUntilFr | 0) > game.time, behindIgnored: !!c1 && c1.homing !== behind && c1.vx > 0 };
  const ahead = mk(260);
  SKILL_FNS.sage_ult();
  const c2 = game.projectiles.filter(p => p && p.bspr === 'bult_sage').pop();
  out.sigil.aheadTargeted = !!c2 && c2.homing === ahead;
  // the watcher closes it on sim time
  game.time = player._sageUntilFr + 1; updatePlayer(16);
  out.sigil.closedByWatcher = (player._sageUntilFr | 0) === 0 && (player.skillCooldowns.sage_ult | 0) > 10000;

  // --- Elementalist G: four beats ---
  player.master = 'elementalist';
  game.monsters.length = 0; game.hazards.length = 0; game.projectiles.length = 0;
  const near = mk(120), near2 = mk(200), near3 = mk(-150);
  SKILL_FNS.elementalist_cascade();
  const col = game.hazards.find(h => h && h._fireColumn);
  out.cascade = { pyreOnNearest: !!col && Math.abs(col.cx - (near.x + near.w / 2)) <= 1, burned: !!(near.burnTimer || near._burn || near.statuses) };
  await new Promise(r => setTimeout(r, 1300));  // frost (350), storm (700), void (1050)
  out.cascade.frozen = (near.freezeTimer | 0) > 0 && (near3.freezeTimer | 0) > 0;
  out.cascade.chainHit = [near, near2, near3].filter(m => m.currentHp < 1e9).length;
  game.monsters.length = 0; game.hazards.length = 0;
  return out;
});
ok('LIVE Sage G: five 95px pyre lanes with 16-frame telegraphs', live.pyre.lanesAtCast === 5 && live.pyre.radius === 95 && live.pyre.life === 16, live.pyre);
ok('LIVE Sage G: a foe in the lane is hurt, launched (vy -9) and the lanes clear', live.pyre.hurt && live.pyre.launched && live.pyre.lanesLeft === 0, live.pyre);
ok('LIVE Sage B: the sigil opens a sim-time window and ignores a foe BEHIND you', live.sigil.opened && live.sigil.behindIgnored, live.sigil);
ok('LIVE Sage B: a foe ahead is homed on', live.sigil.aheadTargeted === true, live.sigil);
ok('LIVE Sage B: the updatePlayer watcher closes the window and charges the cooldown', live.sigil.closedByWatcher === true, live.sigil);
ok('LIVE Cascade: the pyre column lands on the nearest foe ahead', live.cascade.pyreOnNearest === true, live.cascade);
ok('LIVE Cascade: the frost nova froze foes around the caster', live.cascade.frozen === true, live.cascade);
ok('LIVE Cascade: the storm chain hit the pack', live.cascade.chainHit >= 2, live.cascade);
ok('no page errors', errs.length === 0, errs.slice(0, 3));
for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
