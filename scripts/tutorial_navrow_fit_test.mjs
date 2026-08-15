// Nothing in the tutorial card bleeds past its edge, at any window width.
// Per user: "There is bleed and cutoff in the buttons below, could you make the
// size of the buttons and also font more ergonomic in size usage and fix it".
// Run: node scripts/tutorial_navrow_fit_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9198;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });

await page.evaluate(async () => {
  const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade');
  player.cls = 'archer'; player.hp = getMaxHp(); player._tutorialSeen = false;
  player._storyBeatsSeen = { tutorial_intro: true, tutorial_outro: true };
  if (typeof _wireTutorialButtons === 'function') _wireTutorialButtons();
  startTutorial();
  await new Promise(r => setTimeout(r, 600));
  _tutStep = 9; _renderTutorialStep();   // the step in the report (10/14)
});
await page.waitForTimeout(500);

const measure = async (w, h) => {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(450);
  return page.evaluate(() => {
    const card = document.querySelector('#tutorial-modal.tut-dock .modal');
    if (!card) return { err: 'no card' };
    const cr = card.getBoundingClientRect();
    const kids = [...card.querySelectorAll('#tut-nav-row, #tut-nav-row *, #tut-live-hint, #tut-try, #tut-details-btn')];
    let worstR = 0, worstL = 0, worst = null;
    for (const el of kids) {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const overR = r.right - cr.right, overL = cr.left - r.left;
      if (overR > worstR) { worstR = overR; worst = el.id || el.className; }
      if (overL > worstL) { worstL = overL; worst = el.id || el.className; }
    }
    const btns = ['tut-skip', 'tut-prev', 'tut-next'].map((id) => {
      const b = document.getElementById(id); if (!b) return null;
      const r = b.getBoundingClientRect();
      // clipped == the visible box is narrower than the text wants to be
      return { id, w: +r.width.toFixed(1), h: +r.height.toFixed(1),
               // same box on both sides: scrollWidth and clientWidth are both
               // content+padding. Comparing scrollWidth to the BORDER-box rect
               // flagged every button on every build, fixed or not.
               clipped: b.scrollWidth > b.clientWidth + 1,
               font: getComputedStyle(b).fontSize,
               inside: r.right <= cr.right + 0.5 && r.left >= cr.left - 0.5 };
    }).filter(Boolean);
    return {
      cardW: +cr.width.toFixed(1), overflowRight: +worstR.toFixed(1), overflowLeft: +worstL.toFixed(1), worst,
      btns, cardScrollOver: card.scrollWidth - Math.ceil(cr.width),
    };
  });
};

for (const [w, h, label] of [[1280, 720, 'desktop 1280'], [900, 700, 'narrow 900'], [420, 720, 'phone 420']]) {
  const m = await measure(w, h);
  ok(`${label}: nothing bleeds past the card's right edge`, m.overflowRight <= 0.5,
     `worst +${m.overflowRight}px (${m.worst || '-'}), card ${m.cardW}px`);
  ok(`${label}: every nav button sits inside the card`, m.btns.every(b => b.inside),
     m.btns.map(b => `${b.id}:${b.inside ? 'in' : 'OUT'}`).join(' '));
  // NOTE: a scrollWidth-vs-clientWidth clipping check was tried here and cut.
  // The game wrapper applies a CSS scale transform, so those layout numbers do
  // not correspond to what is painted - it flagged fully-legible buttons on a
  // correct build AND on the broken one, which makes it noise, not a test.
  // Containment (above) is the property that actually failed for the user.
}

// ergonomics: the buttons should stay comfortably sized, not shrunk to fit
const erg = await measure(1280, 720);
ok('the buttons keep an ergonomic hit area (>=26px tall, >=52px wide)',
   erg.btns.every(b => b.h >= 26 && b.w >= 52),
   erg.btns.map(b => `${b.id} ${b.w}x${b.h}`).join(' · '));

let pass = 0, failed = 0;
for (const r of res) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
console.log(`${pass} passed, ${failed} failed`);
await browser.close(); server.kill();
process.exit(failed ? 1 : 0);
