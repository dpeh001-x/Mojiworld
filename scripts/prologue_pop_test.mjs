// The prologue in pop punk: stanzas, the memory HUD and Guguma's coach line.
//   node scripts/prologue_pop_test.mjs
//     MOJI_GAME_FILE=<build.html>   test a private build (serve.js swaps it in for the game URL)
//     MOJI_DATA_REF=origin/main     serve data/ tables from a git ref, for when the working copy's are stale
// Per user: "the story stanza text can be way more POP and Punk style to fit the game", "change the font to match the
// pop punk style accordingly", and of the memory banner + Guguma's line: "can be way more pop punk designed".
// Pass 2 (per user): the title card "can be improved, use Dark purple also" - a black kicker tag over the headline banner on a
// dark purple comic burst with plum rays; the memory panel "more POP and PUNK features" - taped corners, a ransom-note title,
// a starburst clock, a labelled will meter, built once and updated in place; Guguma's chirp and shouted word.
// Pass 3 (per user, of the panel and balloon): "more Blue and purple, reduce on the pink" - hot pink is left on the Cheep! only.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = String(process.env.MOJI_PORT || 9173);
const DATA_REF = process.env.MOJI_DATA_REF || '';
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
  for (const [name, vp] of [['desktop 1280x800', { width: 1280, height: 800 }], ['phone held sideways 844x390', { width: 844, height: 390 }]]) {
    const ctx = await browser.newContext({ viewport: vp, serviceWorkers: 'block' }); const page = await ctx.newPage();
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
    if (DATA_REF) {
      await page.route((u) => /^[/]data[/][^/]+[.](js|json)$/.test(u.pathname), async (r) => {
        const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
        try { r.fulfill({ status: 200, contentType: 'text/javascript', body: gitShow(DATA_REF + ':' + rel) }); } catch (e) { r.continue(); }
      });
    }
    await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
    await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => typeof loadMap === 'function' && typeof _prologueOverlay === 'function' && typeof _prologueHud === 'function', null, { timeout: 120000 });
    const S = await page.evaluate(async () => {
      for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
      window._lxBootGateDone = true; loadMap('town'); await new Promise((s) => setTimeout(s, 2000));
      await document.fonts.ready;
      window._prologueActive = true;
      _prologueOverlay(['IN A DIFFERENT REALM ' + String.fromCharCode(8212) + ' AT THE FAR END OF THE DREAM', 'Second stanza.\n\nWith a break.'], () => {}, { noPovVideo: true });
      await new Promise((s) => setTimeout(s, 1100));
      const t = document.getElementById('plg-text'), cs = getComputedStyle(t), b0 = getComputedStyle(t, '::before');
      const out = { font: cs.fontFamily, weight: Number(cs.fontWeight), stroke: parseFloat(cs.webkitTextStrokeWidth), ws: cs.whiteSpace, upper: cs.textTransform,
        title: (() => { const k = t.querySelector('.plg-kick'), hd = t.querySelector('.plg-head'), ra = getComputedStyle(t, '::after');
          const hb = hd && getComputedStyle(hd, '::before'), ha = hd && getComputedStyle(hd, '::after');
          return { cls: t.classList.contains('plg-title'), kick: k && k.textContent, head: hd && hd.textContent, kickBg: k && getComputedStyle(k).backgroundColor,
            burst: /svg/.test(b0.backgroundImage) && /(%23|#)3a1768/i.test(b0.backgroundImage), rays: /conic-gradient/.test(ra.backgroundImage) && /106, 47, 176/.test(ra.backgroundImage),
            banner: !!hb && /linear-gradient/.test(hb.backgroundImage) && /matrix/.test(hb.transform), slab: !!ha && ha.backgroundColor === 'rgb(11, 10, 14)' && /matrix/.test(ha.transform),
            headColor: hd && getComputedStyle(hd).color, barZ: getComputedStyle(document.querySelector('#prologue-cine .plg-top')).zIndex }; })(),
        skip: (() => { const b = document.getElementById('plg-skip'); return b ? { cls: b.className, txt: b.textContent, font: getComputedStyle(b).fontFamily } : null; })(),
        hintKeys: document.querySelectorAll('#prologue-cine .plg-hint kbd').length };
      document.getElementById('prologue-cine').click();
      await new Promise((s) => setTimeout(s, 1100));
      out.banner1 = getComputedStyle(document.getElementById('plg-text'), '::before').content !== 'none';
      out.title1 = document.getElementById('plg-text').classList.contains('plg-title');
      out.lines1 = Math.round(document.getElementById('plg-text').offsetHeight / parseFloat(getComputedStyle(document.getElementById('plg-text')).lineHeight));
      document.getElementById('prologue-cine').remove();
      _prologueOverlay(['The memory frays.\n\nThe Void reclaims.', 'x'], () => {}, { noPovVideo: true });   // the post-Void strip's first stanza
      await new Promise((s) => setTimeout(s, 300));
      { const st = document.getElementById('plg-text'); out.strip = { title: st.classList.contains('plg-title'), kids: st.children.length, before: getComputedStyle(st, '::before').content, txt: st.textContent.slice(0, 17) }; }
      document.getElementById('prologue-cine').remove();
      window._prologueLeftMs = 26000; window._prologueLastTick = Date.now(); window._prologueGodUntil = Date.now() + 41000;
      _prologueHud(true); _prologueTick(); _prologueCoach(_LX_PROLOGUE_COACH[0][1]);
      await new Promise((s) => setTimeout(s, 400));
      const hud = document.getElementById('prologue-hud'), coach = document.getElementById('prologue-coach'), q = (s) => hud.querySelector(s);
      const hr = hud.getBoundingClientRect(), cr = coach.getBoundingClientRect();
      out.hud = { cls: hud.className, font: getComputedStyle(hud).fontFamily, title: q('.plg-hud-title') && q('.plg-hud-title').textContent,
        clock: q('.plg-hud-clock') && q('.plg-hud-clock').textContent, god: !!q('.plg-hud-god') && !q('.plg-hud-god').hidden, will: q('.plg-hud-bar i') && getComputedStyle(q('.plg-hud-bar i')).width,
        barW: q('.plg-hud-bar') && q('.plg-hud-bar').clientWidth, name: q('.plg-hud-name') && q('.plg-hud-name').textContent, keys: hud.querySelectorAll('.plg-hud-keys kbd').length,
        titleStroke: q('.plg-hud-title') && parseFloat(getComputedStyle(q('.plg-hud-title')).webkitTextStrokeWidth),
        chips: hud.querySelectorAll('.plg-rn').length, tapes: hud.querySelectorAll('.plg-tape').length, wl: q('.plg-hud-wl') && q('.plg-hud-wl').textContent,
        star: !!q('.plg-hud-clock') && /polygon/.test(getComputedStyle(q('.plg-hud-clock')).clipPath), panelBg: getComputedStyle(hud).backgroundColor,
        godTxt: q('.plg-hud-god') && !q('.plg-hud-god').hidden ? q('.plg-hud-god').textContent : '' };
      out.hud.blue = { bar: getComputedStyle(q('.plg-hud-bar')).outlineColor, clock: getComputedStyle(q('.plg-hud-clock'), '::before').backgroundColor,
        name: getComputedStyle(q('.plg-hud-name')).backgroundColor, tag: coach.querySelector('.plg-coach-name') && getComputedStyle(coach.querySelector('.plg-coach-name')).backgroundColor,
        pink: [hud, ...hud.querySelectorAll('*'), coach, ...coach.querySelectorAll('*')].filter((e) => { const c = getComputedStyle(e); return [c.color, c.backgroundColor, c.borderTopColor, c.outlineColor].includes('rgb(255, 45, 149)'); })
          .map((e) => e.className || e.tagName).join(',') };
      { const sp = q('.plg-hud-clock span'); window._prologueLeftMs = 25400; window._prologueLastTick = Date.now(); _prologueTick(); out.hud.sameNode = !!sp && sp === q('.plg-hud-clock span'); out.hud.clock2 = sp && sp.textContent; }
      out.coach = { cls: coach.className, txt: coach.textContent, name: !!coach.querySelector('.plg-coach-name'), font: getComputedStyle(coach).fontFamily,
        kbd: coach.querySelector('kbd') ? getComputedStyle(coach.querySelector('kbd')).backgroundColor : null,
        sfx: coach.querySelector('.plg-coach-sfx') && coach.querySelector('.plg-coach-sfx').textContent, shout: [...coach.querySelectorAll('.plg-shout')].map((e) => e.textContent).join(','),
        kbdClean: [...coach.querySelectorAll('kbd')].every((k) => !k.querySelector('em,b')) };
      out.gap = Math.round(cr.top - hr.bottom);
      out.inView = hr.top >= 0 && cr.bottom <= innerHeight && hr.left >= 0 && hr.right <= innerWidth;
      _prologueHud(false); window._prologueActive = false;
      return out;
    });
    check(/^"?Nunito/.test(S.font) && S.weight >= 900 && S.stroke >= 4 && S.upper === 'uppercase', `${name}: stanzas in heavy Nunito caps with a thick ink stroke (was monospace)`, S);
    check(S.ws === 'pre-line' && S.lines1 >= 3, `${name}: a stanza keeps its paragraph break`, { ws: S.ws, lines: S.lines1 });
    const T = S.title;
    check(T.cls && T.kick === 'IN A DIFFERENT REALM' && T.head === 'AT THE FAR END OF THE DREAM' && T.kickBg === 'rgb(11, 10, 14)' && T.banner && T.slab && T.headColor === 'rgb(255, 224, 122)',
      `${name}: the title card - a black kicker tag over the yellow headline on its banner and ink slab`, T);
    check(T.burst && T.rays, `${name}: dark purple - the headline stands on a dark purple comic burst with plum rays`, { burst: T.burst, rays: T.rays });
    check(T.barZ === '1', `${name}: the letterbox bars sit above the rays`, { barZ: T.barZ });
    check(!S.title1 && !S.banner1 && S.strip && !S.strip.title && S.strip.kids === 0 && S.strip.before === 'none', `${name}: other stanzas are inked text off the banner - the post-Void strip's first stanza too`, { t1: S.title1, b1: S.banner1, strip: S.strip });
    check(S.skip && /plg-skip-pop/.test(S.skip.cls) && /Skip prologue/.test(S.skip.txt) && /^"?Nunito/.test(S.skip.font) && S.hintKeys === 2, `${name}: a pop Skip button and keycap hints`, { skip: S.skip, keys: S.hintKeys });
    const h = S.hud;
    check(/plg-hud/.test(h.cls) && /^"?Nunito/.test(h.font) && h.title === 'MEMORY OF WHAT YOU BECOME' && h.clock === '0:26' && h.god && /INVULNERABLE/.test(h.godTxt) && h.titleStroke >= 3 && h.chips === 3,
      `${name}: the memory panel - a ransom-note title, the clock, the invulnerable tape`, h);
    check(h.tapes === 2 && h.star && h.wl === 'WILL' && h.panelBg === 'rgb(26, 11, 46)', `${name}: punk panel pieces - dark purple, taped corners, a starburst clock, a labelled will meter`, h);
    check(h.blue.bar === 'rgb(47, 107, 255)' && h.blue.clock === 'rgb(154, 107, 255)' && h.blue.name === 'rgb(106, 47, 176)' && h.blue.tag === 'rgb(106, 47, 176)' && h.blue.pink === 'plg-coach-sfx',
      `${name}: blue and purple lead the panel and balloon - hot pink is down to Guguma's Cheep!`, h.blue);
    check(h.sameNode && /^0:2\d$/.test(h.clock2 || ''), `${name}: the panel is built once and updated in place (its pulses no longer restart every tick)`, { same: h.sameNode, clock2: h.clock2 });
    check(h.name === 'GRAVITOS, THE WEIGHT-BEARER' && h.keys === 9 && parseFloat(h.will) > 0 && parseFloat(h.will) < h.barW, `${name}: the will bar, the name tape and the nine keycaps`, h);
    const c = S.coach;
    check(/plg-coach/.test(c.cls) && c.name && /Guguma:/.test(c.txt) && /mash/i.test(c.txt) && /^"?Nunito/.test(c.font) && c.kbd === 'rgb(255, 224, 122)' && c.sfx === 'Cheep!' && c.shout === 'STAND' && c.kbdClean,
      `${name}: Guguma speaks from a comic balloon - a name tag, a Cheep! sound effect, STAND under a marker, yellow keycaps`, c);
    check(S.gap >= 20 && S.inView, `${name}: the balloon and its tail sit below the panel, both on screen`, { gap: S.gap, inView: S.inView });
    await ctx.close();
  }
  check(errs.length === 0, 'no page errors', errs.slice(0, 4));
} finally {
  await browser.close();
  srv.kill();
}
console.log(`\n${total - bad}/${total} passed`);
process.exit(bad ? 1 : 0);
