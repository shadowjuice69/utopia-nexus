require("dotenv").config();
const { REST, Routes } = require("discord.js");

const RACE_CHOICES = [
  {name:"Avian",value:"avian"},{name:"Dark Elf",value:"darkelf"},{name:"Dryad",value:"dryad"},
  {name:"Dwarf",value:"dwarf"},{name:"Elf",value:"elf"},{name:"Faery",value:"faery"},
  {name:"Halfling",value:"halfling"},{name:"Human",value:"human"},{name:"Orc",value:"orc"},
  {name:"Undead",value:"undead"}
];

const PERS_CHOICES = [
  {name:"None",value:"none"},{name:"Heretic",value:"heretic"},{name:"Mystic",value:"mystic"},
  {name:"Necromancer",value:"necromancer"},{name:"Cleric",value:"cleric"},{name:"General",value:"general"},
  {name:"Artisan",value:"artisan"},{name:"Rogue",value:"rogue"},{name:"Sage",value:"sage"},
  {name:"Tactician",value:"tactician"},{name:"Warrior",value:"warrior"},{name:"War Hero",value:"warhero"}
];

const commands = [
  {
    name: "utopia",
    description: "Utopia Nexus player commands",
    options: [
      { name: "register",   description: "Register your province",        type: 1 },
      { name: "help",       description: "Show all available commands",    type: 1 },
      { name: "province",   description: "View your province profile",     type: 1 },
      { name: "profile",    description: "View your profile",              type: 1 },
      { name: "leadership", description: "View kingdom leadership",        type: 1 },
      { name: "waves",      description: "Show kingdom wave schedule",     type: 1 },
      { name: "status",     description: "Quick kingdom health check",     type: 1 },
      {
        name: "intel",
        description: "Paste province intel or news logs",
        type: 1,
        options: [{
          name: "type", description: "Choose intel type", type: 3, required: true,
          choices: [
            { name: "Province Intel", value: "throne" },
            { name: "News Log",       value: "news"   }
          ]
        }]
      },
      {
        name: "ask",
        description: "Search the wiki, rules, science, and spells",
        type: 1,
        options: [{ name: "question", description: "Your question or topic", type: 3, required: true }]
      },
      {
        name: "science",
        description: "Look up Age 116 science multipliers and effects",
        type: 1,
        options: [{
          name: "type", description: "Science type or category", type: 3, required: true,
          choices: [
            { name: "All",         value: "all"         },
            { name: "Economy",     value: "economy"     },
            { name: "Military",    value: "military"    },
            { name: "Arcane Arts", value: "arcane_arts" },
            { name: "Alchemy",     value: "alchemy"     },
            { name: "Tools",       value: "tools"       },
            { name: "Housing",     value: "housing"     },
            { name: "Production",  value: "production"  },
            { name: "Bookkeeping", value: "bookkeeping" },
            { name: "Artisan",     value: "artisan"     },
            { name: "Strategy",    value: "strategy"    },
            { name: "Siege",       value: "siege"       },
            { name: "Tactics",     value: "tactics"     },
            { name: "Valor",       value: "valor"       },
            { name: "Heroism",     value: "heroism"     },
            { name: "Resilience",  value: "resilience"  },
            { name: "Crime",       value: "crime"       },
            { name: "Channeling",  value: "channeling"  },
            { name: "Shielding",   value: "shielding"   },
            { name: "Arcana",      value: "arcana"      },
            { name: "Finesse",     value: "finesse"     }
          ]
        }]
      },
      {
        name: "science-summary",
        description: "Calculate science bonuses for your province or a target",
        type: 1,
        options: [{ name: "province", description: "Province name (leave blank for yourself)", type: 3, required: false }, { name: "libraries", description: "Libraries % (for accuracy)", type: 10, required: false }]
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
          { name: "race",     description: "Enemy race",             type: 3, required: true,  choices: RACE_CHOICES },
          { name: "elites",   description: "Enemy elites in army",   type: 4, required: true  },
          { name: "offspecs", description: "Enemy off specs",        type: 4, required: false },
          { name: "soldiers", description: "Enemy soldiers",         type: 4, required: false },
          { name: "defspecs", description: "Enemy def specs",        type: 4, required: false }
        ]
      },
      {
        name: "thievery",
        description: "Calculate thievery op success chance based on TPA",
        type: 1,
        options: [
          { name: "my_thieves",        description: "Your thief count",                type: 4,  required: true  },
          { name: "my_land",           description: "Your land (acres)",               type: 4,  required: true  },
          { name: "my_race",           description: "Your race",                       type: 3,  required: true,  choices: RACE_CHOICES },
          { name: "their_thieves",     description: "Enemy thief count",               type: 4,  required: true  },
          { name: "their_land",        description: "Enemy land (acres)",              type: 4,  required: true  },
          { name: "their_race",        description: "Enemy race",                      type: 3,  required: false, choices: RACE_CHOICES },
          { name: "my_personality",    description: "Your personality",                type: 3,  required: false, choices: PERS_CHOICES },
          { name: "my_crime_science",  description: "Crime science bonus (e.g. 1.15)",type: 10, required: false },
          { name: "my_honor_mod",      description: "Honor modifier (e.g. 1.05)",     type: 10, required: false },
          { name: "invisibility",      description: "Invisibility spell active?",      type: 5,  required: false },
          { name: "my_dens_pct",       description: "Your Thieves Dens %",            type: 10, required: false },
          { name: "their_dens_pct",    description: "Their Thieves Dens %",           type: 10, required: false },
          { name: "their_watchtowers", description: "Their Watch Towers %",           type: 10, required: false },
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
            ]
          },
          { name: "my_nw",    description: "Your networth",  type: 4, required: false },
          { name: "their_nw", description: "Their networth", type: 4, required: false }
        ]
      },
      {
        name: "spellcheck",
        description: "Calculate spell success chance based on WPA",
        type: 1,
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
          { name: "spell", description: "Specific spell to check", type: 3, required: false,
            choices: [
              { name: "Fireball",         value: "fireball"      },
              { name: "Storms",           value: "storms"        },
              { name: "Droughts",         value: "droughts"      },
              { name: "Gluttony",         value: "gluttony"      },
              { name: "Greed",            value: "greed"         },
              { name: "Chastity",         value: "chastity"      },
              { name: "Sloth",            value: "sloth"         },
              { name: "Blizzard",         value: "blizzard"      },
              { name: "Pitfalls",         value: "pitfalls"      },
              { name: "Expose Thieves",   value: "exposethieves" },
              { name: "Abolish Ritual",   value: "abolishritual" },
              { name: "Magic Ward",       value: "magicward"     },
              { name: "Tornadoes",        value: "tornadoes"     },
              { name: "Mystic Vortex",    value: "mysticvortex"  },
              { name: "Nightmares",       value: "nightmares"    },
              { name: "Lightning Strike", value: "lightningst"   },
              { name: "Fools Gold",       value: "foolsgold"     },
              { name: "Land Lust",        value: "landlust"      },
              { name: "Meteor Showers",   value: "meteor"        },
              { name: "Nightfall",        value: "nightfall"     }
            ]
          },
          { name: "my_nw",    description: "Your networth",  type: 4, required: false },
          { name: "their_nw", description: "Their networth", type: 4, required: false }
        ]
      },
      {
        name: "analyze-war",
        description: "AI analysis of current war situation",
        type: 1
      },
      { name: "war-summary", description: "Full war stats summary", type: 1 },
      { name: "roster", description: "View all registered kingdom members", type: 1 },
      {
        name: "admins",
        description: "List current admins",
        type: 1
      },
      {
        name: "addadmin",
        description: "Add an admin (Owner only)",
        type: 1,
        options: [
          {
            name: "user",
            description: "User to make admin",
            type: 6,
            required: true
          }
        ]
      },
      {
        name: "removeadmin",
        description: "Remove an admin (Owner only)",
        type: 1,
        options: [
          {
            name: "user",
            description: "User to remove",
            type: 6,
            required: true
          }
        ]
      },
      {
        name: "setkingdom",
        description: "Update kingdom name and code (Admin only)",
        type: 1,
        options: [
          { name: "name", description: "New kingdom name", type: 3, required: true },
          { name: "code", description: "New kingdom code (e.g. 3:2)", type: 3, required: true }
        ]
      }
    ]
  }
];

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("Refreshing application commands...");
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log("✅ Commands registered successfully.");
  } catch (error) {
    console.error(error);
  }
})();
