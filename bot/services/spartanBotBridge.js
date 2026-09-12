const supabaseService = require('./supabase');
const logger = require('./logger');
const crypto = require('crypto');

function clean(value, max = 12000) { return String(value || '').slice(0, max); }

async function recordEvent({ direction, eventType, userId, channelId, guildId, messageId, commandName, content, metadata = {} }) {
  const sb = supabaseService.getClient();
  if (!sb) return null;
  const { data, error } = await sb.from('spartan_bot_events').insert({
    event_id: crypto.randomUUID(), direction, event_type: eventType,
    discord_user_id: userId || null, discord_channel_id: channelId || null,
    discord_guild_id: guildId || null, message_id: messageId || null,
    command_name: commandName || null, content: clean(content), metadata,
  }).select('id,event_id').maybeSingle();
  if (error) logger.warn(`[SPARTAN BOT BRIDGE] event write failed: ${error.message}`);
  return data || null;
}

async function inboundMessage(message) {
  if (!message) return;
  return recordEvent({
    direction: message.author?.bot ? 'outbound' : 'inbound', eventType: 'discord_message',
    userId: message.author?.id, channelId: message.channelId, guildId: message.guildId,
    messageId: message.id, content: message.content,
    metadata: { author_bot: Boolean(message.author?.bot), channel_name: message.channel?.name || null },
  });
}

async function inboundInteraction(interaction) {
  const command = interaction?.commandName || null;
  let subcommand = null;
  try { subcommand = interaction.options?.getSubcommand(false) || null; } catch (_) {}
  return recordEvent({
    direction: 'inbound', eventType: 'discord_interaction', userId: interaction?.user?.id,
    channelId: interaction?.channelId, guildId: interaction?.guildId, messageId: interaction?.id,
    commandName: command, content: command ? `/${command}` : 'interaction', metadata: { subcommand },
  });
}

async function outboundMessage({ userId, channelId, guildId, messageId, content, metadata = {} }) {
  return recordEvent({ direction: 'outbound', eventType: 'discord_message', userId, channelId, guildId, messageId, content, metadata });
}

module.exports = { recordEvent, inboundMessage, inboundInteraction, outboundMessage };
