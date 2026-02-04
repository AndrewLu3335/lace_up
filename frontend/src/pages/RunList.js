import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import axios from "axios";
import { List, Card, Tag, Space, Typography, Button, message, Modal, Tooltip, Alert } from "antd";
import { BarChartOutlined } from "@ant-design/icons";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  EnvironmentOutlined,
  ClockCircleOutlined,
  FireOutlined,
  HeartOutlined,
  DashboardOutlined,
  ThunderboltOutlined,
  LogoutOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import RunHeatmap from "./RunHeatmap";
import StravaFooter from "../components/StravaFooter";
import LoadingScreen from "../components/LoadingScreen.js";

const { Title, Text } = Typography;

export default function RunList() {
  const [loading, setLoading] = useState(true);
  const [showGlobalLoading, setShowGlobalLoading] = useState(false);
  const [runs, setRuns] = useState([]);
  const [weatherUpdateInterval, setWeatherUpdateInterval] = useState(null);
  const [activitySyncInterval, setActivitySyncInterval] = useState(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mapRef = useRef(null);
  const [modal, contextHolder] = Modal.useModal();
  const [showHintAfterLogin, setShowHintAfterLogin] = useState(false);

  // Check if there are records with pending weather updates and start polling
  const _checkAndStartWeatherPolling = useCallback((runsData) => {
    const hasPendingWeather = runsData?.some(run => 
      run.run_type === 'outdoor' && 
      (run.weather_status === 'pending' || run.weather_status === 'updating')
    );
    
    if (hasPendingWeather && !weatherUpdateInterval) {
      // Start polling every 10 seconds
      const interval = setInterval(() => {
        axios.post(`${process.env.REACT_APP_API_URL}/api/strava/update-weather/`, {}, {
          withCredentials: true
        })
        .then((res) => {
          if (res.data.updated_count > 0 || res.data.remaining_count === 0) {
            // Refresh runs data
            axios.get(`${process.env.REACT_APP_API_URL}/api/runs/`)
              .then((res) => setRuns(res.data))
              .catch((err) => console.error("Error fetching runs:", err));
          }
          // Stop polling if no more records to update
          if (res.data.remaining_count === 0) {
            clearInterval(interval);
            setWeatherUpdateInterval(null);
            if (res.data.updated_count > 0) {
              message.success("Weather data is up to date.");
            }
          }
        })
        .catch((err) => {
          console.error("Error updating weather:", err);
        });
      }, 10000); // Poll every 10 seconds
      
      setWeatherUpdateInterval(interval);
    }
  }, [weatherUpdateInterval]);

  const handleAutoSync = useCallback(() => {
    console.log("Auto syncing data....");
    setShowGlobalLoading(true);
    setLoading(true);

    const apiUrl = `${process.env.REACT_APP_API_URL}/api/strava/sync/`;
    console.log("Making sync request to:", apiUrl);
    
    axios.post(apiUrl, { fast_mode: true }, {
      withCredentials: true, // Ensure cookies are sent
    })
      .then((res) => {
        const count = res.data.synced_activities;
        console.log("Sync completed, synced activities:", count);

        if (count > 0) {
          message.success(`Successfully synced ${count} new activities!`);
        }

        // Always refresh runs after sync
        return axios.get(`${process.env.REACT_APP_API_URL}/api/runs/`)
          .then((res) => {
            console.log("Runs fetched after sync:", res.data.length);
            setRuns(res.data);
            // Start polling for weather updates if there are pending records
            _checkAndStartWeatherPolling(res.data);
          })
          .catch((err) => {
            console.error("Error fetching runs after sync:", err);
          });
      })
      .catch((err) => {
        console.error("Sync error caught:", err);
        message.error("Auto-sync failed, please try again later.");
      })
      .finally(() => {
        setShowGlobalLoading(false);
        setLoading(false);
        console.log("Loading states cleared");
      });
  }, [_checkAndStartWeatherPolling]);

  const handleLogout = () => {
    // Call backend to destroy session
    axios.post(`${process.env.REACT_APP_API_URL}/api/strava/logout/`)
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

  const formatRunTime = (dateString) => {
    if (!dateString) return "";

    const date = new Date(dateString);

    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}`;
  };

  const [selectedRun, setSelectedRun] = useState(null);
  const hasHandledLogin = useRef(false);

  useEffect(() => {
    // Check if we just logged in - only handle once
    const loginSuccess = searchParams.get('login_success') === '1';
    console.log("Login check:", { loginSuccess, hasHandledLogin: hasHandledLogin.current, searchParams: searchParams.toString() });
    
    if (loginSuccess && !hasHandledLogin.current) {
      console.log("Login success detected, starting auto sync");
      hasHandledLogin.current = true;
      setShowHintAfterLogin(true);
      localStorage.setItem('isAuthenticated', 'true');
      
      // Start sync immediately, before navigating
      console.log("Calling handleAutoSync immediately");
      try {
        handleAutoSync();
        console.log("handleAutoSync called successfully");
      } catch (error) {
        console.error("Error calling handleAutoSync:", error);
      }
      
      // Clean URL after starting sync
      setTimeout(() => {
        navigate('/runs', { replace: true });
      }, 50);
    }
  }, [searchParams, navigate, handleAutoSync]);

  useEffect(() => {
    // Initial load of runs - only if not triggered by login
    if (!hasHandledLogin.current && runs.length === 0) {
      // Only load if we don't have runs yet
      setLoading(true);
      axios.get(`${process.env.REACT_APP_API_URL}/api/runs/`)
        .then((res) => {
          setRuns(res.data);
          setLoading(false);
        })
        .catch((err) => {
          console.error("Error fetching runs:", err);
          setLoading(false);
        });
    }
  }, [runs.length]);

  // Debug: log loading states
  useEffect(() => {
    console.log("Loading states:", { loading, showGlobalLoading });
  }, [loading, showGlobalLoading]);

  // Memoize the loading condition to ensure consistent rendering
  const shouldShowLoading = useMemo(() => {
    return showGlobalLoading || loading;
  }, [showGlobalLoading, loading]);

  // Status hints: data syncing vs weather updating
  const hasPendingWeather = useMemo(() => (
    runs.some(run =>
      run.run_type === "outdoor" &&
      (run.weather_status === "pending" || run.weather_status === "updating")
    )
  ), [runs]);
  const showUpdateHint = !shouldShowLoading && hasPendingWeather;
  const [updateHintDismissed, setUpdateHintDismissed] = useState(false);
  // Reset dismissed state when there's nothing pending, so next time we show the hint again
  useEffect(() => {
    if (!showUpdateHint) setUpdateHintDismissed(false);
  }, [showUpdateHint]);

  // Force re-render when loading state changes
  const [forceUpdate, setForceUpdate] = useState(0);
  useEffect(() => {
    if (!shouldShowLoading) {
      // When loading becomes false, force a small update to ensure UI refreshes
      setForceUpdate(prev => prev + 1);
    }
  }, [shouldShowLoading]);

  // Auto sync activities polling - check for new activities every 5 minutes.
  // Always refetch runs after sync so we show data synced by cron (server-side) too.
  useEffect(() => {
    const refetchRuns = () => {
      axios.get(`${process.env.REACT_APP_API_URL}/api/runs/`)
        .then((res) => {
          setRuns(res.data);
          _checkAndStartWeatherPolling(res.data);
        })
        .catch((err) => console.error("Error fetching runs:", err));
    };
    const interval = setInterval(() => {
      console.log("Auto-checking for new activities...");
      axios.post(`${process.env.REACT_APP_API_URL}/api/strava/sync/`, { fast_mode: false }, {
        withCredentials: true
      })
      .then((res) => {
        const count = res.data.synced_activities;
        if (count > 0) {
          console.log(`Auto-synced ${count} new activities`);
        }
        // Always refetch runs so we show data synced by cron (or by this request)
        refetchRuns();
      })
      .catch((err) => {
        console.error("Error auto-syncing activities:", err);
        refetchRuns();
      });
    }, 300000); // Poll every 5 minutes (300000 ms)
    
    setActivitySyncInterval(interval);
    
    return () => {
      clearInterval(interval);
    };
  }, [_checkAndStartWeatherPolling]);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (weatherUpdateInterval) {
        clearInterval(weatherUpdateInterval);
      }
      if (activitySyncInterval) {
        clearInterval(activitySyncInterval);
      }
    };
  }, [weatherUpdateInterval, activitySyncInterval]);

  // Check for pending weather updates when runs data changes
  useEffect(() => {
    if (runs.length > 0) {
      _checkAndStartWeatherPolling(runs);
    }
  }, [runs, _checkAndStartWeatherPolling]);

  return (
    <>
      {contextHolder}
      <LoadingScreen
        show={shouldShowLoading}
        message="Syncing your activities from Strava..."
        key={`loading-${shouldShowLoading}-${forceUpdate}`}
      />
      <RunHeatmap ref={mapRef} runs={runs} selectedRun={selectedRun} />
      <Title level={2} style={{ color: "#FC4C02", fontWeight: 700, marginBottom: 24 }}>
        🏃‍♂️ My Running Records
      </Title>

      {/* Data & weather update hint — closable, shown when records/weather are updating in background */}
      {(showUpdateHint || showHintAfterLogin) && !updateHintDismissed &&  (
        <Alert
          type="info"
          showIcon
          closable
          onClose={() => { setUpdateHintDismissed(true); setShowHintAfterLogin(false); }}
          message="Data & weather update"
          description="Running records and weather data are updated in the background. New activities and outdoor run conditions will appear shortly."
          style={{ marginBottom: 16 }}
        />
      )}

      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Space>
          <Button
            type="default"
            size="large"
            icon={<BarChartOutlined />}
            onClick={() => navigate("/stats")}
          >
            View Statistics
          </Button>
        </Space>
        <Button
          danger
          size="large"
          icon={<LogoutOutlined />}
          onClick={handleLogout}
        >
          Logout
        </Button>
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
              if (run.run_type !== "treadmill") {
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
              cursor: run.run_type === "treadmill" ? "default" : "pointer",
            }}
            title={
              <Space size="large">
                <Text strong style={{ fontSize: 16 }}>
                  📅 {formatRunTime(run.date)}
                </Text>

                <Tag
                  color={run.run_type === "outdoor" ? "orange" : "blue"}
                  style={{ fontSize: 14, padding: "4px 10px" }}
                >
                  {run.run_type === "outdoor" ? "Outdoor Run" : run.run_type === "treadmill" ? "Treadmill Run" : run.run_type}
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
              {run.run_type === "outdoor" && (
                <Space size="large">
                  {run.weather_status === 'pending' || run.weather_status === 'updating' ? (
                    <Tag color="processing" icon={<LoadingOutlined spin />} style={{ padding: "4px 10px" }}>
                      Updating weather data...
                    </Tag>
                  ) : run.weather_status === 'failed' ? (
                    <Tag color="error" icon={<ExclamationCircleOutlined />} style={{ padding: "4px 10px" }}>
                      Weather data unavailable
                    </Tag>
                  ) : (
                    <>
                      {run.weather && (
                        <Tag color="cyan" icon={<CheckCircleOutlined />} style={{ padding: "4px 10px" }}>
                          🌤 {run.weather}
                        </Tag>
                      )}
                      {run.temperature_c && (
                        <Tag color="orange" style={{ padding: "4px 10px" }}>
                          🌡 {run.temperature_c}°C
                        </Tag>
                      )}
                    </>
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
      <StravaFooter />
    </>
  );
}