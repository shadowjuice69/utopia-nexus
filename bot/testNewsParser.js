const fs = require("fs");
const { parseNewsLog } = require("./parsers/news");

const news = fs.readFileSync("./bot/testNews.txt", "utf8");

const result = parseNewsLog(news);

console.log("\n=== ATTACKS ===");
console.log(JSON.stringify(result.attacks, null, 2));

console.log("\n=== INTEL ===");
console.log(JSON.stringify(result.intel, null, 2));

console.log("\n=== SPELLS ===");
console.log(JSON.stringify(result.spells, null, 2));

console.log("\n=== SCIENCE ===");
console.log(JSON.stringify(result.science, null, 2));

console.log("\n=== MILITARY ===");
console.log(JSON.stringify(result.military, null, 2));

console.log("\n=== ECONOMY ===");
console.log(JSON.stringify(result.economy, null, 2));

console.log("\n=== EVENTS ===");
console.log(JSON.stringify(result.events, null, 2));
