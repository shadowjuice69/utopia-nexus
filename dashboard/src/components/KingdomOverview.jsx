import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { getNexusConfig, loadNexusConfig } from "../services/nexusConfig";

export default function KingdomOverview() {
  const [provinces, setProvinces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [kd, setKd] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const config = await loadNexusConfig();
        const currentKd = config?.kd || getNexusConfig().kd || "";

        if (!currentKd) {
          if (!cancelled) {
            setProvinces([]);
            setKd("");
            setError("Kingdom context is unavailable.");
            setLoading(false);
          }
          return;
        }

        if (!cancelled) setKd(currentKd);

        const { data, error: queryError } = await supabase
          .from("provinces")
          .select("name, acres, nw, off, def, be, race, personality, kd_code")
          .eq("kd_code", currentKd)
          .order("nw", { ascending: false });

        if (cancelled) return;

        if (queryError) {
          setProvinces([]);
          setError(queryError.message || "Unable to load kingdom data.");
        } else {
          setProvinces(data || []);
          setError("");
        }
      } catch (loadError) {
        if (!cancelled) {
          setProvinces([]);
          setError(loadError?.message || "Unable to load kingdom context.");
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

  const totalNW = provinces.reduce((s, p) => s + (parseInt(p.nw, 10) || 0), 0);
  const totalAcres = provinces.reduce((s, p) => s + (parseInt(p.acres, 10) || 0), 0);
  const totalOff = provinces.reduce((s, p) => s + (parseInt(p.off, 10) || 0), 0);
  const totalDef = provinces.reduce((s, p) => s + (parseInt(p.def, 10) || 0), 0);
  const avgNW = provinces.length ? Math.round(totalNW / provinces.length) : 0;
  const beValues = provinces
    .map(p => parseFloat(p.be))
    .filter(Number.isFinite);
  const avgBE = beValues.length
    ? Math.round(beValues.reduce((s, value) => s + value, 0) / beValues.length)
    : 0;

  const fmt = n => n ? n.toLocaleString() : "—";

  if (loading) return <div className="empty"><div className="empty-icon">⏳</div><div className="empty-text">Loading kingdom...</div></div>;

  if (error) {
    return <div className="empty"><div className="empty-icon">⚠️</div><div className="empty-text">{error}</div></div>;
  }

  return (
    <div>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Total NW</div>
          <div className="stat-value">{fmt(totalNW)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Acres</div>
          <div className="stat-value green">{fmt(totalAcres)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Offense</div>
          <div className="stat-value red">{fmt(totalOff)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Defense</div>
          <div className="stat-value purple">{fmt(totalDef)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Members</div>
          <div className="stat-value blue">{provinces.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg NW</div>
          <div className="stat-value">{fmt(avgNW)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg BE</div>
          <div className="stat-value green">{avgBE ? avgBE + "%" : "—"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Coordinates</div>
          <div className="stat-value blue">{kd || "—"}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Province Roster</div>
        <div style={{ overflowX: "auto" }}>
          <table className="nexus-table">
            <thead>
              <tr>
                <th>Province</th>
                <th>Race</th>
                <th>Acres</th>
                <th>Net Worth</th>
                <th>Offense</th>
                <th>Defense</th>
                <th>BE</th>
              </tr>
            </thead>
            <tbody>
              {provinces.map((p, i) => (
                <tr key={i}>
                  <td className="gold">{p.name}</td>
                  <td>{p.race || "—"}</td>
                  <td>{fmt(parseInt(p.acres, 10) || 0)}</td>
                  <td className="gold">{fmt(parseInt(p.nw, 10) || 0)}</td>
                  <td className="red">{fmt(parseInt(p.off, 10) || 0)}</td>
                  <td className="purple">{fmt(parseInt(p.def, 10) || 0)}</td>
                  <td className="green">{p.be ? p.be + "%" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
