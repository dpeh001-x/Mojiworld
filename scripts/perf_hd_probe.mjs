// HD check: does any art reach the game canvas UPSCALED - drawn over more device
// pixels than it has? An upscale is the only thing that softens a sprite (a
// downscale with high-quality smoothing stays crisp), so this is the objective
// test behind "keep images as HD as possible". It wraps the game canvas's
// drawImage, reads each blit's device scale from the live transform (render
// scale included), and groups offenders by the art or cache they came from,
// while each class fights a dense pack and casts every skill it has.
//   node scripts/perf_hd_probe.mjs [build.html]
//   env: PERF_ROOT  tree to serve (default: this repo)   DPR  emulated devicePixelRatio (default 1)
//        CLASSES    default warrior,mage,rogue,archer    SECS seconds of fighting per class (default 8)
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn as _spawn } from 'node:child_process';

const ROOT = process.env.PERF_ROOT ? path.resolve(process.env.PERF_ROOT) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PERF_PORT || '9499';
const srv = _spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const URL = 'http://localhost:' + PORT + '/' + (process.argv[2] || 'mojiworld_game.html');
const DPR = Number(process.env.DPR || 1), SECS = Number(process.env.SECS || 8);
const CLASSES = (process.env.CLASSES || 'warrior,mage,rogue,archer').split(',');
const browser = await chromium.launch({ channel: 'chrome', args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
const all = new Map();
let scaleLog = [];
for (const cls of CLASSES) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: DPR });
  // DRS=off pins the render scale at its target (the governor's own debug switch, read at boot), so the
  // report shows what is soft at full resolution rather than what a slow headless raster traded away.
  if (process.env.DRS === 'off') await page.addInitScript(() => { try { localStorage.setItem('lx_drs', 'off'); localStorage.removeItem('lx_render_scale'); } catch (e) {} });
  await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof castSkill === 'function', null, { timeout: 90000 });
  const res = await page.evaluate(async ({ cls, SECS }) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
    window._lxBootGateDone = true;
    const card = [...document.querySelectorAll('#class-select-modal .cls-card')].find((c) => new RegExp(cls, 'i').test(c.textContent || ''));
    if (card && !player.cls) { try { card.click(); } catch (e) {} }
    const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
    player.level = 60; player.cls = cls; player.invulnerable = 9e9; player.hp = player.maxHp = 99999; player.mp = player.maxMp = 99999;
    try { loadMap('blockland_apex'); } catch (e) { try { loadMap('boneGraveyard'); } catch (e2) {} }
    game.paused = false;
    await sleep(5000);
    // The probe: device scale of every blit onto the game canvas.
    const up = new Map(); let n = 0, nUp = 0, minDpr = _LX_DPR;
    const P = CanvasRenderingContext2D.prototype, orig = P.drawImage;
    P.drawImage = function (im, ...a) {
      try {
        if (this === ctx && im) {
          n++;
          const iw = im.naturalWidth || im.videoWidth || im.width || 0, ih = im.naturalHeight || im.videoHeight || im.height || 0;
          let sw = iw, sh = ih, dw = iw, dh = ih;
          if (a.length >= 8) { sw = a[2]; sh = a[3]; dw = a[6]; dh = a[7]; } else if (a.length >= 4) { dw = a[2]; dh = a[3]; }
          const m = this.getTransform(), kx = Math.hypot(m.a, m.b), ky = Math.hypot(m.c, m.d);
          const devW = Math.abs(dw) * kx, devH = Math.abs(dh) * ky;
          const f = Math.max(devW / Math.max(1, Math.abs(sw)), devH / Math.max(1, Math.abs(sh)));
          if (f > 1.08 && Math.abs(sw) >= 24 && Math.abs(sh) >= 24 && devW >= 32) {
            nUp++;
            let key = (im._lxSrc && im._lxSrc.src) || im.src || '';
            if (key) key = String(key).replace(/^.*?\/(Sprites|backgrounds|assets|steam)\//, '$1/').replace(/\?.*$/, '');
            else { const fr = (new Error().stack || '').split('\n').slice(2, 5).map((s) => (s.match(/at ([^ (]+)/) || [])[1]).filter((x) => x && x !== 'Object.drawImage' && !/drawImage$/.test(x)); key = 'canvas via ' + (fr[0] || '?'); }
            const r = up.get(key) || { n: 0, max: 0 };
            r.n++; if (f > r.max) { r.max = +f.toFixed(2); r.dev = Math.round(devW) + 'x' + Math.round(devH); r.src = Math.round(sw) + 'x' + Math.round(sh); }
            up.set(key, r);
          }
        }
      } catch (e) {}
      return orig.apply(this, [im, ...a]);
    };
    // A dense pack right in front of the player, and every skill of the class cast in turn.
    const types = Object.keys(monsterTypes).filter((t) => !(monsterTypes[t] && monsterTypes[t].boss)).slice(0, 10);
    for (let i = 0; i < 24; i++) try { spawnMonster(player.x + 180 + (i % 8) * 55, player.y - 40, types[i % types.length]); } catch (e) {}
    const ids = Object.keys(SKILLS).filter((id) => SKILLS[id].cls === cls);
    const key = (t, k) => window.dispatchEvent(new KeyboardEvent(t, { key: k, bubbles: true }));
    const t0 = performance.now(); let i = 0, lastCast = 0;
    while (performance.now() - t0 < SECS * 1000) {
      game.paused = false; player.hp = player.maxHp; player.mp = player.maxMp;
      if (performance.now() - lastCast > 450) { lastCast = performance.now(); player.skillCooldowns = {}; try { castSkill(ids[i++ % ids.length]); } catch (e) {} }
      if ((i & 3) === 0) { key('keydown', 'z'); setTimeout(() => key('keyup', 'z'), 50); }
      minDpr = Math.min(minDpr, _LX_DPR);
      await new Promise((r) => requestAnimationFrame(r));
    }
    P.drawImage = orig;
    return { n, nUp, dpr: _LX_DPR, minDpr, target: _lxTargetDpr(), bake: _lxBakeDpr(), drs: !!(LX_DRS && LX_DRS.active), skills: ids.length, up: [...up.entries()] };
  }, { cls, SECS });
  scaleLog.push(`${cls}: ${res.skills} skills cast in turn, ${res.n} blits, ${res.nUp} upscaled; render scale ${res.dpr} (min ${res.minDpr}, target ${res.target.toFixed(2)}, bake ${res.bake})${res.drs ? ', DRS ACTIVE' : ''}`);
  for (const [k, r] of res.up) { const a = all.get(k) || { n: 0, max: 0, cls: new Set() }; a.n += r.n; if (r.max > a.max) Object.assign(a, { max: r.max, dev: r.dev, src: r.src }); a.cls.add(cls); all.set(k, a); }
  await page.close();
}
await browser.close(); try { srv.kill(); } catch (e) {}
console.log(`HD probe - emulated devicePixelRatio ${DPR}, viewport 1280x800`);
for (const l of scaleLog) console.log('  ' + l);
const rows = [...all.entries()].sort((a, b) => b[1].max - a[1].max);
const group = (pred, title) => {
  const r = rows.filter(pred);
  console.log(`\n${title}: ${r.length}`);
  for (const [k, v] of r.slice(0, 40)) console.log(`  x${String(v.max).padEnd(5)} ${String(v.n).padStart(6)} blits  src ${String(v.src).padEnd(10)} -> dev ${String(v.dev).padEnd(10)} ${k}  [${[...v.cls].join(',')}]`);
};
group(([k]) => !k.startsWith('backgrounds/'), 'UPSCALED sprites / effects / caches (soft on screen)');
group(([k]) => k.startsWith('backgrounds/'), 'UPSCALED backgrounds (limited by the art file itself)');
