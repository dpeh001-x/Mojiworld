// LEVEL-GATE SCAN — mob level vs the level the game ADVERTISES for it.
//
// Started from one hand-found bug (Legosaurus Lv69 in an arena gated at 55) and
// turned up two traps that make naive level auditing wrong:
//
// TRAP 1 — the table is not the source of truth. `spawnMonster` builds the
//   instance as `{ type, ...t }`, so an inline `level:` on the monsterTypes
//   entry lands on `m.level`, and `_mobLevel` prefers `m.level` over the table.
//   Editing MOB_NATURAL_LEVEL for such a type is a silent no-op — which is
//   exactly what happened to the first Legosaurus fix. Real order:
//       inline `level:`  >  MOB_NATURAL_LEVEL[type]  >  map levelReq  >  1
//
// TRAP 2 — `levelReq` is NOT a gate on most maps. A deliberate v0.26.x sweep
//   sets `levelReq = 1` on every map that is not a boss arena / tower (plus 4
//   named exemptions) so players can walk in early. Comparing mob levels to
//   the authored levelReq therefore reports ~40 phantom "gaps" on maps whose
//   gate does not exist at runtime. Only boss arenas, towers and the named
//   exemptions keep a live levelReq.
//
// So the honest yardstick is what the PLAYER is told: the boss arena's
// levelReq (rendered "Lv N+ recommended" on the world map) and the portal
// signpost text ("▶ Furnace Deep (Lv 55)"), each against the effective level
// of what actually lives there.
//
// Run: node scripts/level_gate_scan.mjs [--all]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'mojiworld_game.html'), 'utf8');
const ALL = process.argv.includes('--all');
const sc = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');

