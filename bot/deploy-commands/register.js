require("dotenv").config();
const { REST, Routes } = require("discord.js");
const commands = [
  {
    name: "utopia",
    description: "Utopia Nexus kingdom commands",
    options: [
      { name: "register", description: "Register your province", type: 1 },
      { name: "province", description: "View your province profile", type: 1 },
      { name: "profile", description: "View your profile", type: 1 },
      { name: "citizens", description: "View kingdom citizens", type: 1 },
      { name: "leadership", description: "View kingdom leadership", type: 1 },
      { name: "admins", description: "View kingdom admins", type: 1 },
      { name: "admin", description: "Verify admin access", type: 1 },
      { name: "resetage", description: "Reset all province data for new age", type: 1 },
      { name: "logs", description: "View admin audit logs", type: 1 },
      { name: "waves", description: "Show kingdom wave schedule", type: 1 },
      { name: "analyze-war", description: "AI war analysis", type: 1 },
      { name: "wiki", description: "Open the Utopia Nexus Wiki", type: 1 },
      { name: "alerts", description: "View all alerts", type: 1 },
      { name: "status", description: "Quick kingdom health check", type: 1 },
      { name: "ask", description: "Ask Utopia Nexus AI", type: 1, options: [{ name: "question", description: "Your question", type: 3, required: true }] },
      { name: "member", description: "View a member profile", type: 1, options: [{ name: "user", description: "User to view", type: 6, required: true }] },
      { name: "addadmin", description: "Add a kingdom admin", type: 1, options: [{ name: "user", description: "User to promote", type: 6, required: true }] },
      { name: "removeadmin", description: "Remove a kingdom admin", type: 1, options: [{ name: "user", description: "User to remove", type: 6, required: true }] },
      { name: "restore", description: "Restore a removed member", type: 1, options: [{ name: "user", description: "User to restore", type: 6, required: true }] },
      { name: "remove", description: "Remove a member", type: 1, options: [{ name: "user", description: "User to remove", type: 6, required: true }, { name: "reason", description: "Reason", type: 3, required: false }] },
      { name: "role", description: "Assign a kingdom role", type: 1, options: [{ name: "user", description: "User", type: 6, required: true }, { name: "role", description: "Role", type: 3, required: true, choices: [{ name: "Monarch", value: "Monarch" }, { name: "Steward", value: "Steward" }, { name: "War Leader", value: "War Leader" }, { name: "Member", value: "Member" }] }] },
      { name: "setalert", description: "Set a tick-based alert", type: 1, options: [{ name: "label", description: "Alert name", type: 3, required: true }, { name: "ticks", description: "Comma-separated ticks e.g. 3,4,5", type: 3, required: true }, { name: "message", description: "Message to send", type: 3, required: true }, { name: "channel", description: "Channel to alert in", type: 7, required: false }, { name: "role", description: "Role to ping", type: 8, required: false }] },
      { name: "deletealert", description: "Delete an alert", type: 1, options: [{ name: "label", description: "Alert label to delete", type: 3, required: true }] },
      { name: "target", description: "Look up enemy province intel", type: 1, options: [{ name: "province", description: "Province name to look up", type: 3, required: true }] },
      { name: "war", description: "Declare or manage active war", type: 1, options: [
        { name: "action", description: "Action to take", type: 3, required: true, choices: [{ name: "Declare", value: "declare" }, { name: "End", value: "end" }, { name: "Status", value: "status" }] },
        { name: "kingdom", description: "Enemy kingdom name", type: 3, required: false },
        { name: "coords", description: "Enemy coordinates e.g. 5:2", type: 3, required: false },
        { name: "notes", description: "War notes", type: 3, required: false }
      ]}
    ]
  }
];
const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
(async () => {
  try {
    console.log("Started refreshing application commands.");
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log("Successfully reloaded application commands.");
  } catch (error) {
    console.error(error);
  }
})();
