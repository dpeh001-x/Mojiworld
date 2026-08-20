// SKILL-BAR ICON SWAP — no-partial-swap guard.
// ============================================================================
// Reported: "on startup the icons keep changing" (screenshot taken at
// "Loading sprites 2544/2731 · 93%", mid-swap).
//
// Cause: each skill icon probes its own sprite and flips from emoji to art the
// instant THAT ONE decodes. During the 2700-sprite startup load the nine
// skill-bar probes resolve seconds apart, so the bar visibly reshuffles one
// glyph at a time while the player is already in the world.
//
// The property that matters is not "icons eventually show art" — the old build
// did that too. It is that the bar is never caught HALF swapped: at any moment
// every kit slot should be showing emoji, or every kit slot should be showing
// art, never a mix. This drives the real _skillIconStatus map into the exact
// mixed state that startup produces, then re-renders and inspects the DOM.
// Run: node scripts/skill_icon_swap_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9325;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`,
  { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'IconTest');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*mage\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);

const R = await page.evaluate(async () => {
  player.level = 99; player.job = 'warlock'; player.master = 'necromancer';
  renderSkillBar();
  await new Promise(r => setTimeout(r, 300));

  // Which slots does this kit actually fill?
  const kitIds = [];
  for (const k of Object.keys(_sbSlots)) {
    const s = _sbSlots[k];
    if (s && s.skillId) kitIds.push(s.skillId);
  }
  // Snapshot how each kit slot is currently presenting.
  const shape = () => {
    const out = { art: 0, emoji: 0, ids: [] };
    for (const k of Object.keys(_sbSlots)) {
      const s = _sbSlots[k];
      if (!s || !s.skillId) continue;
      const el = s.iconEl;
      const hasArt = !!(el && el.dataset && el.dataset.skIco);
      out[hasArt ? 'art' : 'emoji']++;
      out.ids.push((hasArt ? '+' : '-') + s.skillId);
    }
    return out;
  };

  // ---- Drive the exact startup condition: SOME probes done, others not -----
  // Reset the latch and the status map, then mark half the kit resolved.
  try { _lxSkillIconGate = false; _lxSkillIconGateT0 = 0; } catch (e) {}
  for (const k of Object.keys(_skillIconStatus)) delete _skillIconStatus[k];
  for (const el of document.querySelectorAll('.skill-icon')) {
    el.style.backgroundImage = 'none'; delete el.dataset.skIco;
  }
  const half = Math.max(1, Math.floor(kitIds.length / 2));
  kitIds.forEach((id, i) => { _skillIconStatus[id] = (i < half) ? 'ok' : 'pending'; });
  renderSkillBar();
  await new Promise(r => setTimeout(r, 120));
  const mixed = shape();

  // ---- Now let the rest settle: the whole bar should swap together ---------
  for (const id of kitIds) if (_skillIconStatus[id] === 'pending') _skillIconStatus[id] = 'ok';
  renderSkillBar();
  await new Promise(r => setTimeout(r, 120));
  const settled = shape();

  // ---- A later request must not send resolved icons back to emoji ---------
  _skillIconStatus['__a_brand_new_id__'] = 'pending';
  renderSkillBar();
  await new Promise(r => setTimeout(r, 120));
  const afterLate = shape();

  return {
    kitCount: kitIds.length, mixed, settled, afterLate,
    hasGate: typeof _lxSkillIconGateOpen === 'function',
  };
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 125) });

ok('kit filled several skill slots', R.kitCount >= 4, `slots=${R.kitCount}`);
// THE bug: half the probes resolved -> half the bar showing art, half emoji.
ok('bar is never caught half-swapped while probes are still pending',
   R.mixed.art === 0 || R.mixed.emoji === 0,
   `art=${R.mixed.art} emoji=${R.mixed.emoji}  ${R.mixed.ids.join(' ')}`);
ok('once every probe settles, the whole bar shows art',
   R.settled.emoji === 0 && R.settled.art === R.kitCount,
   `art=${R.settled.art} emoji=${R.settled.emoji}`);
ok('a later pending probe does not revert resolved icons to emoji',
   R.afterLate.emoji === 0 && R.afterLate.art === R.kitCount,
   `art=${R.afterLate.art} emoji=${R.afterLate.emoji}`);
ok('batch gate exists and is reachable', R.hasGate);

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
