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
  ok('q_warrior_lv49 trimmed to the line (245,000)', r.w49 === 245000, String(r.w49));
  ok('q_mage_lv42 trimmed to the line (210,000)', r.m42 === 210000, String(r.m42));
  ok('q_warrior_lv41 trimmed to the line (205,000)', r.w41 === 205000, String(r.w41));
  ok('q_boss_aetherion (Lv 60, under the line) untouched', r.aeth === 17872, String(r.aeth));
  ok('b_cinderling codex quest untouched', r.cind === 29314, String(r.cind));
  ok('q_act1_waking (Lv 1) untouched', r.act1 === 493, String(r.act1));
  ok('every coin quest still in the pool (284)', r.n === 284, String(r.n));
  ok('one-time pool trimmed (15M-19M, was 21.6M)', r.total > 15e6 && r.total < 19e6, String(r.total));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
