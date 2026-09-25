// Stormbearer pact in a party (v0.30.996): a co-op GUEST accepts for free and sees
// the same spawn rise as the host. Two real clients through the real relay.
//   PORT=8080 node mp/server.mjs      (from a root holding the build + art)
//   node scripts/coop_stormpact_test.mjs
// Asserts: guest pays 0; host opens the pact and fills to the x1.75 cap; the guest
// sees the same rise; no free extension; a paid host pact reaches the guest; a
// request from another map is ignored. The NPC dialog types itself out - wait for
// text, never read it mid-sentence.
import { chromium } from 'playwright-core';
const PORT = process.env.PORT || 8080;
const URL = 'http://localhost:' + PORT + '/mojiworld_game.html', WS = 'ws://localhost:' + PORT;
const ROOM = 'spk' + Math.floor(Math.random() * 1e6);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = []; const ok = (n, c, x) => res.push({ n, pass: !!c, x });
async function boot(browser, name) {
  const page = await (await browser.newContext()).newPage();
  page._err = []; page.on('pageerror', (e) => page._err.push(String(e).slice(0, 160)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof net === 'object' && typeof mpConnect === 'function', null, { timeout: 30000 });
  await page.waitForTimeout(3500);
  await page.evaluate((nm) => {
    ['loading-overlay', 'class-select-modal', 'lo-menu'].forEach((id) => { const e = document.getElementById(id); if (e) e.style.display = 'none'; });
    window._prologueActive = false; window._lxBootGateDone = true; game.paused = false;
    player.cls = player.cls || 'warrior'; if (player.look) player.look.name = nm;
    player.maxHp = 999999; player.hp = 999999;
  }, name);
  return page;
}
const alive = () => game.monsters.filter((x) => x && !x.isBoss && !x.isMiniBoss && x.currentHp > 0).length;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
try {
  const A = await boot(browser, 'Alice'), B = await boot(browser, 'Bob');
  await A.evaluate(({ ws, room }) => mpConnect(ws, 'Alice', room), { ws: WS, room: ROOM });
  await A.waitForFunction(() => net.myId != null, null, { timeout: 10000 });
  await B.evaluate(({ ws, room }) => mpConnect(ws, 'Bob', room), { ws: WS, room: ROOM });
  await B.waitForFunction(() => net.myId != null, null, { timeout: 10000 });
  for (const P of [A, B]) await P.evaluate(() => { loadMap('stormCrest'); game.paused = false;
    window.__pump = setInterval(() => { try { _mpTick(); } catch (e) {} try { _coopTickMonsters(); } catch (e) {} }, 90); });
  await B.waitForFunction(() => typeof _coopFollowingHost === 'function' && _coopFollowingHost(), null, { timeout: 15000 });
  ok('roles: Alice hosts, Bob follows her on Storm Crest', await A.evaluate(() => net.isHost) && !(await B.evaluate(() => net.isHost)));
  await sleep(1500);

  // ---- 1. Bob (guest) accepts: free, and the whole map rises ---------------
  const a0 = await A.evaluate(alive), b0 = await B.evaluate(alive);
  const bCoins0 = await B.evaluate(() => { player.mojicoins = 100000; return totalCoins(); });
  const btn = await B.evaluate(() => {
    openNPC(game.npcs.find((n) => n && n.role === 'stormbearer'));
    const b = [...document.querySelectorAll('#dialog button')].find((x) => /Accept/.test(x.textContent));
    const t = b ? b.textContent.trim() : null; if (b) b.click(); return t;
  });
  await sleep(2600);
  const bCoins1 = await B.evaluate(() => totalCoins());
  ok('guest button reads free', btn === 'Accept (free in a party)', btn);
  ok('guest is charged nothing', bCoins0 === bCoins1, bCoins0 - bCoins1);
  ok('host opened the pact', await A.evaluate(() => _lxStormPactOn()));
  const aCap = await A.evaluate(() => _lxFieldCap(MAPS.stormCrest)), a1 = await A.evaluate(alive), b1 = await B.evaluate(alive);
  ok('host field rose to the pact cap', a1 >= aCap && a1 > a0, a0 + ' -> ' + a1 + ' (cap ' + aCap + ')');
  ok('GUEST SEES THE SAME RISE', b1 > b0 && b1 >= a1 - 1, b0 + ' -> ' + b1);
  ok('guest got the host confirmation', await B.evaluate(() => _lxStormPactOn()));
  // the dialog TYPES itself out, so wait for the second paragraph rather than reading mid-sentence
  await B.waitForFunction(() => /No coin from you/.test(document.getElementById('dialog-text').textContent), null, { timeout: 12000 }).catch(() => {});
  const _dlg = await B.evaluate(() => document.getElementById('dialog-text').textContent);
  ok('guest dialogue', /No coin from you/.test(_dlg), _dlg.slice(0, 110));

  // ---- 2. no free extension while it is already open -----------------------
  const until0 = await A.evaluate(() => player._spawnBoostUntil);
  await sleep(1100);
  await B.evaluate(() => typeof _lxStormPactRequest === 'function' && _lxStormPactRequest());
  await sleep(700);
  ok('an open pact is not extended for free', (await A.evaluate(() => player._spawnBoostUntil)) === until0);

  // ---- 3. a paid host pact reaches the guest -------------------------------
  await A.evaluate(() => { player._spawnBoostUntil = 0; }); await B.evaluate(() => { player._spawnBoostUntil = 0; });
  await A.evaluate(() => { player.mojicoins = 100000; openNPC(game.npcs.find((n) => n && n.role === 'stormbearer'));
    [...document.querySelectorAll('#dialog button')].find((x) => /Accept/.test(x.textContent)).click(); });
  await sleep(800);
  ok('host pays 25% as before', (await A.evaluate(() => totalCoins())) === 75000);
  ok('paid pact reaches the guest', await B.evaluate(() => _lxStormPactOn()));

  // ---- 4. security: a request from ANOTHER map must not open a pact --------
  await A.evaluate(() => { player._spawnBoostUntil = 0; });
  await B.evaluate(() => { loadMap('forest'); game.paused = false; });
  await sleep(1600);
  await B.evaluate(() => typeof _lxStormPactRequest === 'function' && _lxStormPactRequest());
  await sleep(700);
  ok('request from another map is ignored', !(await A.evaluate(() => _lxStormPactOn())));

  ok('no page errors', !A._err.length && !B._err.length, [...A._err, ...B._err].slice(0, 3));
} catch (e) {
  // a missing function or a timeout is a FAIL with a reason, not a stack trace
  ok('test ran to completion', false, String(e.message || e).slice(0, 140));
} finally { await browser.close(); }
for (const r of res) console.log((r.pass ? 'PASS ' : 'FAIL ') + r.n + (r.x !== undefined ? '  [' + JSON.stringify(r.x) + ']' : ''));
const bad = res.filter((r) => !r.pass).length;
console.log(bad ? bad + ' FAILED' : 'ALL ' + res.length + ' PASS'); process.exit(bad ? 1 : 0);
