// CO-OP BOSS FIGHT certification.
//   1. A boss on the host targets the NEAREST player — including the GUEST
//      (was: bosses only ever chased/attacked the host).
//   2. The host's own state is untouched by a guest-targeted AI tick (position/
//      HP swap fully restored).
//   3. Hysteresis: the boss commits to its target (no flip-flop when distances
//      are similar).
//   4. Regular mobs also pick the closest player (guest included).
//   5. _coopSelfBossHit applies host damage POSITIONALLY (in-range hit lands,
//      out-of-range is safe, i-frames respected).
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
const WS  = 'ws://localhost:8080';
const ROOM = 'boss' + Math.floor(Math.random() * 1e9);
const MAP = 'glasswindSteppe';

const results = [];
const ok = (n, c, extra) => { results.push({ n, pass: !!c, extra }); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function boot(browser, name) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
  page._errors = errs;
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof net === 'object' && typeof mpConnect === 'function', null, { timeout: 30000 });
  await page.waitForTimeout(3200);
  await page.evaluate((nm) => { try { player.cls = player.cls || 'warrior'; if (player.look) player.look.name = nm; game.paused = false; window._prologueActive = false; } catch (e) {} }, name);
  return page;
}
const ev = (page, fn, arg) => page.evaluate(fn, arg);

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
try {
  const A = await boot(browser, 'Host');
  const B = await boot(browser, 'Guest');
  await ev(A, ({ ws, room }) => mpConnect(ws, 'Host', room), { ws: WS, room: ROOM });
  await A.waitForFunction(() => net.myId != null, null, { timeout: 10000 }).catch(() => {});
  await ev(B, ({ ws, room }) => mpConnect(ws, 'Guest', room), { ws: WS, room: ROOM });
  await B.waitForFunction(() => net.connected && net.myId != null, null, { timeout: 10000 }).catch(() => {});
  await sleep(600);
  await ev(A, ({ map }) => loadMap(map), { map: MAP });
  await ev(B, ({ map }) => loadMap(map), { map: MAP });
  await sleep(1200);
  const aHost = await ev(A, () => net.isHost);
  ok('A is host', aHost === true, { aHost });

  // Park the host on the LEFT, guest far on the RIGHT (real position, real ticks).
  const hostX = await ev(A, () => { player.x = 300; player.vx = 0; player.hp = player.maxHp = 100000; return player.x; });
  await ev(B, () => { player.x = 1600; player.vx = 0; player.hp = player.maxHp = 100000; });
  await sleep(700);   // let B's position propagate to A's peer entry

  // 1+2) Spawn a REAL boss next to the GUEST's position on the host sim.
  const bossRun = await ev(A, () => {
    // clear mobs so nothing else interferes
    game.monsters.length = 0;
    let b = null;
    try { b = spawnMonster(1900, player.y, 'mooma', true); } catch (e) { return { err: String(e) }; }
    if (!b) return { err: 'no boss spawned' };
    b.currentHp = b.maxHp = 999999;
    const hostBefore = { x: player.x, hp: player.hp, vx: player.vx };
    const d0 = Math.abs(b.x - 1600);
    // run 240 real sim frames of the monster world
    for (let i = 0; i < 240; i++) { try { updateMonsters(1000 / 60); } catch (e) { return { err: String(e) }; } }
    const d1 = Math.abs(b.x - 1600);
    return {
      aggroId: b._coopAggroId, d0: Math.round(d0), d1: Math.round(d1),
      movedTowardGuest: d1 < d0 - 10,
      hostUntouched: player.x === hostBefore.x && player.hp === hostBefore.hp,
      guestPeerId: (() => { for (const id in net.peers) return +id; })(),
    };
  });
  ok('boss picked the GUEST as its target (nearest player)', bossRun.aggroId != null && bossRun.aggroId === bossRun.guestPeerId, bossRun);
  ok('boss MOVED toward the guest', bossRun.movedTowardGuest, { d0: bossRun.d0, d1: bossRun.d1 });
  ok('host position/HP untouched by guest-targeted AI ticks', bossRun.hostUntouched, bossRun);

  // 3) Hysteresis: host walks slightly closer than the guest — boss should
  // STICK to the guest until the host is >25% closer.
  const hyst = await ev(A, () => {
    const b = game.monsters.find(m => m && m.isBoss);
    if (!b) return { err: 'boss gone' };
    // place host marginally closer than the guest (10% closer, inside hysteresis)
    const guestD = Math.abs(b.x + b.w / 2 - (1600 + 14));
    player.x = (b.x + b.w / 2) + guestD * 0.9 - 14;   // 10% closer from the right
    for (let i = 0; i < 30; i++) { try { updateMonsters(1000 / 60); } catch (e) {} }
    const stuck = b._coopAggroId != null;
    // now make the host DECISIVELY closer (60% closer) — boss should swap to host
    player.x = (b.x + b.w / 2) + guestD * 0.4 - 14;
    for (let i = 0; i < 30; i++) { try { updateMonsters(1000 / 60); } catch (e) {} }
    const swapped = b._coopAggroId == null;
    player.x = 300;   // restore
    return { stuck, swapped };
  });
  ok('hysteresis: boss STAYS on guest when host is only marginally closer', hyst.stuck, hyst);
  ok('hysteresis: boss SWAPS to host when host is decisively closer', hyst.swapped, hyst);

  // 4) Regular mobs pick the closest player too.
  const mob = await ev(A, () => {
    game.monsters.length = 0;
    // spawn at the GUEST's real broadcast coordinates (aggro checks y too)
    let gp = null; for (const id in net.peers) gp = net.peers[id];
    if (!gp) return { err: 'no peer' };
    let h = null;
    try { h = spawnMonster((+gp.x) - 150, +gp.y, 'glasswindHare'); } catch (e) { return { err: String(e) }; }
    if (!h) return { err: 'no mob' };
    h.currentHp = h.maxHp = 999999;
    const d0 = Math.abs((h.x + h.w / 2) - (+gp.x + 14));
    for (let i = 0; i < 180; i++) { try { updateMonsters(1000 / 60); } catch (e) {} }
    const d1 = Math.abs((h.x + h.w / 2) - (+gp.x + 14));
    return { d0: Math.round(d0), d1: Math.round(d1), towardGuest: d1 < d0 - 5, aggro: !!h.aggroTarget };
  });
  ok('regular mob chases the closer GUEST (not the far host)', mob.towardGuest, mob);

  // 5) Positional self-hit: in-range lands, out-of-range safe, i-frames respected.
  const self = await ev(A, () => {
    player.hp = player.maxHp = 10000; player.invulnerable = 0; player._god = false;
    const hp0 = player.hp;
    _coopSelfBossHit(player.x + 14, player.y + 22, 120, 500, 0, 'test-strike', '#fff');
    const afterIn = player.hp;
    player.invulnerable = 0;
    _coopSelfBossHit(player.x + 5000, player.y, 120, 500, 0, 'far-strike', '#fff');
    const afterOut = player.hp;
    _coopSelfBossHit(player.x + 14, player.y + 22, 120, 500, 0, 'iframe-strike', '#fff');   // invulnerable=600 from first hit? was reset... set it:
    player.invulnerable = 600;
    const hpBeforeIframe = player.hp;
    _coopSelfBossHit(player.x + 14, player.y + 22, 120, 500, 0, 'iframe-strike2', '#fff');
    return { hp0, afterIn, afterOut, iframeBlocked: player.hp === hpBeforeIframe, inRangeHit: afterIn < hp0, outOfRangeSafe: afterOut === afterIn };
  });
  ok('self boss-hit lands when host is IN range', self.inRangeHit, self);
  ok('self boss-hit is SAFE out of range', self.outOfRangeSafe, self);
  ok('self boss-hit respects i-frames', self.iframeBlocked, self);

  ok('no page errors on host', A._errors.length === 0, A._errors.slice(0, 3));
  ok('no page errors on guest', B._errors.length === 0, B._errors.slice(0, 3));
} finally {
  await browser.close();
}
let pass = 0, fail = 0;
for (const r of results) { (r.pass ? pass++ : fail++); console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.extra !== undefined ? '  ' + JSON.stringify(r.extra) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
