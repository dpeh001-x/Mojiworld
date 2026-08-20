// Boss pillars wear their own warning art, and the art actually loads.
//
// Per user: "For boss column strikes, generate boss specific sprites to
// replace the generic markouts using ludo.ai." Five telegraph sprites
// (scripts/gen_col_telegraphs.mjs): one each for Legosaurus, Barnaby, the
// Arbiter and the Sovereign, plus one shared by the four zodiac column signs —
// mirroring how they share their strike beam.
//
// Measured in the live page: the LX_FX loader must decode all five, the zone
// descriptor must carry the right key per boss (through the real trigger), and
// a boss with no telegraph art must fall back to the procedural fill without a
// single page error.
//   node scripts/boss_col_telegraph_art_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync, statSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const FILES = ['tg_col_legosaurus', 'tg_col_young_confused_barnaby', 'tg_col_towerArbiter',
  'tg_col_towerSovereign', 'tg_col_zodiac'];
for (const f of FILES) {
  const p = `Sprites/fx/${f}.webp`;
  const there = existsSync(p) && statSync(p).size > 5000;
  ok(`${f}.webp is on disk and non-trivial`, there, { path: p, size: there ? statSync(p).size : 0 });
}

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
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof updateMonsters === 'function' && typeof _lxAttackZones === 'function',
  null, { timeout: 120000 });

// the LX_FX loader decodes all five
const decoded = await page.evaluate(async (keys) => {
  const t0 = Date.now();
  while (Date.now() - t0 < 20000) {
    const state = keys.map(k => ({ k, reg: !!(LX_FX && LX_FX[k]),
      ready: !!(LX_FX && LX_FX[k] && LX_FX[k].complete && LX_FX[k].naturalWidth > 0) }));
    if (state.every(s => s.ready)) return state;
    await new Promise(r => setTimeout(r, 250));
  }
  return keys.map(k => ({ k, reg: !!(LX_FX && LX_FX[k]),
    ready: !!(LX_FX && LX_FX[k] && LX_FX[k].complete && LX_FX[k].naturalWidth > 0) }));
}, FILES);
for (const d of decoded) ok(`LX_FX decodes ${d.k}`, d.reg && d.ready, d);

const r = await page.evaluate(() => {
  const out = {};
  const cs2 = document.getElementById('class-select-modal'); if (cs2) cs2.style.display = 'none';
  player.cls = 'warrior'; player.level = 60; player.hp = getMaxHp();
  window._prologueActive = false;
  if (typeof STORY_BEATS === 'object') { player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true; }
  try { loadMap('glasswindSteppe'); } catch (e) {}
  game.paused = false; game.camera.x = 400; game.camera.y = 0;

  // The zone must carry the right art key, through the REAL trigger.
  const colZoneFor = (type, traitsOverride) => {
    const t = monsterTypes[type] || {};
    const m = Object.assign({}, t, {
      type, name: t.name || type, w: t.w || 120, h: t.h || 140,
      x: 800, y: 400 - ((t.h || 140) - 60), vx: 0, vy: 0, onGround: true,
      maxHp: 1000000, currentHp: 1000000, isBoss: true, boss: true,
      level: t.level || 50, def: 0, evasion: 0, exp: 0, mojicoins: 0,
      traits: traitsOverride || t.traits, aggroTarget: player, facing: -1,
      atk: Math.ceil(getMaxHp() * 0.5),
      _bigMeleeCd: 99999, _columnCd: 0, _bdCd: 99999, shootTimer: 99999,
    });
    player.x = 700; player.y = 400;
    game.monsters.length = 0; game.monsters.push(m);
    game.projectiles.length = 0;
    for (let i = 0; i < 40; i++) { try { updateMonsters(16); } catch (e) {} if (m._columnFiring) break; }
    const z = _lxAttackZones().find(zz => zz.kind === 'column');
    // let the telegraph finish so nothing leaks into the next case
    for (let i = 0; i < 80 && (m._columnFiring || m._columnT > 0); i++) { try { updateMonsters(16); } catch (e) {} }
    return z ? { tg: z.tg || null } : null;
  };

  out.lego    = colZoneFor('legosaurus');
  out.barnaby = colZoneFor('young_confused_barnaby');
  out.arbiter = colZoneFor('towerArbiter');
  // a zodiac column sign, built the way zodiacBossAI builds it (shared art)
  out.zodiac  = colZoneFor('zodiac_taurus', { activeBoss: true,
    columnStrike: { dmgMul: 1.25, width: 120, range: 580, cdMs: 7400, telegraphMs: 720, color: '#aa66ff', sprite: 'fx_col_zodiac' } });
  // a boss with NO telegraph art: zone still exists, draw must not throw
  out.noArt = colZoneFor('pqConductor', { activeBoss: true,
    columnStrike: { dmgMul: 1.5, width: 110, range: 560, cdMs: 7000, telegraphMs: 650 } });
  out.noArtReady = !!(LX_FX && LX_FX['tg_col_pqConductor']);

  game.monsters.length = 0; game.projectiles.length = 0;
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

console.log('lego   :', JSON.stringify(r.lego));
console.log('barnaby:', JSON.stringify(r.barnaby));
console.log('arbiter:', JSON.stringify(r.arbiter));
console.log('zodiac :', JSON.stringify(r.zodiac));
console.log('no-art :', JSON.stringify(r.noArt), '| registered anyway:', r.noArtReady);

ok('Legosaurus pillar zone carries its own art', r.lego && r.lego.tg === 'tg_col_legosaurus', r.lego);
ok('Barnaby pillar zone carries its own art', r.barnaby && r.barnaby.tg === 'tg_col_young_confused_barnaby', r.barnaby);
ok('the Arbiter pillar zone carries its own art', r.arbiter && r.arbiter.tg === 'tg_col_towerArbiter', r.arbiter);
ok('a zodiac column sign shares the zodiac telegraph, like its strike beam',
   r.zodiac && r.zodiac.tg === 'tg_col_zodiac', r.zodiac);
ok('a boss with no telegraph art still zones (procedural fallback, no crash)',
   r.noArt && r.noArt.tg === 'tg_col_pqConductor' && r.noArtReady === false, { zone: r.noArt, registered: r.noArtReady });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
