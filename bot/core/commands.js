const { REST, Routes } = require('discord.js');

const musicCommand = {
  name: 'music',
  description: 'Nexus music player',
  options: [
    { name: 'join', description: 'Join your voice channel', type: 1 },
    { name: 'play', description: 'Play or queue a track or playlist', type: 1, options: [{ name: 'query', description: 'Song, URL, or playlist', type: 3, required: true }] },
    { name: 'pause', description: 'Pause playback', type: 1 },
    { name: 'resume', description: 'Resume playback', type: 1 },
    { name: 'skip', description: 'Skip the current track', type: 1 },
    { name: 'stop', description: 'Stop playback and clear the player', type: 1 },
    { name: 'queue', description: 'Show the current queue', type: 1 },
    { name: 'nowplaying', description: 'Show the current track', type: 1 },
    { name: 'volume', description: 'Set playback volume', type: 1, options: [{ name: 'level', description: 'Volume from 0 to 100', type: 4, required: true, min_value: 0, max_value: 100 }] },
    { name: 'shuffle', description: 'Shuffle the queue', type: 1 },
    { name: 'clear', description: 'Clear queued tracks', type: 1 },
    { name: 'loop', description: 'Enable or disable current-track looping', type: 1, options: [{ name: 'enabled', description: 'Enable track loop', type: 5, required: true }] },
    { name: 'seek', description: 'Seek within the current track', type: 1, options: [{ name: 'seconds', description: 'Position in seconds', type: 4, required: true, min_value: 0 }] }
  ]
};

const playlistCommand = {
  name: 'playlist',
  description: 'Manage saved YouTube playlists',
  options: [
    { name: 'save', description: 'Save or replace a YouTube playlist', type: 1, options: [{ name: 'name', description: 'Saved playlist name', type: 3, required: true }, { name: 'url', description: 'YouTube playlist URL', type: 3, required: true }] },
    { name: 'list', description: 'List your saved playlists', type: 1 },
    { name: 'info', description: 'Show saved playlist information', type: 1, options: [{ name: 'name', description: 'Saved playlist name', type: 3, required: true }] },
    { name: 'play', description: 'Play a saved playlist', type: 1, options: [{ name: 'name', description: 'Saved playlist name', type: 3, required: true }] },
    { name: 'refresh', description: 'Refresh a saved playlist from YouTube', type: 1, options: [{ name: 'name', description: 'Saved playlist name', type: 3, required: true }] },
    { name: 'delete', description: 'Delete a saved playlist', type: 1, options: [{ name: 'name', description: 'Saved playlist name', type: 3, required: true }] }
  ]
};

async function register(client) {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;
  if (!token || !clientId) throw new Error('DISCORD_TOKEN and CLIENT_ID are required for command registration.');
  const rest = new REST({ version: '10' }).setToken(token);
  const guildIds = [...new Set([process.env.GUILD_ID, '1534817549374455848'].filter(Boolean))];
  for (const guildId of guildIds) {
    const route = Routes.applicationGuildCommands(clientId, guildId);
    const existing = await rest.get(route);
    const preserved = existing.filter(command => command.name === 'music' || command.name === 'playlist' ? false : true);
    await rest.put(route, { body: [...preserved, musicCommand, playlistCommand] });
    console.log(`[COMMANDS] Registered clean command set for guild ${guildId}: music, playlist`);
  }
}

module.exports = { register, musicCommand, playlistCommand };
