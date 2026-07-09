require("dotenv").config();

const { REST, Routes } = require("discord.js");

const commands = [
  {
    name: "utopia",
    description: "Utopia Nexus kingdom commands",
    options: [
      {
        name: "province",
        description: "View your province profile",
        type: 1,
      },
      {
        name: "profile",
        description: "View your profile",
        type: 1,
      },
      {
        name: "citizens",
        description: "View the kingdom roster",
        type: 1,
      },
      {
        name: "leadership",
        description: "View kingdom leadership",
        type: 1,
      },
      {
        name: "register",
        description: "Register your province",
        type: 1,
      },
    ],
  },
];

const rest = new REST({ version: "10" })
  .setToken(process.env.DISCORD_TOKEN);

async function register() {
  try {
    console.log("Registering slash commands...");

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      {
        body: commands,
      }
    );

    console.log("Slash commands registered.");
  } catch (error) {
    console.error(error);
  }
}

register();
