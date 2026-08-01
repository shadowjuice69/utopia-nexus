import { useState } from "react";
import "./App.css";
import Header from "./components/Header";
import WarRoom from "./components/WarRoom";
import IntelPanel from "./components/IntelPanel";
import WaveTracker from "./components/WaveTracker";
import AlertPanel from "./components/AlertPanel";
import KingdomOverview from "./components/KingdomOverview";
import AttackCalc from "./components/AttackCalc";
import BuildingIntel from "./components/BuildingIntel";
import ScienceIntel from "./components/ScienceIntel";
import OpsIntel from "./components/OpsIntel";
import AttackLog from "./components/AttackLog";
import ProvinceComparison from "./components/ProvinceComparison";
import SpellTracker from "./components/SpellTracker";
import CSVImport from "./components/CSVImport";
import NewsPanel from "./components/NewsPanel";
import AttackSummary from "./components/AttackSummary";
import EnemyIntel from "./components/EnemyIntel";
import Login from "./components/Login";

const NAV = [
  {
    group: "Attack",
    color: "#f87171",
    tabs: [
      { id: "attacks", label: "Attack Log" },
      { id: "attacks-summary", label: "Summary" },
      { id: "waves", label: "Waves" },
      { id: "calc", label: "Calculator" },
    ],
  },
  {
    group: "Ops",
    color: "#a78bfa",
    tabs: [
      { id: "ops", label: "Hostile Ops" },
      { id: "spells", label: "Spells" },
      { id: "alerts", label: "Alerts" },
    ],
  },
  {
    group: "Kingdom",
    color: "#38bdf8",
    tabs: [
      { id: "kingdom", label: "Overview" },
      { id: "war", label: "War Room" },
      { id: "news", label: "News" },
      { id: "import", label: "Import" },
    ],
  },
  {
    group: "Intel",
    color: "#4ade80",
    tabs: [
      { id: "intel", label: "Provinces" },
      { id: "enemy", label: "Enemy" },
      { id: "compare", label: "Compare" },
    ],
  },
  {
    group: "Province",
    color: "#fbbf24",
    tabs: [
      { id: "buildings", label: "Buildings" },
      { id: "science", label: "Science" },
    ],
  },
];

function App() {
  const [tab, setTab] = useState("kingdom");
  const [authed, setAuthed] = useState(localStorage.getItem("nexus_auth") === "true");

  if (!authed) return <Login onLogin={() => setAuthed(true)} />;

  const activeGroup = NAV.find(g => g.tabs.some(t => t.id === tab));

  return (
    <div className="nexus">
      <Header />
      <nav className="nav-groups">
        {NAV.map(group => (
          <div key={group.group} className={`nav-group ${activeGroup?.group === group.group ? "nav-group-active" : ""}`}>
            <div className="nav-group-label" style={{ color: group.color }}>
              {group.group}
            </div>
            <div className="nav-group-tabs">
              {group.tabs.map(t => (
                <button
                  key={t.id}
                  className={`tab-btn ${tab === t.id ? "active" : ""}`}
                  style={tab === t.id ? { borderColor: group.color, color: group.color, boxShadow: `0 0 12px ${group.color}33` } : {}}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <main className="dashboard-grid">
        {tab === "kingdom" && <KingdomOverview />}
        {tab === "war" && <WarRoom />}
        {tab === "intel" && <IntelPanel />}
        {tab === "waves" && <WaveTracker />}
        {tab === "alerts" && <AlertPanel />}
        {tab === "calc" && <AttackCalc />}
        {tab === "buildings" && <BuildingIntel />}
        {tab === "science" && <ScienceIntel />}
        {tab === "ops" && <OpsIntel />}
        {tab === "attacks" && <AttackLog />}
        {tab === "compare" && <ProvinceComparison />}
        {tab === "spells" && <SpellTracker />}
        {tab === "news" && <NewsPanel />}
        {tab === "attacks-summary" && <AttackSummary />}
        {tab === "enemy" && <EnemyIntel />}
        {tab === "import" && <CSVImport />}
      </main>
    </div>
  );
}

export default App;
