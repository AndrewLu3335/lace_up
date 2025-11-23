import { BrowserRouter, Routes, Route } from "react-router-dom";
import About from "./pages/about";
import AddRun from "./pages/AddRun";
import RunList from "./pages/RunList";
import RunStats from "./pages/RunStats";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/about" element={<About />} />
        <Route path="/add-run" element={<AddRun />} />
        <Route path="/runs" element={<RunList />} />
        <Route path="/stats" element={<RunStats />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;