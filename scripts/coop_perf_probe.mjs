// CO-OP PERF PROBE. Where does a co-op boss fight spend its time? Two real clients through the real relay, a staged
// heavy fight (zodiac boss + a pack, both players casting), and every co-op code path timed on host and guest, next to
// a SOLO run of the same fight. Headless renders slowly, so read the per-second JS cost of each function and the
// guest's hit -> "the host's HP agrees" latency, not the absolute frame times.
//   [SERVE_ROOT=<dir with mp/, data/, art>] node scripts/coop_perf_probe.mjs [page.html] [--secs=12] [--mobs=24]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync, writeFileSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11125';
const PAGE = path.basename(process.argv.slice(2).find((a) => !a.startsWith('--')) || 'mojiworld_game.html');
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const SECS = Number(arg('secs', 12)), MOBS = Number(arg('mobs', 24)), JSON_OUT = arg('json', '');
const relay = spawn(process.execPath, [path.join(SERVE_ROOT, 'mp', 'server.mjs')], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env, PORT } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const URL_ = `http://localhost:${PORT}/${PAGE}?dev=1`, WS = `ws://localhost:${PORT}`;
const FNS = ['_mpHandle', '_mpTick', '_coopTickMonsters', '_coopApplyMonsters', '_coopApplyProjectiles', '_coopApplyHazards', '_coopApplyFx', '_coopFxCollect', '_coopActionFlush', '_mpDrawPeers', 'updateMonsters', 'updateProjectiles', 'updatePlayer', 'updateSmoothFx', 'drawMonsters', 'drawProjectiles', 'drawSmoothFx'];
const boot = async (name, cls, job) => { const page = await (await browser.newContext({ viewport: { width: 1280, height: 760 } })).newPage();
  page._errs = []; page.on('pageerror', (e) => page._errs.push(String(e.message).slice(0, 140)));
  await page.goto(URL_, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof mpConnect === 'function' && typeof SKILL_FNS !== 'undefined' && typeof loadMap === 'function', null, { timeout: 180000 }); await page.waitForTimeout(3500);
  await page.evaluate(([nm, cls, job]) => { try { _lxBootGateDone = true; _prologueActive = false; _playStoryBeat = function () { return false; }; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = cls; player.job = job; player.level = 60; player._god = true; player.maxMp = 99999; player.mp = 99999; if (player.look) player.look.name = nm; game.paused = false; }, [name, cls, job]); return page; };
const INSTR = (fns) => { window.__T = {}; window.__N = {}; for (const f of fns) { try { const o = window[f] || eval(f); if (typeof o !== 'function') continue; const w = function () { const t = performance.now(); try { return o.apply(this, arguments); } finally { window.__T[f] = (window.__T[f] || 0) + performance.now() - t; window.__N[f] = (window.__N[f] || 0) + 1; } }; eval(f + ' = w'); } catch (e) {} }
  window.__frames = []; let last = performance.now(); const tick = () => { const n = performance.now(); window.__frames.push(n - last); last = n; requestAnimationFrame(tick); }; requestAnimationFrame(tick);
  window.__bytes = { out: 0, inn: 0, parse: 0 };
  if (typeof net !== 'undefined' && net.ws) { const ws = net.ws, os = ws.send.bind(ws); ws.send = (s) => { window.__bytes.out += s.length; return os(s); }; const om = ws.onmessage; ws.onmessage = (ev) => { window.__bytes.inn += ev.data.length; const t = performance.now(); try { JSON.parse(ev.data); } catch (e) {} window.__bytes.parse += performance.now() - t; return om(ev); }; } };
const STAGE = (mobs) => { loadMap('glasswindSteppe', 900); game.paused = false; };
const FIGHT = (mobs) => { game.monsters.length = 0; const gy = player.y; const b = spawnMonster(player.x + 360, gy - 120, 'zodiac_taurus', true); b.maxHp = b.currentHp = 9e9;
  for (let i = 0; i < mobs; i++) { const m = spawnMonster(player.x - 300 + i * 34, gy - 20, 'slime', false); m.maxHp = m.currentHp = 9e9; } };
const CAST = () => { const ids = Object.keys(SKILLS).filter((k) => SKILLS[k].cls === player.cls && (!SKILLS[k].job || SKILLS[k].job === player.job) && !SKILLS[k].master); let i = 0;
  window.__castIv = setInterval(() => { try { player.mp = 99999; player.hp = Math.max(player.hp, 5000); for (const k of Object.keys(player.skillCooldowns || {})) player.skillCooldowns[k] = 0; const id = ids[i++ % ids.length]; if (SKILL_FNS[id]) SKILL_FNS[id](); } catch (e) {} }, 300); };
const GRAB = () => { const f = window.__frames.slice(5).sort((a, b) => a - b); const q = (p) => +(f[Math.floor(f.length * p)] || 0).toFixed(1); return { T: window.__T, N: window.__N, frames: f.length, med: q(0.5), p95: q(0.95), worst: q(0.999), bytes: window.__bytes, mons: game.monsters.length, proj: game.projectiles.length, fx: (game.smoothFx || []).length, lat: window.__lat || null }; };
const report = (label, g, secs) => { console.log(`\n${label}: ${g.frames} frames, median ${g.med} ms, p95 ${g.p95} ms, worst ${g.worst} ms   monsters ${g.mons}  projectiles ${g.proj}  fx ${g.fx}`);
  const rows = Object.entries(g.T).map(([k, v]) => [k, v / secs, (g.N[k] || 0) / secs]).sort((a, b) => b[1] - a[1]);
  for (const [k, ms, n] of rows) if (ms >= 0.5) console.log(`   ${k.padEnd(24)} ${ms.toFixed(1).padStart(7)} ms/s   ${n.toFixed(0).padStart(5)} calls/s   ${(ms / Math.max(1, n)).toFixed(3)} ms/call`);
  if (g.bytes) console.log(`   wire: out ${(g.bytes.out / 1024 / secs).toFixed(1)} KB/s, in ${(g.bytes.inn / 1024 / secs).toFixed(1)} KB/s, JSON.parse ${(g.bytes.parse / secs).toFixed(1)} ms/s`); };
const out = {};
try {
  // ---- solo baseline ----
  const S = await boot('Solo', 'mage', 'wizard'); await S.evaluate(STAGE, MOBS); await S.waitForTimeout(1500); await S.evaluate(FIGHT, MOBS); await S.evaluate(INSTR, FNS); await S.evaluate(CAST);
  await S.waitForTimeout(SECS * 1000); out.solo = await S.evaluate(GRAB); report('SOLO', out.solo, SECS); await S.context().close();
  // ---- co-op ----
  const A = await boot('Host', 'mage', 'wizard'), B = await boot('Guest', 'archer', 'ranger'); const ROOM = 'perf' + Math.floor(Math.random() * 1e9);
  await A.evaluate(({ ws, room }) => mpConnect(ws, 'Host', room), { ws: WS, room: ROOM }); await A.waitForFunction(() => net.myId != null, null, { timeout: 15000 });
  await B.evaluate(({ ws, room }) => mpConnect(ws, 'Guest', room), { ws: WS, room: ROOM }); await B.waitForFunction(() => net.myId != null, null, { timeout: 15000 });
  await A.evaluate(STAGE, MOBS); await B.evaluate(STAGE, MOBS); await A.waitForTimeout(2500); await A.evaluate(FIGHT, MOBS);
  await B.waitForFunction((n) => game.monsters.filter((m) => m._coopMirror).length >= n, MOBS, { timeout: 15000 }).catch(() => {});
  await A.evaluate(INSTR, FNS); await B.evaluate(INSTR, FNS);
  // the guest's hit -> "the host's copy agrees" latency: a marked hit, then poll the mirror's host-written HP
  await B.evaluate(() => { window.__lat = []; const probe = () => { const m = game.monsters.find((x) => x._coopMirror && !x.isBoss && x.currentHp > 1e6); if (!m) return; const before = m.currentHp; const t0 = performance.now(); hitMonster(m, 777777, false, 'latprobe');
      const predicted = m.currentHp; let sawUp = false; const iv = setInterval(() => { if (m.currentHp > predicted + 1000) sawUp = true; if (performance.now() - t0 > 900) { clearInterval(iv); window.__lat.push({ rubberBand: sawUp, drop: before - m.currentHp }); } }, 8); };
    window.__latIv = setInterval(probe, 1300); });
  await A.evaluate(CAST); await B.evaluate(CAST);
  await A.waitForTimeout(SECS * 1000);
  out.host = await A.evaluate(GRAB); out.guest = await B.evaluate(GRAB); report('CO-OP HOST', out.host, SECS); report('CO-OP GUEST', out.guest, SECS);
  const lat = out.guest.lat || []; console.log(`\nguest hit prediction: ${lat.length} probes, HP bar rubber-banded (went back UP after my hit) in ${lat.filter((x) => x.rubberBand).length}`);
  console.log('page errors:', JSON.stringify(A._errs.concat(B._errs).slice(0, 4)));
  if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(out, null, 1));
} catch (e) { console.log('PROBE ERROR', String(e.message).slice(0, 300)); }
await browser.close(); relay.kill();
