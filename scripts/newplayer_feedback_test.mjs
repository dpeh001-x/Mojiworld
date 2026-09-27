// New-player feedback (v0.30.x newplayer-feedback).
//   node scripts/newplayer_feedback_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// Pre-launch new-player audit: names were mangled silently ("<b>x</b>" -> "bxb"), "Enter Mojiworld" went grey for 2-5 s
// with no word, the first Esc after the tour's last step closed nothing, and the story cue / loading tip read dark on
// dark. The death check is a regression guard: sampled every frame, a death was already explained (card + toast).
// Part 1 boots for real to the title and through New Game; part 2 uses the usual in-game boot.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11377';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const errs = [];
const lum = (rgb) => { const m = String(rgb).match(/[\d.]+/g).map(Number); const c = m.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return { L: 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], a: m.length > 3 ? m[3] : 1 }; };
async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: 'font/woff2', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
  });
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof _playStoryBeat === 'function', null, { timeout: 150000 });
  return { ctx, p };
}

try {
  // ---- part 1: the real title, New Game, creation ----
  {
    const { ctx, p } = await newPage();
    const tip = await p.evaluate(() => { const el = document.getElementById('lo-tip'), cs = getComputedStyle(el); return { color: cs.color, op: +cs.opacity, bg: cs.backgroundColor, txt: el.textContent.slice(0, 40) }; });
    const tl = lum(tip.color), bgA = lum(tip.bg).a;
    check(tip.op >= 0.95 && tl.L >= 0.6 && tl.a >= 0.9 && bgA >= 0.5, 'the loading-screen tip is light text on a dark plate (was faint lilac at 0.75 over the key art)', { ...tip, L: +tl.L.toFixed(2) });
    await p.waitForFunction(() => { const o = document.getElementById('loading-overlay'), m = document.getElementById('lo-menu');
      return o && o.classList.contains('menu-up') && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 240000, polling: 250 });
    await p.waitForTimeout(1200);
    await p.click('#menu-newgame'); await p.waitForTimeout(300);
    await p.click('#auth-user'); await p.keyboard.type('<b>x</b>'); await p.waitForTimeout(150);
    const h1 = await p.evaluate(() => { const h = document.getElementById('auth-user-hint'); return h ? { txt: h.textContent, vis: getComputedStyle(h).display !== 'none' && h.getBoundingClientRect().height > 0 } : null; });
    check(!!h1 && h1.vis && /saved as .x./i.test(h1.txt) && /letters, numbers/i.test(h1.txt), 'the title name field shows a live hint: allowed characters + "saved as x" for <b>x</b>', h1);
    await p.click('#auth-submit');
    const busy = await p.evaluate(() => document.getElementById('auth-submit').textContent);
    const sess = await p.evaluate(() => { try { return LXAuth.session().name; } catch (e) { return null; } });
    check(/creating hero/i.test(busy), '"Enter Mojiworld" says "Creating hero..." while creation loads (was a silent grey button)', busy);
    check(sess === 'x', 'a title name <b>x</b> becomes "x" (was "bxb")', sess);
    // creation opens once the commence gate (every watched sprite) lets the overlay go; on a loaded machine that can crawl,
    // so after 90 s the overlay is lifted by hand - creation itself was already opened behind it at boot for a new player
    try { await p.waitForFunction(() => { const o = document.getElementById('loading-overlay'); return !o || o.classList.contains('fade') || getComputedStyle(o).display === 'none'; }, null, { timeout: 90000, polling: 250 }); }   // the overlay is removed once it has faded
    catch (e) { await p.evaluate(() => { const o = document.getElementById('loading-overlay'); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }); }
    await p.waitForFunction(() => { const c = document.getElementById('class-select-modal'); return c && getComputedStyle(c).display !== 'none'; }, null, { timeout: 60000, polling: 250 });
    await p.waitForTimeout(1500);
    await p.click('#hero-name-input', { force: true }); await p.keyboard.press('Control+A'); await p.keyboard.type('<u>Zö\u{1F600}</u>'); await p.waitForTimeout(200);
    const cn = await p.evaluate(async () => { const h = document.getElementById('hero-name-hint'), nx = () => Math.round(document.getElementById('cs-nav-next').getBoundingClientRect().bottom);
      const out = { name: player.look && player.look.name, hint: h ? h.textContent : null, shown: !!h && h.getBoundingClientRect().height > 0, nextWith: nx(), vh: innerHeight };
      if (h) { h.style.display = 'none'; await new Promise((s) => setTimeout(s, 60)); out.nextWithout = nx(); h.style.display = ''; }
      return out; });
    check(cn.name === 'Zö' && /saved as .Zö./i.test(cn.hint || '') && cn.shown && cn.nextWith === cn.nextWithout && cn.nextWith <= cn.vh,
      'the creation name <u>Zo(emoji)</u> becomes "Zo" with a floating hint that moves nothing (was "uZou" silently)', cn);
    await ctx.close();
  }
  // ---- part 2: in game ----
  {
    const { ctx, p } = await newPage();
    await p.evaluate(async () => {
      for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
      window._lxBootGateDone = true; window._prologueActive = false; window._lxAwaitingCreation = false; player.cls = 'warrior'; player.level = 7;
      player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
      delete player._storyBeatsSeen.tutorial_outro;
      loadMap('town'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
      player.invulnerable = 999999; game.monsters.length = 0;
      _showTutorialModal(); _tutStep = TUTORIAL_STEPS.length - 1; _renderTutorialStep();
    });
    await p.waitForFunction(() => game.time > 30, null, { timeout: 60000 });
    // 4) the tour's last step: U -> Skills, then ONE Escape closes the panel
    await p.keyboard.press('u'); await p.waitForTimeout(600);
    await p.evaluate(() => { const b = document.querySelector('#attributes-modal .inv-tab[data-utab="skills"]'); if (b) b.click(); });
    await p.waitForFunction(() => document.getElementById('tutorial-modal').style.display === 'none', null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    const before = await p.evaluate(() => ({ u: document.getElementById('attributes-modal').style.display, sb: !!document.querySelector('#story-beat-overlay.on') }));
    await p.keyboard.press('Escape'); await p.waitForTimeout(700);
    const after = await p.evaluate(() => ({ u: document.getElementById('attributes-modal').style.display, sb: !!document.querySelector('#story-beat-overlay.on') }));
    check(before.u === 'flex' && after.u === 'none', 'after the tour\'s last step one Escape closes the U panel (took two: the first skipped the outro under it)', { before, after });
    let outro = false;
    try { await p.waitForFunction(() => !!document.querySelector('#story-beat-overlay.on'), null, { timeout: 8000 }); outro = true; } catch (e) {}
    const seenOutro = await p.evaluate(() => !!(player._storyBeatsSeen && player._storyBeatsSeen.tutorial_outro));
    check(outro && seenOutro, 'the tour\'s outro then plays over the world, not under a panel', { outro, seenOutro });
    if (outro) { await p.keyboard.press('Escape'); await p.waitForTimeout(800); }
    // 5) the story cue: effective alpha (colour alpha x the pulse's lowest opacity) on an epilogue card
    await p.evaluate(() => { _playStoryBeat({ mode: 'epilogue', stanzas: [{ text: 'A quiet test card.' }] }); });
    await p.waitForTimeout(400);
    const cue = await p.evaluate(async () => { const el = document.getElementById('story-beat-hint'); let min = 1;
      for (let i = 0; i < 26; i++) { min = Math.min(min, +getComputedStyle(el).opacity); await new Promise((s) => setTimeout(s, 100)); }
      return { color: getComputedStyle(el).color, min, txt: el.textContent.slice(0, 30) }; });
    const cl = lum(cue.color);
    check(cl.a * cue.min >= 0.7 && cl.L >= 0.55, 'the story card\'s "press Enter to continue" cue is readable (was ~15-45% effective alpha)', { ...cue, L: +cl.L.toFixed(2), eff: +(cl.a * cue.min).toFixed(2) });
    await p.keyboard.press('Escape'); await p.waitForTimeout(800);
    // (death) regression guard: a death is explained - the card with the toll, then the toast with the coins taken
    await p.evaluate(async () => { try { closeAllModals(); } catch (e) {} game.paused = false; player._tutorialSeen = true; loadMap('forest'); await new Promise((s) => setTimeout(s, 2500)); game.monsters.length = 0; player.mojicoins = 50000; });
    await p.waitForFunction(() => game.time > 0 && game.currentMap === 'forest', null, { timeout: 60000 });
    await p.evaluate(() => {
      window.__d = { card: 0, cardToll: '', toast: 0, toastTxt: '', c0: totalCoins() };
      const on = (el) => { if (!el) return false; for (let a = el; a && a !== document.body; a = a.parentElement) { const c = getComputedStyle(a); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.5) return false; }
        const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4) return false; const pe = el.style.pointerEvents; el.style.pointerEvents = 'auto';
        const h = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 10)); el.style.pointerEvents = pe; return !!h && (h === el || el.contains(h)); };
      const tick = () => { try {
        const st = document.querySelector('#death-overlay.on .death-stage'); if (on(st)) { window.__d.card++; window.__d.cardToll = (document.getElementById('death-loss') || {}).textContent || ''; }
        for (const t of document.querySelectorAll('#toast-container .toast')) if (/defeated/i.test(t.textContent) && on(t)) { window.__d.toast++; window.__d.toastTxt = t.textContent; }
      } catch (e) {} if (!window.__dStop) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      player.invulnerable = 0; player.hp = 0;
    });
    await p.waitForFunction(() => game.currentMap === 'void' && !game.dying, null, { timeout: 180000, polling: 100 });
    const t0 = await p.evaluate(() => game.time);
    await p.waitForFunction((t) => game.time > t + 45, t0, { timeout: 60000 });
    const d = await p.evaluate(() => { window.__dStop = true; return { ...window.__d, c1: totalCoins() }; });
    const lost = d.c0 - d.c1, m = d.toastTxt.match(/Lost ([\d,]+)/);
    check(d.card >= 3 && /mojicoins/i.test(d.cardToll) && d.toast >= 2 && !!m && +m[1].replace(/,/g, '') === lost && lost > 0,
      'a death is explained: the death card with its toll, then "Defeated! Lost N" with the coins actually taken (frame-sampled)', { ...d, lost });
    await ctx.close();
  }
  check(errs.length === 0, 'no page errors', errs.slice(0, 5));
} catch (e) {
  console.log('FAIL  test crashed   ' + JSON.stringify(String(e && e.stack || e).slice(0, 600))); bad++; total++;
} finally {
  await browser.close(); srv.kill();
}
console.log(bad ? `${bad} of ${total} FAILED` : `all ${total} passed`);
process.exit(bad ? 1 : 0);
