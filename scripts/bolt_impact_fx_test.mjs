// Live test: the Magic Bolt's contact ENERGY BURST.
// Per user: "after it comes into contact with a monster have an animation
// where the magic bolt does an energy burst".
//   node scripts/bolt_impact_fx_test.mjs [port]   (MOJI_GAME_FILE honored)
import { chromium } from 'playwright-core';
import { existsSync, readFileSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const GAME = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';

// ---- the art ships ---------------------------------------------------------
const frames = [];
for (let i = 0; i < 8; i++) frames.push(`Sprites/fx/anim/bolt_impact_${i}.webp`);
ok('the still burst sprite ships', existsSync('Sprites/fx/bolt_impact.webp'), '');
ok('all 8 burst frames ship', frames.every(existsSync), frames.filter(f => !existsSync(f)));
{
  const idx = readFileSync('data/sprite_frame_index.js', 'utf8');
  ok('the frame index records the set (so the loader asks for exactly 8)', /"bolt_impact":\s*8/.test(idx), '');
}

// ---- EDGE FEATHER (per user: "feather the edges") --------------------------
// The raw ludo roll put alpha-255 pixels hard on the frame border in 7 of 8
// frames, so the burst read as a rectangle guillotining its own shards. Every
// write now ramps alpha to zero over the outer 56 px. Graded on the files:
// nothing opaque may touch the border, and the interior must survive the ramp
// (a feather that ate the burst would also pass an edges-are-clear check).
{
  const sharp = (await import('sharp')).default;
  let worstEdge = 0, thinnest = Infinity;
  for (const f of ['Sprites/fx/bolt_impact.webp', ...frames]) {
    const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width: W, height: H, channels: C } = info;
    const at = (x, y) => data[(y * W + x) * C + 3];
    for (let x = 0; x < W; x++) for (const y of [0, 1, H - 2, H - 1]) if (at(x, y) > worstEdge) worstEdge = at(x, y);
    for (let y = 0; y < H; y++) for (const x of [0, 1, W - 2, W - 1]) if (at(x, y) > worstEdge) worstEdge = at(x, y);
    let core = 0;
    for (let y = 80; y < H - 80; y++) for (let x = 80; x < W - 80; x++) if (at(x, y) > 20) core++;
    if (core < thinnest) thinnest = core;
  }
  ok('edges are feathered: nothing opaque touches any frame border', worstEdge <= 8, { worstBorderAlpha: worstEdge });
  ok('...and the feather did not eat the burst (interior survives)', thinnest > 20000, { thinnestInterior: thinnest });
}

