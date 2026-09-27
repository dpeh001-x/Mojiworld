// Summons keep acting while the player is stunned or frozen (v0.30.x summon-cc).
//   node scripts/summon_cc_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build; PORT=<port>; SC_VERBOSE=1 prints every window)
// updatePlayer's three crowd-control early returns (hit-stun, the freeze / stun gate, the shackle QTE) returned before the
// summon code, so War Machine turrets, Mirror Shadow clones, pack wolves, the Skyhunter eagle and the Soul Ward orbs all
// stood still for as long as the player was staggered, stunned or frozen. Five summons across three classes, each run for
// a window of frames free, staggered (hitStun), stunned (stunTimer) and frozen (frozenTimer). Per window: the summon's
// attacks (hits it lands, or shots it fires), how far it moved, and its lifetime clock sampled around EVERY updatePlayer
// call - it must fall by exactly one frame's dt per call in every state (never 0 = frozen, never 2 = double tick). The
// player's own input stays dead while CC'd (held move / jump / attack keys do nothing) and works when free.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11420';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${(ok && !process.env.SC_VERBOSE) ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
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
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof updatePlayer === 'function' && typeof spawnMonster === 'function' && typeof hitMonster === 'function' && typeof SKILL_FNS === 'object', null, { timeout: 150000 });
  const setup = await p.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'archer'; player.level = 100;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    loadMap('mushroom'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
    player.invulnerable = 999999; player._god = false; game.monsters.length = 0;
    const g = (game.mapData.platforms || []).find((q) => q.type === 'ground'); const FEET = g ? g.y : 480;
    const S = window.__sc = { FEET, PX: 600, cur: null, state: 'free', win: null, seen: new WeakSet(), casts: 0, types: {} };
    // hits on the test target, by tag
    const _hm = hitMonster;
    window.hitMonster = function (m, dmg, crit, tag) { if (m && m.__sc && S.win) S.win.tags[tag] = (S.win.tags[tag] || 0) + 1; return _hm.apply(this, arguments); };
    const _cs = castSkill; window.castSkill = function () { if (S.win) S.win.casts++; return _cs.apply(this, arguments); };
    // the target stays exactly where the test puts it (after the monster step: no AI walk, knockback or gravity)
    const _um = updateMonsters; window.updateMonsters = function () { const r = _um.apply(this, arguments); for (const m of game.monsters) { const q = m.__scPos; if (!q) continue; m.x = q.x; m.y = q.y; m.vx = 0; m.vy = 0; m.onGround = true; m.currentHp = 1e9; } return r; };
    // every updatePlayer call: hold the CC state, sample the summon's clock + position around the call, count its shots
    const _up = updatePlayer;
    window.updatePlayer = function (dt) {
      const T = S.cur, W = S.win;
      if (!T || !W) return _up.apply(this, arguments);
      if (S.state === 'stagger') player.hitStun = 5000; else if (S.state === 'stun') player.stunTimer = 5000; else if (S.state === 'freeze') player.frozenTimer = 5000;
      if (T.keys) for (const k of T.keys) game.keys[k] = true;
      const l0 = T.life(), q0 = T.pos ? T.pos() : null, px0 = player.x;
      const r = _up.apply(this, arguments);
      const l1 = T.life(), q1 = T.pos ? T.pos() : null;
      if (l0 != null && l1 != null) W.deltas.push(Math.round((l0 - l1) * 1000) / 1000); else W.lost++;
      if (q0 && q1 && q0.o === q1.o) W.move += Math.hypot(q1.x - q0.x, q1.y - q0.y);
      for (const pr of game.projectiles) if (!S.seen.has(pr)) { S.seen.add(pr); if (T.proj && T.proj(pr)) W.shots++; }
      W.dxP += player.x - px0; W.minVy = Math.min(W.minVy, player.vy); W.frames++; W.dt = dt;
      return r;
    };
    const tgt = spawnMonster(1800, FEET - 300, 'mushroom', false);
    if (tgt) { tgt.__sc = true; tgt.isElite = false; tgt.isMiniBoss = false; }
    // a fresh player of the given class at PX on the floor, every summon cleared, the target d px ahead (centre to centre)
    S.reset = (cls, d) => {
      player.cls = cls; player.job = null; player.master = null; player.level = 100; player.hp = player.maxHp; player.mp = 1e6;
      // rank 1: no rank-5/10 extras (the pack's delayed second bite could land in the NEXT window and be miscounted)
      player.skillRanks = Object.assign(player.skillRanks || {}, { ballista_ult: 1, beastmaster_pack: 1, skyhunter_ult: 1, shadowlord_clones: 1, soulSiphon: 1 });
      player.x = S.PX; player.y = FEET - player.h; player.vx = 0; player.vy = 0; player.onGround = true; player.facing = 1;
      player.invulnerable = 999999; player.hitStun = 0; player.stunTimer = 0; player.frozenTimer = 0; game.keys = {};
      player._ballistaTurrets = null; player._clones = null; player._shade = null; player._aegis = null; player._necromancerOrbs = null; player._hexOrbs = null;
      player.pack = []; player.pet = null; player.ultPet = null; player._ballistaChannel = null;
      const t = game.monsters.find((m) => m.__sc);
      if (t) { t.__scPos = { x: S.PX + player.w / 2 + d - t.w / 2, y: FEET - t.h }; t.x = t.__scPos.x; t.y = t.__scPos.y; }
      return t;
    };
    const first = (a) => (a && a.length) ? a[0] : null;
    S.types = {
      turret: { cls: 'archer', d: 300, make: () => SKILL_FNS.ballista_ult(), life: () => first(player._ballistaTurrets)?.life ?? null,
        proj: (pr) => pr.rs === 'ballista_ult', ready: () => { const t = first(player._ballistaTurrets); if (t) { t.life = t.maxLife; t.fireCd = 0; } } },
      clones: { cls: 'rogue', d: 320,   // the Mirror Shadow formation, exactly as the cast plants it (the cast's own end-of-life nova timer is left out)
        make: () => { const px = player.x + player.w / 2, py = player.y + player.h / 2; player._clones = [[-320, 50], [0, -60], [320, 50]].map(([ox, oy], i) => ({ life: 11000, maxLife: 11000, anchorX: px + ox, anchorY: py + oy, facing: 1, attackTimer: 140 + i * 80, swingProg: 0, phase: i, bobPhase: i * 1.7, lastX: px + ox, lastY: py + oy })); },
        life: () => first(player._clones)?.life ?? null, tag: 'shadow', ready: () => { for (const c of player._clones || []) { c.life = c.maxLife; c.attackTimer = 0; } } },
      pack: { cls: 'archer', d: 300, make: () => SKILL_FNS.beastmaster_pack(), life: () => first(player.pack)?.life ?? null, tag: 'pack', mover: true,
        pos: () => { const w = first(player.pack); return w ? { o: w, x: w.x, y: w.y } : null; },
        ready: () => { const t = game.monsters.find((m) => m.__sc); for (const w of player.pack || []) { w.life = w.maxLife; w.cdAtk = 0; w.x = t.x - 220; w.vx = 0; } } },
      eagle: { cls: 'archer', d: 300, make: () => SKILL_FNS.skyhunter_ult(), life: () => player.ultPet ? player.ultPet.life : null, proj: (pr) => pr.rs === 'skyhunter_ult', mover: true,
        pos: () => player.ultPet ? { o: player.ultPet, x: player.ultPet.x, y: player.ultPet.y } : null,
        ready: () => { const e = player.ultPet; if (e) { e.life = e.maxLife; e.fireCd = 0; e.x = player.x + 260; e.y = player.y - 220; } } },
      soulward: { cls: 'mage', d: 220, tag: 'necromancerorb', mover: true,   // the Soul Ward, exactly as Soul Siphon plants it (two orbs, 12 s)
        make: () => { player._necromancerOrbs = { life: 12000, maxLife: 12000, orbs: [] }; },
        life: () => player._necromancerOrbs ? player._necromancerOrbs.life : null,
        pos: () => { const o = first(player._necromancerOrbs && player._necromancerOrbs.orbs); return (o && o.x != null) ? { o, x: o.x, y: o.y } : null; },
        ready: () => { const w = player._necromancerOrbs; if (w) { w.life = w.maxLife; w.orbs = [0, 1].map((i) => ({ baseAng: i * Math.PI, phase: i * Math.PI, hitCd: 0 })); } } },
      hands: { cls: 'rogue', d: 900, make: () => {}, life: () => null, keys: [ACTION_KEY_DEFAULT.moveRight, ACTION_KEY_DEFAULT.jump, Object.keys(KEY_TO_SLOT_DEFAULT).find((k) => KEY_TO_SLOT_DEFAULT[k] === 'd')] },
    };
    game.paused = false; try { closeAllModals(); } catch (e) {}
    return { FEET, target: tgt ? [Math.round(tgt.w), Math.round(tgt.h)] : null, dt: typeof _LX_SIM_STEP_MS !== 'undefined' ? _LX_SIM_STEP_MS : null };
  });
  console.log('setup', JSON.stringify(setup));
  const start = (type) => p.evaluate((type) => { const T = __sc.types[type]; __sc.reset(T.cls, T.d); T.make(); return T.life() != null || type === 'hands'; }, type);
  // one window: the summon made ready (full life, cooldown up, movers set back), then `frames` updatePlayer calls in `state`
  const run = (type, state, frames) => p.evaluate(async ([type, state, frames]) => {
    const S = __sc, T = S.types[type];
    player.hitStun = 0; player.stunTimer = 0; player.frozenTimer = 0; player.vx = 0; player.vy = 0; player.invulnerable = 999999; game.paused = false;
    if (T.ready) T.ready();
    for (const pr of game.projectiles) S.seen.add(pr);   // a shot fired between windows (the player free) is not this window's
    S.win = { state, frames: 0, deltas: [], lost: 0, move: 0, shots: 0, tags: {}, casts: 0, dxP: 0, minVy: 0, dt: 0 };
    S.state = state; S.cur = T;
    const w0 = performance.now();
    while (S.win.frames < frames && performance.now() - w0 < 120000) await new Promise((s) => setTimeout(s, 30));
    S.cur = null; S.state = 'free'; player.hitStun = 0; player.stunTimer = 0; player.frozenTimer = 0; game.keys = {};
    const W = S.win; S.win = null;
    const dts = {}; for (const d of W.deltas) dts[d] = (dts[d] || 0) + 1;
    return { state, frames: W.frames, dtPerCall: dts, lost: W.lost, move: Math.round(W.move), shots: W.shots, hits: T.tag ? (W.tags[T.tag] || 0) : 0, casts: W.casts, dxP: Math.round(W.dxP), minVy: Math.round(W.minVy * 10) / 10, dt: W.dt };
  }, [type, state, frames]);

  const CC = [['stagger', 'staggered (hit-stun)'], ['stun', 'stunned'], ['freeze', 'frozen']];
  const SUMMONS = [
    ['turret', 'War Machine turret (archer)', (r) => r.shots >= 1, 'fires'],
    ['clones', 'Mirror Shadow clones (rogue)', (r) => r.hits >= 1, 'strike'],
    ['pack', 'Beastmaster pack wolf (archer)', (r) => r.hits >= 1 && r.move >= 40, 'walks and bites'],
    ['eagle', 'Skyhunter eagle (archer)', (r) => r.shots >= 1 && r.move >= 40, 'flies and fires'],
    ['soulward', 'Soul Ward orbs (mage)', (r) => r.hits >= 1 && r.move >= 40, 'fly and strike'],
  ];
  const FR = 100;
  for (const [type, name, acts, verb] of SUMMONS) {
    const made = await start(type);
    if (!made) { check(false, `${name} was summoned`, { type }); continue; }
    const rs = [];
    for (const st of ['free', 'stagger', 'stun', 'freeze']) rs.push(await run(type, st, FR));
    const free = rs[0];
    check(acts(free), `${name} ${verb} while the player is free (control)`, free);
    for (let i = 0; i < CC.length; i++) check(acts(rs[i + 1]), `${name} ${verb} while the player is ${CC[i][1]}`, rs[i + 1]);
    // exactly once per frame: its clock falls by exactly dt on every updatePlayer call, free and CC'd alike
    const once = rs.every((r) => r.frames >= FR && r.lost === 0 && Object.keys(r.dtPerCall).length === 1 && Math.abs(+Object.keys(r.dtPerCall)[0] - r.dt) < 0.01);
    check(once, `${name} ticks exactly once per frame, free and under all three CC states (its clock falls by one dt per frame)`, rs.map((r) => ({ state: r.state, frames: r.frames, dtPerCall: r.dtPerCall, lost: r.lost })));
  }
  // the player's own input: held move-right + jump + basic attack (rogue) work when free and do nothing while CC'd
  await start('hands');
  const hf = await run('hands', 'free', 60);
  check(hf.dxP >= 40 && hf.casts >= 1, 'control: held move / jump / attack keys walk and attack when the player is free', hf);
  for (const [st, nm] of CC) {
    const h = await run('hands', st, 60);
    check(Math.abs(h.dxP) < 6 && h.casts === 0 && h.minVy > -1, `the player still cannot move, jump or attack while ${nm}`, h);
  }
  check(errs.length === 0, 'no page errors', errs.slice(0, 5));
} finally {
  await browser.close().catch(() => {}); srv.kill();
}
console.log(bad ? `${bad} of ${total} FAILED` : `all ${total} passed`);
process.exit(bad ? 1 : 0);
