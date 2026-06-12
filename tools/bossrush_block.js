// ====================================================================
// v0.26.x — BOSS RUSH ("Hall of Echoes"). Re-fight every boss the player
// has ENCOUNTERED (game.mojidexSeen), back to back, level-scaled like the
// Echo Keeper's shades. Per-boss rewards are zeroed (_echoBoss sandbox);
// the run pays out once at the end (grade-scaled setshards, once per day).
// Entered via the Hall of Echoes star portal in The Void; auto-starts on
// map entry and is torn down by the loadMap choke point on ANY exit.
// ====================================================================
function _bossRushRoster() {
  const out = [];
  try {
    for (const t in monsterTypes) {
      const def = monsterTypes[t];
      if (!def || !def.boss) continue;
      // Mirror Self mirrors the PLAYER and is staged by the Inner
      // Dimension's own scripted flow — unsafe to re-summon raw.
      if (t === 'mirrorSelf') continue;
      if (!game.mojidexSeen || !game.mojidexSeen[t]) continue;
      out.push(t);
    }
  } catch (e) {}
  out.sort((a, b) => ((monsterTypes[a].level || 50) - (monsterTypes[b].level || 50)));
  return out;
}
function _bossRushHud(show) {
  let el = document.getElementById('boss-rush-hud');
  const res = document.getElementById('boss-rush-results');
  if (!show) {
    if (el) el.remove();
    if (res) res.remove();
    if (window._brHudTimer) { clearInterval(window._brHudTimer); window._brHudTimer = null; }
    return;
  }
  if (!el) {
    el = document.createElement('div');
    el.id = 'boss-rush-hud';
    el.style.cssText = 'position:fixed;top:54px;left:50%;transform:translateX(-50%);z-index:880;'
      + 'background:rgba(10,4,24,0.82);border:1px solid #7a4dd8;border-radius:10px;'
      + 'padding:5px 14px;font:700 13px monospace;color:#e8dcff;pointer-events:none;'
      + 'text-shadow:0 1px 3px #000;letter-spacing:1px;';
    document.body.appendChild(el);
  }
  if (window._brHudTimer) clearInterval(window._brHudTimer);
  window._brHudTimer = setInterval(_bossRushUpdateHud, 250);
  _bossRushUpdateHud();
}
function _bossRushUpdateHud() {
  const el = document.getElementById('boss-rush-hud');
  const br = game.bossRush;
  if (!el || !br || !br.active) return;
  const ms = Date.now() - br.t0;
  const mm = Math.floor(ms / 60000), ss = Math.floor((ms % 60000) / 1000);
  el.textContent = '⚔ HALL OF ECHOES — ' + br.downs + '/' + br.queue.length
    + ' · ' + mm + ':' + String(ss).padStart(2, '0');
}
function _bossRushAutoStart() {
  if (game.currentMap !== 'boss_rush') return;
  if (game.bossRush && game.bossRush.active) return;   // double-fire guard
  const queue = _bossRushRoster();
  if (!queue.length) {
    if (typeof showToast === 'function') {
      showToast('🕯 The hall is silent. Face a boss in the world first — its echo will wait for you here.', 'warn');
    }
    return;
  }
  game.bossRush = { active: true, queue, idx: 0, downs: 0, t0: Date.now(), splits: [] };
  _bossRushHud(true);
  if (typeof showToast === 'function') {
    showToast('⚔ BOSS RUSH — ' + queue.length + ' echo' + (queue.length === 1 ? '' : 'es') + ' answer the call!', 'legendary');
  }
  _bossRushSpawnNext(2200);
}
function _bossRushSpawnNext(delayMs) {
  setTimeout(() => {
    const br = game.bossRush;
    if (!br || !br.active || game.currentMap !== 'boss_rush') return;
    // Don't spawn under a pause / boss-intro overlay — re-defer instead.
    if (game.paused) { _bossRushSpawnNext(500); return; }
    const type = br.queue[br.idx];
    if (!type) return;
    const def = monsterTypes[type] || {};
    const wx = (game.mapData && game.mapData.worldWidth) || 1600;
    let m = null;
    try { m = spawnMonster(wx * 0.6, 380, type, true, false); } catch (e) {}
    if (!m) {   // spawn failed (defensive) — skip to the next echo
      br.idx++;
      if (br.idx >= br.queue.length) { _bossRushComplete(); } else { _bossRushSpawnNext(800); }
      return;
    }
    // Echo Keeper-style level scaling (never down-scales), no 1.5× brutality
    // multiplier — the rush is a marathon, not a single duel.
    const bossLv = def.level || 50;
    const mul = Math.max(1, (player.level || 1) / bossLv);
    m.maxHp = Math.floor((m.maxHp || 1) * mul);
    m.currentHp = m.maxHp;
    m.atk = Math.floor((m.atk || 1) * mul);
    m.def = Math.floor((m.def || 0) * mul);
    m.exp = 0; m.mojicoins = 0;          // reward-less per boss — payout at the end
    m._echoBoss = true;                  // ride the sandbox guards (no stamps/boons/shards)
    m._rushBoss = true;                  // rush bookkeeping tag
    m.name = (m.name || type) + ' (Echo)';
    if (typeof showToast === 'function') {
      showToast('⚔ Echo ' + (br.idx + 1) + '/' + br.queue.length + ' — ' + (def.name || type), 'epic');
    }
    if (typeof _playBossIntro === 'function') { try { _playBossIntro(type); } catch (e) {} }
    if (typeof flash === 'function') flash(0.35);
    if (typeof addShake === 'function') addShake(7);
  }, Math.max(60, delayMs | 0));
}
function _bossRushOnBossDown(m) {
  const br = game.bossRush;
  if (!br || !br.active) return;
  br.downs++;
  br.idx++;
  br.splits.push(Date.now() - br.t0);
  if (br.idx >= br.queue.length) { _bossRushComplete(); return; }
  // Breather heal between echoes (the rush has no shops or benches).
  player.hp = Math.min(getMaxHp(), player.hp + Math.floor(getMaxHp() * 0.20));
  player.mp = Math.min(getMaxMp(), player.mp + Math.floor(getMaxMp() * 0.20));
  if (typeof showToast === 'function') {
    showToast('✚ The fallen echo’s essence restores you. Next echo in 3…', 'rare');
  }
  _bossRushSpawnNext(3000);
}
function _bossRushComplete() {
  const br = game.bossRush;
  if (!br || !br.active) return;
  br.active = false;
  const totalMs = Date.now() - br.t0;
  const avg = totalMs / Math.max(1, br.downs) / 1000;
  const grade = avg <= 45 ? 'S' : avg <= 75 ? 'A' : avg <= 110 ? 'B' : 'C';
  const mm = Math.floor(totalMs / 60000), ss = Math.floor((totalMs % 60000) / 1000);
  const timeStr = mm + ':' + String(ss).padStart(2, '0');
  // Best-run record (persisted via GAME_SAVE_FIELDS).
  const prev = game.bossRushBest;
  const isBest = !prev || br.downs > prev.downs || (br.downs === prev.downs && totalMs < prev.timeMs);
  if (isBest) game.bossRushBest = { timeMs: totalMs, downs: br.downs, grade, when: Date.now() };
  // Once-per-day payout (anti-farm): 2 shards per echo + grade bonus.
  const today = new Date().toDateString();
  let payoutTxt = 'Daily reward already claimed — run logged for glory.';
  if (game._bossRushRewardDay !== today) {
    game._bossRushRewardDay = today;
    const bonus = grade === 'S' ? 20 : grade === 'A' ? 12 : grade === 'B' ? 6 : 2;
    const shards = br.downs * 2 + bonus;
    player.setshards = (player.setshards || 0) + shards;
    payoutTxt = '◈ ' + shards + ' Setshards claimed (daily reward).';
  }
  game.bossRush = br;   // keep inactive state for the results card
  if (window._brHudTimer) { clearInterval(window._brHudTimer); window._brHudTimer = null; }
  const hudEl = document.getElementById('boss-rush-hud'); if (hudEl) hudEl.remove();
  if (typeof saveState === 'function') saveState();
  // Results card — lightweight DOM overlay, dismiss with the button.
  let res = document.getElementById('boss-rush-results');
  if (res) res.remove();
  res = document.createElement('div');
  res.id = 'boss-rush-results';
  res.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:980;'
    + 'background:rgba(12,5,28,0.96);border:2px solid #8a5df0;border-radius:14px;padding:22px 30px;'
    + 'font:700 15px monospace;color:#efe6ff;text-align:center;box-shadow:0 0 40px rgba(120,70,255,0.45);';
  res.innerHTML = '<div style="font-size:26px;margin-bottom:6px;">⚔ RUSH COMPLETE</div>'
    + '<div style="font-size:52px;color:' + (grade === 'S' ? '#ffd966' : grade === 'A' ? '#9dffb0' : '#bdaaff') + ';margin:4px 0;">' + grade + '</div>'
    + '<div>' + br.downs + ' echoes · ' + timeStr + (isBest ? ' · ★ NEW BEST' : '') + '</div>'
    + '<div style="margin-top:8px;color:#cdb8ff;">' + payoutTxt + '</div>'
    + '<button id="boss-rush-results-close" style="margin-top:14px;padding:7px 22px;border-radius:9px;'
    + 'border:1px solid #8a5df0;background:#241047;color:#fff;font:700 14px monospace;cursor:pointer;">Walk away</button>';
  document.body.appendChild(res);
  const btn = document.getElementById('boss-rush-results-close');
  if (btn) btn.onclick = () => { res.remove(); };
  if (typeof showToast === 'function') showToast('🏆 Boss Rush complete — grade ' + grade + ' in ' + timeStr + '!', 'legendary');
  if (typeof flash === 'function') flash(0.5);
}
