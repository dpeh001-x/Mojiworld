// Live 2-client test: ELITE VARIANT sync -> an Elite monster on the host mirrors as an
// Elite on the follower (folded into the boss flag as b===3), so name/size/atk/hitbox
// match instead of the guest re-rolling a plain mob.
import { chromium } from 'playwright-core';
const EXE = process.env.PW_EXE || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = 'http://localhost:8080/mojiworld_game.html', WS = 'ws://localhost:8080', MAP = 'glasswindSteppe';
const ROOM = 'elite' + (process.env.RUN_TAG || Math.floor(Math.random() * 1e6));
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
  await ev(B, (m) => loadMap(m), MAP); await sleep(1500);
  ok('B is following the host', await ev(B, () => _coopFollowingHost() === true));

  // Host force-spawns an ELITE mob (net._coopForceElite makes spawnMonster take the
  // elite path). Capture its uid + elite attributes.
  const hostMon = await ev(A, () => {
    const t = Object.keys(monsterTypes)[0];
    net._coopForceElite = true;
    const m = spawnMonster(700, 300, t, false, false);
    net._coopForceElite = false;
    if (!m || m._suppressed) return { fail: true };
    if (m.uid == null) m.uid = (game._monUid = (game._monUid || 0) + 1);
    return { fail: false, type: t, uid: m.uid, isElite: !!m.isElite, w: m.w, atk: m.atk };
  });
  ok('host spawned an Elite mob', hostMon && !hostMon.fail && hostMon.isElite === true, hostMon);

  // Let the host broadcast + the follower mirror it.
  await B.waitForFunction((uid) => game.monsters.some(m => m && m._coopMirror && m.uid === uid), hostMon.uid, { timeout: 6000 }).catch(() => {});
  const mirror = await ev(B, (uid) => {
    const m = game.monsters.find(mm => mm && mm._coopMirror && mm.uid === uid);
    return m ? { found: true, isElite: !!m.isElite, w: m.w, atk: m.atk } : { found: false };
  }, hostMon.uid);
  ok('follower received the mirror', mirror.found === true, mirror);
  ok('mirror is an ELITE (not re-rolled as a plain mob)', mirror.found && mirror.isElite === true, mirror);
  ok('mirror elite size matches the host (not a plain 1.0x)', mirror.found && Math.abs(mirror.w - hostMon.w) <= 2, { mirrorW: mirror.w, hostW: hostMon.w });

  ok('no page errors (host)', A._errors.length === 0, A._errors.slice(0, 4));
  ok('no page errors (follower)', B._errors.length === 0, B._errors.slice(0, 4));
} catch (e) { results.push({ n: 'HARNESS ERROR', pass: false, extra: String(e).slice(0, 300) }); }
finally { await browser.close(); }
const passed = results.filter(r => r.pass).length;
console.log('\n=== CO-OP ELITE VARIANT SYNC ===');
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra !== undefined ? '  ' + JSON.stringify(r.extra) : ''}`);
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
