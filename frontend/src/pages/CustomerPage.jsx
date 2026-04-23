import { useState, useEffect } from 'react'
import { createRequest, getRequest, getMessages, updateRequestStatus } from '../api/client'
import ChatBox from '../components/ChatBox'

export default function CustomerPage() {
  const [form, setForm] = useState({
    customer_name: '',
    description: '',
    latitude: '',
    longitude: '',
  })
  const [loading, setLoading] = useState(false)
  const [gettingLoc, setGettingLoc] = useState(false)
  const [toast, setToast] = useState(null)
  const [activeRequestId, setActiveRequestId] = useState(null)
  
  const [activeRequest, setActiveRequest] = useState(null)
  const [hasMessages, setHasMessages] = useState(false)

  // Poll for request state
  useEffect(() => {
    let interval;
    const checkState = async () => {
      if (!activeRequestId) return;
      try {
        const req = await getRequest(activeRequestId)
        setActiveRequest(req)
        
        const msgs = await getMessages(activeRequestId)
        if (msgs.length > 0) setHasMessages(true)
        
        if (!req.is_active && req.status === 'cancelled') {
          setActiveRequestId(null)
          setToast({ type: 'error', msg: 'Request was cancelled or expired.' })
        }
      } catch (e) {
        console.error(e)
      }
    }
    
    if (activeRequestId) {
      checkState()
      interval = setInterval(checkState, 3000)
    }
    return () => clearInterval(interval)
  }, [activeRequestId])

  const handleAction = async (action) => {
    try {
      await updateRequestStatus(activeRequestId, action, 'customer')
      setActiveRequestId(null)
      setActiveRequest(null)
      setHasMessages(false)
      setToast({ type: 'success', msg: `Request ${action === 'cancel' ? 'cancelled' : 'completed'} successfully!` })
    } catch(e) {
      alert("Failed to update: " + e.message)
    }
  }

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    if (toast) setToast(null)
  }

  const handleGeolocate = () => {
    if (!navigator.geolocation) {
      setToast({ type: 'error', msg: 'Geolocation is not supported by your browser.' })
      return
    }
    setGettingLoc(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }))
        setGettingLoc(false)
      },
      () => {
        setToast({ type: 'error', msg: 'Could not determine your location. Enter coordinates manually.' })
        setGettingLoc(false)
      },
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setToast(null)
    try {
      const reqData = await createRequest({
        customer_name: form.customer_name,
        description: form.description,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
      })
      setActiveRequestId(reqData.data.id)
      setActiveRequest(null)
      setHasMessages(false)
      setToast({
        type: 'success',
        msg: '✅ Request submitted! Vendors nearby can now accept and chat.',
      })
    } catch (err) {
      const detail = err?.response?.data?.detail
      const msg = typeof detail === 'string' ? detail : 'Failed to submit. Is the backend running?'
      setToast({ type: 'error', msg: `❌ ${msg}` })
    } finally {
      setLoading(false)
    }
  }

  const isValid =
    form.customer_name.trim() &&
    form.description.trim() &&
    form.latitude !== '' &&
    form.longitude !== ''

  return (
    <div className="customer-page">
      {activeRequestId ? (
        <div className="customer-card fade-in" style={{ display: 'flex', flexDirection: 'column', height: '80vh', maxWidth: '400px', padding: '1.5rem' }}>
          <div className="card-header" style={{ marginBottom: '1rem' }}>
            <h1 style={{ fontSize: '1.2rem' }}>✅ Request Active</h1>
            <p>Request #{activeRequestId} is broadcasting.</p>
          </div>
          
          {(activeRequest?.status === 'accepted' || hasMessages) ? (
            <div style={{ flex: 1, position: 'relative', width: '100%', minHeight: '300px' }}>
              <ChatBox requestId={activeRequestId} senderType="customer" />
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
               <div className="spinner" style={{ width: '40px', height: '40px', borderTopColor: 'var(--accent)', marginBottom: '1rem' }}></div>
               <p style={{ color: 'var(--text-dim)' }}>Waiting for vendors to accept...</p>
            </div>
          )}

          {activeRequest?.status === 'accepted' ? (
            <button 
              className="btn btn-primary" 
              style={{ backgroundColor: '#10b981', color: 'white', marginTop: '1rem', width: '100%' }} 
              onClick={() => handleAction('complete')}
            >
              ✅ Mark Job Finished
            </button>
          ) : (
            <button 
              className="btn btn-primary" 
              style={{ backgroundColor: '#ef4444', color: 'white', marginTop: '1rem', width: '100%' }} 
              onClick={() => handleAction('cancel')}
            >
              Cancel Request
            </button>
          )}
        </div>
      ) : (
        <div className="customer-card fade-in">
          {/* Header */}
          <div className="card-header">
            <h1>📍 Create a Service Request</h1>
            <p>Post your request — vendors within your radius will see it on their map.</p>
          </div>

          {/* Form */}
          <form id="request-form" className="form" onSubmit={handleSubmit}>
            {/* Name */}
            <div className="form-group">
              <label className="form-label" htmlFor="customer_name">
                Your Name
              </label>
              <input
                id="customer_name"
                name="customer_name"
                className="form-input"
                type="text"
                placeholder="e.g. Rahul Sharma"
                value={form.customer_name}
                onChange={handleChange}
                required
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="form-group">
              <label className="form-label" htmlFor="description">
                Request Description
              </label>
              <textarea
                id="description"
                name="description"
                className="form-textarea"
                placeholder="Describe the service you need..."
                value={form.description}
                onChange={handleChange}
                required
              />
            </div>

            {/* Location */}
            <div className="form-group">
              <div className="location-header">
                <label className="form-label">Your Location (lat / lng)</label>
                <button
                  id="get-location-btn"
                  type="button"
                  className="location-btn"
                  onClick={handleGeolocate}
                  disabled={gettingLoc}
                >
                  {gettingLoc ? (
                    <>
                      <span className="spinner" style={{ borderTopColor: 'var(--blue)' }} />
                      Locating…
                    </>
                  ) : (
                    <>📡 Use My Location</>
                  )}
                </button>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="latitude">Latitude</label>
                  <input
                    id="latitude"
                    name="latitude"
                    className="form-input"
                    type="number"
                    step="any"
                    placeholder="28.6315"
                    value={form.latitude}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="longitude">Longitude</label>
                  <input
                    id="longitude"
                    name="longitude"
                    className="form-input"
                    type="number"
                    step="any"
                    placeholder="77.2167"
                    value={form.longitude}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Submit */}
            <button
              id="submit-request-btn"
              type="submit"
              className="btn btn-primary"
              disabled={loading || !isValid}
            >
              {loading ? (
                <>
                  <span className="spinner" style={{ borderTopColor: '#070d1a' }} />
                  Submitting…
                </>
              ) : (
                '📍 Submit Request'
              )}
            </button>

            {/* Toast feedback */}
            {toast && (
              <div id="form-toast" className={`toast toast-${toast.type} fade-in`}>
                {toast.msg}
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  )
}
