const database = require("../services/database");
const { MessageFlags } = require("discord.js");

module.exports = async function modalHandler(interaction) {

    const db = database.getDb();

    if (interaction.customId === "utopia_register") {

        const user = db.data.users.find(
            (u) => u.id === interaction.user.id
        );

        if (!user) {
            return interaction.reply({
                content: "❌ You need a profile first.",
                flags: MessageFlags.Ephemeral,
            });
        }

        user.province =
            interaction.fields.getTextInputValue("province");

        user.coordinates =
            interaction.fields.getTextInputValue("coordinates");

        await db.write();

        return interaction.reply({
            content:
                `✅ Registration complete!\n\n` +
                `🏰 Province: ${user.province}\n` +
                `📍 Coordinates: ${user.coordinates}`,
            flags: MessageFlags.Ephemeral,
        });
    }

};
