// Certify the hardening fixes: DEF-resolved forwarded damage, follower contact
// damage (no more invincible followers), and the host-side invuln reject gate.
import { chromium } from 'playwright-core';
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = 'http://localhost:8080/mojiworld_game.html', WS = 'ws://localhost:8080', MAP = 'glasswindSteppe';
const ROOM = 'hard' + (process.env.RUN_TAG || Math.floor(Math.random() * 1e6));
const results = [];
const ok = (n, c, extra) => results.push({ n, pass: !!c, extra });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function boot(browser, name) {
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  page._errors = []; page.on('pageerror', e => page._errors.push(String(e).slice(0, 160)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof net === 'object' && typeof mpConnect === 'function', null, { timeout: 30000 });
  await page.waitForTimeout(3500);
  await page.evaluate((nm) => { try { player.cls = 'warrior'; if (player.look) player.look.name = nm; game.paused = false; window._prologueActive = false; } catch (e) {} }, name);
  return page;
}
const ev = (p, f, a) => p.evaluate(f, a);
const pump = (p) => p.evaluate(() => { window.__pump = setInterval(() => { try { _mpTick(); } catch (e) {} try { _coopTickMonsters(); } catch (e) {} }, 90); });
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
try {
  const A = await boot(browser, 'Alice'), B = await boot(browser, 'Bob');
  await ev(A, ({ ws, room }) => mpConnect(ws, 'Alice', room), { ws: WS, room: ROOM }); await sleep(600);
  await ev(B, ({ ws, room }) => mpConnect(ws, 'Bob', room), { ws: WS, room: ROOM }); await sleep(700);
  await pump(A); await pump(B); await sleep(500);
  await ev(A, (m) => loadMap(m), MAP); await sleep(400);
  await ev(B, (m) => loadMap(m), MAP); await sleep(2200);

  const bUids = await ev(B, () => game.monsters.filter(m => m._coopMirror).map(m => m.uid));
  ok('non-host mirrors present', bUids.length > 0, { n: bUids.length });

  // (1) DEF RESOLUTION: give a mirror big DEF on the host, then the non-host hits
  // it with a fixed raw amount; the host must apply the DEF-curve-reduced value,
  // not the raw amount.
  const tUid = bUids[0];
  await ev(A, (u) => { const m = game.monsters.find(x => x.uid === u); if (m) { m.def = 600; m.isBoss = false; m.currentHp = 100000; m.maxHp = 100000; } }, tUid);
  await sleep(300);
  const rawHit = 10000;
  const hpBefore = await ev(A, (u) => { const m = game.monsters.find(x => x.uid === u); return m ? m.currentHp : null; }, tUid);
  await ev(B, ({ u, raw }) => { const m = game.monsters.find(x => x.uid === u); if (m) hitMonster(m, raw, false, 'certtest'); }, { u: tUid, raw: rawHit });
  await sleep(500);
  const hpAfter = await ev(A, (u) => { const m = game.monsters.find(x => x.uid === u); return m ? m.currentHp : 'GONE'; }, tUid);
  const applied = (typeof hpAfter === 'number') ? (hpBefore - hpAfter) : null;
  // DEF 600 -> 300/(600+300)=0.333, combo ~1 -> ~3333, definitely < the raw 10000.
  ok('forwarded damage is DEF-reduced (not raw)', applied != null && applied < rawHit * 0.6 && applied > 0, { rawHit, applied });

  // (2) INVULN GATE: mark the monster invulnerable on the host; a forwarded hit must be rejected.
  await ev(A, (u) => { const m = game.monsters.find(x => x.uid === u); if (m) { m.invulnerable = 5000; m.currentHp = 50000; } }, tUid);
  await sleep(200);
  const hpIB = await ev(A, (u) => { const m = game.monsters.find(x => x.uid === u); return m ? m.currentHp : null; }, tUid);
  await ev(B, (u) => { const m = game.monsters.find(x => x.uid === u); if (m) hitMonster(m, 99999, true, 'certtest'); }, tUid);
  await sleep(500);
  const hpIA = await ev(A, (u) => { const m = game.monsters.find(x => x.uid === u); return m ? m.currentHp : 'GONE'; }, tUid);
  ok('host rejects damage during invuln window', hpIA === hpIB, { hpIB, hpIA });

  // (3) FOLLOWER CONTACT DAMAGE: overlap the follower with a mirror, run
  // updateMonsters on the follower, and confirm the follower takes damage (was
  // invincible before — all monster->player damage was suppressed).
  const setup = await ev(B, (u) => {
    const m = game.monsters.find(x => x.uid === u);
    if (!m) return { placed: false };
    m.currentHp = 99999; m.atk = 300; m.isBoss = false; m.isMiniBoss = false;
    player.x = m.x; player.y = m.y; player.w = player.w || 30; player.h = player.h || 40;
    player.invulnerable = 0; player._god = false; player.hp = player.maxHp = 5000;
    return { placed: true, hp0: player.hp, overlap: (typeof aabb === 'function') ? aabb(player, m) : null };
  }, tUid);
  ok('follower overlaps a mirror monster', setup.placed && setup.overlap === true, setup);
  // Run several frames of the follower's monster update -> contact tick should bite once (i-frame gates the rest).
  const hpDrop = await ev(B, () => {
    const before = player.hp;
    for (let i = 0; i < 5; i++) { updateMonsters(16); player.invulnerable = 0; }  // clear i-frame between ticks to allow repeated bites
    return { before, after: player.hp, dropped: before - player.hp };
  });
  ok('follower TAKES contact damage from a mirror (not invincible)', hpDrop.dropped > 0, hpDrop);

  ok('no page errors (host)', A._errors.length === 0, A._errors.slice(0, 4));
  ok('no page errors (peer)', B._errors.length === 0, B._errors.slice(0, 4));
} catch (e) { results.push({ n: 'HARNESS ERROR', pass: false, extra: String(e).slice(0, 300) }); }
finally { await browser.close(); }
const passed = results.filter(r => r.pass).length;
console.log('\n=== CO-OP HARDENING (DEF / invuln / follower danger) ===');
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra !== undefined ? '  ' + JSON.stringify(r.extra) : ''}`);
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
