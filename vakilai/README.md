# VakilAI — AI-Powered Legal Advisor for India

Full-stack AI legal consultation platform built on Claude (Anthropic), OpenAI embeddings, and Pinecone — designed specifically for the Indian legal system.

## Architecture

```
vakilai/
├── backend/      Node.js + Express API
├── frontend/     React + Tailwind SPA
└── docker-compose.yml
```

**Backend stack:** Node.js 20, Express, MongoDB (Mongoose), JWT auth, Multer uploads, Claude API (Structured Outputs), OpenAI embeddings, Pinecone vector store.

**Frontend stack:** React 18, React Router 6, Tailwind CSS 3, Vite, Axios.

---

## Quick Start (Local Development)

### Prerequisites

| Tool | Minimum version |
|------|----------------|
| Node.js | 20.x |
| MongoDB | 7.x (or MongoDB Atlas free tier) |
| npm | 9.x |

You also need accounts and API keys for:
- [Anthropic Console](https://console.anthropic.com) → `ANTHROPIC_API_KEY`
- [OpenAI Platform](https://platform.openai.com) → `OPENAI_API_KEY`
- [Pinecone](https://app.pinecone.io) → `PINECONE_API_KEY`

---

### Step 1 — Clone and install dependencies

```bash
git clone https://github.com/your-org/vakilai.git
cd vakilai

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### Step 2 — Set up environment variables

**Backend:**
```bash
cd backend
cp .env.example .env
# Open .env and fill in all values (see Environment Variables section below)
```

**Frontend:**
```bash
cd frontend
cp .env.example .env
# Only needed if your backend is NOT at http://localhost:5000
# The Vite proxy handles /api → localhost:5000 automatically in dev
```

### Step 3 — Set up Pinecone index

Log into [app.pinecone.io](https://app.pinecone.io) and create a **Serverless** index with these exact settings:

| Setting | Value |
|---------|-------|
| Index name | `vakilai-legal-docs` (or match `PINECONE_INDEX_NAME` in `.env`) |
| Dimensions | `1536` |
| Metric | `cosine` |
| Cloud | `aws` |
| Region | `us-east-1` |

### Step 4 — Start MongoDB

```bash
# Option A: Local MongoDB
mongod --dbpath ./data/db

# Option B: Docker (one-liner)
docker run -d -p 27017:27017 --name vakilai-mongo mongo:7.0

# Option C: MongoDB Atlas free cluster — just paste the connection string into MONGO_URI
```

### Step 5 — Run backend

```bash
cd backend
npm run dev
# Server starts on http://localhost:5000
# You should see: MongoDB connected | Document processing worker started
```

### Step 6 — Run frontend

```bash
cd frontend
npm run dev
# App opens at http://localhost:5173
```

---

## Environment Variables

### Backend (`backend/.env`)

```env
# Server
PORT=5000
NODE_ENV=development

# MongoDB
MONGO_URI=mongodb://localhost:27017/vakilai

# JWT (generate with: openssl rand -base64 64)
ACCESS_TOKEN_SECRET=<64-char-random-string>
REFRESH_TOKEN_SECRET=<different-64-char-random-string>

# Claude (Anthropic)
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_ANALYSIS_MODEL=claude-sonnet-4-6
CLAUDE_CHAT_MODEL=claude-sonnet-4-6

# OpenAI (for embeddings only)
OPENAI_API_KEY=sk-...
EMBEDDING_MODEL=text-embedding-3-small

# Pinecone
PINECONE_API_KEY=pcsk_...
PINECONE_INDEX_NAME=vakilai-legal-docs

# File Storage
STORAGE_PROVIDER=local
STORAGE_ROOT=./uploads

# CORS
ALLOWED_ORIGINS=http://localhost:5173
```

### Frontend (`frontend/.env`)

```env
# Only set this in production. In dev, Vite proxies /api to localhost:5000 automatically.
VITE_API_URL=https://api.yourdomain.com/api
```

---

## Deployment

### Option A — Docker Compose (recommended)

```bash
# 1. Copy and fill environment file
cp backend/.env.example backend/.env
# Edit backend/.env with all production values

# 2. Build and start all services
docker-compose up -d --build

# Services started:
#   MongoDB:  localhost:27017
#   Backend:  localhost:5000
#   Frontend: localhost:80
```

**To stop:**
```bash
docker-compose down
```

**To view logs:**
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
```

---

### Option B — Manual VPS deployment (Ubuntu 22.04)

#### Install Node.js and PM2

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2
```

#### Install and start MongoDB

```bash
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update && sudo apt-get install -y mongodb-org
sudo systemctl enable --now mongod
```

#### Deploy backend

```bash
cd /opt/vakilai/backend
npm install --production
cp .env.example .env && nano .env  # fill in all values

pm2 start server.js --name vakilai-backend
pm2 save
pm2 startup  # run the command it prints
```

#### Build and serve frontend

```bash
cd /opt/vakilai/frontend
npm install
VITE_API_URL=https://api.yourdomain.com/api npm run build
# dist/ folder is now ready to serve via Nginx
```

#### Nginx config (full site)

```nginx
# /etc/nginx/sites-available/vakilai
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Frontend
    root /opt/vakilai/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 120s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/vakilai /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Add HTTPS with Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

### Option C — Cloud platforms

#### Render.com (free tier available)

1. Push repo to GitHub
2. **Backend:** Create a "Web Service" → Root dir: `backend` → Build: `npm install` → Start: `node server.js` → Add all env vars
3. **Frontend:** Create a "Static Site" → Root dir: `frontend` → Build: `npm install && npm run build` → Publish dir: `dist` → Add `VITE_API_URL=https://your-backend.onrender.com/api`
4. **MongoDB:** Use [MongoDB Atlas](https://cloud.mongodb.com) free M0 cluster → paste connection string as `MONGO_URI`

#### Railway.app

```bash
# Install Railway CLI
npm install -g @railway/cli
railway login

# Deploy backend
cd backend
railway init
railway up

# Deploy frontend (separate service)
cd ../frontend
railway init
railway up
```

---

## API Reference

All endpoints are prefixed with `/api`.

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Login, returns JWT |
| POST | `/auth/logout` | Clear refresh token |
| POST | `/auth/refresh` | Rotate access token |
| GET  | `/auth/me` | Get current user |

### Documents
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/documents/upload` | Upload PDF/DOCX/TXT |
| GET  | `/documents` | List user's documents |
| GET  | `/documents/:id` | Get document |
| GET  | `/documents/:id/status` | Poll processing status |
| DELETE | `/documents/:id` | Soft-delete |

### Analysis
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/documents/:id/analyse` | Trigger AI analysis |
| GET  | `/documents/:id/analysis` | Get existing analysis |
| POST | `/documents/:id/reanalyse` | Force fresh analysis |

### Chats
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/chats` | Create chat session |
| GET  | `/chats` | List chats (paginated) |
| GET  | `/chats/search?q=` | Search chats |
| GET  | `/chats/:id` | Load chat + messages |
| POST | `/chats/:id/messages` | Save message |
| PATCH | `/chats/:id/rename` | Rename chat |
| PATCH | `/chats/:id/archive` | Archive/unarchive |
| DELETE | `/chats/:id` | Soft-delete |

### Consultations
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/consultations/:chatId/message` | Send message (AI responds) |
| GET  | `/consultations/:chatId/state` | Get intake phase + progress |

---

## Project Structure

```
vakilai/
├── backend/
│   ├── config/
│   │   ├── db.js                    MongoDB connection
│   │   ├── legalIntakeSchemas.js    Per-category required-facts checklists
│   │   └── masterSystemPrompt.js    Production system prompt builder
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── chatController.js
│   │   ├── consultationController.js
│   │   ├── documentController.js
│   │   └── analysisController.js
│   ├── middleware/
│   │   ├── authMiddleware.js        JWT protect + tier gates
│   │   └── uploadMiddleware.js      Multer + magic-byte validation
│   ├── models/
│   │   ├── User.js
│   │   ├── Chat.js
│   │   ├── Message.js
│   │   ├── ConsultationSession.js
│   │   ├── Document.js
│   │   └── DocumentAnalysis.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── chatRoutes.js
│   │   ├── consultationRoutes.js
│   │   ├── documentRoutes.js
│   │   └── analysisRoutes.js
│   ├── services/
│   │   ├── claudeClient.js          Anthropic SDK wrapper
│   │   ├── ragChatService.js        RAG-grounded chat
│   │   ├── retrievalService.js      Pinecone parallel search
│   │   ├── vectorIngestionService.js
│   │   ├── embeddingService.js      OpenAI embeddings
│   │   ├── pineconeClient.js
│   │   ├── chunkingService.js
│   │   ├── documentProcessor.js
│   │   ├── pdfExtractor.js
│   │   ├── docxExtractor.js
│   │   ├── textCleaner.js
│   │   ├── textStructurer.js
│   │   ├── documentAnalyzer.js
│   │   ├── analysisPromptBuilder.js
│   │   ├── analysisResponseParser.js
│   │   ├── chatHistoryService.js
│   │   ├── consultationOrchestrator.js
│   │   ├── issueClassifier.js
│   │   ├── intakeStateManager.js
│   │   ├── factExtractor.js
│   │   └── guidanceGenerator.js
│   ├── workers/
│   │   └── documentProcessingWorker.js
│   ├── utils/
│   │   ├── fileStorage.js
│   │   └── generateTokens.js
│   ├── server.js
│   ├── package.json
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── api/            axiosInstance.js, chatApi.js
│   │   ├── context/        AuthContext.jsx
│   │   ├── hooks/          useAuth, useChatHistory, useUpload, useDocuments, useConsultation, useAnalysis
│   │   ├── layouts/        AppLayout, AuthLayout, PublicLayout
│   │   ├── pages/          LandingPage, LoginPage, RegisterPage, DashboardPage,
│   │   │                   UploadPage, ChatPage, AnalysisPage, HistoryPage
│   │   ├── components/
│   │   │   ├── auth/       LoginForm, RegisterForm, ProtectedRoute
│   │   │   ├── layout/     AppSidebar, TopBar, Footer
│   │   │   ├── landing/    LandingNavbar
│   │   │   ├── chat/       ChatWindow, MessageBubble, ChatInput, CitationPanel, + 10 more
│   │   │   ├── analysis/   SummaryCard, RisksList, ClauseAccordion, + 11 more
│   │   │   ├── upload/     DropZone, UploadProgressCard, DocumentListItem
│   │   │   └── ui/         Button, Badge, Card, Spinner, Skeleton, Modal, EmptyState
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── nginx.conf
│
├── docker-compose.yml
├── .gitignore
└── README.md
```

---

## Third-Party API Costs

Running in development with light usage:

| Service | Free tier | Estimated dev cost |
|---------|-----------|-------------------|
| Anthropic Claude | Pay per token | ~$0.01–0.05 per analysis |
| OpenAI Embeddings | $0.00002/1K tokens | Negligible |
| Pinecone | 1 free serverless index | Free |
| MongoDB Atlas | M0 free cluster | Free |

---

## Troubleshooting

**MongoDB connection refused**
```bash
sudo systemctl start mongod  # or: brew services start mongodb-community
```

**Pinecone dimension mismatch error**
```
Your Pinecone index must have dimensions: 1536 (matches text-embedding-3-small output)
Delete the index and recreate it with dimension=1536
```

**Claude API 401 error**
```bash
# Check your key is set
cat backend/.env | grep ANTHROPIC_API_KEY
# Ensure it starts with sk-ant-
```

**Vite proxy not working (frontend can't reach /api)**
```bash
# Ensure backend is running on port 5000
# Check vite.config.js proxy target matches your PORT in backend/.env
```

**File upload fails silently**
```bash
mkdir -p backend/uploads
chmod 755 backend/uploads
```

**JWT errors after changing secrets**
```bash
# All existing tokens are invalidated — users must log in again
# This is expected behaviour
```

---

## Legal Disclaimer

VakilAI provides general legal information based on Indian law. It is not a substitute for professional legal advice from a licensed advocate. Users should consult a qualified lawyer for advice specific to their situation, especially before filing any legal action or signing any legal document.

---

Built with ❤️ for India's 1.4 billion — bringing legal clarity to everyone.
