import { useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabase";

const TYPES = [
  ["war", "⚔️ War"],
  ["cf", "🕊️ CF"],
  ["pump", "📈 Pump"],
  ["recovery", "🛡️ Recovery"],
  ["defense", "🧱 Defense"],
  ["economy", "💰 Economy"],
  ["custom", "🔧 Custom"],
];

const EMPTY = {
  name: "",
  build_type: "war",
  province_id: null,
  description: "",
  race: "",
  personality: "",
  role: "general",
  raw_text: "",
  buildings: {},
  military: {},
  science: {},
  spells: {},
  thievery: {},
  priorities: [],
  notes: "",
  active: true,
  version: 1,
};

const SECTION_LABELS = {
  buildings: "Buildings",
  military: "Military Targets",
  science: "Science / Books",
  spells: "Spells",
  thievery: "Thievery",
  priorities: "Priorities",
};

function cleanKey(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function cleanLine(raw) {
  return raw
    .replace(/[*_`]/g, "")
    .replace(/^\s*[•·]\s*/, "")
    .trim();
}

function prettyName(key) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseBuild(text) {
  const out = {
    buildings: {},
    military: {},
    science: {},
    spells: {},
    thievery: {},
    priorities: [],
    warnings: [],
  };

  let section = "";
  const lines = text.split(/\r?\n/);

  lines.forEach((raw, index) => {
    const line = cleanLine(raw);
    if (!line) return;

    const upper = line.toUpperCase();

    // Savage headers / timestamps are context, not build data.
    if (/^(🏗|🎖|—)?\s*(HALFLING|BUILD|MILITARY|SCIENCE|SPELL|THIEV|PLAN)/i.test(line) && /SET BY|BUILD|MILITARY PLAN|SCIENCE ALLOCATION/i.test(line)) {
      if (upper.includes("BUILD")) section = "buildings";
      return;
    }
    if (upper.includes("ECONOMY SCIENCE")) { section = "science_economy"; return; }
    if (upper.includes("MILITARY SCIENCE")) { section = "science_military"; return; }
    if (upper.includes("ARCANE SCIENCE")) { section = "science_arcane"; return; }
    if (upper.includes("SCIENCE ALLOCATION")) { section = "science"; return; }

    // Building target: Homes — 15%
    let m = line.match(/^(.+?)\s*[—-]\s*(\d+(?:\.\d+)?)%\s*$/);
    if (m) {
      const key = cleanKey(m[1]);
      if (key && !/set_by|build|military|science|allocation/.test(key)) {
        out.buildings[key] = { value: Number(m[2]), metric: "%", kind: "target" };
        return;
      }
    }

    // Military targets, including 10+epa/dspa and "at least" language.
    m = line.match(/^(.+?)\s*[—-]\s*(\d+(?:\.\d+)?\+?)\s*(ppa|tpa|wpa|ospa|epa\/dspa)\b/i);
    if (m) {
      const label = m[1].trim();
      const key = cleanKey(label);
      out.military[key] = {
        value: Number(m[2].replace("+", "")),
        minimum: m[2].includes("+") || /at least|minimum|first|fill/i.test(label),
        metric: m[3].toLowerCase(),
        source: line,
      };
      return;
    }

    // Science allocation: 3x Alchemy / 10x Strategy
    m = line.match(/^(\d+)x\s+(.+)$/i);
    if (m && ["science", "science_economy", "science_military", "science_arcane"].includes(section)) {
      const key = cleanKey(m[2]);
      const category = section.replace("science_", "");
      out.science[key] = { books: Number(m[1]), category };
      return;
    }

    // Explicit "X books" form.
    m = line.match(/^(.+?)\s*[—-]\s*(\d+)\s*books?\b/i);
    if (m) {
      out.science[cleanKey(m[1])] = { books: Number(m[2]), category: section || "unknown" };
      return;
    }

    // Do not warn on known explanatory text / military labels that have already been consumed.
    if (/^(peasants|thieves|wizards|off specs|elites\/acre|this means how many books|economy science|military science|arcane science|science allocation)/i.test(line)) return;
    if (/^barren\s*[—-]\s*\d+%$/i.test(line)) {
      out.buildings.barren = { value: 0, metric: "%", kind: "target" };
      return;
    }

    // Ignore decorative headings, but flag actual content we don't understand.
    if (/^(🏗|🎖|—|SCIENCE|ECONOMY|MILITARY|ARCANE)/i.test(line)) return;
    out.warnings.push({ line: index + 1, text: line });
  });

  // Ratios are parsed separately so the exact Savage labels are retained.
  for (const x of text.matchAll(/^\s*(peasants|thieves|wizards|off specs|elites\/acre[^—-]*)\s*[—-]\s*([\d+.]+)\s*(ppa|tpa|wpa|ospa|epa\/dspa)\b.*$/gim)) {
    const label = x[1].trim();
    out.military[cleanKey(label)] = {
      value: Number(x[2]),
      metric: x[3].toLowerCase(),
      minimum: /at least|first/i.test(label),
      source: x[0].trim(),
    };
  }

  return out;
}

function typeLabel(type) {
  return TYPES.find(([value]) => value === type)?.[1] || type || "Custom";
}

function formatValue(value) {
  if (value && typeof value === "object") {
    if (value.metric === "%") return `${value.value}%`;
    if (value.books !== undefined) return `${value.books} books`;
    if (value.metric) return `${value.value}${value.metric}${value.minimum ? " minimum" : ""}`;
  }
  return String(value);
}

function PreviewSection({ title, data }) {
  const entries = Object.entries(data || {});
  return (
    <div style={{ border: "1px solid #334155", borderRadius: 8, padding: 10 }}>
      <div style={{ color: "#34d399", fontWeight: 700, marginBottom: 7 }}>{title}</div>
      {entries.length === 0 ? (
        <div style={{ color: "#64748b", fontSize: 12 }}>Nothing detected</div>
      ) : (
        entries.map(([key, value]) => (
          <div key={key} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "3px 0", fontSize: 12 }}>
            <span>{prettyName(key)}</span>
            <strong>{formatValue(value)}</strong>
          </div>
        ))
      )}
    </div>
  );
}

export default function AIBuildManager() {
  const [builds, setBuilds] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(EMPTY);
  const [raw, setRaw] = useState("");
  const [parsed, setParsed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("all");

  async function load() {
    setLoading(true);
    setError("");
    const { data, error: loadError } = await supabase
      .from("ai_builds")
      .select("*")
      .order("active", { ascending: false })
      .order("name");
    if (loadError) setError(loadError.message);
    else setBuilds(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const visibleBuilds = useMemo(
    () => filter === "all" ? builds : builds.filter((b) => b.build_type === filter),
    [builds, filter]
  );

  function select(build) {
    setSelectedId(build.id);
    setDraft({ ...EMPTY, ...build });
    setRaw(build.raw_text || "");
    setParsed(null);
    setError("");
    setNotice("");
  }

  function fresh() {
    setSelectedId(null);
    setDraft({ ...EMPTY });
    setRaw("");
    setParsed(null);
    setError("");
    setNotice("");
  }

  function parse() {
    if (!raw.trim()) {
      setError("Paste Savage's build first.");
      return null;
    }
    const result = parseBuild(raw);
    setParsed(result);
    setDraft((d) => ({ ...d, ...result, raw_text: raw }));
    setError("");
    setNotice(`Parsed ${Object.keys(result.buildings).length} buildings, ${Object.keys(result.military).length} military targets, and ${Object.keys(result.science).length} science allocations.`);
    return result;
  }

  async function save() {
    const p = parsed || parse();
    if (!p) return;

    setSaving(true);
    setError("");

    try {
      // If this is a new entry with the same name/type, treat it as a new version
      // instead of creating a duplicate build family.
      let targetId = selectedId;
      let current = selectedId ? builds.find((b) => b.id === selectedId) : null;

      if (!targetId && draft.name.trim()) {
        const { data: existing, error: lookupError } = await supabase
          .from("ai_builds")
          .select("*")
          .eq("name", draft.name.trim())
          .eq("build_type", draft.build_type)
          .order("version", { ascending: false })
          .limit(1);
        if (lookupError) throw lookupError;
        if (existing?.[0]) {
          targetId = existing[0].id;
          current = existing[0];
        }
      }

      const nextVersion = targetId ? (Number(current?.version || 1) + 1) : 1;
      const payload = {
        name: draft.name.trim() || "Savage Build",
        description: draft.description || "",
        race: draft.race || null,
        personality: draft.personality || null,
        role: draft.role || "general",
        buildings: p.buildings,
        military: p.military,
        science: p.science,
        spells: p.spells || {},
        thievery: p.thievery || {},
        priorities: p.priorities || [],
        notes: p.warnings?.length ? `Unparsed lines: ${p.warnings.length}` : "",
        active: true,
        version: nextVersion,
        build_type: draft.build_type,
        province_id: draft.province_id || null,
        raw_text: raw,
      };

      if (targetId) {
        // Preserve the exact previous state before replacing the active version.
        const { error: versionError } = await supabase.from("ai_build_versions").insert({
          build_id: targetId,
          version: nextVersion,
          snapshot: { ...current },
        });
        if (versionError) throw versionError;

        const { data, error: updateError } = await supabase
          .from("ai_builds")
          .update(payload)
          .eq("id", targetId)
          .select()
          .single();
        if (updateError) throw updateError;
        setBuilds((items) => items.map((b) => b.id === data.id ? data : b));
        select(data);
        setNotice(`Saved ${data.name} — ${typeLabel(data.build_type)} — v${data.version}`);
      } else {
        const { data, error: insertError } = await supabase
          .from("ai_builds")
          .insert(payload)
          .select()
          .single();
        if (insertError) throw insertError;
        setBuilds((items) => [data, ...items]);
        select(data);
        setNotice(`Created ${data.name} — ${typeLabel(data.build_type)} — v1`);
      }
    } catch (e) {
      setError(e?.message || "Could not save the build.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    if (!selectedId) return;
    const { data, error: updateError } = await supabase
      .from("ai_builds")
      .update({ active: !draft.active })
      .eq("id", selectedId)
      .select()
      .single();
    if (updateError) setError(updateError.message);
    else {
      setBuilds((items) => items.map((b) => b.id === data.id ? data : b));
      select(data);
      setNotice(data.active ? "Build activated for AI reference." : "Build disabled for AI reference.");
    }
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 14, color: "#e2e8f0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, color: "#34d399" }}>🧠 Savage Build Library</h2>
          <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 3 }}>Paste the build exactly as Savage sends it. No JSON needed.</div>
        </div>
        <button onClick={fresh}>＋ Add Build</button>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        <button onClick={() => setFilter("all")} style={{ fontWeight: filter === "all" ? 700 : 400 }}>All</button>
        {TYPES.map(([value, label]) => (
          <button key={value} onClick={() => setFilter(value)} style={{ fontWeight: filter === value ? 700 : 400 }}>{label}</button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(230px,.65fr) minmax(350px,1.35fr)", gap: 14 }}>
        <section className="panel">
          <div className="panel-header"><h3>Saved Builds</h3><button onClick={load}>Refresh</button></div>
          {loading ? <div>Loading...</div> : visibleBuilds.length ? visibleBuilds.map((b) => (
            <button key={b.id} onClick={() => select(b)} style={{ display: "block", width: "100%", textAlign: "left", padding: 10, marginBottom: 7, borderRadius: 7, border: selectedId === b.id ? "1px solid #34d399" : "1px solid #334155", background: "#111827", color: "inherit" }}>
              <b>{b.name || "Unnamed"}</b><br />
              <small>{typeLabel(b.build_type)} · v{b.version || 1} · {b.active ? "🟢 Active" : "⚪ Inactive"}</small>
            </button>
          )) : <div style={{ color: "#64748b" }}>No builds yet. Add Savage's first build.</div>}
        </section>

        <section className="panel">
          <div className="panel-header"><h3>{selectedId ? `Update Build · v${draft.version || 1}` : "New Build"}</h3></div>

          {error && <div style={{ border: "1px solid #ef4444", padding: 9, marginBottom: 9, borderRadius: 6 }}>{error}</div>}
          {notice && <div style={{ border: "1px solid #34d399", padding: 9, marginBottom: 9, borderRadius: 6 }}>{notice}</div>}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
            <label>Build Name<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Example: Halfling Heretic" /></label>
            <label>Build Type<select value={draft.build_type} onChange={(e) => setDraft({ ...draft, build_type: e.target.value })}>{TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          </div>

          <label style={{ display: "block", marginTop: 10 }}>Paste Savage's Complete Build<textarea value={raw} onChange={(e) => { setRaw(e.target.value); setParsed(null); }} rows={18} placeholder="Paste the complete build exactly as Savage sent it..." /></label>

          <div style={{ display: "flex", gap: 8, margin: "9px 0", flexWrap: "wrap" }}>
            <button onClick={parse}>🔍 Parse Build</button>
            <button disabled={saving} onClick={save}>{saving ? "Saving..." : selectedId ? "💾 Save New Version" : "💾 Save Build"}</button>
            {selectedId && <button onClick={toggleActive}>{draft.active ? "Disable" : "Activate"}</button>}
          </div>

          {parsed && (
            <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: 10 }}>
              <b>✅ Human-Readable Preview</b>
              <div style={{ marginTop: 9, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <PreviewSection title={SECTION_LABELS.buildings} data={parsed.buildings} />
                <PreviewSection title={SECTION_LABELS.military} data={parsed.military} />
                <PreviewSection title={SECTION_LABELS.science} data={parsed.science} />
              </div>

              {parsed.warnings?.length > 0 && (
                <div style={{ marginTop: 10, border: "1px solid #a16207", borderRadius: 8, padding: 10 }}>
                  <b>⚠️ Lines to review ({parsed.warnings.length})</b>
                  <div style={{ marginTop: 5, fontSize: 12 }}>{parsed.warnings.map((w) => <div key={`${w.line}-${w.text}`}>Line {w.line}: {w.text}</div>)}</div>
                </div>
              )}
            </div>
          )}

          {selectedId && <div style={{ marginTop: 10, color: "#64748b", fontSize: 11 }}>Saving an update creates a new version and preserves the previous version in history.</div>}
        </section>
      </div>
    </div>
  );
}
