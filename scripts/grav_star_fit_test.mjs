// Gravitos supernova plays to its last frame (v0.30.x grav-star-fit): in a REAL fight (gravitosArena, his own AI and hazard) a forced
// Singularity in form 2 (gravitos2star) and form 3 (gravitos3star), both facings, two HP tiers each, draws all nine frames in order and
// hands over to idle from its last frame; the cast itself (hazard, length, cooldown) is unchanged; his feet do not float or pop at the
// switch; the v0.30.1821 calibration glide gate and the v0.30.1822 ghost frames still work.
//   node scripts/grav_star_fit_test.mjs        (MOJI_GAME_FILE=<build.html> to test a private build; PORT=11953)
// Before the fix the set's blow was keyed to START on the resolve, the step the cast ends: form 2 never drew f7-8, form 3 stopped at f3.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11953';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const cache = new Map();   // Gravitos art + data tables from origin: the shared working copy may hold another session's unshipped art
const fromOrigin = (rel) => { if (!cache.has(rel)) cache.set(rel, execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 26 })); return cache.get(rel); };
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.route((u) => /[/](assets[/]fonts[/].*[.]woff2|Sprites[/]bosses[/].*gravitos.*[.]webp|data[/][a-z_]+[.]js)$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (rel.endsWith('.woff2') && existsSync(path.join(ROOT, rel))) return r.continue();
    const ct = rel.endsWith('.woff2') ? 'font/woff2' : rel.endsWith('.webp') ? 'image/webp' : 'text/javascript';
    try { r.fulfill({ status: 200, contentType: ct, body: fromOrigin(rel) }); } catch (e) { r.continue(); }
  });
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof _drawBossSprite === 'function' && typeof _lxDrawSoft === 'function', null, { timeout: 150000 });
  await p.evaluate(() => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth', 'lo-menu']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'warrior'; player.level = 100;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    loadMap('gravitosArena'); game.paused = false;
  });
  await p.waitForFunction(() => game.monsters.some((m) => m && m.type === 'gravitos' && m.currentHp > 0), null, { timeout: 60000 });
  const setup = await p.evaluate(async () => {
    const W8 = (ms) => new Promise((s) => setTimeout(s, ms));
    const m = game.monsters.find((x) => x && x.type === 'gravitos'); window.__m = m;
    window.__face = 1;
    const keep = () => {   // the player stays alive (god + invulnerable: the resolve cannot kill), on the chosen side of him; nothing pauses
      game.paused = false; for (const id of ['story-beat-overlay', 'boss-intro-overlay', 'everdawn-welcome-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
      player.invulnerable = 999999; player._god = true; player.hp = player.maxHp; m._warpTimer = 1e9; m._wardNextAt = 1e12;
      m._dirRollT = 1e9; m._break = 0;   // the director's free opening (due 4 s into any long pattern) and the break meter would break off a cast at random: not this test's subject
      const ww = (game.mapData && game.mapData.worldWidth) || 2200; player.x = Math.max(60, Math.min(ww - 90, m.x + m.w / 2 + window.__face * 420)); player.vx = 0;
      requestAnimationFrame(keep); };
    requestAnimationFrame(keep);
    // some of his blows still take a god-mode harness player to 0 between frames; the death that follows (downed -> triggerDeath)
    // wipes game.hazards, his Singularity with them, and the cast ends early. A harness death is absorbed (and counted) instead.
    window.__deaths = 0; window.triggerDeath = function () { window.__deaths++; player.hp = player.maxHp; player._downed = false; };
    const sets = () => [BOSS_ATTACK_FRAMES.gravitos2star, BOSS_ATTACK_FRAMES.gravitos3star, BOSS_IDLE_FRAMES.gravitos2, BOSS_IDLE_FRAMES.gravitos3];
    const t0 = performance.now();   // art is lazy: request both forms, then wait (wall-clock guarded)
    while (performance.now() - t0 < 150000 && !sets().every((s) => s && _lxFtReadyN(s) >= s.length)) { try { _lxBossArtWant('gravitos2', true); _lxBossArtWant('gravitos3', true); } catch (e) {} await W8(150); }
    const tag = new Map();   // frame set -> 'state/key'
    for (const [nm, map] of [['attack', BOSS_ATTACK_FRAMES], ['idle', BOSS_IDLE_FRAMES], ['walk', BOSS_WALK_FRAMES]]) for (const k of Object.keys(map)) if (/^gravitos/.test(k) && Array.isArray(map[k])) tag.set(map[k], nm + '/' + k);
    // ink of a frame: its lowest opaque row and the centre of its bottom band (fractions), read once per image
    const inkC = new WeakMap(), ink = (img) => {
      let r = inkC.get(img); if (r) return r;
      const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height; if (!(w > 0 && h > 0)) return null;
      const S = 512 / Math.max(w, h), cw = Math.max(1, Math.round(w * S)), ch = Math.max(1, Math.round(h * S));
      const c = document.createElement('canvas'); c.width = cw; c.height = ch; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, cw, ch);
      const d = g.getImageData(0, 0, cw, ch).data; let y1 = -1;
      for (let y = ch - 1; y >= 0 && y1 < 0; y--) for (let x = 0; x < cw; x++) if (d[(y * cw + x) * 4 + 3] > 128) { y1 = y; break; }
      let sx = 0, sn = 0, bx = 0, bn = 0; const band = Math.max(2, Math.round(ch * 0.04));
      for (let y = Math.max(0, y1 - band); y <= y1; y++) for (let x = 0; x < cw; x++) if (d[(y * cw + x) * 4 + 3] > 128) { sx += x; sn++; }
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) if (d[(y * cw + x) * 4 + 3] > 128) { bx += x; bn++; }   // the body: every opaque pixel
      r = { by: (y1 + 1) / ch, cx: sn ? (sx / sn + 0.5) / cw : 0.5, mx: bn ? (bx / bn + 0.5) / cw : 0.5 }; inkC.set(img, r); return r;
    };
    window.__rec = null; window.__inB = null; window.__inG = false;
    const oB = window._drawBossSprite;
    window._drawBossSprite = function (sprite, mm, sx, sy) {   // one record per draw of him: frame, state, cast clock, feet relative to his anchor
      if (mm !== m || !window.__rec) return oB.apply(this, arguments);
      const E = ctx.getTransform(), h = game.hazards.find((q) => q && q.type === 'gravitos_singularity');
      const R = { t: game.time | 0, st: mm.patternState, key: mm._gravStarKey || null, set: sprite && sprite._lxSet ? (tag.get(sprite._lxSet) || '?') : '-', fi: sprite ? sprite._lxFi : null,
        life: h ? h.life : -1, face: mm.facing, x: Math.round(mm.x), y: Math.round(mm.y), fx: Math.round(sx + mm.w / 2), fy: Math.round(sy + mm.h), E: [E.a, E.b, E.c, E.d, E.e, E.f], feet: null, area: 0, ghosts: 0, cal: null };
      window.__inB = R;
      try { return oB.apply(this, arguments); } finally {
        window.__inB = null; if (mm._lxCalE) R.cal = { k: mm._lxCalE.k, s: mm._lxCalE.s, dy: mm._lxCalE.dy };
        if (R.st === 'singularity' && R.key) R.set = 'attack/' + R.key;   // a baked frame carries no set: the key names it
        window.__rec.push(R);
      }
    };
    const oD = window._lxDrawSoft;
    window._lxDrawSoft = function (c, img, x, y, w, h) {
      const R = window.__inB;
      if (R && c === ctx) {
        if (window.__inG) R.ghosts++;
        else if (w * h > R.area) {   // his own frame is the largest draw in the call
          const k = ink(img), T = c.getTransform();
          if (k) {
            const px = x + w * k.cx, py = y + h * k.by, X = T.a * px + T.c * py + T.e, Y = T.b * px + T.d * py + T.f;
            const [a, b, cc, d, e, f] = R.E, det = a * d - b * cc, lx = (d * (X - e) - cc * (Y - f)) / det, ly = (a * (Y - f) - b * (X - e)) / det;
            const qx = x + w * k.mx, qy = y + h * 0.5, QX = T.a * qx + T.c * qy + T.e, QY = T.b * qx + T.d * qy + T.f, bx = (d * (QX - e) - cc * (QY - f)) / det;
            R.feet = [+(lx - R.fx).toFixed(2), +(ly - R.fy).toFixed(2)]; R.body = +(bx - R.fx).toFixed(2); R.area = w * h;
          }
        }
      }
      return oD.apply(this, arguments);
    };
    if (typeof _lxGgDraw === 'function') { const oG = _lxGgDraw; window._lxGgDraw = function () { window.__inG = true; try { return oG.apply(this, arguments); } finally { window.__inG = false; } }; }
    return { ready: sets().map((s) => s ? _lxFtReadyN(s) + '/' + s.length : '-').join(' '), ghost: typeof _LX_GRAV_GHOST !== 'undefined' ? _LX_GRAV_GHOST : null,
      gate: String(_drawBossSprite).includes("_ee.k === 'gravitos2star' || _bk === 'gravitos2star'") || String(oB).includes("_ee.k === 'gravitos2star' || _bk === 'gravitos2star'") };
  });
  console.log('setup', JSON.stringify(setup));
  // one forced Singularity in a real fight: his own AI fires it from the one-shot queue, his own hazard resolves it
  const cast = (cfg) => p.evaluate(async ({ form, face, hp }) => {
    const W8 = (ms) => new Promise((s) => setTimeout(s, ms));
    const m = window.__m; window.__face = face;
    if (typeof _LX_GG !== 'undefined') Object.assign(_LX_GG, { offMs: 1e9, onMs: 1e9, open: true, n: 0 });   // headless runs far below 60 fps: hold the ghost valve open
    m._phaseSprite = 'gravitos' + form; m._gravitosPhase = form; m._gravCadenceMul = form === 3 ? 1.45 : 1.20;   // what his form change sets
    try { _lxBossBakeQueue(m._phaseSprite, null); } catch (e) {}
    m.currentHp = Math.max(1, Math.floor(m.maxHp * hp)); m._soulTimer = m._rainTimer = 1e9; m._ohkoWarnUntil = null; m._ohkoQueued = null;
    let g0 = game.time | 0; const t0 = performance.now();   // settle: the HP tier lands, whatever he was doing finishes
    while (((game.time | 0) - g0 < 120 || m.patternState !== 'idle' || game.hazards.some((h) => h && h.type === 'gravitos_singularity')) && performance.now() - t0 < 60000) await W8(16);
    // room on the chosen side (near a wall the clamped player would stand behind him), and time for his facing hold to turn him
    { const ww = (game.mapData && game.mapData.worldWidth) || 2200; m.x = ww / 2 - m.w / 2 - face * 200; m.vx = 0; }
    m._ohkoQueued = 'singularity'; m._ohkoWarnUntil = (game.time | 0) + 20; m._instaTimer = 0;
    window.__rec = []; g0 = game.time | 0;
    let seen = false, endAt = -1, hz = null, cd = null, ph = null;
    while (performance.now() - t0 < 150000) {
      await W8(16);
      if (m.patternState === 'singularity') {
        seen = true; if (cd == null) { cd = m._instaTimer; ph = m.phase; }
        const h = game.hazards.find((q) => q && q.type === 'gravitos_singularity'); if (h && !hz) hz = { maxLife: h.maxLife, atk: h.atk, zones: (h.safeZones || []).length, n: game.hazards.filter((q) => q && q.type === 'gravitos_singularity').length };
      }
      if (seen && endAt < 0 && m.patternState !== 'singularity') endAt = game.time | 0;
      if (endAt >= 0 && (game.time | 0) - endAt > 40) break;
    }
    const rec = window.__rec; window.__rec = null;
    const calib = { idle: _lxAnimCalib(m._phaseSprite, 'idle'), walk: _lxAnimCalib(m._phaseSprite, 'walk') };
    return { rec, seen, endAt, hz, cd, ph, calib, deaths: window.__deaths, fps: +(((game.time | 0) - g0) / ((performance.now() - t0) / 1000)).toFixed(1) };
  }, cfg);
  check(/^9\/9 9\/9 9\/9 9\/9$/.test(setup.ready), 'the star and idle sets of forms 2 and 3 decode (9 frames each)', setup);
  check(setup.ghost === 'blend' && setup.gate, 'v0.30.1822 ghost frames ship as blend; the v0.30.1821 supernova glide gate is in the draw path', setup);
  let ghostsAtSwitch = 0;
  for (const cfg of [{ form: 2, face: 1, hp: 0.9 }, { form: 2, face: -1, hp: 0.5 }, { form: 3, face: 1, hp: 0.9 }, { form: 3, face: -1, hp: 0.2 }]) {
    const R = await cast(cfg), tag = `form ${cfg.form} ${cfg.face > 0 ? 'R' : 'L'} (${Math.round(cfg.hp * 100)}% HP)`, key = 'gravitos' + cfg.form + 'star';
    const star = R.rec.filter((r) => r.st === 'singularity' && r.key === key), seq = star.map((r) => r.fi);
    const lastI = R.rec.lastIndexOf(star[star.length - 1]), after = R.rec.slice(lastI + 1);
    // the switch: his first idle-calibrated draw (until an idle frame has decoded, the stand-in holds f8 with the star's own calibration)
    const next = after.find((r) => !(r.cal && r.cal.k === key));
    const live = R.rec.filter((r) => r.st === 'singularity' && r.life > 0), resolveT = live.length ? live[live.length - 1].t + live[live.length - 1].life : -1;
    const sing = R.rec.filter((r) => r.st === 'singularity'), castT = sing.length ? sing[sing.length - 1].t - sing[0].t : -1;
    console.log(`  ${tag}: fps ${R.fps}, phase ${R.ph}, frames ${[...new Set(seq)].join(' ')}, cast ${castT} steps, resolve ${resolveT}, idle from ${R.endAt}, star facings ${[...new Set(star.map((r) => r.face))].join('/')}`);
    check(R.seen && star.length > 0 && star.every((r) => r.face === cfg.face), `${tag}: his own AI casts the Singularity on the star set, facing the player`, { seen: R.seen, draws: star.length, faces: [...new Set(star.map((r) => r.face))] });
    { const z = seq.lastIndexOf(0), run = z >= 0 ? seq.slice(z) : seq, pre = z >= 0 ? seq.slice(0, z) : [];   // per user (smooth casts): a long wait rocks the first wind-up frames (0-2), then the run-in plays 0..8 in order
    check([0, 1, 2, 3, 4, 5, 6, 7, 8].every((i) => run.includes(i)) && run.every((v, i) => i === 0 || v >= run[i - 1]) && pre.every((v) => v <= 2), `${tag}: all nine supernova frames draw, in order, after a charge-up on the first wind-up frames`, { frames: [...new Set(seq)], preMax: pre.length ? Math.max(...pre) : null, backwardsInRun: run.findIndex((v, i) => i > 0 && v < run[i - 1]) }); }
    check(seq[seq.length - 1] === 8 && next && next.st !== 'singularity' && !next.key && next.cal && next.cal.k === 'gravitos' + cfg.form && (next.set === '-' || /^(idle|walk)\/gravitos[23]$/.test(next.set)), `${tag}: the cast hands over to idle from its last frame (f8)`, { last: seq[seq.length - 1], next: next && { st: next.st, set: next.set, key: next.key, cal: next.cal && next.cal.k } });
    const cdExp = R.ph >= 3 ? 9000 : R.ph === 2 ? 14000 : 20000;
    check(R.hz && R.hz.maxLife === 330 && R.hz.atk === 99999 && R.hz.zones === 5 && R.hz.n === 1 && castT >= 330 && castT <= 380 && R.endAt >= resolveT && R.endAt - resolveT <= 16 && R.cd <= cdExp && R.cd > cdExp - 1500,
      `${tag}: the cast is unchanged - one 330-step hazard (atk 99999, 5 safe zones), it ends as the hazard resolves, the phase's cooldown is set`, { hz: R.hz, castT, resolveT, endAt: R.endAt, cd: R.cd, cdExp, ph: R.ph });
    const fl = star[star.length - 1] && star[star.length - 1].feet, fn = next && next.feet, d = fl && fn ? [+(fn[0] - fl[0]).toFixed(1), +(fn[1] - fl[1]).toFixed(1)] : null;
    const bl = star[star.length - 1] && star[star.length - 1].body, bn = next && next.body, db = (bl != null && bn != null) ? +(bn - bl).toFixed(1) : null;
    console.log(`    px from his anchor - feet: last star ${JSON.stringify(fl)} first idle ${JSON.stringify(fn)} step ${JSON.stringify(d)}; body x: ${bl} -> ${bn} (${db}); harness deaths absorbed ${R.deaths}`);
    check(d && db != null && Math.abs(d[1]) <= 6 && Math.abs(db) <= 8, `${tag}: no float or pop at the switch - his feet stay on the floor line (<= 6 px) and his body in place (<= 8 px)`, { feet: d, body: db });
    if (cfg.form === 2) {
      const c = next && next.cal, ok = c && c.k === 'gravitos2' && ['idle', 'walk'].some((s) => Math.abs(c.s - R.calib[s].s) < 1e-9 && Math.abs(c.dy - R.calib[s].dy) < 1e-9);
      check(ok, `${tag}: the glide gate holds - idle's calibration lands at once out of the supernova (no glide)`, { cal: c, calib: R.calib });
    }
    ghostsAtSwitch += after.slice(0, 3).reduce((a, r) => a + r.ghosts, 0);
  }
  check(ghostsAtSwitch > 0, 'ghost frames still dissolve the switch: the last star frame ghosts over his first idle frames', { ghostsAtSwitch });
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad ? `${bad} of ${total} FAILED` : `all ${total} passed`);
process.exit(bad ? 1 : 0);
