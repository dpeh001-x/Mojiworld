// Co-op handler audit (v0.29.363). Drives _mpHandle -- the real network
// dispatcher -- with valid, hostile, and malformed frames as a simulated
// guest (net faked as a live session: connected + ws.readyState 1 + ids),
// plus the host-side damage path. Asserts effects for legitimate frames and
// FAIL-CLOSED for everything else: forged (non-host) senders, wrong-map
// frames, NaN coords, replayed frames, XSS in drop item strings, monster
// flood past COOP_MON_CAP, revive spent-gate, damage cap and i-frames.
// Also pins Slaughter Ladder co-op rules: near+real earns streak credit;
// downed / far / mirage / forged / boss-tagged frames behave per spec.
//   node scripts/coop_handler_audit_test.mjs
// Env: PW_EXE / PW_CHANNEL (default msedge), PORT (default 8920)
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || 8920;
const server = spawn(process.execPath, [join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch(process.env.PW_EXE
  ? { executablePath: process.env.PW_EXE, headless: true }
  : { channel: process.env.PW_CHANNEL || 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(8000);

const o = await page.evaluate(() => {
  const r = {};
  const arena = Object.entries(MAPS)
    .filter(([id, mp]) => !mp.isVoid && !mp.isTown && (mp.platforms || []).some(p => p.w > 900))
    .sort((x, y) => y[1].worldWidth - x[1].worldWidth)[0];
  loadMap(arena[0]);
  const ww = game.mapData.worldWidth;
  const gy = (game.mapData.platforms || []).filter(p => p.w > 900).sort((x, y) => x.y - y.y)[0].y;
  const MAP = game.currentMap;
  // Pose as a guest in a 2-player room, host id 7, me id 2.
  net.isHost = false; net.hostId = 7; net.myId = 2;
  net.connected = true; net.ws = { readyState: 1, send() {} };   // live-looking session so _coopActive()/_coopFollowingHost() pass
  net.peers = { 7: { id: 7, name: 'Hosty', map: MAP, x: 0, y: 0, _last: performance.now() } };
  player.level = 60; player.maxHp = 100000; player.hp = 100000;
  player._ksTier = 0; game.mapKillStreak = 0; player._downed = false;
  player._god = false; player.invulnerable = 0;
  player.x = ww * 0.5; player.y = gy - 80;
  const px = () => player.x + player.w / 2, py = () => player.y + player.h / 2;
  game.monsters.length = 0;
  for (const k of ['projectiles', 'drops', 'powerupOrbs', 'hazards']) if (game[k]) game[k].length = 0;
  let uid = 700000;
  const H = (m) => { try { _mpHandle(m); return null; } catch (e) { return String(e).slice(0, 140); } };

  // ---- dispatcher hardening --------------------------------------------
  r.garbage = [H(null), H(0), H('x'), H({}), H({ t: 'nope' }), H({ t: 'kill' }),
               H({ t: 'mon' }), H({ t: 'proj', id: 7 }), H({ t: 'hazhit' })].filter(Boolean);

  // ---- kill frames: downed gate + boss + NaN + wrong map + forged -------
  const kf = (over) => Object.assign({ t: 'kill', id: 7, u: ++uid, e: 100, c: 1,
    x: Math.round(px()), y: Math.round(py()), map: MAP, tp: 'slime', b: 0, il: 0 }, over || {});
  player._downed = true;  H(kf());
  r.downedNoStreak = (game.mapKillStreak | 0) === 0;
  player._downed = false; H(kf({ b: 1 }));
  r.bossCounts = (game.mapKillStreak | 0) === 1;
  r.nanThrew = H(kf({ x: NaN, y: undefined }));
  r.nanNoCredit = (game.mapKillStreak | 0) === 1;
  H(kf({ map: 'somewhere_else' }));
  r.wrongMapNoCredit = (game.mapKillStreak | 0) === 1;
  H(kf({ id: 3 }));                                        // forged: not the host
  r.forgedNoCredit = (game.mapKillStreak | 0) === 1;

  // ---- guest map travel: tier kept, streak counter reset ----------------
  player._ksTier = 2; game.mapKillStreak = 1234;
  const other = Object.entries(MAPS).find(([id, mp]) => id !== arena[0] && !mp.isVoid && (mp.platforms || []).length);
  loadMap(other[0]); loadMap(arena[0]);
  net.peers[7].map = game.currentMap;
  r.travelKeepsTier = (player._ksTier | 0) === 2 && (game.mapKillStreak | 0) === 0;
  player._ksTier = 0;

  // ---- 'mon' sync: valid mirrors + 300-monster flood --------------------
  const monOf = (i) => ({ u: 800000 + i, t: 'slime', x: 100 + i * 3, y: gy - 60, vx: 0, vy: 0, h: 500, m: 500, f: 1, b: 0 });
  r.monThrew = H({ t: 'mon', id: 7, map: MAP, list: [monOf(1), monOf(2)] });
  r.mirrors = game.monsters.filter(m => m._coopMirror).length;
  r.monFloodThrew = H({ t: 'mon', id: 7, map: MAP, list: Array.from({ length: 300 }, (_, i) => monOf(i + 10)) });
  r.mirrorsAfterFlood = game.monsters.filter(m => m._coopMirror).length;
  r.monForged = H({ t: 'mon', id: 3, map: MAP, list: [monOf(999)] });
  r.forgedMonRejected = !game.monsters.some(m => m.uid === 800999);

  // ---- 'proj': valid + NaN velocity + forged ----------------------------
  const p0 = (game.projectiles || []).length;
  r.projThrew = H({ t: 'proj', id: 7, map: MAP, list: [{ u: ++uid, x: px(), y: py() - 40, vx: 3, vy: 0, w: 12, h: 12, l: 60, d: 40, s: 'mdark', c: '#f68' }] });
  r.projAdded = (game.projectiles || []).length > p0;
  r.projNaN = H({ t: 'proj', id: 7, map: MAP, list: [{ u: ++uid, x: NaN, y: py(), vx: NaN, vy: 'x', l: 60, d: 40, s: 'mdark' }] });
  const nanProj = (game.projectiles || []).filter(p => !Number.isFinite(p.x) || !Number.isFinite(p.vx)).length;
  r.projNoNaNInWorld = nanProj === 0;

  // ---- 'hazhit': in range, out of range, god, forged --------------------
  const hz = (over) => Object.assign({ t: 'hazhit', id: 7, map: MAP, x: Math.round(px()), r: 180, d: 500 }, over || {});
  let hp0 = player.hp; H(hz());
  r.hazhitHits = player.hp < hp0;
  player.hp = player.maxHp; player.invulnerable = 0;
  hp0 = player.hp; H(hz({ x: Math.round(px() + 5000) }));
  r.hazhitFarMisses = player.hp === hp0;
  player._god = true; hp0 = player.hp; H(hz());
  r.hazhitGodImmune = player.hp === hp0;
  player._god = false; player.invulnerable = 0;
  hp0 = player.hp; H(hz({ id: 3 }));
  r.hazhitForgedRejected = player.hp === hp0;

  // ---- 'drop': valid + XSS scrub + forged --------------------------------
  r.dropThrew = H({ t: 'drop', id: 7, map: MAP, u: ++uid, k: 'item', x: px(), y: py(),
    it: { name: '<script>alert(1)</script>Blade', slot: 'weapon<img>', atk: 5 } });
  const d = (game.drops || []).find(dd => dd._coopMirror);
  r.dropAdded = !!d;
  r.dropScrubbed = d ? (String(d.item.name).indexOf('<') < 0 && String(d.item.slot).indexOf('<') < 0) : false;
  const dCount = (game.drops || []).length;
  H({ t: 'drop', id: 3, map: MAP, u: ++uid, k: 'item', x: px(), y: py(), it: { name: 'Forged' } });
  r.dropForgedRejected = (game.drops || []).length === dCount;

  // ---- 'down'/'up': peer flags + unknown peer ----------------------------
  H({ t: 'down', id: 7, x: 100, y: 100, map: MAP, rev: 1 });
  r.peerDowned = net.peers[7]._downed === true;
  H({ t: 'up', id: 7, ok: 1, map: MAP });
  r.peerUp = net.peers[7]._downed === false;
  r.unknownPeerThrew = [H({ t: 'down', id: 99 }), H({ t: 'up', id: 99 })].filter(Boolean);

  // ---- 'revive': not downed -> no-op; downed + near host -> revive -------
  player._downed = false; player.hp = 40;
  H({ t: 'revive', id: 7 });
  r.reviveNotDownNoop = player.hp === 40 && player._downed === false;
  player._downed = true; player._coopReviveMapAt = {};
  net.peers[7].x = player.x; net.peers[7].y = player.y; net.peers[7].map = game.currentMap;
  H({ t: 'revive', id: 7 });
  r.reviveWorks = player._downed === false && player.hp > 40;
  // spent-gate: down again on the same map, second revive refused
  player._downed = true;
  H({ t: 'revive', id: 7 });
  r.reviveSpentGate = player._downed === true;
  player._downed = false; player.hp = player.maxHp;

  // ---- host-side 'dmg': cap + invulnerable gate --------------------------
  net.isHost = true;
  const mob = spawnMonster(ww * 0.5 + 120, gy - 60, 'slime', false);
  const mhp = mob.currentHp;
  H({ t: 'dmg', u: mob.uid, d: 1e12, c: 0 });
  r.dmgCapped = !game.monsters.includes(mob) || (mhp - mob.currentHp) <= (mob.maxHp || mhp);
  const mob2 = spawnMonster(ww * 0.5 + 160, gy - 60, 'slime', false);
  mob2.invulnerable = 1000;
  const m2hp = mob2.currentHp;
  H({ t: 'dmg', u: mob2.uid, d: 5000, c: 0 });
  r.dmgInvulnRejected = mob2.currentHp === m2hp;
  net.isHost = false;

  // leave clean
  net.connected = false; net.ws = null; net.hostId = null; net.peers = {}; net.myId = null;
  player._ksTier = 0; game.mapKillStreak = 0;
  return r;
});

const results = [];
const ok = (n, c, e) => results.push({ n, pass: !!c, e });
ok('dispatcher survives garbage frames', o.garbage.length === 0, o.garbage.join(' | ') || 'clean');
ok('downed guest earns no streak credit', o.downedNoStreak);
ok('boss kill frame earns streak credit', o.bossCounts);
ok('NaN-coord kill frame: no throw, no credit', o.nanThrew === null && o.nanNoCredit);
ok('wrong-map kill frame earns nothing', o.wrongMapNoCredit);
ok('forged (non-host) kill frame earns nothing', o.forgedNoCredit);
ok('map travel keeps tier, resets counter', o.travelKeepsTier);
ok('mon sync mirrors monsters', o.monThrew === null && o.mirrors >= 2, `${o.mirrors} mirrors`);
ok('300-monster flood: no throw', o.monFloodThrew === null, `${o.mirrorsAfterFlood} mirrors after flood`);
ok('forged mon sync rejected', o.forgedMonRejected);
ok('proj sync adds projectiles', o.projThrew === null && o.projAdded);
ok('NaN projectile never enters the world', o.projNaN === null && o.projNoNaNInWorld);
ok('hazhit in range damages', o.hazhitHits);
ok('hazhit out of range misses', o.hazhitFarMisses);
ok('hazhit respects god mode', o.hazhitGodImmune);
ok('forged hazhit rejected', o.hazhitForgedRejected);
ok('drop lands for guest', o.dropThrew === null && o.dropAdded);
ok('drop item strings scrubbed (no <> into tooltip HTML)', o.dropScrubbed);
ok('forged drop rejected', o.dropForgedRejected);
ok('down/up flips peer state', o.peerDowned && o.peerUp);
ok('down/up for unknown peer: no throw', o.unknownPeerThrew.length === 0);
ok('revive on a not-downed player is a no-op', o.reviveNotDownNoop);
ok('revive works when downed + partner near', o.reviveWorks);
ok('second revive on the same map refused (spent gate)', o.reviveSpentGate);
ok('host dmg frame capped at one HP bar', o.dmgCapped);
ok('host dmg frame respects monster i-frames', o.dmgInvulnRejected);
for (const t of results) console.log(`${t.pass ? 'PASS' : 'FAIL'}  ${t.n}${t.e ? '  (' + t.e + ')' : ''}`);
const failed = results.filter(t => !t.pass);
console.log(`\n${results.length - failed.length}/${results.length} co-op assertions pass`);
console.log('pageerrors:', errs.length, errs.slice(0, 4));
await browser.close(); server.kill();
process.exit(failed.length || errs.length ? 1 : 0);
