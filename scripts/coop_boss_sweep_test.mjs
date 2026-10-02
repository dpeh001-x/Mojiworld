// CO-OP BOSS SWEEP: every boss instance in the game, host + guest in one room on the local relay.
//   node scripts/coop_boss_sweep_test.mjs [--only=zod_leo,krookThrone] [--from=N] [--to=N]     (relay: PORT=<p> node mp/server.mjs)
// Per instance: the host's boss arena spawns it, the guest walks in and must MIRROR it (level, def, name, size, HP, flags, no local
// duplicates), follow its motion, land hits on it (the host judges) and see the host's hits; both screens agree on its HP; a fight
// window measures the wire (host frames/s, share skipped by the send budget, guest mon frames/s) and whether boss damage reaches a
// guest that is not in god mode; the host kills it: it dies on BOTH screens, both players earn EXP, and nothing comes back.
import { boot, launch, room, reset, sleep, arg, until, budget, expOf, gained, FILE, PORT } from './coop_sweep_lib.mjs';
const ZOD = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
const INST = [['slimeCave', 'king'], ['confusedVigil', 'young_confused_barnaby'], ['octopusGrotto', 'octobaby'], ['sundered_forge', 'sundered_smith'], ['krookThrone', 'kingKrook'],
  ['innerDimension', 'mirrorSelf'], ['sanctum', 'aetherion'], ['gravitosArena', 'gravitos'], ['boss', 'mooma'], ['blockland_apex', 'legosaurus'], ['boss_rush', '*'],
  ...ZOD.map((s) => ['zod_' + s, 'zodiac_' + s])].map(([map, boss]) => ({ id: map, map, boss }))
  .concat([{ id: 'tower_b5', map: 'tower_b5', boss: 'towerArbiter', spawn: true }, { id: 'tower_b10', map: 'tower_b10', boss: 'towerSovereign', spawn: true }, { id: 'clockworkExpress', map: 'clockworkExpress', boss: 'pqConductor', spawn: true }]);
