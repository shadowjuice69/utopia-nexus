const { getNexusPrompt } = require("./nexusPrompt");
const axios = require("axios");

async function askOpenRouter(prompt) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is missing");
  }

  let response;
  try {
    response = await axios.post(
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
  } catch(axErr) {
    const status = axErr.response ? axErr.response.status : "no-response";
    const body = axErr.response ? JSON.stringify(axErr.response.data) : axErr.message;
    throw new Error(`OpenRouter ${status}: ${body}`);
  }

  if (!response.data.choices || !response.data.choices[0]) {
    throw new Error("No choices in response: " + JSON.stringify(response.data));
  }
  return response.data.choices[0].message.content;
}

module.exports = {
  askOpenRouter
};
