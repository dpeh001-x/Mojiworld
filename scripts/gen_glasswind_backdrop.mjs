#!/usr/bin/env node
// GLASSWIND STEPPE backdrop, redrawn (per user: "glasswind background probably needs a better design regeneration").
// =============================================================================
// The old plate (backgrounds/bg_v3_glasswindSteppe.webp, 4:3) was a flat cracked-ice FLOOR seen from above
// filling the lower two thirds: behind floating platforms it read as a wall of tiles, not a landscape; it was
// stretched to 16:9 and mirror-tiled, which doubled its ice castle into a symmetric blob; and it was pale on pale,
// so the icy platforms vanished into it. The redraw is a SIDE-ON 16:9 panorama for bgNoMirror (one copy at its own
// aspect, bottom-anchored - the top ~23% is sky overscan, the bottom ~11% sits behind the ground slab), horizon in
// the lower middle, deep blue shadows low down, and the steppe's own identity: wind-carved glass and shards on the
// wind. Samples only; nothing in backgrounds/ is touched until --pick.
//
// ludo's image types are all cut-out types: every roll comes back with its SKY removed (18 of 18 rejected by the
// opacity check). Keep the raw rolls (saved as <set>_roll<n>_*.png) and paint the sky back with
// scripts/gen_glasswind_sky.mjs, which flattens a roll onto a mood gradient and repaints that gradient through
// /assets/image/edit. Shipped (v0.30.x glasswind): set a (dawn) -> Glasswind Steppe, bg_v4_glasswindSteppe.webp;
// set b (aurora night) -> Razor Plains, bg_v4_glasswindSteppe2.webp. The windstorm set c was not used (per user,
// "too messy"). The Frosted Mansion keeps its own plate. Both maps are bgNoMirror.
//
//   LUDO_API_KEY=... GW_OUT=<dir> node scripts/gen_glasswind_backdrop.mjs [a b c]
//   GW_OUT=<dir> node scripts/gen_glasswind_backdrop.mjs --pick=<sample file>
// =============================================================================
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const fs = require('node:fs');
sharp.cache(false);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FINAL = path.join(ROOT, 'backgrounds', 'bg_v4_glasswindSteppe.webp');   // a NEW name: no sw.js cache bump
const OUT = process.env.GW_OUT || path.join(ROOT, 'scripts', '_tmp_glasswind');
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api', KEY = process.env.LUDO_API_KEY;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const arg = (k) => { const a = process.argv.find((x) => x === '--' + k || x.startsWith('--' + k + '=')); return a ? (a.split('=')[1] ?? true) : null; };

const SCENE = 'A side-scrolling platformer game background, seen SIDE-ON from a LOW camera at ground level, the horizon line '
  + 'in the lower middle of the image. The Glasswind Steppe: a vast frozen tundra where the wind has carved the ice into '
  + 'GLASS - rolling dunes and ridges of clear blue-green glass, leaning crystal spires, and natural glass arches, '
  + 'receding in layers into the distance. Streams of tiny glittering glass shards are carried sideways on the wind '
  + 'across the whole scene, catching the light. Far away, right of centre, a small frosted crystal mansion stands on a '
  + 'ridge. The land near the bottom is a low, level stretch of frosted ground seen side-on (not a floor seen from above).';
const LOOK = 'Painterly anime game background, soft cel shading, clean shapes, rich depth with atmospheric haze between the '
  + 'layers. Strong value contrast: DEEP blue and teal shadows in the lower half so pale icy platforms stand out in front of '
  + 'it, a luminous sky above. Nothing large at the far left or far right edges.';
const FULL = 'No characters, no creatures, no text, no letters, no logo, no UI, no frame or border. A FULL RECTANGULAR image, '
  + 'completely opaque, painted from corner to corner including the whole sky - not a sticker, not a cut-out.';
const SETS = {
  a: { label: 'Clear dawn: gold light on glass', mood: 'Early morning: a clear pale gold and aqua sky, low sunlight from the left striking the glass so it glows with prismatic rainbow glints, long cool shadows.' },
  b: { label: 'Aurora night: glowing glass', mood: 'Night: a deep indigo sky with a sweeping green and violet aurora and stars, the glass dunes lit from within in soft cyan, the shards on the wind sparkling like stars.' },
  c: { label: 'Wind storm: dramatic sky', mood: 'A bright windstorm: a dramatic sky of towering white and slate-blue clouds torn sideways by the wind, shafts of sunlight breaking through, heavy streams of glittering shards and snow blowing across.' },
};

