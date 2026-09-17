// Renders docs/reports/LAUNCH_READINESS.html from the launch audit's evidence files. Measured items read the
// probe outputs (launch_smoke_probe.mjs JSON, save_corruption_probe.mjs log, the static suite log); the rest is
// the checklist as reviewed on 2026-09-17. Re-run after any probe to refresh the numbers.
//   node scripts/launch_readiness_report.mjs --smoke=smoke.json --save=save.txt --suite=suite.txt --content=audit_content.json --out=docs/reports/LAUNCH_READINESS.html --ver=v0.30.790
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=').slice(1).join('=') : d; };
const rd = (p) => (p && existsSync(p)) ? readFileSync(p, 'utf8') : null;
const smoke = rd(arg('smoke')) ? JSON.parse(rd(arg('smoke'))) : null, save = rd(arg('save')), suite = rd(arg('suite')), content = rd(arg('content')) ? JSON.parse(rd(arg('content'))) : null;
const VER = arg('ver', smoke ? smoke.ver : 'current'), OUT = arg('out', 'docs/reports/LAUNCH_READINESS.html');
const FIXVER = arg('fixver', 'v0.30.791');   // the polish commit's version; the item texts below say "v0.30.789" and are rewritten to it
const n = (v) => (v == null ? '—' : Number(v).toLocaleString());
const saveLine = save ? (save.match(/(\d+)\/(\d+) checks passed/) || [])[0] : null;
const suiteLine = suite ? (suite.match(/SUITE (\d+) passed, (\d+) failed(?:, (\d+) skipped)?/) || [])[0] : null;
const suiteFails = suite ? [...suite.matchAll(/^FAILED (\S+)/gm)].map((m) => m[1]) : [];
let sm = null;
if (smoke) {
  const mapsBad = smoke.maps.filter((m) => m.err || m.newErrors || m.fell), skillsBad = smoke.skills.filter((s) => s.err || s.newErrors), panelsBad = smoke.panels.filter((p) => p.err || p.newErrors || (p.leaks && p.leaks.length));
  const worst = smoke.maps.slice().sort((a, b) => (b.worst || 0) - (a.worst || 0)).slice(0, 5), heaps = smoke.maps.map((m) => m.mem).filter((x) => x != null);
  sm = { mapsBad, skillsBad, panelsBad, worst, heapMax: heaps.length ? Math.max(...heaps) : null, uniq404: [...new Set((smoke.notFound || []).map((x) => x.url))] };
}
const S = { pass: 'PASS', fixed: 'FIXED', partial: 'PARTIAL', fail: 'FAIL', decide: 'DECIDE', pending: 'PENDING', human: 'HUMAN STEP' };
const items = [];
const add = (pillar, id, title, status, evidence, action) => items.push({ pillar, id, title, status, evidence, action: action || '' });

