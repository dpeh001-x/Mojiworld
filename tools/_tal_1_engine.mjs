// Talents · 1/3 — JOB_TALENTS data (9 jobs × 3 exclusive perks), talentFx
// resolver, chooseTalent, the one-of-three pick modal (reuses the advancement
// modal), Arcane Ember helpers, persistence + reset wiring, applyJob chain.
import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../mojiworld_game.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const orig = src;

const ENGINE = `// =========================================================================
// v0.26.889 — JOB TALENTS. One permanent perk per job, chosen 1-of-3 at job
// advancement (build identity between advancements). Effects are read LIVE
// in the stat getters / hitMonster / useConsumable — NOT via player.mods,
// which _applyEquippedBoons() zeroes every boon refresh.
// fx keys: atkPct defPct maxHpPct maxMpPct critPct(flat) speedPct
//          skillDmg(non-basic) basicLifesteal critMp potionBoost
// =========================================================================
const JOB_TALENTS = {
  berserker: [
    { id:'bloodrush',  name:'Bloodrush',  icon:'🩸', desc:'Basic attacks heal 5% of damage dealt.', fx:{ basicLifesteal:0.05 } },
    { id:'rampage',    name:'Rampage',    icon:'💢', desc:'+10% ATK, always.',                      fx:{ atkPct:0.10 } },
    { id:'warbreaker', name:'Warbreaker', icon:'⚔️', desc:'+15% skill damage.',                     fx:{ skillDmg:0.15 } },
  ],
  knight: [
    { id:'bulwark',  name:'Bulwark',  icon:'🛡️', desc:'+18% DEF.',          fx:{ defPct:0.18 } },
    { id:'crusade',  name:'Crusade',  icon:'✨', desc:'+12% skill damage.', fx:{ skillDmg:0.12 } },
    { id:'lifewall', name:'Lifewall', icon:'❤️', desc:'+15% max HP.',       fx:{ maxHpPct:0.15 } },
  ],
  ninja: [
    { id:'shadowfeet', name:'Shadowfeet', icon:'💨', desc:'+12% movement speed.', fx:{ speedPct:0.12 } },
    { id:'keenedge',   name:'Keen Edge',  icon:'🔪', desc:'+8 crit chance.',      fx:{ critPct:8 } },
    { id:'exploit',    name:'Exploit',    icon:'🎯', desc:'+14% skill damage.',   fx:{ skillDmg:0.14 } },
  ],
  assassin: [
    { id:'cutthroat',  name:'Cutthroat',     icon:'🗡️', desc:'+10 crit chance.',                       fx:{ critPct:10 } },
    { id:'vampedge',   name:'Vampiric Edge', icon:'🦇', desc:'Basic attacks heal 5% of damage dealt.', fx:{ basicLifesteal:0.05 } },
    { id:'executioner',name:'Executioner',   icon:'💀', desc:'+15% skill damage.',                     fx:{ skillDmg:0.15 } },
  ],
  archmage: [
    { id:'overflow',  name:'Overflow',  icon:'💠', desc:'Crits refund 5 MP.',  fx:{ critMp:5 } },
    { id:'archon',    name:'Archon',    icon:'🌀', desc:'+15% skill damage.',  fx:{ skillDmg:0.15 } },
    { id:'mindspring',name:'Mindspring',icon:'🧠', desc:'+20% max MP.',        fx:{ maxMpPct:0.20 } },
  ],
  warlock: [
    { id:'soulfeast', name:'Soulfeast', icon:'👁️', desc:'Basic attacks heal 6% of damage dealt.', fx:{ basicLifesteal:0.06 } },
    { id:'hexweaver', name:'Hexweaver', icon:'🕸️', desc:'+14% skill damage.',                     fx:{ skillDmg:0.14 } },
    { id:'darkpact',  name:'Dark Pact', icon:'🌑', desc:'+12% ATK, always.',                      fx:{ atkPct:0.12 } },
  ],
  priest: [
    { id:'benediction', name:'Benediction', icon:'🙏', desc:'Potions restore 35% more.', fx:{ potionBoost:0.35 } },
    { id:'sanctuary',   name:'Sanctuary',   icon:'⛪', desc:'+15% DEF.',                 fx:{ defPct:0.15 } },
    { id:'zeal',        name:'Zeal',        icon:'☀️', desc:'+12% skill damage.',        fx:{ skillDmg:0.12 } },
  ],
  sniper: [
    { id:'deadeye',  name:'Deadeye',         icon:'🎯', desc:'+10 crit chance.',     fx:{ critPct:10 } },
    { id:'piercing', name:'Piercing Rounds', icon:'🏹', desc:'+14% skill damage.',   fx:{ skillDmg:0.14 } },
    { id:'swifthands',name:'Swift Hands',    icon:'🫳', desc:'+10% ATK, always.',    fx:{ atkPct:0.10 } },
  ],
  ranger: [
    { id:'fleetfoot', name:'Fleetfoot',     icon:'🦌', desc:'+12% movement speed.', fx:{ speedPct:0.12 } },
    { id:'wildheart', name:'Wildheart',     icon:'🐻', desc:'+12% max HP.',         fx:{ maxHpPct:0.12 } },
    { id:'huntsmark', name:"Hunter's Mark", icon:'🪶', desc:'+13% skill damage.',   fx:{ skillDmg:0.13 } },
  ],
};
function talentFx() {
  if (!player || !player.job || !player.talents) return null;
  const picks = JOB_TALENTS[player.job], pid = player.talents[player.job];
  if (!picks || !pid) return null;
  const p = picks.find(t => t.id === pid);
  return p ? p.fx : null;
}
function chooseTalent(jobId, perkId) {
  const picks = JOB_TALENTS[jobId];
  if (!picks || !picks.some(t => t.id === perkId)) return;
  if (!player.talents) player.talents = {};
  if (player.talents[jobId]) { showToast('Talent already chosen — talents are permanent.', 'rare'); return; }
  player.talents[jobId] = perkId;
  const p = picks.find(t => t.id === perkId);
  showToast('✦ Talent learned: ' + p.icon + ' ' + p.name, 'legendary');
  if (typeof flash === 'function') flash(0.35);
  if (typeof refreshGearCache === 'function') refreshGearCache();
  if (typeof saveState === 'function') saveState();
}
function openTalentPick() {
  const jobId = player && player.job;
  const picks = jobId && JOB_TALENTS[jobId];
  if (!picks || (player.talents && player.talents[jobId])) return;
  const opts = document.getElementById('advancement-options');
  const modal = document.getElementById('advancement-modal');
  if (!opts || !modal) return;
  const h2 = modal.querySelector('h2');
  if (h2 && !h2.dataset.orig) h2.dataset.orig = h2.textContent;
  if (h2) h2.textContent = '✦ Choose Your Talent ✦';
  opts.innerHTML = '';
  for (const p of picks) {
    const card = document.createElement('div');
    card.className = 'class-card';
    card.style.cssText = 'flex:1; cursor:pointer; text-align:center; padding:16px 10px;';
    card.innerHTML = '<div style="font-size:36px;">' + p.icon + '</div>' +
      '<div style="font-weight:800; margin:7px 0 4px; color:#ffe089;">' + p.name + '</div>' +
      '<div style="font-size:11.5px; color:#cfd4dc; line-height:1.45;">' + p.desc + '</div>' +
      '<div style="margin-top:9px; font-size:10px; color:#99a;">permanent · one of three</div>';
    card.onclick = () => {
      chooseTalent(jobId, p.id);
      if (h2 && h2.dataset.orig) h2.textContent = h2.dataset.orig;
      modal.style.display = 'none';
      game.paused = false;
    };
    opts.appendChild(card);
  }
  modal.style.display = 'flex';
  game.paused = true;
}
// Delegated click for the U-panel talent cards (renders via _talentCardHtml).
document.addEventListener('click', (e) => {
  const c = e.target && e.target.closest && e.target.closest('[data-talent]');
  if (!c || !player || !player.job) return;
  if (player.talents && player.talents[player.job]) return;
  chooseTalent(player.job, c.dataset.talent);
  if (typeof openLevelUpPanel === 'function') { try { openLevelUpPanel(); } catch (_) {} }
});
function _talentCardHtml() {
  if (!player || !player.job || !JOB_TALENTS[player.job]) return '';
  const jobId = player.job, picks = JOB_TALENTS[jobId];
  const chosen = player.talents && player.talents[jobId];
  const cards = picks.map(p => {
    const isC = chosen === p.id, dim = chosen && !isC;
    return '<div data-talent="' + p.id + '" style="flex:1; min-width:0; padding:7px 8px; border-radius:8px; text-align:center; cursor:' + (chosen ? 'default' : 'pointer') + '; background:' + (isC ? 'rgba(255,209,102,0.14)' : 'rgba(255,255,255,0.04)') + '; border:1px solid ' + (isC ? 'rgba(255,224,137,0.8)' : 'rgba(255,255,255,0.12)') + '; opacity:' + (dim ? 0.45 : 1) + ';">' +
      '<div style="font-size:20px;">' + p.icon + '</div>' +
      '<div style="font-size:10.5px; font-weight:800; color:' + (isC ? '#ffe089' : '#dfe4ec') + ';">' + p.name + (isC ? ' ✓' : '') + '</div>' +
      '<div style="font-size:9.5px; color:#aab2c0; line-height:1.35;">' + p.desc + '</div></div>';
  }).join('');
  return '<div style="margin-top:6px; padding:7px 10px 8px; border-radius:10px; background:rgba(120,80,200,0.08); border:1px solid rgba(190,140,255,0.25);">' +
    '<div style="font:700 9px Inter, system-ui, sans-serif; letter-spacing:1.8px; color:#c8a8ff; text-transform:uppercase; margin-bottom:5px;">✦ Job Talent — ' + ((JOBS[jobId] && JOBS[jobId].name) || jobId) + (chosen ? '' : ' · choose one (permanent)') + '</div>' +
    '<div style="display:flex; gap:6px;">' + cards + '</div></div>';
}
// v0.26.889 — ARCANE EMBERS (mage rotation): basic bolt hits build up to 5
// stacks (6 s weave window); Fireball consumes them for +12% damage each.
function _consumeEmbers() {
  if (!player || player.cls !== 'mage') return 1;
  const s = player._emberStacks || 0;
  if (!s) return 1;
  if (player._emberT && Date.now() - player._emberT > 6000) { player._emberStacks = 0; _renderEmberPips(); return 1; }
  player._emberStacks = 0;
  _renderEmberPips();
  if (typeof showToast === 'function' && s >= 3) showToast('🔥 Embers unleashed ×' + s + ' (+' + (s * 12) + '% Fireball)', 'epic');
  return 1 + 0.12 * s;
}
function _renderEmberPips() {
  let el = document.getElementById('ember-pips');
  if (!el) {
    const wrap = document.querySelector('.game-wrapper');
    if (!wrap) return;
    el = document.createElement('div');
    el.id = 'ember-pips';
    el.style.cssText = 'position:absolute; left:50%; bottom:76px; transform:translateX(-50%); display:flex; gap:4px; pointer-events:none; z-index:60; filter:drop-shadow(0 0 6px rgba(255,140,40,0.7));';
    wrap.appendChild(el);
  }
  const s = (player && player._emberStacks) || 0;
  if (!s || !player || player.cls !== 'mage') { el.style.display = 'none'; el.innerHTML = ''; return; }
  el.style.display = 'flex';
  let html = '';
  for (let i = 0; i < 5; i++) html += '<span style="font-size:13px; opacity:' + (i < s ? 1 : 0.25) + ';">🔥</span>';
  el.innerHTML = html;
}
function applyJob(jobId) {`;

