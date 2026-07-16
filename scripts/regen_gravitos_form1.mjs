#!/usr/bin/env node
// Regenerate Gravitos 1st-form sprite via ludo.ai IMG2IMG (/assets/image/edit).
// =============================================================================
// Restyles the CURRENT Sprites/bosses/gravitos.png toward a majestic armored
// cosmic star-titan (user reference), keeping its EXACT pose (double-biceps
// flex, wide stance), framing, silhouette and transparency.
//
//   node scripts/regen_gravitos_form1.mjs                       # dry-run
//   LUDO_API_KEY=... node scripts/regen_gravitos_form1.mjs --generate   # 4 candidates -> _gravitos_review/
//   node scripts/regen_gravitos_form1.mjs --install 2           # install candidate #2 (backs up original)
// =============================================================================
import sharp from 'sharp';
import { readFile, writeFile, mkdir, access, copyFile, readdir } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(repoRoot, 'Sprites', 'bosses', 'gravitos.png');
const REVIEW = join(repoRoot, 'scripts', '_gravitos_review');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
async function fetchBuf(url) { const r = await fetch(url, { signal: AbortSignal.timeout(150000) }); if (!r.ok) throw new Error('fetch ' + r.status); return Buffer.from(await r.arrayBuffer()); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PROMPT =
  'Restyle this cosmic titan boss game-sprite into a majestic ARMORED STAR-TITAN, ' +
  'KEEPING THE EXACT SAME POSE, silhouette, framing, scale and proportions — both ' +
  'arms raised in a powerful double-biceps flex, wide planted power stance, facing ' +
  'forward. UPGRADE the look: heavy interlocking deep blue-and-violet GALAXY ARMOR ' +
  'PLATES with a swirling starfield/nebula texture inside the plates, bright glowing ' +
  'CYAN-TEAL energy veins and luminous seams tracing along every armor plate, joint ' +
  'and muscle, a brilliant white-hot radiant STAR-BURST core blazing on the chest, an ' +
  'angular horned helmet with one fierce glowing golden eye. Regal, powerful, ' +
  'menacing, cosmic. Clean bold cel-shaded anime game-sprite style with a crisp dark ' +
  'outline and glossy highlights (NOT photoreal, NOT 3D render). Pure transparent ' +
  'background, alpha only — absolutely NO scene, NO ground, NO wall, NO crystals, NO ' +
  'backdrop, NO text. A single centered full-body figure with a clean transparent ' +
  'margin on all sides.';

// v2 — NEW POSE (text->sprite, /assets/image): 3/4 side view, arms lowered.
// Pose can't be changed by img2img (edit preserves the silhouette), so this
// generates fresh from a prompt that carries the cand2 titan design + new pose.
const NEWPOSE_PROMPT =
  'A majestic cosmic ARMORED STAR-TITAN boss, full body, standing UPRIGHT and facing ' +
  'roughly forward. Both arms are STRAIGHT DOWN, relaxed at his sides with fists near ' +
  'the hips — NOT flexing, NOT raised, arms LOWERED. His HEAD and FACE are turned about ' +
  '45 degrees to the RIGHT (a three-quarter face looking to the viewer\'s right). A ' +
  'calm, powerful, commanding stance, feet planted apart. ' +
  'DESIGN (keep it CLEAN and POLISHED, well-defined armor plates — NOT cluttered, NOT ' +
  'over-detailed, NOT busy): heavy interlocking deep blue-and-violet GALAXY ARMOR ' +
  'PLATES with a swirling starfield / spiral-nebula texture inside the plates, bright ' +
  'glowing CYAN-TEAL energy veins and luminous seams tracing the armor plates and ' +
  'joints, a brilliant white-hot radiant STAR-BURST core blazing on the chest, an ' +
  'angular helmet with two curved horns and fierce glowing golden eyes. Regal, ' +
  'powerful, menacing, cosmic. Clean bold cel-shaded anime game-sprite / sticker ' +
  'style, crisp dark outline, glossy highlights (NOT photoreal, NOT 3D render, NOT ' +
  'gritty). Pure transparent background, alpha only — absolutely NO scene, NO ground, ' +
  'NO wall, NO crystals, NO backdrop, NO text. A single centered full-body figure — ' +
  'the WHOLE body including both feet is inside the frame with a clean transparent ' +
  'margin on all sides.';

// v3 — HEAD TURN (img2img on a chosen clean arms-down candidate): keep the
// exact design/pose, rotate ONLY the head ~45deg right. Preserves the liked
// "initial restyle" look while honoring the face-45-right ask.
const HEADTURN_PROMPT =
  'Keep this cosmic armored star-titan character UNCHANGED — identical armor design, ' +
  'colors, galaxy plates, glowing star-burst chest, glowing cyan seams, the SAME ' +
  'body pose (do not move the arms or legs), same body position, same framing and size. ONLY ' +
  'change the HEAD: turn his head and face about 45 degrees to the RIGHT so he looks ' +
  'toward the viewer\'s right in a three-quarter view (we see more of the right side ' +
  'of the face, the twin horns angle to the side, the glowing eyes look rightward). ' +
  'Change NOTHING else. Clean bold cel-shaded game-sprite style, crisp dark outline, ' +
  'glossy. Pure transparent background, alpha only — no scene, no ground, no backdrop, ' +
  'no text.';

// v4 — CEL-SHADE (img2img on a chosen candidate): keep the exact character,
// pose (arms down, head 45deg right) and composition; convert ONLY the render
// to clean FLAT cel-shading to match the user's reference (less painterly, less
// nebula-noise, bold outlines, crisp glowing lines).
const CELSHADE_PROMPT =
  'Re-render this exact cosmic armored star-titan in a CLEAN FLAT CEL-SHADED anime ' +
  'style (polished 2D game / anime look). Keep the EXACT same character, pose, ' +
  'composition, framing, the arms-straight-down stance and the head turned ~45 degrees ' +
  'to the right. CHANGE ONLY THE RENDERING to cel-shading: FLAT solid color regions ' +
  'with just 2-3 HARD cel-shade steps per area and crisp hard-edged shadows — ' +
  'absolutely NO soft gradients, NO airbrushed shading, NO glossy 3D sheen, NO busy ' +
  'nebula sparkle noise or speckle texture, NO photoreal rendering. BOLD, clean, ' +
  'uniform dark outlines around every shape and plate. Deep blue-and-violet armor ' +
  'plates with BRIGHT GLOWING CYAN energy lines tracing the seams as clean crisp ' +
  'glowing strokes (not fuzzy), a bright glowing white star-burst on the chest, ' +
  'glowing golden eyes, a twin-horn helmet. Simple, clean, readable, vibrant, high ' +
  'contrast. Pure transparent background, alpha only — no scene, no ground, no ' +
  'backdrop, no text.';

// v5 — REFERENCE MATCH (fresh text->sprite): a whole new generation modelled on
// the user's reference titan — a CEL-SHADED cosmic galaxy-muscle titan with
// glowing cyan energy veins, a star-burst chest, and a spiky horned helm (NOT
// the heavy full-plate look the edits drifted into).
const REF_PROMPT =
  'A FULL-BODY WIDE SHOT of a cosmic STAR-TITAN boss for a 2D action game — the ENTIRE ' +
  'figure from the tips of the helmet horns down to the BOTTOM OF THE BOOTS is fully ' +
  'visible and SMALL in frame, zoomed OUT, with generous empty transparent margin ' +
  'above the head and below the feet. He STANDS on both feet. Absolutely NOT cropped, ' +
  'NOT a bust or close-up, NOT cut off at the waist / hips / thighs / knees — the ' +
  'whole body including both full legs and both boots is inside the frame. ' +
  'POSE: front view (slight 3/4 angle), menacing imposing stance leaning slightly ' +
  'forward, both arms LOWERED at his sides and slightly out, hands as ready fists — ' +
  'NOT flexing, NOT raised. ' +
  'HEAD: a FULL CLOSED angular spiky HORNED HELMET that COMPLETELY COVERS the face — ' +
  'ONLY two fierce glowing golden-yellow eye-slits are visible. Absolutely NO visible ' +
  'mouth, NO jaw, NO chin, NO teeth, NO nose, NO exposed face or skin — a sealed ' +
  'knight/mecha helm showing only the glowing eyes. ' +
  'BODY (THIS IS THE KEY FEATURE — do NOT make him plain grey metal): his muscular ' +
  'body / skin is a vivid COSMIC GALAXY — deep blue, violet and magenta with a bright ' +
  'starfield — and PROMINENT BRIGHT GLOWING CYAN-TEAL ENERGY VEINS glow all across the ' +
  'arms, chest, abs and legs like circuitry of light. A brilliant radiant white ' +
  'STAR-BURST blazes at the centre of the chest. The galaxy skin and glowing cyan ' +
  'veins MUST be clearly visible over most of the body. Dark angular armor plates ONLY ' +
  'on the shoulders, forearms, hands, hips and shins/boots. A closed helmet as above. ' +
  'STYLE: draw it CEL-SHADED — render the galaxy as BOLD FLAT color shapes ' +
  '(blue / violet / magenta) with clean bright glowing cyan vein-lines and a scatter ' +
  'of bright star dots, using only 2 HARD cel-shade steps and BOLD clean uniform dark ' +
  'outlines. High contrast, vibrant, clean, readable. NO soft airbrushed nebula, NO ' +
  'photoreal, NO gradient bloom, NOT a 3D render — but the cosmic galaxy body and ' +
  'glowing cyan veins stay VIVIDLY present (NOT solid flat grey, NOT plain metal). ' +
  'Pure transparent background, alpha only — NO scene, NO ground, NO wall, NO crystals, ' +
  'NO backdrop, NO text.';

// v6 — MERGE (img2img on the ORIGINAL game sprite): an in-between of image 1
// (the clean cel-shaded flexed Gravitos) and image 2 (the detailed cosmic titan
// with glowing cyan veins). Keep image 1's pose/clean style, infuse image 2's
// glowing veins + cosmic galaxy detail.
const MERGE_BASE = join(dirname(SRC), '_backup_gravitos', 'gravitos.png');
const MERGE_PROMPT =
  'Enhance this cosmic titan game-sprite into an IN-BETWEEN of its current clean look ' +
  'and a more detailed cosmic star-titan. KEEP the EXACT same pose, silhouette, ' +
  'framing, proportions, the arms-raised double-biceps flex, the clean CEL-SHADED ' +
  'game-sprite style with bold dark outlines, the angular glowing-eye helmet and the ' +
  'brilliant white glowing STAR-BURST on the chest. ADD, blended in: brighter and MORE ' +
  'PROMINENT GLOWING CYAN-TEAL ENERGY VEINS and glowing energy lines tracing all along ' +
  'the arms, chest, abs and legs; a richer deep blue-and-violet cosmic GALAXY / ' +
  'starfield across the whole body; and slightly more defined dark angular armor edges ' +
  'on the shoulders and forearms. Keep the vivid cosmic galaxy body and glowing cyan ' +
  'veins VERY visible — do NOT turn him into plain grey metal armor. Clean flat ' +
  'cel-shading, crisp glowing lines, bold outlines, vibrant, high contrast. Pure ' +
  'transparent background, alpha only — no scene, no ground, no backdrop, no text.';

// v7 — TOWARD REFERENCE (img2img on a chosen candidate): push the merge MORE
// toward image 2 — heavier cosmic ARMOR PLATES with glowing cyan seams + a more
// angular spiky horned helm — while keeping the galaxy body, glowing veins,
// pose and cel-shaded style (and NOT flipping to plain grey metal).
const TOWARD2_PROMPT =
  'Push this cosmic titan game-sprite MORE toward a heavily-armored cosmic star-titan. ' +
  'KEEP the EXACT same pose (arms-raised double-biceps flex), silhouette, framing, ' +
  'proportions, the clean CEL-SHADED style with bold dark outlines, the glowing ' +
  'star-burst chest and glowing eyes. CHANGES: give him MORE armored plating — sleek ' +
  'angular deep blue-violet ARMOR PLATES with a cosmic galaxy / starfield INSIDE the ' +
  'plates and BRIGHT GLOWING CYAN energy seams and veins tracing between the plates, ' +
  'covering the shoulders, chest, arms, thighs and shins; and a more ANGULAR SPIKY ' +
  'HORNED HELMET with a pointed crest and fierce glowing golden-yellow eyes (a mostly ' +
  'sealed helm, minimal visible face). The cosmic GALAXY and BRIGHT GLOWING CYAN VEINS ' +
  'MUST stay vivid all over — do NOT make him plain grey metal, keep the deep ' +
  'blue-violet galaxy and cyan glow. Clean flat cel-shading, crisp glowing lines, bold ' +
  'outlines, vibrant, high contrast. Pure transparent background, alpha only — no ' +
  'scene, no ground, no backdrop, no text.';

// v8 — NEW REFERENCE (2026-07-16, img2img on the ORIGINAL sprite): the user's
// second reference is a FULL HEAVY PLATE armored titan — deep indigo-blue
// interlocking plates with CLEAN NEON-CYAN TRON-LINE seams (crisp light
// strips, not fuzzy veins), a huge radiant multi-point WHITE STARBURST on the
// chest, a sealed angular crested helm with twin golden eyes — and the head
// turned ~45° to the viewer's RIGHT. Keep the original's exact double-biceps
// flex pose (same pose family as form 2), silhouette and framing.
const NEWREF_PROMPT =
  'Restyle this cosmic titan boss game-sprite, KEEPING THE EXACT SAME POSE, ' +
  'silhouette, framing, scale and proportions — both arms raised in a powerful ' +
  'double-biceps flex, wide planted power stance. NEW LOOK (full heavy armor): the ' +
  'ENTIRE body is clad in sleek interlocking DEEP INDIGO-BLUE ARMOR PLATES with a ' +
  'subtle dark starfield sheen inside the plates. Along every plate seam run CLEAN, ' +
  'CRISP NEON-CYAN LIGHT LINES — sharp glowing TRON-style energy strips tracing the ' +
  'chest, arms, legs and joints (bold clean glowing strokes, NOT fuzzy veins, NOT ' +
  'lightning). A huge BRILLIANT WHITE MULTI-POINT STARBURST blazes at the centre of ' +
  'the chest, radiating thin white rays across the breastplate. The head is a SEALED ' +
  'angular crested helm with a short pointed crest and TWO fierce glowing ' +
  'GOLDEN-YELLOW eyes (no visible mouth or face). HEAD TURNED about 45 degrees to ' +
  'the viewer\'s RIGHT — a three-quarter face looking right; body stays front-on. ' +
  'Majestic, powerful, imposing. Clean bold cel-shaded anime game-sprite style, ' +
  'crisp dark outlines, glossy highlights (NOT photoreal, NOT 3D). Pure transparent ' +
  'background, alpha only — NO scene, NO ground, NO crystals, NO backdrop, NO text.';

const N = Number(arg('--n') || 4);
const API = process.env.LUDO_API_BASE || 'https://api.ludo.ai/api';
const TIMEOUT = Number(process.env.LUDO_REQ_TIMEOUT_MS || 180000);

async function doGenerate() {
  const apiKey = process.env.LUDO_API_KEY;
  if (!apiKey) { console.error('LUDO_API_KEY required.'); process.exit(1); }
  if (!(await exists(SRC))) { console.error('missing ' + SRC); process.exit(1); }
  await mkdir(REVIEW, { recursive: true });
  const newpose = has('--newpose');
  const ref = has('--ref');
  const t2i = newpose || ref;           // text->sprite modes (fresh generation)
  const t2iPrompt = ref ? REF_PROMPT : NEWPOSE_PROMPT;
  const headturn = arg('--headturn');   // edit a chosen review candidate: rotate head
  const celshade = arg('--celshade');   // edit a chosen review candidate: flat cel-shade
  const merge = has('--merge');         // edit the ORIGINAL sprite: merge toward image 2
  const toward2 = arg('--toward2');     // edit a chosen candidate: push toward image 2 (more armor)
  const newref = has('--newref');       // v8: edit the ORIGINAL sprite toward the 2nd user reference (tron-plate titan, head 45° right)
  const editcand = headturn || celshade || toward2;
  // img2img edit uses SRC by default; --merge edits the original backup; --headturn/
  // --celshade/--toward2 edit a chosen review candidate.
  const editSrc = merge ? MERGE_BASE : (editcand ? join(REVIEW, `gravitos_cand${editcand}.png`) : SRC);
  const editPrompt = merge ? MERGE_PROMPT : toward2 ? TOWARD2_PROMPT : (celshade ? CELSHADE_PROMPT : (headturn ? HEADTURN_PROMPT : (newref ? NEWREF_PROMPT : PROMPT)));
  const buf = await readFile(editSrc);
  const dataUri = `data:image/png;base64,${buf.toString('base64')}`;
  const mode = merge ? 'MERGE edit of original' : toward2 ? `TOWARD-REF edit of cand${toward2}` : ref ? 'REFERENCE text->sprite' : celshade ? `CEL-SHADE edit of cand${celshade}` : headturn ? `HEAD-TURN edit of cand${headturn}` : newref ? 'NEW-REF v8 edit of original (tron-plate, head 45R)' : (newpose ? 'NEW POSE text->sprite' : 'img2img restyle');
  console.log(`Generating ${N} Gravitos candidates (${mode}) -> scripts/_gravitos_review/ ...`);
  for (let i = 1; i <= N; i++) {
    const dest = join(REVIEW, `gravitos_cand${i}.png`);
    if (!has('--force') && await exists(dest)) { console.log(`skip cand${i} (exists)`); continue; }
    let ok = false, last;
    for (let a = 1; a <= 3 && !ok; a++) {
      try {
        const res = t2i
          ? await fetch(`${API}/assets/image`, {
              method: 'POST', headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
              signal: AbortSignal.timeout(TIMEOUT),
              body: JSON.stringify({ image_type: 'sprite', art_style: 'Illustration', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt: t2iPrompt }),
            })
          : await fetch(`${API}/assets/image/edit`, {
          method: 'POST', headers: { Authorization: `ApiKey ${apiKey}`, 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(TIMEOUT),
          body: JSON.stringify({ image: dataUri, prompt: editPrompt, n: 1, augment_prompt: false }),
        });
        if (!res.ok) { const t = await res.text(); if (/\b402\b/.test(t)) { console.error('402 OUT OF CREDITS'); process.exit(3); } throw new Error(res.status + ': ' + t.slice(0, 160)); }
        const data = await res.json();
        const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
        if (!url) throw new Error('no url');
        await writeFile(dest, await fetchBuf(url));
        console.log(`OK cand${i} -> ${dest.replace(repoRoot, '.')}`);
        ok = true;
      } catch (e) { last = e; if (a < 3) await sleep(3000 * a); }
    }
    if (!ok) console.error(`FAIL cand${i}: ${last && last.message}`);
    await sleep(800);
  }
  console.log('\nReview scripts/_gravitos_review/, then: node scripts/regen_gravitos_form1.mjs --install <i>');
}

// Content bbox (alpha>16) of an image buffer -> {x,y,w,h,W,H}.
async function contentBox(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: c } = info;
  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (data[(y * W + x) * c + 3] > 16) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  if (maxX < 0) return { x: 0, y: 0, w: W, h: H, W, H };
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, W, H };
}

