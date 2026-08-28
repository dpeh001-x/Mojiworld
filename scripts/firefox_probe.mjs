// What does Firefox actually do with the sprite pipeline?
// ============================================================================
// Two reported symptoms — "very lag" and "sprites will not load" — and one
// suspect that would produce BOTH: _lxBitmapOffThread passes
//   { resizeWidth, resizeHeight, resizeQuality }
// to createImageBitmap, and Firefox has never implemented those options.
//
// This probe does not assume that. It measures, in each engine:
//   1. whether createImageBitmap HONOURS resizeWidth (the shrink working at all)
//   2. whether it honours the same options when fed a Blob (the path the game
//      actually takes on http/file origins)
//   3. whether it throws, or silently returns a full-size bitmap
//
// (1) and (3) are the fork in the road. A throw means the bake rejects and
// frames stay as <img> — slow but visible. A silent full-size return means the
// game believes it shrank and renders 1656px rasters every frame forever.
// Run: node scripts/firefox_probe.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { firefox, chromium } = require('playwright-core');

const FF_DIR = process.env.LOCALAPPDATA + '\\ms-playwright\\firefox-1538\\firefox\\firefox.exe';

const PROBE = async () => {
  // A real 64x64 source, drawn to a canvas then turned into a blob, so both
  // the <img>/canvas path and the Blob path are exercised the way the game
  // exercises them.
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = '#c33'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#3c3'; g.fillRect(0, 0, 32, 32);

  const opts = { resizeWidth: 16, resizeHeight: 16, resizeQuality: 'high' };
  const out = { ua: navigator.userAgent.slice(0, 90) };

  // 1. from the canvas/ImageBitmapSource directly
  try {
    const b = await createImageBitmap(cv, opts);
    out.direct = { w: b.width, h: b.height, honoured: b.width === 16 };
  } catch (e) { out.direct = { threw: String(e && e.message || e).slice(0, 120) }; }

  // 2. from a Blob — the branch _lxBitmapOffThread takes on http:/file:
  try {
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    const b = await createImageBitmap(blob, opts);
    out.blob = { w: b.width, h: b.height, honoured: b.width === 16 };
  } catch (e) { out.blob = { threw: String(e && e.message || e).slice(0, 120) }; }

  // 3. no options at all — the control. If THIS fails the theory is wrong.
  try {
    const b = await createImageBitmap(cv);
    out.plain = { w: b.width, h: b.height };
  } catch (e) { out.plain = { threw: String(e && e.message || e).slice(0, 120) }; }

  // 4. ctx.filter support — the other static suspect (25 uses, incl. url(#goo))
  try {
    const g2 = document.createElement('canvas').getContext('2d');
    out.filterProp = ('filter' in g2);
    g2.filter = 'blur(2px)';
    out.filterBlur = g2.filter;
    g2.filter = 'url(#goo)';
    out.filterUrl = g2.filter;
  } catch (e) { out.filterErr = String(e && e.message || e).slice(0, 120); }

  return out;
};

const run = async (name, launcher, opts) => {
  let b;
  try { b = await launcher.launch(opts); }
  catch (e) { console.log(`\n### ${name}: could not launch — ${String(e.message).slice(0, 140)}`); return null; }
  const p = await b.newPage();
  await p.goto('about:blank');
  const r = await p.evaluate(PROBE);
  await b.close();
  console.log(`\n### ${name}`);
  console.log('  ' + r.ua);
  console.log(`  createImageBitmap(canvas, {resizeWidth:16})  -> ${JSON.stringify(r.direct)}`);
  console.log(`  createImageBitmap(blob,   {resizeWidth:16})  -> ${JSON.stringify(r.blob)}`);
  console.log(`  createImageBitmap(canvas)        [control]   -> ${JSON.stringify(r.plain)}`);
  console.log(`  ctx.filter supported: ${r.filterProp}   blur(2px) -> "${r.filterBlur}"   url(#goo) -> "${r.filterUrl}"`);
  return r;
};

const ff = await run('FIREFOX', firefox, { executablePath: FF_DIR, headless: true });
const cr = await run('CHROMIUM (msedge)', chromium, { channel: 'msedge', headless: true });

if (ff && cr) {
  console.log('\n================ VERDICT ================');
  const ffOk = ff.blob && ff.blob.honoured, crOk = cr.blob && cr.blob.honoured;
  console.log(`resize options honoured — firefox: ${ffOk}   chromium: ${crOk}`);
  if (!ffOk && crOk) {
    const how = ff.blob.threw ? `it THREW: ${ff.blob.threw}`
      : `it SILENTLY IGNORED them and returned ${ff.blob.w}x${ff.blob.h} instead of 16x16`;
    console.log(`CONFIRMED: the shrink is a no-op on Firefox — ${how}`);
  } else if (ffOk) {
    console.log('NOT the cause: Firefox honours the resize options. Look elsewhere.');
  }
}
