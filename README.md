# VidyaSathi — AI Tutor for Every Student

> Offline-first, cost-optimized AI tutor for rural India. Works on ₹8,000 phones with spotty 2G connections.

**Tech Stack:** FastAPI · Gemini Flash/Pro · Groq Whisper + Orpheus TTS · ChromaDB · Redis · React PWA

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 20+
- Redis (optional — semantic cache falls back gracefully)
- Gemini API key (from Google AI Studio)
- Groq API key (for voice features)

### 1. Clone & Configure

```bash
cd vidyasathi
cp .env.example .env
# Edit .env and add your API keys:
#   GEMINI_API_KEY=...
#   GROQ_API_KEY=...
```

### 2. Start Development (Windows)

```powershell
.\start-dev.ps1
```

### 2. Start Development (Mac/Linux)

```bash
chmod +x start-dev.sh
./start-dev.sh
```

**Or manually:**

**Backend:**
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # add your API keys
uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Open: **http://localhost:5173**

---

## Architecture

```
Student (PWA)
    │ offline-first queries
    ▼
FastAPI Backend
    │
    ├─ Tier 0: Local browser cache (₹0, ~0ms)
    ├─ Tier 1: Redis semantic cache (₹0, ~50ms)  ← embedding similarity
    ├─ Tier 2: Gemini Flash + 2-3 RAG chunks (₹0.006/query)
    └─ Tier 3: Gemini Pro + 5-7 RAG chunks (₹0.08/query)

    ChromaDB ← textbook chunks + embeddings
    Redis    ← semantic cache (Q&A + embeddings)
    SQLite   ← students, logs, quiz attempts
```

### Cost Comparison

| Approach | Cost/1000 queries |
|----------|-------------------|
| GPT-4 every query | ~$15 |
| GPT-4 + RAG | ~$8 |
| **VidyaSathi** | **~$0.30** |

---

## Features

| Feature | Description |
|---------|-------------|
| **Multi-tier Cache** | 70% of queries answered free from cache |
| **Voice (Hindi/Marathi)** | Groq Whisper STT + Orpheus TTS |
| **Learning Style Adaptation** | VARK-inspired profile (visual/auditory/read-write/kinesthetic) |
| **Mermaid Diagrams** | Auto-generated flowcharts, mind maps, timelines |
| **Image Generation** | Educational diagrams generated via Gemini |
| **Adaptive Quiz** | MCQ, fill-blank, true-false with difficulty adaptation |
| **Flashcards** | Spaced repetition-style revision |
| **Teacher Dashboard** | Class analytics, weak topic identification |
| **Gamification** | XP, streaks, badges, chapter mastery |

---

## API Documentation

Once running: **http://localhost:8000/docs**

### Key Endpoints

```
POST /api/auth/register          — Create student account
POST /api/auth/login             — Login
POST /api/query/ask              — Main AI query (multi-tier routing)
POST /api/query/voice            — Voice query (STT → AI → TTS)
POST /api/admin/textbook/upload  — Upload PDF textbook
POST /api/visual/diagram         — Generate Mermaid diagram
POST /api/visual/flowchart       — Generate process flowchart
POST /api/visual/concept-map     — Generate mind map
GET  /api/content-pack/list      — Available offline packs
POST /api/sync/batch-queries     — Sync offline queued questions
GET  /api/analytics/cost-report  — Cost metrics (demo)
```

---

## Adding Textbooks

1. Go to **http://localhost:5173/admin**
2. Upload a PDF (Maharashtra SSC, CBSE, or any state board textbook)
3. Wait for processing (status shows "Ready" when done)
4. Click **+ Q&A** to generate 15 pre-computed Q&A pairs per chapter
5. Click **Pack** to create an offline content pack for students

---

## Project Structure

