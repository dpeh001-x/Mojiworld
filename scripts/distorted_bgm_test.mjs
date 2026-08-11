// DISTORTED PORTAL BGM - the right track, on all three maps, actually served.
// =============================================================================
//   1. TAGS     the mp3 on disk carries the repo's DADPEH authorship convention
//   2. AUDIO    it is still a valid MPEG stream (retagging touched no audio)
//   3. MAPPING  all three distorted maps resolve to the new track in-game
//   4. SERVED   the browser can actually fetch it, at the expected size
// Run: node scripts/distorted_bgm_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const MP3 = 'audio/bgm_distorted_portal.mp3';
const MAPS3 = ['distortedThreshold', 'fracturedReflection', 'confusedVigil'];

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });

// ── 1 + 2. the file itself ───────────────────────────────────────────────────
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
// Walk MPEG frame headers to prove the audio survived retagging.
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
ok('the audio stream still decodes as MPEG frames', frames >= 200, `${frames} frames walked from offset ${audioStart}`);

// ── 3 + 4. in the running game ───────────────────────────────────────────────
const PORT = 9120;
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

const live = await page.evaluate(async ([MP3, MAPS3]) => {
  const out = [];
  const ok = (n, c, extra) => out.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });
  const got = MAPS3.map(id => [id, _BGM_MAP_FILES[id]]);
  ok('all three distorted maps map to the new track',
     got.every(g => g[1] === MP3), got.map(g => `${g[0]}=${g[1] || 'DEFAULT'}`).join('  '));
  // One shared URL means one shared element — no restart when walking the chain.
  const els = MAPS3.map(id => (typeof _bgmMapEl === 'function' ? _bgmMapEl(id) : null));
  ok('the three maps share one audio element (no restart between them)',
     els[0] && els[0] === els[1] && els[1] === els[2], `distinct elements: ${new Set(els).size}`);
  ok('the element points at the new track',
     !!els[0] && String(els[0].src).includes('bgm_distorted_portal.mp3'), els[0] ? String(els[0].src).split('/').pop() : 'none');
  // The Confused Vigil is a boss arena; the per-map entry must win over the
  // generic boss fallback, or it would still play bgm_boss.mp3.
  ok('the boss-arena map is not left on the generic boss theme',
     _BGM_MAP_FILES.confusedVigil === MP3 && MAPS.confusedVigil && MAPS.confusedVigil.isBossArena === true,
     `isBossArena=${MAPS.confusedVigil && MAPS.confusedVigil.isBossArena}`);
  // Actually fetch it, so a missing/misnamed file cannot pass.
  let status = 0, len = 0;
  try { const r = await fetch(MP3); status = r.status; len = (await r.arrayBuffer()).byteLength; } catch (e) {}
  ok('the browser can fetch the track', status === 200 && len > 1000000, `HTTP ${status}, ${len} bytes`);
  return out;
}, [MP3, MAPS3]);

for (const r of live) res.push(r);
let pass = 0, failed = 0;
for (const r of res) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
console.log(`${pass} passed, ${failed} failed`);
console.log('pageerrors:', errs.length, errs.slice(0, 5));
await browser.close(); server.kill();
process.exit(failed || errs.length ? 1 : 0);
