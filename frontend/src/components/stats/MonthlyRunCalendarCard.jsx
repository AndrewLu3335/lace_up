import React, { useMemo } from "react";
import { Card, Tooltip } from "antd";
import { getMonthlyRunCalendarData } from "../../utils/runStats";

const WEEK_DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const CELL_SIZE = 14;

function getCellColor(distance) {
  if (distance <= 0) return "#ebedf0";
  if (distance < 5) return "#9be9a8";
  if (distance < 10) return "#40c463";
  if (distance < 15) return "#30a14e";
  return "#216e39";
}

export default function MonthlyRunCalendarCard({ runs, style }) {
  const calendarData = useMemo(() => {
    return getMonthlyRunCalendarData(runs);
  }, [runs]);

  return (
    <Card
      title={
        <div>
          <div>Monthly Run Calendar</div>
          <div style={{ color: "#8c8c8c", fontSize: "12px", fontWeight: 400 }}>
            {calendarData.monthLabel}
          </div>
        </div>
      }
      style={{ marginBottom: "24px", ...style }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(7, ${CELL_SIZE}px)`,
          gap: "5px",
          justifyContent: "start",
        }}
      >
        {WEEK_DAYS.map((day) => (
          <div
            key={day}
            style={{
              color: "#8c8c8c",
              fontSize: "10px",
              textAlign: "center",
              lineHeight: `${CELL_SIZE}px`,
            }}
          >
            {day}
          </div>
        ))}

        {calendarData.days.map((day, index) => {
          if (!day) {
            return <div key={`empty-${index}`} />;
          }

          return (
            <Tooltip
              key={day.date}
              title={
                day.hasRun
                  ? `${day.date}: ${day.distance} km`
                  : `${day.date}: No run`
              }
            >
              <div
                style={{
                  width: `${CELL_SIZE}px`,
                  height: `${CELL_SIZE}px`,
                  borderRadius: "3px",
                  backgroundColor: getCellColor(day.distance),
                  border: "1px solid rgba(27, 31, 36, 0.08)",
                }}
              />
            </Tooltip>
          );
        })}
      </div>
    </Card>
  );
}
