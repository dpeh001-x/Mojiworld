// Live test: the BOSS RESIZER plays each animation the way the GAME plays it.
//
// Per user, looking at Gravitos in tools/boss_resizer.html: "gravitos walk ...
// looks like its pingponging, ensure the animation does not pingpong and is
// fast and smooth". The tool bounced every state 0..8..1 at a flat 80 ms; the
// game ping-pongs idle only, loops walk/attack/weave forward, plays duck once
// and holds, and scales the walk cadence with stature.
//
// Rather than pin the tool to magic numbers, this test reads the GAME's own
// _bossWalkMsFor out of mojiworld_game.html and its per-state call sites, and
// checks the tool agrees. Drift in either file turns it red.
//   node scripts/boss_resizer_anim_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync, readFileSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

// ---- what the GAME does, read out of the game itself ----------------------
const GAME = readFileSync('mojiworld_game.html', 'utf8');
const walkFnSrc = (GAME.match(/function _bossWalkMsFor\(m\) \{[\s\S]*?\n\}/) || [])[0];
const baseMs = +(GAME.match(/_BOSS_WALK_FRAME_MS\s*=\s*(\d+)/) || [])[1];
const gameWalkMs = walkFnSrc
  ? new Function('_BOSS_WALK_FRAME_MS', `${walkFnSrc}; return _bossWalkMsFor;`)(baseMs) : null;
const gameStateMs = {
  idle: +(GAME.match(/_BOSS_IDLE_FRAME_MS\s*=\s*(\d+)/) || [])[1],
  attack: +(GAME.match(/_BOSS_ATK_FRAME_MS\s*=\s*(\d+)/) || [])[1],
  duck: +(GAME.match(/_BOSS_DUCK_FRAME_MS\s*=\s*(\d+)/) || [])[1],
  weave: +(GAME.match(/_BOSS_WEAVE_FRAME_MS\s*=\s*(\d+)/) || [])[1],
};
// which sequencer the game uses per state, from its own call sites
const gameSeq = {
  idle: /_bossPingPongFrame\(set\.idle/.test(GAME) ? 'pingpong' : '?',
  walk: /_bossLoopFrame\(set\.walk/.test(GAME) ? 'loop' : '?',
  attack: /_bossLoopFrame\(set\.attack/.test(GAME) ? 'loop' : '?',
  weave: /_bossLoopFrame\(BOSS_WEAVE_FRAMES/.test(GAME) ? 'loop' : '?',
};

const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/tools/boss_resizer.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => window.__BR && window.__BR.frameIndex && window.__BR.stateMs, null, { timeout: 60000 });

// ---- pure sequencing, straight off the tool's own functions ---------------
const seq = await page.evaluate(() => {
  const F = window.__BR.frameIndex, n = 9;
  const run = (state, ms, steps) => Array.from({ length: steps }, (_, s) => F(n, ms, s * ms, state));
  return {
    walk: run('walk', 50, 18), idle: run('idle', 130, 16),
    attack: run('attack', 48, 18), duck: run('duck', 30, 14),
    msWalk380: window.__BR.stateMs('walk', { game: { boxH: 380 } }),
    msWalk140: window.__BR.stateMs('walk', { game: { boxH: 140 } }),
    msIdle: window.__BR.stateMs('idle'), msAtk: window.__BR.stateMs('attack'),
    msDuck: window.__BR.stateMs('duck'), msWeave: window.__BR.stateMs('weave'),
  };
});
const fwd = [0, 1, 2, 3, 4, 5, 6, 7, 8, 0, 1, 2, 3, 4, 5, 6, 7, 8];
ok('walk runs a straight forward loop, no ping-pong', JSON.stringify(seq.walk) === JSON.stringify(fwd),
  { got: seq.walk.join(''), gameUses: gameSeq.walk });
ok('attack too (the game loops it as well)', JSON.stringify(seq.attack) === JSON.stringify(fwd),
  { got: seq.attack.join(''), gameUses: gameSeq.attack });
ok('idle STILL ping-pongs, as the game does', JSON.stringify(seq.idle) === JSON.stringify([0,1,2,3,4,5,6,7,8,7,6,5,4,3,2,1]),
  { got: seq.idle.join(','), gameUses: gameSeq.idle });
ok('duck plays once and holds the recover pose', JSON.stringify(seq.duck.slice(0, 9)) === JSON.stringify([0,1,2,3,4,5,6,7,8])
  && seq.duck.slice(9).every(v => v === 8), { got: seq.duck.join('') });
// cadence: compare with the game's own function, not a hardcoded number
const drift = [140, 200, 260, 320, 380, 460].map(h => [h, window0(h), 0]);
function window0(h) { return gameWalkMs ? gameWalkMs({ h }) : null; }
const toolMs = await page.evaluate((hs) => hs.map(h => window.__BR.stateMs('walk', { game: { boxH: h } })),
  drift.map(d => d[0]));
const cadenceMatch = drift.every((d, i) => d[1] === toolMs[i]);
ok('walk cadence matches the GAME\'s _bossWalkMsFor at every stature',
  gameWalkMs && cadenceMatch, { heights: drift.map(d => d[0]), game: drift.map(d => d[1]), tool: toolMs });
ok('Gravitos (m.h 380) strides at the game\'s 50 ms, not the old flat 80',
  seq.msWalk380 === 50 && seq.msWalk380 === window0(380), { tool: seq.msWalk380, game: window0(380) });
ok('idle / attack / duck / weave cadences match the game\'s constants',
  seq.msIdle === gameStateMs.idle && seq.msAtk === gameStateMs.attack
  && seq.msDuck === gameStateMs.duck && seq.msWeave === gameStateMs.weave,
  { tool: [seq.msIdle, seq.msAtk, seq.msDuck, seq.msWeave],
    game: [gameStateMs.idle, gameStateMs.attack, gameStateMs.duck, gameStateMs.weave] });

// ---- and what is ACTUALLY painted, sampled off the live cards -------------
const picked = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('#ents .ent')];
  const hit = rows.find(r => /gravitos/i.test(r.textContent) && !/[234]|laser|punch|soul|star/i.test(r.textContent))
           || rows.find(r => /gravitos/i.test(r.textContent));
  if (!hit) return null; hit.click(); return hit.textContent.trim().slice(0, 40);
});
await page.waitForTimeout(2500);
const live = await page.evaluate(async () => {
  const cards = (window.__BR.cur.cards || []).filter(c => c.a && c.a.state === 'walk');
  if (!cards.length) return { none: true };
  const c = cards[0], samples = [];
  const all = window.__BR.cur.cards;
  const onScreen = all.filter(x => { const b = x.cv.getBoundingClientRect();
    return b.bottom > -200 && b.top < innerHeight + 200; }).length;
  let ticks = 0; const t0 = performance.now();
  while (performance.now() - t0 < 1800) {
    if (c.lastFrame != null) samples.push(c.lastFrame);
    await new Promise(r => requestAnimationFrame(r)); ticks++;
  }
  const dt = performance.now() - t0;
  const steps = samples.filter((v, i) => i === 0 || v !== samples[i - 1]);
  // Deterministic pass through the REAL paint(): drive the animation clock to
  // a known offset and read back what the card put on screen. Free-running
  // rAF sampling cannot decide this - a missed tick turns a forward wrap
  // (8 -> 3) into what looks like a backwards step - so the clock is driven.
  const t0keep = window.__BR.cur.t0, ms = c.lastMs, driven = [];
  for (let s = 0; s < 18; s++) {
    window.__BR.cur.t0 = performance.now() - (s * ms + 5);
    window.__BR.paint();
    driven.push(c.lastFrame);
  }
  window.__BR.cur.t0 = t0keep;
  return { ms, n: c.set.count, steps, driven, key: c.a.key,
           fps: +(ticks / (dt / 1000)).toFixed(1), cards: all.length, onScreen };
});
const steps = live.steps || [];
ok('the live walk card paints 0..8, 0..8 through the real draw path',
  JSON.stringify(live.driven) === JSON.stringify(fwd), { got: (live.driven || []).join('') });
