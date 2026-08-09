import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

const MY_KD = "3:2";

export default function KingdomOverview() {
  const [provinces, setProvinces] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("provinces")
        .select("name, acres, nw, off, def, be, race, personality, networth, land")
        .eq("kd_code", MY_KD)
        .order("nw", { ascending: false });
      setProvinces(data || []);
      setLoading(false);
    }
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, [supabase]);

  const totalNW = provinces.reduce((s, p) => s + (parseInt(p.nw) || parseInt(p.networth) || 0), 0);
  const totalAcres = provinces.reduce((s, p) => s + (parseInt(p.acres) || parseInt(p.land) || 0), 0);
  const totalOff = provinces.reduce((s, p) => s + (parseInt(p.off) || 0), 0);
  const totalDef = provinces.reduce((s, p) => s + (parseInt(p.def) || 0), 0);
  const avgNW = provinces.length ? Math.round(totalNW / provinces.length) : 0;
  const avgBE = provinces.filter(p => p.be).length
    ? Math.round(provinces.filter(p => p.be).reduce((s, p) => s + parseFloat(p.be) || 0, 0) / provinces.filter(p => p.be).length)
    : 0;

  const fmt = n => n ? n.toLocaleString() : "—";

  if (loading) return <div className="empty"><div className="empty-icon">⏳</div><div className="empty-text">Loading kingdom...</div></div>;

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
          <div className="stat-value blue">3:2</div>
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
                  <td>{fmt(parseInt(p.acres) || parseInt(p.land) || 0)}</td>
                  <td className="gold">{fmt(parseInt(p.nw) || parseInt(p.networth) || 0)}</td>
                  <td className="red">{fmt(parseInt(p.off) || 0)}</td>
                  <td className="purple">{fmt(parseInt(p.def) || 0)}</td>
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
