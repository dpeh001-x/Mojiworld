// Innate Growth's bonus rolls as three tossed dice (v0.30.x lg-dice): runs innate_card_test (patched by
// apply_lg_dice_tests.mjs, whose step 3 now checks no bar chart, dice with 0 / 1 / 2 pips, and a total naming the
// bonus) and reports in the "all N passed" form. Per user: "condense the bonus roll section, there is no need for bar
// charts for that section, but make it easy to understand" / "make the design artistic".
//   node scripts/lg_dice_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const r = spawnSync(process.execPath, [path.join(HERE, 'innate_card_test.mjs'), FILE], { env: process.env, encoding: 'utf8', timeout: 400000 });
const out = (r.stdout || '') + (r.stderr || '');
process.stdout.write(out);
const m = out.match(/(\d+)\/(\d+) passed/);
const dice = /PASS\s+3\. no bar chart: three dice/.test(out);
if (m && m[1] === m[2] && dice) { console.log(`\nall ${m[2]} passed`); process.exit(0); }
console.log(`\n${m ? (m[2] - m[1]) : '?'} FAILED${dice ? '' : ' (the dice check did not pass)'}`);
process.exit(1);
