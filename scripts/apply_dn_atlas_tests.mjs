// dn-atlas: three existing tests learn that a damage figure may blit glyph cells (a 9-argument drawImage) where it
// used to stroke live text or blit one bitmap. Run by the ship chain AFTER the files are re-synced from origin, so the
// edits land on origin's copies. Idempotent; exact-count anchors; LF/CRLF preserved.
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const DIR = path.dirname(fileURLToPath(import.meta.url));
const abort = (m) => { console.error('ABORT ' + m); process.exit(1); };
const patch = (name, edits) => {
  const F = path.join(DIR, name); const raw = readFileSync(F, 'utf8'); const crlf = raw.includes('\r\n'); let s = raw.replace(/\r\n/g, '\n');
  if (s.includes('dn-atlas')) { console.log(name + ': already applied'); return; }
  for (const [label, a, b] of edits) { const c = s.split(a).length - 1; if (c !== 1) abort(`${name} / ${label}: matched ${c}, expected 1`); s = s.replace(a, b); }
  writeFileSync(F + '.tmp', crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8'); renameSync(F + '.tmp', F); console.log(name + ': patched (' + edits.length + ' edits)');
};

patch('grav_smooth_test.mjs', [
  ['warm fade draw',
    "    game.damageNumbers = [fading];\n    out.fade = count(() => drawDamageNumbers());",
    "    game.damageNumbers = [fading];\n    drawDamageNumbers();   // (dn-atlas: the first fading figure of a size builds its glyph atlas - text, once. Count the warm draw.)\n    out.fade = count(() => drawDamageNumbers());"],
  ['live pop with the atlas held off',
    "    game.damageNumbers = [popping];\n    out.pop = count(() => drawDamageNumbers());",
    "    game.damageNumbers = [popping];\n    // (dn-atlas, later build: in a boss scene the pop blits glyphs. This check is about the LIVE path, so the atlas is held off for it;\n    //  scripts/dn_atlas_pop_test.mjs covers the atlas.)\n    const _atWas = (typeof _LX_DN_ATLAS_ON !== 'undefined') ? _LX_DN_ATLAS_ON : null; if (_atWas !== null) _LX_DN_ATLAS_ON = false;\n    out.pop = count(() => drawDamageNumbers());\n    if (_atWas !== null) _LX_DN_ATLAS_ON = _atWas;"],
  ['fade accepts glyph blits',
    "    U.fade.drawImage === 1 && U.fade.fillText === 0 && U.fade.strokeText === 0 && U.pop.strokeText >= 2 && U.pop.fillText >= 1,",
    "    U.fade.drawImage >= 1 && U.fade.fillText === 0 && U.fade.strokeText === 0 && U.pop.strokeText >= 2 && U.pop.fillText >= 1,   // (dn-atlas: a fading FIGURE blits glyph cells now - several blits, still no text)"],
]);

patch('dmgnum_outline_test.mjs', [
  ['9-arg blit',
    "      else if (a.length === 4) { rec.devX = +(t.a * a[0] + t.e).toFixed(4); rec.devY = +(t.d * a[1] + t.f).toFixed(4); rec.devW = +(t.a * a[2]).toFixed(4); rec.devH = +(t.d * a[3]).toFixed(4); }",
    "      else if (a.length === 4) { rec.devX = +(t.a * a[0] + t.e).toFixed(4); rec.devY = +(t.d * a[1] + t.f).toFixed(4); rec.devW = +(t.a * a[2]).toFixed(4); rec.devH = +(t.d * a[3]).toFixed(4); }\n      else if (a.length === 8) { rec.atlas = true; rec.rasterW = a[2]; rec.rasterH = a[3]; rec.devX = +(t.a * a[4] + t.e).toFixed(4); rec.devY = +(t.d * a[5] + t.f).toFixed(4); rec.devW = +(t.a * a[6]).toFixed(4); rec.devH = +(t.d * a[7]).toFixed(4); }   // dn-atlas: a glyph cell, source rect = the raster"],
  ['outline from every context',
    "  ctx.strokeText = function (txt, x, y) {\n    if (String(this.strokeStyle) === '#000000') strokes.push(+(this.lineWidth * this.getTransform().a).toFixed(3));\n    return _st.apply(this, arguments);\n  };",
    "  // dn-atlas: the pop and the fade may blit glyphs instead of stroking live, so the black outline is read wherever it is\n  // actually stroked - the live path on the main context, the settled bake and the atlas build on their own canvases.\n  const _P = CanvasRenderingContext2D.prototype, _pst = _P.strokeText;\n  _P.strokeText = function (txt, x, y) {\n    if (String(this.strokeStyle) === '#000000') strokes.push(+(this.lineWidth * this.getTransform().a).toFixed(3));\n    return _pst.apply(this, arguments);\n  };"],
  ['restore', "  ctx.drawImage = _di; ctx.strokeText = _st;", "  ctx.drawImage = _di; _P.strokeText = _pst;"],
]);

patch('damage_number_outline_test.mjs', [
  ['9-arg blit',
    "          baked.push(5 * (arguments[3] / bakedCssW) * Math.abs(m.a));\n        }",
    "          baked.push(5 * (arguments[3] / bakedCssW) * Math.abs(m.a));\n        }\n        if (arguments.length === 9 && img && img.tagName === 'CANVAS') {   // dn-atlas: a glyph cell, baked at the render scale with a 5 px outline\n          baked.push(5 * dpr * (arguments[7] / arguments[3]) * Math.abs(m.a));\n        }"],
]);
