import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const client = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
})

/** Create a new service request */
export const createRequest = (data) => client.post('/requests', data)

/** Fetch active requests within `radius` metres of (lat, lng) */
export const getNearbyRequests = (lat, lng, radius = 5000) =>
  client.get('/requests/nearby', { params: { lat, lng, radius } })

/** List all vendors */
export const getVendors = () => client.get('/vendors')

export default client
