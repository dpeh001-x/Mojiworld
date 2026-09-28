#!/usr/bin/env node
// Refresh tools/sound_review_names.json - the display names scripts/gen_sound_review.mjs bakes into the tester's
// sound-review page - from a RUNNING game, so every name comes out of the same tables the game itself uses:
//   mons   <- monsterTypes + LX_MONSTER_STATS            (the key is the monster type: clip mob_<key>_hit|die)
//   npcs   <- every map's npcs, keyed by _npcTalkKey()    (the exact key _playNpcTalkSfx plays: npc_<key>.mp3)
//   skills <- every SKILLS entry resolved the way _playSkillSfx resolves it (an exact _SKILL_SFX_FILES entry, else the
//             _SKILL_SFX_ALIAS bucket), grouped by the clip it plays - so a shared clip lists every skill that plays it
// Before this script the file was a hand-made snapshot (v0.29.920) and quietly fell behind the game.
//   node scripts/dump_sound_review_names.mjs            (PORT=<port> to pick the server port)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { existsSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 10318);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const page = await browser.newPage();
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof monsterTypes === 'object' && typeof MAPS === 'object' && typeof SKILLS === 'object'
    && typeof _SKILL_SFX_FILES === 'object' && typeof _npcTalkKey === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(3000);
  const out = await page.evaluate(() => {
    const stats = (typeof LX_MONSTER_STATS === 'object' && LX_MONSTER_STATS) || {};
    const mons = {};
    for (const [key, t] of Object.entries(monsterTypes)) {
      if (!t) continue; const st = stats[key] || {};
      mons[key] = { name: t.name || key, lv: st.lv || t.level || t.lv || 0, boss: !!(t.boss || t.isBoss || /^zodiac_/.test(key)) };
    }
    const npcs = {};
    for (const [mk, m] of Object.entries(MAPS)) {
      for (const n of (m && m.npcs) || []) {
        if (!n || !n.name) continue; const k = _npcTalkKey(n.name); if (!k) continue;
        const e = npcs[k] || (npcs[k] = { name: n.name === '???' ? 'Sage Mira' : n.name, role: n.role || n.type || '', maps: [] });
        const where = m.name || mk; if (!e.maps.includes(where)) e.maps.push(where);
      }
    }
    const CLS = { warrior: 'Warrior', rogue: 'Rogue', mage: 'Mage', archer: 'Archer' };
    const skills = {};
    for (const [id, s] of Object.entries(SKILLS)) {
      if (!s) continue;
      const key = _SKILL_SFX_FILES[id] ? id : (_SKILL_SFX_ALIAS[id] || id), file = _SKILL_SFX_FILES[key];
      if (!file) continue;
      const clip = file.split('/').pop().replace(/\.mp3$/, '');
      const job = s.job ? String(s.job).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '';
      (skills[clip] = skills[clip] || []).push({ id, name: s.name || id, cls: CLS[s.cls] || s.cls || '', job, slot: s.slot || '' });
    }
    // two cues the Deadeye Protocol machinery plays by name (_lxDeSfx), not through a SKILLS cast
    const dp = SKILLS.marksman_ult;
    if (dp) for (const [clip, what] of [['deadeye_lock', 'lock-on'], ['deadeye_execute', 'execute']]) {
      (skills[clip] = skills[clip] || []).push({ id: 'marksman_ult', name: `${dp.name || 'Deadeye Protocol'} (${what})`, cls: CLS[dp.cls] || dp.cls || '',
        job: dp.job ? String(dp.job).replace(/\b\w/g, (c) => c.toUpperCase()) : '', slot: dp.slot || '' });
    }
    return { ver: GAME_VERSION, gen: 'scripts/dump_sound_review_names.mjs (monsterTypes + LX_MONSTER_STATS, MAPS npcs via _npcTalkKey, SKILLS via _playSkillSfx resolution)', mons, npcs, skills };
  });
  const file = path.join(ROOT, 'tools', 'sound_review_names.json');
  writeFileSync(file + '.tmp', JSON.stringify(out, null, 1) + '\n'); renameSync(file + '.tmp', file);
  console.log(`wrote tools/sound_review_names.json from ${out.ver}: ${Object.keys(out.mons).length} monsters, ${Object.keys(out.npcs).length} NPC voices, ${Object.keys(out.skills).length} skill clips (${Object.values(out.skills).reduce((a, v) => a + v.length, 0)} skills)`);
} finally { await browser.close(); server.kill(); }
