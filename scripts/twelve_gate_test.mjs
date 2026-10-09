// THE TWELVE ARE REVEALED ONLY AFTER AETHERION FALLS (per user, 2026-10-08: "the twelve should only occur after defeating aetherion").
// Before it, nothing a player can read names the Twelve, their Houses or the champions: the Codex's World, Zodiac and Standings pages, the captains' questions about the champions
// their orders raised, the Amnesiac's and the sage's pages, the base idle bubbles, and every quest below Lv 70 (the Smith, Barnaby and Lyra speak of "the heroes who climbed";
// Aetherion's own quest too). Her fall is the reveal: the Amnesiac's farewell says the break shows twelve Houses, and the Codex opens its sealed pages.
//   [SERVE_ROOT=<dir with serve.js, data, art>] [PORT=n] node scripts/twelve_gate_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync, readFileSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11971';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--')); const FILE = cand ? path.basename(cand) : 'mojiworld_game.html';
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + String(d).slice(0, 260) + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const src = readFileSync(path.join(SERVE_ROOT, FILE), 'utf8');
const code = src.split('\n').filter((l) => !/^\s*\/\//.test(l)).map((l) => l.replace(/\s\/\/ .*$/, '')).join('\n');
// ---- source: the gate, the gated NPC lines and the captains' questions
const gi = code.indexOf('function _lxTwelveKnown()'), gate = gi >= 0 ? code.slice(gi, gi + 900) : '';
check(gi >= 0 && /bestiary\.aetherion/.test(gate) && /aetherionDown/.test(gate) && /frag_aetherion/.test(gate) && /zodiacDefeated/.test(gate) && !/q_distorted_portal|player\.master/.test(gate), 'the gate exists: Aetherion felled (kill count, achievement or Keystone), or a House already fallen; no longer the Master trial', '');
for (const t of ['Who went up with the oath?', 'Why is nothing ever finished here?', 'Why is the Jade Grove empty?', 'Why patience, not fury?']) check(new RegExp("else if \\(typeof _lxTwelveKnown === 'function' && _lxTwelveKnown\\(\\)\\) opts\\.push\\(\\{ t:'" + t.replace(/[?]/g, '\\?') + "'").test(code), `the captain's question "${t}" (about the champion their order raised) waits for the gate`, '');
check(/\(\(typeof _lxTwelveKnown === 'function' && _lxTwelveKnown\(\)\) \? 'Twelve champions were raised to ask for the dreaming back\./.test(code), "the Amnesiac's \"Why was I sent here?\" page tells of the Twelve only after the gate", '');
check(/\(\(typeof _lxTwelveKnown === 'function' && _lxTwelveKnown\(\)\) \? 'Twelve Houses hold it still\./.test(code) && /Something holds it still\. I have counted every age from this step\./.test(code), "the sage's pre-reveal page says \"Something holds it still\" until the gate", '');
check(/to do what twelve ages of others could not/.test(code) && !/twelve ages of champions/.test(code) && /had watched the first climb end in flames/.test(code) && !/watched the first champion burn/.test(code), "Will's pages do not speak of champions before the gate", '');
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } }); await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof _lxTwelveKnown === 'function' && typeof _renderLoreTab === 'function' && typeof QUESTS === 'object' && typeof NPC_CHAT_LINES === 'object' && typeof STORY_BEATS === 'object', null, { timeout: 180000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; } applyClass('warrior'); player.level = 62; player.master = 'knight'; player.dawnFragments = []; game.bestiary = {}; game.achievements = game.achievements || {}; delete game.achievements.aetherionDown; player.quests = { active: {}, completed: { q_distorted_portal: true }, unlocked: {}, fresh: {} }; try { _ensureQuests(); } catch (e) {} game.paused = false; });
  await page.waitForTimeout(800);
  const R = await page.evaluate(async () => {
    const out = {}; const body = document.getElementById('lore-body'); const vis = (tab) => { openLoreMap(tab); const r = { text: body.innerText, html: body.innerHTML, epi: document.getElementById('cdx-epi').textContent }; closeLoreMap(); return r; };
    const LEAK = /the Twelve\b|Twelve champions|twelve champions|Zodiac champions|\bHouses?\b|Zodiac|champions failed/;
    const amn = async () => { try { const npc = Object.values(MAPS).flatMap((m) => m.npcs || []).find((n) => n.role === 'amnesiac' || /Amnesiac/i.test(n.name || '')); game._amnesiacStage = 6; openNPC(npc); } catch (e) { out.amnErr = String(e); } await new Promise((r) => setTimeout(r, 6500)); const t = (document.getElementById('dialog-text') || {}).innerText || ''; try { closeDialog(); } catch (e) {} game._amnesiacStage = 0; return t; };
    // a Lv 62 master who has finished the Master trial but has NOT felled Aetherion: still sees none of it
    out.before = { known: _lxTwelveKnown(), world: vis('world'), zodiac: vis('zodiac'), factions: vis('factions') }; out.leak = LEAK.source;
    out.earlyQuests = Object.entries(QUESTS).filter(([id, q]) => (q.levelReq | 0) < 70).filter(([id, q]) => /\bthe Twelve\b|twelve champions|Zodiac champions|\bHouses?\b|Zodiac|Taur\b|Virga|Sagitta|Ariel|champions/.test(String(q.desc || ''))).map(([id, q]) => id + '@' + q.levelReq);
    out.bubbles = Object.entries(NPC_CHAT_LINES).filter(([k, v]) => [].concat(v).some((l) => /the Twelve\b|Twelve Houses|\bHouses?\b|Zodiac|champions/i.test(String(l)))).map(([k]) => k);
    out.amn1 = await amn();
    // the ways to know: her kill count, her achievement, her Keystone, a House already fallen
    out.ways = {};
    game.bestiary = { aetherion: 1 }; out.ways.kill = _lxTwelveKnown(); game.bestiary = {};
    game.achievements.aetherionDown = true; out.ways.ach = _lxTwelveKnown(); delete game.achievements.aetherionDown;
    player.dawnFragments = ['frag_aetherion']; out.ways.frag = _lxTwelveKnown(); player.dawnFragments = [];
    out.ways.none = _lxTwelveKnown(); player.level = 99; player.master = 'knight'; out.ways.levelAndMasterAlone = _lxTwelveKnown(); player.level = 62;
    // after she falls
    game.bestiary = { aetherion: 1 };
    out.after = { known: _lxTwelveKnown(), world: vis('world'), zodiac: vis('zodiac'), factions: vis('factions') };
    out.amn2 = await amn();
    out.warden = STORY_BEATS.warden_falls.stanzas.map((s) => { try { return typeof s.text === 'function' ? s.text({}) : s.text; } catch (e) { return ''; } }).join(' || ');
    game.bestiary = {};
    return out;
  });
  const LEAK = new RegExp(R.leak); const B = R.before, A = R.after;
  check(B.known === false, 'a Lv 62 master who has finished the Master trial but not felled Aetherion does not know the Twelve', J(B.known));
  check(!LEAK.test(B.world.text) && !/The Twelve & the Doomed/i.test(B.world.text), 'the Codex World page shows nothing of the Twelve, the Houses or the champions before she falls', (B.world.text.match(LEAK) || [''])[0]);
  check(/Sealed/i.test(B.zodiac.text) && !/Failed Dream-Bringers|Ariel|Pisces/i.test(B.zodiac.text) && B.zodiac.epi === 'Sealed for now.' && /when the one who broke the sky falls/.test(B.zodiac.text), 'the Zodiac tab is sealed ("opens when the one who broke the sky falls") and its subtitle too', B.zodiac.text.slice(0, 90) + ' | ' + B.zodiac.epi);
  check(!/Its House/i.test(B.factions.text) && !/Four of the Twelve/.test(B.factions.text) && !/first champion/.test(B.factions.text) && /Bastion/.test(B.factions.text), 'the Standings page keeps the four orders but not their Houses, nor "Four of the Twelve", nor the first champion', (B.factions.text.match(/.{0,30}(Its House|Four of the Twelve|first champion).{0,30}/) || [''])[0]);
  check(R.earlyQuests.length === 0, 'no quest below Lv 70 names the Twelve, the Houses, a zodiac champion or the Zodiac (the Smith, Barnaby, Lyra and Aetherion speak of "the heroes who climbed")', J(R.earlyQuests));
  check(R.bubbles.length === 0, 'no base idle bubble mentions the Twelve, the Houses, the Zodiac or champions', J(R.bubbles));
  check(!R.amnErr && /watcher sent you/.test(R.amn1) && !/Twelve champions/.test(R.amn1), "the Amnesiac's \"Why was I sent here?\" page: before she falls it ends at the watcher and does not mention the Twelve", (R.amnErr || R.amn1).slice(0, 160));
  check(A.known === true && /The Twelve & the Doomed/i.test(A.world.text) && /Zodiac champions/.test(A.world.text) && /the Twelve and the Weight-Bearer/.test(A.world.text), 'after she falls the Codex World page tells of the Twelve again', '');
  check(!/Sealed/i.test(A.zodiac.text) && /Failed Dream-Bringers/i.test(A.zodiac.text) && A.zodiac.epi !== 'Sealed for now.', 'after she falls the Zodiac tab opens', A.zodiac.epi);
  check(/Its House/i.test(A.factions.text) && /Four of the Twelve/.test(A.factions.text), 'after she falls the Standings page shows each order\'s House', '');
  check(/Twelve champions were raised/.test(R.amn2), 'after she falls the Amnesiac tells of the Twelve', R.amn2.slice(0, 120));
  check(R.ways.kill === true && R.ways.ach === true && R.ways.frag === true && R.ways.none === false && R.ways.levelAndMasterAlone === false, 'the gate opens on her kill count, her achievement or her Keystone, and not on level or class alone', J(R.ways));
  check(/Look up, foreigner\. With her gone the break shows what it hid: twelve Houses, and a champion still waiting in each\./.test(R.warden), "her fall is the reveal: the Amnesiac's farewell says the break shows twelve Houses, and a champion waiting in each", R.warden.slice(0, 200));
  check(errs.length === 0, 'no page errors', errs.slice(0, 3).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
