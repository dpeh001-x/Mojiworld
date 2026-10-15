// RELEASE 18c (per user: "keep Aetherion standing, stand and cast attacks more frequently"). A Lv 63 warrior (the boss bands' reference
// bar) stands 250 px off him, inside the Twin Verdict's reach, answers the Gate from a safe spot and never hits back. Two 60 s (sim)
// passes per form: his OWN MACHINE (no Twin Verdict, none of the director's random punish windows - those are the player's and swing
// a 60 s count by +-25%), then the FULL FIGHT (reported, and held to [3]-[5]).
//   [1] the idle gaps between his patterns are 600 / 510 / 360 ms (were 980 / 710 / 490; the evolved 520 until release20, 360 until v0.30.1770); recast cooldowns Sky-Break 420, Astral 650,
//       Feathers 180, Spiral 320, Halo 230 (60 Hz steps); the Gate (1500 / 1080) and Echo Step (360) unchanged
//   [2] his own machine starts >= 22% more patterns a minute in form 1 (old 34.5) and >= 8% more in the evolved form (old 35; ~+15% since v0.30.1770) - since
//       release20 the Twin Verdict claims its own slot, so the evolved gap no longer stops at 520 (release20c_test); the 6 s Gate is a tenth of it
//   [3] no windup is shorter than before (start -> release in sim steps; a hit-stop or a skipped tick may add a few), nothing broken off
//   [4] two telegraphs never open closer than 450 ms apart, and no earlier column has > 250 ms of telegraph left when a move releases
//   [5] he still stands: under 250 px a minute walked outside Echo Step (a walk at his 1.2 is ~4300), his speed row unchanged
//   [6] damage a minute on the hero (the mean of the own-machine and full-fight minutes) rises less than +40%
//   node scripts/release18c_test.mjs        PORT / MOJI_GAME_FILE / MOJI_SERVE_ROOT override; R18C_REPORT=1 prints the full record
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15172), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const SECS = Number(process.env.R18C_SECS || 60), SEED = Number(process.env.R18C_SEED || 0);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 700) + ']' : '')); };
// the old build (v0.30.1749, gaps 980 / 710 / 490), measured by this harness: patterns a minute and damage a minute per form
// the old build (v0.30.1748 + release17b, gaps 980 / 710 / 490), own machine, measured by this harness (seeds 0 and 7): patterns a minute, damage a minute
const OLD = { p1: 34.5, p2: 35, d1: 117000, d2: 90000 };   // damage: the mean of the own-machine and full-fight minutes
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, channel: EXE ? undefined : 'msedge', headless: true, args: ['--mute-audio', '--no-sandbox'] });
const errs = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${FILE}?lxhold=0`, { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _aetherionTick === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(4000);
  await page.evaluate(() => {
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootGateDone = true; } catch (e) {} window._prologueActive = false;
    applyClass('warrior'); player.level = 63; { const h0 = getMaxHp(), ref = _refHpAtLv(63); player.maxHp = Math.round(player.maxHp * ref / Math.max(1, h0)); }   // a fair Lv 63 bar (the boss bands' own reference) player._tutorialSeen = true; player._gravitosCineSeen = true;
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS || {})) player._storyBeatsSeen[k] = true;
    try { for (const k in LX_KILL_FILMS) { const f = LX_KILL_FILMS[k]; if (f && f.key) player._storyBeatsSeen[f.key] = true; } } catch (e) {}
    player.hp = getMaxHp(); loadMap('sanctum', 300);
  });
  await page.waitForTimeout(9000);
  const R = await page.evaluate(async ([SECS, SEED, PURE]) => {
    const sleep = (ms) => new Promise((z) => setTimeout(z, ms));
    const frames = async (n) => { const t0 = game.time; const d = Date.now() + 20000; while (game.time - t0 < n && Date.now() < d) await sleep(4); };
    const hide = () => { for (const id of ['story-beat-overlay', 'boss-intro', 'boss-intro-card']) { const e = document.getElementById(id); if (e) { e.classList.remove('on'); e.style.display = 'none'; } } try { _lxCineHold(0); } catch (e) {} game.paused = false; };
    hide();
    const m = game.monsters.find((x) => x && x.type === 'aetherion'); if (!m) return { err: 'no aetherion (map ' + game.currentMap + ')' };
    const DX = 250, gY = ((game.mapData.platforms || []).find((p) => p.type === 'ground') || { y: m.y + m.h }).y;
    const stand = () => {
      const g = game.hazards.find((h) => h && h.type === 'gravitos_singularity' && h.life > 0 && h.safeZones && h.safeZones.length);
      if (g) { const z = g.safeZones[0]; player.x = z.x + z.w / 2 - player.w / 2; player.y = z.y + z.h - player.h; }   // a fair hero answers the Gate
      else { const side = (player.x + player.w / 2) >= (m.x + m.w / 2) ? 1 : -1; player.x = m.x + m.w / 2 + side * DX - player.w / 2; player.y = gY - player.h; }
      player.vx = 0; player.vy = 0; player.onGround = true;
    };
    for (let i = 0; i < 900 && !m._ae; i++) { hide(); stand(); await frames(1); }
    if (!m._ae) return { err: 'his AI never ticked (no m._ae)' };
    // every hit the hero takes is counted and then refunded (he must live the whole minute; the Gate is answered from its safe spot)
    const hits = []; const _lost = window._lxLost;
    window._lxLost = function (v, shown) { if (v > 0) { hits.push({ t: game.time, v, src: null, stack: (new Error().stack || '').split(/\n/)[2] || '' }); return _lost.call(this, 0, shown); } return _lost.apply(this, arguments); };
    // a seeded chooser, so both builds roll the same dice
    const seed = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const _rnd = Math.random;
    // his tick's call times: a windup's sim length can only stretch if the tick stops being called (its dt is capped at 250 ms)
    const calls = { last: null, gaps: [] }; const _tick = window._aetherionTick;
    window._aetherionTick = function (mm, dt) { if (mm === m) { const t = game.time, st0 = m._ae && m._ae.st; if (calls.last != null && t - calls.last > 15 && st0 && st0 !== 'idle') calls.gaps.push({ st: st0, gap: t - calls.last, at: t, hp: player.hp, cine: !!window._prologueActive, inv: m.invulnerable | 0, stun: m._stunT | 0, frz: m.frozen | 0, slow: m._lxSlowT | 0 }); calls.last = t; } return _tick.apply(this, arguments); };
    // pure: his own machine alone - no Twin Verdict swing and none of the director's random punish windows (2 s free openings,
    // 2.6 s winded after 35% of swings), which are the player's and swing a 60 s count by +-25%; the cadence is read here
    const quiet = () => { m._bigMeleeCd = Math.max(m._bigMeleeCd || 0, 1e6); m._dirRollT = 1e9; m._windedCd = 1e9; m._dirOpenT = 0; };
    const run = async (evolved, hpFrac, sd, pure) => {
      m._aetherionEvolved = evolved; if (evolved) m._phaseSprite = 'aetherion2'; m.currentHp = m.maxHp * hpFrac;
      game.projectiles.length = 0; game.hazards.length = 0;
      const A = m._ae; A.st = 'idle'; A.t = 0; A.cd = {}; A.opened = 1;   /* the evolved form opens as it does in a fight: Sky-Break, the first Gate ~10 s in */ A.gateUntil = 0; m._bigMeleeCd = 1500; m._dirOpenT = 0; m._stagger = 0;
      if (!pure) { m._dirRollT = 6000 + (sd % 7) * 1000; m._windedCd = 0; }
      for (let i = 0; i < 30; i++) { if (pure) quiet(); stand(); player.hp = getMaxHp(); A.lastHp = player.hp; A.healAt = -1e9; await frames(1); }
      const born = new WeakMap(), ovl = []; let overlap = 0, tail = 0;   // a column still telegraphing from an earlier move when the next move releases
      Math.random = seed(sd); hits.length = 0;
      const seenL = new WeakSet(A.log), seenF = new WeakSet(A.fires || []);
      const starts = [], fires = []; const tb = {}; let inv = 0, god = 0, idle = 0, steps = 0, walk = 0, tv = 0, prevTv = !!m._bigMeleeFiring, px = m.x, broke = 0, prevSt = A.st;
      const t0 = game.time;
      while (game.time - t0 < SECS * 60) {
        if (pure) quiet(); stand(); player.hp = getMaxHp(); A.lastHp = player.hp; m.currentHp = m.maxHp * hpFrac;   // the refund is not a heal he should answer
        for (const h of game.hazards) if (h && h.type === 'meteor_warn' && /^Aetherion/.test(h._sourceLabel || '') && !born.has(h)) born.set(h, game.time);
        const g0 = game.time, hp0 = player.hp, hi0 = player._hitIframeAt; await frames(1);
        if (player.hp < hp0 && player._hitIframeAt !== hi0) hits.push({ t: game.time, v: hp0 - player.hp, src: null, stack: 'shot' });   // projectile hits subtract without _lxLost
        for (const h of hits) if (h.src === null) h.src = String(player._lastDamageSource || '?') + ' @' + h.stack.replace(/^.*?at /, '').replace(/\(.*:(\d+):\d+\)/, ':$1').slice(0, 60); const dn = Math.max(1, game.time - g0); steps += dn;
        for (const e of A.log) if (!seenL.has(e)) { seenL.add(e); starts.push({ s: e.s, at: e.at }); }
        for (const e of (A.fires || [])) if (!seenF.has(e)) { seenF.add(e); fires.push({ s: e.s, at: e.at });
          const ov = game.hazards.filter((h) => h && h.life > 0 && born.has(h) && born.get(h) < e.at - 1);
          if (ov.length) tail++;   // an earlier column in its last frames (it lands first; the new move has its whole telegraph to read)
          if (ov.some((h) => h.life > 15)) { overlap++;   /* an earlier column with more than 250 ms still to show: two telegraphs to read at once */ ovl.push({ s: e.s, at: e.at, by: ov.map((h) => (h._sourceLabel || '').replace("Aetherion's ", '') + ' age ' + (e.at - born.get(h)) + ' life ' + h.life + '/' + h.maxLife) }); } }
        if (A.st === 'idle' && !m._bigMeleeFiring) idle += dn; { const k = A.st !== 'idle' ? 'st:' + A.st : m._bigMeleeFiring ? 'tv' : (m._dirOpenT > 0 || m._stagger > 0) ? 'open' : (A.gateUntil > game.time) ? 'gatehold' : (A.t >= _AE_GAP_MS[m._aetherionEvolved ? 2 : 1]) ? 'blocked' : 'gap'; tb[k] = (tb[k] || 0) + dn; } if (player.invulnerable > 0) inv += dn; if (player._god) god += dn;
        if (!!m._bigMeleeFiring && !prevTv) { tv++; starts.push({ s: 'twinVerdict', at: game.time }); } prevTv = !!m._bigMeleeFiring;
        if (prevSt !== 'idle' && A.st === 'idle' && A.fired0 === A.fired && prevSt !== 'astral') broke++;
        const dx = Math.abs(m.x - px); if (!(prevSt === 'echoWind' || A.st === 'echoWind') && dx < 40) walk += dx; px = m.x; prevSt = A.st;
      }
      Math.random = _rnd;
      const mins = steps / 3600, moves = starts.filter((x) => x.s !== 'twinVerdict');
      const all = starts.slice().sort((a, b) => a.at - b.at); let minGap = 1e9;
      for (let i = 1; i < all.length; i++) minGap = Math.min(minGap, (all[i].at - all[i - 1].at) * 1000 / 60);
      const wind = {};   // start -> release per move, in sim steps
      for (let i = 0; i < moves.length; i++) { const s = moves[i], nx = moves[i + 1] ? moves[i + 1].at : 1e12; const f = fires.find((x) => x.s === s.s && x.at >= s.at && x.at <= nx); if (!f) continue; (wind[s.s] = wind[s.s] || []).push(f.at - s.at); }
      const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };
      const dmg = hits.reduce((a, h) => a + h.v, 0), bySrc = {}; for (const h of hits) { const b = bySrc[h.src] = bySrc[h.src] || [0, 0]; b[0] += h.v; b[1]++; }
      return { mins: +mins.toFixed(2), apm: +(moves.length / mins).toFixed(1), cpfm: +(moves.length / Math.max(0.01, (steps - (tb.open || 0) - (tb.tv || 0)) / 3600)).toFixed(1), allpm: +(all.length / mins).toFixed(1), tvpm: +(tv / mins).toFixed(1), firedpm: +(fires.length / mins).toFixed(1),
        minGapMs: Math.round(minGap), overlap, tail, callGaps: calls.gaps.splice(0).slice(0, 8), ovl: ovl.slice(0, 6), idleShare: +(idle / steps).toFixed(3), walkPerMin: Math.round(walk / mins), broke, tb: Object.fromEntries(Object.entries(tb).map(([k, v]) => [k, +(v / steps).toFixed(3)])), inv: +(inv / steps).toFixed(2), god: +(god / steps).toFixed(2), pinv: player.invulnerable,
        dpm: Math.round(dmg / mins), dpmPct: +((dmg / mins) / getMaxHp() * 100).toFixed(1), maxHp: getMaxHp(),
        wind: Object.fromEntries(Object.entries(wind).map(([k, v]) => [k, med(v)])), mix: moves.reduce((o, x) => (o[x.s] = (o[x.s] || 0) + 1, o), {}),
        bySrc: Object.fromEntries(Object.entries(bySrc).map(([k, v]) => [k, [Math.round(v[0] / mins), +(v[1] / mins).toFixed(1)]])) };
    };
    const out = { gap: _AE_GAP_MS.slice(), typeSpeed: monsterTypes.aetherion.speed };
    try { out.src = String(_tick).match(/A\.cd\.(skybreak|astral|feather|spiral|halo|gate|echo) = now \+ [^;]*/g); } catch (e) {}
    out.p1 = await run(false, 0.9, 1801 + SEED, true);
    out.p2 = await run(true, 0.4, 1802 + SEED, true);
    if (!PURE) { out.f1 = await run(false, 0.9, 1801 + SEED, false); out.f2 = await run(true, 0.4, 1802 + SEED, false); }
    window._lxLost = _lost; window._aetherionTick = _tick;
    return out;
  }, [SECS, SEED, !!process.env.R18C_PURE_ONLY]);
  if (R.err) ok('Aetherion spawned in his Sanctum', false, R.err);
  else {
    if (process.env.R18C_REPORT) console.log(JSON.stringify(R, null, 1));
    const tag = (k) => (k === 'p1' || k === 'f1') ? 'form 1' : 'evolved';
    for (const k of ['p1', 'p2', 'f1', 'f2']) { const r = R[k]; if (!r) continue;
      console.log(`  ${k === 'p1' || k === 'p2' ? 'own machine' : 'full fight '} ${tag(k)}: patterns/min ${r.apm} (+ swings ${r.tvpm}), shortest start-to-start ${r.minGapMs} ms, idle ${Math.round(r.idleShare * 100)}%, damage/min ${r.dpm} (${r.dpmPct}% of a ${r.maxHp} bar), walked ${r.walkPerMin} px/min`); }
    ok('[1] idle gaps between patterns are 600 / 510 / 360 ms (were 980 / 710 / 490; the evolved 520 until release20, 360 until v0.30.1770)', R.gap.join() === '0,600,510,360', R.gap);
    const cds = (R.src || []).join(' | ');
    ok('[1] recast cooldowns: Sky-Break 420, Astral 650, Feathers 180, Spiral 320, Halo 230; the Gate (1500 / 1080) and Echo Step (360) kept',
      ['skybreak = now + 420', 'astral = now + 650', 'feather = now + 180', 'spiral = now + 320', 'halo = now + 230', 'gate = now + (phase === 3 ? 1080 : 1500', 'echo = now + 360'].every((x) => cds.includes(x)), cds);
    for (const [k, old, gain] of [['p1', OLD.p1, 1.22], ['p2', OLD.p2, 1.08]]) {   // release20: the evolved bar 1.08 -> 1.22; v0.30.1770 (per user, ~+15% not ~+30%): back to 1.08
      ok(`[2] ${tag(k)}: at least ${Math.round(gain * 100 - 100)}% more patterns a minute than the old cadence (${old} a minute)`, R[k].apm >= old * gain, { now: R[k].apm, old, ratio: +(R[k].apm / old).toFixed(2) });
    }
    const WIND = { lanceWind: [39, 40], fractureWind: [30, 31], shardfallWind: [27, 28], echoWind: [29, 30], skybreakWind: [72, 73], featherWind: [27, 28], spiralWind: [32, 33], haloWind: [36, 37], gateWind: [39, 40] };
    const wbad = []; for (const k of ['p1', 'p2', 'f1', 'f2']) for (const [s, n] of Object.entries((R[k] || {}).wind || {})) if (WIND[s] && (n < WIND[s][0] || n > WIND[s][1] + 8)) wbad.push(k + ':' + s + '=' + n);
    ok('[3] no windup is shorter than before (start -> release in sim steps, at most 8 longer: lance 39, fracture 30, shardfall 27, echo 29, sky-break 72, feathers 27, spiral 32, halo 36, gate 39)', wbad.length === 0 && R.p1.broke === 0 && R.p2.broke === 0, { wbad, broke: [R.p1.broke, R.p2.broke] });
    ok('[4] two telegraphs never open closer than 450 ms, and no earlier column has more than 250 ms of telegraph left when a move releases', ['p1', 'p2', 'f1', 'f2'].every((k) => !R[k] || (R[k].minGapMs >= 450 && R[k].overlap === 0)), ['p1', 'p2', 'f1', 'f2'].map((k) => R[k] && [R[k].minGapMs, R[k].overlap]));
    ok('[5] he still stands: under 250 px a minute walked outside Echo Step, base speed unchanged (1.2)', ['p1', 'p2', 'f1', 'f2'].every((k) => !R[k] || R[k].walkPerMin < 250) && R.typeSpeed === 1.2, ['p1', 'p2', 'f1', 'f2'].map((k) => R[k] && R[k].walkPerMin));
    const dm = (p, q) => q ? (p.dpm + q.dpm) / 2 : p.dpm, d1 = dm(R.p1, R.f1), d2 = dm(R.p2, R.f2);
    ok('[6] damage a minute on the hero (mean of the two minutes per form) rises less than +40%', d1 <= OLD.d1 * 1.4 && d2 <= OLD.d2 * 1.4, { d1, old1: OLD.d1, r1: +(d1 / OLD.d1).toFixed(2), d2, old2: OLD.d2, r2: +(d2 / OLD.d2).toFixed(2) });
  }
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { fail++; console.log('FAIL harness: ' + String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
