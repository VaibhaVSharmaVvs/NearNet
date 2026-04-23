# GeoLocate — Geo-based Real-time Service Request MVP

A prototype web app where customers create geo-tagged service requests and vendors within a geographic radius see those requests as markers on an interactive map, updated every 5 seconds.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend API | FastAPI + Python |
| Database | PostgreSQL 15 + PostGIS 3.3 (via Docker) |
| Geo queries | PostGIS `ST_DWithin` (geography / great-circle distance) |
| Frontend | React + Vite |
| Map | Leaflet.js + react-leaflet + OpenStreetMap tiles |
| Realtime | HTTP polling every 5 seconds |

---

## Project Structure

```
GeoLocate/
├── docker-compose.yml       # PostgreSQL + PostGIS
├── backend/
│   ├── main.py              # FastAPI app
│   ├── database.py          # SQLAlchemy engine + PostGIS enable
│   ├── models.py            # Vendor & Request ORM models
│   ├── schemas.py           # Pydantic v2 schemas
│   ├── seed.py              # Seeds 8 Delhi/NCR vendors
│   ├── requirements.txt
│   ├── .env
│   └── routers/
│       ├── requests.py      # POST /requests, GET /requests/nearby
│       └── vendors.py       # GET /vendors
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── package.json
    └── src/
        ├── App.jsx
        ├── index.css
        ├── api/client.js
        ├── pages/
        │   ├── CustomerPage.jsx
        │   └── VendorPage.jsx
        └── components/
            └── MapView.jsx
```

---

## Setup & Running

### Prerequisites
- **Docker Desktop** (running)
- **Python 3.10+** with pip
- **Node.js 18+** with npm

---

### Step 1 — Start the Database

```powershell
docker compose up -d
```

This starts a `postgis/postgis:15-3.3` container. **Note:** Due to potential native PostgreSQL conflicts, this runs exposed on host port **5433**.
The PostGIS extension is enabled automatically by the backend on first startup.

Verify it's healthy:
```powershell
docker compose ps
```

---

### Step 2 — Set Up the Backend

```powershell
cd backend
pip install -r requirements.txt
```

#### Seed vendors (run once)
```powershell
python seed.py
```
This inserts **8 vendors** across Delhi / NCR:

| Vendor | Area | Lat | Lng |
|--------|------|-----|-----|
| QuickFix Delhi Central | Connaught Place | 28.6315 | 77.2167 |
| TechServe Gurgaon | Gurgaon Cyber Hub | 28.4950 | 77.0888 |
| Smart Solutions Noida | Noida Sector 18 | 28.5679 | 77.3211 |
| Dwarka Pro Services | Dwarka Sector 10 | 28.5921 | 77.0460 |
| NorthZone Vendors | Rohini Sector 7 | 28.7155 | 77.1150 |
| SouthDelhi Experts | Lajpat Nagar | 28.5705 | 77.2440 |
| EastSide Services | Indirapuram | 28.6411 | 77.3646 |
| WestDelhi Pros | Janakpuri | 28.6219 | 77.0878 |

#### Start the API server
```powershell
uvicorn main:app --reload
```

API runs at **http://localhost:8000**
Interactive docs: **http://localhost:8000/docs**

---

### Step 3 — Set Up the Frontend

```powershell
cd ..\frontend
npm install
npm run dev
```

Frontend runs at **http://localhost:5173**

---

## API Endpoints

### `POST /requests`
Create a new service request.

**Body (JSON):**
```json
{
  "customer_name": "Rahul Sharma",
  "description": "Need a plumber urgently",
  "latitude": 28.6315,
  "longitude": 77.2167
}
```

### `GET /requests/nearby`
Return active requests within radius of a vendor location.

**Query params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `lat` | float | required | Vendor latitude |
| `lng` | float | required | Vendor longitude |
| `radius` | float | 5000 | Search radius in **metres** |
| `vendor_id` | int | optional | Vendor ID to include jobs claimed by them |

### `POST /requests/{request_id}/accept`
Atomically assigns a pending request to a specific vendor using an enforced DB state check.

**Body (JSON):**
```json
{
  "vendor_id": 1
}
```

### `GET /vendors`
List all seeded vendors.

---

## How to Test End-to-End

1. Open **http://localhost:5173** → lands on **Customer** tab
2. Fill in Name, Description, and coordinates near Connaught Place (`28.6315, 77.2167`)
3. Click **Submit Request**
4. Switch to **Vendor Map** tab
5. Select **"QuickFix Delhi Central"** from the dropdown (located at Connaught Place)
6. An **orange pin** appears on the map within ≤5 seconds (next poll cycle)
7. Click the pin → popup shows customer name, description, and "Chat (Coming Soon)" button
8. Drag the **radius slider** down to 1 km — if the request is > 1 km away it disappears

---

## Configuration

| Setting | Where | Default |
|---------|-------|---------|
| Database URL | `backend/.env` | `postgresql://postgres:postgres@127.0.0.1:5433/geolocate` |
| Poll interval | `frontend/src/pages/VendorPage.jsx` | `5000` ms |
| Default radius | `frontend/src/pages/VendorPage.jsx` | `5000` m |
| API base URL | `frontend/src/api/client.js` | `http://localhost:8000` |

---

## Geo Logic

Locations are stored as PostGIS `GEOGRAPHY(POINT, 4326)` columns (SRID 4326 = WGS84).

Proximity query uses great-circle distance (accurate on a sphere):
```sql
ST_DWithin(
  request.location,
  ST_SetSRID(ST_MakePoint(<vendor_lng>, <vendor_lat>), 4326)::geography,
  <radius_metres>
)
```

---

## Future Extensions (not implemented)

- [ ] WebSocket push instead of polling
- [x] Vendor accepts / rejects a request (Atomic Marketplace Lock implemented)
- [ ] In-app chat between customer and vendor
- [ ] User authentication (JWT)
- [ ] Push notifications
- [ ] Mobile-responsive map layout
