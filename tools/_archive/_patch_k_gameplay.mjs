// v0.26.949 K: mobile F no longer enters portals; Hall of Echoes portal at
// the Interdimensional Ascension base; rainbow stair trail on combo jumps.
import { readFile, writeFile, rename } from 'node:fs/promises';
import { execSync } from 'node:child_process';
const FILE = 'C:/Users/Xenon/Desktop/Mojiworld/mojiworld_game.html';
let s = await readFile(FILE, 'utf8');
function rep(old, neu, label) {
  let o = old, n = neu, c = s.split(o).length - 1;
  if (c !== 1) { o = old.replace(/\n/g, '\r\n'); n = neu.replace(/\n/g, '\r\n'); c = s.split(o).length - 1; }
  if (c !== 1) { console.error(`FAIL ${label}: ${c}`); process.exit(2); }
  s = s.split(o).join(n); console.log('ok: ' + label);
}

// K1 — mobile dynamic F: drop the portal branch (F was warping players who
// stood near a doorway; ▲ on the d-pad is the portal key, matching desktop).
rep(`        // Portal BEFORE NPC — in towns, NPCs stand near portals, so
        // an NPC was always within 60px and stealing the dispatch
        // before the portal check could run. Portal wins when the
        // player is actually in front of a doorway. tryPortal is
        // bound to ArrowUp (moved off F in v0.24.2) so dispatch
        // 'arrowup' here.
        for (const po of (game.portals || [])) {
          // v0.26.396 — honour explicit po.y, else the map's ground line (was
          // hardcoded 480, so block-land doors never lit the mobile F-button).
          const _pY = (typeof po.y === 'number') ? po.y : (typeof _defaultPortalY === 'function' ? _defaultPortalY() : 480);
          if (Math.abs(px - po.x) < 50 && Math.abs(py - _pY) < 100) return 'arrowup';
        }
        for (const npc of (game.npcs || [])) {`,
`        // v0.26.949 — portal branch REMOVED (per user: "pressing F
        // incorrectly triggers the portal"). F next to a doorway was
        // dispatching 'arrowup' and warping the player mid-fight /
        // mid-chat. Portals are entered with ▲ on the d-pad only,
        // matching the desktop ArrowUp convention (v0.24.2).
        for (const npc of (game.npcs || [])) {`, 'K1 F portal branch removed');

// K2 — Hall of Echoes (boss rush) portal at the tower base.
rep(`MAPS.interdimensionalAscension.portals.push({ x:400, y:14070, dest:'wayfarersLantern2', name:"◀ Wayfarer's Lantern · The Gate" });`,
`MAPS.interdimensionalAscension.portals.push({ x:400, y:14070, dest:'wayfarersLantern2', name:"◀ Wayfarer's Lantern · The Gate" });
MAPS.interdimensionalAscension.portals.push({ x:680, y:14070, dest:'boss_rush', name:'⚔ Hall of Echoes', iconStar:true });   // v0.26.949 — per user: boss-rush entry at the bottom of the Interdimensional tower (the Void portal stays as the early-game entry)`, 'K2 echoes portal at base');

// K3a — rainbow stair spawner (defined next to the smoothFx system).
rep(`function updateSmoothFx(dt) {`,
`// v0.26.949 — Rainbow stair trail for icy-tower combo jumps (per user).
// Spawns a short descending staircase of glowing steps BEHIND the
// character, each tinted a successive rainbow hue, fading over ~0.8s.
// Purely cosmetic — no collision.
function _spawnRainbowStairs() {
  if (!game.smoothFx) game.smoothFx = [];
  const dir = -((player.facing || 1));            // trail behind the run direction
  const baseX = player.x + player.w / 2;
  const baseY = player.y + player.h;
  for (let i = 0; i < 6; i++) {
    game.smoothFx.push({
      type: 'rainbowStair',
      x: baseX + dir * (16 + i * 26),
      y: baseY + 8 + i * 15,
      w: 30, h: 7,
      hue: (i * 52) % 360,
      delay: i * 2,
      life: 50 + i * 2, maxLife: 50 + i * 2,
    });
  }
}
function updateSmoothFx(dt) {`, 'K3a stair spawner');

// K3b — trigger on combo-boosted jumps in the two tower maps.
rep(`      player.vy = -getJump() - _speedJump - _comboJump;
      player.onGround = false; player.coyoteTime = 0;
      player.state = 'jump';`,
`      player.vy = -getJump() - _speedJump - _comboJump;
      player.onGround = false; player.coyoteTime = 0;
      player.state = 'jump';
      // v0.26.949 — combo jumps on Frozen Peak + the Interdimensional
      // Ascension leave a rainbow staircase behind the character.
      if (_comboJump > 0 &&
          (game.currentMap === 'frozenPeak' || game.currentMap === 'interdimensionalAscension')) {
        try { _spawnRainbowStairs(); } catch (e) {}
      }`, 'K3b stair trigger');

// K3c — renderer branch (camY-aware for the vertical towers).
rep(`    const sx = fx.x - camX;
    if (sx < -200 || sx > W + 200) continue;
    if (fx.type === 'slash') {`,
`    const sx = fx.x - camX;
    if (sx < -200 || sx > W + 200) continue;
    if (fx.type === 'rainbowStair') {
      const age = fx.maxLife - fx.life;
      if (age < (fx.delay || 0)) continue;        // staggered appearance
      const _camY = (game.camera && game.camera.y) || 0;
      const syy = fx.y - _camY;
      if (syy < -60 || syy > H + 60) continue;
      ctx.save();
      ctx.globalAlpha = Math.min(0.85, alpha);
      ctx.fillStyle = 'hsl(' + fx.hue + ', 95%, 62%)';
      ctx.shadowColor = 'hsl(' + fx.hue + ', 95%, 70%)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(sx - fx.w / 2, syy, fx.w, fx.h, 3);
      else ctx.rect(sx - fx.w / 2, syy, fx.w, fx.h);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = Math.min(0.5, alpha * 0.5);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(sx - fx.w / 2, syy, fx.w, 2);
      ctx.restore();
      continue;
    }
    if (fx.type === 'slash') {`, 'K3c stair renderer');

const scripts = [...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const big = scripts.sort((a, b) => b.length - a.length)[0];
await writeFile('C:/Users/Xenon/Desktop/Mojiworld/tools/_v949_check.js', big, 'utf8');
execSync('node --check "C:/Users/Xenon/Desktop/Mojiworld/tools/_v949_check.js"', { stdio: 'inherit' });
await writeFile(FILE + '.tmpk', s, 'utf8');
await rename(FILE + '.tmpk', FILE);
console.log('K DONE');
