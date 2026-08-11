// BONE GRAVEYARD + BLOOM REACHES BGM - right track, right maps, actually served.
// =============================================================================
//   1. TAGS     the mp3 carries the repo's DADPEH authorship convention
//   2. AUDIO    still a valid MPEG stream (retagging touched no audio)
//   3. MAPPING  all 3 bone + all 5 bloom maps resolve to the new track
//   4. SCOPE    ossuarySprawl (a look-alike) stays on the sepulchre theme
//   5. SERVED   the browser can fetch it, at the expected size
// Run: node scripts/bone_bloom_bgm_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const MP3 = 'audio/bgm_bone_graveyard.mp3';
const BONE = ['boneGraveyard', 'boneGraveyard2', 'boneGraveyard3'];
const BLOOM = ['verdantHollow', 'bloomhaven', 'thornspireThicket', 'gloomsporeVerge', 'verdantHaven'];

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });

const abs = path.join(ROOT, MP3);
ok('the track exists on disk', fs.existsSync(abs));
const buf = fs.existsSync(abs) ? fs.readFileSync(abs) : Buffer.alloc(0);
let audioStart = 0, frames = 0, tags = {};
if (buf.length > 10 && buf.subarray(0, 3).toString('latin1') === 'ID3') {
  const sz = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
  audioStart = 10 + sz + ((buf[3] >= 4 && (buf[5] & 0x10)) ? 10 : 0);
  let p = 10;
  while (p + 10 <= 10 + sz) {
    const id = buf.subarray(p, p + 4).toString('latin1');
    if (!/^[A-Z0-9]{4}$/.test(id)) break;
    const fsz = buf[3] >= 4
      ? ((buf[p+4] & 0x7f) << 21) | ((buf[p+5] & 0x7f) << 14) | ((buf[p+6] & 0x7f) << 7) | (buf[p+7] & 0x7f)
      : buf.readUInt32BE(p + 4);
    tags[id] = buf.subarray(p + 11, p + 10 + fsz).toString('latin1').replace(/\0/g, ' ').trim();
    p += 10 + fsz;
  }
}
ok('authorship is credited to DADPEH', tags.TPE1 === 'DADPEH', `TPE1 "${tags.TPE1 || ''}"`);
ok('copyright is credited to DADPEH', tags.TCOP === 'DADPEH', `TCOP "${tags.TCOP || ''}"`);
ok('the house "made by DADPEH" comment is present',
   (tags.TXXX || '').includes('made by DADPEH'), `TXXX "${tags.TXXX || ''}"`);
ok('no third-party generator metadata is left behind',
   !/suno/i.test(buf.subarray(0, Math.max(audioStart, 0)).toString('latin1')) && !tags.APIC,
   `tag is ${audioStart} bytes`);
{
  const RATES = [0,32,40,48,56,64,80,96,112,128,160,192,224,256,320,0];
  const SR = [44100, 48000, 32000, 0];
  let p = audioStart;
  while (p + 4 < buf.length && frames < 400) {
    if (buf[p] !== 0xff || (buf[p + 1] & 0xe0) !== 0xe0) break;
    const br = RATES[(buf[p + 2] >> 4) & 0x0f] * 1000;
    const sr = SR[(buf[p + 2] >> 2) & 0x03];
    const pad = (buf[p + 2] >> 1) & 1;
    if (!br || !sr) break;
    frames++;
    p += Math.floor(144 * br / sr) + pad;
  }
}
ok('the audio stream still decodes as MPEG frames', frames >= 200, `${frames} frames from offset ${audioStart}`);

const PORT = 9122;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(10000);

const live = await page.evaluate(async ([MP3, BONE, BLOOM]) => {
  const out = [];
  const ok = (n, c, extra) => out.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });
  const show = (ids) => ids.map(i => `${i}=${(_BGM_MAP_FILES[i] || 'DEFAULT').split('/').pop()}`).join('  ');
  ok('all three Bone Graveyard maps play the new track',
     BONE.every(i => _BGM_MAP_FILES[i] === MP3), show(BONE));
  ok('all five Bloom Reaches maps play the new track',
     BLOOM.every(i => _BGM_MAP_FILES[i] === MP3), show(BLOOM));
  ok('every one of those maps really exists', [...BONE, ...BLOOM].every(i => !!MAPS[i]),
     [...BONE, ...BLOOM].filter(i => !MAPS[i]).join(',') || 'all present');
  // The retired track must not be left anywhere, or a map/jukebox entry would
  // still play music no region uses.
  const stale = Object.entries(_BGM_MAP_FILES).filter(([, v]) => /bgm_bloom\.mp3$/.test(v)).map(([k]) => k);
  ok('no map is left on the retired bloom track', stale.length === 0, stale.join(',') || 'none');
  const jb = (typeof JUKEBOX_TRACKS !== 'undefined' ? JUKEBOX_TRACKS : [])
    .flatMap(g => g.tracks || []).filter(t => /bgm_bloom\.mp3$/.test(t.file || ''));
  ok('the jukebox no longer advertises the retired track', jb.length === 0, jb.map(t => t.id).join(',') || 'none');
  // Scope guard: the look-alike stays put.
  ok('ossuarySprawl (a look-alike) keeps the sepulchre theme',
     /bgm_hollow_sepulchre\.mp3$/.test(_BGM_MAP_FILES.ossuarySprawl || ''),
     (_BGM_MAP_FILES.ossuarySprawl || 'none').split('/').pop());
  // One shared URL across all 8 => one element => no restart walking the region.
  const els = [...BONE, ...BLOOM].map(i => (typeof _bgmMapEl === 'function' ? _bgmMapEl(i) : null));
  ok('all eight maps share one audio element (no restart between them)',
     els[0] && els.every(e => e === els[0]), `distinct elements: ${new Set(els).size}`);
  let status = 0, len = 0;
  try { const r = await fetch(MP3); status = r.status; len = (await r.arrayBuffer()).byteLength; } catch (e) {}
  ok('the browser can fetch the track', status === 200 && len > 1000000, `HTTP ${status}, ${len} bytes`);
  return out;
}, [MP3, BONE, BLOOM]);

for (const r of live) res.push(r);
let pass = 0, failed = 0;
for (const r of res) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
console.log(`${pass} passed, ${failed} failed`);
console.log('pageerrors:', errs.length, errs.slice(0, 5));
await browser.close(); server.kill();
process.exit(failed || errs.length ? 1 : 0);
