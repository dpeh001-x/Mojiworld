// Teaches scripts/level_consistency_audit.mjs the codex cohort rule, so the
// Magma Foundry's shared Greater / Apex levels (v0.30.607 codex-cohort) are not
// reported as formula mismatches. The audit runs in the page, so it asks the
// game's own _lxCodexCohortLevels; on a build without it nothing changes.
// Guarded + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/scripts/level_consistency_audit.mjs';
let s = readFileSync(F, 'utf8');
if (s.includes('_lxCodexCohortLevels')) { console.log('audit: already applied'); process.exit(0); }
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const sub = (label, anchor, after) => {
  const c = s.split(anchor).length - 1;
  if (c !== 1) { console.error(`ABORT audit ${label}: anchor matched ${c}, expected 1`); process.exit(1); }
  s = s.split(anchor).join(after);
};
sub('comment', '    //   apex    aLv     = lvl + 6',
  J('    //   apex    aLv     = lvl + 6',
    '    // except a codex COHORT (v0.30.607 codex-cohort, e.g. the Magma Foundry): its',
    '    // residents share one Greater and one Apex level, read from the game itself.'));
sub('want', J(
  "      const want = /_apex$/.test(qid) ? hi + 6",
  "                 : /_greater$/.test(qid) ? Math.max(base + 5, hi + 3)",
  "                 : base;"),
  J("      const coh = (!isBossQ && typeof _lxCodexCohortLevels === 'function') ? _lxCodexCohortLevels(q.target) : null;",
    "      const want = /_apex$/.test(qid) ? (coh ? coh.apex : hi + 6)",
    "                 : /_greater$/.test(qid) ? (coh ? coh.greater : Math.max(base + 5, hi + 3))",
    "                 : base;"));
writeFileSync(F + '.tmp', s, 'utf8');
renameSync(F + '.tmp', F);
console.log('audit: cohort-aware codex formula');
