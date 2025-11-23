import { MapContainer, TileLayer, Polyline } from "react-leaflet"
import polyline from "@mapbox/polyline"
import "leaflet/dist/leaflet.css"

const RunHeatmap = ({ runs }) => {
    const polylines = runs
        .filter((run) => run.polyline)
        .map((run) => {
            try {
                return polyline.decode(run.polyline)
            } catch (e) {
                console.error("Error decoding polyline:", e)
                return null
            }
        })
        .filter((p) => p != null);

    // if no polylines, return null
    if (polylines.length == 0) {
        return null;
    }

    const center = polylines[0][0];

    return (
        <div style={{ height: "500px", width: "100%", marginBottom: "24px" }}>
            {/* map container */}
            <MapContainer center={center} zoom={11} style={{ height: "100%", width: "100%" }}>

                {/* open street map */}
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />

                {/* draw polylines */}
                {polylines.map((positions, idx) => (
                    <Polyline
                        key={idx}
                        positions={positions}
                        color="red"
                        weight={2}
                        opacity={0.1}
                    />
                ))}
            </MapContainer>
        </div>
    );
};

export default RunHeatmap;