// CO-OP PARTY BUFFS - do buff skills reach partners in the same room?
// =============================================================================
// Two halves:
//   A. STATIC AUDIT of the source. Sharing is opt-in at each grant site
//      (`player.buffs.X = ms` then a separate `_coopPartyBuff(...)` call), so a
//      new buff skill silently forgets to share and nothing complains. This
//      fails if ANY grant of a shareable buff has no broadcast beside it, and
//      is what found the Shadowlord's unshared Bloodlust.
//   B. LIVE checks of the send/receive semantics in the loaded game: whitelist,
//      same-room gate, live-peer gate, never-shorten, never-create-a-slot.
// Run: node scripts/coop_buff_share_test.mjs   (MOJI_GAME_FILE overrides target)
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });

// ── A. STATIC AUDIT ──────────────────────────────────────────────────────────
const src = fs.readFileSync(path.join(ROOT, FILE), 'utf8');
const lines = src.split('\n');
const wl = src.match(/_COOP_SHARABLE_BUFFS = new Set\(\[([^\]]*)\]\)/);
ok('the shareable-buff whitelist is present', !!wl);
const SHARABLE = wl ? [...wl[1].matchAll(/'([^']+)'/g)].map(m => m[1]) : [];
ok('whitelist parses to a non-empty set', SHARABLE.length > 0, SHARABLE.join(','));

// Every whitelisted key must exist as a declared slot: the receiver refuses to
// create slots from the wire (`if (!(key in player.buffs)) continue`), so a
// whitelisted-but-undeclared buff would be silently unshareable.
const decl = src.match(/buffs:\s*\{([\s\S]{0,600}?)\}/);
const declared = decl ? [...decl[1].matchAll(/(\w+)\s*:/g)].map(m => m[1]) : [];
const undeclared = SHARABLE.filter(k => !declared.includes(k));
ok('every shareable buff has a declared slot', undeclared.length === 0,
   undeclared.length ? `missing: ${undeclared.join(',')}` : `${declared.length} slots declared`);

// The audit proper: each grant of a shareable buff needs a broadcast nearby.
const WINDOW = 14;
const offenders = [];
let grants = 0;
lines.forEach((l, n) => {
  const m = l.match(/player\.buffs\.(\w+)\s*=\s*(?!0\s*;)/);
  if (!m || !SHARABLE.includes(m[1])) return;
  if (/^\s*\/\//.test(l)) return;                       // commented-out history
  grants++;
  const near = lines.slice(Math.max(0, n - WINDOW), n + WINDOW).join('\n');
  if (!/_coopPartyBuff\s*\(/.test(near)) offenders.push(`${m[1]} @ L${n + 1}`);
});
ok('every shareable-buff grant broadcasts to the party',
   offenders.length === 0, offenders.length ? offenders.join(' | ') : `${grants} grant sites, all shared`);

// The receiver must be wired to the carrier, or nothing arrives at all.
ok('the pbf carrier is routed to the receive handler',
   /msg\.pbf[\s\S]{0,120}_coopApplyPartyBuff\s*\(/.test(src));

// ── B. LIVE SEMANTICS ────────────────────────────────────────────────────────
const PORT = 9114;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(10000);

const live = await page.evaluate(() => {
  const out = [];
  const ok = (n, c, extra) => out.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });
  for (const id of ['class-select-modal','advancement-modal','tutorial-modal','loading-overlay']) {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  }
  loadMap('forest');
  game.currentMap = 'forest';
  player.hp = 500; player.buffs = player.buffs || {};
  for (const k in player.buffs) player.buffs[k] = 0;

  // A partner standing in the same room, alive.
  let nextId = 100;
  const peer = (map) => {
    const id = ++nextId;
    net.peers = net.peers || {};
    net.peers[id] = { map: map === undefined ? 'forest' : map, hp: 100, name: 'P' };
    return id;
  };
  net.myId = 1;
  const recv = (o) => _coopApplyPartyBuff(o);

  // whitelisted buff from a same-room partner lands
  recv({ id: peer(), hm: 'forest', bl: [['warCry', 9000]], sl: 'War Cry' });
  ok('a partner\'s War Cry reaches you in the same room', (player.buffs.warCry | 0) === 9000, `warCry ${player.buffs.warCry | 0}`);

  // a partner in a DIFFERENT room does not
  player.buffs.guardian = 0;
  recv({ id: peer('slimeCave'), hm: 'slimeCave', bl: [['guardian', 6000]], sl: 'Guardian' });
  ok('a partner in another room does not buff you', (player.buffs.guardian | 0) === 0, `guardian ${player.buffs.guardian | 0}`);

  // non-whitelisted keys are refused
  player.buffs.lich = 0;
  recv({ id: peer(), hm: 'forest', bl: [['lich', 30000]], sl: 'x' });
  ok('non-party buffs are refused off the wire', (player.buffs.lich | 0) === 0, `lich ${player.buffs.lich | 0}`);

  // never shorten a longer local cast
  player.buffs.bloodlust = 20000;
  recv({ id: peer(), hm: 'forest', bl: [['bloodlust', 5000]], sl: 'x' });
  ok('a shorter partner buff never shortens your own', (player.buffs.bloodlust | 0) === 20000, `${player.buffs.bloodlust | 0}`);

  // ...but a longer one extends it
  recv({ id: peer(), hm: 'forest', bl: [['bloodlust', 40000]], sl: 'x' });
  ok('a longer partner buff extends yours', (player.buffs.bloodlust | 0) === 40000, `${player.buffs.bloodlust | 0}`);

  // never invent a slot
  recv({ id: peer(), hm: 'forest', bl: [['totallyNotABuff', 9000]], sl: 'x' });
  ok('unknown buff names never create a slot', !('totallyNotABuff' in player.buffs));

  // an unknown sender is ignored
  player.buffs.eagleEye = 0;
  recv({ id: 9999, hm: 'forest', bl: [['eagleEye', 30000]], sl: 'x' });
  ok('a buff from an unknown peer is ignored', (player.buffs.eagleEye | 0) === 0, `eagleEye ${player.buffs.eagleEye | 0}`);

  // SEND side: the wire frame carries only whitelisted keys, one frame per cast
  const sent = [];
  net.connected = true; net.myId = 1;
  net.ws = { readyState: 1, send: (j) => sent.push(JSON.parse(j)) };
  net._lastPbufAt = 0;
  _coopPartyBuff({ warCry: 12000, bloodlust: 12000, lich: 30000 }, "Warlord's Banner");
  const f = sent[0];
  ok('a multi-buff cast sends exactly one frame', sent.length === 1, `${sent.length} frames`);
  ok('the frame is scoped to the caster\'s room', !!f && f.hm === 'forest', f && f.hm);
  const keys = f && Array.isArray(f.bl) ? f.bl.map(p => p[0]).sort() : [];
  ok('the frame carries both shareable buffs and drops the rest',
     keys.join(',') === 'bloodlust,warCry', keys.join(','));

  return out;
});

for (const r of live) res.push(r);
let pass = 0, failed = 0;
for (const r of res) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
console.log(`${pass} passed, ${failed} failed`);
console.log('pageerrors:', errs.length, errs.slice(0, 5));
await browser.close(); server.kill();
process.exit(failed || errs.length ? 1 : 0);
