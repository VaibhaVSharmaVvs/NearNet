from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.orm import Session
from database import get_db
import models
from ws_manager import manager, get_vendor_subscription_cells

router = APIRouter(prefix="/ws", tags=["websockets"])

@router.websocket("/vendor/{vendor_id}")
async def websocket_vendor_endpoint(
    websocket: WebSocket,
    vendor_id: int,
    lat: float = Query(...),
    lng: float = Query(...),
    radius: float = Query(...),
    db: Session = Depends(get_db)
):
    """
    Vendor connection. Subscribes the vendor to all geo grid cells 
    that intersect their specified radius bounding box.
    """
    # Security MVP: Validate vendor exists
    vendor = db.query(models.Vendor).filter(models.Vendor.id == vendor_id).first()
    if not vendor:
        await websocket.close(code=1008)
        return

    cells = get_vendor_subscription_cells(lat, lng, radius)
    await manager.connect(websocket, vendor_id=vendor_id, channels=cells)
    
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, vendor_id=vendor_id)


@router.websocket("/request/{request_id}")
async def websocket_request_endpoint(
    websocket: WebSocket,
    request_id: int
):
    """
    Customer or active Vendor connection for a specific request.
    Subscribes to updates and chat messages for this request.
    """
    channel = f"request_{request_id}"
    await manager.connect(websocket, channels=[channel])
    
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
