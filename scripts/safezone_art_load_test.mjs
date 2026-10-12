// THE SAFE SPOTS WEAR THEIR ART (per user: "ensure the SAFE spots sprite are loaded"). Every boss whose collapse uses Gravitos's safe
// zones - Aetherion's Gate, the Woman Who Turned Back's Gate's Question, the Sovereign's Singularity Collapse - must have the zone art
// asked for when his arena loads: the portal orb and its nine frames, the shield in its eye, the gold ring (_LX_SZ_ART). Only Gravitos's
// row named it, so in those three arenas it stayed parked by the lazy-art hold and every zone drew its stand-ins: a gold box and the
// word SAFE. Each arena is entered on a fresh page (one page would carry the first arena's loads into the next); in the Sanctum the
// Gate is then cast and its zones must draw the art, not the stand-ins.
//   node scripts/safezone_art_load_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 9817);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const ARENAS = [['sanctum', 'Aetherion'], ['lastStep', 'the Woman Who Turned Back'], ['tower_b10', 'the Sovereign']];
try {
  for (const [map, who] of ARENAS) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
    await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
    await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 90000 });
    await page.waitForTimeout(9000);
    await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
    await page.fill('#hero-name-input', 'Haven');
    await page.evaluate(() => { const m = document.getElementById('class-select-modal'); for (const el of m.querySelectorAll('button,div,li')) { if (el.children.length > 3) continue; if (getComputedStyle(el).display === 'none') continue; if (/warrior/i.test(el.textContent || '')) { el.click(); break; } } });
    await page.click('#cs-nav-next').catch(() => {});
    await page.waitForTimeout(2500);
    await page.evaluate((map) => {
      player._storyBeatsSeen = player._storyBeatsSeen || {}; if (typeof STORY_BEATS === 'object') for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true;
      player.level = 80; player.maxHp = 20000; loadMap(map, 300);
    }, map);
    // the art must arrive on its own (nothing here asks for it: no _lxFxReady, no _fxAnimFrames - those request what they read)
    const art = await page.evaluate(async () => {
      const okIm = (im) => !!(im && im.complete && im.naturalWidth > 0);
      const okFr = (im) => !!(im && (im.tagName === 'CANVAS' ? im.width > 0 : okIm(im)));   // a frame may already be baked to a canvas
      const t0 = performance.now(); let s = null;
      while (performance.now() - t0 < 15000) {
        const fr = (typeof FX_ANIM_FRAMES !== 'undefined') ? FX_ANIM_FRAMES.gravitos_singularity_zone : null;   // read, not _fxAnimFrames (that loads it)
        s = { zone: okIm(LX_FX.gravitos_singularity_zone), shield: okIm(LX_FX.safezone_shield), ring: okIm(LX_FX.safezone_ring),
          frames: fr ? fr.filter(okFr).length + '/' + fr.length : 'unread', map: game.currentMap, ms: Math.round(performance.now() - t0) };
        if (s.zone && s.shield && s.ring) break;
        await new Promise((r) => setTimeout(r, 250));
      }
      return s;
    });
    ok(`${who}'s arena (${map}) loads the safe-zone portal, its shield and its ring on entry`, art && art.map === map && art.zone && art.shield && art.ring, art);
    if (map === 'sanctum') {
      const G = await page.evaluate(async () => {
        const sleep = (ms) => new Promise((z) => setTimeout(z, ms));
        const frames = async (n) => { const t0 = game.time; const d = Date.now() + 20000; while (game.time - t0 < n && Date.now() < d) await sleep(4); };
        for (const id of ['story-beat-overlay', 'boss-intro', 'boss-intro-card']) { const e = document.getElementById(id); if (e) { e.classList.remove('on'); e.style.display = 'none'; } }
        try { _lxCineHold(0); } catch (e) {}
        game.paused = false; player._god = true; player.invulnerable = 9e9;
        const m = game.monsters.find((x) => x && x.type === 'aetherion'); if (!m) return { err: 'no aetherion' };
        const hold = () => { m._stagger = 0; m._dirOpenT = 0; m._dirFleeT = 0; m.vx = 0; player.x = m.x + m.w / 2 + 300 - player.w / 2; player.vx = 0; };
        for (let i = 0; i < 900 && !m._ae; i++) { game.paused = false; hold(); await frames(1); }
        if (!m._ae) return { err: 'his AI never ticked' };
        m._aetherionEvolved = true; m._phaseSprite = 'aetherion2'; m.currentHp = m.maxHp * 0.4; m._bigMeleeCd = 1e9;
        for (let i = 0; i < 90; i++) { hold(); m._ae.st = 'idle'; m._ae.t = 0; await frames(1); }
        let gate = null;
        for (let k = 0; k < 3 && !gate; k++) {
          game.hazards.length = 0; m._ae.st = 'gateWind'; m._ae.t = 0; m._ae.gate = false; m._ae.gateUntil = 0;
          for (let i = 0; i < 120 && !gate; i++) { hold(); await frames(1); gate = game.hazards.find((h) => h && h.type === 'gravitos_singularity' && h.safeZones); }
        }
        if (!gate) return { err: 'no Gate' };
        const P = CanvasRenderingContext2D.prototype, di = P.drawImage, ft = P.fillText, seen = { shield: 0, ring: 0, safeWord: 0 };
        P.drawImage = function (im) { if (im === LX_FX.safezone_shield) seen.shield++; else if (im === LX_FX.safezone_ring) seen.ring++; return di.apply(this, arguments); };
        P.fillText = function (t) { if (t === 'SAFE') seen.safeWord++; return ft.apply(this, arguments); };
        try { for (let i = 0; i < 30; i++) { hold(); await frames(1); } } finally { P.drawImage = di; P.fillText = ft; }
        return Object.assign(seen, { zones: gate.safeZones.length });
      });
      ok("Aetherion's Gate: each safe spot draws its shield and its ring, and never the SAFE stand-in", !G.err && G.zones === 3 && G.shield > 0 && G.ring > 0 && G.safeWord === 0, G);
    }
    ok(`no page errors (${map})`, errs.length === 0, errs);
    await page.close();
  }
} finally { await browser.close(); server.kill(); }
let pass = 0;
console.log('\n=== SAFE-ZONE ART LOADS ===');
for (const t of results) { if (t.pass) pass++; console.log(`${t.pass ? 'PASS' : 'FAIL'}  ${t.n}  ${t.pass ? '' : String(JSON.stringify(t.x)).slice(0, 400)}`); }
console.log(`\n${pass}/${results.length} checks passed`);
process.exit(pass === results.length ? 0 : 1);
