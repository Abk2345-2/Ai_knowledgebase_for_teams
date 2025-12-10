from redis import Redis
from rq import Queue
from document_processor import process_document
from database import SessionLocal
from models import Document
import os

from embeddings import generate_embeddings_batch
from qdrant_config import get_qdrant_client, COLLECTION_NAME
from qdrant_client.models import PointStruct
import uuid

redis_conn = Redis(
    host = os.getenv("REDIS_HOST", "redis"),
    port = int(os.getenv("REDIS_PORT", 6379)),
)

task_queue = Queue(
    'document_processing',
    connection = redis_conn
)

def process_document_job(document_id: int, file_path: str):
    print(f"Processing document {document_id}...")

    result = process_document(file_path)

    if result['success']:
        chunks = result['chunks']
        print(f"Generating embeddings for {len(chunks)} chunks...")
        
        # Check if we have chunks to process
        if len(chunks) == 0:
            print(f"Warning: Document {document_id} produced 0 chunks. Text length: {len(result.get('text', ''))}")
            print("This might be a scanned PDF or the text extraction failed.")
        else:
            embeddings = generate_embeddings_batch(chunks)

            qdrant_client = get_qdrant_client()
            points = []

            for idx, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
                point = PointStruct(
                    id=str(uuid.uuid4()),
                    vector=embedding,
                    payload={
                        "document_id": document_id,
                        "chunk_index": idx,
                        "text": chunk,
                    }
                )
                points.append(point)
            
            qdrant_client.upsert(
                collection_name=COLLECTION_NAME,
                points=points,
            )

            print(f"Stored {len(points)} vectors in Qdrant for document {document_id}")

    db = SessionLocal()
    try:
        doc = db.query(Document).filter(Document.id == document_id).first()
        if doc:
            if result['success']:
                doc.processed = True
                print(f"Documet {document_id} processed: {result['num_chunks']} chunks")
            else:
                print(f"Documet {document_id} failed: {result['error']}")
            db.commit()
    finally:
        db.close()
    
    return result

def enqueue_document_processing(document_id: int, file_path: str):
    job = task_queue.enqueue(
        process_document_job,
        document_id,
        file_path,
        job_timeout=10*60,
    )
    return job.id
