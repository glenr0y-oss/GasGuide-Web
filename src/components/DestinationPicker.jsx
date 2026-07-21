import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useGeolocation } from '../hooks/useGeolocation';
import { haversineMiles } from '../utils/geo';

// Same fallback center StationMapScreen.jsx uses, so the map never renders
// blank before a pin or the user's location is available.
const DEFAULT_CENTER = [41.7, -72.68];

function destPinIcon() {
  return L.divIcon({
    className: '',
    html: '<div class="dest-pin"></div>',
    iconSize: [26, 26],
    iconAnchor: [13, 26],
  });
}

function RecenterMap({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat != null && lng != null) {
      map.setView([lat, lng], 14);
    }
  }, [lat, lng, map]);
  return null;
}

export default function DestinationPicker({ onDistanceChange }) {
  const { location: userLocation, status: locationStatus } = useGeolocation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [pin, setPin] = useState(null);
  const [manualMiles, setManualMiles] = useState('');
  const abortRef = useRef(null);

  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`,
        { signal: controller.signal }
      )
        .then((res) => res.json())
        .then(setResults)
        .catch((err) => {
          if (err.name !== 'AbortError') setResults([]);
        });
    }, 500);
    return () => clearTimeout(timer);
  }, [query]);

  function selectResult(result) {
    setPin({ lat: parseFloat(result.lat), lng: parseFloat(result.lon) });
    setQuery(result.display_name.split(',').slice(0, 2).join(','));
    setResults([]);
  }

  function handleDragEnd(e) {
    const { lat, lng } = e.target.getLatLng();
    setPin((p) => ({ ...p, lat, lng }));
  }

  const distanceMiles = useMemo(() => {
    if (!userLocation || !pin) return null;
    return haversineMiles(userLocation.lat, userLocation.lng, pin.lat, pin.lng);
  }, [userLocation, pin]);

  useEffect(() => {
    if (distanceMiles != null) onDistanceChange(distanceMiles);
  }, [distanceMiles, onDistanceChange]);

  function handleManualMiles(value) {
    setManualMiles(value);
    onDistanceChange(parseFloat(value) || 0);
  }

  const center = pin
    ? [pin.lat, pin.lng]
    : userLocation
      ? [userLocation.lat, userLocation.lng]
      : DEFAULT_CENTER;
  const showManualFallback = locationStatus === 'denied' || locationStatus === 'unsupported';

  return (
    <div>
      <input
        className="text-input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search an address or place"
      />
      {results.length > 0 && (
        <div className="search-results">
          {results.map((r) => (
            <button key={r.place_id} className="search-result-row" onClick={() => selectResult(r)}>
              {r.display_name}
            </button>
          ))}
        </div>
      )}

      <div className="picker-map">
        <MapContainer center={center} zoom={pin ? 14 : 11} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {pin && (
            <Marker
              position={[pin.lat, pin.lng]}
              icon={destPinIcon()}
              draggable
              eventHandlers={{ dragend: handleDragEnd }}
            />
          )}
          <RecenterMap lat={pin?.lat} lng={pin?.lng} />
        </MapContainer>
      </div>

      {distanceMiles != null && (
        <p className="body-muted">
          ≈ {distanceMiles.toFixed(1)} mi straight-line — actual driving distance may be longer.
        </p>
      )}

      {locationStatus === 'loading' && <p className="body-muted">Finding your location…</p>}
      {locationStatus === 'ready' && !pin && (
        <p className="body-muted">Search for a destination above to calculate distance.</p>
      )}

      {showManualFallback && (
        <>
          <p className="body-muted">
            Turn on location access to auto-calculate distance, or just enter miles:
          </p>
          <input
            className="text-input"
            value={manualMiles}
            onChange={(e) => handleManualMiles(e.target.value)}
            inputMode="decimal"
            placeholder="e.g. 42 miles"
          />
        </>
      )}
    </div>
  );
}
