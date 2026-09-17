// Gravitos safe zones in every form (sz-all): the rain's box is never rolled under a HUD panel, the boxes are
// 4 s apart on the wall clock in form 3, every live zone carries a beacon (pillar / edge chevron), a zone with
// no art still paints bright, and the rift art warms with the boss.
//   PORT=9731 node scripts/grav_safezone_all_test.mjs [candidate.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '9731';
const FILE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html';   // the ship chain hands the private build over MOJI_GAME_FILE
const env = { ...process.env, MOJI_GAME_FILE: FILE };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
try {
  const ctxB = await browser.newContext({ viewport: { width: 1630, height: 944 }, serviceWorkers: 'block' });
  const page = await ctxB.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  const TBL = path.join(process.env.TEMP, 'gs_tables'), ART = path.join(process.env.TEMP, 'rp_art');
  await page.route(/\/data\/(sprite_bbox|sprite_edges|sprite_frame_index)\.js/, (r) => { try { r.fulfill({ status: 200, contentType: 'application/javascript', body: readFileSync(path.join(TBL, r.request().url().split('/').pop().split('?')[0])) }); } catch (e) { r.continue(); } });
  await page.route(/Sprites\/fx\/(anim\/)?(gravitos_singularity_zone(_\d)?|safezone_shield)\.webp/, (r) => { const u = r.request().url(); const f = u.includes('/anim/') ? path.join(ART, 'anim', u.split('/').pop().split('?')[0]) : path.join(ART, u.split('/').pop().split('?')[0]); try { r.fulfill({ status: 200, contentType: 'image/webp', body: readFileSync(f) }); } catch (e) { r.continue(); } });
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof hitMonster === 'function', null, { timeout: 120000 });
  await page.evaluate(() => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false;
    player.level = 100; player.cls = 'mage'; player.invulnerable = 0; player.hp = player.maxHp = 44000; player._god = true;
    loadMap('gravitosArena'); game.paused = false;
  });
  await page.waitForFunction(() => game.monsters.some((m) => m && m.type === 'gravitos' && m.currentHp > 0), null, { timeout: 60000 });
  await page.waitForFunction(() => ![...document.querySelectorAll('video')].some((v) => v.offsetParent && !v.paused && v.id.indexOf('map-bg-video') !== 0), null, { timeout: 60000 }).catch(() => {});
  await page.evaluate(async () => { const sleep = (ms) => new Promise((s) => setTimeout(s, ms)); for (let k = 0; k < 12; k++) { for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); } game.paused = false; await sleep(250); } });

  // ---- 1. static: the code and the art list ------------------------------------------------------
  const st = await page.evaluate(() => ({
    beacon: typeof _lxSafeZoneBeacons === 'function', spans: typeof _lxSzHudCoveredSpans === 'function',
    fx: (_LX_MOB_TYPE_ART.gravitos.fx || []).includes('gravitos_singularity_zone'),
    img: ['gravitos_singularity_zone', 'safezone_shield'].every((k) => (_LX_MOB_TYPE_ART.gravitos.img || []).includes(k)),
  }));
  console.log('\nTHE PIECES ARE THERE');
  check(st.beacon && st.spans, 'beacon + HUD-span helpers defined', st);
  check(st.fx && st.img, "the rift anim, rift still and shield are in the boss's warm list", st);

  // ---- 2. placement: 40 boxes rolled with the player at every screen position, none under a panel --------
  const pl = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
    const boss = () => game.monsters.find((x) => x && x.type === 'gravitos' && x.currentHp > 0);
    const cv = document.getElementById('game'), R = cv.getBoundingClientRect(), k = R.width / W;
    const rows = []; let under = 0, off = 0, made = 0;
    const m = boss(); m.currentHp = Math.floor(m.maxHp * 0.49); m._instaTimer = 99999; m._soulTimer = 99999; m._rainTimer = 99999;
    for (let i = 0; i < 40; i++) {
      const camL = game.camera.x; player.x = camL + 60 + (i % 20) * 44; player.y = 436; player.vx = player.vy = 0;
      game.hazards.length = 0; m.patternState = 'collapseRain'; m.patternTimer = 1; m._rainIdx = 0; m._rainSafe = null; m._rainNextAt = null; m._rainBand0 = null;
      for (let f = 0; f < 12 && !game.hazards.some((h) => h && h.type === 'gravitos_singularity'); f++) await sleep(40);
      const h = game.hazards.find((h) => h && h.type === 'gravitos_singularity'); if (!h || !h.safeZones || !h.safeZones.length) continue;
      await sleep(260);   // the panels over a box fade over 150 ms: read the DOM once that is done
      made++; const z = h.safeZones[0]; const camX = game.camera.x, camY = (game.camera && game.camera.y) || 0;
      const sx = z.x - camX, sy = z.y - camY; const onS = sx >= 0 && sx + z.w <= W; if (!onS) off++;
      // the truth test: what the DOM puts at the box's own pixels (corners + centre)
      const pts = [[sx + 4, sy + 4], [sx + z.w - 4, sy + 4], [sx + 4, sy + z.h - 4], [sx + z.w - 4, sy + z.h - 4], [sx + z.w / 2, sy + z.h / 2]];
      const hits = pts.map(([x, y]) => document.elementsFromPoint(R.left + x * k, R.top + y * k).filter((el) => { if (!el || el === cv || cv.contains(el) || el.contains(cv)) return false; const r = el.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0) || (r.width > R.width * 0.9 && r.height > R.height * 0.9)) return false; let op = 1, vis = true; for (let e = el; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); op *= parseFloat(cs.opacity); if (cs.visibility === 'hidden') vis = false; } return vis && op > 0.2; }).map((el) => el.id || el.className || el.tagName)[0]).filter(Boolean);
      if (hits.length) under++;
      rows.push({ px: (player.x - camL) | 0, sx: sx | 0, w: z.w, onS, hits });
      m.patternState = 'idle'; m.patternTimer = 0; game.hazards.length = 0;
    }
    return { made, under, off, rows, spans: _lxSzHudCoveredSpans(480 - 60, 480) };
  });
  console.log(`\nPLACEMENT  boxes ${pl.made}  under a panel ${pl.under}  off screen ${pl.off}  HUD spans ${JSON.stringify(pl.spans)}`);
  check(pl.made >= 36, 'the rain rolled a box for (nearly) every position', pl.made);
  check(pl.spans.length >= 1, 'the HUD-span probe sees at least one panel over the floor', pl.spans);
  check(pl.under === 0, 'no box has a HUD panel over any of its corners or centre', pl.rows.filter((r) => r.hits.length).slice(0, 4));
  check(pl.off === 0, 'every box is fully on screen', pl.rows.filter((r) => !r.onS).slice(0, 4));

  // ---- 3. the beacon: pillar over an on-screen zone, chevron for an off-screen one, fallback without art -------
  const bc = await page.evaluate(() => {
    const boss = () => game.monsters.find((x) => x && x.type === 'gravitos' && x.currentHp > 0);
    const m = boss(); m.patternState = 'idle'; m.patternTimer = 0; game.hazards.length = 0;
    const camX = game.camera.x, camY = (game.camera && game.camera.y) || 0;
    const z = { x: camX + 420, y: 420, w: 102, h: 60 };
    const h = { type: 'gravitos_singularity', life: 70, maxLife: 84, safeZones: [z], x: z.x, y: z.y, w: z.w, h: z.h };
    game.hazards.push(h);
    const px = (x, y) => { const d = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data; return d[0] + d[1] + d[2]; };
    const P = CanvasRenderingContext2D.prototype; const oFT = P.fillText, oFR = P.fillRect; const texts = [], fills = [];
    // wipe the screen black, run only the beacon pass, read the pillar
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const before = px(z.x - camX + z.w / 2, z.y - camY - 60);
    P.fillRect = function (...a) { if (this === ctx) fills.push(a); return oFR.apply(this, a); };
    _lxSafeZoneBeacons();
    P.fillRect = oFR;
    const pillar = px(z.x - camX + z.w / 2, z.y - camY - 60), side = px(z.x - camX - 40, z.y - camY - 60);
    const pillarFill = fills.find((a) => a[3] === 150 && Math.abs(a[0] - (z.x - camX)) < 1 && Math.abs(a[2] - z.w) < 1);
    // off screen: the chevron and its label
    z.x = camX - 600; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    P.fillText = function (...a) { if (this === ctx) texts.push(String(a[0])); return oFT.apply(this, a); };
    _lxSafeZoneBeacons();
    P.fillText = oFT;
    const chevron = px(21, z.y - camY + z.h / 2);
    // no art at all: the ground marker's fallback, inside drawHazards, must still be bright and inside the rect
    z.x = camX + 420; const keepFx = LX_FX.gravitos_singularity_zone; const animArr = (typeof _fxAnimFrames === 'function') ? _fxAnimFrames('gravitos_singularity_zone') : null; const keepAnim = animArr ? animArr.slice() : null;
    LX_FX.gravitos_singularity_zone = undefined; if (animArr) animArr.length = 0;   // the frames array is cached by the game: empty it in place
    const zsx = z.x - camX; const zf = []; P.fillRect = function (...a) { if (this === ctx && a[2] <= z.w + 1 && a[3] <= z.h + 1 && a[0] >= zsx - 1 && a[1] >= z.y - 1 && a[0] + a[2] <= zsx + z.w + 1 && a[1] + a[3] <= z.y + z.h + 1) zf.push({ a, fs: String(this.fillStyle) }); return oFR.apply(this, a); };
    let drawErr = null; try { ctx.save(); ctx.translate(0, -camY); drawHazards(); ctx.restore(); } catch (e) { drawErr = String(e).slice(0, 120); } finally { P.fillRect = oFR; }
    LX_FX.gravitos_singularity_zone = keepFx; if (animArr && keepAnim) animArr.push(...keepAnim);
    game.hazards.length = 0;
    return { before, pillar, side, pillarFill: !!pillarFill, chevron, texts: texts.filter((t) => /^SAFE/.test(t)), zoneFills: zf.length, gold: zf.filter((o) => /255[^0-9]+190[^0-9]+70|255[^0-9]+224[^0-9]+140/.test(o.fs)).length, drawErr, fills: zf.map((o) => o.fs).slice(0, 6), stub: { fn: typeof window._fxAnimFrames, sameArr: !!(animArr && animArr === _fxAnimFrames('gravitos_singularity_zone')), frames: animArr ? animArr.length : null } };
  });
  console.log(`\nBEACON  pillar px ${bc.pillar} (black ${bc.before}, beside ${bc.side})  chevron px ${bc.chevron}  labels ${JSON.stringify(bc.texts)}  fallback fills ${bc.zoneFills} (gold ${bc.gold})${bc.drawErr ? '  drawErr ' + bc.drawErr : ''}`);
  check(bc.pillarFill && bc.pillar > bc.before + 60, 'a pillar of light stands over the zone, exactly the rect wide and 150 tall', bc);
  check(bc.side <= bc.before + 8, 'the pillar does not spill beside the rect', bc);
  check(bc.chevron > 60 && bc.texts.length >= 1, 'an off-screen zone gets an edge chevron with a SAFE label', bc);
  check(!bc.drawErr && bc.zoneFills >= 5 && bc.gold >= 5, 'with no art the zone still paints a gold fill + rim, all inside the rect', bc);

  // ---- 3b. the HUD yields: a panel over a live zone fades, and comes back after the zone resolves ---------------
  const yd = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
    const mm = document.getElementById('minimap'); if (!mm) return { noMinimap: true };
    const op = () => +parseFloat(getComputedStyle(mm).opacity).toFixed(2);
    game.hazards.length = 0; await sleep(300); const before = op();
    const camX = game.camera.x; const z = { x: camX + 760, y: 420, w: 102, h: 60 };
    const hz = { type: 'gravitos_singularity', life: 70, maxLife: 84, safeZones: [z], x: z.x, y: z.y, w: z.w, h: z.h };
    let during = 1;   // keep the zone alive for 700 ms whatever the game does to a stray hazard, and take the lowest opacity seen
    for (let k = 0; k < 20; k++) { if (!game.hazards.includes(hz)) game.hazards.push(hz); hz.life = 70; await sleep(35); during = Math.min(during, op()); }
    let after = null, wiped = 0;   // keep the hazards empty while waiting: the boss's own AI may start a real OHKO here
    for (let k = 0; k < 12; k++) { if (game.hazards.length) { game.hazards.length = 0; wiped++; } await sleep(100); after = op(); }
    return { before, during, after, wiped };
  });
  console.log(`
HUD YIELDS  minimap opacity before ${yd.before}  during ${yd.during}  after ${yd.after}`);
  check(!yd.noMinimap && yd.before >= 0.8 && yd.during <= 0.2 && yd.after >= 0.8, 'the minimap fades while a zone is alive and returns after', yd);

  // ---- 4. cadence: a real form-3 rain, boxes 4 s apart on the wall clock, pattern ends after the last -----------
  const cad = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
    const boss = () => game.monsters.find((x) => x && x.type === 'gravitos' && x.currentHp > 0);
    const clear = () => { for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); } game.paused = false; };
    const phaseOf = (m) => (m && (m._gravitosPhase || m.phase)) | 0;
    for (let want = 2; want <= 3; want++) { let m = boss(), tries = 0; while (m && phaseOf(m) < want && tries++ < 6) { clear(); m.evasion = 0; m._dying = false; m.currentHp = 1; hitMonster(m, 99999999, false, 'phys'); for (let k = 0; k < 30; k++) { await sleep(250); clear(); const b = boss(); if (b && phaseOf(b) >= want) break; } m = boss(); } }
    clear(); await sleep(2500); clear();
    const m = boss(); if (!m) return { err: 'no boss' };
    player.x = game.camera.x + 400; player.y = 436; player.vx = player.vy = 0; player._god = true;
    m.currentHp = Math.floor(m.maxHp * 0.49); m.patternState = 'idle'; m.patternTimer = 99999; m._lastSkillAt = -99999; m._lastOhkoAt = -99999; m._ohkoWarnUntil = null; m._ohkoQueued = null;
    m._instaTimer = 99999; m._rainTimer = -1; m._soulTimer = 99999;
    const seen = new Set(), stamps = []; let endedAt = null, lastDeath = null; const t0 = performance.now();
    while (performance.now() - t0 < 40000) {
      await sleep(30);
      for (const h of game.hazards) { if (h && h.type === 'gravitos_singularity' && !seen.has(h)) { seen.add(h); stamps.push(performance.now()); } if (h && h.type === 'gravitos_singularity' && h.life <= 0 && seen.has(h)) lastDeath = lastDeath || performance.now(); }
      if (stamps.length >= 4 && m.patternState !== 'collapseRain') { endedAt = performance.now(); break; }
    }
    const gaps = stamps.slice(1).map((t, i) => +((t - stamps[i]) / 1000).toFixed(2));
    return { form: phaseOf(m), boxes: stamps.length, gaps, endedAfterLast: endedAt ? +((endedAt - stamps[stamps.length - 1]) / 1000).toFixed(2) : null, state: m.patternState };
  });
  console.log(`\nCADENCE (form ${cad.form})  boxes ${cad.boxes}  gaps s ${JSON.stringify(cad.gaps)}  pattern ended ${cad.endedAfterLast} s after the last box  (${cad.state})`);
  check(cad.form === 3 && cad.boxes === 4, 'form 3 drops all four boxes', cad);
  check(cad.gaps.length === 3 && cad.gaps.every((g) => g >= 3.6 && g <= 4.8), 'the boxes are 4 s apart on the wall clock (previous build: ~1.9 s in form 3)', cad.gaps);
  check(cad.endedAfterLast != null && cad.endedAfterLast >= 1.2 && cad.endedAfterLast <= 4.0, 'the pattern ends once the last box has resolved', cad);
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad === 0 ? `\nall ${total} passed` : `\n${bad} of ${total} FAILED`);
process.exit(bad === 0 ? 0 : 1);
