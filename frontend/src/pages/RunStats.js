
import axios from "axios";
import { useNavigate } from "react-router-dom";
import React, { useEffect, useState } from "react";
import { Card, Col, Row, Statistic, Typography, Spin, Button, Space } from "antd";
import { LogoutOutlined } from "@ant-design/icons";
import StravaFooter from "../components/StravaFooter";
import PaceTrendCard from "../components/stats/PaceTrendCard.jsx";
import VolumeChartCard from "../components/stats/VolumeChartCard.jsx";
import { formatPace, getChartData } from "../utils/runStats";
import useRunStats from "../hooks/useRunStats";
import WeeklyVolumeTrendCard from "../components/stats/WeeklyVolumeTrendCard.jsx";
const { Title } = Typography;
const LOGIN_SYNC_SESSION_KEY = 'laceup_login_sync_handled';

const RunStats = () => {
    
    const [runs, setRuns] = useState([]);
    const { stats, processData } = useRunStats(runs);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate(); // for navigation

    const handleLogout = () => {
        axios.post(`${process.env.REACT_APP_API_URL}/api/strava/logout/`)
            .then(() => {
                sessionStorage.removeItem(LOGIN_SYNC_SESSION_KEY);
                navigate("/login");
            })
            .catch((err) => {
                console.error("Logout failed:", err);
                sessionStorage.removeItem(LOGIN_SYNC_SESSION_KEY);
                navigate("/login");
            });
    };

    const [timeRange, setTimeRange] = useState(3);
    const [paceRange, setPaceRange] = useState(20); //default pace range is 20 runs

    useEffect(() => {
        axios.get(`${process.env.REACT_APP_API_URL}/api/runs/`)
            .then((res) => {
                setRuns(res.data);
            })
            .catch((err) => console.error(err))
            .finally(() => setLoading(false));
    }, []);    

    if (loading) {
        return <Spin size="large" style={{ display: "block", margin: "50px auto" }} />;
    }

    const chartData = getChartData(processData, "monthly", timeRange);

    return (
        <div style={{ padding: "12px 16px", maxWidth: "1200px", margin: "0 auto", display: 'flex', flexDirection: 'column', minHeight: '100vh' }}> 
            <div style={{ flexWrap: "wrap", gap: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                <div style={{ width: "100%", wordBreak: "break-word", flex: 1, minWidth:"0" }}>
                    <Title level={2} style={{ margin: 0 }}>Running Statistics</Title>
                </div>
                <Space>
                    <Button type="primary" size="large" onClick={() => navigate("/runs")}>
                        View All Records and heatmap →
                    </Button>
                    <Button danger size="large" icon={<LogoutOutlined />} onClick={handleLogout}>
                        Logout
                    </Button>
                </Space>
            </div>

            <div style={{ marginBottom: "40px" }}>
                {/* <Title level={3}>Running Statistics</Title> */}

                {/* Summary Cards */}
                <Row gutter={16} style={{ marginBottom: "24px" }}>
                    <Col xs={24} sm={12} md={6}>
                        <Card>
                            <Statistic
                                title="This Week Volume"
                                value={stats.current_weekly}
                                precision={2}
                                suffix="km"
                                valueStyle={{ color: '#3f8600' }}
                            />
                        </Card>
                    </Col>
                    <Col  xs={24} sm={12} md={6}>
                        <Card>
                            <Statistic
                                title="This Month Volume"
                                value={stats.current_monthly}
                                precision={2}
                                suffix="km"
                                valueStyle={{ color: '#1890ff' }}
                            />
                        </Card>
                    </Col>
                    <Col  xs={24} sm={12} md={6}>
                        <Card>
                            <Statistic title="Total Runs" value={stats.total_runs} />
                        </Card>
                    </Col>
                    <Col  xs={24} sm={12} md={6}>
                        <Card>
                            <Statistic
                                title="Average Pace"
                                value={formatPace(stats.avg_pace)}
                                suffix="min/km" />
                        </Card>
                    </Col>
                </Row>

                {/* Merged Volume Chart with Controls */}
                <VolumeChartCard 
                    timeRange={timeRange} 
                    setTimeRange={setTimeRange} 
                    chartData={chartData}
                />

                {/* Weekly Volume Trend Chart */}
                <WeeklyVolumeTrendCard runs={runs} />

                {/* Pace Trend Chart */}
                <PaceTrendCard runs={runs} 
                    paceRange={paceRange} 
                    setPaceRange={setPaceRange} 
                    formatPace={formatPace} 
                />
                <StravaFooter />
            </div>
        </div>
    );
};

export default RunStats;
