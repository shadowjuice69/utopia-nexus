const database = require("../../services/database");
const { MessageFlags } = require("discord.js");

module.exports = async function citizensHandler(interaction) {

    const db = database.getDb();

    let reply = "🏰 Kingdom Roster\n\n";

    db.data.users.forEach((member) => {
        reply += `👤 <@${member.id}>\n`;
        reply += `🏰 Province: ${member.province || "None"}\n`;
        reply += `📍 Location: ${member.coordinates || "None"}\n`;
        reply += `👑 Role: ${member.kingdomRole || "Member"}\n\n`;
    });

    return interaction.reply({
        content: reply,
        flags: MessageFlags.Ephemeral,
    });

};
