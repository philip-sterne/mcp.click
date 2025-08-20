from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="MCP.click UI API")

# Allow local dev from Vite
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Item(BaseModel):
    id: int
    name: str


@app.get("/health")
async def health():
    return {"status": "ok"}


FAKE_ITEMS = [
    Item(id=1, name="Foo"),
    Item(id=2, name="Bar"),
]


@app.get("/items")
async def list_items() -> list[Item]:
    return FAKE_ITEMS


@app.post("/items", status_code=201)
async def create_item(item: Item) -> Item:
    FAKE_ITEMS.append(item)
    return item
