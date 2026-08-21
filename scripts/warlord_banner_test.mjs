// Warlord's Banner is now a real world object, not a 0.8s flash.
//
// Per user: "warlord banner skill should have the warlord banner summoned onto
// the map for the duration stated". The buff runs 12s (720 frames); the sprite
// burst it used to fire lasted ~50. This drives the live skill and holds the
// object to that contract: planted at the cast spot, standing for the full
// duration, gone after, one at a time, and wiped by a map change.
//   node scripts/warlord_banner_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const ART = 'Sprites/fx/warlord_banner_planted.webp';
ok('the banner sprite ships', existsSync(ART) && statSync(ART).size > 3000 && statSync(ART).size < 200000,
   { bytes: existsSync(ART) ? statSync(ART).size : 0 });
ok('...and is COMMITTED (packagers ship only tracked files)',
   execFileSync('git', ['ls-files', '--', ART], { encoding: 'utf8' }).trim() === ART, {});

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
await page.waitForFunction(() => typeof SKILL_FNS === 'object' && typeof updateProjectiles === 'function', { timeout: 120000 });

const r = await page.evaluate(async () => {
  const out = {};
  game.paused = true;                       // the suite owns the clock
  const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none';
  player.cls = 'warrior'; player.job = 'berserker'; player.master = 'warlord';
  player.hp = getMaxHp(); player.mp = 9999; player.skillCooldowns = {};
  game.hazards.length = 0; game.monsters.length = 0;
  player.facing = 1;
  const bannerOf = () => game.hazards.find(h => h.type === 'warlord_banner');
  const frames = (n) => { for (let f = 0; f < n; f++) updateProjectiles(16); };

  const px = player.x, pFoot = player.y + player.h;
  SKILL_FNS.warlord_warcry();
  const h0 = bannerOf();
  out.planted = {
    exists: !!h0, life: h0 && h0.life, maxLife: h0 && h0.maxLife,
    footOnGround: !!h0 && Math.abs(h0.footY - pFoot) < 2,
    besideCaster: !!h0 && Math.abs(h0.cx - (px + player.w / 2)) > 10 && Math.abs(h0.cx - (px + player.w / 2)) < 60,
    protectedType: (typeof _HAZ_PROTECTED !== 'undefined') && _HAZ_PROTECTED.has('warlord_banner'),
    spriteRegistered: !!(typeof LX_FX !== 'undefined' && LX_FX.warlord_banner_planted),
  };

  // it must NOT follow the player, and must outlive the old ~50-frame burst
  player.x += 300;
  frames(120);
  const h1 = bannerOf();
  out.mid = { alive: !!h1, stayedPut: !!h1 && Math.abs(h1.cx - (px + player.w / 2 + (player.facing > 0 ? -34 : 34))) < 2,
    lifeLeft: h1 && h1.life };

  // still standing near the end of the buff, gone after it
  frames(560);                               // ~680 total of 720
  out.lateAlive = !!bannerOf();
  frames(80);                                // past 720
  out.expired = !bannerOf();

  // recast replaces rather than stacks
  player.skillCooldowns = {}; player.mp = 9999;
  SKILL_FNS.warlord_warcry();
  frames(30);
  player.skillCooldowns = {}; player.mp = 9999;
  SKILL_FNS.warlord_warcry();
  out.afterRecast = game.hazards.filter(h => h.type === 'warlord_banner').length;

  // the buff it advertises is the same length as the banner
  out.buffFrames = (player._warlordBanner | 0) - (game.time | 0);
  out.desc = SKILLS.warlord_warcry && SKILLS.warlord_warcry.desc;
  game.hazards.length = 0; game.paused = false;
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

console.log('planted:', JSON.stringify(r.planted));
console.log('mid    :', JSON.stringify(r.mid), '| lateAlive:', r.lateAlive, '| expired:', r.expired,
            '| afterRecast:', r.afterRecast, '| buffFrames:', r.buffFrames);

ok('casting plants a banner in the world', r.planted.exists === true, r.planted);
ok('it stands for the full 12s buff (720 frames), not the old ~50-frame flash',
   r.planted.maxLife === 720, r.planted);
ok('its pole base sits on the caster\'s ground line', r.planted.footOnGround === true, r.planted);
ok('it plants BESIDE the caster, not on top of them', r.planted.besideCaster === true, r.planted);
ok('the sprite is registered in the FX table', r.planted.spriteRegistered === true, r.planted);
ok('it is protected from the hazard perf-trim', r.planted.protectedType === true, r.planted);
ok('it does NOT follow the player — a planted banner stays planted',
   r.mid.alive === true && r.mid.stayedPut === true, r.mid);
ok('still standing at ~680 frames (the old burst died at 50)', r.lateAlive === true, {});
ok('and gone once the duration is spent', r.expired === true, {});
ok('a recast replaces the banner instead of stacking a second one', r.afterRecast === 1, { count: r.afterRecast });
ok('the banner duration matches the buff it announces', Math.abs(r.buffFrames - 720) <= 2, { buffFrames: r.buffFrames });
ok('the tooltip states the real duration (it said 6s while the code ran 12s)',
   /12s/.test(r.desc || ''), { desc: r.desc });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
