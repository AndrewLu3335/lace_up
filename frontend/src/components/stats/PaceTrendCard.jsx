import React, { useMemo } from "react";
import { Card, Select } from "antd";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";

export default function PaceTrendCard({ runs, paceRange, setPaceRange, formatPace }) {
  const paceData = useMemo(() => {
    if (!runs || runs.length === 0) return [];
    const sorted = [...runs].sort((a, b) => new Date(b.date) - new Date(a.date));
    const recent = sorted.slice(0, paceRange).reverse();
    return recent.map((run) => ({
      date: run.date.split("T")[0],
      pace: run.distance_km > 0 ? Number((run.duration_minutes / run.distance_km).toFixed(2)) : 0,
      distance: run.distance_km,
    }));
  }, [runs, paceRange]);

  const avgPace = useMemo(() => {
    if (paceData.length === 0) return null;
    const sum = paceData.reduce((s, d) => s + (Number(d.pace) || 0), 0);
    return sum / paceData.length;
  }, [paceData]);

  return (
    <Card
      title={
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
          <span>Pace Trend</span>
          <Select value={paceRange} onChange={(val) => setPaceRange(val)} style={{ width: 150 }}>
            <Select.Option value={10}>Last 10 Runs</Select.Option>
            <Select.Option value={20}>Last 20 Runs</Select.Option>
            <Select.Option value={50}>Last 50 Runs</Select.Option>
            <Select.Option value={100}>Last 100 Runs</Select.Option>
          </Select>
        </div>
      }
    >
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={paceData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis
            domain={["auto", "auto"]}
            label={{
              value: "Pace (min/km)",
              angle: -90,
              position: "insideLeft",
              style: { textAnchor: "middle" },
              fill: "#ff7300",
            }}
          />
          <Tooltip />
          {avgPace != null && (
            <ReferenceLine
              y={avgPace}
              stroke="#1677ff"
              strokeDasharray="6 6"
              label={`Average Pace: ${formatPace(avgPace)} min/km`}
            />
          )}
          <Line type="monotone" dataKey="pace" stroke="#ff7300" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}