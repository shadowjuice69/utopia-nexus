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
  const [castLog, setCastLog] = useState([]);
  const [spells, setSpells] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all | friendly | hostile
  const [view, setView] = useState("buffs"); // buffs | castlog

  useEffect(() => {
    fetchProvinces();
    fetchCastLog();
    fetchSpells();
    const interval = setInterval(() => { fetchProvinces(); fetchCastLog(); fetchSpells(); }, 30000);
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

  async function fetchCastLog() {
    const { data } = await supabase
      .from("spell_events")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(100);
    setCastLog(data || []);
  }

  async function fetchSpells() {
    const { data } = await supabase
      .from("spell_events")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(100);

    setSpells(data || []);
  }

  const filtered = provinces.filter(p => {
    const spells = parseSpells(p.good_spells);
    if (spells.length === 0 && filter !== "all") return false;
    if (filter === "friendly") return spells.some(s => FRIENDLY_SPELLS.has(s.normalized));
    if (filter === "hostile") return spells.some(s => HOSTILE_SPELLS.has(s.normalized));
    return true;
  });

  // Summary
  const allSpells = spells.map(s => ({
    normalized: s.spell_name.toLowerCase().replaceAll("_", " "),
    name: s.spell_name
  }));
  const spellCounts = allSpells.reduce((acc, s) => {
    acc[s.normalized] = (acc[s.normalized] || 0) + 1;
    return acc;
  }, {});
  const topSpells = Object.entries(spellCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  function timeAgo(ts) {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return `${hrs}h ago`;
    if (mins > 0) return `${mins}m ago`;
    return "just now";
  }

  const filteredCastLog = castLog.filter(s => {
    if (filter === "friendly") return !s.target_kingdom;
    if (filter === "hostile") return !!s.target_kingdom;
    return true;
  });

  if (loading) return <div className="loading">⏳ Loading Spell Tracker...</div>;

  return (
    <div className="intel-panel">
      <div className="panel">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <h2 style={{margin:0}}>✨ Spell Tracker</h2>
          <div style={{display:"flex",gap:6}}>
            {["buffs","castlog"].map(v => (
              <button key={v} onClick={() => setView(v)}>
                {v === "buffs" ? "🛡️ Active Buffs" : "📜 Cast Log"}
              </button>
            ))}
          </div>
        </div>

        {view === "buffs" && (
          <>
            {topSpells.length > 0 && (
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
                {topSpells.map(([name,count]) => (
                  <div key={name}>
                    {SPELL_EMOJI[name] || "✨"} {name} ×{count}
                  </div>
                ))}
              </div>
            )}

            <div style={{marginBottom:12}}>
              {["all","friendly","hostile"].map(f => (
                <button key={f} onClick={() => setFilter(f)}>
                  {f === "friendly" ? "🛡️ Friendly" :
                   f === "hostile" ? "💀 Hostile" : "All"}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <p>No spell data yet.</p>
            ) : (
              filtered.map(p => {
                const spells = parseSpells(p.good_spells);
                return (
                  <div key={p.id} style={{marginBottom:8}}>
                    <b>{p.name}</b>
                    <div>
                      {spells.map((s,i) => (
                        <span key={i} style={{marginRight:8}}>
                          {SPELL_EMOJI[s.normalized] || "✨"} {s.name}
                          {s.days ? ` (${s.days}d)` : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}

        {view === "castlog" && (
          <>
            {filteredCastLog.length === 0 ? (
              <p>No spell casts recorded yet.</p>
            ) : (
              filteredCastLog.map((s,i) => (
                <div key={i} style={{marginBottom:8}}>
                  {SPELL_EMOJI[s.spell_name?.toLowerCase()] || "✨"} {s.spell_name}
                  {" "}
                  {s.success ? "✅" : "❌"}
                  {" "}
                  {s.caster_province}
                  {s.target_province ? ` → ${s.target_province}` : ""}
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
