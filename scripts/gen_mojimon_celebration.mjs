#!/usr/bin/env node
// Celebration art for the FIRST-BIND MojiMon modal.
//
// The first bind is the payoff for 10,000 kills of one species — the single
// biggest grind in the game — and it was being announced through the GENERIC
// #confirm-modal (a text-only yes/no box) as an unstyled wall of bullets.
// This generates the two pieces a proper celebration needs; the existing
// Sprites/ui/mojimon_logo.png (violet/gold chained medallion) stays the
// identity anchor, so these are built to sit behind and around it rather than
// competing with it.
//
//   rays    radial sunburst behind the medallion — the classic achievement
//           "light from behind" read, gold into violet so it matches the logo
//   ribbon  a BOUND banner/laurel to sit under the title
//
// Workflow (needs LUDO_API_KEY):
//   node scripts/gen_mojimon_celebration.mjs                # dry run
//   node scripts/gen_mojimon_celebration.mjs --generate     # 3 each -> review
//   node scripts/gen_mojimon_celebration.mjs --install rays=2 ribbon=1
import sharp from 'sharp';
import { readFile, writeFile, mkdir, access, copyFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const UI = join(repoRoot, 'Sprites', 'ui');
const REVIEW = join(repoRoot, 'scripts', '_mojimon_celebration');
const N = 3;

const has = (f) => process.argv.includes(f);
const valOf = (f) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : null; };
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };

// Shared contract. The palette is lifted from mojimon_logo.png so the whole
// card reads as one object: violet body, gold metal, cyan-white highlights.
const STYLE =
  'Flat 2D cartoon game UI art, bold clean vector shapes, crisp cel shading, ' +
  'rich violet and deep purple with warm GOLD metal accents and pale cyan-white ' +
  'highlights — the palette of an arcane gold-framed medallion. ' +
  'Centred on a fully TRANSPARENT background (alpha only, nothing behind it). ' +
  'CRITICAL: NO text, NO letters, NO words, NO numbers, NO logo, NO watermark. ' +
  'NO characters, NO faces, NO creatures. Single decorative element only, ' +
  'symmetrical, clean edges, no photographic texture, no drop shadow on the alpha.';

const CONCEPTS = {
  rays: {
    size: [1024, 1024],
    prompt:
      'A radial sunburst of light rays bursting outward from the centre — long ' +
      'tapering golden beams alternating with softer violet ones, arranged in a ' +
      'perfectly symmetrical star-burst wheel, brightest at the middle and fading ' +
      'to transparent at the outer edge. The very centre is EMPTY and clear (a ' +
      'medallion will be composited on top of it), so the rays radiate from a ' +
      'hollow middle. Celebratory achievement backdrop.',
  },
  ribbon: {
    size: [1024, 420],
    prompt:
      'An ornate horizontal award ribbon banner: a wide gold-trimmed violet ' +
      'sash with forked swallowtail ends, flanked by a symmetrical pair of ' +
      'golden laurel sprigs curving up from each side, with a few small ' +
      'four-point sparkles. The banner face is SMOOTH and BLANK (text will be ' +
      'drawn over it). Landscape orientation, wider than tall.',
  },
};

async function fetchBuf(u) {
  const r = await fetch(u, { signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error('download ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}

async function normalise(raw, [w, h]) {
  let c; try { c = await sharp(raw).trim().toBuffer(); } catch { c = raw; }
  const inner = await sharp(c).resize(Math.round(w * 0.94), Math.round(h * 0.94), { fit: 'inside' }).png().toBuffer();
  const m = await sharp(inner).metadata();
  return sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: inner, left: Math.round((w - m.width) / 2), top: Math.round((h - m.height) / 2) }])
    .png().toBuffer();
}

async function doGenerate() {
  const apiKey = process.env.LUDO_API_KEY;
  if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
  const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
  await mkdir(REVIEW, { recursive: true });
  const only = valOf('--concept');
  for (const name of (only ? [only] : Object.keys(CONCEPTS))) {
    const cfg = CONCEPTS[name];
    if (!cfg) { console.error('unknown concept ' + name); continue; }
    const ar = cfg.size[0] === cfg.size[1] ? 'ar_1_1' : 'ar_16_9';
    for (let i = 1; i <= N; i++) {
      const dest = join(REVIEW, `${name}_cand${i}.png`);
      if (!has('--force') && await exists(dest)) { console.log(`skip ${name} ${i}`); continue; }
      let ok = false, last;
      for (let a = 1; a <= 3 && !ok; a++) {
        try {
          const res = await fetch(`${API}/assets/image`, {
            method: 'POST',
            headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(180000),
            body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: ar, n: 1, augment_prompt: false, prompt: `${cfg.prompt} ${STYLE}` }),
          });
          if (!res.ok) throw new Error(res.status + ': ' + (await res.text()).slice(0, 150));
          const data = await res.json();
          const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
          if (!url) throw new Error('no url');
          await writeFile(dest, await normalise(await fetchBuf(url), cfg.size));
          console.log(`OK   ${name} cand${i}`);
          ok = true;
        } catch (e) { last = e; if (a < 3) await new Promise(s => setTimeout(s, 3000 * a)); }
      }
      if (!ok) console.error(`FAIL ${name} cand${i}: ${last && last.message}`);
    }
  }
  console.log('\nReview scripts/_mojimon_celebration/, then --install rays=<i> ribbon=<i>');
}

async function doInstall() {
  const backup = join(REVIEW, '_backup');
  await mkdir(backup, { recursive: true });
  let n = 0;
  for (const name of Object.keys(CONCEPTS)) {
    const spec = process.argv.find((a) => a.startsWith(name + '='));
    if (!spec) continue;
    const idx = spec.split('=')[1];
    const src = join(REVIEW, `${name}_cand${idx}.png`);
    if (!await exists(src)) { console.error('missing ' + src); continue; }
    const out = join(UI, `mojimon_${name}.webp`);
    if (await exists(out) && !await exists(join(backup, `mojimon_${name}.webp`))) await copyFile(out, join(backup, `mojimon_${name}.webp`));
    await writeFile(out, await sharp(await readFile(src)).webp({ quality: 92 }).toBuffer());
    console.log(`installed ${name} cand${idx} -> Sprites/ui/mojimon_${name}.webp`);
    n++;
  }
  if (!n) console.error('nothing installed — pass e.g. --install rays=2 ribbon=1');
}

if (has('--install')) await doInstall();
else if (has('--generate')) await doGenerate();
else {
  console.log('# FIRST-BIND celebration art. Existing mojimon_logo.png stays the identity anchor.');
  for (const [k, v] of Object.entries(CONCEPTS)) console.log(`#   ${k.padEnd(7)} ${v.size.join('x')}  ${v.prompt.slice(0, 74)}…`);
  console.log('# 1) node scripts/gen_mojimon_celebration.mjs --generate');
  console.log('# 2) node scripts/gen_mojimon_celebration.mjs --install rays=<i> ribbon=<i>');
}
