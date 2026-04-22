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
export const getNearbyRequests = async (lat, lng, radius, vendorId = null) => {
  const url = new URL(`${API_BASE}/requests/nearby`);
  url.searchParams.append("lat", lat);
  url.searchParams.append("lng", lng);
  url.searchParams.append("radius", radius);
  if (vendorId) {
    url.searchParams.append("vendor_id", vendorId);
  }
  
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Failed to fetch nearby requests");
  return res.json();
};

export const acceptRequest = async (requestId, vendorId) => {
  const res = await fetch(`${API_BASE}/requests/${requestId}/accept`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ vendor_id: vendorId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Failed to accept request");
  }
  return res.json();
};

/** List all vendors */
export const getVendors = () => client.get('/vendors')

export default client
