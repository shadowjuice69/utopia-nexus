const database = require("../../services/database");
const roles = require("../../config/roles");
const { MessageFlags } = require("discord.js");

module.exports = async function adminsHandler(interaction) {

    const db = database.getDb();

    const admins = db.data.admins || [];

    let reply = `👑 Owner:\n• <@${roles.owner}>\n\n`;

    reply += "🛡️ Admins:\n";

    admins.forEach((id) => {
        reply += `• <@${id}>\n`;
    });

    return interaction.reply({
        content: reply,
        flags: MessageFlags.Ephemeral,
    });

};
