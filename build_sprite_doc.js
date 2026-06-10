// build_sprite_doc.js — generate MOJIWORLD_SPRITE_PRODUCTION_LIST.docx
// Run: NODE_PATH="$APPDATA/npm/node_modules" node build_sprite_doc.js
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, LevelFormat, HeadingLevel, BorderStyle, WidthType, ShadingType,
  PageBreak,
} = require('docx');

// ---------- biome → sprite list ----------
const biomes = [
  { title: 'Forest / Mushroom / Candy / Bubblegum (Lv 1–15)', rows: [
    ['forest_oak_stump', 'mossy cut stump with one toadstool'],
    ['forest_log_pile', 'three stacked logs, frayed bark'],
    ['forest_fern_cluster', 'broad green fronds (front-of-platform filler)'],
    ['mushroom_giant_red', '1.2 m red-cap mushroom with spotted dome'],
    ['mushroom_spore_cluster', '5 small lavender mushrooms huddled'],
    ['candy_lollipop_post', 'giant swirled lollipop ground stake'],
    ['candy_jellybean_bush', 'pastel bean cluster on stems'],
    ['bubblegum_bubble_drift', 'translucent floating bubble (mid-air decoration)'],
  ]},
  { title: 'Pearl Bathhouse / Stardust Atrium / Honeycomb Hollow (Lv 15–30)', rows: [
    ['pearl_clamshell_bench', 'open scallop with pearl-cushion seat'],
    ['pearl_water_basin', 'shallow gilded font with floating petals'],
    ['stardust_orrery', 'bronze celestial-rings sculpture'],
    ['stardust_telescope', 'brass tripod scope'],
    ['honeycomb_honey_jar', 'amber pot oozing'],
    ['honeycomb_wax_candle_row', 'three beeswax tapers on a comb tray'],
  ]},
  { title: 'Desert / Coast (Dune Sands, Sunset Beach — Lv 8–18)', rows: [
    ['dune_camel_skull', 'sun-bleached skull half-buried'],
    ['dune_cactus_tall', 'three-armed saguaro'],
    ['dune_tent_striped', 'small nomad tent with red/cream stripes'],
    ['beach_palm_leaning', 'curved palm with coconuts'],
    ['beach_driftwood_log', 'weathered grey log'],
    ['beach_sandcastle_ruin', 'half-collapsed castle'],
  ]},
  { title: 'Crypt / Bone Graveyard / Sepulchre / Wayfarer (Lv 30–70)', rows: [
    ['crypt_sarcophagus_cracked', 'stone coffin with fissure leaking violet mist'],
    ['crypt_tombstone_lean', 'tilted slab with worn rune'],
    ['bone_pile_ribcage', 'exposed ribcage and femurs'],
    ['wayfarer_lantern_post', 'iron post, glass cage with green soul-flame'],
    ['sepulchre_iron_chains', 'chain coil hanging from above (mid-air)'],
    ['crypt_skull_pillar', 'stacked stone-and-skull column'],
    ['graveyard_dead_tree', 'bare twisted tree, no leaves'],
  ]},
  { title: 'Underwater (Coral Reef, Abyssal Trench, Octopus, Tidepool, Withering Tide — Lv 20–80)', rows: [
    ['coral_branch_pink', 'branching pink coral on rock base'],
    ['coral_brain', 'round brain-coral mound'],
    ['kelp_strand_tall', 'swaying green kelp pillar (mid-air)'],
    ['pearl_giant_clam', 'half-open giant clam, pearl inside'],
    ['abyssal_bioluminescent_jellystalk', 'tall glow-stalk, drifting cyan light'],
    ['abyssal_anglerfish_skull', 'huge fang-jawed skull'],
    ['octopus_ink_vase', 'broken urn leaking ink'],
    ['tidepool_starfish_pile', 'three orange stars on a wet rock'],
  ]},
  { title: 'Lava / Forge (Lava Cavern, Magma Foundry, Sundered Forge — Lv 40–75)', rows: [
    ['lava_crystal_cluster', 'red-orange crystal shards on basalt'],
    ['forge_anvil_iron', 'classic black anvil on log stump'],
    ['forge_bellows_huge', 'accordion bellows venting steam'],
    ['forge_iron_ingot_stack', 'five glowing-edge ingots'],
    ['forge_quench_barrel', 'barrel of dark steaming water'],
    ['lava_basalt_pillar', 'hexagonal column, glowing seams'],
  ]},
  { title: 'Ice / Wind (Frozen Peak, Frostbite Hollow, Glasswind Steppe — Lv 45–80)', rows: [
    ['ice_stalagmite', 'jagged blue-white spike'],
    ['ice_frozen_torch', 'iron sconce encased in ice'],
    ['glasswind_glass_shard_pile', 'translucent shards scattered'],
    ['glasswind_weather_vane', 'bent iron compass cross'],
    ['frostbite_carcass_frozen', 'half-buried mammoth tusk pair'],
  ]},
  { title: 'Sky / Storm (Sky Garden, Storm Crest, Thunder Plateau, Celestial Spire — Lv 35–85)', rows: [
    ['sky_floating_islet_small', 'grass-topped chunk of land (decorative midair)'],
    ['sky_lightning_rod', 'iron rod with crackling tip'],
    ['sky_cloud_puff', 'flat painted cumulus (background-foreground bridge)'],
    ['celestial_arcane_glyph_stone', 'floating obelisk with runes'],
    ['storm_broken_windmill', 'wrecked four-blade mill'],
  ]},
  { title: 'Cosmic / Inner Dimension (Sanctum, Inner Dimension, Gravitos Arena — Lv 80–100)', rows: [
    ['cosmic_void_crystal', 'impossible-geometry purple crystal'],
    ['cosmic_singularity_shard', 'floating black shard with light halo'],
    ['cosmic_orbital_ring', 'thin gold ring suspended midair'],
    ['sanctum_pillar_broken', 'shattered marble column'],
  ]},
  { title: 'Mario-kingdom (Sauro Slope, Koopa Throne — Lv 50–65)', rows: [
    ['koopa_throne_chair', 'spiked-shell throne (boss arena hero piece)'],
    ['koopa_torch_brazier', 'iron brazier with green flame'],
    ['sauro_question_block', 'classic yellow ? block on a post'],
    ['sauro_warp_pipe_green', 'green pipe segment, ground-anchored'],
  ]},
  { title: 'Clockwork PQ (Underpass Lobby, Spire, Express — Lv 25)', rows: [
    ['clockwork_turnstile_subway', 'brass turnstile with ticket slot'],
    ['clockwork_ticket_dispenser', 'tall vending box, glowing slot'],
    ['clockwork_gear_giant_wall', 'rotating gear backdrop piece'],
    ['clockwork_lantern_signal', 'red/green signal lamp'],
    ['clockwork_luggage_trunk', 'leather steamer trunk with brass clasps'],
    ['express_carriage_bench', 'velvet seat with wood frame'],
    ['spire_clock_face', 'broken clock face, hands at random angles'],
  ]},
  { title: 'Tower of Expedition (B1–B10 themed)', rows: [
    ['tower_entry_brazier', 'tall iron-stand fire bowl (B1)'],
    ['tower_mirror_shard_floor', 'cracked floor mirror (B2)'],
    ['tower_arbiter_judgement_scales', 'giant gold scales (B5 arena hero)'],
    ['tower_sovereign_throne_obsidian', 'jagged black throne (B10 arena hero)'],
    ['tower_chain_stake', 'iron stake with broken chain (universal)'],
  ]},
  { title: 'Zodiac Sanctum (zodiacHall — Lv 70+)', rows: [
    ['zodiac_constellation_glyph', 'floating glyph (12 variants: aries…pisces) — single sprite tinted per portal'],
    ['zodiac_star_pedestal', 'marble plinth with glowing star atop'],
    ['zodiac_ribbon_banner', 'celestial silk banner with sign embroidery'],
  ]},
  { title: 'Boss arenas (slimeCave, ancient, ribcage, octopusGrotto, gravitosArena)', rows: [
    ['arena_chain_post_broken', 'snapped iron post (generic)'],
    ['arena_blood_smear_floor', 'floor decal (placed beneath boss spawn)'],
    ['arena_warning_pillar_glow', 'obelisk with pulsing ward rune'],
  ]},
  { title: 'Town extensions (Everdawn Central — Eastern Quarter)', rows: [
    ['town_eastern_lantern_string', 'mid-air string-lights span'],
    ['town_eastern_awning_red', 'striped red shop awning'],
    ['town_market_stall_fruit', 'wooden stall with crate of citrus'],
    ['town_stone_planter', 'square planter with topiary'],
    ['town_fountain_small_east', 'second fountain mirroring west'],
  ]},
];