// A. Stability
add('A. Stability', 'A1', 'Boots like a player (no dev flag) to the title menu with no error', smoke ? (smoke.boot.menuVisible && !smoke.boot.errorsDuringBoot ? S.pass : S.fail) : S.pending, smoke ? `scripts ready ${n(smoke.boot.scriptsReadyMs)} ms, title menu showing, ${smoke.boot.errorsDuringBoot} errors and ${smoke.boot.notFoundDuringBoot} missing files during boot` : 'launch_smoke_probe.mjs not run');
add('A. Stability', 'A2', 'Every map loads without a runtime error and the player does not fall out of the world', sm ? (sm.mapsBad.length ? S.fail : S.pass) : S.pending, sm ? `${smoke.maps.length} maps, ${sm.mapsBad.length} with a problem${sm.mapsBad.length ? ': ' + sm.mapsBad.map((m) => m.id).join(', ') : ''}` : '');
add('A. Stability', 'A3', 'Every skill casts without throwing (all classes, jobs and masters)', sm ? (sm.skillsBad.length ? S.fail : S.pass) : S.pending, sm ? `${smoke.skills.length} skills, ${sm.skillsBad.length} threw${sm.skillsBad.length ? ': ' + sm.skillsBad.map((s) => s.id).join(', ') : ''}` : '');
add('A. Stability', 'A4', 'Every panel opens without throwing and without "undefined" / "NaN" in its text', sm ? (sm.panelsBad.length ? S.fail : S.pass) : S.pending, sm ? `${smoke.panels.length} panels, ${sm.panelsBad.length} with a problem${sm.panelsBad.length ? ': ' + sm.panelsBad.map((p) => p.fn + (p.leaks && p.leaks.length ? ' (' + p.leaks.join(',') + ')' : '')).join(', ') : ''}` : '');
add('A. Stability', 'A5', 'One exception in a frame cannot stop the game loop - and a PERMANENT one recovers', S.fixed, '_lxFrame wraps loop() in try/catch; dt clamped to 100 ms. v0.30.834: a frame that throws every time used to freeze the picture for ever, silently (2,400 console lines in 40 s, no message). The run of throws is now counted: at 120 the scene is cleared, a hero stuck at 0 HP is stood up and the player is returned to town with a message; at 900 the game asks for a reload. launch_hardening_test reproduces it with a poisoned monster and with a throw inside the death path.');
add('A. Stability', 'A6', 'Errors outside the frame loop are logged and the player is told', S.fixed, 'v0.30.789 _lxCrashNotes: window error + unhandledrejection, one console line per message, a note at most every 30 s (was: silent)');
add('A. Stability', 'A7', 'No loading gate can hang forever', S.pass, 'every boot gate has a hard cap; 15 s loop-side failsafe forces the overlay open');
add('A. Stability', 'A8', 'A damaged save never bricks the boot or destroys data', saveLine ? (/^(\d+)\/\1 /.test(saveLine) ? S.pass : S.fail) : S.pending, saveLine ? `save_corruption_probe: ${saveLine} (garbage, truncated, null, number, empty, old version)` : 'save_corruption_probe.mjs not run', 'the original bytes are kept under levelx_save_v1_recover');
add('A. Stability', 'A9', 'Canvas context loss is handled', S.fixed, 'v0.30.798: on a lost 2D context the game flushes the save, tells the player and reloads, at most once a minute (launch_art_test: prevented, 1 flush, reload stamped)');
add('A. Stability', 'A10', 'Returning from a hidden tab does not replay a burst of game time', S.pass, 'elapsed clamped 0..100 ms; accumulator capped');
// B. Performance
add('B. Performance', 'B1', 'Time to interactive', smoke ? (smoke.boot.scriptsReadyMs < 8000 ? S.pass : S.partial) : S.pending, smoke ? `${n(smoke.boot.scriptsReadyMs)} ms until the game code is ready on a headless test browser (slower than a real one; the 2026-09-08 audit measured 1.1 s on a real one)` : '');
add('B. Performance', 'B2', 'Map-load hitches', sm ? (sm.worst[0] && sm.worst[0].worst > 1500 ? S.partial : S.pass) : S.pending, sm ? 'worst single frame around a map load: ' + sm.worst.map((m) => `${m.id} ${n(m.worst)} ms`).join(', ') + ' (headless browser; relative, not absolute)' : '');
add('B. Performance', 'B3', 'No heap growth across a full map tour', sm ? ((smoke.finalMem || 0) < 600 ? S.pass : S.partial) : S.pending, sm ? `heap ${n(smoke.finalMem)} MB after ${smoke.maps.length} maps + ${smoke.skills.length} skills + ${smoke.panels.length} panels (peak ${n(sm.heapMax)} MB)` : '');
const webboot = arg('webboot', '');   // "before -> after" text for the live play-link boot, measured in a real browser
add('B. Performance', 'B7', 'First boot on the web play link (real browser, real connection)', S.fixed, webboot || 'v0.30.794 + v0.30.806 + v0.30.808. The page and its scripts were never the problem (ready in 1.9 s on the live site); the title menu waits for 172 files (35 MB) while parse-time loaders had started 2,259 more image requests (379 MB) on the same CDN connection. v0.30.806 holds every image the menu does not need until the menu is up (web deploys only): same CDN, same commit, back to back, 29-32 s -> 8-11 s to the menu, 2,431 -> 413 requests before it; boot_hold_test 12/12. On the live site (play.moji-studios.com, measured minutes after a deploy, so a cold CDN): 23.6 s -> 11.8-16.6 s, 2,442 -> 408 requests before the menu. v0.30.808: the Pages deploy pinned all art to the pushed commit, so every push emptied the CDN and every returning player\'s cache; each art folder is now pinned to the last commit that touched it', 'the page is still 9.7 MB (3 MB on the wire, about 3 s of the boot); the README play link is now https://play.moji-studios.com/');
add('B. Performance', 'B4', 'Boss art is decoded off the main thread before a fight', S.pass, 'v0.30.775; boss_decode_stall_test 11/11 (Gravitos decodes 172 → 21, slow frames 215 → 39)');
add('B. Performance', 'B5', 'Download size', S.partial, 'Sprites 647 MB, audio 198 MB, cinematics 144 MB, backgrounds 113 MB, game 9.7 MB in the repo. v0.30.801 deleted the 29 superseded floor / platform tiles (16.2 MB, referenced nowhere). Web loads lazily; the Steam depot excludes the 23 MB of audio backups (v0.30.789)', 'the remaining orphans are the 23 MB of audio backup folders: delete them once nobody needs the pre-regeneration sounds');
add('B. Performance', 'B6', 'Background asset warm-up', S.partial, 'pulls the whole 819 MB manifest to every fresh device over time (paced, pauses when frames are slow, respects Save-Data / 2G); v0.30.789 skips it on CDN-backed deploys where every request was a 404', 'consider limiting the warm-up to the current map\'s neighbours');
// C. Content
if (content) {
  add('C. Content', 'C1', 'Every map is reachable and every portal leads somewhere', (content.maps.unreachable.length || content.maps.badPortals.length) ? S.fail : S.pass, `${content.maps.count} maps; unreachable: ${content.maps.unreachable.join(', ') || 'none'}; bad portals: ${content.maps.badPortals.length}`);
  add('C. Content', 'C2', 'The quest chain has no gaps and every target exists', content.quests.issues.length ? S.partial : S.pass, `${content.quests.count} quests; ${content.quests.issues.length} issues${content.quests.issues.length ? ': ' + content.quests.issues.slice(0, 4).map((q) => q.quest + ' — ' + q.issue).join('; ') : ''}`);
  add('C. Content', 'C3', 'All 4 classes × 8 jobs × 16 masters are complete (body, icon, sound)', (content.classes.skillsWithoutBody.length || content.classes.skillsWithoutIcon.length) ? S.fail : S.pass, `no body: ${content.classes.skillsWithoutBody.join(', ') || 'none'}; no icon: ${content.classes.skillsWithoutIcon.join(', ') || 'none'}; no sfx: ${content.classes.skillsWithoutSfx.join(', ') || 'none'}; legacy still wired: ${content.classes.legacyStillWired.join(', ') || 'none'}`);
  add('C. Content', 'C4', 'Bosses have intros, and the finale leads somewhere', S.fixed, 'v0.30.797: intro cards for the eight named bosses that only had a spawn banner; all 21 boss arenas resolve a card (dev_surface_and_intro_test 7/7). v0.30.803: finishing the story unlocks Dawn\'s Favor for good - +10% EXP from kills, +10% Mojicoins, the Everdawn Aura - read from what the save already records, so finished saves have it too; closing the credits opens the new Titles panel, where the 13 titles the game grants can finally be chosen (postgame_unlock_test 14/14)');
  add('C. Content', 'C5', 'No player-visible stubs or dead buttons', content.stubs.filter((s) => s.playerVisible).length ? S.partial : S.pass, `${content.stubs.length} stubs found, ${content.stubs.filter((s) => s.playerVisible).length} player-visible${content.stubs.filter((s) => s.playerVisible).length ? ': ' + content.stubs.filter((s) => s.playerVisible).slice(0, 4).map((s) => s.what + ' (L' + s.line + ')').join('; ') : ''}`);
  add('C. Content', 'C6', 'Every achievement can actually fire', content.achievements.neverFired.length ? S.partial : S.pass, `${content.achievements.count} achievements; never fired: ${content.achievements.neverFired.join(', ') || 'none'}`);
} else add('C. Content', 'C1', 'Content completeness audit (maps, quests, classes, bosses, stubs, achievements)', S.pending, 'audit_content.json not available');
add('C. Content', 'C8', "Bloodmoon Domain's execute spares bosses", S.fixed, 'the execute guard read m.boss, which only boss type definitions carry: a mini-boss at 20% HP (and any boss spawned from a normal type) was executed. Confirmed in the running game (mini-boss 20% → −0.6%); the guard now uses isBoss / isMiniBoss / zodiacBoss like the rest of the game (bloodmoon_execute_test 6/6)');
add('C. Content', 'C7', 'Every asset the game asks for exists', S.fixed, '853 literal paths, 72/72 skill icons, all sfx, frame index: 0 missing. v0.30.798 drew the 14 images that had only ever been emoji fallbacks: 5 quest-type tiles, 8 potion icons, Verdant Haven\'s world-map emblem (scripts/gen_launch_gap_icons.mjs; launch_art_test 4/4, binaries verified on origin)');
// D. UI, UX and copy
add('D. UI & copy', 'D1', 'Skill descriptions match the code', S.pass, 'v0.30.782 / 785 / 788: 69 + 39 + 7 descriptions rewritten; skill_desc_accuracy_test reads 27 numbers from the running game (13/13)');
add('D. UI & copy', 'D2', 'On-screen controls text is correct', S.fixed, 'v0.30.789: strip said B Bag / R T Pots (B = master ultimate, potions = PgUp/PgDn); help panel dropped the dead Dev Console 1+2+3 row');
add('D. UI & copy', 'D3', 'No internal build numbers or removed-system notes in player text', S.fixed, 'v0.30.789: DEF and Crit tooltips, attribute panel note, Wardrobe "v0.25.629" chip');
add('D. UI & copy', 'D4', 'No developer wording in gameplay toasts', S.fixed, 'v0.30.789: "GODMODE" recovery window → INVULNERABLE / Aegis holds');
add('D. UI & copy', 'D5', 'Consistent spelling and casing', S.fixed, 'v0.30.798: the seven British spellings in UI labels and toasts are American like the rest of the UI; NPC dialogue keeps the spelling it was written in. v0.30.801: every player-visible string says Mojicoins (28 were lowercase) and MojiDex; a checker proves only the case of 29 letters changed and no identifier was touched. v0.30.803: the U panel\'s L button is named after the panel it opens (Compendium)');
add('D. UI & copy', 'D6', 'Quest journal rows with embedded numbered lists', S.partial, 'two quest descs use \\n lists; the row is one line with an ellipsis, the full text shows in the hover title', 'rewrite the two descs as prose or render the detail pane with pre-line');
add('D. UI & copy', 'D7', 'Accessibility basics: reduced motion, rebindable keys, controller', S.pass, 'game._reduceMotion honoured by heavy FX; keybind modal; controller map in the help panel; Steam Deck layout');
add('D. UI & copy', 'D8', 'Phone / narrow layouts', S.human, 'covered by the mobile-ui-pass branch and MOBILE_GAMEPLAY_AUDIT.html; not re-tested in this pass', 'play one session on a phone before launch');
// E. Dev tools and cheating
add('E. Dev tools', 'E1', 'Dev tools are not reachable by players in the shipped build', S.fixed, 'v0.30.797 (owner\'s decision): dev tools exist only on developer surfaces - file://, localhost, a LAN address - and never in the packaged Steam app (steam/preload exposes MOJI_PACKAGED). On a public hostname ?dev=1 is ignored, there is no lock icon, the passphrase and the backtick prompt do nothing, openDevConsole refuses. dev_surface_and_intro_test 7/7 (localhost / fake public host / packaged flag)', 'known limit: the portable zip runs on localhost, so it still counts as a developer surface');
add('E. Dev tools', 'E2', 'Developer diagnostics are out of player Settings', S.fixed, 'v0.30.789: "Show Scale Debug" row appears only once dev tools are unlocked');
add('E. Dev tools', 'E3', 'Console is quiet in production', S.partial, '64 of 67 console.* calls are ungated boot / cache / audio notes; none per frame', 'route through a logger that no-ops unless dev tools are on');
// F. Saves and progression
add('F. Saves', 'F1', 'Autosave cadence and save-on-leave', S.pass, '1.5 s debounce, 30 s heartbeat, flush on visibilitychange / unload; 5 backup slots; multi-tab warning');
add('F. Saves', 'F2', 'Storage full is handled', S.pass, 'QuotaExceededError detected → toast, save kept in memory');
add('F. Saves', 'F3', 'Save version migration', S.partial, 'SAVE_VERSION has never been bumped (v=1); the only path for another version is "start fresh" with a _recover copy', 'when v2 is needed, add a forward migration instead of a reset');
add('F. Saves', 'F4', 'Web account cloud saves', S.partial, 'dormant, not broken: the shipped menu (v0.27.8) signs players in by character name only; LXAuth.login / register, the cloud push and the _lxCloudSyncOnLogin pull have no callers, so nothing promises cross-device sync today. Steam Cloud is wired at boot (_lxSteamCloudSync, newest-wins with a backup slot)', 'if web accounts come back, call _lxCloudSyncOnLogin after sign-in and at boot, mirroring the Steam path');
add('F. Saves', 'F5', 'Export / import', S.pass, 'exportSave / exportSaveSecure (signed .moj) / importSave with a recover copy on mismatch');
// G. Online
add('G. Online', 'G1', 'The shipped co-op relay answers fast', S.pass, 'wss://mojiworld-mp.dpeh001.workers.dev: connect 0.8 s, 6/6 relay checks (the retired Render relay took 102 s from cold)');
add('G. Online', 'G2', 'A slow or dead relay is explained to the player', S.pass, '4 s "Connecting…" → countdown banner → hard deadline with a message; solo play never waits on the relay');
add('G. Online', 'G3', 'Player-supplied text is escaped', S.pass, 'escapeHtml at every innerHTML sink for names and chat; scrubbed at ingestion');
add('G. Online', 'G4', 'Account passwords are hashed with a real KDF', S.partial, 'mp-cf worker: salted single SHA-256, no stretching; the account UI is dormant (see F4), so no player password is stored today', 'before re-enabling accounts, switch the worker to PBKDF2 / scrypt with a re-hash on next login');
add('G. Online', 'G5', 'Offline web play', S.partial, 'the service worker caches same-origin art only; on the CDN-backed web deploy nothing heavy is cached, so the web build needs a connection. The portable zip and Steam build are fully offline', 'acceptable for a web build; say so on the page');
// H. Platform and distribution
add('H. Distribution', 'H1', 'Steam depot contains every runtime file', S.pass, 'extraResources filter matches the game\'s 13 data files, art, fonts and 22 cinematics exactly');
add('H. Distribution', 'H2', 'Steam build survives a renderer crash or hang', S.fixed, 'v0.30.789 steam/main.js: crash → reload, hang → Wait / Reload dialog, failed load → retry');
add('H. Distribution', 'H3', 'Devtools closed in the packaged app', S.fixed, 'v0.30.789: devTools: !app.isPackaged');
add('H. Distribution', 'H4', 'Steam package version matches the game', S.fixed, 'v0.30.789: 0.30.758 → 0.30.789 (CI also rewrites it)');
add('H. Distribution', 'H5', 'Windows code signing', S.human, 'ships unsigned until the AZURE_* signing secrets exist (docs/guides/CODE_SIGNING.md); Smart App Control machines refuse the bare exe; Steam\'s launcher mitigates most cases');
add('H. Distribution', 'H6', 'Steamworks store & review steps', S.human, 'App ID, depots, Steamworks config, invite QA, store page (see docs/guides/STEAM.md); the earlier Steam review failed only on the retired relay, which is fixed');
add('H. Distribution', 'H7', 'Returning browsers get replaced art', S.fixed, 'v0.30.789: service-worker cache key v58 → v59 (Knight Guardian aegis was redrawn in place in v0.30.769)');
add('H. Distribution', 'H8', 'Web deploy does not 404-storm', S.fixed, 'v0.30.789: the asset warm-up skips CDN-backed deploys (was 8,284 requests per device against the Pages origin)');
add('H. Distribution', 'H9', 'README is current', S.fixed, 'v0.30.789: build line and play instructions (was v0.29.25 and "open the file")');
// I. Security & privacy
add('I. Security', 'I1', 'No secrets in shipped files', S.pass, 'no API keys, tokens or emails in the game, sw.js, steam/ (dev passwords excepted — see E1)');
add('I. Security', 'I2', 'No telemetry, no tracking', S.pass, 'nothing is sent anywhere without the player acting (accounts, co-op); the flip side is zero crash visibility after launch', 'if crash reports are wanted, add an opt-in "send this error" button to the new crash note');
// J. Legal
add('J. Legal', 'J1', 'Licence file present', S.pass, 'LICENSE (proprietary) and assets/fonts/LICENSE-OFL.txt in the tree');
add('J. Legal', 'J2', 'Third-party credits shown in-game', S.fixed, 'v0.30.789: Credits & licences section in the ? help panel (OFL fonts, ludo.ai, Higgsfield, copyright)');
add('J. Legal', 'J3', 'Commercial rights for generated art, audio and cinematics', S.human, 'confirm the ludo.ai and Higgsfield plan terms allow commercial distribution and keep the confirmation with the store paperwork');
// K. Release process
add('K. Process', 'K1', 'Changelog current, newest on top', S.pass, 'CHANGELOG.html entry for every shipped change');
add('K. Process', 'K2', 'Browser-free test suite green on the shipped build', suiteLine ? (suiteFails.length ? S.partial : S.fixed) : S.pending, suiteLine ? `${suiteLine}${suiteFails.length ? ' - failing: ' + suiteFails.map((f) => f.replace(/\.mjs$/, '')).join(', ') : ''}. v0.30.804 cleared the 11 that were failing on main: two were real (Virga\'s feathered wing, boss walk timing computed for art that no longer exists) and were fixed in the game and the art; nine were tests pinned to numbers or code that later, deliberate changes had moved, each re-aimed with the commit it follows. The skipped ones need a git checkout or files outside the test root` : 'suite not run', suiteFails.length ? 'triage each failure to the commit that caused it before touching a threshold' : '');
add('K. Process', 'K3', 'Recurring-bug register', S.pass, 'docs/reports/KNOWN_BUGS.md: BUG-001 (wardrobe) last fixed v0.26.820 with a protected init chain; nothing reopened since');
add('K. Process', 'K4', 'Stale-rebuild protection on main', S.pass, 'push clobber gate + scripts/landed_fixes.json markers');
add('K. Process', 'K5', 'Rollback path', S.pass, 'preview branch for review builds; GitHub Releases zips; Steam build set live by hand');

