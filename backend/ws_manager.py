import math
from fastapi import WebSocket
from typing import Dict, Set

class ConnectionManager:
    def __init__(self):
        # Channel -> Set of WebSockets
        self.channels: Dict[str, Set[WebSocket]] = {}
        # Vendor ID -> WebSocket (for identity tracking)
        self.vendors: Dict[int, WebSocket] = {}

    async def connect(self, websocket: WebSocket, vendor_id: int = None, channels: list[str] = None):
        await websocket.accept()
        if vendor_id:
            self.vendors[vendor_id] = websocket
        
        if channels:
            for channel in channels:
                self.subscribe(websocket, channel)

    def subscribe(self, websocket: WebSocket, channel: str):
        if channel not in self.channels:
            self.channels[channel] = set()
        self.channels[channel].add(websocket)

    def unsubscribe(self, websocket: WebSocket, channel: str):
        if channel in self.channels and websocket in self.channels[channel]:
            self.channels[channel].remove(websocket)
            # Cleanup empty channels to prevent memory leaks
            if len(self.channels[channel]) == 0:
                del self.channels[channel]

    def disconnect(self, websocket: WebSocket, vendor_id: int = None):
        if vendor_id and vendor_id in self.vendors:
            if self.vendors[vendor_id] == websocket:
                del self.vendors[vendor_id]
        
        empty_channels = []
        for channel, conns in self.channels.items():
            if websocket in conns:
                conns.remove(websocket)
                if len(conns) == 0:
                    empty_channels.append(channel)
        
        for ch in empty_channels:
            del self.channels[ch]

    async def broadcast(self, channel: str, message: dict):
        if channel in self.channels:
            for connection in list(self.channels[channel]):
                try:
                    await connection.send_json(message)
                except Exception:
                    self.disconnect(connection)

manager = ConnectionManager()

def get_grid_cell(lat: float, lng: float) -> str:
    """Returns the precise 0.05 degree bucket for a coordinate."""
    # 0.05 degrees is approx 5.5km
    grid_lat = round(math.floor(lat / 0.05) * 0.05, 3)
    grid_lng = round(math.floor(lng / 0.05) * 0.05, 3)
    return f"geo_{grid_lat}_{grid_lng}"

def get_vendor_subscription_cells(lat: float, lng: float, radius_m: float) -> list[str]:
    """Calculates all 0.05 grid cells that intersect the vendor's radius bounding box."""
    # 1 degree lat = 111,320 meters
    deg_lat = radius_m / 111320.0
    deg_lng = radius_m / (111320.0 * math.cos(math.radians(lat)))
    
    min_lat, max_lat = lat - deg_lat, lat + deg_lat
    min_lng, max_lng = lng - deg_lng, lng + deg_lng
    
    cells = set()
    step = 0.05
    
    cur_lat = math.floor(min_lat / step) * step
    end_lat = math.floor(max_lat / step) * step
    
    while cur_lat <= end_lat + 0.001:
        cur_lng = math.floor(min_lng / step) * step
        end_lng = math.floor(max_lng / step) * step
        while cur_lng <= end_lng + 0.001:
            cells.add(f"geo_{round(cur_lat, 3)}_{round(cur_lng, 3)}")
            cur_lng += step
        cur_lat += step
        
    return list(cells)
