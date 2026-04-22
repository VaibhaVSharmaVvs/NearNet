"""
Seed the database with sample vendors spread across Delhi / NCR.

Usage:
    cd backend
    python seed.py
"""

from database import engine, enable_postgis
import models

# ---------------------------------------------------------------------------
# Seed data — 8 vendors across Delhi/NCR
# ---------------------------------------------------------------------------
VENDORS = [
    {
        "name": "QuickFix Delhi Central",
        "area": "Connaught Place",
        "latitude": 28.6315,
        "longitude": 77.2167,
    },
    {
        "name": "TechServe Gurgaon",
        "area": "Gurgaon Cyber Hub",
        "latitude": 28.4950,
        "longitude": 77.0888,
    },
    {
        "name": "Smart Solutions Noida",
        "area": "Noida Sector 18",
        "latitude": 28.5679,
        "longitude": 77.3211,
    },
    {
        "name": "Dwarka Pro Services",
        "area": "Dwarka Sector 10",
        "latitude": 28.5921,
        "longitude": 77.0460,
    },
    {
        "name": "NorthZone Vendors",
        "area": "Rohini Sector 7",
        "latitude": 28.7155,
        "longitude": 77.1150,
    },
    {
        "name": "SouthDelhi Experts",
        "area": "Lajpat Nagar",
        "latitude": 28.5705,
        "longitude": 77.2440,
    },
    {
        "name": "EastSide Services",
        "area": "Indirapuram",
        "latitude": 28.6411,
        "longitude": 77.3646,
    },
    {
        "name": "WestDelhi Pros",
        "area": "Janakpuri",
        "latitude": 28.6219,
        "longitude": 77.0878,
    },
]


def seed():
    from sqlalchemy.orm import Session

    # Ensure PostGIS extension exists and tables are created
    enable_postgis()
    models.Base.metadata.create_all(bind=engine)

    with Session(engine) as db:
        existing = db.query(models.Vendor).count()
        if existing > 0:
            print(f"[OK] {existing} vendor(s) already in DB -- skipping seed.")
            return

        for v in VENDORS:
            # EWKT: longitude first, latitude second (PostGIS convention)
            location_ewkt = f"SRID=4326;POINT({v['longitude']} {v['latitude']})"
            vendor = models.Vendor(
                name=v["name"],
                latitude=v["latitude"],
                longitude=v["longitude"],
                location=location_ewkt,
            )
            db.add(vendor)

        db.commit()
        print(f"[OK] Seeded {len(VENDORS)} vendors across Delhi NCR:\n")
        for v in VENDORS:
            print(f"   - {v['name']:35s} ({v['area']})  @ {v['latitude']}, {v['longitude']}")


if __name__ == "__main__":
    seed()
