// Themed ceiling hazards draw their own art (v0.30.x hazard-themed-art).
//   node scripts/hazard_themed_art_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// Per user ("Give them matching art"): the bone maps' falling rib-cages / rib-bone / bone avalanche and the Wayfarer's Gate embers
// all fell as the red molten meteor. Each themed map now forces one drop and checks: its sprite (p_hz_<art>) is what is drawn and
// the meteor is not; bones land in bone dust, not fire; and the hazard is the same one as before - the same damage taken standing
// in the lane (vs the same drop with its art removed), the same warning length, the same sounds. Lava maps still draw the meteor.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11821';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const ART_SRC = process.env.LX_HZART_SRC || 'C:/Users/dpeh0/AppData/Local/Temp/claude/fa_reports/hazart/final';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
// [map, art (null = red meteor), damage, warnMs] - the numbers are origin's table values, which this change must not move
const MAPS = [['boneGraveyard', 'skull', 70, 1500], ['boneGraveyard2', 'skull', 95, 1300], ['boneGraveyard3', 'skull', 115, 1200],
  ['hollowSepulchre', 'ribbone', 70, 1700], ['ossuarySprawl', 'bonechunk', 110, 1700], ['wayfarersLantern2', 'ember', 120, 1400],
  ['lavaCavern', null, null, null], ['magmaFoundry', null, 110, 1400]];
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: 'font/woff2', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
  });
  await p.route((u) => /[/]Sprites[/](projectiles[/]p_hz_[a-z]+|fx[/]meteor_marker_bone)[.]webp$/.test(u.pathname), async (r) => {   // the new art, before it is in the tree
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    const f = path.join(ART_SRC, path.basename(rel));
    if (existsSync(f)) return r.fulfill({ status: 200, contentType: 'image/webp', body: readFileSync(f) });
    r.continue();
  });
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof updateMapEvents === 'function', null, { timeout: 150000 });
  await p.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'warrior'; player.level = 90;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    // spy: which picture each drawImage paints (a scaled bake or a loop frame is traced back to its source file)
    const tagOf = new WeakMap(), base = (u) => String(u || '').split('/').pop().replace(/[?#].*$/, '');
    const _ps = window._lxProjScaled; window._lxProjScaled = function (img) { const r = _ps.apply(this, arguments); if (r && r !== img && typeof r === 'object') tagOf.set(r, base(img && img.src)); return r; };
    const _pa = window._projAnimFrame; if (_pa) window._projAnimFrame = function (k) { const r = _pa.apply(this, arguments); if (r && typeof r === 'object') tagOf.set(r, 'anim:' + k); return r; };
    window.__tags = null;
    const _di = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (img) { if (window.__tags) { const t = tagOf.get(img) || (img && img.src ? base(img.src) : ''); if (/p_hz_|meteor/.test(t)) window.__tags[t] = (window.__tags[t] || 0) + 1; } return _di.apply(this, arguments); };
    window.__snd = null; if (typeof audio !== 'undefined' && audio && audio.play) { const _pl = audio.play.bind(audio); audio.play = (n, ...a) => { if (window.__snd) window.__snd.push(n); return _pl(n, ...a); }; }
    window.__frames = async (n) => { const g0 = game.time | 0, t0 = performance.now(); while ((game.time | 0) - g0 < n && performance.now() - t0 < 25000) await new Promise((r) => requestAnimationFrame(r)); return (game.time | 0) - g0; };
  });
  for (const [id, art, dmg, warn] of MAPS) {
    const r = await p.evaluate(async ([id]) => {
      loadMap(id); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
      const pin = () => { game.monsters.length = 0; player.vx = 0; game._lavaEruptCD = 1e9; game._gustCD = 1e9; player.hp = 99999; for (const d of (game.damageNumbers || [])) if (d && d.taken && !window.__seen.has(d)) { window.__seen.add(d); if (window.__src) window.__hits.push(String(d.text)); } };
      window.__seen = window.__seen || new WeakSet(); window.__hits = []; window.__src = null;
      if (!window.__mx) { window.__mx = getMaxHp; window.getMaxHp = () => 99999; }   // a pool no drop can empty: a hit reads as its own damage number, never as 'whatever HP was left'
      const cfg = MAPS[id].lavaEruptions || MAPS[id].ceilingHazards;
      const spawn = (dx) => { game.hazards.length = 0; game.paused = false; if (player.hp <= 0) player.hp = 100; game._lavaEruptCD = -1; updateMapEvents(16); const h = game.hazards.find((q) => q.type === 'meteor_warn'); game._lavaEruptCD = 1e9;
        if (h) { const px = player.x + player.w / 2 + dx; h.cx = px; h.x = px - h.radius; } return h; };   // on screen: a random spot can be off-camera
      player.invulnerable = 999999; pin();
      // 1) the look: hold one drop mid-fall and record what is painted (wait for lazy art first)
      let h = spawn(160); if (!h) return { err: 'no hazard spawned' };
      const want = (typeof LX_HZ_ART !== 'undefined' && h._art) ? LX_HZ_ART[h._art] : null;
      const wmk = (want && h._art !== 'ember') ? LX_HZ_ART.marker : null;
      for (let i = 0; i < 200 && want && !(want.complete && want.naturalWidth && (!wmk || (wmk.complete && wmk.naturalWidth))); i++) { _lxPlayerProjReady(want); if (wmk) _lxPlayerProjReady(wmk); if (h._art === 'bonechunk') _lxPlayerProjReady(LX_HZ_ART.ribbone); await __frames(1); }
      const hold = Math.round(h.maxLife * 0.5); let tags = {};
      for (let i = 0; i < 40; i++) { h.life = hold; pin(); window.__tags = {}; await __frames(1); for (const k in __tags) tags[k] = (tags[k] || 0) + __tags[k]; window.__tags = null; if (i > 15 && Object.keys(tags).length) break; }
      const coop = (typeof _coopHazList === 'function') ? (_coopHazList().find((e) => e.t === 'meteor_warn') || {}) : {};
      const out = { art: h._art || null, dmg: h.damage, maxLife: h.maxLife, warnMs: cfg.warnMs, tags, coopAr: coop.ar || null };
      // 2) the hazard itself: stand in the lane, take the drop; then the same drop with its art removed
      const run = async (strip) => {
        await __frames(40);   // let the last landing's hit-stop and flash run out first
        const q = spawn(0); if (strip) delete q._art;
        player.invulnerable = 0; player._god = false; window.__hits = []; window.__src = q._sourceLabel; window.__snd = []; game.particles.length = 0;
        const g0 = game.time | 0, t0 = performance.now(); let gone = -1, parts = null;
        while (performance.now() - t0 < 25000) { pin(); if (game.hazards.indexOf(q) < 0) { gone = (game.time | 0) - g0; parts = game.particles.map((x) => x.color); break; } await __frames(1); }
        player.invulnerable = 999999; window.__src = null; const snd = window.__snd; window.__snd = null;
        return { hits: window.__hits.join(' '), gone, snd: snd.filter((n) => n !== 'step').join(','), fire: parts ? parts.filter((c) => c === '#ff6633' || c === '#ffdd44').length : -1, dust: parts ? parts.filter((c) => /^#(efe6d0|d6cbb2|b3a88f|8f846d)$/.test(c)).length : -1 };
      };
      out.withArt = await run(false); out.noArt = await run(true);
      return out;
    }, [id]);
    if (r.err) { check(false, id + ' spawns its ceiling hazard', r); continue; }
    const hz = Object.keys(r.tags).filter((t) => /^p_hz_/.test(t)), met = Object.keys(r.tags).filter((t) => /meteor/.test(t) && !/marker/.test(t)), mk = Object.keys(r.tags).filter((t) => /marker/.test(t));
    if (art) {
      check(r.art === art && hz.includes('p_hz_' + art + '.webp') && hz.every((t) => t === 'p_hz_' + art + '.webp' || (art === 'bonechunk' && t === 'p_hz_ribbone.webp')) && !met.length, `${id}: falls as its ${art} sprite, not the red meteor`, r.tags);
      check(r.coopAr === art, `${id}: co-op guests get the ${art} look`, { coopAr: r.coopAr });
      if (art !== 'ember') check(mk.length === 1 && mk[0] === 'meteor_marker_bone.webp', `${id}: warns with the bone ground rune`, mk);
      else check(mk.length === 1 && mk[0] === 'meteor_marker.webp', `${id}: embers keep the fiery ground rune`, mk);
      if (art !== 'ember') check(r.withArt.dust > 0 && r.withArt.fire === 0, `${id}: lands in bone dust, not fire`, r.withArt);
    } else {
      check(!r.art && met.length > 0 && !hz.length, `${id}: lava still falls as the red meteor`, r.tags);
      check(mk.length === 1 && mk[0] === 'meteor_marker.webp', `${id}: lava keeps the fiery ground rune`, mk);
    }
    const warnFrames = Math.max(20, Math.round((r.warnMs || 1600) / 16.67));
    check((dmg == null || r.dmg === dmg) && (warn == null || r.warnMs === warn) && r.maxLife === warnFrames, `${id}: damage ${r.dmg} and warning ${r.maxLife} frames unchanged`, r);
    check(r.withArt.hits !== '' && r.withArt.hits === r.noArt.hits && r.withArt.snd === r.noArt.snd
      && [r.withArt.gone, r.noArt.gone].every((g) => g >= r.maxLife - 2 && g <= r.maxLife + 20),   // lands when its warning runs out (game frames; a hit-stop adds a few)
      `${id}: same hit (${r.withArt.hits}), same timing, same sounds as the plain drop`, { withArt: r.withArt, noArt: r.noArt });
  }
  check(errs.length === 0, 'no page errors', errs.slice(0, 4));
} catch (e) { check(false, 'harness', String(e).slice(0, 300)); }
finally { await browser.close(); srv.kill(); }
console.log(bad ? `${bad} of ${total} FAILED` : `all ${total} passed`);
process.exit(bad ? 1 : 0);
