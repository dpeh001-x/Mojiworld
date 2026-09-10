// Two zodiac findings from the v0.30.496 audit (fixed v0.30.497):
//   1. Zodiac SIGILS dropped from echo bosses. Sigils trade at Brok for setshards, so a
//      re-summonable Echo / Nightmare / Duo Trial zodiac boss was a per-kill shard farm —
//      the exact thing the _echoBoss tag exists to prevent, and which the setshard drop
//      360 lines below already guarded against.
//   2. The flat zodiac-projectile roll replaced _projLost wholesale, discarding difficulty.
//      Story and Nightmare dealt byte-identical damage; an expedition Hard run's 150% boss
//      hit for exactly what the same boss hits for on Easy.
//
//   node scripts/audit_zodiac_echo_test.mjs      MOJI_SERVE_ROOT / PORT override
//
// Negative control: 1 and 2 both fail on v0.30.496.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10418); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
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
    player.level = 85; player.cls = 'mage'; player._god = false;
    o.band = (typeof LX_ZODIAC_PROJ_MIN !== 'undefined') ? [LX_ZODIAC_PROJ_MIN, LX_ZODIAC_PROJ_MAX] : null;
    o.sigilPrice = (typeof SIGIL_TRADE_SHARDS === 'number') ? SIGIL_TRADE_SHARDS : null;

    // ---- 1. sigil drops --------------------------------------------------
    // Drive the real drop resolver with a zodiac boss carcass, once tagged and once not.
    const sigilCount = () => (player.inventory || []).filter((i) => i && i.zodiacSigil).length;
    const dropRun = (tags) => {
      player.inventory = [];
      const m = { type: 'zodiac_aries', name: 'Aries', isZodiac: true, zodiacSign: 'aries',
        x: player.x + 60, y: player.y, w: 60, h: 60, level: 85, exp: 0, mojicoins: 0,
        currentHp: 0, maxHp: 1, hp: 0, atk: 1, def: 1, vx: 0, vy: 0, dead: false,
        zodiacBoss: true, isBoss: true, ...tags };
      game.monsters.push(m);
      let err = null;
      try { killMonster(m); } catch (e) { err = String(e.message).slice(0, 90); }
      const i = game.monsters.indexOf(m); if (i >= 0) game.monsters.splice(i, 1);
      return { sigils: sigilCount(), err };
    };
    o.dropPlain     = dropRun({});
    o.dropEcho      = dropRun({ _echoBoss: true });
    o.dropDuo       = dropRun({ _echoBoss: true, _duoTrial: true });
    o.dropExped     = dropRun({ _expeditionBoss: true });
    o.dropTwin      = dropRun({ _isTwin: true });
    player.inventory = [];

    // ---- 2. difficulty scaling ------------------------------------------
    // game._diffDmgMul is re-stamped from the settings by the game's own tick, and the tick can
    // land WHILE a shot is in flight - the harness sets 2.0, awaits up to 500 ms for the projectile
    // to resolve, and the settings pass restores 1.0 underneath it. Assigning per batch and even
    // per shot both produced blended means (a Nightmare row at 6200 against 8000, a Hard row at
    // 1639). Pinned as a non-writable getter for the duration instead, so what the damage path
    // reads is what the batch asked for. Restored to a plain value afterwards.
    let _expFor = null;
    const pinDiff = (mul) => { try { Object.defineProperty(game, '_diffDmgMul', { get: () => mul, set: () => {}, configurable: true }); } catch (e) { game._diffDmgMul = mul; } game._diffTier = null; };
    const unpinDiff = (mul) => { try { delete game._diffDmgMul; } catch (e) {} game._diffDmgMul = mul; game._diffTier = null; };
    const fire = async (sign, defVal) => {
      for (let attempt = 0; attempt < 4; attempt++) {
        game.paused = false;
        // Same reason for the expedition: game.expedition is live state the sim writes to, and a
        // batch that stamps it once can be blanked partway through (a run 'ending' on a non-tower
        // map). Re-stamped per shot so every sample in a batch is really at the tier it claims.
        if (_expFor != null) { game.expedition = game.expedition || {}; game.expedition.active = true; game.expedition.difficulty = _expFor; }
        player.baseDef = defVal; player.mods.def = 0;
        if (typeof invalidateEquipBonusCache === 'function') invalidateEquipBonusCache();
        if (typeof refreshGearCache === 'function') refreshGearCache();
        player.maxHp = 900000; player.hp = 900000;
        player.blockTimer = 0; player._aegis = false;
        player.invulnerable = 0; player.lastHitTime = -9999;
        game.projectiles.length = 0;
        const before = player.hp;
        game.projectiles.push({ x: player.x + player.w / 2 - 6, y: player.y + player.h / 2 - 6, vx: 0, vy: 0,
          w: 12, h: 12, life: 120, damage: 400, owner: 'enemy', skill: 'mbolt', color: '#fff',
          _zodiacAttacker: !!sign, _zodiacSign: sign || null });
        for (let i = 0; i < 25 && player.hp === before; i++) await sleep(20);
        const lost = before - player.hp;
        game.projectiles.length = 0; player.invulnerable = 0; player.lastHitTime = -9999;
        if (lost > 0) return lost;
      }
      return 0;
    };
    const meanAt = async (mul, n) => {
      pinDiff(mul);
      const out = [];
      for (let i = 0; i < n; i++) out.push(await fire('aries', 0));
      return Math.round(out.reduce((s, x) => s + x, 0) / out.length);
    };
    o.story     = await meanAt(0.5, 30);
    o.normal    = await meanAt(1.0, 30);
    o.hard      = await meanAt(1.5, 30);
    o.nightmare = await meanAt(2.0, 30);
    unpinDiff(1);

    // expedition stat column on top of the global setting
    const expedAt = async (key, n) => {
      _expFor = key;
      const out = [];
      for (let i = 0; i < n; i++) out.push(await fire('aries', 0));
      _expFor = null; game.expedition.active = false;
      return Math.round(out.reduce((s, x) => s + x, 0) / out.length);
    };
    o.expEasy = await expedAt('easy', 24);
    o.expHard = await expedAt('hard', 24);
    try { game.expedition.active = false; game.expedition.difficulty = 'normal'; } catch (e) {}
    return o;
  });

  console.log('build ' + r.ver + '   band ' + JSON.stringify(r.band) + '   sigil trades for ' + r.sigilPrice + ' setshards');
  console.log(`drops  plain=${JSON.stringify(r.dropPlain)} echo=${JSON.stringify(r.dropEcho)} duo=${JSON.stringify(r.dropDuo)} exped=${JSON.stringify(r.dropExped)} twin=${JSON.stringify(r.dropTwin)}`);
  console.log(`damage story=${r.story}  normal=${r.normal}  hard=${r.hard}  nightmare=${r.nightmare}   expEasy=${r.expEasy} expHard=${r.expHard}\n`);

  ok('a real zodiac boss still drops its sigil', r.dropPlain.sigils === 1, JSON.stringify(r.dropPlain));
  ok('an ECHO zodiac boss drops none', r.dropEcho.sigils === 0, JSON.stringify(r.dropEcho));
  ok('a Duo Trial zodiac boss drops none', r.dropDuo.sigils === 0, JSON.stringify(r.dropDuo));
  ok('an expedition zodiac boss drops none', r.dropExped.sigils === 0, JSON.stringify(r.dropExped));
  ok('a split twin still drops none (v0.30.412 unchanged)', r.dropTwin.sigils === 0, JSON.stringify(r.dropTwin));

  // The roll is uniform over the declared band, so every mean is an ESTIMATE. Each tier is
  // therefore checked against the band's own midpoint x its multiplier — a fixed target — and
  // never against a second measured mean, which would put sampling error on both sides of the
  // comparison and flake. 30 samples of a 3000-5000 uniform give a standard error near 105, so
  // a 15% window on the expected value is roughly ten sigma at Normal and never less than six.
  const MID = (r.band[0] + r.band[1]) / 2;
  const tier = (name, got, mul) => ok(`${name} lands on the band x${mul.toFixed(2)}`,
    Math.abs(got - MID * mul) <= MID * mul * 0.15, `${got} vs ${Math.round(MID * mul)} expected`);
  ok('Normal keeps the authored 3000-5000 band', r.normal >= r.band[0] && r.normal <= r.band[1], 'mean ' + r.normal);
  ok('the four tiers are strictly ordered', r.story < r.normal && r.normal < r.hard && r.hard < r.nightmare, `${r.story} < ${r.normal} < ${r.hard} < ${r.nightmare}`);
  tier('Story', r.story, 0.5);
  tier('Normal', r.normal, 1.0);
  tier('Hard', r.hard, 1.5);
  tier('Nightmare', r.nightmare, 2.0);
  ok('Story and Nightmare are not the same number', r.nightmare > r.story * 3, `story ${r.story}, nightmare ${r.nightmare}`);
  ok('an expedition Hard run hits harder than an Easy one', r.expHard > r.expEasy * 1.8, `easy ${r.expEasy} vs hard ${r.expHard}`);
  tier('expedition Easy', r.expEasy, 0.60);
  tier('expedition Hard', r.expHard, 1.50);
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally {
  await browser.close(); server.kill();
}
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
