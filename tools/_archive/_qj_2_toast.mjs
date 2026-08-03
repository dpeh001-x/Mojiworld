// Journal restructure · 2/2 — distinct 'story' toast rarity (dawn-ember CSS),
// story-branded unlock toast, and the HUD tracker's "Next:" story pointer.
import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../mojiworld_game.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const orig = src;

const reps = [
  // 1) showToast whitelist
  { old: `    const known = (rarity === 'legendary' || rarity === 'epic' || rarity === 'rare'
                || rarity === 'success'   || rarity === 'danger');`,
    neu: `    const known = (rarity === 'legendary' || rarity === 'epic' || rarity === 'rare'
                || rarity === 'success'   || rarity === 'danger' || rarity === 'story');   // v0.26.888 — dawn-ember story tier` },

  // 2) story toast CSS (after the danger rule)
  { old: `  .toast[data-rarity="danger"] {
    color: #ffb8b8;
    border-color: rgba(220, 80, 80, 0.65);
    border-left-color: #ff6666;
  }`,
    neu: `  .toast[data-rarity="danger"] {
    color: #ffb8b8;
    border-color: rgba(220, 80, 80, 0.65);
    border-left-color: #ff6666;
  }
  /* v0.26.888 — Everdawn story beats get a dawn-ember toast of their own */
  .toast[data-rarity="story"] {
    color: #ffd0a0;
    border-color: rgba(255, 158, 94, 0.65);
    border-left-color: #ff9e5e;
    background:
      linear-gradient(180deg, rgba(70, 36, 22, 0.93) 0%, rgba(38, 18, 40, 0.95) 100%);
    box-shadow:
      0 6px 22px rgba(255, 130, 60, 0.28),
      0 0 0 0.5px rgba(255, 158, 94, 0.22),
      inset 0 1px 0 rgba(255, 210, 160, 0.16);
  }`,
  },

  // 3) story-branded unlock toast
  { old: `        showToast(\`📜 New quest: \${q.icon} \${q.name}\`, 'epic');`,
    neu: `        showToast((q.story || q.advancement)
          ? \`🌅 STORY — \${q.icon} \${q.name}\`
          : \`📜 New quest: \${q.icon} \${q.name}\`,
          (q.story || q.advancement) ? 'story' : 'epic');   // v0.26.888 — story beats stand apart` },

  // 4) tracker story pointer (early-return + head + row)
  { old: `  if (!ids.length) {
    el.classList.remove('show');
    el.innerHTML = '';
    return;
  }`,
    neu: `  // v0.26.888 — "what do I do next" is always answerable: when the next
  // Everdawn beat is NOT already active, the tracker leads with a pointer.
  const _nb = (typeof _nextStoryBeat === 'function') ? _nextStoryBeat() : null;
  const _nbRow = (_nb && !(player.quests.active && player.quests.active[_nb])) ? (() => {
    const nq = QUESTS[_nb];
    const locked = !(player.quests.unlocked && player.quests.unlocked[_nb]);
    return \`<div class="qt-row" style="border-left:2px solid #ff9e5e; padding-left:5px;">
      <span class="qt-icon">🌅</span>
      <span class="qt-name" style="color:#ffd0a0;">Next: \${nq.name}</span>
      <span class="qt-prog" style="color:#c9b8d8;">\${locked ? 'Lv ' + (nq.levelReq || 1) : 'press E'}</span>
    </div>\`;
  })() : '';
  if (!ids.length && !_nbRow) {
    el.classList.remove('show');
    el.innerHTML = '';
    return;
  }`,
  },
  { old: `  el.innerHTML = \`<div class="qt-head">📜 Active</div>\${rows}\`;`,
    neu: `  el.innerHTML = \`<div class="qt-head">📜 Quests</div>\${_nbRow}\${rows}\`;` },
];

let n = 0;
for (const { old, neu } of reps) {
  const c = src.split(old).length - 1;
  if (c !== 1) { console.error('FAIL: expected 1, got ' + c + ' for: ' + old.slice(0, 70).replace(/\n/g, '\\n') + '...'); process.exit(2); }
  src = src.replace(old, neu); n++;
}
if (src === orig) { console.error('no change'); process.exit(3); }
await writeFile(FILE, src, 'utf8');
console.log('OK: ' + n + ' toast/tracker edits applied.');
