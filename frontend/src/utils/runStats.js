// format pace to mm:ss
export function formatPace(minutes) {
    if (!minutes) return "0:00";
    const m = Math.floor(minutes);
    const s = Math.round((minutes - m) * 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
};

// generate local YYYY-MM-DD string (to solve timezone offset issue)
export function getLocalDayKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// generate local YYYY-MM string
export function getLocalMonthKey(date){
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
};

// get monday date
export function getMondayDate(date){
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // calculate monday
    d.setDate(diff);
    return d;
};
// get weekly volume trend data
export function getWeeklyVolumeTrendData(runs = [], weekCount = 12) {
  const weeklyMap = {};

  runs.forEach((run) => {
    const runDate = new Date(run.date);
    const monday = getMondayDate(runDate);
    const weekKey = getLocalDayKey(monday);

    weeklyMap[weekKey] = (weeklyMap[weekKey] || 0) + Number(run.distance_km || 0);
  });

  const data = [];
  const now = new Date();

  for (let i = weekCount - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7);
    const monday = getMondayDate(d);
    const weekKey = getLocalDayKey(monday);

    data.push({
      week: weekKey,
      distance: weeklyMap[weekKey] ? Number(weeklyMap[weekKey].toFixed(2)) : 0,
    });
  }

  return data;
}

// get chart data
export function getChartData(processData, timeUnit, timeRange) {
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
