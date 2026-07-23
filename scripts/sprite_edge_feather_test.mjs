// Edge-feather certification (v0.29.x "soften the harsh square sprite cut").
import { chromium } from 'playwright-core';
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio'] });
try {
  const p = await b.newContext({ serviceWorkers: 'block' }).then(c => c.newPage());
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 140)));
  await p.goto('http://localhost:8080/mojiworld_game.html', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof _lxDrawSoft === 'function' && typeof _lxEdgesTouched === 'function' && typeof spawnMonster === 'function');
  await p.waitForTimeout(5000);

  const r = await p.evaluate(async () => {
    const load = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
    const out = {};
    // 1) probe: clipped frame detected, clean sprite not
    const clipped = await load('Sprites/monsters/idle/bonebosn_0.webp');   // hat clipped at TOP (T10)
    const clean = await load('Sprites/monsters/mushpup.webp');             // padded art
    out.clippedEdges = _lxEdgesTouched(clipped);
    out.cleanEdges = _lxEdgesTouched(clean);
    out.memoised = _lxEdgesTouched(clipped) === out.clippedEdges;
    // 2) draw comparison at 160px: top-row alpha must drop, bottom row unchanged
    const mk = () => { const c = document.createElement('canvas'); c.width = 160; c.height = 160; return c; };
    const A = mk(), B = mk();
    A.getContext('2d').drawImage(clipped, 0, 0, 160, 160);
    _lxDrawSoft(B.getContext('2d'), clipped, 0, 0, 160, 160);
    const rowAlpha = (cv, y) => { const d = cv.getContext('2d').getImageData(0, y, 160, 1).data; let s = 0; for (let i = 3; i < d.length; i += 4) s += d[i]; return s; };
    out.rawTop = rowAlpha(A, 0); out.softTop = rowAlpha(B, 0);
    out.rawBottom = rowAlpha(A, 158); out.softBottom = rowAlpha(B, 158);
    // 3) clean image pass-through: pixel-identical
    const C = mk(), D = mk();
    C.getContext('2d').drawImage(clean, 0, 0, 160, 160);
    _lxDrawSoft(D.getContext('2d'), clean, 0, 0, 160, 160);
    const d1 = C.getContext('2d').getImageData(40, 40, 60, 60).data, d2 = D.getContext('2d').getImageData(40, 40, 60, 60).data;
    let diff = 0; for (let i = 0; i < d1.length; i += 401) if (Math.abs(d1[i] - d2[i]) > 2) diff++;
    out.cleanDiff = diff;
    return out;
  });
  ok('probe flags the clipped frame (bonebosn top edge)', !!(r.clippedEdges && r.clippedEdges.t), r.clippedEdges);
  ok('probe leaves padded art alone (mushpup → null)', r.cleanEdges === null, { cleanEdges: r.cleanEdges });
  ok('probe result is memoised on the image', r.memoised === true, { memoised: r.memoised });
  ok('feather SOFTENS the clipped top edge (row-0 alpha drops >60%)', r.softTop < r.rawTop * 0.4 && r.rawTop > 500, { rawTop: r.rawTop, softTop: r.softTop });
  ok('bottom edge untouched (feet stay planted)', Math.abs(r.softBottom - r.rawBottom) <= r.rawBottom * 0.05 + 40, { rawBottom: r.rawBottom, softBottom: r.softBottom });
  ok('clean sprites draw pixel-identical (pass-through path)', r.cleanDiff === 0, { cleanDiff: r.cleanDiff });

  // 4) in-game smoke: spawn affected mobs and render frames without errors
  const smoke = await p.evaluate(async () => {
    const ov = document.getElementById('loading-overlay'); if (ov) ov.remove();
    for (const el of document.querySelectorAll('.modal-overlay, #story-beat-overlay')) el.style.display = 'none';
    player.cls = player.cls || 'warrior'; game.paused = false; window._prologueActive = false;
    loadMap('forest'); game.monsters.length = 0;
    net._coopSpawning = true;
    for (const t of ['bonebosn', 'bellowsbat', 'brinekraken', 'grumpsquid', 'mushpup']) { const m = spawnMonster(300 + Math.random() * 600, 400, t); if (m) m.currentHp = m.maxHp = 9999; }
    net._coopSpawning = false;
    player.x = 600; player.hp = player.maxHp = 9e9; player.invulnerable = 9e9;
    await new Promise(r => setTimeout(r, 1500));   // let frames decode + rAF render
    return { mobs: game.monsters.length };
  });
  ok('in-game smoke: affected mobs render live', smoke.mobs === 5, smoke);
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} finally { await b.close(); }
let pass = 0, fail = 0;
for (const r of results) { (r.pass ? pass++ : fail++); console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.x !== undefined ? '  ' + JSON.stringify(r.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
