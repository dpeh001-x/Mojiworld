// Live test: TAUR'S GORING CHARGE — telegraphed lane, then a hit that hurts.
//
// Per user: "Zodiac taurus boss is way too easy. Add more lethal attacks like a
// charging one, with like zones indicating danger, then deal a lot of damage,
// like bring down to 1."
//
// The bull is spawned through the REAL spawnMonster and ticked through the REAL
// updateMonsters — a hand-built monster object looks identical but never runs
// the trait (spawnMonster sets fields the update loop gates on), which cost this
// test one confusing red run. The damage is measured off the player on the exact
// tick the gore fires, so ordinary contact damage cannot be mistaken for it.
//   node scripts/taurus_gore_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof spawnMonster === 'function' && typeof updateMonsters === 'function'
  && typeof _lxAttackZones === 'function' && monsterTypes.zodiac_taurus, null, { timeout: 120000 });
await page.evaluate(() => { try { void LX_FX.tg_dash_zodiac_taurus; void LX_FX.fx_taurus_gore; } catch (e) {} });
await page.waitForFunction(() => { try { const a = LX_FX.tg_dash_zodiac_taurus, c = LX_FX.fx_taurus_gore;
  return !!(a && a.complete && a.naturalWidth > 0 && c && c.complete && c.naturalWidth > 0); } catch (e) { return false; } },
  null, { timeout: 40000 }).catch(() => {});
await page.waitForTimeout(1500);

