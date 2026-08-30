<p align="center">
  <h1 align="center">PrepCV</h1>
  <p align="center">
    <strong>AI-Powered Career Platform — Resume Builder, ATS Scorer & Interview Prep</strong>
  </p>
  <p align="center">
    Upload your CV or build a profile from scratch. Let AI format it into a professional, ATS-optimized resume tailored for your target role — then prepare for your interview with AI-generated questions.
  </p>
</p>

<br/>

## ✨ Features

### 📄 Resume Builder
- **CV Upload & AI Extraction** — Upload a PDF or DOCX resume; the system extracts text, parses it into structured data via Google Gemini Flash, and auto-saves to your profile
- **✨ Format with AI** — One-click formatting of manually-entered profile data through Gemini Flash with sanitized prompts, forced JSON schema output, and Pydantic validation
- **Target Job Title** — Every AI operation accepts a target position (e.g. "AI Engineer") to tailor content for that specific role
- **Profile Wizard** — Step-by-step form covering Personal Info, Experience, Education, Skills, Projects, and Certifications
- **ATS-Optimized Resume Generation** — Pure data → dynamic Jinja2 HTML template rendering with automatic content-density scaling (spacious / normal / compact / dense)
- **AI Bullet Improvement** — Refine individual resume bullets with AI suggestions for stronger impact
- **Live HTML Preview** — Interactive in-editor preview of your resume as you edit
- **Multi-Format Export** — Download as standalone HTML or Word (.docx)

### 📊 ATS Scoring
- **Job Description Matching** — Score your resume against any job description with detailed breakdown
- **Keyword Analysis** — See matched keywords, missing skills, and coverage statistics
- **Actionable Recommendations** — Get specific improvement suggestions with categories and priorities
- **Score Tracking** — Track previous scores and score changes over time per resume

### 🔄 Resume Versioning
- **Version History** — Every save creates a versioned snapshot with change summaries
- **Side-by-Side Comparison** — Compare any two versions with structured diffs (skills added/removed, bullet count changes, score deltas)
- **Version Restore** — Restore any older version as a new incremented version, preserving full history

### 🎤 Interview Preparation
- **AI-Generated Questions** — Generate 9–12 tailored interview questions combining company intelligence, job description, candidate CV, and community feedback
- **Company URL Intelligence** — Provide a company URL for Tavily-powered web research to enrich question context
- **Community Feedback RAG Loop** — Post-interview feedback (actual questions asked) is anonymized, PII-scrubbed, tagged by company/role/industry, and fed back into future question generation
- **Session Management** — Create, list, and revisit past interview prep sessions

### 🔐 Authentication
- **JWT + HTTP-Only Cookie** — Secure auth with bcrypt password hashing, 7-day token expiry, and cookie-based session management
- **Protected Routes** — All profile, resume, and interview endpoints require authentication

<br/>

## 🏗️ Architecture

```
┌─────────────────────────────┐      ┌──────────────────────────────┐
│         Frontend            │      │          Backend             │
│     Next.js (App Router)    │◄────►│     FastAPI + Uvicorn        │
│     React · TypeScript      │ HTTP │     Python 3.11+             │
│     Vanilla CSS             │      │     Async/Await Throughout   │
└─────────────────────────────┘      └──────────┬───────────────────┘
                                                 │
                                     ┌───────────┼───────────┐
                                     ▼           ▼           ▼
                              ┌──────────┐ ┌──────────┐ ┌──────────┐
                              │PostgreSQL│ │ Gemini   │ │ Tavily   │
                              │ (asyncpg)│ │ Flash    │ │ Search   │
                              └──────────┘ └──────────┘ └──────────┘
```

<br/>

## 📁 Project Structure

