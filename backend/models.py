import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float
from geoalchemy2 import Geography
from database import Base


class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    # Geography type stores coords and uses meters for ST_DWithin
    location = Column(
        Geography(geometry_type="POINT", srid=4326),
        nullable=False,
    )


class Request(Base):
    __tablename__ = "requests"

    id = Column(Integer, primary_key=True, index=True)
    customer_name = Column(String, nullable=False)
    description = Column(String, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    location = Column(
        Geography(geometry_type="POINT", srid=4326),
        nullable=False,
    )
    created_at = Column(
        DateTime,
        default=datetime.datetime.utcnow,
        nullable=False,
    )
    is_active = Column(Boolean, default=True, nullable=False)
