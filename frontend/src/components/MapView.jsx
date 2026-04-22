import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// ── Fix bundler icon paths using CDN ────────────────────
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize:   [25, 41],
  iconAnchor: [12, 41],
})

// ── Vendor marker: pulsing blue circle ──────────────────
const vendorIcon = L.divIcon({
  className: '',
  html: `
    <div style="
      position: relative;
      width: 22px; height: 22px;
      display: flex; align-items: center; justify-content: center;
    ">
      <div style="
        position: absolute;
        width: 22px; height: 22px;
        background: rgba(79,144,248,0.25);
        border-radius: 50%;
        animation: ripple 1.8s ease-out infinite;
      "></div>
      <div style="
        width: 14px; height: 14px;
        background: #4f90f8;
        border: 2.5px solid #fff;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        position: relative; z-index: 1;
      "></div>
    </div>
    <style>
      @keyframes ripple {
        0%   { transform: scale(1);   opacity: 0.8; }
        100% { transform: scale(2.5); opacity: 0; }
      }
    </style>
  `,
  iconSize:   [22, 22],
  iconAnchor: [11, 11],
  popupAnchor:[0, -14],
})

// ── Request marker: orange pin ───────────────────────────
const requestIcon = L.divIcon({
  className: '',
  html: `
    <svg width="28" height="38" viewBox="0 0 28 38" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 0C6.268 0 0 6.268 0 14c0 9.941 14 24 14 24S28 23.941 28 14C28 6.268 21.732 0 14 0z" fill="#f59e0b"/>
      <path d="M14 1C6.82 1 1 6.82 1 14c0 9.3 13 23 13 23S27 23.3 27 14C27 6.82 21.18 1 14 1z" fill="#fbbf24" opacity="0.4"/>
      <circle cx="14" cy="14" r="5.5" fill="white"/>
    </svg>
  `,
  iconSize:   [28, 38],
  iconAnchor: [14, 38],
  popupAnchor:[0, -40],
})

// ── Re-center map smoothly when vendor changes ───────────
function RecenterMap({ center }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true, duration: 0.8 })
  }, [center[0], center[1]]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

// ── MapView component ────────────────────────────────────
export default function MapView({ vendor, requests }) {
  const center = [vendor.latitude, vendor.longitude]

  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ height: '100%', width: '100%' }}
      zoomControl
    >
      {/* OpenStreetMap tiles */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Recenter when vendor switches */}
      <RecenterMap center={center} />

      {/* Vendor location marker */}
      <Marker position={center} icon={vendorIcon}>
        <Popup>
          <div className="popup-content">
            <div className="popup-name">🔵 {vendor.name}</div>
            <div className="popup-desc">Your vendor location</div>
            <div className="popup-meta">
              {vendor.latitude.toFixed(5)}, {vendor.longitude.toFixed(5)}
            </div>
          </div>
        </Popup>
      </Marker>

      {/* Request markers */}
      {requests.map((req) => (
        <Marker
          key={req.id}
          position={[req.latitude, req.longitude]}
          icon={requestIcon}
        >
          <Popup>
            <div className="popup-content">
              <div className="popup-name">👤 {req.customer_name}</div>
              <div className="popup-desc">{req.description}</div>
              <div className="popup-meta">
                📍 {req.latitude.toFixed(5)}, {req.longitude.toFixed(5)}
                <br />
                🕒 {new Date(req.created_at).toLocaleString()}
              </div>
              <button className="popup-chat-btn" disabled title="Coming in next release">
                💬 Chat — Coming Soon
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
