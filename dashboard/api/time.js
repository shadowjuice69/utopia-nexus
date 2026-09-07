export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const response = await fetch("https://gateway.timeapi.world/timezone/America/Chicago", {
      headers: { accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Time source returned ${response.status}`);
    }

    const data = await response.json();
    if (!Number.isFinite(data.unixtime)) {
      throw new Error("Time source did not return a valid Unix timestamp");
    }

    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.status(200).json({
      unixMs: data.unixtime * 1000,
      timezone: "America/Chicago",
      source: "internet-synchronized time",
      upstream: "timeapi.world",
    });
  } catch (error) {
    console.error("[TIME SYNC ERROR]", error);
    res.status(503).json({ error: "Internet time unavailable" });
  }
}