```text
PrepCV/
├── backend/
│   ├── app/
│   │   ├── business_logic/          # Use cases & orchestration
│   │   │   ├── ats_scorer.py        #   ATS scoring engine (Gemini + NLP fallback)
│   │   │   ├── auth.py              #   User registration & login
│   │   │   ├── cv_extractor.py      #   PDF/DOCX text extraction + LLM parsing
│   │   │   ├── feedback_rag.py      #   Interview feedback RAG (PII scrubbing, retrieval)
│   │   │   ├── interview_generator.py #  Interview question generation pipeline
│   │   │   ├── profile.py           #   Profile CRUD operations
│   │   │   ├── resume_generator.py  #   Resume content generation & HTML/DOCX rendering
│   │   │   └── resume_versioning.py #   Version history, comparison & restore
│   │   ├── core/                    # Configuration, security & shared dependencies
│   │   │   ├── config.py            #   Pydantic settings (env-based)
│   │   │   ├── dependencies.py      #   FastAPI dependency injection
│   │   │   └── security.py          #   JWT creation/decode, bcrypt hashing
│   │   ├── database/                # PostgreSQL persistence
│   │   │   ├── models.py            #   SQLAlchemy 2.0 declarative models
│   │   │   └── session.py           #   Async engine, session factory, schema init
│   │   ├── edge_cases/              # Input validation & exceptional conditions
│   │   ├── endpoints/               # FastAPI routers (one folder per domain)
│   │   │   ├── auth/                #   Register, login, logout, /me
│   │   │   ├── health/              #   Health check
│   │   │   ├── interview/           #   Question generation, sessions, feedback
│   │   │   ├── profile/             #   CRUD, CV upload, format-with-AI
│   │   │   └── resume/              #   Generate, list, update, ATS score, versions, export
│   │   ├── function_calls/          # Application-facing adapters to reusable functions
│   │   ├── functions/               # Small reusable functions (no HTTP concerns)
│   │   ├── integrations/            # External service clients
│   │   │   ├── gemini/              #   Google Gemini (prompt sanitization, schema validation)
│   │   │   ├── grok/                #   xAI Grok client
│   │   │   └── tavily/              #   Tavily web search (company intelligence)
│   │   ├── schemas/                 # Pydantic request/response models
│   │   │   ├── auth.py              #   Auth schemas
│   │   │   ├── interview.py         #   Interview schemas
│   │   │   ├── profile.py           #   Profile schemas
│   │   │   └── resume.py            #   Resume & versioning schemas
│   │   ├── templates/               # Jinja2 ATS resume HTML template
│   │   └── main.py                  # FastAPI app factory, CORS, router mounting
│   ├── requirements.txt
│   ├── run.py                       # Dev server entry point
│   └── .env.example
├── frontend/
│   ├── app/                         # Next.js App Router pages
│   │   ├── ats-checker/             #   ATS scoring page
│   │   ├── dashboard/               #   Main dashboard
│   │   ├── interview-feedback/      #   Submit post-interview feedback
│   │   ├── interview-prep/          #   Generate interview questions
│   │   ├── interview-sessions/      #   Past session history
│   │   ├── login/                   #   Login page
│   │   ├── signup/                  #   Registration page
│   │   ├── profile/                 #   Profile wizard (multi-step form)
│   │   ├── resumes/                 #   Resume list & editor with [id] route
│   │   ├── layout.tsx               #   Root layout with AuthProvider
│   │   ├── page.tsx                 #   Entry redirect (→ dashboard or login)
│   │   └── globals.css              #   Global styles
│   ├── components/
│   │   ├── protected-route.tsx      #   Auth guard HOC
│   │   └── sidebar-layout.tsx       #   App shell with navigation sidebar
│   ├── lib/
│   │   ├── api.ts                   #   Typed API client (all endpoints)
│   │   └── auth-context.tsx         #   React auth context & provider
│   ├── package.json
│   ├── next.config.ts
│   └── tsconfig.json
└── render.yaml                      # Render.com deployment blueprint
```

<br/>

## 🚀 Getting Started

### Prerequisites

- **Python 3.11+**
- **Node.js 18+**
- **PostgreSQL 15+** (running locally or remote)

### Backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
python run.py
```

The API starts at **http://localhost:8000** with interactive Swagger docs at **http://localhost:8000/docs**.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend starts at **http://localhost:3000**.

### Environment Variables

Copy `.env.example` to `.env` in the `backend/` directory:

```bash
cp backend/.env.example backend/.env
```

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string (e.g. `postgresql+asyncpg://user:pass@localhost:5432/prepcv`) |
| `GEMINI_API_KEY` | ✅ | Google Gemini API key — powers CV extraction, profile formatting, ATS scoring, bullet improvement, and interview question generation |
| `TAVILY_API_KEY` | ⬜ | Tavily API key — enables company URL intelligence for interview prep |
| `XAI_API_KEY` | ⬜ | xAI Grok API key (optional alternative LLM) |
| `SECRET_KEY` | ⬜ | JWT signing secret (defaults to a dev value — **change in production**) |
| `ENVIRONMENT` | ⬜ | `development` or `production` |

> **Note:** Without `GEMINI_API_KEY`, CV upload and AI formatting fall back to a deterministic heuristic parser. The ATS scorer and interview generator also have robust fallback logic.

<br/>

## 📡 API Reference

All endpoints are prefixed under `/api`. Interactive documentation is available at `/docs` (Swagger UI) and `/redoc`.

### Auth

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register a new user, returns JWT token + user |
| `POST` | `/api/auth/login` | Authenticate user, returns JWT token + user |
| `GET` | `/api/auth/me` | Get current authenticated user |
| `POST` | `/api/auth/logout` | Clear session cookie |

