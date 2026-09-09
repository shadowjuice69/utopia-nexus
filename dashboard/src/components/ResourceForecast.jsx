import { useCallback, useEffect, useState } from "react";
import { loadResourceForecast } from "../services/resourceForecast";

const nf = new Intl.NumberFormat("en-US");
const n = v => v == null ? "—" : nf.format(Math.round(v));
const rate = v => v == null ? "rate not established" : `${v >= 0 ? "+" : "−"}${n(Math.abs(v))}/t`;
const hours = v => !Number.isFinite(v) ? "unknown" : `${v < 1 ? `${Math.round(v * 60)}m` : `${v.toFixed(1)}h`} old`;

function ResourceRow({ row }) {
  return <div className="intel-row">
    <div className="intel-row-main">
      <span><b>{row.label.padEnd(7, " ")}</b> {n(row.current)} → 24t <b>{n(row.at24)}</b> · 48t <b>{n(row.at48)}</b></span>
      <small>{rate(row.rate)}{row.measuredHours ? ` · measured ${row.measuredHours.toFixed(1)}h` : ""}</small>
    </div>
  </div>;
}

function DraftRow({ row }) {
  return <div className="intel-row">
    <div className="intel-row-main">
      <span><b>{row.label}</b> ({row.rate.toFixed(1)}% Rate; {n(41)} gold coins/soldier)</span>
      <small>24t: {n(row.at24.drafted)} drafted · army {n(row.at24.army)} · ~{n(row.gold24)}gc · peasants {n(row.at24.peasants)} · 48t: {n(row.at48.drafted)} drafted · army {n(row.at48.army)}</small>
    </div>
  </div>;
}

export default function ResourceForecast() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try { setError(""); setData(await loadResourceForecast()); }
    catch (e) { setError(e?.message || "Unable to load resource forecast"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); const timer = setInterval(refresh, 60000); return () => clearInterval(timer); }, [refresh]);

  if (loading && !data) return <div className="panel"><h2>📈 Resource Forecast</h2><p>Calculating 24/48 tick forecast...</p></div>;
  if (!data) return <div className="panel"><h2>📈 Resource Forecast</h2><p className="error-text">{error}</p><button className="btn btn-ghost" onClick={refresh}>Retry</button></div>;

  const status = data.rateStatus === "fresh" ? "rates current" : data.rateStatus === "warning" ? "⚠ rate >24h old" : "⚠ rates >72h old / unavailable";
  return <div className="panel intel7-shell">
    <header className="intel7-header">
      <div><div className="eyebrow">RESOURCE & POPULATION PROJECTION</div><h2>📈 IN 24 · 48 TICKS — {data.province}</h2><small>({data.kd} · captured rates · assumes no combat / aid / spells)</small></div>
      <button className="btn btn-ghost" onClick={refresh}>↻ Recalculate</button>
    </header>
    {error && <div className="intel-warning">⚠ {error}</div>}
    <div className="intel-stat-grid">
      <section className="intel-card"><div className="intel-card-title">Resources</div>{data.resources.map(r => <ResourceRow key={r.label} row={r} />)}</section>
      <section className="intel-card"><div className="intel-card-title">Population</div><div><b>Peasants</b> {n(data.current.peasants)}</div><div><b>Army</b> {n(data.current.soldiers)}</div><div><b>Land</b> {n(data.current.acres)}</div></section>
    </div>
    <section className="intel-card"><div className="intel-card-title">Draft Scenarios</div>{data.draft.map(r => <DraftRow key={r.label} row={r} />)}</section>
    <section className="intel-card"><div className="intel-card-title">Forecast Rules</div>
      <div className="source-grid"><div>Status <b>{status}</b></div><div>Sources <b>{data.sourceCount}</b></div><div>Oldest rate <b>{hours(data.oldestRateHours)}</b></div><div>Tick model <b>24 ticks/day</b></div></div>
      <p className="muted">Rates use the latest two game-state captures when available; otherwise the latest state-page trend is used. Projections stop when a rate is older than 72h. Draft cost is 41gc/soldier.</p>
    </section>
  </div>;
}
