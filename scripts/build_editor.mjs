// Injects scripts/map_data.json into tools/map_editor.html's <script id="MAP_DATA">
// placeholder. Atomic write (tmp → rename). Run after extract_map_data.mjs.
import { readFileSync, writeFileSync, renameSync } from 'fs';
const HTML = 'tools/map_editor.html';
const html = readFileSync(HTML, 'utf8');
let json = readFileSync('scripts/map_data.json', 'utf8').trim();
// Never let a string value break out of the <script> tag.
json = json.replace(/<\//g, '<\\/');
const re = /(<script type="application\/json" id="MAP_DATA">)[\s\S]*?(<\/script>)/;
if (!re.test(html)) { console.error('MAP_DATA placeholder not found'); process.exit(1); }
const out = html.replace(re, (_m, a, b) => a + json + b);
if (out.length < html.length) { console.error('refusing to shrink file'); process.exit(1); }
const tmp = HTML + '.tmp';
writeFileSync(tmp, out, 'utf8');
JSON.parse(json);   // sanity: baked JSON must parse
renameSync(tmp, HTML);
console.log('baked', json.length, 'bytes of map data → ' + HTML + ' (now ' + out.length + ' bytes)');
