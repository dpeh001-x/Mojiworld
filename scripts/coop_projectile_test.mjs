// Live 2-client test: enemy-projectile sync -> co-op followers take RANGED damage
// from shared monsters (closes the facetank-boss gap).
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
const ROOM = 'proj' + (process.env.RUN_TAG || Math.floor(Math.random() * 1e6));
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
// pump now also drives the host's enemy-projectile broadcast
const pump = (p) => p.evaluate(() => { window.__pump = setInterval(() => { try { _mpTick(); } catch (e) {} try { _coopTickMonsters(); } catch (e) {} try { _coopTickProjectiles(); } catch (e) {} }, 80); });
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
try {
  const A = await boot(browser, 'Alice'), B = await boot(browser, 'Bob');
  await ev(A, ({ ws, room }) => mpConnect(ws, 'Alice', room), { ws: WS, room: ROOM }); await sleep(600);
  await ev(B, ({ ws, room }) => mpConnect(ws, 'Bob', room), { ws: WS, room: ROOM }); await sleep(700);
  await pump(A); await pump(B); await sleep(500);
  await ev(A, (m) => loadMap(m), MAP); await sleep(400);
  await ev(B, (m) => loadMap(m), MAP); await sleep(2000);

  ok('B is following the host', await ev(B, () => _coopFollowingHost() === true));

  // Host spawns a stationary enemy projectile (a shared ranged hazard).
  await ev(A, () => {
    game.projectiles.push({ x: 600, y: 300, vx: 0, vy: 0, w: 64, h: 64, life: 100000, damage: 350, owner: 'enemy', skill: 'mbolt', color: '#ff5566', _normalMob: true, _zodiacAttacker: false });
  });
  // Poll until the mirror arrives (robust vs snapshot cadence) rather than a fixed sleep.
  await B.waitForFunction(() => game.projectiles.some(p => p && p._coopMirror && p.owner === 'enemy'), null, { timeout: 6000 }).catch(() => {});

  const bProj = await ev(B, () => {
    const mirrors = game.projectiles.filter(p => p && p._coopMirror && p.owner === 'enemy');
    return { count: mirrors.length, sample: mirrors[0] ? { x: mirrors[0].x, y: mirrors[0].y, d: mirrors[0].damage, w: mirrors[0].w } : null };
  });
  ok('follower received the host enemy projectile', bProj.count > 0, bProj);
  ok('mirrored projectile carries damage + size', bProj.sample && bProj.sample.d === 350 && bProj.sample.w === 64, bProj);

  // Follower stands on the projectile; its OWN updateProjectiles must collide it
  // with the local player and apply RANGED damage (the whole point).
  const dmg = await ev(B, () => {
    const p = game.projectiles.find(x => x && x._coopMirror && x.owner === 'enemy');
    if (!p) return { noProj: true };
    player._god = false; player.invulnerable = 0; player.hp = player.maxHp = 5000;
    player.x = p.x + p.w / 2 - player.w / 2; player.y = p.y + p.h / 2 - player.h / 2;
    const before = player.hp;
    for (let i = 0; i < 4; i++) { updateProjectiles(16); player.invulnerable = 0; }
    return { before, after: player.hp, dropped: before - player.hp };
  });
  ok('follower TAKES ranged damage from the mirrored projectile', dmg.dropped > 0, dmg);

  // When the host removes the projectile, the follower drops the mirror.
  await ev(A, () => { for (let i = game.projectiles.length - 1; i >= 0; i--) { if (game.projectiles[i].owner === 'enemy') game.projectiles.splice(i, 1); } });
  await sleep(500);
  const gone = await ev(B, () => game.projectiles.filter(p => p && p._coopMirror && p.owner === 'enemy').length);
  ok('mirror projectile removed when host clears it', gone === 0, { remaining: gone });

  // Solo/host must be unaffected: the host does NOT inject its own projectiles as mirrors.
  ok('host has no _coopMirror projectiles', (await ev(A, () => game.projectiles.filter(p => p && p._coopMirror).length)) === 0);

  ok('no page errors (host)', A._errors.length === 0, A._errors.slice(0, 4));
  ok('no page errors (follower)', B._errors.length === 0, B._errors.slice(0, 4));
} catch (e) { results.push({ n: 'HARNESS ERROR', pass: false, extra: String(e).slice(0, 300) }); }
finally { await browser.close(); }
const passed = results.filter(r => r.pass).length;
console.log('\n=== CO-OP ENEMY-PROJECTILE SYNC (ranged damage) ===');
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra !== undefined ? '  ' + JSON.stringify(r.extra) : ''}`);
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
