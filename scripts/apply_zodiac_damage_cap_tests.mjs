// zodiac-damage-cap, second apply: two existing confirming tests follow the shared zodiac cap (per user: Story 30%, Normal 45%,
// Hard 65%, Nightmare 85% for all twelve signs; Regulus shipped with 30/45/55/65 in v0.30.1850).
//   scripts/regulus_damage_test.mjs - only his Nightmare figure is asserted there: the 65% checks become 85%.
//   scripts/zodiac_projectile_damage_test.mjs - it fires shot after shot with the hero's i-frames zeroed between them, faster
//     than any real fight; the cap's 1.2 s window (capped zodiac hits inside it share one cap) would then trim the next shot of
//     a 400,000-HP bar. Each shot now starts with the window cleared too, as if the i-frames had run out.
// Guarded (each anchor must match exactly once) + atomic + idempotent per file. EOL-aware. Run from the repo root.
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
function patch(F, edits, lo, hi) {
  let s = readFileSync(F, 'utf8');
  const n0 = s.length;
  if (s.includes('zodiac-damage-cap')) { console.log('already applied: ' + path.basename(F)); return; }
  const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(path.basename(F) + ': ' + what + ' matched ' + n); s = s.replace(a, () => b); };
  for (const [a, b, what] of edits) once(a, b, what);
  const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
  if (crlf > lf / 2) s = s.replace(/\r?\n/g, '\r\n');   // a new line follows the file's own EOL
  const grew = s.length - n0;
  if (grew < lo || grew > hi) die(path.basename(F) + ': size moved ' + grew);
  writeFileSync(F + '.tmp', s, 'utf8');
  renameSync(F + '.tmp', F);
  console.log('applied: zodiac-damage-cap (' + path.basename(F) + ', +' + grew + ' chars)');
}
patch(process.env.LX_REGULUS_TEST || path.join(ROOT, 'scripts', 'regulus_damage_test.mjs'), [
  ['capped at 45% (Normal) / 65% (Nightmare).', 'capped at 45% (Normal) / 85% (Nightmare)\n// (v0.30.x zodiac-damage-cap: the cap table every sign shares).', 'header'],
  ['  // ---- Lv 80 mage, Nightmare: the cap is 65%, no attack ends a full bar', '  // ---- Lv 80 mage, Nightmare: the cap is 85% (v0.30.x zodiac-damage-cap), no attack ends a full bar', 'Nightmare comment'],
  ['const capB = Math.floor(B.maxHp * 0.65);', 'const capB = Math.floor(B.maxHp * 0.85);', 'Nightmare cap'],
  ['Lv 80 mage, Nightmare: a Sun Comet takes at most 65%', 'Lv 80 mage, Nightmare: a Sun Comet takes at most 85%', 'comet label'],
  ['Lv 80 mage, Nightmare: a roar shot takes at most 65%', 'Lv 80 mage, Nightmare: a roar shot takes at most 85%', 'roar label'],
], 40, 200);
patch(process.env.LX_ZPD_TEST || path.join(ROOT, 'scripts', 'zodiac_projectile_damage_test.mjs'), [
  ['        player.blockTimer = 0; player._aegis = false;',
    '        player.blockTimer = 0; player._aegis = false;\n        game._lxZc = null;   // v0.30.x zodiac-damage-cap - a fresh hit: the cap\'s 1.2 s window is cleared with the i-frames', 'shot reset'],
], 60, 220);
