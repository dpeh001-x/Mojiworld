// Quest coin ceiling (v0.30.379): no quest pays more than 5,000 x its unlock
// level; the class-line tail is trimmed to the line, everything under it is
// untouched, and the pool keeps every quest. Boots the game headless.
//   MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override the served tree.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 9917); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
try {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof QUESTS === 'object', null, { timeout: 180000 }); await page.waitForTimeout(6000);
  const r = await page.evaluate(() => {
    const rows = []; for (const id in QUESTS) { const q = QUESTS[id]; if (!q || !q.rewards || !q.rewards.mojicoins) continue; rows.push({ id, lv: Math.max(1, (q.levelReq | 0) || 1), coins: q.rewards.mojicoins }); }
    const over = rows.filter((x) => x.coins > 5000 * x.lv);
    const at = (id) => { const q = QUESTS[id]; return q && q.rewards ? q.rewards.mojicoins : null; };
    return { n: rows.length, total: rows.reduce((a, x) => a + x.coins, 0), over: over.slice(0, 6).map((x) => x.id + '=' + x.coins + '@' + x.lv), overN: over.length,
      w49: at('q_warrior_lv49'), m42: at('q_mage_lv42'), w41: at('q_warrior_lv41'), aeth: at('q_boss_aetherion'), cind: at('b_cinderling'), act1: at('q_act1_waking'), ver: typeof GAME_VERSION === 'string' ? GAME_VERSION : '?' };
  });
  console.log('build ' + r.ver + '  coin quests ' + r.n + '  pool ' + r.total);
  ok('no coin quest pays more than 5,000 x its level', r.overN === 0, r.overN + ' over: ' + r.over.join(' '));
  // the trimmed tail sits exactly on a line proportional to its level (3,750 x level since the
  // v0.30.758 gold cut took 25% off the 5,000 the line was drawn at)
  const LINE = 3750;
  ok('q_warrior_lv49 trimmed to the line', r.w49 === LINE * 49, r.w49 + ' vs ' + LINE * 49);
  ok('q_mage_lv42 trimmed to the line', r.m42 === LINE * 42, r.m42 + ' vs ' + LINE * 42);
  ok('q_warrior_lv41 trimmed to the line', r.w41 === LINE * 41, r.w41 + ' vs ' + LINE * 41);
  ok('q_boss_aetherion (Lv 60) is under the line and keeps its own number', r.aeth > 0 && r.aeth < LINE * 60, String(r.aeth));
  ok('b_cinderling codex quest is under the line and keeps its own number', r.cind > 0 && r.cind < LINE * 45, String(r.cind));
  ok('q_act1_waking (Lv 1) is under the line and keeps its own number', r.act1 > 0 && r.act1 < LINE * 1, String(r.act1));
  ok('no coin quest was dropped from the pool (284 or more)', r.n >= 284, String(r.n));
  ok('the one-time pool is well under the 21.6M it was before the trim', r.total > 10e6 && r.total < 19e6, String(r.total));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
