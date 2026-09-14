// MASTER SKILL DAMAGE COLUMNS — G and B stack their numbers, the way Deadeye Protocol does.
// ============================================================================
// Per user: "for all classes G and B skill damage numbers make them stacked just like the style in
// deadeye protocol (marksman)". G is the master signature and B the master ultimate
// (KEY_TO_SLOT_DEFAULT maps g -> slot 'x', b -> slot 'b'): thirty-four skills.
//
// The interesting thing this guards is WHY the implementation is a cast window rather than a list of
// hit tags. Measured across all thirty-four before writing it: only nine call hitMonster directly at
// all — the rest deal their damage through projectiles, ground hazards, summons and DoTs, which do
// not know which skill spawned them — and two of those nine pass 'melee' / 'magic', the same tags a
// basic attack uses. A tag list would have missed most of the set and captured basic attacks. So the
// window opens at the cast and every monster damage number pushed inside it joins that foe's column.
//
// Section 1 casts every one of the thirty-four and asserts that EVERY hit the hook saw came out of
// _lxDeColumn with a row. Sections 2-6 are the things that would quietly rot: a basic attack outside
// the window must not stack, the window must close, a row must fit its 20px pitch, Deadeye must not
// be double-counted, and a wide AoE must not leave a foe pointing at an unheld column.
//   node scripts/master_skill_column_test.mjs [port]
import { createRequire } from 'node:module';
import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.argv[2] || 9591);
const results = []; const check = (n, c, x) => { results.push({ n, pass: !!c }); console.log((c ? 'PASS  ' : 'FAIL  ') + n + (x === undefined ? '' : '  ' + JSON.stringify(x))); };

const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined, headless: true, args: ['--no-sandbox', '--mute-audio'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => typeof castSkill === 'function' && typeof SKILLS === 'object', { timeout: 120000 });
await page.waitForTimeout(1500);
await page.evaluate(() => {
  window._prologueActive = false; window._prologuePending = false; window._lxBootGateDone = true;
  const o = document.getElementById('story-beat-overlay'); if (o) { o.classList.remove('on'); o.style.display = 'none'; }
  const lo = document.getElementById('loading-overlay'); if (lo) lo.style.display = 'none';
  player.level = 99; player._god = true;
  loadMap('forest', 300);
});
await page.waitForTimeout(3500);

// the harness: count every hook call, and read back whether the number it was handed got a row
await page.evaluate(() => {
  const orig = window._lxGbStack;
  window._GB = { hits: 0, row: 0, noRow: [] };
  window._lxGbStack = function (m, skill) {
    const arr = game.damageNumbers;
    const n = arr && arr.length ? arr[arr.length - 1] : null;
    const isNum = !!(n && n.text !== undefined && /^[\d,]+$/.test(String(n.text)));
    const deadeye = (typeof _LX_DE_LINE_SKILLS !== 'undefined') && _LX_DE_LINE_SKILLS.has(skill);
    const open = (game.time | 0) <= (player._gbStackUntil | 0);
    const r = orig.apply(this, arguments);
    if (isNum && open && !deadeye && skill !== 'thorns' && skill !== '__coop') {
      window._GB.hits++;
      if (n._deRow !== undefined) window._GB.row++;
      else if (window._GB.noRow.length < 5) window._GB.noRow.push([skill, String(n.text).slice(0, 8)]);
    }
    return r;
  };
  window._gbArena = (n) => {
    game.paused = false;
    player.level = 99; player._god = true; player.maxMp = 9999; player.mp = 9999; player.baseAtk = 400;
    player.skillCooldowns = {}; player.hp = player.maxHp;
    player.x = 300; player.y = 300; player.facing = 1;
    game.projectiles.length = 0; game.monsters.length = 0;
    if (game.damageNumbers) game.damageNumbers.length = 0;
    player._gbStackUntil = 0; player._gbStackAt = 0;
    const base = monsterTypes.slime || monsterTypes[Object.keys(monsterTypes)[0]];
    const out = [];
    for (let i = 0; i < n; i++) {
      const m = { type: 'slime', ...JSON.parse(JSON.stringify(base)), x: 380 + i * 60, y: 300,
                  currentHp: 1e9, maxHp: 1e9, facing: -1, vx: 0, vy: 0, _noGravity: true };
      m.traits = {}; game.monsters.push(m); out.push(m);
    }
    return out;
  };
});

