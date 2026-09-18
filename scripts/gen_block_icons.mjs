#!/usr/bin/env node
// The Block (A) slot icon, per class, in the skill icons' own style.
// =============================================================================
// Per user: "regenerate the block A icon for all classes to better suit the icons in a similar style to the skill
// icons". The skill bar's icons are die-cut stickers - a white sticker edge around a thin even black outline, flat
// vibrant chibi colours, light cel shading (scripts/generate_skill_icons.mjs). The v0.29.340 block icons were painted
// 3D objects with no sticker edge, and depicted things the game never shows when you block (a crimson shield, a planet
// with a ring, a tornado). The new ones carry the skill icons' look as a short tail after the subject (see TAIL below:
// their full prompt was tried first and failed), with each class's subject taken from what its block actually looks like in
// game (Sprites/fx/block_<class>.webp, scripts/gen_block_fx_ludo.mjs): the warrior's golden shield of light, the
// rogue's violet smoke burst, the mage's light-blue rune ward, the archer's green wind gust. Plus the plain steel shield
// shown before a class is chosen.
//
// Job API (POST -> id, poll /assets/jobs/<id>), job ids kept in a state file so a paid job is never re-posted.
//   node scripts/gen_block_icons.mjs                          # dry-run: prints the prompts
//   node scripts/gen_block_icons.mjs --generate [--out dir]   # -> <dir>/block_<cls>_v<n>.webp candidates (512 px) + raw/
//   node scripts/gen_block_icons.mjs --install <dir> warrior=1,rogue=2,...   # copy the chosen candidates to Sprites/ui/
// Needs LUDO_API_KEY from the environment (never committed).
// =============================================================================
import { createRequire } from 'node:module';
import { writeFileSync, readFileSync, existsSync, mkdirSync, renameSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const sharp = require('sharp'); sharp.cache(false);
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '..');
const argv = process.argv.slice(2);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

// The skill icons' LOOK, as a short tail after the subject. Their generator's 1,000-character prefix was tried first
// (read out of generate_skill_icons.mjs, verbatim) and all ten jobs came back as glossy orbs and chibi faces: this
// sprite model follows a long style preamble and drops a subject that comes after it. Subject first, then the style.
const TAIL = ', game skill icon as a die-cut sticker: a white sticker border around a thin even black outline, vibrant flat colors with light cel shading and glossy highlights, chibi anime game style, the object only, centered, no character, no person, no face, no creature, no hands, no text, transparent background';
const subject = (s) => 'A single ' + s + TAIL;
const SUBJECTS = {
  warrior: ['golden kite shield made of radiant light, a warm amber rim and a bright white gleam, small sparks around its edge',
            'sturdy golden kite shield glowing with holy light, braced forward, with a ring of light flaring behind it'],
  rogue:   ['swirling burst of violet and deep-purple shadow smoke with dark streaking trails and faint magenta sparks',
            'whirling shroud of dark purple smoke curling into a protective swirl, with shadowy wisps and magenta glints'],
  mage:    ['circular light-blue arcane ward shield: a glowing ring of cyan rune glyphs around a pale ice-blue shield of light',
            'round shimmering ice-blue magic barrier with a ring of glowing cyan runes and a bright crystal core'],
  archer:  ['curling gust of green wind swirling into a protective barrier, with bright emerald streaks and a few tumbling leaves',
            'round whirl of emerald wind and leaves forming a shield, with swift green speed streaks'],
  shield:  ['sturdy steel heater shield with a bright gold rim and a shining gleam',
            'polished steel knight shield with a gold trim border and a soft blue gleam'],
};
const OUT = arg('--out') || path.join(process.env.TEMP || '.', 'block_icons');
const SIZE = 512;   // the size the current Sprites/ui/block_*.webp ship at

// ---- install: copy chosen candidates into place ----------------------------------------------------------------
if (argv.includes('--install')) {
  const dir = arg('--install'), pick = argv[argv.indexOf('--install') + 2] || '';
  for (const p of pick.split(',').filter(Boolean)) {
    const [cls, v] = p.split('='); const src = path.join(dir, `block_${cls}_v${v}.webp`), dst = path.join(ROOT, 'Sprites', 'ui', `block_${cls}.webp`);
    if (!SUBJECTS[cls] || !existsSync(src)) { console.error('ABORT no candidate ' + src); process.exit(1); }
    copyFileSync(src, dst + '.tmp'); renameSync(dst + '.tmp', dst); console.log(`installed ${path.basename(src)} -> Sprites/ui/block_${cls}.webp`);
  }
  process.exit(0);
}