// L. Loops, soft-locks and exploits - the second launch sweep (2026-09-17)
add('L. Loops & exploits', 'L1', 'Every loop is sure to end', S.fixed, 'all 88 while / do loops classified by how they terminate (counted, consuming, walking, arithmetic). One had no bound: Aetherion\'s teleport searched for a spot 300 px from the player for ever - impossible on an arena under ~1000 px (his are 1600-2000 today, so latent). Bounded in v0.30.834. No while(true) / for(;;) anywhere.');
add('L. Loops & exploits', 'L2', 'No reload loop', S.fixed, 'service-worker update and context-loss reloads are one-shot (sessionStorage / 60 s); boot always loads town, so no saved arena can trap a load; the cache never holds HTML or JS. v0.30.834: the Steam Cloud sync returned "reloading" even when the write failed (full storage) and reloaded for ever - it now verifies the write and reloads at most once a session.');
add('L. Loops & exploits', 'L3', 'No soft-lock in the first session or behind a panel', S.fixed, 'v0.30.834: the prologue Void cutscene read its timer before declaring it (black cover with no way out if play() threw); the prologue could finish twice; Up on the Void portal fired the onboarding gate under the intro; the boss-hardening poll outlived the prologue and would have made the REAL Gravitos kill a reward-less echo; the Titles panel lost its pause after 3 s. Checked sound: every video cutscene has onended + onerror + skip + a timer, the stuck-pause and death watchdogs, class select, respawn (5 input routes + 6 s auto), map exits.');
add('L. Loops & exploits', 'L4', 'The prologue\'s 120 s absolute cap', S.decide, 'the cap is one wall-clock timer armed at the start; a slow reader (the stanzas are player-paced) or slow clips can pass it mid-fight, which truncates the intro rather than locking it. Option: re-arm the cap per phase (fight arm, strip) and remove the cinematic covers on a forced finish.', 'Owner decision - the sequence is delicate and has its own tests.');
add('L. Loops & exploits', 'L5', 'Economy: the code does what its comments say', S.fixed, 'v0.30.833: Sage Mira\'s 12 h wait never applied (epoch ms read through | 0 = a negative number: unlimited boons at 5,000 coins); "reward-less" echoes (free Echo Keeper shade, Boss Rush, prologue Gravitos) dropped the first-kill budget of 3 boss pieces on demand; the FIRST Ticket Rush run of every stage paid the repeat rate (86 coins / 64,076 EXP instead of 342 / 128,153); Dawn\'s Favor paid +10% on shop sales. launch_econ_fixes_test 6/6 (previous build 1/6).');
add('L. Loops & exploits', 'L6', 'Repeatable-reward loops that are design calls', S.decide, 'read in code, not changed: (1) the Cursed Chest is re-rolled at 10% on EVERY map load and ignores the 15-minute chest cooldown - hopping a portal farms guaranteed legendaries; (2) zodiac echoes and the Nightmare echo keep the first-kill gear budget (3) with no cooldown, where a real refight gives 1 piece, 40% and a 10-minute timer; (3) rolling the system clock forward and back re-grants dailies, parcels, streak milestones and chest restocks; (4) a MojiMon summon (life 1e12) farms full EXP while the player is away; (5) a co-op guest trusts the host\'s kill frame for EXP and coins with no upper bound.', 'Recommended: seed the curse per (map, day) and respect the chest cooldown; give paying echoes the refight gear budget; skip the daily grant when the day goes backwards; pay minion-kill EXP only after recent input; clamp guest rewards against the monster table.');
add('L. Loops & exploits', 'L7', 'World data is consistent', S.pass, 'runtime dump of the live tables: 109 maps, 312 quests, 136 monster types, 72 skills - 0 portals to a missing map, 0 spawns or quest targets naming a missing monster, 0 quests with a missing prerequisite or giver, every skill implemented, every reachable map has a portal path back to town (the 14 portal-less maps are the tower / party-quest floors, which exit by their own flow), EXP cost per level positive and non-decreasing through Lv 260.');
add('L. Loops & exploits', 'L8', 'A long REAL session leaks nothing', S.pass, 'scripts/launch_soak_probe.mjs (new): 8 hunting maps, every skill in rotation, 281 kills, a forced death - heap 32 -> 28 MB, DOM nodes 2087 -> 2078, live intervals 10 -> 10, no game array growing, 0 runtime errors. The older soak_runtime_probe never left the empty prologue scene (0 monsters, 0 kills), so its "nothing grows" proved nothing.');

