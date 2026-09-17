// CO-OP FIDELITY (v0.30.823, fx collection v0.30.824): the relay budget, seeing each other's skills, and a host that goes away.
// Two real browser clients through the real relay (mp/server.mjs - the same 40 msg/s bucket the deployed worker runs).
//   [SERVE_ROOT=<dir with mp/, data/, art>] node scripts/coop_fidelity_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11123';
const PAGE = path.basename(process.argv.slice(2).find((a) => !a.startsWith('--')) || 'mojiworld_game.html');
const relay = spawn(process.execPath, [path.join(SERVE_ROOT, 'mp', 'server.mjs')], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env, PORT } });
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--disable-gpu'] });
const URL_ = `http://localhost:${PORT}/${PAGE}?dev=1`, WS = `ws://localhost:${PORT}`, ROOM = 'fdt' + Math.floor(Math.random() * 1e9);
const errs = [];
const boot = async (name) => {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 760 } })).newPage();
  page.on('pageerror', (e) => errs.push(name + ': ' + String(e.message).slice(0, 140)));
  await page.goto(URL_, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof net === 'object' && typeof mpConnect === 'function' && typeof SKILL_FNS !== 'undefined' && typeof loadMap === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(3500);
  await page.evaluate((nm) => { try { _lxBootGateDone = true; _prologueActive = false; _playStoryBeat = function () { return false; }; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'mage'; player.job = 'wizard'; player.level = 60; player.maxMp = 99999; player.mp = 99999; player.maxHp = 50000; player.hp = 50000; if (player.look) player.look.name = nm; game.paused = false;
    window.__pump = setInterval(() => { try { _mpTick(); _coopTickMonsters(); _coopTickProjectiles(); _coopTickHazards(); } catch (e) {} }, 16); }, name);
  return page;
};
const wait = (P, fn, ms = 8000) => P.waitForFunction(fn, null, { timeout: ms }).then(() => true).catch(() => false);
try {
  const A = await boot('Host'), B = await boot('Guest');
  check(await A.evaluate(() => typeof _coopFxDrain === 'function' && typeof _coopSetAway === 'function' && LX_COOP_CAP === 2), 'the build has the fidelity layer (cap 2)');
  // ---- connect the two for real ----
  await A.evaluate(({ ws, room }) => mpConnect(ws, 'Host', room), { ws: WS, room: ROOM }); await wait(A, () => net.myId != null);
  await B.evaluate(({ ws, room }) => mpConnect(ws, 'Guest', room), { ws: WS, room: ROOM }); await wait(B, () => net.myId != null);
  for (const P of [A, B]) await P.evaluate(() => { loadMap('glasswindSteppe', 900); game.paused = false; });
  const caps = await wait(A, () => Object.values(net.peers).some((p) => (p.cap | 0) >= 2)) && await wait(B, () => Object.values(net.peers).some((p) => (p.cap | 0) >= 2));
  check(caps && await A.evaluate(() => net.isHost) && !(await B.evaluate(() => net.isHost)), 'both builds advertise cap 2 within a tick of meeting; A hosts');
  await A.evaluate(() => { game.monsters.length = 0; for (let i = 0; i < 3; i++) { const m = spawnMonster(player.x + 260 + i * 60, player.y - 20, 'slime', false); m.maxHp = m.currentHp = 5e6; m.speed = 0; } });
  await wait(B, () => game.monsters.filter((m) => m._coopMirror).length === 3);
  // ---- 2. each sees the other's skills, and a copy is only a picture ----
  const SEE = () => { window.__see = { fx: 0, pj: 0, types: {} }; const s1 = new WeakSet(), s2 = new WeakSet(); window.__seeIv = setInterval(() => {
    for (const f of game.smoothFx || []) if (f && f._peerFx && !s1.has(f)) { s1.add(f); window.__see.fx++; window.__see.types[f.type] = 1; }
    for (const p of game.projectiles || []) if (p && p._peerFx && !s2.has(p)) { s2.add(p); window.__see.pj++; window.__see.bad = window.__see.bad || p.owner !== 'peer' || p.damage !== 0; } }, 30); };
  const CAST = async (P) => P.evaluate(async () => { const ids = Object.keys(SKILLS).filter((k) => SKILLS[k].cls === 'mage' && (!SKILLS[k].job || SKILLS[k].job === 'wizard') && !SKILLS[k].master).slice(0, 6); let n = 0;
    for (const id of ids) { player.mp = 99999; for (const k of Object.keys(player.skillCooldowns || {})) player.skillCooldowns[k] = 0; try { if (SKILL_FNS[id]) { player.facing = 1; SKILL_FNS[id](); n++; } } catch (e) {} await new Promise((r) => setTimeout(r, 450)); } return n; });
  await A.evaluate(SEE); await B.evaluate(SEE);
  const hp0 = await B.evaluate(() => ({ me: player.hp, mon: game.monsters.filter((m) => m._coopMirror).map((m) => m.currentHp) }));
  const castsA = await CAST(A); await A.waitForTimeout(600); const seenByB = await B.evaluate(() => window.__see);
  check(castsA >= 4 && seenByB.fx >= 4 && seenByB.pj >= 1 && !seenByB.bad, `the guest sees the host's ${castsA} casts as effects and projectiles`, J(seenByB));
  const castsB = await CAST(B); await B.waitForTimeout(600); const seenByA = await A.evaluate(() => window.__see);
  check(castsB >= 4 && seenByA.fx >= 4 && seenByA.pj >= 1 && !seenByA.bad, `and the host sees the guest's ${castsB} casts`, J(seenByA));
  const echo = await A.evaluate(() => (game.smoothFx || []).filter((f) => f._peerFx && f._o !== 'net').length + (game.projectiles || []).filter((p) => p._peerFx && !p._fxSeen).length);
  // a forged partner projectile parked ON me for 40 frames: it must arrive as peer / 0 damage and never touch me
  const safe = await B.evaluate(async () => { const hp = player.hp, lh = player.lastHitTime, n0 = game.projectiles.length; player.invulnerable = 0;
    _coopApplyFx({ id: net.hostId, fm: game.currentMap, pj: [{ x: player.x, y: player.y, vx: 0, vy: 0, w: 40, h: 40, life: 40, skill: 'arrow', damage: 99999, owner: 'enemy', noGravity: 1 }] });
    const p = game.projectiles[game.projectiles.length - 1]; const made = game.projectiles.length === n0 + 1 && p.owner === 'peer' && p.damage === 0;
    await new Promise((r) => setTimeout(r, 900)); return { made, hurt: player.hp < hp, stamped: player.lastHitTime !== lh }; });
  check(echo === 0 && safe.made && !safe.hurt && !safe.stamped, 'a copy is a picture: never re-sent; a forged "enemy, 99999 damage" projectile arrives as peer / 0 and cannot touch me', 'echo ' + echo + ' ' + J(safe));
  // ---- 2b. skill poses: the host opens a pose window, the guest's copy of the host strikes it ----
  await A.evaluate(() => { player._warriorBashAt = game.time | 0; player._warriorBashUntil = (game.time | 0) + 120; });
  const posed = await wait(B, () => { const h = net.peers[net.hostId]; return !!(h && h._pose && h._pose.warriorBash && h._pose.warriorBash.u > (game.time | 0)); }, 4000);
  const swap = await B.evaluate(() => { const h = net.peers[net.hostId]; const mine = player._warriorBashUntil; _coopPoseSwapIn(h); const during = (player._warriorBashUntil | 0) > (game.time | 0); _coopPoseSwapOut(); return { during, restored: player._warriorBashUntil === mine }; });
  await A.evaluate(() => { player._warriorBashUntil = 0; }); const ended = await wait(B, () => { const h = net.peers[net.hostId]; return !!(h && h._pose && !h._pose.warriorBash); }, 4000);
  check(posed && swap.during && swap.restored && ended, 'a skill pose opens on the partner\'s avatar, is swapped in only while drawing them, and ends when it ends', J({ posed, swap, ended }));
  // ---- 3. batched hits ----
  const bh = await (async () => { await A.evaluate(() => { window.__dmgFrames = 0; const oh = _mpHandle; _mpHandle = function (m) { if (m && m.t === 'dmg' && (m.l || m.u != null)) window.__dmgFrames++; return oh.apply(this, arguments); }; window.__hp0 = game.monsters[0].currentHp; window.__uid = game.monsters[0].uid; });
    await B.evaluate((uid) => { const m = game.monsters.find((x) => x.uid === uid); for (let i = 0; i < 30; i++) _coopSendDamage(m, 100, false, 'test'); _coopActionFlush(true); }, await A.evaluate(() => window.__uid));
    await A.waitForTimeout(700); return A.evaluate(() => ({ frames: window.__dmgFrames, lost: window.__hp0 - game.monsters[0].currentHp })); })();
  check(bh.frames <= 2 && bh.lost === 3000, '30 hits in one frame travel as one message and all 30 land', J(bh));
  // ---- 4. a paused host: nobody's target, still hands out loot ----
  await B.evaluate(() => { player.x += 700; player.vx = 0; }); await A.waitForFunction(() => { const g = Object.values(net.peers)[0]; return g && Math.abs(g.x - player.x) > 500; }, null, { timeout: 5000 }).catch(() => {});
  const idle = await A.evaluate(async () => { game.monsters.length = 0; const b = spawnMonster(player.x + 80, player.y - 40, 'mooma', true); b.maxHp = b.currentHp = 9e6; const g = Object.values(net.peers)[0];
    const step = () => { for (let i = 0; i < 12; i++) _lxCoopWorldStep(16.67); }; game.paused = false; for (let i = 0; i < 12; i++) updateMonsters(16.67); const live = b._coopAggroId;
    game.paused = true; step(); const paused = b._coopAggroId; game.drops.push({ type: 'item', x: player.x, y: player.y, life: 60000, item: { name: 'Test Blade', slot: 'weapon', rarity: 'common', price: 1 } }); step(); game.paused = false;
    return { live: live == null ? null : +live, paused: paused == null ? null : +paused, guest: +g.id }; });
  const gotDrop = await wait(B, () => (game.drops || []).some((d) => d && d.item && d.item.name === 'Test Blade'), 4000);
  check(idle.live === null && idle.paused === idle.guest, 'a boss beside the host targets the host - until the host pauses, then the partner', J(idle));
  check(gotDrop, 'a paused host still relays the loot');
  // ---- 5. away: the next player takes the world at once, and gives it back ----
  await A.evaluate(() => { game.monsters.length = 0; const m = spawnMonster(player.x + 300, player.y - 20, 'slime', false); m.maxHp = m.currentHp = 5e6; }); await wait(B, () => game.monsters.some((m) => m._coopMirror));
  // the page is not really hidden, so the detector would undo a hand-set away on the next frame: hold it still
  const t0 = Date.now(); await A.evaluate(() => { window.__awayTick = _coopAwayTick; _coopAwayTick = function () {}; _coopSetAway(true); });
  const took = await wait(B, () => net.isHost === true, 3000); const tookMs = Date.now() - t0;
  const afterB = await B.evaluate(() => ({ mons: game.monsters.length, mirrors: game.monsters.filter((m) => m._coopMirror).length })); const aFollows = await wait(A, () => net.isHost === false && game.monsters.some((m) => m._coopMirror), 4000);
  check(took && tookMs < 1500 && afterB.mons >= 1 && afterB.mirrors === 0 && aFollows, 'host says "away": the guest owns the world within 1.5 s, its mirrors become real, the old host follows', `${tookMs} ms ` + J(afterB));
  await A.evaluate(() => { _coopSetAway(false); _coopAwayTick = window.__awayTick; }); const back = await wait(A, () => net.isHost === true, 3000) && await wait(B, () => net.isHost === false, 3000);
  check(back, 'and takes it back on return');
  const det = await A.evaluate(() => { const realNow = performance.now.bind(performance); let t = realNow(); performance.now = () => t; const hid = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');
    game.monsters.length = 0;   // while the guest hosted, its spawner may have rolled a natural boss - and a boss rightly blocks the paused handoff
    const out = {}; try { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); net._hiddenAt = 0; _coopAwayTick(); t += 9000; _coopAwayTick(); out.at9s = !!net._away; t += 1500; _coopAwayTick(); out.at10s = !!net._away;
      delete document.hidden; _coopAwayTick(); out.back = !!net._away;
      game.paused = true; _coopAwayTick(); t += 21000; _coopAwayTick(); out.paused21s = !!net._away; game.paused = false; _coopAwayTick(); out.unpaused = !!net._away;
      const b = spawnMonster(player.x + 400, player.y - 40, 'mooma', true); game.paused = true; net._pausedAt = 0; _coopAwayTick(); t += 21000; _coopAwayTick(); out.pausedMidBoss = !!net._away; game.paused = false; _coopAwayTick(); game.monsters.splice(game.monsters.indexOf(b), 1);
    } finally { try { delete document.hidden; } catch (e) {} performance.now = realNow; net._hiddenAt = 0; net._pausedAt = 0; } return out; });
  check(det.at9s === false && det.at10s === true && det.back === false && det.paused21s === true && det.unpaused === false && det.pausedMidBoss === false, 'the detector: hidden 10 s or paused 20 s hands over, returning takes back, and a host paused mid-boss keeps the fight', J(det));
  const legacy = await B.evaluate(() => { const p = Object.values(net.peers)[0]; const cap = p.cap; p.cap = 0; p._away = true; _coopRecomputeHost(); const h = net.isHost; p.cap = cap; p._away = false; _coopRecomputeHost(); return h; });
  check(legacy === false, 'with an older build in the room the old election stands (away is ignored)');
  // ---- 6. the budget, on a virtual clock: 10 s of 60 fps frames through a counting socket ----
  const budget = await B.evaluate(() => { const run = (peerCap) => { const realNow = performance.now.bind(performance); let t = 1e6; const sent = {}; let kills = 0, killsOut = 0;
      const fake = { readyState: 1, send(s) { const k = JSON.parse(s).t; sent[k] = (sent[k] || 0) + 1; if (k === 'kill') killsOut++; } };
      const keep = { ws: net.ws, connected: net.connected, myId: net.myId, peers: net.peers, isHost: net.isHost, hostId: net.hostId, map: game.currentMap };
      performance.now = () => t; _lxMpBudgetWrap(fake); net.ws = fake; net.connected = true; net.myId = 1; net.isHost = true; net.hostId = 1;
      net.peers = { 2: { id: 2, map: game.currentMap, cap: peerCap, x: 0, y: 0, _last: t } }; net._lastTickAt = 0; net._coopMonAt = 0; net._coopProjAt = 0; net._coopHazAt = 0;
      for (let f = 0; f < 600; f++) { t += 16.667; net.peers[2]._last = t; _mpTick(); _coopTickMonsters(); _coopTickProjectiles(); _coopTickHazards(); if (f % 12 === 0) { kills++; fake.send(JSON.stringify({ t: 'kill', u: f })); } }
      performance.now = realNow; net._lastTickAt = net._coopMonAt = net._coopProjAt = net._coopHazAt = net._actAt = net._lastLookSyncAt = 0; Object.assign(net, { ws: keep.ws, connected: keep.connected, myId: keep.myId, peers: keep.peers, isHost: keep.isHost, hostId: keep.hostId });
      const total = Object.values(sent).reduce((a, b) => a + b, 0); return { perSec: +(total / 10).toFixed(1), sent, kills, killsOut, skipped: net._budget.skipped }; };
    return { bundled: run(2), legacy: run(0) }; });
  check(budget.bundled.perSec <= 38 && !budget.bundled.sent.proj && !budget.bundled.sent.haz && budget.bundled.skipped === 0, 'new partner: projectiles and hazards ride the monster frame, under the relay\'s 40/s with nothing skipped', J(budget.bundled));
  check(budget.legacy.perSec <= 40 && budget.legacy.killsOut === budget.legacy.kills && budget.legacy.skipped > 0 && budget.legacy.sent.proj > 0, 'older partner: separate frames stay, my own bucket thins position frames and EVERY kill still goes out', J(budget.legacy));
  check(!errs.length, 'no page errors', errs.slice(0, 3).join(' | '));
} catch (e) { check(false, 'harness error', String(e.message).slice(0, 300)); }
await browser.close(); relay.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
