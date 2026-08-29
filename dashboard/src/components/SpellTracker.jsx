import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

const SPELL_ABBR = {
  "bb": "Builder's Boon", "ia": "Inner Strength", "lp": "Love and Peace",
  "pat": "Protection", "mp": "Minor Protection", "ms": "Magic Shield",
  "mf": "Mage's Fury", "ge": "Gluttony", "gr": "Greed",
  "ch": "Chastity", "sl": "Sloth", "dr": "Droughts",
  "st": "Storms", "fb": "Fireball", "bl": "Blizzard",
  "pt": "Pitfalls", "et": "Expose Thieves", "ar": "Abolish Ritual",
  "mw": "Magic Ward", "to": "Tornadoes", "mv": "Mystic Vortex",
  "nm": "Nightmares", "ls": "Lightning Strike", "fg": "Fools Gold",
  "ll": "Land Lust", "met": "Meteor Showers", "nf": "Nightfall",
  "invis": "Invisibility", "inv": "Invisibility",
};

const SPELL_EMOJI = {
  "builder's boon": "🏗️", "builders boon": "🏗️", "inner strength": "💪",
  "love and peace": "☮️", "protection": "🛡️", "minor protection": "🛡️",
  "magic shield": "🔮", "mage's fury": "⚡", "gluttony": "🍖", "greed": "💰",
  "chastity": "⛔", "sloth": "😴", "droughts": "🏜️", "storms": "⛈️",
  "fireball": "🔥", "blizzard": "❄️", "pitfalls": "🕳️",
  "expose thieves": "👁️", "abolish ritual": "🚫", "magic ward": "🛡️",
  "tornadoes": "🌪️", "mystic vortex": "🌀", "nightmares": "😱",
  "lightning strike": "⚡", "fools gold": "💛", "land lust": "🗺️",
  "meteor showers": "🌠", "nightfall": "🌑", "invisibility": "👻",
  "heroes inspiration": "🦸", "miners mystique": "⛏️", "miner's mystique": "⛏️",
  "fertile lands": "🌱", "revelation": "🔭", "fountain of knowledge": "⛲",
  "nature's blessing": "🌿", "inspire army": "⚔️", "clear sight": "👁️",
  "ghost workers": "👷", "crystal eye": "🔮", "crystal ball": "🔮",
  "wrath": "⚡", "wraith form": "👻",
};

const HOSTILE_SPELLS = new Set([
  "fireball", "storms", "droughts", "gluttony", "greed", "chastity", "sloth",
  "blizzard", "pitfalls", "expose thieves", "abolish ritual", "tornadoes",
  "mystic vortex", "nightmares", "lightning strike", "fools gold", "land lust",
  "meteor showers", "nightfall",
]);

const FRIENDLY_SPELLS = new Set([
  "builder's boon", "inner strength", "love and peace", "protection",
  "minor protection", "magic shield", "mage's fury", "magic ward", "invisibility",
  "heroes inspiration", "miners mystique", "fertile lands", "wrath",
]);

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d ago`;
  if (hrs > 0) return `${hrs}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}

