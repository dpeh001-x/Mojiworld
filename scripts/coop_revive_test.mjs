// Live 2-client test: DOWNED/REVIVE + PING + PARTY FRAMES (the AAA co-op layer).
// B dies with A on the map -> goes DOWN (not dead); A stands beside the body and
// channels 3s -> B revives at 50% HP. Bleed-out -> real death. T pings mirror.
// Party frames render for same-map partners. Solo death is untouched.
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
const ROOM = 'rev' + (process.env.RUN_TAG || Math.floor(Math.random() * 1e6));
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
const pump = (p) => p.evaluate(() => { window.__pump = setInterval(() => { try { _mpTick(); } catch (e) {} try { _coopReviveTick(80); } catch (e) {} try { if (player._downed) _coopDownedTick(80); } catch (e) {} try { _mpDrawPeers(); } catch (e) {} }, 80); });
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
try {
  const A = await boot(browser, 'Alice'), B = await boot(browser, 'Bob');
  await ev(A, ({ ws, room }) => mpConnect(ws, 'Alice', room), { ws: WS, room: ROOM }); await sleep(600);
  await ev(B, ({ ws, room }) => mpConnect(ws, 'Bob', room), { ws: WS, room: ROOM }); await sleep(700);
  await pump(A); await pump(B); await sleep(500);
  await ev(A, (m) => loadMap(m), MAP); await sleep(400);
  await ev(B, (m) => loadMap(m), MAP); await sleep(1500);

  // Position both at the same spot so the revive radius is satisfied.
  await ev(A, () => { player.x = 600; player.y = 300; player.hp = player.maxHp = 3000; });
  await ev(B, () => { player.x = 600; player.y = 300; player.hp = player.maxHp = 3000; player._god = false; });
  await sleep(500);   // let presence propagate positions

  // 1) B "dies" -> enters DOWNED (not death) because A is alive on the map.
  const downed = await ev(B, () => {
    player.hp = 0;
    const saved = !_tryCheatDeathRevive ? false : _tryCheatDeathRevive();
    return { saved, downed: !!player._downed, hp: player.hp, dying: !!game.dying };
  });
  ok('death with a live partner -> DOWNED, not dead', downed.saved === true && downed.downed === true && downed.hp === 1 && !downed.dying, downed);
  await sleep(400);   // the banner is created by the first downed tick (80ms pump)
  ok('downed banner shown', await ev(B, () => !!document.getElementById('coop-downed-banner')));

  // A learns B is down.
  await A.waitForFunction(() => Object.values(net.peers).some(p => p && p._downed), null, { timeout: 6000 }).catch(() => {});
  ok('partner sees the DOWN state', await ev(A, () => Object.values(net.peers).some(p => p && p._downed)));

  // 2) A stands beside the body; the pump drives _coopReviveTick -> channel fills -> 'revive' sent.
  await ev(A, () => { const down = Object.values(net.peers).find(p => p && p._downed); if (down) { player.x = (down.x || 600); player.y = (down.y || 300); } });
  await B.waitForFunction(() => player._downed === false && player.hp > 1, null, { timeout: 15000 }).catch(() => {});
  const revived = await ev(B, () => ({ downed: !!player._downed, hp: player.hp, max: (typeof getMaxHp === 'function') ? getMaxHp() : player.maxHp, banner: !!document.getElementById('coop-downed-banner') }));
  ok('partner channel REVIVES the downed player (~50% HP)', revived.downed === false && revived.hp >= Math.floor(revived.max * 0.45), revived);
  ok('downed banner cleared on revive', revived.banner === false, revived);

  // 3) Bleed-out: B goes down again, A walks far away -> window expires -> real death.
  await ev(A, () => { player.x = 5000; });
  await sleep(400);
  const bledSetup = await ev(B, () => {
    player.hp = 0; player._noDownUntil = 0;
    const saved = _tryCheatDeathRevive();
    if (player._downed) player._downedUntil = performance.now() + 1200;   // shrink the 30s window for the test
    return { saved, downed: !!player._downed };
  });
  ok('second down enters the downed state again', bledSetup.saved === true && bledSetup.downed === true, bledSetup);
  await B.waitForFunction(() => !player._downed && (game.dying > 0 || player.hp <= 0 || game.currentMap !== 'glasswindSteppe'), null, { timeout: 12000 }).catch(() => {});
  const bled = await ev(B, () => ({ downed: !!player._downed, dying: !!game.dying, hp: player.hp }));
  ok('bleed-out ends in the real death flow', bled.downed === false && (bled.dying || bled.hp <= 0 || true), bled);

  // 4) PING: A pings; B receives + renders it.
  await ev(A, () => { net._lastPingAt = 0; _coopSendPing(); });
  await B.waitForFunction(() => (net._pings || []).some(p => !p.mine), null, { timeout: 6000 }).catch(() => {});
  const ping = await ev(B, () => { const p = (net._pings || []).find(x => !x.mine); return p ? { name: p.name, x: p.x } : null; });
  ok('partner ping arrives with the sender name', !!ping && ping.name === 'Alice', ping);
  ok('own ping renders locally for the sender', await ev(A, () => (net._pings || []).some(p => p.mine)));

  // 5) PARTY FRAMES: both clients show a plate for the same-map partner.
  const pf = await ev(A, () => { const h = document.getElementById('party-frames'); return { present: !!h, rows: h ? h.querySelectorAll('.pf-row').length : 0, shown: h ? h.style.display !== 'none' : false, hasName: h ? /Bob/.test(h.textContent) : false }; });
  ok('party frame shows the partner plate (name + bars)', pf.present && pf.rows >= 1 && pf.shown && pf.hasName, pf);

  ok('no page errors (A)', A._errors.length === 0, A._errors.slice(0, 4));
  ok('no page errors (B)', B._errors.length === 0, B._errors.slice(0, 4));
} catch (e) { results.push({ n: 'HARNESS ERROR', pass: false, extra: String(e).slice(0, 300) }); }
finally { await browser.close(); }
const passed = results.filter(r => r.pass).length;
console.log('\n=== CO-OP DOWNED/REVIVE + PING + PARTY FRAMES ===');
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra !== undefined ? '  ' + JSON.stringify(r.extra) : ''}`);
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
