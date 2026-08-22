require("dotenv").config();
const { REST, Routes } = require("discord.js");

const RACE_CHOICES = [
  { name: "Avian",    value: "avian"    }, { name: "Dark Elf", value: "darkelf"  },
  { name: "Dryad",    value: "dryad"    }, { name: "Dwarf",    value: "dwarf"    },
  { name: "Elf",      value: "elf"      }, { name: "Faery",    value: "faery"    },
  { name: "Halfling", value: "halfling" }, { name: "Human",    value: "human"    },
  { name: "Orc",      value: "orc"      }, { name: "Undead",   value: "undead"   }
];

const PERS_CHOICES = [
  { name: "None",        value: "none"        }, { name: "Heretic",     value: "heretic"     },
  { name: "Mystic",      value: "mystic"      }, { name: "Necromancer", value: "necromancer" },
  { name: "Cleric",      value: "cleric"      }, { name: "General",     value: "general"     },
  { name: "Artisan",     value: "artisan"     }, { name: "Rogue",       value: "rogue"       },
  { name: "Sage",        value: "sage"        }, { name: "Tactician",   value: "tactician"   },
  { name: "Warrior",     value: "warrior"     }, { name: "War Hero",    value: "warhero"     }
];

const utopiaCommand = {
  name: "utopia",
  description: "Utopia Nexus player commands",
  options: [
    { name: "register",   description: "Register your province",      type: 1 },
    { name: "profile",    description: "View your profile",           type: 1 },
    { name: "province",   description: "View your province stats",    type: 1 },
    { name: "leadership", description: "View kingdom leadership",     type: 1 },
    { name: "roster",     description: "View all registered members", type: 1 },
    { name: "status",     description: "Quick kingdom health check",  type: 1 },
    { name: "waves",      description: "Show kingdom wave schedule",  type: 1 },
    { name: "help",       description: "Show all available commands", type: 1 },
    { name: "member", description: "View a member profile", type: 1,
      options: [{ name: "user", description: "User to view", type: 6, required: true }] },
    { name: "ask", description: "Search the wiki, rules, science, and spells", type: 1,
      options: [{ name: "question", description: "Your question or topic", type: 3, required: true }] }
  ]
};

const warCommand = {
  name: "war",
  description: "Utopia Nexus war room commands",
  options: [
    { name: "analyze", description: "AI analysis of current war situation", type: 1 },
    { name: "summary", description: "Full war stats summary",               type: 1 },
    { name: "board",   description: "Force refresh the war status board",   type: 1 },
    { name: "status",  description: "Current war status and scores",        type: 1 },
    { name: "target",  description: "Look up enemy province intel", type: 1,
      options: [{ name: "province", description: "Province name", type: 3, required: true }] },
    { name: "ambush",  description: "Calculate minimum offense to ambush",  type: 1,
      options: [{ name: "target", description: "Province name", type: 3, required: true }] },
    { name: "intel",   description: "Paste province intel or news logs",    type: 1,
      options: [{ name: "type", description: "Choose intel type", type: 3, required: true,
        choices: [{ name: "Province Intel", value: "throne" }, { name: "News Log", value: "news" }] }] }
  ]
};

