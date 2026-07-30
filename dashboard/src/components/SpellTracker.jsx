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
  "builder's boon": "🏗️", "builders boon": "🏗️", "inner strength": "💪", "love and peace": "☮️",
  "protection": "🛡️", "minor protection": "🛡️", "magic shield": "🔮",
  "mage's fury": "⚡", "gluttony": "🍖", "greed": "💰",
  "chastity": "⛔", "sloth": "😴", "droughts": "🏜️",
  "storms": "⛈️", "fireball": "🔥", "blizzard": "❄️",
  "pitfalls": "🕳️", "expose thieves": "👁️", "abolish ritual": "🚫",
  "magic ward": "🛡️", "tornadoes": "🌪️", "mystic vortex": "🌀",
  "nightmares": "😱", "lightning strike": "⚡", "fools gold": "💛",
  "land lust": "🗺️", "meteor showers": "🌠", "nightfall": "🌑",
  "invisibility": "👻", "heroes inspiration": "🦸", "miners mystique": "⛏️",
  "miner's mystique": "⛏️", "fertile lands": "🌱", "revelation": "🔭",
  "fountain of knowledge": "⛲", "nature's blessing": "🌿", "inspire army": "⚔️",
  "clear sight": "👁️", "ghost workers": "👷", "crystal eye": "🔮", "crystal ball": "🔮",
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
  "heroes inspiration", "miners mystique", "fertile lands",
]);

function cleanSpellName(raw) {
  if (!raw) return "";
  return raw.replace(/__/g, "").trim();
}

function parseSpells(raw) {
  if (!raw) return [];
  if (raw.toLowerCase().includes("no magical auras")) return [];
  const results = [];
  const durationPattern = /([A-Za-z\s']+?)\s*\(\s*(\d+)\s*days?\s*\)/gi;
  let match;
  while ((match = durationPattern.exec(raw)) !== null) {
    const name = match[1].trim().toLowerCase();
    results.push({ name: match[1].trim(), days: parseInt(match[2]), normalized: name });
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
    const interval = setInterval(() => { fetchProvinces(); fetchCastLog(); }, 30000);
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
      .limit(200);
    setCastLog(data || []);
  }

  const filtered = provinces.filter(p => {
    const spells = parseSpells(p.good_spells);
    if (spells.length === 0 && filter !== "all") return false;
    if (filter === "friendly") return spells.some(s => FRIENDLY_SPELLS.has(s.normalized));
    if (filter === "hostile") return spells.some(s => HOSTILE_SPELLS.has(s.normalized));
    return true;
  });

  const filteredCastLog = castLog.filter(s => {
    if (filter === "friendly") return !s.target_province;
    if (filter === "hostile") return !!s.target_province;
    return true;
  });

  function timeAgo(ts) {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return `${hrs}h ago`;
    if (mins > 0) return `${mins}m ago`;
    return "just now";
  }

  if (loading) return <div className="loading">⏳ Loading Spell Tracker...</div>;

  return (
    <div className="intel-panel">
      <div className="panel">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <h2 style={{margin:0}}>✨ Spell Tracker</h2>
          <div style={{display:"flex",gap:6}}>
            {["buffs","castlog"].map(v => (
              <button key={v} onClick={() => setView(v)}
                style={{opacity: view === v ? 1 : 0.5}}>
                {v === "buffs" ? "🛡️ Active Buffs" : "📜 Cast Log"}
              </button>
            ))}
          </div>
        </div>

        <div style={{marginBottom:12,display:"flex",gap:6}}>
          {["all","friendly","hostile"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{opacity: filter === f ? 1 : 0.5}}>
              {f === "all" ? "All" : f === "friendly" ? "🛡️ Friendly" : "💀 Hostile"}
            </button>
          ))}
        </div>

        {view === "buffs" && (
          filtered.length === 0 ? (
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
          )
        )}

        {view === "castlog" && (
          filteredCastLog.length === 0 ? (
            <p>No spell casts recorded yet.</p>
          ) : (
            filteredCastLog.map((s,i) => {
              const name = cleanSpellName(s.spell_name);
              const normalized = name.toLowerCase();
              return (
                <div key={i} style={{marginBottom:8,display:"flex",gap:8,alignItems:"center"}}>
                  <span>{SPELL_EMOJI[normalized] || "✨"}</span>
                  <span style={{flex:1}}>
                    <b>{name}</b>
                    {" "}
                    {s.success ? "✅" : "❌"}
                    {" "}
                    <span style={{opacity:0.7}}>{s.caster_province}</span>
                    {s.target_province ? <span> → <b>{s.target_province}</b></span> : ""}
                  </span>
                  <span style={{opacity:0.5,fontSize:"0.85em",whiteSpace:"nowrap"}}>
                    {timeAgo(s.timestamp)}
                  </span>
                </div>
              );
            })
          )
        )}
      </div>
    </div>
  );
}
