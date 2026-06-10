// Equipment sprite-prompt generator → HTML (converted to .docx by Word COM).
// Data rows: [cat, tier, rarity, cls, name, icon, statsObj]
// cat: W=weapons A=armors C=accessories
const DATA = require('./_equip_rows.json'); // [cat,tier,rarity,cls,name,icon,statsObj]

function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function typePhrase(cat, name, icon){
  const n = name.toLowerCase();
  if (cat === 'W'){
    if (/dagger|kunai|talon|fang|edge|whisper|blade(?!.*great)/.test(n) && !/greatblade|greatsword/.test(n)){
      if (/dagger|talon|fang/.test(n)) return 'a pair of curved combat daggers';
      if (/kunai/.test(n)) return 'a set of throwing kunai';
      if (/whisper|edge/.test(n)) return 'a single slender assassin’s shortblade';
    }
    if (/greatsword|greatblade|cleaver|reaver|maul|mace/.test(n)) return /maul|mace/.test(n) ? 'a massive two-handed warhammer' : 'a huge two-handed greatsword';
    if (/sword|sabre|katana|blade/.test(n)) return 'a one-handed longsword';
    if (/wand/.test(n)) return 'a slender magic wand';
    if (/staff|scepter|sceptre|focus/.test(n)) return 'a tall ornate spellcaster’s staff';
    if (/codex/.test(n)) return 'a floating arcane spellbook (codex)';
    if (/bow|recurve|longbow|shortbow|compound|predator/.test(n)) return 'a fantasy archer’s bow';
    if (/stick/.test(n)) return 'a crude whittled wooden stick';
    return 'a fantasy weapon';
  }
  if (cat === 'A'){
    if (/robe|vestment|regalia|garb/.test(n)) return 'a flowing mage robe';
    if (/cloak|shroud|hood|veil|mantle|cowl/.test(n)) return 'a hooded rogue cloak';
    if (/plate|armor|cuirass|bulwark|hauberk|carapace|wargear|pauldron|aegis|bracer/.test(n)) return 'a full plate-armor chestpiece';
    if (/scale/.test(n)) return 'a dragon-scale chest armor';
    if (/vest|tunic|leather|mail|rags|mantle/.test(n)) return 'a set of light leather/cloth body armor';
    return 'a piece of body armor';
  }
  // accessories
  if (/\bring\b|cord|band/.test(n)) return 'an ornate ring';
  if (/amulet|medallion|pendant|sigil|seal|insignia|token|heart/.test(n)) return 'an amulet / medallion on a chain';
  if (/talisman/.test(n)) return 'a mystical talisman charm';
  if (/orb|lens|eye/.test(n)) return 'a glowing arcane orb';
  if (/crown|halo/.test(n)) return /halo/.test(n) ? 'a radiant floating halo' : 'a jeweled crown';
  if (/mask/.test(n)) return 'a stylized face mask';
  if (/quiver/.test(n)) return 'an arrow quiver';
  if (/tattoo/.test(n)) return 'a glowing tattoo emblem / sigil';
  if (/boots/.test(n)) return 'a pair of swift boots';
  if (/veil/.test(n)) return 'a shadowy face veil';
  return 'a fantasy accessory';
}

function rarityVisual(rarity){
  switch(rarity){
    case 'common': return 'plain, slightly worn craftsmanship in muted greys and browns, no magical glow';
    case 'rare': return 'fine polished steel with deep-blue enamel accents and a faint cold sheen';
    case 'epic': return 'ornate craftsmanship inlaid with violet gemstones and crackling purple arcane energy, soft purple glow';
    case 'legendary': return 'masterwork, intricately detailed, wreathed in a powerful radiant aura';
    default: return 'fantasy craftsmanship';
  }
}

function legendaryTheme(name){
  const n = name.toLowerCase();
  if (/doom|blood/.test(n)) return 'molten blood-red energy, glowing rune-veins, embers';
  if (/void|singularity|nebula|cosmic|eternity|oblivion|stardust|apex/.test(n)) return 'deep cosmic purple-and-black with a swirling starfield and event-horizon shimmer';
  if (/storm|thunder|tempest|hurricane/.test(n)) return 'crackling electric-blue lightning and storm sparks';
  if (/eclipse|phantom|wraith|spectre|shadow/.test(n)) return 'wispy shadow-violet smoke and a ghostly translucent edge';
  if (/apocalypse|ragnarok|cataclysm|worldbreaker/.test(n)) return 'catastrophic fiery orange-and-gold cracks with falling cinders';
  if (/dawn|sky|skyhunter|hunter|stormcaller|falcon/.test(n)) return 'brilliant gold-white dawn light with a warm halo';
  return 'a brilliant gold-and-white legendary aura';
}

function classFlavor(cls){
  switch(cls){
    case 'warrior': return 'heavy, broad and rugged, built for a frontline warrior';
    case 'rogue': return 'sleek, sharp and dark-toned, built for a stealthy rogue';
    case 'mage': return 'arcane and elegant, etched with glowing spell-runes, built for a mage';
    case 'archer': return 'streamlined and aerodynamic with feather motifs, built for an archer';
    default: return 'balanced in design, usable by any class';
  }
}

