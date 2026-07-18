import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

const TICK_START_UTC = 19;

const TIMEZONE_OFFSETS = {
  "UTC": 0, "GMT": 0, "EST": -5, "EDT": -4, "CST": -6, "CDT": -5,
  "MST": -7, "MDT": -6, "PST": -8, "PDT": -7,
  "UTC+1": 1, "UTC+2": 2, "UTC+3": 3, "UTC+4": 4, "UTC+5": 5,
  "UTC+6": 6, "UTC+7": 7, "UTC+8": 8, "UTC+9": 9, "UTC+10": 10,
  "CET": 1, "EET": 2, "IST": 5.5, "JST": 9, "AEST": 10
};

function getCurrentTick() {
  const now = new Date();
  return ((now.getUTCHours() - TICK_START_UTC) % 24 + 24) % 24 + 1;
}

function tickToUTCHour(tick) {
  return ((TICK_START_UTC + tick - 1) % 24);
}

function formatUTCHour(h) {
  return `${h.toString().padStart(2, "0")}:00`;
}

function parseTimeToHour(str) {
  str = str.trim().toLowerCase();
  const ampm = str.match(/(\d+)(?::(\d+))?\s*(am|pm)/);
  if (ampm) {
    let h = parseInt(ampm[1]);
    if (ampm[3] === "pm" && h !== 12) h += 12;
    if (ampm[3] === "am" && h === 12) h = 0;
    return h;
  }
  const plain = str.match(/(\d+)/);
  return plain ? parseInt(plain[1]) : null;
}

function localHourToTick(localHour, offset) {
  const utcHour = ((localHour - offset) % 24 + 24) % 24;
  return ((utcHour - TICK_START_UTC) % 24 + 24) % 24 + 1;
}

function getMemberTicks(province) {
  const offset = TIMEZONE_OFFSETS[province.timezone?.trim().toUpperCase()] ?? 0;
  const ticks = new Set();
  const ranges = (province.wave_times || "").split(",");
  for (const range of ranges) {
    const parts = range.trim().split("-");
    if (parts.length < 2) continue;
    const startHour = parseTimeToHour(parts[0]);
    const endHour = parseTimeToHour(parts[1]);
    if (startHour === null || endHour === null) continue;
    const startTick = localHourToTick(startHour, offset);
    const endTick = localHourToTick(endHour, offset);
    let t = startTick;
    let iter = 0;
    while (t !== endTick && iter < 24) {
      ticks.add(t);
      t = (t % 24) + 1;
      iter++;
    }
  }
  return ticks;
}

function roleColor(role) {
  if (!role) return "#94a3b8";
  const r = role.toLowerCase();
  if (r.includes("attack")) return "#38bdf8";
  if (r.includes("mage") || r.includes("hybrid")) return "#a78bfa";
  if (r.includes("thief")) return "#facc15";
  return "#94a3b8";
}

function roleEmoji(role) {
  if (!role) return "👤";
  const r = role.toLowerCase();
  if (r.includes("attack")) return "⚔️";
  if (r.includes("mage") || r.includes("hybrid")) return "🔮";
  if (r.includes("thief")) return "🗡️";
  return "👤";
}

