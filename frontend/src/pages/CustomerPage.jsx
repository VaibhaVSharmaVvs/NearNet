import { useState } from 'react'
import { createRequest } from '../api/client'

export default function CustomerPage() {
  const [form, setForm] = useState({
    customer_name: '',
    description: '',
    latitude: '',
    longitude: '',
  })
  const [loading, setLoading] = useState(false)
  const [gettingLoc, setGettingLoc] = useState(false)
  const [toast, setToast] = useState(null) // { type: 'success'|'error', msg: string }

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
      await createRequest({
        customer_name: form.customer_name,
        description: form.description,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
      })
      setToast({
        type: 'success',
        msg: '✅ Request submitted! Nearby vendors will see it on their map within seconds.',
      })
      setForm({ customer_name: '', description: '', latitude: '', longitude: '' })
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
    </div>
  )
}
