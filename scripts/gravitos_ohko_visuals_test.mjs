// Gravitos's collapses get their own looks (v0.30.x gravitos-ohko-visuals): Collapse Rain (meteors, aurora rift, crystal shelter, its own
// counter) and the Singularity (black hole, clock-face counter) - visuals only.
//   node scripts/gravitos_ohko_visuals_test.mjs        (MOJI_GAME_FILE=<build.html> to test a private build; PORT)
// Per user: "For collapse rain could you make a unique sprite for it using ludo.ai it needs to be similar but differentiated from
// singularity", "it has to be extremely powerful looking", "for singularity can make it look way more devastating and the counter should
// be much more well designed and distinct for singularity". Live arena (gravitosArena, form 2) with his own patterns spawning the hazards;
// the draws are read off a ctx.drawImage / fillText spy, the resolves through the real hazard step, co-op through the real handlers.
// The new art is served from LX_GOV_ART_SRC while it is not in the checkout yet (before the assets half has run).
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11864';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const ART_SRC = process.env.LX_GOV_ART_SRC || 'C:/Users/dpeh0/AppData/Local/Temp/claude/fa_reports/rainart/final';
const ART = ['grav_rain_meteor', 'grav_rain_rift', 'grav_rain_aurora', 'grav_rain_impact', 'grav_rain_shelter', 'grav_rain_dial', 'grav_rain_icon',
  'grav_sing_core', 'grav_sing_lens', 'grav_sing_wave', 'grav_sing_dial', 'grav_sing_debris', 'grav_sing_burst'];
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const cache = new Map();   // fonts + data tables from origin: the shared working copy may hold another session's unshipped files
const fromOrigin = (rel) => { if (!cache.has(rel)) cache.set(rel, execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 26 })); return cache.get(rel); };
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.route((u) => /[/](assets[/]fonts[/].*[.]woff2|data[/][a-z_]+[.]js|Sprites[/]fx[/]grav_(rain|sing)_[a-z]+[.]webp)$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (/grav_(rain|sing)_/.test(rel)) {   // the new art: the checkout's copy once shipped, else the reviewed source folder
      if (existsSync(path.join(ROOT, rel))) return r.continue();
      const f = path.join(ART_SRC, path.basename(rel)); return existsSync(f) ? r.fulfill({ status: 200, contentType: 'image/webp', body: readFileSync(f) }) : r.continue();
    }
    if (rel.endsWith('.woff2') && existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: rel.endsWith('.woff2') ? 'font/woff2' : 'text/javascript', body: fromOrigin(rel) }); } catch (e) { r.continue(); }
  });
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof bossAI === 'function', null, { timeout: 150000 });
  await p.evaluate(() => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth', 'lo-menu']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'warrior'; player.level = 100; player._gravitosCineSeen = true;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    loadMap('gravitosArena'); game.paused = false;
  });
  await p.waitForFunction(() => game.monsters.some((m) => m && m.type === 'gravitos' && m.currentHp > 0), null, { timeout: 60000 });
  const R = await p.evaluate(async (ART) => {
    const W8 = (ms) => new Promise((s) => setTimeout(s, ms)), out = {};
    const m = game.monsters.find((x) => x && x.type === 'gravitos');
    // his AI holds still unless a case lets it run (a held collapse pattern is kept, so he does not scrub its hazard); a death is counted
    window.__ai = false; const oAI = window.bossAI; window.bossAI = function (mm) { if (mm === m && !window.__ai) { if (mm.patternState !== 'singularity' && mm.patternState !== 'collapseRain') mm.patternState = 'idle'; mm.patternTimer = Math.min(mm.patternTimer || 0, 100); mm.vx = 0; return; } return oAI.apply(this, arguments); };
    window.__deaths = 0; window.triggerDeath = function () { window.__deaths++; player._diedHere = true; };
    window._tryCheatDeathRevive = () => false;
    window.__pin = null;
    const keep = () => { game.paused = false; for (const id of ['story-beat-overlay', 'boss-intro-overlay', 'everdawn-welcome-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); } if (window.__pin) window.__pin.h.life = window.__pin.life; requestAnimationFrame(keep); };
    requestAnimationFrame(keep);
    m._phaseSprite = 'gravitos2'; m._gravitosPhase = 2; m.currentHp = Math.floor(m.maxHp * 0.6); m._warpTimer = 1e9; m._shackleCd = 1e9; m._wardNextAt = 1e12; m._dirRollT = 1e9; m._soulTimer = m._instaTimer = m._rainTimer = 1e9;
    const ww = game.mapData.worldWidth || 2200; m.x = ww - 260 - m.w; m.y = 480 - m.h;
    const steps = async (n) => { const g0 = game.time | 0, t0 = performance.now(); while ((game.time | 0) - g0 < n && performance.now() - t0 < 60000) await W8(16); return (game.time | 0) - g0; };
    const hero = (hp, mp, x) => { player._god = false; player._downed = false; game.dying = false; player._diedHere = false; player.invulnerable = 0; player._hitIframeAt = null; player.hp = hp; player.mp = mp; player.x = x; player.y = 480 - player.h; player.vx = player.vy = 0; player.blockTimer = 0; };
    const clearHz = () => { window.__pin = null; for (let i = game.hazards.length - 1; i >= 0; i--) if (game.hazards[i] && game.hazards[i].type === 'gravitos_singularity') game.hazards.splice(i, 1); };
    const live = () => game.hazards.find((q) => q && q.type === 'gravitos_singularity' && q.life > 0);
    player._god = true; player.invulnerable = 999999; player.x = 900; player.y = 480 - player.h;
    // the art: asked for when he spawns (his lazy-art row), and every sprite decodes
    { const row = (typeof _LX_MOB_TYPE_ART !== 'undefined' && _LX_MOB_TYPE_ART.gravitos && _LX_MOB_TYPE_ART.gravitos.img) || [];
      out.row = ART.filter((k) => !row.includes(k));
      for (const k of ART) if (typeof LX_FX !== 'undefined' && LX_FX[k]) _lxFxReady(LX_FX[k]);
      const t0 = performance.now(); while (performance.now() - t0 < 20000 && !ART.every((k) => LX_FX[k] && LX_FX[k].complete && LX_FX[k].naturalWidth > 0)) await W8(100);
      out.decoded = ART.filter((k) => LX_FX[k] && LX_FX[k].complete && LX_FX[k].naturalWidth > 0).length;
      for (const k of ['gravitos_singularity_zone', 'safezone_ring', 'safezone_shield']) if (LX_FX[k]) _lxFxReady(LX_FX[k]); await W8(1500); }
    // the spy: which LX_FX sprites (by key) and which caption strings a few frames draw
    const keyOf = new Map(); for (const k of Object.keys(LX_FX)) { const im = LX_FX[k]; if (im && typeof im === 'object') keyOf.set(im, k); }
    const C2 = CanvasRenderingContext2D.prototype, oDI = C2.drawImage, oFT = C2.fillText;
    let rec = null; C2.drawImage = function (img) { if (rec && keyOf.has(img)) rec.img.add(keyOf.get(img)); return oDI.apply(this, arguments); };
    C2.fillText = function (t) { if (rec) rec.txt.add(String(t)); return oFT.apply(this, arguments); };
    const spy = async (n) => { rec = { img: new Set(), txt: new Set() }; await steps(n); const r = { img: [...rec.img], txt: [...rec.txt] }; rec = null; return r; };
    // ---- the Singularity: his own pattern spawns it
    clearHz(); window.__ai = true; m.patternState = 'singularity'; m.patternTimer = 0; m._ohkoWarnUntil = null;
    { const t0 = performance.now(); let h = null; while (!h && performance.now() - t0 < 45000) { if (m.patternState !== 'singularity') { m.patternState = 'singularity'; m.patternTimer = 0; } h = live(); await W8(16); }
      window.__ai = false;
      out.sing = h ? { art: h._singArt === true, rain: h._rainArt === true, life: h.maxLife, atk: h.atk, w: h.w, zones: (h.safeZones || []).map((z) => [z.w, z.h]) } : null;
      if (h) { window.__pin = { h, life: 250 }; out.singField = await spy(12); window.__pin = { h, life: 100 }; out.singCount = await spy(12); } }
    clearHz(); m.patternState = 'idle'; await steps(4);
    // ---- Collapse Rain: his own pattern, every box (4), each a 1.4 s field, the look on each
    window.__ai = true; m.patternState = 'collapseRain'; m.patternTimer = 0; m._rainIdx = 0; m._rainNextAt = null; m._rainRestF = 0; m._ohkoWarnUntil = null;
    { const boxes = [], t0 = performance.now(); let started = false;
      while (performance.now() - t0 < 120000) {
        if (!started && m.patternState !== 'collapseRain') { m.patternState = 'collapseRain'; m.patternTimer = 0; m._rainIdx = 0; m._rainNextAt = null; m._rainRestF = 0; }
        const h = live(); if (h && !boxes.some((b) => b.h === h)) { started = true; boxes.push({ h, at: performance.now(), life: h.life, maxLife: h.maxLife, atk: h.atk, art: h._rainArt === true, drain: h._rainDrain === true, zones: (h.safeZones || []).map((z) => [z.w, z.h]) }); }
        if (started && m.patternState !== 'collapseRain' && !live()) break;
        await W8(16);
      }
      window.__ai = false;
      out.rain = boxes.map((b) => ({ life: b.life, maxLife: b.maxLife, atk: b.atk, art: b.art, drain: b.drain, zones: b.zones }));
      out.rainGaps = boxes.slice(1).map((b, i) => Math.round(b.at - boxes[i].at));
      out.boom = (game.smoothFx || []).filter((f) => f && f.spriteKey === 'grav_rain_impact').map((f) => f._o); }
    m.patternState = 'idle'; clearHz(); await steps(4);
    // ---- the look of one rain box, pinned at 1 s left (its counter is up)
    { const z = { x: 620, y: 420, w: 102, h: 60 }, h = { type: 'gravitos_singularity', x: 0, y: 0, w: ww, h: 720, cx: m.x + m.w / 2, cy: m.y + m.h / 2, life: 60, maxLife: 84, atk: 99999, safeZones: [z], _rainDrain: true, _sourceLabel: "Gravitos' Collapse Rain", _rainArt: true };
      game.hazards.push(h); window.__pin = { h, life: 60 }; out.rainLook = await spy(12); clearHz(); }
    // ---- another boss's collapse (no flag) keeps the old look
    if (game.smoothFx) game.smoothFx = game.smoothFx.filter((f) => !(f && /^grav_/.test(f.spriteKey || '')));   // the rain's landing bursts have had their say
    { const h = { type: 'gravitos_singularity', _sourceLabel: "the Sovereign's Singularity Collapse", x: 0, y: 0, w: ww, h: 720, cx: 1100, cy: 300, life: 100, maxLife: 300, atk: 99999, safeZones: [{ x: 620, y: 420, w: 102, h: 60 }] };
      game.hazards.push(h); window.__pin = { h, life: 100 }; out.plainLook = await spy(12); clearHz(); }
    C2.drawImage = oDI; C2.fillText = oFT;
    // ---- the resolves are unchanged: a rain box drains (1 HP / 1 MP, alive) outside, spares inside; the Singularity kills outside, spares inside
    const resolve = async (flags, inside, hp, mp) => {
      clearHz(); m.x = ww - 160 - m.w; m.vx = 0;
      const MH = Math.max(1, getMaxHp()), MM = player.maxMp || 100, zx = 620, z = { x: zx, y: 480 - 60, w: 102, h: 60 };
      hero(Math.min(MH, hp), Math.min(MM, mp), inside ? zx + 51 - player.w / 2 : 1100);
      const h = Object.assign({ type: 'gravitos_singularity', x: 0, y: 0, w: ww, h: 720, cx: m.x + m.w / 2, cy: m.y + m.h / 2, life: 20, maxLife: 84, atk: 99999, safeZones: [z] }, flags);
      game.hazards.push(h); const d0 = window.__deaths, t0 = performance.now();
      while (game.hazards.includes(h) && performance.now() - t0 < 30000) { player.x = inside ? zx + 51 - player.w / 2 : 1100; await W8(16); }
      const r = { hp: player.hp, mp: player.mp, died: window.__deaths > d0 || player.hp <= 0, max: Math.min(MH, hp), maxMp: Math.min(MM, mp) };
      player._god = true; player.invulnerable = 999999; player.hp = MH; game.dying = false; return r;
    };
    out.rainOut = await resolve({ _rainDrain: true, _rainArt: true }, false, 4000, 80);
    out.rainIn = await resolve({ _rainDrain: true, _rainArt: true }, true, 4000, 80);
    out.singOut = await resolve({ _singArt: true, maxLife: 330 }, false, 4000, 80);
    out.singIn = await resolve({ _singArt: true, maxLife: 330 }, true, 4000, 80);
    // ---- co-op: the host's snapshot carries both flags and a guest's mirror keeps them
    { clearHz(); const mk = (u, f) => Object.assign({ type: 'gravitos_singularity', x: 0, y: 0, w: ww, h: 720, cx: 0, cy: 0, life: 200, maxLife: 330, atk: 99999, safeZones: [{ x: 300, y: 420, w: 102, h: 60 }], _huid: u }, f);
      game.hazards.push(mk(4251, { _rainDrain: true, _rainArt: true }), mk(4252, { _singArt: true }));
      let list = []; try { list = _coopHazList(); } catch (e) { out.listErr = String(e); }
      const e1 = list.find((q) => q && q.u === 4251), e2 = list.find((q) => q && q.u === 4252); clearHz();
      out.wire = { rain: e1 && e1.xf ? e1.xf._rainArt === true : false, sing: e2 && e2.xf ? e2.xf._singArt === true : false };
      const oF = window._coopFollowingHost, oHost = net.isHost, oHid = net.hostId;
      window._coopFollowingHost = () => true; net.isHost = false; net.hostId = 1;
      try { _coopApplyHazards({ t: 'haz', id: 1, map: game.currentMap, list: [e1, e2].filter(Boolean) }); } catch (er) { out.applyErr = String(er); }
      const m1 = game.hazards.find((q) => q && q._coopMirror && q._huid === 4251), m2 = game.hazards.find((q) => q && q._coopMirror && q._huid === 4252);
      out.mirror = { rain: !!(m1 && m1._rainArt === true), sing: !!(m2 && m2._singArt === true) };
      window._coopFollowingHost = oF; net.isHost = oHost; net.hostId = oHid; clearHz(); }
    out.frames = game.time | 0;
    return out;
  }, ART);
  const has = (s, k) => !!(s && s.img && s.img.includes(k));
  const RAIN = ART.filter((k) => k.startsWith('grav_rain_')), SING = ART.filter((k) => k.startsWith('grav_sing_'));
  check(R.row && R.row.length === 0, "the 13 new sprites are on Gravitos's lazy-art row (asked for when he spawns)", R.row);
  check(R.decoded === ART.length, 'every new sprite decodes', { decoded: R.decoded, of: ART.length });
  check(R.sing && R.sing.art && !R.sing.rain, "his Singularity carries the Singularity look flag (and not the rain's)", R.sing);
  check(R.sing && R.sing.life === 330 && R.sing.atk === 99999 && R.sing.zones.length >= 3 && R.sing.zones.every((z) => z[0] === 112 && z[1] === 70), 'the Singularity is unchanged: 5.5 s field, its shelters 112 x 70, the one-shot atk', R.sing);
  check(R.rain.length === 4 && R.rain.every((b) => b.art && b.drain), 'his Collapse Rain drops 4 boxes, each carrying the rain look flag and its drain tag', R.rain);
  check(R.rain.length === 4 && R.rain.every((b) => b.maxLife === 84 && b.atk === 99999 && b.zones.length === 1 && b.zones[0][0] === 102 && b.zones[0][1] === 60), 'every box is unchanged: a 1.4 s field, one 102 x 60 shelter', R.rain);
  check(R.rainGaps.length === 3 && R.rainGaps.every((g) => g >= 3500), 'the boxes still come about 4 s apart', R.rainGaps);
  check(['grav_sing_core', 'grav_sing_lens'].every((k) => has(R.singField, k)) && !RAIN.some((k) => has(R.singField, k)), 'the Singularity draws the black hole (core, lensing ring; the debris spiral is a low-FX extra) and none of the rain art', R.singField && R.singField.img);
  check(has(R.singCount, 'grav_sing_dial') && R.singCount.txt.includes('REACH THE LIGHT') && !has(R.singCount, 'grav_rain_dial'), "the Singularity's counter is the clock face, captioned REACH THE LIGHT", R.singCount);
  check(has(R.singCount, 'gravitos_singularity_zone') || has(R.singCount, 'safezone_ring'), 'the Singularity keeps its gold shelter', R.singCount && R.singCount.img);
  check(['grav_rain_rift', 'grav_rain_shelter', 'grav_rain_dial', 'grav_rain_icon'].every((k) => has(R.rainLook, k)) && !SING.some((k) => has(R.rainLook, k)), 'a rain box draws its own art (rift, crystal shelter, shield, counter halo) and none of the Singularity art', R.rainLook && R.rainLook.img);
  check(R.rainLook && R.rainLook.txt.includes('REACH THE LIGHT OR DROP TO 1 HP') && !has(R.rainLook, 'safezone_ring'), "the rain's counter keeps its caption; its shelter is not the gold ring", R.rainLook);
  check(R.plainLook && !ART.some((k) => has(R.plainLook, k)) && R.plainLook.txt.includes('REACH THE LIGHT'), "another boss's collapse (no flag) keeps the old look", R.plainLook && R.plainLook.img);
  check(R.boom && R.boom.length > 0 && R.boom.every((o) => o === 'hz'), 'a box lands in crystal bursts that each client draws for itself (never mirrored)', R.boom);
  check(R.rainOut && R.rainOut.hp === 1 && R.rainOut.mp === 1 && !R.rainOut.died, 'a rain box still drains a hero outside its light to 1 HP / 1 MP', R.rainOut);
  check(R.rainIn && R.rainIn.hp === R.rainIn.max && R.rainIn.mp === R.rainIn.maxMp && !R.rainIn.died, 'and spares a hero inside it', R.rainIn);
  check(R.singOut && R.singOut.died, 'the Singularity still kills a hero outside the light', R.singOut);
  check(R.singIn && !R.singIn.died && R.singIn.hp === R.singIn.max, 'and spares a hero inside it', R.singIn);
  check(R.wire && R.wire.rain && R.wire.sing && R.mirror && R.mirror.rain && R.mirror.sing, "co-op: the host's snapshot carries both look flags and a guest's mirror keeps them", { wire: R.wire, mirror: R.mirror, err: R.listErr || R.applyErr });
  check(errs.length === 0, 'no page errors', errs.slice(0, 4));
} catch (e) { check(false, 'harness', String(e).slice(0, 300)); }
finally { await browser.close(); srv.kill(); }
console.log(bad ? `${bad} of ${total} FAILED` : `all ${total} passed`);
process.exit(bad ? 1 : 0);
