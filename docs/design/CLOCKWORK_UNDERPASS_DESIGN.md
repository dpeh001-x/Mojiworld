# THE CLOCKWORK UNDERPASS

> Solo Party Quest design — Mojiworld

A nostalgic-MMORPG-style multi-stage dungeon reimagined for a single player. Five stages plus a 3-phase boss. **Target run time: 8–15 minutes**.

The player is a *"party of one"* — they swap between **Role Masks** that temporarily grant party-style abilities (Scout / Brawler / Trickster / Healer / Jumper). The dungeon's mechanics are designed around switching masks at the right moment, not stacking buffs.

---

## 1. Theme & tone

**Location:** a hidden sewer-and-subway system beneath the neon Everdawn skyline. Steam-pipe lighting, broken ticket machines, rusted turnstiles, ghostly conductors. Equal parts urban-fantasy haunted train and clockwork dungeon.

**Tone:** fast · funny · slightly chaotic · puzzle-heavy but not frustrating · replayable.

**Hook NPC:** **Milo the Rusted Usher** (mechanical butler with a missing arm and an over-confident sense of his job description). He stands at the entrance turnstile.

> *"Party required? Not any more, friend. Show me you can be five fools at once."*

The dungeon is in-fiction a *trial* set up by a long-dead transit authority that demanded teams of five to enter the depths. Milo lets solo players bypass the rule by proving they can fill all five roles.

---

## 2. Player role-mask system

The player gains a temporary **Role Mask** by picking up a glowing mask token in the dungeon (or by spending Mask Charges earned mid-run). Each mask lasts 8 seconds and goes on a 6-second cooldown after use.

Maximum: hold **2 Mask Charges** at a time. Charges replenish at masks/checkpoints between stages.

| Mask | Effect | Visual cue |
|---|---|---|
| 🔍 **Scout** | Reveals hidden walls, fake platforms, hidden tokens for 8 s. Walls + fakes glow cyan. | Cyan eye-glow overlay on player + cyan particle trail |
| ⚒️ **Brawler** | +60 % ATK + can break "barrier" tile type that normal hits can't. | Red ember outline + screen-flash on first hit |
| 🎭 **Trickster** | Switches all activatable mechanisms within 200 px of player; spawns a static decoy that draws aggro for 3 s. | Purple shimmer + decoy puff |
| 💚 **Healer** | Restores 25 % HP instantly + immunity to poison/hazard tiles for 8 s. | Green halo + soft heal pulse |
| 🦘 **Jumper** | +1 air-jump and +40 % move speed; dash range +50 %. | Blue speed-streak afterimage |

**Design rule:** Each stage's solutions are designed around ONE primary mask + one secondary. Players don't need all five every run — they need to read the room.

---

## 3. Quest structure

**Entry quest:** `q_clockwork_underpass` (Lv 25 gate — placed after the Mirror Self Trial so the player has class identity + L20 advancement).

**Run format:**
1. **Lobby — Ticket Panic** (combat)
2. **Stage 2 — The Counting Room** (logic puzzle)
3. **Stage 3 — Rat Race Relay** (platforming)
4. **Stage 4 — The Imposter Party** (clone-puzzle)
5. **Stage 5 — The Password Beast** (clue assembly)
6. **Boss — Conductor Gloomgear** (3-phase)

**Timer:** visible counter starting at **15:00**, counting down. The clear timer is generous; pressure is *exciting, not stressful*. Failing the timer doesn't kick the player — they finish the run for participation rewards, just no Gold/Perfect medal.

**Bonus objectives (per run, displayed at start):**
- ✦ Clear under 10 minutes
- ✦ Find all 7 hidden Rust Tokens
- ✦ Take no deaths
- ✦ Beat boss without using Healer mask
- ✦ Solve the optional secret puzzle room

---

## 4. Stage 1 — Ticket Panic

**Scene:** broken subway lobby. Four turnstiles in a row. Rusted ticket machines flicker behind them. Mechanical pest enemies (ticketMech) scurry around carrying coloured paper tickets.

**Objective:** collect the correct ticket combination to unlock the eastern gate.

**Per-run randomisation:** the required combination varies (3 red + 2 blue, or 4 cracked, or 1 golden from a mini-elite, etc). The combination is shown on a flickering display at the western turnstile.

