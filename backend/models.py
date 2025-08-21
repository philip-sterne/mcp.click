from sqlalchemy import Column, Integer, String, JSON, BigInteger
from .database import Base

class Trace(Base):
    __tablename__ = "traces"

    id = Column(Integer, primary_key=True, index=True)
    kind = Column(String, index=True)
    ts = Column(BigInteger)
    requestId = Column(String, index=True, nullable=True)
    url = Column(String, nullable=True)
    method = Column(String, nullable=True)
    status = Column(Integer, nullable=True)
    headers = Column(JSON, nullable=True)
    body = Column(JSON, nullable=True)
    label = Column(String, nullable=True)
    locator = Column(String, nullable=True)
    fields = Column(JSON, nullable=True)
