const fs = require("fs");

const text = fs.readFileSync("./bot/testNews.txt", "utf8");

const lines = text
.split(/\r?\n/)
.map(raw => raw.trim())
.filter(Boolean)
.map(line => {

const dateMatch = line.match(
/^((January|February|March|April|May|June|July|August|September|October|November|December) \d+ of YR\d+)/
);

return {
date: dateMatch ? dateMatch[1] : null,
text: dateMatch ? line.slice(dateMatch[1].length).trim() : line
};

});

console.log(lines);
