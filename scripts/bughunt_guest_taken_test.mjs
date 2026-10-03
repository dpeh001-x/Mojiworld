// BUG HUNT 2026-10-02, cluster guest-taken: A CO-OP GUEST'S TOUCH IS THE HOST'S TOUCH.
//   sibling-1  guest touch damage used atk x 0.28 (1.0 for a boss): the same median mob hit a guest 4-8x softer than the host, and a
//              generic boss hit it uncapped; now both paths read _lxContactBase and the boss band / floors
//   parityA-5  the normal-mob contact floor (25% of the anchor, after the DR stack) exists on the guest
//   parityA-1  a guest's touch applies the mob's contact status (burn / poison / slow / electrocute / freeze)
//   parityA-2  ... and the landing: i-frame mark, cancelled actions, the ordinary-mob shove, the combo reset, hit-stop (+ the
//              haz / boss hit i-frame mark)
//   combat-3   a guest's parry window parries a touch; Thorns / Guardian reflect on a touch
//   parityA-3 = parityB-6  a mirror's burn / poison ticks, forwards its damage to the host, and expires
// One page, no relay: a guest is simulated with `net.isHost = false; net.hostId = 1` and a stubbed _coopFollowingHost, the host is
// the same page with the stub off. Host numbers are measured through the REAL updateMonsters contact block.
//   [SERVE_ROOT=<dir>] [PORT=n] node scripts/bughunt_guest_taken_test.mjs [candidate.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '13971';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d !== undefined ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 200)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof updateMonsters === 'function' && typeof spawnMonster === 'function' && !!document.getElementById('lo-menu'), null, { timeout: 180000 });
  await page.waitForTimeout(3000);
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootHold.release('menu'); } catch (e) {}
    player.cls = 'warrior'; player.job = null; player.master = null; player.level = 40; player._tutorialSeen = true; player._gravitosCineSeen = true;
    try { player._storyBeatsSeen = new Proxy({}, { get: () => true, set: () => true }); } catch (e) {}
    player.tree = player.tree || {}; player.tree.kbReduce = 0; player.tree.stunImmune = false; player.tree.manaShield = false;
    loadMap('forest', 300); await sleep(3000);
    for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
    game.paused = true;   // every step below is the test's own; `step` un-pauses for one synchronous call (a paused player takes no damage)
  });
  // ---- harness, installed once in the page ----
  await page.evaluate(() => {
    const T = window.__T = { sent: [], calls: [] };
    T.step = (fn) => { game.paused = false; try { return fn(); } finally { game.paused = true; } };
    window._coopSendDamage = (m, d, c, k) => { T.sent.push({ u: m && m.uid, d, k }); };   // the guest's forward, recorded (never sent)
    T.rand = Math.random; T.evasion = window.getEvasion; T.maxHp0 = player.maxHp;   // getMaxHp() is derived FROM player.maxHp: never assign it back (compounds)
    T.follow = (on) => { window._coopFollowingHost = () => !!on; net.isHost = false; net.hostId = on ? 1 : null; };
    T.fresh = () => {
      game.monsters = []; game.projectiles.length = 0; T.sent.length = 0; game.damageNumbers.length = 0;
      player._god = false; player.maxHp = T.maxHp0; player.hp = getMaxHp(); player.invulnerable = 0; player.dodgeIframes = 0; player.blockTimer = 0; player.parryWindow = 0;
      player.hitStun = 0; player.burnTimer = 0; player._poisonTimer = 0; player._slowTimer = 0; player._electrocuteTimer = 0; player.frozenTimer = 0;
      player.attacking = false; player.attackTimer = 0; player.rushTimer = 0; player.dodgeTimer = 0; player.quickDashTimer = 0;
      player._hitIframeAt = null; player.vx = 0; player.vy = 0; player._aegis = false; player._guardianReflect = 0; player._holyReflectUntil = 0;
      player.mods = player.mods || {}; player.mods.thorns = 0; game.combo = 0; game.hitStop = 0; player._statusGraceUntil = {};
      window.getEvasion = () => 0; Math.random = () => 0.5;
    };
    // a monster of `type` at the player's feet, its level and ATK pinned (atk 'med' = the median ATK for that level)
    T.mob = (o) => {
      game.monsters = []; spawnMonster(500, 300, o.type, !!o.boss);
      const m = game.monsters[0]; if (!m) return null;
      m.level = o.level; m.atk = (o.atk === 'med') ? _medAtkAtLv(o.level) : (o.atk != null ? o.atk : m.atk); m.evasion = 0; m.uid = 9001;
      m._heavyArmed = false; m._heavyReadyAt = 1e12; m._stagger = 0; m._staggerCd = 1e12; m._dirOpenT = 0; m.aggroTarget = player;
      player.level = o.level; player.hp = getMaxHp(); T.hp0 = player.hp;
      const cx = (typeof W_PLAY === 'number' ? W_PLAY : 960);
      game.camera = game.camera || { x: 0, y: 0 }; game.camera.x = m.x + m.w / 2 - cx / 2; game.camera.y = Math.max(0, m.y + m.h / 2 - 280);
      player.x = m.x + m.w / 2 - player.w / 2; player.y = m.y + m.h - player.h;
      return m;
    };
    // the number a contact landing shows (_lxContactLanding's red size-16 'taken' number): the loss the touch dealt
    T.num = () => { const n = game.damageNumbers.find((x) => x.taken && (x.color === '#ff4444' || x.color === '#ff6666') && /^[0-9]+$/.test(String(x.text))); return n ? +n.text : null; };
    T.onIt = (m) => { player.x = m.x + m.w / 2 - player.w / 2; player.y = m.y + m.h - player.h; };
    // the HOST's number: the real contact block of updateMonsters, stepped until the touch lands (a boss's AI may move first)
    T.host = (o) => {
      T.follow(false); T.fresh(); const m = T.mob(o); if (!m) return { err: 'spawn' };
      if (o.pre) o.pre(m);
      let f = 0; for (; f < 240 && T.num() == null; f++) T.step(() => { game.time++; player.invulnerable = 0; T.onIt(m); updateMonsters(16); });
      return { lost: T.num(), hpDrop: Math.round(T.hp0 - player.hp), frames: f, src: player._lastDamageSource, m };
    };
    // the GUEST's number: the same monster flagged as the host's mirror, one real tick of the follower branch
    T.guest = (o) => {
      T.follow(false); T.fresh(); const m = T.mob(o); if (!m) return { err: 'spawn' };
      T.follow(true); m._coopMirror = true; if (o.pre) o.pre(m);
      T.step(() => { game.time++; T.onIt(m); _coopFollowerContactTick(); });
      return { lost: T.num(), hpDrop: Math.round(T.hp0 - player.hp), src: player._lastDamageSource, m };
    };
    T.done = () => { T.follow(false); Math.random = T.rand; window.getEvasion = T.evasion; };
  });
  // ---- 1. sibling-1: the same touch, host vs guest ----
  const pick = await page.evaluate(() => {
    const plain = ['slime', 'mushroom', 'goblin', 'wolf', 'bat', 'imp', 'orc', 'skeleton', 'boar'].find((t) => monsterTypes[t] && !monsterTypes[t].boss && !CONTACT_STATUS_TABLE[t]);
    const plainAny = plain || Object.keys(monsterTypes).find((t) => !monsterTypes[t].boss && !CONTACT_STATUS_TABLE[t] && !monsterTypes[t].miniBoss && !/zodiac|tower|pq|octo/i.test(t));
    return { plain: plainAny, generic: ['king', 'mooma', 'kingKrook'].filter((t) => monsterTypes[t]) };
  });
  console.log('types ' + J(pick));
  const num = await page.evaluate((pick) => {
    const T = window.__T, out = {};
    const pair = (tag, o) => { const h = T.host(o), g = T.guest(o); out[tag] = { host: h.lost, guest: g.lost, hdrop: h.hpDrop, gdrop: g.hpDrop, hsrc: h.src, gsrc: g.src, herr: h.err, gerr: g.err }; };
    for (const lv of [20, 40, 60]) pair('med' + lv, { type: pick.plain, level: lv, atk: 'med' });
    pair('strong40', { type: pick.plain, level: 40, atk: _medAtkAtLv(40) * 2 });
    pair('king40', { type: 'king', level: 40, boss: true });
    pair('gravitos', { type: 'gravitos', level: 80, boss: true });
    pair('scorpio', { type: 'zodiac_scorpio', level: 70, boss: true });
    pair('conductor', { type: 'pqConductor', level: 40, boss: true });
    pair('krook', { type: 'kingKrook', level: 40, boss: true });
    T.done(); return out;
  }, pick);
  console.log('NUMBERS ' + J(num));
  for (const [k, v] of Object.entries(num)) check(!v.herr && !v.gerr && v.host > 0 && v.host === v.guest && v.guest === v.gdrop, `${k}: the guest's touch lands the host's number`, `host ${v.host} guest ${v.guest} (hp lost ${v.gdrop}) src ${v.hsrc}/${v.gsrc}`);
  // ---- 2. parityA-5: the normal-mob contact floor (25% of the anchor, after the DR stack; an active block goes below it) ----
  const flo = await page.evaluate((pick) => {
    const T = window.__T, out = {}, realAbs = window._defAbsorbMul;
    window._defAbsorbMul = () => 0.0005;   // a DEF stack that absorbs everything: only the floor is left
    const o = { type: pick.plain, level: 40, atk: 'med' };
    const h = T.host(o), g = T.guest(o), gb = T.guest({ ...o, pre: (m) => { player.blockTimer = 200; } }), hb = T.host({ ...o, pre: (m) => { player.blockTimer = 200; } });
    window._defAbsorbMul = realAbs; T.done();
    return { host: h.lost, guest: g.lost, hostBlock: hb.lost, guestBlock: gb.lost };
  }, pick);
  console.log('FLOOR ' + J(flo));
  check(flo.host > 1 && flo.guest === flo.host, 'parityA-5: a stack that absorbs everything still takes the normal-mob floor, on the guest as on the host', J(flo));
  check(flo.guestBlock === flo.hostBlock && flo.guestBlock < flo.guest, 'parityA-5: an active block still goes below the floor, on both', J(flo));
  // ---- 3. parityA-1: the contact status of the mob that touched you ----
  const st = await page.evaluate(() => {
    const T = window.__T, out = {};
    const force = (m) => { Math.random = () => 0; };   // every proc rolls true
    const run = (tag, type, field) => { const r = T.guest({ type, level: 40, atk: 'med', pre: force }); out[tag] = { field: +player[field] || 0, lost: r.lost, err: r.err }; };
    run('burn', 'emberling', 'burnTimer'); run('slow', 'frostkin', '_slowTimer'); run('poison', 'scorpion', '_poisonTimer'); run('shock', 'voltipup', '_electrocuteTimer');
    T.done(); return out;
  });
  console.log('STATUS ' + J(st));
  for (const [k, v] of Object.entries(st)) check(!v.err && v.lost > 0 && v.field > 0, `parityA-1: a guest touched by a ${k} mob is ${k === 'shock' ? 'electrocuted' : k === 'burn' ? 'burning' : k === 'poison' ? 'poisoned' : 'slowed'}`, J(v));
  // ---- 4. parityA-2: the landing ----
  const lan = await page.evaluate((pick) => {
    const T = window.__T, out = {};
    const pre = (m) => { player.attacking = true; player.attackTimer = 100; player.rushTimer = 50; player.dodgeTimer = 30; player.quickDashTimer = 20; game.combo = 7; };
    const g = T.guest({ type: pick.plain, level: 40, atk: 'med', pre });
    out.touch = { lost: g.lost, mark: player._hitIframeAt === game.time, cancelled: !player.attacking && !player.attackTimer && !player.rushTimer && !player.dodgeTimer && !player.quickDashTimer,
      shove: player.vx > 0 && player.vy < 0, combo: game.combo, hitStop: game.hitStop >= 30, inv: player.invulnerable };
    // a host-fed hazard / boss hit: the HIT-granted mark must ride the i-frame, or the hero is drawn hidden for its first ~60 ms
    T.follow(true); T.fresh(); net.hostId = 1; game.time += 5;
    T.step(() => _coopApplyHazHit({ map: game.currentMap, id: 1, x: player.x + player.w / 2, r: 300, d: 40, sl: 'a meteor' }));
    out.haz = { hit: player.hp < player.maxHp || T.num() != null || player.invulnerable > 0, inv: player.invulnerable, mark: player._hitIframeAt === game.time };
    T.fresh(); game.time += 5;
    T.step(() => _coopApplyBossHit({ map: game.currentMap, id: 1, x: player.x + player.w / 2, y: player.y, r: 0, d: 40, sl: 'a boss attack' }));
    out.boss = { inv: player.invulnerable, mark: player._hitIframeAt === game.time };
    T.done(); return out;
  }, pick);
  console.log('LANDING ' + J(lan));
  check(lan.touch.lost > 0 && lan.touch.mark && lan.touch.inv === 1000, 'parityA-2: a guest touch stamps the hit-granted i-frame mark', J(lan.touch));
  check(lan.touch.cancelled, 'parityA-2: ... cancels an attack / dash / roll in progress', J(lan.touch));
  check(lan.touch.shove, 'parityA-2: ... shoves the player off an ordinary mob (3.0 x 0.4 sideways, -2.4 x 0.4 up for a warrior)', J(lan.touch));
  check(lan.touch.combo === 0 && lan.touch.hitStop, 'parityA-2: ... resets the combo and adds the 30 ms hit-stop', J(lan.touch));
  check(lan.haz.inv === 600 && lan.haz.mark && lan.boss.inv === 600 && lan.boss.mark, 'parityA-2: a host-fed hazhit and bosshit stamp the i-frame mark too', J([lan.haz, lan.boss]));
  // ---- 4b. a PAUSED guest is a ghost statue: its MP, combo and i-frames are not worked on by a touch (the world step unwinds only hp / statuses) ----
  const pz = await page.evaluate((pick) => {
    const T = window.__T;
    T.follow(false); T.fresh(); const m = T.mob({ type: pick.plain, level: 40, atk: 'med' }); T.follow(true); m._coopMirror = true;
    player.mp = 10; game.combo = 7; player.parryWindow = 300; const hp0 = player.hp; game.paused = true; game.time++; T.onIt(m);
    _coopFollowerContactTick();   // paused on purpose: no T.step
    const r = { hp: Math.round(hp0 - player.hp), mp: player.mp, combo: game.combo, parry: player.parryWindow, inv: player.invulnerable, mark: player._hitIframeAt, sent: T.sent.length };
    T.done(); return r;
  }, pick);
  check(pz.hp === 0 && pz.mp === 10 && pz.combo === 7 && pz.parry === 300 && pz.inv === 0 && pz.mark == null && pz.sent === 0, 'a paused guest is a ghost statue: a touch parries nothing, resets nothing, spends no MP', J(pz));
  // ---- 5. combat-3: parry, Thorns, Guardian, Holy Shield on a guest's touch ----
  const cb = await page.evaluate((pick) => {
    const T = window.__T, out = {};
    const o = { type: pick.plain, level: 40, atk: 'med' };
    const p = T.guest({ ...o, pre: () => { player.parryWindow = 300; } });
    out.parry = { lost: p.drop === undefined ? Math.round(T.hp0 - player.hp) : p.drop, stun: p.m.stunTimer | 0, inv: player.invulnerable, win: player.parryWindow };
    const th = T.guest({ ...o, pre: () => { player.mods.thorns = 0.5; } });
    out.thorns = { lost: th.lost, sent: T.sent.filter((x) => x.k === 'thorns' && x.d > 0).length }; player.mods.thorns = 0;
    const gu = T.guest({ ...o, pre: () => { player._guardianReflect = game.time + 600; player._guardianReflectPct = 50; } });
    out.guardian = { lost: gu.lost, sent: T.sent.filter((x) => x.k === 'thorns' && x.d > 0).length };
    const hs = T.guest({ ...o, pre: () => { player.invulnerable = 500; player._holyReflectUntil = game.time + 100; } });
    out.holy = { hpDrop: Math.round(T.hp0 - player.hp), sent: T.sent.filter((x) => x.k === 'thorns' && x.d > 0).length, bounceAt: hs.m._hsBounceAt | 0, now: game.time | 0 };
    T.done(); return out;
  }, pick);
  console.log('COMBAT ' + J(cb));
  check(cb.parry.lost === 0 && cb.parry.stun >= 900 && cb.parry.inv >= 350 && cb.parry.win === 0, 'combat-3: a perfect parry negates a guest touch and stuns the mirror', J(cb.parry));
  check(cb.thorns.lost > 0 && cb.thorns.sent >= 1, 'combat-3: Thorns on a guest touch forwards the reflect to the host', J(cb.thorns));
  check(cb.guardian.lost > 0 && cb.guardian.sent >= 1, 'combat-3: the Knight Guardian reflect bounces off a guest touch', J(cb.guardian));
  check(cb.holy.hpDrop === 0 && cb.holy.sent >= 1 && cb.holy.bounceAt > cb.holy.now, 'combat-3: Holy Shield bounces its retaliation through its own invulnerability', J(cb.holy));
  // ---- 7. parityA-3 = parityB-6: a mirror's burn / poison ticks, forwards, expires; the host applies a tick raw ----
  const bn = await page.evaluate((pick) => {
    const T = window.__T, out = {};
    const mirror = (o) => { T.follow(false); T.fresh(); const m = T.mob(o); T.follow(true); m._coopMirror = true; return m; };
    // a. a guest's burn on the host's mirror: ticks (0.8 s apart), forwards each tick as a 'burn' hit, and expires with its icon
    let m = mirror({ type: pick.plain, level: 40, atk: 'med' }); m.maxHp = m.currentHp = 100000;
    const put = T.step(() => _applyMobStatus(m, 'burn', 2500, { dmg: 100 }));
    const t0 = m.burnTimer; let n = 0;
    for (let i = 0; i < 190; i++) T.step(() => { game.time++; updateMonsters(16); });
    const burns = T.sent.filter((x) => x.k === 'burn');
    const want = Math.min(Math.max(1, Math.floor(m.maxHp * LX_BURN_TICK_MAXHP_PCT)), Math.max(1, Math.floor(100 * LX_BURN_DPS_MUL * LX_BURN_TICK_MS / 1000)));
    out.burn = { put, t0, ticks: burns.length, dmg: burns.map((x) => x.d), want, left: m.burnTimer, kind: m._dotKind, uid: burns.every((x) => x.u === 9001) };
    // b. poison (the other DoT kind) rides the same path and shows its own colour until it ends
    m = mirror({ type: pick.plain, level: 40, atk: 'med' }); m.maxHp = m.currentHp = 100000;
    T.step(() => _applyMobStatus(m, 'poison', 2500, { dmg: 100 })); const kindOn = m._dotKind;
    for (let i = 0; i < 190; i++) T.step(() => { game.time++; updateMonsters(16); });
    out.poison = { kindOn, left: m.burnTimer, kind: m._dotKind, ticks: T.sent.filter((x) => x.k === 'burn').length };
    // c. refused when nobody ticks the mirror (not following the host), and untouched for an ordinary monster
    T.follow(false); T.fresh(); const cm = T.mob({ type: pick.plain, level: 40, atk: 'med' }); cm._coopMirror = true;
    const mirrorApplied = T.step(() => _applyMobStatus(cm, 'burn', 2500, { dmg: 100 }));   // true = a burn was applied
    const timerAfterRefuse = cm.burnTimer || 0; cm._coopMirror = false; const solo = T.step(() => _applyMobStatus(cm, 'burn', 2500, { dmg: 100 }));
    out.guard = { mirrorApplied, timerAfterRefuse, solo, soloTimer: cm.burnTimer };
    // d. the host applies a guest's burn tick RAW: a ward gives a sword 1 and a burn tick its full number, and a stagger window
    //    pays a sword x1.6 and a burn tick x1
    T.follow(false); T.fresh(); const bm = T.mob({ type: 'king', level: 40, boss: true }); bm.maxHp = bm.currentHp = 1e7; bm.invulnerable = 0;
    const hit = (skill, d) => { const h0 = bm.currentHp; net.isHost = true; try { _coopHostApplyDamage(9001, d, false, skill, null, 7); } finally { net.isHost = false; } return Math.round(h0 - bm.currentHp); };
    bm._wardUntil = game.time + 900; bm._wardBreakUntil = 0;
    out.ward = { sword: hit('slash', 400), burn: hit('burn', 400) };
    bm._wardUntil = 0; bm._stagger = 200;
    out.stagger = { sword: hit('slash', 400), burn: hit('burn', 400) };
    T.done(); return out;
  }, pick);
  console.log('BURN ' + J(bn));
  check(bn.burn.put === true && bn.burn.t0 === 2500, 'parityA-3: a guest can put a burn on the host\'s mirror (following)', J(bn.burn));
  check(bn.burn.ticks >= 2 && bn.burn.ticks <= 4 && bn.burn.dmg.every((d) => d === bn.burn.want) && bn.burn.uid, 'parityA-3: the mirror ticks every 0.8 s and forwards each tick to the host as a burn hit (the host\'s own per-tick number)', J(bn.burn));
  check(bn.burn.left <= 0 && bn.burn.kind == null, 'parityA-3: the burn expires and the icon / tint kind clears', J(bn.burn));
  check(bn.poison.kindOn === 'poison' && bn.poison.left <= 0 && bn.poison.kind == null && bn.poison.ticks >= 2, 'parityB-6: poison rides the same path and expires', J(bn.poison));
  check(bn.guard.mirrorApplied === false && bn.guard.timerAfterRefuse === 0 && bn.guard.solo === true && bn.guard.soloTimer > 0, 'parityA-3: a DoT is refused on a mirror nobody ticks, and an ordinary monster still burns', J(bn.guard));
  check(bn.ward.sword === 1 && bn.ward.burn === 400, 'parityA-3: the host applies a guest\'s burn tick raw through a boss ward (a sword hit gets 1)', J(bn.ward));
  check(bn.stagger.sword > 400 && bn.stagger.burn === 400, 'parityA-3: ... and a stagger window does not pay a burn tick the punish bonus', J(bn.stagger));
  // ---- 6. the helpers are shared, not copied ----
  const src = await (await fetch(`http://localhost:${PORT}/mojiworld_game.html`)).text();
  const cnt = (t) => src.split(t).length - 1;
  check(cnt('_lxContactBase(m)') >= 3 && cnt('_lxContactLanding(m, dmg,') >= 2 && cnt('_lxContactHolyBounce(m)') >= 3, 'both contact paths call the shared helpers', J({ base: cnt('_lxContactBase(m)'), landing: cnt('_lxContactLanding(m, dmg,'), bounce: cnt('_lxContactHolyBounce(m)') }));
  check(cnt('dmg = _lxContactDrStack(m, dmg);') === 1, 'the pinned DR-stack line is kept whole, once');
  check(errs.length === 0, 'no page errors', errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.stack || e)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
