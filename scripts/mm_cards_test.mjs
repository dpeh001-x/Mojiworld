// The MojiMon tab's two top cards drawn as art (v0.30.x mm-cards).
//   node scripts/mm_cards_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// Per user: "These buttons and fonts can be stylised, polished to be more artistic and appealing"; then "the how to bind
// and SUMMON READY tabs section needs more POP feel, especially the top MOJIMON header" - the head and both cards in the
// pop palette, heavy Nunito printed in a thick ink stroke. Then "reduce the amount of white, make the hot pink less in
// occurence, use more darker pink instead, the top MOJIMON can be better designed": raspberry does the work, hot pink is
// an accent, no white tiles or edges, and MOJIMON is a comic logo lockup.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '10540';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
try {
  const errs = [];
  const boot = async (opts) => {
    const ctx = await browser.newContext({ ...opts, serviceWorkers: 'block' }); const page = await ctx.newPage();
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
    // a working copy may lack the bundled fonts: serve them from origin so the fonts are the real ones
    await page.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
      const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
      if (existsSync(path.join(ROOT, rel))) return r.continue();
      try { r.fulfill({ status: 200, contentType: 'font/woff2', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
    });
    await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
    await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => typeof loadMap === 'function' && typeof renderMojiMonPanel === 'function' && typeof openLevelUpPanel === 'function', null, { timeout: 120000 });
    await page.evaluate(async () => {
      for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
      window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'warrior'; player.level = 95;
      player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true });
      loadMap('town'); await new Promise((s) => setTimeout(s, 2500));
      for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
      for (const id of ['everdawn-welcome-overlay', 'void-intro-overlay']) { const o = document.getElementById(id); if (o) o.remove(); }
      const mm = _mojimonEnsure(); mm.roster = {}; mm.out = null; mm.cdUntil = 0;
      game._uTab = 'mojimon'; openLevelUpPanel(); const b = document.querySelector('[data-utab="mojimon"]'); if (b) b.click();
      await document.fonts.ready;
    });
    await page.waitForTimeout(500);
    return { ctx, page };
  };
  const { ctx, page } = await boot({ viewport: { width: 1280, height: 800 } });
  const src = await page.evaluate(() => String(renderMojiMonPanel));
  check(src.includes('15× your max HP') && src.includes('MOJIMON_ATK_MULT * 100'), 'the card still states 15x HP and the real ATK share (what u_panel_text_test pins)', null);
  const ready = await page.evaluate(() => {
    const q = (s) => document.querySelector('#u-pane-mojimon ' + s), cs = (el) => getComputedStyle(el);
    const steps = [...document.querySelectorAll('#u-pane-mojimon .mmc-step')];
    return { steps: steps.length, heads: steps.map((x) => x.querySelector('.mmc-st').textContent), kills: q('.mmc-big').textContent, killsReq: MOJIMON_KILLS_REQ.toLocaleString(),
      chips: [...document.querySelectorAll('#u-pane-mojimon .mmc-chip')].map((x) => x.textContent.trim()), atk: Math.round(MOJIMON_ATK_MULT * 100),
      cls: q('.mmc-cd').className, cd: q('#mojimon-cd').textContent, p: cs(q('.mmc-cd')).getPropertyValue('--p').trim(), ping: getComputedStyle(q('.mmc-ring'), '::after').animationName,
      pts: q('.mmc-star').textContent, buddy: q('.mmc-buddy').getAttribute('src'), sub: q('.mmc-cdtx .mmc-sub').textContent, paws: document.querySelectorAll('#u-pane-mojimon .mmc-link').length, ptsReal: _mojimonPoints(), dismiss: !!q('.mmc-dismiss'),
      fonts: { head: cs(q('.mmc-h')).fontFamily, cd: cs(q('#mojimon-cd')).fontFamily, text: cs(q('.mmc-t')).fontFamily,
        headW: Number(cs(q('.mmc-h')).fontWeight), cdW: Number(cs(q('#mojimon-cd')).fontWeight),
        htStroke: parseFloat(cs(q('.mmc-ht')).webkitTextStrokeWidth), cdStroke: parseFloat(cs(q('#mojimon-cd')).webkitTextStrokeWidth), nun: document.fonts.check("900 14px 'Nunito'") },
      // the pop pass (v2): the head as a comic logo on a raspberry banner, both cards raspberry and black with a raspberry
      // edge - hot pink only as an accent, and no white tiles or edges (per user: "reduce the amount of white")
      head: { title: q('.mmc-title') && q('.mmc-title').textContent, tag: q('.mmc-tag') && q('.mmc-tag').textContent,
        titleFill: q('.mmc-title') && cs(q('.mmc-title')).color, titleStroke: q('.mmc-title') && parseFloat(cs(q('.mmc-title')).webkitTextStrokeWidth),
        extrude: q('.mmc-title') ? (cs(q('.mmc-title')).textShadow.match(/rgb\(11, 10, 14\)/g) || []).length : 0,
        letters: document.querySelectorAll('#u-pane-mojimon .mmc-title b').length,
        plate: !!q('.mmc-plate') && /rgb\(154, 15, 80\)/.test(cs(q('.mmc-plate')).backgroundImage), burst: !!q('.mmc-toplogo img'),
        shellArt: q('.mmc-shell') && /mojimon_bg\.webp/.test(cs(q('.mmc-shell')).backgroundImage) },
      panels: ['.mmc-how', '.mmc-cd'].map((s) => { const c = cs(q(s)); return { pink: /rgba?\((184, 20, 95|255, 45, 149)/.test(c.backgroundImage) || c.backgroundColor === 'rgb(184, 20, 95)',
        ink: /rgb\(11, 10, 14\)/.test(c.backgroundImage) || c.borderTopColor === 'rgb(11, 10, 14)', edge: c.outlineStyle === 'solid' && c.outlineColor === 'rgb(184, 20, 95)' }; }),
      tiles: steps.map((x) => cs(x).backgroundColor),
      // per user: "Add some black components as well rather than all purple and pink only"
      black: { how: cs(q('.mmc-how')).backgroundColor, pts: cs(q('.mmc-pts')).backgroundColor },
      ready2: q('.mmc-cd.ready #mojimon-cd') ? cs(q('#mojimon-cd')).color : null };
  });
  console.log('ready', JSON.stringify(ready));
  check(ready.steps === 3 && ready.heads.join('|') === 'Master|Bind|Team up' && ready.kills === ready.killsReq, 'HOW TO BIND in three steps: MASTER (the real kill count), BIND, TEAM UP', ready.heads);
  check(ready.chips.some((c) => c.includes('15× your max HP')) && ready.chips.some((c) => c.includes(ready.atk + '% of your ATK')), 'TEAM UP carries the HP chip and the ATK chip with the real numbers', ready.chips);
  check(/\bready\b/.test(ready.cls) && ready.cd === 'READY' && Number(ready.p) === 0 && ready.ping === 'mmc-ping', 'ready: the ring is full and pings, the readout says READY', ready);
  check(ready.pts === String(ready.ptsReal) && !ready.dismiss, 'the upgrade points on the star are the real count; no Dismiss with nothing out', ready);
  check(/mojimon_logo/.test(ready.buddy) && /ready when you are/.test(ready.sub) && ready.paws === 2, 'with no MojiMon yet the ring holds the MojiMon logo; paw prints walk between the steps', ready);
  const f = ready.fonts;
  check(/^"?Nunito/.test(f.head) && /^"?Nunito/.test(f.cd) && /^"?Nunito/.test(f.text) && f.headW >= 900 && f.cdW >= 900 && f.htStroke >= 4 && f.cdStroke >= 4 && f.nun,
    'pop type: heavy Nunito for the headings and the readout, printed in a thick ink stroke; Nunito for the words, loaded', f);
  const hd = ready.head;
  check(hd.title === 'MOJIMON' && hd.tag === 'BIND · FIELD · UPGRADE · H QUICK-SUMMON' && hd.burst && hd.shellArt,
    'the head: MOJIMON and its tagline (same words as before), the logo on its starburst, the MojiMon art still behind the shell', hd);
  check(hd.titleFill === 'rgb(243, 245, 66)' && hd.titleStroke >= 5 && hd.extrude >= 4 && hd.letters === 7 && hd.plate,
    'MOJIMON as a comic logo: seven bouncing letters, yellow in a thick ink stroke with an ink extrusion, on a raspberry banner', hd);
  // per user: "reduce the yellow at the main columns, more Dark purple and Hot pink"
  check(JSON.stringify(ready.tiles) === JSON.stringify(['rgb(58, 23, 104)', 'rgb(255, 45, 149)', 'rgb(58, 23, 104)']),
    'the steps are deep purple, hot pink, deep purple - no yellow or white columns', ready.tiles);
  check(ready.black.how === 'rgb(11, 10, 14)' && ready.black.pts === 'rgb(11, 10, 14)',
    'black frames among the purple and pink: the How-to-bind panel and the upgrade-points plate', ready.black);
  check(ready.panels.every((p) => p.pink && p.ink && p.edge), 'both cards pink on deep purple / raspberry with an ink border and a raspberry edge (an outline, so low-effects mode keeps it)', ready.panels);
  check(ready.ready2 === 'rgb(243, 245, 66)', 'READY printed in acid yellow', ready.ready2);
  // on cooldown with a mon out
  const cool = await page.evaluate(async () => {
    const ks = Object.keys(monsterTypes).filter((k) => !monsterTypes[k].boss).slice(0, 2), mm = _mojimonEnsure();
    for (const k of ks) mm.roster[k] = { upg: { hp: 0, atk: 0, def: 0 } };
    mm.out = { type: ks[0], hpFrac: 0.7 }; mm.cdUntil = Date.now() + MOJIMON_CD_MS / 2; renderMojiMonPanel();
    const q = (s) => document.querySelector('#u-pane-mojimon ' + s), pv = () => Number(getComputedStyle(q('.mmc-cd')).getPropertyValue('--p'));
    const a = { cls: q('.mmc-cd').className, cd: q('#mojimon-cd').textContent, p: pv(), color: getComputedStyle(q('#mojimon-cd')).color };
    await new Promise((r) => setTimeout(r, 2300));
    const b = { cd: q('#mojimon-cd').textContent, p: pv() };
    const d = q('.mmc-dismiss'); const name = (monsterTypes[ks[0]] || {}).name || ks[0];
    const sp = _monsterDexSprite(ks[0], monsterTypes[ks[0]]); return { a, b, dismiss: d ? d.textContent : null, name, half: MOJIMON_CD_MS / 2000, buddy: q('.mmc-buddy').getAttribute('src'), want: sp && sp.src, sub: q('.mmc-cdtx .mmc-sub').textContent };
  });
  console.log('cooling', JSON.stringify(cool));
  check(/cooling/.test(cool.a.cls) && /^\d+:\d\d$/.test(cool.a.cd) && Math.abs(cool.a.p - 0.5) < 0.01 && cool.a.color === 'rgb(255, 194, 223)', 'cooling: light-pink readout in m:ss and the ring half drained at half the cooldown', cool.a);
  check(cool.b.cd !== cool.a.cd && cool.b.p < cool.a.p, 'the ticker counts down and drains the ring as it goes', cool);
  check(cool.dismiss && cool.dismiss.includes('Dismiss ' + cool.name), 'a fielded mon gets a Dismiss button with its name', cool.dismiss);
  check(cool.want && cool.buddy === cool.want && /resting/.test(cool.sub), 'the ring holds your H-slot MojiMon, resting while the cooldown runs', cool);
  const back = await page.evaluate(async () => {
    _mojimonEnsure().cdUntil = Date.now() + 900; renderMojiMonPanel();
    await new Promise((r) => setTimeout(r, 2600));
    const q = (s) => document.querySelector('#u-pane-mojimon ' + s);
    const before = !!_mojimonEnsure().out; q('.mmc-dismiss').click();
    return { cls: q('.mmc-cd').className, cd: q('#mojimon-cd').textContent, outBefore: before, outAfter: !!_mojimonEnsure().out, dismissAfter: !!q('.mmc-dismiss') };
  });
  console.log('back', JSON.stringify(back));
  check(/\bready\b/.test(back.cls) && back.cd === 'READY', 'when the clock runs out the card turns READY by itself', back);
  check(back.outBefore && !back.outAfter && !back.dismissAfter, 'Dismiss sends the mon back and the button goes', back);
  const lay = await page.evaluate(() => {
    const r = (s) => document.querySelector('#u-pane-mojimon ' + s).getBoundingClientRect();
    const how = r('.mmc-how'), cd = r('.mmc-cd'), pane = r(''), over = [...document.querySelectorAll('#u-pane-mojimon .mmc-step, #u-pane-mojimon .mmc-chip, #u-pane-mojimon .mmc-cdtop, #u-pane-mojimon .mmc-pts, #u-pane-mojimon')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.className || e.id);
    return { side: Math.abs(how.top - cd.top) < 2 && how.right <= cd.left, inside: how.left >= pane.left - 1 && cd.right <= pane.right + 1, h: Math.round(how.height), over };
  });
  console.log('layout', JSON.stringify(lay));
  check(lay.side && lay.inside && lay.over.length === 0 && lay.h < 360, 'desktop: the two cards side by side inside the pane, nothing spills out of a step or chip', lay);
  await ctx.close();
  const ph = await boot({ viewport: { width: 842, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const pl = await ph.page.evaluate(() => {
    const pane = document.getElementById('u-pane-mojimon').getBoundingClientRect();
    const over = [...document.querySelectorAll('#u-pane-mojimon .mmc-step, #u-pane-mojimon .mmc-chip, #u-pane-mojimon .mmc-cdtop, #u-pane-mojimon .mmc-pts, #u-pane-mojimon')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.className || e.id);
    const cards = [...document.querySelectorAll('#u-pane-mojimon .mmc-card')].map((e) => e.getBoundingClientRect()).every((c) => c.left >= pane.left - 1 && c.right <= pane.right + 1);
    return { cards, over, pane: Math.round(pane.width) };
  });
  console.log('phone', JSON.stringify(pl));
  check(pl.cards && pl.over.length === 0, 'phone on its side: both cards inside the pane, nothing spills', pl);
  await ph.ctx.close();
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
process.exit(bad ? 1 : 0);
