import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { List, Card, Tag, Space, Typography, Button } from "antd";
import { BarChartOutlined } from "@ant-design/icons";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  EnvironmentOutlined,
  ClockCircleOutlined,
  FireOutlined,
  HeartOutlined,
  DashboardOutlined,
  ThunderboltOutlined,
  LogoutOutlined
} from "@ant-design/icons";
import RunHeatmap from "./RunHeatmap";

const { Title, Text } = Typography;

export default function RunList() {
  const [runs, setRuns] = useState([]);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mapRef = useRef(null);

  useEffect(() => {
    // Check if we just logged in
    if (searchParams.get('login_success') === '1') {
      localStorage.setItem('isAuthenticated', 'true');
      // Optional: clean URL
      navigate('/runs', { replace: true });
    }
  }, [searchParams, navigate]);

  const handleLogout = () => {
    // Call backend to destroy session
    axios.post("http://127.0.0.1:8000/api/strava/logout/")
      .then(() => {
        localStorage.removeItem('isAuthenticated');
        navigate("/login");
      })
      .catch((err) => {
        console.error("Logout failed:", err);
        localStorage.removeItem('isAuthenticated');
        navigate("/login");
      });
  };

  const formatPace = (minutes) => {
    if (!minutes) return "0:00";
    const m = Math.floor(minutes);
    const s = Math.round((minutes - m) * 60);
    // format to 2 digits
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };


  const [selectedRun, setSelectedRun] = useState(null);

  useEffect(() => {
    axios.get("http://127.0.0.1:8000/api/runs/")
      .then((res) => setRuns(res.data))
      .catch((err) => console.error(err));
  }, []);

  return (
    <>
      <RunHeatmap ref={mapRef} runs={runs} selectedRun={selectedRun} />
      <Title level={2} style={{ color: "#FC4C02", fontWeight: 700, marginBottom: 24 }}>
        🏃‍♂️ My Running Records
      </Title>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button
            type="default"
            size="large"
            icon={<BarChartOutlined />}
            onClick={() => navigate("/stats")}
          >
            View Statistics
          </Button>
          <Button
            danger
            size="large"
            icon={<LogoutOutlined />}
            onClick={handleLogout}
          >
            Logout
          </Button>
        </Space>
      </div>
      <List
        pagination={{
          pageSize: 8,
          align: "center",
        }}
        dataSource={runs}
        renderItem={(run) => (
          <Card
            hoverable
            onClick={() => {
              if (run.run_type !== "Treadmill Run") {
                setSelectedRun(selectedRun?.id === run.id ? null : run);
                // Scroll to map when a run is selected
                if (selectedRun?.id !== run.id && mapRef.current) {
                  mapRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }
            }}
            style={{
              marginBottom: 18,
              borderRadius: 14,
              border: selectedRun?.id === run.id ? "2px solid #FC4C02" : "1px solid #f0f0f0",
              boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
              cursor: run.run_type === "Treadmill Run" ? "default" : "pointer",
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