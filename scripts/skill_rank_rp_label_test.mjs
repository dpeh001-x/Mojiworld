// SKILL-RANK CURRENCY LABEL — regression guard.
// ============================================================================
// Reported as "even while I am at level 5 and have fireball with 2 SP, the
// game does not let me use the skill". Casting was never broken; the skills
// modal was. The rank "+" spends player.skillRankPoints (RP), but the expanded
// LEVEL-UP PERKS panel advertised "Cost: 1 SP per rank" — so a player holding
// SP with 0 RP was told they could afford a rank, found the "+" greyed out,
// and read that as the skill being unusable. Everything else in the modal
// already said RP ("Rank Points (RP)" badge, "spends 1 RP", "Reset RP").
//
// Asserts, against the LIVE rendered modal (not the source text):
//   1. the rank cost line names RP, and never says "SP per rank"
//   2. a disabled "+" carries a title explaining the empty pool, naming RP
//   3. the "+" still works when RP is available (the fix is cosmetic only)
// Run: node scripts/skill_rank_rp_label_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9288;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`,
  { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);

// Reach real gameplay through the actual character-create wizard: the rank
// modal reads player.cls, so a never-started game would measure nothing.
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'RPTest');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*(\u{1F9D9}|\u{1F52E})?\s*mage\s*$/iu.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(3000);

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 150) });

const started = await page.evaluate(() => ({ paused: game.paused, cls: player.cls }));
ok('reached gameplay as a mage', started.cls === 'mage' && !started.paused, JSON.stringify(started));

// --- the reported state: level 5, holding SP, out of RP ---------------------
const dry = await page.evaluate(() => {
  player.level = 5;
  player.skillPoints = 2;        // what the HUD calls "SP"
  player.skillRankPoints = 0;    // the pool the "+" actually spends
  const host = document.createElement('div');
  document.body.appendChild(host);
  renderSkillsReference(host);
  let card = null;
  for (const c of host.querySelectorAll('.skl-tile'))
    if (/fireball/i.test(c.innerHTML)) { card = c; break; }
  const btn = host.querySelector('button[data-rankid="fireball"]');
  const out = {
    cardText: card ? (card.textContent || '').replace(/\s+/g, ' ') : null,
    btnDisabled: btn ? !!btn.disabled : null,
    btnTitle: btn ? (btn.getAttribute('title') || '') : null,
    castable: isReady('fireball'),
  };
  host.remove();
  return out;
});

ok('fireball card renders', !!dry.cardText);
// The premise of the whole report: casting was fine all along.
ok('fireball IS castable at Lv5 (cast path never broke)', dry.castable === true);
ok('"+" is disabled with 0 RP', dry.btnDisabled === true);
ok('rank cost line names RP', /1 RP per rank/.test(dry.cardText || ''),
   (dry.cardText || '').slice(0, 0));
ok('rank cost line never says "SP per rank"', !/SP per rank/.test(dry.cardText || ''),
   (dry.cardText || '').match(/Cost:[^·]*/)?.[0]);
ok('disabled "+" explains itself', !!dry.btnTitle && dry.btnTitle.length > 10, dry.btnTitle);
ok('disabled "+" title names RP', /\bRP\b/.test(dry.btnTitle || ''), dry.btnTitle);

// --- and the button still works when RP exists ------------------------------
const wet = await page.evaluate(() => {
  player.skillRankPoints = 2;
  const host = document.createElement('div');
  document.body.appendChild(host);
  renderSkillsReference(host);
  const btn = host.querySelector('button[data-rankid="fireball"]');
  const before = (player.skillRanks && player.skillRanks.fireball) | 0;
  const disabled = btn ? !!btn.disabled : null;
  const title = btn ? (btn.getAttribute('title') || '') : '';
  if (btn && !btn.disabled) btn.click();
  const after = (player.skillRanks && player.skillRanks.fireball) | 0;
  host.remove();
  return { disabled, before, after, pool: player.skillRankPoints | 0, title };
});
ok('"+" enabled when RP available', wet.disabled === false, JSON.stringify(wet));
ok('"+" spends RP and adds a rank', wet.after === wet.before + 1 && wet.pool === 1, JSON.stringify(wet));
ok('enabled "+" title mentions RP too', /\bRP\b/.test(wet.title || ''), wet.title);

await browser.close(); server.kill();

let bad = 0;
for (const r of res) {
  if (!r.pass) bad++;
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`);
}
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
