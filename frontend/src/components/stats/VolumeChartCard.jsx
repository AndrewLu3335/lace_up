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
  timeUnit,
  setTimeUnit,
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
          <span>Running Volume</span>
          <div style={{ display: "flex", gap: "10px" }}>
            <Select
              value={timeUnit}
              onChange={(val) => {
                setTimeUnit(val);
                setTimeRange(val === "weekly" ? 12 : 6);
              }}
              style={{ width: 120 }}
            >
              <Select.Option value="weekly">Weekly</Select.Option>
              <Select.Option value="monthly">Monthly</Select.Option>
            </Select>

            <Select
              value={timeRange}
              onChange={(val) => setTimeRange(val)}
              style={{ width: 150 }}
            >
              {timeUnit === "weekly" ? (
                <>
                  <Select.Option value={4}>Last 4 Weeks</Select.Option>
                  <Select.Option value={12}>Last 12 Weeks</Select.Option>
                  <Select.Option value={26}>Last 6 Months</Select.Option>
                </>
              ) : (
                <>
                  <Select.Option value={6}>Last 6 Months</Select.Option>
                  <Select.Option value={12}>Last 1 Year</Select.Option>
                </>
              )}
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
          <Bar
            dataKey="distance"
            fill={timeUnit === "weekly" ? "#8884d8" : "#82ca9d"}
          />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}