// Summons keep acting while the player is DOWNED in co-op (v0.30.x coop-downed-summons).
//   node scripts/coop_downed_summons_test.mjs      (MOJI_GAME_FILE=<build.html> to test a private build; PORT=<port>; CD_VERBOSE=1 prints every window)
// updatePlayer's co-op downed gate returned before the summon ticks, so War Machine turrets, Mirror Shadow clones, the
// Wild Bond wolf and the Soul Ward orbs stood still (timers stopped) for the whole down. The co-op context is simulated
// locally, no relay: a stub socket (net.connected, readyState 1, net.myId) and one live partner standing on the map, so
// the player goes down exactly the way a lethal hit does it - hp 0 through _tryCheatDeathRevive() into _coopTryDowned() -
// as a REVIVABLE co-op down; the partner's finished channel is delivered as the relay's 'revive' message
// (_coopApplyRevive). Per summon: a window free (control), a window downed, a window after the revive. In each it must
// attack (and move, for the movers), and its lifetime must fall by exactly one frame's dt on every updatePlayer call
// (never 0 = frozen, never 2 = double tick). The player's own held move / jump / attack keys do nothing while downed and
// work again after the revive.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11510';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${(ok && !process.env.CD_VERBOSE) ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const TYPES = { js: 'text/javascript', mjs: 'text/javascript', json: 'application/json', css: 'text/css', png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', mp4: 'video/mp4', woff2: 'font/woff2' };
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  // files missing from the (stale) working copy come from origin, like the fonts in keybinds_test
  await p.route((u) => u.hostname === 'localhost' && u.port === String(PORT) && !/[.]html$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (!rel || existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: TYPES[rel.split('.').pop().toLowerCase()] || 'application/octet-stream', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] }) }); } catch (e) { r.continue(); }
  });
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof updatePlayer === 'function' && typeof spawnMonster === 'function' && typeof hitMonster === 'function'
    && typeof _coopTryDowned === 'function' && typeof _coopApplyRevive === 'function' && typeof _tryCheatDeathRevive === 'function' && typeof SKILL_FNS === 'object', null, { timeout: 150000 });
  const setup = await p.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; window._prologuePending = false; player.cls = 'archer'; player.level = 100; player._tutorialSeen = true;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    loadMap('mushroom'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
    player.invulnerable = 999999; player._god = false; game.monsters.length = 0;
    const g = (game.mapData.platforms || []).find((q) => q.type === 'ground'); const FEET = g ? g.y : 480;
    const S = window.__cd = { FEET, PX: 600, cur: null, state: 'free', win: null, seen: new WeakSet(), sent: [] };
    // the co-op context, simulated locally: a stub socket that records what we send, and one live partner (id 2, so we stay host)
    net.ws = { readyState: 1, send: (m) => { try { S.sent.push(JSON.parse(m)); } catch (e) {} if (S.sent.length > 400) S.sent.splice(0, 200); }, close() {} };
    net.connected = true; net.myId = 1; net.isHost = true;
    net.peers = { 2: { id: 2, name: 'Pal', cls: 'warrior', level: 100, map: game.currentMap, x: S.PX, y: FEET - 60, vx: 0, vy: 0, facing: 1, hp: 500, maxHp: 500, _last: performance.now() } };
    const _hm = hitMonster;
    window.hitMonster = function (m, dmg, crit, tag) { if (m && m.__cd && S.win) S.win.tags[tag] = (S.win.tags[tag] || 0) + 1; return _hm.apply(this, arguments); };
    const _cs = castSkill; window.castSkill = function () { if (S.win) S.win.casts++; return _cs.apply(this, arguments); };
    // the target stays exactly where the test puts it (after the monster step: no AI walk, knockback or gravity)
    const _um = updateMonsters; window.updateMonsters = function () { const r = _um.apply(this, arguments); for (const m of game.monsters) { const q = m.__cdPos; if (!q) continue; m.x = q.x; m.y = q.y; m.vx = 0; m.vy = 0; m.onGround = true; m.currentHp = 1e9; } return r; };
    // every updatePlayer call: keep the partner live beside the body (and a down from bleeding out: the 30 s window is
    // wall-clock and this machine is slow), sample the summon's clock + position around the call, count its shots
    const _up = updatePlayer;
    window.updatePlayer = function (dt) {
      const pal = net.peers[2]; if (pal) { pal._last = performance.now(); pal.map = game.currentMap; pal.x = player.x; pal.y = player.y; }
      if (player._downed) player._downedUntil = performance.now() + 30000;
      const T = S.cur, W = S.win;
      if (!T || !W) return _up.apply(this, arguments);
      if (T.keys) for (const k of T.keys) game.keys[k] = true;
      const l0 = T.life(), q0 = T.pos ? T.pos() : null, px0 = player.x, dn = !!player._downed;
      const r = _up.apply(this, arguments);
      const l1 = T.life(), q1 = T.pos ? T.pos() : null;
      if (l0 != null && l1 != null) W.deltas.push(Math.round((l0 - l1) * 1000) / 1000); else W.lost++;
      if (q0 && q1 && q0.o === q1.o) W.move += Math.hypot(q1.x - q0.x, q1.y - q0.y);
      for (const pr of game.projectiles) if (!S.seen.has(pr)) { S.seen.add(pr); if (T.proj && T.proj(pr)) W.shots++; }
      W.dxP += player.x - px0; W.minVy = Math.min(W.minVy, player.vy); W.frames++; W.dt = dt; if (dn !== (S.state === 'downed')) W.wrongState++;
      return r;
    };
    const tgt = spawnMonster(1800, FEET - 300, 'mushroom', false);
    if (tgt) { tgt.__cd = true; tgt.isElite = false; tgt.isMiniBoss = false; }
    // a fresh player of the given class at PX on the floor, every summon cleared, the target d px ahead (centre to centre)
    S.reset = (cls, d) => {
      player.cls = cls; player.job = null; player.master = null; player.level = 100; player.hp = player.maxHp; player.mp = 1e6;
      player.skillRanks = Object.assign(player.skillRanks || {}, { ballista_ult: 1, shadowlord_clones: 1, wildBond: 1, soulSiphon: 1 });
      player.x = S.PX; player.y = FEET - player.h; player.vx = 0; player.vy = 0; player.onGround = true; player.facing = 1;
      player.invulnerable = 999999; player.hitStun = 0; player.stunTimer = 0; player.frozenTimer = 0; game.keys = {};
      player._ballistaTurrets = null; player._clones = null; player._shade = null; player._aegis = null; player._necromancerOrbs = null; player._hexOrbs = null;
      player.pack = []; player.pet = null; player.ultPet = null; player._ballistaChannel = null;
      const t = game.monsters.find((m) => m.__cd);
      if (t) { t.__cdPos = { x: S.PX + player.w / 2 + d - t.w / 2, y: FEET - t.h }; t.x = t.__cdPos.x; t.y = t.__cdPos.y; }
      return t;
    };
    const first = (a) => (a && a.length) ? a[0] : null;
    S.types = {
      turret: { cls: 'archer', d: 300, make: () => SKILL_FNS.ballista_ult(), life: () => first(player._ballistaTurrets)?.life ?? null,
        proj: (pr) => pr.rs === 'ballista_ult', ready: () => { const t = first(player._ballistaTurrets); if (t) { t.life = t.maxLife; t.fireCd = 0; } } },
      clones: { cls: 'rogue', d: 320,   // the Mirror Shadow formation, exactly as the cast plants it (the cast's own end-of-life nova timer is left out)
        make: () => { const px = player.x + player.w / 2, py = player.y + player.h / 2; player._clones = [[-320, 50], [0, -60], [320, 50]].map(([ox, oy], i) => ({ life: 11000, maxLife: 11000, anchorX: px + ox, anchorY: py + oy, facing: 1, attackTimer: 140 + i * 80, swingProg: 0, phase: i, bobPhase: i * 1.7, lastX: px + ox, lastY: py + oy })); },
        life: () => first(player._clones)?.life ?? null, tag: 'shadow', ready: () => { for (const c of player._clones || []) { c.life = c.maxLife; c.attackTimer = 0; } } },
      pet: { cls: 'archer', d: 300, make: () => SKILL_FNS.wildBond(), life: () => player.pet ? player.pet.life : null, tag: 'pet', mover: true,
        pos: () => player.pet ? { o: player.pet, x: player.pet.x, y: player.pet.y } : null,
        ready: () => { const t = game.monsters.find((m) => m.__cd), w = player.pet; if (w) { w.life = w.maxLife; w.cdAtk = 0; w.x = t.x - 220; w.vx = 0; } } },
      soulward: { cls: 'mage', d: 220, tag: 'necromancerorb', mover: true,   // the Soul Ward, exactly as Soul Siphon plants it (two orbs, 12 s)
        make: () => { player._necromancerOrbs = { life: 12000, maxLife: 12000, orbs: [] }; },
        life: () => player._necromancerOrbs ? player._necromancerOrbs.life : null,
        pos: () => { const o = first(player._necromancerOrbs && player._necromancerOrbs.orbs); return (o && o.x != null) ? { o, x: o.x, y: o.y } : null; },
        ready: () => { const w = player._necromancerOrbs; if (w) { w.life = w.maxLife; w.orbs = [0, 1].map((i) => ({ baseAng: i * Math.PI, phase: i * Math.PI, hitCd: 0 })); } } },
      hands: { cls: 'rogue', d: 900, make: () => {}, life: () => null, keys: [ACTION_KEY_DEFAULT.moveRight, ACTION_KEY_DEFAULT.jump, Object.keys(KEY_TO_SLOT_DEFAULT).find((k) => KEY_TO_SLOT_DEFAULT[k] === 'd')] },
    };
    game.paused = false; try { closeAllModals(); } catch (e) {}
    return { FEET, target: tgt ? [Math.round(tgt.w), Math.round(tgt.h)] : null, coop: _coopActive(), peerAlive: _coopPeerAliveOnMyMap() };
  });
  console.log('setup', JSON.stringify(setup));
  const start = (type) => p.evaluate((type) => { const T = __cd.types[type]; __cd.reset(T.cls, T.d); T.make(); return T.life() != null || type === 'hands'; }, type);
  // go down the way a lethal hit does: hp 0 into the cheat-death chain, whose last link is the co-op down. The other links
  // (Second Wind, Miracle Evasion, Phoenix Heart) are spent, and this map's one team revive is made fresh for each down.
  const down = () => p.evaluate(() => {
    const S = __cd; S.sent.length = 0;
    player._coopReviveMapAt = {}; player._noDownUntil = 0; player._miracleUsedThisMap = true; player._phoenixUsedThisMap = true;
    if (player.tree) player.tree.secondWindReady = false;
    player.invulnerable = 0; player.hp = 0;
    const ok = _tryCheatDeathRevive();
    if (!ok || !player._downed) { player.hp = player.maxHp; player.invulnerable = 999999; }   // a failed down must not die in the main loop
    const m = S.sent.find((q) => q.t === 'down');
    return { ok, downed: !!player._downed, revivable: !!player._downRevivable, hp: player.hp, sentDown: m ? { rev: m.rev, map: m.map === game.currentMap } : null };
  });
  // the partner's finished channel, as the relay delivers it (sender id stamped by the relay)
  const revive = () => p.evaluate(() => {
    const S = __cd; S.sent.length = 0;
    const banner = !!document.getElementById('coop-downed-banner');
    const pal = net.peers[2]; pal.x = player.x; pal.y = player.y;
    _coopApplyRevive({ t: 'revive', id: 2, map: game.currentMap });
    const m = S.sent.find((q) => q.t === 'up');
    return { bannerWhileDown: banner, downed: !!player._downed, hp: player.hp, half: Math.floor(getMaxHp() * 0.5), up: m ? m.ok : null, bannerAfter: !!document.getElementById('coop-downed-banner') };
  });
  // one window: the summon made ready (full life, cooldown up, movers set back), then `frames` updatePlayer calls
  const run = (type, state, frames) => p.evaluate(async ([type, state, frames]) => {
    const S = __cd, T = S.types[type];
    player.hitStun = 0; player.stunTimer = 0; player.frozenTimer = 0; player.vx = 0; player.vy = 0; player.invulnerable = 999999; game.paused = false;
    if (T.ready) T.ready();
    for (const pr of game.projectiles) S.seen.add(pr);   // a shot fired between windows is not this window's
    S.win = { state, frames: 0, deltas: [], lost: 0, move: 0, shots: 0, tags: {}, casts: 0, dxP: 0, minVy: 0, dt: 0, wrongState: 0 };
    S.state = state; S.cur = T;
    const w0 = performance.now();
    while (S.win.frames < frames && performance.now() - w0 < 120000) await new Promise((s) => setTimeout(s, 30));
    S.cur = null; S.state = 'free'; game.keys = {};
    const W = S.win; S.win = null;
    const dts = {}; for (const d of W.deltas) dts[d] = (dts[d] || 0) + 1;
    return { state, frames: W.frames, dtPerCall: dts, lost: W.lost, move: Math.round(W.move), shots: W.shots, hits: T.tag ? (W.tags[T.tag] || 0) : 0, casts: W.casts, dxP: Math.round(W.dxP), minVy: Math.round(W.minVy * 10) / 10, dt: W.dt, wrongState: W.wrongState };
  }, [type, state, frames]);

  const SUMMONS = [
    ['turret', 'War Machine turret (archer)', (r) => r.shots >= 1, 'fires'],
    ['clones', 'Mirror Shadow clones (rogue)', (r) => r.hits >= 1, 'strike'],
    ['pet', 'Wild Bond wolf pet (archer)', (r) => r.hits >= 1 && r.move >= 40, 'walks and bites'],
    ['soulward', 'Soul Ward orbs (mage)', (r) => r.hits >= 1 && r.move >= 40, 'fly and strike'],
  ];
  const FR = 100, downs = [], revives = [];
  const downOk = (d) => d.ok && d.downed && d.revivable && d.hp === 1 && d.sentDown && d.sentDown.rev === 1 && d.sentDown.map;
  for (const [type, name, acts, verb] of SUMMONS) {
    const made = await start(type);
    if (!made) { check(false, `${name} was summoned`, { type }); continue; }
    const free = await run(type, 'free', FR);
    const d = await down(); downs.push(d);
    const dn = downOk(d) ? await run(type, 'downed', FR) : { state: 'downed', skipped: 'the player did not go down', down: d };
    const rv = await revive(); revives.push(rv);
    const up = await run(type, 'revived', FR);
    check(acts(free), `${name} ${verb} while the player is up (control)`, free);
    check(!dn.skipped && acts(dn), `${name} ${verb} while the player is DOWNED`, dn);
    check(acts(up), `${name} ${verb} again after a partner revives the player`, up);
    // exactly once per frame: its clock falls by exactly dt on every updatePlayer call, up, downed and revived alike
    const rs = [free, dn, up];
    const once = rs.every((r) => !r.skipped && r.frames >= FR && r.lost === 0 && r.wrongState === 0 && Object.keys(r.dtPerCall).length === 1 && Math.abs(+Object.keys(r.dtPerCall)[0] - r.dt) < 0.01);
    check(once, `${name} ticks exactly once per frame up, downed and after the revive (its clock falls by one dt per frame)`, rs.map((r) => ({ state: r.state, frames: r.frames, dtPerCall: r.dtPerCall, lost: r.lost, wrongState: r.wrongState, skipped: r.skipped })));
  }
  // the player's own input: held move-right + jump + basic attack (rogue) work when up, do nothing while downed, work after the revive
  await start('hands');
  const hf = await run('hands', 'free', 60);
  const hd0 = await down(); downs.push(hd0);
  const hd = downOk(hd0) ? await run('hands', 'downed', 60) : { skipped: 'the player did not go down', down: hd0 };
  const hr0 = await revive(); revives.push(hr0);
  const hr = await run('hands', 'revived', 60);
  check(downs.length === SUMMONS.length + 1 && downs.every(downOk), 'the player goes down the way a lethal hit does: a revivable co-op down, held at 1 HP, with the partner told (rev 1)', downs);
  check(revives.every((r) => r.bannerWhileDown && !r.downed && r.hp === r.half && r.up === 1 && !r.bannerAfter), 'a partner\'s revive stands the player back up: half HP, the DOWNED banner gone, the partner told', revives);
  check(hf.dxP >= 40 && hf.casts >= 1, 'control: held move / jump / attack keys walk and attack while the player is up', hf);
  check(!hd.skipped && hd.wrongState === 0 && Math.abs(hd.dxP) < 6 && hd.casts === 0 && hd.minVy > -1, 'the player still cannot move, jump or attack while downed', hd);
  check(hr.wrongState === 0 && hr.dxP >= 40 && hr.casts >= 1, 'after the revive the player moves, jumps and attacks again', hr);
  check(errs.length === 0, 'no page errors', errs.slice(0, 5));
} finally {
  await browser.close().catch(() => {}); srv.kill();
}
console.log(bad ? `${bad} of ${total} FAILED` : `all ${total} passed`);
process.exit(bad ? 1 : 0);
