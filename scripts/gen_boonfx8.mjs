// Boon FX round 2 (per user: "make sprites for the first 8 boons using ludo.ai similar to the style of the new boons as attached").
// The eight boons with no effect sprite (Storm Chain, Frostbite, Burning Touch, Thorns, Lifesteal, Quickening, Hyper Teleport,
// Diagonal Slash). Style recipe copied word for word from the round-1 generator (the sheet the user attached: Riposte Nova, Death
// Bloom, Second Skin, Mirror Step, Overflow Valve, Rampage Engine): image_type sprite-vfx, a classic 2D MMO skill effect of layered
// light, one colour family per effect, no generated outline; two takes each in Cel-Shaded (C) and Illustration (I).
//   node scripts/gen_boonfx8.mjs               -> $BFX_OUT/cand/<fx><style><k>.png (+ _raw.png) + gates.json   (PLAN='{"chain":{"C":1}}' re-rolls)
//   node scripts/gen_boonfx8.mjs pick key=<png> -> Sprites/fx/<key>.webp: 768x768 with the art inside a 23 px margin (the round-1
//     effects), 1024x512 for chain_bolt (overflow_arc's canvas); centred, aspect kept. Shipped picks: S C1, F C1, B C1, T C2, D I1,
//     and per user L I2, Q C1 and, for the regenerated Hyper Teleport, blink3 C2.
import { createRequire } from 'node:module'; import { writeFile, mkdir } from 'node:fs/promises'; import { existsSync, readFileSync } from 'node:fs'; import { join } from 'node:path';
import { execSync } from 'node:child_process';
const sharp = createRequire(import.meta.url)('sharp');
const SCRIPTS = new URL('.', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const HERE = process.env.BFX_OUT || join(SCRIPTS, '_tmp_boonfx8'), OUT = join(HERE, 'cand');
if (process.argv[2] === 'pick') {
  const fs = await import('node:fs'); const DEST = join(SCRIPTS, '..', 'Sprites', 'fx'); const WIDE = new Set(['chain_bolt']);
  for (const a of process.argv.slice(3)) {
    const [key, file] = a.split('='); const [CW, CH] = WIDE.has(key) ? [1024, 512] : [768, 768], M = 23;
    const art = await sharp(fs.readFileSync(file)).trim({ threshold: 8 }).png().toBuffer(); const m = await sharp(art).metadata();
    const s = Math.min((CW - 2 * M) / m.width, (CH - 2 * M) / m.height), w = Math.round(m.width * s), h = Math.round(m.height * s);
    const out = await sharp({ create: { width: CW, height: CH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: await sharp(art).resize(w, h, { kernel: 'lanczos3' }).png().toBuffer(), left: Math.round((CW - w) / 2), top: Math.round((CH - h) / 2) }])
      .webp({ quality: 90, alphaQuality: 100, effort: 6 }).toBuffer();
    const dst = join(DEST, key + '.webp'); fs.writeFileSync(dst + '.tmp', out); fs.renameSync(dst + '.tmp', dst);
    console.log(key, '<-', file, `${w}x${h} on ${CW}x${CH}`);
  }
  process.exit(0);
}
const API = 'https://api.ludo.ai/api';
// the persistent user key (rotated 2026-09-30); never printed
const KEY = (() => { try { const u = execSync('powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable(\'LUDO_API_KEY\',\'User\')"').toString().trim(); if (u) return u; } catch (e) {} return process.env.LUDO_API_KEY; })();
if (!KEY) { console.error('no LUDO_API_KEY'); process.exit(1); }
const BASE = 'Classic 2D MMORPG skill-effect sprite in the style of games like MapleStory: ONE single effect centred, brilliant and luminous, made of layered light - '
  + 'a white-hot core, crisp clean glowing shapes, a soft outer glow halo, twinkling four-point star glints and tiny light particles. Punchy, high contrast, a big satisfying impact. '
  + 'No black outline, no ink lines. Not neon, no rainbow. '
  + 'Fully transparent background, no background, no ground, no text, no border, no drop shadow, no character, no person. The whole effect inside the frame with a wide empty margin on every side - nothing touches or is cut off at any edge.';
const FX = {
  chain: { key: 'chain_bolt', ar: 'ar_16_9', colour: 'one electric colour family, white through bright lemon yellow to deep gold',
    what: 'a CHAIN LIGHTNING bolt travelling horizontally from LEFT to RIGHT: a bright crackling spark burst at the left end, a thick jagged forked bolt of lightning zig-zagging across with thin branching tendrils, and a second crackling spark burst at the right end' },
  freeze: { key: 'frost_lock', ar: 'ar_1_1', colour: 'one ice colour family, white through bright ice blue to deep sapphire blue',
    what: 'a FROSTBITE freeze burst seen head-on: a cluster of sharp jagged ice crystals snapping shut into a spiky icy star, frost shards bursting outward, a ring of cold glittering mist and snowflake glints' },
  burn: { key: 'burn_ignite', ar: 'ar_1_1', colour: 'one fire colour family, white through bright orange to deep red',
    what: 'an IGNITE flare seen head-on: a compact fireball bursting into flame, curling tongues of fire licking outward all round it, a ring of embers and sparks spiralling out' },
  thorns: { key: 'thorn_burst', ar: 'ar_1_1', colour: 'one green colour family, white through bright leaf green to deep emerald',
    what: 'a THORNS retaliation burst seen head-on: a ring of sharp curved thorny vines and pointed thorn spikes lashing outward from a bright impact flash at the centre, small torn leaves flying out' },
  lifesteal: { key: 'drain_wisp', ar: 'ar_1_1', colour: 'one blood-red colour family, white through bright ruby red to deep crimson',
    what: 'a LIFESTEAL drain seen head-on: ribbons of glowing life essence spiralling inward into a bright pulsing heart-shaped core, small droplets of light being pulled in from all round' },
  quicken: { key: 'quicken_burst', ar: 'ar_1_1', colour: 'one violet colour family, white through bright lilac to deep violet',
    what: 'a QUICKENING time-reset burst seen head-on: a glowing clock-face ring with tick marks around its rim and two clock hands, a bright lightning-bolt flash striking through its centre, sparks of light flying off the ring' },
  blink: { key: 'blink_warp', ar: 'ar_1_1', colour: 'one azure colour family, white through bright azure to deep royal blue',
    what: 'a HYPER TELEPORT warp flash seen head-on: a tall vertical slit of blinding light tearing open with a bright star burst at its centre, streaks of light swirling into it, and shimmering afterimage sparkles scattered round it' },
  // per user: "hyper teleport regenerate" (the tall vertical slit) - two new concepts
  blink2: { key: 'blink_warp', ar: 'ar_1_1', colour: 'one azure colour family, white through bright azure to deep royal blue',
    what: 'a HYPER TELEPORT warp burst seen head-on: a round swirling vortex portal of light spiralling inward to a blinding white star point at its centre, curved arcs of energy whipping round it, and sparkles scattering outward from its rim' },
  blink3: { key: 'blink_warp', ar: 'ar_1_1', colour: 'one azure colour family, white through bright azure to deep royal blue',
    what: 'a HYPER TELEPORT blink flash seen head-on: a brilliant starburst with four long sharp rays of light, surrounded by a ring of rushing horizontal speed streaks and shimmering afterimage particles, as if something vanished in an instant' },
  diag: { key: 'diag_slash', ar: 'ar_1_1', colour: 'one steel colour family, white through bright steel blue to deep cobalt',
    what: 'a DIAGONAL SLASH: one huge sharp crescent sword-slash arc sweeping diagonally from the upper left to the lower right, a white-hot cutting edge with a long glowing trail behind it, sparks along the blade path' },
};
const STY = { C: 'Cel-Shaded', I: 'Illustration' };
async function ludoResult(res) {
  if (res.status === 402) throw new Error('OUT OF LUDO CREDITS');
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  const j = await res.json(); if (res.status !== 202 || !j.id) return j;
  const t0 = Date.now();
  while (Date.now() - t0 < 20 * 60 * 1000) {
    const r = await fetch(`${API}/assets/jobs/${j.id}?wait=30`, { headers: { Authorization: `ApiKey ${KEY}` }, signal: AbortSignal.timeout(60000) }).catch(() => null);
    if (!r || r.status === 429 || !r.ok) { await new Promise((s) => setTimeout(s, 4000)); continue; }
    const q = await r.json();
    if (q.status === 'succeeded') return q.result;
    if (q.status === 'failed' || q.status === 'cancelled') throw new Error('job ' + q.status + ': ' + JSON.stringify(q.error || '').slice(0, 160));
    await new Promise((s) => setTimeout(s, Math.max(1000, q.poll_after_ms || 2000)));
  }
  throw new Error('job timed out');
}
const post = (p, body) => fetch(`${API}${p}`, { method: 'POST', headers: { Authorization: `ApiKey ${KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(240000) }).then(ludoResult);
const edgePx = async (buf) => { const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); const W = info.width, H = info.height; let n = 0;
  for (let y = 0; y < H; y++) for (const x of [0, 1, W - 2, W - 1]) if (data[(y * W + x) * 4 + 3] > 24) n++;
  for (let x = 0; x < W; x++) for (const y of [0, 1, H - 2, H - 1]) if (data[(y * W + x) * 4 + 3] > 24) n++;
  return n; };
const gates = existsSync(join(HERE, 'gates.json')) ? JSON.parse(readFileSync(join(HERE, 'gates.json'), 'utf8')) : {};
async function save(tag, result) {
  const list = Array.isArray(result) ? result : (result && result.images) || [result];
  let k = 0; while (existsSync(join(OUT, `${tag}${k + 1}.png`))) k++;
  for (const it of list) { const url = it && (it.url || it.image_url); if (!url) continue; k++;
    const raw = await sharp(Buffer.from(await (await fetch(url)).arrayBuffer())).ensureAlpha().png().toBuffer();
    await writeFile(join(OUT, `${tag}${k}_raw.png`), raw);   // raw first, untouched
    const { data, info } = await sharp(raw).raw().toBuffer({ resolveWithObject: true });
    const corner = data[3] + data[(info.width - 1) * 4 + 3] + data[((info.height - 1) * info.width) * 4 + 3];
    const t = await sharp(raw).trim({ threshold: 8 }).png().toBuffer({ resolveWithObject: true });
    await writeFile(join(OUT, `${tag}${k}.png`), t.data);
    gates[`${tag}${k}`] = { transparent: corner === 0, rawEdgePx: await edgePx(raw), w: t.info.width, h: t.info.height };
  }
}
await mkdir(OUT, { recursive: true });
const PLAN = process.env.PLAN ? JSON.parse(process.env.PLAN) : Object.fromEntries(Object.keys(FX).map((k) => [k, { C: 2, I: 2 }]));
// four requests in flight at a time (each asks for n=2)
const queue = []; for (const [f, plan] of Object.entries(PLAN)) for (const [s, n] of Object.entries(plan)) queue.push([f, s, n]);
let stop = false;
const worker = async () => { while (!stop && queue.length) { const [f, s, n] = queue.shift(); const d = FX[f];
  try { const r = await post('/assets/image', { image_type: 'sprite-vfx', prompt: d.what + '. Colours: ' + d.colour + '. ' + BASE, art_style: STY[s], aspect_ratio: d.ar, n, augment_prompt: false });
    await save(f + s, r); console.log(`${f}${s} done`); await writeFile(join(HERE, 'gates.json'), JSON.stringify(gates, null, 1));
  } catch (e) { console.log(`${f}${s} FAILED ${e.message}`); if (/CREDITS/.test(e.message)) stop = true; } } };
await Promise.all([worker(), worker(), worker(), worker()]);
await writeFile(join(HERE, 'gates.json'), JSON.stringify(gates, null, 1));
process.exitCode = stop ? 2 : 0;
