import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AddRun from "./pages/AddRun";
import RunList from "./pages/RunList";
import RunStats from "./pages/RunStats";
import Login from "./pages/Login";
import PrivateRoute from "./components/PrivateRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route element={<PrivateRoute />}>
          <Route path="/add-run" element={<AddRun />} />
          <Route path="/runs" element={<RunList />} />
          <Route path="/stats" element={<RunStats />} />
        </Route>
        <Route path="/login" element={<Login />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;