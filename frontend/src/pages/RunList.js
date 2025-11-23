import React, { useEffect, useState } from "react";
import axios from "axios";
import { List, Card, Tag, Space, Typography } from "antd";
import {
  EnvironmentOutlined,
  ClockCircleOutlined,
  FireOutlined,
  HeartOutlined,
  DashboardOutlined,
  ThunderboltOutlined
} from "@ant-design/icons";
import RunStats from "./RunStats";
import RunHeatmap from "./RunHeatmap";

const { Title, Text } = Typography;

export default function RunList() {
  const [runs, setRuns] = useState([]);

  const formatPace = (minutes) => {
    if (!minutes) return "0:00";
    const m = Math.floor(minutes);
    const s = Math.round((minutes - m) * 60);
    // format to 2 digits
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };


  useEffect(() => {
    axios.get("http://127.0.0.1:8000/api/runs/")
      .then((res) => setRuns(res.data))
      .catch((err) => console.error(err));
  }, []);

  return (
    <>
      <RunStats runs={runs} />
      <RunHeatmap runs={runs} />
      <Title level={2} style={{ color: "#FC4C02", fontWeight: 700, marginBottom: 24 }}>
        🏃‍♂️ My Running Records
      </Title>

      <List
        dataSource={runs}
        renderItem={(run) => (
          <Card
            style={{
              marginBottom: 18,
              borderRadius: 14,
              border: "1px solid #f0f0f0",
              boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
            }}
            title={
              <Space size="large">
                <Text strong style={{ fontSize: 16 }}>
                  📅 {run.date.replace("T", " ").replace("Z", "")}
                </Text>

                <Tag
                  color={run.run_type === "Outdoor Run" ? "orange" : "blue"}
                  style={{ fontSize: 14, padding: "4px 10px" }}
                >
                  {run.run_type}
                </Tag>
              </Space>
            }
          >
            <Space direction="vertical" size="middle" style={{ width: "100%" }}>

              {/* --- Main Data --- */}
              <Space size="large" wrap>
                <Text><DashboardOutlined /> {run.distance_km} km</Text>
                <Text><ClockCircleOutlined /> {run.duration_minutes} min</Text>
                <Text><ThunderboltOutlined /> {formatPace(run.pace_min_per_km)} min/km </Text>
                {run.avg_heart_rate && <Text><HeartOutlined /> {run.avg_heart_rate} bpm</Text>}
                {run.calories_burned && <Text><FireOutlined /> {run.calories_burned} kcal</Text>}
              </Space>

              {/* --- Weather and temperature (Outdoor only) --- */}
              {run.run_type === "Outdoor Run" && (
                <Space size="large">
                  {run.weather && (
                    <Tag color="cyan" style={{ padding: "4px 10px" }}>
                      🌤 {run.weather}
                    </Tag>
                  )}
                  {run.temperature_c && (
                    <Tag color="orange" style={{ padding: "4px 10px" }}>
                      🌡 {run.temperature_c}°C
                    </Tag>
                  )}

                  {run.location && (
                    <Text>
                      <EnvironmentOutlined /> {run.location}
                    </Text>
                  )}
                </Space>
              )}

              {/* --- Notes --- */}
              {run.notes && (
                <Text type="secondary">
                  📝 {run.notes}
                </Text>
              )}
            </Space>
          </Card>
        )}
      />
    </>
  );
}