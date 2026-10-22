// Themed ceiling-hazard art (hazard themed art, 2026-10-22).
// ============================================================================
// Per user ("Give them matching art": keep the hazards, change only how they look). A map's `ceilingHazards` entry becomes a
// `meteor_warn` hazard in updateMapEvents, and the meteor_warn draw always paints the shared red molten meteor, whatever the
// entry's colour or name. So the Bone Graveyards and the Hollow Sepulchre rained fireballs where their tables say rib-cages and
// rib-bones, the Ossuary Sprawl's "bone avalanche" was a fireball, and the Wayfarer's Gate "ember shower" was the same big meteor.
// Fix: a ceilingHazards entry may name its look with `art:` ('skull' | 'ribbone' | 'bonechunk' | 'ember'); the hazard carries it
// as `_art`, and the meteor_warn draw paints that sprite (ludo.ai art, Sprites/projectiles/p_hz_<art>.webp) in place of the meteor,
// inside the same falling hitbox (_lxMeteorGeom); the bone looks also swap the fiery ground rune for a bone rune of the same size,
// place and pulse (per user: "change the marker at the bottom for the bones"). Timing, damage, hitbox and sounds are untouched. Bones land in
// a puff of bone dust instead of the fire blast (embers keep the fire). No `art:` key = the red meteor, as before: lava and forge
// maps and every other meteor_warn user are unchanged. Co-op guests get the key with the hazard mirror.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('hazard-themed-art')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const cnt = (a) => s.split(a).length - 1;
const once = (anchor, repl, what) => { const c = cnt(anchor); if (c !== 1) die(what + ': anchor matched ' + c); s = s.replace(anchor, () => repl); };
const TAG = 'v0.30.1866 hazard-themed-art';

// 1) the map tables: one `art:` key per themed entry, added after the line that holds its colour
const MAPS = [
  ["damage: 70, radius: 130, color: '#d8d4c8',", 'skull', 'boneGraveyard'],
  ["damage: 95, radius: 140, color: '#c8c0b0',", 'skull', 'boneGraveyard2'],
  ["damage: 115, radius: 150, color: '#b8a898',", 'skull', 'boneGraveyard3'],
  ["color: '#aaccff', label: 'a falling rib-bone',", 'ribbone', 'hollowSepulchre'],
  ["damage: 110, radius: 175, color: '#e8e0c8',", 'bonechunk', 'ossuarySprawl'],
  ["color: '#ffaa44', label: 'an ember shower',", 'ember', 'wayfarersLantern2'],
];
for (const [a, art, id] of MAPS) {
  if (cnt(a) !== 1) die(id + ' colour line matched ' + cnt(a));
  const i = s.indexOf(a), ls = s.lastIndexOf(EOL, i) + EOL.length, le = s.indexOf(EOL, i);
  const ind = s.slice(ls, i).match(/^ */)[0];
  s = s.slice(0, le) + EOL + ind + "art: '" + art + "',   // " + TAG + ' - falls as this sprite, not the red meteor' + s.slice(le);
}

// 2) updateMapEvents: the hazard carries the entry's look, and the map asks for its sprite on entry (the art is lazy)
once("        _sourceLabel: cfg.label || 'a lava eruption',             // v0.25.841 \u2014 themable",
  J("        _sourceLabel: cfg.label || 'a lava eruption',             // v0.25.841 \u2014 themable",
    "        _art: (cfg.art && cfg.art !== 'marker' && LX_HZ_ART[cfg.art]) ? cfg.art : undefined,   // " + TAG + " - the sprite it falls as (none = the red meteor)"),
  'spawn push');
once('      game._lavaEruptCD = cfg.minDelayMs;',
  J('      game._lavaEruptCD = cfg.minDelayMs;',
    '      if (cfg.art && LX_HZ_ART[cfg.art]) { _lxPlayerProjReady(LX_HZ_ART[cfg.art]); if (cfg.art === \'bonechunk\') _lxPlayerProjReady(LX_HZ_ART.ribbone); if (cfg.art !== \'ember\') _lxPlayerProjReady(LX_HZ_ART.marker); }   //' + TAG + ' - ask for the lazy art on map entry'),
  'map-entry art request');

