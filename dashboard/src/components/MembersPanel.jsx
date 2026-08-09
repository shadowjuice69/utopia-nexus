import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

const MY_KD = "3:2";

export default function MembersPanel() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("kingdom_members")
        .select("*")
        .eq("kd_code", MY_KD)
        .order("name");
      setMembers(data || []);
      setLoading(false);
    }
    load();
  }, [supabase]);

  if (loading) return <div className="empty"><div className="empty-icon">⏳</div><div className="empty-text">Loading members...</div></div>;
  if (!members.length) return <div className="empty"><div className="empty-icon">👥</div><div className="empty-text">No members found</div></div>;

  return (
    <div className="card">
      <div className="card-title">Kingdom Members ({members.length})</div>
      <table className="nexus-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Discord</th>
            <th>Role</th>
            <th>Race</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m, i) => (
            <tr key={i}>
              <td className="gold">{m.name}</td>
              <td style={{ color: "var(--text2)" }}>{m.discord || "—"}</td>
              <td>{m.role || "—"}</td>
              <td>{m.race || "—"}</td>
              <td>
                <span className={`badge ${m.is_active ? "badge-green" : "badge-grey"}`}>
                  {m.is_active ? "Active" : "Inactive"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