async function doInstall(idx) {
  const cand = join(REVIEW, `gravitos_cand${idx}.png`);
  if (!(await exists(cand))) { console.error('no such candidate: ' + cand); process.exit(1); }
  const bdir = join(dirname(SRC), '_backup_gravitos');
  await mkdir(bdir, { recursive: true });
  // Reference framing = the ORIGINAL sprite (prefer the pristine backup if the
  // live file was already overwritten by a prior install run).
  const backupPath = join(bdir, basename(SRC));
  const refPath = (await exists(backupPath)) ? backupPath : SRC;
  const ref = await readFile(refPath);
  const rb = await contentBox(ref);                       // original canvas + figure box
  if (!(await exists(backupPath)) && await exists(SRC)) await copyFile(SRC, backupPath);
  // New figure, trimmed to its own content.
  const nb = await contentBox(await readFile(cand));
  const nTrim = await sharp(await readFile(cand)).extract({ left: nb.x, top: nb.y, width: nb.w, height: nb.h }).png().toBuffer();
  // Scale the new figure to the ORIGINAL figure's HEIGHT (bosses anchor by foot
  // line + scale by source dims — matching height keeps both identical). An
  // arms-down pose is shorter than the old arms-raised one, so --hscale (e.g.
  // 0.85) trims the target height to keep the BODY the same apparent size
  // instead of inflating it to fill the old arms-up envelope.
  const hscale = Number(arg('--hscale') || 1);
  const scaledH = Math.round(rb.h * hscale), scaledW = Math.round(nb.w * (scaledH / nb.h));
  const scaled = await sharp(nTrim).resize(scaledW, scaledH, { fit: 'fill' }).png().toBuffer();
  // Place on a canvas the SAME size as the original, feet on the original foot
  // line (rb.y+rb.h), horizontally centered on the original figure's centre.
  const left = Math.round(rb.x + rb.w / 2 - scaledW / 2);
  const top = Math.round(rb.y + rb.h - scaledH);
  const out = await sharp({ create: { width: rb.W, height: rb.H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: scaled, left: Math.max(0, left), top: Math.max(0, top) }]).png().toBuffer();
  const tmp = SRC + '.tmp'; await writeFile(tmp, out);
  const { rename } = await import('node:fs/promises'); await rename(tmp, SRC);
  console.log(`Installed cand${idx} -> ${SRC.replace(repoRoot, '.')} (${rb.W}x${rb.H}, figure ${scaledW}x${scaledH} @ orig foot line). Backup in _backup_gravitos/.`);
}

const inst = arg('--install');
if (inst) await doInstall(inst);
else if (has('--generate')) await doGenerate();
else { console.log('# Gravitos 1st-form img2img restyle.\n# 1) LUDO_API_KEY=... node scripts/regen_gravitos_form1.mjs --generate\n# 2) review scripts/_gravitos_review/*.png\n# 3) node scripts/regen_gravitos_form1.mjs --install <i>\n\nPROMPT:\n' + PROMPT); }