**Enemy types:**
- 🐀 **ticketMech** — common; drops a random colour ticket. Some carry **fake tickets** (visible only in Scout mode — flicker yellow when revealed).
- 🛡️ **armoredMech** — uncommon; takes 50 % damage from normal hits. **Brawler mode** breaks them in one hit.
- 👑 **goldenRat** — mini-elite that drops the rare golden ticket. Spawns once per run from a random hiding spot.

**Combo meter:** a hit-streak counter at the top of the screen. Defeating enemies within 1.5 s of the last kill boosts the ticket drop rate (cap +60 %). Resets on missed hits or movement timeouts.

**Hidden shortcut:** a cracked wall in the south-west corner. Scout mode reveals it (cyan outline). Brawler mode breaks it. Behind it: a chest with 2 Rust Tokens + a Mask Charge.

**Solo mask emphasis:** **Scout + Brawler**. Optional: Jumper to reach an upper ledge with a bonus ticket spawn.

**Anti-frustration:** if the player has all required tickets but is stuck mid-combat, the ticket display flashes green showing they can leave. They don't have to clear every enemy.

---

## 5. Stage 2 — The Counting Room

**Scene:** a circular pipe chamber with **5 numbered platforms** (1-5), **3 steaming pipes**, and **3 ticket machines** giving cryptic readings on cracked screens.

**Objective:** stand on the correct subset of platforms simultaneously (using shadow clones to make up the count) so their numbers add up to the gate code on the central display.

**Per-run randomisation:** the code varies (e.g., "7", "9", "12"). The platforms always sum to enough valid combinations (multiple solutions usually exist).

**Clues (per run, randomised):**
- One ticket machine truthfully tells the answer.
- One machine lies.
- The third gives a riddle ("the lonely platform + the loudest pipe = ?")
- **Steam pipes**: only steaming pipes can be trusted as "yes" indicators on numbered platforms.
- **Broken lamps** in the room: the count of unlit lamps = the gate code.

**Solo adaptation:** The player can deploy **shadow clones** (Trickster mask spawn) on platforms. Each Trickster activation spawns 1 clone that stays on the platform it's deployed on until the player leaves the room.

**Failure mode (non-punishing):** entering a wrong code doesn't kick the player — instead a **3-enemy wave** spawns in the room (a mix of ticketMech). After defeating them, the code reshuffles to a new value and the player retries.

**Solo mask emphasis:** **Trickster + Scout**.

**Hidden secret:** A 6th platform behind one of the steaming pipes (Scout reveals it; only stand-able with Jumper). Standing on it adds the room's "secret answer" to the Password Beast clue chain in Stage 5.

---

## 6. Stage 3 — Rat Race Relay

**Scene:** vertical platforming shaft. Pipes, conveyor belts, steam vents, slippery slime patches. Water is slowly rising from below — visible as a green tide line that climbs 10 px every 5 seconds.

**Objective:** reach the top and hit **3 valves** before the rising water catches the player.

**Mechanics:**
- **Conveyor belts** (left/right) shift platforms beneath the player.
- **Steam vents** launch the player upward (instant boost) — must be triggered intentionally by jumping over the vent at the right time.
- **Slime patches** halve move speed for 2 s on contact.
- **Rats with rust coins** scurry on certain platforms; killing them drops a Rust Token.

**Three routes:**
- 🟢 **Safe route** (right wall): no slime, no fast platforms. ~80 s clear time. Few coins.
- 🟡 **Fast route** (centre): steam-vent chain with risky 1-frame jumps. ~45 s clear. Medium coins.
- 🔴 **Hidden route** (left wall, Scout-revealed): narrow ledges + 1 collapsing platform. ~60 s clear. **Hidden Rust Token chest + secret answer fragment**.

**Solo mask emphasis:** **Jumper** (the obvious one). Bonus: **Trickster** to briefly freeze conveyor belts for tight jumps.

**Anti-frustration:** if the water catches the player, they're shoved back to the last platform they stood on (not the bottom). Lose 10 seconds off the timer instead of failing the stage. Each valve when hit drops the water level by 80 px so even slow players can pace through.

---

## 7. Stage 4 — The Imposter Party

**Scene:** mirror chamber. Four player-shaped silhouettes appear in cracked mirrors around the room. Each mirror has a unique frame.

**Objective:** use the mirror clones to activate **4 simultaneous switches** on a single timed gate (4-second hold required).

