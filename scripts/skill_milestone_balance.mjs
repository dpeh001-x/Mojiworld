// v0.29.301 — balance model for the rank-10 milestone ability windows.
// Answers one question per skill: how much throughput does the window add,
// once you account for how often it can actually be up?
//
// uptime = min(1, windowMs / cooldownMs). A 4 s window on a 0.72 s basic
// attack is permanently up; an 8 s window on a 62 s ultimate is up 13% of
// the time. Effective gain = uptime x the verb's own multiplier.
import { readFileSync } from 'node:fs';
const src = readFileSync('mojiworld_game.html', 'utf8');
const block = (name) => {
  const i = src.indexOf('const ' + name + ' = {');
  let j = src.indexOf('{', i), d = 0, k = j;
  for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) break; } }
  return src.slice(j, k + 1);
};
const L10 = new Function('return ' + block('SKILL_LV10_BONUS'))();
// cooldowns straight out of SKILLS
const skillsSrc = block('SKILLS');
const cds = {}; const names = {};
{ let d = 0;
  for (const line of skillsSrc.split('\n')) {
    const m = line.match(/^  ([A-Za-z_][\w]*)\s*:\s*\{/);
    if (m && d === 1) {
      const cd = line.match(/\bcd\s*:\s*(\d+)/);
      const nm = line.match(/name\s*:\s*'([^']*)'/);
      cds[m[1]] = cd ? +cd[1] : null;
      names[m[1]] = nm ? nm[1] : m[1];
    }
    for (const ch of line) { if (ch === '{') d++; else if (ch === '}') d--; }
  } }

// Throughput multiplier a verb contributes WHILE the window is open.
// Deliberately generous (assumes the verb always finds a target) so the
// model over- rather than under-states risk.
function verbGain(w) {
  let g = 1;
  if (w.chain)     g *= 1 + w.chain.n * w.chain.frac;        // extra targets hit
  if (w.mark)      g *= w.mark.mul;                          // amplified damage
  if (w.execute)   g *= 1 + w.execute.frac * 0.8;            // skipped HP, damped
  if (w.lifesteal) g *= 1 + w.lifesteal * 0.35;              // sustain != dps
  if (w.refundOnKill) g *= 1 + w.refundOnKill * 0.30;        // more casts
  return g;
}

const rows = [];
for (const [id, b] of Object.entries(L10)) {
  if (!b.window) continue;
  const cd = cds[id];
  if (cd == null) continue;
  const uptime = Math.min(1, b.window.ms / Math.max(1, cd));
  const inWindow = verbGain(b.window);
  const effective = 1 + (inWindow - 1) * uptime;
  rows.push({ id, name: names[id], cd, ms: b.window.ms, uptime, inWindow, effective });
}
rows.sort((a, b) => b.effective - a.effective);

console.log('EFFECTIVE THROUGHPUT GAIN FROM THE RANK-10 WINDOW');
console.log('(in-window = while active; effective = weighted by uptime)\n');
console.log('  skill                        cd     win   uptime  in-win   EFFECTIVE');
for (const r of rows) {
  const flag = r.effective >= 1.60 ? '  <== OUTLIER' : r.effective >= 1.40 ? '  <- high' : '';
  console.log('  ' + r.id.padEnd(22)
    + (r.cd / 1000).toFixed(2).padStart(7) + 's'
    + (r.ms / 1000).toFixed(1).padStart(6) + 's'
    + (r.uptime * 100).toFixed(0).padStart(7) + '%'
    + ('x' + r.inWindow.toFixed(2)).padStart(8)
    + ('x' + r.effective.toFixed(2)).padStart(11) + flag);
}
const worst = rows[0];
const over = rows.filter(r => r.effective >= 1.60);
const permanent = rows.filter(r => r.uptime >= 0.999);
console.log(`\nsummary: ${rows.length} windowed skills`);
console.log(`  median effective gain : x${rows[Math.floor(rows.length / 2)].effective.toFixed(2)}`);
console.log(`  worst offender        : ${worst.id} x${worst.effective.toFixed(2)}`);
console.log(`  >= x1.60 (outliers)   : ${over.length}${over.length ? ' -> ' + over.map(r => r.id).join(', ') : ''}`);
console.log(`  permanent uptime      : ${permanent.length}${permanent.length ? ' -> ' + permanent.map(r => r.id).join(', ') : ''}`);

// Gate: nothing should reach +60% sustained throughput from one milestone.
const fail = over.length > 0;
console.log('\n' + (fail ? 'FAIL' : 'PASS') + ' — no milestone should exceed x1.60 effective');
process.exit(fail ? 1 : 0);
