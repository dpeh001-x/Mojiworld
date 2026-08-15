// Every version surface tells the truth, and drifts loudly if it ever stops.
// Per user (screenshot of a version chip): "ensure this part of the version
// gets updated with each update according to the correct version".
//
// Static checks read the repo; the live check drives the real game and reads
// the three places a player can see a version.
// Run: node scripts/version_consistency_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });

// MOJI_VER_REF reads the repo files from a git ref instead of the working
// tree. The working copy holds generated artifacts that ship pipelines
// overwrite, so it can sit behind origin without anything being wrong;
// pointing at origin/main checks what is actually published.
const REF = process.env.MOJI_VER_REF || null;
const readRepo = (f) => REF
  ? execFileSync('git', ['-C', ROOT, 'show', `${REF}:${f}`], { maxBuffer: 1 << 30 }).toString('utf8')
  : fs.readFileSync(path.join(ROOT, f), 'utf8');
const game = readRepo('mojiworld_game.html');
const chlog = readRepo('CHANGELOG.html');
const anim = readRepo('monster_animator.html');

const GV = (/const GAME_VERSION\s*=\s*'([^']+)'/.exec(game) || [])[1];
const TOP = (/<h2>(v0\.\d+\.\d+)/.exec(chlog) || [])[1];
ok('GAME_VERSION is present', !!GV, GV);
ok('the changelog\'s newest entry matches GAME_VERSION', GV && TOP === GV, `changelog ${TOP} vs code ${GV}`);

// The game must not ship a hardcoded version literal that a pre-script paint
// could show. The runtime writer owns every visible version string.
const tagLine = (/<div id="version-tag"[^>]*>([^<]*)</.exec(game) || [])[1];
ok('the in-game version chip ships no hardcoded number',
   tagLine !== undefined && !/v0\.\d+\.\d+/.test(tagLine), `chip literal: "${(tagLine || '').trim()}"`);

// The animator badge must carry the GAME_VERSION current at the animator's
// LAST CHANGE - that is the project rule (CLAUDE.md), and it is what makes a
// stale cached copy identifiable. Comparing against the animator's own last
// commit (not today's version) means a release that doesn't touch the
// animator never puts this test into a false failure.
const badge = (/id="lx-build-badge"[^>]*>\s*build\s+(v0\.\d+\.\d+)/.exec(anim) || [])[1];
let wantBadge = null;
try {
  const sha = execFileSync('git', ['-C', ROOT, 'log', '-1', '--format=%H', '--', 'monster_animator.html'], { encoding: 'utf8' }).trim();
  const at = execFileSync('git', ['-C', ROOT, 'show', `${sha}:mojiworld_game.html`], { maxBuffer: 1 << 30 }).toString('utf8');
  wantBadge = (/const GAME_VERSION\s*=\s*'([^']+)'/.exec(at) || [])[1];
} catch (e) { /* no git / shallow clone - skip the comparison */ }
ok('the animator build badge is present', !!badge, badge);
if (wantBadge) {
  // The working tree may hold an un-committed animator edit; in that case the
  // badge should already carry the CURRENT version instead.
  const dirty = (() => {
    try { return execFileSync('git', ['-C', ROOT, 'status', '--porcelain', '--', 'monster_animator.html'], { encoding: 'utf8' }).trim().length > 0; }
    catch (e) { return false; }
  })();
  const want = dirty ? GV : wantBadge;
  ok('the animator badge matches the game version at its last change',
     badge === want, `badge ${badge}, expected ${want}${dirty ? ' (animator edited in the working tree)' : ` (animator last changed at ${wantBadge})`}`);
}

// ── live: the three surfaces a player actually sees ─────────────────────────
const PORT = 9246;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
// The title-menu tag is only stamped when the menu comes up, so wait for it
// rather than fading the overlay away first (which reads an empty string and
// looks like a failure that isn't one).
for (let i = 0; i < 30; i++) {
  const up = await page.evaluate(() => {
    const lo = document.getElementById('loading-overlay');
    return !!(lo && lo.classList.contains('menu-up'));
  });
  if (up) break;
  await page.waitForTimeout(1000);
}
const live = await page.evaluate(() => ({
  gv: typeof GAME_VERSION !== 'undefined' ? GAME_VERSION : null,
  chip: (document.getElementById('version-tag') || {}).textContent,
  boot: (document.getElementById('lo-boot-version') || {}).textContent,
  menu: (document.getElementById('lo-version') || {}).textContent,
}));
await browser.close(); server.kill();

ok('the HUD chip shows the running version', live.chip && live.chip.trim() === live.gv, `chip "${(live.chip || '').trim()}" vs ${live.gv}`);
ok('the boot screen shows the running version', live.boot && live.boot.trim() === live.gv, `boot "${(live.boot || '').trim()}"`);
ok('the title-menu tag shows the running version', live.menu && live.menu.trim() === live.gv, `menu "${(live.menu || '').trim()}"`);
ok('the running version is the one committed in source', live.gv === GV, `${live.gv} vs ${GV}`);

let pass = 0, failed = 0;
for (const r of res) { if (r.pass) { pass++; console.log(`  PASS  ${r.n}` + (r.extra ? `  (${r.extra})` : '')); }
  else { failed++; console.log(`  FAIL  ${r.n}  ${r.extra}`); } }
console.log(`${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
