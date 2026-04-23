from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, enable_postgis
import models
from routers import requests as requests_router
from routers import vendors as vendors_router
from routers import websockets as websockets_router

app = FastAPI(
    title="GeoLocate API",
    description="Geo-based real-time service request broadcasting system",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    """Enable PostGIS extension and create all tables on app startup."""
    enable_postgis()
    models.Base.metadata.create_all(bind=engine)


app.include_router(requests_router.router)
app.include_router(vendors_router.router)
app.include_router(websockets_router.router)


@app.get("/", tags=["health"])
def root():
    return {"status": "ok", "message": "GeoLocate API is running 🗺️"}
