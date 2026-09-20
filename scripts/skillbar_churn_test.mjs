// THE SKILL BAR REBUILT ITSELF EVERY FRAME (v0.30.936 boss-fight lag). Three things, all live in the page:
// the cooldown readout mutates its text node instead of replacing it (a replacement dirties layout up the bar);
// --cd-pct is written on the .skill-cd overlay that reads it, not on the slot root (which invalidated the icon,
// the key chip and the MP chip alongside it); and the pie is quantised to 0.5%, so it updates ~20 times a second
// instead of once per frame. Measured on a Gravitos fight: style+layout 750 ms -> 555 ms per 8 s.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/skillbar_churn_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11327';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
const env = { ...process.env, MOJI_GAME_FILE: PAGE };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1800));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const src = readFileSync(PAGE, 'utf8');
const viaHelper = (src.match(/_sbCdText\((?:bs|s)\.cdEl,/g) || []).length;
check(viaHelper === 2, 'both cooldown readouts write through _sbCdText', J({ viaHelper }));
check(!/(?:bs|s)\.root\.style\.(?:set|remove)Property\('--cd-pct'/.test(src), 'nothing writes --cd-pct on the slot root any more');
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof renderSkillBar === 'function' && typeof applyClass === 'function', null, { timeout: 180000 });
  await page.evaluate(async () => {
    try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    applyClass('warrior'); player.level = 60; loadMap('forest', 300); await new Promise((r) => setTimeout(r, 900));
  });
  // 1. a cooling slot keeps its text node across HUD ticks (a replacement is what dirtied the bar's layout)
  const node = await page.evaluate(async () => {
    const slot = Object.keys(_sbSlots).map((k) => _sbSlots[k]).find((x) => x && x.skillId && SKILLS[x.skillId] && SKILLS[x.skillId].cd > 0);
    if (!slot) return { err: 'no skill slot with a cooldown' };
    player.skillCooldowns[slot.skillId] = SKILLS[slot.skillId].cd;
    renderSkillBar();
    const first = slot.cdEl.firstChild, firstTxt = slot.cdEl.textContent;
    player.skillCooldowns[slot.skillId] -= 260;              // a later tick of the same cooldown
    renderSkillBar();
    const same = slot.cdEl.firstChild === first, secondTxt = slot.cdEl.textContent;
    player.skillCooldowns[slot.skillId] = 0; renderSkillBar();
    return { same, firstTxt, secondTxt, id: slot.skillId };
  });
  check(!node.err && node.same && node.firstTxt !== node.secondTxt,
    'the cooldown number changes without replacing its text node', J(node));
  // 2. the pie percentage lands on the overlay that reads it, and the root stays clean
  const where = await page.evaluate(async () => {
    const slot = Object.keys(_sbSlots).map((k) => _sbSlots[k]).find((x) => x && x.skillId && SKILLS[x.skillId] && SKILLS[x.skillId].cd > 0);
    player.skillCooldowns[slot.skillId] = SKILLS[slot.skillId].cd;
    renderSkillBar();
    const onCd = slot.cdEl.style.getPropertyValue('--cd-pct'), onRoot = slot.root.style.getPropertyValue('--cd-pct');
    const painted = getComputedStyle(slot.cdEl).backgroundImage.indexOf('conic-gradient') >= 0;
    player.skillCooldowns[slot.skillId] = 0; renderSkillBar();
    const cleared = slot.cdEl.style.getPropertyValue('--cd-pct');
    return { onCd, onRoot, painted, cleared };
  });
  check(where.onCd !== '' && where.onRoot === '' && where.painted && where.cleared === '',
    'the pie percentage is written on .skill-cd, and cleared when the skill comes back', J(where));
  // 3. a full cooldown costs ~20 writes a second, not one per frame
  const writes = await page.evaluate(async () => {
    const slot = Object.keys(_sbSlots).map((k) => _sbSlots[k]).find((x) => x && x.skillId && SKILLS[x.skillId] && SKILLS[x.skillId].cd > 0);
    const cd = SKILLS[slot.skillId].cd;
    let n = 0, last = null;
    for (let ms = cd; ms > 0; ms -= cd / 600) {              // 600 frames' worth of one cooldown
      player.skillCooldowns[slot.skillId] = ms;
      renderSkillBar();
      const v = slot.cdEl.style.getPropertyValue('--cd-pct') || slot.root.style.getPropertyValue('--cd-pct');   // wherever the build writes it
      if (v !== last) { last = v; n++; }
    }
    player.skillCooldowns[slot.skillId] = 0; renderSkillBar();
    return { n, cd };
  });
  check(writes.n <= 210, 'one cooldown writes the pie ~200 times, not once per frame', J(writes));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 3)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
