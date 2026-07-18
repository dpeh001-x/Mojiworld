// Monster-sprite transient-failure healing certification.
// Reproduces the co-op report ("some monsters loaded without their sprites"):
// the boot loader fires ~140 sprite fetches at once; if one drops, that type
// previously rendered as the procedural fallback blob for the whole session.
//   1. LOADER RETRY: block mushpup.{webp,png} at boot → registry misses it;
//      unblock → a backoff retry (2s/6s/18s) heals it with no draw involved.
//   2. DRAW-TIME HEAL: keep sparkling.* blocked through ALL boot retries,
//      then unblock and draw a sparkling mob → _lxNudgeMonsterSprite
//      refetches from the fallback path and the registry heals mid-session.
//   3. The nudge is rate-limited and a no-op for unregistered types.
import { chromium } from 'playwright-core';
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = 'http://localhost:8080/mojiworld_game.html';
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
try {
  // serviceWorkers:'block' — the game registers sw.js which would serve sprite
  // fetches around our route interception and make the block nondeterministic.
  const page = await browser.newContext({ serviceWorkers: 'block' }).then(c => c.newPage());
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));

  let blockMushpup = true, blockSparkling = true, sparklingReqs = 0;
  await page.route('**/Sprites/monsters/**', (route) => {
    const u = route.request().url();
    if (/\/mushpup\.(webp|png)/.test(u) && blockMushpup) return route.abort();
    if (/\/sparkling\.(webp|png)/.test(u)) { sparklingReqs++; if (blockSparkling) return route.abort(); }
    return route.continue();
  });

  const t0 = Date.now();
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof MONSTER_SPRITES === 'object' && typeof _lxNudgeMonsterSprite === 'function', null, { timeout: 30000 });
  // Wait for the boot load burst to settle (headless decodes trickle in).
  await page.waitForFunction(() => Object.keys(MONSTER_SPRITES).length >= 80, null, { timeout: 90000 });

  const boot = await page.evaluate(() => ({
    loaded: Object.keys(MONSTER_SPRITES).length,
    mushpup: !!MONSTER_SPRITES.mushpup, sparkling: !!MONSTER_SPRITES.sparkling,
  }));
  ok('boot burst settled: 80+ types loaded (controls fine)', boot.loaded >= 80, boot);
  ok('blocked types missing after boot (repro of the report)', !boot.mushpup && !boot.sparkling, boot);

  // 1) LOADER RETRY — unblock mushpup; a pending backoff retry (2s/6s/18s
  //    after each failure) fetches it again and heals the registry.
  blockMushpup = false;
  await page.waitForFunction(() => !!MONSTER_SPRITES.mushpup, null, { timeout: 45000 }).catch(() => {});
  ok('loader backoff retry heals mushpup once the network recovers', await page.evaluate(() => !!MONSTER_SPRITES.mushpup), { elapsed: Date.now() - t0 });

  // 2) DRAW-TIME HEAL — let sparkling's retries fully exhaust while blocked.
  const untilExhausted = 40000 - (Date.now() - t0);
  if (untilExhausted > 0) await sleep(untilExhausted);
  const exhausted = await page.evaluate(() => !!MONSTER_SPRITES.sparkling);
  ok('sparkling still missing after ALL boot retries exhausted', !exhausted, { exhausted, sparklingReqs });
  blockSparkling = false;
  const drew = await page.evaluate(() => {
    game.paused = false; window._prologueActive = false;
    let m = null;
    try { m = spawnMonster(player.x + 60, player.y, 'sparkling'); } catch (e) {}
    if (!m) { m = { type: 'sparkling', x: (game.camera.x || 0) + 200, y: 300, w: 34, h: 34, currentHp: 10, maxHp: 10, facing: 1 }; game.monsters.push(m); }
    m.x = (game.camera.x || 0) + 200; m.y = 300;
    try { drawMonster(m); } catch (e) { return { err: String(e) }; }
    return { drew: true };
  });
  ok('fallback draw executes without error', drew.drew === true, drew);
  await page.waitForFunction(() => !!MONSTER_SPRITES.sparkling, null, { timeout: 20000 }).catch(() => {});
  ok('draw-time nudge refetches + heals sparkling mid-session', await page.evaluate(() => !!MONSTER_SPRITES.sparkling), { sparklingReqs });

  // rate limit: a second nudge within 60s must NOT fire another request
  const reqsBefore = sparklingReqs;
  await page.evaluate(() => { delete MONSTER_SPRITES.sparkling; _lxNudgeMonsterSprite('sparkling'); });
  await sleep(800);
  ok('nudge is rate-limited (no re-request within 60s window)', sparklingReqs === reqsBefore, { reqsBefore, after: sparklingReqs });
  ok('nudging an unregistered type is a safe no-op', await page.evaluate(() => { _lxNudgeMonsterSprite('definitely_not_a_type'); return true; }));

  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} finally { await browser.close(); }
let pass = 0, fail = 0;
for (const r of results) { (r.pass ? pass++ : fail++); console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.x !== undefined ? '  ' + JSON.stringify(r.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
