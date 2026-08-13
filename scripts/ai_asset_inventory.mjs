#!/usr/bin/env node
// AI ASSET INVENTORY — evidence for the Steam Content Survey's AI section.
//
// Mojiworld failed Steam review once because the survey's AI disclosure did not
// match the game's actual content. This regenerates the numbers behind the
// answers in docs/guides/STEAM.md §6c, and re-checks the one claim that is easy
// to get wrong: that the SHIPPED game makes no AI call at runtime (which is what
// separates Steam's "Pre-Generated" from "Live-Generated" disclosure).
//
//   node scripts/ai_asset_inventory.mjs
//   node scripts/ai_asset_inventory.mjs --check   # exit 1 if runtime AI is found
// =============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');

const walk = (dir, out = []) => {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
};

// ---- 1. generator scripts ---------------------------------------------------
const gens = [];
for (const f of walk(path.join(ROOT, 'scripts')).filter(f => /\.(mjs|js)$/.test(f))) {
  const t = fs.readFileSync(f, 'utf8');
  if (!/api\.ludo\.ai|LUDO_API_KEY/.test(t)) continue;
  const kinds = [];
  if (/assets\/image/.test(t)) kinds.push('image');
  if (/audio\/sound-effect/.test(t)) kinds.push('sfx');
  gens.push({ f: path.relative(ROOT, f).replace(/\\/g, '/'), kinds: kinds.join('+') || 'ludo' });
}
console.log(`AI generator scripts (ludo.ai): ${gens.length}`);
const byKind = gens.reduce((a, g) => (a[g.kinds] = (a[g.kinds] || 0) + 1, a), {});
for (const [k, n] of Object.entries(byKind)) console.log(`   ${String(n).padStart(3)}  ${k}`);

// ---- 2. asset counts --------------------------------------------------------
const imgs = walk(path.join(ROOT, 'Sprites')).filter(f => /\.(webp|png|jpg|jpeg)$/i.test(f));
const mp3All = walk(path.join(ROOT, 'audio')).filter(f => /\.mp3$/i.test(f));
const mp3Live = mp3All.filter(f => !/_regen_backup|_themes_backup/.test(f));
const sub = (d) => mp3Live.filter(f => f.replace(/\\/g, '/').includes(`/audio/${d}/`)).length;
console.log(`\nSprites/ images            : ${imgs.length}`);
console.log(`audio/ mp3 (live)          : ${mp3Live.length}   (+${mp3All.length - mp3Live.length} archived)`);
console.log(`   monster SFX             : ${sub('monster')}`);
console.log(`   NPC voice blips         : ${sub('npc')}`);
console.log(`   boss stingers           : ${sub('boss')}`);
console.log(`   UI + skill SFX          : ${sub('ui') + sub('skill')}`);
console.log(`   ambient                 : ${sub('ambient')}`);

// ---- 3. lingering generator metadata ---------------------------------------
const tagged = [];
for (const f of mp3Live) {
  const b = fs.readFileSync(f);
  const head = b.subarray(0, Math.min(b.length, 40000)).toString('latin1');
  if (/suno|udio|elevenlabs/i.test(head)) tagged.push(path.relative(ROOT, f).replace(/\\/g, '/'));
}
console.log(`\naudio still carrying an originating-tool tag: ${tagged.length}`);
for (const f of tagged) console.log('   ' + f);
console.log('   (this changes nothing about disclosure — all of it is AI-generated either way)');

// ---- 4. THE claim that must hold: no runtime AI -----------------------------
const gameFile = path.join(ROOT, process.env.MOJI_GAME_FILE || 'mojiworld_game.html');
let runtimeHits = [];
let hosts = [];
if (fs.existsSync(gameFile)) {
  const s = fs.readFileSync(gameFile, 'utf8');
  const lines = s.split('\n');
  // A mention inside a comment is a credit, not a call. Only count lines that
  // look like an actual request to a generative endpoint.
  const CALL = /(fetch|axios|XMLHttpRequest|new WebSocket)\s*\(?[^\n]*?(ludo\.ai|openai|anthropic|elevenlabs|suno|stability\.ai|replicate\.com)/i;
  lines.forEach((l, n) => { if (CALL.test(l) && !/^\s*\/\//.test(l.trim())) runtimeHits.push(`${n + 1}: ${l.trim().slice(0, 120)}`); });
  hosts = [...new Set([...s.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map(m => m[1].toLowerCase()))].sort();
}
console.log(`\nruntime AI calls in the shipped game: ${runtimeHits.length}`);
for (const h of runtimeHits) console.log('   ' + h);
console.log('outbound hosts referenced by the shipped game:');
for (const h of hosts) console.log('   ' + h);
console.log('\nSurvey answers this supports:');
console.log('   Pre-Generated AI content ... YES  (art + audio, shipped as fixed files)');
console.log(`   Live-Generated AI content .. ${runtimeHits.length ? 'YES — investigate the hits above' : 'NO   (no AI endpoint is called at runtime)'}`);

if (CHECK && runtimeHits.length) {
  console.error('\nFAIL: runtime AI usage found — the survey would need Live-Generated disclosure.');
  process.exit(1);
}
