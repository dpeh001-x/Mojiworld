// CO-OP GUESTS: BOSS WARNINGS, TARGETING AND THE LOCK (bug hunt round 7, H17-1..4). One page plays both roles (no relay): as HOST
// (a stand-in partner, id 7, in net.peers) it runs the real monster AI and keeps the 'mon' / 'bosshit' frames it would send; as
// GUEST (net.myId 7) it applies those frames through _coopApplyMonsters / _coopApplyBossHit.
//   [1] every attack zone the host draws (swing, columns, lunge and dash lanes, Leo's pounce, Pisces' crush, Mooma's quake band,
//       Arlen's Coronation, Krook's jump slam) the guest draws from its mirrors, at the host's progress; Octobaby's Meltdown ring too
//   [2] a boss in melee with the partner (host 900 px off) swings at the partner and drops its columns on the partner's lane
//   [3] Elder Arlen crowns the partner beside him (Coronation of Ruin), not the far host
//   [4] the boss lock aimed at the partner: its tell rides the frame (tg.sk), a qteLock addressed to it goes out, the host is not locked
//   [5] the guest applies that lock (in reach), refuses it out of reach or addressed elsewhere, and loses it when its caster dies
//   [6] Virgo's Judgment lands on a five-sin host in a tick aimed at the partner; [7] a guest gains sins and is judged
//   [8] Leo's challenger mark aimed at the partner goes to the partner (lrSpot), not the host, and runs out on the guest
//   node scripts/coop_guest_boss_test.mjs [port]      (MOJI_SERVE_ROOT overrides the served tree)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.argv[2] || process.env.PORT || 10271); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  ' + JSON.stringify(note) : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof spawnMonster === 'function' && typeof _coopApplyMonsters === 'function', null, { timeout: 180000 }); await page.waitForTimeout(5000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const out = { ver: GAME_VERSION };
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {} try { _cineScoreStop(1, false); } catch (e) {}
    try { loadMap('forest', 300); } catch (e) {} await sleep(600); player.level = 99;
    game.paused = false; { const tl = performance.now(); while (!player.onGround && performance.now() - tl < 4000) await sleep(30); } await sleep(200);
    const floor = player.y + player.h, max = () => getMaxHp(), ww = (game.mapData && game.mapData.worldWidth) || 3000;
    const stand = (x) => { player.x = x; player.y = floor - player.h; player.vx = 0; player.vy = 0; player.onGround = true; };
    const HOST = 1, PEER = 7, inst = (typeof _coopInst === 'function') ? _coopInst() : '', sent = [];
    const setPeer = (x) => { net.peers[PEER] = { map: game.currentMap, x, y: floor - 44, vx: 0, vy: 0, hp: 5000, maxHp: 5000, cap: 3, xi: inst }; };
    const oActive = window._coopActive, oFollow = window._coopFollowingHost, oWs = net.ws, oHost = net.isHost, oHostId = net.hostId, oMy = net.myId;
    const asHost = () => { net.isHost = true; net.myId = HOST; net.hostId = HOST; window._coopFollowingHost = oFollow; };
    const asGuest = () => { net.isHost = false; net.myId = PEER; net.hostId = HOST; window._coopFollowingHost = () => true; for (const k in net.peers) delete net.peers[k]; net.peers[HOST] = { map: game.currentMap, x: 80, y: floor - 44, vx: 0, vy: 0, hp: 5000, maxHp: 5000, cap: 3, xi: inst }; game.monsters.length = 0; game.projectiles = []; game.hazards = []; };
    const keyframe = () => { net._coopMonAt = 0; net._coopKeyAt = 0; const n0 = sent.length; _coopTickMonsters(); return sent.slice(n0).filter((m) => m.t === 'mon').pop() || null; };
    const apply = (f) => { const m = JSON.parse(JSON.stringify(f)); m.id = HOST; m.map = game.currentMap; delete m.dl; _coopApplyMonsters(m); };
    const one = (type, x) => { spawnMonster(x, floor - ((monsterTypes[type] && monsterTypes[type].h) || 60), type, true); const m = game.monsters.filter((q) => q && q.type === type).pop(); if (m) { m.y = floor - m.h; m.currentHp = m.maxHp = 1e9; } return m; };
    const clear = () => { game.monsters.length = 0; game.projectiles = []; game.hazards = []; for (const k in net.peers) delete net.peers[k]; };
    const zones = () => _lxAttackZones().map((z) => ({ k: z.kind, x: Math.round(z.x), y: Math.round(z.y), w: Math.round(z.w), p: Math.round((z.prog || 0) * 100) })).sort((a, b) => (a.k + a.x).localeCompare(b.k + b.x) || a.x - b.x);
    window._coopActive = () => true; net.ws = { readyState: 1, send: (s) => { try { const m = JSON.parse(s); if (m && (m.t === 'mon' || m.t === 'bosshit')) sent.push(m); } catch (e) {} } };
    try {
      // ---- [1] the warnings, frozen mid-windup on the host, drawn again on the guest
      asHost(); clear(); setPeer(200); player._god = true; player.invulnerable = 1e9; game.paused = true; stand(150);
      const sp = Math.max(260, Math.floor((ww - 400) / 10)), X = (i) => 300 + i * sp;
      const arb = one('towerArbiter', X(0)); if (arb) { arb._bigMeleeFiring = true; arb._bigMeleeT = 300; arb.facing = 1; }
      const arc = one('archon', X(1)); if (arc) { arc._columnFiring = true; arc._columnT = 400; arc._columnLanes = [X(1) + 60, X(1) + 200]; arc._columnTargetX = X(1) + 60; }
      const stk = one('towerStalker', X(2)); if (stk) { stk.atk = 1e6; stk._hgCharging = true; stk._hgPhase = 'brace'; stk._hgT = 500; stk._hgDir = -1; }
      const lego = one('legosaurus', X(3)); if (lego) { lego.atk = 1e6; lego._braceDashing = true; lego._bdPhase = 'brace'; lego._bdT = 400; lego._bdDir = 1; }
      const leo = one('zodiac_leo', X(4)); if (leo) { leo._leoMarking = true; leo._leoPounceX = X(4) + 120; leo._leoPounceY = floor; leo.patternState = 'pounceWindup'; leo.patternTimer = 550; }
      const pis = one('zodiac_pisces', X(5)); if (pis) { pis._tidalArmed = true; pis._tidalT = 500; pis._tidalX = X(5) + 100; pis._tidalY = floor - 40; }
      const moo = one('mooma', X(6)); if (moo) { moo.patternState = 'quake'; moo.patternTimer = 600; moo._quakeFired = false; }
      const arl = one('vigil_vermillion', X(7)); if (arl) arl._ruin = { t0: (game.time | 0) - 20, dir: 1, fired: false };
      const krk = one('kingKrook', X(8)); if (krk) { krk.patternState = 'jumpSlam'; krk._kJumped = true; krk._kFired = false; krk._kJumpMs = 400; }
      const oct = one('octobaby', X(9)); if (oct) { oct._crazyActive = true; oct._crazyPhase = 'telegraph'; oct._crazyTime = 1500; }
      out.made = game.monsters.length; out.hostZ = zones(); out.hostSlam = moo ? +_lxSlamWindup(moo).toFixed(2) : null;
      const f1 = keyframe(); out.tgKeys = f1 ? f1.list.filter((e) => e && e.tg).map((e) => e.t + ':' + Object.keys(e.tg).join('+')) : null;
      asGuest(); if (f1) apply(f1);
      out.mirrors = game.monsters.length; out.guestZ = zones();
      const gm = (t) => game.monsters.find((q) => q && q.type === t);
      out.guestSlam = gm('mooma') ? +_lxSlamWindup(gm('mooma')).toFixed(2) : null;
      out.melt = gm('octobaby') ? [!!gm('octobaby')._crazyActive, gm('octobaby')._crazyPhase, gm('octobaby')._crazyTime] : null;
      if (f1) { const f2 = JSON.parse(JSON.stringify(f1)); for (const e of f2.list) if (e) delete e.tg; apply(f2); }
      out.guestZAfter = zones().length;
      // ---- [2] [3] [4] aim and the lock, real AI: host 900 px off, the partner beside the boss
      asHost(); clear(); game.paused = false; player._god = true; player.invulnerable = 1e9;
      const run = async (type, ms, each, setup) => {
        clear(); stand(80); const b = one(type, Math.min(ww - 300, 1100)); if (!b) return null; if (setup) setup(b);
        const t0 = performance.now(); while (performance.now() - t0 < ms) { setPeer(b.x + b.w + 10); stand(Math.max(40, b.x - 900)); each(b); await sleep(16); }
        return b;
      };
      let bm = 0, wasBm = false, colNear = 0, colFar = 0;
      const b2 = await run('towerArbiter', 7000, (b) => {
        if (typeof b._columnCd === 'number' && !b._colSet) { b._colSet = 1; b._columnCd = 0; } if (b._bigMeleeFiring && !wasBm) bm++; wasBm = !!b._bigMeleeFiring;
        if (b._columnFiring && b._columnLanes && !b._seenLanes) { b._seenLanes = 1; const px = b.x + b.w + 24; for (const l of b._columnLanes) { if (Math.abs(l - px) < 220) colNear++; else colFar++; } }
        if (!b._columnFiring) b._seenLanes = 0; b.currentHp = b.maxHp;
      });
      out.aim = { bm, colNear, colFar, hostX: Math.round(player.x), bossX: b2 && Math.round(b2.x) };
      let ruin = null; await run('vigil_vermillion', 2500, (b) => { if (b._ruin && !ruin) ruin = { dir: b._ruin.dir, peerSide: (b.x + b.w + 24) > (b.x + b.w / 2) ? 1 : -1 }; b.currentHp = b.maxHp; }, (b) => { b._ruinAt = 0; });
      out.ruin = ruin;
      let skTg = null; const n3 = sent.length;
      const b4 = await run('towerArbiter', 2500, (b) => { if (typeof b._shackleCd === 'number' && !b._cdSet) { b._cdSet = 1; b._shackleCd = 0; } b.currentHp = b.maxHp;
        const f = sent[sent.length - 1]; if (f && f.t === 'mon' && !skTg) for (const e of f.list) if (e && !Array.isArray(e) && e.tg && e.tg.sk) skTg = e.tg.sk; else if (Array.isArray(e) && e[7] && e[7].tg && e[7].tg.sk) skTg = e[7].tg.sk; });
      const lock = sent.slice(n3).find((m) => m.t === 'bosshit' && m.k === 'qteLock') || null;
      out.lock = { msg: lock ? { to: lock.p && lock.p.to, u: lock.p && lock.p.u } : null, sk: skTg, hostLocked: !!_QTE.active };
      const f4 = keyframe();
      // ---- [5] the guest takes the lock
      asGuest(); if (f4) apply(f4); const mir = b4 && game.monsters.find((q) => q && q.uid === b4.uid);
      const tryLock = (to, gap) => { if (_QTE.active) { _qteEnd(false); _qteHide(0); } if (!mir || !lock) return null; stand(mir.x + mir.w + gap); player._god = false; player.invulnerable = 0; player.hp = max();
        const m = JSON.parse(JSON.stringify(lock)); m.id = HOST; m.map = game.currentMap; m.p.to = to; _coopApplyBossHit(m); return !!_QTE.active; };
      out.gLockOther = tryLock(99, 40); out.gLockFar = tryLock(PEER, 600); out.gLock = tryLock(PEER, 40);
      if (mir && _QTE.active) { game.monsters.splice(game.monsters.indexOf(mir), 1); const t0 = performance.now(); while (_QTE.active && performance.now() - t0 < 2000) await sleep(30); }   // a frame or two (more under load)
      out.gLockAfterDeath = !!_QTE.active; if (_QTE.active) { _qteEnd(false); _qteHide(0); }
      // ---- [6] Virgo judges a five-sin host in a tick aimed at the partner
      asHost(); player._god = false; let fired = false, done = false;
      const v6 = await run('zodiac_virgo', 4500, (b) => { b.currentHp = b.maxHp; if (!fired && b._virgoExecuteFiring) fired = true; if (fired && !b._virgoExecuteFiring && !done) { done = true; out.hostHpAfter = player.hp; out.hostSinAfter = player._virgoSin | 0; } if (!fired) { player.hp = max(); player.invulnerable = 0; } },
        () => { player._virgoSin = 5; player.hp = max(); player.invulnerable = 0; player._god = false; });
      out.judge = { fired, done, lost: done ? Math.round(max() - out.hostHpAfter) : null, sin: out.hostSinAfter, share: Math.floor(max() * 0.75 * LX_ZODIAC_DMG_MUL) };
      player._god = true; player.invulnerable = 1e9; player.hp = max(); player._virgoSin = 0;
      const f6 = keyframe();
      // ---- [7] a guest gains sins and is judged
      asGuest(); if (f6) apply(f6); const vm = game.monsters.find((q) => q && q.zodiacSign === 'virgo');
      out.vMirror = vm ? { sign: vm.zodiacSign } : null; player._downed = false; player._virgoSin = 4; player._god = false; player.invulnerable = 0; player.hp = max();
      const dn0 = (game.damageNumbers || []).length; let sin5 = false;
      if (vm) { const t0 = performance.now(); while (performance.now() - t0 < 1500 && !sin5) { stand(vm.x + vm.w / 2 - player.w / 2); player.hp = max(); player._downed = false; if ((player._virgoSin | 0) >= 5) sin5 = true; await sleep(16); } }
      stand(Math.min(ww - 80, (vm ? vm.x : 500) + 700)); player.invulnerable = 0; player.hp = max(); player._downed = false; await sleep(2600);
      out.gJudge = { sin5, sinAfter: player._virgoSin | 0, judged: (game.damageNumbers || []).slice(dn0).some((d) => /JUDGMENT/.test(String(d.text))) || player._lastDamageSource === 'Virgo Judgment Execute' };
      player._god = true; player.invulnerable = 1e9; player.hp = max();
      // ---- [8] Leo's challenger mark
      asHost(); player._leoSpotlight = 0; player._leoSpotlightFrom = null; const n8 = sent.length;
      const l8 = await run('zodiac_leo', 1500, (b) => { b.currentHp = b.maxHp; if (b._leoMarkAt != null && !b._mk) { b._mk = 1; b._leoMarkAt = 0; } });
      const spot = sent.slice(n8).find((m) => m.t === 'bosshit' && m.k === 'lrSpot') || null;
      out.leo = { hostSpot: (player._leoSpotlight | 0) > 0, msg: spot ? spot.p : null };
      const f8 = keyframe(); asGuest(); if (f8) apply(f8); const lm = l8 && game.monsters.find((q) => q && q.uid === l8.uid);
      player._downed = false; player.hp = max(); if (spot && lm) { const m = JSON.parse(JSON.stringify(spot)); m.id = HOST; m.map = game.currentMap; _coopApplyBossHit(m); }
      out.gSpot = { on: (player._leoSpotlight | 0) > 0 && player._leoSpotlightFrom === lm }; if (!out.gSpot.on) out.gSpot.dbg = { lm: !!lm, spot: !!spot, l8: !!l8, n: game.monsters.length, paused: game.paused, hp: player.hp, my: net.myId, ls: player._leoSpotlight, from: !!player._leoSpotlightFrom };
      await sleep(5200); out.gSpot.after = player._leoSpotlight | 0;
    } finally { window._coopActive = oActive; window._coopFollowingHost = oFollow; net.ws = oWs; net.isHost = oHost; net.hostId = oHostId; net.myId = oMy; game.paused = true; }
    return out;
  });
  console.log('build ' + r.ver + '  monsters ' + r.made + ' / mirrors ' + r.mirrors);
  const same = (a, b) => a.length === b.length && a.every((z, i) => z.k === b[i].k && Math.abs(z.x - b[i].x) <= 2 && Math.abs(z.y - b[i].y) <= 2 && Math.abs(z.w - b[i].w) <= 2 && Math.abs(z.p - b[i].p) <= 6);
  ok('[1] every zone the host draws, the guest draws from its mirrors (same kind, place, size and progress)', r.hostZ.length >= 9 && same(r.hostZ, r.guestZ), { host: r.hostZ.length, guest: r.guestZ.length, tg: r.tgKeys, g: r.guestZ.slice(0, 4) });
  ok('[1] Mooma\'s quake band runs at the host\'s progress on the guest (was stuck at 0)', r.hostSlam > 0.3 && r.guestSlam === r.hostSlam, { host: r.hostSlam, guest: r.guestSlam });
  ok('[1] Octobaby\'s Meltdown ring: the mirror is mid-telegraph with the host\'s time', !!(r.melt && r.melt[0] && r.melt[1] === 'telegraph' && r.melt[2] === 1500), r.melt);
  ok('[1] a frame without the windup clears every zone on the guest', r.guestZAfter === 0, { left: r.guestZAfter });
  ok('[2] a boss in melee with the partner swings at it (host 900 px off)', r.aim.bm >= 1, r.aim);
  ok('[2] its columns fall on the partner\'s lane, never the far host\'s', r.aim.colNear >= 1 && r.aim.colFar === 0, r.aim);
  ok('[3] Elder Arlen crowns the partner beside him (Coronation toward it)', !!(r.ruin && r.ruin.dir === r.ruin.peerSide), r.ruin);
  ok('[4] the lock aimed at the partner: its tell rides the frame and a qteLock addressed to it goes out; the host is not locked', !!(r.lock.msg && r.lock.msg.to === 7 && r.lock.sk && r.lock.sk[1] === 7 && !r.lock.hostLocked), r.lock);
  ok('[5] the guest is locked in reach; not out of reach (600 px) or when it is addressed to someone else', r.gLock === true && r.gLockFar === false && r.gLockOther === false, { inReach: r.gLock, far: r.gLockFar, other: r.gLockOther });
  ok('[5] the guest\'s lock ends when its caster dies', r.gLock === true && r.gLockAfterDeath === false, { after: r.gLockAfterDeath });
  ok('[6] Virgo\'s Judgment lands on the five-sin host in a tick aimed at the partner (was undone by the swap, sins wiped)', !!(r.judge.done && Math.abs(r.judge.lost - r.judge.share) <= Math.max(2, r.judge.share * 0.05) && r.judge.sin === 0), r.judge);
  ok('[7] a guest touched by Virgo gains a sin and five sins are judged on its screen', !!(r.vMirror && r.gJudge.sin5 && r.gJudge.judged && r.gJudge.sinAfter === 0), { mirror: r.vMirror, ...r.gJudge });
  ok('[8] Leo\'s challenger mark aimed at the partner is addressed to it, and the host is not made the challenger', !!(r.leo.msg && r.leo.msg.to === 7 && !r.leo.hostSpot), r.leo);
  ok('[8] the guest wears the mark from Leo\'s mirror, and it runs out (~4.5 s)', !!(r.gSpot.on && r.gSpot.after === 0), r.gSpot);
  ok('[last] no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { ok('HARNESS ERROR', false, String(e && e.stack || e).slice(0, 300)); }
finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
