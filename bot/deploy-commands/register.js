require("dotenv").config();
const { REST, Routes } = require("discord.js");

const commands = [
  {
    name: "utopia",
    description: "Utopia Nexus player commands",
    options: [
      { name: "register", description: "Register your province", type: 1 },
      { name: "help", description: "Show all available commands", type: 1 },
      {
        name: "intel",
        description: "Paste province intel or news logs",
        type: 1,
        options: [
          {
            name: "type",
            description: "Choose intel type",
            type: 3,
            required: true,
            choices: [
              { name: "Province Intel", value: "throne" },
              { name: "News Log", value: "news" }
            ]
          }
        ]
      },
      { name: "province", description: "View your province profile", type: 1 },
      { name: "profile", description: "View your profile", type: 1 },
      { name: "citizens", description: "View kingdom citizens", type: 1 },
      { name: "leadership", description: "View kingdom leadership", type: 1 },
      { name: "waves", description: "Show kingdom wave schedule", type: 1 },
      { name: "wiki", description: "Open the Utopia Nexus Wiki", type: 1 },
      { name: "status", description: "Quick kingdom health check", type: 1 },
      {
        name: "ask",
        description: "Ask the Utopia Nexus AI",
        type: 1,
        options: [{ name: "question", description: "Your question", type: 3, required: true }]
      },
      {
        name: "target",
        description: "Look up enemy province intel",
        type: 1,
        options: [{ name: "province", description: "Province name", type: 3, required: true }]
      },
      {
        name: "member",
        description: "View a member profile",
        type: 1,
        options: [{ name: "user", description: "User to view", type: 6, required: true }]
      },
      {
        name: "ambush",
        description: "Calculate minimum offense needed to ambush an enemy army",
        type: 1,
        options: [
          {
            name: "race",
            description: "Enemy race",
            type: 3,
            required: true,
            choices: [
              { name: "Avian", value: "avian" },
              { name: "Dark Elf", value: "darkelf" },
              { name: "Dryad", value: "dryad" },
              { name: "Dwarf", value: "dwarf" },
              { name: "Elf", value: "elf" },
              { name: "Faery", value: "faery" },
              { name: "Halfling", value: "halfling" },
              { name: "Human", value: "human" },
              { name: "Orc", value: "orc" },
              { name: "Undead", value: "undead" }
            ]
          },
          { name: "elites", description: "Enemy elites in army", type: 4, required: true },
          { name: "offspecs", description: "Enemy off specs in army", type: 4, required: false },
          { name: "soldiers", description: "Enemy soldiers in army", type: 4, required: false },
          { name: "defspecs", description: "Enemy def specs in army (NOT used in ambush def)", type: 4, required: false }
        ]
      },
      {
        name: "thievery",
        description: "Calculate thieves needed for a thievery operation",
        type: 1,
        options: [
          {
            name: "operation",
            description: "Thievery operation",
            type: 3,
            required: true,
            choices: [
              { name: "Kidnap", value: "kidnap" },
              { name: "Propaganda", value: "propaganda" },
              { name: "Rob The Vault", value: "robvault" },
              { name: "Steal Money", value: "stealmoney" }
            ]
          },
          {
            name: "your_tpa",
            description: "Your TPA",
            type: 10,
            required: true
          },
          {
            name: "target_tpa",
            description: "Target TPA",
            type: 10,
            required: true
          },
          {
            name: "thieves",
            description: "Available thieves",
            type: 4,
            required: true
          },
          {
            name: "your_modifiers",
            description: "Your modifiers comma separated",
            type: 3,
            required: false
          },
          {
            name: "target_modifiers",
            description: "Target modifiers comma separated",
            type: 3,
            required: false
          }
        ]
      },
      {
        name: "spellcheck",
        description: "Calculate spell success chance based on WPA",
        type: 1,
        options: [
          { name: "my_wizards", description: "Your wizard count", type: 4, required: true },
          { name: "my_land", description: "Your land (acres)", type: 4, required: true },
          { name: "my_race", description: "Your race", type: 3, required: true, choices: [
            {name:"Avian",value:"avian"},{name:"Dark Elf",value:"darkelf"},{name:"Dryad",value:"dryad"},
            {name:"Dwarf",value:"dwarf"},{name:"Elf",value:"elf"},{name:"Faery",value:"faery"},
            {name:"Halfling",value:"halfling"},{name:"Human",value:"human"},{name:"Orc",value:"orc"},{name:"Undead",value:"undead"}
          ]},
          { name: "their_wizards", description: "Enemy wizard count", type: 4, required: true },
          { name: "their_land", description: "Enemy land (acres)", type: 4, required: true },
          { name: "their_race", description: "Enemy race", type: 3, required: false, choices: [
            {name:"Avian",value:"avian"},{name:"Dark Elf",value:"darkelf"},{name:"Dryad",value:"dryad"},
            {name:"Dwarf",value:"dwarf"},{name:"Elf",value:"elf"},{name:"Faery",value:"faery"},
            {name:"Halfling",value:"halfling"},{name:"Human",value:"human"},{name:"Orc",value:"orc"},{name:"Undead",value:"undead"}
          ]},
          { name: "my_personality", description: "Your personality", type: 3, required: false, choices: [
            {name:"None",value:"none"},{name:"Heretic",value:"heretic"},{name:"Mystic",value:"mystic"},
            {name:"Necromancer",value:"necromancer"},{name:"Cleric",value:"cleric"},{name:"General",value:"general"},
            {name:"Artisan",value:"artisan"},{name:"Rogue",value:"rogue"},{name:"Sage",value:"sage"},
            {name:"Tactician",value:"tactician"},{name:"Warrior",value:"warrior"},{name:"War Hero",value:"warhero"}
          ]},
          { name: "my_channeling", description: "Channeling science bonus (e.g. 1.15)", type: 10, required: false },
          { name: "my_honor_mod", description: "Honor WPA modifier (e.g. 1.12)", type: 10, required: false },
          { name: "mages_fury", description: "Mages Fury active?", type: 5, required: false },
          { name: "their_magic_shield", description: "Target has Magic Shield?", type: 5, required: false },
          { name: "my_nw", description: "Your NW", type: 4, required: false },
          { name: "their_nw", description: "Their NW", type: 4, required: false },
          { name: "spell", description: "Specific spell to check", type: 3, required: false, choices: [
            {name:"Fireball",value:"fireball"},{name:"Storms",value:"storms"},{name:"Droughts",value:"droughts"},
            {name:"Chastity",value:"chastity"},{name:"Sloth",value:"sloth"},{name:"Nightmares",value:"nightmares"},
            {name:"Tornadoes",value:"tornadoes"},{name:"Mystic Vortex",value:"mysticvortex"},
            {name:"Fools Gold",value:"foolsgold"},{name:"Land Lust",value:"landlust"},
            {name:"Meteor Showers",value:"meteor"},{name:"Nightfall",value:"nightfall"},
            {name:"Blizzard",value:"blizzard"},{name:"Pitfalls",value:"pitfalls"},
            {name:"Expose Thieves",value:"exposethieves"},{name:"Magic Ward",value:"magicward"}
          ]}
        ]
      },
    ]
  },
  {
    name: "admin",
    description: "Utopia Nexus admin commands",
    default_member_permissions: "0",
    options: [
      { name: "panel", description: "Verify admin access", type: 1 },
      { name: "admins", description: "View kingdom admins", type: 1 },
      { name: "logs", description: "View admin audit logs", type: 1 },
      { name: "resetage", description: "Reset all province data for new age", type: 1 },
      { name: "analyze-war", description: "AI war analysis", type: 1 },
      { name: "threat", description: "Show kingdom threat meter", type: 1 },
      { name: "broadcast", description: "Send DM to all registered members", type: 1 },
      {
        name: "addadmin",
        description: "Add a kingdom admin",
        type: 1,
        options: [{ name: "user", description: "User to promote", type: 6, required: true }]
      },
      {
        name: "removeadmin",
        description: "Remove a kingdom admin",
        type: 1,
        options: [{ name: "user", description: "User to remove", type: 6, required: true }]
      },
      {
        name: "restore",
        description: "Restore a removed member",
        type: 1,
        options: [{ name: "user", description: "User to restore", type: 6, required: true }]
      },
      {
        name: "remove",
        description: "Remove a member",
        type: 1,
        options: [
          { name: "user", description: "User to remove", type: 6, required: true },
          { name: "reason", description: "Reason", type: 3, required: false }
        ]
      },
      {
        name: "role",
        description: "Assign a kingdom role",
        type: 1,
        options: [
          { name: "user", description: "User", type: 6, required: true },
          { name: "role", description: "Role", type: 3, required: true, choices: [
            { name: "Monarch", value: "Monarch" },
            { name: "Steward", value: "Steward" },
            { name: "War Leader", value: "War Leader" },
            { name: "Member", value: "Member" }
          ]}
        ]
      },
      {
        name: "setalert",
        description: "Set a tick-based alert",
        type: 1,
        options: [
          { name: "label", description: "Alert name", type: 3, required: true },
          { name: "ticks", description: "Comma-separated ticks e.g. 3,4,5", type: 3, required: true },
          { name: "message", description: "Message to send", type: 3, required: true },
          { name: "channel", description: "Channel to alert in", type: 7, required: false },
          { name: "role", description: "Role to ping", type: 8, required: false }
        ]
      },
      {
        name: "deletealert",
        description: "Delete an alert",
        type: 1,
        options: [{ name: "label", description: "Alert label to delete", type: 3, required: true }]
      },
      {
        name: "war",
        description: "Declare or manage active war",
        type: 1,
        options: [
          { name: "action", description: "Action", type: 3, required: true, choices: [
            { name: "Declare", value: "declare" },
            { name: "End", value: "end" },
            { name: "Status", value: "status" }
          ]},
          { name: "kingdom", description: "Enemy kingdom name", type: 3, required: false },
          { name: "coords", description: "Enemy coordinates e.g. 5:2", type: 3, required: false },
          { name: "notes", description: "War notes", type: 3, required: false }
        ]
      }
    ]
  }
];

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("Refreshing application commands...");
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log("✅ Commands registered successfully.");
  } catch (error) {
    console.error(error);
  }
})();