// ---- render ----
const counts = {}; for (const i of items) counts[i.status] = (counts[i.status] || 0) + 1;
const blockers = items.filter((i) => i.status === S.fail), decisions = items.filter((i) => i.status === S.decide || i.status === S.human), pending = items.filter((i) => i.status === S.pending);
const verdict = pending.length ? 'Evidence still being collected' : blockers.length ? `Not yet: ${blockers.length} blocker${blockers.length > 1 ? 's' : ''} to fix, ${decisions.length} decisions / human steps` : `Ready to launch once the ${decisions.length} decisions / human steps are done`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pill = (s) => `<span class="pill ${s.toLowerCase().replace(' ', '-')}">${s}</span>`;
const pillars = [...new Set(items.map((i) => i.pillar))];
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Mojiworld — Launch readiness</title>
<style>
:root{--bg:#14101f;--panel:#1e1830;--line:#3a3160;--text:#efeaf8;--muted:#a79fc0;--gold:#ffd46b;--good:#6be3a0;--warn:#ffb36b;--bad:#ff7a7a;--blue:#8fd0ff;color-scheme:dark}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 "Segoe UI",system-ui,sans-serif}
main{max-width:1100px;margin:0 auto;padding:18px 16px 80px}
h1{color:var(--gold);margin:0 0 4px;font-size:26px} h2{color:var(--gold);font-size:18px;margin:26px 0 8px;border-bottom:1px solid var(--line);padding-bottom:4px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px 16px;margin:12px 0}
.sum{display:flex;gap:10px;flex-wrap:wrap;margin:8px 0}
.sum div{background:#262040;border:1px solid var(--line);border-radius:10px;padding:6px 12px;font-size:13px}
.pill{display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.3px;white-space:nowrap}
.pill.pass{background:#1f5a3d;color:#c6ffe0}.pill.fixed{background:#204a6a;color:#cfeaff}.pill.partial{background:#5a4a14;color:#ffe9a8}.pill.fail{background:#6a2222;color:#ffd0d0}.pill.decide,.pill.human-step{background:#4a2a6a;color:#ead0ff}.pill.pending{background:#333;color:#ccc}
table{width:100%;border-collapse:collapse;font-size:13px} td,th{border-top:1px solid var(--line);padding:7px 8px;vertical-align:top;text-align:left} th{color:var(--muted);font-weight:600;font-size:12px}
td.id{color:var(--muted);white-space:nowrap} td.t{font-weight:600;min-width:180px} .ev{color:var(--muted)} .act{color:var(--blue);font-size:12.5px}
kbd,code{background:#262040;border:1px solid var(--line);border-radius:5px;padding:0 5px;font-size:12px}
.muted{color:var(--muted)} ol li{margin:4px 0}
@media (max-width:760px){td.t{min-width:0} table,thead,tbody,tr,td,th{display:block} th{display:none} td{border-top:0;padding:2px 0} tr{border-top:1px solid var(--line);padding:8px 0}}
</style></head><body><main>
<h1>Mojiworld — launch readiness</h1>
<div class="muted">Build ${esc(VER)} · reviewed 2026-09-17 · ${items.length} checks across ${pillars.length} pillars. Evidence: <code>scripts/launch_smoke_probe.mjs</code>, <code>scripts/save_corruption_probe.mjs</code>, the browser-free suite, and four read-only code audits (assets, player text, robustness / release, content).</div>
<div class="card"><b style="font-size:17px">${esc(verdict)}</b>
<div class="sum">${Object.entries(counts).map(([k, v]) => `<div>${pill(k)} &nbsp;${v}</div>`).join('')}</div>
${smoke ? `<div class="muted">Smoke run on ${esc(smoke.ver)}: ${smoke.maps.length} maps, ${smoke.skills.length} skills, ${smoke.panels.length} panels; ${smoke.errors.length} runtime errors, ${sm.uniq404.length} missing files${sm.uniq404.length ? ' (' + esc(sm.uniq404.slice(0, 6).join(', ')) + ')' : ''}; heap ${n(smoke.finalMem)} MB at the end.</div>` : ''}
</div>
<h2>What stands between this build and a launch</h2>
<div class="card"><ol>
${blockers.map((i) => `<li>${pill(i.status)} <b>${esc(i.title)}</b> — ${esc(i.evidence)}${i.action ? ` <span class="act">→ ${esc(i.action)}</span>` : ''}</li>`).join('\n')}
${decisions.map((i) => `<li>${pill(i.status)} <b>${esc(i.title)}</b> — ${esc(i.evidence)}${i.action ? ` <span class="act">→ ${esc(i.action)}</span>` : ''}</li>`).join('\n')}
${items.filter((i) => i.status === S.partial && i.action).map((i) => `<li>${pill(i.status)} <b>${esc(i.title)}</b> <span class="act">→ ${esc(i.action)}</span></li>`).join('\n')}
</ol></div>
${pillars.map((p) => `<h2>${esc(p)}</h2><table><thead><tr><th></th><th>check</th><th>status</th><th>evidence</th></tr></thead><tbody>
${items.filter((i) => i.pillar === p).map((i) => `<tr><td class="id">${i.id}</td><td class="t">${esc(i.title)}</td><td>${pill(i.status)}</td><td><span class="ev">${esc(i.evidence)}</span>${i.action ? `<br><span class="act">→ ${esc(i.action)}</span>` : ''}</td></tr>`).join('\n')}
</tbody></table>`).join('\n')}
<p class="muted" style="margin-top:28px">Statuses: PASS = verified as is · FIXED = fixed in this launch pass (v0.30.791-798) · PARTIAL = works, with a noted gap · FAIL = must fix · DECIDE = the owner's call · HUMAN STEP = cannot be automated.</p>
</main></body></html>`;
writeFileSync(OUT, html.replace(/v0\.30\.789/g, FIXVER));
console.log(`${OUT}: ${items.length} checks — ${JSON.stringify(counts)}; verdict: ${verdict}`);
