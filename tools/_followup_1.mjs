// Follow-ups: (1) prism-charge pips (priest mechanic was invisible),
// (2) rare mid-boss elites for Gloomspore Verge + Ossuary Sprawl,
// (3) talent respec for 300 setshards.
import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../mojiworld_game.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const orig = src;

const reps = [
  // ---- (1) PRISM PIPS ----
  { old: `  let html = '';
  for (let i = 0; i < 5; i++) html += '<span style="font-size:13px; opacity:' + (i < s ? 1 : 0.25) + ';">🔥</span>';
  el.innerHTML = html;
}`,
    neu: `  let html = '';
  for (let i = 0; i < 5; i++) html += '<span style="font-size:13px; opacity:' + (i < s ? 1 : 0.25) + ';">🔥</span>';
  el.innerHTML = html;
}
// v0.26.891 — PRISM PIPS. The priest's _prismCharges (Holy Light builds, max 5;
// Celestial Aurora consumes) existed with NO display at all. Same pip pattern
// as Arcane Embers, one row higher so a priest can read both.
function _renderPrismPips() {
  let el = document.getElementById('prism-pips');
  if (!el) {
    const wrap = document.querySelector('.game-wrapper');
    if (!wrap) return;
    el = document.createElement('div');
    el.id = 'prism-pips';
    el.style.cssText = 'position:absolute; left:50%; bottom:96px; transform:translateX(-50%); display:flex; gap:4px; pointer-events:none; z-index:60; filter:drop-shadow(0 0 6px rgba(150,200,255,0.7));';
    wrap.appendChild(el);
  }
  const s = (player && player._prismCharges) || 0;
  if (!s || !player || player.job !== 'priest') { el.style.display = 'none'; el.innerHTML = ''; return; }
  el.style.display = 'flex';
  let html = '';
  for (let i = 0; i < 5; i++) html += '<span style="font-size:13px; opacity:' + (i < s ? 1 : 0.25) + ';">💠</span>';
  el.innerHTML = html;
}` },
  { old: `    player._prismCharges = Math.min(5, (player._prismCharges || 0) + 1);`,
    neu: `    player._prismCharges = Math.min(5, (player._prismCharges || 0) + 1);
    if (typeof _renderPrismPips === 'function') _renderPrismPips();   // v0.26.891` },
  { old: `    const charges = player._prismCharges || 0;
    player._prismCharges = 0;`,
    neu: `    const charges = player._prismCharges || 0;
    player._prismCharges = 0;
    if (typeof _renderPrismPips === 'function') _renderPrismPips();   // v0.26.891` },

  // ---- (2) MID-BOSS ELITES ----
  { old: `  ossuarySentinel: { name:'Ossuary Sentinel', w:110, h:130, color:'#aaa8c0', shell:'#3a3a4a', hp:28000, atk:760, def:110, evasion:140, exp:22000, mojicoins:8800, speed:0.9, jump:6,                                 signature:'The ossuary\\'s last oath, armored in donors.', traits:{ bigMelee:{ kind:'swing', dmgMul:2.0, range:150, swingW:240, swingH:110, cdMs:6000, telegraphMs:620 } } },`,
    neu: `  ossuarySentinel: { name:'Ossuary Sentinel', w:110, h:130, color:'#aaa8c0', shell:'#3a3a4a', hp:28000, atk:760, def:110, evasion:140, exp:22000, mojicoins:8800, speed:0.9, jump:6,                                 signature:'The ossuary\\'s last oath, armored in donors.', traits:{ bigMelee:{ kind:'swing', dmgMul:2.0, range:150, swingW:240, swingH:110, cdMs:6000, telegraphMs:620 } } },
  // v0.26.891 — rare mid-boss elites (pathsBane idiom: miniElite + revive)
  blightElder:     { name:'Blight Elder',     w:130, h:150, color:'#5a6a3a', shell:'#2a3014', hp:34000, atk:720, def:130, evasion:120, exp:24000, mojicoins:9600,  speed:0.4, jump:2,                                 signature:'The Verge\\'s rotten heart. It fell once already.', traits:{ miniElite:true, revivesOnce:{ hpPct:0.30 }, bigMelee:{ kind:'smash', dmgMul:2.0, range:150, arcW:260, cdMs:6000, telegraphMs:650 } } },
  ossuaryTyrant:   { name:'Ossuary Tyrant',   w:110, h:130, color:'#d8d0b8', shell:'#4a4434', hp:46000, atk:860, def:150, evasion:140, exp:30000, mojicoins:12500, speed:0.8, jump:5,  shoot:'mbonechip', shootCd:2000, signature:'Crowned in everyone. Raises pillars of the departed.', traits:{ miniElite:true, revivesOnce:{ hpPct:0.25 }, bigMelee:{ kind:'swing', dmgMul:2.2, range:160, swingW:240, swingH:100, cdMs:5600, telegraphMs:560 }, columnStrike:{ dmgMul:1.8, width:110, range:520, cdMs:7500, telegraphMs:700, color:'#c8c0a0', sprite:'fx_col_tombhexer' } } },` },
  { old: `  marrowgeist: 66, cryptbinder: 67, ossuarySentinel: 69,                          // v0.26.880 — Ossuary Sprawl`,
    neu: `  marrowgeist: 66, cryptbinder: 67, ossuarySentinel: 69,                          // v0.26.880 — Ossuary Sprawl
  blightElder: 64, ossuaryTyrant: 69,                                             // v0.26.891 — rare mid-boss elites` },
  { old: `  ossuarySentinel: { npc:'Old Rye',  count:3, flavor:'The Sprawl\\'s armoured wardens. Every plate a donation. Every swing a eulogy.' },`,
    neu: `  ossuarySentinel: { npc:'Old Rye',  count:3, flavor:'The Sprawl\\'s armoured wardens. Every plate a donation. Every swing a eulogy.' },
  blightElder:     { npc:'Oakhart',  count:2, flavor:'Something old and rotten anchors the Verge. It does not stay down the first time. Bring patience and a big stick.' },
  ossuaryTyrant:   { npc:'Old Rye',  count:2, flavor:'The Sprawl bows to a tyrant crowned in everyone. Topple it twice — it insists on an encore.' },` },
  { old: `  marrowgeist: 'boneWraith', cryptbinder: 'shardlich', ossuarySentinel: 'echoKnight',`,
    neu: `  marrowgeist: 'boneWraith', cryptbinder: 'shardlich', ossuarySentinel: 'echoKnight',
  blightElder: 'elderbark', ossuaryTyrant: 'boneGolem',   // v0.26.891 — mid-boss elites` },
  { old: `  'gravebloom', 'wiltfang', 'sporewraith', 'marrowgeist', 'cryptbinder', 'ossuarySentinel',`,
    neu: `  'gravebloom', 'wiltfang', 'sporewraith', 'marrowgeist', 'cryptbinder', 'ossuarySentinel',
  'blightElder', 'ossuaryTyrant',` },
  { old: `  marrowgeist: 'ghost', cryptbinder: 'skeleton', ossuarySentinel: 'golem',`,
    neu: `  marrowgeist: 'ghost', cryptbinder: 'skeleton', ossuarySentinel: 'golem',
  blightElder: 'plant', ossuaryTyrant: 'golem',` },
  { old: `    { type: 'elderbark',   count: 2 },
  ],
};
MAPS.ossuarySprawl = {`,
    neu: `    { type: 'elderbark',   count: 2 },
    { type: 'blightElder', count: 1, spawnChance: 0.5 },   // v0.26.891 — rare mid-boss
  ],
};
MAPS.ossuarySprawl = {` },
  { old: `    { type: 'ossuarySentinel', count: 2 },
  ],
};`,
    neu: `    { type: 'ossuarySentinel', count: 2 },
    { type: 'ossuaryTyrant',   count: 1, spawnChance: 0.5 },   // v0.26.891 — rare mid-boss
  ],
};` },

  // ---- (3) TALENT RESPEC ----
  { old: `  return '<div style="margin-top:6px; padding:7px 10px 8px; border-radius:10px; background:rgba(120,80,200,0.08); border:1px solid rgba(190,140,255,0.25);">' +
    '<div style="font:700 9px Inter, system-ui, sans-serif; letter-spacing:1.8px; color:#c8a8ff; text-transform:uppercase; margin-bottom:5px;">✦ Job Talent — ' + ((JOBS[jobId] && JOBS[jobId].name) || jobId) + (chosen ? '' : ' · choose one (permanent)') + '</div>' +
    '<div style="display:flex; gap:6px;">' + cards + '</div></div>';`,
    neu: `  // v0.26.891 — respec: 300◈ clears the choice and reopens the pick.
  const respec = chosen
    ? '<div style="text-align:right; margin-top:5px;"><button type="button" data-talent-respec="1" style="padding:3px 10px; border-radius:6px; border:1px solid rgba(190,140,255,0.4); background:rgba(80,50,130,0.5); color:#dcc8ff; font:600 10px Inter, sans-serif; cursor:pointer;">↻ Respec (300◈)</button></div>'
    : '';
  return '<div style="margin-top:6px; padding:7px 10px 8px; border-radius:10px; background:rgba(120,80,200,0.08); border:1px solid rgba(190,140,255,0.25);">' +
    '<div style="font:700 9px Inter, system-ui, sans-serif; letter-spacing:1.8px; color:#c8a8ff; text-transform:uppercase; margin-bottom:5px;">✦ Job Talent — ' + ((JOBS[jobId] && JOBS[jobId].name) || jobId) + (chosen ? '' : ' · choose one (permanent)') + '</div>' +
    '<div style="display:flex; gap:6px;">' + cards + '</div>' + respec + '</div>';` },
  { old: `document.addEventListener('click', (e) => {
  const c = e.target && e.target.closest && e.target.closest('[data-talent]');
  if (!c || !player || !player.job) return;
  if (player.talents && player.talents[player.job]) return;
  chooseTalent(player.job, c.dataset.talent);
  if (typeof openLevelUpPanel === 'function') { try { openLevelUpPanel(); } catch (_) {} }
});`,
    neu: `document.addEventListener('click', (e) => {
  // v0.26.891 — respec button (300◈): clear the choice, reopen the pick.
  const r = e.target && e.target.closest && e.target.closest('[data-talent-respec]');
  if (r && player && player.job && player.talents && player.talents[player.job]) {
    const COST = 300;
    (async () => {
      const ok = (typeof uiConfirm === 'function')
        ? await uiConfirm({ title: '↻ Respec Talent', body: 'Unlearn your current talent and choose again?\\n\\n• Cost: ' + COST + '◈ setshards  (you have ' + (player.setshards || 0) + '◈)\\n• The new pick is permanent until the next respec.', yesLabel: 'Respec (' + COST + '◈)', noLabel: 'Keep it' })
        : true;
      if (!ok) return;
      if ((player.setshards || 0) < COST) { showToast('Need ' + COST + '◈ setshards.', 'rare'); return; }
      player.setshards -= COST;
      delete player.talents[player.job];
      if (typeof refreshGearCache === 'function') refreshGearCache();
      if (typeof saveState === 'function') saveState();
      if (typeof closeAllModals === 'function') closeAllModals();
      openTalentPick();
    })();
    return;
  }
  const c = e.target && e.target.closest && e.target.closest('[data-talent]');
  if (!c || !player || !player.job) return;
  if (player.talents && player.talents[player.job]) return;
  chooseTalent(player.job, c.dataset.talent);
  if (typeof openLevelUpPanel === 'function') { try { openLevelUpPanel(); } catch (_) {} }
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
console.log('OK: ' + n + ' follow-up edits applied.');
