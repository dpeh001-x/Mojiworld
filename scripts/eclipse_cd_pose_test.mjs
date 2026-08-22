// ECLIPSE MASSACRE — a true 12 s cooldown, and a ninjutsu stance under the moon.
// ============================================================================
// Per user: "put eclipse massacre cooldown at 12 second, the character pose when
// going to the middle at the map should be a ninjitsu style pose".
//
// The cooldown is measured as the game STAMPS it, not as the table states it:
// castSkill multiplies the table value by JOB_CD_MUL (0.75), so the table's
// "12000" was a 9 s skill in play. The pose is read through the real animation
// resolver during the hover, because a flag that is set and then not held for
// the whole pin would pass a table check and still drop back to the generic
// attack pose mid-hover.
// Run: node scripts/eclipse_cd_pose_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9497;
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
await page.fill('#hero-name-input', 'EclipseTest');
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
await page.evaluate(() => {
  player.level = 99; player._god = true;
  player.cls = 'rogue'; player.job = 'assassin'; player.master = 'nightreaper';
  loadMap('forest', 300);
});
await page.waitForTimeout(4000);

const R = await page.evaluate(async () => {
  game.paused = false;
  player.maxMp = 999999; player.mp = 999999; player.baseAtk = 500;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  player.skillCooldowns = {}; player._castLockUntil = 0; player.hitStun = 0;
  player._momentum = 0;   // rogue momentum feeds getCdrMult; zero it so the stamp is the base value
  game.monsters.length = 0;
  // The skill whiffs (and refunds, no blink) with no prey under the moon.
  const t = spawnMonster(player.x + 120, player.y, 'slime', false);
  if (t) { t.maxHp = 1e9; t.currentHp = 1e9; t.atk = 0; t.speed = 0; }
  await sleep(300);
  const cdrMult = (typeof getCdrMult === 'function') ? getCdrMult() : 1;
  castSkill('nightreaper_mark');
  const stampedCd = Math.round(player.skillCooldowns['nightreaper_mark'] || 0);
  const held = !!player._eclipseHold;
  // Resolve the animation the renderer would pick on each frame of the pin.
  const seen = {};
  let frames = 0;
  for (let f = 0; f < 120; f++) {
    await new Promise(r => requestAnimationFrame(r));
    if (!player._eclipseHold) break;
    frames++;
    let anim = null;
    try { anim = (typeof _heroVecAnimFor === 'function') ? _heroVecAnimFor() : null; } catch (e) {}
    if (anim == null) {
      // fall back to the flag the resolver reads
      anim = ((player._ninjaPoseUntil | 0) > (game.time | 0)) ? 'attack_rogue_ninja' : 'attack_rogue';
    }
    seen[anim] = (seen[anim] || 0) + 1;
  }
  return { stampedCd, cdrMult: +cdrMult.toFixed(2), held, frames, seen,
           table: SKILLS.nightreaper_mark.cd, jobMul: typeof JOB_CD_MUL !== 'undefined' ? JOB_CD_MUL : null };
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 140) });
const ninja = R.seen['attack_rogue_ninja'] || 0;
const share = R.frames ? ninja / R.frames : 0;
ok('the cast pins the rogue under the moon', R.held && R.frames > 20, `pinned for ${R.frames} sampled frames`);
ok('the STAMPED cooldown is 12 s (not the table value)', Math.abs(R.stampedCd - 12000) <= 600,
   `stamped ${R.stampedCd}ms (table ${R.table} x JOB_CD_MUL ${R.jobMul} x cdr ${R.cdrMult})`);
ok('the ninjutsu stance is the pose for the WHOLE pin', share >= 0.95,
   `attack_rogue_ninja on ${Math.round(share * 100)}% of pinned frames  ${JSON.stringify(R.seen)}`);

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
