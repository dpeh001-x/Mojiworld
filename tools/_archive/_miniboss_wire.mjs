// Mini-boss dedicated-asset wiring: drop the art aliases (own sprites landed),
// register the 2 unique projectiles + 2 column-VFX, give Blight Elder its
// ranged grave-seed + blight-pillar special + spore death-burst, and switch
// Ossuary Tyrant onto its soul-bone spear + its OWN bone pillar.
import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../mojiworld_game.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const orig = src;

const reps = [
  // 1) drop the aliases — dedicated art is on disk now (CRLF-safe: single-line match)
  { old: `  blightElder: 'elderbark', ossuaryTyrant: 'boneGolem',   // v0.26.891 — mid-boss elites`,
    neu: `  // v0.26.892 — blightElder/ossuaryTyrant aliases removed: dedicated art landed` },
  // 2) projectile filename registry
  { old: `    mfirespit: 'mfirespit.webp',`,
    neu: `    mfirespit: 'mfirespit.webp',
    // v0.26.892 — mid-boss unique projectiles
    mblightseed: 'mblightseed.png',   // Blight Elder — tendril-wrapped grave-seed
    mgravebone:  'mgravebone.png',    // Ossuary Tyrant — soul-fire femur spear` },
  // 3) blit modes
  { old: `  mfirespit:   { mode: 'orient', size: 0.5 },                   // fire jet — orient to velocity`,
    neu: `  mfirespit:   { mode: 'orient', size: 0.5 },                   // fire jet — orient to velocity
  mblightseed: { mode: 'spin',   size: 0.5, spinRate: 0.14 },   // v0.26.892 — grave-seed tumbles
  mgravebone:  { mode: 'orient', size: 0.5 },                   // v0.26.892 — bone spear points forward` },
  // 4) column VFX registry
  { old: `    fx_col_zodiac:      'fx_col_zodiac.webp',       // Zodiac casters — cosmic starfield column`,
    neu: `    fx_col_zodiac:      'fx_col_zodiac.webp',       // Zodiac casters — cosmic starfield column
    fx_col_blightelder:   'fx_col_blightelder.webp',   // v0.26.892 — Blight Elder — blighted-nature pillar
    fx_col_ossuarytyrant: 'fx_col_ossuarytyrant.webp', // v0.26.892 — Ossuary Tyrant — erupting-bone pillar` },
  // 5) Blight Elder: ranged grave-seed + blight pillar + spore death-burst
  { old: `  blightElder:     { name:'Blight Elder',     w:130, h:150, color:'#5a6a3a', shell:'#2a3014', hp:34000, atk:720, def:130, evasion:120, exp:24000, mojicoins:9600,  speed:0.4, jump:2,                                 signature:'The Verge\\'s rotten heart. It fell once already.', traits:{ miniElite:true, revivesOnce:{ hpPct:0.30 }, bigMelee:{ kind:'smash', dmgMul:2.0, range:150, arcW:260, cdMs:6000, telegraphMs:650 } } },`,
    neu: `  blightElder:     { name:'Blight Elder',     w:130, h:150, color:'#5a6a3a', shell:'#2a3014', hp:34000, atk:720, def:130, evasion:120, exp:24000, mojicoins:9600,  speed:0.4, jump:2,  shoot:'mblightseed', shootCd:2400, signature:'The Verge\\'s rotten heart. It fell once already.', traits:{ miniElite:true, revivesOnce:{ hpPct:0.30 }, bigMelee:{ kind:'smash', dmgMul:2.0, range:150, arcW:260, cdMs:6000, telegraphMs:650 }, columnStrike:{ dmgMul:1.7, width:110, range:540, cdMs:8000, telegraphMs:720, color:'#88cc66', sprite:'fx_col_blightelder' }, explodesOnDeath:{ radius:170, damage:0.85 } } },   // v0.26.892 — grave-seed volley + blight pillar + spore death-burst`,
  },
  // 6) Ossuary Tyrant: unique bone spear + its OWN pillar sprite
  { old: `shoot:'mbonechip', shootCd:2000, signature:'Crowned in everyone. Raises pillars of the departed.', traits:{ miniElite:true, revivesOnce:{ hpPct:0.25 }, bigMelee:{ kind:'swing', dmgMul:2.2, range:160, swingW:240, swingH:100, cdMs:5600, telegraphMs:560 }, columnStrike:{ dmgMul:1.8, width:110, range:520, cdMs:7500, telegraphMs:700, color:'#c8c0a0', sprite:'fx_col_tombhexer' } } },`,
    neu: `shoot:'mgravebone', shootCd:2000, signature:'Crowned in everyone. Raises pillars of the departed.', traits:{ miniElite:true, revivesOnce:{ hpPct:0.25 }, bigMelee:{ kind:'swing', dmgMul:2.2, range:160, swingW:240, swingH:100, cdMs:5600, telegraphMs:560 }, columnStrike:{ dmgMul:1.8, width:110, range:520, cdMs:7500, telegraphMs:700, color:'#c8c0a0', sprite:'fx_col_ossuarytyrant' } } },   // v0.26.892 — soul-bone spear + own bone pillar`,
  },
];

let n = 0;
for (const { old, neu } of reps) {
  const c = src.split(old).length - 1;
  if (c !== 1) { console.error('FAIL: expected 1, got ' + c + ' for: ' + old.slice(0, 70).replace(/\n/g, '\\n') + '...'); process.exit(2); }
  src = src.replace(old, neu); n++;
}
if (src === orig) { console.error('no change'); process.exit(3); }
await writeFile(FILE, src, 'utf8');
console.log('OK: ' + n + ' wiring edits applied.');
