from fastapi import APIRouter, Depends, Query, HTTPException
import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text, func, update, and_, or_
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
    vendor_id: int | None = Query(None, description="Vendor ID requesting the data"),
    db: Session = Depends(get_db),
):
    """
    Return all active requests whose location is within `radius` metres of (lat, lng).
    If vendor_id is provided, includes both 'pending' and requests 'accepted' by this vendor.
    """
    filters = [
        models.Request.is_active == True,
        models.Request.expires_at > func.now(),
        text(
            "ST_DWithin("
            "  location,"
            "  ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,"
            "  :radius"
            ")"
        ).bindparams(lat=lat, lng=lng, radius=radius)
    ]

    if vendor_id:
        filters.append(
            or_(
                models.Request.status == "pending",
                models.Request.accepted_by_vendor_id == vendor_id
            )
        )
    else:
        filters.append(models.Request.status == "pending")

    results = (
        db.query(models.Request)
        .filter(*filters)
        .order_by(models.Request.created_at.desc())
        .all()
    )
    return results


@router.post("/{request_id}/accept", response_model=schemas.RequestOut)
def accept_request(request_id: int, payload: schemas.RequestAccept, db: Session = Depends(get_db)):
    """Atomically accept a pending request for a specific vendor."""
    vendor_exists = db.query(models.Vendor).filter(models.Vendor.id == payload.vendor_id).first()
    if not vendor_exists:
        raise HTTPException(status_code=404, detail="Vendor not found")

    stmt = (
        update(models.Request)
        .where(
            and_(
                models.Request.id == request_id,
                models.Request.status == "pending",
                models.Request.is_active == True,
                models.Request.expires_at > func.now()
            )
        )
        .values(
            status="accepted",
            accepted_by_vendor_id=payload.vendor_id
        )
    )
    result = db.execute(stmt)
    
    if result.rowcount == 0:
        # Atomic update failed. Find out why for clean UX feedback.
        existing = db.query(models.Request).filter(models.Request.id == request_id).first()
        if not existing:
            raise HTTPException(status_code=404, detail="Request not found")
        if existing.status == "accepted" and existing.accepted_by_vendor_id == payload.vendor_id:
            return existing # Clean double-accept prevention
        raise HTTPException(status_code=409, detail="Request is no longer available or already taken")
        
    db.commit()
    return db.query(models.Request).get(request_id)


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
