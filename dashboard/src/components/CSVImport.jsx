import { useState } from "react";
import { supabase } from "../services/supabase";

const RACE_MAP = {
  "Av": "Avian", "De": "Dark Elf", "Dr": "Dryad", "Dw": "Dwarf",
  "El": "Elf", "Fa": "Faery", "Ha": "Halfling", "Hu": "Human",
  "Or": "Orc", "Un": "Undead", "Gn": "Gnome"
};

const PERS_MAP = {
  "Ar": "Artisan", "Cl": "Cleric", "Ge": "General", "He": "Heretic",
  "My": "Mystic", "Ne": "Necromancer", "Ro": "Rogue", "Sa": "Sage",
  "Ta": "Tactician", "Wa": "Warrior", "Wh": "War Hero"
};

const SPELL_ABBR = {
  "LP": "Love and Peace", "BB": "Builder's Boon", "IA": "Inner Strength",
  "MP": "Minor Protection", "FL": "Fountain of Life", "HI": "Holy Insight",
  "FoK": "Fog of Knowledge", "MF": "Mage's Fury", "MS": "Magic Shield",
};

function parseCombo(combo) {
  if (!combo) return { race: null, personality: null };
  const parts = combo.split("/");
  return {
    race: RACE_MAP[parts[0]] || parts[0],
    personality: PERS_MAP[parts[1]] || parts[1],
  };
}

function cleanNum(val) {
  if (!val) return null;
  const n = parseFloat(val.toString().replace(/,/g, "").trim());
  return isNaN(n) ? null : n;
}

function parseSpells(spellStr) {
  if (!spellStr) return null;
  return spellStr.split(",").map(s => SPELL_ABBR[s.trim()] || s.trim()).join(", ");
}

function parseCSV(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",").map(h => h.trim().replace(/^#/, "").trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].match(/(".*?"|[^,]+)(?=,|$)/g)?.map(c => c.replace(/"/g, "").trim()) || [];
    const row = {};
    headers.forEach((h, idx) => row[h] = cols[idx] || null);
    rows.push(row);
  }
  return rows;
}

export default function CSVImport() {
  const [status, setStatus] = useState([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [kdCode, setKdCode] = useState("3:2");

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setDone(false);
    setStatus([]);

    const text = await file.text();
    const rows = parseCSV(text);
    const results = [];
    let success = 0, failed = 0;

    for (const row of rows) {
      const { race, personality } = parseCombo(row.Combo);
      const name = row.Name?.trim();
      if (!name) continue;

      const record = {
        name, kd_code: kdCode, race, personality,
        acres: cleanNum(row.Acres)?.toString(),
        nw: cleanNum(row.NW)?.toString(),
        off: cleanNum(row.Off)?.toString(),
        def: cleanNum(row.Def)?.toString(),
        be: row.BE?.replace("%", "") || null,
        o_tpa: cleanNum(row.oTpa)?.toString(),
        d_tpa: cleanNum(row.dTpa)?.toString(),
        o_wpa: cleanNum(row.oWpa)?.toString(),
        d_wpa: cleanNum(row.dWpa)?.toString(),
        honor: cleanNum(row.Honor)?.toString(),
        good_spells: parseSpells(row.GoodSpells),
        updated_at: new Date().toISOString(),
      };

      Object.keys(record).forEach(k => record[k] === null && delete record[k]);

      const { error } = await supabase.from("provinces").upsert(record, { onConflict: "name" });

      if (error) {
        results.push({ name, ok: false, msg: error.message });
        failed++;
      } else {
        results.push({ name, ok: true, race, personality });
        success++;
      }
    }

    setStatus(results);
    setLoading(false);
    setDone(true);
  }

  return (
    <div className="intel-panel">
      <div className="panel">
        <h2 style={{ marginBottom: 16 }}>📥 CSV Import</h2>
        <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 16 }}>
          Export your kingdom from <strong>intel.utopia.site</strong> → CSV, then upload here to populate the dashboard.
        </p>

        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
          <div>
            <label style={{ color: "#94a3b8", fontSize: 12, display: "block", marginBottom: 4 }}>Kingdom Code</label>
            <input
              value={kdCode}
              onChange={e => setKdCode(e.target.value)}
              style={{
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 6, padding: "6px 12px", color: "#e2e8f0", fontSize: 13, width: 80,
              }}
            />
          </div>
          <div>
            <label style={{ color: "#94a3b8", fontSize: 12, display: "block", marginBottom: 4 }}>CSV File</label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFile}
              disabled={loading}
              style={{ color: "#e2e8f0", fontSize: 13 }}
            />
          </div>
        </div>

        {loading && (
          <div style={{ color: "#38bdf8", marginBottom: 16 }}>⏳ Importing...</div>
        )}

        {done && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: "#4ade80", fontWeight: 600, marginBottom: 8 }}>
              ✅ {status.filter(r => r.ok).length} imported · ❌ {status.filter(r => !r.ok).length} failed
            </div>
          </div>
        )}

        {status.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 400, overflowY: "auto" }}>
            {status.map((r, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between",
                padding: "6px 10px", borderRadius: 6,
                background: r.ok ? "rgba(74,222,128,0.05)" : "rgba(239,68,68,0.05)",
                border: `1px solid ${r.ok ? "rgba(74,222,128,0.15)" : "rgba(239,68,68,0.15)"}`,
              }}>
                <span style={{ color: r.ok ? "#4ade80" : "#ef4444", fontSize: 13 }}>
                  {r.ok ? "✅" : "❌"} {r.name}
                </span>
                <span style={{ color: "#475569", fontSize: 12 }}>
                  {r.ok ? `${r.race} ${r.personality}` : r.msg}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
