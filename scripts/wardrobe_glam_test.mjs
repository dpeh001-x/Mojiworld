// Live test: the Wardrobe, round two (per user: "can be even more POP and glamorous ... the posture adjustor can be
// much much beautified"). Checked on the open wardrobe at 1920x1080 and 1280x720:
//   * the panel wears the quilt - the v0.29.29 Persona-5 rule (background-image !important) no longer paints over it,
//     and the painted plate is still in the stack; the old tech-grid ::before and scanline ::after are gone
//   * the tile being edited carries a star INSIDE its box (the tile clips overflow)
//   * the posture editor is dressed: classes on its controls, a custom slider, the duplicate title hidden
//   * the mannequin is repainted: a velvet stage, a skirt over the hips, the part in hand gold, and a rotation gauge
//     that grows hot pink as the part turns
//   * clicking the canvas still selects the part under the pointer and the slider still turns it (geometry unchanged)
//   * the status line sits above the action bar, never on it; on a short window the whole editor fits without scrolling
//   node scripts/wardrobe_glam_test.mjs [port]   (MOJI_GAME_FILE honored)
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
  for (const [vw, vh] of [[1920, 1080], [1280, 720]]) {
    const page = await (await b.newContext({ viewport: { width: vw, height: vh }, serviceWorkers: 'block' })).newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    await page.goto(`http://localhost:${PORT}/mojiworld_game.html?lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => typeof openCharStudio === 'function' && typeof loadMap === 'function', null, { timeout: 120000 });
    await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return !!m && m.offsetParent !== null; }, null, { timeout: 150000 }).catch(() => {});
    const r = await page.evaluate(async () => {
      const wait = (ms) => new Promise((z) => setTimeout(z, ms));
      try { _lxBootGateDone = true; } catch (e) {} try { _lxBootHold.release('menu'); } catch (e) {}
      ['loading-overlay', 'lo-menu'].forEach((id) => { const e = document.getElementById(id); if (e) e.style.display = 'none'; });
      try { if (!player.cls) applyClass('warrior'); } catch (e) {}
      player.mojicoins = 99999; loadMap('town'); await wait(2000);
      _csGrantWardrobe(); openCharStudio(); await wait(2500);
      const ov = document.getElementById('char-studio-overlay'), panel = ov.querySelector('.char-studio-panel');
      const cs = (el, pseudo) => getComputedStyle(el, pseudo || null);
      const post = [...ov.querySelectorAll('.wardrobe-slot')].find((s) => /posture/i.test(s.textContent));
      // pose the front arm and put it in hand, then open the posture editor
      CHAR_STUDIO.posture = _normalizePosture(CHAR_STUDIO.posture);
      CHAR_STUDIO.posture.armFront.angle = 0; _setDollSelected('armFront');
      if (post) post.click(); await wait(500);
      const act = ov.querySelector('.wardrobe-slot.active'), star = act ? cs(act, '::after') : null;
      const cv = ov.querySelector('canvas.lx-pz-cv') || ov.querySelector('#wardrobe-picker canvas');
      const hot = () => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] < 110 && d[i + 2] > 90 && d[i + 2] < 200) n++; return n; };
      const px = (x, y) => [...cv.getContext('2d').getImageData(Math.round(x), Math.round(y), 1, 1).data];
      const at = (id, L) => { const w = _dollPartWorld(CHAR_STUDIO.posture, id); return [w.worldX - Math.sin(w.worldAng) * L, w.worldY + Math.cos(w.worldAng) * L]; };
      const partH = (id) => POSTURE_PARTS.find((p) => p.id === id).dollSize.h;
      const hot0 = hot(), corner = px(6, 6), arm = px(...at('armFront', partH('armFront') / 2)), skirt = px(...at('body', 22 * DOLL_SCALE).map((v, i) => i === 0 ? v - 12 * DOLL_SCALE : v));
      CHAR_STUDIO.posture.armFront.angle = -40; _renderDoll(cv, CHAR_STUDIO.posture, 'armFront'); const hot40 = hot();
      CHAR_STUDIO.posture.armFront.angle = 0; _renderDoll(cv, CHAR_STUDIO.posture, 'armFront');
      const head = at('head', -partH('head') / 2), cr = cv.getBoundingClientRect();
      const q = (sel) => { const e = ov.querySelector(sel); return e ? e.getBoundingClientRect() : null; };
      const wrap = q('.wardrobe-picker-wrap'), sl = q('.lx-pz-slider') || q('#wardrobe-picker input[type=range]'), st = q('#char-studio-status'), acts = q('.wardrobe-actions');
      const bef = cs(panel, '::before'), aft = cs(panel, '::after'), title = ov.querySelector('.lx-pz-title'), slEl = ov.querySelector('.lx-pz-slider');
      return {
        block: !!document.getElementById('lx-wardrobe-glam'), bg: cs(panel).backgroundImage,
        before: [bef.zIndex, bef.mixBlendMode, bef.maskImage || bef.webkitMaskImage], afterContent: aft.content,
        star: star ? [star.content, star.backgroundImage.slice(0, 30), star.bottom, star.right, star.top] : null,
        classes: ['lx-pz-hint', 'lx-pz-reset', 'lx-pz-cv', 'lx-pz-chip', 'lx-pz-partreset', 'lx-pz-lbl', 'lx-pz-slider', 'lx-pz-read'].filter((c) => !ov.querySelector('.' + c)),
        titleShown: title ? cs(title).display !== 'none' : null, sliderLook: slEl ? cs(slEl).appearance : null,
        hot0, hot40, corner, arm, skirt,
        headClient: [cr.left + head[0] * cr.width / cv.width, cr.top + head[1] * cr.height / cv.height],
        statusOnBar: st && acts ? (st.bottom > acts.top + 1 && st.top < acts.bottom - 1) : null, st: st && [Math.round(st.top), Math.round(st.bottom)], acts: acts && [Math.round(acts.top), Math.round(acts.bottom)],
        sliderInView: sl && wrap ? sl.bottom <= wrap.bottom + 1 && sl.top >= wrap.top - 1 : null, sl: sl && [Math.round(sl.top), Math.round(sl.bottom)], wrap: wrap && [Math.round(wrap.top), Math.round(wrap.bottom)],
      };
    });
    // a real click on the head selects it (the hit test and the geometry are unchanged)
    await page.mouse.click(r.headClient[0], r.headClient[1]); await page.waitForTimeout(250);
    const sel = await page.evaluate(async () => {
      const wait = (ms) => new Promise((z) => setTimeout(z, ms));
      const ov = document.getElementById('char-studio-overlay'), chip = ov.querySelector('.lx-pz-chip') || ov.querySelector('#wardrobe-picker b');
      const slider = ov.querySelector('#wardrobe-picker input[type=range]'); slider.value = '20'; slider.dispatchEvent(new Event('input')); await wait(50);
      const rd = ov.querySelector('.lx-pz-read') || slider.nextElementSibling;
      return { sel: _getDollSelected(), chip: chip ? chip.textContent : '', angle: CHAR_STUDIO.posture.head && CHAR_STUDIO.posture.head.angle, read: rd ? rd.textContent : '' };
    });
    const tag = `${vw}x${vh}`;
    ok(`${tag}: the glam block is loaded and the quilt wins over the Persona-5 !important rule, plate kept`, r.block && /45deg/.test(r.bg) && /panel_p5_q/.test(r.bg), r.bg.slice(0, 200));
    ok(`${tag}: the old tech grid (::before) and scanline (::after) are gone - corner halftone bursts instead`, r.before[0] === '-1' && r.before[1] === 'normal' && /gradient/.test(r.before[2] || '') && r.afterContent === 'none', { before: r.before, after: r.afterContent });
    ok(`${tag}: the tile in hand wears a star inside its box (the tile clips overflow)`, r.star && r.star[0] !== 'none' && /svg/.test(r.star[1]) && parseFloat(r.star[2]) >= 0 && parseFloat(r.star[3]) >= 0, r.star);
    ok(`${tag}: the posture controls are dressed (classes, custom slider, no duplicate title)`, r.classes.length === 0 && r.sliderLook === 'none' && r.titleShown === false, { missing: r.classes, slider: r.sliderLook, title: r.titleShown });
    ok(`${tag}: the mannequin stands on a velvet stage (was navy)`, r.corner[0] >= 45 && r.corner[2] >= 45 && r.corner[1] <= 40 && r.corner[3] === 255, r.corner);
    ok(`${tag}: the part in hand is gold, the body wears a pink skirt over the hips`, r.arm[0] > 200 && r.arm[1] > 140 && r.arm[0] - r.arm[2] > 60 && r.skirt[0] > 170 && r.skirt[1] < 130 && r.skirt[2] > 70, { arm: r.arm, skirt: r.skirt });
    ok(`${tag}: the rotation gauge grows hot pink as the part turns`, r.hot40 - r.hot0 > 800, { at0: r.hot0, at40: r.hot40 });
    ok(`${tag}: a click on the canvas still selects the part under it, and the slider still turns it`, sel.sel === 'head' && /head/i.test(sel.chip) && sel.angle === 20 && /20/.test(sel.read), sel);
    ok(`${tag}: the status line sits clear of the action bar`, r.statusOnBar === false, { status: r.st, actions: r.acts });
    ok(`${tag}: the whole posture editor fits its column (the slider is in view without scrolling)`, r.sliderInView === true, { slider: r.sl, wrap: r.wrap });
    ok(`${tag}: no page errors`, errs.length === 0, errs);
    await page.close();
  }
} finally { await b.close(); srv.kill(); }
let pass = 0;
console.log('\n=== WARDROBE GLAM ===');
for (const t of results) { if (t.pass) pass++; console.log(`${t.pass ? 'PASS' : 'FAIL'}  ${t.n}  ${t.pass ? '' : String(JSON.stringify(t.x)).slice(0, 300)}`); }
console.log(`\n${pass}/${results.length} checks passed`);
process.exit(pass === results.length ? 0 : 1);
