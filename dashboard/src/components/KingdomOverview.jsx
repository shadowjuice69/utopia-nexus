import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { loadNexusConfig, getNexusConfig } from "../services/nexusConfig";

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];

    if (quoted) {
      if (c === '"' && n === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        cell += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (c !== "\r") {
      cell += c;
    }
  }

  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function extract(parsed) {
  const raw = parsed?.rows?.find((r) => r?.raw)?.raw;
  if (!raw) return [];

  const rows = parseCSV(raw);
  if (rows.length < 2) return [];

  const headers = rows[0].map((x) => String(x ?? "").trim());

  return rows
    .slice(1)
    .filter((r) => r.length)
    .map((r) =>
      Object.fromEntries(
        headers.map((key, i) => [key, r[i] ?? ""])
      )
    )
    .filter((r) => String(r.Name ?? "").trim());
}

/*
 * Build the freshest province snapshot from ALL recent overview captures.
 *
 * Captures are processed newest -> oldest.
 * For each province, the newest non-empty value wins.
 * Older captures are only used to fill fields that a newer partial
 * capture did not contain.
 */
function mergeFreshestCaptures(data) {
  const provinces = new Map();
  let latestReceivedAt = null;

  for (const capture of data || []) {
    const receivedAt = capture?.received_at;
    const rows = extract(capture?.parsed);

    if (!rows.length) continue;

    if (
      !latestReceivedAt ||
      new Date(receivedAt).getTime() > new Date(latestReceivedAt).getTime()
    ) {
      latestReceivedAt = receivedAt;
    }

    for (const row of rows) {
      const name = String(row.Name ?? "").trim();
      if (!name) continue;

      const existing = provinces.get(name);

      if (!existing) {
        provinces.set(name, {
          ...row,
          _latestReceivedAt: receivedAt,
        });
        continue;
      }

      /*
       * Newest capture is already being processed first.
       * Only fill values that are missing/blank in the newer record.
       */
      for (const [key, value] of Object.entries(row)) {
        if (key === "Name") continue;

        const current = existing[key];
        const incoming = String(value ?? "").trim();

        if (
          (current === undefined ||
            current === null ||
            String(current).trim() === "") &&
          incoming !== ""
        ) {
          existing[key] = value;
        }
      }
    }
  }

  return {
    provinces: Array.from(provinces.values()).sort((a, b) =>
      String(a.Name).localeCompare(String(b.Name))
    ),
    latestReceivedAt,
  };
}

export default function KingdomOverview() {
  const [provinces, setProvinces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [kd, setKd] = useState("");
  const [updated, setUpdated] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const c = await loadNexusConfig(true);
        const k = c?.kd || getNexusConfig().kd || "";

        if (!k) {
          throw new Error("Kingdom context is unavailable.");
        }

        const { data, error: e } = await supabase
          .from("intel_page_ingest")
          .select("parsed,received_at")
          .eq("kd_code", k)
          .eq("tab", "overview")
          .order("received_at", { ascending: false })
          .limit(200);

        if (e) throw e;

        const merged = mergeFreshestCaptures(data);

        if (cancelled) return;

        setKd(k);
        setProvinces(merged.provinces);
        setUpdated(merged.latestReceivedAt);
        setError(
          merged.provinces.length
            ? ""
            : "No fresh overview data for this kingdom yet."
        );
      } catch (e) {
        if (!cancelled) {
          setProvinces([]);
          setUpdated(null);
          setError(e?.message || "Unable to load fresh kingdom data.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    const iv = setInterval(load, 30000);

    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, []);

  const num = (v) =>
    Number(String(v ?? "").replace(/[^0-9.-]/g, "")) || 0;

  const fmt = (n) => (n ? n.toLocaleString() : "—");

  const nw = provinces.reduce((s, p) => s + num(p.NW), 0);
  const acres = provinces.reduce((s, p) => s + num(p.Acres), 0);
  const off = provinces.reduce((s, p) => s + num(p.Off), 0);
  const def = provinces.reduce((s, p) => s + num(p.Def), 0);
  const avg = provinces.length
    ? Math.round(nw / provinces.length)
    : 0;

  const be = provinces
    .map((p) => num(p.BE))
    .filter(Boolean);

  const avgBE = be.length
    ? Math.round(be.reduce((a, b) => a + b, 0) / be.length)
    : 0;

  if (loading) {
    return (
      <div className="empty">
        <div className="empty-icon">⏳</div>
        <div className="empty-text">Loading fresh kingdom intel...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty">
        <div className="empty-icon">⚠️</div>
        <div className="empty-text">{error}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="stat-grid">
        {[
          ["Total NW", fmt(nw), ""],
          ["Total Acres", fmt(acres), "green"],
          ["Total Offense", fmt(off), "red"],
          ["Total Defense", fmt(def), "purple"],
          ["Members", provinces.length, "blue"],
          ["Avg NW", fmt(avg), ""],
          ["Avg BE", avgBE ? avgBE + "%" : "—", "green"],
          ["Coordinates", kd, "blue"],
        ].map(([l, v, c]) => (
          <div className="stat-card" key={l}>
            <div className="stat-label">{l}</div>
            <div className={`stat-value ${c}`}>{v}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-title">
          Fresh Province Roster
          {updated && (
            <small style={{ opacity: 0.6, marginLeft: 8 }}>
              Updated {new Date(updated).toLocaleString()}
            </small>
          )}
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="nexus-table">
            <thead>
              <tr>
                <th>Province</th>
                <th>Combo</th>
                <th>Acres</th>
                <th>Net Worth</th>
                <th>Offense</th>
                <th>Defense</th>
                <th>BE</th>
                <th>Intel Age</th>
              </tr>
            </thead>

            <tbody>
              {provinces.map((p, i) => (
                <tr key={p.Name + i}>
                  <td className="gold">{p.Name}</td>
                  <td>{p.Combo || "—"}</td>
                  <td>{fmt(num(p.Acres))}</td>
                  <td className="gold">{fmt(num(p.NW))}</td>
                  <td className="red">{fmt(num(p.Off))}</td>
                  <td className="purple">{fmt(num(p.Def))}</td>
                  <td className="green">{p.BE || "—"}</td>
                  <td>{p.IntelAge || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
