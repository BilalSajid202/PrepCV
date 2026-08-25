# PrepCV

**AI-Powered ATS Resume Builder** — Upload your CV or enter data manually, and let AI format it into a professional, ATS-optimized profile tailored for your target job role.

## Features

- **CV Upload & AI Extraction** — Upload a PDF/DOCX resume; the system extracts text, parses it into structured data, and formats it using Google Gemini Flash
- **Target Job Title Prompt** — After uploading a CV or clicking "Format with AI", a modal asks for your target position (e.g., "AI Engineer") so the AI can tailor content for that role
- **✨ Format with AI** — One-click button to send manually-entered profile data through Gemini Flash for professional ATS enhancement (sanitized prompts, forced JSON schema output, Pydantic validation)
- **Auto-Save to Database** — Both CV upload and AI formatting automatically validate with Pydantic and save the result to your profile in PostgreSQL
- **Pure Data -> Dynamic ATS Resume (No Second LLM Call)** — Once data is formatted and saved to the DB, the resume is directly rendered into an ATS-compliant dynamic HTML template with automatic content-density scaling (spacious, normal, compact, dense)
- **Live HTML Preview & One-Click Download** — Interactive live preview in the resume editor and instant download of the standalone ATS HTML file or PDF
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
│   │   ├── integrations/      # External services (Gemini)
│   │   │   └── gemini/        # Gemini client with prompt sanitization & schema validation
│   │   ├── templates/         # Jinja2 ATS dynamic resume HTML template
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
| `GEMINI_API_KEY` | Google Gemini API key for CV extraction, profile formatting, and bullet enhancement |
| `XAI_API_KEY` | Optional xAI API key |

> **Note:** Without `GEMINI_API_KEY`, CV upload and "Format with AI" fall back to a deterministic heuristic parser.

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
| `POST` | `/api/resumes/generate` | Generate ATS-optimized resume (pure data -> template) |
| `GET` | `/api/resumes` | List all user resumes |
| `GET` | `/api/resumes/:id` | Get a specific resume |
| `GET` | `/api/resumes/:id/html` | Render standalone dynamic ATS HTML template |
| `PUT` | `/api/resumes/:id` | Update resume title/content |
| `POST` | `/api/resumes/ai-improve` | AI-improve a specific bullet point |

## Backend Layering

Endpoints translate HTTP requests and responses. They call business logic, which coordinates `function_calls`; those adapters call reusable functions. Edge-case validation stays separate so business rules remain easy to read and test.