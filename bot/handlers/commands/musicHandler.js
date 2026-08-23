const musicService = require("../../services/musicService");
const musicPlayer = require("../../services/musicPlayerService");

function voiceChannel(interaction) {
  return interaction.member?.voice?.channel || null;
}

function formatTrack(track) {
  if (!track) return "Unknown track";
  return `**${track.title || "Unknown track"}**${track.author ? ` — ${track.author}` : ""}`;
}

function getQueue(guildId) {
  const queue = musicPlayer.getPlayer(guildId);
  if (!queue) throw new Error("No active music player in this server.");
  return queue;
}

module.exports = async function musicHandler(interaction) {
  const subcommand = interaction.options.getSubcommand();

  if (!musicService.isEnabled()) {
    return interaction.reply({ content: "🎵 Music is currently unavailable.", ephemeral: true });
  }

  const guildId = interaction.guildId;
  if (!guildId) return interaction.reply({ content: "❌ Music commands can only be used in a server.", ephemeral: true });

  const asyncSubcommands = ["play", "join", "stop", "pause", "resume", "skip", "volume", "seek", "loop"];
  if (asyncSubcommands.includes(subcommand)) await interaction.deferReply();

  try {
    if (subcommand === "join") {
      const voice = voiceChannel(interaction);
      if (!voice) return interaction.editReply({ content: "❌ Join a voice channel first." });
      await musicPlayer.getOrCreatePlayer({ guildId, voiceChannelId: voice.id, textChannelId: interaction.channelId });
      return interaction.editReply({ content: `🎵 Joined **${voice.name}**.` });
    }

    if (subcommand === "play") {
      const voice = voiceChannel(interaction);
      if (!voice) return interaction.editReply({ content: "❌ Join a voice channel first." });
      const query = interaction.options.getString("query", true).trim();
      const result = await musicPlayer.play(guildId, query, interaction.user, voice.id, interaction.channelId);
      return interaction.editReply({ content: `🎵 Added ${formatTrack(result.track)} to the queue.` });
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
      return interaction.editReply({ content: "⏹️ Stopped and left the voice channel." });
    }

    if (subcommand === "queue") {
      const queue = getQueue(guildId);
      const lines = queue.tracks.toArray().slice(0, 10).map((track, index) => `${index + 1}. ${formatTrack(track)}`);
      let content = queue.currentTrack ? `🎵 **Now:** ${formatTrack(queue.currentTrack)}\n` : "🎵 **Now:** Nothing playing\n";
      content += lines.length ? `\n**Queue:**\n${lines.join("\n")}` : "\n**Queue:** Empty";
      if (queue.tracks.size > 10) content += `\n…and ${queue.tracks.size - 10} more.`;
      return interaction.reply({ content });
    }

    if (subcommand === "nowplaying") {
      const queue = getQueue(guildId);
      return interaction.reply({ content: queue.currentTrack
        ? `🎵 **Now playing:** ${formatTrack(queue.currentTrack)}${queue.node.isPaused() ? "\n⏸️ Paused" : ""}`
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
    console.error(`[MUSIC] ${subcommand} failed: ${error.stack || error.message}`);
    if (interaction.deferred || interaction.replied) return interaction.editReply({ content: `❌ ${error.message}` });
    return interaction.reply({ content: `❌ ${error.message}`, ephemeral: true });
  }
};
