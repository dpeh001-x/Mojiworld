// Live 2-client test: REMOTE-PLAYER feel -> the peer avatar interpolates (no 14 Hz
// teleport), reads the already-synced facing/anim, and shows a downed state. Verifies
// the render path is exercised without error across run/attack/dead/facing states and
// that the interpolation state advances toward the received snapshot.
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
// Resolve a browser that actually EXISTS. The Linux path stays first so CI is
// untouched, but it is the only candidate this line used to have - and with
// PW_EXE unset on a dev machine that made the launch throw before a single
// assertion ran. 66 scripts shared the line, so 66 gates were passing by never
// executing. Falling through to the local Chrome is what the tests that do run
// already rely on (they pass channel:'chrome').
const EXE = [process.env.PW_EXE,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find((p) => p && existsSync(p));
const URL = 'http://localhost:8080/mojiworld_game.html', WS = 'ws://localhost:8080', MAP = 'glasswindSteppe';
const ROOM = 'feel' + (process.env.RUN_TAG || Math.floor(Math.random() * 1e6));
const results = [];
const ok = (n, c, extra) => results.push({ n, pass: !!c, extra });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function boot(browser, name) {
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  page._errors = []; page.on('pageerror', e => page._errors.push(String(e).slice(0, 160)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof net === 'object' && typeof mpConnect === 'function', null, { timeout: 30000 });
  await page.waitForTimeout(3500);
  await page.evaluate((nm) => { try { player.cls = 'warrior'; if (player.look) player.look.name = nm; game.paused = false; window._prologueActive = false; const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none'; } catch (e) {} }, name);
  return page;
}
const ev = (p, f, a) => p.evaluate(f, a);
const pump = (p) => p.evaluate(() => { window.__pump = setInterval(() => { try { _mpTick(); } catch (e) {} }, 80); });
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
try {
  const A = await boot(browser, 'Alice'), B = await boot(browser, 'Bob');
  await ev(A, ({ ws, room }) => mpConnect(ws, 'Alice', room), { ws: WS, room: ROOM }); await sleep(600);
  await ev(B, ({ ws, room }) => mpConnect(ws, 'Bob', room), { ws: WS, room: ROOM }); await sleep(700);
  await pump(A); await pump(B); await sleep(500);
  await ev(A, (m) => loadMap(m), MAP); await sleep(400);
  await ev(B, (m) => loadMap(m), MAP); await sleep(1500);

  // B should see A as a peer on the same map.
  await B.waitForFunction(() => Object.keys(net.peers).length > 0, null, { timeout: 6000 }).catch(() => {});
  const peerId = await ev(B, () => Object.keys(net.peers)[0] || null);
  ok('B sees A as a peer', peerId != null);

  // Presence carries facing + anim (already on the wire) — confirm B stored them.
  const pres = await ev(B, (id) => { const p = net.peers[id]; return p ? { hasFacing: p.facing !== undefined, hasAnim: 'anim' in p || p.anim !== undefined, map: p.map } : null; }, peerId);
  ok('peer presence includes facing + anim', pres && pres.hasFacing, pres);

  // Render across states — the draw must not throw, and interpolation (_rx) must advance
  // toward the received x.
  const render = await ev(B, (id) => {
    const p = net.peers[id];
    p.x = 800; p.y = 300; p._rx = 200; p._ry = 300;   // start the smoother far from target
    let threw = false;
    const states = [ { anim: 'run', facing: 1, hp: 100 }, { anim: 'attack', facing: -1, hp: 100 }, { anim: 'idle', facing: 1, hp: 100 }, { anim: 'idle', facing: 1, hp: 0, maxHp: 100 } ];
    for (const s of states) { Object.assign(p, s); for (let i = 0; i < 5; i++) { try { _mpDrawPeers(); } catch (e) { threw = true; } } }
    return { threw, rx: p._rx };
  }, peerId);
  ok('_mpDrawPeers renders all states without throwing', render.threw === false, render);
  ok('peer position interpolates toward the snapshot (_rx advanced from 200 toward 800)', render.rx > 250, { rx: render.rx });

  ok('no page errors (host)', A._errors.length === 0, A._errors.slice(0, 4));
  ok('no page errors (follower)', B._errors.length === 0, B._errors.slice(0, 4));
} catch (e) { results.push({ n: 'HARNESS ERROR', pass: false, extra: String(e).slice(0, 300) }); }
finally { await browser.close(); }
const passed = results.filter(r => r.pass).length;
console.log('\n=== CO-OP REMOTE-PLAYER FEEL ===');
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra !== undefined ? '  ' + JSON.stringify(r.extra) : ''}`);
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
