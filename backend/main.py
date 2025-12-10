from fastapi import FastAPI
from database import engine, Base
from models import Document, User
from routes import router
from qdrant_config import init_collection

Base.metadata.create_all(bind=engine)
init_collection()

app = FastAPI(title = "Knowledgebase API")

app.include_router(router, prefix="/api", tags=["documents"])

@app.get("/")
def read_root():
    return {"message": "Hello World", "database": "connected"}