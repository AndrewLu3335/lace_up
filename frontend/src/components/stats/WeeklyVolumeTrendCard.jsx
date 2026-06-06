import React, { useMemo, useState } from "react";
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
import { getWeeklyVolumeTrendData } from "../../utils/runStats";

export default function WeeklyVolumeTrendCard({ runs }) {
  const [weekCount, setWeekCount] = useState(13);

  const data = useMemo(() => {
    return getWeeklyVolumeTrendData(runs, weekCount);
  }, [runs, weekCount]);

  return (
    <Card
      title={
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px",
        }}>
          <span>Weekly Volume Trend</span>
          <Select
            value={weekCount}
            onChange={(value) => setWeekCount(value)}
            style={{ width: 150 }}
          >
            <Select.Option value={5}>Last 1 Month</Select.Option>
            <Select.Option value={13}>Last 3 Months</Select.Option>
            <Select.Option value={26}>Last 6 Months</Select.Option>
            <Select.Option value={52}>Last 1 Year</Select.Option>
          </Select>
        </div>
      }
      style={{ marginBottom: "24px" }}
    >
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="week" />
          <YAxis
            label={{
              value: "Distance (km)",
              angle: -90,
              position: "insideLeft",
              style: { textAnchor: "middle" },
            }}
          />
          <Tooltip />
          {data.map((item) => (
            <ReferenceLine
              key={item.week}
              x={item.week}
              stroke="#d9d9d9"
              strokeDasharray="3 3"
            />
          ))}
          <Line
            type="monotone"
            dataKey="distance"
            stroke="#1677ff"
            strokeWidth={2}
            dot
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
