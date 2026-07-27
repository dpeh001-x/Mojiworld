# Mojiworld — Playtester Report Guide

## Every report = 📸 Screenshot + say the error.

That's the whole system. Two steps, always the same:

> ### 1. Take a screenshot the moment you see it.
> ### 2. Send it and say what's wrong in a few words.

Don't type the version or the map name — they're **already in your
screenshot** (version in the corner, map name in the top banner).

**One problem per screenshot.** If two things are wrong, send two shots.

---

## What to say next to the screenshot

Just a few words. Any of these is enough:

**🐞 Broken?** → screenshot + *"this froze after I killed the boss"*
**📍 Wrong spot?** → screenshot + *"Milo is standing on the portal — move him right"*
**🤔 Feels off?** → screenshot + *"this boss hits way too hard"*

If you can't think of words: **screenshot + "this looks wrong"** works too.

---

## Real examples

| 📸 Screenshot of… | ✏️ You say… |
|---|---|
| The frozen boss-kill screen | "game froze here after the mirror boss died" |
| Milo overlapping the portal | "move Milo off the portal, to the right" |
| A stuck weapon tooltip on the map | "this box won't go away after I equipped it" |
| The Aries boss | "this hits way harder than the last map" |
| A portal you spawn on top of | "I keep leaving by accident — move this or my spawn" |

---

## The only two extra words that help (optional)

- **Broken thing?** add **"every time"** or **"just once"**.
- **Moving thing?** point it where to go: **left / right / up / down /
  "next to Brok" / "away from spawn"**. (Or just circle it in the shot.)

---

## 📱 Taking the screenshot

- **Phone:** press the two side buttons together (or Power + Volume-Down).
- **Windows:** `Windows + Shift + S`, drag over the game, then paste it in.
- **Mac:** `Cmd + Shift + 4`, drag over the game.

Then drop it in the chat and add your few words. Done.

---

## For the dev (how these get used)

Every report is **screenshot-anchored**, so it pastes straight to Claude:

- The screenshot carries the **version** (corner) + **map** (banner) +
  the **visual symptom** — no typing needed from the tester.
- **🐞 Broken** → "Fix: [image] + their line." Map + symptom locate the
  code path.
- **📍 Wrong spot** → "[image] — reposition." The picture shows the exact
  overlap; their direction word → an `x`/`y` edit in `MAPS.<mapId>.npcs` /
  `.portals` (or the `MAPS.<x>.portals.push(...)` block).
- **🤔 Feels off** → balance/design input; may need one follow-up decision.

Keep the screenshots — the version in the corner lets a fix be confirmed
against the exact build the tester saw.
