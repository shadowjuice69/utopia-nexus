const database = require("../../services/database");
const { MessageFlags } = require("discord.js");

module.exports = async function profileHandler(interaction) {

    const db = database.getDb();

    const user = db.data.users.find(
        (u) => u.id === interaction.user.id
    );

    if (!user) {
        return interaction.reply({
            content: "❌ No profile found.",
            flags: MessageFlags.Ephemeral,
        });
    }

    return interaction.reply({
        content:
            `👤 Profile\n\n` +
            `🏰 Province: ${user.province || "None"}\n` +
            `📍 Location: ${user.coordinates || "None"}\n` +
            `👑 Role: ${user.kingdomRole || "Member"}\n` +
            `🟢 Status: ${user.status || "active"}\n` +
            `⭐ Level: ${user.level || 1}`,
        flags: MessageFlags.Ephemeral,
    });

};
