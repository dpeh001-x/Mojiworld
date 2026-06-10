#!/bin/bash
# rename_sfx.sh — bulk-rename Ludo-downloaded audio files into the audio/ tree
# Matches filename prefixes (which mirror the Ludo prompt) to target paths.
# Idempotent: skips files that don't match any pattern, removes duplicates.

DL=~/Downloads
DST=C:/Users/Xenon/Desktop/Mojiworld/audio

# (filename-pattern, target_path) pairs
declare -A MAP=(
  # Skill SFX — class-themed
  ["audio-Heavy-sword-sweep"]="$DST/skill/warrior_strike.mp3"
  ["audio-Two-handed-weapon-ground-smash"]="$DST/skill/warrior_slam.mp3"
  ["audio-Warrior-charge-whoosh"]="$DST/skill/warrior_dash.mp3"
  ["audio-Battle-roar-deep-masculine"]="$DST/skill/warrior_roar.mp3"
  ["audio-Knight-holy-shield-activation"]="$DST/skill/warrior_holy.mp3"
  ["audio-Apocalyptic-blade-strike"]="$DST/skill/warrior_ultimate.mp3"
  ["audio-Quick-dagger-thrust"]="$DST/skill/rogue_stab.mp3"
  ["audio-Throwing-knife-fan-release"]="$DST/skill/rogue_throw.mp3"
  ["audio-Stealth-dash-whoosh"]="$DST/skill/rogue_dash.mp3"
  ["audio-Smoke-bomb-deploy"]="$DST/skill/rogue_vanish.mp3"
  ["audio-Shadow-teleport-strike"]="$DST/skill/rogue_shadow.mp3"
  ["audio-Eclipse-massacre"]="$DST/skill/rogue_ultimate.mp3"
  ["audio-Arcane-bolt-cast"]="$DST/skill/mage_bolt.mp3"
  ["audio-Fireball-ignite"]="$DST/skill/mage_fire.mp3"
  ["audio-Ice-spike-formation"]="$DST/skill/mage_ice.mp3"
  ["audio-Arcane-burst-detonation"]="$DST/skill/mage_thunder.mp3"
  ["audio-Dimensional-teleport"]="$DST/skill/mage_warp.mp3"
  ["audio-Holy-light-heal"]="$DST/skill/mage_holy.mp3"
  ["audio-Meteor-falling-impact"]="$DST/skill/mage_meteor.mp3"
  ["audio-Soul-vortex"]="$DST/skill/mage_void.mp3"
  ["audio-Single-arrow-shot"]="$DST/skill/archer_arrow.mp3"
  ["audio-Multi-arrow-burst"]="$DST/skill/archer_multi.mp3"
  ["audio-Charged-shot-release"]="$DST/skill/archer_charged.mp3"
  ["audio-Evasive-back-flip"]="$DST/skill/archer_evade.mp3"
  ["audio-Eagle-eye-focus-activation"]="$DST/skill/archer_eagle.mp3"
  ["audio-Arrow-rain-barrage"]="$DST/skill/archer_rain.mp3"
  ["audio-Beast-summon"]="$DST/skill/archer_summon.mp3"
  # UI / feedback SFX
  ["audio-UI-menu-hover-toggle"]="$DST/ui/ui_toggle.mp3"
  ["audio-Boon-acquired"]="$DST/ui/boon_gain.mp3"
  ["audio-Rare-legendary-item-drop"]="$DST/ui/rare_drop.mp3"
  ["audio-Equipment-upgrade-success"]="$DST/ui/upgrade_success.mp3"
)

moved=0
removed=0
unmatched=0

for f in "$DL"/audio-*.mp3; do
  [ -f "$f" ] || continue
  base=$(basename "$f")
  matched=""
  for pat in "${!MAP[@]}"; do
    if [[ "$base" == "$pat"* ]]; then
      matched="$pat"
      target="${MAP[$pat]}"
      if [ -f "$target" ]; then
        # Already have this one — remove duplicate
        rm "$f"
        removed=$((removed + 1))
      else
        mv "$f" "$target"
        moved=$((moved + 1))
      fi
      break
    fi
  done
  if [ -z "$matched" ]; then
    unmatched=$((unmatched + 1))
    echo "UNMATCHED: $base"
  fi
done

echo ""
echo "moved=$moved removed_dups=$removed unmatched=$unmatched"
