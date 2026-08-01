// LEVEL CONSISTENCY AUDIT — every place the game states a level, checked
// against what is actually there. Boots the real game: static parsing of this
// file is a minefield (IIFE-valued maps, loop-built zodiac maps, the
// levelReq->1 sweep, inline `level:` shadowing MOB_NATURAL_LEVEL).
//
// A  BOSS vs ARENA     boss level vs its arena's live levelReq
// B  SIGNPOST vs MOBS  portal label "(Lv N)" vs the roster behind it
// C  QUEST vs TARGET   quest levelReq vs the level of what it sends you at
// D  MAP TIER vs MOBS  the map's AUTHORED levelReq (designer intent, before
//                      the sweep) vs its own roster
// E  MISSING LEVEL     boss with no resolvable level, or no arena
//
// Run: node scripts/level_consistency_audit.mjs [--all]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ALL = process.argv.includes('--all');
const html = fs.readFileSync(path.join(ROOT, 'mojiworld_game.html'), 'utf8');

// authored levelReq straight from source — runtime has been swept to 1 on open
// maps, so this is the only place the designer's tier intent survives.
const authored = {};
{
  const re = /^ {2}([a-zA-Z_]\w*)\s*:\s*(?:\(\(\)\s*=>\s*)?\{|^MAPS\.([a-zA-Z_]\w*)\s*=\s*\{/gm;
  let m;
  while ((m = re.exec(html))) {
    const id = m[1] || m[2];
    const from = m.index + m[0].length;
    const nx = html.slice(from).search(/^ {2}[a-zA-Z_]\w*\s*:\s*[({]|^MAPS\.[a-zA-Z_]\w*\s*=|^\};/m);
    const body = html.slice(from, nx < 0 ? from + 20000 : from + nx);
    const q = +(body.match(/levelReq\s*:\s*(\d+)/) || [])[1];
    if (Number.isFinite(q) && authored[id] === undefined) authored[id] = q;
  }
}

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
await page.goto('file:///' + path.join(ROOT, 'mojiworld_game.html').replace(/\\/g, '/'), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof MAPS !== 'undefined' && typeof QUESTS !== 'undefined' && Object.keys(MAPS).length > 10, { timeout: 60000 });

const F = await page.evaluate((authored) => {
  const out = [];
  const add = (kind, where, detail) => out.push({ kind, where, detail });
  // resolution order mirrors _mobLevel exactly
  const lvOf = (t) => {
    const d = monsterTypes[t];
    if (d && typeof d.level === 'number' && d.level > 0) return d.level;
    if (typeof MOB_NATURAL_LEVEL !== 'undefined' && MOB_NATURAL_LEVEL[t]) return MOB_NATURAL_LEVEL[t];
    return null;
  };
  const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const roster = (id) => {
    const m = MAPS[id]; if (!m) return null;
    const lv = [];
    for (const s of (m.spawns || [])) { const l = lvOf(s.type); if (l) lv.push(l); }
    if (m.bossType) { const l = lvOf(m.bossType); if (l) lv.push(l); }
    if (!lv.length) return null;
    const s = lv.sort((a, b) => a - b);
    return { min: s[0], max: s[s.length - 1], med: med(s), n: s.length };
  };
  const gateLive = (m) => !!(m.isBossArena || m.isTower) || m.levelReq > 1;

  for (const id of Object.keys(MAPS)) {
    const m = MAPS[id];
    // A — boss vs its arena
    if (m.bossType) {
      const lv = lvOf(m.bossType);
      if (lv == null) add('E MISSING LEVEL', id, `bossType '${m.bossType}' has no resolvable level`);
      else if (gateLive(m) && typeof m.levelReq === 'number') {
        const g = lv - m.levelReq;
        if (Math.abs(g) >= 10) add('A BOSS vs ARENA', id, `${m.bossType} Lv${lv} vs live gate ${m.levelReq} (${g > 0 ? '+' : ''}${g})`);
      }
    }
    // B — signpost vs roster
    for (const p of (m.portals || [])) {
      if (!p || !p.name || !p.dest) continue;
      const c = /Lv\s*(\d+)/.exec(p.name); if (!c) continue;
      const r = roster(p.dest); if (!r) continue;
      const off = r.med - +c[1];
      // A sign BELOW its roster is the house convention: the endgame ladder
      // (Furnace Deep 55/Lv60-66, Glasswind 61/Lv67-72, Hollow Sepulchre
      // 65/Lv73-79, Wayfarer's 68/Lv76-80) consistently advertises the
      // recommended entry level ~8-12 under the mobs. Only two things are
      // actually wrong: a sign that OVER-promises (roster weaker than
      // advertised — you are told to out-level content you then trivialise),
      // or one that under-promises by more than the convention's spread.
      if (off < -5) add('B SIGNPOST', p.dest, `sign "${p.name}" says Lv${c[1]} but roster is only ${r.min}/${r.med}/${r.max} (${off}) — over-promises`);
      else if (off > 15) add('B SIGNPOST', p.dest, `sign "${p.name}" says Lv${c[1]}, roster ${r.min}/${r.med}/${r.max} (+${off}) — beyond the ~8-12 convention`);
    }
    // D — authored tier vs roster
    // Scaling maps re-stat their roster at spawn — the Tower via its
    // escalation multipliers, clockworkExpress via `expressScaling` (mobs are
    // rebuilt at the LIVE player level). Their authored levels are inputs to
    // a curve, not a claim about what you will meet, so the comparison is
    // meaningless there.
    if (m.isTower || m.expressScaling) continue;
    const a = authored[id], r = roster(id);
    if (typeof a === 'number' && a > 1 && r && Math.abs(r.med - a) >= 10) {
      // LIVE = the sweep exempts this map, so the value actually drives the
      // world-map "Lv N+ recommended" tooltip and _diffDmg's fallback.
      // INERT = swept to levelReq 1 at load; the number is a design record
      // only, and nothing in the running game reads it.
      const live = gateLive(m) ? 'LIVE ' : 'inert';
      add('D MAP TIER', id, `[${live}] authored levelReq ${a}, roster ${r.min}/${r.med}/${r.max} (${r.med - a > 0 ? '+' : ''}${r.med - a})`);
    }
  }
  // C — quest vs what it sends you at
  for (const qid of Object.keys(QUESTS)) {
    const q = QUESTS[qid];
    if (typeof q.levelReq !== 'number') continue;
    const targets = [];
    if (q.target && monsterTypes[q.target]) targets.push(q.target);
    for (const o of (q.objectives || [])) if (o && o.target && monsterTypes[o.target]) targets.push(o.target);
    const lv = targets.map(lvOf).filter((x) => x != null);
    if (!lv.length) continue;
    const hi = Math.max(...lv);
    const g = hi - q.levelReq;
    // Auto-generated bestiary quests use a DELIBERATE offset:
    //   _lvlReq = isBossQ ? lvl - 10 : lvl - 2
    // so "+10 under a boss" is the rule working, not a bug. Hold generated
    // quests to their own formula and hand-written ones to a looser band.
    // The generator ships three study tiers, each with its own offset:
    //   base    _lvlReq = isBossQ ? lvl - 10 : lvl - 2
    //   greater _gLv    = max(_lvlReq + 5, lvl + 3)
    //   apex    aLv     = lvl + 6
    const isGen = /^b_/.test(qid);
    const isBossQ = q.kind === 'boss' || !!(monsterTypes[q.target] || {}).boss;
    if (isGen) {
      const base = Math.max(1, hi - (isBossQ ? 10 : 2));
      const want = /_apex$/.test(qid) ? hi + 6
                 : /_greater$/.test(qid) ? Math.max(base + 5, hi + 3)
                 : base;
      if (q.levelReq !== want) add('C QUEST', qid, `"${q.name}" levelReq ${q.levelReq}, formula says ${want} (target Lv${hi}${isBossQ ? ', boss' : ''})`);
    } else if (isBossQ) {
      if (g > 15) add('C QUEST', qid, `"${q.name}" levelReq ${q.levelReq} vs boss Lv${hi} (+${g}) — beyond the -10 boss rule`);
    } else if (g >= 10 && !q.noScale) {
      add('C QUEST', qid, `"${q.name}" levelReq ${q.levelReq}, hardest target ${targets[lv.indexOf(hi)]} Lv${hi} (+${g})`);
    } else if (g <= -15) {
      add('C QUEST', qid, `"${q.name}" levelReq ${q.levelReq}, toughest target only Lv${hi} (${g})`);
    }
  }
  return out;
}, authored);
await browser.close();

const byKind = {};
for (const f of F) (byKind[f.kind] = byKind[f.kind] || []).push(f);
console.log('=== LEVEL CONSISTENCY AUDIT ===\n');
for (const k of ['A BOSS vs ARENA', 'B SIGNPOST', 'C QUEST', 'D MAP TIER', 'E MISSING LEVEL']) {
  const list = byKind[k] || [];
  if (!list.length) { console.log(`${k}: clean\n`); continue; }
  console.log(`${k}  (${list.length})`);
  const show = ALL ? list : list.slice(0, 14);
  for (const f of show) console.log(`   ${f.where.padEnd(24)} ${f.detail}`);
  if (list.length > show.length) console.log(`   … +${list.length - show.length} more (--all)`);
  console.log('');
}
console.log(F.length ? `${F.length} finding(s).` : 'All stated levels agree with what is there.');
process.exit(F.length ? 1 : 0);
