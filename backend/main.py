from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional

from . import models
from .database import SessionLocal, engine

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="MCP.click UI API")

# Allow local dev from Vite
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency to get the database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class TraceBase(BaseModel):
    kind: str
    ts: int
    requestId: Optional[str] = None
    url: Optional[str] = None
    method: Optional[str] = None
    status: Optional[int] = None
    headers: Optional[dict] = None
    body: Optional[dict] = None
    label: Optional[str] = None
    locator: Optional[str] = None
    fields: Optional[dict] = None

class TraceCreate(TraceBase):
    pass

class Trace(TraceBase):
    id: int

    class Config:
        from_attributes = True

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/api/traces", response_model=List[Trace])
def create_traces(traces: List[TraceCreate], db: Session = Depends(get_db)):
    db_traces = [models.Trace(**trace.model_dump()) for trace in traces]
    db.add_all(db_traces)
    db.commit()
    for db_trace in db_traces:
        db.refresh(db_trace)
    return db_traces

@app.get("/api/traces", response_model=List[Trace])
def read_traces(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    traces = db.query(models.Trace).offset(skip).limit(limit).all()
    return traces
