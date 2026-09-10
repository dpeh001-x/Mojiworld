// v0.30.469 — the Sovereign/Amnesiac rumour thread renders, and the retired
// Vesper->crown pointer is gone. Guards a lore edit the way a lore edit can be
// guarded: the strings exist, the options are reachable, and clicking each one
// actually paints text into the dialog box.
//   node scripts/sovereign_amnesiac_lore_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11191);
// MOJI_SERVE_ROOT: grade a tree other than the shared working copy, which parallel sessions
// leave tens of commits behind origin/main. Both the server AND the static read use it, or the
// two halves of this test would be reading two different builds.
const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Lore');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);

const r = await page.evaluate(async () => {
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const out = [];
  const ok = (n, c, extra) => out.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 130) });
  window._prologueActive = false; player.level = 60; player._god = true;
  loadMap('town'); await wait(1200); game.paused = false;

  // open an NPC by role and click the option whose label matches
  // the dialog reveals text progressively, so read only once it stops growing
  const settled = async (ms = 4000) => {
    const el = () => document.getElementById('dialog-text');
    let last = '', stable = 0;
    for (let i = 0; i < ms / 60; i++) {
      const now = (el() || {}).textContent || '';
      if (now === last && now.length) { if (++stable >= 3) break; } else { stable = 0; last = now; }
      await wait(60);
    }
    return (el() || {}).textContent || '';
  };
  const talk = async (role, labelRe) => {
    const npc = (game.npcs || []).find((n) => n.role === role);
    if (!npc) return { err: 'no npc with role ' + role };
    game._amnesiacMenu = null; game._amnesiacStage = 0;
    try { openNPC(npc); } catch (e) { return { err: 'openNPC threw: ' + e.message }; }
    const intro = await settled();
    if (!labelRe) return { intro };
    const btns = [...document.querySelectorAll('#dialog-options button, #dialog-options .dialog-opt, #dialog-box button')];
    const hit = btns.find((b) => labelRe.test((b.textContent || '').trim()));
    if (!hit) return { intro, err: 'no option matching ' + labelRe + ' among: ' + btns.map((b) => (b.textContent || '').trim()).join(' | ').slice(0, 160) };
    hit.click();
    return { intro, said: await settled() };
  };

  // ---- the Amnesiac carries the gesture in his opening ----
  const am = await talk('amnesiac', null);
  ok('Amnesiac dialogue opens', !am.err && am.intro && am.intro.length > 80, am.err || (am.intro || '').slice(0, 60));
  ok('Amnesiac intro paints real prose', (am.intro || '').length > 40, (am.intro || '').length + ' chars');
  try { closeDialog(); } catch (e) {}
  await wait(120);

  // ---- three rumour voices, each reachable and each painting text ----
  const innie = await talk('innkeeper', /Amnesiac/i);
  ok('Innie: rumour option reachable', !innie.err, innie.err);
  ok('Innie: the rumour paints', (innie.said || '').length > 40 && innie.said !== innie.intro, (innie.said || '').slice(0, 50));
  try { closeDialog(); } catch (e) {}
  await wait(120);

  const arlen = await talk('info', /what do people say about the Amnesiac/i);
  ok('Arlen: rumour option reachable', !arlen.err, arlen.err);
  ok('Arlen: the rumour paints', (arlen.said || '').length > 40 && arlen.said !== arlen.intro, (arlen.said || '').slice(0, 50));
  try { closeDialog(); } catch (e) {}
  await wait(120);

  const bravo = await talk('expedition', /thing at the top/i);
  ok('Bravo: rumour option reachable in town', !bravo.err, bravo.err);
  ok('Bravo: the rumour paints', (bravo.said || '').length > 40 && bravo.said !== bravo.intro, (bravo.said || '').slice(0, 50));
  try { closeDialog(); } catch (e) {}

  // ---- nobody states it outright, anywhere in the shipped strings ----
  ok('no NPC line asserts the identity outright',
     !/the Amnesiac is the Sovereign|Sovereign is the Amnesiac/i.test(document.body.innerText || ''));
  return out;
});
await browser.close(); server.kill();

// ---- static: the retired Vesper pointer is gone, the new tell is in ----
const html = fs.readFileSync(path.join(SERVE_ROOT, PAGE), 'utf8');
const stat = [
  ['Sovereign lore drops the sapphire signet', !/A sapphire signet sits on one still hand/.test(html)],
  ['Sovereign lore carries the ring-that-is-not-there', /keeps turning a ring that is not on it/.test(html)],
  ['chapter IV no longer points at the crown', !/If you ever climb somewhere with a crown at the top/.test(html)],
  ['chapter IV keeps Lyra\'s grief and her father', /High Sage Vesper/.test(html) && /read what is written at the bottom of it/.test(html)],
];
// v0.30.541 — the plant is a nine-word beat now ("His thumb turns a ring that is not on it"),
// deliberately echoing the Sovereign's own line above. The old 20-word stage direction went
// with the plain-speech pass; the LINK is what this guards, not the sentence.
stat.push(['Amnesiac turns a ring that is not there', /turns a ring that is not on it/.test(html)]);
stat.push(['Innie contributes the hearsay ("not the hands")', /climbers started it/.test(html) && /not the hands/.test(html)]);
stat.push(['Arlen contributes the date (one man, two places)', /One man, two places, one morning/.test(html)]);
// The two Bravo regexes below had not matched since before v0.30.500: her throne line was
// rewritten and this test was not, and nobody saw it because it graded the stale checkout.
// Re-pointed at the shipped phrasing; the claims ("observation, not conclusion" / "refuses to
// assert") are unchanged. The apostrophe is optional-escaped because the line lives in a
// single-quoted literal and the raw source reads won\'t.
stat.push(['Bravo gives the observation, not the conclusion', /It watches your hands/.test(html) && /trust my own account of it/.test(html)]);
stat.push(['Bravo refuses to assert it', /won\\?'t tell you what is on the throne/.test(html)]);
// Scan PLAYER-FACING text only. The v0.30.469 design note states the canon in
// plain words on purpose - that is what a canon note is for - so a whole-file
// scan would flag the documentation rather than the writing.
stat.push(['no player-facing string states the identity outright', (() => {
  const NEEDLES = ['the amnesiac is the sovereign', 'sovereign is the amnesiac'];
  return html.split('\n').every((L) => {
    const low = L.toLowerCase();
    if (!NEEDLES.some((n) => low.includes(n))) return true;
    return L.trim().startsWith('//');   // stating it in a canon note is the point
  });
})()]);
const doc = fs.readFileSync(path.join(ROOT, 'docs/design/lore_everdawn_cycle.md'), 'utf8');
stat.push(['lore doc records the corrected canon', /## 7\. The Crown and the Door/.test(doc) && /is a \*witness\* to the Spire, not its occupant/.test(doc)]);

let fails = 0;
for (const x of r) { console.log((x.pass ? 'PASS ' : 'FAIL ') + x.n + (x.extra ? '  [' + x.extra + ']' : '')); if (!x.pass) fails++; }
for (const [n, c] of stat) { console.log((c ? 'PASS ' : 'FAIL ') + n); if (!c) fails++; }
const total = r.length + stat.length;
console.log(`${total - fails}/${total} passed`);
process.exit(fails ? 1 : 0);
