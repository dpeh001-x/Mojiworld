// Legosaurus BRACE-DASH (per user: "add in an attack where by legosaurus
// stays still, and then does a quick dash").
//
// Drives the REAL boss through updateMonsters frame by frame and asserts the
// phase contract: a long dead-still brace (position pinned, direction locked
// at brace START so the tell is sidesteppable), then a fast committed dash
// that cannot be steered mid-flight, then a hard brake and a real cooldown.
// Art checks pin the 9-frame ludo set to disk, index and commit.
//   node scripts/legosaurus_bracedash_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

// --- static: the art really ships -------------------------------------------
let missing = 0;
for (let i = 0; i < 9; i++) if (!existsSync(`Sprites/bosses/attack/legosaurusdash_${i}.webp`)) missing++;
ok('all 9 dash frames exist on disk', missing === 0, { missing });
const tracked = execFileSync('git', ['ls-files', '--', 'Sprites/bosses/attack'], { encoding: 'utf8' });
ok('all 9 dash frames are COMMITTED (packagers ship only tracked files)',
   Array.from({ length: 9 }, (_, i) => `Sprites/bosses/attack/legosaurusdash_${i}.webp`)
     .every(p => tracked.includes(p)), {});
const idx = JSON.parse(readFileSync('data/sprite_frame_index.js', 'utf8')
  .replace(/^[\s\S]*?window\.LX_SPRITE_FRAME_INDEX = /, '').replace(/;\s*$/, ''));
ok('the frame index promises exactly 9 legosaurusdash frames (loaders only request what exists)',
   idx.frames['bosses/attack'] && idx.frames['bosses/attack'].legosaurusdash === 9,
   { indexed: idx.frames['bosses/attack'] && idx.frames['bosses/attack'].legosaurusdash });

// --- live --------------------------------------------------------------------
const net = await import('node:net');
const free = (p) => new Promise((r) => { const s = net.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext()).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof updateMonsters === 'function' && typeof monsterTypes === 'object', { timeout: 120000 });

const r = await page.evaluate(async () => {
  const out = {};
  game.paused = true;   // the suite owns the clock
  const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none';
  player.cls = 'warrior'; player.hp = getMaxHp();
  loadMap('blockland_apex');
  await new Promise(r2 => setTimeout(r2, 300));
  game.monsters.length = 0;
  const m = spawnMonster(player.x + 400, player.y - 100, 'legosaurus', true);
  out.spawned = { hasTrait: !!(m && m.traits && m.traits.braceDash), boss: !!m.boss };
  if (!m || !m.traits || !m.traits.braceDash) return out;
  m._bdCd = 0;                        // arm immediately
  game.camera.x = m.x - 400; game.camera.y = 0;

  // EVENT-DRIVEN: the phase machine owns its own timing (850ms brace, 380ms
  // dash), so the observer follows phase transitions instead of guessing with
  // fixed windows — the first version of this test started its "dash window"
  // after the dash was already over and graded the aftermath.
  // Settle gravity first, but disarm the trigger so the brace can't start
  // before the observer is watching.
  m._bdCd = 99999;
  for (let f = 0; f < 30; f++) updateMonsters(16);
  m._bdCd = 0;
  const px = player.x + player.w / 2;

  let braceStartX = null, braceFrames = 0, movedInBrace = 0, lockedDir = null, atkStamped = false;
  let dashStartX = null, dashFrames = 0, maxStep = 0, dashEndX = null, sidestepped = false;
  let lastX = m.x, phasePrev = null, guard = 0;
  while (guard++ < 400 && (dashEndX === null)) {
    updateMonsters(16);
    const ph = m._braceDashing ? m._bdPhase : null;
    if (ph === 'brace') {
      if (braceStartX === null) { braceStartX = m.x; lockedDir = m._bdDir; }
      braceFrames++;
      movedInBrace = Math.max(movedInBrace, Math.abs(m.x - braceStartX));
      if (m.atkAnimUntil && m.atkAnimUntil > performance.now()) atkStamped = true;
      // the player sidesteps mid-brace — the locked dash must not track them
      if (!sidestepped && braceFrames >= 20) { player.x -= 320; sidestepped = true; }
    } else if (ph === 'dash') {
      if (dashStartX === null) dashStartX = lastX;
      dashFrames++;
      maxStep = Math.max(maxStep, Math.abs(m.x - lastX));
    } else if (phasePrev === 'dash' && ph === null) {
      dashEndX = m.x;   // the move just completed
    }
    phasePrev = ph;
    lastX = m.x;
  }
  out.brace = { entered: braceStartX !== null, braceFrames,
    movedInBrace: Math.round(movedInBrace * 10) / 10,
    lockedDir, expectDir: px > (braceStartX ?? m.x) ? 1 : -1, atkStamped, sidestepped };
  out.dash = {
    travelled: dashStartX !== null && dashEndX !== null ? Math.round((dashEndX - dashStartX) * 10) / 10 : null,
    dashFrames, maxStep: Math.round(maxStep * 10) / 10,
    wentLockedWay: dashStartX !== null && dashEndX !== null
      && (lockedDir === 1 ? dashEndX > dashStartX + 200 : dashEndX < dashStartX - 200),
    over: dashEndX !== null,
  };

  // --- COOLDOWN: no immediate re-trigger -----------------------------------
  let retriggered = false;
  for (let f = 0; f < 90; f++) { updateMonsters(16); if (m._braceDashing) retriggered = true; }
  out.cooldown = { retriggered, cdLeft: Math.round(m._bdCd) };

  // --- draw wiring ----------------------------------------------------------
  out.draw = {
    setLoaded: !!(BOSS_ATTACK_FRAMES.legosaurusdash && BOSS_ATTACK_FRAMES.legosaurusdash.length === 9),
  };
  game.monsters.length = 0; game.paused = false;
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

console.log('spawned :', JSON.stringify(r.spawned));
console.log('brace   :', JSON.stringify(r.brace));
console.log('dash    :', JSON.stringify(r.dash));
console.log('cooldown:', JSON.stringify(r.cooldown), '| draw:', JSON.stringify(r.draw));

ok('Legosaurus carries the braceDash trait', r.spawned && r.spawned.hasTrait === true, r.spawned);
ok('it BRACES: a real windup (>=40 frames) standing dead still (<2px drift)',
   r.brace && r.brace.entered === true && r.brace.braceFrames >= 40 && r.brace.movedInBrace < 2, r.brace);
ok('the player had time to sidestep during the brace', r.brace && r.brace.sidestepped === true, r.brace);
ok('the direction locks AT BRACE START, toward where the player stood',
   r.brace && r.brace.lockedDir === r.brace.expectDir, r.brace);
ok('the attack animation window is stamped during the move', r.brace && r.brace.atkStamped === true, r.brace);
ok('then it DASHES: fast (>=8px/frame peak), far (>=300px), and finishes',
   r.dash && r.dash.maxStep >= 8 && Math.abs(r.dash.travelled) >= 300 && r.dash.over === true, r.dash);
ok('the dash commits to the LOCKED direction — a sidestep during the brace is rewarded',
   r.dash && r.dash.wentLockedWay === true, r.dash);
ok('a real cooldown follows (no immediate re-trigger)',
   r.cooldown && r.cooldown.retriggered === false && r.cooldown.cdLeft > 3000, r.cooldown);
ok('the 9-frame dash set is loaded for the boss draw', r.draw && r.draw.setLoaded === true, r.draw);
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
