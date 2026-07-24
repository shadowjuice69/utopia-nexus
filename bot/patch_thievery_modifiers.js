const fs = require("fs");

const file = "services/thieveryCalculatorService.js";

let data = fs.readFileSync(file, "utf8");

data = data.replace(
`if (mod.modifier_type === "tpa_bonus") {
      multiplier += (Number(mod.value) / 100);

      breakdown.push({
        name: mod.name,
        bonus: \`\${mod.value}%\`
      });
    }`,
`if (mod.modifier_type === "tpa_bonus") {
      multiplier += (Number(mod.value) / 100);

      breakdown.push({
        name: mod.name,
        type: "TPA BONUS",
        bonus: String(mod.value) + "%"
      });
    }

    if (mod.modifier_type === "thief_defense") {
      multiplier += (Number(mod.value) / 100);

      breakdown.push({
        name: mod.name,
        type: "THIEF DEFENSE",
        bonus: String(mod.value) + "%"
      });
    }`
);

fs.writeFileSync(file, data);

console.log("Thievery modifier support updated");
