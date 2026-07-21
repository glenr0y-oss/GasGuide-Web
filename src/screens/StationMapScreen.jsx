import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getNearbyStations, getPriceUnitLabel } from '../data/mockStations';
import { useVehicle } from '../context/VehicleContext';

// Uses OpenStreetMap tiles via Leaflet — genuinely real, no API key ever
// required, unlike Google Maps' JS SDK. Good enough to ship with as-is;
// swap TileLayer's url for Mapbox/Google styled tiles later if you want a
// custom map look, but it isn't required for this to work.

function makePin(isCheapest) {
  return L.divIcon({
    className: '',
    html: `<div class="price-pin ${isCheapest ? 'cheapest' : ''}"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

export default function StationMapScreen() {
  const { selectedVehicle } = useVehicle();
  const stations = getNearbyStations(selectedVehicle.fuelKind);
  const priceUnitLabel = getPriceUnitLabel(selectedVehicle.fuelKind);
  const cheapest = stations[0];
  const center = [stations[0]?.lat ?? 41.7, stations[0]?.lng ?? -72.68];

  return (
    <div>
      <div className="map-container">
        <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {stations.map((station) => (
            <Marker
              key={station.id}
              position={[station.lat, station.lng]}
              icon={makePin(station.id === cheapest?.id)}
            >
              <Popup>
                {station.name} — ${station.price.toFixed(2)}/{priceUnitLabel}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <div className="station-list">
        <span className="label">Nearby, cheapest first</span>
        {stations.map((item) => (
          <div className="station-row" key={item.id}>
            <div className="station-info">
              <div>{item.name}</div>
              <div className="body-muted">{item.address}</div>
            </div>
            <div className="station-price-col">
              <span className="stat" style={{ fontSize: 18 }}>
                ${item.price.toFixed(2)}
              </span>
              <span className="body-muted">{item.lastReportMinutesAgo}m ago</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
