const database = require("../../services/database");
const { MessageFlags } = require("discord.js");

module.exports = async function provinceHandler(interaction) {
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
            `🏰 Province Profile\n\n` +
            `👤 <@${user.id}>\n` +
            `🏰 Province: ${user.province}\n` +
            `📍 Location: ${user.coordinates}\n` +
            `👑 Kingdom Role: ${user.kingdomRole || "Member"}\n` +
            `🟢 Status: ${user.status || "active"}\n` +
            `⭐ Level: ${user.level || 1}`,
        flags: MessageFlags.Ephemeral,
    });
};
