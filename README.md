# AI Knowledgebase for Teams

A microservices-based RAG (Retrieval-Augmented Generation) application designed for teams to ingest documents and ask questions using LLMs.

## Architecture
- **Frontend**: React + Vite
- **Backend**: FastAPI
- **Vector DB**: Qdrant
- **Storage**: MinIO (S3 compatible)
- **Database**: PostgreSQL
- **Orchestration**: Kubernetes

## Getting Started

### Prerequisites
- Docker & Docker Compose
- Python 3.11+
- Node.js 18+

### Local Development
1. Start infrastructure:
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```
2. Start Backend:
   ```bash
   cd services/api
   poetry install
   poetry run uvicorn app.main:app --reload
   ```
3. Start Frontend:
   ```bash
   cd services/frontend
   npm install
   npm run dev
   ```