// ---------------------------------------------------------------- 1. every G and B skill
const list = await page.evaluate(() => Object.entries(SKILLS)
  .filter(([, s]) => s.slot === 'x' || s.slot === 'b')
  .map(([id, s]) => ({ id, slot: s.slot, cls: s.cls, job: s.job, master: s.master })));
check('the G/B set is the whole master roster (17 signatures + 17 ultimates)',
  list.filter((x) => x.slot === 'x').length === 17 && list.filter((x) => x.slot === 'b').length === 17,
  { G: list.filter((x) => x.slot === 'x').length, B: list.filter((x) => x.slot === 'b').length });

const per = [];
for (const sk of list) {
  const r = await page.evaluate(async (sk) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    player.cls = sk.cls; player.job = sk.job; player.master = sk.master;
    window._gbArena(5);
    window._GB = { hits: 0, row: 0, noRow: [] };
    const t0 = game.time | 0;
    try { castSkill(sk.id); } catch (e) { return { err: String(e).slice(0, 80) }; }
    const opened = (player._gbStackUntil | 0) > t0;
    await sleep(1100);
    return { opened, ...window._GB };
  }, sk);
  per.push({ ...sk, ...r });
}
const cast = per.filter((p) => !p.err);
check('every cast opens the stacking window', cast.every((p) => p.opened),
  cast.filter((p) => !p.opened).map((p) => p.id));
const dealt = per.filter((p) => p.hits > 0);
check('the probe actually landed hits for a meaningful share of the roster', dealt.length >= 18,
  { dealtDamage: dealt.length, of: per.length });
check('EVERY hit inside a G/B window got a column row', dealt.every((p) => p.row === p.hits),
  dealt.filter((p) => p.row !== p.hits).map((p) => p.id + ' ' + p.row + '/' + p.hits));
console.log('    (' + dealt.reduce((a, p) => a + p.hits, 0) + ' hits across ' + dealt.length + ' skills, all columned)');
check('no skill threw on cast', per.every((p) => !p.err), per.filter((p) => p.err).map((p) => p.id + ': ' + p.err));

// ---------------------------------------------------------------- 2. a basic attack is not a master skill
const basic = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  player.cls = 'warrior'; player.job = 'berserker'; player.master = 'doombringer';
  const ms = window._gbArena(1);
  player._gbStackUntil = 0; player._gbStackAt = 0;
  hitMonster(ms[0], 500, false, 'melee');
  await sleep(60);
  const arr = game.damageNumbers.filter((d) => d && /^[\d,]+$/.test(String(d.text)));
  return { numbers: arr.length, rows: arr.filter((d) => d._deRow !== undefined).length, cols: _LX_DE.cols.length };
});
check('a hit with no G/B window open does not stack', basic.numbers > 0 && basic.rows === 0, basic);

// ---------------------------------------------------------------- 3. the window closes again
const closes = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  player.cls = 'warrior'; player.job = 'berserker'; player.master = 'doombringer';
  window._gbArena(1);
  castSkill('doombringer_apoc');
  const openedFor = (player._gbStackUntil | 0) - (game.time | 0);
  // clear the arena so the SKILL cannot keep the window alive: what is under test is that the
  // window closes on its own, not that a ten-second aura stops dealing damage
  game.monsters.length = 0; game.projectiles.length = 0;
  await sleep(5000);   // past OPEN (180f) + HOLD (45f)
  const stillOpen = (game.time | 0) <= (player._gbStackUntil | 0);
  const ms = window._gbArena(1);
  player._gbStackUntil = stillOpen ? (player._gbStackUntil | 0) : 0;   // _gbArena zeroes it; keep the real answer
  if (game.damageNumbers) game.damageNumbers.length = 0;
  hitMonster(ms[0], 500, false, 'melee');
  await sleep(60);
  const arr = game.damageNumbers.filter((d) => d && /^[\d,]+$/.test(String(d.text)));
  return { openedFor, stillOpen, rows: arr.filter((d) => d._deRow !== undefined).length, numbers: arr.length };
});
check('the window is opened for about three seconds', closes.openedFor >= 150 && closes.openedFor <= 210, closes);
check('and it closes once the cast stops landing: a later hit is an ordinary number again',
  !closes.stillOpen && closes.numbers > 0 && closes.rows === 0, closes);

// a basic attack may JOIN an open column, but it must not hold the window open by itself
const zspam = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  player.cls = 'warrior'; player.job = 'berserker'; player.master = 'doombringer';
  const ms = window._gbArena(1);
  castSkill('doombringer_apoc');
  game.projectiles.length = 0;
  const until0 = player._gbStackUntil | 0;
  for (let i = 0; i < 40; i++) { hitMonster(ms[0], 300, false, 'melee'); await sleep(40); }
  return { until0, until1: player._gbStackUntil | 0, t: game.time | 0 };
});
check('Z-spam inside the window never extends it', zspam.until1 <= zspam.until0, zspam);

