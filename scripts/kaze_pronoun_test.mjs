// MASTER KAZE — she/her.
// ============================================================================
// Per user: "master kaze is a girl change the pronouns to she".
//
// Opens her real dialogue through the live NPC handler and reads the rendered
// text, rather than grepping the source — the string is assembled at runtime
// and a source match would not prove the player ever sees it.
//
// The interesting half is the collateral: three nearby "he"s must SURVIVE,
// because they refer to other characters. A blanket he->she sweep over Kaze's
// block or her bounty entries would silently misgender Taiga, Aetherion and
// Gravitos, and would pass any test that only checked Kaze's own line.
// Run: node scripts/kaze_pronoun_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9393;
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
await page.fill('#hero-name-input', 'KazeTest');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*rogue\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);

const R = await page.evaluate(async () => {
  player.level = 99;
  // Open Kaze's dialogue through the real NPC path.
  // #dialog-text renders with a typewriter, so a fixed sleep reads a partial
  // string. Poll until it stops growing.
  const settled = async () => {
    let last = '', stable = 0;
    for (let i = 0; i < 200; i++) {
      await new Promise(r => setTimeout(r, 50));
      const t = (document.getElementById('dialog-text') || {}).textContent || '';
      if (t === last && t.length) { if (++stable >= 4) return t; } else { stable = 0; last = t; }
    }
    return last;
  };
  openNPC({ role: 'kaze', name: 'Master Kaze' });
  const intro = await settled();

  // Walk every reply option and collect what it renders.
  const replies = [];
  const btns = [...document.querySelectorAll('#dialog button')];
  for (const b of btns) {
    const label = (b.textContent || '').trim();
    if (/^leave$/i.test(label)) continue;
    b.click();
    const rt = await settled();
    replies.push({ label, text: rt });
    openNPC({ role: 'kaze', name: 'Master Kaze' });
    await settled();
  }

  // The bounty flavour entries Kaze hands out — these describe the TARGET.
  const bounty = {};
  try {
    for (const k of ['aetherion', 'gravitos']) {
      const e = (typeof BOUNTY_FLAVOR !== 'undefined' && BOUNTY_FLAVOR[k])
        || (typeof _BOUNTIES !== 'undefined' && _BOUNTIES[k]) || null;
      if (e) bounty[k] = e.flavor || '';
    }
  } catch (e) {}
  return { intro, replies, bounty };
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 140) });
const stage = R.intro.split('\n')[0] || R.intro;                 // the *stage direction* line
const taigaReply = (R.replies.find(r => /ascendant training/i.test(r.label)) || {}).text || '';

ok('Kaze dialogue actually opened', /I am Kaze/i.test(R.intro), R.intro.slice(0, 60));
// The reported line.
ok('her stage direction uses "She"', /\bShe speaks without opening them\b/.test(stage), stage);
ok('no "He" left in her stage direction', !/\bHe\b/.test(stage), stage);
// Collateral: these must NOT have been swept.
ok('Taiga is still "he" in her reply', /\bhe holds the formal seal\b/.test(taigaReply),
   taigaReply.slice(0, 90) || '(reply not captured)');
ok('no reply of hers misgenders anyone as "she" wrongly',
   !/\bshe holds the formal seal\b/i.test(taigaReply), taigaReply.slice(0, 90));
for (const [k, v] of Object.entries(R.bounty)) {
  ok(`${k} bounty flavour still says "He"`, /\bHe\b/.test(v), v.slice(0, 80));
}

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
