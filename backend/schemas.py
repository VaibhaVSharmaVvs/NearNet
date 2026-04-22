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
    is_active: bool

    model_config = {"from_attributes": True}


class VendorOut(BaseModel):
    id: int
    name: str
    latitude: float
    longitude: float

    model_config = {"from_attributes": True}
