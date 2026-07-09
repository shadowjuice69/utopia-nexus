require("dotenv").config();

const { REST, Routes } = require("discord.js");

const commands = [
  {
    name: "utopia",
    description: "Utopia Nexus kingdom commands",
    options: [
      {
        name: "register",
        description: "Register your province",
        type: 1,
      },
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
        description: "View kingdom citizens",
        type: 1,
      },
      {
        name: "leadership",
        description: "View kingdom leadership",
        type: 1,
      },
      {
        name: "role",
        description: "Assign a kingdom role",
        type: 1,
        options: [
          {
            name: "user",
            description: "User to assign role to",
            type: 6,
            required: true,
          },
          {
            name: "role",
            description: "Kingdom role",
            type: 3,
            required: true,
            choices: [
              {
                name: "Monarch",
                value: "Monarch",
              },
              {
                name: "Steward",
                value: "Steward",
              },
              {
                name: "War Leader",
                value: "War Leader",
              },
              {
                name: "Member",
                value: "Member",
              },
            ],
          },
        ],
      },
      {
        name: "admins",
        description: "View kingdom admins",
        type: 1,
      },
    ],
  },
];

const rest = new REST({ version: "10" })
  .setToken(process.env.DISCORD_TOKEN);

(async () => {
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
})();
