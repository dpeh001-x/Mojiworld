// v0.29.296 — certify the skill rank-5/10 milestone ability windows.
// Static/structural checks on the tables + the wiring. Runtime behaviour of
// the verbs is covered by skill_milestone_runtime_test.mjs.
import { readFileSync } from 'node:fs';
const src = readFileSync('mojiworld_game.html', 'utf8');
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const block = (name) => {
  const i = src.indexOf('const ' + name + ' = {');
  if (i < 0) throw new Error('missing ' + name);
  let j = src.indexOf('{', i), d = 0, k = j;
  for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) break; } }
  return src.slice(j, k + 1);
};
const evalTable = (name) => new Function('return ' + block(name))();
const L10 = evalTable('SKILL_LV10_BONUS');
const L5 = evalTable('SKILL_LV5_BONUS');

// Skill ids
const skillsSrc = block('SKILLS');
const ids = [];
{ let d = 0;
  for (const line of skillsSrc.split('\n')) {
    const m = line.match(/^  ([A-Za-z_][\w]*)\s*:\s*\{/);
    if (m && d === 1) ids.push(m[1]);
    for (const ch of line) { if (ch === '{') d++; else if (ch === '}') d--; }
  } }

ok('every skill has a rank-10 milestone', ids.every(i => L10[i]),
   ids.filter(i => !L10[i]));
ok('every skill has a rank-5 milestone', ids.every(i => L5[i]),
   ids.filter(i => !L5[i]));
ok('no skill is left on the generic cooldown shave',
   ids.filter(i => !L10[i]).length === 0);

// All 13 job ultimates carry a real ability, not just a cd tweak.
const ults = ids.filter(i => /_ult$/.test(i));
ok('all job ultimates exist', ults.length >= 13, ults.length);
const dullUlts = ults.filter(i => {
  const b = L10[i];
  return !b || (!b.window && b.cdReduceMs == null && b.cdMs == null);
});
ok('no ultimate is left with nothing but a cooldown shave', dullUlts.length === 0, dullUlts);
const windowedUlts = ults.filter(i => L10[i] && L10[i].window);
ok('at least 11 ultimates open an ability window', windowedUlts.length >= 11, windowedUlts.length);

// Window shape validity
const winSkills = ids.filter(i => L10[i] && L10[i].window);
const VERBS = ['execute', 'lifesteal', 'chain', 'mark', 'refundOnKill'];
let badShape = null;
for (const id of winSkills) {
  const w = L10[id].window;
  if (!(w.ms > 0)) { badShape = id + ': ms'; break; }
  if (!VERBS.some(v => w[v] != null)) { badShape = id + ': no verb'; break; }
  if (w.execute && !(w.execute.frac > 0 && w.execute.frac < 0.5)) { badShape = id + ': execute frac'; break; }
  if (w.chain && !(w.chain.n >= 1 && w.chain.frac > 0 && w.chain.frac <= 1)) { badShape = id + ': chain'; break; }
  if (w.mark && !(w.mark.mul > 1 && w.mark.ms > 0)) { badShape = id + ': mark'; break; }
  if (w.lifesteal != null && !(w.lifesteal > 0 && w.lifesteal <= 0.35)) { badShape = id + ': lifesteal'; break; }
  if (w.refundOnKill != null && !(w.refundOnKill > 0 && w.refundOnKill <= 0.5)) { badShape = id + ': refund'; break; }
}
ok('every rank-10 window is well-formed and in range', badShape === null, badShape);
ok('execute never threshold-kills a boss (bossMul path required)',
   winSkills.every(i => !L10[i].window.execute || L10[i].window.execute.bossMul > 1));

// Rank 5 must be strictly weaker than rank 10 for the same skill.
const stronger = [];
for (const id of winSkills) {
  const a = L5[id] && L5[id].window, b = L10[id].window;
  if (!a) continue;
  if (a.ms >= b.ms) stronger.push(id + ':ms');
  if (a.lifesteal && b.lifesteal && a.lifesteal >= b.lifesteal) stronger.push(id + ':ls');
  if (a.refundOnKill && b.refundOnKill && a.refundOnKill >= b.refundOnKill) stronger.push(id + ':rf');
  if (a.execute && b.execute && a.execute.frac >= b.execute.frac) stronger.push(id + ':ex');
  if (a.mark && b.mark && a.mark.mul >= b.mark.mul) stronger.push(id + ':mk');
  if (a.chain && b.chain && (a.chain.n > b.chain.n || a.chain.frac >= b.chain.frac)) stronger.push(id + ':ch');
}
ok('rank 5 is strictly weaker than rank 10 everywhere', stronger.length === 0, stronger.slice(0, 6));

// Rank 5 keeps the same verb identity as rank 10.
const drifted = winSkills.filter(id => {
  const a = L5[id] && L5[id].window, b = L10[id].window;
  if (!a) return false;
  return VERBS.filter(v => a[v] != null).join() !== VERBS.filter(v => b[v] != null).join();
});
ok('rank 5 uses the same verb(s) as rank 10 (one identity, deepened)',
   drifted.length === 0, drifted);

// The announce toast is a rank-10-only moment.
ok('no rank-5 window announces (that is a rank-10 beat)',
   ids.every(i => !(L5[i] && L5[i].window && L5[i].window.announce)),
   ids.filter(i => L5[i] && L5[i].window && L5[i].window.announce));

// Wiring
ok('window opens from the cast hook', /_applyLv10Cd[\s\S]{0,400}_msOpenWindow\(id\)/.test(src));
ok('on-hit verbs applied before the authoritative HP write',
   /_msApplyOnHit\(m, finalDmg, isCrit, skill\);\s*\n\s*m\.currentHp -= finalDmg;/.test(src));
ok('mark amplifier sits with the global multipliers', /_msMarkMul\(m\)/.test(src));
ok('kill refund is wired', /_msRefundOnKill\(skill\)/.test(src));
ok('chain has a re-entrancy guard', /_msChaining/.test(src));
ok('shorter windows cannot stomp longer ones', /cur\.until > until && cur\.until > now/.test(src));
ok('formatter renders the window clause', /for ' \+ \(w\.ms \/ 1000\)/.test(src));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x !== undefined ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
