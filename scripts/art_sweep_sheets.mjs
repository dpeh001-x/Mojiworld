// Contact sheets for flagged sets/files: each row = one set, every frame at full canvas scaled to 120 px with its ink box drawn,
// so size pulse, foot-line drift, centre jumps and cutoffs are visible at a glance.
//   node scripts/art_sweep_sheets.mjs <artdir> <kind> [max]   -> <artdir>/sheet_<kind>.png
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url)).split('\\').join('/').replace(/\/+$/, ''); const A = process.argv[2], KIND = process.argv[3], MAX = +(process.argv[4] || 10);
const M = JSON.parse(readFileSync(A + '/metrics.json', 'utf8')); const byP = new Map(M.map((m) => [m.p, m]));
const ALL = JSON.parse(readFileSync(A + '/flagged.json', 'utf8')).flags.filter((f) => f.kind === KIND);
// one row per SET: set-level flags as they are; file-level flags grouped by their set stem with the flagged frames marked
const rowsSpec = new Map();
for (const f of ALL) {
  const mm = f.p.match(/^(.*)\/([^/]+?)_(\d+)\.(webp|png)$/);
  const key = mm ? mm[1] + '/' + mm[2] : f.p;
  if (!rowsSpec.has(key)) rowsSpec.set(key, { key, why: f.why, marked: new Set(), n: 0 });
  const r = rowsSpec.get(key); r.n++; if (mm) r.marked.add(+mm[3]);
}
const specs = [...rowsSpec.values()].sort((a, b) => b.n - a.n).slice(0, MAX);
const H = 120, PAD = 6, LABEL = 150;
const rows = [];
for (const r of specs) {
  let frames;
  if (!/\.(webp|png)$/.test(r.key)) {
    const dir = r.key.replace(/\/[^/]+$/, ''), name = r.key.split('/').pop();
    frames = M.filter((m) => m.p.startsWith(dir + '/' + name + '_') && /^\d+\.(webp|png)$/.test(m.p.slice(dir.length + 1 + name.length + 1))).sort((a, b) => +a.p.match(/_(\d+)\./)[1] - +b.p.match(/_(\d+)\./)[1]);
  } else frames = [byP.get(r.key)].filter(Boolean);
  if (!frames.length) continue;
  const tiles = [];
  for (const m of frames) {
    if (m.err || !m.w) continue;
    const s = H / m.h, w = Math.max(1, Math.round(m.w * s));
    const buf = await sharp(ROOT + '/' + m.p).resize({ height: H }).flatten({ background: '#2b2b2b' }).png().toBuffer();
    const [x0, y0, x1, y1] = m.bb || [0, 0, 0, 0]; const bx = Math.round(x0 * s), by = Math.round(y0 * s), bw = Math.max(1, Math.round((x1 - x0 + 1) * s)), bh = Math.max(1, Math.round((y1 - y0 + 1) * s));
    const idx = (m.p.match(/_(\d+)\.(webp|png)$/) || [])[1] ?? ''; const hot = idx !== '' && r.marked.has(+idx);
    const svg = Buffer.from(`<svg width="${w}" height="${H}"><rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="none" stroke="#ff4d4d" stroke-width="1"/><rect x="0" y="0" width="${w}" height="${H}" fill="none" stroke="${hot ? '#ffcc00' : '#555'}" stroke-width="${hot ? 3 : 1}"/><text x="3" y="12" font-family="Segoe UI, Arial" font-size="11" fill="#ffe08a">${idx}</text></svg>`);
    tiles.push({ buf: await sharp(buf).composite([{ input: svg, left: 0, top: 0 }]).png().toBuffer(), w });
  }
  rows.push({ label: r.key.replace(/^Sprites\//, '') + (r.marked.size ? '  [' + r.n + ' frames]' : '') + '\n' + r.why.slice(0, 60), tiles });
}
const rowW = Math.max(...rows.map((r) => LABEL + r.tiles.reduce((a, t) => a + t.w + PAD, 0))) + PAD, rowH = H + PAD;
const comps = []; let y = PAD;
for (const r of rows) {
  const lab = Buffer.from(`<svg width="${LABEL}" height="${H}"><text x="4" y="14" font-family="Segoe UI, Arial" font-size="11" fill="#eee">${r.label.split('\n')[0].replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text><text x="4" y="30" font-family="Segoe UI, Arial" font-size="10" fill="#aaa">${r.label.split('\n')[1].replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`);
  comps.push({ input: lab, left: PAD, top: y }); let x = LABEL + PAD;
  for (const t of r.tiles) { comps.push({ input: t.buf, left: x, top: y }); x += t.w + PAD; }
  y += rowH;
}
const out = A + '/sheet_' + KIND + '.png';
await sharp({ create: { width: Math.min(rowW, 4000), height: y + PAD, channels: 4, background: '#1c1c1c' } }).composite(comps.filter((c) => c.left < 3900)).png().toFile(out);
console.log(out, rows.length, 'rows');
