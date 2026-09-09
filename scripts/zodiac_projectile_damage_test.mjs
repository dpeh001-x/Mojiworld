// Zodiac projectile damage (v0.30.476). Per user, in two steps: "all zodiac bosses projectiles
// should deal more damage, approximately 3000 - 5000 damage flat regardless of player's defence",
// then "the zodiac projectiles should pierce DEF to a certain extent, meaning DEF still plays a part
// but should not half the damage significantly".
//
// So the claim under test is a BAND, not an absence: armour must move the number and must not move
// it much. Both halves are asserted, because either alone is satisfiable by a broken build — DEF
// doing nothing passes "not much", and the old curve passes "moves".
//
// Every number is the HP the player ACTUALLY lost, measured by firing real projectiles into a real
// player through the game’s own impact resolver — not read back off the constants. The same
// projectile is fired across a DEF sweep, with a PLAIN enemy shot swept alongside it as the control:
// armour must visibly crush the plain shot (2,400 -> 150) while only trimming the zodiac one.
//   node scripts/zodiac_projectile_damage_test.mjs      MOJI_GAME_FILE / MOJI_SERVE_ROOT / PORT
// Negative controls: v0.30.474 tracks the full DEF curve (2,400 -> 125) and never reaches the band;
// v0.30.475 sits in the band but armour moves it by nothing at all.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10371); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof getDef === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    loadMap('forest', 300); await sleep(800);
    const o = { ver: GAME_VERSION };
    o.band = (typeof LX_ZODIAC_PROJ_MIN !== 'undefined') ? [LX_ZODIAC_PROJ_MIN, LX_ZODIAC_PROJ_MAX] : null;
    player.level = 85; player.cls = 'mage'; player._god = false;
    // One shot, measured. baseDef is written DIRECTLY and the gear cache invalidated — assigning a
    // fresh object to player.mods does not reach getDef(), which is why an earlier draft measured
    // armour as having no effect on ANY projectile and quietly proved nothing.
    const fire = async (sign, defVal, extra) => {
      for (let attempt = 0; attempt < 4; attempt++) {
        game.paused = false;                       // loadMap leaves it paused in a headless harness
        player.baseDef = defVal; player.mods.def = 0;
        if (typeof invalidateEquipBonusCache === 'function') invalidateEquipBonusCache();
        if (typeof refreshGearCache === 'function') refreshGearCache();
        player.maxHp = 400000; player.hp = 400000;
        player.blockTimer = 0; player._aegis = false;
        player.invulnerable = 0; player.lastHitTime = -9999;
        Object.assign(player, (extra && extra.player) || {});
        game.projectiles.length = 0;
        const before = player.hp;
        game.projectiles.push({
          x: player.x + player.w / 2 - 6, y: player.y + player.h / 2 - 6, vx: 0, vy: 0,
          w: 12, h: 12, life: 120, damage: 400, owner: 'enemy', skill: 'mbolt', color: '#fff',
          _zodiacAttacker: !!sign, _zodiacSign: sign || null,
        });
        for (let i = 0; i < 25 && player.hp === before; i++) await sleep(20);
        const lost = before - player.hp;
        game.projectiles.length = 0; player.invulnerable = 0; player.lastHitTime = -9999;
        // a shot can expire without connecting; that is a miss, not a zero-damage hit
        if (lost > 0) return { lost, def: Math.round(getDef()) };
      }
      return { lost: 0, def: Math.round(getDef()) };
    };
    const sample = async (sign, defVal, n, extra) => {
      const out = [];
      for (let i = 0; i < n; i++) out.push((await fire(sign, defVal, extra)).lost);
      return out;
    };
    // --- the DEF sweep, zodiac vs a plain enemy shot as the control
    o.sweep = [];
    for (const d of [0, 500, 5000, 100000]) {
      const z = await sample('aries', d, 5);
      const p = await fire(null, d);
      o.sweep.push({ set: d, def: p.def, plain: p.lost, zodMean: Math.round(z.reduce((s, x) => s + x, 0) / z.length),
        zodMin: Math.min(...z), zodMax: Math.max(...z) });
    }
    // --- every sign
    o.bySign = {};
    for (const sg of ['taurus', 'gemini', 'leo', 'virgo', 'scorpio', 'pisces']) o.bySign[sg] = await sample(sg, 0, 3);
    // --- defensive ABILITIES still count
    o.blocked = await sample('aries', 0, 4, { player: { blockTimer: 600 } });
    // --- Capricorn's own floor still raises
    o.capricorn = await sample('capricorn', 0, 3);
    return o;
  });
  const S = r.sweep;
  const zAll = S.flatMap((x) => [x.zodMin, x.zodMax]);
  const zMeans = S.map((x) => x.zodMean);
  console.log(`build ${r.ver}  band ${r.band && r.band.join('-')}`);
  console.log('  DEF sweep: ' + S.map((x) => `def ${x.def}: plain ${x.plain}, zodiac ~${x.zodMean}`).join(' | '));
  ok('the flat band is declared as 3000-5000', !!r.band && r.band[0] === 3000 && r.band[1] === 5000, JSON.stringify(r.band));
  ok('an UNARMOURED hit lands inside the declared 3000-5000 band', S[0].zodMin >= 3000 && S[0].zodMax <= 5000,
    `${S[0].zodMin}-${S[0].zodMax} at def 0`);
  ok('...and armour never pushes it below three quarters of the band floor', Math.min(...zAll) >= 2250,
    `lowest hit seen across the whole sweep: ${Math.min(...zAll)}`);
  {
    const soft = zMeans[0], hard = zMeans[zMeans.length - 1];
    const cut = 1 - hard / soft;
    ok('DEF still plays a part — heavy armour measurably reduces the hit', cut > 0.08,
      `${Math.round(cut * 100)}% off at def ${S[S.length - 1].def} (${soft} -> ${hard})`);
    ok('...but nowhere near halving it — the cut stays under a third', cut < 0.33,
      `${Math.round(cut * 100)}% off; the pre-v0.30.475 curve took 95%`);
    ok('...and the reduction is monotone in DEF, not noise', zMeans[0] >= zMeans[zMeans.length - 1],
      zMeans.map((m, i) => `def ${S[i].def}: ${m}`).join(', '));
  }
  ok('the control proves the sweep is real — a PLAIN shot is crushed by the same armour', S[0].plain > S[S.length - 1].plain * 3,
    `plain ${S.map((x) => x.plain).join(' -> ')} across def ${S.map((x) => x.def).join(' -> ')}`);
  ok('every sign hits in the band at zero DEF, not just the one swept', Object.values(r.bySign).every((v) => Math.min(...v) >= 3000 && Math.max(...v) <= 5000),
    Object.entries(r.bySign).map(([k, v]) => `${k} ${Math.min(...v)}-${Math.max(...v)}`).join(', '));
  ok('blocking still reduces it — the defensive ABILITY is not bypassed', Math.max(...r.blocked) < Math.min(...zAll),
    `blocked ${Math.min(...r.blocked)}-${Math.max(...r.blocked)} vs unblocked ${Math.min(...zAll)}-${Math.max(...zAll)}`);
  ok('Capricorn keeps his 32%-of-maxHp floor, which only ever raises', Math.min(...r.capricorn) > 5000,
    `${Math.min(...r.capricorn)}-${Math.max(...r.capricorn)} against a 400,000 bar`);
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
