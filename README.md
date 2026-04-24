# Borbulhas de Cacau — Admin Panel

Admin panel for managing products in the Borbulhas de Cacau wine and chocolate e-commerce store.

## Tech Stack

- **Backend**: Node.js + Express (REST API)
- **Database**: PostgreSQL 15
- **Auth**: JWT + bcrypt
- **Frontend**: Vanilla HTML/CSS/JS (nginx)
- **Dev**: docker-compose
- **Production**: Kubernetes

---

## Local Development

### Prerequisites

- Docker and Docker Compose installed

### Start all services

```bash
cd /Users/pfelipe/Documents/borbulhas-admin
docker-compose up --build
```

Services will be available at:
- **Frontend**: http://localhost:8080
- **Backend API**: http://localhost:3000
- **PostgreSQL**: localhost:5432

### First-time admin login

On first startup, the backend automatically creates a default admin user:

- **Email**: `admin@borbulhas.com.br`
- **Password**: `changeme123`

> **Important**: Change this password immediately after first login!

### Install backend dependencies (for local dev without Docker)

```bash
cd backend
cp .env.example .env
# Edit .env with your local values
npm install
npm run dev
```

---

## Environment Variables

| Variable       | Description                              | Default                                                          |
|----------------|------------------------------------------|------------------------------------------------------------------|
| `PORT`         | Port the backend API listens on          | `3000`                                                           |
| `DATABASE_URL` | PostgreSQL connection string             | `postgresql://postgres:password@localhost:5432/borbulhas_admin` |
| `JWT_SECRET`   | Secret key for signing JWT tokens        | *(required — set a long random string)*                          |
| `NODE_ENV`     | Environment (`development`/`production`) | `development`                                                    |
| `CORS_ORIGIN`  | Allowed CORS origin                      | `*`                                                              |

---

## API Endpoints

### Health

| Method | Path         | Auth | Description         |
|--------|--------------|------|---------------------|
| GET    | /api/health  | No   | Health check        |

### Auth

| Method | Path                 | Auth | Description                                  |
|--------|----------------------|------|----------------------------------------------|
| POST   | /api/auth/login      | No   | Login — returns JWT                          |
| POST   | /api/auth/register   | No   | Register first admin (only if none exists)   |
| GET    | /api/auth/me         | Yes  | Get current user info                        |

**Login request body:**
```json
{ "email": "admin@borbulhas.com.br", "password": "changeme123" }
```

**Login response:**
```json
{ "token": "eyJ...", "user": { "id": 1, "email": "admin@borbulhas.com.br" } }
```

### Products (all require `Authorization: Bearer <token>`)

| Method | Path                         | Description                             |
|--------|------------------------------|-----------------------------------------|
| GET    | /api/products                | List products (with filters/pagination) |
| GET    | /api/products/:id            | Get single product                      |
| POST   | /api/products                | Create product                          |
| PUT    | /api/products/:id            | Update product                          |
| DELETE | /api/products/:id            | Soft delete (set ativo=false)           |
| PATCH  | /api/products/:id/toggle     | Toggle ativo field                      |

**GET /api/products query parameters:**

| Param        | Description                         |
|--------------|-------------------------------------|
| `categoria`  | Filter by `vinhos`, `chocolates`, `presentes` |
| `subcategoria` | Filter by subcategoria            |
| `destaque`   | Filter by `true`/`false`            |
| `ativo`      | Filter by `true`/`false`            |
| `search`     | Search in nome and descricao        |
| `page`       | Page number (default: 1)            |
| `limit`      | Items per page (default: 20, max: 100) |

---

## Kubernetes Deployment

### Prerequisites

- A Kubernetes cluster (e.g. k3s, EKS, GKE, AKS)
- `kubectl` configured
- nginx ingress controller installed
- cert-manager installed (for TLS)

### Create secrets

```bash
# PostgreSQL secret
kubectl create secret generic postgres-secret \
  --namespace borbulhas-admin \
  --from-literal=POSTGRES_DB=borbulhas_admin \
  --from-literal=POSTGRES_USER=postgres \
  --from-literal=POSTGRES_PASSWORD=<strong-password>

# Backend secret
kubectl create secret generic backend-secret \
  --namespace borbulhas-admin \
  --from-literal=DATABASE_URL=postgresql://postgres:<strong-password>@postgres:5432/borbulhas_admin \
  --from-literal=JWT_SECRET=<long-random-secret>
```

### Apply manifests

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/postgres-pvc.yaml
kubectl apply -f k8s/postgres-deployment.yaml
kubectl apply -f k8s/postgres-service.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/backend-service.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/frontend-service.yaml
kubectl apply -f k8s/ingress.yaml
```

Or apply everything at once:

```bash
kubectl apply -f k8s/
```

### Build and push Docker images

```bash
# Backend
docker build -t ghcr.io/pfelipebr/borbulhas-admin-backend:latest ./backend
docker push ghcr.io/pfelipebr/borbulhas-admin-backend:latest

# Frontend
docker build -t ghcr.io/pfelipebr/borbulhas-admin-frontend:latest ./frontend
docker push ghcr.io/pfelipebr/borbulhas-admin-frontend:latest
```

### Check deployment status

```bash
kubectl get all -n borbulhas-admin
kubectl logs -n borbulhas-admin deployment/backend
```

---

## Product Categories

| Category     | Description      |
|--------------|------------------|
| `vinhos`     | Wines            |
| `chocolates` | Chocolates       |
| `presentes`  | Gift kits        |

---

## Security Notes

- The default admin credentials (`admin@borbulhas.com.br` / `changeme123`) are auto-created only if no admin exists. Change them immediately.
- Always use a strong, random `JWT_SECRET` in production (at least 64 characters).
- The `DELETE /api/products/:id` endpoint performs a soft delete (sets `ativo=false`) — no data is permanently lost.
- All monetary values are stored as `DECIMAL(10,2)` and displayed as BRL.