const r = await page.evaluate(() => {
  const out = {};
  const T = monsterTypes.zodiac_taurus;
  out.trait = T.traits && T.traits.braceDash ? { ...T.traits.braceDash } : null;
  out.stillHasColumn = !!(T.traits && T.traits.columnStrike);
  out.art = { lane: !!(LX_FX.tg_dash_zodiac_taurus && LX_FX.tg_dash_zodiac_taurus.naturalWidth > 0),
              gore: !!(LX_FX.fx_taurus_gore && LX_FX.fx_taurus_gore.naturalWidth > 0) };
  out.otherSigns = Object.keys(monsterTypes).filter(k => k.startsWith('zodiac_')
    && k !== 'zodiac_taurus' && monsterTypes[k].traits && monsterTypes[k].traits.braceDash);

  // NOT paused: _diffDmg returns 0 for a paused player by design (v0.29.672 -
  // "a PAUSED player cannot be harmed"), so pausing the world to drive the sim
  // silently zeroes every damage assertion in this file. That cost a run that
  // looked exactly like the gore not firing.
  game.paused = false;
  const maxHp = (typeof getMaxHp === 'function') ? getMaxHp() : player.maxHp;
  // A real character has player.maxHp written from its class stats; a title-screen
  // player does not, and the %-of-maxHP path multiplies by exactly that field —
  // so without this the gore computes 0 damage and silently no-ops. That cost a
  // red run that looked like the feature was broken.
  const reset = () => { player.maxHp = player.maxHp || maxHp;
    player.hp = maxHp; player.invulnerable = 0; player._god = false;
    player.blockTimer = 0; player._aegis = false; player.vx = 0; player.vy = 0; };
  reset();
  game.monsters = []; game.projectiles = [];
  spawnMonster(400, 400, 'zodiac_taurus', true);
  const bull = game.monsters[0];
  if (!bull) { out.spawnFailed = true; return out; }

  // Stand well clear so ordinary contact damage cannot muddy the reading, but
  // inside braceDash's 900px range so the brace will actually start.
  const park = () => { player.x = bull.x + 620; player.y = 400; reset(); };
  park();
  // 1) wait for the brace to begin ON ITS OWN — the cooldown is real
  let braced = false;
  for (let i = 0; i < 600 && !braced; i++) {
    game.time++; updateMonsters(16);
    park();                                   // hold position; the bull may drift
    braced = !!(bull._braceDashing && bull._bdPhase === 'brace');
  }
  out.braced = braced;
  const zones = _lxAttackZones().filter(z => z.kind === 'dash');
  out.zone = zones[0] ? { kind: zones[0].kind, w: Math.round(zones[0].w), h: Math.round(zones[0].h),
                          dir: zones[0].dir, tg: zones[0].tg } : null;

  // 2) THE GORE ITSELF. The bull is placed overlapping the player and one dash
  // tick is run, rather than choreographing its pathing: the brace, the lane and
  // the self-driven cooldown are already proven above, and steering a 620px
  // charge onto a fixed point from a script only tests the harness. Measured on
  // the exact tick the flag flips, so ordinary contact damage cannot be counted.
  let hpBeforeGore = null, hpAfterGore = null, sawGore = false;
  {
    player.x = bull.x + 20; player.y = bull.y + 10; reset();
    bull._braceDashing = true; bull._bdPhase = 'dash';
    bull._bdT = 400; bull._bdVx = 14; bull._bdTravel = 0; bull._bdGored = false;
    for (let i = 0; i < 12 && !sawGore; i++) {
      player.x = bull.x + 20; player.y = bull.y + 10; player.invulnerable = 0;
      const before = player.hp;
      game.time++; updateMonsters(16);
      if (bull._bdGored) { sawGore = true; hpBeforeGore = before; hpAfterGore = player.hp; }
    }
  }
  out.hit = { sawGore, before: hpBeforeGore, after: hpAfterGore, maxHp,
              lost: sawGore ? hpBeforeGore - hpAfterGore : 0,
              lostPct: sawGore ? +(100 * (hpBeforeGore - hpAfterGore) / maxHp).toFixed(1) : 0 };

  // 3) once per charge. Measured by the gore's OWN signature rather than by a
  // health drop: a Lv-70 bull standing on you deals enormous ordinary contact
  // damage, so "lost more than half" is not evidence of a second gore - it is
  // just the bull. _lastDamageSource is stamped only by the gore.
  let reHit = false;
  if (sawGore) {
    player._lastDamageSource = null; player.hp = maxHp;
    for (let i = 0; i < 40 && bull._bdPhase === 'dash'; i++) {
      player.x = bull.x + 20; player.y = bull.y + 10; player.invulnerable = 0;
      player.hp = maxHp;                       // keep them alive to keep testing
      game.time++; updateMonsters(16);
      if (player._lastDamageSource === 'a goring charge') reHit = true;
    }
  }
  out.reHit = reHit;

  // 4) The dodge that counts is being OUT of the lane. i-frames are NOT the
  // check any more (per user the gore fires on touch, and the bull's own contact
  // damage grants i-frames the same tick), so this asserts the real one: stand
  // clear of the body and the charge takes nothing.
  reset();
  bull._bdGored = false; bull._braceDashing = true; bull._bdPhase = 'dash';
  bull._bdT = 400; bull._bdVx = 14; bull._bdTravel = 0;
  const hpClear = player.hp;
  for (let i = 0; i < 30; i++) { player.x = bull.x + 900; player.y = 400; player.invulnerable = 0;
    game.time++; updateMonsters(16); }
  out.dodged = (player.hp === hpClear) && !bull._bdGored;

  game.monsters = []; game.projectiles = []; player.invulnerable = 0;
  return out;
});

ok('Taur has a braceDash charge with a gore payload',
  r.trait && r.trait.gore && r.trait.gore.frac >= 0.9 && r.trait.telegraphMs >= 700, { trait: r.trait });
ok('...added to his kit, not swapped for his column strike', r.stillHasColumn, {});
ok('...and only to him — the other eleven Houses are untouched', r.otherSigns.length === 0,
  { alsoCharging: r.otherSigns });
ok('both new sprites decode', r.art.lane && r.art.gore, r.art);
ok('the charge braces on its own through the real update loop', r.braced, { braced: r.braced });
ok('the DANGER LANE is published during the brace, using his own art',
  r.zone && r.zone.kind === 'dash' && r.zone.w > 500 && r.zone.tg === 'tg_dash_zodiac_taurus', r.zone);
ok('a connect takes ~99% of MAX HP — from full it brings you to 1, it does not kill',
  r.hit.sawGore && r.hit.after >= 1 && r.hit.lostPct > 90,
  { lost: r.hit.lost, ofMax: r.hit.maxHp, pct: r.hit.lostPct + '%', leftOn: r.hit.after });
ok('it lands at most ONCE per charge', r.hit.sawGore && !r.reHit, { reHit: r.reHit });
ok('stepping OUT of the lane takes nothing — the dodge is position, not i-frames',
  r.dodged, { dodged: r.dodged });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
