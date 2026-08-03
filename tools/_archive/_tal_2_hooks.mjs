// Talents · 2/3 — live hooks: getAtk/getDef/getMaxHp/getMaxMp/getCrit/getSpeed,
// hitMonster (skillDmg / basicLifesteal / critMp + Arcane Ember build),
// Fireball ember consumption, useConsumable potionBoost, U-panel talent card.
import { readFile, writeFile } from 'node:fs/promises';
const FILE = new URL('../mojiworld_game.html', import.meta.url);
let src = await readFile(FILE, 'utf8');
const orig = src;

const reps = [
  // getAtk
  { old: `  // Berserker passive: +% ATK below HP threshold`,
    neu: `  // v0.26.889 — job talent: flat ATK%
  { const _tfx = (typeof talentFx === 'function') ? talentFx() : null; if (_tfx && _tfx.atkPct) pct += _tfx.atkPct; }
  // Berserker passive: +% ATK below HP threshold` },
  // getDef
  { old: `  // v0.25.511 — Warrior innate: +20 % DEF over the baseline classes.
  if (player.cls === 'warrior') d = Math.floor(d * 1.25);
  return d;`,
    neu: `  // v0.26.889 — job talent: DEF%
  { const _tfx = (typeof talentFx === 'function') ? talentFx() : null; if (_tfx && _tfx.defPct) d = Math.floor(d * (1 + _tfx.defPct)); }
  // v0.25.511 — Warrior innate: +20 % DEF over the baseline classes.
  if (player.cls === 'warrior') d = Math.floor(d * 1.25);
  return d;` },
  // getMaxHp
  { old: `  const _hpPct = ((player.mods && player.mods.maxHpPct) || 0) + (getEquipBonus('hpPct') || 0);
  if (_hpPct) h = Math.floor(h * (1 + _hpPct));
  return h;`,
    neu: `  const _hpPct = ((player.mods && player.mods.maxHpPct) || 0) + (getEquipBonus('hpPct') || 0);
  if (_hpPct) h = Math.floor(h * (1 + _hpPct));
  // v0.26.889 — job talent: max HP%
  { const _tfx = (typeof talentFx === 'function') ? talentFx() : null; if (_tfx && _tfx.maxHpPct) h = Math.floor(h * (1 + _tfx.maxHpPct)); }
  return h;` },
  // getMaxMp
  { old: `  const _mpPct = (player.mods && player.mods.maxMpPct) || 0;
  if (_mpPct) m = Math.floor(m * (1 + _mpPct));
  return m;`,
    neu: `  const _mpPct = (player.mods && player.mods.maxMpPct) || 0;
  if (_mpPct) m = Math.floor(m * (1 + _mpPct));
  // v0.26.889 — job talent: max MP%
  { const _tfx = (typeof talentFx === 'function') ? talentFx() : null; if (_tfx && _tfx.maxMpPct) m = Math.floor(m * (1 + _tfx.maxMpPct)); }
  return m;` },
  // getCrit
  { old: `  // v0.25.511 — Rogue innate: +20 % crit chance over the baseline classes.
  if (player.cls === 'rogue') c = Math.floor(c * 1.20);`,
    neu: `  // v0.26.889 — job talent: flat crit points
  { const _tfx = (typeof talentFx === 'function') ? talentFx() : null; if (_tfx && _tfx.critPct) c += _tfx.critPct; }
  // v0.25.511 — Rogue innate: +20 % crit chance over the baseline classes.
  if (player.cls === 'rogue') c = Math.floor(c * 1.20);` },
  // getSpeed
  { old: `  s *= _classSpeedMul;
  if (player.buffs.bloodlust > 0) s += 1.2;`,
    neu: `  s *= _classSpeedMul;
  // v0.26.889 — job talent: movement speed%
  { const _tfx = (typeof talentFx === 'function') ? talentFx() : null; if (_tfx && _tfx.speedPct) s *= (1 + _tfx.speedPct); }
  if (player.buffs.bloodlust > 0) s += 1.2;` },
  // hitMonster — combat talents + ember build
  { old: `  if (!m || m.currentHp <= 0) return;
  // v0.26.086 — Libra Scale Orbs damage gate.`,
    neu: `  if (!m || m.currentHp <= 0) return;
  // v0.26.889 — JOB TALENT combat hooks + mage Arcane Embers, at the
  // canonical player→monster damage sink so every attack path is covered.
  if (typeof player !== 'undefined' && player) {
    const _tfx = (typeof talentFx === 'function') ? talentFx() : null;
    const _basicSkill = (skill === 'bolt' || skill === 'slash' || skill === 'arrow' || skill === 'dagger' || skill === 'basic' || skill === 'melee');
    if (_tfx) {
      if (_tfx.skillDmg && !_basicSkill) dmg = Math.floor(dmg * (1 + _tfx.skillDmg));
      if (_tfx.basicLifesteal && _basicSkill) player.hp = Math.min(getMaxHp(), player.hp + Math.max(1, Math.floor(dmg * _tfx.basicLifesteal)));
      if (_tfx.critMp && isCrit) player.mp = Math.min(getMaxMp(), player.mp + _tfx.critMp);
    }
    if (player.cls === 'mage' && skill === 'bolt') {
      const _now = Date.now();
      if (!player._emberT || _now - player._emberT > 6000) player._emberStacks = 0;
      player._emberStacks = Math.min(5, (player._emberStacks || 0) + 1);
      player._emberT = _now;
      if (typeof _renderEmberPips === 'function') _renderEmberPips();
    }
  }
  // v0.26.086 — Libra Scale Orbs damage gate.` },
  // Fireball consumes embers
  { old: `      damage: getAtk() * 1.8 + 8, owner: 'player', skill: 'fire', explode: 180,`,
    neu: `      damage: (getAtk() * 1.8 + 8) * ((typeof _consumeEmbers === 'function') ? _consumeEmbers() : 1), owner: 'player', skill: 'fire', explode: 180,   // v0.26.889 — Arcane Embers (+12%/stack)` },
  // potionBoost
  { old: `  const pct = p.pct || p.value || 0;
  if (p.type === 'hp') player.hp = Math.min(getMaxHp(), player.hp + Math.ceil(getMaxHp() * pct / 100));
  else if (p.type === 'mp') player.mp = Math.min(getMaxMp(), player.mp + Math.ceil(getMaxMp() * pct / 100));`,
    neu: `  const pct = p.pct || p.value || 0;
  // v0.26.889 — job talent: potion effectiveness
  const _potMul = (() => { const t = (typeof talentFx === 'function') ? talentFx() : null; return (t && t.potionBoost) ? 1 + t.potionBoost : 1; })();
  if (p.type === 'hp') player.hp = Math.min(getMaxHp(), player.hp + Math.ceil(getMaxHp() * pct * _potMul / 100));
  else if (p.type === 'mp') player.mp = Math.min(getMaxMp(), player.mp + Math.ceil(getMaxMp() * pct * _potMul / 100));` },
  // U-panel card after the innate ledger
  { old: `      <div id="lp-innate" class="lp-innate"></div>
    </div>`,
    neu: `      <div id="lp-innate" class="lp-innate"></div>
      \${(typeof _talentCardHtml === 'function') ? _talentCardHtml() : ''}
    </div>` },
];

let n = 0;
for (const { old, neu } of reps) {
  const c = src.split(old).length - 1;
  if (c !== 1) { console.error('FAIL: expected 1, got ' + c + ' for: ' + old.slice(0, 70).replace(/\n/g, '\\n') + '...'); process.exit(2); }
  src = src.replace(old, neu); n++;
}
if (src === orig) { console.error('no change'); process.exit(3); }
await writeFile(FILE, src, 'utf8');
console.log('OK: ' + n + ' hook edits applied.');
