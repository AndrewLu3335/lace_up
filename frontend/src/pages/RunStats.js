
import React, { useEffect, useState } from "react";
import { Card, Col, Row, Statistic, Typography, Spin } from "antd";
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

const { Title } = Typography;

const RunStats = ({ runs }) => {
    const [stats, setStats] = useState(null);

    useEffect(() => {
        if (runs) {
            calculateStats(runs);
        }
    }, [runs]);

    const calculateStats = (runs) => {
        if (!runs || runs.length === 0) {
            setStats({
                total_distance: 0,
                total_runs: 0,
                avg_pace: 0,
                weekly_volume: [],
                monthly_volume: [],
                pace_trend: [],
            });
            return;
        }

        // 1. Total Stats
        const total_distance = runs.reduce((sum, run) => sum + run.distance_km, 0);
        const total_runs = runs.length;
        const total_duration = runs.reduce((sum, run) => sum + run.duration_minutes, 0);
        const avg_pace = total_distance > 0 ? total_duration / total_distance : 0;

        // Helper to get week start (Monday)
        const getWeekStart = (date) => {
            const d = new Date(date);
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
            const monday = new Date(d.setDate(diff));
            monday.setHours(0, 0, 0, 0);
            return monday;
        };

        // 2. Weekly Volume (Last 12 weeks)
        const weeklyMap = {};
        const now = new Date();
        const twelveWeeksAgo = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000);

        // Initialize last 12 weeks with 0
        for (let i = 0; i < 12; i++) {
            const d = new Date(twelveWeeksAgo.getTime() + i * 7 * 24 * 60 * 60 * 1000);
            const weekStart = getWeekStart(d).toISOString().split('T')[0];
            weeklyMap[weekStart] = 0;
        }

        // 3. Monthly Volume (Last 12 months)
        const monthlyMap = {};
        const twelveMonthsAgo = new Date(now.getFullYear() - 1, now.getMonth(), 1);

        // Initialize last 12 months
        for (let i = 0; i < 12; i++) {
            const d = new Date(twelveMonthsAgo.getFullYear(), twelveMonthsAgo.getMonth() + i, 1);
            const monthStr = d.toISOString().slice(0, 7); // YYYY-MM
            monthlyMap[monthStr] = 0;
        }

        // Aggregate Data
        runs.forEach((run) => {
            const runDate = new Date(run.date);

            // Weekly
            if (runDate >= twelveWeeksAgo) {
                const weekStart = getWeekStart(runDate).toISOString().split('T')[0];
                if (weeklyMap.hasOwnProperty(weekStart)) {
                    weeklyMap[weekStart] += run.distance_km;
                }
            }

            // Monthly
            if (runDate >= twelveMonthsAgo) {
                const monthStr = runDate.toISOString().slice(0, 7);
                if (monthlyMap.hasOwnProperty(monthStr)) {
                    monthlyMap[monthStr] += run.distance_km;
                }
            }
        });

        const weekly_volume = Object.keys(weeklyMap)
            .sort()
            .map((week) => ({
                week,
                distance: parseFloat(weeklyMap[week].toFixed(2)),
            }));

        const monthly_volume = Object.keys(monthlyMap)
            .sort()
            .map((month) => ({
                month,
                distance: parseFloat(monthlyMap[month].toFixed(2)),
            }));

        // 4. Pace Trend (Last 20 runs)
        // Runs are already sorted by date desc from API usually, but let's ensure
        const sortedRuns = [...runs].sort((a, b) => new Date(b.date) - new Date(a.date));
        const recentRuns = sortedRuns.slice(0, 20).reverse(); // Get last 20, then reverse for chart (oldest to newest)

        const pace_trend = recentRuns.map((run) => ({
            date: run.date.split("T")[0],
            pace: run.distance_km > 0 ? parseFloat((run.duration_minutes / run.distance_km).toFixed(2)) : 0,
            distance: run.distance_km,
        }));

        setStats({
            total_distance: parseFloat(total_distance.toFixed(2)),
            total_runs,
            avg_pace: parseFloat(avg_pace.toFixed(2)),
            weekly_volume,
            monthly_volume,
            pace_trend,
        });
    };

    if (!stats) {
        return <Spin size="large" style={{ display: "block", margin: "50px auto" }} />;
    }

    return (
        <div style={{ marginBottom: "40px" }}>
            <Title level={3}>Statistics</Title>

            {/* Summary Cards */}
            <Row gutter={16} style={{ marginBottom: "24px" }}>
                <Col span={8}>
                    <Card>
                        <Statistic title="Total Distance" value={stats.total_distance} precision={2} suffix="km" />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card>
                        <Statistic title="Total Runs" value={stats.total_runs} />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card>
                        <Statistic title="Average Pace" value={stats.avg_pace} precision={2} suffix="min/km" />
                    </Card>
                </Col>
            </Row>

            {/* Weekly Volume Chart */}
            <Card title="Weekly Volume (Last 12 Weeks)" style={{ marginBottom: "24px" }}>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={stats.weekly_volume}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="week" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="distance" fill="#8884d8" name="Distance (km)" />
                    </BarChart>
                </ResponsiveContainer>
            </Card>

            {/* Monthly Volume Chart */}
            <Card title="Monthly Volume (Last 12 Months)" style={{ marginBottom: "24px" }}>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={stats.monthly_volume}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="distance" fill="#82ca9d" name="Distance (km)" />
                    </BarChart>
                </ResponsiveContainer>
            </Card>

            {/* Pace Trend Chart */}
            <Card title="Pace Trend (Last 20 Runs)">
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={stats.pace_trend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis domain={["auto", "auto"]} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="pace" stroke="#ff7300" name="Pace (min/km)" />
                    </LineChart>
                </ResponsiveContainer>
            </Card>
        </div>
    );
};

export default RunStats;

