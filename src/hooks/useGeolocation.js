import { useEffect, useState } from 'react';

// Single fix on mount — no watch/polling needed for a one-shot distance
// calculation. status: 'loading' | 'ready' | 'denied' | 'unsupported'.
export function useGeolocation() {
  const [location, setLocation] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus('unsupported');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setStatus('ready');
      },
      () => setStatus('denied'),
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }, []);

  return { location, status };
}
