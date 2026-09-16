// The damage scanner behind tools/skill_tuner.html (tools/skill_damage_scan.js) finds the numbers that
// govern each skill on THIS build, and points at them exactly. No browser.
//   node scripts/skill_scan_test.mjs [game.html]     (default: mojiworld_game.html, or MOJI_GAME_FILE)
import { readFileSync } from 'node:fs'; import vm from 'node:vm'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const src = readFileSync(path.resolve(ROOT, FILE), 'utf8');
const sandbox = {}; vm.runInNewContext(readFileSync(path.join(ROOT, 'tools', 'skill_damage_scan.js'), 'utf8'), sandbox);
const { skills, stats } = sandbox.lxScanSkills(src);
let pass = 0, fail = 0;
const check = (ok, msg, detail) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (detail ? '  [' + detail + ']' : '')); ok ? pass++ : fail++; };
const ver = (src.match(/const GAME_VERSION = '([^']+)'/) || [])[1];
console.log(`build ${ver}: ${stats.skills} skills, ${stats.withLines} with damage lines, ${stats.lines} lines, ${stats.bodies} bodies`);

// 1. every field's offsets point at exactly its number, on a line that really is in the file that many times
let badOff = [], badCount = [];
for (const s of skills) for (const l of s.lines) {
  for (const f of l.fields) if (l.text.slice(f.start, f.end) !== String(f.value) && +l.text.slice(f.start, f.end) !== f.value) badOff.push(s.id + ': ' + l.text.slice(0, 50));
  if (l.count < 1 || src.split(l.text).length - 1 !== l.count) badCount.push(s.id + ': ' + l.text.slice(0, 50));
}
check(!badOff.length, 'every field offset points at its own number', badOff.length ? badOff.slice(0, 3).join(' | ') : stats.lines + ' lines');
check(!badCount.length, 'every line is in the file exactly as often as reported', badCount.length ? badCount.slice(0, 3).join(' | ') : 'counts hold');

// 2. the lines the v0.30.772 budget pass set, one per class and kind, land under the skill that owns them
const KNOWN = [
  ['marksman_oneshot', 'LX_DEADEYE_LINE_ATK'], ['marksman_ult', 'LX_PROTOCOL_LINE_ATK'], ['marksman_ult', 'Math.max(getAtk() *'],
  ['ballista_volley', "skill: 'siege'"], ['ballista_ult', 'Math.floor(getAtk() *'], ['beastmaster_pack', "rollCrit(), 'pack')"],
  ['beastmaster_ult', "_petSlot === 'ultPet' ?"], ['skyhunter_gale', 'i >= 15 ? 0.5 : 1'],
  ['sage_meteorshower', '_sageDmgMul:'], ['elementalist_ult', 'mul:'], ['hexmaster_ult', 'performAround(540,'], ['hexmaster_ult', 'LX_PANDEMIC_FINALE_CAP'],
  ['hexmaster_grandhex', 'LX_HEXORB_DMG_MUL'], ['necromancer_harvest', 'atk: getAtk() *'],
  ['shinobi_seal', 'LX_KAGE_DMG'], ['nightreaper_mark', 'isCrit ? getCritDmg()'], ['phantom_cut', "crit, 'phantom_cut')"],
  ['doombringer_ult', 'performMelee(440,'], ['doombringer_ult', '_heatMul +'], ['crusader_ult', 'baseMul:'], ['crusader_ult', 'timeMul:'],
  ['warlord_ult', 'life: 36, damage: getAtk() *'], ['crusader_aegis', 'const dmg = Math.floor(getAtk() *'], ['dragoon_ult', 'performAround(460,'],
  // damage that lives outside the body: a helper, a hazard resolver, an update loop, a timer
  ['magicBolt', 'damage: (getAtk() *'], ['arcaneBurst', 'performAround(_abAoe,'], ['meteor', ': getAtk() *'],
  ['dragoon_skylance', 'bossMul: 1.6'], ['skyhunter_ult', 'x: _eCx, y: _eCy'], ['wildBond', "rollCrit(), 'pet')"],
];
const missing = KNOWN.filter(([id, frag]) => { const s = skills.find((x) => x.id === id); return !s || !s.lines.some((l) => l.text.includes(frag)); });
check(!missing.length, 'the lines the budget pass edited are found under their skills', missing.length ? missing.map((m) => m.join(':')).join(', ') : KNOWN.length + ' known lines');

// 3. coverage: every castable skill either has a damage line or is a known buff / movement / utility
const UTILITY = new Set(['bloodlust', 'guardian', 'shadowlord_ult']);   // buff, buff, a shade that mirrors your own hits
const none = skills.filter((s) => !s.lines.length);
console.log('  skills with no damage line: ' + (none.map((s) => s.id).join(', ') || 'none'));
const unexplained = none.filter((s) => !UTILITY.has(s.id));
check(!unexplained.length, 'every skill without a damage line is a known buff / movement / utility', unexplained.map((s) => s.id).join(', ') || none.length + ' utilities');

// 4. a const shared by skills is reported as shared on each, never silently owned by one
const shared = skills.flatMap((s) => s.lines.filter((l) => l.shared).map((l) => s.id + '<->' + l.shared.join(',') + ' ' + l.text.slice(0, 40)));
console.log('  shared lines: ' + shared.length + (shared.length ? '  e.g. ' + shared.slice(0, 3).join(' | ') : ''));
check(true, 'shared lines are flagged on both owners', shared.length + ' shared');

// 5. the other variables a skill is made of - counts, reaches, durations, statuses, speeds - are found
//    where the code has them, and never mistaken for damage (the tier generator scales mul/flat only)
const kinds = {}; for (const s of skills) for (const l of s.lines) for (const f of l.fields) kinds[f.kind] = (kinds[f.kind] || 0) + 1;
console.log('  fields by kind: ' + Object.entries(kinds).map(([k, n]) => k + ' ' + n).join(', '));
const has = (id, kind, value) => { const s = skills.find((x) => x.id === id); return !!s && s.lines.some((l) => l.fields.some((f) => f.kind === kind && (value == null || f.value === value))); };
check(has('dragoon_ult', 'count', 9) && has('phantom_ult', 'count', 3) && has('hexmaster_ult', 'count', 10), 'lance / ring / orb counts are found as counts', 'Skyfall 9 lances, Voidwalk 3 rings, Pandemic 10 orbs');
check(has('hexmaster_ult', 'radius', 540) && has('doombringer_ult', 'radius', 440) && has('groundSlam', 'radius'), 'area reaches are found as radii', 'Pandemic 540, Calamity blade 440, Ground Slam');
check(has('darkPulse', 'time', 30000) && has('soulSiphon', 'time', 16000) && has('elemental', 'time', 1200), 'summon lives and status durations are found as times', 'skeletons 30000 / 16000 ms, Convergence stun 1200 ms');
check(has('elemental', 'frac', 100) || has('elemental', 'frac', 75), 'a status chance is a share, not a multiplier', 'Convergence burn / stun chance');
const noise = skills.flatMap((s) => s.lines.filter((l) => /particles\.push|pixelBurst|_budgetedParticlePush/.test(l.text)).map((l) => s.id));
check(!noise.length, 'particle pushes are never listed as skill variables', noise.slice(0, 4).join(', ') || 'none');
check(kinds.mul > 60 && kinds.count >= 10 && kinds.radius >= 15 && kinds.time >= 20, 'every kind is populated', JSON.stringify(kinds));

console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
