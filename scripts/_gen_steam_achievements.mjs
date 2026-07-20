// Extract the ACHIEVEMENTS array from mojiworld_game.html and emit the Steamworks
// achievement manifest (steam/achievements_manifest.json + a paste-in .md table).
// The in-game client already unlocks these on Steam via _lxSteamUnlock(a.id)
// (SteamAPI.achievement.unlock) — the API-name in Steamworks partner backend
// must EXACTLY match each `id` below, or the unlock call no-ops.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'mojiworld_game.html'), 'utf8');

const start = html.indexOf('const ACHIEVEMENTS = [');
const end = html.indexOf('];', start);
const block = html.slice(start, end);

// Pull id/name/desc from each `{ id:'x', name:'y', desc:'z', test:... }` row.
const re = /id:\s*'([^']+)'\s*,\s*name:\s*'([^']+)'\s*,\s*desc:\s*'((?:[^'\\]|\\.)*)'/g;
const rows = [];
let m;
while ((m = re.exec(block))) rows.push({ apiname: m[1], name: m[2], desc: m[3].replace(/\\'/g, "'") });

mkdirSync(join(root, 'steam'), { recursive: true });

// JSON manifest (machine-readable; mirrors Steamworks fields).
writeFileSync(join(root, 'steam', 'achievements_manifest.json'),
  JSON.stringify({ note: 'Register each in Steamworks App Admin -> Achievements. apiname MUST match the in-game id exactly.', count: rows.length, achievements: rows }, null, 2));

// Human paste-in table.
let md = `# Mojiworld — Steam Achievements (${rows.length})\n\n`;
md += `The game already calls \`SteamAPI.achievement.unlock(id)\` on unlock and re-syncs owned\n`;
md += `achievements on launch. For them to register on Steam you must create each one in the\n`;
md += `**Steamworks partner site → your app → Stats & Achievements → Achievements**, with the\n`;
md += `**API Name** set EXACTLY to the \`apiname\` below (case-sensitive), plus a locked + unlocked\n`;
md += `icon per achievement (Steam requires both; 256×256 PNG).\n\n`;
md += `| # | API Name (must match game id) | Display Name | Description |\n|---|---|---|---|\n`;
rows.forEach((r, i) => { md += `| ${i + 1} | \`${r.apiname}\` | ${r.name} | ${r.desc} |\n`; });
writeFileSync(join(root, 'steam', 'ACHIEVEMENTS_STEAM.md'), md);

console.log(`Wrote steam/achievements_manifest.json + steam/ACHIEVEMENTS_STEAM.md — ${rows.length} achievements`);
if (rows.length !== 39) console.warn('WARNING: expected 39, got ' + rows.length + ' — check the parse');
