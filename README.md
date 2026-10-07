# Skill Gap Analyzer

Skill Gap Analyzer is a full-stack career readiness application featuring a modern vanilla JavaScript frontend, a high-performance **Python (FastAPI)** backend, and **Supabase (PostgreSQL)** for secure database persistence and authentication data.

Users can register with email and password or sign in with GitHub OAuth. Each user's career profile, target job analyses, customized learning plan, and UI settings are stored privately in Supabase PostgreSQL tables.

---

## Architecture Overview

- **Frontend**: Vanilla HTML5, CSS3, and modern JavaScript (ES Modules). Single-page application with responsive radar charts, skill extraction engine, what-if simulators, and career plan trackers.
- **Backend**: Python 3.11+ with **FastAPI**, Starlette sessions, Argon2 password hashing via `pwdlib`, and GitHub OAuth integration via `Authlib`.
- **Database**: **Supabase PostgreSQL** accessed via the official async `supabase` Python client (`postgrest`), configured with Row Level Security (RLS) and schema validation.
- **Deployment**: Ready for **Render** (via `render.yaml` Blueprint) and **Supabase**.

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
```

> **Note for Local Testing**: If `SUPABASE_URL` is not set, the backend automatically falls back to an in-memory database adapter for local development and testing.

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

## Deploy to Render & Supabase

1. Push your repository to GitHub.
2. Ensure your Supabase database schema is executed using `supabase_schema.sql`.
3. In **Render** (<https://render.com>):
   - Click **New** → **Blueprint** and connect your repository.
   - Render detects `render.yaml` automatically.
4. In the Render Dashboard environment settings for your service:
   - Set `APP_BASE_URL` to your Render production URL (e.g., `https://skill-gap-analyzer.onrender.com`).
   - Set `SUPABASE_URL` to your Supabase project URL.
   - Set `SUPABASE_KEY` to your Supabase service role key.
   - Optionally add `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.
5. Trigger deploy. Render will build and launch your full-stack application!

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
- **Interactive Skill Gap Engine**: 75+ skill taxonomy, job description parsing, readiness score calculation, radar visualization, what-if simulators, and personalized learning roadmap.
- **Local-to-Cloud Migration**: Detects previous offline browser localStorage data and allows one-click migration to the user's Supabase account upon signup.