```
vidyasathi/
├── backend/
│   ├── main.py                    # FastAPI app entry point
│   ├── requirements.txt
│   ├── app/
│   │   ├── config.py              # Settings (pydantic-settings)
│   │   ├── database.py            # SQLAlchemy models + async session
│   │   ├── models/schemas.py      # Pydantic request/response schemas
│   │   ├── services/
│   │   │   ├── gemini_service.py  # Gemini Flash/Pro/Embedding + Mermaid gen
│   │   │   ├── groq_service.py    # Whisper STT + Orpheus TTS
│   │   │   ├── cache_service.py   # Redis semantic cache (cosine similarity)
│   │   │   ├── chromadb_service.py # Vector store for textbook chunks
│   │   │   ├── ingestion_service.py # PDF → chunks → embeddings → ChromaDB
│   │   │   ├── query_router.py    # Multi-tier routing logic
│   │   │   └── image_gen_service.py # Educational image/diagram generation
│   │   ├── routers/
│   │   │   ├── auth.py            # Register, login, profile
│   │   │   ├── query.py           # /ask and /voice endpoints
│   │   │   ├── admin.py           # Textbook upload & management
│   │   │   ├── quiz.py            # Quiz, flashcards, revision
│   │   │   ├── offline.py         # Content packs, sync
│   │   │   ├── analytics.py       # Cost report, progress
│   │   │   └── visual.py          # Diagram/image generation
│   │   └── utils/auth.py          # JWT + password hashing
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LandingPage.tsx    # Marketing landing page
│   │   │   ├── OnboardingPage.tsx # Registration + VARK assessment
│   │   │   ├── DashboardPage.tsx  # Student home with progress
│   │   │   ├── ChatPage.tsx       # Main AI chat with voice + diagrams
│   │   │   ├── QuizPage.tsx       # Adaptive quiz mode
│   │   │   ├── RevisionPage.tsx   # Summary + flashcards
│   │   │   ├── AdminPage.tsx      # Textbook upload & management
│   │   │   └── AnalyticsPage.tsx  # Cost dashboard + progress
│   │   ├── components/
│   │   │   ├── MermaidDiagram.tsx # Renders Mermaid.js diagrams
│   │   │   ├── MessageBubble.tsx  # Chat message with markdown/math/diagrams
│   │   │   ├── VoiceRecorder.tsx  # Microphone with waveform UI
│   │   │   ├── DiagramModal.tsx   # Generate diagram by concept
│   │   │   └── CostMeter.tsx      # Live cost comparison widget
│   │   ├── services/
│   │   │   ├── api.ts             # All API calls (axios)
│   │   │   ├── offlineCache.ts    # IndexedDB (questions, packs, queue)
│   │   │   └── syncManager.ts     # Offline queue sync
│   │   └── store/                 # Zustand stores (auth, chat, progress)
│
├── docker-compose.yml
├── start-dev.sh                   # Mac/Linux dev starter
├── start-dev.ps1                  # Windows dev starter
└── README.md
```

---

## Demo Script

1. **Register** → Take learning style quiz (8 questions, auto-computes VARK profile)
2. **Admin** → Upload a PDF textbook → wait for "Ready" status
3. **Chat** → Ask "What is photosynthesis?" → shows cache hit (₹0)
4. **Chat** → Ask "Why do plants appear green if chlorophyll absorbs red light?" → Gemini Flash + diagram auto-generated
5. **Voice** → Tap mic → speak in Hindi → get answer spoken back
6. **Quiz** → Take 10-question adaptive quiz → see XP earned + weak topics
7. **Go Offline** → turn off WiFi → ask cached question (works!) → ask new question (queued)
8. **Analytics** → Cost Dashboard tab shows 50x savings vs GPT-4

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | ✅ | Google AI Studio key |
| `GROQ_API_KEY` | ✅ | Groq key (for voice features) |
| `SECRET_KEY` | ✅ | JWT signing key (min 32 chars) |
| `REDIS_URL` | Optional | Redis URL (falls back gracefully) |
| `DATABASE_URL` | Optional | SQLite by default |
| `SEMANTIC_CACHE_THRESHOLD` | Optional | Default: 0.92 |

---

Built with ❤️ for rural India · **VidyaSathi** — every student deserves a tutor that never runs out of patience.
