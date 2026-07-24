const fs = require("fs");

const file = "deploy-commands/register.js";

let data = fs.readFileSync(file, "utf8");

const insertBefore = `      {
        name: "spellcheck",`;

const newCommand = `      {
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
`;

if (!data.includes(insertBefore)) {
  console.log("Insert point not found");
  process.exit(1);
}

data = data.replace(insertBefore, newCommand + insertBefore);

fs.writeFileSync(file, data);

console.log("Thievery command added");