const ONLY = arg('only', '').split(',').filter(Boolean), FROM = +arg('from', 0), TO = +arg('to', 999);
const list = INST.filter((q, i) => (!ONLY.length || ONLY.includes(q.id)) && i >= FROM && i <= TO);
const rows = []; let pass = 0, fail = 0, warn = 0;
const ok = (inst, n, c, extra, soft) => { if (c) pass++; else if (soft) warn++; else fail++; console.log((c ? 'PASS ' : soft ? 'WARN ' : 'FAIL ') + inst + ': ' + n + (c ? '' : '   ' + JSON.stringify(extra))); };
const bossesOf = (p, boss) => p.evaluate((boss) => __sw.live().filter((m) => m.type === boss || m.isBoss || m.zodiacBoss).map(__sw.snap), boss);
const hpOf = (p, u) => p.evaluate((u) => { const m = (game.monsters || []).find((x) => x && x.uid === u && x.currentHp > 0); return m ? Math.round(m.currentHp) : null; }, u);
// land `n` hits of `frac` of max HP from `from` on boss u; true once `watch` sees its HP fall (a ward or a phase window can refuse a few)
async function lands(from, watch, u, mx, frac, n = 3) {
  const h0 = await hpOf(watch, u); if (h0 == null) return { ok: false, h0 };
  for (let round = 0; round < 4; round++) {
    for (let i = 0; i < n; i++) { await from.evaluate(([u, d]) => __sw.hit(u, d), [u, mx * frac]); await sleep(220); }
    const h1 = await until(watch, ([u, h0]) => { const m = (game.monsters || []).find((x) => x && x.uid === u && x.currentHp > 0); return { ok: !m || m.currentHp < h0, v: m ? Math.round(m.currentHp) : 0 }; }, [u, h0], 3500);
    if (typeof h1 === 'number' && h1 < h0) return { ok: true, h0, h1 };
    await sleep(700);
  }
  return { ok: false, h0, h1: await hpOf(watch, u) };
}
async function runInst(A, B, inst) {
  const id = inst.id, m = { id }; const t0 = Date.now();
  await reset(A, B);
  // the Hall of Echoes only answers for bosses this save has SEEN (its roster is the mojidex): a fresh save meets a silent hall
  if (inst.id === 'boss_rush') await A.evaluate(() => { game.mojidexSeen = game.mojidexSeen || {}; game.mojidexSeen.king = true; });
  await A.evaluate((i) => loadMap(i), inst.map);
  if (inst.spawn) { await sleep(2500); await A.evaluate((t) => { game.paused = false; spawnMonster(player.x + 320, player.y, t, true); }, inst.boss); }
  const bA = await until(A, (t) => { if (t === '*') game.paused = false;   /* the rush waits out a pause (a boss-intro card from the last arena leaves one) */
    const l = __sw.live().filter((m) => t === '*' ? (m.isBoss || m.zodiacBoss) : m.type === t); return { ok: l.length > 0, v: l.length }; }, inst.boss, 15000);
  if (inst.boss === '*' && bA > 0) inst.boss = (await A.evaluate(() => __sw.live().find((m) => m.isBoss || m.zodiacBoss).type));   // whichever boss the rush opened with
  ok(id, `the host's arena spawns ${inst.boss}`, bA > 0, { found: bA, map: await A.evaluate(() => game.currentMap) });
  if (!(bA > 0)) return m;
  await B.evaluate((i) => loadMap(i), inst.map); const tB = Date.now();
  const uids = (await bossesOf(A, inst.boss)).map((q) => q.u);
  const mirrored = await until(B, (us) => ({ ok: us.every((u) => __sw.live().some((m) => m.uid === u && m._coopMirror)), v: 1 }), uids, 25000);
  m.mirrorMs = Date.now() - tB;
  ok(id, 'the guest follows the host and mirrors the boss', mirrored === 1 && await B.evaluate(() => _coopFollowingHost() === true), { uids, ms: m.mirrorMs });
  if (mirrored !== 1) return m;
  await sleep(1600);
  const sa = await A.evaluate(() => __sw.live().map(__sw.snap)), sb = await B.evaluate(() => __sw.live().map(__sw.snap));
  const byU = new Map(sb.map((q) => [q.u, q])), diffs = [];
  for (const a of sa) { const g = byU.get(a.u); if (!g) { diffs.push(['missing', a.t, a.u]); continue; } for (const k of ['t', 'n', 'lv', 'df', 'fl']) if (a[k] !== g[k]) diffs.push([k, a.t, a[k], g[k]]);
    if (Math.abs(a.w - g.w) > 3 || Math.abs(a.h - g.h) > 3) diffs.push(['size', a.t, a.w + 'x' + a.h, g.w + 'x' + g.h]); if (Math.abs(a.mx - g.mx) > Math.max(2, a.mx * 0.01)) diffs.push(['maxHp', a.t, a.mx, g.mx]); }
  ok(id, `every host monster (${sa.length}) is on the guest with the same level, def, name, size, max HP and flags`, !diffs.length, diffs.slice(0, 5));
  const loc = sb.filter((q) => !q.mir); ok(id, 'the guest holds no local (non-mirror) monsters', !loc.length, loc.slice(0, 3));
  const u = uids[0], bm = sa.find((q) => q.u === u), mx = bm.mx; let dxs = [], dys = [];
  for (let i = 0; i < 8; i++) { const [pa, pb] = await Promise.all([A, B].map((p) => p.evaluate((u) => { const x = (game.monsters || []).find((q) => q && q.uid === u); return x ? [x.x, x.y] : null; }, u))); if (pa && pb) { dxs.push(Math.abs(pa[0] - pb[0])); dys.push(Math.abs(pa[1] - pb[1])); } await sleep(160); }
  const avg = (a) => a.length ? Math.round(a.reduce((s, v) => s + v, 0) / a.length) : -1; m.dx = avg(dxs); m.dy = avg(dys);
  ok(id, 'the mirror follows the boss (mean position gap < 90 px)', dxs.length >= 5 && m.dx < 90 && m.dy < 90, { dx: m.dx, dy: m.dy });
  const g1 = await lands(B, A, u, mx, 0.004); m.gHit = g1.ok; ok(id, 'a guest hit lands on the host\'s boss', g1.ok, g1);
  await sleep(1800); const [hA, hB] = [await hpOf(A, u), await hpOf(B, u)];
  m.hpGap = hA == null || hB == null ? -1 : Math.abs(hA - hB); ok(id, 'both screens agree on its HP after the hit (within 2% of max)', hA != null && hB != null && m.hpGap <= Math.max(3, mx * 0.02), { hA, hB, mx });
  const h1 = await lands(A, B, u, mx, 0.004); ok(id, 'a host hit shows on the guest\'s mirror', h1.ok, h1);
  return Object.assign(m, await fightAndKill(A, B, inst, u, mx));
}
async function fightAndKill(A, B, inst, u, mx) {
  const id = inst.id, m = {};
  await B.evaluate(() => { if (!window.__monHook) { window.__monHook = true; window.__monN = 0; const oh = window._mpHandle; window._mpHandle = function (msg) { if (msg && msg.t === 'mon') window.__monN++; return oh.apply(this, arguments); }; } });
  // an 8 s fight with both players in god mode: the boss fights on its own; what does the wire do?
  const b0 = await budget(A), n0 = await B.evaluate(() => window.__monN); await sleep(8000);
  const b1 = await budget(A), n1 = await B.evaluate(() => window.__monN), sec = (b1.t - b0.t) / 1000, tot = (b1.s + b1.k) - (b0.s + b0.k);
  m.out = +((b1.s - b0.s) / sec).toFixed(1); m.skip = tot > 0 ? Math.round(100 * (b1.k - b0.k) / tot) : 0; m.monIn = +((n1 - n0) / sec).toFixed(1);
  ok(id, `the wire holds in an 8 s fight: host ${m.out} frames/s (< 40, the relay's 40/s bucket), guest gets ${m.monIn} mon frames/s (>= 4)`, m.out < 40 && m.monIn >= 4, m);
  ok(id, `the host's own send budget skipped ${m.skip}% of droppable frames (< 30%)`, m.skip < 30, m, true);
  // boss damage reaches a guest that can be hurt: park Ben beside the boss, out of god mode, and watch his HP for 12 s
  await B.evaluate((u) => { window.__noGod = true; window._god = false; player._god = false; player.invulnerable = 0; player.maxHp = 1e7; player.hp = 1e7; const b = (game.monsters || []).find((q) => q && q.uid === u); if (b) { player.x = b.x - 140; player.y = b.y; } }, u);
  let drops = 0, lost = 0, prev = 1e7; for (let i = 0; i < 120; i++) { const hp = await B.evaluate(() => player.hp); if (hp < prev) { drops++; lost += prev - hp; } prev = hp; await sleep(100); }
  m.gDmg = drops; ok(id, `the boss's attacks reach a guest who can be hurt (${drops} hits, ${Math.round(lost)} damage in 12 s)`, drops > 0, { drops }, true);
  await B.evaluate(() => { window.__noGod = false; window._god = true; player.invulnerable = 1e9; player.hp = player.maxHp = 1e7; });
  // the host kills it
  const e0 = { A: await expOf(A), B: await expOf(B) }, tk = Date.now(); let dead = false;
  for (let i = 0; i < 140 && !dead; i++) {
    await A.evaluate(([t, d]) => { for (const q of __sw.live().filter((x) => x.type === t || x.isBoss || x.zodiacBoss)) __sw.hit(q.uid, d); }, [inst.boss, mx * 3]); await sleep(220);
    dead = await A.evaluate((t) => !__sw.live().some((x) => x.type === t || x.isBoss || x.zodiacBoss), inst.boss);
  }
  m.killMs = Date.now() - tk; ok(id, `the host kills it (${(m.killMs / 1000).toFixed(1)} s)`, dead, { alive: await bossesOf(A, inst.boss) });
  if (!dead) return m;
  const tg = Date.now(), gdead = await until(B, (t) => ({ ok: !__sw.live().some((x) => x.type === t || x.isBoss || x.zodiacBoss) }), inst.boss, 8000);
  m.gDeathMs = Date.now() - tg; ok(id, `it dies on the guest's screen too (${m.gDeathMs} ms after the host's)`, gdead, { alive: await bossesOf(B, inst.boss) });
  await sleep(1800); const e1 = { A: await expOf(A), B: await expOf(B) }, gA = gained(e0.A, e1.A), gB = gained(e0.B, e1.B);
  ok(id, 'the kill pays EXP to the host and, whenever it pays the host, to the guest', gB || !gA, { hostGained: gA, guestGained: gB, e0, e1 });
  await sleep(2500); const back = [await bossesOf(A, inst.boss), await bossesOf(B, inst.boss)];
  // the Boss Rush opens the NEXT echo when one falls: there, both screens must simply agree on what stands
  ok(id, inst.id === 'boss_rush' ? 'both screens agree on what stands after the echo falls (the rush opens the next one)' : 'nothing comes back on either screen (2.5 s watch)', inst.id === 'boss_rush' ? back[0].length === back[1].length : (!back[0].length && !back[1].length), { host: back[0].length, guest: back[1].length });
  return m;
}
const t00 = Date.now(), browser = await launch();
try {
  const { A, B } = await room(browser, 'bsw'); console.log(`build ${await A.evaluate(() => GAME_VERSION)} file ${FILE} port ${PORT} - ${list.length} boss instances`);
  for (const inst of list) {
    const ea = A._errors.length, eb = B._errors.length; let m = { id: inst.id }; console.log(`--- ${inst.id} (${inst.boss})`);
    try { m = await runInst(A, B, inst); } catch (e) { fail++; console.log('FAIL ' + inst.id + ': harness ' + String(e.message).slice(0, 220)); }
    ok(inst.id, 'no page errors on either client', A._errors.length === ea && B._errors.length === eb, [...A._errors.slice(ea), ...B._errors.slice(eb)].slice(0, 3)); rows.push(m);
  }
} finally { await browser.close(); }
console.log('\ninstance            mirrorMs  dx  gHit hpGap  out/s skip% monIn/s gDmg  killMs gDeathMs');
for (const r of rows) console.log([String(r.id).padEnd(19), String(r.mirrorMs ?? '-').padStart(8), String(r.dx ?? '-').padStart(3), String(r.gHit ?? '-').padStart(5), String(r.hpGap ?? '-').padStart(5), String(r.out ?? '-').padStart(6), String(r.skip ?? '-').padStart(5), String(r.monIn ?? '-').padStart(7), String(r.gDmg ?? '-').padStart(5), String(r.killMs ?? '-').padStart(7), String(r.gDeathMs ?? '-').padStart(8)].join(' '));
console.log(`\n${pass} passed, ${fail} failed, ${warn} warnings - ${list.length} instances in ${Math.round((Date.now() - t00) / 1000)} s`);
process.exit(fail ? 1 : 0);
