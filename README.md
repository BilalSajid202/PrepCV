# PrepCV

PrepCV is organized as a small monorepo:

```text
PrepCV/
├── backend/
│   ├── app/
│   │   ├── business_logic/    # Rules and use cases
│   │   ├── core/              # Configuration and shared dependencies
│   │   ├── database/           # PostgreSQL engine and session management
│   │   ├── edge_cases/        # Validation and exceptional conditions
│   │   ├── endpoints/         # HTTP routes, one folder per endpoint
│   │   ├── function_calls/    # Application-facing calls to basic functions
│   │   ├── functions/         # Small reusable functions with no HTTP concerns
│   │   ├── integrations/       # External services such as Claude API
│   │   └── main.py
│   ├── tests/
│   ├── requirements.txt
│   └── .env.example
└── frontend/                  # Next.js App Router application
```

## Local development

### Backend

```bash
cd backend
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
python run.py
```

The sample endpoint is available at `http://localhost:8000/api/health`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend is available at `http://localhost:3000`.

## Backend layering

Endpoints translate HTTP requests and responses. They call business logic, which coordinates `function_calls`; those adapters call reusable functions. Edge-case validation stays separate so business rules remain easy to read and test.