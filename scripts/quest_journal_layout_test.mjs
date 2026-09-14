// QUEST JOURNAL LAYOUT — the panel fits the screen, and a card says each thing once.
// ============================================================================
// Per user, with a screenshot of the journal: "make this UI more simple to navigate and less
// cluttered". Measured before changing anything, at 1600x900:
//
//   * the panel was 746 CSS px tall inside a 560 CSS px viewport. 150 device px were cut off the
//     TOP - the title and the class/progress chip - and 149 off the bottom. The journal had no
//     height cap at all, which is the same disease panel_vh_audit_test.mjs was written for: `vh`
//     is a PRE-scale unit inside .game-wrapper, so the cap has to be divided by the wrapper's own
//     transform. This suite fails if the cap is dropped or written as a raw vh.
//   * 472 px of chrome before the first card: a 202 px saga block, then TWO full-width tab rows
//     whose counts disagreed ("All 251" sat directly above "Available 251" for different things).
//   * the giver's name was printed twice per card - once in the location row, once as a pill
//     three millimetres below it.
//
// Every check below is one of those, phrased so it fails if the layout regresses rather than if it
// merely changes. Run: node scripts/quest_journal_layout_test.mjs [port]
import { createRequire } from 'node:module';
import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.argv[2] || 9583);
const results = []; const check = (n, c, x) => { results.push({ n, pass: !!c, x }); console.log((c ? 'PASS  ' : 'FAIL  ') + n + (x === undefined ? '' : '  ' + JSON.stringify(x))); };

const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined, headless: true, args: ['--no-sandbox', '--mute-audio'],
});
const errs = [];

