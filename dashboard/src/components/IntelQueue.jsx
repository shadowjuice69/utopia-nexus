import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

export default function IntelQueue() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("intel_queue")
        .select("*")
        .order("priority", { ascending: false });
      setQueue(data || []);
      setLoading(false);
    }
    load();
    const iv = setInterval(load, 10000);
    return () => clearInterval(iv);
  }, [supabase]);

  const pending = queue.filter(q => q.status === "pending").length;
  const done = queue.filter(q => q.status === "done").length;
  const total = queue.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  async function clearDone() {
    await supabase.from("intel_queue").delete().eq("status", "done");
    setQueue(q => q.filter(x => x.status !== "done"));
  }

  if (loading) return <div className="empty"><div className="empty-icon">⏳</div><div className="empty-text">Loading queue...</div></div>;

  return (
    <div>
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
        <div className="stat-card">
          <div className="stat-label">Total</div>
          <div className="stat-value">{total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending</div>
          <div className="stat-value red">{pending}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Done</div>
          <div className="stat-value green">{done}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Progress</div>
          <div className="stat-value blue">{pct}%</div>
        </div>
      </div>

      {total > 0 && (
        <div className="card">
          <div className="queue-progress">
            <div className="queue-progress-bar" style={{ width: pct + "%" }} />
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Intel Queue</div>
          {done > 0 && (
            <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={clearDone}>
              Clear Done
            </button>
          )}
        </div>

        {queue.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">✅</div>
            <div className="empty-text">Queue is empty — start the Nexus Cycler to populate it</div>
          </div>
        ) : (
          <table className="nexus-table">
            <thead>
              <tr>
                <th>Province</th>
                <th>Kingdom</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Last Scraped</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((q, i) => (
                <tr key={i}>
                  <td className="gold">{q.province_name}</td>
                  <td style={{ color: "var(--text2)", fontFamily: "var(--font-mono)" }}>{q.kd_code || "—"}</td>
                  <td>{q.priority}</td>
                  <td>
                    <span className={`badge ${
                      q.status === "done" ? "badge-green" :
                      q.status === "in_progress" ? "badge-gold" :
                      q.status === "failed" ? "badge-red" : "badge-grey"
                    }`}>
                      {q.status}
                    </span>
                  </td>
                  <td style={{ color: "var(--text3)", fontSize: 12 }}>
                    {q.last_scraped ? new Date(q.last_scraped).toLocaleString() : "Never"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
