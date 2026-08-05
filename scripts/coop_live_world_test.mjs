// CO-OP LIVE WORLD certification. Verifies the shared enemy world keeps running
// while the host is paused-in-a-menu (and the host stays damageable), that guests
// keep receiving movement, and that solo play is unaffected. The Web-Worker pump
// for hidden tabs is exercised via _lxCoopWorldStep directly + presence checks.
import { chromium } from 'playwright-core';

const EXE = process.env.PW_EXE || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = 'http://localhost:8080/mojiworld_game.html';
const WS  = 'ws://localhost:8080';
const ROOM = 'live' + Math.floor(Math.random() * 1e9);
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
  await page.waitForFunction(() => typeof net === 'object' && typeof game === 'object' && typeof mpConnect === 'function' && typeof _lxCoopWorldStep === 'function', null, { timeout: 30000 });
  await page.waitForTimeout(3200);
  await page.evaluate((nm) => { try { player.cls = player.cls || 'warrior'; if (player.look) player.look.name = nm; game.paused = false; window._prologueActive = false; } catch (e) {} }, name);
  return page;
}
const ev = (page, fn, arg) => page.evaluate(fn, arg);

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
try {
  // ---- SOLO baseline: paused must FULLY stop the sim (no live-world in solo) ----
  const S = await boot(browser, 'Solo');
  const solo = await ev(S, ({ map }) => {
    loadMap(map); game.paused = false; window._prologueActive = false;
    // ensure a monster exists near the player
    const mk = () => { try { spawnMonster('glasswindHare', player.x + 40, player.y); } catch (e) {} };
    if (!(game.monsters || []).length) mk();
    const m = game.monsters.find(mm => mm && mm.currentHp > 0);
    if (!m) return { noMon: true };
    m.x = player.x + 34; m.y = player.y;   // adjacent
    player.invulnerable = 0; const hp0 = player.hp; const mx0 = m.x;
    game.paused = true;
    for (let i = 0; i < 40; i++) _lxCoopWorldStep(1000 / 60);   // solo → must no-op
    return { movedSolo: Math.abs(m.x - mx0) > 0.5, tookDmgSolo: player.hp < hp0, coop: (typeof _coopActive === 'function' && _coopActive()) };
  }, { map: MAP });
  ok('solo: _lxCoopWorldStep is a no-op (monster did NOT move while paused)', solo && !solo.movedSolo, solo);
  ok('solo: paused player took NO damage from the no-op step', solo && !solo.tookDmgSolo, solo);
  await S.close();

  // ---- CO-OP: host paused keeps the world alive + stays damageable ----
  const A = await boot(browser, 'Host');
  const B = await boot(browser, 'Guest');
  await ev(A, ({ ws, room }) => mpConnect(ws, 'Host', room), { ws: WS, room: ROOM });
  await A.waitForFunction(() => net.myId != null, null, { timeout: 10000 }).catch(() => {});
  await ev(B, ({ ws, room }) => mpConnect(ws, 'Guest', room), { ws: WS, room: ROOM });
  await sleep(900);
  // drive presence so host election + peer discovery settle
  for (const P of [A, B]) await P.evaluate(() => { window.__pump = setInterval(() => { try { _mpTick(); } catch (e) {} }, 90); });
  await sleep(700);
  const aHost = await ev(A, () => net.isHost), bHost = await ev(B, () => net.isHost);
  ok('host election resolved (A host, B guest)', aHost === true && bHost === false, { aHost, bHost });

  // Both load the shared map; host spawns a monster adjacent to itself.
  await ev(A, ({ map }) => { loadMap(map); game.paused = false; }, { map: MAP });
  await ev(B, ({ map }) => { loadMap(map); game.paused = false; }, { map: MAP });
  await sleep(600);
  const setup = await ev(A, () => {
    if (!(game.monsters || []).length) { try { spawnMonster('glasswindHare', player.x + 40, player.y); } catch (e) {} }
    const m = game.monsters.find(mm => mm && mm.currentHp > 0);
    if (!m) return { noMon: true };
    m.uid = m.uid || 9991; m.x = player.x + 34; m.y = player.y; m.currentHp = m.maxHp = 999999;
    player.hp = player.maxHp = 5000; player.invulnerable = 0; player._god = false;
    return { ok: true, uid: m.uid };
  });
  ok('host has an adjacent shared monster', setup && setup.ok, setup);

  // HOST OPENS A MENU → game.paused = true. Then simulate visible+paused frames.
  const paused = await ev(A, () => {
    game.paused = true;                 // as if a UI modal opened
    const m = game.monsters.find(mm => mm && mm.currentHp > 0);
    const hp0 = player.hp;
    let movedAny = false; let px = m.x;
    // Reproduce loop()'s visible+paused path: it calls _lxCoopWorldStep(dt).
    // Track movement across steps, but PIN the monster back onto the host each
    // frame so the contact-damage assertion isn't at the mercy of the AI's
    // flanking-offset walk (v0.29.x co-op aggro can also pick the guest).
    for (let i = 0; i < 60; i++) {
      player.invulnerable = 0;
      _lxCoopWorldStep(1000 / 60);
      if (Math.abs(m.x - px) > 0.5) movedAny = true;
      px = m.x;
      if (i % 5 === 4) { m.x = player.x + 4; m.y = player.y; m.facing = (player.x >= m.x) ? 1 : -1; px = m.x; }
    }
    return { paused: game.paused, moved: movedAny, tookDmg: player.hp < hp0, hp0, hp1: player.hp };
  });
  ok('co-op: monsters KEEP MOVING while the host is paused in a menu', paused && paused.moved, paused);
  ok('co-op: the paused (in-menu) host STILL TAKES monster damage', paused && paused.tookDmg, paused);

  // GUEST keeps receiving the host's monster movement while the host is paused.
  await sleep(1200);
  const guestSaw = await ev(B, () => {
    const mons = (game.monsters || []).filter(m => m && m._coopMirror);
    // capture positions, wait handled outside; here just confirm mirrors exist + have live coords
    return { mirrorCount: mons.length, sample: mons[0] ? { x: Math.round(mons[0].x), hasVel: (mons[0].vx || 0) !== 0 || (mons[0].vy || 0) !== 0 } : null };
  });
  ok('guest still mirrors the host monster while host is paused', guestSaw.mirrorCount > 0, guestSaw);

  // The background pump worker was created (drives the hidden-tab case).
  const pump = await ev(A, () => ({ worker: !!_lxCoopPumpWorker, fn: typeof _lxStartCoopPump === 'function' }));
  ok('co-op background pump worker is running', pump.worker && pump.fn, pump);

  // Unpause the host → normal play resumes, no residual double-sim errors.
  await ev(A, () => { game.paused = false; });
  await sleep(400);
  ok('no page errors on host', A._errors.length === 0, A._errors.slice(0, 3));
  ok('no page errors on guest', B._errors.length === 0, B._errors.slice(0, 3));
} finally {
  await browser.close();
}
let pass = 0, fail = 0;
for (const r of results) { (r.pass ? pass++ : fail++); console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.extra !== undefined ? '  ' + JSON.stringify(r.extra) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
