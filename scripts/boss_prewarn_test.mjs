// Every boss's swing windup draws ITS OWN warning sprite, not the shared striped arc (v0.30.x boss-prewarn).
//   node scripts/boss_prewarn_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build; PORT=<port>)
// Per user: the swing warning "seems to appear on ALL bosses identically, using ludo.ai generate unique customised sprite for
// each boss", "it should be a prewarn striking swing sprite before impact", "remove the yellow and black". Each boss is spawned
// in its own arena (Aetherion: sanctum, Distorted Mira: lastStep, the Ossuary Tyrant: ossuarySprawl, the Master Conductor:
// clockworkExpress), a bigMelee windup is held, and the zone pass's drawImage calls are recorded (src, device box, alpha):
//   - the arena asks for its boss's warning art before any windup (lazy-fx)
//   - form 1 / form 2 / first life / after the revive / the Tyrant / the Conductor each draw their tgsw_ sprite over the zone
//     box (mirrored for a left swing) and NOTHING else in the zone pass: no tg_swing, no swing ghost
//   - it charges like tg_swing did: 30% + 55% x prog, 97% in the last beats
//   - the strike that follows is unchanged (Aetherion: the tinted fx_heavyswing; the Conductor: his own swing art), never tgsw_
//   - a boss with no warning of its own (Aries) draws exactly as before; no page errors
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11551';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
// the working copy can lag origin: a file missing here (and every data / root script) is served from origin/main
const CT = { '.webp': 'image/webp', '.png': 'image/png', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.css': 'text/css', '.jpg': 'image/jpeg' };
const gitShow = (rel) => new Promise((res) => execFile('git', ['show', 'origin/main:' + rel], { cwd: ROOT, encoding: 'buffer', maxBuffer: 1 << 26 }, (e, out) => res(e ? null : out)));
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.route((u) => u.hostname === 'localhost', async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (!rel || rel === FILE || /^tgsw_/.test(path.basename(rel)) || /[.]html$/.test(rel)) return r.continue();
    const fromOrigin = /^data[/].*[.]js$/.test(rel) || /^[^/]+[.]js$/.test(rel);
    if (!fromOrigin && existsSync(path.join(ROOT, rel))) return r.continue();
    const body = await gitShow(rel);
    if (!body) return r.continue();
    return r.fulfill({ status: 200, contentType: CT[path.extname(rel).toLowerCase()] || 'application/octet-stream', body });
  });
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function' && typeof _drawAttackZones === 'function' && typeof LX_FX === 'object', null, { timeout: 180000 });
  await p.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth', 'lo-menu']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; try { _lxBootHold.release('menu'); } catch (e) {}
    if (!player.cls) applyClass('warrior'); player.level = 90; player._tutorialSeen = true; player._gravitosCineSeen = true;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    // the zone pass: its base transform, its zones, every image it draws (src, device box, alpha)
    const srcOf = (img) => { if (!img) return '?'; const s = (img._lxSrc && img._lxSrc.src) || img.src || '';
      if (s) return String(s).replace(/^.*?Sprites[/]/, ''); if (window.__tint && window.__tint.has(img)) return 'TINT:fx_heavyswing'; if (window.__anim && window.__anim.has(img)) return 'ANIM:' + window.__anim.get(img); return img.tagName || '?'; };
    const P = CanvasRenderingContext2D.prototype, oDI = P.drawImage; window.__rec = []; window.__on = null;
    P.drawImage = function (img, ...a) {
      if (window.__on) { try { const t = this.getTransform(), [dx, dy, dw, dh] = a.length >= 8 ? a.slice(4, 8) : a.length >= 4 ? a : [a[0], a[1], img.width, img.height];
        const xs = [dx, dx + dw].map((x) => [dy, dy + dh].map((y) => [t.a * x + t.c * y + t.e, t.b * x + t.d * y + t.f])).flat();
        window.__rec.push({ pass: window.__on, src: srcOf(img), x0: Math.min(...xs.map((q) => q[0])), x1: Math.max(...xs.map((q) => q[0])), y0: Math.min(...xs.map((q) => q[1])), y1: Math.max(...xs.map((q) => q[1])),
          flip: t.a < 0, alpha: +this.globalAlpha.toFixed(3) }); } catch (e) {} }
      return oDI.call(this, img, ...a);
    };
    const oZ = window._drawAttackZones; window.__zones = [];
    window._drawAttackZones = function () { const B = ctx.getTransform(), camX = game.camera.x;
      window.__zones = (window._lxAttackZones() || []).filter((z) => z.kind === 'swing').map((z) => { const xs = [z.x - camX, z.x - camX + z.w], ys = [z.y, z.y + z.h];
        return { type: z.sg && z.sg.type, pw: z.pw || null, dir: z.dir, prog: z.prog, x0: B.a * xs[0] + B.e, x1: B.a * xs[1] + B.e, y0: B.d * ys[0] + B.f, y1: B.d * ys[1] + B.f }; });
      window.__on = 'zone'; try { return oZ.apply(this, arguments); } finally { window.__on = null; } };
    const oP = window.drawProjectiles; window.drawProjectiles = function () { window.__on = 'proj'; try { return oP.apply(this, arguments); } finally { window.__on = null; } };
  });
  const frames = (n) => p.evaluate(async (n) => { const g0 = game.time | 0, t0 = performance.now(); while ((game.time | 0) - g0 < n && performance.now() - t0 < 20000) await new Promise((r) => setTimeout(r, 30)); return (game.time | 0) - g0; }, n);
  await p.evaluate(() => {
    // the held boss: its windup clock and facing read through getters, so the sim cannot fire or turn it while held
    window.__hold = { m: null, T: null, f: 1 };
    window.__grab = (m, f) => { const h = window.__hold; h.m = m; h.f = f; h.T = null; let T = m._bigMeleeT || 0, F = !!m._bigMeleeFiring;
      Object.defineProperty(m, '_bigMeleeT', { configurable: true, get: () => (h.m === m && h.T != null ? h.T : T), set: (x) => { T = x; } });
      Object.defineProperty(m, '_bigMeleeFiring', { configurable: true, get: () => (h.m === m && h.T != null ? true : F), set: (x) => { F = !!x; } });
      Object.defineProperty(m, 'facing', { configurable: true, get: () => h.f, set: () => {} }); };
    (function keep() { try { const h = window.__hold, m = h.m;
      if (m) { m.currentHp = m.maxHp; m.stunTimer = 0; m._bigMeleeCd = 1e9; m.vx = 0; }
      player.invulnerable = 999999; player._god = true; if (player.hp < getMaxHp()) player.hp = getMaxHp(); game.paused = false;
      for (const id of ['story-beat-overlay', 'boss-intro-overlay', 'everdawn-welcome-overlay']) { const el = document.getElementById(id); if (el && el.style.display !== 'none') el.style.display = 'none'; }
    } catch (e) {} requestAnimationFrame(keep); })();
    window.__wait = async (n) => { const g0 = game.time | 0, t0 = performance.now(); while ((game.time | 0) - g0 < n && performance.now() - t0 < 20000) await new Promise((r) => setTimeout(r, 30)); return (game.time | 0) - g0; };
    window.__ready = async (k) => { const t0 = performance.now(); while (LX_FX[k] && !_lxFxReady(LX_FX[k]) && performance.now() - t0 < 40000) await new Promise((r) => setTimeout(r, 100)); return !!(LX_FX[k] && _lxFxReady(LX_FX[k])); };
    window.__arena = async (map, keys) => {
      window.__hold.m = null; loadMap(map); try { closeAllModals(); } catch (e) {} game.paused = false;
      const asked = {}; for (const k of keys) { const im = LX_FX[k]; asked[k] = !!im && (im._lxWanted === true || im._lxLazy !== true); }
      await window.__wait(20); try { closeAllModals(); } catch (e) {} game.monsters.length = 0; return asked; };
    window.__boss = async (type, isBoss, f, key) => {
      game.monsters.length = 0; const gy = (game.mapData.groundY || ((game.mapData.worldHeight || 600) - 80));
      const m = spawnMonster(Math.round((game.mapData.worldWidth || 1600) * 0.45), gy - 300, type, isBoss, false);
      window.__grab(m, f); await window.__wait(25);
      player.x = f > 0 ? m.x + m.w + 40 : m.x - player.w - 40; player.y = m.y + m.h - player.h - 2; player.vx = 0;
      if (key) await window.__ready(key); if (LX_FX['swing_' + type]) await window.__ready('swing_' + type);
      await window.__wait(10); return m; };
    window.__measure = async (frac) => { const m = window.__hold.m; window.__hold.T = m.traits.bigMelee.telegraphMs * frac; await window.__wait(3);
      window.__rec = []; await window.__wait(6); const z = window.__zones.find((q) => q.type === m.type) || null;
      return { zone: z, art: window.__rec.filter((a) => a.pass === 'zone' && /tg_swing|swing_|tgsw_/.test(a.src)), prog: z && z.prog }; };
    window.__strike = async () => { const h = window.__hold, m = h.m, t = h.T; h.T = null; m._bigMeleeT = t; m._bigMeleeFiring = true;
      window.__tint = new Set([_lxTintedFx(LX_FX.fx_heavyswing, m.color)]); window.__anim = new Map();
      try { const fr = _FX_ANIM_KEYS.has('swing_' + m.type) ? _fxAnimFrames('swing_' + m.type) : null; if (fr) for (const im of fr) window.__anim.set(im, 'swing_' + m.type); } catch (e) {}
      window.__rec = []; await window.__wait(45);
      return window.__rec.filter((a) => a.pass === 'proj' && /swing|heavyswing|tgsw|TINT|ANIM/.test(a.src)).map((a) => a.src); };
  });
  const E = (s) => p.evaluate(s);
  const seen = [];   // every zone-pass draw of the six
  const boss = async (what, key, r) => {
    seen.push(...r.art.map((a) => a.src));
    const over = r.zone && r.art.find((a) => a.src.endsWith('/' + key + '.webp') && Math.abs(a.x0 - r.zone.x0) <= 3 && Math.abs(a.x1 - r.zone.x1) <= 3 && Math.abs(a.y0 - r.zone.y0) <= 3 && Math.abs(a.y1 - r.zone.y1) <= 3);
    const ok = !!r.zone && r.zone.pw === key && r.art.length > 0 && r.art.every((a) => a.src.endsWith('/' + key + '.webp')) && !!over && over.flip === (r.zone.dir === 'left');
    check(ok, `${what}: the windup draws ${key} over the swing zone${r.zone && r.zone.dir === 'left' ? ' (mirrored, a left swing)' : ''}, and no tg_swing / swing ghost`,
      { pw: r.zone && r.zone.pw, zone: r.zone, art: r.art.slice(0, 3) });
  };
  // 1) Aetherion in the Sanctum: form 1, the charge-up, form 2, his strike
  const asked = {};
  Object.assign(asked, await E(() => __arena('sanctum', ['tgsw_aetherion', 'tgsw_aetherion2'])));
  await E(() => __boss('aetherion', true, 1, 'tgsw_aetherion'));
  const a1 = await E(() => __measure(0.6));
  await boss('Aetherion, form 1', 'tgsw_aetherion', a1);
  const a9 = await E(() => __measure(0.1));
  const al = (r) => { const w = r.art.filter((a) => a.src.endsWith('/tgsw_aetherion.webp')); return w.length ? w[w.length - 1].alpha : null; };   // the warning's own alpha
  check(a1.prog != null && a9.prog != null && Math.abs(al(a1) - (0.30 + 0.55 * a1.prog)) <= 0.02 && a9.prog > 0.82 && al(a9) === 0.97 && al(a9) > al(a1),
    'the warning charges like the arc it replaces: 30% + 55% x prog through the windup, 97% for the last beats', { prog: [a1.prog, a9.prog], alpha: [al(a1), al(a9)] });
  await E(() => { __hold.m._phaseSprite = 'aetherion2'; });
  await E(() => __ready('tgsw_aetherion2'));
  await boss('Aetherion, Tearborn Ascendant (form 2)', 'tgsw_aetherion2', await E(() => __measure(0.6)));
  const s1 = await E(() => __strike());
  check(s1.includes('TINT:fx_heavyswing') && !s1.some((x) => /tgsw/.test(x)), "Aetherion's strike is unchanged: the tinted heavy-swing crescent, never the warning", s1.slice(0, 6));
  // 2) Distorted Mira at the Last Step: first life, then after her one revive (a left swing)
  Object.assign(asked, await E(() => __arena('lastStep', ['tgsw_miraFallen', 'tgsw_miraFallen2'])));
  await E(() => __boss('miraFallen', true, -1, 'tgsw_miraFallen'));
  await boss('Distorted Mira, first life', 'tgsw_miraFallen', await E(() => __measure(0.6)));
  await E(() => { __hold.m._revivedOnce = true; });
  await E(() => __ready('tgsw_miraFallen2'));
  await boss('Distorted Mira, after her revive', 'tgsw_miraFallen2', await E(() => __measure(0.6)));
  // 3) the Ossuary Tyrant in the Ossuary Sprawl, as the map spawns him (a rare elite, not a boss)
  Object.assign(asked, await E(() => __arena('ossuarySprawl', ['tgsw_ossuaryTyrant'])));
  await E(() => __boss('ossuaryTyrant', false, 1, 'tgsw_ossuaryTyrant'));
  await boss('the Ossuary Tyrant (rare elite, its map)', 'tgsw_ossuaryTyrant', await E(() => __measure(0.6)));
  // 4) the Master Conductor on the Ticket Rush stage-4 arena (spawned by the test, as the duel spawns him at runtime)
  Object.assign(asked, await E(() => __arena('clockworkExpress', ['tgsw_pqConductor'])));
  await E(() => __boss('pqConductor', true, -1, 'tgsw_pqConductor'));
  await boss('the Master Conductor', 'tgsw_pqConductor', await E(() => __measure(0.6)));
  const s2 = await E(() => __strike());
  check(s2.some((x) => /swing_pqConductor/.test(x)) && !s2.some((x) => /tgsw|TINT/.test(x)), "the Conductor's strike is unchanged: his own swing art, never the warning", s2.slice(0, 6));
  check(Object.keys(asked).length === 6 && Object.values(asked).every(Boolean), "each arena asks for its boss's warning art on entry, before any windup", asked);
  check(seen.length > 0 && !seen.some((x) => /tg_swing/.test(x)), 'tg_swing (the striped arc) is never drawn for these six once their art is ready', [...new Set(seen)]);
  // 5) a boss with no warning of its own draws as before: Aries' own swing ghost (tg_swing while that art decodes)
  await E(() => __boss('zodiac_aries', true, 1, null));
  const ar = await E(() => __measure(0.6)), arReady = await E(() => _lxFxReady(LX_FX.swing_zodiac_aries));
  check(!!ar.zone && ar.zone.pw === null && ar.art.length > 0 && ar.art.every((a) => (arReady ? /swing_zodiac_aries/ : /tg_swing/).test(a.src)),
    'Aries (no warning sprite) draws exactly as before: its own swing ghost, no tgsw_', { pw: ar.zone && ar.zone.pw, ready: arReady, art: ar.art.slice(0, 3).map((a) => a.src) });
  check(errs.length === 0, 'no page errors', errs.slice(0, 4));
} finally { await browser.close(); srv.kill(); }
console.log(bad ? `${bad} of ${total} FAILED` : `all ${total} passed`);
process.exit(bad ? 1 : 0);
