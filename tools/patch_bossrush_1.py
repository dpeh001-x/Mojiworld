# Boss Rush patch 1/2 — map, portal, save fields, killMonster + loadMap hooks.
import os, io
P = os.path.join(os.path.dirname(__file__), '..', 'mojiworld_game.html')
s = io.open(P, encoding='utf-8').read()
assert len(s) > 4_000_000, 'file suspiciously small — aborting'

def rep(anchor, new, n=1):
    assert s.count(anchor) == n, 'anchor not unique (%d): %r' % (s.count(anchor), anchor[:70])
    return s.replace(anchor, new)

# A1 — Hall of Echoes portal in The Void, next to the town star.
a = "      { x:400, y:420, dest:'town', name:'⭐ Everdawn Central', iconStar:true },"
s = rep(a, a + "\n      { x:620, y:420, dest:'boss_rush', name:'⚔ Hall of Echoes', iconStar:true },   // v0.26.x — Boss Rush entry")

# A2 — boss_rush arena map, inserted before the Everdawn Megamall block.
a = "  // v0.25.267 — Everdawn Megamall: a covered marketplace pocket map"
MAP = """  // v0.26.x — Hall of Echoes: Boss Rush arena. Entered via the violet star
  // portal in The Void. The rush controller (_bossRushAutoStart, near the
  // boot block) re-summons every boss the player has ENCOUNTERED
  // (game.mojidexSeen) as reward-less echoes, back to back, with a run
  // timer + grade + once-per-day shard payout. spawns stays empty — bosses
  // are injected by the controller; isBossArena only buys the boss BGM
  // (the auto-intro path needs a spawns[].boss entry, so it stays silent).
  boss_rush: {
    name:'Hall of Echoes',
    bg:'voidBlack',
    sky:['#070310','#0d0620','#1a0b33'],
    worldWidth: 1600,
    isBossArena: true,
    isVoid: true,
    platforms: [
      { x:0, y:480, w:1600, h:60, type:'ground' },
    ],
    npcs: [],
    portals: [
      { x:90, y:420, dest:'void', name:'⭐ The Void', iconStar:true },
    ],
    spawns: [],
  },
"""
s = rep(a, MAP + a)

# A3 — persist rush best + daily-reward stamp.
a = "  'expedition'\n];"
s = rep(a, "  'expedition',\n  // v0.26.x — Boss Rush: best-run record + once-per-day reward stamp.\n  'bossRushBest','_bossRushRewardDay'\n];")

# A4 — skip the super-boss death cinematic for rush echoes.
a = "  // Super-boss cinematic death + legendary reward pile\n  if (m.type === 'aetherion' || m.superBoss) {\n    triggerSuperBossDeath(m);\n  }"
s = rep(a, "  // Super-boss cinematic death + legendary reward pile\n  // v0.26.x — skipped for Boss Rush echoes: the cinematic holds the camera\n  // and would fight the rush's own next-boss countdown.\n  if ((m.type === 'aetherion' || m.superBoss) && !m._rushBoss) {\n    triggerSuperBossDeath(m);\n  }")

# A5 — rush bookkeeping at the top of the boss-kill branch.
a = "  if (m.isBoss) {\n    // v0.26.277 — Skip the persistent-world bossDefeated stamp when the"
s = rep(a, "  if (m.isBoss) {\n    // v0.26.x — Boss Rush: advance the rush before any persistent-world\n    // bookkeeping (the _echoBoss tag already skips stamps/boons/shards).\n    if (m._rushBoss && game.bossRush && game.bossRush.active && typeof _bossRushOnBossDown === 'function') {\n      try { _bossRushOnBossDown(m); } catch (e) {}\n    }\n    // v0.26.277 — Skip the persistent-world bossDefeated stamp when the")

# A6 — single choke point: leaving the hall by ANY route ends the rush.
a = "  // v0.26.220 — Portal SFX. Fires at the start of every map transition."
s = rep(a, """  // v0.26.x — Boss Rush: ANY map change away from the hall ends the rush
  // (death respawn, exit portal, dev warp, expedition start — one choke
  // point catches them all; the spawn reset below clears the echoes).
  if (game.bossRush && game.bossRush.active && id !== 'boss_rush') {
    const _br = game.bossRush;
    game.bossRush = null;
    if (typeof _bossRushHud === 'function') _bossRushHud(false);
    if (typeof showToast === 'function' && _br.queue && _br.downs < _br.queue.length) {
      showToast('⚔ Boss Rush over — ' + _br.downs + '/' + _br.queue.length + ' echoes laid to rest.', 'warn');
    }
  }
""" + a)

# A7 — auto-start the rush on hall entry (re-entry/reload always = fresh run).
a = '  // v0.26.x — FINAL BOSS entrance (per user, "make it more dramatic"). The Gravitos'
s = rep(a, """  // v0.26.x — Boss Rush auto-start: entering the Hall of Echoes begins the
  // rush once the fade settles. Re-entering restarts a fresh run; a reload
  // that restores currentMap='boss_rush' starts a new rush too — no
  // stranded/softlocked state is possible.
  if (id === 'boss_rush') {
    setTimeout(() => { if (typeof _bossRushAutoStart === 'function') _bossRushAutoStart(); }, 900);
  }
""" + a)

assert not any(0xD800 <= ord(c) <= 0xDFFF for c in s), 'lone surrogate detected'
tmp = P + '.tmp'
with io.open(tmp, 'w', encoding='utf-8', newline='') as f:
    f.write(s)
assert os.path.getsize(tmp) > 4_000_000
os.replace(tmp, P)
print('patch 1 OK, new size', os.path.getsize(P))
