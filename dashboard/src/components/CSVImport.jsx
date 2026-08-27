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

const PAGE_TYPES = [
  { value: "throne", label: "👑 Throne" },
  { value: "som", label: "⚔️ Military (SOM)" },
  { value: "survey", label: "🏗️ Survey / Buildings" },
  { value: "science", label: "🔬 Science" },
  { value: "kingdom_details", label: "🏰 Kingdom" },
  { value: "province_news", label: "📰 Province News" },
  { value: "province_logs", label: "📋 Province Logs" },
  { value: "kd_news", label: "🌍 KD News" },
];

const INTEL_ENDPOINT = "https://utopia-nexus-production.up.railway.app/intel";
const INTEL_KEY = "NikkoAce";

export default function CSVImport() {
  const [status, setStatus] = useState([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [kdCode, setKdCode] = useState("6:9");

  // Paste Intel state
  const [pasteProvince, setPasteProvince] = useState("");
  const [pasteType, setPasteType] = useState("throne");
  const [pasteText, setPasteText] = useState("");
  const [pasteStatus, setPasteStatus] = useState(null);
  const [pasteSending, setPasteSending] = useState(false);
  const [autoDetected, setAutoDetected] = useState(false);

  function detectProvinceName(text) {
    // "The Province of NAME (kd)" pattern
    const m = text.match(/The Province of ([^\n(]+?)\s*\(\d+:\d+\)/);
    if (m) return m[1].trim();
    return null;
  }

  function handlePasteTextChange(e) {
    const text = e.target.value;
    setPasteText(text);
    const detected = detectProvinceName(text);
    if (detected) {
      setPasteProvince(detected);
      setAutoDetected(true);
    } else {
      setAutoDetected(false);
    }
  }

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

  async function handlePasteSubmit() {
    const kdNewsTypes = ["kd_news", "province_news"];
    if (!pasteProvince.trim() && !kdNewsTypes.includes(pasteType)) {
      setPasteStatus({ ok: false, msg: "Province name is required." });
      return;
    }
    if (!pasteText.trim()) {
      setPasteStatus({ ok: false, msg: "Paste the page text first." });
      return;
    }

    setPasteSending(true);
    setPasteStatus(null);

    // Build a fake URL so intelReceiver detects the right type
    const fakeUrl = `https://utopia-game.com/${pasteType}`;

    const body = new URLSearchParams({
      key: INTEL_KEY,
      prov: pasteProvince.trim(),
      url: fakeUrl,
      data_simple: pasteText.trim(),
    });

    try {
      const res = await fetch(INTEL_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      if (res.ok) {
        setPasteStatus({ ok: true, msg: `✅ Intel saved for "${pasteProvince}" (${pasteType})` });
        setPasteText("");
      } else {
        const txt = await res.text();
        setPasteStatus({ ok: false, msg: `❌ Server error ${res.status}: ${txt}` });
      }
    } catch (e) {
      setPasteStatus({ ok: false, msg: `❌ Request failed: ${e.message}` });
    }

    setPasteSending(false);
  }

  const divider = {
    borderTop: "1px solid rgba(255,255,255,0.08)",
    margin: "32px 0",
  };

  const inputStyle = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 6,
    padding: "6px 12px",
    color: "#e2e8f0",
    fontSize: 13,
  };

  return (
    <div className="intel-panel">
      <div className="panel">

        {/* ── CSV Import ── */}
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
              style={{ ...inputStyle, width: 80 }}
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
            <div style={{ maxHeight: 200, overflowY: "auto", fontSize: 12 }}>
              {status.map((r, i) => (
                <div key={i} style={{ color: r.ok ? "#4ade80" : "#f87171", padding: "2px 0" }}>
                  {r.ok ? `✓ ${r.name} (${r.race} ${r.personality})` : `✗ ${r.name}: ${r.msg}`}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Divider ── */}
        <div style={divider} />

        {/* ── Paste Intel ── */}
        <h2 style={{ marginBottom: 8 }}>📋 Paste Intel</h2>
        <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 16 }}>
          On mobile: open a province's Throne / SOM / Survey / Science page in-game, select all text, copy, and paste below.
        </p>

        <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
          <div>
            <label style={{ color: "#94a3b8", fontSize: 12, display: "block", marginBottom: 4 }}>Province Name</label>
            <input
              value={pasteProvince}
              onChange={e => setPasteProvince(e.target.value)}
              placeholder="Auto-detected from text"
              style={{ ...inputStyle, width: 180, borderColor: autoDetected ? "#4ade80" : undefined }}
            />
            {autoDetected && (
              <div style={{ color: "#4ade80", fontSize: 11, marginTop: 3 }}>✓ auto-detected</div>
            )}
          </div>
          <div>
            <label style={{ color: "#94a3b8", fontSize: 12, display: "block", marginBottom: 4 }}>Page Type</label>
            <select
              value={pasteType}
              onChange={e => setPasteType(e.target.value)}
              style={{ ...inputStyle, width: 180 }}
            >
              {PAGE_TYPES.map(pt => (
                <option key={pt.value} value={pt.value}>{pt.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ color: "#94a3b8", fontSize: 12, display: "block", marginBottom: 4 }}>
            Page Text <span style={{ color: "#475569" }}>(paste full page content)</span>
          </label>
          <textarea
            value={pasteText}
            onChange={handlePasteTextChange}
            placeholder="Select all & copy from the Utopia game page, then paste here..."
            rows={10}
            style={{
              ...inputStyle,
              width: "100%",
              resize: "vertical",
              fontFamily: "monospace",
              fontSize: 11,
              lineHeight: 1.5,
            }}
          />
        </div>

        <button
          onClick={handlePasteSubmit}
          disabled={pasteSending}
          style={{
            background: pasteSending ? "#334155" : "#1d4ed8",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "8px 20px",
            fontSize: 14,
            cursor: pasteSending ? "not-allowed" : "pointer",
            fontWeight: 600,
            transition: "background 0.2s",
          }}
        >
          {pasteSending ? "⏳ Sending..." : "📡 Send Intel"}
        </button>

        {pasteStatus && (
          <div style={{
            marginTop: 12,
            padding: "8px 14px",
            borderRadius: 6,
            fontSize: 13,
            background: pasteStatus.ok ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)",
            border: `1px solid ${pasteStatus.ok ? "#4ade80" : "#f87171"}`,
            color: pasteStatus.ok ? "#4ade80" : "#f87171",
          }}>
            {pasteStatus.msg}
          </div>
        )}

      </div>
    </div>
  );
}