// 3) the sprites + their draw and landing puff, beside the projectile registry they share the lazy loader with
once('function _lxPlayerProjReady(img) {', J(
  '// ' + TAG + ' - THEMED CEILING HAZARDS. A ceilingHazards entry with `art:` falls as its own sprite instead of the red meteor,',
  '// drawn inside the meteor\'s own falling hitbox (_lxMeteorGeom: same band, same timing), so only the picture changes.',
  'const LX_HZ_ART = (() => {',
  '  const out = {};',
  "  const files = { skull: 'projectiles/p_hz_skull', ribbone: 'projectiles/p_hz_ribbone', bonechunk: 'projectiles/p_hz_bonechunk', ember: 'projectiles/p_hz_ember', marker: 'fx/meteor_marker_bone' };",
  '  for (const k in files) {',
  "    const img = new Image(); img.decoding = 'async';",
  "    _lxFxMark(img, 'Sprites/' + files[k] + '.webp');   // " + TAG + ' - parked until the map asks',
  "    img.src = 'Sprites/' + files[k] + '.webp';",
  '    if (img.decode) img.decode().catch(() => {});',
  '    out[k] = img;',
  '  }',
  '  return out;',
  '})();',
  '// ' + TAG + ' - paints h._art in the meteor\'s place; true = drawn (the caller skips the meteor). Unknown key = false = meteor.',
  'function _lxHzArtDraw(h, sx, camY) {',
  "  const img = (h._art !== 'marker') ? LX_HZ_ART[h._art] : null;",
  '  if (!img) return false;',
  '  const g = _lxMeteorGeom(h, camY), t = (game.time | 0) + ((h.cx | 0) % 97), sz = g.sz;',
  '  const blit = (im, x, y, s, rot, a) => {',
  '    const d = _lxProjScaled(im, Math.round(s));',
  '    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); if (rot) ctx.rotate(rot);',
  '    ctx.drawImage(d, -s / 2, -s / 2, s, s); ctx.restore();',
  '  };',
  '  if (!_lxPlayerProjReady(img)) {   // ' + TAG + ' - still decoding: a plain stand-in in the entry colour, never the red meteor',
  "    ctx.fillStyle = h.color || '#ddd4c0'; ctx.strokeStyle = '#2a2018'; ctx.lineWidth = 3;",
  '    ctx.beginPath(); ctx.ellipse(sx, g.hitY + g.hitR * 0.3, sz * 0.14, sz * 0.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();',
  '    return true;',
  '  }',
  "  if (h._art === 'ember') {   // a small glowing cluster, flickering, with a fading streak above it",
  '    const s = sz * 0.5, y = g.hitY + g.hitR * 0.3, fl = 0.85 + 0.15 * Math.sin(t * 0.7);',
  "    ctx.save(); ctx.globalCompositeOperation = 'lighter';",
  '    for (let i = 3; i >= 1; i--) blit(img, sx + Math.sin(t * 0.3 + i) * 4, y - i * s * 0.32, s * (1 - i * 0.16), 0, 0.32 - i * 0.08);',
  '    ctx.restore();',
  '    blit(img, sx, y, s, 0, fl);',
  '    return true;',
  '  }',
  "  if (h._art === 'ribbone') {   // one long bone, rocking as it falls, two ghost copies above",
  '    const s = sz * 0.62, y = g.hitY + g.hitR * 0.15, r = Math.sin(t * 0.15) * 0.45;',
  '    for (let i = 2; i >= 1; i--) blit(img, sx, y - i * sz * 0.17, s, Math.sin((t - i * 3) * 0.15) * 0.45, 0.3 - i * 0.1);',
  '    blit(img, sx, y, s, r, 1);',
  '    return true;',
  '  }',
  "  if (h._art === 'skull') {   // a cute little skull, wobbling as it falls, two ghost copies above",
  '    const s = sz * 0.42, y = g.hitY + g.hitR * 0.3;',
  '    for (let i = 2; i >= 1; i--) blit(img, sx, y - i * sz * 0.15, s * (1 - i * 0.08), Math.sin((t - i * 3) * 0.2) * 0.4, 0.3 - i * 0.1);',
  '    blit(img, sx, y, s, Math.sin(t * 0.2) * 0.4, 1);',
  '    return true;',
  '  }',
  '  // bonechunk: a tumbling chunk with loose bones thrown round it (the avalanche)',
  '  const s = sz * 0.5, y = g.hitY + g.hitR * 0.3, spin = -t * 0.07;',
  '  blit(img, sx, y - sz * 0.2, s * 0.9, spin - 0.2, 0.22);',
  "  if (h._art === 'bonechunk' && _lxPlayerProjReady(LX_HZ_ART.ribbone)) {",
  '    for (let i = 0; i < 3; i++) blit(LX_HZ_ART.ribbone, sx + (i - 1) * s * 0.36, y - s * (0.55 + 0.25 * (i % 2)), s * 0.5, t * 0.11 * (i % 2 ? 1 : -1) + i, 0.95);',
  '  }',
  '  blit(img, sx, y, s, spin, 1);',
  '  return true;',
  '}',
  '// ' + TAG + ' - bones land in a puff of bone dust instead of the fire blast. true = handled; embers return false and keep the fire.',
  'function _lxHzArtImpact(h, cx, camY, radius) {',
  "  if (!h || !LX_HZ_ART[h._art] || h._art === 'ember' || h._art === 'marker') return false;",
  "  spawnSmoothExplosion(cx, camY + 460, radius * 0.8, '#f6eedc', '#8a7d6488', { life: 30 });",
  "  spawnSmoothImpact(cx, camY + 440, '#e8dcc0');",
  "  const cols = ['#efe6d0', '#d6cbb2', '#b3a88f', '#8f846d'];",
  '  for (let j = 0; j < 15; j++) {',
  '    game.particles.push({ x: cx + (Math.random() - 0.5) * radius * 2, y: camY + 410 + Math.random() * 60,',
  '      vx: (Math.random() - 0.5) * 8, vy: -Math.random() * 7, life: 44, color: cols[j % 4], size: 3 + Math.random() * 4 });',
  '  }',
  '  return true;',
  '}',
  'function _lxPlayerProjReady(img) {'), 'registry + draw helpers');

