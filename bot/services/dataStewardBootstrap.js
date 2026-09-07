const dataSteward = require('./dataStewardService');

// The Steward should recognize the event types that Nexus already stores instead of
// treating them as unknown data. These routes point at existing production tables;
// they do not create duplicate storage.
Object.assign(dataSteward.ROUTES, {
  attack: {
    table: 'attacks',
    dashboard: 'News / War / Attacks',
    fields: [
      'message_id', 'timestamp', 'attacker_province', 'attacker_kingdom',
      'target_province', 'target_kingdom', 'acres_captured', 'acres_recaptured',
      'acres_destroyed', 'troops_lost', 'troop_type', 'kills', 'prisoners',
      'spec_creds', 'peasants', 'peasants_gained', 'off_sent', 'offense_sent',
      'sent', 'enemy_defense', 'training_credits', 'return_time', 'return_days',
      'losses', 'loot', 'attack_type', 'buildings_survived', 'books_captured'
    ]
  },
  spell: {
    table: 'spell_events',
    dashboard: 'Magic / Spell Events',
    fields: [
      'message_id', 'timestamp', 'caster_province', 'target_province',
      'caster_kingdom', 'target_kingdom', 'spell_name', 'category', 'success',
      'result_value', 'duration', 'effects', 'result', 'raw'
    ]
  },
  thievery: {
    table: 'intel7_events',
    dashboard: 'Intel 7 / Thievery',
    fields: [
      'message_id', 'discord_message_id', 'timestamp', 'event_type',
      'kingdom', 'kd_code', 'province_name', 'province_kd', 'target_name',
      'target_kd', 'attacker_province', 'attacker_kingdom', 'target_province',
      'target_kingdom', 'operation', 'action', 'quantity', 'resource_type',
      'resource', 'amount', 'success', 'data', 'raw', 'raw_content'
    ]
  }
});

// Existing schema destinations are authoritative. The generic auto-mapping store
// is only a safety net for genuinely new fields, so known fields do not generate
// noisy alerts or duplicate vault records.
module.exports = dataSteward;
