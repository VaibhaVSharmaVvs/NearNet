import datetime
from pydantic import BaseModel, Field
from typing import List


class RequestCreate(BaseModel):
    customer_name: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., min_length=1, max_length=500)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class RequestOut(BaseModel):
    id: int
    customer_name: str
    description: str
    latitude: float
    longitude: float
    created_at: datetime.datetime
    expires_at: datetime.datetime
    is_active: bool
    status: str
    accepted_by_vendor_id: int | None = None

    model_config = {"from_attributes": True}

class RequestAccept(BaseModel):
    vendor_id: int


class VendorOut(BaseModel):
    id: int
    name: str
    latitude: float
    longitude: float

    model_config = {"from_attributes": True}

class MessageCreate(BaseModel):
    sender_type: str = Field(..., pattern="^(vendor|customer)$")
    message: str = Field(..., min_length=1, max_length=1000)

class MessageOut(BaseModel):
    id: int
    request_id: int
    sender_type: str
    message: str
    timestamp: datetime.datetime

    model_config = {"from_attributes": True}

class RequestStatusUpdate(BaseModel):
    action: str = Field(..., pattern="^(complete|cancel|quit)$")
    actor_type: str = Field(..., pattern="^(customer|vendor)$")
