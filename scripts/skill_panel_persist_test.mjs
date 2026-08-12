// BUG (tester): "When I open the description and level up a skill, the desc
// window will automatically close."
//
// The expanded state lived only in the DOM, and the rank "+" handler rebuilds
// every card via renderSkillsReference() with display:none hardcoded — so the
// panel was not closing, it was being replaced by a freshly-built closed one.
//
// This DRIVES THE REAL UI: it clicks the expand button, clicks rank-up, and
// checks the panel is still open. Asserting the state object would not catch a
// regression in the emit, which is where the bug actually lived.
//   node scripts/skill_panel_persist_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const net = await import('node:net');
const free = (p) => new Promise((r) => { const s = net.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext()).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof renderSkillsReference === 'function' && typeof player === 'object', { timeout: 120000 });

const r = await page.evaluate(async () => {
  const out = {};
  // Give the player ranks to spend and render the panel into a detached host.
  player.skillRankPoints = 20;
  player.skillRanks = player.skillRanks || {};
  const host = document.createElement('div');
  host.style.cssText = 'height:400px; overflow:auto;';
  document.body.appendChild(host);
  renderSkillsReference(host);

  const expandBtns = [...host.querySelectorAll('button[data-expandid]')];
  out.expandCount = expandBtns.length;
  // Pick an expand button whose card also has a spendable rank "+".
  let target = null;
  for (const eb of expandBtns) {
    const card = eb.closest('div');
    const holder = eb.parentElement && eb.parentElement.parentElement;
    const rankBtn = holder ? holder.querySelector('button[data-rankid]') : null;
    if (rankBtn && !rankBtn.disabled) { target = { eb, rankBtn }; break; }
  }
  if (!target) {
    // fall back: any expand + any rank button in the host
    const rb = host.querySelector('button[data-rankid]');
    if (expandBtns[0] && rb) target = { eb: expandBtns[0], rankBtn: rb };
  }
  if (!target) { out.noTarget = true; return out; }

  const id = target.eb.dataset.expandid;
  out.id = id;
  const panelOf = () => host.querySelector('#' + CSS.escape(id));

  out.beforeOpen = panelOf() ? panelOf().style.display : null;
  target.eb.click();
  out.afterOpen = panelOf() ? panelOf().style.display : null;
  out.glyphAfterOpen = target.eb.textContent.trim();

  // Now spend a rank — the action that used to wipe it.
  const rankId = target.rankBtn.dataset.rankid;
  out.rankBefore = (player.skillRanks[rankId] | 0);
  host.scrollTop = 120;
  out.scrollBefore = host.scrollTop;
  target.rankBtn.click();
  out.rankAfter = (player.skillRanks[rankId] | 0);

  // After the rebuild the node is NEW — re-query, do not reuse the old handle.
  const after = panelOf();
  out.afterRank = after ? after.style.display : null;
  const newBtn = host.querySelector(`button[data-expandid="${id}"]`);
  out.glyphAfterRank = newBtn ? newBtn.textContent.trim() : null;
  out.scrollAfter = host.scrollTop;

  // Closing must still work, and must persist as CLOSED.
  if (newBtn) newBtn.click();
  out.afterClose = panelOf() ? panelOf().style.display : null;
  const rb2 = host.querySelector(`button[data-rankid="${rankId}"]`);
  if (rb2) rb2.click();
  out.afterCloseThenRank = panelOf() ? panelOf().style.display : null;

  host.remove();
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

console.log(JSON.stringify(r, null, 1).slice(0, 700));
ok('the panel starts closed', r.beforeOpen === 'none', { beforeOpen: r.beforeOpen });
ok('clicking + opens it', r.afterOpen === 'block', { afterOpen: r.afterOpen });
ok('the toggle glyph flips to −', r.glyphAfterOpen === '−', { glyph: r.glyphAfterOpen });
ok('spending a rank actually spent one', r.rankAfter === r.rankBefore + 1, { before: r.rankBefore, after: r.rankAfter });
ok('THE BUG: the panel is STILL OPEN after levelling the skill', r.afterRank === 'block', { afterRank: r.afterRank });
ok('the rebuilt toggle still shows − (not a + that needs two clicks)', r.glyphAfterRank === '−', { glyph: r.glyphAfterRank });
ok('scroll position survives the rebuild', Math.abs((r.scrollAfter | 0) - (r.scrollBefore | 0)) <= 2, { before: r.scrollBefore, after: r.scrollAfter });
ok('closing still works', r.afterClose === 'none', { afterClose: r.afterClose });
ok('a CLOSED panel stays closed across a rank-up (state is not just "always open")',
   r.afterCloseThenRank === 'none', { afterCloseThenRank: r.afterCloseThenRank });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