const calcCommand = {
  name: "calc",
  description: "Utopia calculators and tools",
  options: [
    {
      name: "thievery", description: "Calculate thievery op success chance", type: 1,
      options: [
        { name: "my_thieves",        description: "Your thief count",                 type: 4,  required: true  },
        { name: "my_land",           description: "Your land (acres)",                type: 4,  required: true  },
        { name: "my_race",           description: "Your race",                        type: 3,  required: true,  choices: RACE_CHOICES },
        { name: "their_thieves",     description: "Enemy thief count",                type: 4,  required: true  },
        { name: "their_land",        description: "Enemy land (acres)",               type: 4,  required: true  },
        { name: "their_race",        description: "Enemy race",                       type: 3,  required: false, choices: RACE_CHOICES },
        { name: "my_personality",    description: "Your personality",                 type: 3,  required: false, choices: PERS_CHOICES },
        { name: "my_crime_science",  description: "Crime science bonus (e.g. 1.15)", type: 10, required: false },
        { name: "my_honor_mod",      description: "Honor modifier (e.g. 1.05)",      type: 10, required: false },
        { name: "invisibility",      description: "Invisibility spell active?",       type: 5,  required: false },
        { name: "my_dens_pct",       description: "Your Thieves Dens %",             type: 10, required: false },
        { name: "their_dens_pct",    description: "Their Thieves Dens %",            type: 10, required: false },
        { name: "their_watchtowers", description: "Their Watch Towers %",            type: 10, required: false },
        { name: "my_nw",             description: "Your networth",                   type: 4,  required: false },
        { name: "their_nw",          description: "Their networth",                  type: 4,  required: false },
        { name: "op", description: "Specific op to check", type: 3, required: false,
          choices: [
            { name: "Free Prisoners",      value: "freeprisoners"    },
            { name: "Rob Granaries",       value: "robgranaries"     },
            { name: "Rob Vaults",          value: "robvaults"        },
            { name: "Rob Towers",          value: "robtowers"        },
            { name: "Kidnapping",          value: "kidnapping"       },
            { name: "Bribe Thieves",       value: "bribethieves"     },
            { name: "Bribe Generals",      value: "bribegenerals"    },
            { name: "Incite Riots",        value: "inciteriots"      },
            { name: "Arson",               value: "arson"            },
            { name: "Night Strike",        value: "nightstrike"      },
            { name: "Steal War Horses",    value: "stealwarhorses"   },
            { name: "Greater Arson",       value: "greaterarson"     },
            { name: "Sabotage Wizards",    value: "sabotagewizards"  },
            { name: "Assassinate Wizards", value: "assassinewizards" },
            { name: "Steal Horses",        value: "stealhorses"      }
          ] }
      ]
    },
    {
      name: "declare", description: "Check war declaration legality vs a kingdom", type: 1,
      options: [
        { name: "our_nw",      description: "Our kingdom total NW",       type: 10, required: true  },
        { name: "their_nw",    description: "Their kingdom total NW",     type: 10, required: true  },
        { name: "our_land",    description: "Our kingdom total land",     type: 4,  required: true  },
        { name: "their_land",  description: "Their kingdom total land",   type: 4,  required: true  },
        { name: "our_meter",   description: "Our hostility meter (us→them)",   type: 10, required: true  },
        { name: "their_meter", description: "Their hostility meter (them→us)", type: 10, required: true  },
        { name: "their_name",  description: "Their kingdom name",         type: 3,  required: false },
        { name: "quiet_ticks", description: "Ticks since last attack on them (FCF)", type: 4, required: false }
      ]
    },
    {
      name: "attack", description: "Calculate traditional attack gains", type: 1,
      options: [
        { name: "your_nw",      description: "Your networth",            type: 10, required: true  },
        { name: "target_nw",    description: "Target networth",          type: 10, required: true  },
        { name: "your_acres",   description: "Your total acres",         type: 4,  required: true  },
        { name: "target_acres", description: "Target total acres",       type: 4,  required: true  },
        { name: "your_map",     description: "Your current MAP (0-100)", type: 4,  required: false },
        { name: "war",          description: "Are you in a war?",        type: 5,  required: false },
        { name: "off_mods",     description: "Offensive modifier count", type: 4,  required: false }
      ]
    },
    {
      name: "spellcheck", description: "Calculate spell success chance", type: 1,
      options: [
        { name: "my_wizards",         description: "Your wizard count",                    type: 4,  required: true  },
        { name: "my_land",            description: "Your land (acres)",                    type: 4,  required: true  },
        { name: "my_race",            description: "Your race",                            type: 3,  required: true,  choices: RACE_CHOICES },
        { name: "their_wizards",      description: "Enemy wizard count",                   type: 4,  required: true  },
        { name: "their_land",         description: "Enemy land (acres)",                   type: 4,  required: true  },
        { name: "their_race",         description: "Enemy race",                           type: 3,  required: false, choices: RACE_CHOICES },
        { name: "my_personality",     description: "Your personality",                     type: 3,  required: false, choices: PERS_CHOICES },
        { name: "my_channeling",      description: "Channeling science bonus (e.g. 1.15)", type: 10, required: false },
        { name: "my_honor_mod",       description: "Honor modifier (e.g. 1.05)",          type: 10, required: false },
        { name: "mages_fury",         description: "Mages Fury active?",                  type: 5,  required: false },
        { name: "their_magic_shield", description: "Their Magic Shield active?",          type: 5,  required: false },
        { name: "my_nw",              description: "Your networth",                       type: 4,  required: false },
        { name: "their_nw",           description: "Their networth",                      type: 4,  required: false },
        { name: "spell", description: "Specific spell to check", type: 3, required: false,
          choices: [
            { name: "Fireball",          value: "fireball"      }, { name: "Storms",          value: "storms"        },
            { name: "Droughts",          value: "droughts"      }, { name: "Gluttony",        value: "gluttony"      },
            { name: "Greed",             value: "greed"         }, { name: "Chastity",        value: "chastity"      },
            { name: "Sloth",             value: "sloth"         }, { name: "Blizzard",        value: "blizzard"      },
            { name: "Pitfalls",          value: "pitfalls"      }, { name: "Expose Thieves",  value: "exposethieves" },
            { name: "Abolish Ritual",    value: "abolishritual" }, { name: "Magic Ward",      value: "magicward"     },
            { name: "Tornadoes",         value: "tornadoes"     }, { name: "Mystic Vortex",   value: "mysticvortex"  },
            { name: "Nightmares",        value: "nightmares"    }, { name: "Lightning Strike", value: "lightningst"  },
            { name: "Fools Gold",        value: "foolsgold"     }, { name: "Land Lust",       value: "landlust"      },
            { name: "Meteor Showers",    value: "meteor"        }, { name: "Nightfall",       value: "nightfall"     }
          ] }
      ]
    },
    {
      name: "science", description: "Look up Age 116 science multipliers", type: 1,
      options: [{ name: "type", description: "Science type or category", type: 3, required: true,
        choices: [
          { name: "All",         value: "all"         }, { name: "Economy",     value: "economy"     },
          { name: "Military",    value: "military"    }, { name: "Arcane Arts", value: "arcane_arts" },
          { name: "Alchemy",     value: "alchemy"     }, { name: "Tools",       value: "tools"       },
          { name: "Housing",     value: "housing"     }, { name: "Production",  value: "production"  },
          { name: "Bookkeeping", value: "bookkeeping" }, { name: "Artisan",     value: "artisan"     },
          { name: "Strategy",    value: "strategy"    }, { name: "Siege",       value: "siege"       },
          { name: "Tactics",     value: "tactics"     }, { name: "Valor",       value: "valor"       },
          { name: "Heroism",     value: "heroism"     }, { name: "Resilience",  value: "resilience"  },
          { name: "Crime",       value: "crime"       }, { name: "Channeling",  value: "channeling"  },
          { name: "Shielding",   value: "shielding"   }, { name: "Arcana",      value: "arcana"      },
          { name: "Finesse",     value: "finesse"     }
        ] }]
    },
    {
      name: "science-summary", description: "Calculate science bonuses for a province", type: 1,
      options: [
        { name: "province",  description: "Province name (leave blank for yourself)", type: 3,  required: false },
        { name: "libraries", description: "Libraries % (for accuracy)",               type: 10, required: false }
      ]
    }
  ]
};

