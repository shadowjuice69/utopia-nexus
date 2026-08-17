import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { getKingdomContext } from "../services/kingdomContext";

export default function AITargets() {
  const [targets, setTargets] = useState([]);
  const [ourAvgNW, setOurAvgNW] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { kingdomCode } = await getKingdomContext();
      if (!kingdomCode) {
        setTargets([]);
        setOurAvgNW(0);
        setLoading(false);
        return;
      }

      // Get our avg NW from the configured kingdom.
      const { data: ours } = await supabase
        .from("provinces")
        .select("nw, networth")
        .eq("kd_code", kingdomCode);

      const ourNWs = (ours || []).map(p => parseInt(p.nw) || parseInt(p.networth) || 0).filter(Boolean);
      const avg = ourNWs.length ? Math.round(ourNWs.reduce((a, b) => a + b, 0) / ourNWs.length) : 0;
      setOurAvgNW(avg);

      if (!avg) {
        setTargets([]);
        setLoading(false);
        return;
      }

      // Get enemy provinces within 85-115% NW range.
      const min = Math.round(avg * 0.85);
      const max = Math.round(avg * 1.15);

      const { data: enemies } = await supabase
        .from("provinces")
        .select("name, kd_code, race, acres, nw, off, def, nwpa, personality")
        .neq("kd_code", kingdomCode)
        .gte("nw", String(min))
        .lte("nw", String(max))
        .order("nw", { ascending: false });

      const scored = (enemies || []).map(p => {
        let score = 0;
        const nw = parseInt(p.nw) || 0;
        const acres = parseInt(p.acres) || 0;
        const def = parseInt(p.def) || 0;

        if (p.race === "Elf" || p.race === "Faery") score += 30;
        if (p.race === "Dryad") score += 20;
        if (acres > 600) score += 20;
        else if (acres > 500) score += 10;
        if (nw > 0 && def / nw < 0.5) score += 15;

        const diff = Math.abs(nw - avg);
        if (diff < avg * 0.05) score += 10;

        return { ...p, score };
      });

      scored.sort((a, b) => b.score - a.score);
      setTargets(scored.slice(0, 20));
      setLoading(false);
    }
    load();
  }, []);

  const fmt = n => n ? parseInt(n).toLocaleString() : "—";

  if (loading) return <div className="empty"><div className="empty-icon">⏳</div><div className="empty-text">Calculating targets...</div></div>;

  return (
    <div>
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-label">Our Avg NW</div>
          <div className="stat-value">{fmt(ourAvgNW)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Target Range</div>
          <div className="stat-value blue" style={{ fontSize: 14 }}>
            {fmt(Math.round(ourAvgNW * 0.85))} – {fmt(Math.round(ourAvgNW * 1.15))}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Targets Found</div>
          <div className="stat-value green">{targets.length}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Ranked Targets (85–115% NW)</div>
        {targets.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🎯</div>
            <div className="empty-text">No targets in range yet — scrape enemy kingdoms first</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="nexus-table">
              <thead>
                <tr>
                  <th>#</th><th>Province</th><th>KD</th><th>Race</th><th>Acres</th><th>Net Worth</th><th>Defense</th><th>Score</th>
                </tr>
              </thead>
              <tbody>
                {targets.map((t, i) => (
                  <tr key={i}>
                    <td style={{ color: "var(--text3)", fontFamily: "var(--font-mono)" }}>{i + 1}</td>
                    <td className="gold">{t.name}</td>
                    <td style={{ color: "var(--text2)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{t.kd_code}</td>
                    <td><span className={`badge ${t.race === "Elf" || t.race === "Faery" ? "badge-green" : t.race === "Dryad" ? "badge-blue" : "badge-grey"}`}>{t.race || "?"}</span></td>
                    <td className="green">{fmt(t.acres)}</td>
                    <td className="gold">{fmt(t.nw)}</td>
                    <td className="purple">{fmt(t.def)}</td>
                    <td><span className={`badge ${t.score >= 50 ? "badge-green" : t.score >= 30 ? "badge-gold" : "badge-grey"}`}>{t.score}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