async function ludo(route, body) {
  for (let t = 1; ; t++) {
    let res;
    try { res = await fetch(`${API}/${route}`, { method: 'POST', headers: { Authorization: `ApiKey ${KEY}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(300000), body: JSON.stringify(body) }); }
    catch (e) { if (t < 6 && /ENOTFOUND|EAI_AGAIN|Connect/.test(String(e.cause && (e.cause.code || e.cause.message)))) { await sleep(3000 * t); continue; } throw e; }
    if (res.status === 402) throw new Error('402 OUT OF CREDITS');
    const txt = await res.text(); if (!res.ok) throw new Error(`HTTP ${res.status} ${txt.slice(0, 160)}`);
    let j = JSON.parse(txt);
    if (res.status === 202 && j.id) {
      const id = j.id; let wait = Number(j.poll_after_ms) || 5000;
      for (let i = 0; ; i++) {
        if (i > 90) throw new Error('job timed out');
        await sleep(Math.max(4000, wait));
        let r; try { r = await fetch(`${API}/assets/jobs/${id}`, { headers: { Authorization: `ApiKey ${KEY}` }, signal: AbortSignal.timeout(45000) }); } catch (e) { continue; }
        if (r.status === 429) { await r.text().catch(() => {}); continue; }
        const k = await r.json();
        if (k.status === 'succeeded') { j = k.result; break; }
        if (k.status === 'failed' || k.status === 'cancelled') throw new Error('job ' + k.status);
        wait = Number(k.poll_after_ms) || wait;
      }
    }
    return j;
  }
}
async function fetchBuf(url) { for (let t = 1; ; t++) { try { const r = await fetch(url, { signal: AbortSignal.timeout(180000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); } catch (e) { if (t >= 5) throw e; await sleep(2000 * t); } } }
// share of the image that is opaque: a cut-out sprite (the model's default for image_type sprite) is rejected
async function opaqueCoverage(buf) {
  const { data } = await sharp(buf).ensureAlpha().resize(160, 90, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  let n = 0; for (let i = 3; i < data.length; i += 4) if (data[i] > 245) n++; return n / (160 * 90);
}

if (arg('pick')) {
  const src = path.isAbsolute(arg('pick')) ? arg('pick') : path.join(OUT, arg('pick'));
  const buf = await sharp(fs.readFileSync(src)).flatten({ background: '#1d3550' }).webp({ quality: 90 }).toBuffer();
  fs.writeFileSync(FINAL + '.tmp', buf); fs.renameSync(FINAL + '.tmp', FINAL);
  const m = await sharp(buf).metadata(); console.log('wrote', path.relative(ROOT, FINAL), m.width + 'x' + m.height, Math.round(buf.length / 1024) + ' KB');
} else {
  if (!KEY) { console.error('LUDO_API_KEY is not set'); process.exit(1); }
  fs.mkdirSync(OUT, { recursive: true });
  const which = process.argv.slice(2).filter((a) => SETS[a]);
  await Promise.all((which.length ? which : Object.keys(SETS)).map(async (k) => {
    const prompt = `${SCENE} ${SETS[k].mood} ${LOOK} ${FULL}`;
    let got = 0;
    for (let roll = 1; roll <= 3 && got < 2; roll++) {
      try {
        const d = await ludo('assets/image', { image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_16_9', n: 2, augment_prompt: false, prompt });
        const list = Array.isArray(d) ? d : [d];
        for (const it of list) {
          if (!it || !it.url || got >= 2) continue;
          const raw = await fetchBuf(it.url), cov = await opaqueCoverage(raw), m = await sharp(raw).metadata();
          const name = `${k}${got + 1}_raw.png`;
          fs.writeFileSync(path.join(OUT, `${k}_roll${roll}_${Date.now().toString(36)}.png`), await sharp(raw).png().toBuffer());   // the untouched output, always kept
          if (cov < 0.97) { console.log(`${k} roll ${roll}: rejected, only ${(cov * 100).toFixed(0)}% opaque (a cut-out)`); continue; }
          fs.writeFileSync(path.join(OUT, name), await sharp(raw).png().toBuffer()); got++;
          console.log(`${k}${got}: ${SETS[k].label} - ${m.width}x${m.height}, ${(cov * 100).toFixed(0)}% opaque`);
        }
      } catch (e) { console.log(`${k} roll ${roll} failed: ${e.message}`); if (/402/.test(e.message)) process.exit(3); }
    }
  }));
}
