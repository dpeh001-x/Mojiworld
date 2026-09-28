// Live test: the archer's string flash (per user: "push further with the archer string flash"). Rendered by the game's
// own rig, facing right and facing left:
//   * nothing before the release frame (the arrow leaves at HERO_VEC_ARCHER_RELEASE_T)
//   * just after it, a warm flash appears, and it sits AHEAD of the archer (toward the target) whichever way it faces
//   * it is gone well before the swing ends
//   * the other classes draw no flash
//   node scripts/archer_flash_test.mjs [port]   (MOJI_GAME_FILE honored)
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const page = await (await b.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof _drawVectorHero === 'function' && typeof loadMap === 'function', null, { timeout: 120000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return !!m && m.offsetParent !== null; }, null, { timeout: 150000 }).catch(() => {});
  const r = await page.evaluate(async () => {
    const wait = (ms) => new Promise((z) => setTimeout(z, ms));
    try { _lxBootGateDone = true; } catch (e) {} try { _lxBootHold.release('menu'); } catch (e) {}
    const CX = 150;
    const frame = (cls, t, facing) => {
      const cv = document.createElement('canvas'); cv.width = 300; cv.height = 320; const c = cv.getContext('2d');
      c.fillStyle = '#2a1030'; c.fillRect(0, 0, 300, 320);
      c.save(); c.translate(CX, 292); c.scale(2, 2);
      _drawVectorHero(-14, -44, c, { cls, lookCustom: player.lookCustom || {}, animName: 'attack_' + cls, animTime: t, forcedFacing: facing });
      c.restore(); return c.getImageData(0, 0, 300, 320).data;
    };
    // the flash alone: the same frame drawn with the flash and with its draw stubbed out (count + mean x of changed pixels)
    const real = window._hvArcherStringFlash;
    const flashOf = (cls, t, f) => {
      if (typeof real !== 'function') return { n: 0, x: null };
      const a = frame(cls, t, f); window._hvArcherStringFlash = function () {}; const b2 = frame(cls, t, f); window._hvArcherStringFlash = real;
      let n = 0, sx = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b2[i]) + Math.abs(a[i + 1] - b2[i + 1]) + Math.abs(a[i + 2] - b2[i + 2]) > 30) { n++; sx += (i / 4) % 300; }
      return { n, x: n ? Math.round(sx / n) : null };
    };
    const R = HERO_VEC_ARCHER_RELEASE_T, out = {};
    for (const cls of ['archer', 'warrior', 'mage', 'rogue']) {
      try { applyClass(cls); } catch (e) {}
      loadMap('town'); await wait(700); player.vx = 0; player.attacking = false;
      if (cls === 'archer') for (const f of [1, -1]) out['archer' + f] = { before: flashOf(cls, R - 0.01, f).n, after: flashOf(cls, R + 0.04, f), gone: flashOf(cls, R + 0.22, f).n };
      else out[cls] = flashOf(cls, R + 0.04, 1).n;
    }
    return { out, CX };
  });
  const o = r.out;
  for (const f of [1, -1]) {
    const x = o['archer' + f], tag = f > 0 ? 'facing right' : 'facing left';
    ok(`archer ${tag}: no flash before the release`, x.before === 0, x.before);
    ok(`archer ${tag}: a warm flash right after the release`, x.after.n >= 60, x.after);
    ok(`archer ${tag}: the flash sits ahead of the archer, toward the target`, x.after.x != null && (f > 0 ? x.after.x > r.CX + 8 : x.after.x < r.CX - 8), x.after);
    ok(`archer ${tag}: it is gone well before the swing ends`, x.gone === 0, x.gone);
  }
  ok('the other classes draw no string flash', o.warrior === 0 && o.mage === 0 && o.rogue === 0, { warrior: o.warrior, mage: o.mage, rogue: o.rogue });
  ok('no page errors', errs.length === 0, errs);
} finally { await b.close(); srv.kill(); }
let pass = 0;
console.log('\n=== ARCHER STRING FLASH ===');
for (const t of results) { if (t.pass) pass++; console.log(`${t.pass ? 'PASS' : 'FAIL'}  ${t.n}  ${t.pass ? '' : String(JSON.stringify(t.x)).slice(0, 300)}`); }
console.log(`\n${pass}/${results.length} checks passed`);
process.exit(pass === results.length ? 0 : 1);
