// Live 2-client test: enemy HAZARD (meteor telegraph) sync -> follower sees the
// reticle and takes the meteor strike via the host's detonation event.
import { chromium } from 'playwright-core';
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = 'http://localhost:8080/mojiworld_game.html', WS = 'ws://localhost:8080', MAP = 'glasswindSteppe';
const ROOM = 'haz' + (process.env.RUN_TAG || Math.floor(Math.random() * 1e6));
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
const pump = (p) => p.evaluate(() => { window.__pump = setInterval(() => { try { _mpTick(); } catch (e) {} try { _coopTickMonsters(); } catch (e) {} try { _coopTickProjectiles(); } catch (e) {} try { _coopTickHazards(); } catch (e) {} }, 80); });
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
try {
  const A = await boot(browser, 'Alice'), B = await boot(browser, 'Bob');
  await ev(A, ({ ws, room }) => mpConnect(ws, 'Alice', room), { ws: WS, room: ROOM }); await sleep(600);
  await ev(B, ({ ws, room }) => mpConnect(ws, 'Bob', room), { ws: WS, room: ROOM }); await sleep(700);
  await pump(A); await pump(B); await sleep(500);
  await ev(A, (m) => loadMap(m), MAP); await sleep(400);
  await ev(B, (m) => loadMap(m), MAP); await sleep(2000);
  ok('B is following the host', await ev(B, () => _coopFollowingHost() === true));

  // Host spawns a meteor_warn telegraph about to detonate (life 3), centered at cx=600.
  await ev(A, () => {
    game.hazards.push({ type: 'meteor_warn', x: 540, cx: 600, y: 0, w: 120, h: 560, radius: 120, life: 3, maxLife: 3, timer: 3, damage: 400, owner: 'enemy', color: '#ffaa33', _sourceLabel: 'Test Meteor' });
  });
  // Follower should see the telegraph reticle (a _coopMirror hazard).
  await B.waitForFunction(() => game.hazards.some(h => h && h._coopMirror && h.type === 'meteor_warn'), null, { timeout: 6000 }).catch(() => {});
  const bHaz = await ev(B, () => {
    const m = game.hazards.filter(h => h && h._coopMirror);
    return { count: m.length, sample: m[0] ? { type: m[0].type, cx: m[0].cx, r: m[0].radius, d: m[0].damage } : null };
  });
  ok('follower sees the meteor telegraph (visual mirror)', bHaz.count > 0 && bHaz.sample && bHaz.sample.type === 'meteor_warn', bHaz);

  // Put B's player in the strike zone, then detonate the meteor on the HOST (drive
  // updateProjectiles until life hits 0 -> host broadcasts 'hazhit').
  await ev(B, () => { player._god = false; player.invulnerable = 0; player.hp = player.maxHp = 5000; player.x = 600 - player.w / 2; player.y = 300; });
  const bHpBefore = await ev(B, () => player.hp);
  await ev(A, () => { for (let i = 0; i < 5; i++) updateProjectiles(16); });   // life 3->0 detonates, broadcasts hazhit
  await sleep(600);
  const bHpAfter = await ev(B, () => player.hp);
  ok('follower TAKES the meteor strike (hazhit)', bHpAfter < bHpBefore, { bHpBefore, bHpAfter, dropped: bHpBefore - bHpAfter });

  // Zone check: the meteor strike must MISS a player outside the radius and HIT one
  // inside it (drive the real handler directly with the host's sender id).
  const zone = await ev(B, () => {
    player._god = false; player.invulnerable = 0; player.hp = player.maxHp = 5000; player.x = 600 - player.w / 2; player.y = 300;
    const hostId = net.hostId, m = game.currentMap;
    const b0 = player.hp;
    _coopApplyHazHit({ map: m, id: hostId, x: 3000, r: 120, d: 400, c: '#f93', sl: 'far' });   // out of zone
    const farDrop = b0 - player.hp;
    player.invulnerable = 0;
    _coopApplyHazHit({ map: m, id: hostId, x: 600, r: 120, d: 400, c: '#f93', sl: 'near' });    // in zone
    const nearDrop = (b0 - farDrop) - player.hp;
    return { farDrop, nearDrop };
  });
  ok('meteor misses OUTSIDE the zone, hits INSIDE', zone.farDrop === 0 && zone.nearDrop > 0, zone);

  ok('no page errors (host)', A._errors.length === 0, A._errors.slice(0, 4));
  ok('no page errors (follower)', B._errors.length === 0, B._errors.slice(0, 4));
} catch (e) { results.push({ n: 'HARNESS ERROR', pass: false, extra: String(e).slice(0, 300) }); }
finally { await browser.close(); }
const passed = results.filter(r => r.pass).length;
console.log('\n=== CO-OP HAZARD (meteor telegraph) SYNC ===');
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra !== undefined ? '  ' + JSON.stringify(r.extra) : ''}`);
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
