const musicPlaylistService = require("../../services/musicPlaylistService");
const musicPlayer = require("../../services/musicPlayerService");

function voiceChannel(interaction) {
  return interaction.member?.voice?.channel || null;
}

function formatCount(count) {
  return `${Number(count || 0).toLocaleString()} track${Number(count || 0) === 1 ? "" : "s"}`;
}

function queueSavedTracks(player, tracks, requester) {
  if (!tracks.length) throw new Error("This playlist has no saved tracks.");
  const first = tracks[0];
  return player.addQuery(first.url, requester).then(() => {
    const rest = tracks.slice(1).map(track => ({
      id: track.youtube_video_id || null,
      title: track.title,
      url: track.url,
      duration: Number(track.duration_seconds || 0),
      source: "youtube",
      requester,
    }));
    if (player.raw?.queue && rest.length) player.raw.queue.push(...rest);
    return rest.length;
  });
}

module.exports = async function playlistHandler(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const user = interaction.user;

  if (["save", "play", "refresh", "delete"].includes(subcommand)) await interaction.deferReply();

  try {
    if (subcommand === "save") {
      const name = interaction.options.getString("name", true);
      const url = interaction.options.getString("url", true);
      const playlist = await musicPlaylistService.save(user, name, url);
      return interaction.editReply({ content: `💾 Saved **${playlist.name}** with **${formatCount(playlist.track_count)}**.` });
    }

    if (subcommand === "list") {
      const playlists = await musicPlaylistService.list(user);
      if (!playlists.length) return interaction.reply({ content: "🎵 You have no saved playlists." });
      const lines = playlists.map((playlist, index) => `${index + 1}. **${playlist.name}** — ${formatCount(playlist.track_count)}`);
      return interaction.reply({ content: `🎵 **Saved playlists**\n${lines.join("\n")}` });
    }

    if (subcommand === "info") {
      const name = interaction.options.getString("name", true);
      const playlist = await musicPlaylistService.get(user, name);
      return interaction.reply({ content: `🎵 **${playlist.name}**\nTracks: **${formatCount(playlist.track_count)}**\nSource: ${playlist.source_url}` });
    }

    if (subcommand === "play") {
      const voice = voiceChannel(interaction);
      if (!voice) return interaction.editReply({ content: "❌ Join a voice channel first." });
      const name = interaction.options.getString("name", true);
      const { playlist, tracks } = await musicPlaylistService.getTracks(user, name);
      const player = await musicPlayer.getOrCreatePlayer({ guildId: interaction.guildId, voiceChannelId: voice.id, textChannelId: interaction.channelId });
      const queued = await queueSavedTracks(player, tracks, user);
      return interaction.editReply({ content: `🎵 Playing **${playlist.name}** — **${tracks.length.toLocaleString()} tracks** loaded. **${queued.toLocaleString()}** added behind the current track.` });
    }

    if (subcommand === "refresh") {
      const name = interaction.options.getString("name", true);
      const playlist = await musicPlaylistService.refresh(user, name);
      return interaction.editReply({ content: `🔄 Refreshed **${playlist.name}** — **${formatCount(playlist.track_count)}**.` });
    }

    if (subcommand === "delete") {
      const name = interaction.options.getString("name", true);
      const playlist = await musicPlaylistService.remove(user, name);
      return interaction.editReply({ content: `🗑️ Deleted **${playlist.name}**.` });
    }

    return interaction.reply({ content: "❌ Unknown playlist subcommand.", ephemeral: true });
  } catch (error) {
    console.error(`[PLAYLIST] ${subcommand} failed: ${error.stack || error.message}`);
    if (interaction.deferred || interaction.replied) return interaction.editReply({ content: `❌ ${error.message}` });
    return interaction.reply({ content: `❌ ${error.message}`, ephemeral: true });
  }
};