**Clone personalities (randomised which is which per run):**
- 🦁 **Brave Mirror** — runs straight at the nearest switch and presses it on contact.
- 😴 **Lazy Mirror** — stays put. The player can step on its head to use it as a platform.
- 🐔 **Panic Mirror** — moves opposite to the player's input direction.
- ⏰ **Delay Mirror** — mimics the player with a 1-second lag.

**Puzzle:** with the timed 4-switch hold, the player has to:
1. Position the Lazy clone on a high switch (only reachable via Jumper or by jumping off the clone's head).
2. Send the Brave clone toward another switch by moving until it's lined up.
3. Use the Delay clone by walking to a switch and STOPPING — the clone arrives 1 sec later on its own.
4. Trick the Panic clone by walking AWAY from the switch you want it to reach.

**Humor beats:**
- Brave clone shouts *"FOR THE TICKETS!"* on activation.
- Lazy clone yawns when stepped on (*"five more minutes…"*).
- Panic clone screams (*"WHY ARE YOU CHASING ME?"*) when player approaches.
- Delay clone says nothing — it just stares at the player's feet.

**Solo mask emphasis:** **Trickster** (to spawn additional decoys if a clone is killed) + **Scout** (to identify which mirror is which clone type — the personality is hidden until Scout reveals the labels).

**Hidden secret:** if all 4 clones are active and standing on switches simultaneously, the player can briefly see a *5th mirror* in the centre wall that wasn't there before. Hitting it = secret answer fragment for Stage 5.

---

## 8. Stage 5 — The Password Beast

**Scene:** a locked vault chamber. A creature made of layered subway maps, torn tickets, and dangling sign-arms hangs from the ceiling — the **Password Beast** (it's not a boss; it's a sentinel).

**Objective:** input a 4-symbol code derived from clues collected across the previous stages.

**The 4 symbols come from:**
1. **Ticket-Panic stage**: the COLOUR of the rarest ticket type the player collected.
2. **Counting Room**: the highest single-platform NUMBER the player stood on.
3. **Rat Race**: the route the player took (safe/fast/hidden) maps to a SHAPE (○/△/✦).
4. **Imposter Party**: the personality of the LAST clone activated (Brave/Lazy/Panic/Delay) maps to a GLYPH.

**Input mechanism:** four floor-tiles in front of the Beast, each with rotating symbol cycles. Step on a tile to advance its cycle; step back off and the symbol locks.

**Fallback for forgetful players:** if the player can't remember, **defeat the Beast via combat** (a 5-monster wave appears). Doing so reveals 1 random clue. Players can repeat this until they have all 4 clues — but each combat reveal costs **30 seconds off the timer**.

**Solo mask emphasis:** **Scout** can reveal *faint echoes* of past clues by holding the mask near each symbol tile, but at a cost (each Scout activation here = -2 % final score).

**Successful input:** the Beast disassembles into spinning ticket-stubs, vault door opens, and the player drops into the Boss Arena.

---

## 9. Boss — Conductor Gloomgear

**Visual:** a tall, rusted train-conductor figure. One hand is a turnstile gear, the other a punch-card stamper. His head is a pair of crossed signal flags. Steam vents periodically from his neck.

**Voice:** stuffy and bureaucratic. Lines like:
> *"Tickets! Tickets, please. NO discounts."*
> *"You appear to be travelling without a party. PROHIBITED."*
> *"Final destination: the abyss. Last call."*

### Phase 1 — Ticket Check (HP 100%–66%)
**Mechanics:**
- Gloomgear pulls out a punch-card and demands a colour. The colour shows on a board above him for 3 seconds, then hides.
- Three coloured **ticket-mech minions** spawn at intervals.
- The player must defeat the minion matching the demanded colour and throw its ticket into the ticket-eating slot in Gloomgear's chest. Correct ticket = he gets stunned 2 s (free-damage window). Wrong ticket = a steam-blast hazard.

**Solo mask emphasis:** **Scout** (the colour board can be hard to read at distance — Scout extends visibility) + **Brawler** (faster minion-clear = more open damage windows).

### Phase 2 — Platform Chaos (HP 66%–33%)
**Mechanics:**
- The arena is now a subway car moving sideways. Floor tiles slide left/right under the player at 2 px/frame.
- Gloomgear charges across the screen every 4 s; the player must jump over him.
- Steam vents pop up randomly and launch anyone standing on them.
- He throws "punch-card" projectiles in arcs.

**Solo mask emphasis:** **Jumper** (mandatory for the charge dodges) + **Trickster** (briefly freezes the sliding floor).

### Phase 3 — Full Party Test (HP 33%–0%)
**Mechanics:** all five mask types are forced into rapid succession:
- 🔍 **Scout** to identify the REAL Gloomgear among 3 decoys (decoys flicker; real one has a missing flag).
- ⚒️ **Brawler** to break the armour plating he summons (uniformly tinted; only Brawler hits damage him during armour phases).
- 🎭 **Trickster** to disable a side-gate trap that would otherwise insta-kill on Phase 3 finish.
- 💚 **Healer** to survive a poison-fog gas attack that ticks 8 % HP per second during a 6-second wave.
- 🦘 **Jumper** to dodge the giant "TRAIN" attack — Gloomgear summons a full subway car that sweeps the entire arena floor; only the highest platform clears it.

**Final hit cue:** when Gloomgear hits 5 % HP, he kneels and the camera zooms in. The player walks up and delivers a final punch-card strike — dramatic, satisfying, slowmo.

> *"I… was a fool to ride this line… alone…"*

His body collapses into a pile of tickets that the player can loot.

---

## 10. Rewards

**On any clear (Bronze+):**
- 1 random gear drop, T3 minimum
- 500 Mojicoins
- 3 Rust Tokens (currency for re-running)
- 1 random potion bundle

**Silver (<15 min):** + 1 Bronze Underpass Badge cosmetic accessory.

**Gold (<10 min):** + 1 **Subway Token Pet** (mechanical rat that follows the player; cosmetic only).

**Perfect (no deaths, all secrets, all tokens):** + **"Party of One"** title (shows above nameplate) + 1 **Conductor's Punch-Card** (legendary weapon skin: turns any equipped weapon into a glowing punch-card stamp).

**Per-clear randomised rewards:**
- 1-3 unique cosmetic outfit pieces (uniform jacket, conductor's hat, ticket-stub belt, etc.)
- Random Rune fragment (puzzle-token used to unlock harder Underpass tiers)
- 1 in 50: shiny "Last Train" backpack accessory (extremely rare cosmetic)

**Ranking:**
| Medal | Requirement |
|---|---|
| Bronze | Clear |
| Silver | Clear <15 min |
| Gold | Clear <10 min |
| Perfect | No deaths · all 7 Rust Tokens · all bonus objectives complete |

---

## 11. Replayability

**Randomised per run:**
- Ticket combination (Stage 1)
- Counting Room code + clue-pattern truth/lie assignments (Stage 2)
- Rat Race platform layout + steam vent positions (Stage 3)
- Mirror clone personality assignments (Stage 4)
- Password Beast symbol mapping (Stage 5)
- Boss attack order (Phase 1 colour demands)

**Secret room location:** randomly placed in Stage 2 or Stage 4 each run. Holds a unique recipe scroll.

**Challenge modifiers** (unlock after first Gold clear):
- 🚫 **No Healing** — Healer mask disabled; consumables banned.
- ⏩ **Express Train** — platforms move 2× faster; timer 12 min instead of 15.
- 🎭 **Mask Roulette** — masks change effects each room.
- 👻 **Stealth Mode** — enemies aggro at 2× range; combat noise alerts boss to Phase 3 instantly.
- 🪞 **Mirror Mode** — clone personalities randomise *per stage* instead of per run.
- 🩸 **Lethal Conductor** — boss damage ×1.5; rewards ×1.5.

**Combinable** — stacking 3 modifiers unlocks the **Inverted Underpass** layout (rooms in reverse, boss first, lobby last). Pure speedrunner content.

---

## 12. NPC dialogue (sample)

**Milo at entrance, first visit:**
> *"Welcome to the Underpass, traveller. Mind the gap. And the rust. And the ghosts."*
> *"Party required? Not any more. Show me you can be five fools at once."*
> *"You'll need masks. Take this one — it's the only one I haven't lost."*
> *(Hands the player a Scout mask + first Mask Charge.)*

**Milo at entrance, post-Bronze:**
> *"Back already? The Conductor still talks about you, you know. Mostly complaints."*

**Milo, when player wears Conductor's Punch-Card:**
> *"…oh. OH. You actually did it. Well done, kid. Well done."*

**Inside the dungeon — radio voiceovers** (rotate per run):
- *"Attention passengers: the abyss-bound train will be slightly delayed. By eternity."*
- *"Lost and Found is closed. Permanently."*
- *"Please mind the lurkers in the third car."*
- *"For your safety, please do not feed the spirit conductors. They are not hungry."*

**Conductor Gloomgear quotes** (Phase 1 → 3):
- *"Tickets! Tickets, please. NO discounts."*
- *"The 7:42 to the void is now boarding. All aboard or all… aboard."*
- *"One player. ONE? Impossible. Show me your party."*
- *"This is the end of the line. Final stop."*

---

## 13. Hard Mode — "The Express Line"

Unlocked after first Perfect clear. Available via Milo (3 Rust Tokens to enter).

**Differences from standard:**
- Timer: **10:00** instead of 15.
- All enemies +75 % HP / +50 % ATK.
- Boss has 4 phases instead of 3 (new Phase 0: "Fare Inspector" — solo combat against 3 ticket-inspector mini-elites before the main fight).
- **Single role only** — at the start, player picks 1 mask. Others are locked for the whole run.
- Rewards ×3.
- Exclusive cosmetic: **"Last Conductor"** outfit (shimmering steam-cloak that emits white particles on movement).

---

## 14. Anti-frustration design notes

1. **Wrong answers never insta-fail.** Every "wrong" input either spawns a small enemy wave (which the player can clear) or reshuffles the puzzle. The timer is the only failure mechanism.
2. **Generous timer.** 15 minutes for a 8-12 minute run. Pressure should feel exciting, not stressful.
3. **No checkpoint loss on death.** Death respawns the player at the last stage's start with -30 s on the timer. Bronze is still possible even with several deaths.
4. **Visible objectives at all times.** Top-of-screen UI shows: timer, current stage objective, mask charges, bonus tokens collected. No hidden requirements.
5. **Solo-friendly puzzle hints.** Each puzzle has at least one "obvious" path and one "clever" path. Players who can't crack the clever path can brute-force the obvious one.
6. **Fallback combat.** Every clue puzzle in Stage 5 has a "fight to reveal" fallback. No player gets soft-locked.
7. **Random per run, never per session.** The seed is set on dungeon entry and stays for the whole run — re-trying a puzzle uses the same clues. No re-rolling stage RNG by retrying.

---

## 15. Implementation roadmap (Mojiworld-specific)

### Version 1 (target this batch — v0.25.863)
- New map: `clockworkUnderpassLobby` (Stage 1 only)
- New NPC: **Milo the Rusted Usher** at Everdawn Central
- New quest: `q_clockwork_underpass` (visit-type; Stage 1 only)
- New monster type: `ticketMech` (variant of slime with ticket-drop loot)
- Portal from Everdawn Central to lobby

### Version 2 — Role mask system
- `player._pqRole` engine flag
- Hotkey 1-5 for mask activation
- HUD overlay showing current mask + charges
- Scout/Brawler/Trickster/Healer/Jumper effect implementations

### Version 3 — Stage 2 (Counting Room) + Stage 3 (Rat Race)
- Two new maps with their puzzle/platforming layouts
- Shadow-clone Trickster ability
- Rising-water hazard system

### Version 4 — Stage 4 (Imposter Party) + Stage 5 (Password Beast)
- Mirror-clone AI variants (Brave / Lazy / Panic / Delay)
- Password Beast sentinel enemy
- Clue-tracking save data (per-run seed + clue tokens)

### Version 5 — Conductor Gloomgear boss + rewards
- Boss arena map
- 3-phase boss AI
- Reward drop tables + cosmetic items
- Perfect medal tracking
- Subway Token Pet implementation

### Version 6 — Hard mode + modifiers
- Hard mode unlock gate
- Challenge modifier UI
- Inverted Underpass layout
- Last Conductor cosmetic

---

## 16. The big adaptation principle (reminder for future implementation)

When converting party mechanics to solo:

| Party version | Solo version |
|---|---|
| Four players stand on four switches | Solo player + 3 Trickster shadow clones |
| One player answers, others fight | Player solves clues while Healer mask buys time vs adds |
| Party splits up | Drones / Scout echoes scout side tunnels |
| Tank holds aggro | Trickster decoy taunts |
| Healer keeps party alive | Healer mask + brief invuln on activation |

**The feeling to preserve:** "I am one person but I just did the job of five." Every stage should end with a small moment where the player thinks *"…that was clever. I figured that out alone."*
