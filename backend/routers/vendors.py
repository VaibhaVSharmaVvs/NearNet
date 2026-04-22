from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from database import get_db
import models
import schemas

router = APIRouter(prefix="/vendors", tags=["vendors"])


@router.get("", response_model=List[schemas.VendorOut])
def get_vendors(db: Session = Depends(get_db)):
    """List all seeded vendors ordered by ID."""
    return db.query(models.Vendor).order_by(models.Vendor.id).all()
