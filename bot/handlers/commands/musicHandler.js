const musicService = require("../../services/musicService");
const musicPlayer = require("../../services/musicPlayerService");

function voiceChannel(interaction) {
  return interaction.member?.voice?.channel || null;
}

function formatTrack(track) {
  const info = track?.info || track || {};
  return `**${info.title || "Unknown track"}**${info.author ? ` — ${info.author}` : ""}`;
}

function playerState(player) {
  const current = player?.currentTrack;
  const queue = player?.queue || [];
  return { current, queue, playing: player?.playing === true, paused: player?.paused === true };
}

module.exports = async function musicHandler(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (!musicService.isEnabled()) {
    return interaction.reply({ content: "🎵 Music is currently disabled.", ephemeral: true });
  }

  const guildId = interaction.guildId;
  if (!guildId) return interaction.reply({ content: "❌ Music commands can only be used in a server.", ephemeral: true });

  const asyncSubcommands = ["play", "join", "stop", "pause", "resume", "skip", "volume", "seek", "loop"];
  if (asyncSubcommands.includes(subcommand)) {
    await interaction.deferReply();
  }

  try {
    if (subcommand === "play") {
      const voice = voiceChannel(interaction);
      if (!voice) return interaction.editReply({ content: "❌ Join a voice channel first." });
      const query = interaction.options.getString("query", true).trim();
      const player = await musicPlayer.getOrCreatePlayer({ guildId, voiceChannelId: voice.id, textChannelId: interaction.channelId });
      const result = await player.addQuery(query, interaction.user);
      const first = result.tracks?.[0];
      const label = result.playlistName
        ? `Added **${result.tracks.length} tracks** from **${result.playlistName}**.`
        : `Added ${formatTrack(first)}.`;
      return interaction.editReply({ content: `🎵 ${label}` });
    }

    if (subcommand === "join") {
      const voice = voiceChannel(interaction);
      if (!voice) return interaction.editReply({ content: "❌ Join a voice channel first." });
      await musicPlayer.getOrCreatePlayer({ guildId, voiceChannelId: voice.id, textChannelId: interaction.channelId });
      return interaction.editReply({ content: `🎵 Joined **${voice.name}**.` });
    }

    if (subcommand === "pause") {
      await musicPlayer.pause(guildId);
      return interaction.editReply({ content: "⏸️ Paused." });
    }
    if (subcommand === "resume") {
      await musicPlayer.resume(guildId);
      return interaction.editReply({ content: "▶️ Resumed." });
    }
    if (subcommand === "skip") {
      await musicPlayer.skip(guildId);
      return interaction.editReply({ content: "⏭️ Skipped." });
    }
    if (subcommand === "stop") {
      await musicPlayer.stop(guildId);
      await musicPlayer.destroyPlayer(guildId);
      return interaction.editReply({ content: "⏹️ Stopped and cleared the player." });
    }

    if (subcommand === "queue") {
      const state = playerState(musicPlayer.requirePlayer(guildId));
      const lines = state.queue.slice(0, 10).map((track, index) => `${index + 1}. ${formatTrack(track)}`);
      let content = state.current ? `🎵 **Now:** ${formatTrack(state.current)}\n` : "🎵 **Now:** Nothing playing\n";
      content += lines.length ? `\n**Queue:**\n${lines.join("\n")}` : "\n**Queue:** Empty";
      if (state.queue.length > 10) content += `\n…and ${state.queue.length - 10} more.`;
      return interaction.reply({ content });
    }

    if (subcommand === "nowplaying") {
      const state = playerState(musicPlayer.requirePlayer(guildId));
      return interaction.reply({ content: state.current
        ? `🎵 **Now playing:** ${formatTrack(state.current)}${state.paused ? "\n⏸️ Paused" : ""}`
        : "🎵 Nothing is currently playing." });
    }

    if (subcommand === "volume") {
      const value = interaction.options.getInteger("level", true);
      await musicPlayer.volume(guildId, value);
      return interaction.editReply({ content: `🔊 Volume set to **${value}%**.` });
    }

    if (subcommand === "shuffle") {
      musicPlayer.shuffle(guildId);
      return interaction.reply({ content: "🔀 Queue shuffled." });
    }

    if (subcommand === "clear") {
      musicPlayer.clearQueue(guildId);
      return interaction.reply({ content: "🗑️ Queue cleared." });
    }

    if (subcommand === "loop") {
      const enabled = interaction.options.getBoolean("enabled", true);
      await musicPlayer.loop(guildId, enabled);
      return interaction.editReply({ content: enabled ? "🔁 Track loop enabled." : "➡️ Track loop disabled." });
    }

    if (subcommand === "seek") {
      const seconds = interaction.options.getInteger("seconds", true);
      await musicPlayer.seek(guildId, seconds * 1000);
      return interaction.editReply({ content: `⏩ Seeked to **${seconds}s**.` });
    }

    return interaction.reply({ content: "❌ Unknown music subcommand.", ephemeral: true });
  } catch (error) {
    console.error(`[MUSIC] ${subcommand} failed: ${error.message}`);
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({ content: `❌ ${error.message}` });
    }
    return interaction.reply({ content: `❌ ${error.message}`, ephemeral: true });
  }
};
