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
  "builder's boon": "🏗️", "inner strength": "💪", "love and peace": "☮️",
  "protection": "🛡️", "minor protection": "🛡️", "magic shield": "🔮",
  "mage's fury": "⚡", "gluttony": "🍖", "greed": "💰",
  "chastity": "⛔", "sloth": "🦥", "droughts": "🏜️",
  "storms": "⛈️", "fireball": "🔥", "blizzard": "❄️",
  "pitfalls": "🕳️", "expose thieves": "👁️", "abolish ritual": "🚫",
  "magic ward": "🛡️", "tornadoes": "🌪️", "mystic vortex": "🌀",
  "nightmares": "😱", "lightning strike": "⚡", "fools gold": "💛",
  "land lust": "🗺️", "meteor showers": "☄️", "nightfall": "🌑",
  "invisibility": "👻",
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
]);

function parseSpells(raw) {
  if (!raw) return [];
  if (raw.toLowerCase().includes("no magical auras")) return [];

  const results = [];

  // Format: "Spell Name ( X days )"
  const durationPattern = /([A-Za-z\s']+?)\s*\(\s*(\d+)\s*days?\s*\)/gi;
  let match;
  while ((match = durationPattern.exec(raw)) !== null) {
    const name = match[1].trim().toLowerCase();
    results.push({ name: match[1].trim(), days: parseInt(match[2]), normalized: name });
  }

  if (results.length > 0) return results;

  // Format: "BB, IA, LP, PAT" — abbreviations
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
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all | friendly | hostile

  useEffect(() => {
    fetchProvinces();
    const interval = setInterval(fetchProvinces, 60000);
    return () => clearInterval(interval);
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

  const filtered = provinces.filter(p => {
    const spells = parseSpells(p.good_spells);
    if (spells.length === 0 && filter !== "all") return false;
    if (filter === "friendly") return spells.some(s => FRIENDLY_SPELLS.has(s.normalized));
    if (filter === "hostile") return spells.some(s => HOSTILE_SPELLS.has(s.normalized));
    return true;
  });

  // Summary
  const allSpells = provinces.flatMap(p => parseSpells(p.good_spells));
  const spellCounts = allSpells.reduce((acc, s) => {
    acc[s.normalized] = (acc[s.normalized] || 0) + 1;
    return acc;
  }, {});
  const topSpells = Object.entries(spellCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  if (loading) return <div className="loading">⏳ Loading Spell Tracker...</div>;

  return (
    <div className="intel-panel">
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ margin: 0 }}>✨ Spell Tracker</h2>
          <span style={{ color: "#475569", fontSize: 12 }}>Updates when throne intel is pasted</span>
        </div>

        {/* Top spells summary */}
        {topSpells.length > 0 && (
          <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
            {topSpells.map(([name, count]) => (
              <div key={name} style={{
                background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)",
                borderRadius: 20, padding: "4px 12px", fontSize: 12, color: "#a5b4fc",
              }}>
                {SPELL_EMOJI[name] || "✨"} {name} ×{count}
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {["all", "friendly", "hostile"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "4px 12px", borderRadius: 6,
              border: `1px solid ${filter === f ? "#6366f1" : "rgba(255,255,255,0.1)"}`,
              background: filter === f ? "rgba(99,102,241,0.2)" : "transparent",
              color: filter === f ? "#a5b4fc" : "#94a3b8",
              cursor: "pointer", fontSize: 12, textTransform: "capitalize",
            }}>
              {f === "friendly" ? "🛡️ Friendly" : f === "hostile" ? "💀 Hostile" : "All"}
            </button>
          ))}
        </div>

        {/* Province spell cards */}
        {filtered.length === 0 ? (
          <p style={{ color: "#475569", textAlign: "center", padding: 32 }}>
            No spell data yet. Paste throne intel via /utopia intel.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map(p => {
              const spells = parseSpells(p.good_spells);
              const updated = new Date(p.updated_at);
              const ageHrs = Math.floor((Date.now() - updated) / 3600000);
              return (
                <div key={p.id} style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 8, padding: "12px 14px",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div>
                      <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{p.name}</span>
                      {p.race && <span style={{ color: "#475569", fontSize: 12, marginLeft: 8 }}>{p.race}</span>}
                      {p.kd_code && <span style={{ color: "#374151", fontSize: 11, marginLeft: 6 }}>({p.kd_code})</span>}
                    </div>
                    <span style={{ color: ageHrs > 24 ? "#ef4444" : "#475569", fontSize: 11 }}>
                      {ageHrs > 0 ? `${ageHrs}h ago` : "just now"}
                      {ageHrs > 24 && " ⚠️"}
                    </span>
                  </div>

                  {spells.length === 0 ? (
                    <span style={{ color: "#374151", fontSize: 12 }}>No active spells</span>
                  ) : (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {spells.map((s, i) => {
                        const isHostile = HOSTILE_SPELLS.has(s.normalized);
                        const isFriendly = FRIENDLY_SPELLS.has(s.normalized);
                        const color = isHostile ? "#ef4444" : isFriendly ? "#4ade80" : "#94a3b8";
                        return (
                          <div key={i} style={{
                            background: `${color}15`, border: `1px solid ${color}40`,
                            borderRadius: 6, padding: "4px 10px", fontSize: 12, color,
                          }}>
                            {SPELL_EMOJI[s.normalized] || "✨"} {s.name}
                            {s.days && <span style={{ color: `${color}99`, marginLeft: 4 }}>({s.days}d)</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
