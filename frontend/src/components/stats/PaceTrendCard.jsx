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

    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - paceRange, now.getDate());

    return [...runs]
      .filter((run) => new Date(run.date) >= startDate)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((run) => ({
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
            <Select.Option value={1}>Last 1 Month</Select.Option>
            <Select.Option value={3}>Last 3 Months</Select.Option>
            <Select.Option value={6}>Last 6 Months</Select.Option>
            <Select.Option value={12}>Last 1 Year</Select.Option>
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
