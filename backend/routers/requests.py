from fastapi import APIRouter, Depends, Query
import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from typing import List

from database import get_db
import models
import schemas

router = APIRouter(prefix="/requests", tags=["requests"])


@router.post("", response_model=schemas.RequestOut, status_code=201)
def create_request(req: schemas.RequestCreate, db: Session = Depends(get_db)):
    """Create a new service request and store it with a PostGIS geography point."""
    # EWKT: longitude first, then latitude (PostGIS convention)
    location_ewkt = f"SRID=4326;POINT({req.longitude} {req.latitude})"

    db_req = models.Request(
        customer_name=req.customer_name,
        description=req.description,
        latitude=req.latitude,
        longitude=req.longitude,
        location=location_ewkt,
    )
    db.add(db_req)
    db.commit()
    db.refresh(db_req)
    return db_req


@router.get("/nearby", response_model=List[schemas.RequestOut])
def get_nearby_requests(
    lat: float = Query(..., ge=-90, le=90, description="Vendor latitude"),
    lng: float = Query(..., ge=-180, le=180, description="Vendor longitude"),
    radius: float = Query(
        5000, ge=100, le=50000, description="Search radius in meters"
    ),
    db: Session = Depends(get_db),
):
    """
    Return all active requests whose location is within `radius` metres of (lat, lng).
    Uses PostGIS ST_DWithin on geography columns (great-circle distance in metres).
    """
    results = (
        db.query(models.Request)
        .filter(
            models.Request.is_active == True,
            models.Request.expires_at > func.now(),
            text(
                "ST_DWithin("
                "  location,"
                "  ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,"
                "  :radius"
                ")"
            ).bindparams(lat=lat, lng=lng, radius=radius),
        )
        .order_by(models.Request.created_at.desc())
        .all()
    )
    return results


@router.get("", response_model=List[schemas.RequestOut])
def list_all_requests(db: Session = Depends(get_db)):
    """List all active requests (debug/testing endpoint)."""
    return (
        db.query(models.Request)
        .filter(
            models.Request.is_active == True,
            models.Request.expires_at > func.now(),
        )
        .order_by(models.Request.created_at.desc())
        .all()
    )
