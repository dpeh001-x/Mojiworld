// Small-screen polish: portrait-anyway fits tall narrow phones, the Daily banner clears the d-pad on a 568x320 phone, the two-tab card copy.
//   node scripts/small_screen_polish_test.mjs      (MOJI_GAME_FILE=<build.html> to test a private build; PORT=<port>)
// fix-portrait-fit: _fitGameToViewport floored the portrait scale at 0.33, but a wide-view box is up to 1280 px wide (1212 x 0.33 = 400 px on a 390 px phone, 1244 x 0.33 = 410 px on a
//   360x800): the stats card, version tag and right-edge HUD ran off the screen. Every width 320-480 now fits; the counter-scaled panels still fill the screen at 1 px per px.
// fix-banner-tiny: at 568x320 the Daily Challenge banner sat 38x15 px on the d-pad's up button; a short chip there, the full banner (untouched) from 360 px tall up.
// fix-stale-card-copy: the two-tab card says what happened, which tab has the newest progress and what each button does (behaviour: scripts/two_tab_save_test.mjs).
import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '10651';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const env = { ...process.env }; delete env.MOJI_GAME_FILE;
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const errs = [];
const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';
async function open(vp, phone) {
  const ctx = await browser.newContext({ viewport: vp, serviceWorkers: 'block', hasTouch: !!phone, isMobile: !!phone, userAgent: phone ? UA : undefined });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof openLevelUpPanel === 'function' && typeof DAILY_CHALLENGES !== 'undefined' && document.getElementById('lo-menu'), null, { timeout: 180000 });
  await page.waitForTimeout(3000);
  await page.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; window._prologueAfterCreation = false; window._lxAwaitingCreation = false; window._lxInWorld = true;
    player._tutorialSeen = true; applyClass('mage'); player.level = 45; player.hp = getMaxHp(); player.mp = getMaxMp(); player.mojicoins = 250000; player.skillPoints = 7;
    for (const k of Object.keys(STORY_BEATS)) (player._storyBeatsSeen = player._storyBeatsSeen || {})[k] = true;
    const c = DAILY_CHALLENGES.find((q) => /chest/i.test(q.desc)) || DAILY_CHALLENGES[0];
    game.dailyState = { day: dailyIndex(), streak: 1, challenge: c.id, progress: 0, claimed: false, seenMaps: [], seenNpcs: [] };
    loadMap('town'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
  });
  if (vp.height > vp.width && vp.width < 768) { await page.evaluate(() => document.querySelector('#rotate-nag button + button')?.click()); await page.waitForTimeout(900); }   // "Play in portrait anyway"
  await page.waitForTimeout(1200);
  return { ctx, page };
}
// ---- the HUD against the left / right screen edges, and the panels at 1 px per px
const edges = (page) => page.evaluate(() => {
  const wrap = document.querySelector('.game-wrapper'), r = wrap.getBoundingClientRect(), clip = [];
  for (const e of document.querySelectorAll('body *')) {
    const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < 0.05) continue;
    if (e.closest('script, style, svg, #rotate-nag, #toast-container')) continue;   // toasts slide in over the edge by design (toast_layout_test)
    const q = e.getBoundingClientRect(); if (q.width < 2 || q.height < 2 || q.width > innerWidth * 1.2) continue;
    if (q.left < -0.5 || q.right > innerWidth + 0.5) clip.push((e.id ? '#' + e.id : e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0]) + ' ' + Math.round(q.left * 10) / 10 + '..' + Math.round(q.right * 10) / 10);
  }
  const vt = document.getElementById('version-tag').getBoundingClientRect(), st = document.getElementById('stats').getBoundingClientRect();
  return { vw: innerWidth, scale: wrap.style.getPropertyValue('--game-scale'), box: [Math.round(r.left * 10) / 10, Math.round(r.right * 10) / 10], ver: Math.round(vt.left * 10) / 10, stats: Math.round(st.left * 10) / 10, clip: clip.slice(0, 8), ptf: document.body.classList.contains('lx-ptf') };
});
const panels = (page) => page.evaluate(async () => {
  const nap = (ms) => new Promise((r) => setTimeout(r, ms)), o = {};
  game._uTab = 'lp'; openLevelUpPanel(); await nap(700);
  const ov = document.getElementById('attributes-modal'), q = ov.getBoundingClientRect(), tab = document.querySelector('#attributes-modal .inv-tab[data-utab]').getBoundingClientRect();
  o.u = { rect: [q.left, q.top, q.right, q.bottom].map(Math.round), tab: Math.round(tab.height) };
  closeAllModals(); openShop('potion'); await nap(800);
  const it = document.querySelector('#shop-modal .shop-item'), mx = it.querySelector('[data-step="max"]').getBoundingClientRect(), ir = it.getBoundingClientRect();
  o.potion = { w: Math.round(mx.width), h: Math.round(mx.height), inside: mx.right <= ir.right + 1 && mx.left >= ir.left - 1 };
  closeAllModals(); await nap(300); return o;
});
const PORTRAIT = [[320, 568], [360, 800], [390, 844], [430, 932]];
const card = {};
for (const [w, h] of PORTRAIT) {
  const { ctx, page } = await open({ width: w, height: h }, true);
  try {
    const e = await edges(page);
    check(e.ptf && e.box[0] >= -0.5 && e.box[1] <= w + 0.5 && e.stats >= 0 && e.ver >= -0.5 && e.clip.length === 0, `${w}x${h} portrait-anyway: the whole HUD box fits the screen (box ${e.box}, version tag x ${e.ver}, stats card x ${e.stats})`, e);
    const p = await panels(page);
    check(Math.abs(p.u.rect[0]) <= 1 && Math.abs(p.u.rect[1]) <= 1 && Math.abs(p.u.rect[2] - w) <= 1 && Math.abs(p.u.rect[3] - h) <= 1, `${w}x${h}: the U panel still fills the screen at 1 px per px`, p.u);
    check(p.u.tab >= 30 && p.u.tab <= 60 && p.potion.h <= 60 && p.potion.w <= 80 && p.potion.inside, `${w}x${h}: tap sizes stay ~38 px (U tab ${p.u.tab}, potion MAX ${p.potion.w}x${p.potion.h} inside its row)`, p);
    if (w === 360) {   // the two-tab card on a 360 px portrait phone (the two-tab check shares this page)
      card.portrait = await page.evaluate(() => { game._staleTab = false; _lxStaleTabFlag(); const c = document.getElementById('lx-stale-tab'), r = c.getBoundingClientRect(); return { rect: [r.left, r.top, r.right, r.bottom].map(Math.round), vw: innerWidth, vh: innerHeight, text: c.innerText.replace(/\s+/g, ' ') }; });
      await page.evaluate(() => document.getElementById('lx-stale-tab')?.remove());
    }
  } finally { await ctx.close(); }
}
// ---- the Daily banner on touch landscape: no overlap with any control or HUD piece at the tiny sizes, the full banner above them
async function banner(page, vw, vh) {
  await page.evaluate(async () => { try { bumpCombo(12); game.comboTimer = 1e9; player.buffs.comboAtk = 99999; player.buffs.comboXp = 99999; showToast('first toast of the stack', 'rare'); showToast('second toast', 'rare'); } catch (e) {} await new Promise((s) => setTimeout(s, 800)); });
  return page.evaluate(() => {
    const b = document.getElementById('daily-banner'), q = b.getBoundingClientRect(), cs = getComputedStyle(b), area = innerWidth * innerHeight;
    const live = (e) => { const s = getComputedStyle(e), r = e.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0.05 && r.width > 0 && r.height > 0; };
    const hits = [];
    for (const e of document.querySelectorAll('body *')) {
      if (e === b || b.contains(e) || e.contains(b) || e.closest('script, style, svg, #rotate-nag') || e.tagName === 'CANVAS' || e.id === 'game' || e.classList.contains('game-wrapper')) continue;
      if (!live(e)) continue;
      const pos = getComputedStyle(e).position;
      if (!(pos === 'absolute' || pos === 'fixed' || e.closest('#top-ui, #mobile-deck, #mobile-ctrl, #toast-container, #quest-tracker, #buff-row, #combo-meter, #lx-corner, #skill-bar'))) continue;
      const r = e.getBoundingClientRect(); if (r.width * r.height > area * 0.5) continue;   // the full-screen deck / overlay containers
      const ox = Math.min(r.right, q.right) - Math.max(r.left, q.left), oy = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top);
      if (ox > 1 && oy > 1) hits.push((e.id ? '#' + e.id : e.tagName.toLowerCase() + '.' + String(e.className).split(' ').slice(0, 2).join('.')) + ' ' + Math.round(ox) + 'x' + Math.round(oy));
    }
    const dp = document.querySelector('.mc-dpad'), dr = dp ? dp.getBoundingClientRect() : null, t0 = b.firstElementChild;
    return { shown: cs.display !== 'none', rect: [q.left, q.top, q.right, q.bottom].map(Math.round), h: Math.round(q.height), hits, inside: q.left >= -1 && q.top >= 0 && q.right <= innerWidth + 1 && q.bottom <= innerHeight, dpadTop: dr ? Math.round(dr.top) : null,
      title: getComputedStyle(t0).display !== 'none', streak: getComputedStyle(document.getElementById('daily-streak')).display !== 'none', text: b.innerText.replace(/\s+/g, ' ').slice(0, 90) };
  });
}
const BANNER = [['568x320 touch', 568, 320, true], ['568x300 touch', 568, 300, true], ['640x360 touch', 640, 360, true], ['740x360 touch', 740, 360, true], ['844x390 touch', 844, 390, true], ['932x430 touch', 932, 430, true], ['1280x720', 1280, 720, false]];
for (const [name, w, h, phone] of BANNER) {
  const { ctx, page } = await open({ width: w, height: h }, phone);
  try {
    const f = await banner(page, w, h);
    if (h === 300) check(!f.shown && f.hits.length === 0, `${name}: nothing fits between the stats card and the d-pad, so the banner is hidden (no overlap)`, f);
    else check(f.shown && f.hits.length === 0 && f.inside, `${name}: the Daily Challenge banner overlaps no control or HUD piece ${JSON.stringify(f.rect)}`, f);
    if (h === 320) {   // the short chip: the task and its bar, one line for every challenge
      check(f.h <= 28 && !f.title && !f.streak && /chest/i.test(f.text) && /0 \/ 3/.test(f.text) && f.rect[3] <= f.dpadTop, `${name}: the chip is short (${f.h} px, bottom ${f.rect[3]} above the d-pad at ${f.dpadTop}) and reads "${f.text}"`, f);
      const all = await page.evaluate(async () => {
        const out = [], dp = document.querySelector('.mc-dpad').getBoundingClientRect().top;
        for (const c of DAILY_CHALLENGES) { game.dailyState = { day: dailyIndex(), streak: 1, challenge: c.id, progress: 0, claimed: false, seenMaps: [], seenNpcs: [] }; await new Promise((s) => setTimeout(s, 350)); const q = document.getElementById('daily-banner').getBoundingClientRect(); out.push([c.desc, Math.round(q.height), Math.round(q.bottom), Math.round(q.right)]); }
        return { out, dp };
      });
      check(all.out.length >= 10 && all.out.every(([, hh, bt, rt]) => hh <= 28 && bt <= all.dp && rt <= 568), `${name}: every Daily challenge's chip (${all.out.length}) stays one task line, above the d-pad, inside the screen`, all);
    } else if (h !== 300) check(f.title && f.streak && /Daily Challenge/.test(f.text) && /chest/i.test(f.text), `${name}: the full banner is untouched (title, task, bar, streak)`, f);
  } finally { await ctx.close(); }
}
// ---- the two-tab card: 568x320 landscape phone
{
  const { ctx, page } = await open({ width: 568, height: 320 }, true);
  try {
    const c = await page.evaluate(async () => {
      game._staleTab = false; _lxStaleTabFlag(); await new Promise((s) => setTimeout(s, 400));
      const el = document.getElementById('lx-stale-tab'), r = el.getBoundingClientRect(), go = el.querySelector('.lxs-go'), keep = el.querySelector('.lxs-keep');
      const o = { rect: [r.left, r.top, r.right, r.bottom].map(Math.round), vw: innerWidth, vh: innerHeight, text: el.innerText.replace(/\s+/g, ' '), go: go.textContent, keep: keep.textContent, caps: [...el.querySelectorAll('small')].map((x) => x.textContent) };
      const spill = [...el.querySelectorAll('*')].filter((e) => { const q = e.getBoundingClientRect(); return q.left < r.left - 1 || q.right > r.right + 1 || q.bottom > r.bottom + 1; }).length; o.spill = spill;
      keep.click(); await new Promise((s) => setTimeout(s, 200)); o.armed = keep.textContent; o.stillUp = !!document.getElementById('lx-stale-tab') && !!game._staleTab;
      return o;
    });
    check(c.rect[0] >= 0 && c.rect[2] <= c.vw && c.rect[3] <= c.vh * 0.4 && c.spill === 0, `568x320: the two-tab card fits (${JSON.stringify(c.rect)} of ${c.vw}x${c.vh}), nothing spills out of it`, c);
    check(/another tab/i.test(c.text) && /newest progress/i.test(c.text) && /not being saved/i.test(c.text) && /overwritten/i.test(c.text), 'the card says another tab is open, that tab has the newest progress, this tab is not being saved and nothing is overwritten', c.text);
    check(/Reload/.test(c.go) && c.caps.length === 2 && /newest save/i.test(c.caps[0]) && /other tab/i.test(c.caps[1]) && /Save Backups/.test(c.caps[1]), 'each button has a plain-language caption (Reload: continue from the newest save; Keep: replaces the other tab\'s save, a copy goes to Save Backups)', c);
    check(!/Overwrite the other tab/.test(c.armed) && /confirm/i.test(c.armed) && c.stillUp, 'the first press on the second button only asks to confirm (the card stays, the tab is still held)', c);
  } finally { await ctx.close(); }
  const p = card.portrait;
  check(p && p.rect[0] >= 0 && p.rect[2] <= p.vw && p.rect[3] <= p.vh * 0.3 && /newest progress/i.test(p.text), `360x800 portrait: the two-tab card fits the screen (${JSON.stringify(p && p.rect)}) and carries the new copy`, p);
}
await browser.close(); srv.kill();
const src = fs.readFileSync(path.join(ROOT, FILE), 'utf8');
check(/isLandscape \? 0\.5 : 0\.25, Math\.min\(base, sx, sy\)/.test(src) && !/isLandscape \? 0\.5 : 0\.33/.test(src), 'the portrait scale floor is 0.25 (320 / 1280), not 0.33', null);
check(errs.length === 0, 'no page errors', errs.slice(0, 3));
console.log(`\n${total - bad}/${total} checks passed`);
process.exit(bad ? 1 : 0);
