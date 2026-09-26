// The permanent Discord invite (v0.30.x discord-invite). Static checks on the game file, README, the social-links test
// and the changelog header, then the full social-links suite (real title screen) against the same build.
//   node scripts/discord_invite_test.mjs     (MOJI_GAME_FILE=<build.html>, LX_CHANGELOG_FILE=<changelog.html> honoured)
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAME = path.resolve(ROOT, process.env.MOJI_GAME_FILE || 'mojiworld_game.html');
const CL = path.resolve(ROOT, process.env.LX_CHANGELOG_FILE || 'CHANGELOG.html');
const OLD = 'discord.gg/9CqQwXKcv', NEW = 'https://discord.gg/csHmcWceZA';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const count = (s, x) => s.split(x).length - 1;

const g = readFileSync(GAME, 'utf8');
check(count(g, 'id="lo-discord" href="' + NEW + '"') === 1 && count(g, OLD) === 0, 'the title screen links the permanent invite, and nothing in the game links the old one', { neu: count(g, NEW), old: count(g, OLD) });
const r = readFileSync(path.join(ROOT, 'README.md'), 'utf8');
check(count(r, NEW) === 2 && count(r, OLD) === 0, 'README: both Discord links use the permanent invite', { neu: count(r, NEW), old: count(r, OLD) });
const t = readFileSync(path.join(ROOT, 'scripts/social_links_test.mjs'), 'utf8');
check(t.includes(NEW) && !t.includes(OLD), 'the social-links suite expects the permanent invite', {});
const c = readFileSync(CL, 'utf8');
const head = c.slice(0, c.indexOf('</header>'));
check(head.includes(NEW + '"') && !head.includes(OLD), 'the changelog header links the permanent invite', {});

const port = String(10300 + Math.floor(Math.random() * 60));
const run = spawnSync(process.execPath, [path.join(ROOT, 'scripts/social_links_test.mjs')], { cwd: ROOT, env: { ...process.env, PORT: port, MOJI_GAME_FILE: path.basename(GAME), LX_CHANGELOG_FILE: CL }, encoding: 'utf8', timeout: 600000 });
const out = (run.stdout || '') + (run.stderr || '');
const tail = out.trim().split(/\r?\n/).slice(-1)[0] || '';
check(/^all \d+ passed/.test(tail), 'the full social-links suite passes on this build (title links, icons, README, changelog header)', out.split(/\r?\n/).filter((l) => /^FAIL/.test(l)).slice(0, 6).concat([tail]));

console.log('');
console.log(bad ? `${bad} of ${total} FAILED` : `all ${total} passed`);
process.exit(bad ? 1 : 0);