// --- effective level per type --------------------------------------------
const TABLE = {};
{
  const s = html.search(/const MOB_NATURAL_LEVEL\s*=\s*\{/);
  if (s >= 0) for (const m of sc(html.slice(s, html.indexOf('\n};', s))).matchAll(/([a-zA-Z_]\w*)\s*:\s*(\d+)/g)) TABLE[m[1]] = +m[2];
}
const INLINE = {}, BOSS = new Set();
for (const [re, end] of [[/const monsterTypes\s*=\s*\{/, '\n};'], [/Object\.assign\(monsterTypes,\s*\{/, '\n});']]) {
  const s = html.search(re); if (s < 0) continue;
  const bl = html.slice(s, html.indexOf(end, s));
  const r = /\n {2}([a-zA-Z_]\w*)\s*:\s*\{([\s\S]*?)(?=\n {2}[a-zA-Z_]\w*\s*:\s*\{|$)/g;
  let m;
  while ((m = r.exec(bl))) {
    const b = sc(m[2]);
    const lv = /(?:^|[,{\s])level\s*:\s*(\d+)/.exec(b);
    if (lv) INLINE[m[1]] = +lv[1];
    if (/\bboss\s*:\s*true/.test(b)) BOSS.add(m[1]);
  }
}
const eff = (t) => (INLINE[t] !== undefined ? INLINE[t] : TABLE[t]);

// --- maps ----------------------------------------------------------------
// Entries are `  id: {`, `  id: (() => {` (IIFE), and `MAPS.id = {`. Missing
// the IIFE form makes 6 real maps look undefined and their portals "broken".
const MAPS = new Map();
const takeBody = (from) => {
  const nx = html.slice(from).search(/^ {2}[a-zA-Z_]\w*\s*:\s*[({]|^MAPS\.[a-zA-Z_]\w*\s*=|^\};/m);
  return html.slice(from, nx < 0 ? from + 20000 : from + nx);
};
for (const re of [/^ {2}([a-zA-Z_]\w*)\s*:\s*(?:\(\(\)\s*=>\s*)?\{/gm, /^MAPS\.([a-zA-Z_]\w*)\s*=\s*\{/gm]) {
  let m;
  while ((m = re.exec(html))) {
    const body = takeBody(m.index + m[0].length);
    if (!/levelReq\s*:|spawns\s*:|bossType\s*:/.test(body)) continue;
    if (MAPS.has(m[1])) continue;
    const req = +(body.match(/levelReq\s*:\s*(\d+)/) || [])[1];
    const spawnBlock = (body.match(/spawns\s*:\s*\[([\s\S]*?)\n\s*\]/) || [])[1] || '';
    MAPS.set(m[1], {
      id: m[1],
      name: (body.match(/name\s*:\s*["']((?:[^"'\\]|\\.)*)["']/) || [])[1] || m[1],
      req: Number.isFinite(req) ? req : null,
      bossType: (body.match(/bossType\s*:\s*'([a-zA-Z_]\w*)'/) || [])[1] || null,
      isBossArena: /isBossArena\s*:\s*true/.test(body),
      isTower: /isTower\s*:\s*true/.test(body),
      types: [...new Set([...sc(spawnBlock).matchAll(/type\s*:\s*'([a-zA-Z_]\w*)'/g)].map((x) => x[1]))],
    });
  }
}
// the sweep's own exemption list, read from the sweep rather than hardcoded
const SWEEP_EXEMPT = new Set([...html.matchAll(/_id === '([a-zA-Z_]\w*)'/g)].map((m) => m[1]));
const gateIsLive = (m) => m.isBossArena || m.isTower || SWEEP_EXEMPT.has(m.id);

const out = { SHADOWED: [], 'BOSS ARENA GAP': [], 'SIGNPOST GAP': [] };

// 1. inline level: shadowing a disagreeing MOB_NATURAL_LEVEL entry
for (const t of Object.keys(INLINE)) {
  if (TABLE[t] !== undefined && TABLE[t] !== INLINE[t]) {
    out.SHADOWED.push({ t, detail: `inline level:${INLINE[t]} WINS over MOB_NATURAL_LEVEL:${TABLE[t]} — editing the table does nothing` });
  }
}

// 2. boss vs its own arena's (live) levelReq
for (const m of MAPS.values()) {
  if (!m.bossType || m.req == null || !gateIsLive(m)) continue;
  const lv = eff(m.bossType);
  if (lv === undefined) continue;
  const gap = lv - m.req;
  if (Math.abs(gap) >= 10) out['BOSS ARENA GAP'].push({ t: m.bossType, map: m, detail: `Lv${lv} vs its arena's live gate ${m.req} (${gap > 0 ? '+' : ''}${gap})` });
}

// 3. portal signpost text vs the median effective level of what is there
const roster = (id) => {
  const m = MAPS.get(id); if (!m) return null;
  const lv = [];
  for (const t of m.types) { const l = eff(t); if (l) lv.push(l); }
  if (m.bossType) { const l = eff(m.bossType); if (l) lv.push(l); }
  if (!lv.length) return null;
  lv.sort((a, b) => a - b);
  return { min: lv[0], max: lv[lv.length - 1], med: lv[Math.floor(lv.length / 2)] };
};
const seen = new Set();
for (const m of html.matchAll(/\{[^{}]*?dest\s*:\s*'([a-zA-Z_]\w*)'[^{}]*?\}/g)) {
  const dest = m[1];
  const nm = (m[0].match(/name\s*:\s*'((?:[^'\\]|\\.)*)'/) || [])[1];
  if (!nm) continue;
  const claim = /Lv\s*(\d+)/.exec(nm); if (!claim) continue;
  const k = dest + '|' + nm; if (seen.has(k)) continue; seen.add(k);
  const r = roster(dest); if (!r) continue;
  const off = r.med - +claim[1];
  if (Math.abs(off) >= 8) out['SIGNPOST GAP'].push({ t: dest, detail: `signpost says Lv${claim[1]}, roster is ${r.min}/${r.med}/${r.max} (${off > 0 ? '+' : ''}${off})   "${nm}"` });
}

console.log(`=== LEVEL-GATE SCAN — ${MAPS.size} maps, ${Object.keys(TABLE).length} table levels, ${Object.keys(INLINE).length} inline levels ===`);
console.log(`(gate is live on ${[...MAPS.values()].filter(gateIsLive).length} maps; the rest are swept to levelReq 1 by design)\n`);
let total = 0;
for (const [kind, list] of Object.entries(out)) {
  if (!list.length) { console.log(`${kind}: clean\n`); continue; }
  total += list.length;
  console.log(`${kind}  (${list.length})`);
  const show = ALL ? list : list.slice(0, 12);
  for (const f of show) console.log(`   ${f.t.padEnd(22)} ${f.detail}${f.map ? `\n      in ${f.map.name} (${f.map.id})` : ''}`);
  if (list.length > show.length) console.log(`   … +${list.length - show.length} more (--all)`);
  console.log('');
}
console.log(total ? `${total} finding(s).` : 'No level/advertising mismatches.');
process.exit(total ? 1 : 0);
