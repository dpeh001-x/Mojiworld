// tools/skill_tuner.html edits the numbers a skill deals damage with, and measures what they deal.
//   MOJI_GAME_FILE=<build> [TAB_JSON=docs/reports/skill_tabulation.json] node scripts/skill_tuner_test.mjs
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 11201);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1800));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
let pass = 0, fail = 0;
const check = (ok, msg, detail) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (detail ? '  [' + detail + ']' : '')); ok ? pass++ : fail++; };
try {
  await page.goto(`http://localhost:${PORT}/tools/skill_tuner.html`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.lxTuner && window.lxTuner.scan, null, { timeout: 120000 });
  const stats = await page.evaluate(() => lxTuner.scan.stats);
  check(stats.skills >= 70 && stats.lines >= 100, 'the page scanned the served game', `${stats.skills} skills, ${stats.lines} damage lines`);

  // 1. the boxed value IS the literal in the source
  const lit = await page.evaluate(() => (lxTuner.src.match(/const LX_KAGE_DMG = (\d+(?:\.\d+)?);/) || [])[1]);
  const sel = 'input[data-id="shinobi_seal"][data-line^="const LX_KAGE_DMG = "]';
  const shown = await page.$eval(sel, (el) => el.value).catch(() => null);
  check(lit != null && shown === lit, "Kage Rush's LX_KAGE_DMG box shows the number on its line", `source ${lit}, box ${shown}`);

  // 2. editing the box yields a count-gated line edit, and applying it rewrites only that number
  await page.fill(sel, '7.5'); await page.dispatchEvent(sel, 'input');
  const p = await page.evaluate(() => lxTuner.buildPatch());
  const le = p.shinobi_seal && p.shinobi_seal.lines && p.shinobi_seal.lines[0];
  check(!!le && le.anchor === `const LX_KAGE_DMG = ${lit};` && le.new === 'const LX_KAGE_DMG = 7.5;' && le.count === 1, 'the patch carries the whole line as anchor and the same line with the new number', le ? `${le.anchor} -> ${le.new} x${le.count}` : 'no line edit');
  const ap = await page.evaluate((lit) => { const out = lxTuner.applyPatch(lxTuner.src, lxTuner.buildPatch()); return { n: out.split('const LX_KAGE_DMG = 7.5;').length - 1, old: out.split('const LX_KAGE_DMG = ' + lit + ';').length - 1, dl: out.length - lxTuner.src.length }; }, lit);
  check(ap.n === 1 && ap.old === 0 && Math.abs(ap.dl) <= 4, 'applying the patch changes exactly that line', `new line x${ap.n}, old x${ap.old}, length delta ${ap.dl}`);
  const tamper = await page.evaluate(() => { const p = lxTuner.buildPatch(); p.shinobi_seal.lines[0].count = 2; try { lxTuner.applyPatch(lxTuner.src, p); return 'applied'; } catch (e) { return e.message; } });
  check(/found 1/.test(tamper), 'a wrong anchor count aborts instead of guessing', tamper.slice(0, 70));

  // 3. cooldown edits ride the same patch (v1 field) and land on the SKILLS row
  const cdSel = 'input[data-id="shinobi_seal"][data-f="cd"]';
  await page.fill(cdSel, '16'); await page.dispatchEvent(cdSel, 'input');
  const cd = await page.evaluate(() => { const p = lxTuner.buildPatch(); const out = lxTuner.applyPatch(lxTuner.src, p); const row = out.match(/^\s{2}shinobi_seal\s*:\s*\{[^\n]*$/m)[0]; return { cd: p.shinobi_seal.cd, row: /\bcd:\s*16000\b/.test(row) }; });
  check(cd.cd === 16000 && cd.row, 'a cooldown edit becomes cd in ms on the SKILLS row', JSON.stringify(cd));

  // 4. the two global multipliers are on the page as editable numbers
  const g = await page.evaluate(() => [...document.querySelectorAll('input[data-id="_global"]')].map((el) => el.dataset.line.slice(0, 32) + ' = ' + el.value));
  const gSrc = await page.evaluate(() => [/GLOBAL_SKILL_DMG_MUL\s*=\s*(\d+(?:\.\d+)?)/, /GLOBAL_ULT_DMG_MUL\s*=\s*(\d+(?:\.\d+)?)/].map((re) => (lxTuner.src.match(re) || [])[1]));
  check(g.length === 2 && g[0].endsWith('= ' + gSrc[0]) && g[1].endsWith('= ' + gSrc[1]), 'GLOBAL_SKILL_DMG_MUL and GLOBAL_ULT_DMG_MUL are shown, not hidden', g.join(' | '));

  // 5. reset clears everything
  await page.click('#reset');
  check(Object.keys(await page.evaluate(() => lxTuner.buildPatch())).length === 0, 'Reset empties the patch');

  // 5b. the other variables: a count edit (Skyfall Dominion's nine lances -> seven) rides the same patch and lands on its loop line
  const cntSel = 'input[data-id="dragoon_ult"].count';
  const cnt = await page.$eval(cntSel, (el) => ({ v: el.value, line: el.dataset.line })).catch(() => null);
  if (cnt) {
    await page.fill(cntSel, String(+cnt.v - 2)); await page.dispatchEvent(cntSel, 'input');
    const r = await page.evaluate(() => { const p = lxTuner.buildPatch(); const e = p.dragoon_ult && p.dragoon_ult.lines[0]; const out = lxTuner.applyPatch(lxTuner.src, p); return { anchor: e && e.anchor, nw: e && e.new, n: e ? out.split(e.new).length - 1 : 0 }; });
    check(r.anchor === cnt.line && r.n === 1 && /< 7;/.test(r.nw || ''), 'a count edit (lances 9 -> 7) rewrites exactly its loop line', `${(r.anchor || '').slice(0, 40)} -> ${(r.nw || '').slice(0, 40)}`);
    await page.click('#reset');
  } else check(false, 'Skyfall Dominion shows an editable lance count');
  const kindsShown = await page.evaluate(() => [...new Set([...document.querySelectorAll('.line input')].map((el) => el.className.split(' ')[0]))].sort());
  check(['count', 'flat', 'mul', 'radius', 'time'].every((k) => kindsShown.includes(k)), 'multipliers, flats, counts, reaches and durations are all on the page', kindsShown.join(' '));

  // 6. Measure: the edited build boots in the frame and Kage Rush reads its measured %basic
  await page.fill('#q', 'kage rush'); await page.dispatchEvent('#q', 'input');
  const vis = await page.evaluate(() => document.querySelectorAll('tr.skill').length);
  check(vis === 1, 'the filter narrows the page to one skill', vis + ' rows');
  await page.click('#measure');
  await page.waitForFunction(() => typeof lxTuner.measured.edited.shinobi_seal === 'number' || /failed/.test(document.getElementById('status').textContent), null, { timeout: 150000 });
  const m = await page.evaluate(() => ({ pct: lxTuner.measured.edited.shinobi_seal, status: document.getElementById('status').textContent }));
  check(typeof m.pct === 'number' && m.pct > 0, 'Measure boots the edited build in the frame and reads the skill', m.status.slice(0, 100));
  const budget = 1000;
  check(typeof m.pct === 'number' && Math.abs(m.pct / budget - 1) <= 0.2, "Kage Rush measures inside its budget band (it is one line, so this is the frame's basic too)", `${Math.round(m.pct || 0)}% vs ${budget}%`);
  if (process.env.TAB_JSON && existsSync(process.env.TAB_JSON)) {
    const tab = JSON.parse(readFileSync(process.env.TAB_JSON, 'utf8')); const c = tab.classes.rogue;
    const ref = c && c.rows.shinobi_seal ? c.rows.shinobi_seal.total / c.basic.total * 100 : null;
    check(ref != null && Math.abs(m.pct / ref - 1) <= 0.05, 'the page measures what scripts/skill_tabulation.mjs measured', `page ${Math.round(m.pct)}% vs tabulation ${Math.round(ref || 0)}%`);
  }
  const own = errs.filter((e) => /lxTuner|skill_tuner|lxScan|lxMeasure/.test(e));
  check(!own.length, 'no page errors from the tuner itself', own.join(' | ') || (errs.length ? errs.length + ' from the game frame (informational)' : 'none'));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
