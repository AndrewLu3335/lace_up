import React from "react";
import { Card, Select } from "antd";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
export default function VolumeChartCard({
  timeRange,
  setTimeRange,
  chartData,
}) {
  return (
    <Card
      title={
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <span>Monthly Running Volume</span>
          <div style={{ display: "flex", gap: "10px" }}>
            <Select
              value={timeRange}
              onChange={(val) => setTimeRange(val)}
              style={{ width: 150 }}
            >
              <Select.Option value={1}>Last 1 Month</Select.Option>
              <Select.Option value={3}>Last 3 Months</Select.Option>
              <Select.Option value={6}>Last 6 Months</Select.Option>
              <Select.Option value={12}>Last 1 Year</Select.Option>
            </Select>
          </div>
        </div>
      }
      style={{ marginBottom: "24px" }}
    >
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis
            label={{
              value: "Distance (km)",
              angle: -90,
              position: "insideLeft",
              style: { textAnchor: "middle" },
              fill: "#8884d8",
            }}
          />
          <Tooltip />
          <Bar dataKey="distance" fill="#82ca9d" />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
