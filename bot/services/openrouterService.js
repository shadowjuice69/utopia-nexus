const axios = require("axios");

// Keep the AI path fast and resilient. Free models can be temporarily
// rate-limited or removed from OpenRouter, so use a short ordered pool.
// OPENROUTER_MODELS may override this list with a comma-separated set.
const DEFAULT_MODELS = [
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "google/gemma-4-26b-a4b-it:free",
  "openai/gpt-oss-20b:free",
  "poolside/laguna-s-2.1:free"
];

const REQUEST_TIMEOUT_MS = 15000;
const RETRYABLE_STATUS = new Set([408, 409, 429, 500, 502, 503, 504]);

function getModels() {
  const configured = String(process.env.OPENROUTER_MODELS || "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);

  return configured.length ? configured : DEFAULT_MODELS;
}

async function askOpenRouter(prompt) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is missing");

  let lastError = null;

  for (const model of getModels()) {
    try {
      console.log(`[OPENROUTER] Trying model: ${model}`);

      const response = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://dashboard-gold-six-11.vercel.app",
            "X-Title": "Utopia Nexus AI"
          },
          timeout: REQUEST_TIMEOUT_MS
        }
      );

      const content = response.data?.choices?.[0]?.message?.content;
      if (content) {
        console.log(`[OPENROUTER] Used model: ${model}`);
        return content;
      }

      lastError = new Error(`Model ${model} returned no content`);
      console.warn(`[OPENROUTER] Model ${model} returned no content — trying next`);
    } catch (e) {
      const status = e.response?.status || "no-response";
      const retryable = status === "no-response" || RETRYABLE_STATUS.has(status);
      console.warn(
        `[OPENROUTER] Model ${model} failed (${status})${retryable ? " — trying next" : " — trying next available model"}`
      );
      lastError = e;
    }
  }

  throw new Error(
    "All configured OpenRouter models failed: " +
      (lastError?.response?.data?.error?.message || lastError?.message || "unknown")
  );
}

module.exports = { askOpenRouter };