const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext()).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
const bad = []; page.on('response', r => { if (r.status() >= 400 && /bolt_impact/.test(r.url())) bad.push(r.status() + ' ' + r.url().split('/').pop()); });
await page.goto(`http://localhost:${PORT}/${GAME}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof updateProjectiles === 'function' && typeof _FX_ANIM_KEYS !== 'undefined', null, { timeout: 120000 });
await page.waitForLoadState('load', { timeout: 120000 }).catch(() => {});
await page.waitForTimeout(2000);

const r = await page.evaluate(async () => {
  const out = {};
  game.paused = false;
  const cs = document.getElementById('class-select-modal'); if (cs) cs.style.display = 'none';
  out.registered = _FX_ANIM_KEYS.has('bolt_impact');
  out.spriteKnown = !!(LX_FX && LX_FX.bolt_impact);
  // the frame set decodes (async images — poll)
  const fr = (typeof _fxAnimFrames === 'function') ? _fxAnimFrames('bolt_impact') : null;
  out.frameCount = fr ? fr.length : 0;
  const t0 = Date.now();
  while (fr && Date.now() - t0 < 12000 && !fr.every(im => im && im.complete)) await new Promise(z => setTimeout(z, 200));
  out.decoded = fr ? fr.filter(im => im && im.complete && im.naturalWidth > 0).length : 0;

  player.cls = 'mage'; player.level = 30; player.x = 400; player.y = 300;
  const mk = () => { const m = { x: player.x + 60, y: player.y, w: 40, h: 40, hp: 1e9, maxHp: 1e9, currentHp: 1e9,
    def: 0, type: 'slime', level: 1, speed: 0, facing: 1, vx: 0, vy: 0, _noGravity: true, name: 'dummy' };
    game.monsters.length = 0; game.monsters.push(m); return m; };
  const shoot = (skill, alwaysCrit) => {
    game.projectiles.length = 0;
    const before = (game.smoothFx || []).filter(f => f && f.spriteKey === 'bolt_impact').length;
    game.projectiles.push({ x: player.x + 40, y: player.y + 10, vx: 6, vy: 0, w: 20, h: 12, life: 60,
      damage: 50, owner: 'player', skill, alwaysCrit: !!alwaysCrit, _noGravity: true, noGravity: true });
    for (let f = 0; f < 20 && game.projectiles.length; f++) updateProjectiles(16);
    const fx = (game.smoothFx || []).filter(f => f && f.spriteKey === 'bolt_impact');
    return { spawned: fx.length - before, last: fx[fx.length - 1] || null };
  };
  // v0.30.x - THE REAL CAST. The original suite pushed a SYNTHETIC projectile
  // with skill:'bolt', which is why it passed green while the effect was dead
  // in play: it never went through the spawn gate. Drive SKILL_FNS.magicBolt()
  // and let the projectile fly into a dummy, exactly as a player does.
  const realCast = (withBoss) => {
    game.monsters.length = 0; game.projectiles.length = 0;
    if (game.smoothFx) game.smoothFx.length = 0;
    if (game._lowFxCache) game._lowFxCache = null;
    player.cls = 'mage'; player.job = 'archmage'; player.level = 60;
    player.facing = 1; player.mp = 9999; player.hp = getMaxHp();
    player.skillCooldowns = {}; player._castLockUntil = 0;
    const m = { x: player.x + 150, y: player.y, w: 40, h: 40, hp: 1e9, maxHp: 1e9, currentHp: 1e9,
      def: 0, type: 'slime', level: 1, speed: 0, facing: 1, vx: 0, vy: 0, _noGravity: true, name: 'dummy' };
    game.monsters.push(m);
    if (withBoss) {
      // a live boss trips _perfLowFx() — the gate that silently ate the burst
      game.monsters.push({ x: player.x - 600, y: player.y, w: 90, h: 90, hp: 1e9, maxHp: 1e9,
        currentHp: 1e9, def: 0, type: 'slime', level: 60, speed: 0, facing: 1, vx: 0, vy: 0,
        _noGravity: true, name: 'bossy', isBoss: true });
    }
    SKILL_FNS.magicBolt();
    for (let f = 0; f < 40; f++) {
      updateProjectiles(16);
      const bs = (game.smoothFx || []).filter(x => x && x.spriteKey === 'bolt_impact');
      if (bs.length) return { spawned: bs.length, size: Math.round(bs[0].size), life: bs[0].maxLife, hurt: m.currentHp < 1e9 };
    }
    return { spawned: 0, size: 0, life: 0, hurt: m.currentHp < 1e9 };
  };
  out.real = realCast(false);
  out.realBoss = realCast(true);
  out.lowFxWithBoss = (typeof _perfLowFx === 'function') ? _perfLowFx() : null;

  // ...and it must reach the SCREEN as animated frames, not the static sprite.
  {
    game.monsters.length = 0; game.projectiles.length = 0;
    if (game.smoothFx) game.smoothFx.length = 0;
    const drawn = [];
    const proto = CanvasRenderingContext2D.prototype;
    const oDI = proto.drawImage;
    proto.drawImage = function (img, ...a) {
      try { const src = (img && img.src) || ''; if (/bolt_impact/.test(src)) drawn.push(src.split('/').pop()); } catch (e) {}
      return oDI.call(this, img, ...a);
    };
    try {
      const m2 = { x: player.x + 150, y: player.y, w: 40, h: 40, hp: 1e9, maxHp: 1e9, currentHp: 1e9,
        def: 0, type: 'slime', level: 1, speed: 0, facing: 1, vx: 0, vy: 0, _noGravity: true, name: 'd2' };
      game.monsters.push(m2);
      player.skillCooldowns = {}; player._castLockUntil = 0;
      SKILL_FNS.magicBolt();
      for (let f = 0; f < 60; f++) {
        updateProjectiles(16);
        if (typeof updateSmoothFx === 'function') updateSmoothFx(16);
        else for (const fx of (game.smoothFx || [])) if (fx && fx.life > 0) fx.life -= 1;
        try { drawSmoothFx(); } catch (e) {}
      }
    } finally { proto.drawImage = oDI; }
    out.drawn = { total: drawn.length, uniq: [...new Set(drawn)].sort(),
      animated: drawn.filter(f => f !== 'bolt_impact.webp').length,
      still: drawn.filter(f => f === 'bolt_impact.webp').length };
  }

  mk(); const boltHit = shoot('bolt', false);
  out.bolt = { spawned: boltHit.spawned, size: boltHit.last && Math.round(boltHit.last.size) };
  mk(); const critHit = shoot('bolt', true);
  out.crit = { spawned: critHit.spawned, size: critHit.last && Math.round(critHit.last.size) };
  mk(); const arrowHit = shoot('arrow', false);
  out.arrow = { spawned: arrowHit.spawned };
  game.monsters.length = 0; game.projectiles.length = 0;
  return out;
});
ok('the key is registered as an ANIMATED fx (not a lone still)', r.registered === true && r.spriteKnown === true, r);
ok('the loader asks for 8 frames and they decode', r.frameCount === 8 && r.decoded === 8, { want: 8, frames: r.frameCount, decoded: r.decoded });
ok('a bolt hitting a monster spawns the burst', r.bolt.spawned === 1, r.bolt);
ok('a CRIT blooms wider than a normal hit', r.crit.size > r.bolt.size, { crit: r.crit.size, normal: r.bolt.size });
ok('an arrow hit spawns NO bolt burst (bolt-only, per the tag guard)', r.arrow.spawned === 0, r.arrow);
// v0.30.x — the checks that would have caught the dead effect.
ok('THE REAL CAST spawns the burst (SKILL_FNS.magicBolt, not a synthetic projectile)',
   r.real.spawned === 1 && r.real.hurt === true, r.real);
ok('...and it still spawns WITH A BOSS ALIVE (the low-fx gate used to eat it)',
   r.realBoss.spawned === 1 && r.lowFxWithBoss === true, { boss: r.realBoss, lowFx: r.lowFxWithBoss });
ok('...at a readable size (140 normal / 190 crit) over 30 ticks', r.real.size === 140 && r.real.life === 30, r.real);
ok('the burst reaches the screen as ANIMATED frames, not the static sprite',
   r.drawn.animated > 0 && r.drawn.animated >= r.drawn.still, r.drawn);
ok('no frame index runs past the end of the 8-frame set (no static blip mid-burst)',
   !r.drawn.uniq.includes('bolt_impact_8.webp'), r.drawn.uniq);
ok('no 404s on the burst art', bad.length === 0, bad.slice(0, 4));
ok('no page errors', errs.length === 0, errs.slice(0, 3));
for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
