// BOOT TIPS MUST BE TRUE.
// =============================================================================
// Per user: "ensure that the tips are accurate - talking about boons, mojimon,
// and upgrading of equipments briefly". The strip they saw claimed "Tab + click
// for taxi" — there is no 'tab' handler anywhere in the game — and taught "J for
// quests", a legacy alias, after v0.29.387 moved the Journal to Q. A tip is UI
// copy that ages badly: the binding moves, the tip does not. These checks read
// the LIVE bindings and fail the build if a tip drifts from them again.
// Run: node scripts/boot_tips_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9203;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`,
  { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
const res = [];
const ok = (n, c, x) => res.push({ n, pass: !!c, x: String(x ?? '') });

const d = await page.evaluate(() => {
  const tips = (typeof LX_BOOT_TIPS !== 'undefined') ? LX_BOOT_TIPS : null;
  const all = (tips || []).join(' ');
  const keysIn = (s) => [...s.matchAll(/class="kbd">([^<]+)</g)].map(m => m[1].trim());
  return {
    tips, all, keys: keysIn(all),
    bind: {
      worldMap: ACTION_KEY_DEFAULT.worldMap,
      questJournal: ACTION_KEY_DEFAULT.questJournal,
      attributesU: ACTION_KEY_DEFAULT.attributesU,
      characterK: ACTION_KEY_DEFAULT.characterK,
      mojidex: ACTION_KEY_DEFAULT.mojidex,
    },
    // does a 'tab' handler exist anywhere in the keydown path? (the old lie)
    tabHandled: /k === 'tab'|_isAction\(k, *'[a-z]+'\)[^\n]*tab/.test(String(window.onkeydown || '')),
    hasSummonH: typeof _mojimonQuickSummon === 'function',
    tipEl: !!document.getElementById('lo-tip'),
  };
});

ok('a tips table exists (not one hardcoded line)', Array.isArray(d.tips) && d.tips.length >= 4, (d.tips || []).length + ' tips');
ok('the tip element is present for rotation', d.tipEl);

// ── every claimed key matches the live binding ──
const claim = (label, key, bound) => ok(`"${label}" matches the live binding`, key.toLowerCase() === String(bound).toLowerCase(), `tip says ${key}, bound is ${bound}`);
if (/class="kbd">W</.test(d.all)) claim('W world map', 'w', d.bind.worldMap);
if (/class="kbd">Q</.test(d.all)) claim('Q quests', 'q', d.bind.questJournal);
if (/class="kbd">U</.test(d.all)) claim('U panel', 'u', d.bind.attributesU);
if (/class="kbd">K</.test(d.all)) claim('K keybinds', 'k', d.bind.characterK);

// ── the two specific lies must never come back ──
ok('no tip claims Tab does anything', !/>Tab</.test(d.all), d.all.match(/>Tab</) ? 'Tab claim present' : 'clean');
ok('quests are taught as Q, not the legacy J alias', !/class="kbd">J</.test(d.all));

// ── the three requested topics are covered ──
ok('a tip covers BOONS', /boon/i.test(d.all));
ok('a tip covers MOJIMON', /mojimon/i.test(d.all));
ok('a tip covers UPGRADING EQUIPMENT', /(enhance|upgrade)/i.test(d.all) && /gear|equip/i.test(d.all));

// ── the mechanics each tip asserts are real ──
ok('H really summons a MojiMon', d.hasSummonH);
const mechanics = await page.evaluate(() => {
  // the U panel builds its tabs lazily — open it before asserting they exist
  try { player.cls = player.cls || 'warrior'; if (typeof openAttributes === 'function') openAttributes();
        else window.dispatchEvent(new KeyboardEvent('keydown',{key:'u'})); } catch (e) {}
  return ({
  // The U panel builds its tab strip from a template literal at render time,
  // so query the RENDERER SOURCE rather than the DOM — that proves the tab
  // ships without having to satisfy the panel's open preconditions.
  boonsTab: /data-utab="boons"/.test(String(window.openAttributes || '') + String(window._uRenderTabs || '') + document.documentElement.innerHTML),
  mojimonTab: /data-utab="mojimon"/.test(String(window.openAttributes || '') + String(window._uRenderTabs || '') + document.documentElement.innerHTML),
  enhanceFn: typeof openEnhancementModal === 'function',
  taxiBtn: !!document.getElementById('taxi-btn'),
});});
ok('U panel really has a Boons tab', mechanics.boonsTab);
ok('U panel really has a MojiMon tab', mechanics.mojimonTab);
ok('the smith enhance flow really exists', mechanics.enhanceFn);
ok('the Taxi HUD button really exists (what replaced the Tab claim)', mechanics.taxiBtn);

let pass = 0, failed = 0;
for (const r of res) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}${r.x ? '  (' + r.x + ')' : ''}`); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.x}`); } }
console.log(`${pass} passed, ${failed} failed`);
await browser.close(); server.kill();
process.exit(failed ? 1 : 0);
