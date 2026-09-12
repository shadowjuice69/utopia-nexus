const supabaseService = require('./supabase');
const logger = require('./logger');
const crypto = require('crypto');

function clean(value, max = 12000) { return String(value || '').slice(0, max); }

async function routeIntoSpartan(sb, event) {
  const captureId = `bot-${event.eventId}`;
  const payload = { source: 'discord-bot', event_type: event.eventType, direction: event.direction, content: event.content, metadata: event.metadata, discord: { user_id: event.userId, channel_id: event.channelId, guild_id: event.guildId, message_id: event.messageId, command: event.commandName } };
  const { error: captureError } = await sb.from('spartan_capture_vault').insert({ capture_id: captureId, source: 'discord-bot', source_id: event.messageId || event.eventId, page_kind: 'bot_event', province_id: null, kingdom_id: null, raw_text: event.content, raw_payload: payload, parsed_payload: { type: 'bot_event', kind: 'bot_event', data: payload }, content_hash: crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex'), captured_at: new Date().toISOString() });
  if (captureError) throw new Error(`capture: ${captureError.message}`);
  const { data: flow, error: flowError } = await sb.from('spartan_data_flow').insert({ source: 'discord-bot', source_id: event.messageId || event.eventId, capture_id: captureId, province_id: null, kingdom_id: null, page_kind: 'bot_event', status: 'received', stage: 'ingest', current_stage: 'ingest', payload: { capture_id: captureId, event_type: event.eventType, direction: event.direction } }).select('flow_id').maybeSingle();
  if (flowError) throw new Error(`flow: ${flowError.message}`);
  const { error: edgeError } = await sb.from('spartan_data_edges').insert({ flow_id: flow.flow_id, from_system: 'discord_bot', to_system: 'spartan_processing_queue', event_type: 'ingest', payload: { capture_id: captureId }, from_node: 'discord_bot', to_node: 'spartan_processing_queue', edge_type: 'ingest', status: 'completed', metadata: { event_type: event.eventType, direction: event.direction } });
  if (edgeError) throw new Error(`edge: ${edgeError.message}`);
  const { error: queueError } = await sb.from('spartan_processing_queue').insert({ flow_id: flow.flow_id, stage: 'bot_event', priority: 90, status: 'pending', payload: { capture_id: captureId } });
  if (queueError) throw new Error(`queue: ${queueError.message}`);
  return flow.flow_id;
}

async function recordEvent({ direction, eventType, userId, channelId, guildId, messageId, commandName, content, metadata = {} }) {
  const sb = supabaseService.getClient();
  if (!sb) return null;
  const eventId = crypto.randomUUID();
  const event = { eventId, direction, eventType, userId, channelId, guildId, messageId, commandName, content: clean(content), metadata };
  const { data, error } = await sb.from('spartan_bot_events').insert({ event_id: eventId, direction, event_type: eventType, discord_user_id: userId || null, discord_channel_id: channelId || null, discord_guild_id: guildId || null, message_id: messageId || null, command_name: commandName || null, content: event.content, metadata }).select('id,event_id').maybeSingle();
  if (error) logger.warn(`[SPARTAN BOT BRIDGE] event write failed: ${error.message}`);
  try { await routeIntoSpartan(sb, event); logger.info(`[SPARTAN BOT BRIDGE] routed ${direction} ${eventType} into Spartan event=${eventId}`); }
  catch (routeError) { logger.warn(`[SPARTAN BOT BRIDGE] Spartan route failed event=${eventId}: ${routeError.message}`); }
  return data || null;
}

async function inboundMessage(message) {
  if (!message) return;
  return recordEvent({ direction: message.author?.bot ? 'outbound' : 'inbound', eventType: 'discord_message', userId: message.author?.id, channelId: message.channelId, guildId: message.guildId, messageId: message.id, content: message.content, metadata: { author_bot: Boolean(message.author?.bot), channel_name: message.channel?.name || null } });
}

async function inboundInteraction(interaction) {
  const command = interaction?.commandName || null; let subcommand = null;
  try { subcommand = interaction.options?.getSubcommand(false) || null; } catch (_) {}
  return recordEvent({ direction: 'inbound', eventType: 'discord_interaction', userId: interaction?.user?.id, channelId: interaction?.channelId, guildId: interaction?.guildId, messageId: interaction?.id, commandName: command, content: command ? `/${command}` : 'interaction', metadata: { subcommand } });
}

async function outboundMessage({ userId, channelId, guildId, messageId, content, metadata = {} }) { return recordEvent({ direction: 'outbound', eventType: 'discord_message', userId, channelId, guildId, messageId, content, metadata }); }
module.exports = { recordEvent, inboundMessage, inboundInteraction, outboundMessage };