const JOBS = [];
const V0 = Number(arg('--v0') || 3);   // v1/v2 were the long-prefix run (all unusable); this shape starts at v3
for (const [cls, subs] of Object.entries(SUBJECTS)) subs.forEach((s, i) => JOBS.push({ key: 'block_' + cls, v: V0 + i, prompt: subject(s) }));
if (!argv.includes('--generate')) { for (const j of JOBS) console.log(`${j.key}_v${j.v}: ${j.prompt}`); console.log(`\n${JOBS.length} jobs (0.5 credit each). Re-run with --generate (needs LUDO_API_KEY).`); process.exit(0); }
const KEY = process.env.LUDO_API_KEY; if (!KEY) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
mkdirSync(path.join(OUT, 'raw'), { recursive: true });
const STATE_F = path.join(OUT, 'jobs_state.json');
const state = existsSync(STATE_F) ? JSON.parse(readFileSync(STATE_F, 'utf8')) : {};
const saveState = () => { writeFileSync(STATE_F + '.tmp', JSON.stringify(state, null, 1)); renameSync(STATE_F + '.tmp', STATE_F); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const urlOf = (d) => Array.isArray(d) ? (d[0] && d[0].url) : (d && (d.url || (d.images && d.images[0] && d.images[0].url) || (Array.isArray(d.result) && d.result[0] && d.result[0].url)));

async function submit(job) {
  for (let busy = 0; ; busy++) {
    const res = await fetch(`${API}/assets/image`, { method: 'POST', headers: { Authorization: `ApiKey ${KEY}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(120000),
      body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: job.prompt }) });
    if (res.status === 402) throw new Error('OUT OF CREDITS (402)');
    if (res.status === 429) { await res.text().catch(() => ''); if (busy > 20) throw new Error('queue stayed full'); await sleep(15000); continue; }
    const txt = await res.text();
    if (!res.ok) throw new Error(`POST ${res.status}: ${txt.slice(0, 140)}`);
    return JSON.parse(txt);
  }
}
async function poll(id) {
  const t0 = Date.now(); let wait = 5000;
  for (;;) {
    await sleep(wait);
    const r = await fetch(`${API}/assets/jobs/${id}`, { headers: { Authorization: `ApiKey ${KEY}` }, signal: AbortSignal.timeout(30000) });
    if (r.status === 429) { await r.text().catch(() => ''); wait = Math.min(30000, wait * 2 + Math.random() * 3000); continue; }
    if (!r.ok) throw new Error(`job ${id}: ${r.status}`);
    const j = await r.json();
    if (j.status === 'succeeded') return j;
    if (j.status === 'failed' || j.status === 'cancelled') throw new Error(`job ${id} ${j.status}`);
    if (Date.now() - t0 > 600000) throw new Error(`job ${id} still ${j.status} after 600 s`);
    wait = Math.min(15000, Math.max(5000, Number(j.poll_after_ms) || 6000));
  }
}
async function run(job) {
  const name = `${job.key}_v${job.v}`, dst = path.join(OUT, name + '.webp');
  if (existsSync(dst)) return name + ': exists';
  let id = state[name] && state[name].id, data = null;
  if (!id) { const r = await submit(job); if (urlOf(r)) data = r; else if (r && r.id) { id = r.id; state[name] = { id, at: Date.now() }; saveState(); } else throw new Error('no job id'); }
  if (!data) data = await poll(id);
  const url = urlOf(data); if (!url) throw new Error('no url');
  const buf = Buffer.from(await (await fetch(url, { signal: AbortSignal.timeout(120000) })).arrayBuffer());
  writeFileSync(path.join(OUT, 'raw', name + '.png'), buf);
  // the skill icons' framing: the subject centred at ~82% of a transparent square
  const trimmed = await sharp(buf).ensureAlpha().trim({ threshold: 8 }).png().toBuffer();
  const inner = Math.round(SIZE * 0.84);
  const fitted = await sharp(trimmed).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: fitted, gravity: 'center' }]).webp({ quality: 92, alphaQuality: 100 }).toFile(dst);
  return name + ': ok';
}
const results = await Promise.allSettled(JOBS.map((j, i) => sleep(i * 800).then(() => run(j))));
results.forEach((r, i) => console.log(r.status === 'fulfilled' ? r.value : `${JOBS[i].key}_v${JOBS[i].v}: FAIL ${r.reason && r.reason.message}`));
process.exit(results.some((r) => r.status === 'rejected') ? 2 : 0);
