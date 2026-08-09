const axios = require("axios");

const FREE_MODELS = [
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "google/gemma-4-26b-a4b-it:free",
  "openai/gpt-oss-20b:free",
  "poolside/laguna-s-2.1:free"
];

async function askOpenRouter(prompt) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is missing");

  let lastError = null;

  for (const model of FREE_MODELS) {
    try {
      const response = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model,
          messages: [{ role: "user", content: prompt }]
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          timeout: 30000
        }
      );

      if (response.data.choices && response.data.choices[0]) {
        console.log(`[OPENROUTER] Used model: ${model}`);
        return response.data.choices[0].message.content;
      }
    } catch(e) {
      const status = e.response ? e.response.status : "no-response";
      console.warn(`[OPENROUTER] Model ${model} failed (${status}) — trying next`);
      lastError = e;
    }
  }

  throw new Error("All OpenRouter models failed: " + (lastError ? lastError.message : "unknown"));
}

module.exports = { askOpenRouter };
