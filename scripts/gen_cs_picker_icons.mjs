#!/usr/bin/env node
// Sprites/ui/cs/ - custom icons for the character-creation picker cards.
// =============================================================================
// Per user, with a screenshot of the HAIR / EYES / MOUTH / SKIN TONE cards: "use custom images
// instead of emojis". The four section labels carried a system emoji each (a haircut, an eye, a
// mouth, a palette) and the dice button on the preview was a fifth; each renders differently per
// platform and none of them match the HUD's cel-shaded icon set. These five are that set's
// missing members, in its own style.
//
// The style tail is read VERBATIM out of scripts/gen_hud_stat_icons.mjs at run time, so these
// icons stay a matched set with the sixteen HUD icons by construction rather than by copy-paste.
//
//   node scripts/gen_cs_picker_icons.mjs                 # dry-run
//   node scripts/gen_cs_picker_icons.mjs --generate      # writes (skips existing)
//   flags: --force --only hair,eyes
// Needs LUDO_API_KEY (read from the environment - never committed).
// =============================================================================
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
import { readFileSync } from 'node:fs';
import { writeFile, mkdir, access, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const OUT_DIR = join(repoRoot, 'Sprites', 'ui', 'cs');
const SIZE = 128;
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };

const hud = readFileSync(join(repoRoot, 'scripts', 'gen_hud_stat_icons.mjs'), 'utf8');
const SUFFIX = (/const SUFFIX = '([^']+)'/.exec(hud) || [])[1];
if (!SUFFIX || !/game UI icon/.test(SUFFIX)) { console.error('could not read the HUD style tail from gen_hud_stat_icons.mjs'); process.exit(1); }

const ICON = {
  // subject-first and terse, per the recorded ludo.ai lesson
  hair:  'A glossy wavy lock of chestnut brown hair',
  eyes:  'A single glossy anime eye with a bright teal iris and long dark lashes',
  mouth: 'A pair of glossy smiling pink lips',
  skin:  'A glossy wooden artist palette with four round dabs of skin-tone paint from pale to deep brown',
  dice:  'A glossy white six-sided die showing five black pips',
  // v0.30.5xx - the gender buttons' text glyphs become icons too (per user: custom images, not glyphs)
  male:   'A glossy sapphire-blue Mars male gender symbol, a circle with an arrow pointing up-right',
  female: 'A glossy rose-pink Venus female gender symbol, a circle with a cross below it',
};
let keys = Object.keys(ICON);
const only = arg('--only');
if (only) { const w = only.split(',').map((x) => x.trim()); keys = keys.filter((k) => w.includes(k)); }

if (!has('--generate')) {
  console.log(`# ${keys.length} icon(s) -> ${OUT_DIR} (${SIZE}x${SIZE} webp)\n`);
  for (const k of keys) console.log(`  ${k}\n     ${ICON[k]}`);
  console.log('\n# style tail: ' + SUFFIX.slice(0, 80) + '...');
  console.log('# Re-run with --generate (needs LUDO_API_KEY).');
  process.exit(0);
}
const apiKey = process.env.LUDO_API_KEY;
if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const force = has('--force');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fetchBuf = async (u) => { const r = await fetch(u, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); };

async function gen(k) {
  const out = join(OUT_DIR, `ico_${k}.webp`);
  if (!force && await exists(out)) return 'skip';
  let last;
  for (let a = 1; a <= 4; a++) {
    try {
      const res = await fetch(`${API}/assets/image`, {
        method: 'POST',
        headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(180000),
        body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1',
                               n: 1, augment_prompt: false, prompt: ICON[k] + SUFFIX }),
      });
      if (res.status === 402) throw new Error('402 OUT OF CREDITS');
      if (!res.ok) throw new Error(res.status + ': ' + (await res.text()).slice(0, 140));
      const data = await res.json();
      const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
      if (!url) throw new Error('no url');
      // trim the transparent margin the endpoint leaves, then seat at 128 with a hair of padding
      const raw = await fetchBuf(url);
      const trimmed = await sharp(raw).ensureAlpha().trim({ threshold: 10 }).png().toBuffer().catch(() => raw);
      const buf = await sharp(trimmed)
        .resize(SIZE - 8, SIZE - 8, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .extend({ top: 4, bottom: 4, left: 4, right: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 92 }).toBuffer();
      const m = await sharp(buf).metadata();
      if (m.width !== SIZE || m.height !== SIZE || !m.hasAlpha) throw new Error(`bad output ${m.width}x${m.height} alpha=${m.hasAlpha}`);
      await mkdir(OUT_DIR, { recursive: true });
      await writeFile(out + '.tmp', buf); await rename(out + '.tmp', out);
      return out;
    } catch (e) { last = e; if (/402/.test(e.message)) throw e; if (a < 4) await sleep(3000 * a); }
  }
  throw last;
}
for (const k of keys) {
  process.stdout.write(`  ${k} ... `);
  try { console.log(await gen(k)); } catch (e) { console.log('FAIL ' + e.message); process.exitCode = 2; if (/402/.test(e.message)) break; }
  await sleep(800);
}
console.log('done.');
