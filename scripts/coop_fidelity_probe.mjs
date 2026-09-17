// CO-OP FIDELITY PROBE. Two real browser clients through the real relay (mp/server.mjs, the same 40 msg/s token
// bucket the deployed worker runs), a boss fight on a shared map, and MEASUREMENTS instead of assumptions:
//   1. what the host SENT per message type vs what the guest RECEIVED (relay drops show up here);
//   2. what the guest SEES of the host's skills (projectiles / sprite bursts / hazards born near the host's avatar);
//   3. how far the guest's copy of the host's avatar is from where the host really is.
// Both pages are pumped at 60 Hz by a timer, because headless renders ~13 fps and the co-op ticks are wall-clock
// throttled inside a per-frame call: without the pump the measured rates would be a quarter of real play.
//
//   [SERVE_ROOT=<dir with mp/, data/, art>] node scripts/coop_fidelity_probe.mjs [page.html] [--secs=12] [--json=out.json]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11120';
const pageArg = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'mojiworld_game.html';
const PAGE = path.basename(pageArg);   // the relay serves files from its root
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const SECS = Number(arg('secs', 12)), JSON_OUT = arg('json', '');
const relay = spawn(process.execPath, [path.join(SERVE_ROOT, 'mp', 'server.mjs')], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env, PORT } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--disable-gpu'] });
const URL_ = `http://localhost:${PORT}/${PAGE}?dev=1`, WS = `ws://localhost:${PORT}`, ROOM = 'fid' + Math.floor(Math.random() * 1e9);
const boot = async (name) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 } }); const page = await ctx.newPage();
  page._errs = []; page.on('pageerror', (e) => page._errs.push(String(e.message).slice(0, 160)));
  await page.goto(URL_, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof net === 'object' && typeof mpConnect === 'function' && typeof loadMap === 'function' && typeof SKILL_FNS !== 'undefined', null, { timeout: 180000 });
  await page.waitForTimeout(3500);
  await page.evaluate((nm) => { try { _lxBootGateDone = true; _prologueActive = false; _playStoryBeat = function () { return false; }; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'mage'; player.job = 'wizard'; player.level = 60; player._god = true; player.maxMp = 99999; player.mp = 99999; player.maxHp = 999999; player.hp = 999999; if (player.look) player.look.name = nm; game.paused = false; }, name);
  return page;
};
const out = { page: PAGE, secs: SECS };
try {
  const A = await boot('Host'), B = await boot('Guest');
  await A.evaluate(({ ws, room }) => mpConnect(ws, 'Host', room), { ws: WS, room: ROOM });
  await A.waitForFunction(() => net.myId != null, null, { timeout: 15000 });
  await B.evaluate(({ ws, room }) => mpConnect(ws, 'Guest', room), { ws: WS, room: ROOM });
  await B.waitForFunction(() => net.myId != null, null, { timeout: 15000 });
  const INSTR = () => {   // count sends and receives by type; pump the co-op ticks at 60 Hz like a real frame loop would
    window.__sent = {}; window.__recv = {};
    const ws = net.ws, os = ws.send.bind(ws); ws.send = (s) => { try { const t = JSON.parse(s).t; window.__sent[t] = (window.__sent[t] || 0) + 1; } catch (e) {} return os(s); };
    const oh = _mpHandle; _mpHandle = function (m) { try { window.__recv[m.t] = (window.__recv[m.t] || 0) + 1; } catch (e) {} return oh.apply(this, arguments); };
    window.__pump = setInterval(() => { try { _mpTick(); _coopTickMonsters(); _coopTickProjectiles(); _coopTickHazards(); if (typeof _coopFxTick === 'function') _coopFxTick(); } catch (e) {} }, 16);
  };
  for (const P of [A, B]) await P.evaluate(() => { loadMap('glasswindSteppe', 900); game.paused = false; });
  await A.waitForTimeout(1500);
  for (const P of [A, B]) await P.evaluate(INSTR);
  await A.waitForTimeout(1200);
  out.roles = { aHost: await A.evaluate(() => net.isHost), bHost: await B.evaluate(() => net.isHost), ver: await A.evaluate(() => GAME_VERSION) };
  // the fight: a zodiac boss (projectiles + hazards) and a few mobs, next to both players
  await A.evaluate(() => { game.monsters.length = 0; const gy = player.y; spawnMonster(player.x + 320, gy - 120, 'zodiac_taurus', true); for (let i = 0; i < 5; i++) spawnMonster(player.x + 120 + i * 50, gy - 20, 'slime', false); });
  await A.waitForTimeout(800);
  for (const P of [A, B]) await P.evaluate(() => { window.__sent = {}; window.__recv = {}; window.__t0 = performance.now(); });
  // both players fight: every 900 ms the host and the guest cast their skills in turn
  const CAST = () => { window.__casts = 0; const ids = Object.keys(SKILLS).filter((k) => SKILLS[k].cls === player.cls && (!SKILLS[k].job || SKILLS[k].job === player.job) && !SKILLS[k].master).slice(0, 6); let i = 0;
    window.__castIv = setInterval(() => { try { player.mp = 99999; for (const k of Object.keys(player.skillCooldowns || {})) player.skillCooldowns[k] = 0; const id = ids[i++ % ids.length]; if (SKILL_FNS[id]) { SKILL_FNS[id](); window.__casts++; } } catch (e) {} }, 900); };
  await A.evaluate(CAST); await B.evaluate(CAST);
  // what the GUEST sees around the HOST's avatar while the host casts
  await B.evaluate(() => { window.__seen = { proj: 0, burst: 0, haz: 0 }; const hostId = net.hostId; const seenP = new WeakSet(), seenB = new WeakSet(), seenH = new WeakSet();
    window.__seeIv = setInterval(() => { const h = net.peers[hostId]; if (!h) return; const near = (o) => Math.abs((o.x || 0) - h.x) < 420 && Math.abs((o.y || 0) - h.y) < 320;
      for (const p of game.projectiles || []) if (p && p.owner !== 'enemy' && !p._mine && !seenP.has(p) && p._peerFx) { seenP.add(p); window.__seen.proj++; }
      for (const b of (game.smoothFx || [])) if (b && b._peerFx && !seenB.has(b)) { seenB.add(b); window.__seen.burst++; window.__seen.types = window.__seen.types || {}; window.__seen.types[b.type] = (window.__seen.types[b.type] || 0) + 1; }
      for (const z of game.hazards || []) if (z && z._peerFx && !seenH.has(z)) { seenH.add(z); window.__seen.haz++; } }, 50); });
  // avatar error: sample where the guest draws the host vs where the host is (the host walks back and forth)
  await A.evaluate(() => { let d = 1; window.__walkIv = setInterval(() => { player.vx = 3.2 * d; player.x += 3.2 * d; if (Math.random() < 0.03) d = -d; }, 16); });
  const errs = [];
  const tEnd = Date.now() + SECS * 1000;
  while (Date.now() < tEnd) {
    const [ha, gb] = await Promise.all([A.evaluate(() => ({ x: player.x, y: player.y })), B.evaluate(() => { const h = net.peers[net.hostId]; return h ? { x: (h._rx != null ? h._rx : h.x), y: (h._ry != null ? h._ry : h.y), raw: h.x } : null; })]);
    if (gb) errs.push(Math.abs(gb.x - ha.x));
    await A.waitForTimeout(100);
  }
  const grab = (P) => P.evaluate(() => ({ sent: window.__sent, recv: window.__recv, secs: (performance.now() - window.__t0) / 1000, casts: window.__casts, mons: game.monsters.length, seen: window.__seen || null }));
  const a = await grab(A), b = await grab(B);
  errs.sort((x, y) => x - y);
  out.host = a; out.guest = b; out.avatarErrPx = { mean: +(errs.reduce((s, v) => s + v, 0) / Math.max(1, errs.length)).toFixed(1), p95: errs[Math.floor(errs.length * 0.95)] | 0, max: errs[errs.length - 1] | 0, n: errs.length };
  out.errors = A._errs.concat(B._errs).slice(0, 4);
  const rate = (o, s) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, +(v / s).toFixed(1)]));
  console.log('build ' + out.roles.ver + '   A host=' + out.roles.aHost + '  B host=' + out.roles.bHost);
  console.log('HOST sent/s  :', JSON.stringify(rate(a.sent, a.secs)), ' total', (Object.values(a.sent).reduce((s, v) => s + v, 0) / a.secs).toFixed(1) + '/s');
  console.log('GUEST recv/s :', JSON.stringify(rate(b.recv, b.secs)));
  for (const t of ['mon', 'proj', 'haz', 'state', 'kill', 'bosshit', 'hazhit', 'drop']) { const s = a.sent[t] || 0, r = b.recv[t] || 0; if (s) console.log(`  ${t.padEnd(8)} host sent ${String(s).padStart(5)}  guest got ${String(r).padStart(5)}  lost ${(100 * (1 - r / s)).toFixed(0)}%`); }
  console.log('GUEST sent/s :', JSON.stringify(rate(b.sent, b.secs)), '  HOST recv dmg', a.recv.dmg || 0, 'of', b.sent.dmg || 0);
  console.log('guest saw of the host\'s ' + a.casts + ' casts:', JSON.stringify(b.seen));
  console.log('host avatar error on the guest (px):', JSON.stringify(out.avatarErrPx));
  console.log('page errors:', JSON.stringify(out.errors));
  if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(out, null, 1));
} catch (e) { console.log('PROBE ERROR', String(e.message).slice(0, 300)); }
await browser.close(); relay.kill();
