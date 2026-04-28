'use client';

import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Polyline } from 'react-leaflet';
import { useEffect, useState } from 'react';
import { CircleMarker } from 'react-leaflet';





// Fix marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});



function createArc(start: [number, number], end: [number, number]) {
  const points = [];
  const steps = 50;
  const latDiff = end[0] - start[0];
  const curveFactor = Math.min(Math.abs(latDiff) * 0.5, 8);

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;

    const lat =
      start[0] * (1 - t) +
      end[0] * t +
      Math.sin(Math.PI * t) * curveFactor;

    const lng = start[1] * (1 - t) + end[1] * t;

    points.push([lat, lng]);
  }

  return points as [number, number][];
}

function createLine(start: [number, number], end: [number, number]) {
  return [start, end];
}

function createCoastalRoute(
  start: [number, number],
  end: [number, number]
): [number, number][] {
  // Hug the western coastline via key coastal points
  const coastalWaypoints: [number, number][] = [
    start,
    [15.85, 73.9],  // Goa coast
    [12.86, 74.84], // Mangalore
    [11.25, 75.77], // Kozhikode
    [9.93, 76.26],  // Kochi
    [8.5, 76.94],   // Trivandrum area
    [8.08, 77.55],  // Kanyakumari tip
    end,
  ];
  return coastalWaypoints;
}

export default function RouteMap({
  origin,
  destination,
  mode
}: {
  origin: string;
  destination: string;
  mode: string;
}) {
  const coords: Record<string, [number, number]> = {
    Mumbai: [19.076, 72.8777],
    Chennai: [13.0827, 80.2707],
    Bangalore: [12.9716, 77.5946],
    Hyderabad: [17.385, 78.4867],
    Delhi: [28.6139, 77.209],
    Kolkata: [22.5726, 88.3639],
  };
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  
  const [originCoords, setOriginCoords] = useState<[number, number]>([20, 77]);
  const [destCoords, setDestCoords] = useState<[number, number]>([20, 77]);
  const [coordsReady, setCoordsReady] = useState(false);
  const routePoints =
  mode === 'road'
    ? routeCoords.length > 0
      ? routeCoords
      : createLine(originCoords, destCoords)
    : mode === 'air'
    ? createArc(originCoords, destCoords)
    : createCoastalRoute(originCoords, destCoords);
  const center: [number, number] = [
  (originCoords[0] + destCoords[0]) / 2,
  (originCoords[1] + destCoords[1]) / 2,
];

async function geocodeCity(city: string): Promise<[number, number]> {
  // Check cache first — instant for known cities
  const cached = coords[city];
  if (cached) return cached;

  // Unknown city — ask Nominatim
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)},India&format=json&limit=1`,
      { headers: { 'User-Agent': 'SportTrace/1.0' } }
    );
    const data = await res.json();
    if (data.length > 0) {
      return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    }
  } catch (err) {
    console.error('Geocoding failed for', city);
  }

  // Last resort — center of India
  return [20, 77];
}


const weatherPoints = routePoints.slice(0, 5).map((pt, i) => ({
  position: pt,
  risk: Math.random() * 20, // simulate
}));

useEffect(() => {
  const loadAndFetch = async () => {
    setCoordsReady(false);
    setRouteCoords([]);

    const [oCoords, dCoords] = await Promise.all([
      geocodeCity(origin),
      geocodeCity(destination),
    ]);

    setOriginCoords(oCoords);
    setDestCoords(dCoords);
    setCoordsReady(true);

    // Now fetch road route if needed
    if (mode === 'road') {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${oCoords[1]},${oCoords[0]};${dCoords[1]},${dCoords[0]}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();
        const routeData = data.routes[0].geometry.coordinates.map(
          ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
        );
        setRouteCoords(routeData);
      } catch (err) {
        console.error('OSRM failed');
        setRouteCoords(createLine(oCoords, dCoords));
      }
    }
  };

  loadAndFetch();
}, [origin, destination, mode]);

if (!coordsReady) {
  return (
    <div className="rounded-lg border border-slate-700 h-48 flex items-center justify-center bg-slate-900/50">
      <p className="text-slate-500 text-xs animate-pulse">Loading map...</p>
    </div>
  );
}


  return (
    <div className="rounded-lg overflow-hidden border border-slate-700 h-48">
      <MapContainer
        center={center}
        zoom={5}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        <Marker position={originCoords}>
          <Popup>{origin}</Popup>
        </Marker>

        <Marker position={destCoords}>
          <Popup>{destination}</Popup>
        </Marker>

        <Polyline
  positions={routePoints}
  pathOptions={{
    color:
      mode === 'air'
        ? '#38bdf8' // blue
        : mode === 'sea'
        ? '#22c55e' // green
        : '#f59e0b', // road orange
    weight: 3,
    opacity: 0.85,
    dashArray: mode === 'sea' ? '6, 8' : undefined, // dashed sea route
  }}
/>

    {weatherPoints.map((wp, i) => (
  <CircleMarker
    key={i}
    center={wp.position}
    radius={6}
    pathOptions={{
      color:
        wp.risk > 15
          ? '#ef4444'
          : wp.risk > 8
          ? '#f59e0b'
          : '#22c55e',
      fillOpacity: 0.7,
    }}
  >
    <Popup>Risk: {Math.round(wp.risk)}</Popup>
  </CircleMarker>
))}
      </MapContainer>
    </div>
  );
}