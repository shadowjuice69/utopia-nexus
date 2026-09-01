import { useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabase";

const EMPTY_BUILD = {
  name: "New Build",
  description: "",
  race: "",
  personality: "",
  role: "general",
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

function prettyJson(value) {
  return JSON.stringify(value ?? {}, null, 2);
}

function parseJson(text, fallback) {
  try { return JSON.parse(text); } catch { return fallback; }
}

export default function AIBuildManager() {
  const [builds, setBuilds] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(EMPTY_BUILD);
  const [jsonText, setJsonText] = useState({ buildings: "{}", military: "{}", science: "{}", spells: "{}", thievery: "{}", priorities: "[]" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selected = useMemo(() => builds.find((b) => b.id === selectedId) || null, [builds, selectedId]);

  async function loadBuilds() {
    setLoading(true);
    setError("");
    const { data, error: loadError } = await supabase.from("ai_builds").select("*").order("active", { ascending: false }).order("name");
    if (loadError) setError(loadError.message);
    else {
      setBuilds(data || []);
      if (!selectedId && data?.length) selectBuild(data[0]);
    }
    setLoading(false);
  }

  useEffect(() => { loadBuilds(); }, []);

  function selectBuild(build) {
    setSelectedId(build.id);
    setDraft({ ...EMPTY_BUILD, ...build });
    setJsonText({
      buildings: prettyJson(build.buildings), military: prettyJson(build.military), science: prettyJson(build.science),
      spells: prettyJson(build.spells), thievery: prettyJson(build.thievery), priorities: prettyJson(build.priorities),
    });
    setNotice("");
    setError("");
  }

  function updateField(field, value) { setDraft((d) => ({ ...d, [field]: value })); }

  function newBuild() {
    setSelectedId(null);
    setDraft({ ...EMPTY_BUILD, name: "New Savage Build" });
    setJsonText({ buildings: "{}", military: "{}", science: "{}", spells: "{}", thievery: "{}", priorities: "[]" });
    setNotice("");
    setError("");
  }

  async function saveBuild() {
    setSaving(true); setError(""); setNotice("");
    const parsed = {
      buildings: parseJson(jsonText.buildings, null), military: parseJson(jsonText.military, null), science: parseJson(jsonText.science, null),
      spells: parseJson(jsonText.spells, null), thievery: parseJson(jsonText.thievery, null), priorities: parseJson(jsonText.priorities, null),
    };
    for (const [key, value] of Object.entries(parsed)) {
      if (value === null) { setSaving(false); setError(`${key} contains invalid JSON.`); return; }
    }
    const payload = { ...draft, ...parsed, version: Number(draft.version) || 1 };
    delete payload.id; delete payload.created_at; delete payload.updated_at;

    if (selectedId) {
      const current = builds.find((b) => b.id === selectedId);
      const nextVersion = (Number(current?.version) || 1) + 1;
      const { error: versionError } = await supabase.from("ai_build_versions").insert({
        build_id: selectedId,
        version: nextVersion,
        snapshot: { ...current, saved_as_version: nextVersion },
      });
      if (versionError) { setSaving(false); setError(`Could not save version history: ${versionError.message}`); return; }
      payload.version = nextVersion;
      const { data, error: updateError } = await supabase.from("ai_builds").update(payload).eq("id", selectedId).select().single();
      if (updateError) setError(updateError.message);
      else { setBuilds((items) => items.map((b) => b.id === data.id ? data : b)); selectBuild(data); setNotice(`Saved ${data.name} v${data.version}`); }
    } else {
      const { data, error: insertError } = await supabase.from("ai_builds").insert(payload).select().single();
      if (insertError) setError(insertError.message);
      else { setBuilds((items) => [...items, data].sort((a,b) => Number(b.active)-Number(a.active) || a.name.localeCompare(b.name))); selectBuild(data); setNotice(`Created ${data.name}`); }
    }
    setSaving(false);
  }

  async function toggleActive() {
    if (!selectedId) return;
    const { data, error: updateError } = await supabase.from("ai_builds").update({ active: !draft.active }).eq("id", selectedId).select().single();
    if (updateError) setError(updateError.message);
    else { setBuilds((items) => items.map((b) => b.id === data.id ? data : b)); selectBuild(data); }
  }

  async function archiveBuild() {
    if (!selectedId) return;
    const { data, error: updateError } = await supabase.from("ai_builds").update({ active: false }).eq("id", selectedId).select().single();
    if (updateError) setError(updateError.message);
    else { setBuilds((items) => items.map((b) => b.id === data.id ? data : b)); selectBuild(data); setNotice("Build archived; AI will no longer use it as an active reference."); }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 0.7fr) minmax(0, 2fr)", gap: 16 }}>
      <section className="panel">
        <div className="panel-header"><h2>AI Reference Builds</h2><button onClick={newBuild}>+ Add</button></div>
        {loading ? <div className="loading">Loading builds...</div> : builds.length === 0 ? <div className="muted">No reference builds yet. Add Savage's first build.</div> : builds.map((b) => (
          <button key={b.id} onClick={() => selectBuild(b)} style={{ width: "100%", textAlign: "left", padding: 12, marginBottom: 8, borderRadius: 8, border: b.id === selectedId ? "1px solid #34d399" : "1px solid #334155", background: b.id === selectedId ? "#132b26" : "#111827", color: "inherit" }}>
            <strong>{b.name}</strong><br /><small>{b.role} · v{b.version} · {b.active ? "ACTIVE" : "ARCHIVED"}</small>
          </button>
        ))}
      </section>

      <section className="panel">
        <div className="panel-header"><h2>{selectedId ? "Edit Reference Build" : "New Reference Build"}</h2></div>
        {error && <div style={{ padding: 10, marginBottom: 10, border: "1px solid #ef4444", borderRadius: 8 }}>{error}</div>}
        {notice && <div style={{ padding: 10, marginBottom: 10, border: "1px solid #34d399", borderRadius: 8 }}>{notice}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label>Name<input value={draft.name} onChange={(e) => updateField("name", e.target.value)} /></label>
          <label>Role<input value={draft.role} onChange={(e) => updateField("role", e.target.value)} placeholder="defense / offense / economy / hybrid" /></label>
          <label>Race<input value={draft.race || ""} onChange={(e) => updateField("race", e.target.value)} /></label>
          <label>Personality<input value={draft.personality || ""} onChange={(e) => updateField("personality", e.target.value)} /></label>
        </div>
        <label>Description<textarea value={draft.description} onChange={(e) => updateField("description", e.target.value)} rows={2} /></label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {Object.keys(jsonText).map((key) => <label key={key}>{key}<textarea value={jsonText[key]} onChange={(e) => setJsonText((j) => ({ ...j, [key]: e.target.value }))} rows={key === "priorities" ? 4 : 6} spellCheck="false" /></label>)}
        </div>
        <label>Notes<textarea value={draft.notes} onChange={(e) => updateField("notes", e.target.value)} rows={5} placeholder="Savage's strategy notes, exceptions, conditions, etc." /></label>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}><input type="checkbox" checked={!!draft.active} onChange={(e) => updateField("active", e.target.checked)} /> Active reference for AI</label>
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button disabled={saving} onClick={saveBuild}>{saving ? "Saving..." : "Save Build"}</button>
          {selectedId && <button onClick={toggleActive}>{draft.active ? "Disable Reference" : "Enable Reference"}</button>}
          {selectedId && draft.active && <button onClick={archiveBuild}>Archive</button>}
        </div>
        {selected && <div className="muted" style={{ marginTop: 12 }}>Version {selected.version}. Saving changes creates a version-history snapshot first.</div>}
      </section>
    </div>
  );
}