### Profile

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/profile` | Get candidate profile |
| `PUT` | `/api/profile` | Save or update profile |
| `POST` | `/api/profile/upload-cv` | Upload CV file (PDF/DOCX) → AI extraction → auto-save |
| `POST` | `/api/profile/format-with-ai` | Format profile data with Gemini for a target role |

### Resume

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/resumes/generate` | Generate ATS-optimized resume from profile data |
| `GET` | `/api/resumes` | List all user resumes |
| `GET` | `/api/resumes/:id` | Get a specific resume |
| `PUT` | `/api/resumes/:id` | Update resume title or content |
| `GET` | `/api/resumes/:id/html` | Render standalone ATS HTML |
| `GET` | `/api/resumes/:id/docx` | Export as Word document (.docx) |
| `POST` | `/api/resumes/ai-improve` | AI-improve a bullet point |
| `POST` | `/api/resumes/render-preview` | Render HTML preview from content (no save) |

### ATS Scoring

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/resumes/:id/ats-score` | Score saved resume against a job description |
| `POST` | `/api/resumes/ats-score-direct` | Score ad-hoc content directly against a JD |

### Resume Versioning

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/resumes/:id/versions` | List version history |
| `POST` | `/api/resumes/:id/versions` | Save current draft as a new version |
| `GET` | `/api/resumes/:id/versions/:vid` | Get full version detail |
| `POST` | `/api/resumes/:id/versions/:vid/restore` | Restore an older version |
| `GET` | `/api/resumes/:id/compare` | Compare two versions side-by-side |

### Interview Prep

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/interview/generate` | Generate tailored interview questions |
| `GET` | `/api/interview/sessions` | List all interview prep sessions |
| `GET` | `/api/interview/sessions/:id` | Get session details & question list |
| `POST` | `/api/interview/feedback` | Submit post-interview feedback (PII-scrubbed) |
| `GET` | `/api/interview/feedback` | List all submitted feedback |

### Health

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |

<br/>

## 🧱 Backend Layering

The backend follows a strict layered architecture to keep concerns separated:

```
Endpoints  →  Business Logic  →  Function Calls  →  Functions
    │               │                                    │
    │               ├── Integrations (Gemini, Tavily)     │
    │               ├── Edge Cases (validation)           │
    │               └── Database (models, session)        │
    │                                                     │
    └── Schemas (Pydantic request/response models)        │
                                                          │
                              Pure utilities, no HTTP ─────┘
```

- **Endpoints** translate HTTP requests/responses and call business logic
- **Business Logic** orchestrates use cases and coordinates function calls
- **Function Calls** are application-facing adapters to reusable functions
- **Functions** are small, pure utilities with no HTTP or framework concerns
- **Edge Cases** keep validation separate so business rules remain readable and testable
- **Integrations** encapsulate external service clients (Gemini, Tavily, Grok)

<br/>

## ⚙️ Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| **FastAPI** | Async web framework |
| **Uvicorn** | ASGI server |
| **SQLAlchemy 2.0** | Async ORM (declarative mapped models) |
| **asyncpg** | PostgreSQL async driver |
| **Pydantic v2** | Data validation & settings |
| **PyJWT + bcrypt** | JWT authentication |
| **Google GenAI** | Gemini Flash LLM integration |
| **Tavily** | Web search API (company intelligence) |
| **Jinja2** | Resume HTML template rendering |
| **pypdf + python-docx** | PDF/DOCX text extraction & export |
| **Alembic** | Database migrations |

### Frontend
| Technology | Purpose |
|---|---|
| **Next.js** (App Router) | React meta-framework |
| **React 18+** | UI library |
| **TypeScript** | Type safety |
| **Vanilla CSS** | Styling |

<br/>

## 🚢 Deployment

The project includes a [`render.yaml`](render.yaml) blueprint for one-click deployment to **Render.com**:

- **Backend** — Python web service running `uvicorn app.main:app`
- **Frontend** — Node.js web service running `npm run start`
- **Database** — Managed PostgreSQL (free tier)

<br/>

## 📝 Database Models

| Model | Table | Description |
|---|---|---|
| `User` | `users` | Registered users with hashed passwords |
| `Profile` | `profiles` | Candidate profile data (JSON columns for personal info, experience, education, skills, projects, certifications) |
| `Resume` | `resumes` | Generated resumes with profile snapshot, content, ATS score, and target JD |
| `ResumeVersion` | `resume_versions` | Immutable version history for each resume |
| `InterviewSession` | `interview_sessions` | Interview prep sessions with company insights and generated questions |
| `InterviewFeedback` | `interview_feedback` | Post-interview feedback with PII-scrubbed questions and company/role/industry tags |

<br/>

## 📄 License

This project is proprietary. All rights reserved.