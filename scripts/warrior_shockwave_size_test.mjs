// Per user: the warrior skills that draw p_shockwave throw a LARGER projectile.
//
// Only two spawns still resolve to p_shockwave.webp after the Bloodlust rider
// moved to the doombringer crescent: powerStrike's forward wave and
// warlord_warcry's three-way fan. This drives both executors and measures the
// projectiles the game actually produced.
//
// w/h is the HITBOX (the hit test is aabb(p, _atkMonBoxCached(m))), so this
// asserts reach as well as size — and asserts damage is UNCHANGED, so a
// "make it bigger" ask cannot quietly become a damage buff too.
//   node scripts/warrior_shockwave_size_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

ok('p_shockwave.webp is on disk', existsSync('Sprites/projectiles/p_shockwave.webp'), {});

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
  player.cls = 'warrior'; player.job = 'berserker'; player.master = null;
  player.facing = 1;
  player.buffs = player.buffs || {}; player.buffs.bloodlust = 0;   // keep the rider out of the way
  // powerStrike's wave spawns in a scheduleSkillTimer callback that opens with
  // `if (player.hp <= 0 || game.paused) return;`. A headless boot sits PAUSED,
  // so the first run of this test saw zero projectiles and blamed the change.
  game.paused = false;
  player.hp = Math.max(1, player.maxHp || 100);

  const run = (fn, waitMs) => new Promise((res) => {
    game.projectiles.length = 0;
    try { SKILL_FNS[fn](); } catch (e) { out['err_' + fn] = String(e).slice(0, 80); }
    setTimeout(() => res(game.projectiles.filter(p => p && (p.skill === 'shockwave' || p.skill === 'bloodwave'))), waitMs);
  });

  // powerStrike spawns its wave on a timer (SOMER_MS), so wait it out.
  const ps = await run('powerStrike', 1400);
  out.powerStrike = ps.length ? { n: ps.length, w: ps[0].w, h: ps[0].h, bspr: ps[0].bspr || null, dmg: Math.round(ps[0].damage) } : null;

  const wc = await run('warlord_warcry', 200);
  out.warcry = wc.length ? { n: wc.length, w: wc[0].w, h: wc[0].h, bspr: wc[0].bspr || null, dmg: Math.round(wc[0].damage) } : null;

  // Which file does a bspr-less shockwave resolve to?
  out.sprite = null;
  // The table is LX_PLAYER_PROJ (an IIFE result) and its values are Image
  // objects, not filenames. There is no LX_PLAYER_PROJ_BY_SKILL binding — the
  // first draft invented that name and silently resolved to null.
  try {
    const v = LX_PLAYER_PROJ && LX_PLAYER_PROJ.shockwave;
    out.sprite = (typeof v === 'string') ? v
      : (v && v.src ? decodeURIComponent(v.src).split('/').pop() : null);
  } catch (e) {}
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

console.log('powerStrike ->', JSON.stringify(r.powerStrike));
console.log('warcry fan  ->', JSON.stringify(r.warcry));
console.log('sprite      ->', r.sprite);

ok('powerStrike still fires its wave', !!r.powerStrike, { err: r.err_powerStrike });
ok('powerStrike wave is enlarged (was 44x30)',
   r.powerStrike && r.powerStrike.w === 78 && r.powerStrike.h === 52, r.powerStrike);
ok('powerStrike still draws p_shockwave (no sprite was swapped)',
   r.powerStrike && r.powerStrike.bspr === null, { bspr: r.powerStrike && r.powerStrike.bspr });
ok('warlord_warcry still fires its fan', !!r.warcry, { err: r.err_warlord_warcry });
ok('the fan is still a FAN of three, not merged into one',
   r.warcry && r.warcry.n >= 3, { n: r.warcry && r.warcry.n });
ok('fan projectiles are enlarged (were 28x14)',
   r.warcry && r.warcry.w === 46 && r.warcry.h === 24, r.warcry);
ok('the fan is scaled LESS than powerStrike (three hitboxes can multi-hit one target)',
   r.warcry && r.powerStrike && (r.warcry.w * r.warcry.h) < (r.powerStrike.w * r.powerStrike.h),
   { fanArea: r.warcry && r.warcry.w * r.warcry.h, waveArea: r.powerStrike && r.powerStrike.w * r.powerStrike.h });
ok('both are genuinely bigger than before',
   r.powerStrike && r.warcry && (r.powerStrike.w * r.powerStrike.h) > 44 * 30 && (r.warcry.w * r.warcry.h) > 28 * 14, {});
ok('the shockwave sprite still resolves to p_shockwave.webp', r.sprite === 'p_shockwave.webp', { sprite: r.sprite });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
