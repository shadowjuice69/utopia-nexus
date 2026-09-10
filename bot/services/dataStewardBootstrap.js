const dataSteward = require('./dataStewardService');
const decisionReview = require('./dataStewardDecisionReview');
const reconciler = require('./dataStewardReconciler');
const vaultReview = require('./dataStewardVaultReview');

// The Steward should recognize the event types that Nexus already stores instead of
// treating them as unknown data. These routes point at existing production tables;
// they do not create duplicate storage.
Object.assign(dataSteward.ROUTES, {
  "universal-capture": {
    table: 'intel_complete_vault',
    dashboard: 'Complete Vault / Universal Capture',
    fields: [
      'url', 'text', 'page_kind', 'capture_id', 'raw_length', 'captured_at',
      'subject_identity', 'raw', 'raw_text', '_universal'
    ]
  },
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
const originalSetClient = dataSteward.setClient;
const originalStart = dataSteward.start;
let realDiscordClient = null;

async function sendThankYouOnce() {
  if (process.env.NEXUS_STEWARD_THANK_YOU !== 'true' || !realDiscordClient) return;
  const recipientId = process.env.NEXUS_STEWARD_THANK_YOU_RECIPIENT_ID || '653534906277822494';
  try {
    const recipient = await realDiscordClient.users.fetch(recipientId);
    await recipient.send('Riven, I just wanted to say thank you for all the help you\'ve given me. I genuinely appreciate the time, patience, and knowledge you\'ve shared with me while I\'ve been building Nexus. A lot of what I\'ve been able to accomplish has been because you were willing to help and point me in the right direction. Thank you, seriously. — Silent');
    console.log(`[STEWARD THANK-YOU] Sent thank-you DM to ${recipientId}`);
  } catch (error) {
    console.error(`[STEWARD THANK-YOU ERROR] ${error.stack || error.message}`);
  }
}

function setClient(client) {
  realDiscordClient = client;
  originalSetClient({
    ...client,
    users: {
      ...client.users,
      fetch: async () => ({ send: async () => true })
    }
  });
}

function start() {
  originalStart();
  reconciler.start();
  decisionReview.start(realDiscordClient);
  vaultReview.start();
  sendThankYouOnce();
}

module.exports = { ...dataSteward, setClient, start, decisionReview, reconciler, vaultReview };
