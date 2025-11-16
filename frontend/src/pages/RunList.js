import React, { useEffect, useState } from "react";
import axios from "axios";
import { Container, Typography, Card, CardContent, Divider } from "@mui/material";

function RunList() {
  const [runs, setRuns] = useState([]);

  useEffect(() => {
    axios.get("http://127.0.0.1:8000/api/runs/")
      .then(response => {
        console.log("API Data:", response.data);
        setRuns(response.data);
      })
      .catch(error => {
        console.error("Error fetching runs:", error);
      });
  }, []);

  return (
    <Container maxWidth="md" style={{ paddingTop: "40px" }}>
      <Typography variant="h4" gutterBottom>
        My Running Records
      </Typography>
      <Divider style={{ marginBottom: "20px" }} />

      {runs.map(run => (
        <Card key={run.id} style={{ marginBottom: "20px" }}>
          <CardContent>
            <Typography variant="h6">
              🗓️ {run.date.replace("T", " ").replace("Z", "")}
            </Typography>
            <Typography>📏 Distance: {run.distance_km} km</Typography>
            <Typography>⏱️ Duration: {run.duration_minutes} min</Typography>
            <Typography>⚡ Pace: {run.pace_min_per_km}</Typography>

            {run.avg_heart_rate && (
              <Typography>❤️ HR: {run.avg_heart_rate} bpm</Typography>
            )}

            {run.notes && (
              <Typography style={{ marginTop: "10px" }}>
                📝 {run.notes}
              </Typography>
            )}
          </CardContent>
        </Card>
      ))}
    </Container>
  );
}

export default RunList;