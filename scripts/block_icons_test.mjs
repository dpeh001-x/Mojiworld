// The Block (A) icon, per class, in the skill icons' style (v0.30.x block-icons).
//   node scripts/block_icons_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// Per user: "regenerate the block A icon for all classes to better suit the icons in a similar style to the skill icons".
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp'); sharp.cache(false);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '10471';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
// the chosen icons (scripts/gen_block_icons.mjs candidates: warrior v4, rogue v3, mage v4, archer v3, shield v4)
const CHOSEN = {
  warrior: '049c14b0db00b1173a7e3126c5bd7e48fa3b2a92a297f1991264752bd9916c87',
  rogue: '1c11efdb426f34c10b4395ffbb4c81796605edf67ff228dc6fb703c998735f2b',
  mage: '1f93c599c600dcfde7ab9a055ade461644a7bc1970b5ac5d3951dcd4d4571034',
  archer: '9c2e48e07b8b14921c8848a4b2b46d03d24a4cf97c234db600d7d11971692323',
  shield: '5f242980880f1a8989823c0099ca026e603333bc12e42240e36239536897e780',
};

// ---------- the art on disk ----------
const art = {};
for (const [cls, want] of Object.entries(CHOSEN)) {
  const f = path.join(ROOT, 'Sprites', 'ui', `block_${cls}.webp`), b = readFileSync(f);
  const { data, info } = await sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const corners = [[0, 0], [info.width - 1, 0], [0, info.height - 1], [info.width - 1, info.height - 1]].every(([x, y]) => data[(y * info.width + x) * 4 + 3] === 0);
  art[cls] = { hash: createHash('sha256').update(b).digest('hex') === want, w: info.width, h: info.height, corners };
}
console.log('art:', JSON.stringify(art));
check(Object.values(art).every((a) => a.hash), 'all five Block icons (warrior, rogue, mage, archer, and the steel shield before a class) are the regenerated art', Object.fromEntries(Object.entries(art).map(([k, a]) => [k, a.hash])));
check(Object.values(art).every((a) => a.w === 512 && a.h === 512 && a.corners), 'each is 512 px square on a transparent background, like the icons it replaces', art);
const sw = readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
check(/^const CACHE = 'mojiworld-assets-v\d+';[^\n]*Block icons/m.test(sw), 'sw.js moved its cache generation, so a returning browser drops the old icons', (sw.match(/^const CACHE[^\n]*/m) || [])[0]);

// ---------- in the game ----------
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 747 }, serviceWorkers: 'block' })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  // the working copy can lag origin: serve origin's copy of any skill icon missing here (the Block art is always local)
  await page.route((u) => /[/]Sprites[/]skills[/].*[.]webp$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: 'image/webp', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
  });
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof renderSkillBar === 'function' && typeof _lxRefreshBlockIcon === 'function', null, { timeout: 120000 });
  const g = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false;
    player.level = 60; loadMap('duneSands'); await sleep(3000);
    for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
    const out = {};
    for (const cls of ['warrior', 'rogue', 'mage', 'archer', '']) {
      player.cls = cls; player.job = null; player.master = null;
      try { renderSkillBar(); } catch (e) {}
      _lxRefreshBlockIcon(true);
      // the bar can re-render while the map's sprites load: re-find the slot's image each time round, up to 20 s
      const q = () => document.querySelector('#skill-bar .skill-slot.defense img[data-lx-block-icon]');
      let img = q(); for (let i = 0; i < 200 && !(img && img.complete && img.naturalWidth > 0); i++) { await sleep(100); img = q(); }
      const slot = img && img.closest('.skill-slot'), sr = slot && slot.getBoundingClientRect(), ir = img && img.getBoundingClientRect();
      // a skill slot's icon for comparison: its painted size is the element's box x its background-size
      let sk = null; for (let i = 0; i < 60 && !sk; i++) { sk = [...document.querySelectorAll('#skill-bar .skill-slot:not(.defense) .skill-icon')].find((e) => e.dataset.skIco); if (!sk) await sleep(100); }
      const skr = sk && sk.getBoundingClientRect(), skSize = sk ? parseFloat(getComputedStyle(sk).backgroundSize) / 100 : null;
      out[cls || 'none'] = img ? { src: img.getAttribute('src'), nw: img.naturalWidth, slot: Math.round(sr.width), w: +ir.width.toFixed(1), dx: +((ir.left + ir.width / 2) - (sr.left + sr.width / 2)).toFixed(1), dy: +((ir.top + ir.height / 2) - (sr.top + sr.height / 2)).toFixed(1), skill: sk ? { w: +(skr.width * skSize).toFixed(1) } : null } : null;
    }
    return out;
  });
  console.log('in game:', JSON.stringify(g));
  const want = { warrior: 'block_warrior', rogue: 'block_rogue', mage: 'block_mage', archer: 'block_archer', none: 'block_shield' };
  check(Object.entries(want).every(([k, f]) => g[k] && g[k].src === `Sprites/ui/${f}.webp` && g[k].nw === 512), 'each class\'s hotbar Block slot shows its own new icon (and the steel shield before a class), loaded at full size', g);
  check(Object.values(g).every((r) => r && r.w >= r.slot && Math.abs(r.dx) <= 1 && Math.abs(r.dy) <= 1), 'the Block icon fills its slot, centred, cropped by it like a skill icon (it was 24 px under its label)', Object.values(g).map((r) => r && [r.w, r.slot, r.dx, r.dy]));
  check(['warrior', 'rogue', 'mage', 'archer'].every((k) => g[k].skill && Math.abs(g[k].w - g[k].skill.w) <= 1.5), 'and at exactly the size the skill icons beside it are painted', ['warrior', 'rogue', 'mage', 'archer'].map((k) => [g[k].w, g[k].skill && g[k].skill.w]));
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad === 0 ? `\nall ${total} passed` : `\n${bad} of ${total} FAILED`);
process.exit(bad === 0 ? 0 : 1);
