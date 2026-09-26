// The MojiMon roster cards in the cute style (v0.30.x mm-roster).
//   node scripts/mm_roster_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// Per user: "do the same cute style for the roster cards".
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '10550';
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
      const mm = _mojimonEnsure(); mm.roster = {}; mm.out = null; mm.cdUntil = 0; mm.assigned = null;
      game._uTab = 'mojimon'; openLevelUpPanel(); const b = document.querySelector('[data-utab="mojimon"]'); if (b) b.click();
      await document.fonts.ready;
    });
    await page.waitForTimeout(500);
    return { ctx, page };
  };
  const { ctx, page } = await boot({ viewport: { width: 1280, height: 800 } });
  const empty = await page.evaluate(() => { const e = document.querySelector('#u-pane-mojimon .mmr-empty'); return e ? e.textContent : null; });
  check(empty && empty.includes('No MojiMon bound yet'), 'nothing bound: a cute empty bubble says so', empty);
  // two bound: the first fielded and on H, the second resting on the bench while the cooldown runs
  const R = await page.evaluate(() => {
    const ks = Object.keys(monsterTypes).filter((k) => !monsterTypes[k].boss).slice(0, 2), mm = _mojimonEnsure();
    mm.roster[ks[0]] = { upg: { hp: 2, atk: 1, def: 0 } }; mm.roster[ks[1]] = { upg: { hp: 0, atk: MOJIMON_UPG_PT_CAP, def: 0 } };
    mm.out = { type: ks[0], hpFrac: 0.7 }; mm.assigned = ks[0]; mm.cdUntil = Date.now() + 60000; renderMojiMonPanel();
    const card = (k) => document.querySelector('#u-pane-mojimon .mmr-card[data-mon="' + k + '"]');
    const info = (k) => { const c = card(k), st = _mojimonStatsFor(k); return {
      cls: c.className, name: c.querySelector('.mmr-name').textContent, stats: [...c.querySelectorAll('.mmr-sp')].map((x) => x.textContent.replace(/[^\d,%]/g, '')),
      want: [st.maxHp.toLocaleString(), st.atk.toLocaleString(), Math.round(st.defRed * 100) + '%'], hp: c.querySelector('.mmr-hp i') ? c.querySelector('.mmr-hp i').style.width : null,
      hkey: c.querySelector('.mmr-hkey').textContent, hon: c.querySelector('.mmr-hkey').classList.contains('on'), bond: c.querySelector('.mmr-bond').className,
      summon: c.querySelector('.mmr-summon') ? { t: c.querySelector('.mmr-summon').textContent, dis: c.querySelector('.mmr-summon').disabled } : null,
      rows: [...c.querySelectorAll('.mmr-row')].map((r) => ({ v: r.querySelector('.mmr-val').textContent, m: r.querySelector('.mmr-meter i').style.width, minus: r.querySelector('.minus').disabled, plus: r.querySelector('.plus').disabled })),
      free: c.querySelector('.mmr-chip').textContent,
      // per user: "Abit more black" - black cards, their point rows on a deep-purple plate
      bg: getComputedStyle(c).backgroundColor, plate: getComputedStyle(c.querySelector('.mmr-alloc')).backgroundColor,
      // per user: the circle round the monster was "ugly, please make it less opaque and beautify it" - a translucent glow
      bub: (() => { const s = getComputedStyle(c.querySelector('.mmr-bub')); return { bg: s.backgroundColor, opaque: /rgb\(/.test(s.backgroundImage),
        bw: parseFloat(s.borderTopWidth), ba: parseFloat((s.borderTopColor.match(/rgba\([^)]*,\s*([\d.]+)\)/) || [0, 1])[1]) }; })() }; };
    return { ks, a: info(ks[0]), b: info(ks[1]), cap: MOJIMON_UPG_PT_CAP, pts: _mojimonPoints() };
  });
  console.log('cards', JSON.stringify(R));
  const { a, b } = R;
  check(/\bout\b/.test(a.cls) && a.name.includes('FIELDED') && a.hp === '70%' && !a.summon, 'the fielded MojiMon: a yellow-edged card, a FIELDED pill, its HP as a candy bar, no Summon', a);
  check([a, b].every((x) => x.bub.bg === 'rgba(0, 0, 0, 0)' && !x.bub.opaque && x.bub.bw <= 2 && x.bub.ba <= 0.5),
    'the bubble round each monster is a translucent glow: no solid fill, a thin faint ring', [a.bub, b.bub]);
  check([a, b].every((x) => x.bg === 'rgb(14, 10, 20)' && x.plate === 'rgb(31, 13, 54)'), 'black cards, their point rows on a deep-purple plate', [a.bg, a.plate, b.bg, b.plate]);
  check(JSON.stringify(a.stats) === JSON.stringify(a.want) && JSON.stringify(b.stats) === JSON.stringify(b.want), 'the stat pills show its real max HP, attack and damage reduction', [a.stats, a.want]);
  check(a.hon && a.hkey.includes('★') && /\bon\b/.test(a.bond) && !b.hon && b.hkey.includes('☆') && !/\bon\b/.test(b.bond), 'the H-slot MojiMon has the yellow ★ H and the lit bond; the other a plain ☆ H and a quiet bond', [a.hkey, b.hkey]);
  check(b.summon && b.summon.dis && b.summon.t.includes('after the rest'), 'on cooldown the bench MojiMon\'s Summon is greyed and says it is resting', b.summon);
  check(a.rows[0].v === '2' && a.rows[0].m === Math.round(2 / R.cap * 100) + '%' && a.rows[2].minus && !a.rows[0].minus, 'each stat row: its points, a meter up to the cap, and - greyed at 0', a.rows);
  check(b.rows[1].v === String(R.cap) && b.rows[1].plus && b.rows[1].m === '100%', 'a stat at the cap: + greyed and the meter full', b.rows[1]);
  check(a.free === (R.pts - 3) + ' free', 'the free-points chip counts what is left for this MojiMon', a.free);
  // the buttons still do their jobs
  const act = await page.evaluate(async (ks) => {
    const mm = _mojimonEnsure(), card = (k) => document.querySelector('#u-pane-mojimon .mmr-card[data-mon="' + k + '"]');
    card(ks[1]).querySelector('.mmr-row.hp .plus').click();
    const up = mm.roster[ks[1]].upg.hp, shown = card(ks[1]).querySelector('.mmr-row.hp .mmr-val').textContent;
    card(ks[1]).querySelector('.mmr-row.hp .minus').click();
    const down = mm.roster[ks[1]].upg.hp;
    card(ks[1]).querySelector('.mmr-hkey').click();
    const assigned = mm.assigned, lit = card(ks[1]).querySelector('.mmr-bond').classList.contains('on') && card(ks[1]).querySelector('.mmr-hkey').classList.contains('on');
    mm.out = null; mm.cdUntil = 0; renderMojiMonPanel();
    const btn = card(ks[1]).querySelector('.mmr-summon'), txt = btn.textContent, dis = btn.disabled;
    btn.click(); await new Promise((r) => setTimeout(r, 600));
    return { up, shown, down, assigned, lit, txt, dis, out: mm.out && mm.out.type };
  }, R.ks);
  console.log('actions', JSON.stringify(act));
  check(act.up === 1 && act.shown === '1' && act.down === 0, '+ and - move the points and the card shows it', act);
  check(act.assigned === R.ks[1] && act.lit, '☆ H hands the H slot over and that card\'s bond lights up', act);
  check(!act.dis && act.txt.includes('Summon') && act.out === R.ks[1], 'ready: ✨ Summon is a live yellow button and it fields the MojiMon', act);
  // layout, desktop and a phone on its side
  const layout = async (pg) => pg.evaluate(async () => {
    const mm = _mojimonEnsure(); mm.out = null; mm.cdUntil = Date.now() + 60000;
    if (!document.getElementById('u-pane-mojimon') || document.getElementById('u-pane-mojimon').offsetParent === null) { game._uTab = 'mojimon'; openLevelUpPanel(); const b = document.querySelector('[data-utab="mojimon"]'); if (b) b.click(); }
    renderMojiMonPanel(); await new Promise((r) => setTimeout(r, 300));
    const pane = document.getElementById('u-pane-mojimon').getBoundingClientRect();
    const sel = '.mmr-top, .mmr-id, .mmr-stats, .mmr-row, .mmr-ah, .mmr-bond, .mmr-summon';
    const over = [...document.querySelectorAll('#u-pane-mojimon .mmr-card')].flatMap((c) => [...c.querySelectorAll(sel)].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.className));
    const cards = [...document.querySelectorAll('#u-pane-mojimon .mmr-card')].map((c) => c.getBoundingClientRect());
    const oneLine = [...document.querySelectorAll('#u-pane-mojimon .mmr-stats')].every((s) => s.getBoundingClientRect().height < 30 * (s.getBoundingClientRect().height / s.offsetHeight || 1));
    return { n: cards.length, inside: cards.every((c) => c.left >= pane.left - 1 && c.right <= pane.right + 1), over, oneLine };
  });
  const L1 = await layout(page);
  console.log('desktop', JSON.stringify(L1));
  check(L1.n === 2 && L1.inside && L1.over.length === 0 && L1.oneLine, 'desktop: both cards inside the pane, the stat pills on one line, nothing spills', L1);
  await ctx.close();
  const ph = await boot({ viewport: { width: 842, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ph.page.evaluate(() => { const ks = Object.keys(monsterTypes).filter((k) => !monsterTypes[k].boss).slice(0, 2), mm = _mojimonEnsure(); for (const k of ks) mm.roster[k] = { upg: { hp: 1, atk: 1, def: 1 } }; mm.assigned = ks[0]; });
  const L2 = await layout(ph.page);
  console.log('phone', JSON.stringify(L2));
  check(L2.n === 2 && L2.inside && L2.over.length === 0, 'phone on its side: both cards inside the pane, nothing spills', L2);
  await ph.ctx.close();
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
process.exit(bad ? 1 : 0);