export default function WaveTracker() {
  const [members, setMembers] = useState([]);
  const [currentTick, setCurrentTick] = useState(getCurrentTick());
  const [viewTick, setViewTick] = useState(getCurrentTick());
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    fetchMembers();
    const tickInterval = setInterval(() => {
      setCurrentTick(getCurrentTick());
      setNow(new Date());
    }, 10000);
    return () => clearInterval(tickInterval);
  }, []);

  async function fetchMembers() {
    const { data } = await supabase
      .from("provinces")
      .select("name, play_role, timezone, wave_times, race, combo")
      .not("wave_times", "is", null)
      .not("timezone", "is", null);
    setMembers(data || []);
    setLoading(false);
  }

  const availableAtTick = (tick) =>
    members.filter(m => getMemberTicks(m).has(tick));

  const currentAvailable = availableAtTick(viewTick);
  const attackers = currentAvailable.filter(m => m.play_role?.toLowerCase().includes("attack"));
  const mages = currentAvailable.filter(m => m.play_role?.toLowerCase().includes("mage") || m.play_role?.toLowerCase().includes("hybrid"));
  const thieves = currentAvailable.filter(m => m.play_role?.toLowerCase().includes("thief"));

  const minsLeft = 60 - now.getUTCMinutes();
  const utcHour = tickToUTCHour(currentTick);

  if (loading) return <div className="loading">⏳ Loading Waves...</div>;

  return (
    <div className="wave-panel">

      {/* Current Tick Card */}
      <div className="tick-card">
        <div className="tick-info">
          <div>
            <div className="tick-label">CURRENT TICK</div>
            <div className="tick-number">{currentTick}</div>
          </div>
          <div>
            <div className="tick-label">UTC TIME</div>
            <div className="tick-number">{formatUTCHour(utcHour)}</div>
          </div>
          <div>
            <div className="tick-label">NEXT TICK IN</div>
            <div className="tick-number" style={{ color: minsLeft <= 10 ? "#f87171" : "#4ade80" }}>
              {minsLeft}m
            </div>
          </div>
          <div>
            <div className="tick-label">AVAILABLE</div>
            <div className="tick-number" style={{ color: "#38bdf8" }}>{availableAtTick(currentTick).length}</div>
          </div>
        </div>
      </div>

      {/* Tick Selector */}
      <div className="panel">
        <h2>🌊 Wave Schedule — Tick {viewTick} ({formatUTCHour(tickToUTCHour(viewTick))} UTC)</h2>
        
        {/* Tick Grid */}
        <div className="tick-grid">
          {Array.from({ length: 24 }, (_, i) => i + 1).map(tick => {
            const avail = availableAtTick(tick).length;
            const isCurrent = tick === currentTick;
            const isView = tick === viewTick;
            return (
              <div
                key={tick}
                className={`tick-cell ${isCurrent ? "current" : ""} ${isView ? "viewing" : ""} ${avail > 0 ? "has-members" : ""}`}
                onClick={() => setViewTick(tick)}
              >
                <div className="tick-cell-num">{tick}</div>
                <div className="tick-cell-utc">{formatUTCHour(tickToUTCHour(tick))}</div>
                <div className="tick-cell-count">{avail > 0 ? avail : ""}</div>
              </div>
            );
          })}
        </div>

        {/* Available Members at Selected Tick */}
        <div className="wave-available">
          {currentAvailable.length === 0 ? (
            <p className="empty">😴 No members available at tick {viewTick}</p>
          ) : (
            <div className="wave-groups">
              {attackers.length > 0 && (
                <div className="wave-group">
                  <div className="wave-group-label">⚔️ Attackers ({attackers.length})</div>
                  <div className="wave-members">
                    {attackers.map(m => (
                      <div key={m.name} className="wave-member" style={{ borderColor: "#38bdf8" }}>
                        <span className="wm-name">{m.name}</span>
                        <span className="wm-combo">{m.combo || m.race || "?"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {mages.length > 0 && (
                <div className="wave-group">
                  <div className="wave-group-label">🔮 Mages ({mages.length})</div>
                  <div className="wave-members">
                    {mages.map(m => (
                      <div key={m.name} className="wave-member" style={{ borderColor: "#a78bfa" }}>
                        <span className="wm-name">{m.name}</span>
                        <span className="wm-combo">{m.combo || m.race || "?"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {thieves.length > 0 && (
                <div className="wave-group">
                  <div className="wave-group-label">🗡️ Thieves ({thieves.length})</div>
                  <div className="wave-members">
                    {thieves.map(m => (
                      <div key={m.name} className="wave-member" style={{ borderColor: "#facc15" }}>
                        <span className="wm-name">{m.name}</span>
                        <span className="wm-combo">{m.combo || m.race || "?"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Member Schedules */}
      <div className="panel">
        <h2>👥 Member Availability ({members.length} registered)</h2>
        {members.length === 0 ? (
          <p className="empty">No members have registered wave times yet.</p>
        ) : (
          <div className="member-schedule-list">
            {members.map(m => {
              const ticks = getMemberTicks(m);
              return (
                <div key={m.name} className="member-schedule-row">
                  <div className="ms-header">
                    <span className="ms-name">{roleEmoji(m.play_role)} {m.name}</span>
                    <span className="ms-role" style={{ color: roleColor(m.play_role) }}>{m.play_role}</span>
                    <span className="ms-tz">{m.timezone}</span>
                    <span className="ms-ticks">{ticks.size} ticks/day</span>
                  </div>
                  <div className="ms-tick-bar">
                    {Array.from({ length: 24 }, (_, i) => i + 1).map(tick => (
                      <div
                        key={tick}
                        className={`ms-tick ${ticks.has(tick) ? "active" : ""} ${tick === currentTick ? "now" : ""}`}
                        style={ticks.has(tick) ? { background: roleColor(m.play_role) } : {}}
                        title={`Tick ${tick} — ${formatUTCHour(tickToUTCHour(tick))} UTC`}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
