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
        name: "admins",
        description: "View kingdom admins",
        type: 1,
      },
      {
        name: "admin",
        description: "Verify admin access",
        type: 1,
      },
      {
        name: "resetage",
        description: "Reset all province names and coordinates for a new age",
        type: 1,
      },
      {
        name: "logs",
        description: "View admin audit logs",
        type: 1,
      },
      {
        name: "addadmin",
        description: "Add a kingdom admin",
        type: 1,
        options: [
          {
            name: "user",
            description: "User to promote to admin",
            type: 6,
            required: true,
          },
        ],
      },
      {
        name: "removeadmin",
        description: "Remove a kingdom admin",
        type: 1,
        options: [
          {
            name: "user",
            description: "User to remove from admin",
            type: 6,
            required: true,
          },
        ],
      },
      {
        name: "restore",
        description: "Restore a removed member",
        type: 1,
        options: [
          {
            name: "user",
            description: "User to restore",
            type: 6,
            required: true,
          },
        ],
      },
      {
        name: "remove",
        description: "Remove a member",
        type: 1,
        options: [
          {
            name: "user",
            description: "User to remove",
            type: 6,
            required: true,
          },
          {
            name: "reason",
            description: "Reason for removal",
            type: 3,
            required: false,
          },
        ],
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
    ],
  },
];

const rest = new REST({ version: "10" }).setToken(
  process.env.DISCORD_TOKEN
);

(async () => {
  try {
    console.log("Started refreshing application commands.");

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      {
        body: commands,
      }
    );

    console.log("Successfully reloaded application commands.");
  } catch (error) {
    console.error(error);
  }
})();