function parseSpells(raw) {
  if (!raw) return [];
  if (raw.toLowerCase().includes("no magical auras")) return [];
  const results = [];
  const durationPattern = /([A-Za-z\s']+?)\s*\(\s*(\d+)\s*days?\s*\)/gi;
  let match;
  while ((match = durationPattern.exec(raw)) !== null) {
    const name = match[1].trim();
    results.push({ name, days: parseInt(match[2]), normalized: name.toLowerCase() });
  }
  if (results.length > 0) return results;
  const parts = raw.split(/[,·]+/).map(s => s.trim()).filter(Boolean);
  for (const part of parts) {
    const lower = part.toLowerCase();
    const expanded = SPELL_ABBR[lower] || part;
    results.push({ name: expanded, days: null, normalized: expanded.toLowerCase() });
  }
  return results;
}

export default function SpellTracker() {
  const [provinces, setProvinces] = useState([]);
  const [castLog, setCastLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState("buffs");

  useEffect(() => {
    fetchProvinces();
    fetchCastLog();
    const iv = setInterval(() => { fetchProvinces(); fetchCastLog(); }, 30000);
    return () => clearInterval(iv);
  }, []);

  async function fetchProvinces() {
    const { data } = await supabase
      .from("provinces")
      .select("id, name, race, personality, good_spells, kd_code, updated_at")
      .not("good_spells", "is", null)
      .order("updated_at", { ascending: false });
    setProvinces(data || []);
    setLoading(false);
  }

  async function fetchCastLog() {
    const { data } = await supabase
      .from("intel7_events")
      .select("*")
      .eq("event_type", "spell")
      .order("timestamp", { ascending: false })
      .limit(200);
    setCastLog(data || []);
  }

  const filteredProvinces = provinces.filter(p => {
    const spells = parseSpells(p.good_spells);
    if (spells.length === 0 && filter !== "all") return false;
    if (filter === "friendly") return spells.some(s => FRIENDLY_SPELLS.has(s.normalized));
    if (filter === "hostile") return spells.some(s => HOSTILE_SPELLS.has(s.normalized));
    return true;
  });

  const filteredCastLog = castLog.filter(e => {
    const spellName = (e.spell_name || e.data?.spellName || "").toLowerCase();
    if (filter === "friendly") return FRIENDLY_SPELLS.has(spellName);
    if (filter === "hostile") return HOSTILE_SPELLS.has(spellName);
    return true;
  });

  // Cast log stats
  const last24h = castLog.filter(e => Date.now() - new Date(e.timestamp) < 86400000);
  const successCount = last24h.filter(e => e.success !== false).length;
  const bySpell = castLog.reduce((acc, e) => {
    const n = e.spell_name || e.data?.spellName || "Unknown";
    acc[n] = (acc[n] || 0) + 1;
    return acc;
  }, {});
  const topSpell = Object.entries(bySpell).sort((a, b) => b[1] - a[1])[0];

  if (loading) return <div className="loading">⏳ Loading Spell Tracker...</div>;

  return (
    <div className="intel-panel">
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>✨ Spell Tracker</h2>
          <div style={{ display: "flex", gap: 6 }}>
            {[["buffs", "🛡️ Active Buffs"], ["castlog", "📜 Cast Log"]].map(([v, label]) => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: "4px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12,
                border: `1px solid ${view === v ? "#8b5cf6" : "rgba(255,255,255,0.1)"}`,
                background: view === v ? "rgba(139,92,246,0.15)" : "transparent",
                color: view === v ? "#a78bfa" : "#94a3b8",
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* Filter buttons */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {[["all", "All"], ["friendly", "🛡️ Friendly"], ["hostile", "💀 Hostile"]].map(([f, label]) => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12,
              border: `1px solid ${filter === f ? "#6366f1" : "rgba(255,255,255,0.1)"}`,
              background: filter === f ? "rgba(99,102,241,0.15)" : "transparent",
              color: filter === f ? "#a5b4fc" : "#94a3b8",
            }}>{label}</button>
          ))}
        </div>

        {/* Cast log stats (only in castlog view) */}
        {view === "castlog" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8, marginBottom: 14 }}>
            {[
              { label: "CASTS (24H)", value: last24h.length, color: "#8b5cf6" },
              { label: "SUCCESS", value: successCount, color: "#4ade80" },
              { label: "FAILED", value: last24h.length - successCount, color: "#ef4444" },
              { label: "TOP SPELL", value: topSpell ? topSpell[0] : "—", color: "#a78bfa" },
            ].map(s => (
              <div key={s.label} style={{ background: `${s.color}18`, border: `1px solid ${s.color}33`, borderRadius: 8, padding: "8px 12px" }}>
                <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 4 }}>{s.label}</div>
                <div style={{ color: s.color, fontSize: s.value?.toString().length > 8 ? 11 : 16, fontWeight: 700 }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Active Buffs view */}
        {view === "buffs" && (
          filteredProvinces.length === 0 ? (
            <p style={{ color: "#475569", textAlign: "center", padding: 24 }}>No spell data yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredProvinces.map(p => {
                const spells = parseSpells(p.good_spells);
                return (
                  <div key={p.id} style={{
                    background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 8, padding: "10px 14px",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{p.name}</span>
                      <span style={{ color: "#475569", fontSize: 11 }}>{p.kd_code}</span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {spells.map((s, i) => {
                        const isHostile = HOSTILE_SPELLS.has(s.normalized);
                        const color = isHostile ? "#ef4444" : "#8b5cf6";
                        return (
                          <span key={i} style={{
                            fontSize: 12, padding: "3px 8px", borderRadius: 5,
                            background: `${color}18`, color, border: `1px solid ${color}33`,
                          }}>
                            {SPELL_EMOJI[s.normalized] || "✨"} {s.name}
                            {s.days ? ` (${s.days}d)` : ""}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* Cast Log view */}
        {view === "castlog" && (
          filteredCastLog.length === 0 ? (
            <p style={{ color: "#475569", textAlign: "center", padding: 24 }}>No spell casts recorded yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {filteredCastLog.map((e, i) => {
                const spellName = e.spell_name || e.data?.spellName || "Unknown";
                const caster = e.attacker_province || e.data?.casterProvince || "?";
                const normalized = spellName.toLowerCase();
                const failed = e.success === false;
                const color = HOSTILE_SPELLS.has(normalized) ? "#ef4444" : "#8b5cf6";
                const data = e.data || {};

                return (
                  <div key={i} style={{
                    background: "rgba(255,255,255,0.02)",
                    border: `1px solid ${failed ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.06)"}`,
                    borderLeft: `3px solid ${failed ? "#ef4444" : color}`,
                    borderRadius: 8, padding: "8px 12px",
                    display: "flex", alignItems: "center", gap: 10,
                  }}>
                    <span style={{ fontSize: 18 }}>{SPELL_EMOJI[normalized] || "✨"}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                        <span style={{ color: "#e2e8f0", fontWeight: 500, fontSize: 13 }}>{spellName}</span>
                        {failed
                          ? <span style={{ color: "#ef4444", fontSize: 11 }}>FAILED</span>
                          : <span style={{ color: "#4ade80", fontSize: 11 }}>✓</span>
                        }
                      </div>
                      <div style={{ color: "#94a3b8", fontSize: 12 }}>
                        <span style={{ color: "#e2e8f0" }}>{caster}</span>
                        {e.target_province && <>
                          <span style={{ color: "#374151", margin: "0 6px" }}>→</span>
                          <span style={{ color: "#38bdf8" }}>{e.target_province}</span>
                        </>}
                        {data.runes && <span style={{ color: "#475569", marginLeft: 8 }}>{Number(data.runes).toLocaleString()} runes</span>}
                        {data.durationDays && <span style={{ color: "#475569", marginLeft: 8 }}>{data.durationDays}d</span>}
                      </div>
                    </div>
                    <span style={{ color: "#475569", fontSize: 11, whiteSpace: "nowrap" }}>{timeAgo(e.timestamp)}</span>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}