// ---------- map background audit ----------
function _bracedSlice(str, fromIdx, open, close) {
  const blockStart = str.indexOf(open, fromIdx);
  if (blockStart < 0) return null;
  let depth = 0;
  for (let i = blockStart; i < str.length; i++) {
    const ch = str[i];
    if (ch === open) depth++;
    else if (ch === close) { depth--; if (depth === 0) return str.substring(blockStart, i + 1); }
  }
  return null;
}
function _extractMaps(srcText) {
  const startIdx = srcText.indexOf('const MAPS = {');
  const mapsBlockText = _bracedSlice(srcText, startIdx, '{', '}');
  const out = new Function('return (' + mapsBlockText + ');')();
  const zodMatch = srcText.match(/\nMAPS\.zodiacHall\s*=\s*\{/);
  if (zodMatch) {
    const zodIdx = zodMatch.index + zodMatch[0].lastIndexOf('{');
    const zodText = _bracedSlice(srcText, zodIdx, '{', '}');
    let zsText='[]';
    const zsStart = srcText.indexOf('const ZODIAC_SIGNS = [');
    const zsSlice = _bracedSlice(srcText, zsStart, '[', ']');
    if (zsSlice) zsText = zsSlice;
    out.zodiacHall = new Function('const ZODIAC_SIGNS='+zsText+'; return ('+zodText+');')();
  }
  const tfIdx = srcText.indexOf('const TOWER_FLOORS = [');
  const tfText = _bracedSlice(srcText, tfIdx, '[', ']');
  const towerFloors = new Function('return (' + tfText + ');')();
  for (const cfg of towerFloors) {
    if (out[cfg.id]) continue;
    out[cfg.id] = { name: cfg.name, bg: cfg.bg || 'dungeon' };
  }
  return out;
}
const mapAudit = (() => {
  const srcText = fs.readFileSync('mojiworld_game.html', 'utf8');
  const maps = _extractMaps(srcText);
  const placeholder = [], missingFile = [];
  for (const [id, m] of Object.entries(maps)) {
    if (!m || typeof m !== 'object') continue;
    const bg = m.bg || null;
    if (!bg) { missingFile.push({ id, name: m.name||id, bg:'<none declared>' }); continue; }
    if (bg === 'dungeon') { placeholder.push({ id, name: m.name||id }); continue; }
    const found = ['bg_v3_'+bg+'.png','bg_v3_'+bg+'.webp','bg_'+bg+'.png',bg+'.png']
                    .some(p => fs.existsSync('backgrounds/'+p));
    if (!found) missingFile.push({ id, name: m.name||id, bg });
  }
  return { total: Object.keys(maps).length, placeholder, missingFile };
})();

// ---------- portal extraction (inline + push statements) ----------
function _extractPortals(srcText, maps) {
  // Seed from inline `portals:` arrays inside the MAPS literal.
  const portals = {};
  for (const [id, m] of Object.entries(maps)) {
    portals[id] = Array.isArray(m && m.portals) ? m.portals.slice() : [];
  }
  // Then scan MAPS.<id>.portals.push({...}) statements after the block.
  // Each push uses brace-matching to extract the full object literal
  // (handles nested commas, strings, comments etc. that regex would
  // misparse). The object literal is fed through `new Function` so
  // all JS syntax (template strings, numeric expressions) works as
  // it does at runtime.
  const re = /MAPS\.([a-zA-Z_][a-zA-Z0-9_]*)\.portals\.push\s*\(/g;
  let m;
  while ((m = re.exec(srcText))) {
    const id = m[1];
    const objStart = re.lastIndex - 1;   // the '(' opens here; advance to next '{'
    const obj = _bracedSlice(srcText, objStart, '{', '}');
    if (!obj) continue;
    let parsed = null;
    try { parsed = new Function('return (' + obj + ');')(); }
    catch (_) { /* skip unparseable objects (template-string dest, etc.) */ }
    if (!parsed) continue;
    if (!portals[id]) portals[id] = [];
    portals[id].push(parsed);
  }
  return portals;
}
const portalMap = (() => {
  const srcText = fs.readFileSync('mojiworld_game.html', 'utf8');
  const maps = _extractMaps(srcText);
  const portals = _extractPortals(srcText, maps);
  // Pair with display name for the table.
  return Object.keys(portals).sort().map(id => ({
    id,
    name: (maps[id] && maps[id].name) || id,
    worldWidth: (maps[id] && maps[id].worldWidth) || null,
    portals: portals[id],
  })).filter(row => row.portals.length > 0);
})();

// ---------- audit section: declared in code, missing from disk ----------
const text = fs.readFileSync('mojiworld_game.html', 'utf8');
const declared = new Set();
const patterns = [
  /['"](Sprites\/[a-zA-Z0-9_\/.-]+\.(?:png|webp|jpg|jpeg|gif))['"]/g,
  /['"](backgrounds\/[a-zA-Z0-9_.-]+\.(?:png|webp|jpg|jpeg))['"]/g,
  /['"](audio\/[a-zA-Z0-9_\/.-]+\.(?:mp3|wav|ogg))['"]/g,
];
for (const re of patterns) { let m; while ((m = re.exec(text))) declared.add(m[1]); }
const fxBlock = text.match(/LX_FX\s*=\s*\{([\s\S]*?)\n\s*\};/);
if (fxBlock) { const re=/['"]([a-zA-Z0-9_]+\.(?:png|webp))['"]/g; let m; while ((m=re.exec(fxBlock[1]))) declared.add('Sprites/fx/'+m[1]); }
const projBlock = text.match(/LX_MOB_PROJ_SPRITES\s*=\s*\{([\s\S]*?)\n\s*\};/) || text.match(/_MOB_PROJ_SPRITES\s*=\s*\{([\s\S]*?)\n\s*\};/);
if (projBlock) { const re=/['"]([a-zA-Z0-9_]+\.(?:png|webp))['"]/g; let m; while ((m=re.exec(projBlock[1]))) declared.add('Sprites/projectiles/'+m[1]); }
const missing = [...declared].filter(p => !fs.existsSync(p)).sort();

// Categorize missing for the table
const cat = (p) => {
  if (p.startsWith('audio/boss/'))    return 'Boss music / stinger';
  if (p.startsWith('audio/monster/')) return 'Monster hit/die';
  if (p.startsWith('audio/ui/'))      return 'UI SFX';
  if (p.startsWith('audio/'))         return 'Other audio';
  if (p.startsWith('Sprites/bosses/attack/')) return 'Boss attack pose';
  if (p.startsWith('Sprites/fx/'))    return 'Skill VFX (.webp variant)';
  if (p.startsWith('Sprites/vfx/'))   return 'Generic VFX';
  if (p.startsWith('Sprites/character/')) return 'Character body part';
  if (p.startsWith('Sprites/projectiles/cast/')) return 'Projectile cast frame';
  if (p.startsWith('Sprites/npc/'))   return 'NPC portrait';
  return 'Other';
};
const byCat = {};
for (const p of missing) (byCat[cat(p)] = byCat[cat(p)] || []).push(p);

// ---------- docx assembly helpers ----------
const styles = {
  default: { document: { run: { font: 'Arial', size: 22 } } },
  paragraphStyles: [
    { id:'Title', name:'Title', basedOn:'Normal', next:'Normal', quickFormat:true,
      run:{ size:44, bold:true, font:'Arial' },
      paragraph:{ spacing:{ before:0, after:240 } } },
    { id:'Heading1', name:'Heading 1', basedOn:'Normal', next:'Normal', quickFormat:true,
      run:{ size:32, bold:true, font:'Arial', color:'2E3A59' },
      paragraph:{ spacing:{ before:360, after:160 }, outlineLevel:0 } },
    { id:'Heading2', name:'Heading 2', basedOn:'Normal', next:'Normal', quickFormat:true,
      run:{ size:26, bold:true, font:'Arial', color:'4A5572' },
      paragraph:{ spacing:{ before:240, after:120 }, outlineLevel:1 } },
  ],
};

const numbering = {
  config: [
    { reference:'pri', levels:[{ level:0, format:LevelFormat.DECIMAL, text:'%1.',
      alignment:AlignmentType.LEFT,
      style:{ paragraph:{ indent:{ left:720, hanging:360 } } } }] },
  ],
};

const border = { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' };
const cellBorders = { top:border, bottom:border, left:border, right:border };
const headerShade = { fill: 'D5E8F0', type: ShadingType.CLEAR };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

function spriteTable(rows) {
  const colW = [3300, 6060]; // total 9360 DXA = US Letter content width
  const headerRow = new TableRow({ tableHeader: true, children: [
    new TableCell({ borders:cellBorders, width:{ size:colW[0], type:WidthType.DXA }, shading:headerShade, margins:cellMargins,
      children:[new Paragraph({ children:[new TextRun({ text:'Key', bold:true })] })] }),
    new TableCell({ borders:cellBorders, width:{ size:colW[1], type:WidthType.DXA }, shading:headerShade, margins:cellMargins,
      children:[new Paragraph({ children:[new TextRun({ text:'Visual hint', bold:true })] })] }),
  ] });
  const bodyRows = rows.map(([k,v]) => new TableRow({ children: [
    new TableCell({ borders:cellBorders, width:{ size:colW[0], type:WidthType.DXA }, margins:cellMargins,
      children:[new Paragraph({ children:[new TextRun({ text:k, font:'Consolas', size:20 })] })] }),
    new TableCell({ borders:cellBorders, width:{ size:colW[1], type:WidthType.DXA }, margins:cellMargins,
      children:[new Paragraph({ children:[new TextRun({ text:v, size:20 })] })] }),
  ] }));
  return new Table({ width:{ size:9360, type:WidthType.DXA }, columnWidths:colW, rows:[headerRow, ...bodyRows] });
}

function auditTable(items) {
  const colW = [6960, 2400];
  const headerRow = new TableRow({ tableHeader: true, children: [
    new TableCell({ borders:cellBorders, width:{ size:colW[0], type:WidthType.DXA }, shading:headerShade, margins:cellMargins,
      children:[new Paragraph({ children:[new TextRun({ text:'Path declared in code', bold:true })] })] }),
    new TableCell({ borders:cellBorders, width:{ size:colW[1], type:WidthType.DXA }, shading:headerShade, margins:cellMargins,
      children:[new Paragraph({ children:[new TextRun({ text:'Count', bold:true })] })] }),
  ] });
  // One row per item path
  const bodyRows = items.map(p => new TableRow({ children: [
    new TableCell({ borders:cellBorders, width:{ size:colW[0], type:WidthType.DXA }, margins:cellMargins,
      children:[new Paragraph({ children:[new TextRun({ text:p, font:'Consolas', size:18 })] })] }),
    new TableCell({ borders:cellBorders, width:{ size:colW[1], type:WidthType.DXA }, margins:cellMargins,
      children:[new Paragraph({ children:[new TextRun({ text:'1', size:18 })] })] }),
  ] }));
  return new Table({ width:{ size:9360, type:WidthType.DXA }, columnWidths:colW, rows:[headerRow, ...bodyRows] });
}

// ---------- compose document body ----------
const body = [];
body.push(new Paragraph({ style:'Title', children:[new TextRun('Mojiworld — Sprite Production List')] }));
body.push(new Paragraph({ children:[new TextRun({ text:`Generated against game state v0.26.332. ${biomes.reduce((a,b)=>a+b.rows.length,0)} new decorative sprites proposed (Part 1). ${mapAudit.placeholder.length + mapAudit.missingFile.length} maps need background art (Part 2). ${portalMap.length} maps with ${portalMap.reduce((a,m)=>a+m.portals.length,0)} portals catalogued for the placement tool (Part 3). ${missing.length} declared-but-missing assets in the audit (Part 4).`, italics:true, size:20, color:'666666' })] }));

// PART 1 — decorative sprite proposals
body.push(new Paragraph({ heading:HeadingLevel.HEADING_1, children:[new TextRun('Part 1 — Decorative props to create')] }));
body.push(new Paragraph({ children:[new TextRun({ text:'Suggested file convention: Sprites/objects/<key>.png. Transparent PNG, feet-anchored, ~96–160 px tall for ground props, ~64–96 px for mid-air. Once authored and dropped into the directory, register the key + (x, y, scale) in the MAP_PROPS block in mojiworld_game.html and the map_placement_tool.html can drag them in visually.', size:20 })] }));

for (const b of biomes) {
  body.push(new Paragraph({ heading:HeadingLevel.HEADING_2, children:[new TextRun(b.title)] }));
  body.push(spriteTable(b.rows));
  body.push(new Paragraph({ children:[new TextRun('')] })); // spacer
}

// Priority order
body.push(new Paragraph({ heading:HeadingLevel.HEADING_2, children:[new TextRun('Recommended production order')] }));
const pri = [
  'Town Eastern Quarter (5 sprites) — area is empty since v0.26.006',
  'Tower of Expedition (5 sprites) — 10 floors with placeholder backgrounds',
  'Clockwork PQ trio (7 sprites) — high traffic, currently bare',
  'Crypt / Sepulchre / Graveyard (7 sprites) — Lv 30–70 zone, undecorated',
  'Underwater zones (8 sprites) — five maps share the palette',
  'Forge / Lava (6 sprites) — two maps share, can reuse',
  'Cosmic / Sanctum (4 sprites) — endgame ambience',
  'Boss arena hero pieces (Arbiter scales, Sovereign throne, Koopa throne) — single-use but high-impact',
];
for (const p of pri) {
  body.push(new Paragraph({ numbering:{ reference:'pri', level:0 }, children:[new TextRun({ text:p, size:20 })] }));
}

// PART 2 — map backgrounds needing art
body.push(new Paragraph({ children:[new PageBreak()] }));
body.push(new Paragraph({ heading:HeadingLevel.HEADING_1, children:[new TextRun('Part 2 — Map backgrounds to generate')] }));
body.push(new Paragraph({ children:[new TextRun({ text:`Across the ${mapAudit.total} maps the game knows about, ${mapAudit.placeholder.length} fall back to the generic dungeon backdrop and ${mapAudit.missingFile.length} reference a bg key that has no matching file in backgrounds/. Generating these will materially lift the visual identity of the listed maps. Target spec: 1024×640 PNG (16:10) or wider for vertical-tower variants, saved as backgrounds/bg_v3_<key>.png so the engine's existing loader picks them up automatically.`, size:20 })] }));

function bgTable(rows) {
  const colW = [2400, 2960, 4000];
  const headerRow = new TableRow({ tableHeader: true, children: [
    new TableCell({ borders:cellBorders, width:{ size:colW[0], type:WidthType.DXA }, shading:headerShade, margins:cellMargins,
      children:[new Paragraph({ children:[new TextRun({ text:'Map id', bold:true })] })] }),
    new TableCell({ borders:cellBorders, width:{ size:colW[1], type:WidthType.DXA }, shading:headerShade, margins:cellMargins,
      children:[new Paragraph({ children:[new TextRun({ text:'Bg key', bold:true })] })] }),
    new TableCell({ borders:cellBorders, width:{ size:colW[2], type:WidthType.DXA }, shading:headerShade, margins:cellMargins,
      children:[new Paragraph({ children:[new TextRun({ text:'Display name / notes', bold:true })] })] }),
  ] });
  const bodyRows = rows.map(r => new TableRow({ children: [
    new TableCell({ borders:cellBorders, width:{ size:colW[0], type:WidthType.DXA }, margins:cellMargins,
      children:[new Paragraph({ children:[new TextRun({ text:r.id, font:'Consolas', size:18 })] })] }),
    new TableCell({ borders:cellBorders, width:{ size:colW[1], type:WidthType.DXA }, margins:cellMargins,
      children:[new Paragraph({ children:[new TextRun({ text:r.bg||'<none>', font:'Consolas', size:18 })] })] }),
    new TableCell({ borders:cellBorders, width:{ size:colW[2], type:WidthType.DXA }, margins:cellMargins,
      children:[new Paragraph({ children:[new TextRun({ text:r.name, size:18 })] })] }),
  ] }));
  return new Table({ width:{ size:9360, type:WidthType.DXA }, columnWidths:colW, rows:[headerRow, ...bodyRows] });
}

body.push(new Paragraph({ heading:HeadingLevel.HEADING_2, children:[new TextRun(`Placeholder dungeon fallback (${mapAudit.placeholder.length})`)] }));
body.push(new Paragraph({ children:[new TextRun({ text:'These maps explicitly set bg:"dungeon" — generic stone-wall backdrop. Each has its own thematic identity that the placeholder fails to sell.', italics:true, size:20, color:'666666' })] }));
body.push(bgTable(mapAudit.placeholder.map(m => ({ id:m.id, bg:'dungeon', name:m.name }))));
body.push(new Paragraph({ children:[new TextRun('')] }));

body.push(new Paragraph({ heading:HeadingLevel.HEADING_2, children:[new TextRun(`Bg key declared but file missing (${mapAudit.missingFile.length})`)] }));
body.push(new Paragraph({ children:[new TextRun({ text:'These maps declare a unique bg key in the MAPS config but the matching backgrounds/bg_v3_<key>.png is absent — engine falls back to procedural sky-gradient + platform rendering only.', italics:true, size:20, color:'666666' })] }));
body.push(bgTable(mapAudit.missingFile));
body.push(new Paragraph({ children:[new TextRun('')] }));

body.push(new Paragraph({ heading:HeadingLevel.HEADING_2, children:[new TextRun('Suggested generation order')] }));
const bgPri = [
  'town (everdawnCentral) + everdawn_megamall — town hub is the player\'s first impression; both currently fall through to procedural fill.',
  'koopaThrone — boss arena hero piece; placeholder dungeon undercuts the Bowser-throne identity.',
  'tower_b1..b10 — 10 expedition floors; bg fields name distinct themes (entry, mirror, tomb, echo, midboss, aether, crystal, bone, storm, finale) but five still ride dungeon.',
  'slimeCave, abyssalTrench, octopusGrotto, lavaCavern — themed combat zones currently sharing the dungeon backdrop.',
  'skyGarden (zodiacDawn), boss (cosmos), void (voidBlack) — cosmic / void-themed zones with distinct palettes baked into other systems.',
];
for (const p of bgPri) {
  body.push(new Paragraph({ numbering:{ reference:'pri', level:0 }, children:[new TextRun({ text:p, size:20 })] }));
}

// PART 3 — portal positioning per map
body.push(new Paragraph({ children:[new PageBreak()] }));
body.push(new Paragraph({ heading:HeadingLevel.HEADING_1, children:[new TextRun('Part 3 — Portal positioning per map')] }));
body.push(new Paragraph({ children:[new TextRun({ text:`Authoritative dump of every portal across the ${portalMap.length} maps that own one — sourced from both inline portals:[] arrays and runtime MAPS.<id>.portals.push() statements. Use this table when configuring the map_placement_tool.html: the (x, y) coordinates are in world-space pixels; the y field is rendered relative to the ground line (most maps spawn portals at y:412–460 to sit on the ground tile). Where y is unset the engine snaps the portal to ground-y at render time.`, size:20 })] }));

function portalTable(portals) {
  const colW = [780, 780, 2400, 5400]; // x | y | dest | name + flags  (sum = 9360)
  const headerRow = new TableRow({ tableHeader: true, children: [
    new TableCell({ borders:cellBorders, width:{ size:colW[0], type:WidthType.DXA }, shading:headerShade, margins:cellMargins,
      children:[new Paragraph({ children:[new TextRun({ text:'x', bold:true })] })] }),
    new TableCell({ borders:cellBorders, width:{ size:colW[1], type:WidthType.DXA }, shading:headerShade, margins:cellMargins,
      children:[new Paragraph({ children:[new TextRun({ text:'y', bold:true })] })] }),
    new TableCell({ borders:cellBorders, width:{ size:colW[2], type:WidthType.DXA }, shading:headerShade, margins:cellMargins,
      children:[new Paragraph({ children:[new TextRun({ text:'dest', bold:true })] })] }),
    new TableCell({ borders:cellBorders, width:{ size:colW[3], type:WidthType.DXA }, shading:headerShade, margins:cellMargins,
      children:[new Paragraph({ children:[new TextRun({ text:'name / flags', bold:true })] })] }),
  ] });
  const bodyRows = portals.map(p => {
    const flags = [];
    if (p.levelGate)    flags.push('Lv ≥ ' + p.levelGate);
    if (p.entryX != null) flags.push('entryX:' + p.entryX);
    if (p.entryY != null) flags.push('entryY:' + p.entryY);
    if (p._hidden)       flags.push('hidden');
    if (p._pqSpireReturn) flags.push('spire-return');
    const flagStr = flags.length ? '  [' + flags.join(', ') + ']' : '';
    return new TableRow({ children: [
      new TableCell({ borders:cellBorders, width:{ size:colW[0], type:WidthType.DXA }, margins:cellMargins,
        children:[new Paragraph({ children:[new TextRun({ text:String(p.x ?? ''), font:'Consolas', size:18 })] })] }),
      new TableCell({ borders:cellBorders, width:{ size:colW[1], type:WidthType.DXA }, margins:cellMargins,
        children:[new Paragraph({ children:[new TextRun({ text:String(p.y ?? '—'), font:'Consolas', size:18 })] })] }),
      new TableCell({ borders:cellBorders, width:{ size:colW[2], type:WidthType.DXA }, margins:cellMargins,
        children:[new Paragraph({ children:[new TextRun({ text:String(p.dest ?? ''), font:'Consolas', size:18 })] })] }),
      new TableCell({ borders:cellBorders, width:{ size:colW[3], type:WidthType.DXA }, margins:cellMargins,
        children:[new Paragraph({ children:[new TextRun({ text:(p.name ?? '') + flagStr, size:18 })] })] }),
    ] });
  });
  return new Table({ width:{ size:9360, type:WidthType.DXA }, columnWidths:colW, rows:[headerRow, ...bodyRows] });
}

for (const m of portalMap) {
  const wwLabel = m.worldWidth ? `  (worldWidth ${m.worldWidth})` : '';
  body.push(new Paragraph({ heading:HeadingLevel.HEADING_2, children:[new TextRun(`${m.id} — ${m.name}${wwLabel}`)] }));
  body.push(portalTable(m.portals));
  body.push(new Paragraph({ children:[new TextRun('')] }));
}

// PART 4 — audit
body.push(new Paragraph({ children:[new PageBreak()] }));
body.push(new Paragraph({ heading:HeadingLevel.HEADING_1, children:[new TextRun('Part 4 — Audit: declared in code, missing from disk')] }));
body.push(new Paragraph({ children:[new TextRun({ text:`Scanned mojiworld_game.html for every quoted asset path (Sprites/*, backgrounds/*, audio/*) plus the LX_FX and LX_MOB_PROJ_SPRITES registries. Of ${declared.size} unique paths declared in code, ${declared.size - missing.length} exist on disk and ${missing.length} are missing. These either silently degrade (LX_FX uses procedural fallbacks) or no-op (UI SFX, monster hit audio).`, size:20 })] }));

for (const [c, paths] of Object.entries(byCat)) {
  body.push(new Paragraph({ heading:HeadingLevel.HEADING_2, children:[new TextRun(`${c} (${paths.length})`)] }));
  body.push(auditTable(paths));
  body.push(new Paragraph({ children:[new TextRun('')] }));
}

body.push(new Paragraph({ heading:HeadingLevel.HEADING_2, children:[new TextRun('Audit notes')] }));
const notes = [
  'Sprites/fx/*.webp paths are the v2 successors to the .png variants already on disk. Engine falls back to the .png procedurally, so the .webp versions are nice-to-have, not blockers.',
  'audio/boss/boss_zodiac_*.mp3 — all 12 zodiac sign stingers pre-staged but unauthored. Boss intros are silent for those fights.',
  'audio/monster/mob_*.mp3 — six creature-class hit/die layers (fairy/fish/goblin/golem/insect/mechanical) declared. Mob hit feedback falls through to the WebAudio synth in their absence.',
  'Sprites/character/* — clothing layer slots authored ahead of the gear-skin system. Player still renders correctly via the procedural body.',
  'Sprites/projectiles/cast/*.webp — telegraph poses for caster mobs. Not wired in current animation pipeline.',
];
for (const n of notes) {
  body.push(new Paragraph({ children:[new TextRun({ text:'• ' + n, size:20 })] }));
}

// ---------- write doc ----------
const doc = new Document({
  styles, numbering,
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    children: body,
  }],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync('MOJIWORLD_SPRITE_PRODUCTION_LIST.docx', buf);
  console.log('✓ Wrote MOJIWORLD_SPRITE_PRODUCTION_LIST.docx  (' + buf.length + ' bytes)');
  console.log('  Missing-asset audit summary:');
  for (const [c, paths] of Object.entries(byCat)) {
    console.log(`    ${c}: ${paths.length}`);
  }
});
