// BUG HUNT 2026-10-02 - co-op mirror parity (ids coop-2, coop-5, coop-7, coop-9, coop-11, boss-3, boss-5, diff-b-2, parityA-4,
// parityB-8, sibling-3, sibling-4, engine-2). One page plays BOTH seats in turn over a fake socket: as host it builds the real
// frames (_coopTickMonsters, _coopProjList, the hazard resolver), then as guest it applies them (_coopApplyMonsters,
// _coopApplyProjectiles, _coopApplyHazHit, _coopApplyBossHit), so every check runs the real code on both ends of the wire.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] [PORT=n] node scripts/bughunt_coop_mirror_test.mjs [candidate.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '13965';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d !== undefined ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
let src = '';
try {
  src = await (await fetch(`http://localhost:${PORT}/mojiworld_game.html`)).text();
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 200)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof castSkill === 'function' && typeof GAME_VERSION === 'string' && !!document.getElementById('lo-menu'), null, { timeout: 180000 });
  await page.waitForTimeout(2500);
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootHold.release('menu'); } catch (e) {}
    player.level = 60; player.cls ||= 'warrior'; player._gravitosCineSeen = true; player._tutorialSeen = true;
    try { player._storyBeatsSeen = new Proxy({}, { get: () => true, set: () => true }); } catch (e) {}
    loadMap('forest', 300); game.paused = false; await sleep(800); game.paused = false;
    // the fake socket and the two seats (host = id 5, guest = id 9). `peer` overrides the other seat's presence entry.
    window.__sent = []; const fake = { readyState: 1, send(s) { window.__sent.push(s); } };
    window.__role = (role, peer) => {
      net.myId = role === 'host' ? 5 : 9; net.connected = true; net.ws = fake; net.hostId = 5; net.isHost = role === 'host';
      const other = role === 'host' ? 9 : 5;
      net.peers = { [other]: Object.assign({ id: other, _last: performance.now(), map: game.currentMap, x: 0, y: 0, hp: 100, maxHp: 100, cap: 4, xi: '' }, peer || {}) };
    };
    window.__solo = () => { net.connected = false; net.ws = null; net.myId = null; net.peers = {}; net.isHost = true; net.hostId = null; };
    // mint a quiet monster with plenty of HP, flags on it set by the case
    window.__mk = (type, o) => { const m = spawnMonster(player.x + 200, player.y, type || 'slime', false, false); m.maxHp = m.currentHp = 1e8; m.def = 0; m.invulnerable = 0; m.freezeTimer = 0; m.stunTimer = 0; m.atk = 10; m.uid = o && o.uid || (game._monUid = (game._monUid || 0) + 1); return Object.assign(m, o || {}); };
    // host builds a frame list (full keyframe, then a light one if `light`), the guest applies them in order
    window.__wire = (o) => {
      o = o || {}; __role('host', o.peer); net._coopMonAt = 0; net._coopKeyAt = 0; __sent.length = 0; _coopTickMonsters();
      const frames = [JSON.parse(__sent.pop())];
      if (o.mutate) { o.mutate(); net._coopMonAt = 0; net._coopKeyAt = performance.now(); __sent.length = 0; _coopTickMonsters(); const s2 = __sent.pop(); if (s2) frames.push(JSON.parse(s2)); }
      __role('guest'); for (const f of frames) { f.id = 5; _coopApplyMonsters(f); }
      return frames;
    };
  });
  const E = (fn, arg) => page.evaluate(fn, arg);
  // ==== PART 1: coop-2 / coop-11 (the heal-lock accessor) and engine-2 =====================================================
  const heal = await E(() => {
    const out = {}; __solo(); player._god = false; player.invulnerable = 9e9; player.maxHp = 6000; player.hp = 6000; player.dying = 0; game.dying = false;
    const peer = (hp) => ({ id: 7, cls: 'warrior', hp, maxHp: 6000, map: game.currentMap, _rx: player.x + 60, look: {}, anim: 'idle', vx: 0, vy: 0 });
    const reset = () => { window._lxHpRestore = true; player.hp = 6000; window._lxHpRestore = false; };
    _lxHealLockApply(10000, 'test comet'); out.locked = _lxHealLocked() && !!(Object.getOwnPropertyDescriptor(player, 'hp') || {}).get;
    reset(); _mpDrawPeerAvatar(peer(1), 400, 300, 1); out.avatarLow = player.hp;           // a partner at 1 HP drawn under the lock
    reset(); _mpDrawPeerAvatar(peer(300), 400, 300, 1); out.avatarMid = player.hp;
    window._lxHpRestore = true; player.hp = 3000; window._lxHpRestore = false;
    player._healBlockedAt = 0; _mpDrawPeerAvatar(peer(6000), 400, 300, 1); out.avatarHigh = player.hp; out.stamped = (player._healBlockedAt | 0) > 0;   // a healthier partner than me
    reset(); _drawMirrorSelf({ type: 'mirrorSelf', currentHp: 1, w: 28, h: 44, x: player.x, y: player.y, vx: 0, vy: 0, facing: 1 }, 300, 300); out.mirrorSelf = player.hp;
    // coop-11: a downed player (held at 1 HP) is revived under a heal lock
    reset(); player._downed = true; window._lxHpRestore = true; player.hp = 1; window._lxHpRestore = false; player._coopReviveMapAt = {};
    __role('guest'); net.peers = { 7: { id: 7, name: 'Pal', map: game.currentMap, x: player.x + 10, y: player.y, _last: performance.now() } };
    _coopApplyRevive({ id: 7 }); out.revived = player.hp; out.revivedDowned = !!player._downed;
    player.invulnerable = 0; reset(); player._healLockUntil = 0; player._downed = false; __solo();
    return out;
  });
  check(heal.locked, 'a heal lock is on (the hp accessor is installed)', J(heal));
  check(heal.avatarLow === 6000 && heal.avatarMid === 6000, 'drawing a partner at low HP leaves MY hp alone under a heal lock (coop-2)', J([heal.avatarLow, heal.avatarMid]));
  check(heal.avatarHigh === 3000, 'drawing a healthier partner does not raise mine either', heal.avatarHigh);
  check(heal.mirrorSelf === 6000, 'the Mirror Self draw swap restores my hp under a heal lock (coop-2)', heal.mirrorSelf);
  check(heal.revived >= 2900 && !heal.revivedDowned, 'a partner revive lifts the downed 1 HP to half under a heal lock (coop-11)', J([heal.revived, heal.revivedDowned]));
  // engine-2: the hidden-tab pump keeps the sub-step remainder (the pump closure lives inside a Worker handler: source check)
  check(/while \(_acc >= _LX_SIM_STEP_MS\) \{[^\n]*\n\s*_lxCoopPumpLast = _now - _acc;/.test(src), 'the hidden-tab co-op pump carries its sub-step remainder (engine-2)');
  // ==== PART 2: the host judges what a mirror cannot see (coop-5, boss-3, diff-b-2 / parityB-8a) ===========================
  const host = await E(() => {
    const out = {}; __role('host', { x: 0 }); const drop = (m, d, skill, pid) => { const h0 = m.currentHp; _coopHostApplyDamage(m.uid, d, false, skill || 'melee', null, pid == null ? 9 : pid); return h0 - m.currentHp; };
    let m = __mk('slime', { uid: 9101 });
    out.plain = drop(m, 1000);
    m._invulnBurrow = true; out.burrowMelee = drop(m, 1000); out.burrowBurn = drop(m, 1000, 'burn'); out.burrowThorns = drop(m, 1000, 'thorns'); m._invulnBurrow = false;
    m._dmgTakenMul = 0.12; out.regalia = drop(m, 1000); m._dmgTakenMul = 1.75; out.exposed = drop(m, 1000); m._dmgTakenMul = 1;
    m._dirGuardT = 400; out.guard = drop(m, 1000); m._dirGuardT = 0;
    m.type = 'sundered_smith'; m._smithHeat = 'hot'; out.smithHot = drop(m, 1000); m._smithHeat = 'quenched'; out.smithCold = drop(m, 1000); m._smithHeat = null; m.type = 'slime';
    // Taurus planted: facing LEFT (-1); a partner on his left is in front of him, on his right is behind
    m.facing = -1; m._frontBlocked = true; const cx = m.x + m.w / 2;
    net.peers[9].x = cx - 300; out.tauFront = drop(m, 1000); net.peers[9].x = cx + 300; out.tauBack = drop(m, 1000); m._frontBlocked = false;
    // Cancer sealed facing RIGHT (+1): the guest's hitMonster already took the x0.3 off a front hit, so the forwarded 300 must land as 300
    m._cancerShellClosed = true; m._shellFace = 1; m._shellHp = 10000;
    net.peers[9].x = cx + 300; const f0 = m._shellHp; out.cancerFront = drop(m, 300); out.shellFront = Math.round(f0 - m._shellHp);
    net.peers[9].x = cx - 300; const b0 = m._shellHp; out.cancerBack = drop(m, 1000); out.shellBack = Math.round(b0 - m._shellHp); m._cancerShellClosed = false;
    // Libra: the unlit pan takes 25% (host judged); a lit one and a plain monster take it all
    m._libraOrb = 'B'; m._libraOrbActive = false; out.panUnlit = drop(m, 1000); m._libraOrbActive = true; out.panLit = drop(m, 1000); m._libraOrb = false;
    __solo(); return out;
  });
  check(host.plain === 1000, 'control: a plain monster takes the forwarded 1000', host.plain);
  check(host.burrowMelee === 0 && host.burrowBurn === 1000 && host.burrowThorns === 1000, 'a burrowed (_invulnBurrow) monster refuses a guest hit; burn and thorns still land (coop-5)', J([host.burrowMelee, host.burrowBurn, host.burrowThorns]));
  check(host.regalia === 120 && host.exposed === 1750, 'the Sovereign\'s _dmgTakenMul applies to a guest hit: Regalia x0.12, Exposed x1.75 (boss-3)', J([host.regalia, host.exposed]));
  check(host.guard === 450, 'GUARD UP (_dirGuardT) takes 55% off a guest hit (boss-3)', host.guard);
  check(host.smithHot === 1320 && host.smithCold === 650, 'the Smith\'s heat applies to a guest hit: hot x1.32, quenched x0.65 (boss-3)', J([host.smithHot, host.smithCold]));
  check(host.tauFront === 0 && host.tauBack === 1000, 'a planted Taurus deflects a guest hit from the front and takes one from behind (boss-3)', J([host.tauFront, host.tauBack]));
  check(host.cancerFront === 300 && host.shellFront === 1000 && host.cancerBack === 1000 && host.shellBack === 3000, 'Cancer\'s shell: no second x0.3 on the host, the carapace chips 1x from the front and 3x from behind (boss-3)', J(host));
  check(host.panUnlit === 250 && host.panLit === 1000, 'a guest hit on the unlit Libra pan lands for 25% (diff-b-2 / parityB-8a)', J([host.panUnlit, host.panLit]));
  // ==== PART 3: what the frame carries (coop-5 / parityB-8b / diff-b-2 / coop-7), keyframe and light frame ==================
  const wire = await E(() => {
    const out = {}; __solo(); game.monsters.length = 0;
    const burrow = __mk('slime', { uid: 9201 }), ghost = __mk('slime', { uid: 9202 }), dim = __mk('lanternWisp', { uid: 9203, _libraOrb: 'A', _libraOrbActive: false, _artKey: 'scaleLanternA' });
    const lit = __mk('lanternWisp', { uid: 9204, _libraOrb: 'B', _libraOrbActive: true, _artKey: 'scaleLanternB' }), pan = __mk('lanternWisp', { uid: 9205, _libraOrb: 'A', _libraOrbActive: true, _artKey: 'scaleLanternA' });
    const shiny = __mk('slime', { uid: 9206, isShiny: true }), plain = __mk('slime', { uid: 9207 });
    const fbm = __mk('slime', { uid: 9208, _frontBlocked: true, facing: -1 }), pmm = __mk('slime', { uid: 9209, _dmgTakenMul: 0.12, _dirGuardT: 300 });
    burrow._invulnBurrow = true; ghost._dirGhostT = 120;
    game.mojidexShiny = {}; const R = Math.random; Math.random = () => 0.0001;   // a mirror that rolls for itself would be shiny at this roll
    let frames; try { frames = __wire({ mutate: () => { pan._libraOrbActive = false; } }); } finally { Math.random = R; }
    const mir = (u) => game.monsters.find((x) => x && x.uid === u && x._coopMirror);
    const e0 = frames[0].list.find((e) => e.u === 9203) || {};
    out.keyHasWire = { ar: e0.ar, lo: e0.lo, sn: (frames[0].list.find((e) => e.u === 9206) || {}).sn, ib: (frames[0].list.find((e) => e.u === 9201) || {}).ib, gh: (frames[0].list.find((e) => e.u === 9202) || {}).gh };
    out.light = frames.length > 1 && frames[1].dl === 1 && Array.isArray(frames[1].list[0]);
    out.burrowMirror = !!(mir(9201) && mir(9201)._invulnBurrow); out.plainMirrorBurrow = !!(mir(9207) && mir(9207)._invulnBurrow);
    out.ghostMirror = mir(9202) && mir(9202)._dirGhostT; out.plainGhost = mir(9207) && mir(9207)._dirGhostT;
    out.art = [mir(9203) && mir(9203)._artKey, mir(9204) && mir(9204)._artKey, mir(9207) && mir(9207)._artKey];
    out.dimFlags = [mir(9203) && mir(9203)._libraDim, mir(9204) && mir(9204)._libraDim, mir(9205) && mir(9205)._libraDim, mir(9203) && mir(9203)._libraOrb];
    out.shiny = [mir(9206) && mir(9206).isShiny, mir(9207) && mir(9207).isShiny]; out.dex = !!(game.mojidexShiny && game.mojidexShiny.slime);
    // guest hits: the forward stays un-reduced and the guest predicts the host's x0.25; a burrowed foe refuses the hit outright
    const rec = []; const orig = _coopSendDamage; window._coopSendDamage = (mm, d) => { rec.push(d); };
    const hit = (u, skill) => { const mm = mir(u); const h0 = mm.currentHp; rec.length = 0; player._lxSureHit = true; try { hitMonster(mm, 1000, false, skill); } finally { player._lxSureHit = false; } return { fwd: rec.length ? rec[0] : null, drop: h0 - mm.currentHp }; };
    try { { const fm = mir(9208); const px = player.x; player.x = fm.x - 120; out.hitFront = hit(9208, 'power'); player.x = fm.x + fm.w + 120; out.hitBehind = hit(9208, 'power'); player.x = px; } out.hitPm = hit(9209, 'power'); out.pm = mir(9209) && mir(9209)._predMul; out.fbFlag = !!(mir(9208) && mir(9208)._frontBlocked); out.hitDim = hit(9203, 'power'); out.hitLit = hit(9204, 'power'); out.hitBurrow = hit(9201, 'power'); out.hitPlain = hit(9207, 'power'); } finally { window._coopSendDamage = orig; }
    __solo(); return out;
  });
  check(wire.keyHasWire.ar === 'scaleLanternA' && wire.keyHasWire.lo === 2 && wire.keyHasWire.sn === 1 && wire.keyHasWire.ib === 1 && wire.keyHasWire.gh === 1, 'the keyframe carries ar / lo / sn / ib / gh', J(wire.keyHasWire));
  check(wire.light, 'the second frame was a light (array) frame', J(wire.light));
  check(wire.burrowMirror && !wire.plainMirrorBurrow, 'a guest\'s mirror of a burrowed boss is _invulnBurrow, a plain one is not (coop-5)', J([wire.burrowMirror, wire.plainMirrorBurrow]));
  check(wire.ghostMirror === 300 && !wire.plainGhost, 'Ghost Step reaches the mirror as _dirGhostT (parityB-8b)', J([wire.ghostMirror, wire.plainGhost]));
  check(wire.art[0] === 'scaleLanternA' && wire.art[1] === 'scaleLanternB' && !wire.art[2], 'a guest\'s Libra lanterns wear the host\'s art key (diff-b-2)', J(wire.art));
  check(wire.dimFlags[0] === true && wire.dimFlags[1] === false && wire.dimFlags[2] === true && !wire.dimFlags[3], 'the unlit pan is dim on the mirror (incl. a pan that flipped on a LIGHT frame), the lit one is not, and _libraOrb is never copied (no double x0.25)', J(wire.dimFlags));
  check(wire.shiny[0] === true && wire.shiny[1] === false && !wire.dex, 'a mirror wears the host\'s shiny roll, never its own, and writes no Mojidex slot (coop-7)', J([wire.shiny, wire.dex]));
  check(wire.hitDim.fwd > 0 && wire.hitLit.fwd > 0 && Math.abs(wire.hitDim.fwd - wire.hitLit.fwd) < wire.hitLit.fwd * 0.2 && wire.hitDim.drop === Math.floor(wire.hitDim.fwd * 0.25) && wire.hitLit.drop === wire.hitLit.fwd, 'a guest hit on the unlit pan forwards a full-size number (the hit spread aside) and predicts exactly 25% of it; a lit pan predicts all of it (diff-b-2)', J([wire.hitDim, wire.hitLit]));
  check(wire.fbFlag && wire.hitFront.fwd === null && wire.hitFront.drop === 0 && wire.hitBehind.fwd > 0, 'the mirror of a planted Taurus deflects a front hit on the guest too (no forward) and takes one from behind (boss-3)', J([wire.fbFlag, wire.hitFront, wire.hitBehind]));
  check(Math.abs(wire.pm - 0.054) < 0.002 && wire.hitPm.fwd > 0 && wire.hitPm.drop === Math.max(1, Math.floor(wire.hitPm.fwd * wire.pm)), 'the guest predicts the host-only multipliers (Regalia x GUARD UP) but forwards the un-multiplied hit (boss-3)', J([wire.pm, wire.hitPm]));
  check(wire.hitBurrow.fwd === null && wire.hitBurrow.drop === 0 && wire.hitPlain.fwd > 0, 'a guest\'s hit on a burrowed boss is refused on the guest too (no forward, no predicted drop) (coop-5)', J([wire.hitBurrow, wire.hitPlain]));
  // ==== PART 4: the hazard strike and the boss direct hits (parityA-4, boss-5) ============================================
  const hz = await E(() => {
    const out = {}; __solo(); game.monsters.length = 0; game.hazards.length = 0;
    // host: a %-of-max-HP pillar with a shove and Gravitos's band detonates; its hazhit frame must carry what the guest needs
    __role('host'); player._god = true; __sent.length = 0;
    game.hazards.push({ type: 'meteor_warn', x: 540, cx: 600, y: 0, w: 120, h: 560, radius: 120, life: 3, maxLife: 3, timer: 3, damage: 4000, owner: 'enemy', color: '#ffaa33', _sourceLabel: 'Test Pillar', _pctCap: true, _kb: 16, _gravBand: { floor: 0, cap: 0.35, mul: 1, ref: 2000 } });
    for (let i = 0; i < 6; i++) updateProjectiles(16);
    const fs = __sent.filter((s) => s.indexOf('"t":"hazhit"') >= 0).map((s) => JSON.parse(s)); out.frame = fs[0] ? { pc: fs[0].pc, kb: fs[0].kb, gbd: fs[0].gbd } : null;
    player._god = false; game.hazards.length = 0; game.projectiles.length = 0;
    // guest: the same strike on a player with the DEF absorb at its cap
    __role('guest'); const absorb = _defAbsorbMul; window._defAbsorbMul = () => 0.2;
    const strike = (o, px) => { player.maxHp = 5000; player.hp = 5000; player.invulnerable = 0; player.dying = 0; game.paused = false; player.x = px == null ? 590 : px; player.vx = 0; player.onGround = true; player.y = 300;
      const h0 = player.hp; _coopApplyHazHit(Object.assign({ map: game.currentMap, id: 5, x: 600, r: 120, d: 4000, c: '#f93', sl: 'Test Pillar' }, o)); const lost = h0 - player.hp; const vx = player.vx; player.hp = 5000; return { lost, vx }; };
    try { out.plain = strike({}); out.pct = strike({ pc: 1 }); out.big = strike({ pc: 1, d: 1e9 }); out.bigRaw = strike({ d: 1e9 }); out.kb = strike({ kb: 16 }); out.kbLeft = strike({ kb: 16 }, 560); out.band = strike({ gbd: [0, 0.001, 1, 1000] }); out.badBand = strike({ gbd: [0, 9, 1, 1000] }); }
    finally { window._defAbsorbMul = absorb; }
    out.mh = getMaxHp(); __solo(); return out;
  });
  check(hz.frame && hz.frame.pc === 1 && hz.frame.kb === 16 && Array.isArray(hz.frame.gbd) && hz.frame.gbd[1] === 0.35, 'the host\'s hazhit frame carries pc / kb / gbd (parityA-4)', J(hz.frame));
  check(hz.pct.lost > 0 && hz.pct.lost < hz.plain.lost * 0.5, 'a %-of-max-HP pillar (pc) gets the second DEF pass on the guest, as on the host (parityA-4)', J([hz.plain.lost, hz.pct.lost]));
  check(hz.big.lost <= Math.floor(hz.mh * 0.999) && hz.big.lost > hz.mh * 0.9 && hz.bigRaw.lost > hz.mh, 'the 99.9% ceiling holds for pc hits and not for raw atk columns (parityA-4)', J([hz.big.lost, hz.bigRaw.lost]));
  check(hz.kb.vx === 16 && hz.kbLeft.vx === -16 && hz.plain.vx === 0, 'the pillar\'s shove (kb) throws the guest away from the column centre (parityA-4)', J([hz.kb.vx, hz.kbLeft.vx, hz.plain.vx]));
  check(hz.band.lost <= 1 && hz.badBand.lost > 1, 'Gravitos\'s band (gbd) clamps the final loss; a nonsense band is ignored (parityA-4)', J([hz.band.lost, hz.badBand.lost]));
  const bh = await E(() => {
    const out = {}; __solo(); __role('guest'); game.paused = false;
    const hit = (o, ground, feetY) => { player.maxHp = 5000; player.hp = 5000; player.invulnerable = 0; player.onGround = ground; player.x = 600; player.y = feetY - player.h;
      const h0 = player.hp; _coopApplyBossHit(Object.assign({ map: game.currentMap, id: 5, x: 600, y: 0, r: 0, d: 0, fr: 0.3, sl: 'quake', c: '#f84' }, o)); const lost = h0 - player.hp; player.hp = 5000; return lost; };
    out.airNoFlag = hit({}, false, 300); out.airGrounded = hit({ g: 1 }, false, 300); out.groundGrounded = hit({ g: 1 }, true, 300);
    out.aboveBand = hit({ lo: 400 }, true, 380); out.belowBand = hit({ lo: 400 }, true, 450);
    // the broadcaster puts the new rules on the wire
    __role('host'); __sent.length = 0; _coopBroadcastBossHit(10, 0, 0, 0, 0.5, 'q', '#fff', true); _coopBroadcastBossHit(10, 0, 0, 0, 0.02, 'a', '#fff', false, 400.4); _coopBroadcastBossHit(10, 0, 50, 0, 0.1, 'p', '#fff');
    out.wire = __sent.map((s) => JSON.parse(s)).map((f) => [f.g, f.lo]);
    // the host's own re-apply (the partner-aggro tap) follows the same rules
    __solo(); player.maxHp = 5000; player.hp = 5000; player.invulnerable = 0; player.onGround = false; const h1 = player.hp; _coopSelfBossHit(600, 0, 0, 0, 0.3, 'q', '#fff', true); out.selfAir = h1 - player.hp;
    player.onGround = true; _coopSelfBossHit(600, 0, 0, 0, 0.3, 'q', '#fff', true); out.selfGround = h1 - player.hp; player.hp = 5000;
    __solo(); return out;
  });
  check(bh.airNoFlag > 0 && bh.airGrounded === 0 && bh.groundGrounded > 0, 'a grounded boss strike (g) misses a guest in the air and hits one on the ground (boss-5)', J([bh.airNoFlag, bh.airGrounded, bh.groundGrounded]));
  check(bh.aboveBand === 0 && bh.belowBand > 0, 'Altitude Pressure (lo) only reaches a guest below its floor band (boss-5)', J([bh.aboveBand, bh.belowBand]));
  check(J(bh.wire) === J([[1, 0], [0, 400], [0, 0]]), 'the broadcaster sends g / lo (and nothing extra for an ordinary strike)', J(bh.wire));
  check(bh.selfAir === 0 && bh.selfGround > 0, 'the host\'s own re-apply of a tapped strike keeps the ground rule (boss-5)', J([bh.selfAir, bh.selfGround]));
  // the site shapes (each is a literal call: a source check pins them)
  check(/_coopBroadcastBossHit\(m\._tidalX, m\._tidalY, 90, 0, 0\.26, "Pisces's Tidal Crush"/.test(src), 'Pisces\' Tidal Crush broadcasts r = 90 (the host\'s +-80 box), not 240 (boss-5)');
  check(/_coopBroadcastBossHit\(m\._sagMarkX, m\._sagMarkY, 70, 0, 0\.24, "Sagittarius's Marked Shot"/.test(src), 'Marked Shot broadcasts the marked spot (r 70), not the whole arena (boss-5)');
  check(/_coopBroadcastBossHit\(h\.x \+ h\.w \/ 2, 0, h\.w \/ 2, 0, 0\.35, "Aquarius's Conductive Pool"/.test(src), 'the Conductive Pool broadcasts its lane (x only), not the whole arena (boss-5)');
  check(/"Capricorn's Altitude Pressure", '#bba078', false, Math\.round\(_floorBand\)\)/.test(src), 'Altitude Pressure broadcasts its floor band (boss-5)');
  const groundSites = ["King Gloopaloo's earthquake\", '#ff8844', true)", "Mooma's earthquake\", '#ff8844', true)", "Mooma's ground-shake\", '#ff5522', true)", "'s slam\", '#ff5522', true)", "Capricorn's hoofquake\", '#bba078', true)"];
  check(groundSites.every((t) => src.includes(t)), 'the five ground quakes / slams broadcast grounded (boss-5)', J(groundSites.map((t) => src.includes(t))));
  // ==== PART 5: loot (coop-9), the paused statue (sibling-3), the swing's rules on the wire (sibling-4) ====================
  const lo = await E(() => {
    __solo(); game.drops = []; game.powerupOrbs = [];
    __role('host', { map: '__elsewhere__' });   // keyed mode (cap 4); the partner is in the room, on another map
    game.drops.push({ x: 100, y: 100, vy: 0, type: 'item', item: { name: 'Old Boots', slot: 'boots' }, life: 60000 });
    game.powerupOrbs.push({ x: 120, y: 100, w: 26, h: 26, rarity: 'common', life: 30000, collected: false });
    __sent.length = 0; _coopTickDrops(); const alone = __sent.length;
    net.peers[9].map = game.currentMap;   // the partner arrives inside the drop's 60 s life
    game.drops.push({ x: 140, y: 100, vy: 0, type: 'item', item: { name: 'New Gloves', slot: 'gloves' }, life: 60000 });
    __sent.length = 0; _coopTickDrops(); const fr = __sent.map((s) => JSON.parse(s)); game.drops = []; game.powerupOrbs = []; __solo();
    return { alone, names: fr.filter((f) => f.k === 'item').map((f) => f.it.name), orbs: fr.filter((f) => f.k === 'orb').length };
  });
  check(lo.alone === 0 && J(lo.names) === J(['New Gloves']) && lo.orbs === 0, 'loot that dropped while the partner was elsewhere is not copied to them when they arrive; loot after is (coop-9)', J(lo));
  const st = await E(() => {
    __role('host'); player.hp = player.maxHp = 5000; game.dying = false; player.dying = 0; game.paused = true;
    const keys = ['mp', '_virgoSin', '_cancerBubble', '_cancerBubbleHits', '_leoSpotlight', '_potionLockUntil', '_potionLockMap', '_potionSealNextAt'];
    player.mp = 80; player._virgoSin = 1; player._cancerBubble = 0; player._cancerBubbleHits = 0; player._leoSpotlight = 0; player._potionLockUntil = 0; player._potionLockMap = ''; player._potionSealNextAt = 0;
    const before = {}; for (const k of keys) before[k] = player[k]; const sp = { um: updateMonsters, up: updateProjectiles };
    window.updateMonsters = () => { player.mp = 0; player._virgoSin = 5; player._cancerBubble = 99; player._cancerBubbleHits = 3; player._leoSpotlight = 7; player._leoSpotlightFrom = { dummy: 1 }; player._potionLockUntil = 99999; player._potionLockMap = 'zz'; player._potionSealNextAt = 88888; };
    window.updateProjectiles = () => {};
    try { _lxCoopWorldStep(16); } finally { window.updateMonsters = sp.um; window.updateProjectiles = sp.up; }
    const after = {}; for (const k of keys) after[k] = player[k];
    game.paused = false; __solo(); return { before, after, from: player._leoSpotlightFrom };
  });
  check(J(st.before) === J(st.after) && !st.from, 'a paused player\'s ghost statue is not drained, sinned, bubbled, spotlit or potion-sealed by the world step (sibling-3)', J(st));
  check(/if \(p\._zodiacSign === 'aquarius' && !player\._god && _projLost > 0\) \{/.test(src), 'the Aquarius potion seal needs a hit that took something (_projLost > 0), like its siblings (sibling-3)');
  const pj = await E(() => {
    const out = {}; __solo(); game.monsters.length = 0; game.projectiles.length = 0;
    const shooter = __mk('slime', { uid: 9401 });
    out.keys = ['_sgL0', '_swingType', '_sgM', '_sgF', '_sgBoss', '_lxSrcUid'].every((k) => _COOP_PJ_XF.includes(k));
    out.pinned = _COOP_PJ_XF.slice(0, 4).join() === ['_defPierce', '_ignoreDef', '_heavyFloorPct', '_srcType'].join();
    game.projectiles.push({ x: 300, y: 300, vx: 1.5, vy: 0, w: 120, h: 60, life: 14, damage: 50, owner: 'enemy', skill: 'swing', color: '#fa5', _sgL0: 14, _swingType: 'slime', _sgM: { dx: 5, dy: 6, w: 40, h: 40 }, _sgF: -1, _sgBoss: true, _lxSrcUid: 9401 });
    __wire(); const mon = game.monsters.find((x) => x._coopMirror && x.uid === 9401);   // (the host's frame also carried the shooter: the guest holds its mirror now)
    __role('host'); const list = _coopProjList(true); __role('guest'); game.projectiles.length = 0;
    _coopApplyProjectiles({ id: 5, map: game.currentMap, list });
    const p = game.projectiles.find((q) => q._coopMirror); out.got = p ? { l0: p._sgL0, t: p._swingType, f: p._sgF, b: p._sgBoss, m: p._sgM && p._sgM.dx, u: p._lxSrcUid } : null;
    out.parry = !!(p && mon && _lxParrySource(p) === mon);
    __solo(); return out;
  });
  check(pj.keys && pj.pinned && pj.got && pj.got.l0 === 14 && pj.got.t === 'slime' && pj.got.f === -1 && pj.got.b === true && pj.got.m === 5 && pj.got.u === 9401, 'a guest\'s copy of a monster swing keeps _sgL0 / _swingType / _sgM / _sgF / _sgBoss / _lxSrcUid (sibling-4)', J(pj));
  check(pj.parry, 'and a guest\'s parry finds the monster that swung (sibling-4)');
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 4)));
} catch (e) { check(false, 'HARNESS ERROR', String(e && e.stack || e).slice(0, 600)); }
finally { await browser.close(); try { server.kill(); } catch (e) {} }
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
