// A co-op partner stuck in a menu (the portal's world map, any confirm) must stand still on the other screen.
// Per user: "when I click on the portal ... the other character will see me glitching while im stuck when the
// game UI ask if I want to enter the portal". A paused player is a frozen "statue", but the presence tick kept
// sending the velocity it froze with, and the partner dead-reckons a peer by that velocity for up to 8 frames:
// the statue lurched forward and snapped back on every 70 ms frame.
//   1. SENDER - a paused, mid-walk player sends vx 0, vy 0, anim 'idle'.
//   2. RECEIVER - a peer sending the SAME x/y with a non-zero velocity (an older build) is drawn still.
//   3. CONTROL - a genuinely running peer still glides (dead reckoning is not simply switched off).
//   node scripts/coop_paused_statue_test.mjs [port]   (MOJI_GAME_FILE overrides the page)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.argv[2] || 9946);
const PAGE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => typeof _mpTick === 'function' && typeof _mpHandle === 'function' && typeof loadMap === 'function', null, { timeout: 90000 });
const r = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
  try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  applyClass('warrior'); player.level = 30;
  loadMap('town', 300); await sleep(1500);
  const out = {};
  // ── 1. sender
  const sent = [];
  const saved = { ws: net.ws, connected: net.connected };
  net.ws = { readyState: 1, send: (s) => sent.push(s) }; net.connected = true;
  player.vx = 3.2; player.vy = 0; player.attacking = false;
  game.paused = true; net._lastTickAt = 0; net._lastAir = false;
  _mpTick();
  const st = sent.map((s) => { try { return JSON.parse(s); } catch (e) { return null; } }).find((m) => m && m.t === 'state');
  out.sent = st ? { vx: st.vx, vy: st.vy, anim: st.anim } : null;
  game.paused = false; net.ws = saved.ws; net.connected = saved.connected;
  // ── 2 / 3. receiver: feed snapshots at the real 14 Hz while drawing at ~60 fps, record the drawn x
  const plat = (game.mapData.platforms || []).filter((p) => p.w > 300).sort((a, b) => b.y - a.y)[0];
  const baseX = plat ? plat.x + 120 : 400, baseY = plat ? plat.y - 44 : 400;
  const run = async (id, movePerTick, vx) => {
    net.connected = true;
    const xs = [], leads = [];
    let x = baseX;
    for (let tick = 0; tick < 24; tick++) {
      _mpHandle({ t: 'state', id, x, y: baseY, vx, vy: 0, facing: 1, map: game.currentMap, anim: Math.abs(vx) > 0.5 ? 'run' : 'idle', hp: 100, maxHp: 100 });
      for (let f = 0; f < 4; f++) {
        try { ctx.save(); _mpDrawPeers(); ctx.restore(); } catch (e) { out.drawErr = String(e.message).slice(0, 120); }
        if (tick >= 4) { xs.push(net.peers[id]._rx); leads.push(net.peers[id]._rx - x); xs.stillMax = Math.max(xs.stillMax || 0, net.peers[id]._stillN | 0); }
        await sleep(17);
      }
      x += movePerTick;
    }
    const stillMax = xs.stillMax || 0;
    delete net.peers[id]; net.connected = saved.connected;
    xs.leads = leads; xs.stillMax = stillMax;
    return xs;
  };
  const statue = await run('statue', 0, 3.2);           // frozen x, frozen run velocity (an older build, paused)
  out.statueSpread = +(Math.max(...statue) - Math.min(...statue)).toFixed(2);
  out.statueOff = +(Math.max(...statue.map((v) => Math.abs(v - baseX)))).toFixed(2);
  const runner = await run('runner', 3.2 * 4.2, 3.2);    // a real runner: x advances with its velocity
  // The one way the fix could hurt a MOVING peer is by marking it still, which switches its extrapolation off.
  // So: never flagged still, and still drawn AHEAD of its last snapshot (dead reckoning; without it the lerp
  // trails behind). Step-size bounds were tried and cut - one slow headless frame makes the existing
  // extrapolation overshoot and settle back a few px on the tip as well, which is timing, not this bug.
  out.runnerStillMax = runner.stillMax;
  out.runnerLead = +(runner.leads.reduce((a, b) => a + b, 0) / runner.leads.length).toFixed(2);
  out.runnerTravel = +(runner[runner.length - 1] - runner[0]).toFixed(1);
  return out;
});
await browser.close(); server.kill();
let fails = 0; const ok = (name, c, x) => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'}  ${name}  ${JSON.stringify(x)}`); };
ok('a paused, mid-walk player broadcasts no velocity and an idle pose', r.sent && r.sent.vx === 0 && r.sent.vy === 0 && r.sent.anim === 'idle', r.sent);
ok('a peer frozen in place is drawn still - no lurch-and-snap from its stale velocity', r.statueSpread <= 1 && r.statueOff <= 1, { spread: r.statueSpread, off: r.statueOff });
ok('a genuinely running peer is never flagged still and is still dead-reckoned ahead of its snapshots', r.runnerTravel > 200 && r.runnerLead > 0 && r.runnerStillMax === 0, { travel: r.runnerTravel, lead: r.runnerLead, stillMax: r.runnerStillMax });
ok('no page errors', errs.length === 0 && !r.drawErr, errs.slice(0, 2).concat(r.drawErr ? [r.drawErr] : []));
console.log(fails ? `FAIL(${fails})` : 'ALL PASS');
process.exit(fails ? 1 : 0);
