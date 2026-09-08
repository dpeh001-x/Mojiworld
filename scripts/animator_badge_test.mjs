// ANIMATOR BUILD BADGE - the number is the build, and a stale pinned page jumps.
// Per user (2026-09-08): "the animator is clearly not updated it is only 0.30.424" /
// "ensure that the animator always updates to the latest build". The badge used to
// show the animator FILE's own hand-bumped version, so a page pinned at main's tip
// read as stale after every game-only push. It now resolves the GAME_VERSION of the
// served commit from the GitHub API and redirects a behind-the-tip page on open.
// The pinned rawcdn origin and api.github.com are both served by playwright routes,
// so this runs offline against any copy of the animator:
//   node scripts/animator_badge_test.mjs [path/to/monster_animator.html]
import { chromium } from 'playwright-core';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ANIM = path.resolve(process.argv[2] || path.join(ROOT, 'monster_animator.html'));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const html = readFileSync(ANIM, 'utf8');
const ANIM_VER = (html.match(/data-anim="(v[\d.]+)"/) || [])[1];
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
ok('the static build string is gone; data-anim carries the file version', !/build v0\.\d+\.\d+/.test(html) && !!ANIM_VER, { ANIM_VER });
const H = (c) => c.repeat(40);
const TIP = H('1'), MID = H('a'), OLD = H('2');
const LIST = [
  { sha: TIP, commit: { message: 'docs: calibration document - 1f, the animator patch bakes' } },
  { sha: MID, commit: { message: 'v0.30.433 polish: animator badge names the real build\n\nbody' } },
  { sha: H('b'), commit: { message: 'calib: bake nine animator patches' } },
  { sha: OLD, commit: { message: 'v0.30.430 balance: gear pays less and is capped' } },
  { sha: H('c'), commit: { message: 'v0.30.429 polish: bake boss attack art drop' } },
];
const MIME = { html: 'text/html', js: 'text/javascript', json: 'application/json', webp: 'image/webp', png: 'image/png', mp3: 'audio/mpeg', ogg: 'audio/ogg', css: 'text/css', svg: 'image/svg+xml' };
const pinned = (sha, q = '') => `https://rawcdn.githack.com/dpeh001-x/Mojiworld/${sha}/monster_animator.html${q}`;
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
async function scenario(name, { apiDown = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await page.route('https://rawcdn.githack.com/**', (route) => {
    const u = new URL(route.request().url()); const m = u.pathname.match(/^\/dpeh001-x\/Mojiworld\/[0-9a-f]{40}\/(.*)$/i);
    if (!m) return route.fulfill({ status: 404, body: '' });
    const rel = decodeURIComponent(m[1]); const file = rel === 'monster_animator.html' ? ANIM : path.join(ROOT, rel);
    if (!existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ status: 200, contentType: MIME[path.extname(file).slice(1)] || 'application/octet-stream', body: readFileSync(file) });
  });
  await page.route('https://api.github.com/**', (route) => {
    if (apiDown) return route.abort('failed');
    const u = new URL(route.request().url()); let body;
    if (/\/commits\/main$/.test(u.pathname)) body = LIST[0];
    else if (/\/commits$/.test(u.pathname)) { const sha = u.searchParams.get('sha'); const i = sha === 'main' ? 0 : LIST.findIndex((c) => c.sha === sha); body = i < 0 ? [] : LIST.slice(i); }
    else return route.fulfill({ status: 404, body: '{}' });
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"e-' + name + '"' }, body: JSON.stringify(body) });
  });
  return { page, ctx, errs, badge: () => page.evaluate(() => (document.getElementById('lx-build-badge') || {}).textContent || '') };
}
const T7 = TIP.slice(0, 7);
// A - pinned at the tip whose top commit is a docs commit: the build is the next versioned subject
{ const s = await scenario('A'); await s.page.goto(pinned(TIP), { waitUntil: 'domcontentloaded' });
  await s.page.waitForFunction(() => /latest|STALE|offline/.test((document.getElementById('lx-build-badge') || {}).textContent || ''), null, { timeout: 30000 }).catch(() => {});
  const t = await s.badge(); await s.page.waitForTimeout(1500);
  ok('A pinned at the tip: badge names the build from the first versioned commit at or below the tip', t === `build v0.30.433 · ${T7} ✓ latest`, { t });
  ok('A pinned at the tip: no redirect', s.page.url() === pinned(TIP), { url: s.page.url() });
  ok('A no page errors', s.errs.length === 0, { errs: s.errs.slice(0, 2) }); await s.ctx.close(); }
