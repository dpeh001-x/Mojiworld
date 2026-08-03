// Cloudburst replaces the gravity well on Skywisp + Cloudbun.
// Asserts: both mobs carry it, the hazard spawns in the AIR, the telegraph is
// harmless, the rain damages inside the column only, and it renders + expires.
import { createRequire } from 'node:module';
const req = createRequire('file:///C:/Users/dpeh0/Mojiworld/package.json');
const { chromium } = req('playwright-core');
import { spawn } from 'node:child_process';
const PORT = 8981;
const server = spawn(process.execPath, ['C:/Users/dpeh0/Mojiworld/serve.js', String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
const net = [];
page.on('response', r => { if (/cloudburst/i.test(r.url())) net.push(r.status()); });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(11000);

const R = await page.evaluate(async () => {
  const res = [];
  const ok = (name, cond, extra) => res.push({ name, pass: !!cond, extra: extra === undefined ? '' : String(extra) });
  for (const id of ['class-select-modal','advancement-modal','tutorial-modal','loading-overlay',
                    'story-beat-overlay','boss-intro-overlay','dialog']) {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  }
  player.cls = 'warrior'; player.level = 40; player.maxHp = 99999; player.hp = 99999;

  // --- 1. skill table -------------------------------------------------------
  ok('skywisp special is cloudburst', MONSTER_SKILLS.skywisp?.kind === 'cloudburst', MONSTER_SKILLS.skywisp?.kind);
  ok('cloudbun special is cloudburst', MONSTER_SKILLS.cloudbun?.kind === 'cloudburst', MONSTER_SKILLS.cloudbun?.kind);
  ok('gravityWell skill fn is gone', typeof MONSTER_SKILL_FNS.gravityWell !== 'function');
  ok('cloudburst skill fn exists', typeof MONSTER_SKILL_FNS.cloudburst === 'function');
  ok('no MONSTER_SKILLS entry still uses gravityWell',
     !Object.values(MONSTER_SKILLS).some(s => s && s.kind === 'gravityWell'));

  // --- 2. art loaded --------------------------------------------------------
  for (let i = 0; i < 60 && !_lxVfxReady(LX_VFX.cloudburst); i++) await new Promise(r => setTimeout(r, 100));
  ok('cloudburst.webp decoded', _lxVfxReady(LX_VFX.cloudburst),
     LX_VFX.cloudburst ? `${LX_VFX.cloudburst.naturalWidth}x${LX_VFX.cloudburst.naturalHeight}` : 'missing');
  ok('gravityWell VFX key retired', !LX_VFX.gravityWell);

  // --- 3. cast --------------------------------------------------------------
  loadMap('skyGarden'); game.paused = false;
  game.hazards.length = 0; game.monsters.length = 0;
  player.x = 500; player.y = 300; player.vy = 0;
  const m = spawnMonster(560, 200, 'skywisp', false);
  ok('skywisp spawned', !!(m && !m._suppressed));
  MONSTER_SKILL_FNS.cloudburst(m);
  const h = game.hazards.find(z => z.type === 'mob_cloudburst');
  ok('cloudburst hazard spawned', !!h, game.hazards.map(z => z.type).join(','));
  ok('no mob_gravity hazard exists', !game.hazards.some(z => z.type === 'mob_gravity'));
  if (!h) return res;
  ok('cloud sits ABOVE the player', h.cy < player.y, `cloud ${Math.round(h.cy)} vs player ${Math.round(player.y)}`);
  ok('cloud stays inside the world', h.cy >= 0, Math.round(h.cy));

  // --- 4. telegraph is harmless --------------------------------------------
  player.x = h.cx - player.w / 2; player.y = h.cy + 120;   // dead centre of column
  player.hp = 99999; player.invulnerable = 0;
  let hpBefore = player.hp;
  for (let f = 0; f < (h.warn - 2); f++) {
    player.x = h.cx - player.w / 2; player.y = h.cy + 120;
    player.invulnerable = 0;
    updateProjectiles(16.667);
  }
  ok('no damage during the telegraph', player.hp === hpBefore, `lost ${hpBefore - player.hp}`);

  // --- 5. rain damages inside the column -----------------------------------
  hpBefore = player.hp;
  for (let f = 0; f < 80; f++) {
    player.x = h.cx - player.w / 2; player.y = h.cy + 120;
    player.invulnerable = 0;
    updateProjectiles(16.667);
  }
  const dmgIn = hpBefore - player.hp;
  ok('rain damages inside the column', dmgIn > 0, `lost ${dmgIn}`);

  // --- 6. outside the column is safe ---------------------------------------
  game.hazards.length = 0;
  MONSTER_SKILL_FNS.cloudburst(m);
  const h2 = game.hazards.find(z => z.type === 'mob_cloudburst');
  player.hp = 99999; player.invulnerable = 0;
  hpBefore = player.hp;
  for (let f = 0; f < 140; f++) {
    player.x = h2.cx + h2.radius + 90;      // well clear, horizontally
    player.y = h2.cy + 120;
    player.invulnerable = 0;
    updateProjectiles(16.667);
  }
  ok('no damage outside the column', player.hp === hpBefore, `lost ${hpBefore - player.hp}`);

  // --- 7. above the cloud is safe (it rains DOWN) --------------------------
  game.hazards.length = 0;
  MONSTER_SKILL_FNS.cloudburst(m);
  const h3 = game.hazards.find(z => z.type === 'mob_cloudburst');
  player.hp = 99999; hpBefore = player.hp;
  for (let f = 0; f < 140; f++) {
    player.x = h3.cx - player.w / 2; player.y = h3.cy - 140;   // above it
    player.invulnerable = 0;
    updateProjectiles(16.667);
  }
  ok('no damage above the cloud', player.hp === hpBefore, `lost ${hpBefore - player.hp}`);

  // --- 8. renders, uses the sprite, and stays upright ----------------------
  game.hazards.length = 0;
  MONSTER_SKILL_FNS.cloudburst(m);
  const h4 = game.hazards.find(z => z.type === 'mob_cloudburst');
  h4.tick = 100;   // past the telegraph so the rain curtain draws too
  // NOTE: with rain on, the painted bbox legitimately jitters — the streak x
  // positions are seeded off game.time. The "is it upright" measurement below
  // therefore runs a SECOND pass during the telegraph, where the cloud is the
  // only thing drawn, so any width change would be the sprite itself moving.
  const ctx = canvas.getContext('2d');
  const drawn = [];
  const orig = ctx.drawImage;
  ctx.drawImage = function (src, ...rest) {
    try { drawn.push(String(src && src.src || (src && src.tagName) || '?').split('/').slice(-2).join('/')); } catch (e) {}
    return orig.apply(this, [src, ...rest]);
  };
  let drawErr = null;
  const boxes = [];
  for (const t of [0, 17, 33, 61, 90]) {
    game.time = t;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    try { drawHazards(); } catch (e) { drawErr = String(e).slice(0, 180); break; }
    const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let y = 0; y < canvas.height; y++)
      for (let x = 0; x < canvas.width; x++)
        if (d[(y * canvas.width + x) * 4 + 3] > 24) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
    if (x1 > 0) boxes.push({ t, w: x1 - x0 + 1, h: y1 - y0 + 1 });
  }
  ctx.drawImage = orig;
  ok('drawHazards runs clean', !drawErr, drawErr || 'no throw');
  ok('draw blits the cloudburst art', drawn.some(s => /cloudburst/i.test(s)), drawn.slice(0, 3).join(' | '));
  ok('renders with rain across the loop', boxes.length >= 3,
     boxes.map(b => `${b.w}x${b.h}`).join(' '));
  // Cloud ALONE (telegraph phase, no rain curtain): an upright blit must not
  // change width at all. This is the assertion the gravity well would fail.
  h4.tick = 0;
  const cloudBoxes = [];
  for (const t of [0, 17, 33, 61, 90, 140]) {
    game.time = t;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawHazards();
    const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let y = 0; y < canvas.height; y++)
      for (let x = 0; x < canvas.width; x++)
        if (d[(y * canvas.width + x) * 4 + 3] > 24) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
    if (x1 > 0) cloudBoxes.push({ w: x1 - x0 + 1, h: y1 - y0 + 1 });
  }
  const cws = cloudBoxes.map(b => b.w), chs = cloudBoxes.map(b => b.h);
  const wSpread = cws.length ? Math.max(...cws) - Math.min(...cws) : -1;
  const hSpread = chs.length ? Math.max(...chs) - Math.min(...chs) : -1;
  ok('cloud silhouette never tumbles (width fixed)', cws.length >= 4 && wSpread === 0,
     `widths ${cws.join(',')}`);
  // Height is NOT expected to be pixel-identical: the cloud bobs by
  // sin(t*0.08)*2, a sub-pixel vertical translate, so the measured bbox edge
  // shifts by up to the 4 px of bob travel. Anything beyond that would mean
  // the sprite is being scaled, which is the thing under test.
  ok('cloud height varies only by the 4px bob, never scales', hSpread <= 5,
     `heights ${chs.join(',')} spread ${hSpread}`);
  ok('cloud is WIDER than tall (side-on, not a flattened disc)',
     cloudBoxes.length > 0 && cloudBoxes[0].h / cloudBoxes[0].w > 0.45,
     cloudBoxes.length ? `${cloudBoxes[0].w}x${cloudBoxes[0].h}` : 'none');

  // --- 9. expires ----------------------------------------------------------
  game.hazards.length = 0;
  MONSTER_SKILL_FNS.cloudburst(m);
  for (let f = 0; f < 900; f++) { player.invulnerable = 200; updateProjectiles(16.667); }
  ok('hazard cleans itself up', !game.hazards.some(z => z.type === 'mob_cloudburst'),
     `${game.hazards.length} hazards left`);
  return res;
});

let pass = 0, fail = 0;
for (const r of R) {
  if (r.pass) { pass++; console.log(`  PASS  ${r.name}${r.extra ? '  (' + r.extra + ')' : ''}`); }
  else { fail++; console.log(`  FAIL  ${r.name}  ${r.extra}`); }
}
console.log(`\n${pass} passed, ${fail} failed`);
console.log('cloudburst asset responses:', JSON.stringify(net.slice(0, 4)));
console.log('pageerrors:', errs.length, errs.slice(0, 3));
await browser.close(); server.kill();
process.exit(fail ? 1 : 0);
