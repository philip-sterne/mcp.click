import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.main import app, get_db
from backend.database import Base

# Use a test-specific database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="module")
def anyio_backend():
    return "asyncio"

@pytest.mark.asyncio
async def test_health_check():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

@pytest.mark.asyncio
async def test_create_and_read_traces():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Create a trace
        trace_data = {
            "kind": "request",
            "ts": 1234567890,
            "url": "https://example.com",
        }
        response = await ac.post("/api/traces", json=[trace_data])
        assert response.status_code == 200
        created_trace = response.json()[0]
        assert created_trace["url"] == "https://example.com"

        # Read traces
        response = await ac.get("/api/traces")
        assert response.status_code == 200
        traces = response.json()
        assert len(traces) > 0
        assert traces[0]["url"] == "https://example.com"
