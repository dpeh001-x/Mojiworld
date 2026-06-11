// Journal restructure · 1/2 — Story/Class/Bounties category layer, pinned
// next-story-beat in the saga banner, filtered card pane.
import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../mojiworld_game.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const orig = src;

const reps = [
  // 1) state + helpers
  { old: `let _questTab = 'active';`,
    neu: `let _questTab = 'active';
// v0.26.888 — Journal category layer (Story / Class / Bounties) + the pinned
// "next story beat" pointer. The saga spine was buried among ~80 bestiary
// bounties and the per-level class lines; categories make it legible.
let _questCat = 'all';
const _QUEST_STORY_CHAIN = [   // intended play order (levelReq ascending)
  'q_inner_dim_trial', 'q_distorted_portal', 'q_boss_sundered_smith',
  'q_hourglass_1', 'q_hourglass_2', 'q_boss_aetherion', 'q_hourglass_3',
  'q_hourglass_4', 'q_hourglass_5', 'q_boss_aries', 'q_zodiac_twelve',
  'q_boss_gravitos',
];
function _questCatOf(id) {
  const q = QUESTS[id]; if (!q) return 'bounty';
  if (q.story || q.advancement) return 'story';
  if (q.cls) return 'class';
  return 'bounty';   // bestiary bounties + unflagged side quests
}
function _nextStoryBeat() {
  if (!player || !player.quests) return null;
  for (const id of _QUEST_STORY_CHAIN) {
    if (!QUESTS[id]) continue;
    if (!(player.quests.completed && player.quests.completed[id])) return id;
  }
  return null;
}` },

  // 2) catSpec + counts (appended after tabSpec)
  { old: `  const tabSpec = [
    { key:'active',    label:'Active',    icon:'🎯', color:'#ffaa44' },
    { key:'available', label:'Available', icon:'📋', color:'#88ccff' },
    { key:'completed', label:'Completed', icon:'✅', color:'#88dd66' },
  ];`,
    neu: `  const tabSpec = [
    { key:'active',    label:'Active',    icon:'🎯', color:'#ffaa44' },
    { key:'available', label:'Available', icon:'📋', color:'#88ccff' },
    { key:'completed', label:'Completed', icon:'✅', color:'#88dd66' },
  ];
  // v0.26.888 — category chips (filter the visible status tab)
  const catSpec = [
    { key:'all',    label:'All',      icon:'✨', color:'#cfd4dc' },
    { key:'story',  label:'Story',    icon:'🌅', color:'#ff9e5e' },
    { key:'class',  label:'Class',    icon:cIcon, color:cColor },
    { key:'bounty', label:'Bounties', icon:'🪙', color:'#88dd66' },
  ];
  const _catCounts = { all: 0, story: 0, class: 0, bounty: 0 };
  for (const id of [...buckets.active, ...buckets.available]) { _catCounts.all++; _catCounts[_questCatOf(id)]++; }` },

  // 3) pinned next beat inside the saga banner
  { old: `        <div style="font-size:15px;">\${pips} <span style="color:#9790b4; font-size:11px;">Dawn Fragments \${s.count}/\${s.total}</span></div>
      </div>\`;
    })()}`,
    neu: `        <div style="font-size:15px;">\${pips} <span style="color:#9790b4; font-size:11px;">Dawn Fragments \${s.count}/\${s.total}</span></div>
        \${(() => {
          // v0.26.888 — pinned NEXT story beat (always answers "what now?")
          const nb = _nextStoryBeat();
          if (!nb || s.done) return '';
          const nq = QUESTS[nb];
          const st = (player.quests.active && player.quests.active[nb]) ? '🎯 underway'
                   : (player.quests.unlocked && player.quests.unlocked[nb]) ? '📋 ready — see the Story tab'
                   : '🔒 reach Lv ' + (nq.levelReq || 1);
          return \`<div style="margin-top:6px; padding:6px 9px; border-radius:8px; background:rgba(255,158,94,0.10); border:1px dashed rgba(255,158,94,0.45); font-size:12px; color:#ffd0a0;">▶ <b>Next story beat:</b> \${nq.icon || '🌅'} \${nq.name} <span style="color:#c9b8d8;">· Lv \${nq.levelReq || 1}+ · \${st}</span></div>\`;
        })()}
      </div>\`;
    })()}` },

  // 4) category chip row above the status tabs
  { old: `    <div class="qj-tabs">
      \${tabSpec.map(t => {`,
    neu: `    <div class="qj-tabs" style="margin-bottom:2px;">
      \${catSpec.map(t => {
        const active = (_questCat === t.key);
        return \`<button type="button" class="qj-tab\${active ? ' active' : ''}" data-qcat="\${t.key}" style="--tab-c:\${t.color}; font-size:11px; padding:4px 10px;">
          <span class="qj-tab-ico">\${t.icon}</span><span class="qj-tab-lbl">\${t.label}</span>
          <span class="qj-tab-count">\${_catCounts[t.key]}</span>
        </button>\`;
      }).join('')}
    </div>
    <div class="qj-tabs">
      \${tabSpec.map(t => {` },

  // 5) filtered card pane
  { old: `    <div class="qj-cards">
      \${buckets[_questTab].length
        ? buckets[_questTab].map(id => buildCard(id, _questTab)).join('')
        : \`<div class="moji-empty-state" style="padding:32px 18px;">
             <span class="moji-empty-glyph" style="font-size:36px;">\${_questTab === 'completed' ? '🏆' : _questTab === 'available' ? '🔓' : '📜'}</span>
             <span class="moji-empty-caption">No \${_questTab} quests right now.</span>
             <span class="moji-empty-hint">\${_questTab === 'active' ? 'Visit an NPC to accept your next quest.' : _questTab === 'available' ? 'Level up to unlock more options.' : 'Complete your first quest to fill this list.'}</span>
           </div>\`}
    </div>`,
    neu: `    <div class="qj-cards">
      \${(() => {
        // v0.26.888 — category filter applies to the visible status tab
        const _ids = buckets[_questTab].filter(id => _questCat === 'all' || _questCatOf(id) === _questCat);
        return _ids.length
          ? _ids.map(id => buildCard(id, _questTab)).join('')
          : \`<div class="moji-empty-state" style="padding:32px 18px;">
               <span class="moji-empty-glyph" style="font-size:36px;">\${_questTab === 'completed' ? '🏆' : _questTab === 'available' ? '🔓' : '📜'}</span>
               <span class="moji-empty-caption">No \${_questCat === 'all' ? '' : _questCat + ' '}quests in \${_questTab}.</span>
               <span class="moji-empty-hint">\${_questTab === 'active' ? 'Pick one up from the Available tab or an NPC.' : _questTab === 'available' ? 'Level up to unlock more options.' : 'Complete quests to fill this list.'}</span>
             </div>\`;
      })()}
    </div>` },

  // 6) wiring for category chips
  { old: `  list.querySelectorAll('[data-qtab]').forEach(btn => {
    btn.onclick = () => { _questTab = btn.dataset.qtab; renderQuestJournal(); };
  });`,
    neu: `  list.querySelectorAll('[data-qtab]').forEach(btn => {
    btn.onclick = () => { _questTab = btn.dataset.qtab; renderQuestJournal(); };
  });
  list.querySelectorAll('[data-qcat]').forEach(btn => {
    btn.onclick = () => { _questCat = btn.dataset.qcat; renderQuestJournal(); };
  });` },
];

let n = 0;
for (const { old, neu } of reps) {
  const c = src.split(old).length - 1;
  if (c !== 1) { console.error('FAIL: expected 1, got ' + c + ' for: ' + old.slice(0, 70).replace(/\n/g, '\\n') + '...'); process.exit(2); }
  src = src.replace(old, neu); n++;
}
if (src === orig) { console.error('no change'); process.exit(3); }
await writeFile(FILE, src, 'utf8');
console.log('OK: ' + n + ' journal edits applied.');
