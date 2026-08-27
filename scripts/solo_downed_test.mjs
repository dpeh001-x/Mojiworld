// Live test: SOLO DOWNED — dying in solo now plays the 30s downed beat with a
// "▸ Respawn now" button that fast-forwards to the normal (void) death flow.
// Never connects to multiplayer, so this certifies the pure-solo path.
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
const URL = 'http://localhost:8080/mojiworld_game.html';
const results = [];
const ok = (n, c, extra) => results.push({ n, pass: !!c, extra });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page._errors = []; page.on('pageerror', e => page._errors.push(String(e).slice(0, 160)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof _tryCheatDeathRevive === 'function' && typeof loadMap === 'function', null, { timeout: 45000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => { try { player.cls = 'warrior'; game.paused = false; window._prologueActive = false; const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none'; loadMap('glasswindSteppe'); } catch (e) {} });
  await sleep(800);
  // pump the downed tick (headless rAF throttling)
  await page.evaluate(() => { window.__pump = setInterval(() => { try { if (player._downed) _coopDownedTick(80); } catch (e) {} }, 80); });

  // 1) SOLO death -> DOWNED (not instant death), with the solo banner + skip button.
  const down = await page.evaluate(() => {
    player._god = false; player.hp = 0;
    const saved = _tryCheatDeathRevive();
    return { saved, downed: !!player._downed, revivable: !!player._downRevivable, hp: player.hp,
      dying: !!game.dying, connected: !!net.connected };
  });
  ok('solo death enters DOWNED (no partner needed)', down.saved === true && down.downed === true && down.hp === 1 && !down.dying, down);
  ok('never connected — pure solo path', down.connected === false, down);
  // banner is created by the first downed tick — give the pump a beat
  await sleep(400);
  const banner = await page.evaluate(() => {
    const b = document.getElementById('coop-downed-banner');
    const btn = document.getElementById('coop-downed-skip');
    return { banner: !!b, btn: btn ? btn.textContent : null, soloSubtitle: b ? /no one can reach you/.test(b.textContent) : false };
  });
  ok('solo banner variant + Respawn button', banner.banner && banner.btn === '▸ Respawn now' && banner.soloSubtitle && down.revivable === false, banner);

  // 2) Countdown ticks down.
  const s1 = await page.evaluate(() => (document.getElementById('coop-downed-secs') || {}).textContent);
  await sleep(2400);
  const s2 = await page.evaluate(() => (document.getElementById('coop-downed-secs') || {}).textContent);
  ok('countdown ticks (' + s1 + ' -> ' + s2 + ')', parseInt(s2) < parseInt(s1), { s1, s2 });

  // 3) Clicking "Respawn now" fast-forwards to the real death flow.
  await page.evaluate(() => document.getElementById('coop-downed-skip').click());
  await page.waitForFunction(() => !player._downed && (game.dying > 0 || player.hp <= 0), null, { timeout: 8000 }).catch(() => {});
  const dead = await page.evaluate(() => ({ downed: !!player._downed, dying: !!game.dying, banner: !!document.getElementById('coop-downed-banner') }));
  ok('Respawn button fast-forwards into the death flow', dead.downed === false && dead.dying === true, dead);
  ok('banner removed on skip', dead.banner === false, dead);

  // 4) The dying->respawn sequence is driven by the rAF loop (throttled in
  // headless), so drive the respawn directly to certify the flow lands cleanly.
  const after = await page.evaluate(() => { try { respawnAtTown(); } catch (e) {} return { hp: player.hp, downed: !!player._downed }; });
  ok('respawn lands cleanly after the skip (HP restored, not downed)', after.hp > 0 && after.downed === false, after);

  ok('no page errors', page._errors.length === 0, page._errors.slice(0, 5));
} catch (e) { results.push({ n: 'HARNESS ERROR', pass: false, extra: String(e).slice(0, 300) }); }
finally { await browser.close(); }
const passed = results.filter(r => r.pass).length;
console.log('\n=== SOLO DOWNED + RESPAWN FAST-FORWARD ===');
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra !== undefined ? '  ' + JSON.stringify(r.extra) : ''}`);
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
