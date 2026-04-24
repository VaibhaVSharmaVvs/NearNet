from fastapi import APIRouter, Depends, Query, HTTPException
import datetime
import asyncio
from sqlalchemy.orm import Session
from sqlalchemy import text, func, update, and_, or_
from typing import List
from fastapi.encoders import jsonable_encoder

from database import get_db
import models
import schemas
from ws_manager import manager, get_request_broadcast_cells

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
    
    # Broadcast to geo buckets (3x3 safety net)
    cells = get_request_broadcast_cells(db_req.latitude, db_req.longitude)
    payload = {"type": "new_request", "data": jsonable_encoder(db_req)}
    for cell in cells:
        asyncio.create_task(manager.broadcast(cell, payload))
    
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
                and_(models.Request.status == "accepted", models.Request.accepted_by_vendor_id == vendor_id)
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

    # Prevent vendor from hoarding requests
    active_for_vendor = db.query(models.Request).filter(
        models.Request.accepted_by_vendor_id == payload.vendor_id,
        models.Request.status == "accepted",
        models.Request.is_active == True,
        models.Request.expires_at > func.now()
    ).first()
    if active_for_vendor and active_for_vendor.id != request_id:
        raise HTTPException(status_code=409, detail="You already have an active request. Complete or quit it first.")

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
    req = db.query(models.Request).get(request_id)
    
    payload = {"type": "status_update", "data": jsonable_encoder(req)}
    cells = get_request_broadcast_cells(req.latitude, req.longitude)
    for cell in cells:
        asyncio.create_task(manager.broadcast(cell, payload))
    asyncio.create_task(manager.broadcast(f"request_{request_id}", payload))
    
    return req


@router.get("/{request_id}", response_model=schemas.RequestOut)
def get_request(request_id: int, db: Session = Depends(get_db)):
    """Fetch a single request by ID."""
    req = db.query(models.Request).filter(models.Request.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    return req


@router.patch("/{request_id}/status", response_model=schemas.RequestOut)
def update_status(request_id: int, payload: schemas.RequestStatusUpdate, db: Session = Depends(get_db)):
    """Update the status of a request (Complete, Cancel, or Quit)."""
    req = db.query(models.Request).filter(models.Request.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if payload.actor_type == "customer":
        if payload.action == "cancel":
            req.status = "cancelled"
            req.is_active = False
        elif payload.action == "complete":
            if req.status != "accepted":
                raise HTTPException(status_code=400, detail="Can only complete an accepted request.")
            req.status = "completed"
            req.is_active = False
        else:
            raise HTTPException(status_code=400, detail="Invalid action for customer.")
            
    elif payload.actor_type == "vendor":
        if payload.action == "quit":
            if req.status != "accepted":
                raise HTTPException(status_code=400, detail="Can only quit an accepted request.")
            req.status = "pending"
            req.accepted_by_vendor_id = None
        else:
            raise HTTPException(status_code=400, detail="Invalid action for vendor.")
            
    db.commit()
    db.refresh(req)
    
    payload = {"type": "status_update", "data": jsonable_encoder(req)}
    cells = get_request_broadcast_cells(req.latitude, req.longitude)
    for cell in cells:
        asyncio.create_task(manager.broadcast(cell, payload))
    asyncio.create_task(manager.broadcast(f"request_{request_id}", payload))
    
    return req


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


@router.get("/{request_id}/messages", response_model=List[schemas.MessageOut])
def get_messages(request_id: int, db: Session = Depends(get_db)):
    """Fetch all messages for a specific request."""
    req = db.query(models.Request).filter(models.Request.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
        
    return (
        db.query(models.Message)
        .filter(models.Message.request_id == request_id)
        .order_by(models.Message.timestamp.asc(), models.Message.id.asc())
        .all()
    )

@router.post("/{request_id}/messages", response_model=schemas.MessageOut, status_code=201)
def create_message(request_id: int, payload: schemas.MessageCreate, db: Session = Depends(get_db)):
    """Add a new message to a specific request."""
    req = db.query(models.Request).filter(models.Request.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
        
    msg = models.Message(
        request_id=request_id,
        sender_type=payload.sender_type,
        message=payload.message
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    
    payload = {"type": "new_message", "data": jsonable_encoder(msg)}
    asyncio.create_task(manager.broadcast(f"request_{request_id}", payload))
    
    return msg
