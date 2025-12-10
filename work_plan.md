# Project 4: AI Knowledgebase for Teams

This document outlines the end-to-end design for the "AI Knowledgebase for Teams" project, covering architecture, components, CI/CD, Kubernetes deployment, security/ops, and a practical milestone plan.

## 1. High-Level Architecture

**Data Flow:**
User (Web UI / Slack / Teams) → Frontend (React) → Backend API (Auth + Gateway) → Ingress → API Gateway (optional) → Microservices

**Microservices:**
*   **Auth Service:** OAuth2 / SSO
*   **Tenant Management / Admin**
*   **Document Ingestion Worker:** Scrapers, upload processor
*   **Embedding & Indexer Service:** Creates embeddings, writes to Vector DB
*   **Vector DB:** Qdrant / Chroma / Weaviate + Metadata DB (Postgres)
*   **LLM Service:** Calls Grok or self-hosted Llama/Mistral
*   **RAG Orchestrator / Retrieval Service:** Retrieves top-k chunks, builds prompt
*   **Conversation Service:** Session/context management
*   **Async Task Queue:** RabbitMQ / Redis Queue / NATS
*   **Caching:** Redis
*   **Monitoring:** Prometheus, Grafana, Alertmanager
*   **Logging:** Loki / ELK

**CI/CD:**
Build → Test → Image → Helm → Deploy to Kubernetes cluster

---

## 2. Component Responsibilities & Recommended Stack

*   **Frontend:** React + Vite. Auth via OAuth2 (Auth0 / Keycloak).
*   **API / Backend:** FastAPI (Python) or Go (Gin). *Recommendation: FastAPI for fast iteration with Python LLM libraries.*
*   **Embeddings:** `sentence-transformers` (local) or Hugging Face embeddings. Can also use provider APIs (e.g., Grok).
*   **Vector DB:** Qdrant (self-hosted, production-ready) or Chroma (quick local dev).
*   **Model / LLM:**
    *   *Option A:* Grok (via provider API) — Easiest.
    *   *Option B:* Open Llama / Mistral self-hosted using KServe / Triton / Ollama.
*   **Database:** PostgreSQL (tenants, metadata, user accounts).
*   **Cache / Broker:** Redis (cache + ephemeral context) + RabbitMQ or Redis Queue for background processing.
*   **Object Store:** S3-compatible (MinIO for on-prem or AWS S3) for stored docs and PDF files.
*   **Kubernetes:** Deploy with Helm. Use Node pools: CPU-only for app, GPU nodes for heavy LLM inference (if self-hosting).
*   **CI/CD:** GitHub Actions (build images, run tests, push to registry, deploy with Helm).
*   **Secrets Management:** SealedSecrets / HashiCorp Vault / External Secrets operator.
*   **Observability:** Prometheus + Grafana, Loki for logs, OpenTelemetry tracing.

---

## 3. Data Flow (Detailed)

1.  **Ingestion:**
    *   User uploads docs (PDF/Markdown/URL).
    *   Stored to S3 (MinIO) and metadata saved in Postgres.
    *   **Ingestion Worker:**
        *   Extracts text (pdfminer / tika / unstructured).
        *   Chunks text with overlap (e.g., 1,000 token windows, 200 token overlap).
        *   Creates embeddings for each chunk.
        *   Writes vector + metadata to Vector DB (Qdrant).

2.  **Querying:**
    *   User asks question → Frontend sends to Backend (with tenant + auth).
    *   **Retrieval Service** queries Vector DB for top-N relevant chunks.
    *   **RAG Orchestrator** prepares a prompt (retrieved chunks + system instruction + user query + optional few-shot examples) and passes it to the LLM Service.
    *   **LLM** returns answer. Response is cached and stored as conversation history.
    *   *Optional:* Run an answer verifier (fact-checker) or cite chunks with confidence scores.
    *   Frontend displays answer with "source links" referencing document chunk metadata.

---

## 4. Kubernetes Deployment & Helm/Manifest Blueprint

Package each microservice as its own Helm chart (or one parent chart with subcharts).

**Key K8s Objects:**
*   **Deployment:** Resource requests/limits.
*   **Service:** ClusterIP.
*   **HPA:** Based on CPU/memory or custom metrics (queue depth).
*   **PodDisruptionBudget**
*   **ConfigMap:** Non-sensitive config.
*   **Secret:** Sensitive data (use External Secrets / Sealed Secrets).
*   **Ingress:** IngressRoute (Traefik) or Ingress-nginx, TLS via cert-manager.

**Example `deployment.yaml` (RAG Service):**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rag-service
spec:
  replicas: 2
  selector:
    matchLabels:
      app: rag-service
  template:
    metadata:
      labels:
        app: rag-service
    spec:
      containers:
      - name: rag
        image: ghcr.io/yourorg/rag-service:{{ .Values.image.tag }}
        envFrom:
        - secretRef:
            name: rag-secrets
        resources:
          requests:
            cpu: "500m"
            memory: "1Gi"
          limits:
            cpu: "1"
            memory: "2Gi"
        ports:
        - containerPort: 8000
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: rag-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: rag-service
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 60
```

**Recommended Helm Chart Layout:**
```
charts/
  rag/
    Chart.yaml
    values.yaml
    templates/
  ingestion/
  web/
  auth/