const adminCommand = {
  name: "admin",
  description: "Utopia Nexus admin commands",
  options: [
    { name: "panel",    description: "Admin control panel",    type: 1 },
    { name: "logs",     description: "View recent bot logs",   type: 1 },
    { name: "resetage", description: "Reset age data",         type: 1 },
    { name: "threat",   description: "View live threat meter", type: 1 },
    { name: "admins",   description: "List current admins",    type: 1 },
    { name: "alerts",   description: "View configured alerts", type: 1 },
    { name: "addadmin",    description: "Add an admin (Owner only)", type: 1,
      options: [{ name: "user", description: "User to make admin", type: 6, required: true }] },
    { name: "removeadmin", description: "Remove an admin (Owner only)", type: 1,
      options: [{ name: "user", description: "User to remove", type: 6, required: true }] },
    { name: "role", description: "Assign role to a member", type: 1,
      options: [
        { name: "user", description: "User to assign role", type: 6, required: true },
        { name: "role", description: "Role to assign",      type: 8, required: true }
      ] },
    { name: "remove", description: "Remove a member from the roster", type: 1,
      options: [{ name: "user", description: "User to remove", type: 6, required: true }] },
    { name: "restore", description: "Restore a removed member", type: 1,
      options: [{ name: "user", description: "User to restore", type: 6, required: true }] },
    { name: "broadcast", description: "Send a broadcast to the kingdom", type: 1,
      options: [{ name: "message", description: "Message to broadcast", type: 3, required: true }] },
    { name: "setalert", description: "Configure an alert", type: 1,
      options: [
        { name: "type",    description: "Alert type",    type: 3, required: true },
        { name: "channel", description: "Alert channel", type: 7, required: true }
      ] },
    { name: "deletealert", description: "Delete an alert", type: 1,
      options: [{ name: "type", description: "Alert type to delete", type: 3, required: true }] },
    { name: "setkingdom", description: "Update kingdom name and code", type: 1,
      options: [
        { name: "name", description: "New kingdom name",              type: 3, required: true },
        { name: "code", description: "New kingdom code (e.g. 3:2)",  type: 3, required: true }
      ] },
    { name: "war", description: "Set war status", type: 1,
      options: [{ name: "status", description: "War status", type: 3, required: true,
        choices: [
          { name: "Active",   value: "active"   },
          { name: "Inactive", value: "inactive" },
          { name: "Peace",    value: "peace"    }
        ] }] },
    { name: "removecheck", description: "Check before removing a member", type: 1,
      options: [{ name: "user", description: "User to check", type: 6, required: true }] }
  ]
};

const commands = [utopiaCommand, warCommand, calcCommand, adminCommand];

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
const GUILD_IDS = [process.env.GUILD_ID, "1534817549374455848"];

(async () => {
  try {
    console.log("Refreshing application commands...");
    for (const guildId of GUILD_IDS) {
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
        { body: commands }
      );
      console.log(`✅ Commands registered for guild ${guildId}`);
    }
    console.log("✅ All done — /utopia /war /calc /admin registered.");
  } catch (error) {
    console.error(error);
  }
})();
