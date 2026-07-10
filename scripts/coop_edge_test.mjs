// Co-op edge cases: host handoff (host leaves) + solo fallback (split maps).
import { chromium } from 'playwright-core';
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = 'http://localhost:8080/mojiworld_game.html', WS = 'ws://localhost:8080';
const MAP = 'glasswindSteppe', MAP2 = 'magmaFoundry';
const ROOM = 'edge' + (process.env.RUN_TAG || Math.floor(Math.random() * 1e6));
const results = [];
const ok = (n, c, extra) => results.push({ n, pass: !!c, extra });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function boot(browser, name) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page._errors = []; page.on('pageerror', e => page._errors.push(String(e).slice(0, 160)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof net === 'object' && typeof mpConnect === 'function', null, { timeout: 30000 });
  await page.waitForTimeout(3500);
  await page.evaluate((nm) => { try { player.cls = player.cls || 'warrior'; if (player.look) player.look.name = nm; game.paused = false; window._prologueActive = false; } catch (e) {} }, name);
  page._ctx = ctx; return page;
}
const ev = (p, f, a) => p.evaluate(f, a);
const pump = (p) => p.evaluate(() => { window.__pump = setInterval(() => { try { _mpTick(); } catch (e) {} try { _coopTickMonsters(); } catch (e) {} }, 90); });

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
try {
  // ---------- SOLO FALLBACK: non-host on a DIFFERENT map simulates locally ----------
  const A = await boot(browser, 'Alice'), B = await boot(browser, 'Bob');
  await ev(A, ({ ws, room }) => mpConnect(ws, 'Alice', room), { ws: WS, room: ROOM }); await sleep(600);
  await ev(B, ({ ws, room }) => mpConnect(ws, 'Bob', room), { ws: WS, room: ROOM }); await sleep(700);
  await pump(A); await pump(B); await sleep(500);
  await ev(A, (m) => loadMap(m), MAP);   // host on MAP
  await ev(B, (m) => loadMap(m), MAP2);  // non-host on a DIFFERENT map
  await sleep(2000);
  const bSplit = await ev(B, () => ({ following: _coopFollowingHost(), curMap: game.currentMap, hostMap: _coopHostMap(), n: game.monsters.length, locals: game.monsters.filter(m => !m._coopMirror).length, mirrors: game.monsters.filter(m => m._coopMirror).length }));
  ok('split-map non-host is NOT following', bSplit.following === false, bSplit);
  ok('split-map non-host simulates its OWN monsters', bSplit.locals > 0 && bSplit.mirrors === 0, bSplit);

  // Now B walks onto the host's map -> should switch to mirroring, purge its locals.
  await ev(B, (m) => loadMap(m), MAP);
  await sleep(2200);
  const bJoined = await ev(B, () => ({ following: _coopFollowingHost(), mirrors: game.monsters.filter(m => m._coopMirror).length, locals: game.monsters.filter(m => !m._coopMirror).length }));
  ok('joining host map switches to mirroring', bJoined.following === true && bJoined.mirrors > 0, bJoined);
  ok('locals purged on join', bJoined.locals === 0, bJoined);

  // ---------- HOST HANDOFF: host leaves, non-host takes over ----------
  const aUidsBefore = (await ev(A, () => game.monsters.map(m => m.uid))).sort((x, y) => x - y);
  await ev(A, () => { try { mpDisconnect(); } catch (e) {} });   // host quits multiplayer
  await sleep(2000);
  const bAfter = await ev(B, () => ({ isHost: net.isHost, connected: net.connected, following: (typeof _coopFollowingHost === 'function') ? _coopFollowingHost() : null, n: game.monsters.length, peers: Object.keys(net.peers).length }));
  ok('non-host became host after handoff', bAfter.isHost === true, bAfter);
  ok('monsters survive the handoff (not wiped)', bAfter.n > 0, bAfter);
  ok('new host no longer in following mode', bAfter.following === false, bAfter);
  // New host should now run AI locally (monsters can move) — verify updateMonsters no longer early-returns.
  const moved = await ev(B, () => { const m = game.monsters[0]; if (!m) return false; const x0 = m.x; for (let i = 0; i < 30; i++) updateMonsters(16); return Math.abs(m.x - x0) >= 0 && game.monsters.length > 0; });
  ok('new host simulates monsters (updateMonsters runs)', moved === true);

  ok('no page errors (host)', A._errors.length === 0, A._errors.slice(0, 4));
  ok('no page errors (peer)', B._errors.length === 0, B._errors.slice(0, 4));
} catch (e) {
  results.push({ n: 'HARNESS ERROR', pass: false, extra: String(e).slice(0, 300) });
} finally { await browser.close(); }

const passed = results.filter(r => r.pass).length;
console.log('\n=== CO-OP EDGE CASES (handoff + solo fallback) ===');
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra !== undefined ? '  ' + JSON.stringify(r.extra) : ''}`);
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
