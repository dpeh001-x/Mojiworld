// LIBRA'S SCALE PROJECTILE ART: a wide golden sigil, composed for the shot.
// ============================================================================
// Per user: "regenerate a better sprite using ludo.ai for the libra's scale,
// it looks weird at present". The old set was an upright balance scale on a
// square canvas, spun slowly in flight inside a 45x18 beam hitbox. The new set
// (scripts/gen_libra_scale_ludo.mjs) is a golden medallion bearing the balance
// emblem with light streaking both ways — wide, centre-symmetric — and the
// blit no longer spins it, and draws it large enough to fill the hitbox.
// Node-only (sharp): reads the frames from LIBRA_ART_DIR (default the repo's
// Sprites/projectiles) and the blit entry from MOJI_GAME_FILE.
// Run: node scripts/libra_scale_art_test.mjs
import sharp from 'sharp';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ART = process.env.LIBRA_ART_DIR || path.join(ROOT, 'Sprites', 'projectiles');
const GAME = process.env.MOJI_GAME_FILE_PATH || path.join(ROOT, 'mojiworld_game.html');
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 220) });
async function box(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let l = info.width, t = info.height, r = -1, b = -1, opaque = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) { const a = data[(y * info.width + x) * 4 + 3]; if (a > 24) { opaque++; if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; if (y > b) b = y; } }
  return { w: info.width, h: info.height, alpha: info.channels === 4, l, t, r, b, cw: r - l + 1, ch: b - t + 1, cx: (l + r) / 2, cy: (t + b) / 2, opaque, hash: data.reduce((h, v, i) => (i % 7 === 0 ? (h * 31 + v) >>> 0 : h), 7) };
}
const frames = [];
for (let i = 0; i < 9; i++) { const f = path.join(ART, 'anim', `scale_${i}.webp`); frames.push(existsSync(f) ? await box(f) : null); }
const still = existsSync(path.join(ART, 'p_scale.webp')) ? await box(path.join(ART, 'p_scale.webp')) : null;
ok('all nine animation frames exist at 656×656 with alpha', frames.every((f) => f && f.w === 656 && f.h === 656 && f.alpha), frames.map((f, i) => f ? `${i}:${f.w}x${f.h}` : `${i}:missing`).join(' '));
ok('the still exists at 512×512 with alpha', still && still.w === 512 && still.h === 512 && still.alpha, still ? `${still.w}x${still.h}` : 'missing');
const good = frames.filter(Boolean);
ok('the art is WIDE — a beam, not an upright scale (content aspect ≥ 2.2 on every frame)', good.length === 9 && good.every((f) => f.cw / f.ch >= 2.2), good.map((f) => (f.cw / f.ch).toFixed(2)).join(' '));
ok('the content is centred on the canvas (within 8px) on every frame, so the spin-free blit sits on the hitbox', good.length === 9 && good.every((f) => Math.abs(f.cx - 327.5) <= 8 && Math.abs(f.cy - 327.5) <= 8), good.map((f) => `${f.cx.toFixed(0)},${f.cy.toFixed(0)}`).join(' '));
ok('the content fills ~62% of the canvas width (the size the blit is tuned for)', good.length === 9 && good.every((f) => f.cw >= 656 * 0.55 && f.cw <= 656 * 0.70), good.map((f) => f.cw).join(' '));
ok('the frames animate (not nine identical images) yet do not drift (bbox within 10px across the set)', good.length === 9 && new Set(good.map((f) => f.hash)).size >= 5 && Math.max(...good.map((f) => f.cw)) - Math.min(...good.map((f) => f.cw)) <= 30 && Math.max(...good.map((f) => f.cy)) - Math.min(...good.map((f) => f.cy)) <= 10,
  `distinct ${new Set(good.map((f) => f.hash)).size}; width spread ${Math.max(...good.map((f) => f.cw)) - Math.min(...good.map((f) => f.cw))}`);
const game = existsSync(GAME) ? readFileSync(GAME, 'utf8') : '';
const blit = game.match(/scale:\s*\{[^}]*\}/);
ok("the blit no longer spins the scale and draws it at 1.6× the hitbox width", !!blit && /mode:\s*'spin'/.test(blit[0]) && /spinRate:\s*0\b/.test(blit[0]) && /size:\s*1\.6/.test(blit[0]), blit ? blit[0] : 'no blit entry');
let fail = 0;
for (const x of res) { if (!x.pass) fail++; console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.extra ? '  — ' + x.extra : '')); }
console.log(`\n${res.length - fail}/${res.length} checks passed`);
process.exit(fail ? 1 : 0);
