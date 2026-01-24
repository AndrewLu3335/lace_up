
import axios from "axios";
import { useNavigate } from "react-router-dom";
import React, { useEffect, useState } from "react";
import { Card, Col, Row, Statistic, Typography, Spin, Select, Button, Space } from "antd";
import { LogoutOutlined } from "@ant-design/icons";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    BarChart,
    Bar,
} from "recharts";
import StravaFooter from "../components/StravaFooter";

const { Title } = Typography;

const RunStats = () => {
    const [stats, setStats] = useState(null);
    const [runs, setRuns] = useState([]);
    const navigate = useNavigate(); // for navigation

    const handleLogout = () => {
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

    const [timeUnit, setTimeUnit] = useState("weekly");
    const [timeRange, setTimeRange] = useState(12);
    const [processData, setProcessedData] = useState({ weekly: {}, monthly: {} });
    const [paceRange, setPaceRange] = useState(20); //default pace range is 20 runs

    useEffect(() => {
        axios.get(`${process.env.REACT_APP_API_URL}/api/runs/`)
            .then((res) => {
                setRuns(res.data);
                calculateStats(res.data);
            })
            .catch((err) => console.error(err));
    }, []);

    const formatPace = (minutes) => {
        if (!minutes) return "0:00";
        const m = Math.floor(minutes);
        const s = Math.round((minutes - m) * 60);
        return `${m}:${s < 10 ? "0" : ""}${s}`;
    };

    // 1. new helper function: generate local YYYY-MM-DD string (to solve timezone offset issue)
    const getLocalDayKey = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // 2. new helper function: generate local YYYY-MM string
    const getLocalMonthKey = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    };

    // 3. modify get monday logic
    const getMondayDate = (date) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // calculate monday
        d.setDate(diff);
        return d;
    };

    const calculateStats = (runs) => {
        if (!runs || runs.length === 0) {
            setStats({
                current_weekly: 0,
                current_monthly: 0,
                total_runs: 0,
                avg_pace: 0,
                pace_trend: [],
            });
            return;
        }

        // --- basic stats ---
        const total_distance = runs.reduce((sum, run) => sum + run.distance_km, 0);
        const total_runs = runs.length;
        const total_duration = runs.reduce((sum, run) => sum + run.duration_minutes, 0);
        const avg_pace = total_distance > 0 ? total_duration / total_distance : 0;

        // --- core fix: use local time to generate key ---
        const weeklyMap = {};
        const monthMap = {};

        runs.forEach((run) => {
            const runDate = new Date(run.date); // browser will automatically convert UTC to local time

            // 1. calculate weekly distance key
            const monday = getMondayDate(runDate);
            const weekKey = getLocalDayKey(monday); // format: 2026-01-19

            if (!weeklyMap[weekKey]) weeklyMap[weekKey] = 0;
            weeklyMap[weekKey] += run.distance_km;

            // 2. calculate monthly distance key
            const monthKey = getLocalMonthKey(runDate); // format: 2026-01

            if (!monthMap[monthKey]) monthMap[monthKey] = 0;
            monthMap[monthKey] += run.distance_km;
        });

        // save data for charts
        setProcessedData({
            weekly: weeklyMap,
            monthly: monthMap,
        });

        // --- get "this week" and "this month" ---
        const now = new Date();

        // generate today's weekKey and monthKey
        const currentMonday = getMondayDate(now);
        const currentWeekKey = getLocalDayKey(currentMonday);
        const currentMonthKey = getLocalMonthKey(now);

        // Debug: if still 0, can check the generated Key in the console
        console.log("Keys Check:", {
            weekKey: currentWeekKey,
            monthKey: currentMonthKey,
            weeklyData: weeklyMap,
            monthlyData: monthMap
        });

        const currentWeekDistance = weeklyMap[currentWeekKey] || 0;
        const currentMonthDistance = monthMap[currentMonthKey] || 0;

        // --- pace trend ---
        const sortedRuns = [...runs].sort((a, b) => new Date(b.date) - new Date(a.date));
        const recentRuns = sortedRuns.slice(0, 20).reverse();

        const pace_trend = recentRuns.map((run) => ({
            date: run.date.split("T")[0],
            pace: run.distance_km > 0 ? parseFloat((run.duration_minutes / run.distance_km).toFixed(2)) : 0,
            distance: run.distance_km,
        }));

        setStats({
            current_weekly: parseFloat(currentWeekDistance.toFixed(2)),
            current_monthly: parseFloat(currentMonthDistance.toFixed(2)),
            total_runs,
            avg_pace: parseFloat(avg_pace.toFixed(2)),
            pace_trend,
        });
    };

    const getChartData = () => {
        const data = [];
        const map = processData[timeUnit] || {};
        const now = new Date();

        for (let i = timeRange - 1; i >= 0; i--) {
            let key;

            if (timeUnit === "weekly") {
                // calculate the date of the previous week
                const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (i * 7));
                const monday = getMondayDate(d);
                key = getLocalDayKey(monday); // must use the same getLocalDayKey
            } else {
                // Monthly
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                key = getLocalMonthKey(d); // must use the same getLocalMonthKey
            }

            data.push({
                date: key,
                distance: map[key] ? parseFloat(map[key].toFixed(2)) : 0,
            });
        }
        return data;
    };

    const getPaceData = () => {
        if (!runs || runs.length === 0) return [];
        // sort runs by date desc   
        const sortedRuns = [...runs].sort((a, b) => new Date(b.date) - new Date(a.date));
        // get recent runs
        const recentRuns = sortedRuns.slice(0, paceRange).reverse();

        return recentRuns.map((run) => ({
            date: run.date.split("T")[0],
            pace: run.distance_km > 0 ? parseFloat((run.duration_minutes / run.distance_km).toFixed(2)) : 0,
            distance: run.distance_km,
        }));
    };

    if (!stats) {
        return <Spin size="large" style={{ display: "block", margin: "50px auto" }} />;
    }

    const chartData = getChartData();

    return (
        <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto", display: 'flex', flexDirection: 'column', minHeight: '100vh' }}> {/* 加点容器样式 */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                <Title level={2} style={{ margin: 0 }}>Running Statistics</Title>
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
                    <Col span={6}>
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
                    <Col span={6}>
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
                    <Col span={6}>
                        <Card>
                            <Statistic title="Total Runs" value={stats.total_runs} />
                        </Card>
                    </Col>
                    <Col span={6}>
                        <Card>
                            <Statistic
                                title="Average Pace"
                                value={formatPace(stats.avg_pace)}
                                suffix="min/km" />
                        </Card>
                    </Col>
                </Row>

                {/* Merged Volume Chart with Controls */}
                <Card
                    title={
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Running Volume</span>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                {/* Unit Selector: Weekly / Monthly */}
                                <Select
                                    value={timeUnit}
                                    onChange={val => {
                                        setTimeUnit(val);
                                        // reset range to avoid invalid range
                                        setTimeRange(val === 'weekly' ? 12 : 6);
                                    }}
                                    style={{ width: 120 }}
                                >
                                    <Select.Option value="weekly">Weekly</Select.Option>
                                    <Select.Option value="monthly">Monthly</Select.Option>
                                </Select>

                                {/* Range Selector: Past X */}
                                <Select
                                    value={timeRange}
                                    onChange={val => setTimeRange(val)}
                                    style={{ width: 150 }}
                                >
                                    {timeUnit === 'weekly' ? (
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
                                    value: 'Distance (km)',
                                    angle: -90,
                                    position: 'insideLeft',
                                    style: { textAnchor: 'middle' },
                                    fill: "#8884d8"
                                }}
                            />
                            <Tooltip />
                            <Bar dataKey="distance" fill={timeUnit === 'weekly' ? "#8884d8" : "#82ca9d"} />
                        </BarChart>
                    </ResponsiveContainer>
                </Card>

                {/* Pace Trend Chart */}
                <Card
                    title={
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Pace Trend</span>
                            <Select
                                value={paceRange}
                                onChange={val => setPaceRange(val)}
                                style={{ width: 150 }}
                            >
                                <Select.Option value={10}>Last 10 Runs</Select.Option>
                                <Select.Option value={20}>Last 20 Runs</Select.Option>
                                <Select.Option value={50}>Last 50 Runs</Select.Option>
                                <Select.Option value={100}>Last 100 Runs</Select.Option>
                            </Select>
                        </div>
                    }
                >
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={getPaceData()}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis
                                domain={["auto", "auto"]}
                                label={{
                                    value: 'Pace (min/km)',
                                    angle: -90,
                                    position: 'insideLeft',
                                    style: { textAnchor: 'middle' },
                                    fill: "#ff7300"
                                }}
                            />
                            <Tooltip />
                            <Line type="monotone" dataKey="pace" stroke="#ff7300" />
                        </LineChart>
                    </ResponsiveContainer>
                </Card>
                <StravaFooter />
            </div>
        </div>
    );
};

export default RunStats;

