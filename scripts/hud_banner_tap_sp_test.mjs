// UI / layout / text fixes: the Daily Challenge banner shows (and fits) on every viewport, portrait-play tap sizes, SP wording, tooltip + quest text.
//   node scripts/hud_banner_tap_sp_test.mjs      (MOJI_GAME_FILE=<build.html> to test a private build; PORT=<port>)
// fix-daily-banner-z: #daily-banner was z-index:auto UNDER the opaque #game canvas - it never painted. Pixel-diffed here (banner on vs hidden, paused sim) because
//   the banner is pointer-events:none, so elementFromPoint cannot tell. Placement: no overlap with any other HUD piece at 1280x720, 1024x768, 844x390 touch, 390x844 portrait.
// fix-lx-tap-portrait: --lx-tap inside a counter-scaled portrait panel (U tabs, jump buttons, potion MAX). fix-sp-poll-dedupe: "SP" everywhere, one toast per refund.
import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '10640';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const env = { ...process.env }; delete env.MOJI_GAME_FILE;
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] });
const errs = []; const md5 = (b) => crypto.createHash('md5').update(b).digest('hex');
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
  if (vp.width < 768) { await page.evaluate(() => document.querySelector('#rotate-nag button + button')?.click()); await page.waitForTimeout(900); }
  await page.waitForTimeout(1200);
  return { ctx, page };
}
const clipOf = (r, W, H) => { const x = Math.max(0, Math.floor(r.left)), y = Math.max(0, Math.floor(r.top)); return { x, y, width: Math.max(1, Math.min(W - x, Math.ceil(r.width))), height: Math.max(1, Math.min(H - y, Math.ceil(r.height))) }; };
// does the banner paint? (hash of its rect with it shown vs visibility:hidden, paused sim)
async function paints(page, W, H) {
  await page.evaluate(() => { game.paused = true; document.querySelectorAll('#toast-container .toast').forEach((t) => t.remove()); });
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => { const q = document.getElementById('daily-banner').getBoundingClientRect(); return { left: q.left, top: q.top, width: q.width, height: q.height }; });
  const clip = clipOf(r, W, H); const on1 = md5(await page.screenshot({ clip })); await page.waitForTimeout(250); const on2 = md5(await page.screenshot({ clip }));
  await page.evaluate(() => document.getElementById('daily-banner').style.setProperty('visibility', 'hidden', 'important')); await page.waitForTimeout(250);
  const off1 = md5(await page.screenshot({ clip })); await page.waitForTimeout(250); const off2 = md5(await page.screenshot({ clip }));
  await page.evaluate(() => { document.getElementById('daily-banner').style.removeProperty('visibility'); game.paused = false; });
  return { stable: on1 === on2 && off1 === off2, differs: on1 !== off1 };
}
// stress the right column (combo + two buffs + toasts) and list every HUD piece the banner overlaps
async function fits(page) {
  await page.evaluate(async () => { try { bumpCombo(12); game.comboTimer = 1e9; player.buffs.comboAtk = 99999; player.buffs.comboXp = 99999; showToast('first toast of the stack', 'rare'); showToast('second toast of the stack', 'rare'); } catch (e) {} await new Promise((s) => setTimeout(s, 700)); });
  return page.evaluate(() => {
    const b = document.getElementById('daily-banner'), q = b.getBoundingClientRect(), cs = getComputedStyle(b);
    const live = (e) => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0.05 && r.width > 0 && r.height > 0 && !b.contains(e); };
    const sels = ['#top-ui', '#quest-tracker', '#buff-row .moji-buff-pill', '#combo-meter', '#minimap', '#map-label', '#mp-btn', '#lx-corner', '#skill-bar', '#taxi-btn', '#hotkey-hint', '#toast-container .toast', '#mobile-deck .mc-btn', '#mobile-ctrl .mc-btn', '#mobile-deck .mc-dpad', '.mc-pot-dock'];
    const hits = [];
    for (const sel of sels) for (const e of document.querySelectorAll(sel)) { if (!live(e)) continue; const r = e.getBoundingClientRect(); const ox = Math.min(r.right, q.right) - Math.max(r.left, q.left), oy = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top); if (ox > 1 && oy > 1) hits.push(sel + ' ' + Math.round(ox) + 'x' + Math.round(oy)); }
    const z = parseInt(cs.zIndex, 10), cz = parseInt(getComputedStyle(document.getElementById('game')).zIndex, 10) || 0;
    return { hits, rect: [q.left, q.top, q.right, q.bottom].map(Math.round), inside: q.left >= -3 && q.top >= 0 && q.right <= innerWidth + 3 && q.bottom <= innerHeight, zAbove: z > cz, z, cz, shown: cs.display !== 'none' && cs.visibility !== 'hidden', text: b.innerText.replace(/\s+/g, ' ').slice(0, 90) };
  });
}
const VIEWS = [['1280x720', { width: 1280, height: 720 }, false], ['1024x768', { width: 1024, height: 768 }, false], ['844x390 touch', { width: 844, height: 390 }, true], ['390x844 portrait', { width: 390, height: 844 }, true]];
const R = {};
for (const [name, vp, phone] of VIEWS) {
  const { ctx, page } = await open(vp, phone);
  try {
    let pt = await paints(page, vp.width, vp.height); for (let i = 0; i < 2 && !pt.stable; i++) pt = await paints(page, vp.width, vp.height);   // the canvas under it can still be animating
    const f = await fits(page);
    check(f.zAbove && f.shown, `${name}: the Daily Challenge banner is above the game canvas (z ${f.z} vs ${f.cz})`, f);
    check(pt.stable && pt.differs, `${name}: the banner paints (its rect differs with it hidden)`, pt);
    check(/Daily Challenge/.test(f.text) && /chest/i.test(f.text), `${name}: it reads like a challenge ("${f.text}")`, f.text);
    check(f.hits.length === 0 && f.inside, `${name}: it overlaps no other HUD piece and is not clipped ${JSON.stringify(f.rect)}`, f);
    if (name === '1280x720') {
      const t = await page.evaluate(() => {
        const out = {}; const ban = document.getElementById('daily-banner'), top = document.getElementById('top-ui');
        out.hudScale = {}; for (const k of [0.8, 1.5]) { document.documentElement.style.setProperty('--lx-ui-scale', String(k)); out.hudScale[k] = [Math.round(top.getBoundingClientRect().bottom), Math.round(ban.getBoundingClientRect().top)]; }
        document.documentElement.style.removeProperty('--lx-ui-scale');
        document.body.classList.add('lx-prologue-fight'); out.fightVis = getComputedStyle(ban).visibility; document.body.classList.remove('lx-prologue-fight');
        const coin = document.getElementById('hud-mojicoins').closest('.stat-item').title, mp = document.getElementById('mp-bar').closest('.bar').title;
        out.coin = coin; out.mp = mp;
        const step = TUTORIAL_STEPS.find((s) => s.detect === 'combo'); out.combo = step.body + ' || ' + step.gugumaLine;
        const q = Object.values(QUESTS).find((x) => x.desc && /Withering Tide/.test(x.desc) && /anglerfish/.test(x.desc)); out.quest = q ? q.desc : '';
        return out;
      });
      // fix-daily-banner-yield: the co-op plates / tower pin / party-quest pin share the left column - the banner steps aside, and comes back
      const y = await page.evaluate(async () => {
        const nap = (ms) => new Promise((r) => setTimeout(r, ms)), ban = document.getElementById('daily-banner'), o = {};
        const disp = () => getComputedStyle(ban).display;
        await nap(600); o.solo = disp();
        const pf = document.createElement('div'); pf.id = 'party-frames'; pf._cache = '<div class="pf-row">x</div>'; pf.innerHTML = pf._cache; pf.style.display = 'block'; document.body.appendChild(pf);
        await nap(700); o.party = disp(); pf.remove(); await nap(700); o.partyGone = disp();
        const ep = document.getElementById('expedition-quest-pin'); ep.style.display = 'block'; await nap(700); o.tower = disp(); ep.style.display = 'none'; await nap(700); o.towerGone = disp();
        const qp = document.getElementById('pq-objective-pin'); qp.style.display = 'block'; await nap(700); o.pq = disp(); qp.style.display = 'none'; await nap(700); o.pqGone = disp();
        return o;
      });
      check(y.solo !== 'none' && y.party === 'none' && y.partyGone !== 'none' && y.tower === 'none' && y.towerGone !== 'none' && y.pq === 'none' && y.pqGone !== 'none', 'the banner steps aside for the co-op partner plates, the tower pin and the party-quest pin, and returns after', y);
      check(Object.values(t.hudScale).every(([tb, bt]) => bt >= tb - 1), 'the banner hangs under the stats card at HUD size 80% and 150% (it follows --lx-ui-scale)', t.hudScale);
      check(t.fightVis === 'hidden', 'the prologue memory fight hides the banner with the rest of the HUD (visibility:hidden)', t.fightVis);
      check(!/auction house|toll/i.test(t.coin) && /taxi/i.test(t.coin) && /craft/i.test(t.coin) && /reset/i.test(t.coin) && /wardrobe/i.test(t.coin), 'Mojicoins tooltip names real sinks (stat reset, taxi, crafting, wardrobe), not the auction house or toll-gates', t.coin);
      check(/G, B slots/.test(t.mp), 'the MP tooltip lists the Master Ultimate slot B', t.mp);
      check(/hits/.test(t.combo) && /15%/.test(t.combo) && !/5 kills|Chain kills|Chain your kills/.test(t.combo), 'the tutorial combo step describes hits, +15% damage and a smaller XP bonus (not "every 5 kills")', t.combo);
      check(/bonebos'ns/.test(t.quest) && !/bonebosns/.test(t.quest), "the Withering Tide quest says bonebos'ns", t.quest.slice(0, 200));
    }
    if (name === '844x390 touch') {   // phone landscape: tap sizes unchanged, SP toasts
      const m = await page.evaluate(async () => { game._uTab = 'lp'; openLevelUpPanel(); await new Promise((r) => setTimeout(r, 500)); const h = document.querySelector('#attributes-modal .inv-tab[data-utab]').getBoundingClientRect().height; closeAllModals(); return { tab: Math.round(h), ptf: document.body.classList.contains('lx-ptf') }; });
      check(!m.ptf && m.tab >= 36 && m.tab <= 44, 'phone landscape: U tabs keep their ~38 px tap size (the portrait rule does not reach it)', m);
      const sp = await page.evaluate(async () => {
        const seen = []; const st = window.showToast; window.showToast = (...a) => { seen.push(String(a[0])); return st(...a); };
        const nap = (ms) => new Promise((r) => setTimeout(r, ms)); const o = {};
        await nap(1300); player.skillPoints = (player.skillPoints | 0) + 3; await nap(1400); o.gain = seen.slice();
        seen.length = 0; const lo = LEVELUP_OPTIONS[0]; player._levelUpSpent = { [lo.id]: 3 }; player.mojicoins = 500000; player.setshards = 5000; window.uiConfirm = async () => true;
        const sp0 = player.skillPoints; resetStats(); await nap(1500); o.reset = seen.slice(); o.refund = player.skillPoints - sp0;
        // a level-up with a lucky innate roll (both dice 1): the poll says "+3 SP", the innate toast its own "+2 SP" - not "+5"
        seen.length = 0; const rnd = Math.random; Math.random = () => 0.99; player.exp = player.expToNext; const lv0 = player.level; _maybeLevelUp(); await nap(1600); Math.random = rnd; o.lvl = seen.slice(); o.leveled = player.level - lv0;
        window.showToast = st; return o;
      });
      check(sp.leveled === 1 && sp.lvl.some((t) => /^\+3 SP\b/.test(t)) && sp.lvl.some((t) => /Innate growth: \+2 SP/.test(t)) && !sp.lvl.some((t) => /^\+5 /.test(t)), 'a level-up with an innate roll toasts "+3 SP" and "Innate growth: +2 SP" - the poll does not fold the innate SP in again ("+5")', sp.lvl);
      check(sp.gain.length === 1 && /^\+3 SP\b/.test(sp.gain[0]) && /tap LV UP/.test(sp.gain[0]), 'a plain +3 gain toasts "+3 SP - tap LV UP to spend" (SP, not Ability Points)', sp.gain);
      check(sp.refund > 0 && sp.reset.filter((t) => /Stats reset/.test(t) && /SP refunded/.test(t)).length === 1, 'Reset Stats toasts its own "N SP refunded"', sp);
      check(sp.reset.filter((t) => /tap LV UP to spend/.test(t)).length === 0, 'Reset Stats does not ALSO fire the generic "+N ... tap LV UP" poll toast (one toast per refund)', sp.reset);
    }
    if (name === '390x844 portrait') {   // portrait-anyway: panels counter-scaled, tap sizes in screen px
      const m = await page.evaluate(async () => {
        game._uTab = 'lp'; openLevelUpPanel(); await new Promise((r) => setTimeout(r, 600));
        const tab = document.querySelector('#attributes-modal .inv-tab[data-utab]').getBoundingClientRect().height, jump = document.querySelector('#u-jump-row .u-jump').getBoundingClientRect().height;
        closeAllModals(); openShop('potion'); await new Promise((r) => setTimeout(r, 700));
        const it = document.querySelector('#shop-modal .shop-item'), mx = it.querySelector('[data-step="max"]').getBoundingClientRect(), ir = it.getBoundingClientRect(); closeAllModals();
        return { ptf: document.body.classList.contains('lx-ptf'), tab: Math.round(tab), jump: Math.round(jump), maxW: Math.round(mx.width), maxH: Math.round(mx.height), maxInside: mx.right <= ir.right + 1 && mx.left >= ir.left - 1 };
      });
      check(m.ptf && m.tab >= 30 && m.tab <= 60 && m.jump <= 60, 'portrait play: U tabs / jump buttons are ~40 px, not ~3x too big (117 / 87 before)', m);
      check(m.maxH <= 60 && m.maxW <= 80 && m.maxInside, 'portrait play: potion-stall MAX is a normal button inside its row (it landed outside, 115 px square)', m);
      // fix-compendium-ring-portrait: the title ran under the 0% progress ring
      const c = await page.evaluate(async () => {
        closeAllModals(); openMojidex(); await new Promise((r) => setTimeout(r, 900));
        const t = document.querySelector('#mojidex-modal .mjx-title'), rg = document.createRange(); rg.selectNodeContents(t); const tr = rg.getBoundingClientRect(), ring = document.getElementById('mjx-ring').getBoundingClientRect();
        closeAllModals(); return { titleRight: Math.round(tr.right), ringLeft: Math.round(ring.left), overlap: tr.right > ring.left + 1 && tr.left < ring.right && tr.bottom > ring.top };
      });
      check(!c.overlap, 'portrait play: the Compendium title does not run under the progress ring (270 vs 251 before)', c);
    }
  } finally { await ctx.close(); }
}
await browser.close(); srv.kill();
const src = fs.readFileSync(path.join(ROOT, FILE), 'utf8');
check(!/ AP refunded from the old skill tree/.test(src) && / SP refunded from the old skill tree/.test(src), 'the class-swap toast says SP refunded, not AP', null);
check(errs.length === 0, 'no page errors', errs.slice(0, 3));
console.log(`\n${total - bad}/${total} checks passed`);
process.exit(bad ? 1 : 0);