const FRAMING = 'Single centered object on a transparent (or neutral dark) background, 3/4 hero angle, clean cel-shaded fantasy game art, crisp dark outline, soft rim lighting and a subtle ground shadow. No text, no characters, no extra props — a clean inventory/equip icon. Square 1:1 framing, high detail.';

function statsStr(o){
  const map={atk:'ATK',def:'DEF',hp:'HP',mp:'MP',crit:'Crit%',critDmg:'CritDmg',hpPct:'HP%',atkPct:'ATK%',accuracy:'Acc',evasion:'Eva'};
  return Object.keys(o).map(k=>`+${o[k]} ${map[k]||k}`).join(', ') || '—';
}

function buildPrompt(row){
  const [cat,tier,rarity,cls,name,icon,stats]=row;
  let parts=[];
  parts.push(typePhrase(cat,name,icon));
  parts.push(classFlavor(cls));
  parts.push(rarityVisual(rarity));
  if (rarity==='legendary') parts.push(legendaryTheme(name));
  // tier scaling cue
  const t=tier|0;
  if (t>=8) parts.push('extremely elaborate and imposing, overflowing with power (apex-tier)');
  else if (t>=5) parts.push('elaborate and impressive, clearly high-tier');
  else if (t<=1) parts.push('simple and humble, low-tier starter gear');
  parts.push(FRAMING);
  return parts.join('. ').replace(/\.\./g,'.');
}

const CATNAME={W:'Weapons',A:'Armor',C:'Accessories'};
function render(){
  const groups={W:{},A:{},C:{}};
  for(const r of DATA){ const [cat,tier]=r; (groups[cat][tier]=groups[cat][tier]||[]).push(r); }
  let h=[];
  h.push('<html><head><meta charset="utf-8"><style>');
  h.push('body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1a1a1a;}');
  h.push('h1{font-size:24pt;color:#3a2a6a;} h2{font-size:17pt;color:#5a3aa8;border-bottom:2px solid #cbb6f0;margin-top:22pt;} h3{font-size:13pt;color:#6634a8;margin-top:14pt;}');
  h.push('.item{margin:0 0 12pt 0;padding:6pt 8pt;border-left:3px solid #b59cf0;background:#f7f3ff;}');
  h.push('.nm{font-weight:bold;font-size:12pt;} .meta{color:#555;font-size:9.5pt;} .pl{margin-top:4pt;} .pl b{color:#5a3aa8;}');
  h.push('.intro{background:#f0ecfa;padding:10pt;border:1px solid #cbb6f0;}');
  h.push('</style></head><body>');
  h.push('<h1>Mojiworld — Equipment Sprite Prompt Sheet</h1>');
  h.push('<div class="intro"><b>Purpose:</b> One image-generation prompt per equippable item ('+DATA.length+' total) for producing consistent inventory/equip sprites.<br>');
  h.push('<b>Global style guide (prepend or keep consistent across every generation):</b> 2D fantasy RPG item icon, cel-shaded / painterly, bold readable silhouette, crisp dark outline, transparent background, centered single object, soft rim light, gentle drop shadow, no text or watermark, 512×512 square. Keep the same camera angle, lighting direction (upper-left key light) and outline weight across the whole set so the inventory grid looks cohesive.<br>');
  h.push('<b>Rarity colour language:</b> Common = muted grey/brown, no glow · Rare = steel + blue accents · Epic = violet gems + purple energy · Legendary = full radiant aura themed to the item’s name.</div>');
  for(const cat of ['W','A','C']){
    h.push('<h2>'+CATNAME[cat]+'</h2>');
    const tiers=Object.keys(groups[cat]).map(Number).sort((a,b)=>a-b);
    for(const t of tiers){
      h.push('<h3>Tier '+t+'</h3>');
      for(const r of groups[cat][t]){
        const [c,tier,rarity,cls,name,icon,stats]=r;
        h.push('<div class="item"><div class="nm">'+esc(icon)+' '+esc(name)+'</div>');
        h.push('<div class="meta">Tier '+tier+' · '+rarity+' · class: '+cls+' · stats: '+esc(statsStr(stats))+'</div>');
        h.push('<div class="pl"><b>Prompt:</b> '+esc(buildPrompt(r))+'</div></div>');
      }
    }
  }
  h.push('</body></html>');
  return h.join('\n');
}

// Exported so the sprite-generation runner can reproduce the EXACT docx prompts.
module.exports = { DATA, buildPrompt, typePhrase, statsStr, CATNAME };

// Only write the HTML artifact when run directly (`node gen_equip_prompts.js`),
// not when required as a library by the generator.
if (require.main === module) {
  const fs=require('fs');
  const outHtml='C:\\Users\\Xenon\\Desktop\\Mojiworld\\Equipment_Sprite_Prompts.html';
  fs.writeFileSync(outHtml, render(), 'utf8');
  console.log('wrote '+outHtml+' with '+DATA.length+' items');
}
