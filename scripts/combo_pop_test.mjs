// COMBO METER, POP PUNK (per user: "For the combo multiplier make it more distinct with POP and PUNK design style").
//  1. it is DRAWN: the canvas carries an inline z-index 2 (the 2026-06-10 DOM-snapshot restore) and the meter had none,
//     so it painted under the map - the meter's box looked the same shown or hidden. Now the pixels change.
//  2. the multiplier sticker grades with it: data-tier 0-4 and "×1.00" .. "×5 MAX" at combos 3 / 17 / 42 / 88 / 142
//  3. each tier paints its own sticker colour; the MAX tier turns the COMBO sticker berry
//  4. the pop keeps its keyframe name, so a break (both classes on) still plays comboBreak
//  5. the drain bar is still a transform over a full-width box (hud_churn_test's contract)
//  6. the sticker plates survive the low-graphics mode (html.lx-nobackdrop strips every box-shadow)
//  7. clean and compact (per user: "Looks about messy, the outlines around the numbers can be more, make it more compact
//     and less messy"): the numbers carry a real text stroke (>= 5 px, painted under the fill), one burst behind the
//     count takes the tier colour, no halftone fan or torn tape, and the meter stays within 100 px tall at 1280x720
//   node scripts/combo_pop_test.mjs [page.html] [port]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(import.meta.url)('playwright-core');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const FILE = (args[0] && /\.html$/i.test(args[0])) ? args[0] : (process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html');
const PORT = Number(args.find((a) => /^\d+$/.test(a)) || process.env.PORT || 11629);
const env = { ...process.env }; delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
let bad = 0; const check = (ok, label, d) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && d !== undefined ? '  [' + JSON.stringify(d) + ']' : ''}`); if (!ok) bad++; };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof bumpCombo === 'function' && typeof updateUI === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(4000);
  await page.evaluate(async () => {
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; window._lxAwaitingCreation = false;
    player.cls = 'rogue'; player.level = 60; player._god = true; player._storyBeatsSeen = new Proxy({}, { get: () => true });
    loadMap('forest', 300); await new Promise((r) => setTimeout(r, 2000)); game.paused = false; game.monsters.length = 0;
  });
  const frames = (n) => page.evaluate(async (k) => { for (let i = 0; i < k; i++) await new Promise((r) => requestAnimationFrame(r)); }, n);
  const set = (c) => page.evaluate((cc) => {
    document.documentElement.classList.remove('lx-nobackdrop');
    game.monsters.length = 0; game.combo = cc; game.comboMult = Math.min(5, 1 + Math.floor(cc / 5) * 0.15); game.comboTimer = 1300;
    const el = document.getElementById('combo-meter'); el.style.opacity = 1; el.classList.remove('pop', 'break');
    for (const t of document.querySelectorAll('.toast')) t.remove(); const tc = document.getElementById('toast-container'); if (tc) tc.style.visibility = 'hidden';
  }, c);
  // 1. drawn above the world
  await set(42); await frames(12);
  // wait out the meter's 0.3 s fade-in: a shot mid-transition read ~10% changed pixels and failed 1 run in 3
  for (let i = 0; i < 120 && (await page.evaluate(() => getComputedStyle(document.getElementById('combo-meter')).opacity)) !== '1'; i++) await frames(2);
  const rect = await page.evaluate(() => document.getElementById('combo-meter').getBoundingClientRect().toJSON());
  const clip = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  const hold = () => page.evaluate(() => { window.__freeze = setInterval(() => { game.comboTimer = 1300; }, 30); });
  await hold();
  const shown = await page.screenshot({ clip });
  await page.evaluate(() => { document.getElementById('combo-meter').style.visibility = 'hidden'; });
  await frames(2);
  const hidden = await page.screenshot({ clip });
  await page.evaluate(() => { document.getElementById('combo-meter').style.visibility = ''; clearInterval(window.__freeze); });
  const diff = await page.evaluate(async ([a, b]) => {
    const load = (s) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = 'data:image/png;base64,' + s; });
    const px = (im) => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, im.width, im.height).data; };
    const A = px(await load(a)), B = px(await load(b)); let changed = 0; for (let i = 0; i < A.length; i += 4) if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) > 60) changed++;
    return +(changed / (A.length / 4)).toFixed(3);
  }, [shown.toString('base64'), hidden.toString('base64')]);
  const z = await page.evaluate(() => ({ meter: getComputedStyle(document.getElementById('combo-meter')).zIndex, canvas: getComputedStyle(document.getElementById('game')).zIndex }));
  check(diff > 0.05 && Number(z.meter) > Number(z.canvas), '1. the meter is drawn over the world (its box changes when it is shown; z above the canvas)', { changedShare: diff, z });
  // 2 + 3. tiers
  const tiers = [];
  for (const c of [3, 17, 42, 88, 142]) {
    await set(c); await frames(6);
    tiers.push(await page.evaluate(() => { const el = document.getElementById('combo-meter'), m = document.getElementById('combo-mult'), l = el.querySelector('.combo-label');
      const cnt = document.getElementById('combo-count'), b = getComputedStyle(cnt, '::before');
      return { tier: el.dataset.tier, text: m.textContent, plate: getComputedStyle(m, '::before').backgroundColor, label: getComputedStyle(l, '::before').backgroundColor,
        burst: b.backgroundColor, burstClip: b.clipPath.slice(0, 8), burstW: parseFloat(b.width), tape: getComputedStyle(l, '::before').clipPath.slice(0, 8),
        fan: getComputedStyle(el, '::before').content, stroke: parseFloat(getComputedStyle(cnt).webkitTextStrokeWidth), paint: getComputedStyle(cnt).paintOrder,
        multStroke: parseFloat(getComputedStyle(m).webkitTextStrokeWidth), h: Math.round(el.getBoundingClientRect().height) }; }));
  }
  check(tiers.map((t) => t.tier).join() === '0,1,2,3,4' && tiers.map((t) => t.text).join() === '×1.00,×1.45,×2.20,×3.55,×5 MAX',
    '2. the multiplier sticker grades with it: tiers 0-4, ×1.00 .. ×5 MAX', tiers.map((t) => t.tier + ' ' + t.text));
  check(new Set(tiers.map((t) => t.plate)).size === 5 && tiers[4].label !== tiers[0].label, '3. each tier paints its own sticker; MAX turns the COMBO sticker', tiers.map((t) => t.plate + ' / ' + t.label));
  check(tiers.every((t) => t.burstClip === 'polygon(' && t.tape !== 'polygon(' && t.fan === 'none' && t.stroke >= 5 && /^stroke/.test(t.paint) && t.h <= 100)
    && tiers.slice(0, 4).every((t) => t.multStroke >= 3) && new Set(tiers.map((t) => t.burst)).size === 5,
    '7. clean: a real stroke on the numbers, one tier-coloured burst, no halftone or tape, within 100 px tall',
    tiers.map((t) => [t.tier, t.burst, 'stroke ' + t.stroke, t.paint, 'mult ' + t.multStroke, 'fan ' + t.fan, 'tape ' + t.tape, 'h ' + t.h].join(' ')));
  // 4. break still wins over the pop
  const anim = await page.evaluate(() => { const el = document.getElementById('combo-meter'); el.classList.add('pop', 'break'); const a = getComputedStyle(el).animationName; el.classList.remove('break'); const b = getComputedStyle(el).animationName; el.classList.remove('pop'); return { both: a, pop: b }; });
  check(anim.both === 'comboBreak' && anim.pop === 'comboPop', '4. a break still plays comboBreak over the pop', anim);
  // 5. the drain bar contract
  await set(42); await frames(8);
  const bar = await page.evaluate(() => { const f = document.getElementById('combo-timer-fill'), b = f.parentElement, cs = getComputedStyle(f); return { fw: cs.width, bw: getComputedStyle(b).width, transform: cs.transform, transition: cs.transitionProperty }; });
  check(bar.fw === bar.bw && /^matrix\(0\.\d+, 0, 0, 1, 0, 0\)$/.test(bar.transform) && bar.transition === 'transform', '5. the drain bar is still a transform over a full-width box', bar);
  // 6. low-graphics mode
  const low = await page.evaluate(() => { document.documentElement.classList.add('lx-nobackdrop'); const m = document.getElementById('combo-mult');
    const r = { plate: getComputedStyle(m, '::before').backgroundColor, offset: getComputedStyle(m, '::after').transform, offsetBg: getComputedStyle(m, '::after').backgroundColor };
    document.documentElement.classList.remove('lx-nobackdrop'); return r; });
  check(low.plate !== 'rgba(0, 0, 0, 0)' && low.offset !== 'none' && low.offsetBg !== 'rgba(0, 0, 0, 0)', '6. the sticker plate and its offset survive the low-graphics mode', low);
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close().catch(() => {}); server.kill(); }
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
