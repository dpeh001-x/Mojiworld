// ART SWEEP report builder: metrics.json + dead.json + keys.json -> flagged.json + markdown tables (stdout).
//   node scripts/art_sweep_report.mjs <artdir>
import { readFileSync, writeFileSync } from 'node:fs';
const A = process.argv[2];
const M = JSON.parse(readFileSync(A + '/metrics.json', 'utf8')), D = JSON.parse(readFileSync(A + '/dead.json', 'utf8')), K = JSON.parse(readFileSync(A + '/keys.json', 'utf8'));
const deadSet = new Set(D.dead || []);
const refKeys = new Set(); for (const n of ['monsterTypes', 'MONSTER_SPRITES', 'BOSS_SPRITES', 'BOSS_ATTACK_FRAMES', 'BOSS_IDLE_FRAMES', 'BOSS_WALK_FRAMES', 'ZODIAC_SPRITES', 'LX_FX', 'LX_VFX', 'LX_SUMMON', 'LX_MOB_PROJ', 'LX_MOB_CAST', 'LX_PLAYER_PROJ', 'LX_BULT_PROJ', 'LX_ITEMS', 'LX_OBJECTS', 'LX_TILES', 'BG_IMAGES', 'LX_HAIR', 'LX_EYES', 'LX_MOUTH', '_PROJ_ANIM_KEYS', '_FX_ANIM_KEYS', 'mapSpawnTypes', 'mapNpcs']) for (const k of (K[n] || [])) refKeys.add(String(k).toLowerCase());
for (const f of (K.NPC_SPRITE_FILES || [])) refKeys.add(String(f).toLowerCase());
for (const f of (K.NPC_SPRITE_FILES || []).concat(K.mapNpcs || [])) refKeys.add(String(f).toLowerCase().replace(/\.(webp|png)$/, '').replace(/\s+/g, '_'));
const refSrc = new Set((K.registrySrcs || []).map((s) => s.toLowerCase()));
// every identifier-like token in the game source: a set key that appears there is referenced somehow (string, id, template stem)
const SRC = readFileSync(new URL('../mojiworld_game.html', import.meta.url), 'utf8');
const srcTokens = new Set(); for (const t of SRC.match(/[A-Za-z][A-Za-z0-9_]{2,}/g) || []) srcTokens.add(t.toLowerCase());
const OPAQUE_OK = /^(backgrounds\/|Sprites\/(floors|platforms|world|tiles|ui|boons|talents|skills|items)\/)/;   // opaque by design or icons
const BIG = /^Sprites\/(monsters|bosses|npc|summons|character|equipment)\//;
const files = M.filter((m) => !/\/_backup|_orig_backup|\/_icon_backup|New background/.test(m.p));
const flags = []; const flag = (p, sev, kind, why, action) => flags.push({ p, sev, kind, why, action });
// ---- per-file ----
const groups = {}; for (const m of files) { if (m.sharp == null) continue; const g = m.p.split('/').slice(0, 3).join('/'); (groups[g] = groups[g] || []).push(m.sharp); }
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const gmed = {}; for (const g in groups) gmed[g] = med(groups[g]);
for (const m of files) {
  if (m.err) { flag(m.p, 5, 'broken', m.err, 'replace (the file is unusable)'); continue; }
  const sprite = m.p.startsWith('Sprites/') && !OPAQUE_OK.test(m.p);
  if (sprite && !m.alpha) flag(m.p, 4, 'no-alpha', 'no alpha channel: draws as a solid rectangle', 'replace with a transparent export');
  else if (sprite && m.corners >= 200) flag(m.p, 4, 'opaque-corners', 'corners are opaque (alpha ' + m.corners + '): background not removed', 'replace with a transparent export');
  // cutoff: ink running into the TOP or a SIDE edge (a head, hand or weapon cut), or a flat cut along the bottom that is
  // wider than 40% of the body (bottom-flush feet are a convention for older sets, so plain bottom contact is not a cut)
  const rg = m.ring || { t: 0, b: 0, l: 0, r: 0 }; const cutEdges = [];
  if (rg.t >= 24) cutEdges.push('top ' + rg.t + 'px'); if (rg.l >= 24) cutEdges.push('left ' + rg.l + 'px'); if (rg.r >= 24) cutEdges.push('right ' + rg.r + 'px');
  // bottom contact is judged per set below (flush feet are a convention; a cut is a frame that is flush while its siblings are not)
  const face = /^Sprites\/character\/(mouth|eyes|head)\//.test(m.p);
  if (sprite && cutEdges.length && !/\/(fx|vfx|projectiles)\//.test(m.p) && !face) flag(m.p, 4, 'cutoff', 'ink runs into the canvas edge: ' + cutEdges.join(', '), 're-canvas (pad the frame) or regenerate the set');
  if (m.bytes < 4096 && Math.max(m.w, m.h) >= 256 && sprite && !face) flag(m.p, 3, 'tiny-file', m.bytes + ' bytes for ' + m.w + 'x' + m.h, 'check: over-compressed or near-empty');
  if (BIG.test(m.p) && !face && Math.max(m.bw || 0, m.bh || 0) < 200) flag(m.p, 3, 'low-res-body', 'body only ' + m.bw + 'x' + m.bh + ' px in a ' + m.w + 'x' + m.h + ' canvas', 'regenerate at a larger size (it is upscaled on screen)');
  // per-file softness only for STATIC sprites (sets are judged as a whole below)
  const g = m.p.split('/').slice(0, 3).join('/'); const inSet = /_\d+\.(webp|png)$/.test(m.p);
  if (!inSet && m.sharp != null && gmed[g] > 0 && groups[g].length >= 12 && m.sharp < gmed[g] * 0.3 && Math.max(m.bw, m.bh) > 160) flag(m.p, 2, 'soft', 'sharpness ' + m.sharp + ' vs folder median ' + gmed[g], 'replace with a sharper export or regenerate');
}
// ---- per-set ----
const sets = {}; for (const m of files) { const mm = m.p.match(/^(.*)\/([^/]+?)_(\d+)\.(webp|png)$/); if (!mm) continue; (sets[mm[1] + '/' + mm[2]] = sets[mm[1] + '/' + mm[2]] || []).push({ i: +mm[3], m }); }
const ham = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++; return d; };
const setRows = [];
for (const key in sets) {
  const fr = sets[key].sort((a, b) => a.i - b.i); const ms = fr.map((f) => f.m).filter((m) => !m.err); if (ms.length < 2) continue;
  const dir = key.split('/').slice(0, -1).join('/'); const name = key.split('/').pop();
  const isMob = /^Sprites\/(monsters|bosses|npc)\//.test(key); const st = /\/(idle|walk|attack|cast|dash|fly)\//.exec(key); const state = st ? st[1] : '';
  const idx = fr.map((f) => f.i); const gaps = []; for (let i = 0; i < idx[idx.length - 1]; i++) if (!idx.includes(i)) gaps.push(i);
  const dims = new Set(ms.map((m) => m.w + 'x' + m.h));
  const bh = ms.map((m) => m.bh), bots = ms.map((m) => m.bot), cxs = ms.map((m) => m.cx);
  const pulse = (Math.max(...bh) - Math.min(...bh)) / med(bh); const drift = Math.max(...bots) - Math.min(...bots);
  let jump = 0; for (let i = 1; i < cxs.length; i++) jump = Math.max(jump, Math.abs(cxs[i] - cxs[i - 1]));
  let dups = 0; for (let i = 1; i < ms.length; i++) if (ms[i].dh && ms[i - 1].dh && ham(ms[i].dh, ms[i - 1].dh) <= 2) dups++;
  const stem = name.replace(/_(walk|attack|idle|cast)$/, '');   // summon sets carry their state in the key (wolf_walk)
  const referenced = refKeys.has(name.toLowerCase()) || refKeys.has(stem.toLowerCase()) || srcTokens.has(name.toLowerCase()) || srcTokens.has(stem.toLowerCase()) || refSrc.has((dir.replace(/\/(idle|walk|attack|anim|cast)$/, '') + '/' + name + '.webp').toLowerCase());
  // bottom cut: some frames flush to the bottom edge with a wide flat run while sibling frames keep a margin
  const flush = ms.filter((m) => m.ring && m.ring.b >= Math.max(24, 0.4 * (m.bw || 0))); const margin = ms.filter((m) => m.bot < 0.985);
  if (isMob && flush.length && margin.length && flush.length < ms.length) flag(key, 4, 'bottom-cut', flush.length + ' of ' + ms.length + ' frames run flat into the bottom edge while the others keep a margin (frames ' + flush.map((m) => (m.p.match(/_(\d+)\./) || [])[1]).join(',') + ')', 're-canvas those frames (pad the bottom) or regenerate the set');
  const row = { key, n: ms.length, gaps, dims: [...dims], pulse: +pulse.toFixed(2), drift: +drift.toFixed(3), jump: +jump.toFixed(3), dups, referenced, state };
  setRows.push(row);
  if (dims.size > 1) flag(key, 4, 'set-canvas-mismatch', 'frames on different canvases: ' + [...dims].join(', '), 're-canvas onto one size (or regenerate)');
  const animDir = /\/(idle|walk|attack|anim|cast|dash|fly|pounce|duck|weave|charge)$/.test(dir);
  if (gaps.length && animDir) flag(key, 3, 'set-gap', 'missing frame index ' + gaps.join(','), 'regenerate the missing frames');
  const flier = new Set((K.fliers || []).map((s) => s.toLowerCase())).has(name.toLowerCase()) || /\/(fly)\//.test(key);
  if (isMob && state !== 'attack' && pulse > 0.18) flag(key, 3, 'set-pulse', 'body height varies ' + Math.round(pulse * 100) + '% across ' + state + ' frames', 'regenerate the set (or normalise frames on one body scale)');
  if (isMob && state === 'attack' && pulse > 0.55) flag(key, 2, 'set-pulse', 'body height varies ' + Math.round(pulse * 100) + '% across attack frames', 'check the swing; normalise if it is a scale drift not a pose');
  if (isMob && !flier && state !== 'attack' && drift > 0.06) flag(key, 3, 'set-drift', 'foot line moves ' + Math.round(drift * 100) + '% of the canvas across ' + state + ' frames (grounded type: it will bob on screen)', 're-canvas onto one foot line (recanvas script) or regenerate');
  if (isMob && jump > 0.15) flag(key, 3, 'set-jump', 'body centre jumps ' + Math.round(jump * 100) + '% of the canvas between consecutive frames', 'check for a flipped/misplaced frame; regenerate it');
  if (ms.length >= 6 && dups >= ms.length - 2) flag(key, 1, 'set-static', dups + ' of ' + (ms.length - 1) + ' consecutive frames near-identical (coarse hash: verify by eye)', 'if it really does not animate, regenerate');
  // soft SETS: the set's median sharpness against its folder's median (a style can be soft; a set far below its peers is worth a look)
  const sh = ms.map((m) => m.sharp).filter((v) => v != null); const g = key.split('/').slice(0, 3).join('/');
  if (sh.length >= 4 && gmed[g] > 0 && groups[g].length >= 24 && med(sh) < gmed[g] * 0.3 && Math.max(...ms.map((m) => Math.max(m.bw, m.bh))) > 160) flag(key, 2, 'set-soft', 'set median sharpness ' + med(sh) + ' vs folder median ' + gmed[g], 'replace with a sharper export or regenerate (unless the softness is the style)');
  if (!referenced && /^Sprites\/(monsters|bosses|npc|summons|fx|vfx|projectiles)\//.test(key)) flag(key, 1, 'set-unreferenced', 'no runtime registry names this key', 'verify, then delete or wire');
}
for (const m of files) if (deadSet.has(m.p) && /^(Sprites|backgrounds)\//.test(m.p)) flag(m.p, 1, 'dead', 'nothing references it (audit_dead_assets)', 'delete after a manual check');
flags.sort((a, b) => b.sev - a.sev || a.kind.localeCompare(b.kind) || a.p.localeCompare(b.p));
writeFileSync(A + '/flagged.json', JSON.stringify({ flags, setRows }, null, 1));
const byKind = {}; for (const f of flags) byKind[f.kind] = (byKind[f.kind] || 0) + 1;
console.log('files', files.length, '| sets', Object.keys(sets).length, '| flags', flags.length, JSON.stringify(byKind));
for (const kind of Object.keys(byKind)) { console.log('\n## ' + kind + ' (' + byKind[kind] + ')'); for (const f of flags.filter((x) => x.kind === kind).slice(0, 14)) console.log('  ' + f.p + '  -- ' + f.why); }
