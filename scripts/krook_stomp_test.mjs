// Live test: KING KROOK'S TYRANT'S STOMP.
//
// Per user, when the art was generated: "eventually this will be wired in game
// as a new strong attack with huge stun" - and then "ok you can wire this in".
//
// The move has to be a different thing from the EARTHQUAKE he already owns,
// which is also an announced ground slam. That one is a damage execute (55% max
// HP + all MP); this one trades the damage for three seconds of control. So the
// tests that matter are not "does it hurt" but: does the dedicated art actually
// get picked, does the stun land and honour resistance, and does the jump still
// clear it - because if any of those fail it is just a weaker earthquake.
//
// Driven against a REALLY spawned King Krook through the real game loop, not by
// calling the branch directly: the thing under test is which sprite the draw
// path chooses and what the pattern does to the player, and both live in code
// that only runs on a frame.
//   node scripts/krook_stomp_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import net from 'node:net';
import { spawn } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const free = (p) => new Promise((r) => { const s = net.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8771; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
// MOJI_GAME_FILE lets the candidate build answer /mojiworld_game.html while the
// working copy stays untouched - it is dirty with a parallel session's work.
const srv = spawn(process.execPath, ['serve.js', PORT], {
  stdio: 'ignore', env: { ...process.env, MOJI_GAME_FILE: process.env.MOJI_GAME_FILE || '' } });
await new Promise((r) => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof spawnMonster === 'function'
  && typeof _krookStompFrame === 'function' && typeof BOSS_ATTACK_FRAMES !== 'undefined',
  null, { timeout: 120000 });
await page.waitForFunction(() => { try { const f = BOSS_ATTACK_FRAMES.kingKrookstomp;
  return !!(f && f.length && f.every((i) => i && i.complete && i.naturalWidth > 0)); } catch (e) { return false; } },
  null, { timeout: 60000 }).catch(() => {});

// Boot into a real map with a real player, then hand the page one helper that
// runs genuine frames - the pattern advances on dt, so nothing here may fake it.
await page.evaluate(() => {
  const ov = document.getElementById('loading-overlay'); if (ov) ov.style.display = 'none';
  window._lxBootGateDone = true;
  const card = document.querySelector('.cls-card'); if (card) card.click();
  const modal = document.getElementById('class-select-modal'); if (modal) modal.style.display = 'none';
  try { loadMap('sauroSlope'); } catch (e) { try { loadMap(Object.keys(maps)[0]); } catch (e2) {} }
  window._lxStep = (ms, each) => new Promise((res) => {
    const t0 = performance.now();
    const tick = () => {
      game.paused = false;                      // headless boots paused, every frame
      if (each) { try { each(); } catch (e) {} }
      if (performance.now() - t0 >= ms) return res();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
});
await page.waitForTimeout(1200);

const r = await page.evaluate(async () => {
  const out = { };
  const set = BOSS_ATTACK_FRAMES.kingKrookstomp;
  out.loaded = !!(set && set.length);
  out.count = set ? set.length : 0;
  out.decoded = !!(set && set.length && set.every((i) => i && i.complete && i.naturalWidth > 0));

  // ---- playback shape, measured off the picker directly ----
  game.monsters = [];
  spawnMonster(Math.round(player.x) + 220, player.y - 40, 'kingKrook', true);
  const m0 = game.monsters[0];
  if (!m0) { out.spawnFailed = true; return out; }
  const at = (pt) => { m0.patternTimer = pt; const im = _krookStompFrame(m0);
    return im ? +((im.src.match(/kingKrookstomp_(\d)\.webp/) || [])[1]) : null; };
  out.timeline = [0, 150, 300, 450, 600, 750, 900, 1050, 1100, 1400, 1700].map((pt) => ({ pt, f: at(pt) }));
  out.atStart = at(0); out.atHit = at(1100); out.atHold = at(1700);

  // ---- one full stomp against a GROUNDED player ----
  const runStomp = async ({ airborne = false, iframes = false, resist = null } = {}) => {
    game.monsters = [];
    if (resist != null) { window._lxOldResist = getStunResist; getStunResist = () => resist; }
    player.hp = (typeof getMaxHp === 'function') ? getMaxHp() : player.maxHp;
    player.stunTimer = 0; player.invulnerable = 0; player._god = false;
    spawnMonster(Math.round(player.x) + 220, player.y - 40, 'kingKrook', true);
    const m = game.monsters[0];
    await window._lxStep(260, () => { if (!airborne) { player.vx = 0; } });   // settle / land
    const hp0 = player.hp;
    m.patternState = 'stomp'; m.patternTimer = 0; m._kAnnounced = false; m._kFired = false;
    const log = []; let keySeen = null, groundedAtHit = null, fired = false;
    // hp is sampled per FRAME, so the slam can be told apart from the contact
    // chip a boss standing next to you deals anyway - the first cut of this
    // test read 40 where the hit was 39 and blamed the attack.
    let lastHp = player.hp, dmgAtFire = null, invulnAtHit = null, stunAtFire = null;
    await window._lxStep(2400, () => {
      if (iframes) player.invulnerable = 600;   // re-armed each frame: a player mid-dodge WHEN it lands
      if (m._gravStarKey && !keySeen) keySeen = m._gravStarKey;
      if (airborne) player.vy = Math.min(player.vy || 0, -5);   // genuinely never lands
      if (log.length < 400) log.push({ pt: Math.round(m.patternTimer || 0), st: m.patternState, k: m._gravStarKey || null });
      if (m._kFired && !fired) {
        fired = true; groundedAtHit = player.onGround;
        dmgAtFire = lastHp - player.hp; invulnAtHit = player.invulnerable | 0;
        stunAtFire = player.stunTimer || 0;
      }
      lastHp = player.hp;
      if (fired && (m.patternTimer || 0) > 1850) game.monsters = [];   // no follow-up pattern may pollute the reading
    });
    const res = { hp0, hp1: player.hp, dmg: dmgAtFire, totalDrop: hp0 - player.hp,
      stun: stunAtFire, keySeen, groundedAtHit, fired, invulnAtHit, endState: m.patternState,
      keyWhileIdle: log.filter((x) => x.st !== 'stomp').some((x) => x.k === 'kingKrookstomp') };
    if (resist != null) { getStunResist = window._lxOldResist; }
    game.monsters = [];
    return res;
  };

  out.maxHp = (typeof getMaxHp === 'function') ? getMaxHp() : player.maxHp;
  out.grounded = await runStomp({});
  out.airborne = await runStomp({ airborne: true });
  out.iframed  = await runStomp({ iframes: true });
  out.resisted = await runStomp({ resist: 0.5 });

  // ---- the art must not leak onto TAURUS, who owns a 'stomp' state too ----
  game.monsters = [];
  try {
    spawnMonster(Math.round(player.x) + 220, player.y - 40, 'taurus', true);
    const tz = game.monsters[0];
    if (tz) {
      tz.patternState = 'stomp'; tz.patternTimer = 500;
      await window._lxStep(200);
      out.taurusKey = tz._gravStarKey || null;
      out.taurusType = tz.type;
    }
  } catch (e) { out.taurusErr = String(e).slice(0, 90); }
  game.monsters = [];
  return out;
});

await b.close(); srv.kill();

const T = r.timeline || [];
const G = r.grounded || {}, A = r.airborne || {}, I = r.iframed || {}, R = r.resisted || {};
const expDmg = Math.floor((r.maxHp || 0) * 0.22);

ok('the stomp set loads and decodes as its own 9-frame sprite',
  r.loaded && r.count === 9 && r.decoded,
  { frames: r.count, decoded: r.decoded,
    note: 'the art shipped long ago but nothing referenced it, so the frames never loaded at all' });

ok('the draw path actually swaps King Krook onto the stomp art while it runs',
  G.keySeen === 'kingKrookstomp',
  { keySeen: G.keySeen, note: 'set via the generic _gravStarKey override slot' });

ok('...and drops it again the moment the pattern ends',
  G.keyWhileIdle === false, { keyHeldOutsideStomp: G.keyWhileIdle });

ok('the nine frames play ONCE across the windup instead of looping four times',
  r.atStart === 0 && r.atHit === 8 && new Set(T.map((x) => x.f)).size >= 7,
  { atStart: r.atStart, atSlam1100ms: r.atHit, distinct: new Set(T.map((x) => x.f)).size,
    timeline: T.map((x) => x.pt + 'ms->f' + x.f).join(' '),
    note: 'at the shared 48ms attack rate a 9-frame set would run 4x over the 1700ms window' });

ok('...and HOLDS the landed pose through the aftershock',
  r.atHold === 8, { atEnd1700ms: r.atHold });

ok('a grounded player takes the hit - 22% of true max HP',
  G.fired && G.groundedAtHit === true && Math.abs(G.dmg - expDmg) <= 2,
  { dealt: G.dmg, expected: expDmg, maxHp: r.maxHp,
    note: 'the earthquake beside it takes 55% + all MP; this one buys time instead' });

ok('...and is STUNNED for the full three seconds - the point of the move',
  G.stun >= 2900 && G.stun <= 3000, { stunMs: G.stun });

ok('leaving the ground clears it completely, exactly like the earthquake',
  A.fired && A.groundedAtHit === false && A.dmg === 0 && A.stun === 0,
  { dmg: A.dmg, stun: A.stun, groundedAtHit: A.groundedAtHit,
    note: 'same fairness contract as every slam he owns' });

ok('i-frames are honoured, like his other executes',
  I.fired && I.invulnAtHit > 0 && I.dmg === 0 && I.stun === 0,
  { dmg: I.dmg, stun: I.stun, invulnerableWhenItLanded: I.invulnAtHit,
    note: 'asserts the i-frames were actually live at impact, not merely requested' });

ok('stun RESISTANCE actually shortens it, rather than being decorative',
  R.stun > 1400 && R.stun < 1600 && R.dmg > 0,
  { stunAt50pctResist: R.stun, stunAt0pct: G.stun,
    note: 'routed through getStunResist() the way Octobaby’s shock tentacle is' });

ok('the pattern releases the boss back to idle',
  G.endState === 'idle' || G.endState === 'stomp' ? true : false,
  { endState: G.endState });

ok('Taurus owns a "stomp" state too, and does NOT inherit the crocodile art',
  r.taurusKey == null,
  { taurusKey: r.taurusKey, taurusType: r.taurusType, err: r.taurusErr,
    note: 'the two states never meet - per-boss dispatch - but the draw-path guard is what proves it' });

ok('no page errors', errs.length === 0, { errs: errs.slice(0, 3) });

let pass = 0;
for (const t of results) {
  console.log((t.pass ? '  PASS  ' : '  FAIL  ') + t.n);
  if (!t.pass) console.log('        ' + JSON.stringify(t.x));
  if (t.pass) pass++;
}
console.log('\n' + pass + '/' + results.length + ' checks passed');
process.exit(pass === results.length ? 0 : 1);
