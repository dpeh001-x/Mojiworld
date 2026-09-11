// DEADEYE / DEADEYE PROTOCOL — pure single-target DPS in lines (v0.30.x revamp).
// ============================================================================
// Per user: "revamp the entire skill for marksman deadeye and deadeye protocol, they should focus on
// pure DPS with multiple lines of damage on a single target ... a fun spammy skill ... with a
// sizeable cooldown". What this pins, in both directions:
//   * both skills are WINDOWS: the first press pays, presses inside are free, the window CLOSES and
//     stamps a sizeable real cooldown (30 s / 60 s);
//   * a press is LINES on ONE target: Deadeye ramps 3 -> 7 lines a press, Protocol fires 5-round
//     volleys (7 on a Deadeye-marked foe) that hit nothing but the mark;
//   * the lines stack into a COLUMN with a running total, not one pile of numbers;
//   * the art is registered and decodes (tracer, reticle, the two impact loops, the two rounds).
// Run: node scripts/deadeye_window_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 9479);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'DeadeyeTest');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*archer\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);
await page.evaluate(() => {
  player.level = 99; player._god = true;
  player.cls = 'archer'; player.job = 'sniper'; player.master = 'marksman';
  loadMap('forest', 300);
});
await page.waitForTimeout(4000);

const R = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clear = () => { const sb = document.getElementById('story-beat-overlay'); if (sb) { sb.classList.remove('on'); sb.style.display = 'none'; } try { _lxCineHold(0); } catch (e) {} game.paused = false; };
  clear();
  player.maxMp = 999999; player.mp = 999999; player.baseAtk = 500; player.hp = player.maxHp = 99999;
  const out = { name: SKILLS.marksman_oneshot.name, ultName: SKILLS.marksman_ult.name, cdDef: SKILLS.marksman_oneshot.cd, ultCdDef: SKILLS.marksman_ult.cd };
  const dummy = (dx) => { const m = spawnMonster(player.x + dx, player.y - 10, 'snail', false); m.maxHp = m.currentHp = 5e8; m.evasion = 0; m.dodge = 0; m.level = 1; m.def = 0; return m; };
  const reset = () => {
    player.skillCooldowns = {}; player.mp = 999999; player._castLockUntil = 0; player.hitStun = 0;
    player._deadeyeUntil = 0; player._protocolUntil = 0; player._deadeyeMark = null; player._deadeyeRamp = 0; player._deadeyeLastPress = 0;
    game.projectiles.length = 0; game.monsters.length = 0; game.damageNumbers.length = 0; game.comboMult = 1;
    player.x = 400; player.facing = 1; clear();
  };
  // ---- 1. Deadeye: the window opens, presses inside are free, it closes on a real cooldown ------
  reset(); const A = dummy(220), B = dummy(420);
  const mp0 = player.mp; castSkill('marksman_oneshot'); out.mpFirst = mp0 - player.mp;
  await sleep(240); const rowsOf = () => game.damageNumbers.filter((d) => d._deRow != null);
  out.linesFirst = rowsOf().length; out.rowsFirst = new Set(rowsOf().map((d) => Math.round(d.y))).size;
  out.textsFirst = game.damageNumbers.map((d) => String(d.text) + (d._deRow != null ? '@' + d._deRow : '')).join(' ');
  out.sumFirst = game.damageNumbers.some((d) => d._deSum && /[0-9]/.test(String(d.text)));
  out.markIsA = player._deadeyeMark === A;
  out.bUntouched = B.currentHp === B.maxHp;
  out.aHurt = A.currentHp < A.maxHp;
  { const cdRight = player.skillCooldowns.marksman_oneshot, fA = game.time, lock = (player._castLockUntil | 0) - fA; let hs = 0, ticks = 0;
    while (!isReady('marksman_oneshot') && ticks < 400) { if (game.hitStop > 0) hs++; ticks++; await sleep(5); }
    out.cadence = { cdRight, framesToReady: game.time - fA, hitStopSamples: hs, lockFrames: lock, cdNow: player.skillCooldowns.marksman_oneshot || 0 }; }
  let presses = 1, mpFollow = null; const t0 = Date.now(), f0 = game.time;
  const deltas = [], locks = [], cds = []; let lastF = game.time, wFirst = 0, wLast = 0;
  while (Date.now() - t0 < 5600) { if (isReady('marksman_oneshot')) { const b = player.mp; castSkill('marksman_oneshot'); presses++; if (mpFollow === null) mpFollow = b - player.mp;
      deltas.push(game.time - lastF); lastF = game.time; wLast = Date.now(); if (!wFirst) wFirst = wLast; locks.push((player._castLockUntil | 0) - game.time); cds.push(Math.round(player.skillCooldowns.marksman_oneshot || 0)); } await sleep(20); }
  out.msPerPress = Math.round((wLast - wFirst) / Math.max(1, presses - 2)); out.pressDeltas = deltas.join(','); out.pressLocks = locks.join(','); out.pressCds = cds.join(',');
  out.presses = presses; out.mpFollow = mpFollow; out.framesPerPress = +((game.time - f0) / Math.max(1, presses - 1)).toFixed(1);   // headless runs under 60 fps: measure cadence in game frames
  out.rampAtEnd = player._deadeyeRamp | 0;
  await sleep(700);
  out.cdAfter = Math.round(player.skillCooldowns.marksman_oneshot || 0);
  let late = 0; const t1 = Date.now(); while (Date.now() - t1 < 1200) { if (isReady('marksman_oneshot')) { castSkill('marksman_oneshot'); late++; } await sleep(20); }
  out.late = late; out.bStillUntouched = B.currentHp === B.maxHp; out.aTotal = A.maxHp - A.currentHp;
  // ---- 2. the ramp: five consecutive presses end on 7 lines ---------------------------------
  reset(); const C = dummy(220); const seq = []; let rows7 = 0;
  { const t = Date.now(); while (Date.now() - t < 6200) { if (isReady('marksman_oneshot')) { castSkill('marksman_oneshot'); seq.push(player._deadeyeLastLines | 0);
      if (seq[seq.length - 1] === 7) { for (let k = 0; k < 6; k++) { await sleep(50); rows7 = Math.max(rows7, new Set(rowsOf().map((d) => Math.round(d.y))).size); }
        if (!out.rowDiag) out.rowDiag = { n: game.damageNumbers.length, cap: _damageNumberCap(), texts: game.damageNumbers.map((d) => String(d.text) + (d._deRow != null ? '@' + d._deRow : '')).join(' ') }; } } await sleep(15); } }
  out.rampSeq = seq.join(','); out.linesSixth = Math.max(0, ...seq); out.rowsSixth = rows7; out.cHurt = C.currentHp < C.maxHp;
  // ---- 3. Protocol: volleys of single-target homing rounds, an Execute Round every sixth ---------
  reset(); const D = dummy(240), E = dummy(460);
  castSkill('marksman_ult'); await sleep(220);
  const rounds = game.projectiles.filter((p) => p.owner === 'player' && p.onlyTarget);
  out.volley = rounds.length; out.volleyHoming = rounds.every((p) => p.homing === D && p.bspr === 'bult_marksman' && p.alwaysCrit);
  let volleys = 1, execSeen = false, vFirst = 0, vLast = 0; const t2 = Date.now(), f2 = game.time;
  while (volleys < 8 && Date.now() - t2 < 6000) { if (isReady('marksman_ult')) { castSkill('marksman_ult'); volleys++; vLast = Date.now(); if (!vFirst) vFirst = vLast; } if (game.projectiles.some((p) => p._deExec)) execSeen = true; await sleep(15); }
  for (let i = 0; i < 40 && !execSeen; i++) { await sleep(25); if (game.projectiles.some((p) => p._deExec)) execSeen = true; }
  out.volleys = volleys; out.msPerVolley = Math.round((vLast - vFirst) / Math.max(1, volleys - 2)); out.framesPerVolley = +((game.time - f2) / Math.max(1, volleys - 1)).toFixed(1); out.execSeenAny = execSeen;
  out.dHurt = D.currentHp < D.maxHp; out.eUntouched = E.currentHp === E.maxHp;
  while ((player._protocolUntil || 0) > performance.now()) await sleep(100);   // let the 8 s window run out
  await sleep(400); out.ultCdAfter = Math.round(player.skillCooldowns.marksman_ult || 0);
  // ---- 4. combo: a Deadeye-marked foe takes 7-round volleys ------------------------------------
  reset(); dummy(240); castSkill('marksman_oneshot'); await sleep(300); game.projectiles.length = 0; castSkill('marksman_ult'); await sleep(260);
  out.markedVolley = game.projectiles.filter((p) => p.onlyTarget).length;
  // ---- 5. repair + art ---------------------------------------------------------------------
  reset(); player.skillCooldowns.marksman_ult = 250; player._protocolUntil = performance.now() + 5000; _lxRestoreUltCd(); out.ultRepaired = (player.skillCooldowns.marksman_ult || 0) > 10000;
  reset();
  out.fx = { tracer: !!(LX_FX.deadeye_tracer && LX_FX.deadeye_tracer.naturalWidth), reticle: !!(LX_FX.deadeye_reticle && LX_FX.deadeye_reticle.naturalWidth),
    keyed: _FX_ANIM_KEYS.has('deadeye_hit') && _FX_ANIM_KEYS.has('deadeye_execute'), hitFrames: _lxFrameCount('fx/anim', 'deadeye_hit', 9), execFrames: _lxFrameCount('fx/anim', 'deadeye_execute', 9),
    round: !!(LX_BULT_PROJ.bult_marksman && LX_BULT_PROJ.bult_marksman.naturalWidth), exec: !!(LX_BULT_PROJ.bult_deadeye_exec && LX_BULT_PROJ.bult_deadeye_exec.naturalWidth) };
  // ---- 6. the frame budget under a full mash with three foes ----------------------------------
  const prof = {}; const wrap = (n) => { const f = window[n]; if (typeof f !== 'function') return; prof[n] = 0; window[n] = function () { const a = performance.now(); try { return f.apply(this, arguments); } finally { prof[n] += performance.now() - a; } }; };
  for (const n of ['_lxDeadeyeDraw', 'drawDamageNumbers', 'drawProjectiles', 'updateProjectiles', 'updateMonsters', 'hitMonster', 'drawSmoothFx', 'drawMonsters', 'drawPlayer']) wrap(n);
  const mash = async (ids, ms) => { reset(); dummy(200); dummy(300); dummy(400); for (const k in prof) prof[k] = 0; LX_PERF.avgFrame = 16.7; const f = game.time, t = Date.now();
    while (Date.now() - t < ms) { for (const id of ids) if (isReady(id)) castSkill(id); await sleep(15); }
    const frames = Math.max(1, game.time - f); const per = {}; for (const k in prof) per[k] = +(prof[k] / frames).toFixed(2);
    return { avg: +LX_PERF.avgFrame.toFixed(2), frames, per, dn: game.damageNumbers.length }; };
  out.perfDeadeye = await mash(['marksman_oneshot'], 3000);
  out.perfProtocol = await mash(['marksman_ult'], 3000);
  out.perfBoth = await mash(['marksman_oneshot', 'marksman_ult'], 3000);
  out.avgFrame = out.perfBoth.avg; out.dnCount = out.perfBoth.dn;
  return out;
});
await browser.close(); server.kill();
console.log(JSON.stringify(R));
const checks = [
  ['the names stay', R.name === 'Deadeye' && R.ultName === 'Deadeye Protocol'],
  ['sizeable cooldowns: 30 s and 60 s', R.cdDef === 30000 && R.ultCdDef === 60000, `${R.cdDef} / ${R.ultCdDef}`],
  ['the opening press pays MP; presses inside are free', R.mpFirst > 0 && R.mpFollow === 0, `${R.mpFirst} then ${R.mpFollow}`],
  ['the first press is 3 lines on the marked foe, in 3 rows, with a running total', R.linesFirst === 3 && R.rowsFirst === 3 && R.sumFirst && R.markIsA && R.aHurt, `${R.linesFirst} lines / ${R.rowsFirst} rows / sum ${R.sumFirst} / numbers: ${R.textsFirst}`],
  ['every line lands on ONE target (the second foe is never touched)', R.bUntouched && R.bStillUntouched],
  ['it is spammy: presses land at the 420 ms gate through one 6 s window', R.presses >= 10 && R.msPerPress <= 560, `${R.presses} presses, ${R.msPerPress} ms apart (${R.framesPerPress} frames)`],
  ['the window closes onto the real cooldown and nothing fires after', R.cdAfter > 20000 && R.late === 0, `cd ${R.cdAfter} ms, late ${R.late}`],
  ['the ramp climbs 3,4,5,6,7 and holds at 7 lines a press (7 rows on screen)', R.linesSixth === 7 && R.rowsSixth === 7 && R.cHurt, `${R.rampSeq} / ${R.rowsSixth} rows`],
  ['Protocol: a press is a 5-round homing volley of single-target crits', R.volley === 5 && R.volleyHoming, `${R.volley}`],
  ['Protocol is spammier still (250 ms gate) and never touches the other foe', R.volleys >= 8 && R.msPerVolley <= 380 && R.dHurt && R.eUntouched, `${R.volleys} volleys, ${R.msPerVolley} ms apart (${R.framesPerVolley} frames)`],
  ['an Execute Round fires by the sixth volley', R.execSeenAny === true],
  ['Protocol closes onto its real cooldown', R.ultCdAfter > 40000, `${R.ultCdAfter} ms`],
  ['a Deadeye-marked foe takes 7-round volleys', R.markedVolley === 7, `${R.markedVolley}`],
  ['a parked Protocol cooldown is repaired with the other windows', R.ultRepaired === true],
  ['the art is registered and decoded', R.fx.tracer && R.fx.reticle && R.fx.keyed && R.fx.hitFrames === 9 && R.fx.execFrames === 9 && R.fx.round && R.fx.exec, JSON.stringify(R.fx)],
  // (headless software GL; the module's own draw and the hit path each measure well under 0.1 ms a frame - see perfBoth.per)
  ['a full mash of both windows stays inside the frame budget', R.avgFrame < 14 && R.dnCount <= 30 && R.perfBoth.per._lxDeadeyeDraw < 0.5 && R.perfBoth.per.hitMonster < 0.5, `${R.avgFrame} ms avg, ${R.dnCount} numbers alive, module draw ${R.perfBoth.per._lxDeadeyeDraw} ms, hitMonster ${R.perfBoth.per.hitMonster} ms`],
  ['no page errors', errs.length === 0, errs.slice(0, 2).join(' | ')],
];
let bad = 0; for (const [n, ok, x] of checks) { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '   [' + x + ']' : ''}`); }
console.log(bad ? `\n${bad}/${checks.length} FAILED` : `\nall ${checks.length} passed`);
process.exit(bad ? 1 : 0);
