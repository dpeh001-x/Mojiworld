// ELDER ARLEN'S CORONATION OF RUIN (per user: "He needs a new menacing attack, absolutely devastating, strong powerful, a strike and
// projectiles"). Pins, in the running game on a stepped clock (page.clock, 16 ms a step):
//   art: the 10-frame cast set (frame index too), the skull shot and the eruption are registered and decode;
//   reach: out of reach he never starts it; in reach it starts with its call-out, roots him and lights the floor (smash tiles);
//   timing: the windup walks cast frames 0-4 in order, the slam frame (5) is drawn on the step the strike exists, nine skulls follow a
//           beat later out of the eruption's edge (none inside his box), and nothing of his volley or his shot fires mid-cast;
//   damage: the strike stays within 72% of max HP and a skull within 30% (no one-shot from full); a stun in the windup breaks it.
//   node scripts/arlen_ruin_test.mjs            (MOJI_SERVE_ROOT / PORT override)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = process.env.MOJI_SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'package.json')); const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 10447);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x).slice(0, 400) : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { cwd: ROOT, stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.clock.install();
  await page.goto('http://localhost:' + PORT + '/mojiworld_game.html?dev=1', { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof loadMap === 'function' && typeof LX_ARLEN_RUIN === 'object', null, { timeout: 180000 }); await page.waitForTimeout(5000);
  const art = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    player.cls = 'warrior'; player.level = 47; player._god = false; player._tutorialSeen = true; player._gravitosCineSeen = true; game.paused = false;
    loadMap('fracturedReflection', 600); await sleep(3000);
    try { _lxFxWantMob('vigil_vermillion', true); } catch (e) {}
    const A = _monsterFramesFor('vigil_vermillionruin').attack;
    for (let i = 0; i < 80; i++) { if (A.length === 10 && A.every((f) => f.complete && f.naturalWidth > 0) && LX_FX.fx_arlen_ruin && _lxFxReady(LX_FX.fx_arlen_ruin) && LX_MOB_PROJ.mruinskull && LX_MOB_PROJ.mruinskull.naturalWidth > 0) break; await sleep(250); }
    return { n: A.length, idx: _lxFrameCount('monsters/attack', 'vigil_vermillionruin', 24), decoded: A.every((f) => f.complete && f.naturalWidth > 0),
      fx: !!(LX_FX.fx_arlen_ruin && _lxFxReady(LX_FX.fx_arlen_ruin)), skull: !!(LX_MOB_PROJ.mruinskull && LX_MOB_PROJ.mruinskull.naturalWidth > 0), blit: _PROJ_SPRITE_BLIT.mruinskull };
  });
  ok('the cast set has 10 frames (frame index agrees) and the skull + eruption are registered and decode', art.n === 10 && art.idx === 10 && art.decoded && art.fx && art.skull && art.blit && art.blit.mode === 'orient' && art.blit.keepUp, art);
  // one scenario: hero at dx from Arlen, Arlen's clock due now; step S steps of 16 ms, recording per step
  const run = async (dx, S, opts) => { await page.evaluate(({ dx, opts }) => {
      game.monsters.length = 0; game.projectiles.length = 0; player.x = 600; player.vx = 0; player.hp = getMaxHp(); player.invulnerable = 0;
      const m = spawnMonster(600 + dx, 360, 'vigil_vermillion', false, true); m.speed = 0; window.__arl = m; window.__rec = []; window.__toasts = [];
      const st = window.showToast; if (!st.__w) { window.showToast = function (t) { (window.__toasts || []).push(String(t)); return st.apply(this, arguments); }; window.showToast.__w = 1; }
      const msf = window._monsterStateFrame; if (!msf.__w) { window._monsterStateFrame = function (mm) { const f = msf.apply(this, arguments); if (mm === window.__arl) window.__drawn = f && (f.src || (f._lxSrc && f._lxSrc.src) || ''); return f; }; window._monsterStateFrame.__w = 1; }
      window.__pin = setInterval(() => { player.x = 600; player.vx = 0; }, 1); window.__hpAfter = null;
      m._ruinAt = (game.time | 0) + 2; m._vermSprayAt = (game.time | 0) + 30;   // the volley falls due mid-cast on purpose
      if (opts && opts.stunAt) window.__stunAt = opts.stunAt; else window.__stunAt = 0;
    }, { dx, opts });
    const now = await page.evaluate(() => Date.now()); await page.clock.pauseAt(now + 1000);
    for (let i = 0; i < S; i++) {
      await page.clock.runFor(16);
      await page.evaluate(() => { const m = window.__arl, R = m._ruin; if (window.__stunAt && R && (game.time - R.t0) >= window.__stunAt && !R.fired) { m.stunTimer = 600; window.__stunAt = 0; }
        const zones = (typeof _lxAttackZones === 'function') ? _lxAttackZones().filter((z) => z.tg === 'tg_smash' && Math.abs(z.y + 42 - (m.y + m.h)) < 3).length : 0;
        const fired = !!(R && R.fired); let hpA = null; if (fired && window.__hpAfter == null) { window.__hpAfter = player.hp; hpA = player.hp; }
        const pj = game.projectiles; window.__rec.push({ fired, hpA, t: R ? (game.time | 0) - R.t0 : null, vx: m.vx, cast: !!_mobCasting(m), zones, f: (/vigil_vermillionruin_(\d+)/.exec(window.__drawn || '') || [])[1],
          strike: pj.filter((p) => p._arlenStrike).length, skulls: pj.filter((p) => p.skill === 'mruinskull').map((p) => [p.x + p.w / 2, p.y + p.h / 2, !!p.homing]),
          bolts: pj.filter((p) => p.skill === 'mbloodbolt').length, hp: player.hp, max: getMaxHp(), box: [m.x, m.y, m.w, m.h] });
        if (window.__hpAfter != null) { player.hp = getMaxHp(); player.invulnerable = 0; } });   // after the slam is read, keep the hero up for the rest
    }
    return page.evaluate(() => { clearInterval(window.__pin); return { rec: window.__rec, toasts: window.__toasts.slice() }; });
  };
  // 1) out of reach
  const far = await run(1000, 200);
  ok('out of reach (1000 px) he never starts the Coronation', far.rec.every((r) => r.t == null) && !far.toasts.some((t) => /CORONATION/.test(t)), far.rec.filter((r) => r.t != null).length);
  // 2) in reach, the full cast with the hero inside the strike zone
  const C = await page.evaluate(() => LX_ARLEN_RUIN);
  const r = await run(260, 180); const R = r.rec, cast = R.filter((x) => x.t != null);
  ok('in reach it starts, with its call-out', cast.length > 0 && r.toasts.some((t) => /ELDER ARLEN .* CORONATION OF RUIN!/.test(t)), r.toasts.slice(-3));
  const wind = cast.filter((x) => x.t < C.windF);
  ok('the windup roots him and he is casting throughout', wind.length > 20 && wind.every((x) => x.vx === 0 && x.cast), wind.slice(0, 3));
  ok('the floor he will break glows through the windup (smash tiles under him)', wind.filter((x) => x.t > 2).every((x) => x.zones >= 2), wind.map((x) => x.zones).slice(0, 12));
  const wf = wind.map((x) => x.f).filter((f) => f != null).map(Number);
  ok('the windup walks cast frames 0-4 in order', wf.length > 15 && wf.every((f, i) => f <= 4 && (i === 0 || f >= wf[i - 1])) && wf[0] === 0 && wf[wf.length - 1] === 4, wf.join(''));
  const s0 = R.findIndex((x) => x.fired);
  ok('the slam frame (5) is drawn on the step the strike exists', s0 >= 0 && R[s0].f === '5', s0 >= 0 ? { t: R[s0].t, f: R[s0].f } : null);
  const k0 = R.findIndex((x) => x.skulls.length > 0), sk = k0 >= 0 ? R[k0].skulls : [], bx = k0 >= 0 ? R[k0].box : [0, 0, 0, 0];
  ok('nine skulls (seven straight, two homing) follow a beat later, none inside his box', k0 > s0 && R[k0].t - R[s0].t >= 4 && sk.length === 9 && sk.filter((q) => q[2]).length === 2
    && sk.every((q) => !(q[0] > bx[0] && q[0] < bx[0] + bx[2] && q[1] > bx[1] && q[1] < bx[1] + bx[3])), { dt: k0 >= 0 ? R[k0].t - R[s0].t : null, n: sk.length });
  ok('nothing of his volley or his shot fires mid-cast', cast.filter((x) => x.t < C.windF + C.recF).every((x) => x.bolts === 0), cast.map((x) => x.bolts).filter(Boolean).length);
  const hpAt = R[Math.max(0, s0 - 1)].hp, mx = R[0].max, after = s0 >= 0 ? R[s0].hpA : mx;
  ok('the strike lands hard but within 72% of max HP (no one-shot from full)', hpAt === mx && mx - after > 0 && (mx - after) <= Math.ceil(mx * C.strikeCap) + 1, { max: mx, lost: mx - after });
  // 3) a skull alone, at full HP
  const lost = await page.evaluate(async () => { game.projectiles.length = 0; player.hp = getMaxHp(); player.invulnerable = 0; const m0 = player.hp;
    game.projectiles.push({ x: player.x + player.w / 2 - 26, y: player.y + player.h / 2 - 26, vx: 0.1, vy: 0, w: 52, h: 52, life: 20, damage: Math.floor(window.__arl.atk * LX_ARLEN_RUIN.skullMul), _bossBand: { floor: 0, cap: LX_ARLEN_RUIN.skullCap }, owner: 'enemy', skill: 'mruinskull', noGravity: true });
    return { m0 }; });
  for (let i = 0; i < 6; i++) await page.clock.runFor(16);
  const sl = await page.evaluate((m0) => ({ lost: m0 - player.hp, max: getMaxHp() }), lost.m0);
  ok('a skull lands within 30% of max HP', sl.lost > 0 && sl.lost <= Math.ceil(sl.max * C.skullCap) + 1, sl);
  // 4) a stun in the windup breaks it
  const st = await run(260, 160, { stunAt: 20 });
  ok('a stun in the windup breaks the cast (no strike, no skulls)', st.rec.every((x) => !x.fired && x.skulls.length === 0), st.rec.filter((x) => x.fired).length);
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('HARNESS ERROR', false, String(e && e.stack || e).slice(0, 300)); }
finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
