// Quest pass 2 · Batch I — (1) journal cards now show a "↩ Return to <giver>"
// pill when a handIn quest's objectives are done (was toast-only — easy to
// miss); (2) remove Milo's dead _prog<300 dialog branch (pre-v0.26.309 copy
// that mislabels the Carriage as "Stage 2"; unreachable since the quest
// completes at 150, but stale and contradicts the live chain).
import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../mojiworld_game.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const orig = src;

// --- (1) journal pill ---
const STORYPILL = `    const storyPill = isStory ? '<span class="qj-pill" style="background:linear-gradient(90deg, rgba(255,158,94,0.28), rgba(150,90,200,0.20)); border:0.5px solid rgba(255,180,120,0.8); color:#ffd0a0; text-shadow:0 0 6px rgba(255,150,90,0.4); font-weight:800; letter-spacing:1px;" title="Everdawn Cycle — main storyline arc">🌅 STORY</span>' : '';`;
const HANDIN = STORYPILL + `
    // v0.26.831+ — "Return to giver" pill. handIn quests don't auto-complete;
    // after the final kill the only signal was a one-time toast. The active
    // card now shows where to claim.
    const handInPill = (isActive && q.handIn && q.giver && (player.quests.active[id] || {}).readyToHandIn)
      ? \`<span class="qj-pill" style="background:rgba(110,220,140,0.18); border:0.5px solid rgba(130,235,160,0.85); color:#8df0a8; font-weight:800; letter-spacing:0.6px;" title="All objectives complete — talk to \${q.giver} to claim the reward">↩ Return to \${q.giver}</span>\`
      : '';`;

let c = src.split(STORYPILL).length - 1;
if (c !== 1) { console.error('FAIL storyPill anchor: ' + c); process.exit(2); }
src = src.replace(STORYPILL, HANDIN);

const METAOLD = `    } else {
      metaHtml = advPill + storyPill + metaHtml + rewardPills;
    }`;
const METANEW = `    } else {
      metaHtml = advPill + storyPill + handInPill + metaHtml + rewardPills;
    }`;
c = src.split(METAOLD).length - 1;
if (c !== 1) { console.error('FAIL metaHtml anchor: ' + c); process.exit(2); }
src = src.replace(METAOLD, METANEW);

// --- (2) dead Milo branch: } else if (_prog < 300) { ... } else { <stale guard> }
const DEAD = /      \} else if \(_prog < 300\) \{[\s\S]{200,3000}?\} else \{\n        \/\/ _prog >= 24 — shouldn't normally land here \(quest completes on 24th kill\)\n        \/\/ but guard anyway in case the completion handler hasn't fired yet\.\n        text = '\*Milo flips through his clipboard, finds a fully-punched card, and grins\.\*\\n\\nThat\\'s twenty-four! The trial completes the moment your last kill registers — give it a beat and the rewards drop\. If they don\\'t, talk to me again\.';\n      \}/;
const m = src.match(DEAD);
if (!m || src.split(m[0]).length - 1 !== 1) { console.error('FAIL dead-branch regex: ' + (m ? 'non-unique' : 'no match')); process.exit(2); }
src = src.replace(DEAD, `      } else {
        // _prog >= 150 — completion pending (Stage 1 finishes on the 150th
        // kill; this guard only shows if the handler hasn't fired yet).
        // v0.26.831+ — removed the dead pre-v0.26.309 _prog<300 branch that
        // mislabelled the Carriage as "Stage 2" inside this quest.
        text = '*Milo flips through his clipboard, finds a fully-punched card, and grins.*\\n\\nThat\\'s a hundred and fifty! Stage 1 completes the moment your last kill registers — give it a beat and the rewards drop. If they don\\'t, talk to me again.';
      }`);

if (src === orig) { console.error('no change'); process.exit(3); }
await writeFile(FILE, src, 'utf8');
console.log('OK: journal pill + dead-branch removal applied.');
