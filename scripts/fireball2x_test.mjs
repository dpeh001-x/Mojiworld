// The falling fireball: twice the size, its hitbox the teardrop you see, its blast a little wider than that (v0.30.x fireball2x).
//   node scripts/fireball2x_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// Per user: "the fireballs should be bigger by about 100% in all instances and hitbox should match it, this applies
// for monsters and skills, ensure it does not look pixelated"; on a crop of the fireball's glowing teardrop, "this part
// of the sprite should be the hitbox"; and "the blast radius is just slightly expanded width from that when it hits the
// ground". Everything runs in a booted game: the real draw (drawImage spied), the real hazard ticker (updateProjectiles),
// the real art (measured off the decoded frame).
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '10411';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
try {
  // render scale 2 (the desktop cap): the case where pixelation would show
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 747 }, deviceScaleFactor: 2, serviceWorkers: 'block' })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  const TBL = path.join(process.env.TEMP || '', 'gs_tables');
  if (existsSync(TBL)) await page.route((u) => /data[/]sprite_(bbox|edges|frame_index)[.]js/.test(u.pathname), (r) => { try { r.fulfill({ status: 200, contentType: 'application/javascript', body: readFileSync(path.join(TBL, r.request().url().split('/').pop().split('?')[0])) }); } catch (e) { r.continue(); } });
  // the working copy can lag origin (art added since): serve origin's copy of any meteor art that is missing here
  await page.route((u) => /Sprites[/]projectiles[/](anim[/]meteor_[0-9]+|p_meteor(_blue)?)[.]webp$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: 'image/webp', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
  });
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof updateProjectiles === 'function' && typeof drawHazards === 'function', null, { timeout: 120000 });
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false;
    player.level = 99; player.cls = 'mage';
    loadMap('duneSands'); game.paused = false;
    await sleep(2500);
    const sb = document.getElementById('story-beat-overlay'); if (sb) { sb.classList.remove('on'); sb.style.display = 'none'; }
    game.monsters = []; game.paused = true;   // the hazard ticker and the draw are driven by hand below
    const out = { hasGeom: typeof _lxMeteorGeom === 'function', hasBlast: typeof _lxMeteorBlast === 'function', dpr: _LX_DPR };
    // the loop frames (behind the boot's sprite queue they can take a while)
    let fr = null; for (let i = 0; i < 300 && !(fr && (fr.naturalWidth || fr.width)); i++) { fr = _projAnimFrame('meteor'); await sleep(100); }
    out.frameLong = fr ? Math.max(fr.naturalWidth || fr.width, fr.naturalHeight || fr.height) : 0;
    out.base = (typeof PROJ_ANIM_FRAMES !== 'undefined' && PROJ_ANIM_FRAMES.meteor) ? PROJ_ANIM_FRAMES.meteor._lxBase : null;
    const camY = (game.camera && game.camera.y) || 0;
    const mk = (o) => Object.assign({ type: 'meteor_warn', cx: 600, x: 510, y: 0, w: 180, h: H, radius: 90, life: 100, maxLife: 100, fireAt: 100, damage: 5000 }, o);
    // ---- the art: the head's width, the rock's top, the flame's bottom (on the decoded source)
    {
      const src = new Image(); src.src = 'Sprites/projectiles/anim/meteor_0.webp'; await src.decode();
      const cv = document.createElement('canvas'); cv.width = src.naturalWidth; cv.height = src.naturalHeight;
      const g = cv.getContext('2d'); g.drawImage(src, 0, 0); const d = g.getImageData(0, 0, cv.width, cv.height).data, Wd = cv.width, Hd = cv.height;
      const rows = []; for (let y = 0; y < Hd; y++) { let a = -1, b = -1; for (let x = 0; x < Wd; x++) if (d[(y * Wd + x) * 4 + 3] > 60) { if (a < 0) a = x; b = x; } rows.push(b >= 0 ? b - a + 1 : 0); }
      const maxW = Math.max(...rows); let inkBot = Hd - 1; while (inkBot > 0 && !rows[inkBot]) inkBot--;
      let rockTop = -1; for (let y = 0; y < Hd && rockTop < 0; y++) { let n = 0; for (let x = 0; x < Wd; x++) { const o = (y * Wd + x) * 4; if (d[o + 3] > 200 && 0.3 * d[o] + 0.59 * d[o + 1] + 0.11 * d[o + 2] < 70) n++; } if (n >= 8) rockTop = y; }
      out.art = { w: maxW / Wd, rockTop: rockTop / Hd, bottom: inkBot / Hd };
    }
    // ---- the draw: spy the blits; a cropped blit (9 args) is read back as the full frame it stands for
    const P = CanvasRenderingContext2D.prototype, oDI = P.drawImage;
    const drawAt = (h, prog) => {
      h.life = Math.max(1, Math.round(h.maxLife * (1 - prog))); game.hazards = [h];
      const blits = []; P.drawImage = function (img, ...a) {
        if (this === ctx && a.length === 4) blits.push({ x: a[0], y: a[1], w: a[2], h: a[3] });
        else if (this === ctx && a.length === 8) { const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, kx = a[6] / a[2], ky = a[7] / a[3]; blits.push({ x: a[4] - a[0] * kx, y: a[5] - a[1] * ky, w: iw * kx, h: ih * ky, cropped: true }); }
        return oDI.call(this, img, ...a); };
      try { ctx.save(); ctx.translate(0, -camY); drawHazards(); ctx.restore(); } finally { P.drawImage = oDI; }
      const sq = blits.filter((b) => b.w > 40 && Math.abs(b.w - b.h) < 0.5).sort((p, q) => q.w - p.w);   // the meteor frames are square
      const rune = blits.filter((b) => Math.abs(b.h - 70) < 0.5)[0] || null;                           // the ground rune is 70 tall
      return { head: sq[0] || null, trail: sq.slice(1, 7), rune, cropped: sq.length ? sq.every((b) => b.cropped) : false };
    };
    out.draw = [];
    for (const p of [0, 0.5, 1]) {
      const h = mk({ owner: 'enemy' }); const d = drawAt(h, p);
      out.draw.push({ prog: 1 - h.life / h.maxLife, head: d.head, trail: d.trail, rune: d.rune, cropped: d.cropped, geom: out.hasGeom ? _lxMeteorGeom(h, camY) : null, blast: out.hasBlast ? _lxMeteorBlast(h, camY) : null });
    }
    { const h = mk({ owner: 'enemy', _gravBlue: true }); const d = drawAt(h, 0.5); out.blue = { head: d.head, prog: 1 - h.life / h.maxLife, rune: d.rune, blast: out.hasBlast ? _lxMeteorBlast(h, camY) : null }; }
    // ---- a monster's fireball falling onto the player, on the real ticker: the frame the fall hits, and whether the
    // landing blast hits (the landing pushes a big damage number; this dev harness takes no HP off)
    const fall = (o, py) => {
      const h = mk(Object.assign({ owner: 'enemy', life: 120, maxLife: 120, fireAt: 120 }, o)); game.hazards = [h];
      player.hp = 1e9; player.invulnerable = 0; player.blockTimer = 0; player._god = false;
      const px = 600 - player.w / 2 + (o._off || 0); player.x = px; player.y = py; player.vy = 0;
      let first = null, landed = false;
      for (let f = 0; f < 130 && game.hazards.includes(h); f++) {
        const lifeNow = h.life, n0 = game.damageNumbers.length; updateProjectiles(16); player.invulnerable = 0;
        if (h._passHit && first == null) { const at = (L) => out.hasGeom ? _lxMeteorGeom(Object.assign({}, h, { life: L }), camY) : null; first = { f, lifeNow, g: at(lifeNow), gAfter: at(lifeNow - 1), gBefore: at(lifeNow + 2) }; }
        if (!game.hazards.includes(h) && game.damageNumbers.slice(n0).some((d) => d && d.taken && d.big)) landed = true;
        player.y = py; player.x = px;
      }
      return { first, landed, pY: py, pH: player.h, pW: player.w };
    };
    const GROUND = 480 - player.h;
    out.stand = fall({}, GROUND);
    out.high = fall({}, 200);
    out.side = fall({ _off: 85 }, GROUND);                              // inside the old 90 px lane, outside the fireball and its blast
    out.edge = fall({ radius: 40, x: 560, w: 80, _off: 55 }, GROUND);   // outside a narrow lane, but under the fireball
    out.miss = fall({ _off: 400 }, GROUND);
    // ---- your Meteor passing through a monster
    {
      const mon = { type: 'slime', x: 570, y: 300, w: 60, h: 50, currentHp: 1e9, maxHp: 1e9, def: 0, evasion: 0, vx: 0, vy: 0, uid: 999999 };
      game.monsters = [mon];
      const h = mk({ life: 120, maxLife: 120, fireAt: 120, radius: 180, x: 420, w: 360 });
      game.hazards = [h]; let first = null;
      for (let f = 0; f < 130 && game.hazards.includes(h); f++) {
        const lifeNow = h.life; updateProjectiles(16); mon.y = 300; mon.x = 570;
        if (h._passSet && h._passSet.has(mon) && first == null) { const at = (L) => out.hasGeom ? _lxMeteorGeom(Object.assign({}, h, { life: L }), camY) : null; first = { f, lifeNow, g: at(lifeNow), gAfter: at(lifeNow - 1), gBefore: at(lifeNow + 2) }; }
      }
      out.mon = { first, y: 300, h: 50 };
      // a monster 130 px off your Meteor's centre: inside the old 180 px lane, outside the fireball and its blast
      const mon2 = { type: 'slime', x: 600 + 130 - 30, y: 430, w: 60, h: 50, currentHp: 1e9, maxHp: 1e9, def: 0, evasion: 0, vx: 0, vy: 0, uid: 999998 };
      game.monsters = [mon2];
      const h2 = mk({ life: 120, maxLife: 120, fireAt: 120, radius: 180, x: 420, w: 360 }); game.hazards = [h2];
      for (let f = 0; f < 130 && game.hazards.includes(h2); f++) { updateProjectiles(16); mon2.x = 700; mon2.y = 430; }
      out.mon2 = { hp: mon2.currentHp, max: mon2.maxHp };
      game.monsters = [];
    }
    // ---- co-op: the host's blast message carries the blast's height
    {
      const sent = []; const _oa = window._coopActive, _ow = net.ws, _oh = net.isHost;
      try {
        window._coopActive = () => true; net.isHost = true; net.ws = { send: (m) => sent.push(m), readyState: 1 };
        const h = mk({ owner: 'enemy', life: 1, maxLife: 120, fireAt: 120, _passHit: true }); game.hazards = [h];
        player.x = 2000; updateProjectiles(16); updateProjectiles(16);
      } catch (e) { out.coopErr = String(e).slice(0, 120); }
      finally { window._coopActive = _oa; net.ws = _ow; net.isHost = _oh; }
      const m = sent.map((s) => { try { return JSON.parse(s); } catch (e) { return null; } }).find((x) => x && x.t === 'hazhit');
      out.coop = m ? { r: m.r, bt: m.bt, bh: m.bh } : null;
    }
    game.hazards = [];
    return out;
  });
  const d5 = r.draw[1], d1 = r.draw[2];
  console.log(`render scale ${r.dpr} · loop frame ${r.frameLong}px (bake base ${r.base}) · art: head ${(r.art.w * 100).toFixed(1)}% wide, rock from ${(r.art.rockTop * 100).toFixed(1)}%, flame to ${(r.art.bottom * 100).toFixed(1)}%`);
  console.log(`drawn head ${r.draw.map((d) => d.head && Math.round(d.head.w) + 'px').join(' -> ')} (cropped blits: ${r.draw.every((d) => d.cropped)}) · blast ${d1.blast && JSON.stringify({ r: Math.round(d1.blast.r), top: Math.round(d1.blast.top), bot: Math.round(d1.blast.bot) })} · rune ${d1.rune && Math.round(d1.rune.w)}px · blue head ${r.blue.head && Math.round(r.blue.head.w)}px`);
  check(r.hasGeom && r.hasBlast, 'one geometry serves the draw, both fall hits and the landing (_lxMeteorGeom, _lxMeteorBlast)');
  const want = (p) => 2 * (100 + p * 70);
  check(r.draw.every((d) => d.head && Math.abs(d.head.w - want(d.prog)) < 1.5), 'the fireball is drawn at twice its old size through the whole fall (200 -> 340 px, was 100 -> 170)', r.draw.map((d) => [d.prog, d.head && d.head.w]));
  check(d5.trail.length === 6 && d5.trail.every((t, i) => Math.abs((d5.head.y - t.y) - (44 * (i + 1) - (d5.head.w * (i + 1) * 0.1) / 2)) < 6), 'its six trail copies are spaced to the new size (44 px steps, was 22)', d5.trail.map((t) => Math.round(d5.head.y - t.y)));
  check(r.draw.every((d) => d.cropped), 'only the inked column of each frame is blitted (a third of the fill)', r.draw.map((d) => d.cropped));
  check(r.blue.head && Math.abs(r.blue.head.w - (100 + r.blue.prog * 70)) < 1.5 && r.blue.blast === null, 'Gravitos\'s blue meteors keep their size, hitbox and blast (not fireballs)', r.blue);
  // the hitbox is the teardrop as drawn: from the rock of the second trail copy to the bottom of the head's flame, the head's width
  const geoOk = r.draw.every((d) => { const g = d.geom, hd = d.head, t2 = d.trail[1]; if (!g || !hd || !t2) return false;
    const top = t2.y + r.art.rockTop * t2.h, bot = hd.y + r.art.bottom * hd.h;
    return Math.abs((g.hitY - g.hitR) - top) < 0.03 * hd.h && Math.abs((g.hitY + g.hitR) - bot) < 0.03 * hd.h && Math.abs(2 * g.halfW - r.art.w * hd.w) < 0.04 * hd.w; });
  check(geoOk, 'the hitbox is the glowing teardrop as drawn: from the rock of the second trail copy to the bottom of the head\'s flame, as wide as the head (measured on the art at the real blits, within 3-4%)', r.draw.map((d) => ({ p: d.prog, geom: d.geom && [Math.round(d.geom.hitY - d.geom.hitR), Math.round(d.geom.hitY + d.geom.hitR), Math.round(d.geom.halfW)], head: d.head && [Math.round(d.head.y), Math.round(d.head.h)], t2: d.trail[1] && [Math.round(d.trail[1].y), Math.round(d.trail[1].h)] })));
  { const p = d1.prog, oldBot = 60 + 400 * p + 0.445 * (100 + 70 * p);   // the old fireball's bottom (camera y 0)
    check(d1.geom && Math.abs(d1.geom.hitY + d1.geom.hitR - oldBot) < 3, 'it lands with its bottom where the old fireball\'s landed (the ground rune), not through the floor', { geom: d1.geom, oldBot }); }
  // the blast: the landing hitbox, 25% wider; the rune shows it
  { const b = d1.blast, g = d1.geom || { halfW: 0, hitY: 0, hitR: 0 };
    check(b && Math.abs(b.r - 1.25 * g.halfW) < 1 && b.top < g.hitY - g.hitR && b.bot > g.hitY + g.hitR && b.r < 90, `the blast is the landing hitbox a little bigger: ${b ? Math.round(2 * b.r) : '?'} px wide (the fireball is ${Math.round(2 * g.halfW)}; the lane was 180-360)`, { b, g });
    check(d1.rune && b && Math.abs(d1.rune.w - (2 * b.r + 20)) < 1.5, 'the ground rune telegraphs the blast\'s width', { rune: d1.rune && d1.rune.w, blast: b && b.r }); }
  // hits on the real ticker
  const over = (g, y, hh) => !!g && (g.hitY + g.hitR >= y) && (g.hitY - g.hitR <= y + hh);
  const touch = (x, y = x.pY, hh = x.pH) => !!(x.first && (over(x.first.g, y, hh) || over(x.first.gAfter, y, hh)) && !over(x.first.gBefore, y, hh));
  console.log(`\nstanding: fall at frame ${r.stand.first && r.stand.first.f}, blast ${r.stand.landed} · high up: fall at ${r.high.first && r.high.first.f}, blast ${r.high.landed} · 85 px off a 90 px lane: fall ${!!r.side.first}, blast ${r.side.landed} · under the fireball outside a 40 px lane: fall ${r.edge.first ? r.edge.first.f : 'none'} · 400 px away: ${!!r.miss.first || r.miss.landed} · your Meteor: monster hit at ${r.mon.first && r.mon.first.f}, monster 130 px off ${r.mon2.hp < r.mon2.max ? 'HIT' : 'untouched'} · co-op blast message ${JSON.stringify(r.coop)}`);
  check(touch(r.stand), 'a monster\'s fireball hits a standing player the frame the drawn teardrop reaches them - not before, not late', r.stand);
  check(r.stand.landed, 'and its blast hits them when it lands', r.stand);
  check(touch(r.high) && r.stand.first && r.high.first.f < r.stand.first.f, 'a player high in its path is hit earlier, as the fireball passes', { high: r.high.first && r.high.first.f, stand: r.stand.first && r.stand.first.f });
  check(r.high.landed === false, '...but the blast on the ground does not reach a player on a high platform (it was the whole column)', r.high);
  check(!r.side.first && !r.side.landed, 'a player 85 px off-centre - inside the old 90 px lane, clear of the fireball and its blast - is not hit', r.side);
  check(touch(r.edge), 'a player the fireball overlaps is hit even outside a narrow lane: the fireball decides', r.edge);
  check(!r.miss.first && !r.miss.landed, 'a player well away is not hit', r.miss);
  check(touch(r.mon, r.mon.y, r.mon.h), 'your Meteor hits a monster the frame the drawn teardrop reaches it', r.mon);
  check(r.mon2.hp === r.mon2.max, 'your Meteor no longer hits a monster 130 px off its centre (inside the old 360 px lane, clear of the fireball and its ~140 px blast)', r.mon2);
  check(r.coop && d1.blast && Math.abs(r.coop.r - Math.round(d1.blast.r)) <= 1 && Number.isFinite(r.coop.bt) && r.coop.bh > 0, 'a co-op host sends the blast\'s width AND height, so a guest takes the same blast', r.coop);
  // the words
  const html = readFileSync(path.join(ROOT, FILE), 'utf8');
  check(html.includes('it strikes every foe it falls through') && !html.includes('360px-wide path'), 'the Meteor\'s description no longer promises a 360 px path', null);
  // sharpness
  check(r.base === 360 && r.frameLong >= Math.min(680, Math.ceil(340 * r.dpr)), `not pixelated: the frame it draws from has ${r.frameLong} px for a ${340 * r.dpr} device-px draw at render scale ${r.dpr} (the source art is 680)`, { base: r.base, frameLong: r.frameLong, dpr: r.dpr });
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad === 0 ? `\nall ${total} passed` : `\n${bad} of ${total} FAILED`);
process.exit(bad === 0 ? 0 : 1);