const reps = [
  { old: `function applyJob(jobId) {`, neu: ENGINE },
  // chain the pick after the job lands
  { old: `  showToast(\`Advanced to \${j.name}!\`, 'legendary');
  flash(0.5);
  addShake(6);
}`,
    neu: `  showToast(\`Advanced to \${j.name}!\`, 'legendary');
  flash(0.5);
  addShake(6);
  // v0.26.889 — chain the one-of-three talent pick right after the job lands.
  if (typeof openTalentPick === 'function' && JOB_TALENTS[jobId] && !(player.talents && player.talents[jobId])) {
    setTimeout(openTalentPick, 700);
  }
}` },
  // persistence
  { old: `  '_powerups', 'boons','boonsEquipped', 'mastery',`,
    neu: `  '_powerups', 'boons','boonsEquipped', 'mastery', 'talents',   // v0.26.889 — job talents` },
  // resets (the two full resets)
  { old: `    player.job = null; player.master = null;`,
    neu: `    player.job = null; player.master = null; player.talents = {};   // v0.26.889` },
  { old: `    player.cls = null; player.job = null; player.master = null;`,
    neu: `    player.cls = null; player.job = null; player.master = null; player.talents = {};   // v0.26.889` },
];

let n = 0;
for (const { old, neu } of reps) {
  const c = src.split(old).length - 1;
  if (c !== 1) { console.error('FAIL: expected 1, got ' + c + ' for: ' + old.slice(0, 70).replace(/\n/g, '\\n') + '...'); process.exit(2); }
  src = src.replace(old, neu); n++;
}
if (src === orig) { console.error('no change'); process.exit(3); }
await writeFile(FILE, src, 'utf8');
console.log('OK: ' + n + ' engine edits applied.');
