// Live 2-client test: LOOT DROP sync -> a co-op follower now gets its OWN copy of the
// host's item drops + boon orbs from shared monster kills (previously ALL drop creation
// was host-only, so guests saw zero loot). Coins are NOT synced here (paid via 'kill').
import { chromium } from 'playwright-core';
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = 'http://localhost:8080/mojiworld_game.html', WS = 'ws://localhost:8080', MAP = 'glasswindSteppe';
const ROOM = 'loot' + (process.env.RUN_TAG || Math.floor(Math.random() * 1e6));
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
const pump = (p) => p.evaluate(() => { window.__pump = setInterval(() => { try { _mpTick(); } catch (e) {} try { _coopTickMonsters(); } catch (e) {} try { _coopTickDrops(); } catch (e) {} }, 80); });
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
try {
  const A = await boot(browser, 'Alice'), B = await boot(browser, 'Bob');
  await ev(A, ({ ws, room }) => mpConnect(ws, 'Alice', room), { ws: WS, room: ROOM }); await sleep(600);
  await ev(B, ({ ws, room }) => mpConnect(ws, 'Bob', room), { ws: WS, room: ROOM }); await sleep(700);
  await pump(A); await pump(B); await sleep(500);
  await ev(A, (m) => loadMap(m), MAP); await sleep(400);
  await ev(B, (m) => loadMap(m), MAP); await sleep(2000);
  ok('B is following the host', await ev(B, () => _coopFollowingHost() === true));

  // Host pushes an ITEM drop (as killMonster would). _coopTickDrops broadcasts it.
  await ev(A, () => {
    game.drops.push({ x: 640, y: 300, vy: -6, type: 'item',
      item: { name: 'Test Blade', rarity: 'epic', slot: 'weapon', atk: 42, tier: 5 }, life: 3600, noMagnet: false });
    // a coin drop too — must NOT be synced (guest already paid via 'kill')
    game.drops.push({ x: 660, y: 300, vy: -4, type: 'mojicoin', value: 25, life: 400 });
  });
  await B.waitForFunction(() => game.drops.some(d => d && d._coopMirror && d.type === 'item'), null, { timeout: 6000 }).catch(() => {});

  const bItem = await ev(B, () => {
    const m = game.drops.filter(d => d && d._coopMirror && d.type === 'item');
    return { count: m.length, sample: m[0] ? { name: m[0].item && m[0].item.name, rarity: m[0].item && m[0].item.rarity, atk: m[0].item && m[0].item.atk } : null };
  });
  ok('follower received the host item drop', bItem.count > 0, bItem);
  ok('mirrored item carries full stats (name/rarity/atk)', bItem.sample && bItem.sample.name === 'Test Blade' && bItem.sample.rarity === 'epic' && bItem.sample.atk === 42, bItem);
  ok('coin drop NOT synced (no double-pay)', (await ev(B, () => game.drops.filter(d => d && d._coopMirror && d.type === 'mojicoin').length)) === 0);

  // Host pushes a BOON orb -> follower gets its own orb (independent boon).
  await ev(A, () => { spawnPowerupOrb(700, 300, 'rare'); });
  await B.waitForFunction(() => (game.powerupOrbs || []).some(o => o && o._coopMirror), null, { timeout: 6000 }).catch(() => {});
  const bOrb = await ev(B, () => {
    const m = (game.powerupOrbs || []).filter(o => o && o._coopMirror);
    return { count: m.length, hasPw: !!(m[0] && m[0].pw), rarity: m[0] && m[0].rarity };
  });
  ok('follower received a boon orb copy', bOrb.count > 0 && bOrb.hasPw, bOrb);

  // The follower can PICK UP the mirrored item — the real pickup loop lives in
  // updatePlayer, which followers run. Re-center on the drop each frame to defeat
  // gravity drift so the magnet/pickup engages.
  const pick = await ev(B, () => {
    const d = game.drops.find(x => x && x._coopMirror && x.type === 'item');
    if (!d) return { noDrop: true };
    if (!player.inventory) player.inventory = [];
    const invBefore = player.inventory.length;
    d.noMagnet = false; game.paused = false;
    for (let i = 0; i < 40; i++) { player.x = d.x - player.w / 2; player.y = d.y - player.h / 2; try { updatePlayer(16); } catch (e) {} if (!game.drops.includes(d)) break; }
    return { invBefore, invAfter: (player.inventory || []).length, dropGone: !game.drops.includes(d) };
  });
  ok('follower can pick up the mirrored item (inventory grows)', pick && !pick.noDrop && (pick.invAfter > pick.invBefore || pick.dropGone), pick);

  // Host must NOT mirror its own drops.
  ok('host has no _coopMirror drops', (await ev(A, () => game.drops.filter(d => d && d._coopMirror).length)) === 0);

  ok('no page errors (host)', A._errors.length === 0, A._errors.slice(0, 4));
  ok('no page errors (follower)', B._errors.length === 0, B._errors.slice(0, 4));
} catch (e) { results.push({ n: 'HARNESS ERROR', pass: false, extra: String(e).slice(0, 300) }); }
finally { await browser.close(); }
const passed = results.filter(r => r.pass).length;
console.log('\n=== CO-OP LOOT DROP SYNC ===');
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra !== undefined ? '  ' + JSON.stringify(r.extra) : ''}`);
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
