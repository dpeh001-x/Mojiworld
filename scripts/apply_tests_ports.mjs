// Test suites that hard-code their port or the game's file name (tests-ports). Test infrastructure only - no game change.
// ============================================================================
// Many older scripts/*_test.mjs suites load the game from a fixed place: 'http://localhost:8080/mojiworld_game.html'
// (a server someone else had to start), a fixed or argv-only port (`const PORT = 8123`, `process.argv[3] || 8123`), or
// the fixed file name (`/mojiworld_game.html`, `file:///.../mojiworld_game.html`, `argv[2] || 'mojiworld_game.html'`).
// They could not run against a private build (MOJI_GAME_FILE) or on a port of the caller's choosing (PORT), so they could
// not run in parallel with other suites or against a candidate build before it ships.
// Now each honours the standard pair from scripts/keybinds_test.mjs:
//   const PORT = process.env.PORT || '<its old port>'
//   const FILE = process.env.MOJI_GAME_FILE ? basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html'
// An argv override stays first (argv > env > the old default); a free-port finder is skipped only when PORT is set;
// MOJI_GAME_URL / PERF_PORT keep their precedence. With no env set, every suite behaves exactly as before.
// Rules are line-local and code-only (comment lines are never touched); a file is converted only when its rule count
// matches the plan below (taken on origin), so a suite another session rewrote since is refused, never half-converted.
//   LX_ROOT=<dir holding scripts/>   default the repo; point it at a private copy of origin's scripts to build the ship set
//   LX_TP_SKIP_DRIFT=1               skip (and list) drifted files instead of aborting
//   LX_TP_PLAN=1                     print the plan for the files found (build time only)
// Each file: tmp beside it -> node --check -> rename (EPERM/EBUSY retry). Idempotent (a converted file carries MARK).
// Only scripts/*_test.mjs are ever written; never the game file.
import { readFileSync, writeFileSync, renameSync, readdirSync, existsSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const ROOT = process.env.LX_ROOT || 'C:/Users/dpeh0/Mojiworld';
const DIR = path.join(ROOT, 'scripts');
const MARK = '// tests-ports:';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
if (!existsSync(DIR)) die('no scripts/ under ' + ROOT);

// ---- the converter: returns { out, n } (n = edits), or { err } ----
function convert(src) {
  const crlf = (src.match(/\r\n/g) || []).length, lf = (src.match(/\n/g) || []).length;
  const EOL = crlf > lf / 2 ? '\r\n' : '\n';
  // lines and their own terminators (a file mixing LF and CRLF keeps every untouched line byte for byte)
  const parts = src.split(/(\r?\n)/), L = [], SEP = [];
  for (let i = 0; i < parts.length; i += 2) { L.push(parts[i]); SEP.push(parts[i + 1] || ''); }
  const hasPath = /^import\s+(\*\s+as\s+)?path\s+from\s+['"](node:)?path['"]/m.test(src);
  const declFILE = /^\s*(const|let|var)\s+FILE\s*=/m.test(src);
  const declPORT = /\b(?:const|let|var)\s+(?:[^;\n]*,\s*)?PORT\s*(?:=|;)/.test(src);
  const fileExpr = "process.env.MOJI_GAME_FILE ? " + (hasPath ? 'path.basename(process.env.MOJI_GAME_FILE)' : "process.env.MOJI_GAME_FILE.split(/[\\\\/]/).pop()") + " : 'mojiworld_game.html'";
  let n = 0, useFILE = false, usePORT = null, inBlock = false, err = null;
  const sub = (line, re, rep) => line.replace(re, (...a) => { n++; return typeof rep === 'function' ? rep(...a) : rep; });
  for (let i = 0; i < L.length; i++) {
    let l = L[i]; const t = l.trim();
    if (inBlock) { if (t.includes('*/')) inBlock = false; continue; }
    if (t.startsWith('/*') && !t.includes('*/')) { inBlock = true; continue; }
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue;
    // PORT declarations: env after an argv override, before the old default
    l = sub(l, /\blet\s+PORT\s*=\s*process\.argv\[(\d)\]\s*;/, (m, d) => `let PORT = process.argv[${d}] || process.env.PORT;`);
    l = sub(l, /\blet\s+PORT\s*;/, 'let PORT = process.env.PORT;');
    l = sub(l, /\blet\s+PORT\s*=\s*null\s*;/, 'let PORT = process.env.PORT || null;');
    l = sub(l, /(\b(?:_|GAME_)?PORT\s*=\s*(?:Number\()?)process\.argv\[(\d)\]\s*\|\|(?!\s*process\.env\.PORT)\s*/,(m, a, d) => `${a}process.argv[${d}] || process.env.PORT || `);
    l = sub(l, /(\b_?PORT\s*=\s*)process\.env\.PERF_PORT\s*\|\|(?!\s*process\.env\.PORT)\s*/, (m, a) => `${a}process.env.PERF_PORT || process.env.PORT || `);
    l = sub(l, /\bconst\s+PORT\s*=\s*(\d{2,5})\s*;/, (m, p) => `const PORT = Number(process.env.PORT || ${p});`);
    l = sub(l, /\bconst\s+PORT\s*=\s*(['"])(\d{2,5})\1\s*;/, (m, q, p) => `const PORT = process.env.PORT || '${p}';`);
    // fixed URLs
    const want = (p) => { if (usePORT && usePORT !== p) err = 'two fixed ports (' + usePORT + ', ' + p + ')'; usePORT = p; };
    l = sub(l, /(['"])http:\/\/localhost:(\d+)\/mojiworld_game\.html(\?[^'"`]*)?\1/g, (m, q, p, qs) => { want(p); useFILE = true; return '`http://localhost:${PORT}/${FILE}' + (qs || '') + '`'; });
    l = sub(l, /(['"])http:\/\/localhost:(\d+)\/monster_animator\.html\1/g, (m, q, p) => { want(p); return '`http://localhost:${PORT}/monster_animator.html`'; });
    l = sub(l, /(`http:\/\/localhost:\$\{[\w$.]+\}\/)mojiworld_game\.html/g, (m, a) => { useFILE = true; return a + '${FILE}'; });
    l = sub(l, /('http:\/\/localhost:'\s*\+\s*[\w$]+\s*\+\s*)'\/mojiworld_game\.html'/g, (m, a) => { useFILE = true; return a + "'/' + FILE"; });
    if (/^\s*(const|let|var)\s+FILE\s*=/.test(l)) l = sub(l, /\|\|\s*(['"])mojiworld_game\.html\1/, () => '|| (' + fileExpr + ')');
    else l = sub(l, /\|\|\s*(['"])mojiworld_game\.html\1/g, () => { useFILE = true; return '|| FILE'; });
    if (/file:|goto\(/.test(l)) l = sub(l, /(path\.join\(\s*ROOT\s*,\s*)(['"])mojiworld_game\.html\2(\s*\))/g, (m, a, q, b) => { useFILE = true; return a + 'FILE' + b; });
    L[i] = l;
  }
  // ws:// on the game's own (formerly fixed) port follows PORT too
  if (usePORT) for (let i = 0; i < L.length; i++) { const t = L[i].trim(); if (t.startsWith('//') || t.startsWith('*')) continue;
    L[i] = L[i].replace(new RegExp("(['\"])ws://localhost:" + usePORT + '\\1', 'g'), () => { n++; return '`ws://localhost:${PORT}`'; }); }
  if (err) return { err };
  if (!n) return { out: src, n: 0 };
  if (useFILE && declFILE) return { err: 'FILE is already declared for something else' };
  if (usePORT && declPORT) return { err: 'PORT is already declared and a fixed port is used too' };
  // the header (and the constants the rewritten URLs need), after the last import
  let at = -1; for (let i = 0; i < L.length; i++) if (/^import\s/.test(L[i])) { at = i; while (at < L.length - 1 && !/from\s+['"][^'"]+['"]\s*;?\s*$|^import\s+['"][^'"]+['"]\s*;?\s*$/.test(L[at])) at++; }
  if (at < 0) return { err: 'no import to anchor the header' };
  const add = [MARK + ' PORT / MOJI_GAME_FILE from the environment (scripts/apply_tests_ports.mjs); unset = the old defaults'];
  if (usePORT) add.push(`const PORT = process.env.PORT || '${usePORT}';`);
  if (useFILE) add.push('const FILE = ' + fileExpr + ';');
  L.splice(at + 1, 0, ...add); SEP.splice(at + 1, 0, ...add.map(() => EOL));
  return { out: L.map((l, k) => l + SEP[k]).join(''), n: n + add.length };
}

// ---- the plan: files and their edit counts on origin (LX_TP_PLAN=1 regenerates it) ----
const PLAN = {   // 385 suites, origin 8268d14a
  'act3_arrival_test.mjs': 4, 'additions_audit_test.mjs': 4, 'advancement_and_deadeye_test.mjs': 4, 'aetherion_astral_test.mjs': 4,
  'aetherionastral_art_test.mjs': 3, 'amnesiac_wipe_gate_test.mjs': 4, 'anim_frame_scale_test.mjs': 3, 'anim_smoothness_test.mjs': 3,
  'animator_edge_feather_test.mjs': 3, 'animator_headbody_test.mjs': 2, 'arbiter_attack_sets_test.mjs': 4, 'archbishop_icon_test.mjs': 4,
  'archer_basic_single_target_test.mjs': 3, 'archer_bow_rotation_test.mjs': 4, 'area_card_test.mjs': 4, 'aries_ember_test.mjs': 4,
  'art_drop_test.mjs': 3, 'ascension_reset_test.mjs': 3, 'audio_paths_test.mjs': 4, 'audit_dataloss_test.mjs': 3,
  'audit_expedition_bravo_test.mjs': 3, 'audit_regression_fixes_test.mjs': 4, 'audit_zodiac_echo_test.mjs': 3, 'b6_bravo_seat_test.mjs': 4,
  'bake_dpr_test.mjs': 4, 'bank_and_chill_test.mjs': 4, 'barnaby_arc_test.mjs': 3, 'barnaby_evade_anim_test.mjs': 3, 'barnaby_fist_test.mjs': 4,
  'blockland_bg_test.mjs': 3, 'bloom_bgm_test.mjs': 4, 'bolt_flight_test.mjs': 4, 'boon_balance_test.mjs': 4, 'boon_drop_rate_test.mjs': 4,
  'boon_potency_test.mjs': 4, 'boot_gate_pause_test.mjs': 4, 'boot_gate_test.mjs': 4, 'boot_priority_test.mjs': 4, 'boot_prologue_test.mjs': 4,
  'boss_add_sweep_test.mjs': 3, 'boss_bar_chip_test.mjs': 4, 'boss_bar_test.mjs': 4, 'boss_col_telegraph_art_test.mjs': 4,
  'boss_column_sprite_test.mjs': 4, 'boss_conductor_motion_test.mjs': 4, 'boss_cornered_test.mjs': 4, 'boss_dead_traits_test.mjs': 3,
  'boss_death_cleanup_test.mjs': 3, 'boss_fairness_test.mjs': 3, 'boss_floor_test.mjs': 3, 'boss_killshot_test.mjs': 4,
  'boss_latch_sweep_test.mjs': 4, 'boss_level_floor_test.mjs': 4, 'boss_resizer_anim_test.mjs': 2, 'boss_scale_transition_test.mjs': 4,
  'boss_sprites_running_test.mjs': 5, 'boss_state_readout_test.mjs': 4, 'boss_threat_ai_test.mjs': 4, 'boss_title_test.mjs': 4,
  'boss_walk_timing_test.mjs': 3, 'boss_ward_test.mjs': 2, 'boss_zone_punish_test.mjs': 4, 'boss_zone_telegraph_test.mjs': 4,
  'camera_space_test.mjs': 4, 'capricorn_ice_proj_test.mjs': 4, 'carriage_stage3_test.mjs': 4, 'cast_aura_load_test.mjs': 3,
  'cc_stacking_test.mjs': 3, 'chest_placement_clearance_test.mjs': 3, 'class_balance_mirror_test.mjs': 2, 'class_damage_dummy_test.mjs': 2,
  'class_hit_fx_test.mjs': 4, 'cloudburst_skill_test.mjs': 4, 'combat_backlog_test.mjs': 4, 'combat_bug_repro_test.mjs': 4,
  'combat_fx_budget_test.mjs': 4, 'combat_test.mjs': 4, 'comet_orientation_test.mjs': 3, 'compact_card_test.mjs': 4,
  'conductor_touch_boon_test.mjs': 4, 'coop_2client_test.mjs': 5, 'coop_authority_test.mjs': 4, 'coop_avatar_mirror_test.mjs': 4,
  'coop_boss_test.mjs': 5, 'coop_bosshit_test.mjs': 5, 'coop_chat_test.mjs': 5, 'coop_e2e_two_clients_test.mjs': 4, 'coop_edge_test.mjs': 5,
  'coop_elite_test.mjs': 5, 'coop_env_test.mjs': 5, 'coop_fidelity_test.mjs': 3, 'coop_handler_audit_test.mjs': 3, 'coop_hardening_test.mjs': 5,
  'coop_hazard_test.mjs': 5, 'coop_hidden_host_test.mjs': 5, 'coop_host_election_test.mjs': 4, 'coop_latency_test.mjs': 5,
  'coop_live_world_test.mjs': 5, 'coop_look_cf_live_test.mjs': 4, 'coop_look_test.mjs': 5, 'coop_loot_test.mjs': 5, 'coop_paint_sync_test.mjs': 3,
  'coop_party_support_test.mjs': 3, 'coop_peerfeel_test.mjs': 5, 'coop_projectile_test.mjs': 5, 'coop_revive_e2e_test.mjs': 4,
  'coop_revive_test.mjs': 5, 'coop_seamless_test.mjs': 4, 'coop_skills_audit_test.mjs': 4, 'coop_stormpact_test.mjs': 3,
  'coop_sync_fidelity_test.mjs': 3, 'coop_ui_test.mjs': 4, 'coop_visual_sync_test.mjs': 3, 'corner_tray_test.mjs': 4, 'cs_class_cards_test.mjs': 4,
  'cs_look_page_test.mjs': 4, 'cs_picker_cards_test.mjs': 4, 'cs_preview_backdrop_test.mjs': 3, 'damage_outline_test.mjs': 3, 'dash_fx_test.mjs': 4,
  'dash_leg_attach_test.mjs': 4, 'dead_eyes_outline_test.mjs': 3, 'def_pierce_cap_test.mjs': 2, 'def_pierce_rank_ramp_test.mjs': 2,
  'def_scaling_test.mjs': 3, 'defense_paths_test.mjs': 4, 'dev_teleport_test.mjs': 4, 'dev_unlock_test.mjs': 4, 'dmgnum_outline_test.mjs': 4,
  'dn_bitmap_dpr_test.mjs': 4, 'doombringer_bloodwave_test.mjs': 4, 'doombringer_brand_test.mjs': 3, 'doombringer_fire_test.mjs': 4,
  'doombringer_spin_test.mjs': 3, 'double_shot_cap_test.mjs': 4, 'downed_banner_test.mjs': 4, 'downed_visibility_test.mjs': 4,
  'dragoon_buff_test.mjs': 4, 'drop_sprite_test.mjs': 3, 'drs_test.mjs': 4, 'echoknight_plant_test.mjs': 4, 'eclipse_massacre_balance_test.mjs': 3,
  'economy_ladders_test.mjs': 4, 'edge_probe_defer_test.mjs': 4, 'edge_rows_parity_test.mjs': 2, 'edicts_surface_test.mjs': 4,
  'elder_drop_rate_test.mjs': 3, 'elite_drop_rate_test.mjs': 2, 'ember_pips_test.mjs': 4, 'endgame_profile_test.mjs': 2,
  'ending_backdrop_test.mjs': 4, 'entity_shadow_test.mjs': 4, 'everdawn_welcome_test.mjs': 4, 'expedition_boss_test.mjs': 4,
  'express_scaling_test.mjs': 3, 'fireball_hitbox_test.mjs': 4, 'flier_ground_test.mjs': 3, 'forge_failure_card_test.mjs': 4,
  'forge_green_price_test.mjs': 3, 'forge_ux_test.mjs': 4, 'foundry_def_test.mjs': 3, 'fx_sprites_decode_test.mjs': 4, 'grandhex_revamp_test.mjs': 3,
  'graphics_settings_test.mjs': 4, 'grav_impact_test.mjs': 4, 'grav_warm_pacing_test.mjs': 4, 'gravitos3_idle_pulse_test.mjs': 4,
  'gravitos_anim_test.mjs': 4, 'gravitos_arena_test.mjs': 2, 'gravitos_bake_pump_test.mjs': 3, 'gravitos_beat_test.mjs': 4,
  'gravitos_blue_meteor_test.mjs': 4, 'gravitos_finale_test.mjs': 4, 'gravitos_floor_drift_test.mjs': 3, 'gravitos_floor_test.mjs': 3,
  'gravitos_form_cast_test.mjs': 4, 'gravitos_laser_anim_test.mjs': 4, 'gravitos_ohko_warn_test.mjs': 3, 'gravitos_perf_runtime_test.mjs': 4,
  'gravitos_plant_test.mjs': 2, 'gravitos_safezone_draw_test.mjs': 3, 'gravitos_shadow_bolt_test.mjs': 2, 'gravitos_slam_telegraph_test.mjs': 3,
  'gravitos_soul_anim_test.mjs': 2, 'gravitos_star_idle_removal_test.mjs': 4, 'gravitos_well_depth_test.mjs': 3, 'guguma_ascend_gate_test.mjs': 4,
  'hazard_telegraph_test.mjs': 3, 'hit_spark_test.mjs': 3, 'hitrate_tuning_test.mjs': 4, 'hud_column_test.mjs': 4, 'hud_footer_test.mjs': 4,
  'hud_identity_test.mjs': 4, 'hud_size_slider_test.mjs': 4, 'hunt_supply_cap_test.mjs': 4, 'ice_ring_anchor_test.mjs': 2,
  'inert_fix_verify_test.mjs': 4, 'kanji_stamp_test.mjs': 4, 'keybind_rebind_test.mjs': 4, 'kill_streak_edge_test.mjs': 3, 'kill_streak_test.mjs': 3,
  'krook_ai_alive_test.mjs': 4, 'krook_attack_strings_test.mjs': 3, 'krook_tuning_test.mjs': 3, 'lego_sticky_gore_test.mjs': 4,
  'legosaurus_bracedash_test.mjs': 4, 'legosaurus_feel_test.mjs': 4, 'leo_pounce_attack_test.mjs': 4, 'leo_pounce_test.mjs': 4,
  'libra_scales_test.mjs': 4, 'lifesteal_cap_test.mjs': 2, 'lifesteal_source_cap_test.mjs': 2, 'lyra_arc_test.mjs': 3,
  'mage_dash_sprite_test.mjs': 4, 'magic_bolt_fade_test.mjs': 4, 'map_backdrop_video_test.mjs': 3, 'map_honeycomb_shrink_test.mjs': 3,
  'master_advancement_grant_test.mjs': 3, 'meteor_anim_test.mjs': 4, 'meteor_pillar_hitbox_test.mjs': 4, 'milo_hop_confirm_test.mjs': 4,
  'minimap_symbols_test.mjs': 4, 'mob_attack_anim_speed_test.mjs': 4, 'mob_bake_base_test.mjs': 4, 'mob_cast_plant_test.mjs': 3,
  'mob_float_clamp_test.mjs': 2, 'mobile_render_test.mjs': 4, 'mojimon_anim_test.mjs': 3, 'mojimon_balance_ascension_test.mjs': 4,
  'mojimon_firstbind_test.mjs': 3, 'mojimon_hp_parity_test.mjs': 4, 'mojimon_padded_frame_test.mjs': 3, 'monster_kit_coverage_test.mjs': 4,
  'monster_sprite_heal_test.mjs': 4, 'monster_traits_test.mjs': 4, 'mooma_quake_strand_test.mjs': 4, 'mp_backdrop_test.mjs': 3,
  'mp_cosmetic_e2e_test.mjs': 4, 'mp_title_sync_test.mjs': 4, 'mwrap_anim_test.mjs': 4, 'nav_icons_ship_test.mjs': 2,
  'necro_vortex_heal_test.mjs': 3, 'necromancer_rename_test.mjs': 3, 'new_features_smoke_test.mjs': 4, 'no_chests_without_mobs_test.mjs': 4,
  'npc_dialog_style_test.mjs': 4, 'octobaby_phase_event_test.mjs': 3, 'pact_and_telegraph_test.mjs': 4, 'pad_u_stats_worldmap_test.mjs': 3,
  'panel_frame_test.mjs': 4, 'panel_vh_audit_test.mjs': 4, 'particle_combat_cap_test.mjs': 4, 'party_exp_scaling_test.mjs': 4,
  'pause_owner_test.mjs': 3, 'pause_panel_style_test.mjs': 4, 'perf_hotpath_test.mjs': 4, 'perf_readback_test.mjs': 4, 'platform_tint_test.mjs': 4,
  'player_title_test.mjs': 4, 'playtest_skills_test.mjs': 4, 'portal_access_test.mjs': 3, 'portal_bake_test.mjs': 4, 'portal_seat_test.mjs': 3,
  'pq_carriage_scaling_test.mjs': 3, 'pq_chain_integrity_test.mjs': 3, 'pq_objective_target_test.mjs': 3, 'pq_pin_map_gate_test.mjs': 4,
  'pq_playthrough_test.mjs': 3, 'pq_post40_exp_test.mjs': 3, 'pq_restart_option_test.mjs': 3, 'pq_stage_count_test.mjs': 3,
  'progression_record_test.mjs': 4, 'prologue_no_earn_test.mjs': 4, 'prologue_pleasant_test.mjs': 2, 'ps5_pad_test.mjs': 2,
  'quake_plume_anim_test.mjs': 4, 'quake_ring_aspect_test.mjs': 3, 'quest_count_prose_test.mjs': 3, 'quest_hud_draggable_test.mjs': 3,
  'quest_master_test.mjs': 3, 'quest_navigator_test.mjs': 3, 'quest_navigator_ui_test.mjs': 3, 'quest_pin_heading_test.mjs': 3,
  'quest_pin_screenspace_test.mjs': 3, 'quest_repeat_and_mirror_test.mjs': 4, 'quest_text_accuracy_test.mjs': 4, 'railshot_vertical_hit_test.mjs': 4,
  'rampage_vfx_test.mjs': 4, 'recipe_scroll_removed_test.mjs': 2, 'rogue_basic_fx_test.mjs': 3, 'safezone_anim_test.mjs': 4,
  'save_and_cache_hardening_test.mjs': 4, 'save_guard_test.mjs': 4, 'scaled_mode_cap_test.mjs': 4, 'scroll_buyout_removed_test.mjs': 2,
  'secure_save_test.mjs': 4, 'setshard_economy_test.mjs': 4, 'shackle_mirror_fix_test.mjs': 4, 'shockwave_anim_test.mjs': 4,
  'shopkeeper_voice_test.mjs': 3, 'sigil_test.mjs': 4, 'singularity_disc_prewarm_test.mjs': 4, 'skill_icon_test.mjs': 4,
  'skill_milestone_runtime_test.mjs': 4, 'skill_pierce_and_tooltip_test.mjs': 4, 'skill_sfx_timing_test.mjs': 3, 'skygarden_gate_test.mjs': 4,
  'skylance_apex_test.mjs': 4, 'solo_smoke_test.mjs': 4, 'soul_vortex_anim_test.mjs': 3, 'soulorb_upright_test.mjs': 3,
  'sovereign_amnesiac_lore_test.mjs': 4, 'sovereign_homer_blit_test.mjs': 3, 'sovereign_regalia_test.mjs': 4, 'sovereign_shade_test.mjs': 4,
  'spire_drift_test.mjs': 4, 'spire_rift_test.mjs': 4, 'sprite_bbox_test.mjs': 4, 'sprite_edge_feather_test.mjs': 4, 'sprite_gate_retry_test.mjs': 5,
  'star_bands_test.mjs': 4, 'star_signature_test.mjs': 4, 'start_menu_test.mjs': 4, 'status_tint_bake_test.mjs': 3, 'steam_coop_review_test.mjs': 4,
  'steam_depot_boot_test.mjs': 2, 'steam_input_nav_test.mjs': 4, 'steam_integration_test.mjs': 4, 'steam_virtual_pad_test.mjs': 2,
  'story_beat_card_test.mjs': 4, 'story_beat_look_test.mjs': 2, 'story_voice_test.mjs': 4, 'stream_yield_test.mjs': 4,
  'summon_vulnerability_test.mjs': 4, 'sunset_levelreq_test.mjs': 2, 'swap_and_cull_test.mjs': 4, 'talent_icon_test.mjs': 4,
  'taur_charge_sprite_test.mjs': 2, 'taurus_gore_test.mjs': 4, 'taxi_combat_memory_test.mjs': 3, 'title_pad_nav_test.mjs': 4,
  'toast_style_test.mjs': 4, 'today_regressions_test.mjs': 4, 'tower_pit_rescue_test.mjs': 4, 'town_portal_tint_test.mjs': 3,
  'tutorial_fixes_test.mjs': 4, 'tutorial_gravity_test.mjs': 3, 'tutorial_interactive_test.mjs': 4, 'tutorial_keys_test.mjs': 4,
  'u_panel_fit_test.mjs': 4, 'u_panel_order_test.mjs': 3, 'ui_audit_test.mjs': 4, 'ui_injection_test.mjs': 3, 'ui_input_guard_test.mjs': 4,
  'ui_panel_test.mjs': 3, 'ui_polish_test.mjs': 4, 'underwater_ceiling_test.mjs': 4, 'underwater_fall_damage_test.mjs': 3,
  'underwater_height_test.mjs': 4, 'underwater_jumps_test.mjs': 4, 'updraft_warning_test.mjs': 4, 'virga_tune_test.mjs': 4,
  'void_backdrop_test.mjs': 4, 'void_intro_zoom_test.mjs': 5, 'wardrobe_fashionista_test.mjs': 3, 'warrior_shockwave_size_test.mjs': 4,
  'weather_fog_removed_test.mjs': 4, 'wolf_pack_ai_test.mjs': 3, 'world_stream_test.mjs': 4, 'world_variety_test.mjs': 4, 'worldmap_art_test.mjs': 4,
  'worldmap_emoji_test.mjs': 4, 'worldmap_header_test.mjs': 4, 'worldmap_hover_test.mjs': 4, 'worldmap_icons_test.mjs': 4,
  'worldmap_lanes_test.mjs': 4, 'worldmap_overlap_test.mjs': 3, 'worldmap_route_test.mjs': 4, 'worldmap_territory_test.mjs': 4,
  'worldmap_type_test.mjs': 4, 'worldmap_zoom_test.mjs': 4, 'zodiac_behaviour_test.mjs': 3, 'zodiac_gait_test.mjs': 3, 'zodiac_pillar_test.mjs': 4,
  'zodiac_threats_test.mjs': 3,
};

// ---- main ----
const isTarget = (f) => /^[\w.-]+_test\.mjs$/.test(f) && f !== 'apply_tests_ports.mjs';
if (process.env.LX_TP_PLAN) {
  const plan = {};
  for (const f of readdirSync(DIR).filter(isTarget).sort()) {
    const s = readFileSync(path.join(DIR, f), 'utf8');
    if (s.includes(MARK)) continue;
    const code = s.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    if (s.includes('MOJI_GAME_FILE') && !/\b8080\b|localhost:80\d\d\b/.test(code)) continue;   // says it honours the private build (serve.js aliases it) and no fixed 80xx port
    const r = convert(s);
    if (r.err) console.error('SKIP ' + f + ': ' + r.err); else if (r.n) plan[f] = r.n;
  }
  console.log(JSON.stringify(plan));
  process.exit(0);
}
const todo = [], drift = [], done = [];
for (const f of Object.keys(PLAN)) {
  if (!isTarget(f)) die('not a test suite: ' + f);
  const fp = path.join(DIR, f);
  if (!existsSync(fp)) { drift.push(f + ' (missing)'); continue; }
  const s = readFileSync(fp, 'utf8');
  if (s.includes(MARK)) { done.push(f); continue; }
  const r = convert(s);
  if (r.err || r.n !== PLAN[f]) { drift.push(f + ' (' + (r.err || r.n + ' edits, planned ' + PLAN[f]) + ')'); continue; }
  todo.push([f, fp, r.out]);
}
if (drift.length && !process.env.LX_TP_SKIP_DRIFT) die('changed since the plan (LX_TP_SKIP_DRIFT=1 skips them):\n  ' + drift.join('\n  '));
if (!todo.length) { console.log(done.length ? 'already applied' : 'nothing to do'); process.exit(0); }
for (const [f, fp, out] of todo) {
  const tmp = path.join(DIR, '.tp_' + f);   // .mjs, so node --check parses it as a module
  writeFileSync(tmp, out, 'utf8');
  const chk = spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8' });
  if (chk.status !== 0) { try { unlinkSync(tmp); } catch (e) {} die(f + ' fails node --check after conversion:\n' + (chk.stderr || '').slice(0, 400)); }
  let ok = false, lastErr = null;
  for (let a = 1; a <= 8 && !ok; a++) {
    try { renameSync(tmp, fp); ok = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!ok) die('rename kept failing on ' + f + ': ' + lastErr.code);
}
console.log('applied: tests-ports - ' + todo.length + ' suites converted' + (done.length ? ', ' + done.length + ' already' : '') + (drift.length ? ', ' + drift.length + ' SKIPPED (drift)' : ''));
for (const [f] of todo) console.log('  scripts/' + f);
if (drift.length) { console.log('skipped:'); for (const d of drift) console.log('  scripts/' + d); }
