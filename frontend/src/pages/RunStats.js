
import React, { useEffect, useState } from "react";
import { Card, Col, Row, Statistic, Typography, Spin, Select } from "antd";
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

    const [timeUnit, setTimeUnit] = useState("weekly");
    const [timeRange, setTimeRange] = useState(12);
    const [processData, setProcessedData] = useState({ weekly: {}, monthly: {} });
    const [paceRange, setPaceRange] = useState(20); //default pace range is 20 runs
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

        // process all history for weekly and monthly
        const weeklyMap = {};
        const monthMap = {};

        // process runs
        runs.forEach((run) => {
            const runDate = new Date(run.date);

            // Weekly
            const weekStart = getWeekStart(runDate).toISOString().split('T')[0];
            if (!weeklyMap[weekStart]) weeklyMap[weekStart] = 0;
            weeklyMap[weekStart] += run.distance_km;

            // Monthly
            const monthStr = runDate.toISOString().slice(0, 7);
            if (!monthMap[monthStr]) monthMap[monthStr] = 0;
            monthMap[monthStr] += run.distance_km;
        });

        // save processed data  
        setProcessedData({
            weekly: weeklyMap,
            monthly: monthMap,
        });

        // Pace Trend (Last 20 runs)
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
            pace_trend,
        });
    };

    const getChartData = () => {
        const data = [];
        const map = processData[timeUnit] || {};
        const now = new Date();

        // get week start
        const getWeekStart = (date) => {
            const d = new Date(date);
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(d.setDate(diff));
            monday.setHours(0, 0, 0, 0);
            return monday;
        };

        for (let i = timeRange - 1; i >= 0; i--) {
            let key;

            if (timeUnit === "weekly") {
                const d = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
                key = getWeekStart(d).toISOString().split('T')[0];
            } else {
                // Monthly
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                key = d.toISOString().slice(0, 7);
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
        <div style={{ marginBottom: "40px" }}>
            <Title level={3}>Running Statistics</Title>

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
        </div>
    );
};

export default RunStats;

