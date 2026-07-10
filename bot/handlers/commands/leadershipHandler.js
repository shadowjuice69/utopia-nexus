const database = require("../../services/database");
const { MessageFlags } = require("discord.js");

module.exports = async function leadershipHandler(interaction) {

    const db = database.getDb();

    const leaders = db.data.users.filter(
        (member) =>
            member.kingdomRole &&
            member.kingdomRole !== "Member"
    );

    let reply = "🏰 Kingdom Leadership\n\n";

    leaders.forEach((leader) => {
        reply += `👑 ${leader.kingdomRole}\n`;
        reply += `<@${leader.id}>\n\n`;
    });

    return interaction.reply({
        content: reply || "No leadership assigned.",
        flags: MessageFlags.Ephemeral,
    });

};
