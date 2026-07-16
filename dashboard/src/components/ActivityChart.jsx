import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from "recharts";

const data = [
  { time: "00:00", activity: 20 },
  { time: "04:00", activity: 45 },
  { time: "08:00", activity: 80 },
  { time: "12:00", activity: 55 },
  { time: "16:00", activity: 90 }
];

function ActivityChart() {
  return (
    <section className="panel">
      <h2>📊 Kingdom Activity</h2>

      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={data}>
          <XAxis dataKey="time" />
          <YAxis />
          <Tooltip />
          <Area dataKey="activity" />
        </AreaChart>
      </ResponsiveContainer>
    </section>
  );
}

export default ActivityChart;