// B - behind the tip with ?nojump: red STALE naming both builds, the link flips, the banner names the build
{ const s = await scenario('B'); await s.page.goto(pinned(OLD, '?nojump'), { waitUntil: 'domcontentloaded' });
  await s.page.waitForFunction(() => /STALE/.test((document.getElementById('lx-build-badge') || {}).textContent || ''), null, { timeout: 30000 }).catch(() => {});
  const t = await s.badge(); const link = await s.page.evaluate(() => (document.getElementById('lx-latest-link') || {}).textContent || '');
  const bg = await s.page.evaluate(() => getComputedStyle(document.getElementById('lx-build-badge')).backgroundColor);
  ok('B behind the tip (?nojump): badge reads its own build and the latest build', t === 'build v0.30.430 · STALE — latest is v0.30.433', { t });
  ok('B behind the tip: painted red, link flips to open latest', bg === 'rgb(58, 21, 21)' && link === 'open latest↗', { bg, link });
  await s.page.waitForSelector('#updbar', { timeout: 12000 }).catch(() => {});
  const bar = await s.page.evaluate(() => (document.getElementById('updbar') || {}).textContent || '');
  ok('B the update banner names the new build, not just its sha', /new build v0\.30\.433 is live/.test(bar), { bar });
  ok('B ?nojump: stays on the old build', s.page.url().includes(OLD), { url: s.page.url() });
  ok('B no page errors', s.errs.length === 0, { errs: s.errs.slice(0, 2) }); await s.ctx.close(); }
// C - behind the tip, opened normally: jumps to the latest pinned build on open
{ const s = await scenario('C'); await s.page.goto(pinned(OLD), { waitUntil: 'domcontentloaded' });
  await s.page.waitForURL((u) => String(u).includes(TIP), { timeout: 30000 }).catch(() => {});
  await s.page.waitForFunction(() => /✓ latest/.test((document.getElementById('lx-build-badge') || {}).textContent || ''), null, { timeout: 30000 }).catch(() => {});
  ok('C behind the tip, opened normally: redirected to the latest pinned build', s.page.url() === pinned(TIP), { url: s.page.url() });
  ok('C after the jump the badge is green at the tip', (await s.badge()) === `build v0.30.433 · ${T7} ✓ latest`, { t: await s.badge() }); await s.ctx.close(); }
// D - API unreachable: honest fallback naming the animator file version, no jump
{ const s = await scenario('D', { apiDown: true }); await s.page.goto(pinned(OLD), { waitUntil: 'domcontentloaded' });
  await s.page.waitForFunction(() => /offline/.test((document.getElementById('lx-build-badge') || {}).textContent || ''), null, { timeout: 30000 }).catch(() => {});
  const t = await s.badge(); await s.page.waitForTimeout(800);
  ok('D API down: offline fallback names the animator file version', t === `build ? · offline (animator ${ANIM_VER})`, { t });
  ok('D API down: no redirect', s.page.url() === pinned(OLD), { url: s.page.url() }); await s.ctx.close(); }
await browser.close();
let pass = 0; for (const t of results) { console.log((t.pass ? '  PASS  ' : '  FAIL  ') + t.n); if (!t.pass) console.log('        ' + JSON.stringify(t.x).slice(0, 300)); if (t.pass) pass++; }
console.log('\n' + pass + '/' + results.length + ' checks passed'); process.exitCode = pass === results.length ? 0 : 1;
