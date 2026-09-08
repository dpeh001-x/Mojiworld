// ANIMATOR MIRROR PARITY — the animator hand-copies the game's geometry tables, and the
// copies drift. Found 2026-09-08: ATK_FRAME_SCALE had picked up entries the game does not
// have (smithgolem 1.881, conductorMech 1.69) and disagreed on two more (fatDragon 1.951
// vs 1.199, tombKeeper 2.13 vs 1.7), so the tool drew those monsters' ATTACK state up to
// 88% larger than the game does. The smith golem's art was rebuilt three times chasing a
// discrepancy that lived in this table.
//
// Every table the animator claims is "verbatim" from the game is diffed here. Render-
// affecting drift fails; so does the (currently inert) content-norm drift, because an
// inert table is exactly the one nobody notices going stale.
//   node scripts/animator_table_parity_test.mjs
import { readFileSync } from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const game = readFileSync(process.env.MOJI_GAME_FILE || path.join(ROOT, 'mojiworld_game.html'), 'utf8');
const anim = readFileSync(process.env.MOJI_ANIM_FILE || path.join(ROOT, 'monster_animator.html'), 'utf8');
let pass = 0, fail = 0;
const ok = (n, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS  ' : 'FAIL  ') + n + (note ? '  ' + note : '')); };
const numTable = (src, re) => { const m = src.match(re); if (!m) return null; const t = {}; for (const mm of m[1].matchAll(/([A-Za-z_$][\w$]*)\s*:\s*([\d.]+)/g)) t[mm[1]] = +mm[2]; return t; };
const strSet = (src, re) => { const m = src.match(re); if (!m) return null; return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort(); };
const num = (src, re) => { const m = src.match(re); return m ? +m[1] : null; };
const diffTable = (label, g, a) => {
  if (!g || !a) return ok(label, false, `table not found (game ${g ? 'ok' : 'MISSING'}, animator ${a ? 'ok' : 'MISSING'})`);
  const keys = [...new Set([...Object.keys(g), ...Object.keys(a)])].sort();
  const bad = keys.filter((k) => g[k] !== a[k]).map((k) => `${k}: game ${g[k] ?? '(none)'} / animator ${a[k] ?? '(none)'}`);
  ok(label, bad.length === 0, bad.length ? bad.join('; ') : `${keys.length} entries agree`);
};
const diffSet = (label, g, a) => {
  if (!g || !a) return ok(label, false, `set not found (game ${g ? 'ok' : 'MISSING'}, animator ${a ? 'ok' : 'MISSING'})`);
  const only = (x, y) => x.filter((k) => !y.includes(k));
  const bad = [...only(g, a).map((k) => 'game only: ' + k), ...only(a, g).map((k) => 'animator only: ' + k)];
  ok(label, bad.length === 0, bad.length ? bad.join('; ') : `${g.length} members agree`);
};
// ---- render-affecting ------------------------------------------------------
diffTable('_ATK_FRAME_SCALE: the monster attack-padding multiplier',
  numTable(game, /const _ATK_FRAME_SCALE = Object\.assign\(Object\.create\(null\), \{([\s\S]*?)\n\}\);/),
  numTable(anim, /const ATK_FRAME_SCALE = \{([\s\S]*?)\n  \};/));
diffTable('_BOSS_ATK_SCALE: the boss attack multiplier',
  numTable(game, /const _BOSS_ATK_SCALE = \{([^}]*)\};/), numTable(anim, /const BOSS_ATK_SCALE = \{([^}]*)\};/));
const gms = { idle: num(game, /const _BOSS_IDLE_FRAME_MS = (\d+);/), walk: num(game, /const _BOSS_WALK_FRAME_MS = (\d+);/), attack: num(game, /const _BOSS_ATK_FRAME_MS = (\d+);/), duck: num(game, /const _BOSS_DUCK_FRAME_MS = (\d+);/), weave: num(game, /const _BOSS_WEAVE_FRAME_MS = (\d+);/) };
const ams = numTable(anim, /const GAME_FRAME_MS = \{([^}]*)\};/);
diffTable('boss frame clocks (idle / walk / attack / duck / weave ms)', gms, ams && { idle: ams.idle, walk: ams.walk, attack: ams.attack, duck: ams.duck, weave: ams.weave });
ok('the zodiac states borrow the right clocks (fly = walk, pounce/charge = attack)',
  !!ams && ams.fly === gms.walk && ams.pounce === gms.attack && ams.charge === gms.attack,
  ams ? `fly ${ams.fly}, pounce ${ams.pounce}, charge ${ams.charge}` : 'GAME_FRAME_MS missing');
const gb = num(game, /const _BURY_MAX_PX = (\d+);/), ab = num(anim, /BURY_MAX_PX = (\d+)/);
ok('_BURY_MAX_PX: the anti-sinking clamp', gb != null && gb === ab, `game ${gb} / animator ${ab}`);
// ---- content-norm sets (inert while _BOSS_FRAME_TRUST_ALL is true, fenced anyway) ----
diffSet('_BOSS_BODYLOCK', strSet(game, /const _BOSS_BODYLOCK = new Set\(\[([^\]]*)\]\)/), strSet(anim, /const BODYLOCK = new Set\(\[([^\]]*)\]\)/));
diffSet('_BOSS_FRAME_TRUST', strSet(game, /const _BOSS_FRAME_TRUST = new Set\(\[([^\]]*)\]\)/), strSet(anim, /const FRAME_TRUST = new Set\(\[([^\]]*)\]\)/));
diffSet('_BOSS_ATK_NOSHRINK', strSet(game, /const _BOSS_ATK_NOSHRINK = new Set\(\[([^\]]*)\]\)/), strSet(anim, /const ATK_NOSHRINK = new Set\(\[([^\]]*)\]\)/));
diffSet('_BOSS_SIZE_STRICT', strSet(game, /const _BOSS_SIZE_STRICT = new Set\(\[([^\]]*)\]\)/), strSet(anim, /const SIZE_STRICT = new Set\(\[([^\]]*)\]\)/));
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exitCode = fail ? 1 : 0;
