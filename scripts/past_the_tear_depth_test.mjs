// THE LINE PAST THE TEAR, WITH DEPTH (per user, 2026-10-11: "Raise the cap and add depth to the quest text"). The story-quest prose cap went 5,000 -> 5,600, the Barnaby / Tear
// chapters 170 -> 190 and the quests below 120 -> 170, and these beats were added to the quests themselves:
//   Four Captains: the four once rode out together and could not agree who should lead; Distorted Portal: the four argued over who should enter, the only one who came this close went
//   alone; The Forge That Broke: the Smith remembers the blade better than the woman and is sorry; The Last Step: she struck the curse once, what struck back took her name, one sword was
//   forged by a hand that is sorry; The Sanctum's Refusal: the curse has no edge; The Tear III: the edge is a cut only a blade made for it leaves; The Tear VI: her unfinished line;
//   Long Dawn II: the four sit in one room at last; The Law of the Kindest Hand: whose blade he is sorry for.
//   1. every beat is in its quest; 2. every touched quest fits its new cap and the total stays under 5,600 (and above 5,000); 3. the lines the user pasted are intact;
//   4. none of the added passages names Mira, the Twelve, a House, a champion or the maker; 5. no page errors.   node scripts/past_the_tear_depth_test.mjs
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11799), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
const BEATS = [
  ['q_four_captains', 'The four once rode out together, after whatever the rumours said stood behind all this, and could not agree who should lead.'],
  ['q_four_captains', 'Ask any of them why, and notice whose name they leave out.'],
  ['q_distorted_portal', 'The four argued a season over who should go past the mouth, and settled it the usual way: nobody.'],
  ['q_distorted_portal', 'The Eleventh Hour, the last hour of one night, held open.'],
  ['q_distorted_portal', 'The first to go up the road for answers went without them, and has not come back down it.'],
  ['q_boss_sundered_smith', 'He remembers the blade better than the woman who carried it, and never learned whether it cut.'],
  ['q_boss_sundered_smith', 'He turns every finished blade over once, looking for the flaw.'],
  ['q_last_step', 'She had gone up the road to break the curse on this world, and the copy remembers one blow struck at the gate. What struck back took its name and the rest.'],
  ['q_last_step', 'The other is so well made it hurts to look at, and she cannot remember who made it, or why she will not put it down.'],
  ['q_boss_aetherion', 'The curse the woman came to cut has no edge; her weeping was the only thing it ever gave back.'],
  ['q_lyra_cut', 'Only one thing leaves an edge like that: a blade made to cut what cannot be cut.'],
  ['q_lyra_last', 'Beneath it, in her own hand, is one line she did not finish: "It was never meant to'],
  ['q_long_dawn_2', 'for the first time since the quarrel, the four orders sit in one room.'],
  ['q_kindest_hand', 'Ask him what he made; he will tell you, and it will cost him.'],
];
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof QUESTS !== 'undefined' && typeof openNPC === 'function', null, { timeout: 180000 });
  const R = await page.evaluate(() => {
    const w = (t) => String(t || '').replace(/<[^>]+>/g, '').split(/\s+/).filter((x) => /[A-Za-z]/.test(x)).length;
    const d = (id) => String((QUESTS[id]._lxDesc0 != null ? QUESTS[id]._lxDesc0 : QUESTS[id].desc) || '');
    const ids = ['q_four_captains', 'q_distorted_portal', 'q_boss_sundered_smith', 'q_last_step', 'q_boss_aetherion', 'q_lyra_cut', 'q_lyra_last', 'q_long_dawn_2', 'q_kindest_hand', 'q_lyra_forge', 'q_barnaby_hands', 'q_barnaby_roll', 'q_lyra_aperture', 'q_lyra_loan'];
    const out = { desc: {}, words: {} }; for (const id of ids) { out.desc[id] = d(id); out.words[id] = w(d(id)); }
    out.names = { tear3: QUESTS.q_lyra_cut.name };
    out.fiveText = String((QUESTS.q_barnaby_five || {}).desc || '');
    out.legend = (typeof BOSS_INTROS === 'object' && BOSS_INTROS.young_confused_barnaby) ? BOSS_INTROS.young_confused_barnaby.lore : '';
    out.maps = { name: (MAPS.confusedVigil || {}).name, portals: Object.keys(MAPS).flatMap((id) => (MAPS[id].portals || []).map((p) => id + ': ' + p.name)).filter((s) => /Confused Vigil/.test(s)) };
    out.total = Object.keys(QUESTS).filter((id) => QUESTS[id].story || QUESTS[id].advancement).reduce((t, id) => t + w(d(id)), 0);
    return out;
  });
  const miss = BEATS.filter(([id, s]) => R.desc[id].indexOf(s) < 0).map(([id, s]) => id + ': ' + s.slice(0, 40));
  ok('[1] every added beat is in its quest (' + BEATS.length + ' passages across nine quests)', miss.length === 0, miss);
  const cap = (id) => (/^q_(barnaby|lyra)_/.test(id) ? 190 : 170);
  const over = Object.entries(R.words).filter(([id, n]) => n > cap(id));
  ok('[2] every touched quest fits its new cap (Tear chapters 190, the rest of the line 170)', over.length === 0, R.words);
  ok('[2] the story prose is above its old 5,000 and under the new 5,600', R.total > 5000 && R.total < 5600, R.total);
  const D = R.desc;
  ok('[3] the lines the user pasted are intact: the Portal ends "Past him, the tear runs on.", the Forge opens on the young smith you set free, the Last Step opens on the ashes', /Past him, the tear runs on\.$/.test(D.q_distorted_portal) && /^The Eleventh Hour, that one night held open, broke like a mirror, and the young smith you set free did not walk out of it\. Past it, a hammer is still ringing\./.test(D.q_boss_sundered_smith) && /^The Smith set his hammer down, and his ashes did not fall\. They drifted down the tear, as if someone below had called for them\./.test(D.q_last_step), [D.q_distorted_portal.slice(-40), D.q_last_step.slice(0, 60)]);
  ok('[3] the Smith\'s card still never names Barnaby, and The Forge That Broke still says the Forge handed him back', !/Barnaby/.test(D.q_boss_sundered_smith) && /The loan was closed, and the Forge has handed him back\./.test(D.q_boss_sundered_smith), '');
  const added = BEATS.map(([, s]) => s).join(' ');
  ok('[4] none of the added passages names Mira, the Twelve, a House, a champion or the maker', !/\bMira\b|Twelve|Zodiac|Houses?\b|champion|Guguma|creator|maker|playground|entertain|extraterrestrial|\bgame\b/i.test(added), added.match(/\bMira\b|Twelve|Zodiac|House|champion|Guguma|creator|maker|playground|entertain/gi));
  ok('[5] the name is explained before it is paid off: the Portal quest says it is the last hour of one night, held open, and the boss card says the hammer is still coming down in the eleventh hour of that night', /The Eleventh Hour, the last hour of one night, held open./.test(R.desc.q_distorted_portal) && /in the eleventh hour of that night/.test(R.legend), R.legend.slice(0, 120));
  ok('[5] the map is The Eleventh Hour everywhere the player reads it: its own name and every portal label (the Stage Editor bake overrides portals at boot)', /The Eleventh Hour$/.test(R.maps.name || '') && R.maps.portals.length === 0, R.maps);
  ok('[8] one timeline, no conflicts: the blade came before the sky fell and the forge was left cold; she led her own company (never "alone" beside the Sage\'s twelve hearts); the four never entered together; the Hesitant is the COPY and remembers one blow', /Before the sky fell, the woman at the gate came to his bench with one order/.test(D.q_lyra_forge) && /left her forge cold\. He took on her forge four years ago, and kept it until he built his own below/.test(D.q_lyra_forge) && !/Four years ago the Bastion/.test(D.q_lyra_forge) && /led her own company up the road/.test(D.q_barnaby_roll) && !/ alone/.test(D.q_distorted_portal + D.q_barnaby_roll + D.q_lyra_forge) && /past the mouth/.test(D.q_distorted_portal) && /the copy remembers one blow/.test(D.q_last_step) && !/took her name/.test(D.q_last_step), '');
  ok('[8] the tear has one cause: Tear III no longer blames the Weight-Bearer\'s lift, is called What the Blade Left Behind, and the Academia\'s record stays a true fact with a false cause; Tear 0 and I date the ring and Lyra to the tear, not to a frozen spring', /^The Tear III .{1,3}What the Blade Left Behind$/.test(R.names.tear3) && !/Weight-Bearer/.test(D.q_lyra_cut) && /Two true facts, one false cause/.test(D.q_lyra_cut) && /Something has been widening it since the night the sky came down/.test(D.q_lyra_cut) && /Since a tear opened at the western awning the ring/.test(D.q_lyra_aperture) && /since the tear opened, Lyra/.test(D.q_lyra_loan), R.names.tear3);
  ok('[8] the rumour list gives nothing away early (the Smith rumour is underlined, not confirmed), Will\'s white blade is not Barnaby\'s work, and the foundry has its name', /Brok has underlined that one twice/.test(D.q_barnaby_roll + R.fiveText) && !/it is the only story that explains the steel/.test(R.fiveText) && /Magma Foundry/.test(R.fiveText) && /Will's white blade has a page in it: brought in each spring, handed back untouched/.test(D.q_barnaby_roll), '');
  ok('[9] no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 200), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