// 4) the meteor_warn draw: a themed hazard paints its sprite and skips the meteor
once('      if (h._markerOnly || h._aquaFlood) continue;   // v0.26.1029 \u2014 Aqua flood draws only its ground rune, not a falling meteor',
  J('      if (h._markerOnly || h._aquaFlood) continue;   // v0.26.1029 \u2014 Aqua flood draws only its ground rune, not a falling meteor',
    '      if (h._art && _lxHzArtDraw(h, sx, _camY)) continue;   // ' + TAG + ' - a themed ceiling hazard falls as its own sprite'),
  'meteor draw');

// 4b) the ground rune: bone looks draw the bone rune in the fiery rune's place (same rect, same pulse); embers and every other user keep theirs
once('      const _markerSprite = h._gravBlue',
  "      const _markerSprite = (h._art && h._art !== 'ember' && LX_HZ_ART.marker) ? LX_HZ_ART.marker   // " + TAG + ' - the bone rune (same size, place and pulse)' + EOL +
  '        : h._gravBlue',
  'ground rune');

// 5) the landing: bone dust in place of the fire blast (the shake, flash, hit-stop and damage above it are untouched)
once("      } else if (h._spore && typeof _lxSporeBurst === 'function') {",
  J("      } else if (h._art && _lxHzArtImpact(h, _cx, _impactCamY, radius)) {",
    '        // ' + TAG + ' - bone dust, drawn by _lxHzArtImpact',
    "      } else if (h._spore && typeof _lxSporeBurst === 'function') {"),
  'impact');

// 6) co-op: the hazard mirror carries the look to guests
once('      mk: h._markerOnly ? 1 : (h._spore ? 2 : 0), sk: h._skin || undefined,',
  '      mk: h._markerOnly ? 1 : (h._spore ? 2 : 0), sk: h._skin || undefined, ar: h._art || undefined /* ' + TAG + ' */,',
  'coop list');
once('    if (e.sk) h._skin = String(e.sk).slice(0, 8);',
  J('    if (e.sk) h._skin = String(e.sk).slice(0, 8);',
    "    if (e.ar && LX_HZ_ART[e.ar]) h._art = e.ar;   // " + TAG + ' - a known look only'),
  'coop apply');

const marks = cnt('hazard-themed-art');
if (marks !== 18) die('marker count ' + marks);
const grew = s.length - n0;
if (grew < 5000 || grew > 7500) die('size moved ' + grew);
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 5000000) die('tmp small');
{
  let done = false, lastErr = null;
  for (let a = 1; a <= 8 && !done; a++) {
    try { renameSync(F + '.tmp', F); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!done) die('rename kept failing: ' + lastErr.code);
}
console.log('applied: hazard-themed-art (+' + grew + ' chars, ' + marks + ' marks)');
