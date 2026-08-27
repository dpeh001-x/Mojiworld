// Live 2-client test: BOSS DIRECT-HIT sync -> a boss attack that writes player.hp
// inside its own AI (bypassing projectiles/hazards) now strikes co-op followers via
// the host's 'bosshit' broadcast. Covers %-maxHp nukes (fr) + raw atk hits (d),
// radius dodge, and arena-wide (radius 0) nukes.
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
const ROOM = 'bhit' + (process.env.RUN_TAG || Math.floor(Math.random() * 1e6));
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
const pump = (p) => p.evaluate(() => { window.__pump = setInterval(() => { try { _mpTick(); } catch (e) {} try { _coopTickMonsters(); } catch (e) {} }, 80); });
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
try {
  const A = await boot(browser, 'Alice'), B = await boot(browser, 'Bob');
  await ev(A, ({ ws, room }) => mpConnect(ws, 'Alice', room), { ws: WS, room: ROOM }); await sleep(600);
  await ev(B, ({ ws, room }) => mpConnect(ws, 'Bob', room), { ws: WS, room: ROOM }); await sleep(700);
  await pump(A); await pump(B); await sleep(500);
  await ev(A, (m) => loadMap(m), MAP); await sleep(400);
  await ev(B, (m) => loadMap(m), MAP); await sleep(2000);
  ok('B is following the host', await ev(B, () => _coopFollowingHost() === true));

  // Prep B's player: full HP, in range, no i-frames.
  const setup = () => ev(B, () => { player._god = false; player.invulnerable = 0; player.hp = player.maxHp = 5000; player.x = 600 - player.w / 2; player.y = 300; player.blockTimer = 0; player.cls = 'mage'; });

  // Warm-up: the very first cross-client event can land before B's handler wiring
  // fully settles. Each case below DRAINS first (park B far away for 700ms so any
  // in-flight bosshit from the previous case resolves harmlessly), then positions,
  // fires, and polls — eliminating cross-case message-timing races.
  const drain = async () => { await ev(B, () => { player.x = 20000; player.invulnerable = 0; player.hp = player.maxHp = 5000; }); await sleep(700); };

  // 1) %-maxHp proximity nuke (fr=0.5) IN range -> ~50% of B's maxHp.
  await drain();
  await ev(B, () => { player.x = 600 - player.w / 2; player.invulnerable = 0; player.hp = player.maxHp = 5000; });
  await ev(A, () => _coopBroadcastBossHit(600, 0, 220, 0, 0.5, 'Test Nuke', '#f55'));
  await B.waitForFunction(() => player.hp < 5000, null, { timeout: 3000 }).catch(() => {});
  let hp1 = await ev(B, () => player.hp);
  ok('follower TAKES a %-maxHp proximity nuke in range (~50%)', hp1 <= 3000 && hp1 >= 2000, { hp1, dropped: 5000 - hp1 });

  // 2) Same nuke but B stands OUTSIDE the radius -> no damage.
  await drain();
  await ev(B, () => { player.x = 3000; player.invulnerable = 0; player.hp = player.maxHp = 5000; });
  await ev(A, () => _coopBroadcastBossHit(600, 0, 220, 0, 0.5, 'Test Nuke', '#f55'));
  await sleep(600);
  hp1 = await ev(B, () => player.hp);
  ok('proximity nuke MISSES a follower outside the radius', hp1 === 5000, { hp1 });

  // 3) Arena-wide nuke (radius 0) hits regardless of position.
  await drain();
  await ev(B, () => { player.x = 4000; player.invulnerable = 0; player.hp = player.maxHp = 5000; });
  await ev(A, () => _coopBroadcastBossHit(0, 0, 0, 0, 0.4, 'Arena Nuke', '#f55'));
  await B.waitForFunction(() => player.hp < 5000, null, { timeout: 3000 }).catch(() => {});
  hp1 = await ev(B, () => player.hp);
  ok('arena-wide nuke (r=0) hits a follower anywhere', hp1 <= 3500 && hp1 >= 2500, { hp1, dropped: 5000 - hp1 });

  // 4) Raw atk-based hit (d) applies a flat number (DEF-reduced but positive).
  await drain();
  await ev(B, () => { player.x = 600 - player.w / 2; player.invulnerable = 0; player.hp = player.maxHp = 5000; });
  await ev(A, () => _coopBroadcastBossHit(600, 0, 200, 800, 0, 'Slam', '#f55'));
  await B.waitForFunction(() => player.hp < 5000, null, { timeout: 3000 }).catch(() => {});
  hp1 = await ev(B, () => player.hp);
  ok('follower takes a raw atk-based boss hit', hp1 < 5000, { hp1, dropped: 5000 - hp1 });

  // 5) i-frames block the strike (defensive tools honored).
  await drain();
  await ev(B, () => { player.x = 600 - player.w / 2; player.hp = player.maxHp = 5000; player.invulnerable = 1000; });
  await ev(A, () => _coopBroadcastBossHit(600, 0, 220, 0, 0.5, 'Nuke', '#f55'));
  await sleep(600);
  hp1 = await ev(B, () => player.hp);
  ok('i-frames negate the boss hit', hp1 === 5000, { hp1 });

  // 6) The HOST must NOT self-apply its own broadcast (guarded by net.isHost).
  const aHp = await ev(A, () => { player.hp = player.maxHp = 5000; player.x = 600 - player.w / 2; player.invulnerable = 0; const b = player.hp; _coopBroadcastBossHit(600, 0, 220, 0, 0.5, 'Nuke'); return { before: b, after: player.hp }; });
  ok('host does not damage itself with its own bosshit', aHp.after === aHp.before, aHp);

  ok('no page errors (host)', A._errors.length === 0, A._errors.slice(0, 4));
  ok('no page errors (follower)', B._errors.length === 0, B._errors.slice(0, 4));
} catch (e) { results.push({ n: 'HARNESS ERROR', pass: false, extra: String(e).slice(0, 300) }); }
finally { await browser.close(); }
const passed = results.filter(r => r.pass).length;
console.log('\n=== CO-OP BOSS DIRECT-HIT SYNC ===');
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra !== undefined ? '  ' + JSON.stringify(r.extra) : ''}`);
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