async function open(w, h) {
  const page = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
  page.on('pageerror', (e) => errs.push(w + 'x' + h + ': ' + String(e).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => typeof renderQuestJournal === 'function' && typeof toggleQuestJournal === 'function', { timeout: 120000 });
  await page.waitForTimeout(1200);
  // a save with something in every bucket, without playing the prologue
  await page.evaluate(() => {
    window._prologueActive = false; window._prologuePending = false;
    const o = document.getElementById('story-beat-overlay'); if (o) o.classList.remove('on');
    const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade');
    player.level = 99;
    _ensureQuests();
    for (const id in QUESTS) if (!player.quests.completed[id] && !player.quests.active[id]) player.quests.unlocked[id] = true;
    const m = document.getElementById('quest-modal');
    if (m) m.style.display = 'flex';
    renderQuestJournal();
  });
  await page.waitForTimeout(700);
  return page;
}

// ---------------------------------------------------------------- 1. it fits, at any size
for (const [w, h] of [[1600, 900], [1366, 768], [1280, 720]]) {
  const page = await open(w, h);
  const r = await page.evaluate(() => {
    const modal = document.querySelector('#quest-modal > .modal');
    const b = modal.getBoundingClientRect();
    const cards = document.querySelector('.qj-cards');
    return {
      top: Math.round(b.y), bottom: Math.round(b.y + b.height), vh: innerHeight,
      capped: /calc|vh/.test(modal.style.maxHeight || '') || getComputedStyle(modal).maxHeight !== 'none',
      rawVh: /(^|[^/])\b\d+vh/.test((modal.getAttribute('style') || '').replace(/\s/g, '')) &&
             !/\/\s*var\(--game-scale/.test(modal.getAttribute('style') || ''),
      cardsScrolls: cards ? getComputedStyle(cards).overflowY : null,
      cardsH: cards ? Math.round(cards.getBoundingClientRect().height) : 0,
    };
  });
  check(`${w}x${h}: the panel is inside the viewport`, r.top >= -1 && r.bottom <= r.vh + 1,
    { top: r.top, bottom: r.bottom, vh: r.vh });
  check(`${w}x${h}: the height cap divides by the wrapper scale (raw vh would overflow)`, r.capped && !r.rawVh, r);
  check(`${w}x${h}: the card list is the part that scrolls`, r.cardsScrolls === 'auto' && r.cardsH > 120, r);
  await page.context().close();
}

// ---------------------------------------------------------------- 2. one toolbar, counts that agree
const page = await open(1600, 900);
const bar = await page.evaluate(() => {
  const list = document.getElementById('quest-list');
  const bars = [...list.querySelectorAll('.qj-bar')];
  const tabs = [...list.querySelectorAll('[data-qtab]')];
  const chips = [...list.querySelectorAll('[data-qcat]')];
  const num = (el) => { const m = (el.textContent || '').match(/(\d[\d,]*)\s*$/); return m ? +m[1].replace(/,/g, '') : null; };
  const byKey = {}; for (const c of chips) byKey[c.dataset.qcat] = num(c);
  const activeTab = tabs.find((t) => t.classList.contains('active'));
  // "one row" means every control overlaps every other vertically - comparing tops would fail on
  // a chip that is two pixels shorter than a tab while sitting beside it.
  const boxes = [...tabs, ...chips].map((e) => e.getBoundingClientRect());
  const oneRow = boxes.every((a) => boxes.every((b) => a.top < b.bottom - 2 && b.top < a.bottom - 2));
  return {
    bars: bars.length, tabs: tabs.length, chips: chips.length,
    rows: oneRow ? 1 : 2,
    span: Math.round(Math.max(...boxes.map((b) => b.bottom)) - Math.min(...boxes.map((b) => b.top))),
    tabCount: activeTab ? num(activeTab) : null,
    parts: (byKey.story || 0) + (byKey.class || 0) + (byKey.bounty || 0),
    byKey,
  };
});
check('the status tabs and the category chips share ONE row', bar.bars === 1 && bar.rows === 1, bar);
check('three status tabs and four category chips', bar.tabs === 3 && bar.chips === 4, bar);
check('the category counts partition the visible tab (they used to contradict it)',
  bar.tabCount !== null && bar.parts === bar.tabCount, { parts: bar.parts, tab: bar.tabCount, byKey: bar.byKey });

// ---------------------------------------------------------------- 3. the saga strip is one row
const saga = await page.evaluate(() => {
  const el = document.querySelector('.qj-saga');
  if (!el) return null;
  const b = el.getBoundingClientRect();
  const next = el.querySelector('[data-qnext]');
  return {
    h: Math.round(b.h || b.height),
    hasTitle: /Act/.test(el.textContent || ''),
    hasFrag: /\d+\/\d+/.test(el.textContent || ''),
    tip: (el.getAttribute('title') || '').length,
    next: next ? (next.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60) : null,
  };
});
check('the saga strip still names the act and the fragment count', !!saga && saga.hasTitle && saga.hasFrag, saga);
check('it is one row, not the old 202px block', !!saga && saga.h <= 110, saga && { h: saga.h });
check('the act blurb survives as the strip tooltip', !!saga && saga.tip > 40, saga && { tipChars: saga.tip });
check('the next story beat is a control, not a sentence telling you where to look',
  !!saga && !!saga.next && !/see the Story tab/.test(saga.next), saga && { next: saga.next });

// ---------------------------------------------------------------- 4. a card says each thing once
const cards = await page.evaluate(() => {
  const out = { checked: 0, dupes: [], mapHidden: [], heights: [] };
  for (const card of document.querySelectorAll('.qj-card')) {
    const nav = card.querySelector('.qj-nav');
    out.heights.push(Math.round(card.getBoundingClientRect().height));
    if (!nav) continue;
    out.checked++;
    // the giver named in the location row must NOT also be a pill on the same card
    const who = (nav.querySelector('.qj-nav-who b') || {}).textContent || '';
    if (who) {
      for (const p of card.querySelectorAll('.qj-pill.npc')) {
        if ((p.textContent || '').trim() === who.trim()) out.dupes.push(who.trim());
      }
    }
    // the destination must still be READABLE, not ellipsised to nothing
    const map = nav.querySelector('.qj-nav-map');
    if (map) {
      const mb = map.getBoundingClientRect();
      if (mb.width < 30 || map.scrollWidth > map.clientWidth + 2) out.mapHidden.push((map.textContent || '').trim());
    }
  }
  out.heights.sort((a, b) => a - b);
  out.median = out.heights[out.heights.length >> 1] || 0;
  return out;
});
check('location rows render', cards.checked >= 10, { withNav: cards.checked });
check('the giver is named once per card, not twice', cards.dupes.length === 0, cards.dupes.slice(0, 4));
check('the destination map is never squeezed out of its own row', cards.mapHidden.length === 0, cards.mapHidden.slice(0, 4));
check('a card is one glance tall (median <= 130 device px; it was 169)', cards.median > 0 && cards.median <= 130, { median: cards.median });

// ---------------------------------------------------------------- 5. the next-beat button navigates
const jump = await page.evaluate(async () => {
  const btn = document.querySelector('[data-qnext]');
  if (!btn) return { skipped: true };
  const qid = btn.dataset.qnext;
  btn.click();
  await new Promise((r) => setTimeout(r, 250));
  const hit = document.querySelector('#quest-list [data-qaccept="' + qid + '"], #quest-list [data-qabandon="' + qid + '"]');
  return { qid, cat: _questCat, tab: _questTab, found: !!hit };
});
check('the next beat jumps to the Story filter', jump.skipped || jump.cat === 'story', jump);
check('and the card it names is actually in the list', jump.skipped || jump.found, jump);

// ---------------------------------------------------------------- 6. the tabs still work
const tabs = await page.evaluate(async () => {
  // The panel refuses to open on an empty pane (it hops to the next non-empty one), so give the
  // other two buckets something to show before asking whether they render.
  _questCat = 'all';
  const ids = Object.keys(QUESTS).filter((id) => player.quests.unlocked[id]).slice(0, 2);
  if (ids[0]) { acceptQuest(ids[0]); }
  if (ids[1]) { player.quests.unlocked[ids[1]] = false; player.quests.completed[ids[1]] = true; }
  renderQuestJournal();
  await new Promise((r) => setTimeout(r, 200));
  const out = {};
  for (const key of ['available', 'completed', 'active']) {
    const b = document.querySelector('[data-qtab="' + key + '"]');
    if (!b) { out[key] = 'missing'; continue; }
    b.click();
    await new Promise((r) => setTimeout(r, 200));
    out[key] = { on: _questTab, cards: document.querySelectorAll('.qj-card').length,
                 empty: !!document.querySelector('.moji-empty-state') };
  }
  return out;
});
check('every status tab still renders its pane', ['available', 'completed', 'active'].every((k) =>
  tabs[k] !== 'missing' && tabs[k].on === k && (tabs[k].cards > 0 || tabs[k].empty)), tabs);

check('no page errors', errs.length === 0, errs.slice(0, 3));
await browser.close().catch(() => {}); server.kill();
const bad = results.filter((r) => !r.pass);
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' passed');
process.exit(bad.length ? 1 : 0);
