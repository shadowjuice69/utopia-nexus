import { useState, useEffect } from "react";
import "./App.css";
import { loadNexusConfig, getKingdomLabel } from "./services/nexusConfig";
import { getDashboardRegistration } from "./services/auth";
import { getTickState } from "./services/tick";

// ── Components ──────────────────────────────────────────────────────────────
import KingdomOverview from "./components/KingdomOverview";
import NewsPanel from "./components/NewsPanel";
import BuildingIntel from "./components/BuildingIntel";
import ScienceIntel from "./components/ScienceIntel";
import ScienceCalculator from './components/ScienceCalculator';
import MembersPanel from "./components/MembersPanel";
import WarRoom from "./components/WarRoom";
import WaveTracker from "./components/WaveTracker";
import AttackLog from "./components/AttackLog";
import AttackSummary from "./components/AttackSummary";
import EnemyKingdoms from "./components/EnemyKingdoms";
import IntelQueue from "./components/IntelQueue";
import OpsIntel from "./components/OpsIntel";
import SpellTracker from "./components/SpellTracker";
import Intel7 from "./components/Intel7";
import AlertPanel from "./components/AlertPanel";
import AttackCalc from "./components/AttackCalc";
import AIWarReport from "./components/AIWarReport";
import AITargets from "./components/AITargets";
import AIAssistant from "./components/AIAssistant";
import AdvisorLog from "./components/AdvisorLog";
import AIBuildManager from "./components/AIBuildManager";
import RepoTools from "./components/RepoTools";
import Login from "./components/Login";

const GROUPS = [
  { id: "kingdom", label: "KINGDOM", color: "#fbbf24", tabs: [
    { id: "overview", label: "Overview", component: KingdomOverview },
    { id: "news", label: "News", component: NewsPanel },
    { id: "buildings", label: "Buildings", component: BuildingIntel },
    { id: "science", label: "Science", component: ScienceIntel },
  { id: "science-calc", label: 'Sci Calc', component: ScienceCalculator },
    { id: "members", label: "Members", component: MembersPanel },
  ] },
  { id: "war", label: "WAR", color: "#f87171", tabs: [
    { id: "warroom", label: "War Room", component: WarRoom },
    { id: "waves", label: "Waves", component: WaveTracker },
    { id: "attacks", label: "Attack Log", component: AttackLog },
    { id: "summary", label: "Summary", component: AttackSummary },
    { id: "enemies", label: "Enemy Kingdoms", component: EnemyKingdoms },
    { id: "queue", label: "Intel Queue", component: IntelQueue },
  ] },
  { id: "ops", label: "OPS", color: "#a78bfa", tabs: [
    { id: "intel7", label: "Intel 7", component: Intel7 },
    { id: "hostileops", label: "Hostile Ops", component: OpsIntel },
    { id: "spells", label: "Spells", component: SpellTracker },
    { id: "alerts", label: "Alerts", component: AlertPanel },
    { id: "calc", label: "Calculator", component: AttackCalc },
  ] },
  { id: "ai", label: "AI", color: "#34d399", tabs: [
    { id: "warreport", label: "War Report", component: AIWarReport },
    { id: "targets", label: "Targets", component: AITargets },
    { id: "ask", label: "Ask", component: AIAssistant },
    { id: "advisorlog", label: "Advisor Log", component: AdvisorLog },
    { id: "builds", label: "Reference Builds", component: AIBuildManager },
  ] },
  { id: "tools", label: "TOOLS", color: "#60a5fa", tabs: [
    { id: "repo-tools", label: "Repo Toolkit", component: RepoTools },
  ] },
];

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [activeGroup, setActiveGroup] = useState("kingdom");
  const [activeTab, setActiveTab] = useState("overview");
  const [tick, setTick] = useState(null);
  const [configReady, setConfigReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function restoreAuthorization() {
      const saved = sessionStorage.getItem("nexus_auth") === "true";
      if (!saved) {
        if (!cancelled) setAuthReady(true);
        return;
      }
      const registration = await getDashboardRegistration();
      const allowed = registration.registered || registration.owner;
      if (!cancelled) {
        if (allowed) setAuthed(true);
        else sessionStorage.removeItem("nexus_auth");
        setAuthReady(true);
      }
    }
    restoreAuthorization().catch(() => {
      if (!cancelled) {
        sessionStorage.removeItem("nexus_auth");
        sessionStorage.removeItem("nexus_province");
        setAuthReady(true);
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!authed) return undefined;
    let cancelled = false;
    loadNexusConfig().finally(() => {
      if (!cancelled) setConfigReady(true);
    });
    return () => { cancelled = true; };
  }, [authed]);

  useEffect(() => {
    function calcTick() { setTick(getTickState()); }
    calcTick();
    const iv = setInterval(calcTick, 1000);
    return () => clearInterval(iv);
  }, []);

  if (!authReady) return <div className="loading">Checking Nexus authorization...</div>;
  if (!authed) return <Login onAuth={(result) => {
    sessionStorage.setItem("nexus_auth", "true");
    if (result?.province?.name) sessionStorage.setItem("nexus_province", result.province.name);
    setAuthed(true);
  }} />;
  if (!configReady) return <div className="loading">Loading current kingdom context...</div>;

  const currentGroup = GROUPS.find(g => g.id === activeGroup);
  const currentTab = currentGroup?.tabs.find(t => t.id === activeTab);
  const TabComponent = currentTab?.component;

  function switchGroup(gid) {
    setActiveGroup(gid);
    const grp = GROUPS.find(g => g.id === gid);
    if (grp) setActiveTab(grp.tabs[0].id);
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <span className="header-logo">⚔</span>
          <div>
            <div className="header-title">NEXUS</div>
            <div className="header-sub">{getKingdomLabel()}</div>
          </div>
        </div>
        <div className="header-tick">
          {tick && <>
            <span className="tick-label">TICK</span>
            <span className="tick-num">{tick.current}</span>
            <span className="tick-time">{String(tick.minLeft).padStart(2, "0")}:{String(tick.secLeft).padStart(2, "0")}</span>
          </>}
        </div>
      </header>
      <nav className="group-nav">
        {GROUPS.map(g => (
          <button key={g.id} className={`group-btn ${activeGroup === g.id ? "group-btn-active" : ""}`} style={activeGroup === g.id ? { borderColor: g.color, color: g.color } : {}} onClick={() => switchGroup(g.id)}>{g.label}</button>
        ))}
      </nav>
      <nav className="tab-nav">
        {currentGroup?.tabs.map(t => (
          <button key={t.id} className={`tab-btn ${activeTab === t.id ? "tab-btn-active" : ""}`} style={activeTab === t.id ? { color: currentGroup.color, borderBottomColor: currentGroup.color } : {}} onClick={() => setActiveTab(t.id)}>{t.label}</button>
        ))}
      </nav>
      <main className="content">{TabComponent && <TabComponent />}</main>
    </div>
  );
}