```

---

## 5. CI/CD Pipeline (GitHub Actions)

One pipeline per repo (microservice) or central pipeline for infra.

**Workflow:**
1.  **On push to main:**
2.  Run unit tests + linters.
3.  Build Docker image.
4.  Push image to registry (GitHub Packages / Docker Hub / ECR).
5.  Run integration tests (testcontainers / ephemeral k8s cluster using kind).
6.  Helm upgrade --install to target cluster (use kubeconfig from secrets, or GitOps).
7.  Run smoke tests.

**Example `deploy.yml` snippet:**
```yaml
name: CI/CD
on:
  push:
    branches: [ main ]
jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v4
        with: python-version: '3.11'
      - name: Run tests
        run: |
          pip install -r requirements.txt
          pytest -q
      - name: Build and push Docker image
        uses: docker/build-push-action@v4
        with:
          context: .
          push: true
          tags: ghcr.io/yourorg/rag-service:${{ github.sha }}
      - name: Helm upgrade
        uses: azure/setup-helm@v3
      - name: Deploy
        env:
          KUBECONFIG: ${{ secrets.KUBECONFIG }}
        run: |
          helm upgrade --install rag charts/rag --set image.tag=${{ github.sha }}
```
*Alternative: Use GitOps (ArgoCD).*

---

## 6. Model Serving & MLOps

**Option A: Hosted Model API (Fastest)**
*   Call Grok API, Mistral, Anthropic, etc.
*   **Pros:** No GPU management, easy scaling.
*   **Cons:** Cost per token, external dependency.

**Option B: Self-Hosted Open Models (Advanced)**
*   Host Llama/Mistral via KServe, Triton, or BentoML.
*   Use model registry (DVC, MLflow).
*   **Infrastructure:** GPU node pool, model loaded in memory, gRPC/REST endpoints, warmup/health checks.

**Embedding Pipeline:**
*   Use `sentence-transformers` (CPU or small GPU).
*   Store metadata + chunk text in Postgres + Object Store.
*   Write vectors to Qdrant.

---

## 7. Observability, Scaling & Security

**Observability:**
*   **Metrics:** Prometheus.
*   **Dashboards:** Grafana (latency, vector DB query times, queue depth, error rates).
*   **Traces:** OpenTelemetry.
*   **Logs:** Loki / ELK.

**Scaling:**
*   **Stateless:** HPA.
*   **Workers:** Scale based on queue length.
*   **Vector DB:** Horizontal scaling (replicas).
*   **Model Service:** Scale based on GPU utilization / RPS.

**Security:**
*   **Tenant Isolation:** `tenant_id` in all queries, Row-Level Security (RLS).
*   **Auth:** OAuth2/OIDC + RBAC.
*   **Encryption:** TLS everywhere (Ingress + mTLS).
*   **Secrets:** External Secrets.
*   **Rate Limiting:** API Gateway.
*   **Compliance:** Audit logging, data retention policies.

---

## 8. Milestones & Deliverables (Roadmap)

Break into 6-8 sprints (2 weeks each).

### MVP (Sprints 1–3) — Goal: Functioning Demo
*   **Sprint 1: Repo + Infra Foundation**
    *   Scaffolding (frontend, backend, helm charts).
    *   Deploy cluster (kind/minikube).
    *   Deploy Postgres, MinIO, Redis, Qdrant.
*   **Sprint 2: Document Ingestion Pipeline**
    *   Upload UI + backend endpoint.
    *   PDF text extraction + chunking.
    *   Embeddings pipeline + vector insert.
*   **Sprint 3: Question Answering**
    *   Retrieval → RAG → LLM answer (hosted API).
    *   Display answer with sources.
    *   Basic Auth.

### v1 (Sprints 4–5) — Harden & Add Features
*   Multi-tenant support + RLS.
*   Advanced search and filters.
*   Conversation history, rate limiting.
*   CI/CD pipeline + integration tests.
*   Basic monitoring + alerts.

### v2 (Sprints 6–8) — Productionize & MLOps
*   Switch to self-hosted model or scalable inference.
*   Model versioning + A/B testing.
*   SSO, audit logs.
*   Backup & DR, performance tuning.
*   Admin dashboard, billing metrics.

---

## 9. Starter Folder Layout

```
ai-knowledgebase/
├─ infra/                  # Helm umbrella chart + k8s manifests
├─ services/
│  ├─ api/                 # FastAPI backend (auth, user, rag endpoints)
│  ├─ ingestion/           # worker for ingesting and embedding
│  ├─ frontend/            # React app
│  ├─ model-service/       # wrapper to call model provider / inference
├─ docs/
├─ .github/workflows/
├─ docker-compose.dev.yml  # local dev (Postgres, MinIO, Qdrant, Redis)
```

**Sample Dockerfile (FastAPI):**
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY pyproject.toml poetry.lock /app/
RUN pip install --upgrade pip && pip install poetry && poetry config virtualenvs.create false && poetry install --no-dev
COPY . /app
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
```

---

## 10. Practical Tips

*   **MVP Strategy:** Start with a hosted LLM to reduce infra overhead.
*   **Local Dev:** Use MinIO + Qdrant + Postgres locally.
*   **Chunking:** Test chunk size and overlap; it's crucial for RAG performance.
*   **Caching:** Cache RAG outputs for identical queries.
*   **Isolation:** Use separate vector collections per tenant or tenant-id prefixing.
*   **Privacy:** Redact PII before embedding if required.