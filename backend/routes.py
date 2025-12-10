from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import shutil
import os
from pathlib import Path

from database import get_db
from models import Document, User
from schemas import DocumentCreate, DocumentResponse
from worker import enqueue_document_processing
from embeddings import generate_embedding
from qdrant_config import get_qdrant_client, COLLECTION_NAME

from llm_service import generate_answer

from auth import hash_password, verify_password, create_access_token
from schemas import UserCreate, UserLogin, Token, UserResponse

router = APIRouter()

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

@router.post("/upload", response_model=DocumentResponse)
async def upload_document(file: UploadFile = File(...), db: Session = Depends(get_db)):
    file_path = UPLOAD_DIR / file.filename
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    db_document = Document(filename=file.filename, file_path=str(file_path))
    db.add(db_document)
    db.commit()
    db.refresh(db_document)

    job_id = enqueue_document_processing(db_document.id, str(file_path))
    print(f"Enqueued job {job_id} for document {db_document.id}")

    return db_document

@router.get("/documents", response_model=List[DocumentResponse])
def list_documents(db: Session = Depends(get_db)):
    documents = db.query(Document).all()
    return documents

@router.get("/documents/{document_id}", response_model=DocumentResponse)
def get_document(document_id: int, db: Session = Depends(get_db)):
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document

from pydantic import BaseModel

class SearchQuery(BaseModel):
    query: str

@router.post("/search")
def search_documents(search: SearchQuery, db: Session = Depends(get_db)):
    query_embedding = generate_embedding(search.query)
    qdrant_client = get_qdrant_client()
    search_results = qdrant_client.query_points(
        collection_name=COLLECTION_NAME,
        query=query_embedding,
        limit=5,
    ).points

    results = []
    for hit in search_results:
        results.append({
            "document_id": hit.payload["document_id"],
            "text": hit.payload["text"],
            "score": hit.score,
            "chunk_index": hit.payload["chunk_index"]
        })
    
    return {"query": search.query, "results": results}

@router.post("/ask")
def ask_question(question: str, db: Session = Depends(get_db)):
    query_embedding = generate_embedding(question)
    qdrant_client = get_qdrant_client()
    search_results = qdrant_client.query_points(
        collection_name=COLLECTION_NAME,
        query=query_embedding,
        limit=3
    ).points

    context_chunks = [hit.payload["text"] for hit in search_results]

    answer = generate_answer(question, context_chunks)

    sources = []
    for hit in search_results:
        doc = db.query(Document).filter(Document.id == hit.payload["document_id"]).first()
        sources.append({
            "document": doc.filename if doc else "Unknown",
            "score": hit.score
        })
    
    return {
        "question": question,
        "answer": answer,
        "sources": sources
    }

@router.post("/register", response_model=UserResponse)
def register(user: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == user.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    db_user = User(
        email=user.email,
        name=user.name,
        hashed_password=hash_password(user.password)
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.post("/login", response_model=Token)
def login(credentials: UserLogin, db:Session = Depends(get_db)):
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}