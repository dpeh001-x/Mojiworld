# Mojiworld — Steam Achievements (38)

The game already calls `SteamAPI.achievement.unlock(id)` on unlock and re-syncs owned
achievements on launch. For them to register on Steam you must create each one in the
**Steamworks partner site → your app → Stats & Achievements → Achievements**, with the
**API Name** set EXACTLY to the `apiname` below (case-sensitive), plus a locked + unlocked
icon per achievement (Steam requires both; 256×256 PNG).

| # | API Name (must match game id) | Display Name | Description |
|---|---|---|---|
| 1 | `firstBlood` | First Blood | Defeat 1 enemy |
| 2 | `slayer100` | Slayer | Defeat 100 enemies |
| 3 | `exterminator` | Exterminator | Defeat 1000 enemies |
| 4 | `bossHunter` | Boss Hunter | Defeat 3 different bosses |
| 5 | `lv10` | Adept | Reach level 10 |
| 6 | `lv20` | Apprentice | Reach level 20 |
| 7 | `lv50` | Master | Reach level 50 |
| 8 | `legendary` | Legendary Find | Possess a legendary item |
| 9 | `combo50` | Combo Striker | Reach a 50-hit combo |
| 10 | `combo100` | Centurion | Reach a 100-hit combo |
| 11 | `starforged` | Starforged | Enhance an item to ★5 |
| 12 | `ascendant` | Ascendant | Complete your first ascension |
| 13 | `firstCalling` | First Calling | Take your first class advancement |
| 14 | `truePath` | True Path | Reach a Master class |
| 15 | `lv30` | Veteran | Reach level 30 |
| 16 | `lv70` | Champion | Reach level 70 |
| 17 | `lv100` | Ascended | Reach level 100 |
| 18 | `lv150` | Mythic | Reach level 150 |
| 19 | `kill5000` | Annihilator | Defeat 5,000 enemies |
| 20 | `kill10000` | Worldbreaker | Defeat 10,000 enemies |
| 21 | `boss6` | Boss Slayer | Defeat 6 different bosses |
| 22 | `boss12` | Boss Conqueror | Defeat 12 different bosses |
| 23 | `aetherionDown` | Warden Undone | Vanquish Aetherion |
| 24 | `gravitosDown` | The Weight Lifted | Defeat Gravitos at the Singularity |
| 25 | `zodiac1` | Star-Toucher | Defeat your first Zodiac |
| 26 | `zodiacAll` | The Twelve Houses | Defeat all 12 Zodiac signs |
| 27 | `star8` | Master Smith | Enhance an item to ★8 |
| 28 | `star10` | Astral Forge | Enhance an item to ★10 |
| 29 | `coin50k` | Coin Hoarder | Hold 50,000 Mojicoins at once |
| 30 | `coin100k` | Mojibaron | Hold 100,000 Mojicoins at once |
| 31 | `bestiary20` | Field Researcher | Log 20 monster types |
| 32 | `bestiary40` | Naturalist | Log 40 monster types |
| 33 | `bestiary60` | Compendium Keeper | Log 60 monster types |
| 34 | `boonAttuned` | Attuned | Equip a full boon loadout |
| 35 | `boonHunter` | Boon Hunter | Collect 10 boons |
| 36 | `combo200` | Unstoppable | Reach a 200-hit combo |
| 37 | `prestige5` | Reborn | Ascend 5 times |
| 38 | `prestige20` | Apex Ascendant | Reach the prestige cap (20) |
