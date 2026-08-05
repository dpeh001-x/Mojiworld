// A runbook with a stale path is worse than no runbook. Check every file,
// script and fact the steam-update skill asserts.
import fs from 'node:fs';
const R = 'C:/Users/dpeh0/Mojiworld/';
const skill = fs.readFileSync(R + '.claude/skills/steam-update/SKILL.md', 'utf8');
const res = [];
const ok = (n, c, extra = '') => res.push({ n, pass: !!c, extra });

// frontmatter
ok('has name frontmatter', /^---[\s\S]*?\nname: steam-update\n/.test(skill));
ok('has description frontmatter', /\ndescription: .{40,}/.test(skill));

// every repo path the skill names must exist
const paths = [
  'steam/steam_upload/app_build.vdf', '.github/workflows/steam-build.yml',
  'steam/package.json', 'tools/set_steam_appid.mjs', 'tools/sync_steam_version.mjs',
  'tools/stamp_win_exe.mjs', 'tools/gen_steam_upload_assets.mjs',
  'scripts/steam_depot_boot_test.mjs', 'scripts/steam_integration_test.mjs',
  'serve.js', 'docs/guides/STEAM.md', 'steam/relay.config.json',
];
for (const p of paths) ok(`path exists: ${p}`, fs.existsSync(R + p));

// the IDs quoted in the table must match what's actually committed
const appid = fs.readFileSync(R + 'steam/steam_appid.txt', 'utf8').trim();
const vdf = fs.readFileSync(R + 'steam/steam_upload/app_build.vdf', 'utf8');
ok('skill quotes the real App ID', skill.includes(appid), `repo=${appid}`);
ok('app_build.vdf carries that App ID', vdf.includes(`"AppID" "${appid}"`));
const depots = [...vdf.matchAll(/"(\d+)"\s*"depot_(\w+)\.vdf"/g)].map(m => [m[2], m[1]]);
for (const [os, id] of depots) ok(`skill quotes ${os} depot ${id}`, skill.includes(id));
ok('SetLive is empty (no auto-publish)', /"SetLive"\s*""/.test(vdf));
ok('ContentRoot points at release/', /"ContentRoot"\s*"\.\.\\release\\?"/.test(vdf));

// CI artifact names
const yml = fs.readFileSync(R + '.github/workflows/steam-build.yml', 'utf8');
for (const a of ['mojiworld-windows-depot', 'mojiworld-linux-depot']) {
  ok(`workflow defines artifact ${a}`, yml.includes(a));
  ok(`skill names artifact ${a}`, skill.includes(a));
}
ok('workflow triggers on the game file', /-\s*'mojiworld_game\.html'/.test(yml));

// npm scripts the skill tells you to run
const pkg = JSON.parse(fs.readFileSync(R + 'steam/package.json', 'utf8'));
for (const s of ['dist:steamwin', 'dist:steamdeck']) ok(`npm script exists: ${s}`, !!pkg.scripts[s]);

// steam/release must stay ignored so a local build is never committed
const ignored = fs.readFileSync(R + '.gitignore', 'utf8');
ok('steam/release is gitignored', /^steam\/release\/?$/m.test(ignored));

// safety language must be present
ok('requires confirmation before upload', /REQUIRES USER CONFIRMATION/.test(skill));
ok('refuses to handle the Steam password', /[Nn]ever ask for, type, or handle their\s*\n?Steam password/.test(skill.replace(/\s+/g, ' ')) || /Never ask for, type, or handle their Steam password/.test(skill.replace(/\s+/g, ' ')));
ok('warns against building from a dirty tree', /dirty working tree/i.test(skill));

let pass = 0, fail = 0;
for (const r of res) {
  if (r.pass) { pass++; } else { fail++; console.log(`  FAIL  ${r.n}  ${r.extra}`); }
}
console.log(`\n${pass} passed, ${fail} failed  (${res.length} checks)`);
process.exit(fail ? 1 : 0);
