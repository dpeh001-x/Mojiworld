// Sage + Marksman burst (v0.30.391): the last two skills of each master hit 25%
// harder. Measured with the master-skill audit harness (one cast, 8s window, pinned
// immortal dummies, Lv 50 ATK 400) against the v0.30.390 figures, and the four
// multipliers are checked in the shipped source.
//   MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override the served tree.
import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT; const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html'; const PORT = process.env.PORT || '10031';
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
// v0.30.390, same harness, same settings. One run of the harness swings +/-9% on the same build (its own header
// says so), so the measurement is a 2-rep mean and the band is +12% to +40% around the +25% the multipliers carry.
const BEFORE = { sage_meteorshower: 35.2, sage_ult: 3.4, marksman_oneshot: 20, marksman_ult: 193.6 };
const NAMES = { sage_meteorshower: 'Pyre Columns (Sage X)', sage_ult: 'Meteor Sigil (Sage B, one comet)', marksman_oneshot: 'Deadeye (Marksman X, one rail)', marksman_ult: 'Deadeye Protocol (Marksman B)' };
// the multipliers in the shipped source
const src = readFileSync(path.join(SERVE_ROOT, FILE), 'utf8');
ok('Pyre Columns lanes are 4.9x ATK (were 3.9x)', src.indexOf('_sageDmgMul: 4.9, _fireColumn: true,') >= 0);
ok('Meteor Sigil comets are 5.25x ATK + 33 (were 4.2x + 26)', src.indexOf('damage: getAtk() * 5.25 + 33,') >= 0);
ok('Deadeye rails are 2.4x ATK + 19 (were 1.9x + 15)', src.indexOf('const LX_DEADEYE_DMG     = 2.4;') >= 0 && src.indexOf('const LX_DEADEYE_FLAT    = 19;') >= 0);
ok('Deadeye Protocol rounds are 3.75x ATK + 25 (were 3.0x + 20)', src.indexOf('damage: getAtk() * 3.75 + 25,') >= 0);
// the measurement
const harness = [path.join(SERVE_ROOT, 'scripts', 'master_skill_audit.mjs'), path.join(ROOT, 'scripts', 'master_skill_audit.mjs')].find((p) => existsSync(p));
const run = spawnSync(process.execPath, [harness, '--skills=' + Object.keys(BEFORE).join(','), '--reps=2', '--json'], { cwd: SERVE_ROOT, env: Object.assign({}, process.env, { MOJI_GAME_FILE: FILE, PORT: String(PORT) }), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 560000 });
let rows = [];
try {
  const txt = String(run.stdout || '');
  const at = txt.lastIndexOf('\n{');   // the harness prints progress lines before its JSON
  rows = JSON.parse(txt.slice(at >= 0 ? at + 1 : txt.indexOf('{'))).rows || [];
} catch (e) { console.log('FAIL harness: audit output unreadable: ' + String(run.stderr || run.stdout || e).slice(0, 300)); fail++; }
for (const id of Object.keys(BEFORE)) {
  const r = rows.find((x) => x.id === id); const before = BEFORE[id]; const now = r ? r.xatk : null; const ratio = now != null ? now / before : 0;
  ok(`${NAMES[id]}: ${before}x -> ${now}x ATK per cast, +12% to +40% (2-rep mean)`, r && !r.castErr && ratio >= 1.12 && ratio <= 1.40, r ? `ratio ${ratio.toFixed(3)} cd ${r.cds}s sustained ${r.sust}` : 'not measured');
}
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
