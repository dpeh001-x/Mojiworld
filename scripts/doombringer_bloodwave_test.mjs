// Per user: a DOOMBRINGER with Bloodlust up launches the p_ult_doombringer
// blade-wave from basic swings, not the generic small fireball.
//
// Drives the real swing and inspects the projectile the game actually spawned,
// because the old behaviour came from an ABSENT field â€” the rider set no bspr
// and fell through to LX_PLAYER_PROJ_BY_SKILL. A test that only read a sprite
// table would have seen "bloodwave -> shockwave" and called it correct.
//   node scripts/doombringer_bloodwave_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

ok('the blade-wave art is on disk', existsSync('Sprites/projectiles/p_ult_doombringer.webp'), {});

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
await page.waitForFunction(() => typeof SKILL_FNS === 'object' && typeof player === 'object', { timeout: 120000 });

const r = await page.evaluate(async () => {
  const out = {};
  const swing = (master, facing) => {
    player.cls = 'warrior'; player.job = 'berserker'; player.master = master;
    player.facing = facing;
    player.buffs = player.buffs || {};
    player.buffs.bloodlust = 600;          // rage up
    game.projectiles.length = 0;
    // The rider lives in the `slash` executor (SKILL_FNS.slash), not in
    // performMelee — calling performMelee spawns no bloodwave at all, which is
    // how the first draft of this test reported zero projectiles.
    SKILL_FNS.slash();
    return game.projectiles.filter(p => p && p.skill === 'bloodwave');
  };
  const doomR = swing('doombringer', 1);
  out.doomRight = doomR.length ? { bspr: doomR[0].bspr || null, flip: !!doomR[0].bsprFlipX, w: doomR[0].w, h: doomR[0].h, vx: doomR[0].vx } : null;
  const doomL = swing('doombringer', -1);
  out.doomLeft = doomL.length ? { bspr: doomL[0].bspr || null, flip: !!doomL[0].bsprFlipX, vx: doomL[0].vx } : null;
  const bers = swing(null, 1);
  out.berserker = bers.length ? { bspr: bers[0].bspr || null, w: bers[0].w, h: bers[0].h } : null;

  // Damage must be untouched â€” this was an ART request, not a balance one.
  out.doomDmg = doomR.length ? doomR[0].damage : null;
  out.bersDmg = bers.length ? bers[0].damage : null;

  // Resolve the sprite key the way the renderer does, and confirm it loads.
  out.resolved = null;
  try {
    const key = out.doomRight && out.doomRight.bspr;
    // The table is LX_BULT_PROJ (built by an IIFE), and its values are resolved
    // Image objects, not filenames — so check the loaded src rather than a
    // string. The first draft guessed LX_BOSS_PROJ and simply found nothing.
    if (key && typeof LX_BULT_PROJ !== 'undefined' && LX_BULT_PROJ[key]) {
      const v = LX_BULT_PROJ[key];
      out.resolved = (typeof v === 'string') ? v
        : ((v && v.src) ? decodeURIComponent(v.src).split('/').pop() : null);
    }
  } catch (e) {}
  return out;
});

// Fetch the art the way the game would.
const url = 'Sprites/projectiles/p_ult_doombringer.webp';
const status = await page.evaluate(async (u) => { try { return (await fetch(u)).status; } catch (e) { return -1; } }, url);
await b.close(); try { srv.kill(); } catch (e) {}

console.log('doombringer facing right ->', JSON.stringify(r.doomRight));
console.log('doombringer facing left  ->', JSON.stringify(r.doomLeft));
console.log('plain berserker          ->', JSON.stringify(r.berserker));
console.log('art fetch                ->', status);

ok('a doombringer swing launches a bloodwave at all', !!r.doomRight, {});
ok('it uses the doombringer blade-wave sprite', r.doomRight && r.doomRight.bspr === 'bult_doombringer', r.doomRight);
ok('the LEFT-FACING art is flipped so it reads travelling right',
   r.doomRight && r.doomRight.flip === true, { flip: r.doomRight && r.doomRight.flip });
ok('the flip is declared facing left too (not a one-direction fix)',
   r.doomLeft && r.doomLeft.bspr === 'bult_doombringer' && r.doomLeft.flip === true, r.doomLeft);
ok('it travels the way the player faces', r.doomRight && r.doomRight.vx > 0 && r.doomLeft && r.doomLeft.vx < 0,
   { right: r.doomRight && r.doomRight.vx, left: r.doomLeft && r.doomLeft.vx });
ok('the box was enlarged so the blade is not a 26px smear',
   r.doomRight && r.doomRight.w >= 60 && r.doomRight.h >= 40, { w: r.doomRight && r.doomRight.w, h: r.doomRight && r.doomRight.h });
ok('it stays SMALLER than Calamity Incarnate (100-130px) so the ult still reads bigger',
   r.doomRight && r.doomRight.w < 100 && r.doomRight.h < 100, { w: r.doomRight && r.doomRight.w });
ok('a plain berserker is unchanged â€” no bspr, still 26px',
   r.berserker && r.berserker.bspr === null && r.berserker.w === 26, r.berserker);
ok('DAMAGE is untouched (this was an art change, not a buff)',
   r.doomDmg != null && r.doomDmg === r.bersDmg, { doombringer: r.doomDmg, berserker: r.bersDmg });
ok('the sprite key resolves to the real file', r.resolved === 'p_ult_doombringer.webp', { resolved: r.resolved });
ok('the art downloads (no invisible projectile)', status === 200, { status });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);