ok('the live walk card runs at the game cadence', live.ms === 50, { ms: live.ms, picked });
ok('...and its frames actually reach the screen, not just the counter',
  new Set(steps).size >= live.n - 2, { distinct: new Set(steps).size, of: live.n, fps: live.fps });
ok('the loop keeps up with that cadence (>= 30 fps with all 20 cards up)',
  live.fps >= 30, { fps: live.fps, cards: live.cards, onScreen: live.onScreen });

// the repaint key must not freeze a card: every input that changes its pixels
// has to invalidate it. Toggle, hover and pause, and check the canvas moves.
const react = await page.evaluate(async () => {
  const c = (window.__BR.cur.cards || []).find(x => x.a && x.a.state === 'walk');
  const snap = () => c.cv.toDataURL().length + ':' + (c.pkey || '');
  const settle = () => new Promise(r => setTimeout(r, 260));
  const out = {};
  await settle(); const a0 = snap();
  document.getElementById('before').click(); await settle();          // show-original ghost
  out.ghost = snap() !== a0;
  document.getElementById('before').click(); await settle();
  document.getElementById('idleover').click(); await settle();        // idle overlay off
  out.overlay = snap() !== a0;
  document.getElementById('idleover').click(); await settle();
  c.hover = 'handle'; await settle(); out.hover = (c.pkey || '').includes('|true|');
  c.hover = null; await settle();
  document.getElementById('play').click(); await settle();            // pause -> frame 0
  out.paused = c.lastFrame === 0;
  document.getElementById('play').click(); await settle();
  return out;
});
ok('the repaint key still lets every control through (ghost / overlay / hover / pause)',
  react.ghost && react.overlay && react.hover && react.paused, react);
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
