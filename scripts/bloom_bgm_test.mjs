// Per user: the Bloom Reaches maps play bgm_bloom.mp3 again. v0.29.634 had
// moved them onto bgm_bone_graveyard.mp3 to share a track with the graveyard
// chain; only Bloom is reverted, the graveyard keeps its own.
//
// Resolves each map through the game's own lookup and FETCHES the resulting
// URL, because a BGM table is exactly the kind of thing that can name a file
// that is not shipped â€” the table entry looks right and the map plays silence.
//   node scripts/bloom_bgm_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

ok('audio/bgm_bloom.mp3 is on disk', existsSync('audio/bgm_bloom.mp3'), {});
ok('audio/bgm_bone_graveyard.mp3 is still on disk', existsSync('audio/bgm_bone_graveyard.mp3'), {});

const net = await import('node:net');
const free = (p) => new Promise((r) => { const s = net.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext()).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof MAPS === 'object', { timeout: 120000 });

const BLOOM = ['verdantHollow', 'bloomhaven', 'thornspireThicket', 'gloomsporeVerge', 'verdantHaven'];
const BONE = ['boneGraveyard', 'boneGraveyard2', 'boneGraveyard3'];

const r = await page.evaluate(({ BLOOM, BONE }) => {
  // _BGM_MAP_FILES is a top-level `const`, which in this file is a LEXICAL
  // binding and therefore NOT a property of `window` — scanning Object.keys
  // (window) finds nothing. Reference it by bare identifier instead.
  let table = null;
  try { table = _BGM_MAP_FILES; } catch (e) {}
  const out = { found: !!table, bloom: {}, bone: {}, jukebox: null };
  if (table) {
    for (const m of BLOOM) out.bloom[m] = table[m] || null;
    for (const m of BONE) out.bone[m] = table[m] || null;
  }
  try {
    // JUKEBOX_TRACKS is grouped: [{ tracks: [...] }], so the entry is one level
    // deeper than a flat find would reach.
    const jb = (typeof JUKEBOX_TRACKS !== 'undefined' && JUKEBOX_TRACKS) || null;
    if (jb) {
      for (const grp of jb) {
        const list = (grp && grp.tracks) ? grp.tracks : (Array.isArray(grp) ? grp : [grp]);
        const t = (list || []).find(x => x && x.id === 'bloomReaches');
        if (t) { out.jukebox = t.file; break; }
      }
    }
  } catch (e) {}
  return out;
}, { BLOOM, BONE });

// Fetch each distinct URL â€” a table can name a file that is not shipped.
const urls = [...new Set([...Object.values(r.bloom || {}), ...Object.values(r.bone || {})].filter(Boolean))];
const status = {};
for (const u of urls) {
  const res = await page.evaluate(async (u2) => {
    try { const q = await fetch(u2, { method: 'GET' }); return q.status; } catch (e) { return -1; }
  }, u);
  status[u] = res;
}
await b.close(); try { srv.kill(); } catch (e) {}

console.log('bloom  ->', JSON.stringify(r.bloom));
console.log('bone   ->', JSON.stringify(r.bone));
console.log('jukebox->', r.jukebox);
console.log('fetch  ->', JSON.stringify(status));

ok('the per-map BGM table was found', r.found === true, {});
ok('all five Bloom Reaches maps play bgm_bloom.mp3',
   BLOOM.every(m => r.bloom[m] === 'audio/bgm_bloom.mp3'), r.bloom);
ok('no Bloom map is still on the graveyard track',
   BLOOM.every(m => !/bone_graveyard/.test(r.bloom[m] || '')), r.bloom);
ok('Bone Graveyard keeps its own theme (only Bloom was reverted)',
   BONE.every(m => r.bone[m] === 'audio/bgm_bone_graveyard.mp3'), r.bone);
ok('the jukebox Bloom Reaches entry points at bgm_bloom.mp3', r.jukebox === 'audio/bgm_bloom.mp3', { jukebox: r.jukebox });
ok('every referenced track actually downloads (no silent map)',
   urls.length > 0 && urls.every(u => status[u] === 200), status);
ok('the two chains are on DIFFERENT tracks', r.bloom.verdantHollow !== r.bone.boneGraveyard,
   { bloom: r.bloom.verdantHollow, bone: r.bone.boneGraveyard });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);

