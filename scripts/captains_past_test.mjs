// THE FOUR ONCE STOOD TOGETHER, AND THE WOMAN AT THE GATE WENT ALONE (per user, 2026-10-11): the four captains teamed up against whatever the rumours said stood
// behind all this and could not get along, so each leads a faction to no avail; an independent hero (Mira, never named) came closest to the secrets, was cursed and
// distorted and lost part of her memory; the blade a smith forged for her was meant to cut the unbreakable curse. And the creator's secret is never told, only hinted.
//   1. each captain's order page has 'Did the four ever stand together?' answered in their own voice (<= 60 words), and the woman at the gate went on alone;
//   2. Will's 'Barnaby's work?' no longer claims the Bastion's blades are Barnaby's (they are hers, and none has broken): she asked him for the one that would
//      (one spine, v0.30.1851: it opens once the Distorted Portal is done, the Order Book being retired);
//   3. her boss card and dossier carry the curse-cutting blade she cannot remember the reason for;
//   4. no new line names Mira, the creator, a playground or anything like it; 5. no page errors.
//   node scripts/captains_past_test.mjs     MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync, readFileSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11798), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof openNPC === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) applyClass('warrior'); player.level = 60; player._tutorialSeen = true; player._gravitosCineSeen = true;
    const words = (t) => String(t || '').replace(/<[^>]+>/g, '').split(/\s+/).filter((w) => /[A-Za-z]/.test(w)).length;
    const text = () => (document.getElementById('dialog-text') || {}).textContent || '';
    const opts = () => [...document.querySelectorAll('#dialog-options button')].map((b) => (b.textContent || '').trim());
    const click = async (re) => { const b = [...document.querySelectorAll('#dialog-options button')].find((x) => re.test(x.textContent || '')); if (b) { b.click(); await sleep(250); } return !!b; };
    const settle = async () => { const d = document.getElementById('dialog'); for (let i = 0; i < 200 && d.classList.contains('typing'); i++) await sleep(50); await sleep(100); };
    const close = async () => { try { closeDialog(); } catch (e) {} await sleep(200); };
    const ask = async (map, name, pageRe, optRe) => { loadMap(map, 300); await sleep(900); game.paused = false; try { closeAllModals(); } catch (e) {}
      const n = (game.mapData.npcs || []).find((x) => x.name === name); if (!n) return { err: 'no ' + name + ' on ' + map };
      game._brokMenu = null; game._lxOrderPage = null; openNPC(n); await sleep(300); await settle(); if (pageRe) { await click(pageRe); await settle(); }
      const menu = opts(); const had = await click(optRe); await settle(); const t = text(); await close(); return { menu, had, t }; };
    const done = { q_lyra_kin: true }; player.quests = player.quests || { active: {}, completed: {} }; player.quests.completed = Object.assign({}, done);
    const TW = /Did the four ever stand together\?/, TH = /Did the four ever work as one\?/, TG = /Did you four ever pull together\?/, TT = /Did you ever hunt with the others\?/;   // one button text per captain (npc_unique_options_test)
    out.will = await ask('bastionThrone', 'Will', /Who fights beside you\?/, TW);
    out.hera = await ask('azureAbode', 'Hera', /What was the Academia\?/, TH);
    out.hong = await ask('emeraldVillage', 'Lady Hong', /What guards the grove\?/, TG);
    out.taiga = await ask('shadowWovenHood', 'Taiga', /Who do you fight\?/, TT);
    player.quests.completed = { q_distorted_portal: true };   // one spine: Will's "Barnaby's work?" waits on the Portal (the Order Book is retired)
    out.work = await ask('bastionThrone', 'Will', /Who fights beside you\?/, /Barnaby's work\?/);
    player.quests.completed = {};
    out.lore = (typeof BOSS_INTROS === 'object' && BOSS_INTROS.miraFallen) ? BOSS_INTROS.miraFallen.lore : '';
    out.w = { will: words(out.will.t), hera: words(out.hera.t), hong: words(out.hong.t), taiga: words(out.taiga.t), work: words(out.work.t), lore: words(out.lore) };
    return out;
  });
  const src = readFileSync(path.join(SERVE_ROOT, FILE), 'utf8');
  const dex = (src.match(/miraFallen: +'She reached the gate first[^']*'/) || [''])[0];
  const all = [R.will.t, R.hera.t, R.hong.t, R.taiga.t, R.work.t, R.lore, dex].join(' ');
  ok('[1] every captain answers "did the four ever stand together?" on their order page, each under their own words', [R.will, R.hera, R.hong, R.taiga].every((x) => x.had && x.t), [R.will.had, R.hera.had, R.hong.had, R.taiga.had]);
  ok('[1] in their own voices: Will wanted a line held, Hera ranked the culprits, Hong kept the grove, Taiga went ahead', /wanted a line held/.test(R.will.t) && /ranked the rumoured culprits/.test(R.hera.t) && /I kept the grove/.test(R.hong.t) && /I went ahead/.test(R.taiga.t), [R.will.t.slice(0, 60), R.hera.t.slice(0, 60)]);
  ok('[1] the woman at the gate led her own company up the road, and none of the four went with her', /The woman at the gate led her own company up it, and none of us went with her/.test(R.will.t) && /Those who went up without us should not have had to/.test(R.hong.t), [R.will.t.slice(-90), R.hong.t.slice(-60)]);
  ok('[2] Will\'s "Barnaby\'s work?": her blades never break, and she asked him for the one that would - not that the Bastion\'s blades are his', R.work.had && /Her blades never break/.test(R.work.t) && /She asked me for the one that would/.test(R.work.t) && !/Every blade my knights carry is his/.test(R.work.t), R.work.t.slice(0, 160));
  ok('[3] her boss card: the blade a smith forged to cut the curse on this world, and she cannot remember what it was for', /forged to cut the curse on this world/.test(R.lore) && /cannot remember what it was for/.test(R.lore), R.lore.slice(-120));
  ok('[3] her dossier: she remembers the gate and almost nothing else', /She remembers the gate, and almost nothing else\./.test(dex), dex.slice(-80));
  ok('[4] nothing here names Mira, the creator, a playground or an outsider; the hints stay oblique', !/\bMira\b|Guguma|creator|playground|extraterrestrial|outsider|alien|entertain|\bgame\b/i.test(all) && /ceiling/.test(R.hera.t) && /let through/.test(R.taiga.t), all.match(/\bMira\b|Guguma|creator|playground|extraterrestrial|alien|entertain|\bgame\b/gi));
  ok('[4] and none names the Twelve, a House or a champion', !/Twelve|Zodiac|Houses?\b|champion/.test([R.will.t, R.hera.t, R.hong.t, R.taiga.t, R.work.t].join(' ')), '');
  ok('[4] every new line is at most 60 words', Object.values(R.w).every((w) => w > 0 && w <= 60), R.w);
  ok('[5] no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 200), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
