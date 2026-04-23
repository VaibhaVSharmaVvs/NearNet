import { useState, useEffect, useRef, useCallback } from 'react'
import { getVendors, getNearbyRequests, acceptRequest, updateRequestStatus } from '../api/client'
import MapView from '../components/MapView'
import ChatBox from '../components/ChatBox'

const POLL_INTERVAL = 5000 // ms

export default function VendorPage() {
  const [vendors, setVendors] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [radius, setRadius] = useState(5000)
  const [requests, setRequests] = useState([])
  const [polling, setPolling] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [apiError, setApiError] = useState(null)
  const [acceptingId, setAcceptingId] = useState(null)
  const [activeChatRequest, setActiveChatRequest] = useState(null)
  const intervalRef = useRef(null)

  const selectedVendor = vendors.find((v) => String(v.id) === String(selectedId)) ?? null

  // ── Load vendor list once ──────────────────────────────
  useEffect(() => {
    getVendors()
      .then((res) => setVendors(res.data))
      .catch(() => setApiError('Could not load vendors. Is the backend running?'))
  }, [])

  // ── Poll /requests/nearby ──────────────────────────────
  const fetchRequests = useCallback(async () => {
    if (!selectedVendor) return
    try {
      const data = await getNearbyRequests(
        selectedVendor.latitude,
        selectedVendor.longitude,
        radius,
        selectedVendor.id
      )
      setRequests(data)
      setLastUpdated(new Date())
      setApiError(null)
    } catch {
      setApiError('Failed to fetch nearby requests.')
    }
  }, [selectedVendor, radius])

  // Start/stop polling when vendor or radius changes
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (!selectedVendor) {
      setRequests([])
      setPolling(false)
      setActiveChatRequest(null)
      return
    }

    fetchRequests() // immediate first call
    setPolling(true)
    intervalRef.current = setInterval(fetchRequests, POLL_INTERVAL)

    return () => clearInterval(intervalRef.current)
  }, [selectedVendor, radius, fetchRequests])

  // ── Handlers ───────────────────────────────────────────
  const handleAccept = async (requestId) => {
    if (!selectedVendor) return;
    setAcceptingId(requestId);
    setApiError(null);
    try {
      await acceptRequest(requestId, selectedVendor.id);
      
      // UX Fix: Debounce/Restart polling so a fetch doesn't overwrite our success state instantly
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      await fetchRequests(); // Refresh data immediately
      intervalRef.current = setInterval(fetchRequests, POLL_INTERVAL);
    } catch (err) {
      setApiError(err.message || 'Failed to accept request.');
    } finally {
      setAcceptingId(null);
    }
  };

  const handleOpenChat = (requestId) => {
    setActiveChatRequest(requestId);
  };

  const handleQuit = async (requestId) => {
    if (!selectedVendor) return;
    setApiError(null);
    try {
      await updateRequestStatus(requestId, 'quit', 'vendor');
      
      if (intervalRef.current) clearInterval(intervalRef.current);
      await fetchRequests();
      intervalRef.current = setInterval(fetchRequests, POLL_INTERVAL);
      if (activeChatRequest === requestId) setActiveChatRequest(null);
    } catch (err) {
      setApiError(err.message || 'Failed to quit request.');
    }
  };

  // ── Helpers ────────────────────────────────────────────
  const fmtTime = (d) =>
    d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'

  const fmtRadius = (m) =>
    m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`

  const fmtAge = (iso) => {
    // Backend may return naive datetimes if timezone=True wasn't fully applied retroactively
    const isoString = (iso && !iso.endsWith('Z') && !iso.includes('+')) ? iso + 'Z' : iso;
    const diff = Date.now() - new Date(isoString).getTime()
    const mins = Math.floor(diff / 60_000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    return `${Math.floor(mins / 60)}h ago`
  }

  return (
    <div className="vendor-page">
      {/* ════════════════════════════════ SIDEBAR ══════ */}
      <aside className="vendor-sidebar">
        <div className="sidebar-header">
          <h2>Vendor Dashboard</h2>
          <p>View service requests near your location</p>
        </div>

        {/* Vendor selector */}
        <div className="form-group">
          <label className="form-label" htmlFor="vendor-select">
            Act as Vendor
          </label>
          <select
            id="vendor-select"
            className="vendor-select"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <option value="">— Select a vendor —</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          {selectedVendor && (
            <div className="vendor-coords">
              📍 {selectedVendor.latitude.toFixed(4)}, {selectedVendor.longitude.toFixed(4)}
            </div>
          )}
        </div>

        {/* Radius slider */}
        <div className="slider-group">
          <div className="slider-label">
            <span>Search Radius</span>
            <span className="slider-value">{fmtRadius(radius)}</span>
          </div>
          <input
            id="radius-slider"
            type="range"
            className="slider"
            min="500"
            max="20000"
            step="500"
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
          />
        </div>

        {/* Stats */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-value">{requests.length}</div>
            <div className="stat-label">Nearby Requests</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{fmtRadius(radius)}</div>
            <div className="stat-label">Radius</div>
          </div>
        </div>

        {/* Polling indicator */}
        <div className="poll-status">
          <div className={`poll-dot${polling ? ' active' : ''}`} />
          <span style={{ fontSize: '0.78rem' }}>
            {polling
              ? `Auto-updating · Last: ${fmtTime(lastUpdated)}`
              : 'Select a vendor to begin polling'}
          </span>
        </div>

        {/* Error */}
        {apiError && (
          <div className="toast toast-error" style={{ fontSize: '0.78rem', marginTop: 0 }}>
            ⚠️ {apiError}
          </div>
        )}

        {/* Request list */}
        {selectedVendor && (
          <div className="requests-list">
            <div className="requests-list-header">
              Requests within range ({requests.length})
            </div>

            {requests.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">🔍</span>
                <p>No active requests within {fmtRadius(radius)} of this vendor.</p>
              </div>
            ) : (
              requests.map((req) => (
                <div key={req.id} className="request-item fade-in" style={{ borderLeft: req.status === 'accepted' ? '3px solid #10b981' : 'none' }}>
                  <div className="request-item-name">
                    {req.status === 'accepted' ? '🟢 Claimed by you' : `👤 ${req.customer_name}`}
                  </div>
                  <div className="request-item-desc">{req.description}</div>
                  <div className="request-item-meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem' }}>
                    <span>📍 {req.latitude.toFixed(4)}, {req.longitude.toFixed(4)}&nbsp;·&nbsp;{fmtAge(req.created_at)}</span>
                    {req.status === 'accepted' && (
                      <button 
                        onClick={() => handleQuit(req.id)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.7rem', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        Quit Job
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* No vendor selected hint */}
        {!selectedVendor && vendors.length > 0 && (
          <div className="empty-state">
            <span className="empty-state-icon">🗺️</span>
            <p>Select a vendor above to load the map and start seeing nearby requests.</p>
          </div>
        )}
      </aside>

      {/* ════════════════════════════════ MAP ══════════ */}
      <div className="map-container">
        {selectedVendor ? (
          <>
            <MapView 
              vendor={selectedVendor} 
              requests={requests} 
              onAccept={handleAccept} 
              acceptingId={acceptingId} 
              onOpenChat={handleOpenChat}
              onQuit={handleQuit}
              radius={radius}
            />
            {activeChatRequest && (
              <ChatBox 
                requestId={activeChatRequest} 
                senderType="vendor" 
                onClose={() => setActiveChatRequest(null)} 
              />
            )}
          </>
        ) : (
          <div className="map-placeholder">
            <div className="map-placeholder-icon">🗺️</div>
            <h3>No vendor selected</h3>
            <p>Pick a vendor from the sidebar to load the map</p>
          </div>
        )}
      </div>
    </div>
  )
}
