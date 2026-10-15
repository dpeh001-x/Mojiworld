// RELEASE 20c (per user, option "a": the evolved Aetherion also casts ~+30% more often than before v0.30.1751, the Twin Verdict swing
// kept at its share). v0.30.1751 gave form 1 +34% but the evolved form only +17%: his 500 ms Twin Verdict hold (start(), a landed-fix
// marker, and the in-move hold - both kept) meant the swing only opened when the idle gap outlasted it, so the evolved gap stopped at 520.
// Now the evolved gap is 360 and a due swing claims its slot (the move waits for it, at most to 640 ms of idle).
// Same harness as release18c: a Lv 63 warrior 250 px off him (inside the Twin Verdict's reach) answers the Gate from a safe spot and
// never hits back; 60 s (sim) of his evolved form at 40% HP, first his OWN MACHINE (no swing, no punish windows), then the FULL FIGHT.
//   v0.30.1770 (per user: "instead of the 30% more often change it to 15%"): the evolved gap is 510 - ~+15-20% (41-42 a minute here); every rule below stays.
//   [1] the evolved gap is 510 ms (360 until v0.30.1770; form 1 600, under 25% 360 unchanged); the swing-slot, column-wait and follow-through rules are in his tick; start()'s hold kept
//   [2] his own machine starts ~15% more patterns a minute than before v0.30.1751 (35 a minute at the 710 gap): 8-24% (the 360 gap measured 44-46, ~+30%)
//   [3] the Twin Verdict is still there in the full fight: >= 6 swings a minute (7-10 at v0.30.1753) and no more than 14
//   [4] no windup is shorter than before (start -> release in sim steps), nothing broken off in his own machine
//   [5] two telegraphs never open closer than 450 ms, no earlier column has > 250 ms of telegraph left when a move releases, and a
//       swing never opens sooner than 480 ms after a move's release (500 ms hold, as before)
//   [6] he still stands: under 250 px a minute walked outside Echo Step, base speed 1.2
//   [7] damage a minute on the hero (mean of the two minutes) vs the pre-v0.30.1751 build (90,000): FLAGGED above +40%, failed above +50% - the
//       full-fight minute alone swings it +-15% run to run (v0.30.1753 itself measured x0.98-x1.37)
//   node scripts/release20c_test.mjs     PORT / MOJI_GAME_FILE / MOJI_SERVE_ROOT override; R20C_SEED picks the dice; R20C_REPORT=1 prints the record
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15174), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const SECS = Number(process.env.R20C_SECS || 60), SEED = Number(process.env.R20C_SEED || 0);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 700) + ']' : '')); };
const OLD = { p2: 35, d2: 90000 };   // the pre-v0.30.1751 build (gap 710), this harness: evolved patterns a minute (own machine), damage a minute (mean)
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
    applyClass('warrior'); player.level = 63; { const h0 = getMaxHp(), ref = _refHpAtLv(63); player.maxHp = Math.round(player.maxHp * ref / Math.max(1, h0)); }   // a fair Lv 63 bar
    player._tutorialSeen = true; player._gravitosCineSeen = true;
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS || {})) player._storyBeatsSeen[k] = true;
    try { for (const k in LX_KILL_FILMS) { const f = LX_KILL_FILMS[k]; if (f && f.key) player._storyBeatsSeen[f.key] = true; } } catch (e) {}
    player.hp = getMaxHp(); loadMap('sanctum', 300);
  });
  await page.waitForTimeout(9000);
  const R = await page.evaluate(async ([SECS, SEED]) => {
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
    const hits = []; const _lost = window._lxLost;   // every hit is counted, then refunded (he must live the whole minute)
    window._lxLost = function (v, shown) { if (v > 0) { hits.push({ t: game.time, v }); return _lost.call(this, 0, shown); } return _lost.apply(this, arguments); };
    const seed = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const _rnd = Math.random;
    const quiet = () => { m._bigMeleeCd = Math.max(m._bigMeleeCd || 0, 1e6); m._dirRollT = 1e9; m._windedCd = 1e9; m._dirOpenT = 0; };
    const run = async (hpFrac, sd, pure) => {
      m._aetherionEvolved = true; m._phaseSprite = 'aetherion2'; m.currentHp = m.maxHp * hpFrac;
      game.projectiles.length = 0; game.hazards.length = 0;
      const A = m._ae; A.st = 'idle'; A.t = 0; A.cd = {}; A.opened = 1; A.gateUntil = 0; m._bigMeleeCd = 1500; m._dirOpenT = 0; m._stagger = 0;
      if (!pure) { m._dirRollT = 6000 + (sd % 7) * 1000; m._windedCd = 0; }
      for (let i = 0; i < 30; i++) { if (pure) quiet(); stand(); player.hp = getMaxHp(); A.lastHp = player.hp; A.healAt = -1e9; await frames(1); }
      const born = new WeakMap(); let overlap = 0;
      Math.random = seed(sd); hits.length = 0;
      const seenL = new WeakSet(A.log), seenF = new WeakSet(A.fires || []);
      const starts = [], fires = [], tvAfter = [], tvCols = []; let steps = 0, walk = 0, tv = 0, prevTv = !!m._bigMeleeFiring, px = m.x, broke = 0, prevSt = A.st;
      const t0 = game.time;
      while (game.time - t0 < SECS * 60) {
        if (pure) quiet(); stand(); player.hp = getMaxHp(); A.lastHp = player.hp; m.currentHp = m.maxHp * hpFrac;
        for (const h of game.hazards) if (h && h.type === 'meteor_warn' && /^Aetherion/.test(h._sourceLabel || '') && !born.has(h)) born.set(h, game.time);
        const g0 = game.time, hp0 = player.hp, hi0 = player._hitIframeAt; await frames(1);
        if (player.hp < hp0 && player._hitIframeAt !== hi0) hits.push({ t: game.time, v: hp0 - player.hp });   // projectile hits subtract without _lxLost
        steps += Math.max(1, game.time - g0);
        for (const e of A.log) if (!seenL.has(e)) { seenL.add(e); starts.push({ s: e.s, at: e.at }); }
        for (const e of (A.fires || [])) if (!seenF.has(e)) { seenF.add(e); fires.push({ s: e.s, at: e.at });
          if (game.hazards.some((h) => h && h.life > 15 && born.has(h) && born.get(h) < e.at - 1)) overlap++; }
        if (!!m._bigMeleeFiring && !prevTv) { tv++; starts.push({ s: 'twinVerdict', at: game.time });
          const lf = fires.length ? fires[fires.length - 1].at : -1e9; tvAfter.push(Math.round((game.time - lf) * 1000 / 60));
          tvCols.push(game.hazards.filter((h) => h && h.life > 15 && born.has(h)).length); }
        prevTv = !!m._bigMeleeFiring;
        if (prevSt !== 'idle' && A.st === 'idle' && A.fired0 === A.fired && prevSt !== 'astral') broke++;
        const dx = Math.abs(m.x - px); if (!(prevSt === 'echoWind' || A.st === 'echoWind') && dx < 40) walk += dx; px = m.x; prevSt = A.st;
      }
      Math.random = _rnd;
      const mins = steps / 3600, moves = starts.filter((x) => x.s !== 'twinVerdict');
      const all = starts.slice().sort((a, b) => a.at - b.at); let minGap = 1e9;
      for (let i = 1; i < all.length; i++) minGap = Math.min(minGap, (all[i].at - all[i - 1].at) * 1000 / 60);
      const wind = {};
      for (let i = 0; i < moves.length; i++) { const s = moves[i], nx = moves[i + 1] ? moves[i + 1].at : 1e12; const f = fires.find((x) => x.s === s.s && x.at >= s.at && x.at <= nx); if (!f) continue; (wind[s.s] = wind[s.s] || []).push(f.at - s.at); }
      const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };
      const dmg = hits.reduce((a, h) => a + h.v, 0);
      return { apm: +(moves.length / mins).toFixed(1), tvpm: +(tv / mins).toFixed(1), tvShare: +(tv / Math.max(1, all.length)).toFixed(3), minGapMs: Math.round(minGap), overlap,
        tvAfterMin: tvAfter.length ? Math.min(...tvAfter) : null, tvAfterMed: tvAfter.length ? med(tvAfter) : null, tvWithCols: tvCols.filter((n) => n > 0).length,
        walkPerMin: Math.round(walk / mins), broke, dpm: Math.round(dmg / mins), maxHp: getMaxHp(),
        wind: Object.fromEntries(Object.entries(wind).map(([k, v]) => [k, med(v)])), mix: moves.reduce((o, x) => (o[x.s] = (o[x.s] || 0) + 1, o), {}) };
    };
    const out = { gap: _AE_GAP_MS.slice(), typeSpeed: monsterTypes.aetherion.speed, src: String(window._aetherionTick) };
    out.slot = out.src.includes('m._bigMeleeCd <= 520 - A.t && A.t < 640') && out.src.includes("h.type === 'meteor_warn' && h.life > 30 && /^Aetherion/") && out.src.includes('A.t < (_AE_MOVE_TAIL_BY[_AE_MOVE_SET[A.recent[A.recent.length - 1]]] || 0)'); out.hold = out.src.includes('const start = (s, why) => { A.st = s; A.t = 0; m._bigMeleeCd = Math.max(m._bigMeleeCd || 0, 500);'); delete out.src;
    out.p2 = await run(0.4, 1802 + SEED, true);
    out.f2 = await run(0.4, 1802 + SEED, false);
    window._lxLost = _lost;
    return out;
  }, [SECS, SEED]);
  if (R.err) ok('Aetherion spawned in his Sanctum', false, R.err);
  else {
    if (process.env.R20C_REPORT) console.log(JSON.stringify(R, null, 1));
    for (const k of ['p2', 'f2']) { const r = R[k];
      console.log(`  ${k === 'p2' ? 'own machine' : 'full fight '} evolved: patterns/min ${r.apm} (+ swings ${r.tvpm}, share ${r.tvShare}), shortest start-to-start ${r.minGapMs} ms, release->swing min ${r.tvAfterMin} ms, damage/min ${r.dpm} (a ${r.maxHp} bar), walked ${r.walkPerMin} px/min`); }
    ok('[1] the evolved gap is 510 ms (form 1 600, under 25% 360), the swing-slot rule is in his tick, start() still holds the swing 500 ms', R.gap.join() === '0,600,510,360' && R.slot && R.hold, { gap: R.gap, slot: R.slot, hold: R.hold });
    ok(`[2] evolved, own machine: ~15% more patterns a minute than before v0.30.1751 (${OLD.p2} a minute): 8-24%, not the ~30% of the 360 gap`, R.p2.apm >= OLD.p2 * 1.08 && R.p2.apm < OLD.p2 * 1.24, { now: R.p2.apm, old: OLD.p2, ratio: +(R.p2.apm / OLD.p2).toFixed(2) });
    ok('[3] the Twin Verdict still swings in the full fight: 6-14 a minute (7-10 at v0.30.1753)', R.f2.tvpm >= 6 && R.f2.tvpm <= 14, { tvpm: R.f2.tvpm, share: R.f2.tvShare });
    const WIND = { lanceWind: [39, 40], fractureWind: [30, 31], shardfallWind: [27, 28], echoWind: [29, 30], skybreakWind: [72, 73], featherWind: [27, 28], haloWind: [36, 37], gateWind: [39, 40] };
    const wbad = []; for (const k of ['p2', 'f2']) for (const [s, n] of Object.entries(R[k].wind || {})) if (WIND[s] && (n < WIND[s][0] || n > WIND[s][1] + 8)) wbad.push(k + ':' + s + '=' + n);
    ok('[4] no windup is shorter than before (lance 39, fracture 30, shardfall 27, echo 29, sky-break 72, feathers 27, halo 36, gate 39 steps; at most 8 longer)', wbad.length === 0 && R.p2.broke === 0, { wbad, broke: R.p2.broke });
    ok('[5] telegraphs never stack: starts >= 450 ms apart, no live column (> 250 ms left) when a move releases, a swing opens >= 480 ms after a release',
      R.p2.minGapMs >= 450 && R.f2.minGapMs >= 450 && R.p2.overlap === 0 && R.f2.overlap === 0 && (R.f2.tvAfterMin == null || R.f2.tvAfterMin >= 480), [R.p2.minGapMs, R.f2.minGapMs, R.p2.overlap, R.f2.overlap, R.f2.tvAfterMin]);
    ok('[6] he still stands: under 250 px a minute walked outside Echo Step, base speed 1.2', R.p2.walkPerMin < 250 && R.f2.walkPerMin < 250 && R.typeSpeed === 1.2, [R.p2.walkPerMin, R.f2.walkPerMin, R.typeSpeed]);
    const d2 = (R.p2.dpm + R.f2.dpm) / 2;
    if (d2 > OLD.d2 * 1.4) console.log('FLAG [7] damage a minute is above +40% of the pre-v0.30.1751 build this run: x' + (d2 / OLD.d2).toFixed(2));
    ok('[7] damage a minute on the hero (mean of the two minutes) stays under +50% of the pre-v0.30.1751 build (flag at +40%)', d2 <= OLD.d2 * 1.5, { d2, old: OLD.d2, ratio: +(d2 / OLD.d2).toFixed(2) });
  }
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { fail++; console.log('FAIL harness: ' + String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
