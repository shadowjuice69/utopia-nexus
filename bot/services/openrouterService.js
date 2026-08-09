const { getNexusPrompt } = require("./nexusPrompt");
const axios = require("axios");

async function askOpenRouter(prompt) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is missing");
  }

  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: "google/gemma-3-4b-it:free",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      }
    }
  );

  if (!response.data.choices || !response.data.choices[0]) {
    throw new Error("No choices in response: " + JSON.stringify(response.data));
  }
  return response.data.choices[0].message.content;
}

module.exports = {
  askOpenRouter
};
