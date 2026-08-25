# PrepCV

**AI-Powered ATS Resume Builder** — Upload your CV or enter data manually, and let AI format it into a professional, ATS-optimized profile tailored for your target job role.

## Features

- **CV Upload & AI Extraction** — Upload a PDF/DOCX resume; the system extracts text, parses it into structured data, and formats it using the Grok (xAI) LLM
- **Target Job Title Prompt** — After uploading a CV or clicking "Format with AI", a modal asks for your target position (e.g., "AI Engineer") so the AI can tailor content for that role
- **✨ Format with AI** — One-click button to send manually-entered profile data through Grok for professional enhancement (polished descriptions, action verbs, impact metrics)
- **Auto-Save to Database** — Both CV upload and AI formatting automatically save the result to your profile in PostgreSQL
- **ATS Resume Generation** — Generate an ATS-optimized resume from your profile data using Gemini Flash
- **Profile Wizard** — Step-by-step form covering Personal Info, Experience, Education, Skills, Projects, and Certifications
- **AI Bullet Improvement** — Refine individual resume bullets with AI suggestions

## Project Structure

```text
PrepCV/
├── backend/
│   ├── app/
│   │   ├── business_logic/    # Rules and use cases (CV extraction, resume generation)
│   │   ├── core/              # Configuration and shared dependencies
│   │   ├── database/          # PostgreSQL engine and session management
│   │   ├── edge_cases/        # Validation and exceptional conditions
│   │   ├── endpoints/         # HTTP routes, one folder per endpoint
│   │   ├── function_calls/    # Application-facing calls to basic functions
│   │   ├── functions/         # Small reusable functions with no HTTP concerns
│   │   ├── integrations/      # External services (Grok xAI, Claude)
│   │   │   ├── grok/          # Grok (xAI) client for CV formatting
│   │   │   └── claude/        # Claude API client
│   │   └── main.py
│   ├── requirements.txt
│   └── .env.example
└── frontend/                  # Next.js App Router application
```

## Local Development

### Backend

```bash
cd backend
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
python run.py
```

The API is available at `http://localhost:8000`. Swagger docs at `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend is available at `http://localhost:3000`.

### Environment Variables

Copy `.env.example` to `.env` in the `backend/` directory and configure:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `XAI_API_KEY` | Grok (xAI) API key for CV formatting & profile enhancement |
| `GEMINI_API_KEY` | Google Gemini API key for resume generation |
| `CLAUDE_API_KEY` | Anthropic Claude API key (optional) |

> **Note:** Without `XAI_API_KEY`, CV upload and "Format with AI" fall back to a heuristic parser — no AI enhancement will be applied.

## API Endpoints

### Profile

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/profile` | Get current user's profile |
| `PUT` | `/api/profile` | Save/update profile manually |
| `POST` | `/api/profile/upload-cv` | Upload CV file + job title → AI format → auto-save |
| `POST` | `/api/profile/format-with-ai` | Format existing profile data with AI for a target role |

### Resume

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/resumes/generate` | Generate ATS-optimized resume |
| `GET` | `/api/resumes` | List all user resumes |
| `GET` | `/api/resumes/:id` | Get a specific resume |
| `PUT` | `/api/resumes/:id` | Update resume title/content |
| `POST` | `/api/resumes/ai-improve` | AI-improve a specific bullet point |

## Backend Layering

Endpoints translate HTTP requests and responses. They call business logic, which coordinates `function_calls`; those adapters call reusable functions. Edge-case validation stays separate so business rules remain easy to read and test.