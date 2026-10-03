// BUG HUNT 2026-10-02, cluster coop-trust: what a guest believes of a host / partner / invite link.
//   coop-1 + runtime-1  a wire uid of '__proto__' polluted Object.prototype in the three mirror reconcilers, and the junk key
//                       then crashed updatePlayer's Deadeye-window for-in every frame (120 throws -> thrown back to town)
//   coop-3              kill / drop dedup rings keyed by the bare uid: a reloaded or different host's first kills were dropped
//   coop-4              uncapped owner:'peer' projectile copies (any room member: ~14,000 live on every screen)
//   coop-6              a host's kill frame minted boss Setshards (b / bl / zs / dt read raw)
//   relay-5/7/8         invite / Steam connect-string join: only ws(s), custom hosts confirmed, never re-advertised;
//                       the whole custom party code + channel survive the round trip; a failed lobby create retries
// One page plays the guest: net says a host exists, frames go through _mpHandle exactly as the relay would deliver them.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] [PORT=n] node scripts/bughunt_coop_trust_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '13960';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
// every scenario shares these: a guest session (me 20, hosts 7 / 8 on my map), the Object.prototype probe, a quiet field
const PRE = `
  const STD = new Set(['constructor','__defineGetter__','__defineSetter__','hasOwnProperty','__lookupGetter__','__lookupSetter__','isPrototypeOf','propertyIsEnumerable','toString','valueOf','__proto__','toLocaleString']);
  const polluted = () => Object.getOwnPropertyNames(Object.prototype).filter((k) => !STD.has(k));
  const stage = () => { const MAP = game.currentMap; net.isHost = false; net.hostId = 7; net.myId = 20; net.connected = true; net.ws = { readyState: 1, send() {} };
    net.peers = { 7: { id: 7, name: 'Hosty', map: MAP, x: 0, y: 0, _last: performance.now() }, 8: { id: 8, name: 'Pal', map: MAP, x: 0, y: 0, _last: performance.now() } };
    for (const k in _MP_BUCKETS) delete _MP_BUCKETS[k];
    game.monsters.length = 0; for (const k of ['projectiles', 'drops', 'powerupOrbs', 'hazards']) if (game[k]) game[k].length = 0;
    player._god = true; player.hp = player.maxHp = 99999; return MAP; };
  const H = (m) => { try { _mpHandle(m); return null; } catch (e) { return String(e).slice(0, 140); } };
`;
const boot = async () => {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } })).newPage();
  page._errs = []; page._logs = []; page.on('pageerror', (e) => page._errs.push(String(e.message).slice(0, 200))); page.on('console', (m) => page._logs.push(m.text().slice(0, 200)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _coopApplyKill === 'function', null, { timeout: 180000 }); await page.waitForTimeout(4000);
  await page.evaluate(async () => { const sleep = (ms) => new Promise((r2) => setTimeout(r2, ms));
    try { _lxBootGateDone = true; _prologueActive = false; _playStoryBeat = function () { return false; }; _playBossIntro = function () {}; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'warrior'; player.level = 40; player._god = true; player._tutorialSeen = true;
    loadMap('glasswindSteppe', 900); await sleep(1500); game.paused = false; });
  return page;
};
try {
  // ---------------------------------------------------------------------------------------------------- coop-1 / runtime-1
  const P1 = await boot();
  const a = await P1.evaluate(`(() => { ${PRE}
    const out = {}, MAP = stage();
    const fr = [
      { t: 'mon', id: 7, map: MAP, list: [{ u: '__proto__', x: 100, y: 100, t: 'slime', h: 5, m: 50, a: 9999999, lv: 99, df: 99999, f: 1 }] },
      { t: 'mon', id: 7, map: MAP, list: [['__proto__', 100, 100, 3, 4, 1, 5, JSON.parse('{"iv":900,"fz":900,"st":900,"__proto__":{"a":12345},"constructor":1}')]] },
      { t: 'proj', id: 7, map: MAP, list: [{ u: '__proto__', x: 100, y: 100, vx: 1, vy: 1, w: 30, h: 30, l: 50, d: 9999999, s: 'x', c: '#fff', xf: { _healLockMs: 9999, pierce: 1 } }] },
      { t: 'haz', id: 7, map: MAP, list: [{ u: '__proto__', t: 'quake', x: 100, y: 100, l: 50, d: 5, xf: { atk: 777777, dir: 1, slow: 5 } }], hx: ['__proto__'] },
    ];
    out.hostile = fr.map(H);
    out.polluted = polluted(); out.leak = { atk: ({}).atk, currentHp: ({}).currentHp, life: ({}).life, vx: ({}).vx, damage: ({}).damage };
    const e = _coopMonFromArr(['5', 1, 1, 0, 0, 1, 5, JSON.parse('{"__proto__":{"a":12345},"constructor":1,"iv":7}')]);
    out.arrEntry = { proto: Object.getPrototypeOf(e) === Object.prototype, a: e.a, iv: e.iv, ctor: Object.prototype.hasOwnProperty.call(e, 'constructor') };
    // numeric uids still reconcile
    out.mirrorErr = H({ t: 'mon', id: 7, map: MAP, list: [{ u: 424242, x: 300, y: 100, t: 'slime', h: 5, m: 5, f: 1 }] });
    out.projErr = H({ t: 'proj', id: 7, map: MAP, list: [{ u: 55, x: 300, y: 100, vx: 0, vy: 0, w: 12, h: 12, l: 50, d: 3, s: 'mbolt', c: '#f66' }] });
    out.hazErr = H({ t: 'haz', id: 7, map: MAP, list: [{ u: 66, t: 'quake', x: 300, y: 100, l: 50, d: 5 }] });
    out.mirror = game.monsters.some((m) => m.uid === 424242 && m._coopMirror); out.proj = game.projectiles.some((p) => p._puid === 55); out.haz = game.hazards.some((h) => h._huid === 66);
    return out; })()`);
  check(a.hostile.every((x) => x === null), 'hostile __proto__ frames (mon object, mon light array, proj, haz + hx) are handled without throwing', J(a.hostile));
  check(a.polluted.length === 0 && Object.values(a.leak).every((v) => v === undefined), 'Object.prototype is untouched after them (was 20+ keys: atk, currentHp, vx, life, damage...)', J({ polluted: a.polluted.slice(0, 8), leak: a.leak }));
  check(a.arrEntry.proto && a.arrEntry.a === undefined && a.arrEntry.iv === 7 && !a.arrEntry.ctor, 'a light entry\u2019s "__proto__" / "constructor" extras are not table keys (the entry keeps its prototype; real keys still ride)', J(a.arrEntry));
  check(!a.mirrorErr && !a.projErr && !a.hazErr && a.mirror && a.proj && a.haz, 'numeric uids still mirror: monster, projectile and hazard', J({ a: a.mirrorErr, b: a.projErr, c: a.hazErr, m: a.mirror, p: a.proj, h: a.haz }));
  const g = await P1.evaluate(`(() => { ${PRE}
    const MAP = stage(), out = {};
    H({ t: 'mon', id: 7, map: MAP, list: [{ u: 3131, x: 200, y: 100, t: '__proto__', h: 5, m: 5, f: 1 }, { u: 3132, x: 220, y: 100, t: 'constructor', h: 5, m: 5, f: 1 }, { u: 3133, x: 240, y: 100, t: 'slime', h: 5, m: 5, f: 1 }] });
    out.mons = game.monsters.filter((m) => m._coopMirror && m.uid >= 3131 && m.uid <= 3133).map((m) => m.type);
    game.smoothFx = [];
    H({ t: 'dmg', id: 8, fm: MAP, fx: [{ type: '__proto__', x: 5, y: 5, life: 20 }, { type: 'constructor', x: 5, y: 5, life: 20 }, { type: 'slash', x: 5, y: 5, life: 20 }] });
    out.fx = game.smoothFx.filter((f) => f._peerFx).map((f) => f.type);
    // a relay (a hostile one: the id is the relay's to stamp) naming a sender '__proto__' indexes net.peers as Object.prototype
    const idErrs = ['__proto__', 'constructor', 'toString'].map((id) => H({ t: 'ping', id, lk: { zzlook: 1 }, eq: { zzeq: 1 }, v: 'zz', ti: 'zz', cap: 9, at: 5 }));
    out.idPolluted = polluted(); out.idLeak = { look: ({}).look, eq: ({}).eq, cap: ({}).cap, ti: ({}).ti }; for (const k of polluted()) { try { delete Object.prototype[k]; } catch (e) {} }
    out.idOk = H({ t: 'ping', id: 'friend', lk: { a: 1 }, ti: 'T' }) === null && !!net.peers.friend;   // an ordinary non-numeric id (the suites use them) still works
    return out; })()`);
  check(g.idPolluted.length === 0 && Object.values(g.idLeak).every((v) => v === undefined) && g.idOk, 'a sender id of "__proto__" / "constructor" cannot reach Object.prototype through net.peers (ordinary ids still work)', J({ polluted: g.idPolluted.slice(0, 6), leak: g.idLeak, ok: g.idOk }));
  check(J(g.mons) === '["slime"]', 'a mirror is never built for a monster type named "__proto__" / "constructor" (a real type still mirrors)', J(g.mons));
  check(J(g.fx) === '["slash"]', 'a partner’s effect of type "__proto__" / "constructor" is dropped (a real type still draws)', J(g.fx));
  const errs0 = P1._errs.length, logs0 = P1._logs.length;
  await P1.evaluate(`(() => { ${PRE} stage(); H({ t: 'mon', id: 7, map: game.currentMap, list: [{ u: '__proto__', x: 100, y: 100, t: 'slime', h: 5, a: 9999999, f: 1 }] }); })()`);
  await P1.waitForTimeout(3500);   // base: the first for-in each frame dereferences an inherited null: 120 throws in a row and the guest is sent to town
  const b = await P1.evaluate(`(() => { ${PRE}
    const out = { polluted: polluted(), map: game.currentMap };
    for (const k of polluted()) { try { delete Object.prototype[k]; } catch (e) {} }
    Object.prototype.zzprobe = null; let err = null; try { updatePlayer(16); } catch (e) { err = String(e && e.message).slice(0, 140); } delete Object.prototype.zzprobe;
    out.dwErr = err; return out; })()`);
  const newErrs = P1._errs.slice(errs0), newLogs = P1._logs.slice(logs0);
  check(b.polluted.length === 0 && !newLogs.some((l) => /throws in a row/.test(l)) && !newErrs.some((l) => /until/.test(l)), 'the guest keeps running 3.5 s after a hostile frame (no per-frame throws, no "120 throws" reset)', J({ polluted: b.polluted.slice(0, 6), map: b.map, errs: newErrs.slice(0, 2), logs: newLogs.filter((l) => /throws/.test(l)).slice(0, 1) }));
  check(!/until/.test(b.dwErr || ''), 'hardening: updatePlayer\u2019s Deadeye-window loop reads own keys, so an inherited null cannot crash it', J(b.dwErr));
  await P1.close();
  const P2 = await boot();
  // ---------------------------------------------------------------------------------------------------- coop-3
  const c = await P2.evaluate(`(() => { ${PRE}
    const out = {}, MAP = stage(); let uid = 880000;
    const mirror = (type, boss, u) => { net._coopSpawning = true; const m = spawnMonster(player.x + 300, player.y - 20, type, !!boss, false); net._coopSpawning = false; m.uid = (u != null) ? u : ++uid; m._coopMirror = true; return m; };
    const kill = (id, m, extra) => Object.assign({ t: 'kill', id, u: m.uid, e: m.exp, c: m.mojicoins, x: player.x + 300, y: player.y, map: MAP, tp: m.type, b: 0, il: 0 }, extra || {});
    const pay = (f) => { const e0 = player.exp, c0 = player.mojicoins || 0; player.level = 40; const err = H(f); const r = { exp: player.exp - e0, coins: (player.mojicoins || 0) - c0, err }; player.level = 40; return r; };
    const m1 = mirror('slime'); out.first = pay(kill(7, m1));
    const m1b = mirror('slime', false, m1.uid); out.redelivered = pay(kill(7, m1b));                  // the same sender, the same uid: still a redelivery
    net.hostId = 8; const m2 = mirror('slime', false, m1.uid); out.newHostSameUid = pay(kill(8, m2));   // another host’s counter reached the same number
    out.keyed = [..._coopKillSeen].some((k) => String(k).startsWith('7:')) && [..._coopKillSeen].some((k) => String(k).startsWith('8:'));
    // drops: same shape
    net.hostId = 7; const orbs = () => game.powerupOrbs.length;
    H({ t: 'drop', id: 7, map: MAP, k: 'orb', u: 5, x: player.x, y: player.y, rr: 'common' }); const o1 = orbs();
    H({ t: 'drop', id: 7, map: MAP, k: 'orb', u: 5, x: player.x, y: player.y, rr: 'common' }); const o2 = orbs();
    net.hostId = 8; H({ t: 'drop', id: 8, map: MAP, k: 'orb', u: 5, x: player.x, y: player.y, rr: 'common' }); const o3 = orbs();
    out.drops = [o1, o2, o3];
    // adoption keeps my own counters ahead
    game._dropUid = 0; game._projUid = 0; game._hazUid = 0; net.hostId = 7;
    H({ t: 'drop', id: 7, map: MAP, k: 'orb', u: 77, x: player.x, y: player.y, rr: 'common' });
    H({ t: 'proj', id: 7, map: MAP, list: [{ u: 31, x: 300, y: 100, vx: 0, vy: 0, w: 12, h: 12, l: 50, d: 3, s: 'mbolt', c: '#f66' }] });
    H({ t: 'haz', id: 7, map: MAP, list: [{ u: 41, t: 'quake', x: 300, y: 100, l: 50, d: 5 }] });
    H({ t: 'mon', id: 7, map: MAP, list: [{ u: 1e300, x: 300, y: 100, t: 'slime', h: 5, m: 5, f: 1 }] });
    out.counters = { drop: game._dropUid, proj: game._projUid, haz: game._hazUid, monHuge: game._monUid < 1e9 };
    // a peer leaving / a fresh welcome forgets what it had applied
    const m3 = mirror('slime'); H(kill(8, m3)); const before8 = [..._coopKillSeen].some((k) => String(k).startsWith('8:'));
    H({ t: 'left', id: 8 }); out.left = { before8, after8: [..._coopKillSeen].some((k) => String(k).startsWith('8:')) };
    H({ t: 'welcome', id: 20, room: 'x__ch1', players: [{ id: 7, name: 'Hosty', map: MAP }] });
    out.welcome = { kills: _coopKillSeen.size, ring: _coopKillRing.length, drops: _coopDropSeen.size };
    return out; })()`);
  check(c.first.exp > 0 && c.first.err === null, 'baseline: a kill from the host pays', J(c.first));
  check(c.redelivered.exp === 0 && c.redelivered.coins === 0, 'the same host redelivering a kill uid still pays nothing', J(c.redelivered));
  check(c.newHostSameUid.exp > 0, 'another host (a reload, a hand-off, another map’s runner) whose counter hits the same uid is paid (was: swallowed, no EXP / coins / quest credit)', J(c.newHostSameUid));
  check(c.keyed, 'the rings are keyed by sender + uid', J(c.keyed));
  check(c.drops[0] === 1 && c.drops[1] === 1 && c.drops[2] === 2, 'drops: a redelivery from one sender is ignored, another sender’s same uid lands (was: dropped)', J(c.drops));
  check(c.counters.drop >= 77 && c.counters.proj >= 31 && c.counters.haz >= 41 && c.counters.monHuge, 'adopting a drop / projectile / hazard uid raises my own counter (like monsters); a 1e300 uid cannot freeze it', J(c.counters));
  check(c.left.before8 === true && c.left.after8 === false, 'a peer that leaves is forgotten by the rings', J(c.left));
  check(c.welcome.kills === 0 && c.welcome.ring === 0 && c.welcome.drops === 0, 'a fresh welcome clears both rings', J(c.welcome));
  // ---------------------------------------------------------------------------------------------------- coop-4
  const d = await P2.evaluate(`(() => { ${PRE}
    const out = {}, MAP = stage();
    const peers = () => game.projectiles.filter((p) => p.owner === 'peer');
    const frame = (id, n0, over) => ({ t: 'dmg', id, fm: MAP, pj: Array.from({ length: 32 }, (_, i) => Object.assign({ x: 100 + n0 + i, y: 100, vx: 0, vy: 0, life: 900, w: 400, h: 400, pierce: 1 }, over || {})) });
    let n8 = 0; for (let f = 0; f < 60; f++) { for (const k in _MP_BUCKETS) delete _MP_BUCKETS[k]; H(frame(8, n8, null)); n8 += 32; }   // 60 frames x 32 from one room member
    const mine = peers();
    out.count8 = mine.length; out.sent8 = n8;
    out.clamp = { life: Math.max(...mine.map((p) => p.life)), w: Math.max(...mine.map((p) => p.w)), h: Math.max(...mine.map((p) => p.h)) };
    out.oldestKept = Math.min(...mine.map((p) => p.x));
    let n7 = 0; for (let f = 0; f < 30; f++) { for (const k in _MP_BUCKETS) delete _MP_BUCKETS[k]; H(frame(7, 5000 + n7, null)); n7 += 32; }
    out.two = peers().length; out.cap = (typeof MAX_PEER_PROJECTILES === 'number') ? MAX_PEER_PROJECTILES : null;
    let terr = null; try { _trimVisualQueues(); } catch (e) { terr = String(e).slice(0, 100); } out.afterTrim = peers().length; out.trimErr = terr;
    game.projectiles.length = 0; for (const k in _MP_BUCKETS) delete _MP_BUCKETS[k];
    H({ t: 'dmg', id: 8, fm: MAP, pj: [{ x: 500, y: 100, vx: 5, vy: 0, life: 250, w: 220, h: 100, pierce: 1 }] });
    const real = peers()[0]; out.real = real && { life: real.life, w: real.w, h: real.h, from: real._peerFrom };
    return out; })()`);
  check(d.count8 <= 160 && d.count8 > 100, 'one sender floods 1,920 projectile copies: at most 160 stay live (was every one of them)', J({ count: d.count8, sent: d.sent8 }));
  check(d.oldestKept === 100 + d.sent8 - 160, 'the oldest copies go first (the newest 160 stay)', J({ oldestKept: d.oldestKept, want: 100 + d.sent8 - 160 }));
  check(d.clamp.life <= 360 && d.clamp.w <= 260 && d.clamp.h <= 260, 'life and size of a partner’s copy are clamped (was 900 / 400)', J(d.clamp));
  check(d.cap != null && d.two > d.cap && d.afterTrim <= d.cap && !d.trimErr, 'a second sender gets its own allowance and the whole ceiling (MAX_PEER_PROJECTILES) holds in the cap block', J({ two: d.two, cap: d.cap, afterTrim: d.afterTrim, err: d.trimErr }));
  check(d.real && d.real.life === 250 && d.real.w === 220 && d.real.h === 100 && d.real.from === 8, 'a real partner shot (life 250, 220 wide) passes unchanged', J(d.real));
  // ---------------------------------------------------------------------------------------------------- coop-6
  const e = await P2.evaluate(`(() => { ${PRE}
    const out = {}, MAP = stage(); let uid = 990000; game._bossKills = {}; game.bossDefeated = {}; player.setshards = 0; player.level = 40; net._bossPaid = null;
    const mirror = (type, boss) => { net._coopSpawning = true; const m = spawnMonster(player.x + 300, player.y - 20, type, !!boss, false); net._coopSpawning = false; m.uid = ++uid; m._coopMirror = true; return m; };
    const kill = (m, extra) => Object.assign({ t: 'kill', id: 7, u: m.uid, e: 0, c: 0, x: player.x + 300, y: player.y, map: MAP, tp: m.type, b: m.isBoss ? 1 : 0, il: 0 }, extra || {});
    const shards = (f) => { const s0 = player.setshards | 0; const err = H(f); return { s: (player.setshards | 0) - s0, err }; };
    const lvOf = (m) => ((m.level > 0 ? m.level : _mobLevel(m)) | 0);
    // honest: real boss mirrors, the frame as the host builds it (its level, its sign)
    const kk = mirror('kingKrook', true), lvK = lvOf(kk); out.honest = shards(kill(kk, { bl: lvK })); out.honestWant = Math.min(10000, lvK * lvK);
    const ar = mirror('zodiac_aries', true), lvA = lvOf(ar); out.zodiac = shards(kill(ar, { bl: lvA, zs: 'aries' })); out.zodiacWant = Math.min(10000, lvA * lvA);
    out.zodiacKeys = { aries: game._bossKills.zodiac_aries | 0 };
    // the same boss twice inside 30 s pays once; a bad clock / a real respawn minutes later pays again
    const k2 = mirror('kingKrook', true); out.again = shards(kill(k2, { bl: lvK }));
    for (const k in net._bossPaid) net._bossPaid[k] -= 31000; const k3 = mirror('kingKrook', true); out.later = shards(kill(k3, { bl: lvK }));
    // hostile: a trash mob called a level-200 zodiac boss, with a fresh sign name each time
    game._bossKills = {}; game.bossDefeated = {}; net._bossPaid = null;
    const sl = mirror('slime', false); out.trash = shards(kill(sl, { b: 1, bl: 200, zs: 'fresh1', dt: 1 }));
    out.trashState = { keys: Object.keys(game._bossKills), defeated: !!game.bossDefeated[MAP], duo: game.duoTrials | 0 };
    // hostile: a real boss mirror with a made-up level and sign
    const mo = mirror('mooma', true), moT = (monsterTypes.mooma && monsterTypes.mooma.level) | 0, cap = Math.max(lvOf(mo), moT, mo.level | 0, player.level | 0);
    out.inflated = shards(kill(mo, { bl: 200, zs: 'fresh2' })); out.inflatedWant = Math.min(10000, cap * cap);
    out.inflatedKeys = Object.keys(game._bossKills);
    const za = mirror('zodiac_taurus', true); const zs0 = Object.keys(game._bossKills).length; shards(kill(za, { bl: 70, zs: 'whatever' }));
    out.zodiacFake = { fake: game._bossKills.zodiac_whatever, real: game._bossKills.zodiac_taurus | 0 };
    // an honest 70-kill burst inside one second: my own bucket stops the excess
    stage(); let paid = 0; for (let i = 0; i < 70; i++) { const s = mirror('slime'); const e0 = player.exp; player.level = 40; H(kill(s, { e: s.exp, c: s.mojicoins })); if (player.exp > e0) paid++; player.level = 40; }
    out.burst = paid;
    return out; })()`);
  check(e.honest.s === e.honestWant && e.honest.s > 0 && !e.honest.err, 'an honest boss kill (the host’s own level) pays exactly level-squared Setshards, as before', J({ got: e.honest, want: e.honestWant }));
  check(e.zodiac.s === e.zodiacWant && e.zodiac.s > 0 && e.zodiacKeys.aries === 1, 'an honest zodiac boss kill pays level-squared under the sign’s own ladder key', J({ got: e.zodiac, want: e.zodiacWant, keys: e.zodiacKeys }));
  check(e.again.s === 0 && e.later.s > 0, 'the same boss paying twice inside 30 s is refused; minutes later it pays again (the ladder’s step)', J({ again: e.again, later: e.later }));
  check(e.trash.s === 0 && e.trashState.keys.length === 0 && !e.trashState.defeated && e.trashState.duo === 0, 'a mirrored trash mob called a level-200 boss pays no Setshards, no Duo Trial, and marks nothing defeated (was 10,000 a frame)', J({ trash: e.trash, state: e.trashState }));
  check(e.inflated.s === e.inflatedWant && e.inflated.s < 10000 && !e.inflatedKeys.some((k) => /fresh2/.test(k)), 'a real boss claiming level 200 and a fresh sign pays by MY table / mirror / level, under its own key', J({ got: e.inflated, want: e.inflatedWant, keys: e.inflatedKeys }));
  check(e.zodiacFake.fake === undefined && e.zodiacFake.real === 1, 'a sign name the frame invents never becomes a ladder key (the mirror’s own sign does)', J(e.zodiacFake));
  check(e.burst <= 60 && e.burst >= 50, 'a 70-frame burst inside one second pays at most 60 kills (my own bucket)', J(e.burst));
  // ---------------------------------------------------------------------------------------------------- relay-5 / relay-7 / relay-8
  const f = await P2.evaluate(`(async () => { ${PRE}
    const out = {}, calls = [], asked = []; let answer = true;
    const mpOrig = window.mpConnect, cfOrig = window.confirm, steamOrig = window.SteamAPI, enc = encodeURIComponent;
    window.mpConnect = (url, name, room) => { calls.push({ url, room, ch: player.channel }); };
    window.confirm = (msg) => { asked.push(String(msg)); return answer; };
    const join = (s) => { calls.length = 0; asked.length = 0; _lxSteamJoinDone = false; try { _lxSteamTryAutoJoin(s); } catch (e) { return { threw: e.message }; } return { calls: calls.slice(), asked: asked.slice() }; };
    player.cls = player.cls || 'warrior';
    out.def = join('--moji-join=' + enc(MP_DEFAULT_URL) + '~ABC42');
    out.empty = join('~ABC43');
    out.https = join('--moji-join=' + enc('https://evil.example') + '~ABC44');
    out.js = join('--moji-join=' + enc('javascript:alert(1)') + '~ABC45');
    out.file = join('--moji-join=' + enc('file:///etc/passwd') + '~ABC46');
    out.junk = join('--moji-join=' + enc('not a url') + '~ABC47');
    out.badEsc = join('--moji-join=%E0%A4%A~ABC47');
    answer = false; out.customNo = join('--moji-join=' + enc('wss://relay.example') + '~ABC48');
    answer = true; out.customYes = join('--moji-join=' + enc('ws://relay.example:9') + '~ABC49');
    // the invite round trip: what the host advertises is what the joiner joins (code as typed, up to 24, and the channel)
    net.connected = true; net._lastUrl = MP_DEFAULT_URL; net.channel = 3; net.baseRoom = 'dragon party';
    out.cs = _lxSteamConnectString(); out.rt = join(out.cs);
    net.baseRoom = 'a~b&c'; out.csOdd = _lxSteamConnectString(); out.rtOdd = join(out.csOdd);
    net.channel = 1; net.baseRoom = 'abc42'; out.cs1 = _lxSteamConnectString();
    out.noCh = join('--moji-join=' + enc(MP_DEFAULT_URL) + '~ABC50');
    out.long = join('~' + enc('abcdefghijklmnopqrstuvwxyz'));
    out.angle = join('~' + enc('a<b>c'));
    net.channel = 3; net.baseRoom = 'dragon-party'; out.invite = _mpInviteText();
    history.replaceState(null, '', location.pathname + '?dev=1&join=' + enc('DRAGON-PARTY') + '&ch=3'); calls.length = 0; _lxSteamJoinDone = false; _lxWebTryAutoJoin(); out.web = calls.slice();
    history.replaceState(null, '', location.pathname + '?dev=1');
    // a relay a friend's link handed me is not re-advertised; the one I typed (and the default) are
    net.channel = 1; net.baseRoom = 'abc42'; net._lastUrl = 'wss://evil.example'; localStorage.removeItem(MP_URL_KEY);
    out.advEvil = { cs: _lxSteamConnectString(), party: _lxSteamPartyRelay(), def: enc(MP_DEFAULT_URL) };
    localStorage.setItem(MP_URL_KEY, 'wss://typed.example'); net._lastUrl = 'wss://typed.example';
    out.advTyped = { cs: _lxSteamConnectString(), party: _lxSteamPartyRelay() };
    localStorage.removeItem(MP_URL_KEY);
    // relay-8: a lobby create that fails is retried on the next heartbeat; one that works is not repeated
    const rec = { host: [] }, ans = ['', '109775240000000001'];
    window.SteamAPI = { available: true, lobby: { host: (d) => { rec.host.push(d); return Promise.resolve(ans.shift()); }, leave: () => Promise.resolve(true), invite: () => Promise.resolve(true) } };
    net._lastUrl = null; net.baseRoom = 'lobbyx'; net.channel = 1; _lxSteamLobbyCode = '';
    await _lxSteamLobbySync(); await new Promise((r) => setTimeout(r, 20)); out.afterFail = _lxSteamLobbyCode;
    await _lxSteamLobbySync(); await new Promise((r) => setTimeout(r, 20)); out.afterOk = _lxSteamLobbyCode; out.hostCalls = rec.host.length;
    _lxSteamLobbySync(); out.hostCallsRepeat = rec.host.length;
    net.channel = 2; _lxSteamLobbySync(); out.lobbyCh = rec.host.length && rec.host[rec.host.length - 1].code;
    net.connected = false; _lxSteamLobbySync();
    window.mpConnect = mpOrig; window.confirm = cfOrig; window.SteamAPI = steamOrig; _lxSteamJoinDone = false;
    return out; })()`);
  const one = (r, url, room) => r.calls && r.calls.length === 1 && (url == null || r.calls[0].url === url) && (room == null || r.calls[0].room === room);
  const none = (r) => r.calls && r.calls.length === 0 && r.asked.length === 0;
  const DEF = 'wss://mojiworld-mp.dpeh001.workers.dev';
  check(one(f.def, null, 'ABC42') && f.def.asked.length === 0 && one(f.empty, null, 'ABC43') && f.empty.asked.length === 0, 'the default relay (and an invite with no relay half) joins at once, no question asked', J({ def: f.def, empty: f.empty }));
  check(none(f.https) && none(f.js) && none(f.file) && none(f.junk) && !f.badEsc.threw && none(f.badEsc), 'https:, javascript:, file:, a non-URL and a broken escape are refused outright (only ws: / wss: are ever dialled)', J({ https: f.https, js: f.js, file: f.file, junk: f.junk, bad: f.badEsc }));
  check(f.customNo.calls.length === 0 && f.customNo.asked.length === 1 && /relay\.example/.test(f.customNo.asked[0]), 'a custom relay asks first, naming the host; "no" does not connect', J(f.customNo));
  check(one(f.customYes, 'ws://relay.example:9', 'ABC49') && f.customYes.asked.length === 1, 'a custom relay joins after "yes"', J(f.customYes));
  check(/%20/.test(f.cs) && /&ch=3$/.test(f.cs) && one(f.rt, DEF, 'DRAGON PARTY') && f.rt.calls[0].ch === 3, 'a code with a space and channel 3 survives the Steam connect string round trip (was: "DRAGON" on channel 1)', J({ cs: f.cs, rt: f.rt }));
  check(!/[~].*[~]/.test(f.csOdd) && one(f.rtOdd, null, 'A~B&C'), 'a "~" or "&" inside a code cannot split the string', J({ cs: f.csOdd, rt: f.rtOdd }));
  check(!/&ch=/.test(f.cs1) && /~ABC42$/.test(f.cs1) && one(f.noCh, null, 'ABC50') && f.noCh.calls[0].ch === 1, 'channel 1 adds nothing to the Steam string (older builds read it unchanged); an invite without a channel means channel 1', J({ cs1: f.cs1, noCh: f.noCh }));
  check(one(f.long, null, 'ABCDEFGHIJKLMNOPQRSTUVWX') && one(f.angle, null, 'ABC'), 'the code keeps up to 24 characters (was 12) and loses only <>', J({ long: f.long, angle: f.angle }));
  check(/[?&]join=DRAGON-PARTY&ch=3/.test(f.invite) && f.web.length === 1 && f.web[0].url === DEF && f.web[0].room === 'DRAGON-PARTY' && f.web[0].ch === 3, 'the web invite link carries the whole code and the channel, and joins them', J({ invite: f.invite, web: f.web }));
  check(f.advEvil.cs.indexOf(f.advEvil.def) > 0 && !/evil/.test(f.advEvil.cs) && f.advEvil.party === DEF, 'a relay handed over by a link is not advertised to my friends (the default is)', J(f.advEvil));
  check(/typed\.example/.test(f.advTyped.cs) && f.advTyped.party === 'wss://typed.example', 'the server I typed myself is advertised', J(f.advTyped));
  check(f.afterFail === '' && f.afterOk !== '' && f.hostCalls === 2 && f.hostCallsRepeat === 2, 'a failed Steam lobby create is retried on the next heartbeat; a good one is not repeated', J({ afterFail: f.afterFail, afterOk: f.afterOk, calls: f.hostCalls, repeat: f.hostCallsRepeat }));
  check(f.lobbyCh === 'LOBBYX&ch=2', 'the lobby carries the channel with the code', J(f.lobbyCh));
  check(P2._errs.length === 0, 'no page errors', J(P2._errs.slice(0, 3)));
} catch (e) { check(false, 'harness: ' + String(e && e.stack || e).slice(0, 600)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
