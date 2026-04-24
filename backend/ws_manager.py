import math
import asyncio
from fastapi import WebSocket
from typing import Dict, Set

class ConnectionManager:
    def __init__(self):
        # Channel -> Set of WebSockets
        self.channels: Dict[str, Set[WebSocket]] = {}
        # WebSocket -> Set of Channels (for O(1) disconnect cleanup)
        self.socket_channels: Dict[WebSocket, Set[str]] = {}
        # Vendor ID -> Dict with socket and channels
        self.vendors: Dict[int, dict] = {}

    async def connect(self, websocket: WebSocket, vendor_id: int = None, channels: list[str] = None):
        await websocket.accept()
        self.socket_channels[websocket] = set()
        
        if vendor_id:
            self.vendors[vendor_id] = {"socket": websocket, "channels": set()}
        
        if channels:
            for channel in channels:
                self.subscribe(websocket, channel, vendor_id)

    def subscribe(self, websocket: WebSocket, channel: str, vendor_id: int = None):
        if channel not in self.channels:
            self.channels[channel] = set()
        self.channels[channel].add(websocket)
        self.socket_channels[websocket].add(channel)
        
        if vendor_id and vendor_id in self.vendors:
            self.vendors[vendor_id]["channels"].add(channel)

    def unsubscribe(self, websocket: WebSocket, channel: str, vendor_id: int = None):
        if channel in self.channels and websocket in self.channels[channel]:
            self.channels[channel].remove(websocket)
            if len(self.channels[channel]) == 0:
                del self.channels[channel]
                
        if websocket in self.socket_channels and channel in self.socket_channels[websocket]:
            self.socket_channels[websocket].remove(channel)
            
        if vendor_id and vendor_id in self.vendors:
            if channel in self.vendors[vendor_id]["channels"]:
                self.vendors[vendor_id]["channels"].remove(channel)

    def disconnect(self, websocket: WebSocket, vendor_id: int = None):
        if vendor_id and vendor_id in self.vendors:
            del self.vendors[vendor_id]
        
        if websocket in self.socket_channels:
            subscribed_channels = list(self.socket_channels[websocket])
            for channel in subscribed_channels:
                if channel in self.channels:
                    self.channels[channel].discard(websocket)
                    if len(self.channels[channel]) == 0:
                        del self.channels[channel]
            del self.socket_channels[websocket]

    async def broadcast(self, channel: str, message: dict):
        if channel in self.channels:
            for connection in list(self.channels[channel]):
                task = asyncio.create_task(self._send_safe(connection, message))
                task.add_done_callback(lambda t: t.exception())

    async def _send_safe(self, websocket: WebSocket, message: dict):
        try:
            await websocket.send_json(message)
        except Exception:
            self.disconnect(websocket)

manager = ConnectionManager()

def get_grid_cell(lat: float, lng: float) -> str:
    """Returns the precise 0.01 degree bucket using int multiplication to avoid float rounding bugs."""
    grid_lat = int(lat * 100)
    grid_lng = int(lng * 100)
    return f"geo_{grid_lat}_{grid_lng}"

def get_request_broadcast_cells(lat: float, lng: float) -> list[str]:
    """Safety Net: Broadcasts to the 3x3 grid around the request to cover edge boundary cases."""
    center_lat = int(lat * 100)
    center_lng = int(lng * 100)
    
    cells = []
    for d_lat in [-1, 0, 1]:
        for d_lng in [-1, 0, 1]:
            cells.append(f"geo_{center_lat + d_lat}_{center_lng + d_lng}")
    return cells

def get_vendor_subscription_cells(lat: float, lng: float, radius_m: float) -> list[str]:
    """Calculates all 0.01 grid cells that intersect the vendor's radius bounding box."""
    deg_lat = radius_m / 111320.0
    deg_lng = radius_m / (111320.0 * math.cos(math.radians(lat)))
    
    min_lat, max_lat = lat - deg_lat, lat + deg_lat
    min_lng, max_lng = lng - deg_lng, lng + deg_lng
    
    start_lat = int(min_lat * 100)
    end_lat = int(max_lat * 100)
    start_lng = int(min_lng * 100)
    end_lng = int(max_lng * 100)
    
    cells = set()
    for cur_lat in range(start_lat, end_lat + 1):
        for cur_lng in range(start_lng, end_lng + 1):
            cells.add(f"geo_{cur_lat}_{cur_lng}")
            
    cells_list = list(cells)
    if len(cells_list) > 25:
        cells_list = cells_list[:25]
        
    return cells_list
