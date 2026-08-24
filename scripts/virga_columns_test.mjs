#!/usr/bin/env node
// Virga the Seraph — light columns, not fireballs.
// ============================================================================
// Per user: "Virga should not be shooting fireballs, it should rain columns of
// light rays, that does significant significant damage, occasional leaves user
// with 1hp."
//
// The live probe before the change: 142 samples of a Virga fight, zero enemy
// projectiles, 45 meteor_warn hazards. So the "fireballs" were her Banishment
// retaliation, which is the ONLY meteor she owns — and she had no columnStrike
// trait at all (traits: null). Both halves of that are pinned below.
//
// The checks that matter most are the arithmetic ones. A volley is only an
// attack if it can be dodged, and "3 pillars centred on you" is trivially
// tunable into "a wall": lanePitch below measures the actual gap between
// adjacent pillars, so a later balance pass that closes it fails here rather
// than in someone's playthrough.
//
//   node scripts/virga_columns_test.mjs [build.html]
// ============================================================================
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = process.argv[2] || join(root, 'mojiworld_game.html');
const s = readFileSync(file, 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
};

// ---- the art is registered and present -------------------------------------
ok('fx_col_zodiac_virgo registered in LX_FX', /fx_col_zodiac_virgo:\s*'fx_col_zodiac_virgo\.webp'/.test(s));
ok('tg_col_zodiac_virgo registered in LX_FX', /tg_col_zodiac_virgo:\s*'tg_col_zodiac_virgo\.webp'/.test(s));
for (const f of ['fx_col_zodiac_virgo.webp', 'tg_col_zodiac_virgo.webp'])
  ok(`Sprites/fx/${f} on disk`, existsSync(join(root, 'Sprites', 'fx', f)));

// ---- she has the trait at all ----------------------------------------------
const trait = s.match(/if \(z\.id === 'virgo'\) \{[\s\S]{0,900}?\n  \}/);
ok('virgo opts into columnStrike', !!trait && /columnStrike\s*=/.test(trait[0]));
const T = trait ? trait[0] : '';
ok('the trait points at her own pillar art', /sprite:\s*'fx_col_zodiac_virgo'/.test(T));
ok('activeBoss is set (boss handlers are opt-in)', /activeBoss\s*=\s*true/.test(T));

// ---- it RAINS: more than one pillar, with a dodgeable gap -------------------
const count = Number((T.match(/count:\s*(\d+)/) || [])[1] || 0);
const spread = Number((T.match(/spread:\s*(\d+)/) || [])[1] || 0);
const width = Number((T.match(/width:\s*(\d+)/) || [])[1] || 0);
ok('the volley is more than one pillar', count >= 3, `count=${count}`);
const pitch = count > 1 ? spread / (count - 1) : 0;
const gap = pitch - width;
ok('adjacent pillars leave a standable gap', gap >= 120,
  `pitch=${pitch.toFixed(0)} width=${width} gap=${gap.toFixed(0)} (need >=120)`);

// ---- significant damage, and the 1-HP option -------------------------------
const dmgMul = Number((T.match(/dmgMul:\s*([\d.]+)/) || [])[1] || 0);
ok('hits far harder than the generic column (1.25x)', dmgMul >= 2, `dmgMul=${dmgMul}`);
ok('radiance can leave the player on 1 HP', /radiance:\s*\{[^}]*frac:\s*0\.99/.test(T));
const chance = Number((T.match(/radiance:\s*\{[^}]*chance:\s*([\d.]+)/) || [])[1] || 0);
ok('radiance is OCCASIONAL, not every hit', chance > 0 && chance <= 0.35, `chance=${chance}`);

// ---- the engine actually fires and resolves the volley ----------------------
ok('_columnLanesFor helper exists', /function _columnLanesFor\(cs, cx\)/.test(s));
ok('the trait handler builds lanes at telegraph time', /m\._columnLanes = _columnLanesFor\(cs, _playerCx\)/.test(s));
ok('the strike spawns one pillar per lane', /for \(const _lane of _csLanes\) game\.projectiles\.push\(\{/.test(s));
ok('every lane is drawn as a danger zone', /for \(const _zl of _zLanes\) out\.push\(\{ kind: 'column'/.test(s));
ok('the pillar carries its radiance option', /_radiance: cs\.radiance \|\| null/.test(s));
ok('radiance resolves through the isFrac 99.9% ceiling', /_projLost = \(typeof _diffDmg === 'function'\) \? _diffDmg\(_rg, 0, true\)/.test(s));
ok('radiance respects block / warrior DR / aegis', /_rg = Math\.max\(1, Math\.floor\(_rg \* 0\.3\)\)/.test(s)
  && /_warriorDr\(\)\)\);?\s*\n\s*if \(player\._aegis\) _rg/.test(s.replace(/\r/g, '')));
ok('the death log names the pillar, not "a stray bolt"', /player\._lastDamageSource = player\._radianceHit \|\|/.test(s));

// ---- and she has stopped throwing the fireball ------------------------------
const virgoAi = s.match(/\n  virgo\(m, dt, dist, phase, z\) \{[\s\S]*?\n  \},\n/);
ok('the virgo AI block was found', !!virgoAi);
const V = virgoAi ? virgoAi[0] : '';
ok('NO meteor_warn anywhere in the virgo AI', !/meteor_warn/.test(V),
  V.match(/meteor_warn/g) ? `${V.match(/meteor_warn/g).length} left` : '');
ok('Banishment retaliates with a column volley', /m\._columnLanes = _columnLanesFor\(_vCs, _vCx\)/.test(V));

console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
