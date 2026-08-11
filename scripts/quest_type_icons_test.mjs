// Quest-type icons: every quest classifies, the art renders in real cards at a
// real size, each type is actually reachable, and the emoji fallback works.
// Opens the journal with the Q key — a direct renderQuestJournal() call has
// already, once in this feature, stayed green against a build that had lost
// the code entirely.
// Run: node scripts/quest_type_icons_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = 'file:///' + path.join(ROOT, process.argv[2] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof _questTypeOf === 'function' && typeof QUESTS !== 'undefined', { timeout: 60000 });
await page.evaluate(() => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const card = document.querySelector('#class-select-modal .cls-card');
  if (card && !player.cls) { try { card.click(); } catch (e) {} }
  const gate = document.getElementById('class-select-modal'); if (gate) gate.style.display = 'none';
  game.paused = false; player.level = 40;
  if (typeof tickQuestUnlocks === 'function') tickQuestUnlocks();
});
await page.waitForTimeout(3000);

// ---- classification covers everything, and every type is reachable --------
const cls = await page.evaluate(() => {
  const TYPES = ['hunt', 'boss', 'talk', 'explore', 'bounty'];
  const dist = {}, bad = [];
  let total = 0;
  for (const id in QUESTS) {
    total++;
    const t = _questTypeOf(id);
    dist[t] = (dist[t] || 0) + 1;
    if (!TYPES.includes(t)) bad.push(`${id} -> ${t}`);
  }
  // spot-check the precedence rule: a story quest flagged bossFight is a BOSS
  const bossStory = Object.keys(QUESTS).find((k) => QUESTS[k].story && QUESTS[k].bossFight);
  return { total, dist, bad, bossStory, bossStoryType: bossStory ? _questTypeOf(bossStory) : null, TYPES };
});
console.log(`classified ${cls.total}: ${JSON.stringify(cls.dist)}`);
check(cls.bad.length === 0, 'every quest maps to a known type', cls.bad);
check(Object.keys(cls.dist).length === 5, 'all five types are actually used', cls.dist);
for (const t of cls.TYPES) check((cls.dist[t] || 0) > 0, `type "${t}" is reachable`, cls.dist[t] || 0);
check(cls.bossStoryType === 'boss', 'a story quest flagged bossFight classifies as boss (precedence)', cls);

// ---- the art renders in real cards ---------------------------------------
await page.keyboard.press('q');
await page.waitForTimeout(900);
const dom = await page.evaluate(async () => {
  const list = document.getElementById('quest-list');
  const arts = [...list.querySelectorAll('.qj-ico-art')];
  const cards = list.querySelectorAll('.qj-card').length;
  await Promise.all(arts.slice(0, 40).map((i) => i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; })));
  const sample = arts[0];
  const rc = sample ? sample.getBoundingClientRect() : null;
  // Measure against the TILE, not against absolute pixels: the journal sits
  // inside the fullscreen-fit transform, so a 30px rule measures 40px at this
  // viewport. An absolute band would encode the window size, not the design.
  const tileRc = sample ? sample.parentNode.getBoundingClientRect() : null;
  const loaded = arts.filter((i) => i.complete && i.naturalWidth > 0).length;
  const types = {};
  for (const i of arts) types[i.dataset.qtype] = (types[i.dataset.qtype] || 0) + 1;
  return {
    cards, arts: arts.length, loaded,
    box: rc ? [Math.round(rc.width), Math.round(rc.height)] : null,
    tile: tileRc ? [Math.round(tileRc.width), Math.round(tileRc.height)] : null,
    ratio: (rc && tileRc && tileRc.width) ? +(rc.width / tileRc.width).toFixed(2) : null,
    types,
    fallbackHidden: sample ? getComputedStyle(sample.parentNode.querySelector('.qj-ico-fb')).display : null,
  };
});
console.log(`cards ${dom.cards} | art tiles ${dom.arts} | loaded ${dom.loaded} | box ${JSON.stringify(dom.box)} | ${JSON.stringify(dom.types)}`);
check(dom.cards >= 10, 'the panel rendered a meaningful set of cards', dom.cards);
check(dom.arts === dom.cards, 'every card has an art tile', { arts: dom.arts, cards: dom.cards });
check(dom.loaded === dom.arts, 'every art tile actually loaded (no 404s)', { loaded: dom.loaded, of: dom.arts });
check(!!dom.ratio && dom.ratio > 0.5 && dom.ratio < 1.0, 'art fits inside its tile (measured as a ratio, not raw px)', { box: dom.box, tile: dom.tile, ratio: dom.ratio });
check(Object.keys(dom.types).length >= 2, 'more than one type is visible in the list', dom.types);
check(dom.fallbackHidden === 'none', 'the emoji fallback stays hidden while art loads', dom.fallbackHidden);

// ---- fallback: a broken src must show the emoji, not a broken image -------
const fb = await page.evaluate(() => {
  const img = document.querySelector('#quest-list .qj-ico-art');
  const fbEl = img.parentNode.querySelector('.qj-ico-fb');
  const emoji = fbEl.textContent;
  // addEventListener, NOT img.onerror = — the fallback IS an inline onerror
  // attribute, and assigning the property overwrites it. The first run of this
  // check did exactly that and then reported the fallback as broken: the test
  // had removed the mechanism it was testing.
  return new Promise((r) => {
    img.addEventListener('error', () => setTimeout(() => r({
      imgHidden: getComputedStyle(img).display,
      fbShown: getComputedStyle(fbEl).display,
      emoji,
    }), 60));
    setTimeout(() => r({ timedOut: true }), 3000);
    img.src = 'Sprites/ui/quest/__does_not_exist__.webp';
  });
});
if (fb.timedOut) check(false, 'the broken-image path fired', fb);
else {
  console.log(`fallback: img ${fb.imgHidden}, emoji "${fb.emoji}" ${fb.fbShown}`);
  check(fb.imgHidden === 'none', 'a failed image hides itself', fb);
  check(fb.fbShown !== 'none', 'and the quest emoji takes over', fb);
}

check(errs.length === 0, 'no page errors', errs);
console.log(bad ? `\n${bad} FAILED` : '\nall green');
await browser.close();
process.exit(bad ? 1 : 0);
