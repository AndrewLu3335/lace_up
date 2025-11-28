import { MapContainer, TileLayer, Polyline, useMap } from "react-leaflet"
import polyline from "@mapbox/polyline"
import "leaflet/dist/leaflet.css"
import { useEffect, forwardRef } from "react"

const MapUpdater = ({ selectedRun }) => {
    const map = useMap();

    useEffect(() => {
        if (selectedRun && selectedRun.polyline) {
            try {
                const positions = polyline.decode(selectedRun.polyline);
                if (positions && positions.length > 0) {
                    map.fitBounds(positions, { padding: [20, 20] });
                }
            } catch (e) {
                console.error("Error decoding polyline for focus:", e);
            }
        }
    }, [selectedRun, map]);

    return null;
};

const RunHeatmap = forwardRef(({ runs, selectedRun }, ref) => {
    const polylines = runs
        .filter((run) => run.polyline)
        .filter((run) => !selectedRun || run.id === selectedRun.id) // Filter if selectedRun is present
        .map((run) => {
            try {
                return {
                    positions: polyline.decode(run.polyline),
                    id: run.id,
                    isSelected: selectedRun && selectedRun.id === run.id
                }
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

    const center = polylines[0].positions[0];

    return (
        <div ref={ref} style={{ height: "500px", width: "100%", marginBottom: "24px" }}>
            {/* map container */}
            <MapContainer center={center} zoom={11} style={{ height: "100%", width: "100%" }}>
                <MapUpdater selectedRun={selectedRun} />

                {/* open street map */}
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />

                {/* draw polylines */}
                {polylines.map((item, idx) => (
                    <>
                        {/* Draw multiple overlapping polylines for selected route to make it thicker */}
                        {item.isSelected ? (
                            <>
                                <Polyline
                                    key={`${idx}-bg`}
                                    positions={item.positions}
                                    pathOptions={{
                                        color: "#FC4C02",
                                        weight: 8,
                                        opacity: 0.3,
                                        lineCap: "round",
                                        lineJoin: "round"
                                    }}
                                />
                                <Polyline
                                    key={`${idx}-mid`}
                                    positions={item.positions}
                                    pathOptions={{
                                        color: "#FC4C02",
                                        weight: 5,
                                        opacity: 0.6,
                                        lineCap: "round",
                                        lineJoin: "round"
                                    }}
                                />
                                <Polyline
                                    key={`${idx}-main`}
                                    positions={item.positions}
                                    pathOptions={{
                                        color: "#FC4C02",
                                        weight: 3,
                                        opacity: 1,
                                        lineCap: "round",
                                        lineJoin: "round"
                                    }}
                                />
                            </>
                        ) : (
                            <Polyline
                                key={idx}
                                positions={item.positions}
                                pathOptions={{
                                    color: "red",
                                    weight: 2,
                                    opacity: 0.1
                                }}
                            />
                        )}
                    </>
                ))}
            </MapContainer>
        </div>
    );
});

export default RunHeatmap;