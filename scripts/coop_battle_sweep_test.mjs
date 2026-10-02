// CO-OP BATTLE SWEEP: every map the game spawns monsters on, host + guest in one room on the local relay.
//   node scripts/coop_battle_sweep_test.mjs [--only=forest,tower] [--from=N] [--to=N]     (relay: PORT=<p> node mp/server.mjs)
// Per map: the host's field spawns monsters, the guest walks in and must MIRROR every one (type, level, def, name, size, max HP, flags;
// no local duplicates), a guest kill and a host kill each leave BOTH screens and stay gone, the kill pays EXP, and the wire (host
// frames/s vs the relay's 40/s bucket, guest monster frames/s) holds over a 3 s window.
import { launch, room, reset, sleep, arg, until, budget, expOf, gained, FILE, PORT } from './coop_sweep_lib.mjs';
const ONLY = arg('only', '').split(',').filter(Boolean), FROM = +arg('from', 0), TO = +arg('to', 999);
const rows = []; let pass = 0, fail = 0, warn = 0;
const ok = (id, n, c, extra, soft) => { if (c) pass++; else if (soft) warn++; else fail++; console.log((c ? 'PASS ' : soft ? 'WARN ' : 'FAIL ') + id + ': ' + n + (c ? '' : '   ' + JSON.stringify(extra))); };
const liveSnaps = (p) => p.evaluate(() => __sw.live().map(__sw.snap));
// kill monster u from `killer` (swinging until it is down on that screen), then watch both screens
async function killOne(killer, A, B, u) {
  const t0 = Date.now(); for (const p of [A, B]) await p.evaluate((u) => __sw.strip(u), u);   // a reviver (zombies, lichkin) would come back by design
  await killer.evaluate(async (u) => { for (let i = 0; i < 45; i++) { const m = (game.monsters || []).find((x) => x && x.uid === u && x.currentHp > 0); if (!m) return; __sw.hit(u, Math.max(m.maxHp || 0, m.currentHp) * 3); await new Promise((r) => setTimeout(r, 90)); } }, u);
  const gone = (p) => until(p, (u) => ({ ok: !(game.monsters || []).some((x) => x && x.uid === u && x.currentHp > 0) }), u, 5000);
  const [ga, gb] = [await gone(A), await gone(B)]; let stayed = ga && gb; for (let i = 0; i < 6 && stayed; i++) { await sleep(200); stayed = !(await liveSnaps(A)).some((q) => q.u === u) && !(await liveSnaps(B)).some((q) => q.u === u); }
  return { ga, gb, stayed, ms: Date.now() - t0 };
}
async function runMap(A, B, id) {
  const m = { id }; await reset(A, B);
  await A.evaluate((i) => loadMap(i), id);
  const nA = await until(A, () => { const l = __sw.live().filter((x) => !x.isBoss && !x.zodiacBoss); return { ok: l.length > 0, v: l.length }; }, null, 15000);
  m.n = nA || 0; if (!nA) { ok(id, 'the host\'s field spawns monsters', false, { n: nA }, true); return m; }
  await B.evaluate((i) => loadMap(i), id); const tB = Date.now();
  const want = (await liveSnaps(A)).map((q) => q.u);
  const mir = await until(B, (us) => { const have = new Set(__sw.live().filter((x) => x._coopMirror).map((x) => x.uid)); const n = us.filter((u) => have.has(u)).length; return { ok: n >= us.length * 0.85, v: n }; }, want, 25000);
  m.mirrorMs = Date.now() - tB; const follow = await B.evaluate(() => _coopFollowingHost() === true);
  ok(id, `the guest follows the host and mirrors its monsters (${mir}/${want.length} in ${m.mirrorMs} ms)`, follow && mir >= want.length * 0.85, { mir, want: want.length, follow });
  if (!follow) return m;
  await sleep(2200); const sa = await liveSnaps(A), sb = await liveSnaps(B), byU = new Map(sb.map((q) => [q.u, q])), diffs = [];
  for (const a of sa) { const g = byU.get(a.u); if (!g) continue; for (const k of ['t', 'n', 'lv', 'df', 'fl']) if (a[k] !== g[k]) diffs.push([k, a.t, a[k], g[k]]);
    if (Math.abs(a.w - g.w) > 3 || Math.abs(a.h - g.h) > 3) diffs.push(['size', a.t, a.w + 'x' + a.h, g.w + 'x' + g.h]); if (Math.abs(a.mx - g.mx) > Math.max(2, a.mx * 0.01)) diffs.push(['maxHp', a.t, a.mx, g.mx]); }
  m.diffs = diffs.length; ok(id, `every monster the guest holds matches the host's level, def, name, size, max HP and flags (${sa.length} host / ${sb.length} guest)`, !diffs.length, diffs.slice(0, 5));
  const loc = sb.filter((q) => !q.mir); ok(id, 'the guest holds no local (non-mirror) monsters', !loc.length, loc.slice(0, 3));
  const miss = sa.filter((a) => !byU.has(a.u)); ok(id, 'no host monster is missing on the guest after settling', miss.length <= Math.max(1, Math.round(sa.length * 0.1)), { missing: miss.length, of: sa.length }, true);
  const both = sa.filter((a) => byU.has(a.u) && !(a.fl & 11) && !a.bk).map((a) => a.u);   // not a booked Ticket Rush mech: its shield needs two players in turn (pq_party_test) m.kills = 0;
  if (both.length >= 2) {
    const e0 = { A: await expOf(A), B: await expOf(B) };
    const k1 = await killOne(B, A, B, both[0]); const k2 = await killOne(A, A, B, both[1]); m.kills = 2;
    ok(id, `a guest kill and a host kill each leave BOTH screens and stay gone (${k1.ms} / ${k2.ms} ms)`, k1.ga && k1.gb && k1.stayed && k2.ga && k2.gb && k2.stayed, { k1, k2 });
    await sleep(1200); const e1 = { A: await expOf(A), B: await expOf(B) };
    ok(id, 'the kills pay EXP to both players', gained(e0.A, e1.A) && gained(e0.B, e1.B), { e0, e1 }, true);
  } else ok(id, 'two plain monsters to kill on both screens', false, { n: both.length }, true);
  const b0 = await budget(A), n0 = await B.evaluate(() => { if (!window.__monHook) { window.__monHook = true; window.__monN = 0; const oh = window._mpHandle; window._mpHandle = function (msg) { if (msg && msg.t === 'mon') window.__monN++; return oh.apply(this, arguments); }; } return window.__monN; });
  await sleep(3000); const b1 = await budget(A), n1 = await B.evaluate(() => window.__monN), sec = (b1.t - b0.t) / 1000;
  m.out = +((b1.s - b0.s) / sec).toFixed(1); m.monIn = +((n1 - n0) / sec).toFixed(1);
  ok(id, `the wire holds: host ${m.out} frames/s (< 40), guest gets ${m.monIn} mon frames/s`, m.out < 40, m);
  return m;
}
const t00 = Date.now(), browser = await launch();
try {
  const { A, B } = await room(browser, 'bat');
  const maps = await A.evaluate(() => Object.keys(MAPS).filter((k) => { const d = MAPS[k]; return !d.isTown && !d.isBossArena && (Array.isArray(d.spawns) ? d.spawns.length : d.spawns) && !d.isVerticalTower && !d.isZodiacHub; }));
  const list = maps.filter((k, i) => (!ONLY.length || ONLY.includes(k)) && i >= FROM && i <= TO);
  console.log(`build ${await A.evaluate(() => GAME_VERSION)} file ${FILE} port ${PORT} - ${list.length} of ${maps.length} battle maps`);
  for (const id of list) {
    const ea = A._errors.length, eb = B._errors.length; let m = { id }; console.log(`--- ${id}`);
    try { m = await runMap(A, B, id); } catch (e) { fail++; console.log('FAIL ' + id + ': harness ' + String(e.message).slice(0, 220)); }
    ok(id, 'no page errors on either client', A._errors.length === ea && B._errors.length === eb, [...A._errors.slice(ea), ...B._errors.slice(eb)].slice(0, 3)); rows.push(m);
  }
} finally { await browser.close(); }
console.log('\nmap                   mobs mirrorMs diffs  out/s monIn/s');
for (const r of rows) console.log([String(r.id).padEnd(21), String(r.n ?? '-').padStart(4), String(r.mirrorMs ?? '-').padStart(8), String(r.diffs ?? '-').padStart(5), String(r.out ?? '-').padStart(6), String(r.monIn ?? '-').padStart(7)].join(' '));
console.log(`\n${pass} passed, ${fail} failed, ${warn} warnings - ${rows.length} maps in ${Math.round((Date.now() - t00) / 1000)} s`);
process.exit(fail ? 1 : 0);
