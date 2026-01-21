import React, { useState } from "react";
import axios from "axios";
import {
  Container, TextField, Button, Typography, Paper, MenuItem
} from "@mui/material";

function AddRun() {
  const [formData, setFormData] = useState({
    date: "",
    distance_km: "",
    duration_minutes: "",
    avg_heart_rate: "",
    notes: "",
    weather: "",
    location: "",
    run_type: "",
    calories: "",
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    axios.post(`${process.env.REACT_APP_API_URL}/api/runs/`, formData)
      .then(() => {
        alert("Run added!");
      })
      .catch((err) => {
        console.error(err);
        alert("Error submitting run");
      });
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom>
          Add New Run
        </Typography>

        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            type="date"
            label="Date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Distance (km)"
            name="distance_km"
            value={formData.distance_km}
            onChange={handleChange}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Duration (minutes)"
            name="duration_minutes"
            value={formData.duration_minutes}
            onChange={handleChange}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Avg heart rate"
            name="avg_heart_rate"
            value={formData.avg_heart_rate}
            onChange={handleChange}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Notes"
            name="notes"
            value={formData.notes}
            multiline
            rows={3}
            onChange={handleChange}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Weather"
            name="weather"
            value={formData.weather}
            onChange={handleChange}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label="Location"
            name="location"
            value={formData.location}
            onChange={handleChange}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            select
            label="Run Type"
            name="run_type"
            value={formData.run_type}
            onChange={handleChange}
            sx={{ mb: 2 }}
          >
            <MenuItem value="outdoor">Outdoor</MenuItem>
            <MenuItem value="treadmill">Treadmill</MenuItem>
            <MenuItem value="trail">Trail</MenuItem>
            <MenuItem value="indoor_track">Indoor Track</MenuItem>
          </TextField>

          <TextField
            fullWidth
            label="Calories"
            name="calories"
            value={formData.calories}
            onChange={handleChange}
            sx={{ mb: 3 }}
          />

          <Button variant="contained" color="primary" type="submit" fullWidth>
            Submit
          </Button>
        </form>
      </Paper>
    </Container>
  );
}

export default AddRun;