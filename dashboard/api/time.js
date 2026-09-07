export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const sources = [
    {
      name: "gettimeapi.dev",
      url: "https://gettimeapi.dev/v1/time?timezone=America%2FChicago",
      parse: data => data.timestamp * 1000,
    },
    {
      name: "timeapi.world",
      url: "https://gateway.timeapi.world/timezone/America/Chicago",
      parse: data => data.unixtime * 1000,
    },
  ];

  for (const source of sources) {
    try {
      const response = await fetch(source.url, {
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) continue;

      const data = await response.json();
      const unixMs = source.parse(data);
      if (!Number.isFinite(unixMs)) continue;

      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      res.status(200).json({
        unixMs,
        timezone: "America/Chicago",
        source: "internet-synchronized time",
        upstream: source.name,
      });
      return;
    } catch (error) {
      console.error(`[TIME SYNC ERROR] ${source.name}`, error?.message || error);
    }
  }

  res.status(503).json({ error: "Internet time unavailable" });
}
