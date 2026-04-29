import { useMemo } from "react";
import { getLocalDayKey, getLocalMonthKey, getMondayDate } from "../utils/runStats";

export default function useRunStats(runs) {
  return useMemo(() => {
    if (!runs || runs.length === 0) {
      return {
        stats: {
          current_weekly: 0,
          current_monthly: 0,
          total_runs: 0,
          avg_pace: 0,
          pace_trend: [],
        },
        processData: { weekly: {}, monthly: {} },
      };
    }

    const total_distance = runs.reduce((sum, run) => sum + run.distance_km, 0);
    const total_runs = runs.length;
    const total_duration = runs.reduce((sum, run) => sum + run.duration_minutes, 0);
    const avg_pace = total_distance > 0 ? total_duration / total_distance : 0;

    const weeklyMap = {};
    const monthMap = {};

    runs.forEach((run) => {
      const runDate = new Date(run.date);

      const monday = getMondayDate(runDate);
      const weekKey = getLocalDayKey(monday);
      weeklyMap[weekKey] = (weeklyMap[weekKey] || 0) + run.distance_km;

      const monthKey = getLocalMonthKey(runDate);
      monthMap[monthKey] = (monthMap[monthKey] || 0) + run.distance_km;
    });

    const now = new Date();
    const currentMonday = getMondayDate(now);
    const currentWeekKey = getLocalDayKey(currentMonday);
    const currentMonthKey = getLocalMonthKey(now);

    const currentWeekDistance = weeklyMap[currentWeekKey] || 0;
    const currentMonthDistance = monthMap[currentMonthKey] || 0;

    const sortedRuns = [...runs].sort((a, b) => new Date(b.date) - new Date(a.date));
    const recentRuns = sortedRuns.slice(0, 20).reverse();
    const pace_trend = recentRuns.map((run) => ({
      date: run.date.split("T")[0],
      pace: run.distance_km > 0 ? Number((run.duration_minutes / run.distance_km).toFixed(2)) : 0,
      distance: run.distance_km,
    }));

    return {
      stats: {
        current_weekly: Number(currentWeekDistance.toFixed(2)),
        current_monthly: Number(currentMonthDistance.toFixed(2)),
        total_runs,
        avg_pace: Number(avg_pace.toFixed(2)),
        pace_trend,
      },
      processData: {
        weekly: weeklyMap,
        monthly: monthMap,
      },
    };
  }, [runs]);
}