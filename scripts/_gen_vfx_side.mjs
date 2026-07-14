// Regenerate 4 shared VFX in cute 2D-sidescroller (side-view) style via ludo.ai.
// 3 candidates each -> scripts/_vfx_review/. Cute, ~2px black outline, transparent.
import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
sharp.cache(false);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const REV = join(root, 'scripts', '_vfx_review');
const KEY = process.env.LUDO_API_KEY;
const API = 'https://api.ludo.ai/api';
const STYLE = ' Cute chibi platformer game-VFX sticker, bold simple shapes, a thin even ~2px BLACK OUTLINE around every edge, flat cel colors with a glossy highlight. FULLY TRANSPARENT background (alpha only) — no panel, no frame, no scene, no ground plane behind it. NO text, no letters.';
const JOBS = {
  lightning_pillar: 'A tall vertical CARTOON LIGHTNING BOLT column striking straight down — one jagged electric bolt, bright electric-blue and white glowing core, a few spark bits around it. Tall vertical composition, centered.' + STYLE,
  lava_pool: 'A 2D SIDE-SCROLLER LAVA POOL hazard seen EDGE-ON FROM THE SIDE (side elevation, NOT top-down, do not show it as a disc from above): a horizontal molten lava surface with a bright glowing orange-yellow bubbling top waterline, a couple of lava bubbles popping and small embers rising, a dark rocky bank in front. Wide horizontal composition.' + STYLE,
  quake_ring: 'A 2D SIDE-SCROLLER EARTHQUAKE ground-slam shockwave seen FROM THE SIDE (side elevation, NOT top-down): cracked brown ground along a horizontal line with chunks of rock and puffs of tan dust bursting UPWARD and outward to the left and right. Wide symmetric horizontal burst.' + STYLE,
  poison_cloud: 'A 2D SIDE-SCROLLER POISON PUDDLE hazard seen EDGE-ON FROM THE SIDE (side elevation, NOT top-down, not a disc from above): a horizontal bubbling toxic-green poison surface with glossy green bubbles popping and wisps of green toxic gas rising upward. Vibrant toxic green with glow. Wide horizontal composition.' + STYLE,
};
await mkdir(REV, { recursive: true });
const only = process.env.ONLY ? process.env.ONLY.split(',') : Object.keys(JOBS);
for (const key of only) {
  const prompt = JOBS[key];
  for (let i = 1; i <= 3; i++) {
    let ok = false, last;
    for (let a = 1; a <= 3 && !ok; a++) {
      try {
        const res = await fetch(API + '/assets/image', { method: 'POST',
          headers: { Authorization: 'ApiKey ' + KEY, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(180000),
          body: JSON.stringify({ image_type: 'sprite', art_style: 'Anime/Manga', aspect_ratio: 'ar_1_1', n: 1, augment_prompt: false, prompt }) });
        if (!res.ok) throw new Error(res.status + ': ' + (await res.text()).slice(0, 120));
        const data = await res.json();
        const url = Array.isArray(data) ? data[0]?.url : (data?.url || data?.images?.[0]?.url);
        if (!url) throw new Error('no url');
        const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
        await writeFile(join(REV, key + '_c' + i + '.png'), buf);
        console.log('OK', key, 'c' + i);
        ok = true;
      } catch (e) { last = e; if (a < 3) await new Promise(s => setTimeout(s, 3000 * a)); }
    }
    if (!ok) console.error('FAIL', key, 'c' + i, last && last.message);
  }
}
console.log('done');
