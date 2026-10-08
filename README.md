# Skill Gap Analyzer

Skill Gap Analyzer is a full-stack career readiness application featuring a modern vanilla JavaScript frontend, a high-performance **Python (FastAPI)** backend, and **Supabase (PostgreSQL)** for secure database persistence and authentication data.

Users can register with email and password or sign in with GitHub OAuth. Each user's career profile, target job analyses, customized learning plan, and UI settings are stored privately in Supabase PostgreSQL tables.

---

## Architecture Overview

- **Frontend**: Vanilla HTML5, CSS3, and modern JavaScript (ES Modules). Single-page application with responsive radar charts, skill extraction engine, what-if simulators, and career plan trackers.
- **Backend**: Python 3.11+ with **FastAPI**, Starlette sessions, Argon2 password hashing via `pwdlib`, and GitHub OAuth integration via `Authlib`.
- **Database**: **Supabase PostgreSQL** accessed via the official async `supabase` Python client (`postgrest`), configured with Row Level Security (RLS) and schema validation.
- **AI guidance**: Optional, authenticated career recommendations generated with the **Gemini API**. The API key stays on the backend.
- **Deployment**: **Netlify** serves the static frontend and proxies `/api/*` requests to the **Render** FastAPI backend; **Supabase** stores account data.

---

## Quick Start (Local Development)

### 1. Prerequisites
- Python 3.11+ installed (`python --version`)
- A free [Supabase](https://supabase.com) account (or local in-memory fallback for immediate testing)

### 2. Set Up Python Environment

```powershell
# Navigate into the project folder
cd "C:\path\to\skill-gap-analyzer"

# Create and activate a virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install backend dependencies
python -m pip install -r requirements.txt
```

### 3. Configure Supabase

1. Go to [Supabase](https://supabase.com) and create a new project.
2. In your Supabase Project Dashboard, navigate to the **SQL Editor**.
3. Open [`supabase_schema.sql`](supabase_schema.sql) from this repository, paste its contents into the SQL Editor, and click **Run**. This provisions:
   - `public.users`: Stores account credentials and identity profiles.
   - `public.user_data`: Stores user skills, analysis histories, and learning plans.
   - Associated indexes and Row Level Security (RLS) policies.
4. In your Supabase Project Settings → **API**:
   - Copy your **Project URL** (`https://<project-ref>.supabase.co`).
   - Copy your **Project API keys** (use the `service_role` secret or `anon` key).

### 4. Configure Environment Variables

Copy the example configuration:

```powershell
Copy-Item .env.example .env
```

Generate a secure session secret:
```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Edit `.env` and set:
```env
APP_ENV=development
APP_BASE_URL=http://localhost:8000
SESSION_SECRET=<paste_your_generated_secret_here>
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_KEY=your-supabase-service-role-or-anon-key
GEMINI_API_KEY=<your_google_ai_studio_api_key>
```

> **Note for Local Testing**: If `SUPABASE_URL` is not set, the backend automatically falls back to an in-memory database adapter for local development and testing.

To enable AI career guidance, create a key in [Google AI Studio](https://aistudio.google.com/apikey) and set `GEMINI_API_KEY` in `.env`. `GEMINI_MODEL` defaults to `gemini-2.5-flash` and can be overridden if that model is unavailable to your account. The browser never receives the key. When a user requests guidance, the backend sends Gemini the role title, readiness score, detected skill groups, and skill levels/years; it does **not** send the full job description, account email, or account ID. Google's free-tier terms state prompts may be used to improve Google products; review the [Gemini API terms](https://ai.google.dev/gemini-api/terms) before enabling it. Free-tier availability and quotas can change.

### 5. Start the Server

```powershell
uvicorn backend.main:app --reload --port 8000
```

Open your browser at <http://localhost:8000>.
- API Health Check: <http://localhost:8000/api/health>
- Interactive API Docs (Swagger): <http://localhost:8000/docs>

---

## GitHub Sign-In (Optional)

To enable GitHub sign-in:

1. In GitHub, go to **Settings** → **Developer settings** → **OAuth Apps** → **New OAuth App**.
2. Fill in:
   - **Application name**: `Skill Gap Analyzer`
   - **Homepage URL**: `http://localhost:8000`
   - **Authorization callback URL**: `http://localhost:8000/api/auth/github/callback`
3. Generate a client secret and add both to `.env`:
   ```env
   GITHUB_CLIENT_ID=your_github_client_id
   GITHUB_CLIENT_SECRET=your_github_client_secret
   ```

---

## Deploy to Netlify, Render & Supabase

1. Push the repository to GitHub and run [`supabase_schema.sql`](supabase_schema.sql) in your Supabase SQL Editor.
2. In **Netlify** (<https://netlify.com>), import the repository. Netlify reads `netlify.toml`, copies only `index.html`, `styles.css`, and `js/` into the published `dist/` folder, and routes `/api/*` through to the backend. This keeps `.env` and Python source files out of the published site.
3. In **Render** (<https://render.com>), create a Blueprint from the same repository. Render detects `render.yaml` and deploys the FastAPI backend.
4. In the Render service environment settings, set:
   - `APP_BASE_URL` to your Netlify site's primary HTTPS URL (for example, `https://your-site.netlify.app`).
   - `SUPABASE_URL` and `SUPABASE_KEY` to your Supabase project settings.
   - `GEMINI_API_KEY` to your Google AI Studio key to enable AI guidance.
   - Optionally, `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.
5. The proxy target in [`netlify.toml`](netlify.toml) defaults to `https://skill-gap-analyzer.onrender.com`, matching this repository's Render service name. If Render assigns your service another hostname, update the `/api/*` redirect target in that file and redeploy Netlify.
6. For GitHub sign-in, set the OAuth app callback URL to `https://your-site.netlify.app/api/auth/github/callback`. Redeploy the Render backend after setting `APP_BASE_URL` and any secrets.

Netlify hosts the frontend; it does not run this Python/FastAPI backend. The API remains on Render, and Netlify's same-origin proxy preserves the app's session-cookie flow. For local development, the existing FastAPI server continues to serve both the frontend and API directly.

---

## Running Tests

Run frontend parser/extractor tests:
```bash
node tests/extractor.test.mjs
```

Run backend FastAPI & Supabase database adapter unit tests:
```bash
python -m unittest discover -s backend/tests -v
```

---

## Key Features

- **End-to-End Full Stack**: Python FastAPI serving API and static frontend seamlessly with zero CORS issues.
- **Supabase PostgreSQL Persistence**: Scalable relational database storage with foreign key constraints, indexes, and RLS.
- **Robust Security**: Argon2 password hashing, HttpOnly session cookies, Lax same-site policies, and CSRF / origin validation on mutating requests.
- **Optional Gemini Career Guidance**: Generates a practical skills summary and first-week plan from the role and profile summary, without sending the full job description or account identifiers.
- **Interactive Skill Gap Engine**: 75+ skill taxonomy, job description parsing, readiness score calculation, radar visualization, what-if simulators, and personalized learning roadmap.
- **Local-to-Cloud Migration**: Detects previous offline browser localStorage data and allows one-click migration to the user's Supabase account upon signup.