// ---------------------------------------------------------------- 4. a row fits its row
const sizes = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  player.cls = 'warrior'; player.job = 'berserker'; player.master = 'doombringer';
  player.baseAtk = 9000;   // the case that broke it: a single master hit wants size 39 in a 20px pitch
  const ms = window._gbArena(3);
  castSkill('doombringer_apoc');
  await sleep(1200);
  const rows = game.damageNumbers.filter((d) => d && d._deRow !== undefined);
  player.baseAtk = 400;
  return { rows: rows.length, max: rows.reduce((a, d) => Math.max(a, d.size | 0), 0),
           cap: (typeof LX_COL_ROW_MAX !== 'undefined') ? LX_COL_ROW_MAX : null,
           crit: rows.filter((d) => d.crit).length };
});
check('no stacked row is taller than the 20px pitch it sits in', sizes.rows > 0 && sizes.max <= (sizes.cap || 14), sizes);
check('stacked rows drop the crit pop, like Deadeye\'s do', sizes.rows > 0 && sizes.crit === 0, sizes);

// ---------------------------------------------------------------- 5. Deadeye is not double-counted
// Deadeye Protocol columns its own hits (that is where the column came from) and keeps its own
// tallies off the value the column reports. If the generic hook ALSO columned those numbers, each
// line would advance the column twice and be counted twice in the gold total. So the invariant is
// not "the hook sees nothing" — a Deadeye cast triggers on-hit procs with their own tags, which
// legitimately join the column — it is that NO NUMBER IS EVER COLUMNED TWICE.
const de = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const orig = window._lxDeColumn;
  const seen = { calls: 0, twice: 0, tags: {} };
  window._lxDeColumn = function (m, n0) {
    const arr = game.damageNumbers;
    let d = null;
    for (let i = arr.length - 1; i >= n0 && i >= 0; i--) {
      const e = arr[i];
      if (!e || e._deSum || e.text === undefined || e.text === '') continue;
      if (Number.isFinite(+String(e.text).replace(/[,\s]/g, ''))) { d = e; break; }
    }
    seen.calls++;
    if (d && d._deRow !== undefined) seen.twice++;
    return orig.apply(this, arguments);
  };
  const origGb = window._lxGbStack;
  window._lxGbStack = function (m, skill) { seen.tags[skill] = (seen.tags[skill] || 0) + 1; return origGb.apply(this, arguments); };
  player.cls = 'archer'; player.job = 'sniper'; player.master = 'marksman';
  const ms = window._gbArena(1);
  castSkill('marksman_oneshot');
  await sleep(400);
  castSkill('marksman_oneshot');
  await sleep(900);
  window._lxDeColumn = orig; window._lxGbStack = origGb;
  const c = ms[0]._deCol;
  return { ...seen, colN: c ? c.n : -1, colTotal: c ? c.total : -1 };
});
check('no damage number is ever put in a column twice', de.calls > 0 && de.twice === 0,
  { columnCalls: de.calls, columnedTwice: de.twice, tagsSeenByHook: de.tags });
check('Deadeye\'s own column still fills', de.colN > 0 && de.colTotal > 0, { rows: de.colN, total: de.colTotal });

// ---------------------------------------------------------------- 6. a wide AoE leaves no orphan column
const orphans = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  player.cls = 'mage'; player.job = 'warlock'; player.master = 'hexmaster';
  const ms = window._gbArena(16);
  castSkill('hexmaster_ult');
  await sleep(1500);
  const held = new Set(_LX_DE.cols);
  return {
    monsters: ms.length, cols: _LX_DE.cols.length, cap: (typeof LX_COL_MAX !== 'undefined') ? LX_COL_MAX : null,
    orphan: game.monsters.filter((m) => m._deCol && !held.has(m._deCol)).length,
  };
});
check('the held-column list respects its cap', orphans.cols <= (orphans.cap || 10), orphans);
check('no foe is left pointing at a column nothing holds (it would sag off its own rows)',
  orphans.orphan === 0, orphans);

check('no page errors', errs.length === 0, errs.slice(0, 3));
await browser.close().catch(() => {}); server.kill();
const bad = results.filter((r) => !r.pass);
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' passed');
process.exit(bad.length ? 1 : 0);
