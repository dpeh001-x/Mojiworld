// ====================================================================
// v0.26.x — FLASH-FORWARD PROLOGUE ("The Memory of What You Become").
// Fresh saves open on a skippable animated cinematic, then ~30s of play
// as a Lv.100 Shinobi against Gravitos in his own arena, then the power
// is torn away and the player walks out of The Void at Lv.1 into class
// select. Saving is gated off for the whole sequence (_prologueActive),
// and the apex state is restored from a JSON snapshot — nothing leaks.
// ====================================================================
function _prologueOverlay(stanzas, onDone) {
  let i = 0;
  const ov = document.createElement('div');
  ov.id = 'prologue-cine';
  ov.style.cssText = 'position:fixed;inset:0;z-index:1500;background:#02010a;display:flex;'
    + 'align-items:center;justify-content:center;cursor:pointer;overflow:hidden;';
  ov.innerHTML =
    '<style>@keyframes plg-drift{0%{transform:translateY(0) scale(1)}100%{transform:translateY(-60px) scale(1.18)}}'
    + '@keyframes plg-in{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}'
    + '@keyframes plg-star{0%,100%{opacity:0.25}50%{opacity:0.9}}</style>'
    + '<div style="position:absolute;inset:-80px;background:radial-gradient(ellipse at 50% 60%,#241048 0%,#0b0420 45%,#02010a 80%);animation:plg-drift 16s ease-out forwards;"></div>'
    + Array.from({ length: 26 }, (_, k) =>
        '<div style="position:absolute;left:' + ((k * 137) % 100) + '%;top:' + ((k * 61) % 100) + '%;'
        + 'width:2px;height:2px;border-radius:50%;background:#cdb8ff;'
        + 'animation:plg-star ' + (2 + (k % 5)) + 's ease-in-out ' + (k % 7) * 0.4 + 's infinite;"></div>').join('')
    + '<div style="position:absolute;top:0;left:0;right:0;height:64px;background:#000;"></div>'
    + '<div style="position:absolute;bottom:0;left:0;right:0;height:64px;background:#000;"></div>'
    + '<div id="plg-text" style="position:relative;max-width:760px;padding:0 28px;text-align:center;'
    + 'font:700 24px/1.6 monospace;color:#efe6ff;letter-spacing:2px;text-shadow:0 0 18px rgba(150,100,255,0.6),0 2px 4px #000;"></div>'
    + '<div style="position:absolute;bottom:18px;right:22px;font:700 12px monospace;color:#8b7fb8;">click / Enter ▸ &nbsp;·&nbsp; </div>'
    + '<button id="plg-skip" style="position:absolute;top:16px;right:18px;z-index:2;padding:5px 14px;border-radius:8px;'
    + 'border:1px solid #5a4490;background:rgba(20,8,44,0.85);color:#cdb8ff;font:700 12px monospace;cursor:pointer;">Skip prologue ▸▸</button>';
  document.body.appendChild(ov);
  const txt = ov.querySelector('#plg-text');
  function show() {
    txt.style.animation = 'none'; void txt.offsetWidth;
    txt.style.animation = 'plg-in 0.9s ease-out forwards';
    txt.textContent = stanzas[i];
  }
  function close(skipAll) {
    ov.remove();
    window.removeEventListener('keydown', onKey, true);
    onDone(skipAll === true);
  }
  function adv(e) {
    if (e && e.target && e.target.id === 'plg-skip') return;
    i++; if (i >= stanzas.length) close(false); else show();
  }
  function onKey(e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); adv(); }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
  }
  ov.addEventListener('click', adv);
  ov.querySelector('#plg-skip').onclick = (e) => { e.stopPropagation(); close(true); };
  window.addEventListener('keydown', onKey, true);
  show();
}
function _startPrologue() {
  window._prologueActive = true;
  loadMap('void', 400);
  _prologueOverlay([
    'EONS FROM NOW — AT THE FAR END OF THE DREAM',
    'One law remains. One bearer of the world’s weight.\n\nAnd one foreigner who climbed every plane to face him.',
    'You remember this.\n\nYou have not lived it yet — but you remember.',
  ], (skipped) => {
    if (skipped) { _prologueFinish(true); return; }
    _prologueApexSegment();
  });
}
function _prologueApexSegment() {
  // Snapshot the untouched fresh state — restored verbatim afterwards.
  try {
    window._prologueSnapP = JSON.stringify(player);
    window._prologueSnapG = JSON.stringify({
      mojidexSeen: game.mojidexSeen || {}, bestiary: game.bestiary || {},
      bossDefeated: game.bossDefeated || {}, kills: game.kills,
    });
  } catch (e) {}
  // Pre-mark advancement story beats so devSetMasterChain can't pop their
  // dialogs mid-cinematic (the snapshot restore un-marks them again).
  player._storyBeatsSeen = Object.assign({}, player._storyBeatsSeen,
    { advancement_1: true, advancement_2: true, advancement_3: true });
  try {
    if (typeof devSetMasterChain === 'function') devSetMasterChain('rogue', 'ninja', 'shinobi');
    if (typeof devSetLevel === 'function') devSetLevel(99);
    player.level = 100;   // the memory stands one step beyond the mortal cap
    player.hp = getMaxHp(); player.mp = getMaxMp();
  } catch (e) {}
  loadMap('gravitosArena', 300);
  setTimeout(_prologueHardenBoss, 1600);
  _prologueHud(true);
  window._prologueLeftMs = 30000;
  window._prologueLastTick = Date.now();
  window._prologueTimer = setInterval(_prologueTick, 250);
}
function _prologueHardenBoss() {
  // The memory's Gravitos cannot realistically die in 30s — and if he
  // somehow does, the _echoBoss tag keeps the kill sandboxed (no stamps,
  // no boon, no epilogue cinematic side-state on a save that's seconds old).
  const g = (game.monsters || []).find(m => m && m.type === 'gravitos');
  if (!g) { setTimeout(_prologueHardenBoss, 800); return; }
  g.maxHp = Math.floor((g.maxHp || 1) * 4);
  g.currentHp = g.maxHp;
  g.exp = 0; g.mojicoins = 0;
  g._echoBoss = true;
}
function _prologueHud(show) {
  let el = document.getElementById('prologue-hud');
  if (!show) { if (el) el.remove(); return; }
  if (!el) {
    el = document.createElement('div');
    el.id = 'prologue-hud';
    el.style.cssText = 'position:fixed;top:54px;left:50%;transform:translateX(-50%);z-index:880;'
      + 'background:rgba(20,8,44,0.85);border:1px solid #8a5df0;border-radius:10px;'
      + 'padding:5px 16px;font:700 13px monospace;color:#efe6ff;pointer-events:none;'
      + 'text-align:center;letter-spacing:1px;text-shadow:0 1px 3px #000;';
    document.body.appendChild(el);
  }
}
function _prologueTick() {
  if (!window._prologueActive) { clearInterval(window._prologueTimer); return; }
  const now = Date.now();
  const dt = now - (window._prologueLastTick || now);
  window._prologueLastTick = now;
  if (!game.paused) window._prologueLeftMs -= dt;
  // The memory cannot fall — it refills. (Also dodges the death overlay.)
  if (player.hp < getMaxHp() * 0.15) player.hp = getMaxHp();
  const el = document.getElementById('prologue-hud');
  if (el) {
    const s = Math.max(0, Math.ceil(window._prologueLeftMs / 1000));
    el.innerHTML = '✦ MEMORY OF WHAT YOU BECOME — 0:' + String(s).padStart(2, '0')
      + '<br><span style="font-size:11px;color:#bdaaff;">skills: Z · X · A · S · D · Q · W · E · C</span>';
  }
  const bossGone = !((game.monsters || []).some(m => m && m.type === 'gravitos'))
    && window._prologueLeftMs < 25000;
  if (window._prologueLeftMs <= 0 || bossGone) {
    clearInterval(window._prologueTimer); window._prologueTimer = null;
    _prologueStrip();
  }
}
function _prologueStrip() {
  _prologueHud(false);
  if (typeof flash === 'function') flash(1.0);
  if (typeof addShake === 'function') addShake(12);
  _prologueOverlay([
    'The memory frays.\n\nThe Void reclaims what you have not yet earned.',
    'Power is never given, foreigner.\n\nIt is re-earned — step by step, plane by plane.',
    'Walk out of the Void.\n\nIt is time to begin.',
  ], () => _prologueFinish(false));
}
function _prologueFinish(skipped) {
  if (window._prologueTimer) { clearInterval(window._prologueTimer); window._prologueTimer = null; }
  _prologueHud(false);
  // Restore the untouched fresh state (level, class, beats — everything).
  try {
    const fp = JSON.parse(window._prologueSnapP || 'null');
    if (fp) {
      for (const k of Object.keys(player)) delete player[k];
      Object.assign(player, fp);
    }
    const fg = JSON.parse(window._prologueSnapG || 'null');
    if (fg) {
      game.mojidexSeen = fg.mojidexSeen; game.bestiary = fg.bestiary;
      game.bossDefeated = fg.bossDefeated; game.kills = fg.kills;
    }
  } catch (e) {}
  window._prologueSnapP = window._prologueSnapG = null;
  window._prologueActive = false;
  if (typeof refreshGearCache === 'function') { try { refreshGearCache(); } catch (e) {} }
  loadMap('void', 400);
  if (typeof renderSkillBar === 'function') { try { renderSkillBar(); } catch (e) {} }
  if (typeof updateUI === 'function') { try { updateUI(); } catch (e) {} }
  if (!skipped && typeof showToast === 'function') {
    showToast('✦ You will get back there. Your legend begins at Lv.1.', 'epic');
  }
  openClassSelect();
}
