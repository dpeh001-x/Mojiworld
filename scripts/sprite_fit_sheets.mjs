// Contact sheets (webp) for the sets the sprite fit audit flagged: one PNG per type with an
// idle / walk / attack strip, every frame drawn at the SAME frame scale (as the game
// draws them, scaled to the box), so a body that shrinks or grows between states or
// frames shows exactly as it would in play. Reads docs/reports/sprite_fit_audit.json.
//   node scripts/sprite_fit_sheets.mjs [--kinds state-size,foot-line,...] [--out dir]
import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const KINDS = (args.includes('--kinds') ? args[args.indexOf('--kinds') + 1] : 'state-size,foot-line,box-aspect,body-drift').split(',');
const OUT = args.includes('--out') ? args[args.indexOf('--out') + 1] : path.join(ROOT, 'docs', 'reports', 'sprite_fit');
const audit = JSON.parse(readFileSync(path.join(ROOT, 'docs', 'reports', 'sprite_fit_audit.json'), 'utf8'));
const idxSrc = readFileSync(path.join(ROOT, 'data', 'sprite_frame_index.js'), 'utf8');
const IDX = JSON.parse(idxSrc.slice(idxSrc.indexOf('{', idxSrc.indexOf('window.LX_SPRITE_FRAME_INDEX')), idxSrc.lastIndexOf('}') + 1));
const FH = 112, PAD = 6, LABEL = 22;
const wanted = new Map();   // family:key -> [details]
for (const f of audit.findings) { if (!KINDS.includes(f.kind)) continue; if (f.kind === 'body-drift' && f.state === 'attack') continue; const fam = f.dir.split('/')[0]; const id = fam + ':' + f.key; if (!wanted.has(id)) wanted.set(id, []); wanted.get(id).push(`${f.kind} (${f.state}): ${f.detail}`); }
mkdirSync(OUT, { recursive: true });
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const statesFor = (fam, key) => { const out = []; for (const dir of Object.keys(IDX.frames)) { if (!dir.startsWith(fam + '/') && dir !== fam) continue; if (!IDX.frames[dir][key]) continue; out.push({ dir, n: IDX.frames[dir][key], state: dir.split('/').slice(1).join('/') || 'idle' }); } return out.sort((a, b) => ['idle', 'walk', 'attack'].indexOf(a.state) - ['idle', 'walk', 'attack'].indexOf(b.state)); };
const index = [];
for (const [id, notes] of wanted) {
  const [fam, key] = id.split(':'); const states = statesFor(fam, key); if (!states.length) continue;
  const rows = [];
  for (const st of states) {
    const tiles = [];
    for (let i = 0; i < st.n; i++) { const f = path.join(ROOT, 'Sprites', st.dir, `${key}_${i}.webp`); if (!existsSync(f)) continue; const meta = await sharp(f).metadata(); const w = Math.round(FH * meta.width / meta.height); tiles.push({ f, w, h: FH }); }
    rows.push({ st, tiles, w: tiles.reduce((a, t) => a + t.w + PAD, PAD) });
  }
  const W = Math.max(640, ...rows.map((r) => r.w)); const H = rows.reduce((a) => a + LABEL + FH + PAD, 0) + LABEL * 2 + PAD;
  const comps = []; let y = LABEL * 2;
  const svgParts = [`<text x="8" y="17" font-family="Segoe UI, Arial" font-size="15" font-weight="700" fill="#ffe08a">${esc(fam + ' / ' + key)}</text>`, `<text x="8" y="36" font-family="Segoe UI, Arial" font-size="11" fill="#cfd8ff">${esc(notes[0].slice(0, 150))}</text>`];
  for (const r of rows) {
    svgParts.push(`<text x="8" y="${y + 15}" font-family="Segoe UI, Arial" font-size="12" fill="#9fe" >${esc(r.st.state)}  (${r.tiles.length} frames)</text>`);
    let x = PAD; const ty = y + LABEL;
    svgParts.push(`<line x1="0" y1="${ty + FH}" x2="${W}" y2="${ty + FH}" stroke="#5a5a7a" stroke-width="1"/>`);
    for (const [i, t] of r.tiles.entries()) { comps.push({ input: await sharp(t.f).resize(t.w, t.h, { fit: 'fill' }).png().toBuffer(), left: x, top: ty }); svgParts.push(`<text x="${x + 2}" y="${ty + FH - 3}" font-family="Arial" font-size="10" fill="#8890b0">${i}</text>`); x += t.w + PAD; }
    y += LABEL + FH + PAD;
  }
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${svgParts.join('')}</svg>`);
  const png = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 24, g: 22, b: 40, alpha: 1 } } }).composite([...comps, { input: svg, left: 0, top: 0 }]).webp({ quality: 82 }).toBuffer();
  const file = path.join(OUT, `${fam}_${key}.webp`); writeFileSync(file, png); index.push({ id, file: path.relative(ROOT, file), notes });
}
writeFileSync(path.join(OUT, 'index.html'), `<!doctype html><meta charset="utf-8"><title>sprite fit audit</title><body style="background:#14121f;color:#ddd;font-family:Segoe UI,Arial;padding:16px">` + index.map((e) => `<h3 style="margin:18px 0 4px">${esc(e.id)}</h3><ul style="margin:0 0 6px;font-size:12px;color:#bbb">${e.notes.map((n) => '<li>' + esc(n) + '</li>').join('')}</ul><img src="${path.basename(e.file)}" style="max-width:100%;border:1px solid #333">`).join('') + '</body>');
console.log(`wrote ${index.length} sheets to ${path.relative(ROOT, OUT)}`);
for (const e of index) console.log('  ' + e.file);
