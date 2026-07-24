const fs = require("fs");

const file = "services/thieveryCalculatorService.js";

let data = fs.readFileSync(file, "utf8");

const old = `modifiers: {
        attacker: attackerTPA.breakdown,
        target: defenderTPA.breakdown
      },`;

const replacement = `modifiers: {
        attacker: attackerTPA.breakdown.map(m =>
          \`\${m.name}: \${m.bonus}\`
        ),
        target: defenderTPA.breakdown.map(m =>
          \`\${m.name}: \${m.bonus}\`
        )
      },`;

if (!data.includes(old)) {
  console.log("Output block not found");
  process.exit(1);
}

data = data.replace(old, replacement);

fs.writeFileSync(file, data);

console.log("Thievery output formatting updated");
