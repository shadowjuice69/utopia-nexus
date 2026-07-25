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
import Login from "./components/Login";

const TABS = [
  { id: "kingdom", label: "🏰 Kingdom" },
  { id: "war", label: "⚔️ War Room" },
  { id: "intel", label: "🔍 Intel" },
  { id: "waves", label: "🌊 Waves" },
  { id: "alerts", label: "🔔 Alerts" },
  { id: "calc", label: "🧮 Calculator" },
  { id: "buildings", label: "🏗️ Buildings" },
  { id: "science", label: "🔬 Science" },
  { id: "ops", label: "🗡️ Ops" },
];

function App() {
  const [tab, setTab] = useState("kingdom");
  const [authed, setAuthed] = useState(localStorage.getItem("nexus_auth") === "true");

  if (!authed) return <Login onLogin={() => setAuthed(true)} />;

  return (
    <div className="nexus">
      <Header />
      <nav className="tab-bar">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`tab-btn ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
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
      </main>
    </div>
  );
}

export default App;
