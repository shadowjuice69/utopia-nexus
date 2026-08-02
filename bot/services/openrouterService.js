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
      model: "meta-llama/llama-3.3-70b-instruct:free",
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

  return response.data.choices[0].message.content;
}

module.exports = {
  askOpenRouter
};
