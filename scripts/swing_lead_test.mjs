// SWING LEAD: monster attacks never snap into the strike frame, never restart mid-swing, hand back to idle / walk on the
// rest pose, cherubs blink at a readable rate and never mid-swing, and a column strike is CAST (per user: the Archon's attack
// is "disjointed", the Astrofox's "transition between the animations is not smooth", cherubs "zipping around when attacking").
//  A. the Astrofox's shot (240 ms telegraph vs a 482 ms windup) plays from its first frames into the strike, frames only advance
//  B. an instant swing (a contact hit) on the Archon leads in through its windup and reaches the strike within 130 ms
//  C. a monster mid-swing does not start a shot windup; it starts as soon as the swing is over
//  D. out of an attack, idle starts on its first frame (the rest pose every swing ends on), whatever the per-mob seed
//  E. a cherub in reach blinks at most once per 2.4 s, never mid-swing, and lands without a walk-frame flash
//  F. the Archon's column strike plants it and plays its attack through the telegraph
//   node scripts/swing_lead_test.mjs [page.html] [port]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(import.meta.url)('playwright-core');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const FILE = (args[0] && /\.html$/i.test(args[0])) ? args[0] : 'mojiworld_game.html';
const PORT = Number(args.find((a) => /^\d+$/.test(a)) || process.env.PORT || 11791);
const env = { ...process.env }; if (FILE !== 'mojiworld_game.html') env.MOJI_GAME_FILE = FILE; else delete env.MOJI_GAME_FILE;   // served AT /mojiworld_game.html
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
let bad = 0, total = 0; const check = (ok, label, d) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${d !== undefined ? '  ' + JSON.stringify(d) : ''}`); if (!ok) bad++; };
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _monsterStateFrame === 'function' && typeof spawnMonster === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(3000);
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), o = {};
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const e = document.getElementById(id); if (e) { e.style.display = 'none'; e.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'mage'; player.level = 60; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    loadMap('stardustAtrium'); await sleep(3500); player._god = true; player.invulnerable = 1e9;
    // FREEZE the live loop for good: game.paused alone does not survive the awaits below, and a live step between two
    // samples starts the monster walking (walk art outranks attack art) or fires its shot. A hit-stop that never runs out
    // gates the whole update; the sections below step updateMonsters themselves.
    const hold = () => { game.paused = true; game.hitStop = 1e9; }; hold(); window.__slHold = setInterval(hold, 1);
    player.x = 900; player.y = 480 - player.h; player.vx = 0; player.vy = 0; game.camera.x = 420; game.camera.y = 0;
    const mk = async (type, dx) => { game.monsters.length = 0; const m = spawnMonster(player.x + dx, 480 - 140, type, false, false) || game.monsters[game.monsters.length - 1];
      m.y = 480 - m.h; m.onGround = true; m.vx = 0; m.vy = 0; const set = _monsterFramesFor(type); const t0 = performance.now();
      while (!(set.attack && set.attack.filter((f) => f && f.complete && f.naturalWidth > 0).length === 9 && set.idle && set.idle[8] && set.idle[8].complete) && performance.now() - t0 < 30000) { _monsterStateFrame(m); await sleep(50); }   // a loaded machine can take a while to decode nine frames
      return { m, set }; };
    // the picker runs on performance.now(): sample it on a CONTROLLED clock, 8 ms a step, so a stalled page cannot skip frames
    const sample = async (m, set, ms) => { m.vx = 0; m._walkLatch = false; m._animXV = 0; const P = performance, orig = P.now, t0 = orig.call(P); let t = t0; P.now = () => t;
      try { const seq = []; for (let e = 0; e <= ms; e += 8) { t = t0 + e; const f = _monsterStateFrame(m); seq.push([e, set.attack.indexOf(f)]); } return seq; } finally { P.now = orig; } };
    const strikeOf = (ft) => { let s = 0, b = -1; ft.forEach((v, i) => { if (v > b) { b = v; s = i; } }); return s; };
    const sum = (seq0, strike) => { const seq = seq0.filter((x) => x[1] >= 0);   // the swing's own frames (after it, the idle set)
      if (!seq.length) return { first: -1, strikeAt: -1, mono: false, last: -1, seen: 'no attack frame drawn (art not decoded?)' };
      return { first: seq[0][1], strikeAt: (seq.find((x) => x[1] >= strike) || [-1])[0], mono: seq.every((x, i) => i === 0 || x[1] >= seq[i - 1][1]), last: seq[seq.length - 1][1], seen: [...new Set(seq0.map((x) => x[1]))].join(',') }; };
    // A. the Astrofox shot
    { const { m, set } = await mk('nimbusFox', 160); const ft = _lxCalibFt('nimbusFox', 'attack'); const strike = strikeOf(ft); const now = performance.now();
      m._walkLatch = false; m._animSt = null; m._swingUntil = 0; m._atkStrikeMs = 240; m.atkAnimUntil = now + 380 + 50;
      o.A = Object.assign({ strike, ft: ft.join('/') }, sum(await sample(m, set, 700), strike)); }
    // B. an instant swing on the Archon
    { const { m, set } = await mk('archon', 160); const ft = _lxCalibFt('archon', 'attack'); const strike = strikeOf(ft); const now = performance.now();
      m._walkLatch = false; m._animSt = null; m._swingUntil = 0; m._atkStrikeMs = undefined; m.atkAnimUntil = now + 760 + 50;
      o.B = Object.assign({ strike, ft: ft.join('/') }, sum(await sample(m, set, 900), strike));
      // D. out of the attack: idle on its first frame, with a seed that would put it elsewhere
      m.atkAnimUntil = 0; m._swingUntil = 0; m._animSt = 'attack'; m._animSeed = 500; m._walkLatch = false; m.vx = 0; m._animXV = 0; m._shootWindup = 0; m._postShotHold = 0; m._bigMeleeFiring = false; m._columnFiring = false;
      const f = _monsterStateFrame(m); o.D = { idle: set.idle.indexOf(f), walk: set.walk ? set.walk.indexOf(f) : -1, attack: set.attack.indexOf(f) }; }
    // C. a shot waits for a swing in progress
    { const { m } = await mk('archon', 200); m._columnCd = 1e9; m.traits = Object.assign({}, m.traits, { columnStrike: undefined }); m.aggro = true; m.aggroTarget = player;
      m.shootTimer = 0; m._shootWindup = 0; m._swingUntil = performance.now() + 600; game.time++; updateMonsters(1000 / 60);
      o.C = { during: +(m._shootWindup || 0) }; m.shootTimer = 0; m._shootWindup = 0; m._swingUntil = 0; game.time++; updateMonsters(1000 / 60); o.C.after = +(m._shootWindup || 0); }
    // E. the cherub blink: a player in reach the whole time, every roll a hit
    { const { m } = await mk('cherub', 40); const oR = Math.random; Math.random = () => 0.01;
      try { m.traits = {}; const run = (steps, midSwing) => { /* synchronous: nothing else can step the world between these steps */ let blinks = 0, flash = 0, px = m.x; const at = [];
          for (let i = 0; i < steps; i++) { player.x = m.x + m.w / 2 - player.w / 2 + 30; player.y = m.y + m.h - player.h; player.invulnerable = 1e9;
            if (midSwing) m._swingUntil = performance.now() + 5000; game.paused = true; game.time++; updateMonsters(1000 / 60);
            if (Math.abs(m.x - px) > 60) { blinks++; at.push(i); if (!(m._animXV === 0 && Math.abs(m.x - m._animPX) < 12)) flash++; /* the tracker restarts at the landing spot (the step's own chase may move it a little) */ } px = m.x; }
          return { blinks, flash, at }; };
        m._swingUntil = 0; m.atkAnimUntil = 0; o.E = run(180, false);
        m.x = 1000; m._blinkCd = 0; m._blinkInvuln = 0; m.invulnerable = 0;   // back in the open, every timer clear: only the swing may stop a blink now
        o.Emid = run(60, true);
      } finally { Math.random = oR; } }
    // F. the Archon's column strike
    { const { m, set } = await mk('archon', 220); m.shoot = null; m.vx = 1.5; m._walkLatch = true; m._swingUntil = 0; m.atkAnimUntil = 0; m._columnCd = 0; m.aggro = true; m.aggroTarget = player;
      game.time++; updateMonsters(1000 / 60); const tel = m.traits.columnStrike ? m.traits.columnStrike.telegraphMs : null;
      o.F = { firing: !!m._columnFiring, tel, sm: m._atkStrikeMs, win: Math.round((m.atkAnimUntil || 0) - performance.now()) };
      for (let i = 0; i < 6; i++) { game.time++; updateMonsters(1000 / 60); }
      o.F.vx = +(+m.vx || 0).toFixed(2); const fr = _monsterStateFrame(m); o.F.frame = set.attack.indexOf(fr) >= 0 ? 'attack' + set.attack.indexOf(fr) : (set.walk && set.walk.indexOf(fr) >= 0 ? 'walk' : 'idle'); }
    clearInterval(window.__slHold); game.hitStop = 0; game.paused = false;
    return o;
  });
  const A = R.A, B = R.B;
  check(A.first <= 1 && A.mono && A.strikeAt >= 232 && A.strikeAt <= 256 && A.last === 8, `A. the Astrofox's shot plays from its first frames into the strike (${A.strike}) at ~240 ms, frames only advance`, A);
  check(B.first < B.strike - 1 && B.mono && B.strikeAt >= 112 && B.strikeAt <= 136 && B.last === 8, `B. a contact swing on the Archon leads in through its windup and reaches the strike (${B.strike}) in about 120 ms`, B);
  check(R.C.during === 0 && R.C.after > 0, 'C. a monster mid-swing starts no shot windup; the shot starts once the swing is over', R.C);
  check(R.D.idle === 0, 'D. out of an attack, idle starts on its first frame (the rest pose the swing ended on)', R.D);
  check(R.E.blinks >= 1 && R.E.blinks <= 2 && (R.E.at.length < 2 || R.E.at[1] - R.E.at[0] >= 140) && R.E.flash === 0, 'E. a cherub with the player in reach for 3 s blinks at most twice, 2.4 s or more apart (140+ sim steps), and its stride tracker does not read the teleport as a step', R.E);
  check(R.Emid.blinks === 0, 'E. and never while it is swinging', R.Emid);
  check(R.F.firing && R.F.sm === R.F.tel && R.F.win > R.F.tel && R.F.vx === 0 && /^attack/.test(R.F.frame), 'F. the Archon\'s column strike plants it (vx 0) and plays its attack through the telegraph', R.F);
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close().catch(() => {}); server.kill(); }
console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
process.exit(bad ? 1 : 0);
