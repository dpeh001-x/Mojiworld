// The empty MojiMon card: a pop-comic panel around the game's snail sprite (cropped, ringed in black ink).
//   node scripts/mm_empty_icon_test.mjs
//     MOJI_GAME_FILE=<build.html>   test a private build (serve.js swaps it in for the game URL)
//     MOJI_DATA_REF=origin/main     serve data/ tables from a git ref, for when the working copy's are stale
//     MOJI_SHOT_DIR=<dir>           also save a close-up of the card per viewport, to eyeball it
// Per user: "Use the snail sprite as the mojimon" (after "something much cuter with a black outline"), then
// "make it look more artistic", then "make the snail bigger" + "more POP with more POP colours like pink black and
// yellow": black / yellow slash / pink halftone, the snail on a starburst, a two-line pop title, three ? badges.
// The card points at the LIVE sprite with a hand-set crop window, so the crop is re-measured here
// against the real image: a redraw that no longer fits the window fails instead of clipping.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = String(process.env.MOJI_PORT || 9143);
const DATA_REF = process.env.MOJI_DATA_REF || '';
const SHOTS = process.env.MOJI_SHOT_DIR || '';
let bad = 0, total = 0;
const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const gitShow = (rel) => execFileSync('git', ['show', rel], { cwd: ROOT, maxBuffer: 1 << 26 });
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
let browser;
try { browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] }); }
catch (e) { browser = await chromium.launch({ channel: 'msedge', args: ['--mute-audio'] }); }
const errs = [];
try {
  const boot = async (opts) => {
    const ctx = await browser.newContext({ ...opts, serviceWorkers: 'block' }); const page = await ctx.newPage();
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
    await page.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
      const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
      if (existsSync(path.join(ROOT, rel))) return r.continue();
      try { r.fulfill({ status: 200, contentType: 'font/woff2', body: gitShow('origin/main:' + rel) }); } catch (e) { r.continue(); }
    });
    if (DATA_REF) {
      await page.route((u) => /^[/]data[/][^/]+[.](js|json)$/.test(u.pathname), async (r) => {
        const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
        try { r.fulfill({ status: 200, contentType: rel.endsWith('.json') ? 'application/json' : 'text/javascript', body: gitShow(DATA_REF + ':' + rel) }); } catch (e) { r.continue(); }
      });
    }
    await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
    await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => typeof loadMap === 'function' && typeof renderMojiMonPanel === 'function' && typeof openLevelUpPanel === 'function', null, { timeout: 120000 });
    await page.evaluate(async () => {
      for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
      window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'warrior'; player.level = 95;
      player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true });
      loadMap('town'); await new Promise((s) => setTimeout(s, 2500));
      for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
      for (const id of ['everdawn-welcome-overlay', 'void-intro-overlay']) { const o = document.getElementById(id); if (o) o.remove(); }
      const mm = _mojimonEnsure(); mm.roster = {}; mm.out = null; mm.cdUntil = 0; mm.assigned = null;
      game._uTab = 'mojimon'; openLevelUpPanel(); const b = document.querySelector('[data-utab="mojimon"]'); if (b) b.click();
      await document.fonts.ready;
    });
    await page.waitForTimeout(600);
    return { ctx, page };
  };
  const measure = (page) => page.evaluate(async () => {
    const card = document.querySelector('#u-pane-mojimon .mmr-empty');
    if (!card) return null;
    card.scrollIntoView({ block: 'center' });
    const ico = card.querySelector('.mmr-empty-ico'), el = ico && ico.querySelector('i.mmr-snail');
    const out = {
      title: (card.querySelector('.mmr-et') || {}).textContent,
      icoText: ico ? ico.textContent.trim() : null,
      extras: ico ? ico.querySelectorAll('.lx-emo, img, svg').length : -1,
      snail: !!el,
    };
    if (!el) return out;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect(), c = card.getBoundingClientRect();
    const url = (cs.backgroundImage.match(/url\("?([^")]+)"?\)/) || [])[1] || '';
    out.url = url.replace(location.origin + '/', '');
    out.cssW = parseFloat(cs.width); out.cssH = parseFloat(cs.height);
    out.inside = r.width > 0 && r.left >= c.left - 0.5 && r.right <= c.right + 0.5 && r.top >= c.top - 0.5 && r.bottom <= c.bottom + 0.5;
    const under = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    out.visible = !!under && (under === el || ico.contains(under));
    out.ink = (cs.filter.match(/rgb\(11, 10, 14\)/g) || []).length;
    out.rim = (cs.filter.match(/rgb\(244, 241, 234\)/g) || []).length;   // v2: the white rim is gone (per user: "reduce the amount of white")
    out.anim = getComputedStyle(ico).animationName;
    // The pop-comic panel (per user: "more POP with more POP colours like pink black and yellow").
    const cc = getComputedStyle(card);
    const burst = card.querySelector('.mmr-burst'), br = burst && burst.getBoundingClientRect();
    const slots = [...card.querySelectorAll('.mmr-slots i')], tw = [...card.querySelectorAll('.mmr-trail .tw')];
    out.scene = { burst: !!burst, dots: !!card.querySelector('.mmr-dots'), trail: !!card.querySelector('svg.mmr-trail'),
      sparkles: tw.length, slots: slots.length, slotText: slots.map((s) => s.textContent).join('') };
    out.spill = [...card.children].filter((ch) => { const q = ch.getBoundingClientRect(); return q.width > 0 && (q.left < c.left - 0.5 || q.right > c.right + 0.5 || q.top < c.top - 0.5 || q.bottom > c.bottom + 0.5); }).map((ch) => ch.className.baseVal || ch.className);
    const mx = r.left + r.width / 2, my = r.top + r.height / 2;
    out.onBurst = !!br && mx > br.left && mx < br.right && my > br.top && my < br.bottom;
    out.palette = { pink: /rgb\(184, 20, 95\)/.test(cc.backgroundImage), yellow: /rgb\(243, 245, 66\)/.test(cc.backgroundImage), ink: /rgb\(11, 10, 14\)/.test(cc.backgroundImage) };
    const etEl = card.querySelector('.mmr-et'), et = getComputedStyle(etEl), esEl = card.querySelector('.mmr-es'), es = getComputedStyle(esEl);
    out.popTitle = { fill: et.color, stroke: parseFloat(et.webkitTextStrokeWidth), strokeColor: et.webkitTextStrokeColor,
      copy: /rgb\(184, 20, 95\)/.test(et.textShadow), lines: Math.round(etEl.offsetHeight / parseFloat(et.lineHeight)) };
    out.tape = { bg: es.backgroundColor, lines: Math.round((esEl.clientHeight - parseFloat(es.paddingTop) - parseFloat(es.paddingBottom)) / parseFloat(es.lineHeight)) };
    const etx = card.querySelector('.mmr-etx').getBoundingClientRect(), sl = card.querySelector('.mmr-slots').getBoundingClientRect();
    out.badgesClear = sl.left > etx.right;
    // The raspberry edge must survive the low-effects mode, which strips every box-shadow (html.lx-nobackdrop).
    const root = document.documentElement, hadLow = root.classList.contains('lx-nobackdrop');
    // Wait after each toggle: under reduced motion the game gives elements a 0.01s transition, and a read taken
    // the instant the class flips catches box-shadow mid-transition (transparent 0px) - a false alarm. Not rAFs:
    // headless fires several per sim step, so two of them can land inside those 10ms.
    const settle = () => new Promise((res) => setTimeout(res, 100));
    root.classList.remove('lx-nobackdrop'); await settle();
    const hi = getComputedStyle(card);
    // The slab is read from the stylesheet, not the computed style: on a slow run the game's frame watchdog re-adds
    // lx-nobackdrop while the test waits, and a computed read then sees 'none' through no fault of the card.
    const slabRule = [...document.styleSheets].flatMap((ss) => { try { return [...ss.cssRules]; } catch (e) { return []; } })
      .some((rl) => rl.selectorText && card.matches(rl.selectorText) && /var\(--pkd\)/.test(rl.style.boxShadow || ''));
    out.frame = { edge: hi.outlineStyle === 'solid' && /rgb\(184, 20, 95\)/.test(hi.outlineColor) && parseFloat(hi.outlineWidth) >= 2, slab: slabRule };
    root.classList.add('lx-nobackdrop'); await settle();
    const low = getComputedStyle(card);
    out.frame.lowEdge = low.outlineStyle === 'solid' && parseFloat(low.outlineWidth) >= 2;
    // Not asserted: that the slab vanishes. That is the game's own low-effects policy, and the perf governor flips the
    // class on its own clock, so a computed read here races it (seen failing on an unchanged build).
    if (!hadLow) root.classList.remove('lx-nobackdrop');
    out.moving = { crawl: out.anim, slot: slots[0] ? getComputedStyle(slots[0]).animationName : 'none', trail: tw[0] ? getComputedStyle(tw[0]).animationName : 'none',
      sparkBefore: getComputedStyle(card, '::before').animationName, sparkAfter: getComputedStyle(card, '::after').animationName };
    // Load the very image the card uses, then map the CSS crop back onto its pixels.
    const img = new Image(); img.src = url;
    try { await img.decode(); } catch (e) {}
    out.loaded = img.naturalWidth > 0;
    if (!out.loaded) return out;
    const k = parseFloat(cs.backgroundSize) / img.naturalWidth;
    const [px, py] = cs.backgroundPosition.split(' ').map(parseFloat);
    const win = { x: -px / k, y: -py / k, w: out.cssW / k, h: out.cssH / k };
    const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, cv.width, cv.height).data;
    let t = -1, b = -1, lft = cv.width, rt = -1;
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) if (d[(y * cv.width + x) * 4 + 3] > 64) { if (t < 0) t = y; b = y; if (x < lft) lft = x; if (x > rt) rt = x; }
    out.margins = { left: lft - win.x, top: t - win.y, right: win.x + win.w - (rt + 1), bottom: win.y + win.h - (b + 1) };
    return out;
  });
  const shot = async (page, name) => {
    if (!SHOTS) return;
    const el = await page.$('#u-pane-mojimon .mmr-empty');
    if (el) await el.screenshot({ path: path.join(SHOTS, name + '.png') });
  };

  for (const [name, opts, motion] of [
    ['desktop 1280x800', { viewport: { width: 1280, height: 800 } }, true],
    ['phone held sideways 844x390', { viewport: { width: 844, height: 390 }, hasTouch: true, reducedMotion: 'reduce' }, false],
  ]) {
    const { ctx, page } = await boot(opts);
    const M = await measure(page);
    check(!!M && M.title === 'No MojiMon bound yet', `${name}: the empty card is up`, M && M.title);
    if (M) {
      check(M.snail && M.extras === 0 && M.icoText === '', `${name}: the icon is the snail, no emoji or old buddy left`, M);
      check(M.url === 'Sprites/monsters/snail.webp', `${name}: it is the game's own snail sprite`, M.url);
      check(M.loaded === true, `${name}: that image really loads`, M.loaded);
      check(M.cssW === 104 && M.cssH === 72, `${name}: drawn at 104x72 (half as big again as 70x49)`, { w: M.cssW, h: M.cssH });
      const mg = M.margins || {}, vals = Object.values(mg);
      check(vals.length === 4 && vals.every((v) => v >= 0 && v <= 24), `${name}: the crop holds the whole snail with a thin margin (canvas px)`, mg);
      check(M.inside, `${name}: fully inside the card`, M);
      check(M.visible, `${name}: nothing covers it`, M);
      check(M.ink >= 4 && M.rim === 0, `${name}: a black ink ring, and no white rim`, { ink: M.ink, rim: M.rim });
      const sc = M.scene || {};
      check(sc.burst && sc.dots && sc.trail && sc.sparkles >= 2 && sc.slots === 3 && sc.slotText === '???', `${name}: the panel is all there - starburst, halftone, glitter trail, three ? badges`, sc);
      check(Array.isArray(M.spill) && M.spill.length === 0, `${name}: nothing spills out of the card`, M.spill);
      check(M.onBurst === true, `${name}: the snail sits on its starburst`, M.onBurst);
      const pal = M.palette || {};
      check(pal.pink && pal.yellow && pal.ink, `${name}: the backdrop is raspberry, black and yellow`, pal);
      const pt = M.popTitle || {};
      check(pt.fill === 'rgb(243, 245, 66)' && pt.stroke >= 4 && pt.strokeColor === 'rgb(11, 10, 14)' && pt.copy, `${name}: the title is yellow in a thick black stroke with a raspberry copy`, pt);
      check(pt.lines === 2, `${name}: the title stacks on exactly two lines`, pt.lines);
      check(M.tape && M.tape.bg === 'rgb(243, 245, 66)' && M.tape.lines === 1, `${name}: the subtitle is one line of yellow tape`, M.tape);
      check(M.badgesClear === true, `${name}: the ? badges clear the text`, M.badgesClear);
      const fr = M.frame || {};
      check(fr.edge && fr.slab, `${name}: a raspberry edge and a raspberry offset slab frame it`, fr);
      check(fr.lowEdge, `${name}: in low-effects mode the edge stays`, fr);
      const mv = M.moving || {}, still = Object.values(mv).every((v) => v === 'none');
      check(motion ? (mv.crawl === 'mmr-crawl' && mv.slot === 'mmr-bob' && mv.trail === 'mmc-tw' && mv.sparkBefore === 'mmc-tw') : still,
        `${name}: ${motion ? 'the snail crawls, the slots bob, the sparkles twinkle' : 'nothing moves under reduced motion'}`, mv);
    }
    await shot(page, name.split(' ')[0]);
    await ctx.close();
  }
  check(errs.length === 0, 'no page errors', errs.slice(0, 4));
} finally {
  await browser.close();
  srv.kill();
}
console.log(`\n${total - bad}/${total} passed`);
process.exit(bad ? 1 : 0);
